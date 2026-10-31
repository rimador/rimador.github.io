# Generador de les dades del joc de rimes.
#
# Llegeix el diccionari i les columnes de rima de CADA dialecte i n'escriu SIS
# fitxers, ni un mes:
#
#   joc/dades/<codi>.txt      -> totes les rimes d'un dialecte, els grups
#                                assonants un darrere l'altre
#   joc/dades/index.json      -> les claus jugables dels quatre dialectes i, de
#                                cada grup assonant, on comenca i quant ocupa
#                                dins el seu fitxer
#   joc/dades/versions.json   -> el resum de cada fitxer, que es com el joc sap
#                                si la copia que te el navegador encara val
#                                (igual que diccionaris/versions.json)
#
# ABANS N'HI HAVIA 183, un per grup assonant i dialecte, perque una partida
# nomes necessita un grup i aixi no es baixava la resta. Sortia a 145 KB per
# partida, pero omplia el repositori de fitxers que no mira mai ningu. Ara el
# joc es baixa el dialecte sencer un sol cop (1,9 MB comprimits) i despres les
# partides no costen res: a partir de tretze ja hi surt guanyant. Els
# desplacaments son el que fa que no hagi d'interpretar els 7,6 MB per jugar amb
# un grup: talla el tros que li toca i prou.
#
# La gracia: la clau consonant determina sempre la clau assonant (comprovat, i
# es torna a comprovar aqui a cada passada), o sigui que un sol fitxer per grup
# assonant serveix les dues dificultats. Facil = totes les paraules del fitxer;
# dificil = nomes la seccio de la paraula objectiu. Una sola descarrega per
# partida.
#
# Format de cada fitxer de rimes:
#
#   #aðə              <- capcalera de seccio: clau de rima consonant
#   *cascada          <- OBJECTIU A TOTS ELS DIALECTES: la pot proposar qualsevol
#                        mode (vegeu "les tres menes de paraula" mes avall)
#   +panderola        <- objectiu NOMES al mode personalitzat: no compleix la
#                        finestra de rimes als quatre dialectes
#   cavalcava         <- sense marca, nomes val com a RIMA (aqui, una forma
#                        verbal; tambe hi cauen les paraules de l'apendix)
#   *cami>camí        <- si la forma real porta accents, va despres del ">"
#
# Aixi el joc no ha de normalitzar res en temps d'execucio, i sap de seguida
# quines paraules pot proposar com a objectiu i quines nomes accepta com a rima.
#
# LES TRES MENES DE PARAULA, i per que fan falta:
#
#   *  Es pot rimar als QUATRE dialectes: la seva clau de rima te entre
#      MIN_RIMES i MAX_RIMES rimes a tots quatre. Es l'unica mena que poden
#      proposar la paraula del dia i l'il·limitat, perque la classificacio es
#      una de sola per a tothom i una paraula amb 25 rimes en central i 900 en
#      balear no seria la mateixa partida segons on la juguis.
#   +  Nomes al mode PERSONALITZAT, que es on el jugador es tria la finestra i
#      pot demanar a posta una terminacio de tres rimes o una de sis mil. Alla
#      el dialecte va tancat dins de l'enllac i tots dos jugadors juguen el
#      mateix, o sigui que la finestra dels quatre dialectes no hi fa falta.
#   -  (sense marca) Nomes val com a resposta: els verbs (rimar-hi amb altres
#      formes conjugades seria massa facil) i tot l'APENDIX del dialecte.
#
# L'APENDIX es el diccionari propi de cada dialecte: les formes que nomes es
# diuen alla i que, per tant, no son al diccionari global. Compten com a RIMA
# -qui juga en valencia ha de poder respondre-hi una paraula valenciana- pero
# mai com a paraula a rimar: l'objectiu surt sempre del diccionari global, que
# es el que tothom comparteix. Vegeu llegir_apendix().
#
# ELS DESPLACAMENTS SON EN BYTES, no en caracters: el joc es baixa el fitxer com
# a ArrayBuffer i nomes descodifica el tros que li toca (vegeu grupDeRimes a
# joc/js/dades.js). Comptar caracters seria demanar-se problemes, perque un
# index de Python son punts de codi i un de JavaScript son unitats UTF-16.
#
# ON SON LES DADES: no se sap aqui. Els camins surten de
# diccionaris/python/camins.py, que es el vocabulari compartit de tots els
# scripts del repositori. La rima no es al diccionari (depen de com es parli) i
# viu a dialectes_col/<codi>/; els dialectes que hi ha son les subcarpetes
# d'alla i no es declaren enlloc.
#
# L'apendix tambe surt del camins.py (camins.te_apendix i camins.cami_apendix):
# es dialectes_col/<codi>/apendix/, amb les mateixes columnes que el diccionari
# global pero SENSE el nom al mig del fitxer (vegeu llegir_apendix).
#
# Execucio (des d'on sigui):
#   python joc/eines/generar_dades.py             tots els dialectes
#   python joc/eines/generar_dades.py ca va       nomes aquests

import collections
import hashlib
import json
import os
import shutil
import sys
import unicodedata
from datetime import datetime, timezone

# camins.py sap on es cada cosa i com es diu. Es el mateix modul que fan servir
# els scripts del diccionari, o sigui que si un dia les columnes es tornen a
# moure, el joc les segueix sense tocar res d'aqui.
DIR_EINES = os.path.dirname(os.path.abspath(__file__))
DIR_REPOSITORI = os.path.dirname(os.path.dirname(DIR_EINES))
sys.path.insert(0, os.path.join(DIR_REPOSITORI, "diccionaris", "python"))

import camins  # noqa: E402

# L'arrel de l'arbre que es llegeix I on s'escriu, que es la que digui el
# camins.py: amb RIMADOR_ARREL posat, tot l'script corre contra la copia de
# joguina de l'arbre (un diccionari de vint files, dos dialectes) i no toca les
# dades de debo. Abans les sortides anaven sempre al repositori de veritat,
# encara que les entrades vinguessin de la copia, i provar un canvi volia dir
# reescriure 30 MB de dades bones.
ARREL = camins.ARREL

# --- Configuracio -----------------------------------------------------------

