# Un dades.html amb dialectes, abans que n'hi hagi cap.
#
# La columna "Dialecte" del full és buida i ho continuarà sent fins que l'Apps
# Script de stats/apps_script_cerques.gs no estigui desplegat i la gent no torni
# a cercar. Mentrestant, els codis del top de rimes, la barra de dialectes i les
# nàufragues per dialecte de dades.html surten buits (que és el que han de fer)
# i no hi ha manera de saber si estan ben fets.
#
# Això s'ho mira: agafa el full de veritat, li omple la columna "Dialecte" amb
# valors inventats i executa l'stats.py DE DEBÒ contra aquesta còpia. El que es
# prova no és, doncs, una imitació de l'stats.py: és l'stats.py, amb l'única
# diferència que llegeix un altre CSV i escriu a un altre lloc.
#
# NO TOCA CAP FITXER DE VERITAT. La sortida va a stats/proves/:
# stats/estadistiques_rimador.json i stats/versions_stats.json es queden
# exactament com estaven. EL CSV D'ALLÀ DUU CERQUES REALS: està al .gitignore i
# no s'ha de pujar mai.
#
# COM S'USA
#
#   python3 stats/prova_dialectes.py                 (baixa el full; cal la clau,
#                                                     vegeu stats/llegir_full.py)
#   python3 stats/prova_dialectes.py un_full.csv     (un CSV que ja tinguis)
#
# i després, per veure-ho a la pàgina, el que el mateix guió t'escriu en acabat.
#
# QUÈ INVENTA I QUÈ NO
#
# El dialecte de cada fila, i prou. Tota la resta (paraules, rimes, usuaris,
# dates) és el que hi ha al full. El dialecte es reparteix a l'atzar, o sigui
# que els percentatges de la barra sortiran repartits i els codis del top de
# rimes sortiran gairebé sempre tots quatre: NO t'ho miris per veure si les
# xifres són versemblants, que no ho seran. Serveix per veure si allò es pinta
# bé, si hi cap i si no salta de línia.
#
# Les primeres files es deixen expressament SENSE dialecte, per fer-hi sortir el
# cas mixt que hi haurà de debò els primers dies: cerques velles que no en duen
# barrejades amb les noves que sí. Són les que fan que alguna rima del top
# aparegui amb menys de quatre codis.
#
# El que ja dugui dialecte de debò no es toca mai, o sigui que el guió continua
# servint quan el full comenci a omplir-se.

import csv
import io
import json
import os
import random
import sys

from llegir_full import baixar_full

ARREL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUTA_STATS = os.path.join(ARREL, 'stats', 'stats.py')
CARPETA_PROVES = os.path.join(ARREL, 'stats', 'proves')
NOM_SORTIDA = 'estadistiques_dialectes.json'

# Els mateixos codis que ORDRE_DIALECTES de stats.py i que la llista DIALECTES
# de js/components.js.
CODIS = ['ca', 'nw', 'va', 'ba']

# Quantes files es queden sense dialecte, comptant des de les més velles. No és
# cap xifra sagrada: només ha de ser prou gran perquè el cas mixt es vegi i prou
# petita perquè quedin dades de sobres per omplir els tops.
FILES_SENSE_DIALECTE = 800

# Perquè dues execucions seguides donin el mateix: si cada cop sortís un
# repartiment diferent, no es podria comparar una captura amb l'anterior.
LLAVOR = 7


def llegir_full(origen):
    """El CSV, o baixat del Drive o llegit del disc."""
    if origen:
        print(f"Llegint {origen}")
        with io.open(origen, encoding='utf-8') as fitxer:
            return list(csv.reader(fitxer))

    # La mateixa adreça que stats.py: es treu d'allà i no es reescriu aquí, que
    # si algun dia canvia el full no hi hagi dos llocs per recordar.
    codi = io.open(RUTA_STATS, encoding='utf-8').read()
    marca = 'url_apps_script = "'
    if marca not in codi:
        raise SystemExit(
            "No trobo l'url_apps_script dins de stats/stats.py. Si l'has canviat de nom, "
            "passa-li el CSV a mà: python3 stats/prova_dialectes.py un_full.csv")
    url = codi.split(marca, 1)[1].split('"', 1)[0]

    print("Baixant el full...")
    text = baixar_full(url, ['Data', 'Usuari', 'Paraula'])
    return list(csv.reader(io.StringIO(text)))


def afegir_dialectes(files):
    """Emplena la columna "Dialecte", i la crea si el full encara no la duu.

    El que ja hi hagi escrit NO es toca. Això vol dir que el guió continua
    servint quan comencin a arribar cerques de debò amb dialecte: aquelles es
    queden com són i només s'inventen les que estan en blanc, o sigui que la
    pàgina es pot mirar sencera des del primer dia i sense esperar mesos que el
    full s'ompli.
    """
    capcalera = files[0]
    if 'Dialecte' in capcalera:
        columna = capcalera.index('Dialecte')
        sortida = [list(capcalera)]
    else:
        columna = len(capcalera)
        sortida = [list(capcalera) + ['Dialecte']]

    atzar = random.Random(LLAVOR)
    reals = inventats = buides = 0

    for numero, fila in enumerate(files[1:]):
        # Les files curtes (Google no escriu les cel·les buides del final) es
        # completen, que si no l'índex de la columna se'n va fora.
        fila = list(fila) + [''] * (columna + 1 - len(fila))

        if fila[columna].strip():
            reals += 1
        elif numero < FILES_SENSE_DIALECTE:
            buides += 1
        else:
            fila[columna] = atzar.choice(CODIS)
            inventats += 1

        sortida.append(fila)

    if reals:
        print(f"  {reals} files ja duien dialecte de debò: no s'hi toca")
    print(f"  {inventats} files amb dialecte inventat i {buides} deixades en blanc")
    return sortida


