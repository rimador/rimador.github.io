import os
import json
import locale
from collections import Counter

def generar_llista():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    ruta_col_0 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_0.txt') #paraula
    ruta_col_1 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_1.txt') #infinitiu
    ruta_col_2 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_2.txt') #codi
    ruta_col_3 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_3.txt') #rimacons
    #ruta_col_4 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_4.txt') #rimaass
    ruta_col_5 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_5.txt') #sil
    ruta_col_6 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_6.txt') #Vicc
    ruta_col_7 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_7.txt') #Viq
    ruta_col_8 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_8.txt') #DIEC
    #ruta_col_9 = os.path.join(base_dir, '..', 'diccionaris', 'separat', 'col_9.txt') #transcripció
    
    fitxer_sortida = os.path.join(base_dir, 'paraules_fenixs.json')

    paraules_orfes = []

    def valor_per_index(llista, index):
        return llista[index] if index < len(llista) else None

    try:
        with open(ruta_col_0, 'r', encoding='utf-8') as f0, \
            open(ruta_col_1, 'r', encoding='utf-8') as f1, \
            open(ruta_col_2, 'r', encoding='utf-8') as f2, \
            open(ruta_col_3, 'r', encoding='utf-8') as f3, \
            open(ruta_col_5, 'r', encoding='utf-8') as f5, \
            open(ruta_col_6, 'r', encoding='utf-8') as f6, \
            open(ruta_col_7, 'r', encoding='utf-8') as f7, \
            open(ruta_col_8, 'r', encoding='utf-8') as f8:
            
            paraules = f0.read().splitlines()
            infinitius = f1.read().splitlines()
            codis = f2.read().splitlines()
            rimes = f3.read().splitlines()
            silabes = f5.read().splitlines()
            viccs = f6.read().splitlines()
            viqs = f7.read().splitlines()
            diecs = f8.read().splitlines()

            comptador_rimes = Counter(rimes)
            
            for i, rima in enumerate(rimes):
                if comptador_rimes[rima] == 1:
                    if i < len(paraules):
                        paraules_orfes.append({
                            'paraula': valor_per_index(paraules, i),
                            'infinitiu': valor_per_index(infinitius, i),
                            'codi': valor_per_index(codis, i),
                            'rimacons': valor_per_index(rimes, i),
                            'sil': valor_per_index(silabes, i),
                            'vicc': valor_per_index(viccs, i),
                            'viq': valor_per_index(viqs, i),
                            'diec': valor_per_index(diecs, i),
                        })

    except FileNotFoundError as e:
        print(f"Error: No s'han trobat els arxius necessaris. {e}")
        return
    except Exception as e:
        print(f"Error inesperat processant els arxius: {e}")
        return

    with open(fitxer_sortida, 'w', encoding='utf-8') as f:
        json.dump(paraules_orfes, f, ensure_ascii=False, indent=2)

    print(f"Generació completada: {len(paraules_orfes)} paraules sense rima guardades a {fitxer_sortida}")

if __name__ == "__main__":
    generar_llista()