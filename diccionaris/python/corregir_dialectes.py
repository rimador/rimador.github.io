"""
EINA LOCAL. Corregir els altres dialectes de les entrades on has editat el
central: les que el comparar_aina.py troba diferents de l'API de l'Aina.

    python3 diccionaris/python/corregir_dialectes.py

Engega un servidor a http://localhost:8772 i obre la pàgina al navegador
(--port, --sense-navegador i --aina si cal). Ctrl+C per aturar-lo.

QUÈ ENSENYA. Cada entrada amb el central editat, amb els quatre dialectes com
són ara i, sota de cadascun, què en deia l'Aina i què hi has canviat. Tres
piles:

    per mirar     els altres dialectes encara diuen el que deia l'Aina
    ja tocades    algun altre dialecte ja no ho diu (ja hi has passat, o es
                  van agafar d'una altra banda)
    revisades     les que ja has desat o has donat per bones

QUÈ TOCA. Només les transcripcions de la col_10 del diccionari, i ho desa amb
el Fitxer del corregir_transcripcions.py: fitxer temporal i reemplaçament, i
si algú l'ha tocat per fora des que la tens a la pantalla, no desa res i et
diu que tornis a carregar. Ni commit ni push: en acabar, comiteja la col_10 i
el workflow refà la resta.

LES REVISADES es guarden a corregir_dialectes.revisades.txt, una per línia
(paraula$lema$codi$central). El central hi és a posta: si el tornes a editar,
l'entrada torna a sortir per mirar.
"""

import argparse
import json
import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DIR_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if DIR_SCRIPTS not in sys.path:
    sys.path.insert(0, DIR_SCRIPTS)

import camins
import col_10 as modul_col_10
from comparar_aina import DIR_AINA, comparar, llegir_aina
from comparar_aina import entrada as entrada_de
from columnes import INVENTARI
from corregir_transcripcions import (NOMS_DIALECTES, ORDRE_DEL_DICCIONARI, DadesDelDiccionari,
                                     Fitxer, problemes)

PAGINA = os.path.join(DIR_SCRIPTS, "corregir_dialectes.html")
REVISADES = os.path.join(DIR_SCRIPTS, "corregir_dialectes.revisades.txt")
PORT = 8772
PER_PAGINA = 40
FILTRES = ("pendents", "tocades", "revisades", "totes")


def clau(e):
    return "$".join([e["paraula"], e["lema"], e["codi"], e["ara"].get(camins.CENTRAL, "")])


def llegir_revisades():
    if not os.path.exists(REVISADES):
        return set()
    with open(REVISADES, encoding="utf-8") as fitxer:
        return {linia.rstrip("\n") for linia in fitxer if linia.strip()}


def escriure_revisades(revisades):
    with open(REVISADES + ".desant", "w", encoding="utf-8") as sortida:
        sortida.write("".join(f"{c}\n" for c in sorted(revisades)))
    os.replace(REVISADES + ".desant", REVISADES)


