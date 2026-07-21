with open("separat/col_10 (canvis aquí).txt", "r", encoding="utf-8") as doc2:
    linies = [linia.strip() for linia in doc2 if "€" in linia]

paraula = []
donve = []
codi = []
transcripcions = []

for linia in linies:
    parts = linia.split(" € ")
    if len(parts) >= 4:
        paraula.append(parts[0])
        donve.append(parts[1])
        codi.append(parts[2])
        transcripcions.append(parts[3])
    else:
        print("Línia amb format incorrecte:", linia)

with open("separat/col_0.txt", "w", encoding="utf-8") as doc0:
    for i in paraula:
        doc0.write(i + "\n")

with open("separat/col_1.txt", "w", encoding="utf-8") as doc1:
    for i in donve:
        doc1.write(i + "\n")
     
with open("separat/col_2.txt", "w", encoding="utf-8") as doc2:
    for i in codi:
        doc2.write(i + "\n")

with open("separat/col_9.txt", "w", encoding="utf-8") as doc9:
    for i in transcripcions:
        doc9.write(i + "\n")
        
with open("separat/col_3.txt", "w", encoding="utf-8") as doc3:
    finals = []
    for linia in transcripcions:
        paraula = linia.split(" € ")[-1]
        final = paraula.split("ˈ")[-1]
        finals.append(final)
        doc3.write(final + '\n')

with open("separat/col_4.txt", "w", encoding="utf-8") as doc4:
    vocals = []
    for linia in finals:
        vocal = ''.join([lletra for lletra in linia if lletra in "ɔəaeiou@Eɛˈ"])
        vocals.append(vocal)
        doc4.write(vocal + '\n')

print("Fet! (rima creada)")

print("Es comença a fer diccionari")
files = ['separat/col_0.txt',  #paraula
         'separat/col_1.txt',  #d'on ve
         'separat/col_2.txt',  #codi
         'separat/col_3.txt',  #rima consonant 
         'separat/col_4.txt',  #rima assonant 
         'separat/col_5.txt',  #síl·labes
         'separat/col_6.txt',  #Vicc
         'separat/col_7.txt',  #Wiki
         'separat/col_8.txt',  #Diec
         'separat/col_9.txt',  #transcripció  
]

lines_per_file = []
for file in files:
    with open(file, 'r') as f:
        lines = f.readlines()
        lines_per_file.append(lines)

output_file = 'diccionari.5.2.3.txt'
with open(output_file, 'w') as f:
    for i in range(len(lines_per_file[0])):
        line_parts = [lines[i].strip() for lines in lines_per_file]
        
        extra_column = f"{line_parts[0]} € {line_parts[1]} € {line_parts[2]} € {line_parts[9]}"
        line_parts.append(extra_column)

        line_to_write = '$'.join(line_parts)
        f.write(line_to_write + '\n')

print("Fet! (diccionari creat)")