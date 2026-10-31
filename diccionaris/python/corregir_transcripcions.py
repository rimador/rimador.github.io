"""
EINA LOCAL. Cercar una paraula, veure com sona a cada dialecte i corregir-ho.
També totes les formes d'un lema o totes les paraules que fan una rima.

    python3 diccionaris/python/corregir_transcripcions.py

Engega un servidor a http://localhost:8771 i obre la pàgina al navegador. No
porta arguments (--port i --sense-navegador si cal). Ctrl+C per aturar-lo.

QUÈ TOCA. Tots els camps d'una entrada: la paraula, el lema, el codi, les
síl·labes, els enllaços (Vicc, Viq i Diec) i la transcripció de cada dialecte.
Cadascun va on ja és:

    del diccionari    la col_10 (diccionaris/col_10.txt, els quatre dialectes)
                      i el diccionari.5.2.3.txt, a la mateixa fila
    d'un apendix      la seva col_10 (dialectes_col/<codi>/apendix/
                      col_10_<codi>.txt, un sol dialecte) i les seves col_5 a 8

La paraula, el lema i el codi del diccionari són als DOS fitxers, i es canvien
als dos igual: així el sincronitzar.py hi veu el mateix canvi a banda i banda i
no hi ha res a resoldre. Si aquella fila no diu el mateix al diccionari que a
la col_10 (algú n'ha tocat un a mà i el sincronitzar.py encara no hi ha
passat), no se sap qui té raó i només se n'hi poden corregir les
transcripcions. A l'apendix la identitat només és a la col_10, i les col_0, 1 i
2 ja les refarà el sincronitzar.py.

LA FILA NO ES MOU SI NO HO DEMANES. Quan canvies com s'escriu una paraula, la
pàgina et diu si per ordre alfabètic li tocaria un altre lloc i entre quines
paraules, i només hi va si ho marques. Es mou a tots els fitxers de la seva
banda alhora (la col_10 i el diccionari, o la col_10 i les col_5 a 8 de
l'apendix), i el sincronitzar.py ho veu com una fila que se'n va i una de nova
amb la mateixa transcripció. Moure-la sense canviar-la no es pot: per al
sincronitzar.py seria una reordenació, i s'aturaria.

QUÈ NO FA. Ni commit ni push. Quan acabes, comitejes la col_10 (i el
diccionari o les col_5 a 8, si n'has tocat res) i el workflow refà la resta.
Abans d'engegar-la, un git pull: si el workflow ha comitejat una col_10 nova i
corregeixes sobre la vella, el sincronitzar.py hi veurà un conflicte.

COM DESA. La col_10 del diccionari fa 67 MB i té mig milió de línies: es llegeix
sencera en engegar i a cada correcció es reescriu sencera, i el diccionari
també si hi has canviat res que hi sigui. Primer tots els fitxers temporals i
després tots els reemplaçaments, perquè un Ctrl+C a mitges no en deixi cap de
tallat. Abans de desar es mira si algú els ha tocat per fora (el git, un
editor, l'afegir_paraula.py): si és així es tornen a llegir, i si la fila ja no
és la que tenies a la pantalla no es desa res i et diu que tornis a cercar.

Les rimes que surten a la pàgina es calculen amb calcular_rimes() del
columnes.py, la mateixa funció que les publica, i els símbols es comproven amb
el seu INVENTARI: un símbol que no hi sigui, la rima assonant se'l menjaria.
"""

import argparse
import bisect
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
ON = ("paraula", "lema", "fonetica", "rima")
ACCENTS = ("ˈ", "ˌ")


def sense_accents(transcripcio):
    for accent in ACCENTS:
        transcripcio = transcripcio.replace(accent, "")
    return transcripcio


def normalitzar_fonetica(text):
    """El que s'escriu fàcil amb el teclat i a les transcripcions és un altre
    símbol: la g de l'IPA no és la g de sempre, i l'apòstrof fa d'accent."""
    return text.replace("g", "ɡ").replace("'", "ˈ").replace("’", "ˈ")

NOMS_DIALECTES = {"ca": "central", "nw": "nord-occidental", "va": "valencià", "ba": "balear"}


ENLLACOS = ("Vicc", "Viq", "Diec")
# Els set camps del diccionari, tal com es diuen als missatges.
NOMS_CAMPS = ("paraula", "lema", "codi", "síl·labes", *ENLLACOS)


