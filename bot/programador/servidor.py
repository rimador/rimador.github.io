"""El programador manual de tuits: serveix la pàgina i toca els publicades_*.json.

Ara cada lot és un sol dia: el tuit que revela la paraula del joc d'ahir i una
paraula nàufraga aleatòria. Es programen a mà a la web de X i només s'apunten a
publicades_*.json quan es confirma que ja estan programats.
"""

import hashlib
import json
import os
import random
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_BOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, DIR_BOT)

import generador_tuits as generador  # noqa: E402  (cal el sys.path de sobre)

PAGINA = os.path.join(BASE_DIR, 'programador.html')
PORT_PER_DEFECTE = 8765
# Quants ports es miren a partir del de per defecte, tant per veure si ja hi ha
# cap programador engegat com per buscar-ne un de lliure.
PORTS_A_MIRAR = 20

# Com es fa conèixer a la capçalera Server, amb l'empremta del codi al darrere:
# "ProgramadorDeTuits/6f2a1c9b04e7". Serveix per a dues coses alhora quan
# s'engega: saber si el que ja corre en un port és un dels nostres (i no pas
# qualsevol altre servidor de proves) i si duu el mateix codi que hi ha al disc
# o un de vell.
NOM_DEL_SERVIDOR = 'ProgramadorDeTuits'


def empremta_del_codi():
    """Un resum del codi que es carrega en engegar.

    Els DOS mòduls de Python i prou: el programador.html es torna a llegir a
    cada petició i canviar-lo no demana reengegar res. Es mira el contingut i
    no pas la data del fitxer perquè el Dropbox toca les dates sense que el
    codi hagi canviat, i llavors es reengegaria per no res.
    """
    resum = hashlib.sha256()

    for ruta in (os.path.abspath(__file__), os.path.abspath(generador.__file__)):
        try:
            with open(ruta, 'rb') as f:
                resum.update(f.read())
        except OSError:
            return ''

    return resum.hexdigest()[:12]


EMPREMTA = empremta_del_codi()

# Un pany per a les escriptures: el navegador pot engegar dues peticions
# alhora (dos clics seguits) i les dues llegeixen, afegeixen i desen el mateix
# fitxer. Sense això, la segona podria desar-se damunt de la primera i perdre
# una rima acabada d'apuntar.
PANY = threading.Lock()

FITXERS_PUBLICADES = {
    'joc': generador.FITXER_PUBLICADES_JOC,
    'naufragues': generador.FITXER_PUBLICADES_NAUFRAGUES,
}

# Cada dia es programen dos tuits: la paraula del joc d'ahir i una nàufraga.
TIPUS_PER_DIA = ('joc', 'naufragues')

# Quants en surten com a molt, del cercador. Prou per triar i prou pocs per
# llegir-los d'un cop d'ull.
MAXIM_RESULTATS = 12

# Menys de dues lletres no és una cerca: sortiria mig diccionari.
MINIM_A_CERCAR = 2


