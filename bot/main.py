import os
import random
import argparse
import requests
from datetime import date, timedelta

# Importem el teu generador (com que som a la mateixa carpeta bot/, funciona directament)
import generador_tuits

def publicar_a_buffer(text_tuit):
    """Envia el text a l'API de Buffer."""
    url = "https://api.bufferapp.com/1/updates/create.json"
    token = os.environ.get("BUFFER_API_KEY")
    profile_id = os.environ.get("BUFFER_PROFILE_ID") 
    
    print(f"Longitud del token carregat: {len(token) if token else 'CAP (és None o buit)'}")
    print(f"ID del perfil: {profile_id if profile_id else 'CAP'}")
    
    if not token or not profile_id:
        raise ValueError("Falten les credencials de Buffer a les variables d'entorn!")
    
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "text": text_tuit,
        "profile_ids[]": profile_id
    }
    
    resposta = requests.post(url, headers=headers, data=data)
    resposta.raise_for_status()
    return resposta.json()

def publicar_tuit_joc():
    """Genera i publica el tuit del joc d'ahir a les 08:00."""
    print("Iniciant la publicació del tuit del JOC d'ahir...")
    
    # Calculem la data d'ahir per generar la clau
    data_ahir = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
    clau = generador_tuits.clau_de_joc(data_ahir)
    
    path_joc = generador_tuits.FITXER_PUBLICADES_JOC
    publicades_joc = generador_tuits.carregar_json(path_joc, [])
    
    if clau in publicades_joc:
        print(f"El tuit del joc per a la clau '{clau}' ja estava publicat.")
        return
        
    # Generem el tuit usant la teva funció
    tuit = generador_tuits.tuit_joc_ahir()
    
    # Enviem a Buffer
    publicar_a_buffer(tuit)
    print(f"Tuit enviat a Buffer:\n{tuit}\n")
    
    # Guardem als registres
    publicades_joc.append(clau)
    generador_tuits.guardar_json(publicades_joc, path_joc)
    print(f"Fitxer {path_joc} actualitzat amb èxit.")

def publicar_tuit_naufraga():
    """Genera i publica el tuit de la paraula nàufraga a les 15:30."""
    print("Iniciant la publicació del tuit de la paraula NÀUFRAGA...")
    
    tots_dialectes = generador_tuits.dialectes()
    if not tots_dialectes:
        tots_dialectes = ['ca', 'nw', 'va', 'ba'] # fallback si no troba les carpetes
        
    # Carreguem dades de tots els dialectes
    naufragues_per_dialecte = {d: generador_tuits.carregar_naufragues(d) for d in tots_dialectes}
    dialectes_naufraga = generador_tuits.dialectes_de_cada_naufraga(naufragues_per_dialecte)
    
    path_nau = generador_tuits.FITXER_PUBLICADES_NAUFRAGUES
    publicades_nau = generador_tuits.carregar_json(path_nau, [])
    
    # Prenem el català central ('ca') com a base pel tuit
    disponibles = generador_tuits.naufragues_disponibles(naufragues_per_dialecte['ca'], fora=publicades_nau)
    
    if not disponibles:
        print("Atenció: No queden paraules nàufragades disponibles!")
        return
        
    # Triem una paraula a l'atzar i n'escollim una de les seves entrades (homògrafes)
    paraula_escollida = random.choice(list(disponibles.keys()))
    item_escollit = random.choice(disponibles[paraula_escollida])
    
    # Generem el tuit usant la teva funció
    tuit = generador_tuits.tuit_naufraga(
        item=item_escollit,
        dialecte='ca',
        dialectes_naufraga=dialectes_naufraga.get(paraula_escollida, ['ca']),
        tots=tots_dialectes
    )
    
    # Enviem a Buffer
    publicar_a_buffer(tuit)
    print(f"Tuit enviat a Buffer:\n{tuit}\n")
    
    # Guardem als registres usant NOMÉS la paraula com a clau, tal com fas al teu arxiu
    publicades_nau.append(paraula_escollida)
    generador_tuits.guardar_json(publicades_nau, path_nau)
    print(f"Fitxer {path_nau} actualitzat amb èxit.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bot de tuits per Rimador")
    # Ara fem que el paràmetre sigui opcional (required=False)
    parser.add_argument('--tipus', choices=['joc', 'naufraga'], required=False, 
                        help="Quin tuit vols publicar?")
    args = parser.parse_args()
    
    tipus_a_executar = args.tipus
    
    # Si no ens passen cap tipus, ho deduïm llegint el JSON del joc
    if not tipus_a_executar:
        data_ahir = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        clau_joc_avui = generador_tuits.clau_de_joc(data_ahir)
        
        publicades_joc = generador_tuits.carregar_json(generador_tuits.FITXER_PUBLICADES_JOC, [])
        
        # Si la clau d'avui ja és al JSON, vol dir que ja hem fet la primera execució
        if clau_joc_avui in publicades_joc:
            tipus_a_executar = 'naufraga'
        else:
            tipus_a_executar = 'joc'
            
        print(f"Mode deduït automàticament: {tipus_a_executar.upper()}")
    
    # Executem la funció corresponent
    if tipus_a_executar == 'joc':
        publicar_tuit_joc()
    elif tipus_a_executar == 'naufraga':
        publicar_tuit_naufraga()