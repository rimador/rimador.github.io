"""
Quina finestra de rimes triar per a la paraula del dia: una pàgina per mirar-ho.

    python3 joc/eines/finestra_rimes.py
    python3 joc/eines/finestra_rimes.py --sortida /tmp/finestra.html --sense-obrir

Escriu joc/eines/finestra_rimes.html i l'obre al navegador. Hi tries un mínim i
un màxim de rimes i et diu, amb les regles del joc de debò:

  - quants dies dura el cicle de la paraula del dia sense repetir cap clau de
    rima (cada dia en gasta una per dificultat, i no en torna a sortir cap fins
    que s'han fet servir totes: vegeu paraulaDelDia a joc/js/objectius.js);
  - quin percentatge són de totes les claus que podrien sortir mai;
  - quantes rimes tenen, que és la dificultat (en difícil, les respostes bones
    són les rimes de la clau i prou).

A sota hi ha l'histograma de les claus amb la part que entra a la finestra, i
una taula amb els dies que dona cada combinació de mínim i màxim.

COMPTA COM EL JOC perquè fa servir les seves funcions (generar_dades.py): què
és una rima vàlida, com es normalitza, l'apendix de cada dialecte i les
paraules que poden ser objectiu. I sobretot LA REGLA DELS QUATRE DIALECTES: una
paraula només pot ser paraula del dia si la seva clau té entre el mínim i el
màxim de rimes a tots quatre. Mirant només el central, a 30-800 hi cabrien 697
claus; amb la regla, en queden 541, que és el que publica el generador (i el
script avisa si no hi quadra).

COM ES GUARDA cada clau, perquè la pàgina pugui provar qualsevol finestra sense
tornar a llegir el diccionari: de cada paraula candidata, quantes rimes té la
seva clau a cada dialecte (el seu PERFIL, quatre números). La paraula entra a la
finestra si els quatre hi cauen, i la clau central hi entra si hi entra alguna
de les seves paraules. Les paraules d'una mateixa clau central solen tenir el
mateix perfil, però no sempre: si en un altre dialecte es reparteixen en claus
diferents, en tenen més d'un. Es guarda cada perfil diferent un sol cop, amb
una paraula d'exemple, i amb els quatre números la pàgina també pot dir QUIN
dialecte deixa fora una clau i per què.

I TOT PLEGAT DUES VEGADES: amb la rima consonant, que és com tria el joc, i amb
l'assonant (la que val en fàcil), per veure com quedaria la finestra si es
mirés pels grups assonants. Un botó a dalt de la pàgina canvia d'una a l'altra.

No toca res del joc: només llegeix. No és cap pas dels workflows.
"""

import argparse
import collections
import json
import os
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

DIR_EINES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_EINES)

import generar_dades as gd  # noqa: E402
import camins  # noqa: E402  (el generar_dades ja l'ha posat al camí)

PLANTILLA = os.path.join(DIR_EINES, "finestra_rimes.plantilla.html")
SORTIDA = os.path.join(DIR_EINES, "finestra_rimes.html")


# Les dues menes de rima: la consonant, que és la que fa servir el joc per triar
# la paraula del dia, i l'assonant, que és la que val en fàcil.
RIMES = ("cons", "asson")


def comptar(base, codis):
    """De cada dialecte i cada mena de rima, quantes rimes té cada clau i a
    quines claus cau cada paraula que podria ser objectiu. És el mateix recompte
    que marges_de_rima del generador, però guardant les claus i no només els
    marges. Torna {mena: (rimes_de_la_clau, claus_de)} i mostrar_de."""
    per_mena = {mena: ({}, {}) for mena in RIMES}
    mostrar_de = {}
    for codi in codis:
        formes = {mena: collections.defaultdict(set) for mena in RIMES}
        claus = {mena: collections.defaultdict(set) for mena in RIMES}
        for normalitzada, paraula, cons, asson, es_objectiu in gd.files_del_dialecte(codi, base):
            for mena, clau in (("cons", cons), ("asson", asson)):
                formes[mena][clau].add(normalitzada)
                if es_objectiu:
                    claus[mena][normalitzada].add(clau)
            if es_objectiu:
                anterior = mostrar_de.get(normalitzada)
                if anterior is None or len(paraula) < len(anterior):
                    mostrar_de[normalitzada] = paraula
        for mena in RIMES:
            rimes_de_la_clau, claus_de = per_mena[mena]
            rimes_de_la_clau[codi] = {clau: len(f) for clau, f in formes[mena].items()}
            claus_de[codi] = claus[mena]
        print(f"  {codi}: {camins.mil(len(formes['cons']))} claus consonants, "
              f"{camins.mil(len(formes['asson']))} assonants")
    return per_mena, mostrar_de


