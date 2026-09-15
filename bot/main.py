import os
import random
import argparse
import requests
from datetime import datetime, date, timedelta, time
import zoneinfo

# Importem el teu generador (com que som a la mateixa carpeta bot/, funciona directament)
import generador_tuits

def obtenir_iso_programacio(hora, minut):
    """Calcula el string ISO 8601 UTC per l'hora i minut especificats en hora de Catalunya."""
    tz = zoneinfo.ZoneInfo("Europe/Madrid")
    ara = datetime.now(tz)
    
    # Programem per al dia d'avui (segons hora catalana) a l'hora indicada
    data_hora_objectiu = datetime.combine(ara.date(), time(hora, minut), tzinfo=tz)
    
    # Si ja ha passat l'hora (l'script s'ha endarrerit), l'enviem a l'endemà
    if ara > data_hora_objectiu:
        data_hora_objectiu += timedelta(days=1)
        
    # Buffer demana que l'hora "dueAt" sigui text (ISO 8601) en temps UTC absolut
    # Així evitem errors de zona horària o d'horari d'estiu/hivern
    utc_tz = zoneinfo.ZoneInfo("UTC")
    data_hora_utc = data_hora_objectiu.astimezone(utc_tz)
    
    # Ex: "2026-09-14T06:00:00Z" (que per nosaltres equivaldria a les 08:00)
    return data_hora_utc.strftime('%Y-%m-%dT%H:%M:%SZ')

def publicar_a_buffer(text_tuit):
    url = "https://api.buffer.com" 
    token = os.environ.get("BUFFER_API_KEY")
    channel_id = os.environ.get("BUFFER_PROFILE_ID")
    
    if not token or not channel_id:
        raise ValueError("Falten credencials (assegura't de tenir BUFFER_API_KEY i BUFFER_PROFILE_ID)")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    query = """
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
          }
        }
        ... on MutationError {
          message
        }
      }
    }
    """
    
    # Ara l'enviem directament a la cua de Buffer
    variables = {
        "input": {
            "channelId": channel_id,
            "text": text_tuit,
            "schedulingType": "automatic",
            "mode": "addToQueue"
        }
    }
    
    resposta = requests.post(url, headers=headers, json={"query": query, "variables": variables})
    resposta.raise_for_status()
    
    resultat = resposta.json()
    
    if "errors" in resultat:
        raise ValueError(f"Error de GraphQL de Buffer: {resultat['errors']}")
        
    data_mutacio = resultat.get("data", {}).get("createPost", {})
    if "message" in data_mutacio:
        raise ValueError(f"Error de Buffer a l'enviar la publicació: {data_mutacio['message']}")
        
    return resultat

