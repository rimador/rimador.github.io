# Valida les paraules del dia manuals i en publica la versio xifrada.
#
# L'script de debo es ara joc/eines/manuals.mjs (de node): publicar-les vol dir
# xifrar-les, i es fa amb les mateixes funcions que les desxifren al joc (joc/js/
# especials.js), de manera que no hi ha cap port a Python que pugui discrepar. Aquest
# fitxer es queda perque l'ordre de sempre continui funcionant, i nomes l'engega.
#
# Cada paraula ha de ser paraula a rimar, i caure a UNA sola clau publicada, ALS
# QUATRE dialectes: si no, l'script falla i no escriu res. Tambe avisa si la paraula
# repeteix la d'un dia de la formula a menys de 30 dies. Escriu joc/dades/especials.json.
#
# L'entrada, amb les paraules en clar, s'edita a ma i es queda en local:
# joc/eines/diaries_manuals.json (al .gitignore).
#
# Execucio (des d'on sigui; els arguments es passen tal qual a l'script de node):
#   python joc/eines/comprovar_diaries_manuals.py
#   python joc/eines/comprovar_diaries_manuals.py --simula --detall

import os
import subprocess
import sys

DIR_EINES = os.path.dirname(os.path.abspath(__file__))


def main():
    try:
        resultat = subprocess.run(["node", os.path.join(DIR_EINES, "manuals.mjs"), *sys.argv[1:]])
    except FileNotFoundError:
        raise SystemExit("Cal node (v18 o superior) i no el trobo: les manuals es xifren amb el JS del joc.")
    sys.exit(resultat.returncode)


if __name__ == "__main__":
    main()