# QUINES CLAUS ES PODEN JUGAR: les que tenen entre MIN_RIMES i MAX_RIMES rimes
# consonants. Com que la clau consonant implica la clau assonant, complir-ho en
# consonant ja ho garanteix en assonant.
#
# I ES COMPROVA ALS QUATRE DIALECTES ALHORA, no nomes al que es juga: la
# finestra no qualifica CLAUS sino PARAULES, i una paraula nomes pot ser
# objectiu dels modes normals si la seva clau de rima hi cau als quatre. Vegeu
# qualificar_objectius().
#
# EL MINIM era 50, despres 20 i ara es 30. Amb 50 nomes hi havia 500 claus
# jugables per dialecte; amb 20 se'n van fer unes 1.000, pero amb vint rimes i
# un minut la partida s'acaba abans que el rellotge i la pantalla de final es
# queda a mig gas. Amb 30 n'hi ha prou per no tocar sostre i encara queden
# ~660 claus jugables per dialecte.
#
# EL MAXIM es nou i es el que substitueix la idea de vetar les agudes. El
# problema de "camio" no es que sigui aguda: es que la seva clau consonant ('o')
# te 6.543 rimes al diccionari central, o sigui que val gairebe qualsevol cosa
# acabada en o tonica i la partida no es jugar sino escriure de pressa. El
# mateix passa amb 'en' (5.067: vent, dent, ment...) i 'os' (3.490: gos, os,
# nos...), i en canvi hi ha agudes perfectament jugables ('el' d'estel en te
# 118, 'ol' d'esquirol 467). Vetant les agudes es perdien aquestes i es
# quedaven fora igualment claus planes igual de barates; comptant rimes cauen
# exactament les que son massa facils, siguin agudes o no.
#
# Per que 800: mirant la distribucio del central, la mediana d'una clau jugable
# son 38 rimes i el percentil 90 en son 277; les que passen del miler son
# nomes les mitja dotzena de terminacions gegants d'abans. Amb 30-800 i la
# comprovacio als quatre dialectes en queden 663 de jugables al central, i cap
# on la resposta sigui "escriu el que sigui".
#
# AQUEST ES L'UNIC LLOC ON ES TOQUEN. Arriben al joc per dues bandes, i totes
# dues les escriu aquest script: l'index.json (min_rimes, max_rimes), que es la
# finestra dels modes normals, i el joc/js/finestra.js, d'on el personalitzat i
# el freestyle treuen els seus valors per defecte (vegeu escriure_finestra_js).
# Canviar-los aqui sense tornar a passar el generador no canvia res.
MIN_RIMES = 50
MAX_RIMES = 1000

# QUE ES PUBLICA, que no es el mateix. La finestra de dalt es la dels modes
# normals (paraula del dia i il·limitat), pero el mode PERSONALITZAT deixa que
# el jugador es triï els límits: rimar amb una terminació que només en té tres
# es una manera perfectament legítima de fer-s'ho difícil. Al fitxer, doncs, hi
# van TOTES les claus des de MIN_RIMES_PUBLICADES amunt, sense sostre, i qui
# retalla la finestra dels modes normals es el joc, en temps d'execucio (vegeu
# clausDeLaFinestra a joc/js/objectius.js).
#
# Amb dues rimes ja hi ha partida (una paraula per trobar); amb una, la
# terminacio no rima amb res i la clau no serveix per a res.
MIN_RIMES_PUBLICADES = 2

# Quantes paraules es guarden de cada clau per a la paraula del dia. La paraula
# del dia es UNA per a tothom (vegeu construir_diaries), o sigui que no es pot
# triar del sac sencer de cada dialecte: n'hi ha d'haver una llista curta i
# compartida. Amb quatre per clau, els cicles de la paraula del dia no repeteixen
# mai exactament la mateixa llista.
DIARIES_PER_CLAU = 4

# Els verbs no poden ser paraula objectiu (seria massa facil rimar-hi amb altres
# formes verbals), pero si que valen com a resposta. Els noms propis no compten
# ni per objectiu ni per resposta.
#
# I VERB VOL DIR TAMBE LES FORMES AMB PRONOM: "havent-se'n", "rient-li",
# "prometent-se-la". Al diccionari duen codi W i no pas V (vegeu les formes que
# genera el workflow dels pronoms), i per tant se n'escapaven: sortien 19
# paraules del dia i 133 objectius de l'il·limitat que eren aixo. Es el mateix
# problema que els verbs i pitjor, perque a mes de rimar amb qualsevol altra
# forma conjugada, la meitat de la paraula es el pronom i "rima amb havent-se'n"
# no es cap partida.
EXCLOURE_VERBS_OBJECTIU = True

# Els codis gramaticals que son verb, per al de sobre: V son les formes
# conjugades i W les mateixes formes amb pronoms enganxats.
CODIS_VERBALS = ("V", "W")

# Si es posa a True, els plurals tampoc poden ser objectiu.
EXCLOURE_PLURALS_OBJECTIU = False

# Com es diu cada dialecte a la pantalla i EN QUIN ORDRE surt a la tira. Ha de
# coincidir amb la llista DIALECTES de js/components.js, que es la que pinta la
# tira del cercador: el joc no comparteix JS amb la web i se'ls ha de dir el nom
# a la seva manera, pero les dues tires han d'ensenyar el mateix i en el mateix
# ordre.
#
# Els codis, en canvi, no surten d'aqui sino de camins.dialectes(): un dialecte
# nou es una carpeta a dialectes_col/ i prou. Si n'hi ha un que no es en aquest
# mapa, es genera igualment i el joc n'ensenyara el codi tal qual, al final de
# la tira: lleig, pero no trencat ni silenciat.
NOMS_DE_DIALECTE = {
    "ca": "Central",
    "nw": "Nord-occidental",
    "va": "Valencià",
    "ba": "Balear",
}


def ordre_de_tira(codis):
    """Els codis en l'ordre de NOMS_DE_DIALECTE (el de la tira del cercador), i
    els que no hi surtin, al final i per ordre alfabetic."""
    coneguts = [c for c in NOMS_DE_DIALECTE if c in codis]
    return coneguts + sorted(c for c in codis if c not in NOMS_DE_DIALECTE)


DIR_JOC = os.path.basename(os.path.dirname(DIR_EINES))
DIR_DADES = os.path.join(ARREL, DIR_JOC, "dades")
VERSIONS = os.path.join(DIR_DADES, "versions.json")
INDEX = os.path.join(DIR_DADES, "index.json")
FINESTRA_JS = os.path.join(ARREL, DIR_JOC, "js", "finestra.js")

