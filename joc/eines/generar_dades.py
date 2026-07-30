# Generador de les dades del joc de rimes.
#
# Llegeix les columnes del diccionari (diccionaris/separat/col_*.txt) i en treu
# dues coses:
#
#   joc/dades/index.json      -> les claus de rima consonant que tenen prou rimes
#                                per fer-hi una partida, amb quin fitxer les conte
#                                i quantes paraules objectiu (no verbs) hi ha.
#   joc/dades/rimes/N.txt     -> un fitxer per grup assonant, dividit per dins en
#                                seccions de rima consonant.
#
# La gracia: la clau consonant determina sempre la clau assonant (comprovat: 0
# conflictes en 619.785 entrades), o sigui que un sol fitxer per grup assonant
# serveix les dues dificultats. Facil = totes les paraules del fitxer; dificil =
# nomes la seccio de la paraula objectiu. Una sola descarrega per partida.
#
# Format de cada fitxer de rimes:
#
#   #aðə              <- capcalera de seccio: clau de rima consonant
#   *cascada          <- l'* marca les paraules que poden ser OBJECTIU (no verbs)
#   cavalcava         <- sense *, nomes val com a RIMA (aqui, una forma verbal)
#   *cami>camí        <- si la forma real porta accents, va despres del ">"
#
# Aixi el joc no ha de normalitzar res en temps d'execucio, i sap de seguida
# quines paraules pot proposar com a objectiu i quines nomes accepta com a rima.
#
# Execucio (des de l'arrel del repositori o des d'aqui):
#   python joc/eines/generar_dades.py

import collections
import json
import os
import unicodedata
from datetime import date

# --- Configuracio -----------------------------------------------------------

# Rimes minimes que ha de tenir una clau consonant per poder-hi jugar. Com que
# la clau consonant implica la clau assonant, complir-ho en consonant ja ho
# garanteix en assonant.
MIN_RIMES = 50

# Els verbs no poden ser paraula objectiu (seria massa facil rimar-hi amb altres
# formes verbals), pero si que valen com a resposta. Els noms propis no compten
# ni per objectiu ni per resposta.
EXCLOURE_VERBS_OBJECTIU = True

# Si es posa a True, els plurals tampoc poden ser objectiu.
EXCLOURE_PLURALS_OBJECTIU = False

ARREL = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR_COLUMNES = os.path.join(ARREL, "diccionaris", "separat")
DIR_DADES = os.path.join(ARREL, "joc", "dades")
DIR_RIMES = os.path.join(DIR_DADES, "rimes")

# --- Utilitats --------------------------------------------------------------


def llegir_columna(i):
    with open(os.path.join(DIR_COLUMNES, f"col_{i}.txt"), encoding="utf-8") as f:
        return f.read().split("\n")


def normalitzar(paraula):
    """Minuscules, sense accents, sense punt volat. Ha de coincidir exactament
    amb normalitza() de joc/js/normalitza.js."""
    text = paraula.strip().lower().replace("·", "").replace("’", "'")
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def es_resposta_valida(paraula, codi):
    """Val com a rima: qualsevol paraula que no sigui nom propi ni una sigla."""
    if not paraula:
        return False
    if codi[:2] == "NP":
        return False
    normalitzada = normalitzar(paraula)
    if not normalitzada:
        return False
    # Fora xifres i caracters estranys. Els guionets i apostrofs enmig si valen
    # (p. ex. "adeu-siau").
    return normalitzada.replace("-", "").replace("'", "").isalpha()


def pot_ser_objectiu(codi):
    """Val com a paraula a rimar. Ja sabem que es resposta valida."""
    if EXCLOURE_VERBS_OBJECTIU and codi[0] == "V":
        return False
    if EXCLOURE_PLURALS_OBJECTIU:
        if codi[0] == "N" and len(codi) > 3 and codi[3] == "P":
            return False
        if codi[0] in "AD" and len(codi) > 4 and codi[4] == "P":
            return False
    return True


# --- Proces -----------------------------------------------------------------


