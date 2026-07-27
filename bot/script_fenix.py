import json
import random
import os
import tweepy
import urllib.parse
from datetime import datetime

base_dir = os.path.dirname(os.path.abspath(__file__))

FITXER_FENIXS = os.path.join(base_dir, '..', 'llistes', 'paraules_fenixs.json')
FITXER_UTILITZATS = os.path.join(base_dir, 'publicades_fenix.json')

def carregar_json(nom_fitxer):
    if not os.path.exists(nom_fitxer):
        return [] 
    
    with open(nom_fitxer, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.decoder.JSONDecodeError:
            return []

def guardar_json(dades, nom_fitxer):
    with open(nom_fitxer, 'w', encoding='utf-8') as f:
        json.dump(dades, f, indent=4, ensure_ascii=False)

def principal():
    print("Iniciant el bot")
    
    utilitzats = carregar_json(FITXER_UTILITZATS)
    dades_fenixs = carregar_json(FITXER_FENIXS)

    if not dades_fenixs:
        print("El fitxer de paraules fènix està buit o no s'ha trobat.")
        return

    paraules_disponibles = [item for item in dades_fenixs if item.get("rimacons") not in utilitzats]

    if not paraules_disponibles:
        print("Ja s'han utilitzat totes les rimes fènix del fitxer!")
        return

    item_escollit = random.choice(paraules_disponibles)

    paraula_escollida = item_escollit.get("paraula")
    rima_escollida = item_escollit.get("rimacons")
    lema = item_escollit.get("infinitiu")
    codi = item_escollit.get("codi")
    es_diec = item_escollit.get("diec") == "Diec"
    es_VIQ = item_escollit.get("viq") == "Viq"
    es_VICC = item_escollit.get("vicc") == "Vicc"
    
    avui = datetime.now()
    data_formatada = f"{avui.day}/{avui.month}/{avui.strftime('%y')}"

    tuit = f"Paraula fènix del dia ({data_formatada}): {paraula_escollida} (/{rima_escollida}/)\n\n"
    if codi.startswith("NP"):
        tuit += "Aquest nom propi no rima amb cap paraula del diccionari ni amb cap altre nom propi, per això és una Paraula fènix.\n\n"
    else:
        tuit += "Aquesta paraula no rima amb cap paraula del diccionari ni amb cap nom propi, per això és una Paraula fènix.\n\n"

    paraula_url = urllib.parse.quote(lema)
    
    if es_diec:
        tuit += f"📖 DIEC: https://dlc.iec.cat/Results?DecEntradaText={paraula_url}\n"

    else:
        if codi.startswith("NP"):
            if es_VIQ:
                tuit += f"📖 Viquipèdia: https://ca.wikipedia.org/wiki/{paraula_url}\n"
            else:
                tuit += f"📖 Viccionari: https://ca.wiktionary.org/wiki/{paraula_url}\n"
        else:
            if es_VICC:
                tuit += f"📖 Viccionari: https://ca.wiktionary.org/wiki/{paraula_url}\n"
            else:
                tuit += f"📖 Viquipèdia: https://ca.wikipedia.org/wiki/{paraula_url}\n"

    tuit += "\nConsulta totes les paraules fènix a https://rimador.cat/llistes/llista_fenixs.html"

    print("-" * 50)
    print(tuit)
    print("-" * 50)

    api_key = os.environ.get("API_KEY")
    api_secret = os.environ.get("API_SECRET")
    access_token = os.environ.get("ACCESS_TOKEN")
    access_token_secret = os.environ.get("ACCESS_TOKEN_SECRET")

    if api_key and api_secret and access_token and access_token_secret:
        try:
            print("Connectant amb l'API de Twitter")
            client = tweepy.Client(
                consumer_key=api_key,
                consumer_secret=api_secret,
                access_token=access_token,
                access_token_secret=access_token_secret
            )
            client.create_tweet(text=tuit)
            print("Tuit publicat amb èxit!")
        except Exception as e:
            print(f"Error en publicar el tuit: {e}")
            return
    else:
        print("Mode simulació: No s'han trobat les credencials de Twitter (API keys).")

    utilitzats.append(rima_escollida)
    guardar_json(utilitzats, FITXER_UTILITZATS)
    print(f"Rima '{rima_escollida}' afegida a '{FITXER_UTILITZATS}'.")

if __name__ == '__main__':
    principal()