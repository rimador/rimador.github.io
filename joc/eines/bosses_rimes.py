"""
Les bosses de la paraula del dia: una eina per triar-ne els talls i les quotes.

    python3 joc/eines/bosses_rimes.py
    python3 joc/eines/bosses_rimes.py --sortida /tmp/bosses.html --sense-obrir

Escriu joc/eines/bosses_rimes.html i l'obre al navegador. No cal cap servidor:
les dades van a dins de la pàgina.

LA IDEA. Ara la paraula del dia surt d'UNA sola bossa: totes les claus de la
finestra, a l'atzar i sense repetir fins que s'han fet servir totes. Com que hi
ha moltes més claus amb poques rimes que amb moltes, la majoria de dies són
difícils i les fàcils gairebé no surten. Amb BOSSES, les claus es reparteixen
per trams de rimes i cada bossa té una QUOTA: el percentatge de dies que li
toca, tingui les claus que tingui. Dins de cada bossa es continua traient a
l'atzar i sense repetir.

A la pàgina tries els talls de les bosses i la quota de cadascuna, i et diu:

  - quantes claus hi entren i quants dies triga a repetir-se cada bossa
    (claus / quota), i quina quota li caldria per durar els dies que vulguis;
  - les tres paraules amb menys rimes, les tres del mig i les tres amb més;
  - la dificultat que en resulta: mediana i quartils de les rimes, ponderats
    per les quotes (una clau d'una bossa petita amb quota gran surt més sovint);
  - una previsió dels propers dies, per veure com quedaria;
  - la comparació amb la finestra que es juga ara.

LA REGLA DELS QUATRE DIALECTES, que no desapareix: la paraula del dia és la
mateixa per a tothom (vegeu generar_dades.py). La bossa la decideixen les rimes
del central, i hi ha dues maneres de demanar-ho als altres dialectes:

  estricta   les rimes dels quatre han de caure dins de la mateixa bossa;
  del costat també valen a la bossa del costat. Recupera les claus que cauen
             just a la frontera ("tereftàlic": 24 al central i 36 al valencià)
             sense deixar entrar les absurdes ("batiscafs": 17 al central i
             10.327 al balear).

Els recomptes surten de finestra_rimes.py, que compta amb les mateixes funcions
que el generador del joc. La pàgina comença per la proposta de PER_DEFECTE i
s'hi pot jugar, però no desa res: per quedar-se una configuració, s'ha de
copiar a PER_DEFECTE. No toca res del joc: només llegeix. No és cap pas dels
workflows.
"""

import argparse
import json
import os
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

DIR_EINES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_EINES)

import finestra_rimes as fr  # noqa: E402
import generar_dades as gd  # noqa: E402
import camins  # noqa: E402  (el generar_dades ja l'ha posat al camí)

PLANTILLA = os.path.join(DIR_EINES, "bosses_rimes.plantilla.html")
SORTIDA = os.path.join(DIR_EINES, "bosses_rimes.html")

# Les dues menes de rima, amb el nom que tenen a la configuració. La consonant
# és la de la paraula del dia en difícil (les respostes són les rimes de la
# clau) i l'assonant la del fàcil (les respostes són tot el grup assonant):
# cadascuna té les seves bosses i les seves quotes.
MENES = {"consonant": "cons", "assonant": "asson"}

# La proposta de partida: les difícils de tant en tant, les fàcils tant com
# donen de si perquè durin un any, i la resta al mig.
PER_DEFECTE_CONSONANT = {
    "des_de": 15,
    "regla": "costat",
    "dies_objectiu": 365,
    "bosses": [
        {"fins": 34, "quota": 1},
        {"fins": 49, "quota": 1.5},
        {"fins": 99, "quota": 4},
        {"fins": 249, "quota": 40},
        {"fins": 499, "quota": 36},
        {"fins": 999, "quota": 15},
        {"fins": 4999, "quota": 1.4},
        {"fins": 8999, "quota": 0.7},
        {"fins": 26000, "quota": 0.4},
    ],
}

# En assonant hi ha molts menys grups (uns 90 de jugables al central) i van de
# dues rimes a gairebé cent mil: les bosses van per ordres de magnitud.
PER_DEFECTE_ASSONANT = {
    "des_de": 15,
    "regla": "costat",
    "dies_objectiu": 30,
    "bosses": [
        {"fins": 49, "quota": 1.5},
        {"fins": 99, "quota": 2.5},
        {"fins": 499, "quota": 28.5},
        {"fins": 1999, "quota": 27.5},
        {"fins": 4999, "quota": 27},
        {"fins": 13999, "quota": 11},
        {"fins": 150000, "quota": 2},
    ],
}

PER_DEFECTE = {"consonant": PER_DEFECTE_CONSONANT, "assonant": PER_DEFECTE_ASSONANT}


def calcular_dades():
    """Les claus candidates, com a finestra_rimes.py: de cada una, les rimes al
    central (n) i els perfils de les seves paraules als quatre dialectes (f)."""
    codis = gd.ordre_de_tira(camins.dialectes())
    canonic = camins.CENTRAL if camins.CENTRAL in codis else codis[0]
    print("Llegint el diccionari...")
    base = gd.preparar_diccionari()
    for codi in codis:
        apendix = gd.llegir_apendix(codi)
        if apendix:
            base["apendixs"][codi] = apendix
    print("Comptant les rimes de cada dialecte...")
    per_mena, mostrar_de = fr.comptar(base, codis)
    claus = {}
    for nom, mena in MENES.items():
        claus[nom] = fr.claus_candidates(*per_mena[mena], mostrar_de, canonic, codis)
        print(f"{camins.mil(len(claus[nom]))} claus {nom}s poden donar paraula del dia")
    return {
        "generat": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "canonic": gd.NOMS_DE_DIALECTE.get(canonic, canonic),
        "i_canonic": codis.index(canonic),
        "dialectes": [gd.NOMS_DE_DIALECTE.get(c, c) for c in codis],
        "publicada": fr.finestra_publicada(),
        "per_defecte": PER_DEFECTE,
        "claus": claus,
    }


def main():
    analitzador = argparse.ArgumentParser(description="Pàgina per triar les bosses i les quotes de la paraula del dia.")
    analitzador.add_argument("--sortida", default=SORTIDA,
                             help=f"on s'escriu l'HTML ({camins.relatiu(SORTIDA)})")
    analitzador.add_argument("--sense-obrir", action="store_true", help="no l'obre al navegador")
    args = analitzador.parse_args()

    # Dins d'un <script>, un "</" de les dades el podria tancar abans d'hora.
    json_dades = json.dumps(calcular_dades(), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

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
