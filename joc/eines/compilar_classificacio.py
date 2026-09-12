# Compilador de la classificacio (leaderboard) del joc.
#
# Funciona igual que stats/stats.py: llegeix el full de calcul de Google publicat
# en CSV (on el Google Apps Script va apuntant les puntuacions que envia la gent)
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
#   noms_ocupats    els sobrenoms que ja son a la classificacio, perque el joc
#                   no en deixi triar cap de repetit
#   estadistiques   quantes partides s'han jugat de cada cosa i amb quines
#                   puntuacions, per poder dir-li a qui acaba de jugar quin
#                   percentil ha fet i quina es la mitjana (vegeu
#                   joc/js/estadistiques.js). NO son els vint primers sino
#                   TOTES les partides, resumides en un histograma: dir "has
#                   superat el 72%" amb els vint millors seria mentida.
#
# Els tres es veuen al joc, a les dues pestanyes de la pantalla de classificacio
# (vegeu pintarDiaria i pintarModalitats a joc/js/).
#
# EL DIALECTE NO PARTEIX EL RANQUING. Es guarda al full i viatja amb cada
# entrada, i el joc el posa entre parentesis a cada fila, pero no fa taules a
# part: quatre classificacions de quatre persones cadascuna no son cap
# classificacio. Aixi tothom surt a la mateixa taula i es veu en que jugava.
#
# LES DUES DATES: el full en guarda dues (vegeu apps_script_classificacio.gs).
# La "Data" es quan va arribar l'enviament i la "DataPartida" de quin dia era la
# partida. El ranquing per dia agrupa per DataPartida, que es la que ho diu be:
# qui juga a les 23.55 i ho envia a les 00.05 ha jugat la paraula d'ahir.
#
# Execucio (a ma, quan es vulgui refrescar el ranquing):
#   python joc/eines/compilar_classificacio.py

import json
import os
import re
import ssl
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

#zone info
tz_espanya = ZoneInfo("Europe/Madrid")

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
TOP_N = 15

# I quantes al ranquing de sempre de la paraula del dia, que va a sota del dia
# que estiguis mirant.
TOP_DIARIA = 30

# Quants dies enrere de paraula del dia es publiquen. Amb 30 la pantalla te un
# mes per mirar i el JSON no creix sense aturador.
DIES_DIARIA = 30

# Mateixes regles que joc/js/classificacio.js: el navegador ja filtra, pero aqui
# ho tornem a comprovar perque es l'ultima porta abans de publicar.
LLARG_MIN, LLARG_MAX = 3, 16
CARACTERS_OK = re.compile(r"^[^\W_]+[\w .\-]*$", re.UNICODE)


DIR_JOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA_JSON = os.path.join(DIR_JOC, "dades", "classificacio.json")

NOM_MODE = {"illimitat": "Il·limitat", "diaria": "Paraula del dia"}
NOM_DIFICULTAT = {"facil": "Fàcil", "dificil": "Difícil"}

# Els rellotges de l'il·limitat (vegeu les opcions de temps de joc/index.html).
# Un rellotge que no sigui cap d'aquests es titula amb els segons i prou.
NOM_TEMPS = {"30": "Llampec", "60": "Estàndard", "120": "Lent"}

# Les columnes que ha de dur el full. Les dues ultimes son les que es van afegir
# quan el joc va passar a tenir dialectes: les files velles no les duen i se'ls
# posa un valor per defecte en comptes de descartar-les.
COLUMNES = ["Data", "Sobrenom", "Mode", "Dificultat", "Segons", "Punts",
            "Paraula", "Usuari", "Dialecte", "DataPartida"]


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
    return net


def titol_modalitat(mode, dificultat, segons):
    parts = [NOM_MODE.get(mode, mode), NOM_DIFICULTAT.get(dificultat, dificultat)]
    if mode != "diaria":
        parts.append(NOM_TEMPS.get(str(segons), f"{segons}s"))
    return " · ".join(parts)


