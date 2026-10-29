import hashlib
import pandas as pd
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

# hora no utc
tz_espanya = ZoneInfo("Europe/Madrid") 

# Els codis dels dialectes, en l'ordre de la tira de pastilles del web (la
# llista DIALECTES de js/components.js). Manen ells i no el recompte: els codis
# del costat de cada rima i els trossos de la barra de dialectes surten sempre
# en aquest ordre, i així no es reordenen sols d'un dia a l'altre.
ORDRE_DIALECTES = ['ca', 'nw', 'va', 'ba']

# Quin dialecte tenien les cerques d'abans que se'n pogués triar cap: el
# central, que era l'únic que hi havia. Mateix codi (i mateixa idea) que el
# DIALECTE_ANTIC de joc/eines/compilar_classificacio.py.
#
# NOMÉS es fa servir per a les nàufragues, i no pas per als recomptes de
# dialecte, que és una diferència a posta. Preguntar-li a una fila vella "quin
# dialecte va triar aquesta persona?" no té resposta (no en podia triar cap, i
# per això no compta a la barra de dialectes); preguntar-li "aquella paraula
# tenia rima?" sí que en té, i és la del central.
DIALECTE_ANTIC = 'ca'

# agafar excel drive i netejar dades
url_google_sheet = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2bwhVaSdCKFkzXsqpVdufvVrOFankBE5CTTD1dHMbzhFXnSBgn2mXYgnGjrXt41FgHU6WmIGr7Gw/pub?gid=0&single=true&output=csv"
df = pd.read_csv(url_google_sheet)

