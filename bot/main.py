import os
import random
import argparse
import requests
from datetime import datetime, date, timedelta, time
import zoneinfo # Necessari per fixar l'hora catalana i evitar errors de GitHub (UTC)

# Importem el teu generador (com que som a la mateixa carpeta bot/, funciona directament)
import generador_tuits

def obtenir_timestamp_programacio(hora, minut):
    """Calcula el timestamp Unix per l'hora i minut especificats en hora de Catalunya."""
    tz = zoneinfo.ZoneInfo("Europe/Madrid")
    ara = datetime.now(tz)
    
    # Programem per al dia d'avui (segons hora catalana) a l'hora indicada
    data_hora_objectiu = datetime.combine(ara.date(), time(hora, minut), tzinfo=tz)
    
    # Si per culpa de GitHub l'script s'executa quan ja ha passat l'hora
    if ara > data_hora_objectiu:
        data_hora_objectiu += timedelta(days=1)
        
    return int(data_hora_objectiu.timestamp())

def publicar_a_buffer(text_tuit, timestamp_publicacio):
    # Endpoint principal recomanat per la documentació
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
    
    variables = {
        "input": {
            "channelId": channel_id,
            "text": text_tuit,
            "schedulingType": "custom", # Afegim que volem una hora personalitzada
            "scheduledAt": timestamp_publicacio # Li passem l'hora exacta calculada
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

def publicar_tuit_joc():
    """Genera i programa el tuit del joc d'ahir a les 08:00."""
    print("Iniciant la publicació del tuit del JOC d'ahir...")
    
    # Forcem la zona horària catalana. GitHub corre a les 23:01 UTC, i per a nosaltres ja és l'endemà
    tz = zoneinfo.ZoneInfo("Europe/Madrid")
    avui_catalunya = datetime.now(tz).date()
    data_ahir = (avui_catalunya - timedelta(days=1)).strftime('%Y-%m-%d')
    clau = generador_tuits.clau_de_joc(data_ahir)
    
    path_joc = generador_tuits.FITXER_PUBLICADES_JOC
    publicades_joc = generador_tuits.carregar_json(path_joc, [])
    
    if clau in publicades_joc:
        print(f"El tuit del joc per a la clau '{clau}' ja estava publicat.")
        return
        
    tuit = generador_tuits.tuit_joc_ahir()
    
    # Calculem l'hora (08:00) i enviem a Buffer
    timestamp = obtenir_timestamp_programacio(8, 0)
    publicar_a_buffer(tuit, timestamp)
    print(f"Tuit enviat i programat a Buffer per a les 08:00:\n{tuit}\n")
    
    publicades_joc.append(clau)
    generador_tuits.guardar_json(publicades_joc, path_joc)
    print(f"Fitxer {path_joc} actualitzat amb èxit.")

def publicar_tuit_naufraga():
    """Genera i programa el tuit de la paraula nàufraga a les 15:30."""
    print("Iniciant la publicació del tuit de la paraula NÀUFRAGA...")
    
    tots_dialectes = generador_tuits.dialectes()
    if not tots_dialectes:
        tots_dialectes = ['ca', 'nw', 'va', 'ba'] 
        
    naufragues_per_dialecte = {d: generador_tuits.carregar_naufragues(d) for d in tots_dialectes}
    dialectes_naufraga = generador_tuits.dialectes_de_cada_naufraga(naufragues_per_dialecte)
    
    path_nau = generador_tuits.FITXER_PUBLICADES_NAUFRAGUES
    publicades_nau = generador_tuits.carregar_json(path_nau, [])
    
    disponibles = generador_tuits.naufragues_disponibles(naufragues_per_dialecte['ca'], fora=publicades_nau)
    
    if not disponibles:
        print("Atenció: No queden paraules nàufragades disponibles!")
        return
        
    paraula_escollida = random.choice(list(disponibles.keys()))
    item_escollit = random.choice(disponibles[paraula_escollida])
    
    tuit = generador_tuits.tuit_naufraga(
        item=item_escollit,
        dialecte='ca',
        dialectes_naufraga=dialectes_naufraga.get(paraula_escollida, ['ca']),
        tots=tots_dialectes
    )
    
    # Calculem l'hora (15:30) i enviem a Buffer
    timestamp = obtenir_timestamp_programacio(15, 30)
    publicar_a_buffer(tuit, timestamp)
    print(f"Tuit enviat i programat a Buffer per a les 15:30:\n{tuit}\n")
    
    publicades_nau.append(paraula_escollida)
    generador_tuits.guardar_json(publicades_nau, path_nau)
    print(f"Fitxer {path_nau} actualitzat amb èxit.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bot de tuits per Rimador")
    parser.add_argument('--tipus', choices=['joc', 'naufraga', 'tots'], default='tots', required=False, 
                        help="Quin tuit vols publicar?")
    args = parser.parse_args()
    
    tipus_a_executar = args.tipus
    print(f"Iniciant execució en mode: {tipus_a_executar.upper()}")
    
    if tipus_a_executar in ['joc', 'tots']:
        publicar_tuit_joc()
        
    if tipus_a_executar in ['naufraga', 'tots']:
        publicar_tuit_naufraga()
        
    print("Procés completat!")