def executar_stats(cami_csv, cami_json, cami_versions):
    """L'stats.py de veritat, llegint el CSV de prova i escrivint fora del git.

    Es fa canviant-li tres línies i executant-lo, i no pas important-lo, perquè
    l'stats.py és un guió de dalt a baix sense cap funció main(): importar-lo ja
    el faria córrer sencer contra el full de veritat.
    """
    codi = io.open(RUTA_STATS, encoding='utf-8').read()

    canvis = [
        ("text_full = baixar_full(url_apps_script, ['Data', 'Usuari', 'Paraula'])\n"
         "df = pd.read_csv(io.StringIO(text_full))", f'df = pd.read_csv({cami_csv!r})'),
        ("ruta_json = 'stats/estadistiques_rimador.json'", f'ruta_json = {cami_json!r}'),
        ("ruta_versions = 'stats/versions_stats.json'", f'ruta_versions = {cami_versions!r}'),
    ]
    for vell, nou in canvis:
        if vell not in codi:
            # Val més plantar-se que no pas executar l'stats.py sense el canvi:
            # sense el de la sortida, sobreescriuria les estadístiques bones.
            raise SystemExit(
                f"L'stats.py ha canviat i no hi trobo aquesta línia:\n    {vell}\n"
                "Actualitza la llista de canvis de prova_dialectes.py abans de tornar-hi.")
        codi = codi.replace(vell, nou, 1)

    # Amb el directori de treball a l'arrel, que l'stats.py obre
    # 'llistes/paraules_naufragues_ca.json' amb el camí relatiu.
    abans = os.getcwd()
    os.chdir(ARREL)
    try:
        exec(compile(codi, RUTA_STATS, 'exec'), {'__name__': '__main__'})
    finally:
        os.chdir(abans)


def resum(cami_json):
    """Quatre xifres per veure d'un cop d'ull que hi ha arribat el dialecte."""
    dades = json.load(io.open(cami_json, encoding='utf-8'))
    sempre = dades['sempre']

    print("\nrecompte_dialecte (la barra de 'Percentatge d'ús dels filtres'):")
    recompte = sempre.get('recompte_dialecte', {})
    total = sum(recompte.values()) or 1
    for codi in CODIS:
        vegades = recompte.get(codi, 0)
        print(f"    {codi}  {vegades:6d}   {vegades / total * 100:5.1f} %")

    print("\nTop de rimes (els codis grisos de dades.html):")
    for entrada in sempre['top_10_rimes'][:5]:
        codis = ', '.join(entrada['dialectes']) or '(cap)'
        print(f"    {entrada['paraula']:8s} {entrada['tipus']:12s} {entrada['cerques']:4d}   {codis}")

    sense_codis = [e for e in sempre['top_10_rimes'] if not e['dialectes']]
    if sense_codis:
        print(f"\n  ({len(sense_codis)} rimes del top sense cap codi: sortiran sense res al costat)")

    # Les nàufragues ara es comparen amb la llista del dialecte de cada cerca,
    # o sigui que aquest top hauria de canviar respecte del que hi ha publicat:
    # hi ha paraules que no rimen en valencià i sí al central, i a l'inrevés.
    print("\nTop de paraules nàufragues (amb la llista de cada dialecte):")
    for entrada in sempre['top_10_naufragues'][:5]:
        codis = ', '.join(entrada.get('dialectes', [])) or '(cap)'
        print(f"    {entrada['paraula']:16s} {entrada['cerques']:4d}   {codis}")


def main():
    origen = sys.argv[1] if len(sys.argv) > 1 else None

    files = afegir_dialectes(llegir_full(origen))

    os.makedirs(CARPETA_PROVES, exist_ok=True)
    cami_csv = os.path.join(CARPETA_PROVES, 'full_amb_dialectes.csv')
    cami_json = os.path.join(CARPETA_PROVES, NOM_SORTIDA)
    cami_versions = os.path.join(CARPETA_PROVES, 'versions_dialectes.json')

    with io.open(cami_csv, 'w', encoding='utf-8', newline='') as fitxer:
        csv.writer(fitxer).writerows(files)

    executar_stats(cami_csv, cami_json, cami_versions)
    resum(cami_json)

    print(f"\nEscrit a stats/proves/{NOM_SORTIDA}")
    print("Les estadístiques de veritat no s'han tocat.\n")
    print("Per veure-ho a la pàgina: obre dades.html al navegador i, a la consola,")
    print("engega el servidor de sempre i enganxa-hi això:\n")
    print("    ['graficLiniaObj', 'graficFormatgeAssObj', 'graficFormatgeConsObj']")
    print("        .forEach(n => window[n] && window[n].destroy());")
    print(f"    carregarEstadistiques('stats/proves/{NOM_SORTIDA}');\n")


if __name__ == '__main__':
    main()