class Servidor:
    def __init__(self, dir_aina):
        print("Llegint l'Aina…", flush=True)
        self.aina = llegir_aina(dir_aina)
        print("Llegint la col_10…", flush=True)
        self.fitxer = Fitxer("dicc", camins.COL_10, "diccionari", DadesDelDiccionari(),
                             ORDRE_DEL_DICCIONARI)
        self.revisades = llegir_revisades()
        self.pany = threading.Lock()
        self._refer()
        c = self.comptes()
        print(f"  {camins.mil(c['totes'])} entrades amb el central editat: "
              f"{camins.mil(c['pendents'])} per mirar, {camins.mil(c['tocades'])} ja tocades, "
              f"{camins.mil(c['revisades'])} revisades")

    def _refer(self):
        self.editades, self.sense_aina = comparar(self.fitxer.linies, self.aina)
        self.mtime = self.fitxer.mtime

    def _al_dia(self):
        """Si algú ha tocat la col_10 per fora, es torna a llegir i a comparar."""
        self.fitxer.al_dia()
        if self.fitxer.mtime != self.mtime:
            self._refer()

    def _pila(self, e):
        if clau(e) in self.revisades:
            return "revisades"
        return "tocades" if e["tocats"] else "pendents"

    def comptes(self):
        comptes = dict.fromkeys(FILTRES, 0)
        for e in self.editades:
            comptes[self._pila(e)] += 1
        comptes["totes"] = len(self.editades)
        return comptes

    def _amb_estat(self, e):
        return {**e, "revisada": clau(e) in self.revisades}

    def llista(self, filtre, des_de):
        with self.pany:
            self._al_dia()
            triades = [e for e in self.editades if filtre == "totes" or self._pila(e) == filtre]
            return {
                "total": len(triades),
                "des_de": des_de,
                "entrades": [self._amb_estat(e) for e in triades[des_de:des_de + PER_PAGINA]],
                "comptes": self.comptes(),
                "sense_aina": self.sense_aina,
                "per_pagina": PER_PAGINA,
            }

    def _trobar(self, peticio):
        """La fila de la petició, si encara és la que hi ha a la pantalla.
        Torna (fila, None) o (None, (codi, resposta))."""
        try:
            fila = int(peticio.get("fila"))
        except (TypeError, ValueError):
            return None, (400, {"error": "Falta la fila."})
        if not 0 <= fila < len(self.fitxer.linies) or self.fitxer.linies[fila] != peticio.get("linia"):
            return None, (409, {"error": "Aquesta entrada ha canviat des que la tens a la "
                                         "pantalla. Torna a carregar la pàgina."})
        return fila, None

    def desar(self, peticio):
        noves = peticio.get("transcripcions")
        if not isinstance(noves, dict):
            return 400, {"error": "Falten les transcripcions."}
        errors = {codi: problemes(str(valor)) for codi, valor in noves.items()}
        errors = {codi: llista for codi, llista in errors.items() if llista}
        if errors:
            return 400, {"error": "; ".join(f"{NOMS_DIALECTES.get(codi, codi)}: {', '.join(e)}"
                                            for codi, e in errors.items())}
        with self.pany:
            self._al_dia()
            fila, error = self._trobar(peticio)
            if error:
                return error
            linia = self.fitxer.linies[fila]
            trossos = modul_col_10.TROS.split(linia)
            nova = trossos[0] + "".join(modul_col_10.marca(codi) + noves.get(codi, valor)
                                        for codi, valor in zip(trossos[1::2], trossos[2::2]))
            try:
                if nova != linia:
                    self.fitxer.desar(fila, nova)
            except OSError as e:
                self._refer()
                return 500, {"error": f"No s'ha pogut desar: {e}"}

            # Només canvia aquesta entrada: no cal tornar a comparar-ho tot.
            nou = entrada_de(fila, nova, self.aina)
            index = next(i for i, e in enumerate(self.editades) if e["fila"] == fila)
            if nou["ara"].get(camins.CENTRAL) == nou["aina"].get(camins.CENTRAL):
                del self.editades[index]          # el central torna a ser el de l'Aina
            else:
                self.editades[index] = nou
                self.revisades.add(clau(nou))
                escriure_revisades(self.revisades)
            self.mtime = self.fitxer.mtime
            return 200, {"entrada": self._amb_estat(nou), "comptes": self.comptes(),
                         "desat": nova != linia}

    def revisar(self, peticio):
        with self.pany:
            self._al_dia()
            fila, error = self._trobar(peticio)
            if error:
                return error
            e = next(e for e in self.editades if e["fila"] == fila)
            if peticio.get("revisada"):
                self.revisades.add(clau(e))
            else:
                self.revisades.discard(clau(e))
            escriure_revisades(self.revisades)
            return 200, {"entrada": self._amb_estat(e), "comptes": self.comptes()}

    def configuracio(self):
        return {"dialectes": NOMS_DIALECTES, "central": camins.CENTRAL,
                "inventari": "".join(sorted(INVENTARI))}


def fer_handler(servidor):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def _json(self, codi, dades):
            cos = json.dumps(dades, ensure_ascii=False).encode("utf-8")
            self.send_response(codi)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(cos)))
            self.end_headers()
            self.wfile.write(cos)

        def do_GET(self):
            url = urlparse(self.path)
            if url.path == "/":
                with open(PAGINA, "rb") as fitxer:
                    cos = fitxer.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(cos)))
                self.end_headers()
                self.wfile.write(cos)
            elif url.path == "/api/configuracio":
                self._json(200, servidor.configuracio())
            elif url.path == "/api/llista":
                consulta = parse_qs(url.query)
                filtre = consulta.get("filtre", ["pendents"])[0]
                if filtre not in FILTRES:
                    return self._json(400, {"error": f"El filtre ha de ser {', '.join(FILTRES)}."})
                try:
                    des_de = max(0, int(consulta.get("des_de", ["0"])[0]))
                except ValueError:
                    return self._json(400, {"error": "des_de ha de ser un número."})
                self._json(200, servidor.llista(filtre, des_de))
            else:
                self._json(404, {"error": "no hi és"})

        def do_POST(self):
            cami = urlparse(self.path).path
            if cami not in ("/api/desa", "/api/revisada"):
                return self._json(404, {"error": "no hi és"})
            llargada = int(self.headers.get("Content-Length", 0))
            try:
                peticio = json.loads(self.rfile.read(llargada) or b"{}")
            except json.JSONDecodeError:
                return self._json(400, {"error": "La petició no és JSON."})
            if cami == "/api/desa":
                self._json(*servidor.desar(peticio))
            else:
                self._json(*servidor.revisar(peticio))

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Corregir els dialectes de les entrades "
                                                 "amb el central editat.")
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--sense-navegador", action="store_true")
    parser.add_argument("--aina", default=DIR_AINA,
                        help="el directori on va córrer l'api_aina.py")
    opcions = parser.parse_args()

    servidor = Servidor(opcions.aina)
    # Només localhost: aquesta pàgina escriu al repositori.
    http = ThreadingHTTPServer(("127.0.0.1", opcions.port), fer_handler(servidor))
    adreca = f"http://localhost:{opcions.port}"
    print(f"\nObert a {adreca}  (Ctrl+C per aturar-lo)")
    print("Recorda: git pull abans de començar, i commit de la col_10 en acabar.\n")
    if not opcions.sense_navegador:
        webbrowser.open(adreca)
    try:
        http.serve_forever()
    except KeyboardInterrupt:
        print("\nAturat.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
