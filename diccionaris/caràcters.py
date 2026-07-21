from collections import Counter

def analitzar_caracters_sense_noms_propis(ruta_col_0, ruta_codis):
    try:
        tots_els_caracters = []
        caracters_unics = set()
        recompte = Counter()
        
        paraules_saltades = 0
        paraules_processades = 0
        
        print("--- PRIMERES PARAULES DESCARTADES ---")
        
        with open(ruta_col_0, 'r', encoding='utf-8') as arxiu_0, \
             open(ruta_codis, 'r', encoding='utf-8') as arxiu_1:
            
            for paraula, codi in zip(arxiu_0, arxiu_1):
                paraula = paraula.strip()
                codi = codi.strip()
                
                # Si el codi comença per NP, sumem al descart i comprovem si l'imprimim
                if codi.upper().startswith("NP"):
                    # Imprimim només les 5 primeres descartades
                    if paraules_saltades < 5:
                        print(f"❌ Descartada -> Paraula: {repr(paraula):<15} | Codi: {repr(codi)}")
                    
                    paraules_saltades += 1
                    continue
                
                # Si el codi no ha saltat amb el 'continue', processem els caràcters
                paraules_processades += 1
                caracters_paraula = list(paraula)
                tots_els_caracters.extend(caracters_paraula)
                caracters_unics.update(caracters_paraula)
                recompte.update(caracters_paraula)
        
        print("\n--- RESUM DEL FILTRATGE ---")
        print(f"Paraules processades: {paraules_processades}")
        print(f"Paraules descartades (codi NP): {paraules_saltades}")
        print("-" * 27 + "\n")
        
        print(f"S'han trobat un total de {len(tots_els_caracters)} caràcters.")
        print(f"Hi ha {len(caracters_unics)} caràcters únics diferents.")
        print(f"Caràcters únics: {sorted(caracters_unics)}\n")
        
        print("--- Recompte detallat ---")
        for car, quantitat in recompte.most_common():
            print(f"Caràcter {repr(car):<4} : {quantitat} vegades")
            
    except FileNotFoundError as e:
        print(f"Error: No s'ha trobat algun dels arxius. Detall: {e}")
    except Exception as e:
        print(f"S'ha produït un error inesperat: {e}")

analitzar_caracters_sense_noms_propis('separat/col_0.txt', 'separat/col_2.txt')