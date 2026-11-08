# Compilador de la classificacio (leaderboard) del joc.
#
# Funciona igual que stats/stats.py: demana amb una clau el full de calcul de
# Google (on el Google Apps Script va apuntant les puntuacions que envia la gent)
# i n'escriu un ranquing net a joc/dades/classificacio.json, que es el que mostra
# la pantalla de classificacio del joc.
#
# Aqui es on es decideix de veritat que s'accepta: es validen els sobrenoms, es
# treuen els repetits i, de cada persona i modalitat, es guarda nomes la millor
# puntuacio.
#
# QUE EN SURT:
#   modalitats      ranquing de cada mode|dificultat|segons
#   diaria          ranquing de cada dia i dificultat, amb la paraula que tocava
#   diaria_millors  els TOP_DIARIA millors de sempre a la paraula del dia, per
#                   dificultat: la taula que no depen de quin dia miris
#   estadistiques   quantes partides s'han jugat de cada cosa i amb quines
#                   puntuacions, per poder dir-li a qui acaba de jugar quin
#                   percentil ha fet i quina es la mitjana.
#
# Els tres es veuen al joc, a les dues pestanyes de la pantalla de classificacio
# (vegeu pintarDiaria i pintarModalitats a joc/js/).
#
# EL DIALECTE NO PARTEIX EL RANQUING. Es guarda al full i viatja amb cada
# entrada, i el joc el posa entre parentesis a cada fila, pero no fa taules a
# part: quatre classificacions de quatre persones cadascuna no son cap
# classificacio. Aixi tothom surt a la mateixa taula i es veu en que jugava.
#
# Execucio (a ma, quan es vulgui refrescar el ranquing):
#   CLAU_LECTURA_FULLS='...' python joc/eines/compilar_classificacio.py

import io
import json
import os
import sys
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

#zone info
tz_espanya = ZoneInfo("Europe/Madrid")

try:
    import pandas as pd
except ModuleNotFoundError:
    pd = None

# L'eina de llegir els fulls privats la comparteix amb stats/stats.py.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "stats"))
from llegir_full import baixar_full

# --- Configuracio -----------------------------------------------------------

# El full es privat: es demana al seu Apps Script amb una clau (vegeu
# stats/llegir_full.py). L'adreca es la mateixa URL_ENVIAMENT de joc/js/classificacio.js.
URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbz6mXph0DU7jZPKg-EAHSbVPJoFLDgvNbocAGv4HGkruOH_ZoauwNKAxUu3SaRLbxPbzg/exec"

# Quantes posicions guardem per modalitat.
TOP_N = 15

# I quantes al ranquing de sempre de la paraula del dia, que va a sota del dia
# que estiguis mirant.
TOP_DIARIA = 30

# Quants dies enrere de paraula del dia es publiquen. Amb 30 la pantalla te un
# mes per mirar i el JSON no creix sense aturador.
DIES_DIARIA = 30


DIR_JOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA_JSON = os.path.join(DIR_JOC, "dades", "classificacio.json")

NOM_MODE = {"illimitat": "Il·limitat", "diaria": "Paraula del dia"}
NOM_DIFICULTAT = {"facil": "Fàcil", "dificil": "Difícil"}

# Els rellotges de l'il·limitat (vegeu les opcions de temps de joc/index.html).
# Un rellotge que no sigui cap d'aquests es titula amb els segons i prou.
NOM_TEMPS = {"30": "Llampec", "60": "Estàndard", "120": "Lent"}

# Quines partides son possibles. Han de dir el mateix que apps_script_classificacio.gs:
# l'Apps Script ja ho filtra al rebre-les, pero l'adreca on s'envien es publica i
# hi pot haver files d'abans de les comprovacions (o escrites a ma al full).
SEGONS_PERMESOS = {30, 60, 120}
SEGONS_DIARIA = 60
MAX_PUNTS_PER_SEGON = 1.5