class Dades:
    """Les dades grosses, carregades un sol cop.

    El tuit del joc només necessita el dialecte de referència, perquè la paraula
    és comuna a tothom però la transcripció que s'ensenya al tuit ha de ser d'un
    dialecte concret. Les nàufragues sí que es carreguen de tots els dialectes,
    perquè el tuit random pot sortir de qualsevol llista.
    """

    def __init__(self):
        self.dialectes = generador.dialectes()
        self.dialecte_joc = (generador.DIALECTE_JOC_PER_DEFECTE
                             if generador.DIALECTE_JOC_PER_DEFECTE in self.dialectes
                             else self.dialectes[0] if self.dialectes else None)

        noms = ', '.join(generador.nom_dialecte(dialecte) for dialecte in self.dialectes)
        print(f'Aplegant les dades dels tuits ({noms})...')

        self.paraules_base = generador.carregar_paraules_del_diccionari()
        del_diccionari = len(self.paraules_base)

        self.paraules_joc = []
        self.noms_propis_joc = set()
        self.columna_rima_joc = []
        self.rimes_joc = {}
        if self.dialecte_joc:
            self.paraules_joc = generador.carregar_paraules(self.dialecte_joc, self.paraules_base)
            self.noms_propis_joc = generador.carregar_noms_propis(self.dialecte_joc,
                                                                  self.paraules_joc)
            self.columna_rima_joc = generador.carregar_columna_rima(self.dialecte_joc)
            self.rimes_joc = generador.carregar_rimes(self.dialecte_joc, self.paraules_joc,
                                                      self.columna_rima_joc)

        self.naufragues = {dialecte: generador.carregar_naufragues(dialecte)
                           for dialecte in self.dialectes}
        self.dialectes_de_naufraga = generador.dialectes_de_cada_naufraga(self.naufragues)

        if self.dialecte_joc:
            propies = len(self.paraules_joc) - del_diccionari
            print(f'  Joc: {generador.nom_dialecte(self.dialecte_joc)}, '
                  f'{len(self.rimes_joc)} rimes'
                  f'{f", {propies} paraules pròpies" if propies else ""}.')

        for dialecte in self.dialectes:
            diuen = generador.naufragues_disponibles(self.naufragues[dialecte], set())
            print(f'  {generador.nom_dialecte(dialecte)}: {len(diuen)} paraules nàufragues.')

        if not self.dialectes:
            print(f'AVÍS: no s\'ha trobat cap dialecte a {generador.DIR_DIALECTES}.')
        if not self.paraules_base:
            print(f'AVÍS: no s\'ha trobat {generador.FITXER_PARAULES}.')
        if self.dialecte_joc and not self.rimes_joc:
            print(f'AVÍS: no s\'han trobat les columnes de {generador.nom_dialecte(self.dialecte_joc)}:')
            print(f'      {generador.FITXER_PARAULES}')
            print(f'      {generador.fitxer_rimacons(self.dialecte_joc)}')
        for dialecte in self.dialectes:
            if not self.naufragues[dialecte]:
                print(f'AVÍS: no s\'ha trobat {generador.fitxer_naufragues(dialecte)}.')
                print('      El genera llistes/generar_naufragues.py.')


# El servidor l'omple a principal(): llegir mig diccionari no s'ha de fer
# només per importar el mòdul.
DADES = None


def publicades(tipus):
    return generador.carregar_json(FITXERS_PUBLICADES[tipus], [])


def estat():
    """Quantes nàufragues queden i quins tuits ja s'han dit."""
    pub_joc = publicades('joc')
    pub_naufragues = publicades('naufragues')
    dites = set(pub_naufragues)

    return {
        'empremta': EMPREMTA,
        'dialectes': [{'codi': dialecte, 'nom': generador.nom_dialecte(dialecte)}
                      for dialecte in DADES.dialectes],
        'tuits_per_lot': len(TIPUS_PER_DIA),
        'joc': {
            'publicades': pub_joc,
            'fitxer': os.path.relpath(FITXERS_PUBLICADES['joc'], os.path.dirname(DIR_BOT)),
            'dialecte': DADES.dialecte_joc,
            'dificultat': generador.DIFICULTAT_JOC_PER_DEFECTE,
        },
        'naufragues': {
            'publicades': pub_naufragues,
            'disponibles': {
                dialecte: len(generador.naufragues_disponibles(DADES.naufragues[dialecte], dites))
                for dialecte in DADES.dialectes
            },
            'fitxer': os.path.relpath(FITXERS_PUBLICADES['naufragues'], os.path.dirname(DIR_BOT)),
        },
    }


def tuit_de_joc(data_publicacio, data):
    """La targeta del tuit que revela la paraula del joc d'ahir."""
    if not DADES.dialecte_joc:
        return None

    data_joc = (data_publicacio - timedelta(days=1)).strftime('%Y-%m-%d')
    dificultat = generador.DIFICULTAT_JOC_PER_DEFECTE
    clau = generador.clau_de_joc(data_joc, dificultat, DADES.dialecte_joc)
    dades = generador.dades_tuit_joc_ahir(DADES.dialecte_joc, data_joc, dificultat,
                                          DADES.paraules_joc, DADES.columna_rima_joc,
                                          DADES.rimes_joc, DADES.noms_propis_joc)

    return {
        'tipus': 'joc',
        'dialecte': DADES.dialecte_joc,
        'nom_dialecte': generador.nom_dialecte(DADES.dialecte_joc),
        'clau': clau,
        'etiqueta': dades['paraula'],
        'detall': f"/{dades['rima']}/ · {generador.nom_dificultat(dificultat)}",
        'altres_exemples': dades['quantes_rimen'] > generador.EXEMPLES_PER_TUIT_JOC + 1,
        'data': data,
        'text': generador.tuit_joc_ahir(DADES.dialecte_joc, data_joc, dificultat,
                                        data, dades=dades),
    }