def top_entrades(df, quantes=TOP_N):
    """De cada sobrenom, la millor puntuacio; despres, les millors de totes.

    Empat de punts: la MES NOVA. Ve de quan el sobrenom es canviava a la pantalla
    de FINAL: canviar-lo tornava a enviar la mateixa puntuacio amb el nom nou, i
    amb l'ordre d'abans la fila que guanyava era la vella, o sigui que el nom nou
    no sortia mai. Ara el nom es tria abans de comencar (vegeu refrescarJugador a
    joc/js/principal.js) i aquell cas ja no es pot donar, pero l'ordre es queda:
    al full hi ha les files d'abans, i entre dues puntuacions empatades la mes
    nova continua sent la que te mes sentit ensenyar.
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
            # Viatja amb l'entrada, no amb la taula: el joc el posa entre
            # parentesis a cada fila (vegeu subtitolEntrada a joc/js/ui.js).
            "dialecte": fila["Dialecte"],
            "data": fila["Data"].strftime("%d/%m/%Y") if pd.notna(fila["Data"]) else "",
        }
        for _, fila in millor.iterrows()
    ]


# --- Estadistiques ----------------------------------------------------------
#
# El que fa falta per dir-li a qui acaba de jugar com li ha anat comparat amb
# tothom: quantes partides hi ha, quina n'es la mitjana i quantes n'hi ha de
# cada puntuacio. L'histograma es el que permet calcular el percentil exacte al
# navegador sense publicar la llista de totes les partides: les puntuacions son
# nombres petits (0-100 i escaig), o sigui que son quatre parells de numeros.


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

    Compta PARTIDES, no persones: la pregunta que respon es "aquesta partida,
    com ha anat comparada amb les altres", i quedar-se nomes el rècord de cada
    persona respondria una altra.

    L'unica cosa que si que es treu son els enviaments repetits de la MATEIXA
    partida. Passaven quan algu es canviava el sobrenom a la pantalla de final i
    la puntuacio es tornava a enviar amb el nom nou; ara el nom es tria abans de
    comencar i ja no se'n fan de nous, pero al full hi ha els d'abans.
    """
    unic = ["Usuari", "dia", "Mode", "Dificultat", "Segons", "Dialecte", "Punts"]
    net = df.drop_duplicates(subset=unic)

    per_modalitat = {}
    for (mode, dificultat, segons), grup in net.groupby(["Mode", "Dificultat", "Segons"]):
        per_modalitat[f"{mode}|{dificultat}|{segons}"] = resum_estadistic(grup["Punts"])

    # La paraula del dia va per dia i dificultat, i NO per dialecte: n'hi ha
    # dues al dia i son les mateixes per a tothom (vegeu paraulaDelDia a
    # joc/js/objectius.js). El dialecte nomes canvia quantes rimes valen, i per
    # aixo continua sortint a cada fila del ranquing.
    per_dia = {}
    if not diaria.empty:
        recents = diaria[diaria["dia"].isin(dies)].drop_duplicates(subset=unic)
        for (dia, dificultat), grup in recents.groupby(["dia", "Dificultat"]):
            per_dia.setdefault(dia, {})[dificultat] = resum_estadistic(grup["Punts"])

    # I el total de sempre de la paraula del dia, per dificultat. Es la xarxa de
    # sota: el JSON es refa un cop al dia, o sigui que qui juga la paraula d'avui
    # abans que torni a passar el compilador no te encara cap dada d'avui, i val
    # mes comparar-lo amb totes les paraules del dia que no pas no dir-li res.
    totals = {}
    if not diaria.empty:
        net_diaria = diaria.drop_duplicates(subset=unic)
        for dificultat, grup in net_diaria.groupby("Dificultat"):
            totals[dificultat] = resum_estadistic(grup["Punts"])

    return {"modalitats": per_modalitat, "diaria": per_dia, "diaria_totals": totals}


# --- Proces -----------------------------------------------------------------


