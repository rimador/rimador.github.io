"""
EINA LOCAL. Cercar una paraula, veure com sona a cada dialecte i corregir-ho.

    python3 diccionaris/python/corregir_transcripcions.py

Engega un servidor a http://localhost:8771 i obre la pàgina al navegador. No
porta arguments (--port i --sense-navegador si cal). Ctrl+C per aturar-lo.

QUÈ TOCA. Només les transcripcions de les col_10: la del diccionari
(diccionaris/col_10.txt, els quatre dialectes) i les dels apendixs
(dialectes_col/<codi>/apendix/col_10_<codi>.txt, un sol dialecte). La paraula,
el lema i el codi no s'hi poden canviar: aquests també són al diccionari, i
qui els posa d'acord és el sincronitzar.py. Per a això, l'editor de sempre.

QUÈ NO FA. Ni commit ni push. Quan acabes, comitejes la col_10 com sempre i el
workflow refà la resta. Abans d'engegar-la, un git pull: si el workflow ha
comitejat una col_10 nova i corregeixes sobre la vella, el sincronitzar.py hi
veurà un conflicte.

COM DESA. La col_10 del diccionari fa 67 MB i té mig milió de línies: es llegeix
sencera en engegar i a cada correcció es reescriu sencera, primer a un fitxer
temporal i després reemplaçant l'original, perquè un Ctrl+C a mitges no la
deixi tallada. Abans de desar es mira si algú l'ha tocat per fora (el git, un
editor): si és així es torna a llegir, i si la línia ja no és la que tenies a la
pantalla no es desa res i et diu que tornis a cercar.

Les rimes que surten a la pàgina es calculen amb calcular_rimes() del
columnes.py, la mateixa funció que les publica, i els símbols es comproven amb
el seu INVENTARI: un símbol que no hi sigui, la rima assonant se'l menjaria.
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
from afegir_paraula import clau_dordre
from columnes import ACCENT, INVENTARI, VOCALS, calcular_rimes

PAGINA = os.path.join(DIR_SCRIPTS, "corregir_transcripcions.html")
PORT = 8771
MAX_RESULTATS = 60
# Les de "comença per" i "acaba per" van per pàgines: en una cerca com "acaba
# en -ció" hi ha milers d'entrades, i cada targeta són quatre camps editables.
PER_PAGINA = 50
MODES = ("exacta", "comenca", "acaba")

NOMS_DIALECTES = {"ca": "central", "nw": "nord-occidental", "va": "valencià", "ba": "balear"}


ENLLACOS = ("Vicc", "Viq", "Diec")


def enllacos_del_diccionari():
    """Els tres últims camps del diccionari: Vicc, Viq i Diec, o NO. Van fila
    per fila amb la col_10."""
    enllacos = []
    for linia in camins.llegir_columna(camins.DICCIONARI):
        if linia:
            enllacos.append(tuple(linia.split("$")[4:7]))
    return enllacos


def enllacos_de_lapendix(codi):
    """A l'apendix són les col_6, 7 i 8, que van fila per fila amb la seva col_10."""
    return list(zip(*(camins.llegir_columna(camins.cami_apendix(codi, numero))
                      for numero in (6, 7, 8))))


class Fitxer:
    """Una col_10 a la memòria: les línies tal com són i un índex per paraula.

    Les línies no es parteixen fins que algú les demana: mig milió de llistes
    de camps serien uns quants centenars de MB per no res.

    Al costat, si la paraula té entrada al Viccionari, a la Viquipèdia i al
    DIEC. Això no és a la col_10 sinó al diccionari (o a les col_6 a 8 de
    l'apendix), i per això es llegeix a part i es torna a llegir quan canvia."""

    def __init__(self, clau, cami, etiqueta, camins_enllacos, llegir_enllacos):
        self.clau = clau
        self.cami = cami
        self.etiqueta = etiqueta
        self.camins_enllacos = camins_enllacos
        self.llegir_enllacos = llegir_enllacos
        self.carregar()

    def mtimes(self):
        return [os.path.getmtime(cami) for cami in (self.cami, *self.camins_enllacos)]

    def carregar(self):
        self.linies = camins.llegir_columna(self.cami)
        self.mtime = self.mtimes()
        self.enllacos = self.llegir_enllacos()
        if len(self.enllacos) != len(self.linies):
            # A mig editar (una paraula donada d'alta a la col_10 i encara no al
            # diccionari, per exemple) les files no quadren i no se sap quin
            # enllaç és de qui. Millor no ensenyar-ne cap que ensenyar-los malament.
            print(f"  (avís: {camins.relatiu(self.cami)} té {camins.mil(len(self.linies))} "
                  f"línies i els enllaços {camins.mil(len(self.enllacos))}: no se n'ensenyaran)")
            self.enllacos = None
        self.per_paraula = {}
        self.per_clau = {}
        for fila, linia in enumerate(self.linies):
            paraula = linia.split(modul_col_10.SEPARADOR, 1)[0]
            self.per_paraula.setdefault(paraula.lower(), []).append(fila)
            self.per_clau.setdefault(clau_dordre(paraula), []).append(fila)

    def al_dia(self):
        """Si algú l'ha tocat per fora des que l'hem llegida, la tornem a llegir."""
        if self.mtimes() != self.mtime:
            self.carregar()

    def entrada(self, fila):
        linia = self.linies[fila]
        trossos = modul_col_10.TROS.split(linia)
        paraula, lema, codi = trossos[0].split(modul_col_10.SEPARADOR)
        return {
            "fitxer": self.clau,
            "etiqueta": self.etiqueta,
            "fila": fila,
            "linia": linia,
            "paraula": paraula,
            "lema": lema,
            "codi": codi,
            "transcripcions": dict(zip(trossos[1::2], trossos[2::2])),
            "enllacos": None if self.enllacos is None else
                        {nom: valor == nom for nom, valor in zip(ENLLACOS, self.enllacos[fila])},
        }

    def desar(self, fila, linia):
        self.linies[fila] = linia
        temporal = self.cami + ".desant"
        with open(temporal, "w", encoding="utf-8") as sortida:
            sortida.write("\n".join(self.linies))
        os.replace(temporal, self.cami)
        self.mtime = self.mtimes()