def tuit_de_naufraga(dialecte, paraula, data, items=None):
    """La targeta d'una nàufraga concreta, o None si en aquell dialecte no ho és.

    `items` són les entrades d'aquella paraula si qui ho crida ja les té a mà
    (el lot i el cercador les acaben de trobar); si no, es busquen.
    """
    if items is None:
        items = generador.naufragues_disponibles(DADES.naufragues.get(dialecte, []),
                                                 set()).get(paraula)
    if not items:
        return None

    item = random.choice(items)
    dialectes_naufraga = DADES.dialectes_de_naufraga.get(paraula, [dialecte])

    return {
        'tipus': 'naufragues',
        'dialecte': dialecte,
        'nom_dialecte': generador.nom_dialecte(dialecte),
        'clau': paraula,
        'etiqueta': paraula,
        'detall': f"/{item.get('rimacons')}/ · nàufraga en {len(dialectes_naufraga)}"
                  f" de {len(DADES.dialectes)} dialectes",
        'data': data,
        'text': generador.tuit_naufraga(item, dialecte, dialectes_naufraga,
                                        DADES.dialectes, data),
    }


def tuit_de_naufraga_random(data, fora, dialecte=None):
    """Una nàufraga random, mantenint el filtre de publicades i noms propis."""
    dialectes = [dialecte] if dialecte else list(DADES.dialectes)
    random.shuffle(dialectes)

    disponibles = []
    for candidat in dialectes:
        per_paraula = generador.naufragues_disponibles(DADES.naufragues[candidat], fora)
        if per_paraula:
            disponibles.append((candidat, per_paraula))

    if not disponibles:
        return None

    dialecte, per_paraula = random.choice(disponibles)
    paraula = random.choice(list(per_paraula))
    return tuit_de_naufraga(dialecte, paraula, data, per_paraula[paraula])


def generar(data_inici):
    """El lot d'un dia: joc d'ahir i nàufraga random. No toca cap fitxer."""
    try:
        dia = datetime.strptime(data_inici, '%Y-%m-%d')
    except (TypeError, ValueError):
        dia = datetime.now()

    data = generador.data_curta(dia)
    tuits = []

    tuit_joc = tuit_de_joc(dia, data)
    if tuit_joc and tuit_joc['clau'] not in set(publicades('joc')):
        tuits.append(tuit_joc)

    dites = set(publicades('naufragues'))
    tuit_naufraga = tuit_de_naufraga_random(data, dites)
    if tuit_naufraga:
        tuits.append(tuit_naufraga)

    return tuits


def un_tuit(tipus, dialecte, data, fora):
    if tipus == 'joc':
        return None
    return tuit_de_naufraga_random(data, fora, dialecte)


def fora_del_lot(tipus, dialecte, exclou):
    """El que no es pot dir: el ja publicat i el que ja és a la pantalla."""
    exclou = {clau for clau in (exclou or []) if isinstance(clau, str)}

    if tipus == 'joc':
        return set(publicades('joc')) | exclou

    return set(publicades('naufragues')) | exclou


def un_altre(tipus, dialecte, data, exclou):
    """Un tuit per canviar-ne un del lot: mateix tipus, dialecte i dia."""
    return un_tuit(tipus, dialecte, netejar_data(data), fora_del_lot(tipus, dialecte, exclou))


def triat(tipus, dialecte, clau, data):
    """El tuit que s'ha triat al cercador, per al dia que ocupava aquell lloc."""
    data = netejar_data(data)

    if tipus == 'joc':
        data_iso, dificultat, dialecte_clau = generador.parts_clau_de_joc(clau)
        return tuit_de_joc_data(data_iso, dificultat, dialecte_clau or dialecte, data)

    return tuit_de_naufraga(dialecte, clau, data)


