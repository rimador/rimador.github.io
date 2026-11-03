"""
EINA LOCAL. Quines transcripcions del central has editat a mà, comparant la
col_10 amb el que en diu l'API de l'Aina. Són les que potser cal corregir
també als altres dialectes, que encara diuen el que deia l'Aina.

    python3 diccionaris/python/comparar_aina.py
    python3 diccionaris/python/comparar_aina.py --aina /un/altre/directori

Escriu editades_central.tsv al costat d'aquest fitxer (una fila per entrada
editada) i un resum per pantalla. No toca res més. Per corregir-les, el
corregir_dialectes.py, que fa servir la mateixa comparació.

D'ON SURT L'AINA. Del directori on ha corregut l'api_aina.py (vegeu DIR_AINA):
l'entrada (col_0.txt) i una sortida per dialecte (col_0_central.txt,
col_0_balear.txt, ...), fila per fila amb l'entrada. L'API transcriu paraules
soles, sense lema ni codi, i per això aquí s'aparellen per PARAULA i no per
fila: així la comparació aguanta que el diccionari hagi canviat des que va
córrer. Les paraules que no hi són (donades d'alta després) es compten i prou.

QUÈ VOL DIR "TOCAT". Una entrada editada al central pot tenir els altres
dialectes encara com els deia l'Aina (els has de mirar) o algun ja diferent
(algú ja hi ha passat, o es van agafar d'una altra banda). Les dues coses
surten a la llista, i el servidor les separa.
"""

import argparse
import os
import sys

DIR_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if DIR_SCRIPTS not in sys.path:
    sys.path.insert(0, DIR_SCRIPTS)

import camins
import col_10 as modul_col_10

# On va córrer l'api_aina.py amb el diccionari d'ara (novembre del 2026), fora
# del repositori: són 35 MB que no es publiquen.
DIR_AINA = os.path.join(os.path.dirname(camins.ARREL), "alia rimador",
                        "pronoms:previa (10:10:26)", "proves_generador_dialectes",
                        "api_aina_nou")
# Com diu l'api_aina.py cada dialecte (en minúscula, que és com els anomena
# en escriure'ls).
NOMS_AINA = {"ca": "central", "ba": "balear", "nw": "occidental", "va": "valencia"}
SORTIDA = os.path.join(DIR_SCRIPTS, "editades_central.tsv")


def llegir_aina(directori=DIR_AINA):
    """{codi: {paraula: transcripció}} de cada dialecte que hi hagi."""
    entrada = os.path.join(directori, "col_0.txt")
    if not os.path.exists(entrada):
        sys.exit(f"No trobo {entrada}: és l'entrada de l'api_aina.py. Passa-li el "
                 f"directori on va córrer amb --aina.")
    paraules = [linia.strip() for linia in open(entrada, encoding="utf-8") if linia.strip()]
    aina = {}
    for codi, nom in NOMS_AINA.items():
        cami = os.path.join(directori, f"col_0_{nom}.txt")
        if not os.path.exists(cami):
            continue
        transcripcions = [linia.rstrip("\n") for linia in open(cami, encoding="utf-8")]
        if len(transcripcions) != len(paraules):
            sys.exit(f"{cami} té {camins.mil(len(transcripcions))} línies i l'entrada "
                     f"{camins.mil(len(paraules))}: no van fila per fila.")
        aina[codi] = dict(zip(paraules, transcripcions))
    if camins.CENTRAL not in aina:
        sys.exit(f"No trobo col_0_central.txt a {directori}: sense el central no hi ha "
                 f"res a comparar.")
    return aina


def entrada(fila, linia, aina):
    """Una línia de la col_10 partida i, al costat, què en diu l'Aina."""
    trossos = modul_col_10.TROS.split(linia)
    paraula, lema, codi = trossos[0].split(modul_col_10.SEPARADOR)
    ara = dict(zip(trossos[1::2], trossos[2::2]))
    de_laina = {dialecte: aina[dialecte].get(paraula) for dialecte in aina}
    return {
        "fila": fila,
        "linia": linia,
        "paraula": paraula,
        "lema": lema,
        "codi": codi,
        "ara": ara,
        "aina": de_laina,
        # Els altres dialectes que ja no diuen el que deia l'Aina.
        "tocats": [dialecte for dialecte, valor in ara.items()
                   if dialecte != camins.CENTRAL and dialecte in de_laina
                   and valor != de_laina[dialecte]],
    }


def es_editada(linia, aina):
    """Si el central d'aquesta línia no és el de l'Aina. None si l'Aina no la té.

    Es mira sense partir la línia sencera: són mig milió i la gran majoria
    diuen el mateix que l'Aina."""
    paraula = linia.split(modul_col_10.SEPARADOR, 1)[0]
    central = aina[camins.CENTRAL].get(paraula)
    if central is None:
        return None
    marca = modul_col_10.marca(camins.CENTRAL).rstrip()
    despres = linia.split(marca, 1)[1].lstrip(" ")
    return despres.split(" €$", 1)[0] != central


def comparar(linies, aina):
    """Torna (editades, sense_aina): les entrades on el central no és el de
    l'Aina, i quantes línies són de paraules que l'Aina no té."""
    editades, sense_aina = [], 0
    for fila, linia in enumerate(linies):
        editada = es_editada(linia, aina)
        if editada is None:
            sense_aina += 1
        elif editada:
            editades.append(entrada(fila, linia, aina))
    return editades, sense_aina


def escriure_tsv(editades, cami=SORTIDA):
    dialectes = [camins.CENTRAL] + sorted(codi for codi in NOMS_AINA if codi != camins.CENTRAL)
    capcalera = ["fila", "paraula", "lema", "codi", "tocats"]
    for codi in dialectes:
        capcalera += [f"aina_{codi}", codi]
    with open(cami, "w", encoding="utf-8") as sortida:
        sortida.write("\t".join(capcalera) + "\n")
        for e in editades:
            camps = [str(e["fila"] + 1), e["paraula"], e["lema"], e["codi"], ",".join(e["tocats"])]
            for codi in dialectes:
                camps += [e["aina"].get(codi) or "", e["ara"].get(codi, "")]
            sortida.write("\t".join(camps) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Quines transcripcions del central són editades.")
    parser.add_argument("--aina", default=DIR_AINA,
                        help="el directori on va córrer l'api_aina.py")
    opcions = parser.parse_args()

    aina = llegir_aina(opcions.aina)
    linies = camins.llegir_columna(camins.COL_10)
    editades, sense_aina = comparar(linies, aina)
    escriure_tsv(editades)

    sense_tocar = sum(1 for e in editades if not e["tocats"])
    print(f"col_10.txt: {camins.mil(len(linies))} línies")
    if sense_aina:
        print(f"  {camins.mil(sense_aina)} són de paraules que l'Aina no té (no es comparen)")
    print(f"  {camins.mil(len(editades))} amb el central editat:")
    print(f"    {camins.mil(sense_tocar)} amb els altres dialectes encara com l'Aina (per mirar)")
    print(f"    {camins.mil(len(editades) - sense_tocar)} amb algun altre dialecte ja tocat")
    print(f"\nLa llista és a {camins.relatiu(SORTIDA)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
