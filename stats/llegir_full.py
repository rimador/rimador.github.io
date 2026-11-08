# Baixa un full de càlcul privat a través del seu Apps Script.
#
# Els fulls de les cerques i del joc no són públics: duen el que ha escrit la
# gent i qui ho ha escrit. stats.py i joc/eines/compilar_classificacio.py els
# demanen a l'Apps Script de cada full amb una clau que només saben dos llocs:
#
#   - GitHub:  Settings > Secrets and variables > Actions > CLAU_LECTURA_FULLS
#   - Google:  Configuració del projecte > Propietats de l'script > CLAU_LECTURA
#              (a tots dos Apps Script, amb el mateix valor)
#
# Per executar-ho al teu ordinador, posa-la a l'entorn abans:
#
#   export CLAU_LECTURA_FULLS='...'
#
# LA CLAU VA AL COS D'UN POST i no a l'adreça, perquè les adreces acaben als
# registres. I LA CONNEXIÓ COMPROVA EL CERTIFICAT, a posta: sense la comprovació,
# qui estigués enmig de la xarxa es podria quedar la clau.
#
# ELS REGISTRES DE GITHUB ACTIONS SÓN PÚBLICS en un repositori públic: els errors
# d'aquí no han d'ensenyar mai ni la clau ni cap fila del full.

import csv
import io
import os
import ssl
import urllib.parse
import urllib.request

NOM_CLAU = 'CLAU_LECTURA_FULLS'


def context_segur():
    """Connexió que comprova el certificat.

    El Python del Mac sovint no troba els certificats del sistema; si hi ha el
    paquet certifi, es fan servir els seus. L'alternativa no és mai desactivar
    la comprovació.
    """
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()
    return ssl.create_default_context(cafile=certifi.where())


def baixar_full(url_apps_script, columnes):
    """El text CSV del full. Es planta si no arriba un full amb aquestes columnes."""
    clau = os.environ.get(NOM_CLAU, '').strip()
    if not clau:
        raise RuntimeError(f"Falta la variable d'entorn {NOM_CLAU} (vegeu stats/llegir_full.py).")

    cos = urllib.parse.urlencode({'tipus': 'llegir', 'clau': clau}).encode('utf-8')
    peticio = urllib.request.Request(url_apps_script, data=cos, method='POST')
    with urllib.request.urlopen(peticio, context=context_segur(), timeout=180) as resposta:
        text = resposta.read().decode('utf-8')

    # Una clau dolenta o un script sense desplegar també responen 200: el que
    # delata l'error és que la primera línia no és la capçalera del full. Se
    # n'ensenya només aquesta línia, que és el motiu o els títols, mai una fila.
    primera = text.split('\n', 1)[0]
    capcalera = next(csv.reader(io.StringIO(primera)), [])
    falten = [nom for nom in columnes if nom not in capcalera]
    if falten:
        raise RuntimeError(f"L'Apps Script no ha tornat el full. Primera línia: {primera[:80]!r}")
    return text