# Les columnes que ha de dur el full. 
COLUMNES = ["Data", "Sobrenom", "Mode", "Dificultat", "Segons", "Punts",
            "Paraula", "Usuari", "Dialecte", "DataPartida"]


# --- Utilitats --------------------------------------------------------------

def sense_accents(text):
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    ).lower()


def titol_modalitat(mode, dificultat, segons):
    parts = [NOM_MODE.get(mode, mode), NOM_DIFICULTAT.get(dificultat, dificultat)]
    if mode != "diaria":
        parts.append(NOM_TEMPS.get(str(segons), f"{segons}s"))
    return " · ".join(parts)


def top_entrades(df, quantes=TOP_N):
    """De cada sobrenom, la millor puntuacio; despres, les millors de totes.
    Es manté la desduplicació per clau_persona per assegurar que una sola
    persona no ocupa tot el Top N.
    """
    millor = (
        df.sort_values(["Punts", "Data"], ascending=[False, False])
        .drop_duplicates(subset=["clau_persona"], keep="first")
        .head(quantes)
    )
    return [
        {
            "sobrenom": fila["Sobrenom"],
            "punts": int(fila["Punts"]),
            "paraula": fila["Paraula"],
            "dialecte": fila["Dialecte"],
            "data": fila["Data"].strftime("%d/%m/%Y") if pd.notna(fila["Data"]) else "",
        }
        for _, fila in millor.iterrows()
    ]


# --- Estadistiques ----------------------------------------------------------

def resum_estadistic(punts):
    """{partides, mitjana, histograma} d'una serie de puntuacions."""
    recompte = punts.value_counts()
    return {
        "partides": int(len(punts)),
        "mitjana": round(float(punts.mean()), 1),
        "histograma": {str(int(valor)): int(quantes)
                       for valor, quantes in sorted(recompte.items())},
    }


def estadistiques(df, diaria, dies):
    """El bloc "estadistiques" del JSON.
    Compta PARTIDES. Utilitzem directament els dataframes sense desduplicar partides,
    ja que el bug d'enviaments múltiples amb diferents noms ja està arreglat.
    """
    per_modalitat = {}
    for (mode, dificultat, segons), grup in df.groupby(["Mode", "Dificultat", "Segons"]):
        per_modalitat[f"{mode}|{dificultat}|{segons}"] = resum_estadistic(grup["Punts"])

    per_dia = {}
    if not diaria.empty:
        recents = diaria[diaria["dia"].isin(dies)]
        for (dia, dificultat), grup in recents.groupby(["dia", "Dificultat"]):
            per_dia.setdefault(dia, {})[dificultat] = resum_estadistic(grup["Punts"])

    totals = {}
    if not diaria.empty:
        for dificultat, grup in diaria.groupby("Dificultat"):
            totals[dificultat] = resum_estadistic(grup["Punts"])

    return {"modalitats": per_modalitat, "diaria": per_dia, "diaria_totals": totals}


# --- Proces -----------------------------------------------------------------

def classificacio_buida():
    return {
        "actualitzacio": datetime.now(tz_espanya).strftime("%d/%m/%Y %H:%M:%S"),
        "modalitats": {},
        "diaria": {},
        "diaria_millors": {},
        "estadistiques": {"modalitats": {}, "diaria": {}, "diaria_totals": {}},
    }


