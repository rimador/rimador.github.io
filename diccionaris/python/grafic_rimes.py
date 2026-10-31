"""
Quantes paraules té cada rima: els gràfics, tots en una pàgina.

L'eix x és quantes paraules té una rima; l'eix y, quantes rimes en tenen
aquestes. La barra de l'1 són les rimes que només té una paraula, les
nàufragues (la mateixa definició que llistes/generar_naufragues.py), i com
més a la dreta, més rimes riques.

    python3 diccionaris/python/grafic_rimes.py
    python3 diccionaris/python/grafic_rimes.py --sortida /tmp/rimes.html --sense-obrir

Escriu un HTML (per defecte, grafic_rimes.html al costat d'aquest script) amb
un gràfic de rima consonant i un d'assonant per a cada dialecte, i l'obre al
navegador. La pàgina és autònoma: les dades hi van a dins i no demana res a
cap servidor. A dalt s'hi tria com s'agrupen (per dialecte o per tipus de
rima), l'escala, si a la lineal hi surten les de més de --fins paraules, si
hi surten les nàufragues i les rimes de 2 paraules, si hi entren els verbs
amb pronoms i si hi entra l'apendix.

QUÈ ÉS UNA PARAULA. Es compten les formes diferents (la col_0), no les files:
"a" és una sola paraula encara que surti tres vegades al diccionari amb tres
lemes i codis diferents. És el que veu qui cerca: una paraula a la llista.

QUINES PARAULES. Les d'un dialecte són les del diccionari més les del seu
apendix, igual que les cus el navegador (compondreDiccionari a js/script.js):
una paraula de l'apendix i una del diccionari amb la mateixa rima rimen. La
pàgina també duu els recomptes sense l'apendix, per comparar.

ELS PRONOMS. Les formes de verb + pronom(s) (codi W: "caure'm", "vivint-se")
hi són per defecte, perquè el cercador també les dona. Sense elles es compta
com si no existissin, i no com fa la llista de nàufragues, que les fa servir
per decidir qui rima i després no les ensenya: aquí, una paraula que només
rimava amb una forma amb pronom passa a ser nàufraga.

LES DUES ESCALES. No surt cap campana: la majoria de rimes tenen una o dues
paraules i unes poques en tenen desenes de milers, i amb els dos eixos
lineals tot el gràfic seria la primera barra. Per això:

    lineal  una barra per a cada nombre de paraules, de l'1 fins a --fins.
            Les rimes que en tenen més, o no hi surten i es diu quantes
            són, o van totes juntes en una última barra.
    log     els dos eixos logarítmics i cada barra agrupa el doble de valors
            que l'anterior (1, 2-3, 4-7, 8-15...), perquè hi càpiga tot fins a
            la rima més gran. Que dupliquin sempre és el que fa que l'alçada de
            les barres es pugui comparar: amb intervals d'amplada irregular, una
            barra que n'agrupa més surt més alta sense que hi hagi més rimes.

L'HTML és la plantilla grafic_rimes.plantilla.html amb les dades al lloc de
__DADES__: el disseny es toca allà i les xifres surten d'aquí.

No és cap pas dels workflows: es passa a mà quan es vol mirar.
"""

import argparse
import hashlib
import json
import os
import statistics
import webbrowser
from collections import Counter, defaultdict
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import camins

# Els noms i l'ordre de la tira de dialectes del web (la llista DIALECTES de
# js/components.js). Un dialecte que no hi sigui surt al final amb el codi.
NOMS_DIALECTES = {"ca": "Central", "nw": "Nord-occidental", "va": "Valencià", "ba": "Balear"}

TIPUS = (("consonant", 3, "Rima consonant"), ("assonant", 4, "Rima assonant"))

# Quants exemples de rimes duu cada barra, per al requadre que surt en passar-hi
# per sobre; i fins a quantes paraules s'hi diu quines són.
EXEMPLES = 3
PARAULES_ALS_EXEMPLES = 3

PLANTILLA = os.path.join(camins.DIR_SCRIPTS, "grafic_rimes.plantilla.html")
SORTIDA = os.path.join(camins.DIR_SCRIPTS, "grafic_rimes.html")


@lru_cache(maxsize=None)
def llegir(cami):
    """Cada columna surt a més d'un gràfic (amb l'apendix i sense, amb els
    pronoms i sense, i la col_0 i la col_2 a tots): es llegeixen una vegada."""
    return tuple(camins.llegir_columna(cami))


def es_verb_amb_pronoms(codi_gramatical):
    """Infinitiu o gerundi + pronom(s): "caure'm", "vivint-se". Són les WN i
    les WG que el cercador ensenya a part (CriterisInfinitiuPronom i
    CriterisGerundiPronom a js/script.js)."""
    return codi_gramatical.startswith("W")


