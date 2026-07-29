# Compilador de la classificacio (leaderboard) del joc.
#
# Funciona igual que stats/stats.py: llegeix el full de calcul de Google publicat
# en CSV (on el Google Apps Script va apuntant les puntuacions que envia la gent)
# i n'escriu un rànquing net a joc/dades/classificacio.json, que es el que mostra
# la pantalla de classificacio del joc.
#
# Aqui es on es decideix de veritat que s'accepta: es validen els sobrenoms, es
# treuen els repetits i, de cada persona i modalitat, es guarda nomes la millor
# puntuacio.
#
# Execucio (a ma, quan es vulgui refrescar el rànquing):
#   python joc/eines/compilar_classificacio.py

import json
import os
import re
import ssl
import unicodedata
from datetime import datetime

# pandas nomes fa falta quan hi ha backend configurat. Si no hi es (per exemple
# en local, abans de muntar el full), l'script encara ha de poder escriure una
# classificacio buida, o sigui que no petem si falta.
try:
    import pandas as pd
except ModuleNotFoundError:
    pd = None

ssl._create_default_https_context = ssl._create_unverified_context

# --- Configuracio -----------------------------------------------------------

# El full publicat en CSV (Fitxer > Comparteix > Publica a la web > CSV). Mentre
# no hi sigui, l'script escriu una classificacio buida perque la pagina no peti.
URL_FULL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRwuOIIAtFLHbvQpMS_gHPTBOyge4TCoXb--viKHL3tTux1qkDgv9evA_wy2aYVzGKXTDfEefqtXC4l/pub?output=csv"

# Quantes posicions guardem per modalitat.
TOP_N = 20

# Mateixes regles que joc/js/classificacio.js: el navegador ja filtra, pero aqui
# ho tornem a comprovar perque es l'ultima porta abans de publicar.
LLARG_MIN, LLARG_MAX = 2, 16
CARACTERS_OK = re.compile(r"^[^\W_]+[\w .\-]*$", re.UNICODE)
PARAULES_VETADES = [
    "merda", "puta", "puto", "collo", "cabro", "fill de",
    "nazi", "hitler", "admin", "moderador",
]

ARREL = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RUTA_JSON = os.path.join(ARREL, "joc", "dades", "classificacio.json")

NOM_MODE = {"illimitat": "Il·limitat", "diaria": "Paraula del dia"}
NOM_DIFICULTAT = {"facil": "Fàcil", "dificil": "Difícil"}
NOM_TEMPS = {"45": "Llampec", "60": "1 minut", "90": "Estàndard", "180": "Lent"}


# --- Utilitats --------------------------------------------------------------


def sense_accents(text):
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    ).lower()


def sobrenom_valid(text):
    net = re.sub(r"\s+", " ", str(text).strip())
    if not (LLARG_MIN <= len(net) <= LLARG_MAX):
        return None
    if not CARACTERS_OK.match(net):
        return None
    pla = sense_accents(net)
    if any(mot in pla for mot in PARAULES_VETADES):
        return None
    return net


def titol_modalitat(mode, dificultat, segons):
    parts = [NOM_MODE.get(mode, mode), NOM_DIFICULTAT.get(dificultat, dificultat)]
    if mode != "diaria":
        parts.append(NOM_TEMPS.get(str(segons), f"{segons}s"))
    return " · ".join(parts)


def top_entrades(df):
    """De cada sobrenom, la millor puntuacio; despres, les TOP_N millors."""
    millor = (
        df.sort_values("Punts", ascending=False)
        .drop_duplicates(subset=["clau_persona"], keep="first")
        .head(TOP_N)
    )
    return [
        {
            "sobrenom": fila["Sobrenom"],
            "punts": int(fila["Punts"]),
            "paraula": fila["Paraula"],
            "data": fila["Data"].strftime("%d/%m/%Y") if pd.notna(fila["Data"]) else "",
        }
        for _, fila in millor.iterrows()
    ]


# --- Proces -----------------------------------------------------------------


def classificacio_buida():
    return {
        "actualitzacio": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "modalitats": {},
        "diaria": {},
    }


def main():
    if not URL_FULL_CSV:
        print("URL_FULL_CSV no configurada: escric una classificacio buida.")
        desar(classificacio_buida())
        return
    if pd is None:
        raise SystemExit("Cal instal·lar pandas per compilar el full: pip install pandas")

    df = pd.read_csv(URL_FULL_CSV)
    # Els noms de columna els posa el Google Apps Script; els deixem tal qual.
    df["Data"] = pd.to_datetime(df["Data"], format="%d/%m/%Y %H:%M:%S", errors="coerce")
    df["Punts"] = pd.to_numeric(df["Punts"], errors="coerce")
    df = df.dropna(subset=["Punts"])
    df["Punts"] = df["Punts"].astype(int)

    for columna in ["Sobrenom", "Mode", "Dificultat", "Segons", "Paraula", "Usuari"]:
        df[columna] = df[columna].astype(str)

    # Nomes puntuacions amb sobrenom acceptable.
    df["Sobrenom"] = df["Sobrenom"].map(sobrenom_valid)
    df = df.dropna(subset=["Sobrenom"])

    # La "persona" per desduplicar: el sobrenom (en minuscula i sense accents) o,
    # si el tenim, l'identificador d'usuari. Aixi una mateixa persona no ocupa
    # mitja taula amb el mateix nom.
    df["clau_persona"] = df["Usuari"].where(
        df["Usuari"].str.startswith("usr_"), df["Sobrenom"].map(sense_accents)
    )

    resultat = classificacio_buida()

    # Rànquings per modalitat (mode | dificultat | segons).
    for (mode, dificultat, segons), grup in df.groupby(["Mode", "Dificultat", "Segons"]):
        clau = f"{mode}|{dificultat}|{segons}"
        resultat["modalitats"][clau] = {
            "titol": titol_modalitat(mode, dificultat, segons),
            "top": top_entrades(grup),
        }

    # Rànquing especial de la paraula del dia, per data i dificultat.
    diaria = df[df["Mode"] == "diaria"].copy()
    if not diaria.empty:
        diaria["dia"] = diaria["Data"].dt.strftime("%Y-%m-%d")
        for (dia, dificultat), grup in diaria.groupby(["dia", "Dificultat"]):
            if pd.isna(dia):
                continue
            entrada = resultat["diaria"].setdefault(
                dia, {"paraula": grup["Paraula"].mode().iat[0] if not grup["Paraula"].mode().empty else ""}
            )
            entrada[dificultat] = top_entrades(grup)

    desar(resultat)
    n = sum(len(m["top"]) for m in resultat["modalitats"].values())
    print(f"Fet: {len(resultat['modalitats'])} modalitats, {n} puntuacions publicades "
          f"(hora: {datetime.now().strftime('%H:%M:%S')}).")


def desar(dades):
    os.makedirs(os.path.dirname(RUTA_JSON), exist_ok=True)
    with open(RUTA_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dades, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
