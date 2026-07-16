import glob
import os
import math

ruta_separat = "diccionaris/separat"
arxiu_temporal = os.path.join(ruta_separat, "col_10.txt")

with open(arxiu_temporal, 'r', encoding='utf-8') as f:
    dades_col10 = f.read().splitlines()

antics = glob.glob(os.path.join(ruta_separat, "col_10_*.txt"))
for f_antic in antics:
    try:
        os.remove(f_antic)
    except OSError:
        pass

total_linies = len(dades_col10)
mida_part = math.ceil(total_linies / 3)


for i in range(3):
    inici = i * mida_part
    fi = (i + 1) * mida_part if i < 2 else total_linies
    
    tall = dades_col10[inici:fi]
    
    if not tall:
        continue
        
    primera = tall[0]
    ultima = tall[-1]
    
    nom_fitxer = f"col_10_{i+1}_{primera}_{ultima}.txt"
    ruta_completa = os.path.join(ruta_separat, nom_fitxer)
    
    with open(ruta_completa, 'w', encoding='utf-8') as f:
        f.write("\n".join(tall) + "\n")
        
    print(f"Creat: {nom_fitxer} (del registre {inici} al {fi-1}).")

os.remove(arxiu_temporal)
print(f"Arxiu sencer {arxiu_temporal} eliminat.")
