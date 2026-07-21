import glob
import os
import math

ruta_separat = "separat"
arxiu_temporal = os.path.join(ruta_separat, "col_10provisional.txt")

def netejar_paraula(linia):
    caracters_prohibits = ['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>', ' ', '.']
    primera_paraula = linia.split('€')[0]
    paraula_neta = primera_paraula.strip()
    for c in caracters_prohibits:
        paraula_neta = paraula_neta.replace(c, "_")
    return paraula_neta

print("Iniciant el post-procés: dividint l'arxiu col_10.txt...")

with open(arxiu_temporal, 'r', encoding='utf-8') as f:
    dades_col10 = f.read().splitlines()

antics = glob.glob(os.path.join(ruta_separat, "col_10_*.txt"))
for f_antic in antics:
    try:
        os.remove(f_antic)
    except OSError:
        pass

total_linies = len(dades_col10)
num_arxius = 8
mida_part = math.ceil(total_linies / num_arxius)

for i in range(num_arxius):
    inici = i * mida_part
    fi = (i + 1) * mida_part if i < num_arxius - 1 else total_linies
    
    tall = dades_col10[inici:fi]
    
    if not tall:
        continue
        
    primera = netejar_paraula(tall[0])
    ultima = netejar_paraula(tall[-1])
    
    nom_fitxer = f"col_10_{i+1}_{primera}>{ultima}.txt"
    ruta_completa = os.path.join(ruta_separat, nom_fitxer)
    
    with open(ruta_completa, 'w', encoding='utf-8') as f:
        f.write("\n".join(tall) + "\n")
        
    print(f"Creat: {nom_fitxer} (del registre {inici} al {fi-1}).")

os.remove(arxiu_temporal)
print(f"L'arxiu sencer {arxiu_temporal} ha estat eliminat correctament.")