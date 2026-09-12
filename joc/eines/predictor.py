import json
import math
from datetime import date, timedelta

def obtenir_manual(manuals, dataISO, dificultat):
    """Llegeix la paraula manual per a un dia i dificultat concrets, si n'hi ha."""
    if not manuals:
        return None
    entrada = manuals.get(dataISO)
    
    # Si és una cadena, la mateixa paraula val per les dues dificultats
    if isinstance(entrada, str):
        return entrada
    # Si és un diccionari, busquem la dificultat específica
    elif isinstance(entrada, dict):
        return entrada.get(dificultat)
        
    return None


# Simula el Math.imul() de JavaScript limitat a 32 bits (unsigned)
def imul(a, b):
    return (a * b) & 0xFFFFFFFF

# Variant de cyrb53 per a la llavor
def llavor(text):
    h1 = 0xdeadbeef
    h2 = 0x41c6ce57
    for c in text:
        char_code = ord(c)
        h1 = imul(h1 ^ char_code, 2654435761)
        h2 = imul(h2 ^ char_code, 1597334677)
    
    h1 = imul(h1 ^ (h1 >> 16), 2246822507) ^ imul(h2 ^ (h2 >> 13), 3266489909)
    h1 &= 0xFFFFFFFF  # Vital perquè el següent '>> 13' actuï exactament com el '>>>' sense signe
    
    h2 = imul(h2 ^ (h2 >> 16), 2246822507) ^ imul(h1 ^ (h1 >> 13), 3266489909)
    h2 &= 0xFFFFFFFF
    
    return (h1 ^ h2) & 0xFFFFFFFF


# mulberry32 generador
def generador(sembra):
    estat = sembra & 0xFFFFFFFF
    
    def seguent():
        nonlocal estat
        estat = (estat + 0x6d2b79f5) & 0xFFFFFFFF
        t = imul(estat ^ (estat >> 15), 1 | estat)
        # S'aplica l'operació XOR amb la suma de Math.imul i el valor anterior (simulant els 32bits)
        suma_imul = (t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF
        t = suma_imul ^ t
        t = t & 0xFFFFFFFF
        
        # Simula: ((t ^ (t >>> 14)) >>> 0) / 4294967296
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
        
    return seguent

# Funció per calcular els dies des de l'EPOCA (2026-01-01)
def diaDeLaRoda(dataISO):
    any_num, mes_num, dia_num = map(int, dataISO.split('-'))
    d = date(any_num, mes_num, dia_num)
    epoca = date(2026, 1, 1) # A JavaScript tens: Date.UTC(2026, 0, 1)
    return (d - epoca).days

# Barreja de Fisher-Yates de l'script original
def ordreDeLaRoda(quantes, clauDeLaRoda):
    aleatori = generador(llavor(f"rimador-joc-roda-{clauDeLaRoda}"))
    ordre = list(range(quantes))
    for i in range(quantes - 1, 0, -1):
        j = math.floor(aleatori() * (i + 1))
        ordre[i], ordre[j] = ordre[j], ordre[i]
    return ordre

def predir_paraula_del_dia(index_dades, dataISO, manuals=None):
    diaries = index_dades['diaries']
    quantes = len(diaries['claus'])
    dia = diaDeLaRoda(dataISO)
    
    cicle = math.floor(dia / quantes)
    posicio = ((dia % quantes) + quantes) % quantes
    
    resultats = {}
    for dificultat in ['facil', 'dificil']:
        # Pas 1: Comprovem si hi ha una excepció manual per aquesta data i dificultat
        paraula_manual = obtenir_manual(manuals, dataISO, dificultat)
        
        if paraula_manual:
            # Si hi ha paraula manual, ens saltem la roda algorítmica
            resultats[dificultat] = paraula_manual
        else:
            # Pas 2: Obtenir l'ordre de la roda d'aquest cicle (comportament normal)
            ordre = ordreDeLaRoda(quantes, f"{cicle}-{dificultat}")
            clauDeLaRoda = ordre[posicio]
            paraulesDeLaClau = diaries['claus'][clauDeLaRoda]
            
            # Pas 3: Triar la paraula concreta dins de la clau
            text_tria = f"rimador-joc-paraula-{cicle}-{dificultat}-{clauDeLaRoda}"
            tria = llavor(text_tria)
            posicioParaula = paraulesDeLaClau[tria % len(paraulesDeLaClau)]
            
            # Pas 4: Extraure la paraula i netejar el caràcter '>' si en porta
            cos = diaries['paraules'][posicioParaula]
            tall = cos.find('>')
            
            mostrar = cos if tall == -1 else cos[tall + 1:]
            resultats[dificultat] = mostrar
        
    return resultats


# ----------- EXECUCIÓ -----------
if __name__ == "__main__":
    import os
    
    dades = "joc/dades/index.json"
    fitxer_manuals = "joc/dades/diaries_manuals.json"
    
    # Carrega l'índex
    with open(dades, 'r', encoding='utf-8') as f:
        index_json = json.load(f)
        
    # Carrega els manuals (si el fitxer existeix)
    manuals_json = {}
    if os.path.exists(fitxer_manuals):
        with open(fitxer_manuals, 'r', encoding='utf-8') as f:
            manuals_json = json.load(f)
    
    avui = date.today()
    print("-" * 50)
    print("Predicció de les rimes per als propers 15 dies:")
    print("-" * 50)
    
    for i in range(-2, 1):
        data_actual = avui + timedelta(days=i)
        data_iso = data_actual.strftime("%Y-%m-%d")
        
        # Passem també els manuals_json a la funció
        paraules = predir_paraula_del_dia(index_json, data_iso, manuals=manuals_json)
        
        # Una marca visual per saber quines vénen del fitxer manual
        marca_f = " (Manual)" if obtenir_manual(manuals_json, data_iso, 'facil') else ""
        marca_d = " (Manual)" if obtenir_manual(manuals_json, data_iso, 'dificil') else ""
        
        print(f"Data: {data_iso}")
        print(f"  Fàcil:   {paraules['facil']}{marca_f}")
        print(f"  Difícil: {paraules['dificil']}{marca_d}")
        print()