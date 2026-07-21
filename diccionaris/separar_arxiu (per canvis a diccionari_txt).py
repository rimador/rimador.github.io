import os
import sys
import subprocess

nom_document = "diccionari.5.2.3.txt"
directori_destinacio = os.path.join("..", "diccionaris", "separat")
directori_extra = os.path.join("..", "diccionaris", "separat", "col_10 (canvis aquí)")
os.makedirs(directori_destinacio, exist_ok=True)
os.makedirs(directori_extra, exist_ok=True)

try:
    with open(nom_document, "r", encoding="utf-8") as file:
        linies = file.readlines()
except FileNotFoundError:
    print(f"El fitxer '{nom_document}' no s'ha trobat.")
    sys.exit()

columnes = [linia.strip().split("$") for linia in linies]
max_columnes = max(len(col) for col in columnes)
columnes = [col + [""] * (max_columnes - len(col)) for col in columnes]

columnes_transposades = list(zip(*columnes))

for i, columna in enumerate(columnes_transposades):
    nou_nom_fitxer = f"col_{i}.txt"
    nom_fitxer = os.path.join(directori_destinacio, nou_nom_fitxer)
    
    with open(nom_fitxer, "w", encoding="utf-8") as sortida:
        sortida.write("\n".join(columna))

    nombre_linees = len(columna)
    print(f"Generat: {nou_nom_fitxer} amb {nombre_linees} línies")

extra_linies = []
for line_parts in columnes:
    if len(line_parts) > 9:
        extra_column = f"{line_parts[0]} € {line_parts[1]} € {line_parts[2]} € {line_parts[9]}"
    else:
        extra_column = ""
    extra_linies.append(extra_column)

nom_fitxer_extra = os.path.join(directori_extra, "col_10provisional.txt")
with open(nom_fitxer_extra, "w", encoding="utf-8") as sortida_extra:
    sortida_extra.write("\n".join(extra_linies))

print(f"Generat: {nom_fitxer_extra} amb {len(extra_linies)} línies al directori: {directori_extra}")
print(f"Funció acabada! {max_columnes} fitxers generats al directori: {directori_destinacio}")

subprocess.run(["python3", "post_proces.py"])

print("Post-procés finalitzat. Els fitxers han estat dividits i guardats correctament.")
