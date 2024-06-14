from tqdm import tqdm

def comprovar_elements(llista_a, llista_b, fitxer_sortida):
    elements_no_presentats = []

    # Inicialitzem la barra de progrés amb el total de la llista_a
    progress_bar = tqdm(total=len(llista_a), desc="Comparant llistes", unit="element")

    for element in llista_a:
        if element not in llista_b:
            elements_no_presentats.append(element)
        progress_bar.update(1)

    progress_bar.close()

    if elements_no_presentats:
        with open(fitxer_sortida, 'w') as f:
            for element in elements_no_presentats:
                f.write(f"{element}\n")
                        
    else:
        with open(fitxer_sortida, 'w') as f:
            print("Tots els elements de la llista A estan presents a la llista B.")
            
def llegir_fitxer_linia_per_linia(nom_fitxer):
    with open(nom_fitxer, 'r') as fitxer:
        linies = [linia.strip() for linia in fitxer.readlines()]
    return linies

def llegir_fitxer_tabulador(nom_fitxer):
    with open(nom_fitxer, 'r') as fitxer:
        linies = [linia.strip().split('\t')[1] if '\t' in linia else '' for linia in fitxer.readlines()]
    return linies

fitxer1 = '../../separat/col_0.txt'  # Fitxer on cada línia conté una paraula
fitxer2 = 'cawiktionary-20240601-all-titles.txt'  # Fitxer on cada línia té el format "0\tParaula"
fitxer_sortida = 'paraules_NO_presents_al_viccionari.txt'  # Fitxer on s'escriuran els resultats

llista_a = llegir_fitxer_linia_per_linia(fitxer1)
llista_b = llegir_fitxer_tabulador(fitxer2)

comprovar_elements(llista_a, llista_b, fitxer_sortida)