def tuit_de_joc_data(data_iso, dificultat, dialecte, data):
    dades = generador.dades_tuit_joc_ahir(dialecte, data_iso, dificultat,
                                          DADES.paraules_joc, DADES.columna_rima_joc,
                                          DADES.rimes_joc, DADES.noms_propis_joc)
    return {
        'tipus': 'joc',
        'dialecte': dialecte,
        'nom_dialecte': generador.nom_dialecte(dialecte),
        'clau': generador.clau_de_joc(data_iso, dificultat, dialecte),
        'etiqueta': dades['paraula'],
        'detall': f"/{dades['rima']}/ · {generador.nom_dificultat(dificultat)}",
        'altres_exemples': dades['quantes_rimen'] > generador.EXEMPLES_PER_TUIT_JOC + 1,
        'data': data,
        'text': generador.tuit_joc_ahir(dialecte, data_iso, dificultat, data, dades=dades),
    }


def cercar(tipus, dialecte, text, exclou):
    """Quines nàufragues d'aquest dialecte casen amb una paraula."""
    if tipus == 'joc':
        return []

    cru = str(text or '').strip().lower()
    text = generador.aplanar(cru)
    if len(text) < MINIM_A_CERCAR:
        return []

    fora = fora_del_lot(tipus, dialecte, exclou)
    trobats = []
    per_paraula = generador.naufragues_disponibles(DADES.naufragues.get(dialecte, []), fora)

    for paraula, items in per_paraula.items():
        plana = generador.aplanar(paraula)
        if plana == text:
            pes = 0
        elif plana.startswith(text):
            pes = 1
        elif text in plana:
            pes = 2
        else:
            continue

        dialectes_naufraga = DADES.dialectes_de_naufraga.get(paraula, [dialecte])
        trobats.append((pes, paraula, {
            'clau': paraula,
            'etiqueta': paraula,
            'detall': f"/{items[0].get('rimacons')}/ · nàufraga en"
                      f" {len(dialectes_naufraga)} de {len(DADES.dialectes)} dialectes",
        }))

    trobats.sort(key=lambda trobat: (trobat[0], trobat[1]))
    millors = trobats[:MAXIM_RESULTATS]
    millors.sort(key=lambda trobat: (generador.aplanar(trobat[2]['etiqueta']), trobat[1]))

    return [resultat for _, _, resultat in millors]


def netejar_data(data):
    """La data que ve del navegador, ja escrita ("5/9/26"), tal com surt al tuit."""
    if not isinstance(data, str) or not data.strip():
        return generador.data_curta()
    return data.strip()[:16]


def marcar(tipus, clau, programat):
    """Apunta (o desapunta) un tuit al publicades_*.json corresponent."""
    fitxer = FITXERS_PUBLICADES[tipus]

    with PANY:
        llista = generador.carregar_json(fitxer, [])

        if programat and clau not in llista:
            llista.append(clau)
            generador.guardar_json(llista, fitxer)
            print(f'  ✓ {clau} apuntada a {os.path.basename(fitxer)} ({len(llista)} en total)')
        elif not programat and clau in llista:
            llista.remove(clau)
            generador.guardar_json(llista, fitxer)
            print(f'  ✗ {clau} tornada a treure de {os.path.basename(fitxer)} ({len(llista)} en total)')

    return estat()


