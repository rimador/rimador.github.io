from collections import Counter

def analitzar_caracters_txt(ruta_arxiu):
    try:
        # Obrim l'arxiu en mode lectura ('r') i amb codificació UTF-8
        with open(ruta_arxiu, 'r', encoding='utf-8') as arxiu:
            contingut = arxiu.read()
            
            # 1. Llista de TOTS els caràcters tal com apareixen al text
            tots_els_caracters = list(contingut)
            print(f"S'han trobat un total de {len(tots_els_caracters)} caràcters.")
            
            # 2. Llista de caràcters ÚNICS (sense repeticions)
            caracters_unics = set(contingut)
            print(f"Hi ha {len(caracters_unics)} caràcters únics diferents.")
            print(f"Caràcters únics: {sorted(caracters_unics)}\n")
            
            # 3. Recompte de quantes vegades apareix cada caràcter
            recompte = Counter(contingut)
            print("--- Recompte detallat ---")
            
            # Ordenem el recompte de més a menys freqüent
            for car, quantitat in recompte.most_common():
                # Fem servir repr() perquè espais (' ') o salts de línia ('\n') es llegeixin bé
                print(f"Caràcter {repr(car):<4} : {quantitat} vegades")
                
    except FileNotFoundError:
        print(f"Error: No s'ha trobat cap arxiu amb el nom '{ruta_arxiu}'.")
    except Exception as e:
        print(f"S'ha produït un error inesperat: {e}")

# Substitueix 'el_teu_document.txt' per la ruta real del teu arxiu
analitzar_caracters_txt('separat/col_0.txt')