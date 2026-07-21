import os

nom_document = "diccionari.5.2.3.txt"
directori_destinacio = os.path.join("..", "diccionaris", "separat")
os.makedirs(directori_destinacio, exist_ok=True)

try:
    with open(nom_document, "r", encoding="utf-8") as file:
        linies = file.readlines()
except FileNotFoundError:
    print(f"El fitxer '{nom_document}' no s'ha trobat.")
    exit()

columnes = [linia.strip().split("$") for linia in linies]
max_columnes = max(len(col) for col in columnes)
columnes = [col + [""] * (max_columnes - len(col)) for col in columnes]

columnes_transposades = zip(*columnes)

for i, columna in enumerate(columnes_transposades):
    nou_nom_fitxer = f"col_{i}.txt"

    nom_fitxer = os.path.join(directori_destinacio, nou_nom_fitxer)
    with open(nom_fitxer, "w", encoding="utf-8") as sortida:
        sortida.write("\n".join(columna))

    nombre_linees = len(columna)
    print(f"Generat: {nou_nom_fitxer} amb {nombre_linees} línies")

print(f"Funció acabada! {max_columnes} fitxers generats al directori: {directori_destinacio}")