df['Data'] = pd.to_datetime(df['Data'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
df = df.dropna(subset=['Data']).copy()
df['Dia'] = df['Data'].dt.date
df['Usuari'] = df['Usuari'].astype(str)
df['Paraula'] = df['Paraula'].astype(str)
df['Codi'] = df['Codi'].astype(str)
df['Rima'] = df['Rima'].astype(str)
df['Tipus de rima'] = df['Tipus de rima'].astype(str)
df['Num. síl·'] = df['Num. síl·'].astype(str)
df['Comença per'] = df['Comença per'].astype(str)
df['Incloure NP'] = df['Incloure NP'].astype(str)
df['Incloure pl.'] = df['Incloure pl.'].astype(str)

# El dialecte de cada cerca. El web l'envia des que hi ha la tira de dialectes
# (vegeu registrarCerca a js/script.js) i qui l'apunta al full és
# stats/apps_script_cerques.gs.
#
# Es llegeix a la defensiva per dos motius: el gruix del full és d'abans que
# existís la columna i la duu buida, i si algú refà el full sense la columna,
# val més que les estadístiques surtin sense dialectes que no pas que no surtin.
#
# Les files sense dialecte NO compten als recomptes de dialecte. No s'hi posa
# 'ca' encara que aquelles cerques fossin de fet en central (era l'únic que hi
# havia), perquè el que diuen aquells recomptes és quin dialecte TRIA la gent, i
# qui no el podia triar no hi diu res. Si algun dia es vol el contrari, és posar
# DIALECTE_ANTIC al replace de sota. (A les nàufragues sí que s'hi suposa el
# central, que allà la pregunta és una altra: vegeu son_naufragues.)
if 'Dialecte' not in df.columns:
    print("  (el full no té la columna Dialecte: les dades de dialectes sortiran buides)")
    df['Dialecte'] = ''
df['Dialecte'] = df['Dialecte'].fillna('').astype(str).str.strip().replace({'nan': '', 'None': ''})

#dades i coses del temps
avui = datetime.now(tz_espanya).date()
inici_setmana = avui - timedelta(days=7)
ahir = avui - timedelta(days=1)

data_inici = pd.to_datetime(inici_setmana)
data_fi = pd.to_datetime(ahir) + timedelta(days=1, seconds=-1)

# Quants dies enrere miren els dos podis de "menys" (menys cerques i menys
# usuaris; vegeu obtenir_top_dies). Si es canvia, cal canviar també els títols i
# l'explicació de dades.html, que diuen el número.
DIES_PODIS_MENYS = 60

# VARIABLES
# El dialecte hi entra com un filtre més: la mateixa paraula cercada en central
# i en valencià dona rimes diferents i són, doncs, dues cerques diferents. Amb
# el full d'ara no canvia cap xifra (la columna és buida a tot arreu), però sense
# això, el dia que arribin dades, dues cerques de debò diferents es fondrien en
# una i els dialectes sortirien comptats de menys.
cerques_totals = df.drop_duplicates(subset=['Dia', 'Usuari', 'Paraula', 'Tipus de rima', 'Num. síl·', 'Comença per', 'Incloure NP', 'Incloure pl.', 'Dialecte']).copy()
cerques_totals = cerques_totals[cerques_totals['Dia'] < avui].copy()

paraules_cercades = cerques_totals[cerques_totals['Rima'] != '***'].drop_duplicates(subset=['Paraula']).copy()

paraules_cercades_usuaris_diferents = cerques_totals.drop_duplicates(subset=['Paraula', 'Usuari']).copy()
paraules_cercades_usuaris_diferents_trobades = paraules_cercades_usuaris_diferents[paraules_cercades_usuaris_diferents['Rima'] != '***'].copy()

# El dialecte també hi compta: qui cerca la mateixa paraula en dos dialectes
# obté dues terminacions diferents i ha de sumar a totes dues.
rimes_usuaris_diferents = cerques_totals.drop_duplicates(subset=['Paraula', 'Tipus de rima', 'Usuari', 'Dialecte']).copy()
rimes_usuaris_diferents = rimes_usuaris_diferents[['Rima', 'Tipus de rima', 'Dialecte']]
rimes_usuaris_diferents = rimes_usuaris_diferents[rimes_usuaris_diferents['Rima'] != '***'].copy()


#df paraules nàufragues
# Ser nàufraga (no tenir cap rima consonant amb cap altre mot) depèn de com es
# parli: n'hi ha 4.593 al central, 5.123 al nord-occidental, 5.300 en valencià i
# 4.726 al balear, i no són les mateixes. Cada dialecte té, doncs, la seva
# llista (vegeu llistes/generar_naufragues.py), i cada cerca s'ha de comparar
# amb la del dialecte en què es va fer: mirar-ho tot contra la del central
# voldria dir dir que "xarxa" no rima en valencià perquè no rima a Barcelona.
naufragues_per_dialecte = {}
for codi_dialecte in ORDRE_DIALECTES:
    with open(f'llistes/paraules_naufragues_{codi_dialecte}.json', 'r', encoding='utf-8') as arxiu:
        naufragues_per_dialecte[codi_dialecte] = {
            item['paraula'].lower() for item in json.load(arxiu)
        }


def son_naufragues(df_dades):
    """Quines files van cercar una paraula sense rima AL SEU dialecte.

    Torna una màscara per a filtrar el df. Les files sense dialecte (les
    d'abans que la tira existís) es miren contra la llista del central, que és
    l'únic que hi havia quan es van fer.
    """
    dialectes = df_dades['Dialecte'].where(
        df_dades['Dialecte'].isin(ORDRE_DIALECTES), DIALECTE_ANTIC)

    return pd.Series(
        [paraula in naufragues_per_dialecte[codi]
         for paraula, codi in zip(df_dades['Paraula'], dialectes)],
        index=df_dades.index,
        dtype=bool)


# Es filtren les nàufragues ABANS de treure els repetits, i no al revés.
# Ara que la llista depèn del dialecte, una mateixa paraula pot ser nàufraga en
# una cerca i no pas en una altra del mateix usuari: si primer es tragués el
# repetit, sobreviuria una fila qualsevol de les dues i el fet d'haver topat amb
# una paraula sense rima es perdria la meitat de les vegades. Fent-ho en aquest
# ordre, qualsevol cerca que hi topi compta, i el drop_duplicates de després
# continua deixant que cada usuari sumi un sol cop per paraula.
df_rimes_naufragues = cerques_totals[cerques_totals['Tipus de rima'] == 'r.consonant'].copy()
df_rimes_naufragues = df_rimes_naufragues[son_naufragues(df_rimes_naufragues)]
df_rimes_naufragues = df_rimes_naufragues.drop_duplicates(subset=['Paraula', 'Usuari']).copy()


#els errors de cerca (mots que no són al diccionari), comptats com la resta de
#tops: cada usuari suma un sol cop per error, encara que el repiqui deu vegades
#seguides mirant si ara sí que surt
df_typos = paraules_cercades_usuaris_diferents[paraules_cercades_usuaris_diferents['Rima'] == '***'].copy()


mascara_cerques = (cerques_totals['Data'] >= data_inici) & (cerques_totals['Data'] <= data_fi)
cerques_totals_emmascarat = cerques_totals[mascara_cerques].copy()

paraules_cercades_emmascarades = cerques_totals_emmascarat.drop_duplicates(subset=['Paraula']).copy()
paraules_cercades_emmascarades = paraules_cercades_emmascarades[paraules_cercades_emmascarades['Rima'] != '***'].copy()

paraules_cercades_usuaris_diferents_emmascarat = cerques_totals_emmascarat.drop_duplicates(subset=['Paraula', 'Usuari']).copy()
paraules_cercades_usuaris_diferents_emmascarat_trobades = paraules_cercades_usuaris_diferents_emmascarat[paraules_cercades_usuaris_diferents_emmascarat['Rima'] != '***'].copy()

rimes_usuaris_diferents_emmascarat = cerques_totals_emmascarat.drop_duplicates(subset=['Paraula', 'Tipus de rima', 'Usuari', 'Dialecte']).copy()
rimes_usuaris_diferents_emmascarat = rimes_usuaris_diferents_emmascarat[['Rima', 'Tipus de rima', 'Dialecte']]
rimes_usuaris_diferents_emmascarat = rimes_usuaris_diferents_emmascarat[rimes_usuaris_diferents_emmascarat['Rima'] != '***'].copy()

noms_propis = paraules_cercades[paraules_cercades['Codi'].str.startswith('NP')].copy()

#dfs de recència: només serveixen per desempatar els tops (data de l'última cerca),
#no intervenen en cap recompte
recencia_paraules = cerques_totals[cerques_totals['Rima'] != '***']
recencia_paraules_emmascarat = cerques_totals_emmascarat[cerques_totals_emmascarat['Rima'] != '***']
recencia_naufragues = cerques_totals[(cerques_totals['Tipus de rima'] == 'r.consonant') & son_naufragues(cerques_totals)]
recencia_typos = cerques_totals[cerques_totals['Rima'] == '***']

#funcions
def dialectes_de_cada_entrada(df_dades, claus):
    """Els codis de dialecte que hi ha darrere de cada entrada d'un top.

    Serveix per als dos tops que en duen: el de rimes i el de nàufragues. Tots
    dos ajunten en una sola línia cerques que es poden haver fet en dialectes
    diferents —una mateixa terminació pot sortir de més d'un dialecte (la /i/ de
    "camí" rima igual es parli com es parli), i una paraula pot no rimar en més
    d'un—, i el número del costat les compta totes plegades: cal, doncs, dir
    d'on venen.

    Les files sense dialecte (les d'abans que es pogués triar) no hi aporten
    res, i per això ara mateix totes les llistes surten buides.

    Torna una taula amb les mateixes claus que el top i una columna
    'dialectes' amb els codis ordenats com a ORDRE_DIALECTES.
    """
    amb_dialecte = df_dades[df_dades['Dialecte'].isin(ORDRE_DIALECTES)]

    #sense cap fila amb dialecte, el groupby tornaria una sèrie buida sense
    #columnes on agafar-se i el merge de sota petaria: val més fabricar aquí la
    #taula de llistes buides que no pas deixar el top sense sortir
    if amb_dialecte.empty:
        buida = df_dades[claus].drop_duplicates().copy()
        buida['dialectes'] = [[] for _ in range(len(buida))]
        return buida

    codis = amb_dialecte.groupby(claus)['Dialecte'].apply(
        lambda valors: sorted(set(valors), key=ORDRE_DIALECTES.index)
    )
    return codis.rename('dialectes').reset_index()


def obtenir_top_paraules(df_dades, n, paraula, df_recencia, amb_dialectes=False):
    if paraula == 'paraula':
        claus = ['Paraula']
    elif paraula == 'rima':
        claus = ['Rima', 'Tipus de rima']
    else:
        raise ValueError("El paràmetre 'paraula' només pot ser 'paraula' o 'rima'.")

    recompte = df_dades.groupby(claus).size().reset_index(name='cerques')
    ultima_cerca = df_recencia.groupby(claus)['Data'].max().rename('ultima_cerca')
    recompte = recompte.merge(ultima_cerca, on=claus, how='left')

    #d'on venen les cerques de cada entrada. Només ho demanen el top de rimes i
    #el de nàufragues; al de paraules cercades i al d'errors de picatge no hi va,
    #que allà el dialecte no canvia res del que s'hi explica.
    #
    #Es mira el df_recencia i no pas el df_dades a posta: el df_dades ja ha
    #passat pel drop_duplicates i, al top de nàufragues, aquell no inclou el
    #dialecte (el recompte és d'usuaris únics per paraula, i ha de continuar
    #sent-ho). Qui cerqués la mateixa paraula nàufraga en dos dialectes hi
    #deixaria una sola fila i un dels dos codis es perdria. El df_recencia són
    #les mateixes cerques abans de treure'n cap.
    if amb_dialectes:
        recompte = recompte.merge(dialectes_de_cada_entrada(df_recencia, claus), on=claus, how='left')
        #les entrades que no han tingut cap cerca amb dialecte queden a NaN, i
        #el JSON ha de dur una llista buida, no pas un nul
        recompte['dialectes'] = recompte['dialectes'].apply(lambda v: v if isinstance(v, list) else [])

    #en cas d'empat de cerques, primer la que s'ha cercat més recentment
    recompte = recompte.sort_values(by=['cerques', 'ultima_cerca'], ascending=[False, False], kind='stable')
    return recompte.head(n).drop(columns='ultima_cerca')

def obtenir_top_dies(df_dades):
    df_dades = df_dades[df_dades['Dia'] < avui]
    cerques_per_dia = df_dades['Dia'].value_counts().reset_index()
    cerques_per_dia.columns = ['Dia', 'cerques']
    usuaris_per_dia = df_dades.groupby('Dia')['Usuari'].nunique().reset_index()
    usuaris_per_dia.columns = ['Dia', 'usuaris']

    #els podis de "menys" només miren els darrers DIES_PODIS_MENYS dies (d'avui
    #menys 60 fins a ahir, com el gràfic de línies amb els seus 30). Amb tot
    #l'històric, s'hi quedaven per sempre els dies del començament, quan el
    #Rimador encara no el coneixia ningú, i no deien res de com va ara.
    primer_dia_menys = avui - timedelta(days=DIES_PODIS_MENYS)
    cerques_recents = cerques_per_dia[cerques_per_dia['Dia'] >= primer_dia_menys]
    usuaris_recents = usuaris_per_dia[usuaris_per_dia['Dia'] >= primer_dia_menys]

    #en cas d'empat, primer el dia més recent (mateix criteri que als tops de
    #paraules). Sense la clau del dia l'ordre entre empatats era el que sortia
    #de l'ordenació, que no és estable ni previsible.
    cerques_top = cerques_per_dia.sort_values(by=['cerques', 'Dia'], ascending=[False, False], kind='stable').head(3)
    cerques_anti = cerques_recents.sort_values(by=['cerques', 'Dia'], ascending=[True, False], kind='stable').head(3)
    usuaris_top = usuaris_per_dia.sort_values(by=['usuaris', 'Dia'], ascending=[False, False], kind='stable').head(3)
    usuaris_anti = usuaris_recents.sort_values(by=['usuaris', 'Dia'], ascending=[True, False], kind='stable').head(3)

    return {
        "top_cerques": [{"data": d.strftime("%d/%m/%Y"), "total": int(c)} for d, c in zip(cerques_top['Dia'], cerques_top['cerques'])],
        "top_usuaris": [{"data": d.strftime("%d/%m/%Y"), "total": int(u)} for d, u in zip(usuaris_top['Dia'], usuaris_top['usuaris'])],
        "anti_top_cerques": [{"data": d.strftime("%d/%m/%Y"), "total": int(c)} for d, c in zip(cerques_anti['Dia'], cerques_anti['cerques'])],
        "anti_top_usuaris": [{"data": d.strftime("%d/%m/%Y"), "total": int(u)} for d, u in zip(usuaris_anti['Dia'], usuaris_anti['usuaris'])]

    }

def dades_grafic_linia(df_dades):
    avui = datetime.now(tz_espanya).date()
    data_inici = avui - timedelta(days=30)
    data_fi = avui - timedelta(days=1)

    mascara_temps = (df_dades['Dia'] >= data_inici) & (df_dades['Dia'] <= data_fi)
    df_filtrat = df_dades[mascara_temps]

    recompte_diari = df_filtrat['Dia'].value_counts()

    resultat = []

    for i in range(30, 0, -1):
        dia_actual = avui - timedelta(days=i)
        total_cerques = recompte_diari.get(dia_actual, 0)
        total_usuaris = df_filtrat[df_filtrat['Dia'] == dia_actual]['Usuari'].nunique()

        resultat.append({
            "data": dia_actual.strftime("%d/%m"),
            "cerques": int(total_cerques),
            "usuaris": int(total_usuaris)
        })

    return resultat

def dades_grafic_formatge_totes(df_dades, tipus_rima):
    df_filtrat = df_dades[df_dades['Tipus de rima'] == tipus_rima]
    recompte = df_filtrat['Rima'].value_counts()

    return [
        {"rima": str(rima), "vegades": int(total)}
        for rima, total in recompte.items()
    ]

def dades_grafic_hores(df_dades):
    hores_minuts = df_dades['Data'].dt.floor('30min').dt.strftime('%H:%M')
    recompte_hores = hores_minuts.value_counts()    
    total_cerques = len(hores_minuts.dropna())
    
    resultat = []
    
    for h in range(24):
        for m in ['00', '30']:
            hora_str = f"{h:02d}:{m}"
            total_hora = recompte_hores.get(hora_str, 0)
            percentatge = (total_hora / total_cerques * 100) if total_cerques > 0 else 0
            
            resultat.append({
                "hora": hora_str,
                "percentatge": round(percentatge, 2) 
            })
    return resultat


def formatar_top_per_json(dades):
    df_temp = dades.rename(columns={'Paraula': 'paraula', 'Rima': 'paraula', 'Tipus de rima': 'tipus'})
    return df_temp.to_dict(orient='records')


#execució
dades_json = {
    "actualitzacio": datetime.now(tz_espanya).strftime("%d/%m/%Y %H:%M:%S"),
    "setmana": {
        "text_dies": f"{inici_setmana.day}/{inici_setmana.month} > {ahir.day}/{ahir.month}",
        "top_10_paraules": formatar_top_per_json(obtenir_top_paraules(paraules_cercades_usuaris_diferents_emmascarat_trobades, 10, 'paraula', recencia_paraules_emmascarat)),
        "top_10_rimes": formatar_top_per_json(obtenir_top_paraules(rimes_usuaris_diferents_emmascarat, 10, 'rima', recencia_paraules_emmascarat, amb_dialectes=True)),
        "total_cerques": len(cerques_totals_emmascarat),
        "paraules_cercades_uniques": len(paraules_cercades_emmascarades),
        "numero_usuaris": cerques_totals_emmascarat['Usuari'].nunique(),

    },
    "sempre": {
        "top_10_paraules": formatar_top_per_json(obtenir_top_paraules(paraules_cercades_usuaris_diferents_trobades, 10, 'paraula', recencia_paraules)),
        "top_10_rimes": formatar_top_per_json(obtenir_top_paraules(rimes_usuaris_diferents, 10, 'rima', recencia_paraules, amb_dialectes=True)),
        "total_cerques": len(cerques_totals),
        "paraules_cercades_uniques": len(paraules_cercades),
        "numero_usuaris": cerques_totals['Usuari'].nunique(),
        "recompte_tipus_rima": cerques_totals['Tipus de rima'].value_counts().to_dict(),
        "top_10_naufragues": formatar_top_per_json(obtenir_top_paraules(df_rimes_naufragues, 10, 'paraula', recencia_naufragues, amb_dialectes=True)),
        "top_10_typos": formatar_top_per_json(obtenir_top_paraules(df_typos, 10, 'paraula', recencia_typos)),
        "total_noms_propis": len(noms_propis),
        "recompte_num_sil": cerques_totals['Num. síl·'].value_counts().to_dict(),
        "recompte_comenca_per": cerques_totals['Comença per'].value_counts().to_dict(),
        "recompte_incloure_np": cerques_totals['Incloure NP'].value_counts().to_dict(),
        "recompte_incloure_pl": cerques_totals['Incloure pl.'].value_counts().to_dict(),
        #un tros de barra per dialecte, com la resta de filtres. Les cerques
        #sense dialecte en queden fora, i per això ara surt buit
        "recompte_dialecte": cerques_totals[cerques_totals['Dialecte'].isin(ORDRE_DIALECTES)]['Dialecte'].value_counts().to_dict(),
        "top_dies": obtenir_top_dies(cerques_totals)
    },
    "grafics": {
        "grafic_linia_diaria": dades_grafic_linia(cerques_totals),
        "grafic_linia_hores": dades_grafic_hores(cerques_totals), 
        "grafic_formatge_exit_assonant": dades_grafic_formatge_totes(rimes_usuaris_diferents, "r.assonant"),
        "grafic_formatge_exit_consonant": dades_grafic_formatge_totes(rimes_usuaris_diferents, "r.consonant"),
    }
}

ruta_json = 'stats/estadistiques_rimador.json'
ruta_versions = 'stats/versions_stats.json'

with open(ruta_json, 'w', encoding='utf-8') as arxiu:
    json.dump(dades_json, arxiu, ensure_ascii=False, indent=4)


def resum(cami):
    """Sha256 truncat, igual que diccionaris/python/versions.py i
    llistes/versions.py: la versió és un resum del contingut, no un
    comptador ni una hora que caldria recordar de pujar."""
    calculador = hashlib.sha256()
    with open(cami, 'rb') as fitxer:
        for tros in iter(lambda: fitxer.read(1024 * 1024), b''):
            calculador.update(tros)
    return calculador.hexdigest()[:12]


with open(ruta_versions, 'w', encoding='utf-8') as arxiu:
    json.dump({
        "fitxers": {"estadistiques_rimador.json": resum(ruta_json)},
        "generat": datetime.now(tz_espanya).strftime("%Y-%m-%d %H:%M:%S %Z"),
    }, arxiu, ensure_ascii=False, indent=2)

print(f"Exportació completada amb èxit (hora: {datetime.now(tz_espanya).strftime('%H:%M:%S')})")