class Mans(BaseHTTPRequestHandler):
    server_version = f'{NOM_DEL_SERVIDOR}/{EMPREMTA}'

    def do_GET(self):
        cami = self.path.split('?')[0]

        if cami in ('/', '/index.html', '/programador.html'):
            # Es llegeix a cada petició a posta: així es pot retocar l'HTML i
            # veure-ho amb un F5, sense reengegar el servidor (que vol dir
            # tornar a empassar-se les rimes dels quatre dialectes).
            try:
                with open(PAGINA, 'rb') as f:
                    cos = f.read()
            except FileNotFoundError:
                return self.respondre_error(404, f'No es troba {PAGINA}')
            return self.respondre(cos, 'text/html; charset=utf-8')

        if cami == '/api/estat':
            return self.respondre_json(estat())

        return self.respondre_error(404, 'Això aquí no hi és')

    def do_POST(self):
        cami = self.path.split('?')[0]

        try:
            llargada = int(self.headers.get('Content-Length') or 0)
            peticio = json.loads(self.rfile.read(llargada) or b'{}')
        except (ValueError, json.JSONDecodeError):
            return self.respondre_error(400, 'La petició no és un JSON vàlid')

        try:
            if cami == '/api/generar':
                return self.respondre_json({
                    'tuits': generar(peticio.get('data')),
                    'estat': estat(),
                })

            tipus = peticio.get('tipus')
            if tipus not in FITXERS_PUBLICADES:
                return self.respondre_error(400, f'Tipus desconegut: {tipus}')

            if cami in ('/api/un_altre', '/api/cercar', '/api/tria'):
                dialecte = peticio.get('dialecte')
                if dialecte not in DADES.dialectes:
                    return self.respondre_error(400, f'Dialecte desconegut: {dialecte}')

                if cami == '/api/cercar':
                    # Cercar no canvia res: no cal tornar l'estat.
                    return self.respondre_json({
                        'resultats': cercar(tipus, dialecte, peticio.get('text'),
                                            peticio.get('exclou')),
                    })

                if cami == '/api/tria':
                    clau = peticio.get('clau')
                    if not clau:
                        return self.respondre_error(400, 'Falta la clau del tuit triat')
                    return self.respondre_json({
                        'tuit': triat(tipus, dialecte, clau, peticio.get('data')),
                        'estat': estat(),
                    })

                return self.respondre_json({
                    'tuit': un_altre(tipus, dialecte, peticio.get('data'), peticio.get('exclou')),
                    'estat': estat(),
                })

            if cami in ('/api/programat', '/api/desfes'):
                clau = peticio.get('clau')
                if not clau:
                    return self.respondre_error(400, 'Falta la clau del tuit')
                return self.respondre_json(marcar(tipus, clau, cami == '/api/programat'))
        except Exception as e:  # que un error d'aquests no tombi el servidor
            print(f'ERROR a {cami}: {e}')
            return self.respondre_error(500, str(e))

        return self.respondre_error(404, 'Això aquí no hi és')

    def respondre(self, cos, tipus_contingut):
        self.send_response(200)
        self.send_header('Content-Type', tipus_contingut)
        self.send_header('Content-Length', str(len(cos)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(cos)

    def respondre_json(self, dades):
        self.respondre(json.dumps(dades, ensure_ascii=False).encode('utf-8'),
                       'application/json; charset=utf-8')

    def respondre_error(self, codi, missatge):
        cos = json.dumps({'error': missatge}, ensure_ascii=False).encode('utf-8')
        self.send_response(codi)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(cos)))
        self.end_headers()
        self.wfile.write(cos)

    def log_message(self, format, *args):
        pass  # el registre d'accessos només faria soroll: ja hi ha els avisos d'apuntar


def port_ocupat(port):
    with socket.socket() as s:
        s.settimeout(0.2)
        return s.connect_ex(('127.0.0.1', port)) == 0


def quin_programador(port):
    """Quina empremta de codi duu el programador que hi ha en aquest port.

    Es pregunta amb una petició de debò i no pas mirant si el port està ocupat
    i prou: hi pot haver qualsevol altre servidor de proves, i d'aquell sí que
    val la pena apartar-se en comptes de tocar-lo. Qui identifica el nostre és
    la capçalera Server, que és el server_version de la classe Mans.

    Torna None si allà no hi ha cap programador nostre, i '' si n'hi ha un de
    tan vell que encara no deia quin codi duia (els d'abans d'aquest canvi).
    Aquests darrers també compten com a vells, que és el que són.
    """
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/estat', timeout=0.5) as resposta:
            capçalera = resposta.headers.get('Server', '')
    except urllib.error.HTTPError as error:
        capçalera = error.headers.get('Server', '')
    except Exception:
        return None

    if not capçalera.startswith(NOM_DEL_SERVIDOR):
        return None

    return capçalera.split()[0].partition('/')[2]


def programadors_engegats(a_mes=None):
    """[(port, empremta)] dels programadors que ja corren.

    `a_mes` és el port que s'ha demanat a mà, per si cau fora dels que es
    miren: engegar-ne un damunt d'un altre no ha de petar amb un OSError.
    """
    ports = set(range(PORT_PER_DEFECTE, PORT_PER_DEFECTE + PORTS_A_MIRAR))
    if a_mes is not None:
        ports.add(a_mes)

    trobats = []
    for port in sorted(ports):
        if not port_ocupat(port):
            continue
        empremta = quin_programador(port)
        if empremta is not None:
            trobats.append((port, empremta))

    return trobats


