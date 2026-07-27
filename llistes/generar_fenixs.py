import os
import json
from contextlib import ExitStack

def generar_llista():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dir_diccionaris = os.path.join(base_dir, '..', 'diccionaris')
    dir_separat = os.path.join(dir_diccionaris, 'separat')
    
    ruta_json_rimes = os.path.join('..', 'bot', 'resultat_ordenat_cons.json')
    fitxer_sortida = os.path.join(base_dir, 'paraules_fenixs.json')
    ruta_versions = os.path.join(base_dir, 'versions_llistes.json')

    noms_fitxers = [
        'col_0.txt', 'col_1.txt', 'col_2.txt', 'col_3.txt', 'col_5.txt', 'col_6.txt', 'col_7.txt', 'col_8.txt'
    ]
    rutes_txt = [os.path.join(dir_separat, nom) for nom in noms_fitxers]

    paraules_orfes = []

    try:
        with open(ruta_json_rimes, 'r', encoding='utf-8') as f:
            dades_rimes = json.load(f)

        rimes_fenix = {
            rima for rima, dades in dades_rimes.items() 
            if len(set(dades.get("paraules", []))) == 1
        }

        with ExitStack() as stack:
            fitxers_oberts = [stack.enter_context(open(ruta, 'r', encoding='utf-8')) for ruta in rutes_txt]
            
            for linies in zip(*fitxers_oberts):
                paraula, infinitiu, codi, rima, sil, vicc, viq, diec = [linia.strip() for linia in linies]

                if rima in rimes_fenix:
                    paraules_orfes.append({
                        'paraula': paraula,
                        'infinitiu': infinitiu,
                        'codi': codi,
                        'rimacons': rima,
                        'sil': sil,
                        'vicc': vicc,
                        'viq': viq,
                        'diec': diec,
                    })

    except FileNotFoundError as e:
        print(f"Error: No s'han trobat els arxius necessaris. {e}")
        return
    except Exception as e:
        print(f"Error inesperat processant els arxius: {e}")
        return

    with open(fitxer_sortida, 'w', encoding='utf-8') as f:
        json.dump(paraules_orfes, f, ensure_ascii=False, indent=2)

    print(f"Generació completada: {len(paraules_orfes)} paraules fènix guardades a {fitxer_sortida}")

    try:
        with open(ruta_versions, 'r', encoding='utf-8') as fitxer:
            dades = json.load(fitxer)
            
        dades['versio_fenix'] += 1
        
        with open(ruta_versions, 'w', encoding='utf-8') as fitxer:
            json.dump(dades, fitxer, indent=2)
            
    except FileNotFoundError:
        print(f"Avís: No s'ha trobat l'arxiu {ruta_versions}. Versió no actualitzada.")
    except Exception as e:
        print(f"Avís: Error en intentar actualitzar la versió: {e}")

if __name__ == "__main__":
    generar_llista()