class DadesDelDiccionari:
    """El que el diccionari sap d'una entrada i la col_10 no: les síl·labes i
    els enllaços. Van fila per fila amb la col_10.

    Les línies es guarden senceres, perquè la paraula, el lema i el codi també
    hi són: quan es corregeixen a la col_10, aquí s'hi han de canviar igual."""

    def __init__(self):
        self.camins = [camins.DICCIONARI]

    def llegir(self):
        # Les línies buides no són cap fila: llegir_diccionari() se les salta.
        self.linies = [linia for linia in camins.llegir_columna(camins.DICCIONARI) if linia]

    def files(self):
        return len(self.linies)

    def identitat(self, fila):
        return self.linies[fila].split("$")[:camins.CAMPS_IDENTITAT]

    def dades(self, fila):
        """Síl·labes, Vicc, Viq i Diec."""
        return self.linies[fila].split("$")[camins.CAMPS_IDENTITAT:]

    def posar(self, fila, camps):
        """Els set camps. Torna els camins que han canviat: cap, si ja deia això."""
        linia = "$".join(camps)
        if linia == self.linies[fila]:
            return []
        self.linies[fila] = linia
        return self.camins

    def moure(self, de, a):
        self.linies.insert(a, self.linies.pop(de))
        return self.camins

    def text(self, cami):
        # El diccionari SÍ que acaba amb salt de línia (vegeu camins.py).
        return "\n".join(self.linies) + "\n"


class DadesDeLapendix:
    """A l'apendix, les síl·labes i els enllaços són les col_5 a 8, fila per
    fila amb la seva col_10. La identitat només és a la col_10."""

    def __init__(self, codi):
        self.camins = [camins.cami_apendix(codi, numero) for numero in camins.APENDIX_A_MA]

    def llegir(self):
        self.columnes = [camins.llegir_columna(cami) for cami in self.camins]

    def files(self):
        """None si no en tenen totes les mateixes: llavors no quadren amb res."""
        mides = {len(columna) for columna in self.columnes}
        return mides.pop() if len(mides) == 1 else None

    def identitat(self, fila):
        return None

    def dades(self, fila):
        return [columna[fila] for columna in self.columnes]

    def posar(self, fila, camps):
        canviats = []
        for cami, columna, valor in zip(self.camins, self.columnes,
                                        camps[camins.CAMPS_IDENTITAT:]):
            if columna[fila] != valor:
                columna[fila] = valor
                canviats.append(cami)
        return canviats

    def moure(self, de, a):
        for columna in self.columnes:
            columna.insert(a, columna.pop(de))
        return self.camins

    def text(self, cami):
        return "\n".join(self.columnes[self.camins.index(cami)])


