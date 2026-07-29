import json
import os

def agrupar_rimes_amb_paraules(ruta_rimes, ruta_paraules, ruta_json):
    try:
        dades_agrupades = {}
        
        with open(ruta_rimes, 'r', encoding='utf-8') as arxiu1, \
             open(ruta_paraules, 'r', encoding='utf-8') as arxiu2:
            
            for linia_rima, linia_paraula in zip(arxiu1, arxiu2):
                rima = linia_rima.strip()
                paraula = linia_paraula.strip()
                
                if rima: 
                    if rima not in dades_agrupades:
                        dades_agrupades[rima] = []
                    
                    dades_agrupades[rima].append(paraula) 
        
        dades_ordenades = {}
        elements_ordenats = sorted(dades_agrupades.items(), key=lambda item: len(item[1]), reverse=True)
        
        for rima, paraules in elements_ordenats:
            dades_ordenades[rima] = {
                "frequencia": len(paraules),
                "paraules": paraules
            }
        
        with open(ruta_json, 'w', encoding='utf-8') as arxiu_sortida:
            json.dump(dades_ordenades, arxiu_sortida, indent=4, ensure_ascii=False)
            
        print("S'ha generat l'arxiu.")
        
    except FileNotFoundError as e:
        print(f"Error: No s'ha trobat algun dels arxius especificats. Detalls: {e}")


base_dir = os.path.dirname(os.path.abspath(__file__))
dir_diccionaris = os.path.join(base_dir, '..', 'diccionaris', 'separat')

arxiu_sortida = os.path.join(base_dir, 'resultat_ordenat_cons.json')
arxiu_rimes = os.path.join(dir_diccionaris, 'col_3.txt')
arxiu_paraules = os.path.join(dir_diccionaris, 'col_0.txt')

agrupar_rimes_amb_paraules(arxiu_rimes, arxiu_paraules, arxiu_sortida)