# Les marques de cada mena de paraula al fitxer de rimes. Han de coincidir amb
# l'analitzar() de joc/js/dades.js, que compara codis de caracter (35 = '#',
# 42 = '*', 43 = '+').
MARCA_ARREU = "*"
MARCA_PERSONALITZAT = "+"


# --- Utilitats --------------------------------------------------------------


def normalitzar(paraula):
    """Minuscules, sense accents, sense punt volat. Ha de coincidir exactament
    amb normalitza() de joc/js/normalitza.js."""
    text = paraula.strip().lower().replace("·", "").replace("’", "'")
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def es_resposta_valida(paraula, codi, normalitzada):
    """Val com a rima: qualsevol paraula que no sigui nom propi ni una sigla.

    La forma normalitzada la passa qui crida i no es calcula aqui: amb quatre
    dialectes i dues passades, normalitzar les 619.783 paraules a cada volta
    eren vuit milions de crides per no res (surten del diccionari, que es el
    mateix a tot arreu)."""
    if not paraula:
        return False
    if codi[:2] == "NP":
        return False
    if not normalitzada:
        return False
    # Fora xifres i caracters estranys. Els guionets i apostrofs enmig si valen
    # (p. ex. "adeu-siau").
    return normalitzada.replace("-", "").replace("'", "").isalpha()


def pot_ser_objectiu(codi):
    """Val com a paraula a rimar. Ja sabem que es resposta valida."""
    if EXCLOURE_VERBS_OBJECTIU and codi[:1] in CODIS_VERBALS:
        return False
    if EXCLOURE_PLURALS_OBJECTIU:
        if codi[0] == "N" and len(codi) > 3 and codi[3] == "P":
            return False
        if codi[0] in "AD" and len(codi) > 4 and codi[4] == "P":
            return False
    return True


def escriure_si_cal(cami, contingut):
    """Refer-ho tot a cada passada vol dir reescriure desenes de MB que el git
    ni tan sols mirara, i deixa la data de tots els fitxers canviada per no
    res. Accepta text o bytes. Torna si ha calgut escriure'l."""
    dades = contingut if isinstance(contingut, bytes) else contingut.encode("utf-8")
    if os.path.exists(cami):
        with open(cami, "rb") as fitxer:
            if fitxer.read() == dades:
                return False
    os.makedirs(os.path.dirname(cami), exist_ok=True)
    with open(cami, "wb") as fitxer:
        fitxer.write(dades)
    return True


def resum(cami):
    """La versio d'un fitxer es un resum del seu contingut, com a
    diccionaris/python/versions.py: es refresca exactament quan el fitxer ha
    canviat, ni abans ni de mes."""
    calculador = hashlib.sha256()
    with open(cami, "rb") as fitxer:
        for tros in iter(lambda: fitxer.read(1024 * 1024), b""):
            calculador.update(tros)
    return calculador.hexdigest()[:12]


# --- El diccionari global i l'apendix de cada dialecte -----------------------


def preparar_diccionari():
    """Les columnes del diccionari global, amb la feina feta un sol cop.

    La paraula i el codi gramatical son els MATEIXOS per a tots els dialectes
    (surten del diccionari, no de la transcripcio), o sigui que normalitzar-les
    i qualificar-les es fa aqui i prou. Torna llistes paral·leles:

      paraules       la forma tal com s'escriu
      normalitzades  la forma sense accents (la que el joc compara)
      valides        si val com a RIMA
      objectius      si, a mes, podria ser paraula a rimar (no es verb)
    """
    paraules = camins.llegir_columna(camins.cami_columna(0))
    codis = camins.llegir_columna(camins.cami_columna(2))
    if len(paraules) != len(codis):
        raise SystemExit(
            f"Les columnes del diccionari no tenen el mateix nombre de files: "
            f"col_0 {len(paraules)}, col_2 {len(codis)}. Passa el columnes.py.")

    normalitzades = []
    valides = []
    objectius = []
    for paraula, codi in zip(paraules, codis):
        normalitzada = normalitzar(paraula)
        valida = es_resposta_valida(paraula, codi, normalitzada)
        normalitzades.append(normalitzada)
        valides.append(valida)
        objectius.append(valida and pot_ser_objectiu(codi))

    # Els apendixs els hi posa el main() quan sap quins dialectes ha de generar;
    # aqui hi va la casella buida perque files_del_dialecte() sempre la trobi.
    return {"paraules": paraules, "normalitzades": normalitzades,
            "valides": valides, "objectius": objectius, "apendixs": {}}


def llegir_apendix(codi):
    """L'APENDIX D'UN DIALECTE: les paraules que nomes es diuen alla.

    El diccionari complet d'un dialecte es global + apendix. L'apendix te la
    MATEIXA ESTRUCTURA que el global -columnes paral·leles, una linia per
    forma- i viu a:

        dialectes_col/<codi>/apendix/
            col_0_<codi>.txt    la paraula
            col_2_<codi>.txt    el codi gramatical
            col_3_<codi>.txt    la clau de rima consonant
            col_4_<codi>.txt    la clau de rima assonant

    Els noms els diu camins.cami_apendix(): dins de l'apendix les columnes NO
    duen el nom al mig ("col_3_va.txt" i no pas "col_3_rimacons_va.txt", que es
    com es diuen les del trans_dicc). Abans aixo s'endevinava aqui i s'hi
    provaven noms que no existeixen; el resultat era que l'apendix no es
    llegia mai i les dades del joc sortien nomes del diccionari global.

    Si la carpeta no hi es, el dialecte no te apendix i no passa res: un
    dialecte nou es una carpeta amb la seva transcripcio i les paraules propies
    ja vindran. Si hi es pero hi falta alguna columna, l'script peta: un apendix
    a mitges donaria rimes valides que el joc no acceptaria i no hi hauria cap
    error visible.

    Torna llistes paral·leles (paraules, normalitzades, valides, rima_cons,
    rima_asson) o None.
    """
    if not camins.te_apendix(codi):
        return None

    def columna(numero):
        cami = camins.cami_apendix(codi, numero)
        if not os.path.exists(cami):
            raise SystemExit(
                f"[{codi}] l'apendix es a {camins.dir_apendix(codi)} pero no hi "
                f"ha cap {os.path.basename(cami)}. L'apendix ha de dur les "
                "mateixes columnes que el diccionari global (col_0, col_2, "
                "col_3 i col_4).")
        return camins.llegir_columna(cami)

    paraules = columna(0)
    codis = columna(2)
    rima_cons = columna(3)
    rima_asson = columna(4)

    mides = {"col_0": len(paraules), "col_2": len(codis),
             "col_3": len(rima_cons), "col_4": len(rima_asson)}
    if len(set(mides.values())) != 1:
        raise SystemExit(f"[{codi}] les columnes de l'apendix no tenen el mateix "
                         f"nombre de files: {mides}")

    normalitzades = []
    valides = []
    for paraula, codi_gramatical in zip(paraules, codis):
        normalitzada = normalitzar(paraula)
        normalitzades.append(normalitzada)
        valides.append(es_resposta_valida(paraula, codi_gramatical, normalitzada))

    return {"paraules": paraules, "normalitzades": normalitzades,
            "valides": valides, "rima_cons": rima_cons, "rima_asson": rima_asson}


