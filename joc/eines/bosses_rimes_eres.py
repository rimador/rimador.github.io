"""
El panell de selecció de les eres de la paraula del dia.

    python3 joc/eines/bosses_rimes_eres.py
    python3 joc/eines/bosses_rimes_eres.py --sortida /tmp/bosses.html --sense-obrir

Escriu joc/eines/bosses_rimes_eres.html i l'obre al navegador. No cal cap servidor: les
dades van a dins de la pàgina.

(La consulta de bosses d'abans de les eres, amb les tres regles dels quatre
dialectes, es conserva tal com era a bosses_rimes_consulta.py.)

LA IDEA. La paraula del dia surt de BOSSES: les claus es reparteixen per trams de
rimes i cada bossa té una QUOTA, el percentatge de dies que li toca, tingui les
claus que tingui. Dins de cada bossa les claus surten per voltes, sense repetir, i
cada clau gira entre les seves VARIANTS (les paraules que tenen les mateixes claus
als altres tres dialectes). Els talls, les quotes, la tolerància i les paraules per
variant formen la configuració d'una ERA (vegeu PROPOSTA_TRIA_DE_PARAULES.md).

A la pàgina tries la configuració de cada carril (el difícil és la rima consonant i
el fàcil l'assonant) i veus l'efecte abans de congelar res:

  - quantes claus entren a cada bossa i cada quan torna una clau (claus / quota);
  - quines claus queden fora per quin dialecte, i les variants de cada clau;
  - la dificultat que en resulta: mediana i quartils de les rimes, ponderats per
    les quotes;
  - cada quan torna la mateixa PARAULA, segons les paraules guardades per variant;
  - què faria l'IL·LIMITAT NATIU a cada dialecte, comptant-hi les seves rimes;
  - l'error del patró de les quotes (menys d'un dia amb les per defecte, però no
    amb qualsevol quota) i la mida aproximada de l'era;
  - una previsió dels propers dies amb la fórmula del joc de debò.

El botó d'exportar escriu config_era.json, que el congelador (congelar_era.py)
llegeix: es mou a joc/eines/. La pàgina no desa res per ella mateixa.

COMPTA COM EL JOC: les rimes surten de finestra_rimes.py, que compta amb les
mateixes funcions que el generador (generar_dades.py), i el codi de la fórmula
(llavor, generador, el patró i les baralles) es copia a la pàgina TAL COM ÉS de
joc/js/objectius.js i joc/js/bosses.js: cap còpia escrita a mà que pugui discrepar.
No toca res del joc: només llegeix. No és cap pas dels workflows.
"""

import argparse
import collections
import json
import os
import re
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

DIR_EINES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_EINES)

import variants_era as ve  # noqa: E402
import finestra_rimes as fr  # noqa: E402
import generar_dades as gd  # noqa: E402
import camins  # noqa: E402  (el generar_dades ja l'ha posat al camí)

PLANTILLA = os.path.join(DIR_EINES, "bosses_rimes_eres.plantilla.html")
SORTIDA = os.path.join(DIR_EINES, "bosses_rimes_eres.html")
DIR_JS = os.path.join(os.path.dirname(DIR_EINES), "js")

# Les dues menes de rima, amb el nom que tenen a la configuració del panell. La
# consonant és la del difícil (les respostes són les rimes de la clau) i l'assonant
# la del fàcil (les respostes són tot el grup assonant): cadascuna té les seves
# bosses i les seves quotes.
MENES = {"consonant": "cons", "assonant": "asson"}

