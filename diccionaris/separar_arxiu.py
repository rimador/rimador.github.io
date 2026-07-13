import os

# Configuració de rutes
nom_document = "diccionari.5.2.3.txt"
directori_destinacio = os.path.join("..", "diccionaris", "separat")
os.makedirs(directori_destinacio, exist_ok=True)

# Llegir línies del fitxer
try:
    with open(nom_document, "r", encoding="utf-8") as file:
        linies = file.readlines()
except FileNotFoundError:
    print(f"El fitxer '{nom_document}' no s'ha trobat.")
    exit()

# Separar per columnes
columnes = [linia.strip().split("$") for linia in linies]
max_columnes = max(len(col) for col in columnes)
columnes = [col + [""] * (max_columnes - len(col)) for col in columnes]

# Transposar per a tenir columnes com a files
columnes_transposades = zip(*columnes)

# Escriure cada columna en un fitxer diferent
for i, columna in enumerate(columnes_transposades):
    if i == 10:
        nou_nom_fitxer = "col_10 (canvis aquí).txt"
    else:
        nou_nom_fitxer = f"col_{i}.txt"

    nom_fitxer = os.path.join(directori_destinacio, nou_nom_fitxer)
    with open(nom_fitxer, "w", encoding="utf-8") as sortida:
        sortida.write("\n".join(columna))

    # Comptar línies escrites
    nombre_linees = len(columna)
    print(f"Generat: {nou_nom_fitxer} amb {nombre_linees} línies")

print(f"Funció acabada! {max_columnes} fitxers generats al directori: {directori_destinacio}")