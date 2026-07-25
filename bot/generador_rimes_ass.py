import json

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
        
        dades_ordenades = dict(sorted(dades_agrupades.items(), key=lambda item: len(item[1]), reverse=True))
        
        with open(ruta_json, 'w', encoding='utf-8') as arxiu_sortida:
            json.dump(dades_ordenades, arxiu_sortida, indent=4, ensure_ascii=False)
            
        print(f"S'ha generat l'arxiu")
        
    except FileNotFoundError as e:
        print(f"Error: No s'ha trobat algun dels arxius especificats. Detalls: {e}")

arxiu_rimes = '../diccionaris/separat/col_4.txt'
arxiu_paraules = '../diccionaris/separat/col_0.txt'
arxiu_sortida = 'resultat_ordenat_ass.json'

agrupar_rimes_amb_paraules(arxiu_rimes, arxiu_paraules, arxiu_sortida)