class Fitxer:
    """Una col_10 a la memòria: les línies tal com són i un índex per paraula.

    Les línies no es parteixen fins que algú les demana: mig milió de llistes
    de camps serien uns quants centenars de MB per no res.

    Al costat, les síl·labes i els enllaços (si la paraula té entrada al
    Viccionari, a la Viquipèdia i al DIEC). Això no és a la col_10 sinó al
    diccionari o a les col_5 a 8 de l'apendix (DadesDelDiccionari i
    DadesDeLapendix), i per això es llegeix a part i es torna a llegir quan
    canvia.

    I per quina clau van ordenades les paraules, que no és la mateixa a les
    dues bandes (vegeu ORDRE_DEL_DICCIONARI i ORDRE_DE_LAPENDIX)."""

    def __init__(self, clau, cami, etiqueta, dades, ordre):
        self.clau = clau
        self.cami = cami
        self.etiqueta = etiqueta
        self.dades = dades
        self.ordre = ordre
        self.carregar()

    def mtimes(self):
        return [os.path.getmtime(cami) for cami in (self.cami, *self.dades.camins)]

    def carregar(self):
        self.linies = camins.llegir_columna(self.cami)
        self.mtime = self.mtimes()
        self.dades.llegir()
        quantes = self.dades.files()
        self.quadren = quantes == len(self.linies)
        if not self.quadren:
            # A mig editar (una paraula donada d'alta a la col_10 i encara no al
            # diccionari, per exemple) les files no quadren i no se sap quines
            # síl·labes són de qui. Millor no ensenyar-ne cap que ensenyar-les
            # malament, i encara menys escriure-hi.
            print(f"  (avís: {camins.relatiu(self.cami)} té {camins.mil(len(self.linies))} línies i "
                  + (f"les síl·labes i els enllaços {camins.mil(quantes)}" if quantes is not None
                     else "les col_5 a 8 no tenen totes les mateixes")
                  + ": no se n'ensenyaran, i només s'hi podran corregir les transcripcions)")
        self._fonetica = None
        self._indexar()

    def _indexar(self):
        self.per_paraula = {}
        self.per_clau = {}
        self.per_lema = {}
        for fila, linia in enumerate(self.linies):
            for index, clau in self._claus(linia):
                index.setdefault(clau, []).append(fila)

    def _desplacar(self, de, a):
        """Els índexs, quan la fila de passa a ser la a: totes les d'entremig
        es desplacen una posició. Fer-ho així és cinc vegades més ràpid que
        refer-los, que vol dir passar el clau_dordre() a mig milió de paraules."""
        if de < a:
            nova = lambda fila: a if fila == de else fila - 1 if de < fila <= a else fila
        else:
            nova = lambda fila: a if fila == de else fila + 1 if a <= fila < de else fila
        for index in (self.per_paraula, self.per_clau, self.per_lema):
            for files in index.values():
                files[:] = sorted(map(nova, files))

    def _claus(self, linia):
        """On va una línia a cada índex."""
        paraula, lema = (linia.split(modul_col_10.SEPARADOR, 2) + [""])[:2]
        return ((self.per_paraula, paraula.lower()), (self.per_clau, clau_dordre(paraula)),
                (self.per_lema, lema.lower()))

    def fonetica(self):
        """{codi: [transcripció de cada fila]}, per a la cerca per fonètica.

        No es fa fins que algú la demana: són més de dos milions de cadenes
        entre tots els fitxers, uns quants segons i uns quants centenars de MB
        que qui només corregeix paraules no ha de pagar en engegar."""
        if self._fonetica is None:
            self._fonetica = {}
            for fila, linia in enumerate(self.linies):
                self._posar_fonetica(fila, linia)
        return self._fonetica

    def _posar_fonetica(self, fila, linia):
        trossos = modul_col_10.TROS.split(linia)
        for codi, valor in zip(trossos[1::2], trossos[2::2]):
            if codi not in self._fonetica:
                self._fonetica[codi] = [""] * len(self.linies)
            self._fonetica[codi][fila] = valor

    def al_dia(self):
        """Si algú l'ha tocat per fora des que l'hem llegida, la tornem a llegir."""
        if self.mtimes() != self.mtime:
            self.carregar()

    def entrada(self, fila):
        linia = self.linies[fila]
        trossos = modul_col_10.TROS.split(linia)
        paraula, lema, codi = trossos[0].split(modul_col_10.SEPARADOR)
        dades = self.dades.dades(fila) if self.quadren else None
        return {
            "fitxer": self.clau,
            "etiqueta": self.etiqueta,
            "fila": fila,
            "linia": linia,
            "paraula": paraula,
            "lema": lema,
            "codi": codi,
            "transcripcions": dict(zip(trossos[1::2], trossos[2::2])),
            "silabes": None if dades is None else dades[0],
            "enllacos": None if dades is None else
                        {nom: valor == nom for nom, valor in zip(ENLLACOS, dades[1:])},
            # Tal com són al fitxer, com la línia: per saber, en desar, si algú
            # les ha tocades des que les tens a la pantalla.
            "dades": None if dades is None else "$".join(dades),
        }

    def paraula(self, fila):
        return self.linies[fila].split(modul_col_10.SEPARADOR, 1)[0]

    def lloc(self, fila, paraula):
        """Si la fila es digués així, on li tocaria anar per ordre alfabètic.

        None si on és ja li va bé: entre les seves veïnes. Si no, (on aniria,
        la paraula que hi tindria just abans, la de just després), amb None a
        les puntes. On aniria es compta sense ella, que és com queda la llista
        quan se la treu per tornar-la a posar.

        Les veïnes es miren primer perquè l'ordre no és perfecte enlloc: si on
        és ja hi quadra, no cal moure-la encara que la cerca binària, saltant
        per damunt de les files que no quadren, digués una altra cosa."""
        clau = self.ordre(paraula)
        mida = len(self.linies) - 1
        # La i-èsima paraula de la llista sense la fila.
        veina = lambda i: self.paraula(i if i < fila else i + 1) if 0 <= i < mida else None
        abans, despres = veina(fila - 1), veina(fila)
        if (abans is None or self.ordre(abans) <= clau) and \
                (despres is None or clau <= self.ordre(despres)):
            return None
        esquerra, dreta = 0, mida
        while esquerra < dreta:
            mig = (esquerra + dreta) // 2
            if self.ordre(veina(mig)) < clau:
                esquerra = mig + 1
            else:
                dreta = mig
        if esquerra == fila:
            return None
        return esquerra, veina(esquerra - 1), veina(esquerra)

    def desar(self, fila, linia, camps=None, desti=None):
        """La línia de la col_10 i, amb els set camps, el que hagi canviat de
        les síl·labes i els enllaços (i, al diccionari, de la identitat). Amb
        desti, a més, la fila es treu d'on és i es posa allà, a tots els
        fitxers de la seva banda alhora. Torna els camins que ha escrit."""
        canviats = set(self.dades.posar(fila, camps)) if camps else set()
        if linia != self.linies[fila]:
            for index, clau in self._claus(self.linies[fila]):
                index[clau].remove(fila)
                if not index[clau]:
                    del index[clau]
            for index, clau in self._claus(linia):
                bisect.insort(index.setdefault(clau, []), fila)
            self.linies[fila] = linia
            if self._fonetica is not None:
                self._posar_fonetica(fila, linia)
            canviats.add(self.cami)
        if desti is not None and desti != fila:
            self.linies.insert(desti, self.linies.pop(fila))
            if self._fonetica is not None:
                for columna in self._fonetica.values():
                    columna.insert(desti, columna.pop(fila))
            self._desplacar(fila, desti)
            canviats.update([self.cami, *self.dades.moure(fila, desti)])
        textos = {cami: "\n".join(self.linies) if cami == self.cami else self.dades.text(cami)
                  for cami in canviats}
        try:
            for cami, text in textos.items():
                with open(cami + ".desant", "w", encoding="utf-8") as sortida:
                    sortida.write(text)
            for cami in textos:
                os.replace(cami + ".desant", cami)
        except OSError:
            # La memòria ja porta el canvi i els fitxers potser no: que manin
            # els fitxers.
            self.carregar()
            raise
        self.mtime = self.mtimes()
        return list(textos)


