import pandas as pd
import json
from datetime import datetime, timedelta
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

# agafar excel drive i netejar dades
url_google_sheet = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQu2bwhVaSdCKFkzXsqpVdufvVrOFankBE5CTTD1dHMbzhFXnSBgn2mXYgnGjrXt41FgHU6WmIGr7Gw/pub?gid=0&single=true&output=csv"
df = pd.read_csv(url_google_sheet)

df['Data'] = pd.to_datetime(df['Data'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
df['Dia'] = df['Data'].dt.date
df['Usuari'] = df['Usuari'].astype(str)
df['Paraula'] = df['Paraula'].astype(str)
df['Rima'] = df['Rima'].astype(str)
df['Tipus de rima'] = df['Tipus de rima'].astype(str)

df_net = df.drop_duplicates(subset=['Dia', 'Usuari', 'Paraula', 'Tipus de rima']).copy()

#les dues llistes
df_typos = df_net[df_net['Rima'] == '***'].copy()
df_rimes_totes = df_net[df_net['Rima'] != '***'].copy()

#df paraules fènix
ruta_json_fenix = '../llistes/paraules_fenixs.json' 

with open(ruta_json_fenix, 'r', encoding='utf-8') as arxiu:
    dades_fenix = json.load(arxiu)
llista_paraules_fenix = [item['paraula'] for item in dades_fenix]

df_rimes_fenix = df_rimes_totes[df_rimes_totes['Paraula'].isin(llista_paraules_fenix)].copy()

#dades i coses del temps
avui = datetime.now().date()
inici_setmana = avui - timedelta(days=7)
ahir = avui - timedelta(days=1)

data_inici = pd.to_datetime(inici_setmana)
data_fi = pd.to_datetime(ahir) + timedelta(days=1, seconds=-1)

mascara_temps_net = (df_net['Data'] >= data_inici) & (df_net['Data'] <= data_fi)
df_net_setmana = df_net[mascara_temps_net].copy()

mascara_temps_rimes = (df_rimes_totes['Data'] >= data_inici) & (df_rimes_totes['Data'] <= data_fi)
df_rimes_setmana = df_rimes_totes[mascara_temps_rimes].copy()


#funcions
def obtenir_top_paraules(df_dades, n, paraula):
    if paraula == 'paraula':
        return df_dades['Paraula'].value_counts().head(n)
    elif paraula == 'rima':
        recompte = df_dades.groupby(['Rima', 'Tipus de rima']).size().reset_index(name='cerques')
        return recompte.sort_values(by='cerques', ascending=False).head(n)
    else:
        raise ValueError("El paràmetre 'paraula' només pot ser 'paraula' o 'rima'.")

def comptar_per_tipus_rima(df_dades):
    recompte = df_dades['Tipus de rima'].value_counts().to_dict()
    return {
        "assonant": recompte.get("r.assonant", 0),
        "consonant": recompte.get("r.consonant", 0)
    }

def dades_grafic_linia(df_dades):
    avui = datetime.now().date()
    data_inici = avui - timedelta(days=30)
    data_fi = avui - timedelta(days=1)
    
    mascara_temps = (df_dades['Dia'] >= data_inici) & (df_dades['Dia'] <= data_fi)
    df_filtrat = df_dades[mascara_temps]
    
    recompte_diari = df_filtrat['Dia'].value_counts()
    
    resultat = []
    
    for i in range(30, 0, -1):
        dia_actual = avui - timedelta(days=i)
        total_cerques = recompte_diari.get(dia_actual, 0)
        
        resultat.append({
            "data": dia_actual.strftime("%d/%m"),
            "cerques": int(total_cerques)
        })
        
    return resultat

def dades_grafic_formatge_totes(df_dades):
    recompte = df_dades['Rima'].value_counts()
    
    return [
        {"rima": str(rima), "vegades": int(total)}
        for rima, total in recompte.items()
    ]


def formatar_top_per_json(dades):
    if isinstance(dades, pd.Series):
        df_temp = dades.reset_index()
        df_temp.columns = ['paraula', 'cerques']
        return df_temp.to_dict(orient='records')
        
    elif isinstance(dades, pd.DataFrame):
        df_temp = dades.rename(columns={'Rima': 'paraula', 'Tipus de rima': 'tipus'})
        return df_temp.to_dict(orient='records')


#execució
dades_json = {
    "actualitzacio": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
    "setmana": {
        "top_10_paraules": formatar_top_per_json(obtenir_top_paraules(df_rimes_setmana, 10, 'paraula')),
        "top_10_rimes": formatar_top_per_json(obtenir_top_paraules(df_rimes_setmana, 10, 'rima')),
        "total_cerques": len(df_net_setmana),
        "numero_usuaris": df_net_setmana['Usuari'].nunique(),
        "recompte_tipus_rima": comptar_per_tipus_rima(df_rimes_setmana),

    },
    "sempre": {
        "top_10_paraules": formatar_top_per_json(obtenir_top_paraules(df_rimes_totes, 10, 'paraula')),
        "top_10_rimes": formatar_top_per_json(obtenir_top_paraules(df_rimes_totes, 10, 'rima')),
        "total_cerques": len(df_net),
        "numero_usuaris": df_net['Usuari'].nunique(),
        "recompte_tipus_rima": comptar_per_tipus_rima(df_rimes_totes),
        "top_10_fenix": formatar_top_per_json(obtenir_top_paraules(df_rimes_fenix, 10, 'paraula')),
        "top_10_typos": formatar_top_per_json(obtenir_top_paraules(df_typos, 10, 'paraula')),
        "grafic_linia_diaria": dades_grafic_linia(df_net),
        "grafic_formatge_exit": dades_grafic_formatge_totes(df_rimes_totes),

    }
}

ruta_json = 'estadistiques_rimador.json'

with open(ruta_json, 'w', encoding='utf-8') as arxiu:
    json.dump(dades_json, arxiu, ensure_ascii=False, indent=4)

print(f"Exportació completada amb èxit (hora: {datetime.now().strftime('%H:%M:%S')})")