def files_del_dialecte(codi, base):
    """Totes les formes que valen en un dialecte, primer les del diccionari
    global i despres les del seu apendix.

    Torna tuples (normalitzada, paraula, clau_cons, clau_asson, pot_ser_objectiu).
    LES DE L'APENDIX MAI NO SON OBJECTIU: la paraula a rimar surt sempre del
    diccionari global, que es el que comparteixen els quatre dialectes; les de
    l'apendix hi valen com a resposta i prou.
    """
    rima_cons = camins.llegir_columna(camins.cami_dialecte(codi, 3))
    rima_asson = camins.llegir_columna(camins.cami_dialecte(codi, 4))

    total = len(base["paraules"])
    if not (len(rima_cons) == len(rima_asson) == total):
        raise SystemExit(
            f"[{codi}] les columnes de rima tenen {len(rima_cons)} i "
            f"{len(rima_asson)} files, i el diccionari en te {total}. "
            "Passa el columnes.py.")

    normalitzades = base["normalitzades"]
    paraules = base["paraules"]
    valides = base["valides"]
    objectius = base["objectius"]
    for i in range(total):
        if valides[i]:
            yield (normalitzades[i], paraules[i], rima_cons[i], rima_asson[i],
                   objectius[i])

    apendix = base["apendixs"].get(codi)
    if apendix:
        for i in range(len(apendix["paraules"])):
            if apendix["valides"][i]:
                yield (apendix["normalitzades"][i], apendix["paraules"][i],
                       apendix["rima_cons"][i], apendix["rima_asson"][i], False)


# --- Primera passada: quantes rimes te cada paraula a cada dialecte ----------
#
# LA FINESTRA DE RIMES ES COMPROVA ALS QUATRE DIALECTES, i per aixo fan falta
# dues passades. Una paraula nomes pot ser objectiu dels modes normals si la
# seva clau de rima te entre MIN_RIMES i MAX_RIMES rimes A TOTS QUATRE: "reflux"
# en te 64 en central, en nord-occidental i en valencia, i 582 en balear;
# n'hi ha que en tenen 25 en un i 900 en un altre, i llavors la mateixa paraula
# no es la mateixa partida segons on la juguis. Com que la classificacio es una
# de sola per a tothom, aixo no s'aguanta.
#
# La primera passada nomes en treu el MARGE de cada paraula (el minim i el maxim
# de rimes de les claus on cau), que son dos numeros per paraula i no els quatre
# dialectes sencers a la memoria alhora: aixo ultim no hi cabria.


def marges_de_rima(codi, base):
    """De cada paraula que podria ser objectiu, quantes rimes te la seva clau en
    aquest dialecte: [minim, maxim] de les claus on cau.

    Nomes hi ha mes d'una clau amb els homografs que, sense accents, s'escriuen
    igual i rimen diferent ("dona" /dɔnə/ i "dóna" /donə/). Es guarden el minim
    i el maxim perque el joc ensenya la forma nua i no pot dir amb quina de les
    dues estas jugant: si una de les dues cau fora de la finestra, la paraula no
    pot ser objectiu.

    L'APENDIX HI COMPTA: les seves paraules son rimes valides del dialecte, o
    sigui que fan pujar el compte de la seva clau. El diccionari d'un dialecte
    es global + apendix, i la finestra es mira damunt del diccionari sencer.
    """
    formes_per_clau = collections.defaultdict(set)
    parelles = []   # (normalitzada, clau) de les que podrien ser objectiu
    for normalitzada, _paraula, clau, _asson, es_objectiu in files_del_dialecte(codi, base):
        formes_per_clau[clau].add(normalitzada)
        if es_objectiu:
            parelles.append((normalitzada, clau))

    compte = {clau: len(formes) for clau, formes in formes_per_clau.items()}
    del formes_per_clau

    marges = {}
    for normalitzada, clau in parelles:
        rimes = compte[clau]
        marge = marges.get(normalitzada)
        if marge is None:
            marges[normalitzada] = [rimes, rimes]
        else:
            if rimes < marge[0]:
                marge[0] = rimes
            if rimes > marge[1]:
                marge[1] = rimes
    return marges