def carregar_fitxers():
    fitxers = {"dicc": Fitxer("dicc", camins.COL_10, "diccionari",
                              [camins.DICCIONARI], enllacos_del_diccionari)}
    for codi in camins.dialectes_amb_apendix():
        cami = camins.cami_col_10_apendix(codi)
        if os.path.exists(cami):
            nom = NOMS_DIALECTES.get(codi, codi)
            fitxers[codi] = Fitxer(codi, cami, f"apèndix {nom}",
                                   [camins.cami_apendix(codi, numero) for numero in (6, 7, 8)],
                                   lambda codi=codi: enllacos_de_lapendix(codi))
    return fitxers


def problemes(transcripcio):
    """El que impedeix desar-la. Torna una llista de textos (buida si va bé)."""
    errors = []
    if not transcripcio.strip():
        errors.append("és buida")
    if transcripcio != transcripcio.strip():
        errors.append("té espais al davant o al darrere")
    estranys = sorted(set(transcripcio) - INVENTARI)
    if estranys:
        errors.append("hi ha símbols que no són a l'inventari: " + " ".join(estranys))
    return errors


def rimes(transcripcio):
    consonant, assonant = calcular_rimes(transcripcio)
    return {"consonant": consonant, "assonant": assonant,
            "sense_accent": ACCENT not in transcripcio}


def amb_rimes(entrada):
    entrada["rimes"] = {codi: rimes(valor) for codi, valor in entrada["transcripcions"].items()}
    return entrada