def claus_candidates(rimes_de_la_clau, claus_de, mostrar_de, canonic, ordre):
    """Les claus del dialecte canònic que podrien donar paraula del dia amb
    alguna finestra, amb els perfils de les seves paraules: quantes rimes té la
    seva clau a cada dialecte, en l'ordre de `ordre`, i una paraula d'exemple.

    Una paraula és candidata si pot ser objectiu als quatre dialectes i cau a
    UNA sola clau a cadascun: les que cauen a dues (els homògrafs com "dona")
    no poden ser paraula del dia, igual que a construir_diaries."""
    candidates = set(claus_de[canonic])
    for codi in ordre:
        candidates &= {p for p, claus in claus_de[codi].items() if len(claus) == 1}

    # clau central -> perfil -> paraules que el tenen
    perfils = collections.defaultdict(lambda: collections.defaultdict(list))
    for paraula in candidates:
        perfil = tuple(rimes_de_la_clau[codi][next(iter(claus_de[codi][paraula]))] for codi in ordre)
        # Amb menys de MIN_RIMES_PUBLICADES rimes en algun dialecte no surt mai.
        if min(perfil) < gd.MIN_RIMES_PUBLICADES:
            continue
        perfils[next(iter(claus_de[canonic][paraula]))][perfil].append(paraula)

    claus = []
    for clau in sorted(perfils):
        f = []
        for perfil, paraules in sorted(perfils[clau].items()):
            # L'exemple: la que el joc posaria primer (barreja_estable, com a
            # construir_diaries).
            exemple = min(paraules, key=lambda p: (gd.barreja_estable(p), p))
            f.append([*perfil, mostrar_de.get(exemple, exemple)])
        claus.append({"c": clau, "n": rimes_de_la_clau[canonic][clau], "f": f})
    return claus


def finestra_publicada():
    """La que diu el joc/dades/index.json, que és la que es juga ara."""
    try:
        with open(gd.INDEX, encoding="utf-8") as fitxer:
            index = json.load(fitxer)
        return {"min": index["min_rimes"], "max": index["max_rimes"],
                "dies": len(index["diaries"]["claus"])}
    except (OSError, ValueError, KeyError):
        return None


def main():
    analitzador = argparse.ArgumentParser(description="Pàgina per triar la finestra de rimes del joc.")
    analitzador.add_argument("--sortida", default=SORTIDA,
                             help=f"on s'escriu l'HTML ({camins.relatiu(SORTIDA)})")
    analitzador.add_argument("--sense-obrir", action="store_true", help="no l'obre al navegador")
    args = analitzador.parse_args()

    # En l'ordre de la tira: és el de les columnes dels perfils i el de la pàgina.
    codis = gd.ordre_de_tira(camins.dialectes())
    canonic = camins.CENTRAL if camins.CENTRAL in codis else codis[0]

    print("Llegint el diccionari...")
    base = gd.preparar_diccionari()
    for codi in codis:
        apendix = gd.llegir_apendix(codi)
        if apendix:
            base["apendixs"][codi] = apendix
    print("Comptant les rimes de cada dialecte...")
    per_mena, mostrar_de = comptar(base, codis)
    claus_de_la_mena = {}
    for mena in RIMES:
        claus_de_la_mena[mena] = claus_candidates(*per_mena[mena], mostrar_de, canonic, codis)
        claus = claus_de_la_mena[mena]
        print(f"{camins.mil(len(claus))} claus {'consonants' if mena == 'cons' else 'assonants'} de {canonic} "
              f"poden donar paraula del dia amb alguna finestra "
              f"({camins.mil(sum(len(clau['f']) for clau in claus))} perfils)")
    claus = claus_de_la_mena["cons"]

    publicada = finestra_publicada()
    if publicada:
        dins = sum(1 for clau in claus
                   if any(min(f[:-1]) >= publicada["min"] and max(f[:-1]) <= publicada["max"]
                          for f in clau["f"]))
        avis = "" if dins == publicada["dies"] else "  ATENCIO: no quadra amb l'index publicat!"
        print(f"Finestra publicada {publicada['min']}-{publicada['max']}: {dins} claus "
              f"(l'index en diu {publicada['dies']}){avis}")

    dades = {
        "generat": datetime.now().strftime("%d/%m/%Y"),
        "canonic": gd.NOMS_DE_DIALECTE.get(canonic, canonic),
        "i_canonic": codis.index(canonic),
        # Els noms, en l'ordre de les columnes dels perfils.
        "dialectes": [gd.NOMS_DE_DIALECTE.get(c, c) for c in codis],
        "generador": {"min": gd.MIN_RIMES, "max": gd.MAX_RIMES},
        "publicada": publicada,
        # Les de la rima consonant, que és com tria el joc, i les de l'assonant,
        # que la pàgina mostra si s'hi canvia amb el botó de dalt.
        "claus": claus,
        "claus_asson": claus_de_la_mena["asson"],
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