def marges_publicats(codi):
    """El mateix, pero tret del fitxer JA PUBLICAT d'un dialecte.

    Serveix per a les passades parcials (`generar_dades.py va`): la finestra es
    dels quatre dialectes, o sigui que per marcar-ne un cal saber quantes rimes
    tenen les paraules als altres tres. Del fitxer publicat se'n pot treure:
    cada seccio diu quantes rimes te (les seves linies) i quines paraules hi ha.

    Torna (marges, marcades), on `marcades` son les paraules que el fitxer ja te
    marcades com a objectiu-arreu: serveix per avisar si la passada parcial les
    deixa desactualitzades.

    NO ES EXACTE i no ho pot ser: al fitxer nomes hi son les claus publicades,
    o sigui que una paraula que en aquest dialecte tambe caigui en una clau de
    menys de MIN_RIMES_PUBLICADES rimes hi surt amb un marge massa optimista.
    Per aixo la passada de tots els dialectes es l'unica que mana, i quan la
    parcial no hi quadra s'avisa.
    """
    cami = os.path.join(DIR_DADES, f"{codi}.txt")
    if not os.path.exists(cami):
        return None

    with open(cami, encoding="utf-8") as fitxer:
        text = fitxer.read()

    marges = {}
    marcades = set()
    seccio = []     # (normalitzada, es_objectiu) de la seccio que s'esta llegint

    def tancar():
        rimes = len(seccio)
        for normalitzada, es_objectiu in seccio:
            if not es_objectiu:
                continue
            marge = marges.get(normalitzada)
            if marge is None:
                marges[normalitzada] = [rimes, rimes]
            else:
                marge[0] = min(marge[0], rimes)
                marge[1] = max(marge[1], rimes)
        seccio.clear()

    for linia in text.split("\n"):
        if not linia:
            continue
        if linia[0] == "#":
            tancar()
            continue
        marca = linia[0]
        cos = linia[1:] if marca in (MARCA_ARREU, MARCA_PERSONALITZAT) else linia
        normalitzada = cos.split(">", 1)[0]
        seccio.append((normalitzada, marca in (MARCA_ARREU, MARCA_PERSONALITZAT)))
        if marca == MARCA_ARREU:
            marcades.add(normalitzada)
    tancar()

    return marges, marcades


def qualificar_objectius(marges_per_dialecte):
    """Les paraules que poden ser objectiu ALS QUATRE dialectes: la seva clau de
    rima ha de tenir entre MIN_RIMES i MAX_RIMES rimes a tots quatre.

    Amb els homografs es demana que hi capiguen TOTES les claus on cauen (per
    aixo el marge es un minim i un maxim): el joc ensenya "dona" i prou, i les
    rimes que valdran son les d'una de les dues lectures.
    """
    codis = sorted(marges_per_dialecte)
    if not codis:
        return set()

    qualificades = set()
    for normalitzada in marges_per_dialecte[codis[0]]:
        for codi in codis:
            marge = marges_per_dialecte[codi].get(normalitzada)
            if marge is None or marge[0] < MIN_RIMES or marge[1] > MAX_RIMES:
                break
        else:
            qualificades.add(normalitzada)
    return qualificades


# --- Segona passada: un dialecte --------------------------------------------