# La proposta de partida: les difícils de tant en tant, les fàcils tant com donen de
# si perquè durin un any, i la resta al mig. Les quotes són percentatges (poden ser
# decimals): el congelador les normalitza a per mil enters.
#
# tolerancia            2 vol dir que a cada dialecte la clau ha de tenir entre ×0,5 i ×2
#                       de les rimes que té al central
# paraules_per_variant  quantes paraules es guarden de cada variant: 10 al difícil i
#                       200 al fàcil, on els grups tornen molt més sovint
# dies_objectiu         només per a l'avís del panell (cap bossa no hauria de durar
#                       menys): no es congela
PER_DEFECTE_CONSONANT = {
    "des_de": 15,
    "tolerancia": 2,
    "paraules_per_variant": 10,
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

# En assonant hi ha molts menys grups (uns 60 de candidats al central) i van de dues
# rimes a gairebé cent mil: les bosses van per ordres de magnitud.
PER_DEFECTE_ASSONANT = {
    "des_de": 15,
    "tolerancia": 2,
    "paraules_per_variant": 200,
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


# ------------------------------------------------ El codi del joc, a la pàgina

def extreu_funcio(text, nom):
    """El text d'una `export function nom(...) { ... }`, fins a la clau que la tanca.
    Serveix per a llavor i generador, que viuen entre moltes altres coses."""
    inici = text.index(f"export function {nom}(")
    nivell = 0
    for posicio in range(text.index("{", inici), len(text)):
        if text[posicio] == "{":
            nivell += 1
        elif text[posicio] == "}":
            nivell -= 1
            if nivell == 0:
                return text[inici:posicio + 1]
    raise ValueError(f"No trobo on acaba la funció {nom}")


def codi_del_joc():
    """llavor, generador i tot bosses.js, tal com són però sense els import/export
    de mòdul: el panell els carrega com a script normal. Així el patró, l'error de
    les quotes i la previsió dels dies són els del joc i no una còpia."""
    with open(os.path.join(DIR_JS, "objectius.js"), encoding="utf-8") as fitxer:
        objectius = fitxer.read()
    with open(os.path.join(DIR_JS, "bosses.js"), encoding="utf-8") as fitxer:
        bosses = fitxer.read()
    bosses = re.sub(r"^import .*$", "", bosses, flags=re.M)
    codi = "\n\n".join(extreu_funcio(objectius, nom) for nom in ("llavor", "generador"))
    codi += "\n\n" + bosses
    codi = re.sub(r"^export ", "", codi, flags=re.M)
    if "</script" in codi:
        raise ValueError("El codi del joc porta un </script: no es pot posar dins de la pàgina")
    return codi


# ------------------------------------------------------ Les dades del panell

def histograma(unitats):
    """[[clau, rimes, jugables], ...] -> [[rimes, quantes], ...]: del que s'ha de
    saber de les unitats natives n'hi ha prou amb quantes en tenen, de cada
    nombre de rimes (els talls els tria qui fa servir la pàgina)."""
    return sorted(collections.Counter(rimes for _, rimes, _ in unitats).items())


def calcular_dades():
    """Les claus candidates de cada carril amb totes les seves variants (abans de
    la tolerància, que es tria a la pàgina), i el que faria l'il·limitat natiu a
    cada dialecte.

    Una variant es guarda com a llista, perquè pesi poc:
      [rimes ×4, claus ×4, paraules, exemple, exemple, exemple]
    en l'ordre dels dialectes. Les claus són posicions a `claus_noms`."""
    dades = ve.llegir_dades()
    mostrar = lambda paraula: dades.mostrar_de.get(paraula, paraula)  # noqa: E731

    carrils = {}
    claus_noms = {}
    for nom, mena in MENES.items():
        unitats = ve.construir_unitats(ve.candidates_de(dades, mena), dades.i_canonic)
        posicions = [{} for _ in dades.codis]

        def posicio(j, clau):
            return posicions[j].setdefault(clau, len(posicions[j]))

        files = []
        for clau in sorted(unitats):
            unitat = unitats[clau]
            variants = []
            for variant in unitat.variants:
                exemples = [mostrar(p) for p in sorted(variant.paraules, key=ve.ordre_estable)[:3]]
                variants.append([*variant.rimes,
                                 *(posicio(j, c) for j, c in enumerate(variant.claus)),
                                 len(variant.paraules), *exemples])
            files.append([clau, unitat.n, variants])
        carrils[nom] = {
            "unitats": files,
            "natiu": {codi: histograma(ve.unitats_natives(dades, codi, mena)) for codi in dades.codis},
        }
        claus_noms[nom] = [sorted(p, key=p.get) for p in posicions]
        print(f"{camins.mil(len(files))} {'claus consonants' if mena == 'cons' else 'grups assonants'} "
              f"poden donar paraula del dia ({camins.mil(sum(len(f[2]) for f in files))} variants)")

    return {
        "generat": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "codis": dades.codis,
        "dialectes": [gd.NOMS_DE_DIALECTE.get(c, c) for c in dades.codis],
        "i_canonic": dades.i_canonic,
        "publicada": fr.finestra_publicada(),
        "per_defecte": PER_DEFECTE,
        "carrils": carrils,
        "claus_noms": claus_noms,
    }


def main():
    analitzador = argparse.ArgumentParser(description="Panell per triar la configuració de les eres de la paraula del dia.")
    analitzador.add_argument("--sortida", default=SORTIDA,
                             help=f"on s'escriu l'HTML ({camins.relatiu(SORTIDA)})")
    analitzador.add_argument("--sense-obrir", action="store_true", help="no l'obre al navegador")
    args = analitzador.parse_args()

    # Dins d'un <script>, un "</" de les dades el podria tancar abans d'hora.
    json_dades = json.dumps(calcular_dades(), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    with open(PLANTILLA, encoding="utf-8") as fitxer:
        html = fitxer.read()
    for marcador in ("__DADES__", "/*__CODI_JOC__*/"):
        if marcador not in html:
            raise SystemExit(f"{camins.relatiu(PLANTILLA)} no té el marcador {marcador}.")
    html = html.replace("/*__CODI_JOC__*/", codi_del_joc()).replace("__DADES__", json_dades)
    with open(args.sortida, "w", encoding="utf-8") as fitxer:
        fitxer.write(html)

    print(f"Desat a {args.sortida}")
    if not args.sense_obrir:
        webbrowser.open(Path(args.sortida).resolve().as_uri())


if __name__ == "__main__":
    main()