class Servidor:
    def __init__(self):
        print("Llegint les col_10…", flush=True)
        self.fitxers = carregar_fitxers()
        self.pany = threading.Lock()
        for fitxer in self.fitxers.values():
            print(f"  {camins.relatiu(fitxer.cami)}: {camins.mil(len(fitxer.linies))} línies")

    def cercar(self, text, mode="exacta", des_de=0):
        """Tres maneres, i totes sense mirar majúscules:

            exacta    la paraula tal com l'has escrita, accents inclosos. Si no
                      n'hi ha cap, et proposa les que s'hi assemblen
            comenca   les entrades de les paraules que comencen així
            acaba     les entrades de les paraules que acaben així

        Les dues últimes per ordre alfabètic i de PER_PAGINA en PER_PAGINA,
        començant per la des_de."""
        text = text.strip()
        if not text:
            return {"resultats": []}
        with self.pany:
            for fitxer in self.fitxers.values():
                fitxer.al_dia()
            if mode in ("comenca", "acaba"):
                return self._entrades_que(mode, text.lower(), des_de)

            resultats = self._buscar(lambda f: f.per_paraula.get(text.lower(), []))
            if not resultats:
                return {"resultats": self._semblants(clau_dordre(text)), "suggeriments": True}
        return {"resultats": [amb_rimes(entrada) for entrada in resultats]}

    def _entrades_que(self, mode, text, des_de):
        trobades = []
        for ordre, fitxer in enumerate(self.fitxers.values()):
            for minuscula, files in fitxer.per_paraula.items():
                if minuscula.startswith(text) if mode == "comenca" else minuscula.endswith(text):
                    paraula = fitxer.linies[files[0]].split(modul_col_10.SEPARADOR, 1)[0]
                    # Les entrades d'una mateixa paraula juntes, primer les del
                    # diccionari i després les dels apendixs, i cadascuna per fila.
                    clau = (clau_dordre(paraula), paraula, ordre)
                    trobades.extend((clau, fila, fitxer) for fila in files)
        trobades.sort(key=lambda trobada: trobada[:2])
        pagina = trobades[des_de:des_de + PER_PAGINA]
        return {"resultats": [amb_rimes(fitxer.entrada(fila)) for _, fila, fitxer in pagina],
                "total": len(trobades), "des_de": des_de}

    def _buscar(self, files_de):
        resultats = []
        for fitxer in self.fitxers.values():
            for fila in files_de(fitxer):
                resultats.append(fitxer.entrada(fila))
        return resultats[:MAX_RESULTATS]

    def _semblants(self, clau):
        """Quan la cerca exacta no troba res: les que només canvien d'accents,
        majúscules o guions ("pages" -> "pagès") i les que ho contenen
        ("hertogenb" -> "'s-Hertogenbosch"). Primer les que s'hi assemblen més."""
        if not clau:
            return []
        trobades = set()
        for fitxer in self.fitxers.values():
            for clau_seva, files in fitxer.per_clau.items():
                if clau_seva == clau or (len(clau) >= 3 and clau in clau_seva):
                    trobades.add(fitxer.linies[files[0]].split(modul_col_10.SEPARADOR, 1)[0])
        ordenades = sorted(trobades, key=lambda paraula: (clau_dordre(paraula) != clau,
                                                          not clau_dordre(paraula).startswith(clau),
                                                          len(paraula), paraula))
        return [{"suggeriment": paraula} for paraula in ordenades[:MAX_RESULTATS]]

    def desar(self, peticio):
        fitxer = self.fitxers.get(peticio.get("fitxer"))
        if fitxer is None:
            return 400, {"error": "Aquest fitxer no el conec."}
        fila = peticio.get("fila")
        noves = peticio.get("transcripcions") or {}

        with self.pany:
            fitxer.al_dia()
            if not isinstance(fila, int) or not 0 <= fila < len(fitxer.linies) \
                    or fitxer.linies[fila] != peticio.get("linia"):
                return 409, {"error": "Aquesta línia ha canviat des que l'has cercada "
                                      "(algú ha tocat el fitxer). Torna a cercar la paraula."}

            entrada = fitxer.entrada(fila)
            actuals = entrada["transcripcions"]
            if set(noves) != set(actuals):
                return 400, {"error": "Els dialectes no són els de la línia."}
            errors = {codi: problemes(valor) for codi, valor in noves.items()}
            errors = {codi: llista for codi, llista in errors.items() if llista}
            if errors:
                return 400, {"error": "; ".join(f"{codi}: {', '.join(llista)}"
                                                for codi, llista in errors.items())}
            if noves == actuals:
                return 200, {"entrada": entrada, "canviat": False}

            # Es reconstrueix amb l'ordre de dialectes que ja hi havia, igual que
            # fa col_10.escriure(): així el diff només ensenya el que has canviat.
            linia = modul_col_10.SEPARADOR.join([entrada["paraula"], entrada["lema"], entrada["codi"]])
            for codi in actuals:
                linia += modul_col_10.marca(codi) + noves[codi]
            fitxer.desar(fila, linia)
            nova = fitxer.entrada(fila)

        amb_rimes(nova)
        canvis = ", ".join(f"{codi} {actuals[codi]} → {noves[codi]}"
                           for codi in actuals if actuals[codi] != noves[codi])
        print(f"  desat: {entrada['paraula']} ({entrada['codi']}, {fitxer.etiqueta}, "
              f"fila {fila + 1}): {canvis}", flush=True)
        return 200, {"entrada": nova, "canviat": True}

    def configuracio(self):
        return {"dialectes": NOMS_DIALECTES, "vocals": VOCALS, "accent": ACCENT,
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
            elif url.path == "/api/cerca":
                consulta = parse_qs(url.query)
                text = consulta.get("q", [""])[0]
                mode = consulta.get("mode", ["exacta"])[0]
                if mode not in MODES:
                    return self._json(400, {"error": f"El mode ha de ser {', '.join(MODES)}."})
                try:
                    des_de = max(0, int(consulta.get("des_de", ["0"])[0]))
                except ValueError:
                    return self._json(400, {"error": "des_de ha de ser un número."})
                self._json(200, servidor.cercar(text, mode, des_de))
            else:
                self._json(404, {"error": "no hi és"})

        def do_POST(self):
            if urlparse(self.path).path != "/api/desa":
                return self._json(404, {"error": "no hi és"})
            llargada = int(self.headers.get("Content-Length", 0))
            try:
                peticio = json.loads(self.rfile.read(llargada) or b"{}")
            except json.JSONDecodeError:
                return self._json(400, {"error": "La petició no és JSON."})
            self._json(*servidor.desar(peticio))

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Corregir transcripcions de les col_10.")
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--sense-navegador", action="store_true")
    opcions = parser.parse_args()

    servidor = Servidor()
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