def generar_dialecte(codi, base, qualificades):
    """Escriu joc/dades/<codi>.txt i torna el seu tros d'index.

    `qualificades` son les paraules que poden ser objectiu als quatre dialectes
    (vegeu qualificar_objectius): les que al fitxer duran l'asterisc. Les altres
    paraules no verbals hi van amb un "+" i nomes les pot proposar el mode
    personalitzat.
    """
    # clau consonant -> {forma normalitzada: forma per mostrar}
    grups = collections.defaultdict(dict)
    # clau consonant -> {formes normalitzades que poden ser objectiu}
    objectius = collections.defaultdict(set)
    # clau consonant -> clau assonant
    cons_a_asson = {}
    # les formes per mostrar del diccionari GLOBAL, que son les mateixes a tots
    # els dialectes i les uniques que poden ser paraula del dia
    mostrar_de = {}

    for normalitzada, paraula, clau, asson, es_objectiu in files_del_dialecte(codi, base):
        grup = grups[clau]
        # Si dues entrades cauen a la mateixa forma normalitzada (dona / dóna),
        # ens quedem la mes curta d'escriure: nomes es per mostrar-la.
        if normalitzada not in grup or len(paraula) < len(grup[normalitzada]):
            grup[normalitzada] = paraula

        # Una forma es objectiu si ALGUNA de les seves entrades ho es (p. ex.
        # "poder" es verb i nom; com a nom, pot ser objectiu). Les de l'apendix
        # no ho son mai.
        if es_objectiu:
            objectius[clau].add(normalitzada)
            anterior = mostrar_de.get(normalitzada)
            if anterior is None or len(paraula) < len(anterior):
                mostrar_de[normalitzada] = paraula

        anterior = cons_a_asson.setdefault(clau, asson)
        if anterior != asson:
            raise SystemExit(
                f"[{codi}] la clau consonant '{clau}' apunta a dues claus "
                f"assonants ('{anterior}' i '{asson}'): el joc no ho "
                "suporta, perque es el que li permet servir les dues "
                "dificultats amb un sol fitxer.")

    # Les que poden ser objectiu a tots els dialectes, clau per clau.
    objectius_arreu = {
        clau: {p for p in formes if p in qualificades}
        for clau, formes in objectius.items()
    }

    # TOT EL QUE ES PUBLICA: qualsevol clau amb prou rimes per poder-hi jugar i
    # amb alguna paraula que es pugui proposar. Es la llista que veu el mode
    # personalitzat.
    publicades = sorted(
        clau for clau, grup in grups.items()
        if len(grup) >= MIN_RIMES_PUBLICADES and len(objectius[clau]) > 0
    )
    if not publicades:
        raise SystemExit(f"[{codi}] cap clau arriba a {MIN_RIMES_PUBLICADES} "
                         "rimes amb objectius.")

    # I LES DELS MODES NORMALS: les que tenen alguna paraula que es pot rimar
    # als quatre dialectes. La finestra ja hi es dins (una paraula qualificada
    # arreu te, per forca, la clau d'aquest dialecte entre MIN_RIMES i
    # MAX_RIMES), pero aixo es mes estret que abans: la clau pot ser-hi i no
    # tenir cap paraula que valgui a tot arreu.
    #
    # El maxim val per a les dues dificultats a posta: en dificil es literalment
    # el nombre de respostes bones, i en facil, encara que les respostes siguin
    # el grup assonant sencer, la paraula objectiu surt d'aqui i es la que fa
    # que la partida sigui un repte o una copia al net.
    jugables = {clau for clau in publicades if objectius_arreu[clau]}
    if not jugables:
        raise SystemExit(
            f"[{codi}] cap clau te cap paraula que es pugui rimar als quatre "
            f"dialectes amb la finestra de {MIN_RIMES}-{MAX_RIMES} rimes.")

    # Nomes generem els grups assonants que fan falta per a alguna clau
    # qualificada. Cada fitxer, pero, conte el grup assonant sencer: fa falta
    # per validar les respostes en mode facil.
    asson_necessaris = sorted({cons_a_asson[clau] for clau in publicades})
    id_de_asson = {clau: i for i, clau in enumerate(asson_necessaris)}

    claus_per_asson = collections.defaultdict(list)
    for clau in grups:
        claus_per_asson[cons_a_asson[clau]].append(clau)

    # Un sol fitxer per dialecte: els grups assonants un darrere l'altre,
    # separats per un salt de linia. De cada grup n'apuntem on comenca i quant
    # ocupa, EN BYTES, que es el que despres permet al joc tallar-ne un sense
    # haver d'interpretar la resta.
    # Quantes rimes te cada grup assonant sencer: es el nombre de respostes
    # bones del mode facil, i el mode personalitzat hi filtra.
    rimes_del_grup = {
        clau_asson: sum(len(grups[c]) for c in claus_per_asson[clau_asson])
        for clau_asson in asson_necessaris
    }

    trossos = []
    desplacaments = []
    posicio = 0
    for clau_asson in asson_necessaris:
        linies = []
        for clau_cons in sorted(claus_per_asson[clau_asson]):
            linies.append("#" + clau_cons)
            grup = grups[clau_cons]
            es_objectiu = objectius.get(clau_cons, ())
            arreu = objectius_arreu.get(clau_cons, ())
            for normalitzada in sorted(grup):
                mostrar = grup[normalitzada]
                cos = normalitzada if mostrar == normalitzada else f"{normalitzada}>{mostrar}"
                if normalitzada in arreu:
                    linies.append(MARCA_ARREU + cos)
                elif normalitzada in es_objectiu:
                    linies.append(MARCA_PERSONALITZAT + cos)
                else:
                    linies.append(cos)
        dades = "\n".join(linies).encode("utf-8")
        desplacaments.append([posicio, len(dades)])
        trossos.append(dades)
        posicio += len(dades) + 1   # +1 pel salt que els separa

    contingut = b"\n".join(trossos)
    escrit = escriure_si_cal(os.path.join(DIR_DADES, f"{codi}.txt"), contingut)

    # CANDIDATS A PARAULA DEL DIA d'aquest dialecte: les paraules que es poden
    # rimar arreu i que nomes son a UNA clau. Les que son a dues (els homografs
    # que, sense accents, es diuen igual pero rimen diferent: "dona" /dɔnə/ i
    # "dona" /donə/) no poden ser paraula del dia, perque no se sabria amb quina
    # de les dues estas jugant.
    #
    # La posicio que es desa es la de la clau dins de "claus", que porta TOTES
    # les publicades: es l'index que despres fa servir el bloc "diaries".
    quantes_claus = collections.Counter()
    primera_clau = {}
    for posicio, clau in enumerate(publicades):
        for paraula_objectiu in objectius_arreu[clau]:
            quantes_claus[paraula_objectiu] += 1
            primera_clau.setdefault(paraula_objectiu, posicio)
    candidats = {
        normalitzada: primera_clau[normalitzada]
        for normalitzada in primera_clau
        if quantes_claus[normalitzada] == 1
    }

    total_objectius = sum(len(objectius[clau]) for clau in publicades)
    total_arreu = sum(len(objectius_arreu[clau]) for clau in publicades)
    apendix = base["apendixs"].get(codi)
    rimes_apendix = (f", {camins.mil(len(apendix['paraules']))} de l'apendix"
                     if apendix else "")
    print(f"  {codi}: {len(publicades)} claus publicades ({len(jugables)} amb "
          f"paraules jugables arreu), {camins.mil(total_arreu)} paraules "
          f"objectiu de {camins.mil(total_objectius)}{rimes_apendix}, "
          f"{len(asson_necessaris)} grups, {len(contingut) / 1048576:.1f} MB"
          f"{'' if escrit else ' (sense canvis)'}")

    # El tros d'index d'aquest dialecte.
    #
    # De cada GRUP assonant: on comenca, quant ocupa, DE QUINA CLASSE es
    # (1 aguda, 2 plana, 3 esdruixola) i QUANTES RIMES te en total. Les dues
    # ultimes son per al mode personalitzat: la classe surt de la llargada de la
    # clau assonant -que es la sequencia de vocals des de la tonica, o sigui que
    # comptar-les es comptar les sillabes des de l'accent- i el total de rimes
    # es el nombre de respostes bones que tindras en mode facil, perque en facil
    # val tot el grup.
    #
    # De cada CLAU: la clau, el seu grup, quantes paraules objectiu te, quantes
    # RIMES (que son les respostes bones en mode dificil) i quantes d'aquelles
    # paraules objectiu es poden rimar ALS QUATRE dialectes.
    #
    # Els dos recomptes d'objectius no son cap duplicat: el primer es el que veu
    # el mode personalitzat (que deixa triar la finestra i, per tant, pot
    # proposar qualsevol paraula no verbal) i el segon el dels modes normals,
    # que nomes poden proposar les que valen a tot arreu. Tots dos fan de PES a
    # l'hora de triar quina clau d'una rima dona la paraula (vegeu clauDeLaRima
    # a joc/js/objectius.js), i barrejar-los faria sortir claus sense cap
    # paraula que es pugui jugar.
    tros_index = {
        # La mida del fitxer sense comprimir. El joc la fa servir per dir quant
        # li queda mentre el baixa: el Content-Length que dona el servidor es el
        # del cos COMPRIMIT, i el lector del fetch va donant bytes ja
        # descomprimits, o sigui que comparar-los faria percentatges falsos.
        "bytes": len(contingut),
        "grups": [
            desplacaments[i] + [min(len(clau_asson), 3), rimes_del_grup[clau_asson]]
            for i, clau_asson in enumerate(asson_necessaris)
        ],
        "claus": [
            [clau, id_de_asson[cons_a_asson[clau]], len(objectius[clau]),
             len(grups[clau]), len(objectius_arreu[clau])]
            for clau in publicades
        ],
    }

    # I les formes per mostrar, que fan falta per escriure la llista de paraules
    # del dia. Nomes les del diccionari GLOBAL: les de l'apendix no poden ser
    # paraula del dia i, si una hi coincidis de forma normalitzada, ensenyaria
    # l'ortografia d'un dialecte a tots els altres.
    return tros_index, candidats, mostrar_de