def main():
    print("Llegint les columnes del diccionari...")
    paraules = llegir_columna(0)
    codis = llegir_columna(2)
    rima_cons = llegir_columna(3)
    rima_asson = llegir_columna(4)

    total = len(paraules)
    if not (len(codis) == len(rima_cons) == len(rima_asson) == total):
        raise SystemExit("Les columnes no tenen el mateix nombre de linies.")
    print(f"  {total} entrades")

    # clau consonant -> {forma normalitzada: forma per mostrar}
    grups = collections.defaultdict(dict)
    # clau consonant -> {formes normalitzades que poden ser objectiu}
    objectius = collections.defaultdict(set)
    # clau consonant -> clau assonant
    cons_a_asson = {}

    for i in range(total):
        paraula, codi = paraules[i], codis[i]
        if not es_resposta_valida(paraula, codi):
            continue

        clau = rima_cons[i]
        normalitzada = normalitzar(paraula)
        grup = grups[clau]
        # Si dues entrades cauen a la mateixa forma normalitzada (dona / dóna),
        # ens quedem la mes curta d'escriure: nomes es per mostrar-la.
        if normalitzada not in grup or len(paraula) < len(grup[normalitzada]):
            grup[normalitzada] = paraula

        # Una forma es objectiu si ALGUNA de les seves entrades no es verb
        # (p. ex. "poder" es verb i nom; com a nom, pot ser objectiu).
        if pot_ser_objectiu(codi):
            objectius[clau].add(normalitzada)

        anterior = cons_a_asson.setdefault(clau, rima_asson[i])
        if anterior != rima_asson[i]:
            raise SystemExit(
                f"La clau consonant '{clau}' apunta a dues claus assonants "
                f"('{anterior}' i '{rima_asson[i]}'): el joc no ho suporta."
            )

    print(f"  {len(grups)} claus de rima consonant, "
          f"{sum(len(g) for g in grups.values())} formes uniques")

    qualificades = sorted(
        clau for clau, grup in grups.items()
        if len(grup) > MIN_RIMES and len(objectius[clau]) > 0
    )
    if not qualificades:
        raise SystemExit("Cap clau supera el minim de rimes amb objectius.")

    # Nomes generem els grups assonants que fan falta per a alguna clau
    # qualificada. Cada fitxer, pero, conte el grup assonant sencer: fa falta
    # per validar les respostes en mode facil.
    asson_necessaris = sorted({cons_a_asson[clau] for clau in qualificades})
    id_de_asson = {clau: i for i, clau in enumerate(asson_necessaris)}

    claus_per_asson = collections.defaultdict(list)
    for clau in grups:
        claus_per_asson[cons_a_asson[clau]].append(clau)

    os.makedirs(DIR_RIMES, exist_ok=True)
    for antic in os.listdir(DIR_RIMES):
        if antic.endswith(".txt"):
            os.remove(os.path.join(DIR_RIMES, antic))

    print(f"Escrivint {len(asson_necessaris)} fitxers de rimes...")
    bytes_totals = 0
    for clau_asson in asson_necessaris:
        linies = []
        for clau_cons in sorted(claus_per_asson[clau_asson]):
            linies.append("#" + clau_cons)
            grup = grups[clau_cons]
            es_objectiu = objectius[clau_cons]
            for normalitzada in sorted(grup):
                mostrar = grup[normalitzada]
                cos = normalitzada if mostrar == normalitzada else f"{normalitzada}>{mostrar}"
                linies.append(("*" + cos) if normalitzada in es_objectiu else cos)
        cami = os.path.join(DIR_RIMES, f"{id_de_asson[clau_asson]}.txt")
        contingut = "\n".join(linies)
        with open(cami, "w", encoding="utf-8", newline="\n") as f:
            f.write(contingut)
        bytes_totals += len(contingut.encode("utf-8"))

    # index.json: per cada clau qualificada, a quin fitxer es i quantes paraules
    # objectiu hi ha. El joc tria la clau amb probabilitat proporcional al nombre
    # d'objectius, o sigui que totes les paraules objectiu son igual de probables.
    index = {
        "versio": date.today().isoformat(),
        "min_rimes": MIN_RIMES,
        "fitxers": len(asson_necessaris),
        "claus": [
            [clau, id_de_asson[cons_a_asson[clau]], len(objectius[clau])]
            for clau in qualificades
        ],
    }
    with open(os.path.join(DIR_DADES, "index.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

    total_objectius = sum(len(objectius[clau]) for clau in qualificades)
    print(f"Fet: {len(qualificades)} claus jugables, {total_objectius} paraules "
          f"objectiu possibles (sense verbs), {bytes_totals / 1048576:.1f} MB de dades.")


if __name__ == "__main__":
    main()