def main():
    if pd is None:
        raise SystemExit("Cal instal·lar pandas per compilar el full: pip install pandas")

    # Gestió estricta d'errors per aturar Github Actions si hi ha problemes
    try:
        df = pd.read_csv(io.StringIO(baixar_full(URL_APPS_SCRIPT, ["Data", "Sobrenom"])))
        if df.empty:
            raise ValueError("El CSV s'ha descarregat però està completament buit.")
    except Exception as e:
        raise SystemExit(f"ERROR GREU llegint el CSV de dades: {e}")

    falten = [c for c in COLUMNES if c not in df.columns]
    if falten:
        raise SystemExit(f"Al full li falten columnes: {', '.join(falten)}. "
                         "Mira les capceleres que demana apps_script_classificacio.gs.")

    df["Data"] = pd.to_datetime(df["Data"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
    df["Punts"] = pd.to_numeric(df["Punts"], errors="coerce")
    df = df.dropna(subset=["Punts"])
    df["Punts"] = df["Punts"].astype(int)

    for columna in ["Sobrenom", "Mode", "Dificultat", "Segons", "Paraula",
                    "Usuari", "Dialecte", "DataPartida"]:
        df[columna] = df[columna].fillna("").astype(str)

    # Nomes passen les partides que el joc pot haver jugat de veritat: un mode,
    # una dificultat i un rellotge que existeixen, i uns punts que caben en el
    # temps que dura la partida.
    segons_num = pd.to_numeric(df["Segons"], errors="coerce")
    segons_ok = segons_num.isin(SEGONS_PERMESOS)
    segons_ok &= (df["Mode"] != "diaria") | (segons_num == SEGONS_DIARIA)
    df = df[df["Mode"].isin(NOM_MODE) & df["Dificultat"].isin(NOM_DIFICULTAT)
            & segons_ok & (df["Punts"] <= segons_num * MAX_PUNTS_PER_SEGON)]

    # Nomes es valida la DataPartida (ignorem la de recepcio)
    dia_partida = df["DataPartida"].str.strip()
    df["dia"] = dia_partida.where(dia_partida.str.match(r"^\d{4}-\d{2}-\d{2}$"), None)
    df = df.dropna(subset=["dia"])

    # Filtrem perquè no agafi les dades d'avui
    avui_str = datetime.now(tz_espanya).strftime("%Y-%m-%d")
    df = df[df["dia"] < avui_str]

    # Els sobrenoms només han de no estar en blanc
    df["Sobrenom"] = df["Sobrenom"].str.strip()
    df = df[df["Sobrenom"] != ""]

    # La "persona" per desduplicar la taula del TOP
    df["clau_persona"] = df["Sobrenom"].map(sense_accents)

    resultat = classificacio_buida()

    # Ranquings per modalitat
    for (mode, dificultat, segons), grup in df.groupby(
            ["Mode", "Dificultat", "Segons"]):
        clau = f"{mode}|{dificultat}|{segons}"
        resultat["modalitats"][clau] = {
            "titol": titol_modalitat(mode, dificultat, segons),
            "top": top_entrades(grup),
        }

    # Ranquing especial de la paraula del dia
    diaria = df[(df["Mode"] == "diaria") & df["dia"].notna()].copy()
    dies = sorted(diaria["dia"].unique(), reverse=True)[:DIES_DIARIA] if not diaria.empty else []

    # Les estadistiques es calculen amb TOT el que ha arribat
    resultat["estadistiques"] = estadistiques(df, diaria, dies)

    if not diaria.empty:
        for dificultat, grup in diaria.groupby("Dificultat"):
            resultat["diaria_millors"][dificultat] = top_entrades(grup, TOP_DIARIA)

        diaria = diaria[diaria["dia"].isin(dies)]
        for dia, grup_dia in diaria.groupby("dia"):
            entrada = resultat["diaria"].setdefault(dia, {})
            for dificultat, grup in grup_dia.groupby("Dificultat"):
                entrada[dificultat] = top_entrades(grup)

    desar(resultat)
    
    n = sum(len(m["top"]) for m in resultat["modalitats"].values())
    millors = sum(len(v) for v in resultat["diaria_millors"].values())
    partides = sum(m["partides"] for m in resultat["estadistiques"]["modalitats"].values())
    
    print(f"Fet: {len(resultat['modalitats'])} modalitats, {n} puntuacions publicades, "
          f"{len(resultat['diaria'])} dies de paraula del dia, {millors} als millors "
          f"de sempre, {partides} partides comptades a les estadístiques "
          f"(hora: {datetime.now(tz_espanya).strftime('%H:%M:%S')}).")


def desar(dades):
    os.makedirs(os.path.dirname(RUTA_JSON), exist_ok=True)
    with open(RUTA_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dades, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()