# --- La paraula del dia, que es UNA per a tothom -----------------------------
#
# LA PARAULA DEL DIA NO POT SORTIR DE L'INDEX D'UN DIALECTE. Cada dialecte
# reparteix les paraules en claus de rima diferents, o sigui que triant sobre
# l'index de cadascu sortien quatre paraules diferents el mateix dia. Ara n'hi
# ha DUES al dia i prou (una per dificultat) i son les mateixes per a tothom,
# jugui en el dialecte que jugui; el que continua canviant amb el dialecte son
# les RIMES que valen, que es de que va el lloc.
#
# Per aixo fa falta una llista a part, que es la interseccio dels quatre
# dialectes: nomes hi entren les paraules que son objectiu d'una clau jugable a
# TOTS QUATRE. Es guarda al mateix index.json, al bloc "diaries".
#
# LES CLAUS DE LA LLISTA SON LES DEL CENTRAL, que fa de canonic. Fa falta un
# repartiment de referencia per poder dir "no es repeteix cap paraula fins que
# s'han fet servir totes les claus de rima" (vegeu ordreDelCicle a
# joc/js/objectius.js): el central es el dialecte de sempre i el que te la
# transcripcio repassada a ma.


def barreja_estable(text):
    """Un numero que depen nomes del text. Serveix per triar sempre les mateixes
    paraules sense haver de desar cap llista a ma."""
    return int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:12], 16)


def construir_diaries(candidats, mostrar_de, index, canonic):
    """El bloc "diaries" de l'index.json.

    Torna { paraules, claus, on } on:
      paraules  llista de formes ("cami>camí" si la forma real porta accents)
      claus     una entrada per clau canonica, amb els indexs de "paraules"
                que li toquen (fins a DIARIES_PER_CLAU)
      on        de cada dialecte, en quina posicio del seu "claus" es cada
                paraula. Es el que permet al joc trobar el grup i la seccio de
                la paraula del dia sense buscar-la enlloc.
    """
    dialectes = sorted(candidats)
    compartides = set(candidats[canonic])
    for codi in dialectes:
        compartides &= set(candidats[codi])

    per_clau = collections.defaultdict(list)
    for normalitzada in compartides:
        per_clau[candidats[canonic][normalitzada]].append(normalitzada)

    paraules = []
    claus = []
    on = {codi: [] for codi in dialectes}
    for posicio in sorted(per_clau):
        # De cada clau, DIARIES_PER_CLAU paraules i prou. Quines, ho decideix un
        # resum del text: sempre les mateixes, sense cap llista escrita a ma i
        # sense afavorir les que van primer per ordre alfabetic (que serien
        # totes les que comencen per "a").
        tries = sorted(per_clau[posicio], key=lambda p: (barreja_estable(p), p))
        tries = tries[:DIARIES_PER_CLAU]
        indexs = []
        for normalitzada in tries:
            mostrar = mostrar_de.get(normalitzada, normalitzada)
            cos = normalitzada if mostrar == normalitzada else f"{normalitzada}>{mostrar}"
            indexs.append(len(paraules))
            paraules.append(cos)
            for codi in dialectes:
                on[codi].append(candidats[codi][normalitzada])
        claus.append(indexs)

    return {"paraules": paraules, "claus": claus, "on": on}


# --- Proces -----------------------------------------------------------------


