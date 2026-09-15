import json
import os
import random
import sys
import unicodedata
import urllib.parse
from datetime import date, datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_EINES_JOC = os.path.join(BASE_DIR, '..', 'joc', 'eines')
sys.path.insert(0, DIR_EINES_JOC)

import predictor  # noqa: E402  (cal el sys.path de sobre)

# Noves rutes per als fitxers del joc
FITXER_INDEX_JOC = os.path.join(BASE_DIR, '..', 'joc', 'dades', 'index.json')
FITXER_MANUALS_JOC = os.path.join(BASE_DIR, '..', 'joc', 'dades', 'diaries_manuals.json')


# La columna de paraules del diccionari, el tros que és igual per a tots els
# dialectes. Va fila per fila amb el trans_dicc de cadascun: la fila que fa 40
# de la col_0 és una paraula i la que fa 40 de la col_3 d'un dialecte és com
# rima allà. Les mateixes columnes que llegeix llistes/fonts.py.
FITXER_PARAULES = os.path.join(BASE_DIR, '..', 'diccionaris', 'separat', 'col_0.txt')
# La categoria gramatical, fila per fila i de la mateixa llargada: d'aquí surt
# quines formes són nom propi ("NPCSG00", "NPFSO00"...).
FITXER_CODIS = os.path.join(BASE_DIR, '..', 'diccionaris', 'separat', 'col_2.txt')
DIR_DIALECTES = os.path.join(BASE_DIR, '..', 'dialectes_col')
DIR_LLISTES = os.path.join(BASE_DIR, '..', 'llistes')

FITXER_PUBLICADES_NORMAL = os.path.join(BASE_DIR, 'publicades_normal.json')
FITXER_PUBLICADES_JOC = os.path.join(BASE_DIR, 'publicades_joc.json')
FITXER_PUBLICADES_NAUFRAGUES = os.path.join(BASE_DIR, 'publicades_naufragues.json')

PARAULES_PER_TUIT = 5
EXEMPLES_PER_TUIT_JOC = 3
DIALECTE_JOC_PER_DEFECTE = 'ca'
DIFICULTAT_JOC_PER_DEFECTE = 'dificil'
NOMS_DIFICULTATS = {
    'facil': 'fàcil',
    'dificil': 'difícil',
}

# Com es diu cada dialecte al tuit, i en quin ordre surten al lot. Els codis no
# es declaren enlloc —són les subcarpetes de dialectes_col/, vegeu dialectes(),
# la mateixa regla que a diccionaris/python/camins.py i a
# llistes/generar_naufragues.py—, però el NOM sí que s'ha d'escriure: són els
# mateixos de la tira de dialectes de js/components.js.
NOMS_DIALECTES = {
    'ca': 'central',
    'nw': 'nord-occidental',
    'va': 'valencià',
    'ba': 'balear',
}


def dialectes():
    """Els codis que hi ha ara, en l'ordre en què es diuen els tuits.

    Un dialecte nou és una carpeta a dialectes_col/ amb la seva rima a dins.
    Si encara no és a NOMS_DIALECTES surt igualment, al final i amb el codi per
    nom: val més un tuit amb un nom lleig que no pas un dialecte que el
    programador no sap que hi és.
    """
    if not os.path.isdir(DIR_DIALECTES):
        return []

    hi_ha = {nom for nom in os.listdir(DIR_DIALECTES)
             if os.path.isdir(os.path.join(DIR_DIALECTES, nom)) and not nom.startswith('.')}
    coneguts = [dialecte for dialecte in NOMS_DIALECTES if dialecte in hi_ha]

    return coneguts + sorted(hi_ha.difference(coneguts))


def nom_dialecte(dialecte):
    return NOMS_DIALECTES.get(dialecte, dialecte)


def fitxer_rimacons(dialecte):
    """La rima del diccionari sencer, dit en aquest dialecte."""
    return os.path.join(DIR_DIALECTES, dialecte, 'trans_dicc',
                        f'col_3_rimacons_{dialecte}.txt')


def dir_apendix(dialecte):
    return os.path.join(DIR_DIALECTES, dialecte, 'apendix')