def paraules_per_rima(codi, numero, amb_apendix, amb_pronoms):
    """{rima: el conjunt de paraules diferents que la tenen}

    Sense els pronoms, les formes de verb + pronom(s) no hi són i prou: és com
    si el diccionari no les tingués, i una paraula que només rimava amb una
    d'elles passa a ser nàufraga."""
    parts = [(camins.cami_columna(0), camins.cami_columna(2), camins.cami_dialecte(codi, numero))]
    if amb_apendix and camins.te_apendix(codi):
        parts.append((camins.cami_apendix(codi, 0), camins.cami_apendix(codi, 2),
                      camins.cami_apendix(codi, numero)))

    grups = defaultdict(set)
    for fitxers in parts:
        paraules, codis_gramaticals, rimes = (llegir(cami) for cami in fitxers)
        if not len(paraules) == len(codis_gramaticals) == len(rimes):
            raise SystemExit(f"{', '.join(camins.relatiu(cami) for cami in fitxers)} no tenen les "
                             f"mateixes files ({camins.mil(len(paraules))}, "
                             f"{camins.mil(len(codis_gramaticals))} i {camins.mil(len(rimes))}): "
                             f"han d'anar fila per fila. Torna a passar el columnes.py.")
        for paraula, codi_gramatical, rima in zip(paraules, codis_gramaticals, rimes):
            if rima and (amb_pronoms or not es_verb_amb_pronoms(codi_gramatical)):
                grups[rima].add(paraula)
    return grups


def dades_grafic(grups, fins):
    """Tot el que la pàgina necessita per dibuixar un gràfic i explicar-lo."""
    mides = {rima: len(paraules) for rima, paraules in grups.items()}

    def exemple(rima):
        n = mides[rima]
        e = {"r": rima, "n": n}
        if n <= PARAULES_ALS_EXEMPLES:
            e["p"] = sorted(grups[rima])
        return e

    # Un ordre que sembla a l'atzar però que és el mateix a cada passada: si
    # els exemples canviessin cada cop, el fitxer no es podria comparar.
    barrejades = sorted(mides, key=lambda rima: hashlib.md5(rima.encode()).hexdigest())

    exemples_mida = defaultdict(list)
    for rima in barrejades:
        n = mides[rima]
        if n <= fins and len(exemples_mida[n]) < EXEMPLES:
            exemples_mida[n].append(exemple(rima))

    # A l'escala log, les més grans de cada interval. L'interval k va de 2^k
    # a 2^(k+1) - 1, que és el que diu el bit_length.
    exemples_interval = defaultdict(list)
    for rima in sorted(barrejades, key=lambda rima: -mides[rima]):
        k = mides[rima].bit_length() - 1
        if len(exemples_interval[k]) < EXEMPLES:
            exemples_interval[k].append(exemple(rima))

    return {
        "rimes": len(mides),
        "paraules": sum(mides.values()),
        "mediana": statistics.median(mides.values()),
        "maxim": max(mides.values()),
        "mides": sorted(Counter(mides.values()).items()),
        "exemples_mida": exemples_mida,
        "exemples_interval": exemples_interval,
        "grans": [[rima, mides[rima]] for rima in sorted(mides, key=lambda r: (-mides[r], r))[:5]],
    }


def main():
    analitzador = argparse.ArgumentParser(description="Gràfics de quantes paraules té cada rima, en un HTML.")
    analitzador.add_argument("--fins", type=int, default=50,
                             help="a l'escala lineal, fins a quantes paraules arriba l'eix x (50)")
    analitzador.add_argument("--sortida", default=SORTIDA,
                             help=f"on s'escriu l'HTML ({camins.relatiu(SORTIDA)})")
    analitzador.add_argument("--sense-obrir", action="store_true", help="no l'obre al navegador")
    args = analitzador.parse_args()

    codis = sorted(camins.dialectes(),
                   key=lambda c: list(NOMS_DIALECTES).index(c) if c in NOMS_DIALECTES else len(NOMS_DIALECTES))
    grafics = {}
    for codi in codis:
        for tipus, numero, _ in TIPUS:
            for amb_apendix in (True, False):
                for amb_pronoms in (True, False):
                    grups = paraules_per_rima(codi, numero, amb_apendix, amb_pronoms)
                    grafics[f"{codi}.{tipus}.{int(amb_apendix)}.{int(amb_pronoms)}"] = dades_grafic(grups, args.fins)
                if amb_apendix:
                    g = grafics[f"{codi}.{tipus}.1.1"]
                    sense = grafics[f"{codi}.{tipus}.1.0"]
                    print(f"{codi} {tipus:<9} {camins.mil(g['rimes']):>7} rimes, "
                          f"{camins.mil(g['paraules']):>8} paraules, "
                          f"{camins.mil(dict(g['mides']).get(1, 0)):>6} nàufragues "
                          f"({camins.mil(dict(sense['mides']).get(1, 0))} sense els pronoms)")

    dades = {
        "fins": args.fins,
        "generat": datetime.now().strftime("%d/%m/%Y"),
        "dialectes": [{"codi": c, "nom": NOMS_DIALECTES.get(c, c),
                       "apendix": camins.te_apendix(c)} for c in codis],
        "tipus": [{"codi": tipus, "nom": nom} for tipus, _, nom in TIPUS],
        "grafics": grafics,
    }
    # Dins d'un <script>, un "</" de les dades el podria tancar abans d'hora.
    json_dades = json.dumps(dades, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    with open(PLANTILLA, encoding="utf-8") as fitxer:
        html = fitxer.read()
    if "__DADES__" not in html:
        raise SystemExit(f"{camins.relatiu(PLANTILLA)} no té cap __DADES__ on posar-hi les dades.")
    with open(args.sortida, "w", encoding="utf-8") as fitxer:
        fitxer.write(html.replace("__DADES__", json_dades))

    print(f"Desat a {args.sortida}")
    if not args.sense_obrir:
        webbrowser.open(Path(args.sortida).resolve().as_uri())


if __name__ == "__main__":
    main()