def main():
    demanats = sys.argv[1:]
    tots = camins.dialectes()
    if not tots:
        raise SystemExit("No hi ha cap dialecte a dialectes_col/.")
    codis = demanats or tots
    for codi in codis:
        if codi not in tots:
            raise SystemExit(f"El dialecte '{codi}' no es a dialectes_col/. Hi ha: "
                             f"{', '.join(tots)}")

    print("Llegint el diccionari...")
    base = preparar_diccionari()
    print(f"  {camins.mil(len(base['paraules']))} entrades")

    # L'apendix de cada dialecte: les paraules que nomes es diuen alla. Les
    # llegim un sol cop i les guardem, que les dues passades les necessiten.
    base["apendixs"].clear()
    for codi in codis:
        apendix = llegir_apendix(codi)
        if apendix:
            base["apendixs"][codi] = apendix
    if base["apendixs"]:
        quants = ", ".join(f"{codi} {camins.mil(len(a['paraules']))}"
                           for codi, a in sorted(base["apendixs"].items()))
        print(f"  apendixs: {quants}")
    else:
        print("  (cap dialecte no te apendix a dialectes_col/<codi>/apendix/)")

    # PRIMERA PASSADA: quantes rimes te cada paraula a cada dialecte. Fa falta
    # abans d'escriure res, perque la finestra de MIN_RIMES-MAX_RIMES s'ha de
    # complir ALS QUATRE dialectes i no nomes al que s'esta generant.
    print("Comptant les rimes de cada dialecte...")
    marges = {}
    for codi in codis:
        marges[codi] = marges_de_rima(codi, base)

    # Els que no es regeneren, del seu fitxer ja publicat. No es tan exacte
    # (vegeu marges_publicats) i per aixo despres es comprova si les marques que
    # tenen han quedat desactualitzades.
    antics = [codi for codi in tots if codi not in codis]
    marcades_abans = {}
    for codi in antics:
        publicat = marges_publicats(codi)
        if publicat is None:
            raise SystemExit(
                f"Per generar nomes {', '.join(codis)} cal saber quantes rimes "
                f"tenen les paraules en {codi}, i no hi ha cap dades/{codi}.txt "
                "d'on treure-ho. Passa el generador sense arguments un cop.")
        marges[codi], marcades_abans[codi] = publicat
        print(f"  {codi}: del fitxer publicat")

    qualificades = qualificar_objectius(marges)
    print(f"  {camins.mil(len(qualificades))} paraules es poden rimar als "
          f"{len(marges)} dialectes amb {MIN_RIMES}-{MAX_RIMES} rimes")
    if not qualificades:
        raise SystemExit(
            f"Cap paraula no te entre {MIN_RIMES} i {MAX_RIMES} rimes a tots "
            "els dialectes: amb aixo els modes normals no tindrien res a jugar.")
    del marges

    print(f"Generant {len(codis)} dialecte{'s' if len(codis) > 1 else ''}...")
    trossos = {}
    candidats = {}
    mostrar_de = {}
    for codi in codis:
        trossos[codi], candidats[codi], mostrar = generar_dialecte(
            codi, base, qualificades)
        mostrar_de.update(mostrar)

    # Si la passada es parcial, els dialectes que no s'han tocat poden haver-se
    # quedat amb les marques velles: la qualificacio depen dels quatre alhora, o
    # sigui que canviar-ne un les pot moure a tots. Es diu i prou; el que ho
    # arregla es una passada sencera.
    for codi in antics:
        arreu_ara = {p for p in marcades_abans[codi] if p in qualificades}
        canvien = len(marcades_abans[codi]) - len(arreu_ara)
        if canvien:
            # Sense caracters de fora de l'ASCII: la consola de Windows escriu
            # en cp1252 i un simbol d'avis hi peta amb un UnicodeEncodeError.
            print(f"  ATENCIO {codi}: {camins.mil(canvien)} paraules que te "
                  "marcades com a jugables ja no ho son. Passa el generador "
                  "sense arguments per refer-lo.")

    # L'index es un de sol per als quatre dialectes. Si nomes se n'ha regenerat
    # un, els altres s'han de quedar tal com estan: es llegeix el que hi ha i
    # nomes se'n substitueix el tros que toca.
    index_anterior = {}
    if os.path.exists(INDEX):
        try:
            with open(INDEX, encoding="utf-8") as fitxer:
                index_anterior = json.load(fitxer)
        except (ValueError, OSError):
            index_anterior = {}   # si ve romput, es refa sencer
    index = index_anterior.get("dialectes", {})
    index.update(trossos)

    # I si un dialecte ha desaparegut de dialectes_col/, fora de l'index i fora
    # el seu fitxer: si no, el versions.json continuaria oferint-lo a la tira.
    for codi in sorted(set(index) - set(tots)):
        print(f"  (fora {codi}: ja no es a dialectes_col/)")
        del index[codi]
        cami = os.path.join(DIR_DADES, f"{codi}.txt")
        if os.path.exists(cami):
            os.remove(cami)

    # Les restes del format vell, quan hi havia un fitxer per grup assonant.
    for codi in tots:
        vella = os.path.join(DIR_DADES, codi)
        if os.path.isdir(vella):
            print(f"  (fora {codi}/: era el format d'un fitxer per grup)")
            shutil.rmtree(vella)

    presents = ordre_de_tira(sorted(index))

    # La llista de paraules del dia es la interseccio dels QUATRE dialectes, o
    # sigui que nomes es pot refer quan s'han generat tots. En una passada
    # parcial es conserva la que ja hi havia i es diu, perque no quedi la
    # sensacio que s'ha actualitzat.
    diaries = index_anterior.get("diaries")
    if set(codis) >= set(presents):
        canonic = camins.CENTRAL if camins.CENTRAL in candidats else presents[0]
        diaries = construir_diaries(candidats, mostrar_de, index, canonic)
        print(f"paraules del dia: {len(diaries['paraules'])} paraules en "
              f"{len(diaries['claus'])} claus de rima (les de {canonic}), "
              f"valides als {len(presents)} dialectes")
    elif diaries:
        print("  (la llista de paraules del dia no s'ha refet: nomes es pot "
              "amb una passada de tots els dialectes)")
    else:
        raise SystemExit(
            "No hi ha llista de paraules del dia i aquesta passada no la pot "
            "fer. Passa el generador sense arguments un cop.")

    escriure_si_cal(INDEX, json.dumps(
        {"min_rimes": MIN_RIMES, "max_rimes": MAX_RIMES,
         "min_publicades": MIN_RIMES_PUBLICADES,
         "diaries": diaries,
         "dialectes": {codi: index[codi] for codi in presents}},
        ensure_ascii=False, separators=(",", ":")))

    escriure_finestra_js()
    escriure_versions(presents)

    fitxers = 3 + len(presents)
    print(f"Fet: {len(presents)} dialectes ({', '.join(presents)}) en {fitxers} fitxers.")


def escriure_finestra_js():
    """El joc/js/finestra.js: MIN_RIMES i MAX_RIMES per als moduls del joc que
    els necessiten abans que arribi l'index (els valors per defecte del
    personalitzat i del freestyle, que es llegeixen de seguida en arrencar).

    Es un modul i no un JSON perque un import de JSON no funciona a tots els
    navegadors. S'escriu a cada passada, igual que l'index: aixi tots dos
    surten sempre dels mateixos valors.
    """
    contingut = (
        "// El genera joc/eines/generar_dades.py a partir de MIN_RIMES i MAX_RIMES:\n"
        "// no el toquis a ma, que la propera passada el trepitjaria. La finestra\n"
        "// dels modes normals arriba per l'index.json (min_rimes, max_rimes); aqui\n"
        "// hi ha els mateixos valors per als que els necessiten abans que arribi.\n"
        f"export const MIN_RIMES = {MIN_RIMES};\n"
        f"export const MAX_RIMES = {MAX_RIMES};\n"
    )
    if escriure_si_cal(FINESTRA_JS, contingut):
        print(f"finestra.js: {MIN_RIMES}-{MAX_RIMES} rimes")


def escriure_versions(codis):
    """El versions.json del joc, germa de diccionaris/versions.json.

    Mateixa idea: la versio de cada fitxer es un resum del seu contingut, i el
    navegador la fa servir per saber si la copia que te encara val (vegeu
    carregarVersions a joc/js/dades.js). El fitxer que diu que hi ha versions no
    es pot cachejar mai; tota la resta, per sempre.

    Ara son cinc entrades: l'index i un fitxer per dialecte.
    """
    fitxers = {"index.json": resum(INDEX)}
    for codi in codis:
        fitxers[f"{codi}.txt"] = resum(os.path.join(DIR_DADES, f"{codi}.txt"))

    contingut = {
        "generat": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        # En l'ordre de la tira, no per ordre alfabetic: aquesta llista es la
        # que el joc pinta tal com li arriba (vegeu pintarTiraDialectes a
        # joc/js/ui.js).
        "dialectes": [
            {"codi": codi, "nom": NOMS_DE_DIALECTE.get(codi, codi)} for codi in codis
        ],
        "fitxers": fitxers,
    }
    with open(VERSIONS, "w", encoding="utf-8", newline="\n") as fitxer:
        json.dump(contingut, fitxer, ensure_ascii=False, indent=2)
        fitxer.write("\n")
    print(f"versions.json: {len(fitxers)} fitxers, dialectes {', '.join(codis)}")


if __name__ == "__main__":
    main()