def pid_del_port(port):
    """Quin procés escolta en aquest port, o None.

    El Python de sèrie no sap anar del port al procés i el psutil no és de
    sèrie; l'lsof hi és a qualsevol macOS.
    """
    try:
        sortida = subprocess.run(['lsof', '-nP', f'-iTCP:{port}', '-sTCP:LISTEN', '-t'],
                                 capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None

    pids = [int(linia) for linia in sortida.stdout.split() if linia.strip().isdigit()]

    return pids[0] if pids else None


def es_un_servidor_nostre(pid):
    """Que el procés que anem a matar sigui de debò un servidor.py.

    Entre preguntar al port i enviar el senyal hi ha una escletxa on aquell
    procés pot haver mort i un altre haver-li agafat el port. És barat de
    comprovar i el senyal no es pot desfer.
    """
    try:
        sortida = subprocess.run(['ps', '-o', 'command=', '-p', str(pid)],
                                 capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return False

    return 'servidor.py' in sortida.stdout


def esperar_que_deixi_el_port(port, segons):
    for _ in range(int(segons * 10)):
        if not port_ocupat(port):
            return True
        time.sleep(0.1)

    return not port_ocupat(port)


def aturar_programador(port):
    """Atura el programador que hi ha en aquest port. Diu si se n'ha sortit.

    No s'hi perd res, aturant-ne un: els publicades_*.json s'escriuen a
    l'instant a cada confirmació i el lot de la pantalla és al navegador.
    """
    pid = pid_del_port(port)
    if pid is None or pid == os.getpid() or not es_un_servidor_nostre(pid):
        return False

    for senyal, espera in ((signal.SIGTERM, 3), (signal.SIGKILL, 2)):
        try:
            os.kill(pid, senyal)
        except OSError:
            return not port_ocupat(port)
        if esperar_que_deixi_el_port(port, espera):
            return True

    return False


def port_lliure(preferit):
    """El primer port lliure a partir del que es vol."""
    for port in range(preferit, preferit + PORTS_A_MIRAR):
        if not port_ocupat(port):
            return port
    return preferit


def avisar_dels_engegats(ports, aturar_se):
    """Diu quins programadors amb AQUEST mateix codi ja corren.

    Els de codi vell no arriben fins aquí: aquells es tanquen (vegeu
    principal()). Els que queden duen el mateix que hi ha al disc, i engegar-ne
    un altre només serviria per tenir dos ports que diuen el mateix i no saber
    en quin ets.
    """
    quants = 'un programador de tuits engegat' if len(ports) == 1 \
             else f'{len(ports)} programadors de tuits engegats'
    print()
    print(f'  Ja hi ha {quants} amb aquest mateix codi:')
    for port in ports:
        print(f'    http://localhost:{port}/')
    print()

    if not aturar_se:
        return

    print('  Aquest no s\'engega: no hi guanyaries res. Obre l\'adreça de dalt.')
    print()
    print('  (Si el codi hagués canviat, aquest l\'hauria aturat i s\'hauria posat')
    print('  al seu lloc tot sol. Recorda que l\'HTML es rellegeix a cada F5 i')
    print('  que el lot que veus a la pantalla no es refà fins que no premis')
    print('  "Genera el lot".)')
    print()
    print('  Si el que has refet són les DADES (el diccionari, les columnes de')
    print('  rima, les nàufragues), el codi és el mateix i aquest no se n\'adona:')
    print('  el que corre les va carregar en engegar i les té d\'abans. Fes-lo fora:')
    print('    python3 bot/programador/servidor.py reengega')
    print()
    print('  Per aturar-los a mà: Ctrl+C a la seva finestra, o des d\'aquí:')
    print('    pkill -f servidor.py')
    print()
    print(f'  Si de debò en vols dos alhora, digues-li un port lliure:')
    print(f'    python3 bot/programador/servidor.py {PORT_PER_DEFECTE + PORTS_A_MIRAR}')
    print()


def apartar_els_vells(engegats, tots=False):
    """Tanca els programadors que duen codi d'abans. Diu si tot ha anat bé.

    És el que demana el sentit comú de treballar-hi: si has tocat el
    generador_tuits.py, el que corre des d'abans dona els tuits d'abans, i
    tenir-lo obert en un altre port només serveix per mirar la pantalla que no
    toca. Els que duen el MATEIX codi no es toquen, que no hi ha res a guanyar;
    amb `tots` (el «reengega») hi van també, que és l'única manera de fer que
    es rellegeixin unes dades refetes.
    """
    tot_be = True

    for port, empremta in engegats:
        si_mateix = empremta == EMPREMTA
        if si_mateix and not tots:
            continue

        if si_mateix:
            quin = 'aquest mateix codi'
        elif empremta:
            quin = f'el codi {empremta}'
        else:
            quin = 'codi d\'abans que es pogués saber quin'
        print(f'  Al port {port} hi ha un programador amb {quin}: l\'aturo.')

        if aturar_programador(port):
            print(f'    aturat.')
        else:
            tot_be = False
            print(f'    NO l\'he pogut aturar. Atura\'l tu i torna-ho a provar:')
            print(f'      pkill -f servidor.py')

    return tot_be


PARAULES_DE_REENGEGAR = ('reengega', '-r', '--reengega')


def llegir_arguments():
    """El port que es demana (o None) i si s'ha dit de reengegar.

    Reengegar és per quan el codi és el MATEIX i tot i així el que corre ja no
    serveix: les dades grosses (el diccionari, les columnes de rima, les
    nàufragues) es carreguen un sol cop en engegar i l'empremta no les mira,
    que llegir-les totes a cada arrencada per fer-ne el resum costaria més que
    no pas engegar. Si n'has refet cap, el que corre les té d'abans.
    """
    port = None
    reengegar = False

    for argument in sys.argv[1:]:
        if argument in PARAULES_DE_REENGEGAR:
            reengegar = True
        elif argument.isdigit():
            port = int(argument)
        else:
            print(f'No entenc l\'argument «{argument}».')
            print('  python3 bot/programador/servidor.py [port] [reengega]')
            sys.exit(2)

    return port, reengegar


def principal():
    global DADES

    # Mirar-ho ABANS de carregar les dades: adonar-se'n després seria fer
    # esperar sis segons per no engegar res.
    port_a_ma, reengegar = llegir_arguments()
    port_demanat = PORT_PER_DEFECTE if port_a_ma is None else port_a_ma
    ja_engegats = programadors_engegats(port_a_ma)

    # Primer, fora els que duen codi d'abans: aquests sí que sobren, i el port
    # que deixen lliure sol ser justament el que volem. Amb el reengega, fora
    # també els que duen aquest mateix codi.
    if not apartar_els_vells(ja_engegats, tots=reengegar):
        return

    # Els que queden duen el mateix codi que hi ha al disc (amb el reengega no
    # en queda cap: acaben de marxar tots).
    mateix_codi = [] if reengegar else \
        [port for port, empremta in ja_engegats if empremta == EMPREMTA]

    if mateix_codi:
        # Amb un port dit a mà, s'entén que ja se sap el que es fa i només
        # s'avisa; sense, val més aturar-se que no pas acumular-ne un altre. I
        # damunt d'un que ja corre no s'hi engega mai.
        aturar_se = port_a_ma is None or port_demanat in mateix_codi
        avisar_dels_engegats(mateix_codi, aturar_se)
        if aturar_se:
            return

    DADES = Dades()

    port = port_lliure(port_demanat)
    adreca = f'http://localhost:{port}/'

    # Només 127.0.0.1: això escriu al repositori i no ha de ser a l'abast de
    # ningú més de la xarxa.
    try:
        servidor = ThreadingHTTPServer(('127.0.0.1', port), Mans)
    except OSError as e:
        print(f'\n  No s\'ha pogut engegar al port {port}: {e}')
        print(f'  Prova-ho amb un altre: python3 bot/programador/servidor.py <port>\n')
        return

    print()
    if port != port_demanat:
        print(f'  El port {port_demanat} estava ocupat per una altra cosa.')
    print(f'  El programador de tuits és a {adreca}')
    print('  Per aturar-lo: Ctrl+C (i espera que digui "Apa, adeu").')
    print()

    threading.Timer(0.5, lambda: webbrowser.open(adreca)).start()

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\nApa, adeu.')
    finally:
        servidor.server_close()


if __name__ == '__main__':
    principal()