# Per quina clau van ordenades les paraules. El diccionari, la de
# l'afegir_paraula.py: sense accents, majúscules, guions ni punts volats (423
# files de mig milió no hi quadren, quasi totes per la puntuació). Els apendixs,
# com s'escriuen tal qual, que posa les lletres amb accent darrere de les que
# no en duen: "abacallaneu" i després "abacallanàrem" (un centenar de files no
# hi quadren; amb la clau del diccionari serien deu mil).
ORDRE_DEL_DICCIONARI = clau_dordre
ORDRE_DE_LAPENDIX = lambda paraula: paraula


def carregar_fitxers():
    fitxers = {"dicc": Fitxer("dicc", camins.COL_10, "diccionari", DadesDelDiccionari(),
                              ORDRE_DEL_DICCIONARI)}
    for codi in camins.dialectes_amb_apendix():
        cami = camins.cami_col_10_apendix(codi)
        if os.path.exists(cami):
            nom = NOMS_DIALECTES.get(codi, codi)
            fitxers[codi] = Fitxer(codi, cami, f"apèndix {nom}", DadesDeLapendix(codi),
                                   ORDRE_DE_LAPENDIX)
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


def camps_de(entrada):
    """Els set camps del diccionari (paraula, lema, codi, síl·labes, Vicc, Viq
    i Diec) d'una entrada com les de Fitxer.entrada(), que és com la torna la
    pàgina. Només els tres primers si no té síl·labes ni enllaços."""
    text = lambda valor: "" if valor is None else str(valor)
    camps = [text(entrada.get(clau)) for clau in ("paraula", "lema", "codi")]
    enllacos = entrada.get("enllacos")
    if not isinstance(enllacos, dict):
        return camps
    silabes = text(entrada.get("silabes")).strip()
    return camps + [str(int(silabes)) if silabes.isdecimal() else silabes,
                    *(nom if enllacos.get(nom) else "NO" for nom in ENLLACOS)]