def noms_ocupats(df):
    """Els sobrenoms que ja son d'algu, normalitzats (minuscules i sense
    accents, com el clauDeSobrenom de joc/js/classificacio.js).

    El joc se'ls baixa amb la resta del fitxer i no deixa que ningu n'agafi un
    que ja hi es. No es cap garantia -la llista es d'ahir, i dues persones poden
    triar el mateix nom el mateix dia sense poder-ho saber-, pero aixo no trenca
    res: el ranquing separa la gent per identificador d'usuari i no pas pel nom
    (vegeu clau_persona), o sigui que en aquest cas surten dues files i no una
    de barrejada.
    """
    return sorted({sense_accents(nom) for nom in df["Sobrenom"].unique()})


def classificacio_buida():
    return {
        "actualitzacio": datetime.now(tz_espanya).strftime("%d/%m/%Y %H:%M:%S"),
        "modalitats": {},
        "diaria": {},
        "diaria_millors": {},
        "noms_ocupats": [],
        "estadistiques": {"modalitats": {}, "diaria": {}, "diaria_totals": {}},
    }


def main():
    if pd is None:
        raise SystemExit("Cal instal·lar pandas per compilar el full: pip install pandas")

    df = pd.read_csv(URL_FULL_CSV)

    # Els noms de columna els posa el Google Apps Script. Les que hi ha d'haver
    # sempre, si falten, son un full mal muntat i val mes dir-ho que no pas
    # publicar un ranquing a mitges.
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


    # El dia de la partida: el que diu el navegador i, si no el diu (files
    # velles), el dia que va arribar l'enviament.
    dia_arribada = df["Data"].dt.strftime("%Y-%m-%d")
    dia_partida = df["DataPartida"].str.strip()
    df["dia"] = dia_partida.where(dia_partida.str.match(r"^\d{4}-\d{2}-\d{2}$"), dia_arribada)

    # Filtrem perquè no agafi les dades d'avui (equivalent al filtre de stats.py)
    avui_str = datetime.now(tz_espanya).strftime("%Y-%m-%d")
    df = df[df["dia"] < avui_str]

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

    # Ranquings per modalitat (mode | dificultat | segons). El dialecte no hi
    # entra: tothom qui juga la mateixa modalitat surt a la mateixa taula.
    for (mode, dificultat, segons), grup in df.groupby(
            ["Mode", "Dificultat", "Segons"]):
        clau = f"{mode}|{dificultat}|{segons}"
        resultat["modalitats"][clau] = {
            "titol": titol_modalitat(mode, dificultat, segons),
            "top": top_entrades(grup),
        }

    # Ranquing especial de la paraula del dia, per dia i dificultat. Nomes els
    # DIES_DIARIA ultims dies: es una pantalla per mirar com va anar aquesta
    # setmana, no un arxiu historic.
    #
    # La paraula del dia es UNA per a tothom (vegeu paraulaDelDia a
    # joc/js/objectius.js); el que canvia amb el dialecte son les rimes que
    # valen. La paraula va igualment a cada entrada, al costat del dialecte, i
    # no pas a la capcalera del dia: la taula pot barrejar dies.
    diaria = df[(df["Mode"] == "diaria") & df["dia"].notna()].copy()
    dies = sorted(diaria["dia"].unique(), reverse=True)[:DIES_DIARIA] if not diaria.empty else []

    # Les estadistiques es calculen amb TOT el que ha arribat, abans de retallar
    # res: son partides, no ranquings (vegeu estadistiques()).
    resultat["estadistiques"] = estadistiques(df, diaria, dies)
    resultat["noms_ocupats"] = noms_ocupats(df)

    if not diaria.empty:
        # Els millors de SEMPRE es calculen abans de retallar els dies: es
        # justament la taula que no ha de dependre de quin dia estiguis mirant.
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
          f"de sempre, {partides} partides comptades a les estadístiques, "
          f"{len(resultat['noms_ocupats'])} sobrenoms ocupats "
          f"(hora: {datetime.now(tz_espanya).strftime('%H:%M:%S')}).")


def desar(dades):
    os.makedirs(os.path.dirname(RUTA_JSON), exist_ok=True)
    with open(RUTA_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dades, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