def publicar_tuit_joc(dialecte=generador_tuits.DIALECTE_JOC_PER_DEFECTE):
    """Genera i programa el tuit del joc d'ahir a les 08:00."""
    print(f"Iniciant la publicació del tuit del JOC d'ahir (dialecte: {dialecte})...")
    
    tz = zoneinfo.ZoneInfo("Europe/Madrid")
    avui_catalunya = datetime.now(tz).date()
    data_ahir = (avui_catalunya - timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Utilitzem el dialecte perquè cada un té la seva rima i la seva clau
    clau = generador_tuits.clau_de_joc(data_ahir, dialecte=dialecte)
    
    path_joc = generador_tuits.FITXER_PUBLICADES_JOC
    publicades_joc = generador_tuits.carregar_json(path_joc, [])
    
    if clau in publicades_joc:
        print(f"El tuit del joc per a la clau '{clau}' ja estava publicat.")
        return
        
    # Carreguem els noms propis DEL DIALECTE ESCOLLIT
    noms_propis_dialecte = generador_tuits.carregar_noms_propis(dialecte)
    
    # Passem el dialecte i els noms propis
    tuit = generador_tuits.tuit_joc_ahir(dialecte=dialecte, noms_propis=noms_propis_dialecte)
    
    # Calculem l'hora (08:00) en format de text (ISO 8601) i enviem a Buffer
    hora_iso = obtenir_iso_programacio(8, 0)
    publicar_a_buffer(tuit)
    print(f"Tuit enviat a la cua de Buffer:\n{tuit}\n")
    
    publicades_joc.append(clau)
    generador_tuits.guardar_json(publicades_joc, path_joc)
    print(f"Fitxer {path_joc} actualitzat amb èxit.")


def publicar_tuit_naufraga(dialecte=generador_tuits.DIALECTE_JOC_PER_DEFECTE, paraula_forçada=None):
    """Genera i programa el tuit de la paraula nàufraga a les 15:30."""
    print(f"Iniciant la publicació del tuit de la paraula NÀUFRAGA (dialecte: {dialecte})...")
    
    tots_dialectes = generador_tuits.dialectes()
    if not tots_dialectes:
        tots_dialectes = ['ca', 'nw', 'va', 'ba'] 
        
    naufragues_per_dialecte = {d: generador_tuits.carregar_naufragues(d) for d in tots_dialectes}
    dialectes_naufraga = generador_tuits.dialectes_de_cada_naufraga(naufragues_per_dialecte)
    
    path_nau = generador_tuits.FITXER_PUBLICADES_NAUFRAGUES
    publicades_nau = generador_tuits.carregar_json(path_nau, [])
    
    # Ara busquem només dins l'inventari del dialecte triat
    disponibles = generador_tuits.naufragues_disponibles(naufragues_per_dialecte[dialecte], fora=publicades_nau)
    
    if not disponibles:
        print(f"Atenció: No queden paraules nàufragades disponibles per al dialecte {dialecte}!")
        return
        
    # Lògica per admetre una paraula especificada des del GitHub Action
    if paraula_forçada and paraula_forçada in disponibles:
        paraula_escollida = paraula_forçada
        print(f"Forçant manualment l'ús de la paraula: {paraula_escollida}")
    else:
        if paraula_forçada:
            print(f"Avís: La paraula '{paraula_forçada}' no existeix o ja s'ha publicat. S'en triarà una a l'atzar.")
        paraula_escollida = random.choice(list(disponibles.keys()))
        
    item_escollit = random.choice(disponibles[paraula_escollida])
    
    # Ara el tuit es munta centrat en el dialecte correcte
    tuit = generador_tuits.tuit_naufraga(
        item=item_escollit,
        dialecte=dialecte,
        dialectes_naufraga=dialectes_naufraga.get(paraula_escollida, [dialecte]),
        tots=tots_dialectes
    )
    
    hora_iso = obtenir_iso_programacio(15, 30)
    publicar_a_buffer(tuit)
    print(f"Tuit enviat a la cua de Buffer:\n{tuit}\n")    

    publicades_nau.append(paraula_escollida)
    generador_tuits.guardar_json(publicades_nau, path_nau)
    print(f"Fitxer {path_nau} actualitzat amb èxit.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bot de tuits per Rimador")
    parser.add_argument('--tipus', choices=['joc', 'naufraga', 'tots'], default='tots', required=False, 
                        help="Quin tuit vols publicar?")
    parser.add_argument('--paraula', required=False, type=str, 
                        help="Força una paraula nàufraga específica (opcional)")
    # Afegim una bandera per decidir el dialecte
    parser.add_argument('--dialecte', type=str, default='ca', choices=['ca', 'nw', 'va', 'ba'],
                        help="Tria el dialecte pel tuit ('ca', 'nw', 'va', 'ba')")
    args = parser.parse_args()
    
    tipus_a_executar = args.tipus
    dialecte_escollit = args.dialecte
    print(f"Iniciant execució en mode: {tipus_a_executar.upper()} amb dialecte {dialecte_escollit.upper()}")
    
    if tipus_a_executar in ['joc', 'tots']:
        publicar_tuit_joc(dialecte=dialecte_escollit)
        
    if tipus_a_executar in ['naufraga', 'tots']:
        publicar_tuit_naufraga(dialecte=dialecte_escollit, paraula_forçada=args.paraula)
        
    print("Procés completat!")