def problemes_dels_camps(camps):
    """Com problemes(), per a la resta de camps. Els enllaços no poden anar
    malament: camps_de() els fa de sí o no."""
    errors = []
    for nom, valor in zip(("la paraula", "el lema", "el codi"), camps):
        if not valor.strip():
            errors.append(f"falta {nom}")
        elif valor != valor.strip():
            errors.append(f"{nom} té espais al davant o al darrere")
        # El $ partiria la fila del diccionari; el €, la de la col_10; i un
        # salt de línia, totes dues.
        if "$" in valor or "€" in valor:
            errors.append(f"{nom} no pot dur cap $ ni cap €")
        if not valor.isprintable():
            errors.append(f"{nom} té caràcters que no s'hi poden posar (salts de línia, tabuladors…)")
    # Zero sí: és el que porten les formes amb pronom (absoldre-hi).
    if not (camps[3].isascii() and camps[3].isdigit()):
        errors.append("les síl·labes han de ser un nombre enter")
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

    def cercar(self, text, mode="exacta", des_de=0, on="paraula", dialecte=None, totes=False):
        """Tres maneres, i totes sense mirar majúscules:

            exacta    la paraula tal com l'has escrita, accents inclosos. Si no
                      n'hi ha cap, et proposa les que s'hi assemblen
            comenca   les entrades de les paraules que comencen així
            acaba     les entrades de les paraules que acaben així

        Les dues últimes per ordre alfabètic i de PER_PAGINA en PER_PAGINA,
        començant per la des_de (o totes d'una, amb totes=True).

        Amb on="fonetica", el mateix però sobre les transcripcions: les de tots
        els dialectes o només les del que diguis. Aquí la cerca exacta també va
        per pàgines, que homòfons n'hi pot haver molts.

        Amb on="rima", les que rimen en consonant amb el text, també en tots
        els dialectes o en el que diguis, i el mode no hi compta. El text pot
        ser la rima ("ɛktə") o una transcripció sencera ("pəɾfˈɛktə"), i
        aleshores se'n treu la rima: el que hi ha darrere l'últim accent.

        Amb on="lema", totes les formes del lema, d'una: "inepte" i "inepta"
        donen inepta, inepte i ineptes. Aquí el mode tampoc hi compta."""
        text = text.strip()
        if not text:
            return {"resultats": []}
        with self.pany:
            for fitxer in self.fitxers.values():
                fitxer.al_dia()
            if on == "lema":
                return self._del_lema(text.lower())
            if on == "rima":
                rima = calcular_rimes(normalitzar_fonetica(text).lstrip("-"))[0]
                if not rima:
                    return {"resultats": [], "total": 0, "des_de": des_de, "rima": rima}
                return {**self._per_rima(rima, des_de, dialecte, totes), "rima": rima}
            if on == "fonetica":
                return self._per_fonetica(mode, normalitzar_fonetica(text), des_de, dialecte, totes)
            if mode in ("comenca", "acaba"):
                return self._entrades_que(mode, text.lower(), des_de, totes)

            resultats = self._buscar(lambda f: f.per_paraula.get(text.lower(), []))
            if not resultats:
                return {"resultats": self._semblants(clau_dordre(text)), "suggeriments": True}
        return {"resultats": [amb_rimes(entrada) for entrada in resultats]}

    def _entrades_que(self, mode, text, des_de, totes):
        trobades = []
        for ordre, fitxer in enumerate(self.fitxers.values()):
            for minuscula, files in fitxer.per_paraula.items():
                if minuscula.startswith(text) if mode == "comenca" else minuscula.endswith(text):
                    paraula = fitxer.linies[files[0]].split(modul_col_10.SEPARADOR, 1)[0]
                    # Les entrades d'una mateixa paraula juntes, primer les del
                    # diccionari i després les dels apendixs, i cadascuna per fila.
                    clau = (clau_dordre(paraula), paraula, ordre)
                    trobades.extend((clau, fila, fitxer) for fila in files)
        return self._pagina(trobades, des_de, totes)

    def _del_lema(self, text):
        """Els lemes són el text, si n'és un, i els de les paraules que s'escriuen
        així. Les formes van sense pàgines: un verb en té una cinquantena."""
        lemes = set()
        for fitxer in self.fitxers.values():
            if text in fitxer.per_lema:
                lemes.add(text)
            for fila in fitxer.per_paraula.get(text, []):
                lemes.add(fitxer.linies[fila].split(modul_col_10.SEPARADOR, 2)[1].lower())

        trobades = []
        for ordre, fitxer in enumerate(self.fitxers.values()):
            for lema in lemes:
                for fila in fitxer.per_lema.get(lema, []):
                    paraula = fitxer.linies[fila].split(modul_col_10.SEPARADOR, 1)[0]
                    trobades.append(((clau_dordre(paraula), paraula, ordre), fila, fitxer))
        return {**self._pagina(trobades, 0, totes=True), "lemes": sorted(lemes, key=clau_dordre)}

    def _per_fonetica(self, mode, text, des_de, dialecte, totes):
        """Si no hi has posat cap accent, les transcripcions es comparen sense
        els seus: "ɔnə" troba dˈɔnə, i "dɔnə" també. Si n'hi poses, compten."""
        amb_accent = any(accent in text for accent in ACCENTS)
        if mode == "exacta":
            compara = lambda valor: valor == text
        elif mode == "comenca":
            compara = lambda valor: valor.startswith(text)
        else:
            compara = lambda valor: valor.endswith(text)
        coincideix = compara if amb_accent else lambda valor: compara(sense_accents(valor))
        return self._pagina(self._transcripcions_que(coincideix, dialecte), des_de, totes)

    def _per_rima(self, rima, des_de, dialecte, totes):
        """La rima consonant que calcular_rimes() els posa ha de ser aquesta.
        L'endswith() va primer perquè és barat i ja en deixa fora gairebé totes."""
        coincideix = lambda valor: valor.endswith(rima) and calcular_rimes(valor)[0] == rima
        return self._pagina(self._transcripcions_que(coincideix, dialecte), des_de, totes)

    def _transcripcions_que(self, coincideix, dialecte):
        """Les entrades amb alguna transcripció que coincideix, de tots els
        dialectes o només del que diguis, i en quins dialectes ho fa."""
        trobades = []
        for ordre, fitxer in enumerate(self.fitxers.values()):
            per_fila = {}
            for codi, columna in fitxer.fonetica().items():
                if dialecte and codi != dialecte:
                    continue
                for fila, valor in enumerate(columna):
                    if coincideix(valor):
                        per_fila.setdefault(fila, []).append(codi)
            for fila, codis in per_fila.items():
                paraula = fitxer.linies[fila].split(modul_col_10.SEPARADOR, 1)[0]
                trobades.append(((clau_dordre(paraula), paraula, ordre), fila, fitxer, codis))
        return trobades

    def _pagina(self, trobades, des_de, totes=False):
        """trobades: (clau d'ordre, fila, fitxer[, dialectes que hi coincideixen])."""
        trobades.sort(key=lambda trobada: trobada[:2])
        fins = len(trobades) if totes else des_de + PER_PAGINA
        resultats = []
        for clau, fila, fitxer, *codis in trobades[des_de:fins]:
            entrada = amb_rimes(fitxer.entrada(fila))
            if codis:
                entrada["coincideixen"] = codis[0]
            resultats.append(entrada)
        return {"resultats": resultats, "total": len(trobades), "des_de": des_de}

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
                    or fitxer.linies[fila] != peticio.get("linia") \
                    or fitxer.entrada(fila)["dades"] != peticio.get("dades"):
                return 409, {"error": "Aquesta fila ha canviat des que l'has cercada "
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

            # Sense "camps", la pàgina només hi ha tocat les transcripcions.
            camps = peticio.get("camps")
            abans = camps_de(entrada)
            despres = camps_de(camps if isinstance(camps, dict) else entrada)
            if despres != abans:
                if not fitxer.quadren:
                    return 400, {"error": "Les síl·labes i els enllaços no van fila per fila "
                                          "amb la col_10: passa el sincronitzar.py. Fins "
                                          "llavors, aquí només s'hi poden corregir les "
                                          "transcripcions."}
                if len(despres) != len(abans):
                    return 400, {"error": "Falten les síl·labes i els enllaços."}
                identitat = fitxer.dades.identitat(fila)
                if identitat is not None and identitat != abans[:camins.CAMPS_IDENTITAT]:
                    return 400, {"error": f"Al diccionari, aquesta fila és {'$'.join(identitat)} "
                                          f"i a la col_10 és {'$'.join(abans[:3])}: passa el "
                                          f"sincronitzar.py abans de tocar-ne res més que "
                                          f"les transcripcions."}
                errors = problemes_dels_camps(despres)
                if errors:
                    return 400, {"error": "; ".join(errors)}

            # La fila només es mou si ho has demanat, i al lloc que la pàgina
            # t'ha ensenyat: "moure" és on l'has vista anar.
            moure = peticio.get("moure")
            desti = None
            if moure is not None:
                if despres[0] == abans[0]:
                    return 400, {"error": "Una fila només es mou quan canvies com s'escriu la "
                                          "paraula: moguda sola, per al sincronitzar.py seria "
                                          "una reordenació, i s'aturaria."}
                lloc = fitxer.lloc(fila, despres[0])
                desti = lloc and lloc[0]
                if desti != moure:
                    return 409, {"error": "On aniria ja no és on tenies a la pantalla (algú ha "
                                          "tocat el fitxer). Torna-ho a mirar."}
            if noves == actuals and despres == abans:
                return 200, {"entrada": entrada, "canviat": False, "desats": []}

            # Es reconstrueix amb l'ordre de dialectes que ja hi havia, igual que
            # fa col_10.escriure(): així el diff només ensenya el que has canviat.
            linia = modul_col_10.SEPARADOR.join(despres[:camins.CAMPS_IDENTITAT])
            for codi in actuals:
                linia += modul_col_10.marca(codi) + noves[codi]
            # Les dades, només si la fitxa ha canviat: si no, una fila que el
            # diccionari diu diferent (tocada a mà i encara sense sincronitzar)
            # hi tornaria a escriure la identitat de la col_10 i desfaria el canvi.
            desats = fitxer.desar(fila, linia, despres if despres != abans else None, desti)
            nova = fitxer.entrada(fila if desti is None else desti)

        amb_rimes(nova)
        canvis = [f"{nom} {a} → {b}" for nom, a, b in zip(NOMS_CAMPS, abans, despres) if a != b]
        canvis += [f"{codi} {actuals[codi]} → {noves[codi]}"
                   for codi in actuals if actuals[codi] != noves[codi]]
        if desti is not None:
            canvis.append(f"moguda a la fila {desti + 1}")
        print(f"  desat: {entrada['paraula']} ({entrada['codi']}, {fitxer.etiqueta}, "
              f"fila {fila + 1}): {', '.join(canvis)}", flush=True)
        return 200, {"entrada": nova, "canviat": True,
                     "desats": [os.path.basename(cami) for cami in desats],
                     "moguda": None if desti is None else {"de": fila, "a": desti}}

    def lloc(self, clau, fila, paraula):
        """On aniria la fila per ordre alfabètic si es digués així: el que la
        pàgina t'ensenya quan canvies com s'escriu una paraula."""
        fitxer = self.fitxers.get(clau)
        if fitxer is None:
            return 400, {"error": "Aquest fitxer no el conec."}
        with self.pany:
            fitxer.al_dia()
            if not 0 <= fila < len(fitxer.linies):
                return 400, {"error": "Aquesta fila no hi és."}
            lloc = fitxer.lloc(fila, paraula)
        if lloc is None:
            return 200, {"desti": None}
        desti, abans, despres = lloc
        return 200, {"desti": desti, "abans": abans, "despres": despres}

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
                on = consulta.get("on", ["paraula"])[0]
                if on not in ON:
                    return self._json(400, {"error": f"on ha de ser {', '.join(ON)}."})
                dialecte = consulta.get("dialecte", [""])[0] or None
                totes = consulta.get("totes", [""])[0] == "1"
                self._json(200, servidor.cercar(text, mode, des_de, on, dialecte, totes))
            elif url.path == "/api/lloc":
                consulta = parse_qs(url.query)
                try:
                    fila = int(consulta.get("fila", [""])[0])
                except ValueError:
                    return self._json(400, {"error": "fila ha de ser un número."})
                self._json(*servidor.lloc(consulta.get("fitxer", [""])[0], fila,
                                          consulta.get("paraula", [""])[0]))
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