def fitxer_apendix(dialecte, numero):
    """Una columna de les paraules pròpies d'un dialecte."""
    return os.path.join(dir_apendix(dialecte), f'col_{numero}_{dialecte}.txt')


def te_apendix(dialecte):
    """No tots en tenen: un dialecte nou és una carpeta amb la seva rima, i les
    paraules pròpies vindran després o no vindran mai."""
    return os.path.isdir(dir_apendix(dialecte))


def fitxer_naufragues(dialecte):
    return os.path.join(DIR_LLISTES, f'paraules_naufragues_{dialecte}.json')


def carregar_json(nom_fitxer, per_defecte):
    """El fitxer que no hi és, o que és buit o malmès, compta com a per_defecte.

    Els publicades_*.json comencen buits i el JSON no en sap res, d'un fitxer
    de zero bytes: sense aquest coixí, el primer tuit de tots petaria.
    """
    if not os.path.exists(nom_fitxer):
        return per_defecte

    with open(nom_fitxer, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.decoder.JSONDecodeError:
            return per_defecte


def guardar_json(dades, nom_fitxer):
    with open(nom_fitxer, 'w', encoding='utf-8') as f:
        json.dump(dades, f, indent=4, ensure_ascii=False)


def _llegir(ruta):
    """Una columna sencera, una entrada per fila. El fitxer que no hi és compta
    com a columna buida: un dialecte a mitges no ha de tombar el programador."""
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            return [linia.strip() for linia in f]
    except FileNotFoundError:
        return []


def carregar_paraules_del_diccionari():
    """La col_0 sencera: el tros de paraules que és igual a tots els dialectes.

    A part de carregar_paraules() a posta: aquest tros s'ha de llegir UN sol
    cop i passar-lo a les quatre crides. Així les quatre llistes de paraules
    comparteixen les mateixes cadenes en comptes de tenir-ne cadascuna una
    còpia, que és la diferència entre 90 MB i 240 MB de memòria.
    """
    return _llegir(FITXER_PARAULES)


def carregar_paraules(dialecte, base=None):
    """Les paraules d'un dialecte: les del diccionari i les seves.

    En aquest ordre i no en cap altre: la columna de rima es munta igual
    (carregar_columna_rima()) i les dues han d'anar fila per fila.
    """
    base = carregar_paraules_del_diccionari() if base is None else base
    if not te_apendix(dialecte):
        return list(base)
    return base + _llegir(fitxer_apendix(dialecte, 0))


def carregar_noms_propis(dialecte, paraules=None):
    """Les formes que en aquest dialecte NOMÉS surten com a nom propi.

    Als tuits els noms propis fan nosa: la gràcia és la paraula, i una rima on
    hi surten quatre pobles i un cognom no diu res a ningú. Els de les
    nàufragues es treuen per la categoria de la seva entrada
    (naufragues_disponibles()); els de les rimes, per aquest conjunt, que la
    llista de cada rima només duu la forma escrita.

    "Només": "Pau" és nom de persona i també la pau, i per tant no hi és. Es
    mira forma per forma perquè és el que es pot comparar amb la llista d'una
    rima; qui hi surt de debò són els 14.682 topònims, cognoms i marques que
    no volen dir res més.

    Va per dialecte perquè hi entren les seves paraules pròpies. Aquelles són
    totes formes verbals i no n'hi afegiran cap de nova, però sí que en poden
    TREURE: una forma que al diccionari només sortia com a nom propi i que a
    l'apendix hi és com a verb ja no ho és "només", i ha de poder sortir.
    """
    paraules = carregar_paraules(dialecte) if paraules is None else paraules
    codis = _llegir(FITXER_CODIS)
    if te_apendix(dialecte):
        codis += _llegir(fitxer_apendix(dialecte, 2))
    if not codis:
        return set()

    amb_np = set()
    sense_np = set()
    for paraula, codi in zip(paraules, codis):
        (amb_np if codi.startswith('NP') else sense_np).add(paraula)

    return amb_np - sense_np


def es_nom_propi(item):
    """Si una entrada de les nàufragues és un nom propi, per la seva categoria."""
    return str(item.get('codi') or '').startswith('NP')


def carregar_columna_rima(dialecte):
    """La columna de rima sencera, una entrada per fila i amb les cadenes compartides.

    Les 620.000 files només tenen 10.000 rimes diferents; guardant-ne la
    mateixa cadena, la columna són cinc megues de punters i no pas quaranta de
    text repetit. Serveix per anar de la fila d'una paraula a la seva rima, que
    és el que necessita el cercador: la taula de carregar_rimes() va a l'inrevés.

    Primer la del diccionari i després la de l'apendix, en el mateix ordre que
    carregar_paraules(): van fila per fila i si no anessin igual, cada paraula
    duria la rima d'una altra. I les cadenes se segueixen compartint entre les
    dues meitats, que és el que fa que una forma de l'apendix i una del
    diccionari puguin resultar la MATEIXA clau de rima i per tant rimar entre
    elles.
    """
    unica = {}
    columna = []

    for ruta in (fitxer_rimacons(dialecte),
                 fitxer_apendix(dialecte, 3) if te_apendix(dialecte) else None):
        if ruta is None:
            continue
        try:
            with open(ruta, 'r', encoding='utf-8') as f:
                for linia in f:
                    rima = linia.strip()
                    columna.append(unica.setdefault(rima, rima))
        except FileNotFoundError:
            return []

    return columna


def carregar_rimes(dialecte, paraules=None, columna=None):
    """{rima: [totes les paraules que hi rimen]} d'UN dialecte.

    Abans això era un fitxer fet i comitejat, bot/resultat_ordenat_cons.json,
    de 17 MB, que generava bot/generador_rimes_cons.py des d'aquestes mateixes
    dues columnes. Se n'havia de pujar una còpia sencera a cada canvi del
    diccionari (30 versions a la història del repositori) i, com que la seva
    generació estava aturada, podia dir una cosa diferent del diccionari que
    serveix el lloc. Fer-ho aquí costa mig segon per dialecte, i no pot quedar
    endarrerit.

    Sí que es guarda totes les paraules de cada rima: en necessita quatre a
    l'atzar i no en sap quines fins que tria la rima. Si un dia es publica el
    diccionari amb les formes amb pronom (quatre milions de files en comptes de
    620.000), això s'haurà de repensar; vegeu l'avís de
    rimes_amb_una_sola_paraula() a llistes/generar_naufragues.py, que ja el va
    haver de tenir en compte.
    """
    paraules = carregar_paraules(dialecte) if paraules is None else paraules
    columna = carregar_columna_rima(dialecte) if columna is None else columna
    rimes = {}

    # El zip() fa que, si per un error una columna fos més llarga que l'altra,
    # les files de més no es miressin.
    for paraula, rima in zip(paraules, columna):
        if rima:
            rimes.setdefault(rima, []).append(paraula)

    return rimes


def carregar_naufragues(dialecte):
    """Les nàufragues d'un dialecte, tal com les deixa llistes/generar_naufragues.py."""
    return carregar_json(fitxer_naufragues(dialecte), [])


def dialectes_de_cada_naufraga(naufragues_per_dialecte):
    """{paraula: [dialectes on és nàufraga]}, que és el que diu el tuit.

    Ser nàufraga depèn de com es parli: qui no rima amb ningú en central pot
    rimar amb algú en valencià, on la a i la e àtones finals no es confonen.
    De 5.125 nàufragues, 3.509 ho són als quatre dialectes i 363 en un de sol.

    La paraula sola ja identifica la nàufraga: dins d'un dialecte cada paraula
    té una sola rima i cada rima nàufraga una sola paraula (per definició, que
    per això és nàufraga), i les entrades repetides són homògrafes —la mateixa
    forma amb una categoria gramatical diferent.

    L'ordre de les llistes de sortida és el de naufragues_per_dialecte, que ve
    de dialectes(): al tuit, el central va primer.
    """
    index = {}

    for dialecte, items in naufragues_per_dialecte.items():
        for item in items:
            paraula = item.get('paraula')
            if paraula and dialecte not in index.setdefault(paraula, []):
                index[paraula].append(dialecte)

    return index


def data_curta(moment=None):
    """La data tal com surt al tuit: 5/9/26, sense zeros al davant."""
    moment = moment or datetime.now()
    return f"{moment.day}/{moment.month}/{moment.strftime('%y')}"


def clau_de_rima(dialecte, rima):
    """La clau que es desa a publicades_normal.json: 'ca:ana'.

    Amb el dialecte al davant a posta: /ana/ en central i /ana/ en valencià no
    són la mateixa rima —cada dialecte té la seva columna i hi poden rimar
    paraules diferents—, i dir-ne una no ha de cremar l'altra.

    Les nàufragues, en canvi, es desen per la paraula i prou: allà sí que dir-la
    en un dialecte la crema a tots, perquè el tuit ja diu on és nàufraga.
    """
    return f'{dialecte}:{rima}'


def rima_de_clau(clau):
    """La rima sola, sense el dialecte del davant: 'ca:ana' -> 'ana'."""
    return clau.partition(':')[2]


def rimes_publicades(publicades, dialecte):
    """Les rimes de publicades_normal.json que són d'aquest dialecte."""
    prefix = f'{dialecte}:'
    return {clau[len(prefix):] for clau in publicades if clau.startswith(prefix)}


def rimes_de_naufragues(dades_naufragues):
    """Les rimes que ja té el tuit de nàufraga i que el de la rima no ha de tocar."""
    return {item.get('rimacons') for item in dades_naufragues if item.get('rimacons')}


def rimes_disponibles(dades_rimes, fora):
    """Les rimes d'un dialecte que encara es poden dir."""
    return [rima for rima in dades_rimes if rima not in fora]


def naufragues_disponibles(dades_naufragues, fora):
    """Les nàufragues d'un dialecte que encara es poden dir, agrupades per paraula.

    Sense noms propis: dels 4.049 mots nàufrags del central, 862 són topònims i
    cognoms i no surten mai (vegeu carregar_noms_propis()). Es miren per la
    categoria de l'entrada i no pas pel conjunt de formes perquè aquí sí que la
    tenim; i cap nàufraga no barreja les dues coses —cap forma no és nom propi
    en una entrada i nom comú en una altra.

    Agrupades i no pas una llista d'entrades perquè triar-ne una a l'atzar surti
    igual de probable per a cada PARAULA: les homògrafes ("boga" el peix i
    "boga" del verb bogar) hi són una vegada per categoria gramatical, i sobre
    la llista sencera pesarien el doble. Un cop triada la paraula, quina de les
    entrades es fa servir torna a ser a l'atzar: canvia el lema, i per tant
    l'enllaç al diccionari.
    """
    per_paraula = {}

    for item in dades_naufragues:
        paraula = item.get('paraula')
        if paraula and paraula not in fora and not es_nom_propi(item):
            per_paraula.setdefault(paraula, []).append(item)

    return per_paraula


# Com es compara al cercador: qui escriu "porfir" ha de trobar "pòrfir", i qui
# escriu "agalloc", "agàl·loc". Una sola taula que ja fa les minúscules també,
# perquè aplanar una paraula sigui UNA crida i no pas dues: el cercador ha de
# passar per les 620.000 paraules del dialecte a cada tecla i cada crida que
# s'hi estalvia són set dècimes de segon. Per això tampoc no es normalitza a
# NFD, que va a la meitat.
#
# Les majúscules que fa són les de l'alfabet llatí i prou; d'un diccionari
# català, el que en queda fora són quatre noms propis grecs o russos, i com a
# molt vol dir que "Ω" no casa amb "ω".
SENSE_ACCENTS = {}
for _lletra in 'àáâäèéêëìíîïòóôöùúûüçñ':
    _base = unicodedata.normalize('NFD', _lletra)[0]
    SENSE_ACCENTS[ord(_lletra)] = _base
    SENSE_ACCENTS[ord(_lletra.upper())] = _base
for _lletra in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
    SENSE_ACCENTS[ord(_lletra)] = _lletra.lower()
SENSE_ACCENTS.update({ord(_signe): None for _signe in "·-'’"})
del _lletra, _base   # (el _signe és de la comprensió i ja no hi és)


def aplanar(text):
    """El text tal com es compara al cercador: en minúscules i sense accents."""
    return str(text or '').translate(SENSE_ACCENTS)


def aplanar_paraules(paraules):
    """Les mateixes paraules, ja aplanades, fila per fila.

    Es fa un cop en engegar perquè el cercador ha de passar per les 620.000 a
    cada tecla: aplanant-les allà, cada cerca costa un segon; tenint-les fetes,
    una dècima. Val la pena la memòria.

    I no en són quaranta megues, de memòria, sinó cinc: la majoria de paraules
    no duen accent ni majúscula, i d'aquestes es torna a guardar la MATEIXA
    cadena en comptes d'una còpia que diria el mateix. El diccionari de la
    feina no es queda: només hi és per no aplanar dues vegades les formes
    repetides (620.000 files, 529.000 formes diferents).
    """
    fetes = {}
    planes = []

    for paraula in paraules:
        plana = fetes.get(paraula)
        if plana is None:
            plana = paraula.translate(SENSE_ACCENTS)
            if plana == paraula:
                plana = paraula
            fetes[paraula] = plana
        planes.append(plana)

    return planes


def enumerar(noms):
    """['central', 'valencià', 'balear'] -> 'central, valencià i balear'."""
    if len(noms) < 2:
        return ''.join(noms)
    return ', '.join(noms[:-1]) + ' i ' + noms[-1]


def frase_de_dialectes(dialecte, dialectes_naufraga, tots):
    """La línia del tuit que diu en quins dialectes la paraula és nàufraga.

    Va comptada al caràcter, que el tuit de les nàufragues acaba a 270 dels 280
    i qualsevol paraula d'aquestes fa de mal encabir (hi ha dos enllaços, i a X
    cada enllaç compta 23 caràcters per curt que sigui). Per això:

    - quan ho és a tot arreu no es fa la llista, que és el cas de dues de cada
      tres i la llista sencera fa el doble de llarga;
    - i quan no, només es diuen els ALTRES: el dialecte de qui la diu ja surt a
      la primera ratlla, al costat de la rima.
    """
    if len(dialectes_naufraga) == len(tots) > 1:
        return 'És Nàufraga en tots els dialectes.'

    altres = [nom_dialecte(altre) for altre in dialectes_naufraga if altre != dialecte]

    if not altres:
        return f'Només és nàufraga en {nom_dialecte(dialecte)}.'

    return f'També és nàufraga en {enumerar(altres)}.'


def quantes_hi_rimen(paraules):
    """Quantes paraules hi rimen: les repetides, una sola vegada.

    La llista d'una rima ve del diccionari sencer i hi surt una entrada per
    forma, o sigui que "abacallaneu" hi és tres vegades (tres formes verbals
    que s'escriuen igual). Al tuit hi compta una. Compte que això NO és la
    freqüència que ensenya el lloc, que sí que compta les entrades.
    """
    return len(set(paraules))


def triar_paraules_de_rima(paraules, quantes, noms_propis=(), excloses=()):
    """Tria exemples d'una rima amb el mateix criteri que els tuits antics.

    Primer paraules comunes i, si no n'hi ha prou, noms propis. Les repeticions
    del diccionari compten una sola vegada i la paraula objectiu es pot excloure
    perquè no surti com a exemple de si mateixa.
    """
    excloses = set(excloses or ())
    distintes = sorted(set(paraules).difference(excloses))
    quantes = min(quantes, len(distintes))
    normals = [paraula for paraula in distintes if paraula not in noms_propis]

    if len(normals) >= quantes:
        return sorted(random.sample(normals, quantes))

    propis = [paraula for paraula in distintes if paraula in noms_propis]
    return sorted(normals + random.sample(propis, quantes - len(normals)))


def paraules_del_tuit(paraules, noms_propis=()):
    """Les que surten a la llista del tuit antic de rima: cinc exemples."""
    return triar_paraules_de_rima(paraules, PARAULES_PER_TUIT, noms_propis)


# L'adreça del lloc amb el dialecte a dins, que és com han d'anar TOTS els
# enllaços dels tuits.
#
# Sense el ?d=, qui obre l'enllaç hi entra amb el dialecte que ell tingui desat
# (vegeu dialecteInicial a js/script.js), que no té per què ser el del tuit: la
# rima que acaba de llegir pot no existir on cau, i la llista de nàufragues és
# una altra a cada dialecte (vegeu llistes/generar_naufragues.py), de manera
# que la paraula del tuit pot no sortir-hi. És el mateix ?d= que el botó de
# compartir del cercador posa als seus dos enllaços (actualitzarBotoCompartir).
#
# I no costa cap caràcter: a X cada enllaç en compta 23 per llarg que sigui,
# que és el que fa el compta() del programador.html.
def enllac(cami, dialecte):
    if dialecte == '':
        return f'https://rimador.cat/{cami}'
    else:
        return f'https://rimador.cat/{cami}?d={dialecte}'


def tuit_naufraga(item, dialecte, dialectes_naufraga, tots, data=None):
    """El tuit de la paraula que no rima amb res.

    La rima que ensenya és la del dialecte que la diu, i per això hi va el nom
    al costat: la mateixa paraula rima diferent a cada banda (3.492 de les
    4.762 nàufragues multidialectals canvien de rima d'un dialecte a l'altre),
    i una rima sola no voldria dir res. On MÉS és nàufraga ho diu la línia de
    frase_de_dialectes().

    Les dues frases del mig són més curtes que abans ("per això és una paraula
    nàufraga" i el segon "del diccionari" van caure) perquè hi cabés la dels
    dialectes: amb les d'abans, quatre de cada cinc tuits passaven de 280. Ara
    el més llarg de tots fa 270 i els diu tots, i el que en sobrava ja ho diu
    la primera ratlla, que comença per "Paraula nàufraga del dia".

    La branca dels noms propis no la fa servir el programador —de nàufragues,
    naufragues_disponibles() no n'hi deixa arribar cap—, però es queda: és la
    mateixa comprovació que tria a quin diccionari va l'enllaç (Viquipèdia per
    als noms propis, Viccionari per a la resta), i qui cridi això amb una
    entrada qualsevol ha de continuar tenint un tuit que digui la veritat.
    """
    paraula_escollida = item.get("paraula")
    rima_escollida = item.get("rimacons")
    lema = item.get("infinitiu")
    codi = item.get("codi")
    es_diec = item.get("diec") == "Diec"
    es_VIQ = item.get("viq") == "Viq"
    es_VICC = item.get("vicc") == "Vicc"

    tuit = (f"Paraula nàufraga del dia ({data or data_curta()}): {paraula_escollida}, "
            f"/{rima_escollida}/ en {nom_dialecte(dialecte)}.\n\n")
    if codi.startswith("NP"):
        tuit += "Aquest nom propi no rima amb cap altra paraula del diccionari. "
    else:
        tuit += "Aquesta paraula no rima amb cap altra paraula del diccionari. "

    tuit += frase_de_dialectes(dialecte, dialectes_naufraga, tots) + "\n\n"

    tuit += ("Consulta la llista: "
             + enllac('llistes/llista_naufragues.html', dialecte))

    paraula_url = urllib.parse.quote(lema)

    tuit += "\n\n"
    if es_diec:
        tuit += f"📖 DIEC: https://dlc.iec.cat/Results?DecEntradaText={paraula_url}\n"

    else:
        if codi.startswith("NP"):
            if es_VIQ:
                tuit += f"📖 Viquipèdia: https://ca.wikipedia.org/wiki/{paraula_url}\n"
            else:
                tuit += f"📖 Viccionari: https://ca.wiktionary.org/wiki/{paraula_url}\n"
        else:
            if es_VICC:
                tuit += f"📖 Viccionari: https://ca.wiktionary.org/wiki/{paraula_url}\n"
            else:
                tuit += f"📖 Viquipèdia: https://ca.wikipedia.org/wiki/{paraula_url}\n"

    return tuit

def nom_dificultat(dificultat):
    return NOMS_DIFICULTATS.get(dificultat, dificultat)


def clau_de_joc(data_iso, dificultat=DIFICULTAT_JOC_PER_DEFECTE,
                dialecte=DIALECTE_JOC_PER_DEFECTE):
    """La clau que es desa a publicades_joc.json: '2026-09-12:dificil:ca'."""
    return f'{data_iso}:{dificultat}:{dialecte}'


def parts_clau_de_joc(clau):
    data_iso, _, resta = str(clau or '').partition(':')
    dificultat, _, dialecte = resta.partition(':')
    return data_iso, dificultat or DIFICULTAT_JOC_PER_DEFECTE, dialecte or DIALECTE_JOC_PER_DEFECTE


def paraula_del_joc(data_iso, dificultat=DIFICULTAT_JOC_PER_DEFECTE):
    """La paraula del dia del joc, calculada amb la mateixa roda que el JS."""
    index_json = carregar_json(FITXER_INDEX_JOC, {'diaries': {'claus': [], 'paraules': []}})
    manuals_json = carregar_json(FITXER_MANUALS_JOC, {})

    paraules = predictor.predir_paraula_del_dia(index_json, data_iso, manuals=manuals_json)
    paraula = paraules.get(dificultat)
    if not paraula:
        raise ValueError(f"No s'ha pogut predir la paraula del joc del {data_iso}")
    return paraula


def posicio_de_paraula(paraula, paraules):
    """On cau una paraula dins la columna del diccionari d'un dialecte."""
    try:
        return paraules.index(paraula)
    except ValueError:
        buscada = aplanar(paraula)
        for i, candidata in enumerate(paraules):
            if aplanar(candidata) == buscada:
                return i
    return None


def dades_tuit_joc_ahir(dialecte=DIALECTE_JOC_PER_DEFECTE, data_iso=None,
                         dificultat=DIFICULTAT_JOC_PER_DEFECTE, paraules=None,
                         columna=None, rimes=None, noms_propis=()):
    """Les peces del tuit de la paraula del joc d'ahir.

    `data_iso` és el dia que es revela, no pas el dia de publicació del tuit. Si
    no es passa, es calcula amb el dia d'ahir del rellotge del servidor.
    """
    data_iso = data_iso or (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
    paraula_joc = paraula_del_joc(data_iso, dificultat)

    paraules = carregar_paraules(dialecte) if paraules is None else paraules
    columna = carregar_columna_rima(dialecte) if columna is None else columna
    posicio = posicio_de_paraula(paraula_joc, paraules)
    rima_joc = columna[posicio] if posicio is not None and posicio < len(columna) else None

    rimes = carregar_rimes(dialecte, paraules, columna) if rimes is None else rimes
    paraules_que_rimen = rimes.get(rima_joc, []) if rima_joc else []
    exemples = triar_paraules_de_rima(paraules_que_rimen, EXEMPLES_PER_TUIT_JOC,
                                      noms_propis, excloses={paraula_joc})

    return {
        'data_joc': data_iso,
        'dificultat': dificultat,
        'paraula': paraula_joc,
        'rima': rima_joc,
        'exemples': exemples,
        'quantes_rimen': quantes_hi_rimen(paraules_que_rimen),
    }


def tuit_joc_ahir(dialecte=DIALECTE_JOC_PER_DEFECTE, data_iso=None,
                  dificultat=DIFICULTAT_JOC_PER_DEFECTE, data=None,
                  paraules=None, columna=None, rimes=None, noms_propis=(), dades=None):
    """El tuit de la paraula del joc d'ahir, amb rima fonètica i 3 exemples."""
    dades = dades or dades_tuit_joc_ahir(dialecte, data_iso, dificultat, paraules,
                                         columna, rimes, noms_propis)
    paraula_joc = dades['paraula']
    rima_joc = dades['rima']
    exemples = dades['exemples']
    dificultat = dades['dificultat']

    # Forcem que s'imprimeixi la data del joc (ahir) en format curt
    try:
        dia_joc = datetime.strptime(dades['data_joc'], '%Y-%m-%d')
        data_ahir_curta = data_curta(dia_joc)
    except (TypeError, ValueError):
        data_ahir_curta = data or data_curta()

    tuit = (f"La paraula del joc d'ahir ({data_ahir_curta}) en mode {nom_dificultat(dificultat)} (rima consonant) era "
            f"«{paraula_joc}», /{rima_joc}/ en {nom_dialecte(dialecte)}.\n\n")
    if rima_joc:
        if exemples:
            tuit += 'Hi rimen, per exemple:\n'
            for exemple in exemples:
                tuit += f"- {exemple}\n"

   # tuit += f"\nTroba totes les altres rimes aquí: {enllac(f'?q={paraula_joc}&', dialecte)}"
    tuit += f"\nIntenta-ho amb la paraula d'avui i sigues qui en troba més! {enllac('joc', '')}"
    return tuit