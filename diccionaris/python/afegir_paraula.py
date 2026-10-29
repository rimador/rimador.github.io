"""
EINA LOCAL. Donar d'alta paraules al diccionari, als dos fitxers alhora.

    python3 diccionaris/python/afegir_paraula.py

Engega un servidor i obre la pàgina al navegador. No
porta arguments (--port i --sense-navegador si cal). Ctrl+C per aturar-lo.

ÉS PER AL DICCIONARI, o sigui per a una paraula que es diu a TOTS els
dialectes: entra a diccionari.5.2.3.txt i a col_10.txt, i et demana com sona a
cadascun. Una paraula que només es digui en un lloc no va aquí sinó a l'apendix
d'aquell dialecte (dialectes_col/<codi>/apendix/), que és una llista de
paraules a part i té la seva pròpia col_10.

DUES MANERES, que es trien a la pàgina:

    una paraula   un formulari amb la paraula, el lema, el codi, les síl·labes,
                  els enllaços i la transcripció de cada dialecte
    diverses      des d'arxius: un amb les files del diccionari, una per línia
                  (paraula$lema$codi$síl·labes$Vicc$Viq$Diec), i un per dialecte
                  amb la transcripció de cadascuna a la mateixa línia

Una paraula nova ha d'entrar al diccionari (paraula, lema, codi, síl·labes i
els tres enllaços) i a la col_10 (com sona a cada dialecte) A LA MATEIXA FILA i
al mateix commit. Fer-ho a mà vol dir encertar la mateixa posició en dos fitxers
de sis-centes mil línies, un dels quals fa 76 MB; per això hi ha aquesta eina.

No corre mai als workflows: allà, si els dos fitxers no es corresponen, el
sincronitzar.py s'atura i diu quina paraula falta i on.

QUÈ NO FA. Ni commit ni push. Abans d'engegar-la, un git pull; quan acabes,
comitejes el diccionari i la col_10 junts: el workflow s'espera trobar-los
d'acord.

LA POSICIÓ. El diccionari està ordenat alfabèticament ignorant accents,
majúscules, guions i punts volats, però no del tot (423 llocs de 619.783 no hi
quadren, quasi tots per la puntuació). Per això, d'una en una, la fila es
proposa i s'ensenya amb els veïns perquè la miris, i sempre la pots dir tu. Les
dels arxius van cadascuna on li toca per ordre alfabètic.

COM DESA. Els dos fitxers es llegeixen sencers en engegar i a cada alta es
reescriuen sencers, primer a fitxers temporals i després reemplaçant els
originals, perquè un Ctrl+C a mitges no els deixi tallats. Abans de desar es
mira si algú els ha tocat per fora (el git, un editor, el
corregir_transcripcions.py): si és així es tornen a llegir, i si les files del
voltant ja no són les que tenies a la pantalla no es desa res i et diu que hi
tornis a mirar.

Les transcripcions es comproven amb l'INVENTARI del columnes.py, com al
corregir_transcripcions.py: un símbol que no hi sigui, la rima assonant se'l
menjaria.
"""

import argparse
import json
import os
import sys
import threading
import unicodedata
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DIR_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if DIR_SCRIPTS not in sys.path:
    sys.path.insert(0, DIR_SCRIPTS)

import avisos
import camins
import col_10 as modul_col_10
from columnes import ACCENT, INVENTARI, VOCALS

PAGINA = os.path.join(DIR_SCRIPTS, "afegir_paraula.html")
# Un més que el corregir_transcripcions.py, per poder tenir-los oberts tots dos.
PORT = 8773
# Quantes files s'ensenyen a cada banda de la nova.
VEINS = 2
# De les dels arxius, quantes se n'ensenyen abans d'afegir-les.
MAX_VISTA = 200
# I quants errors se'n diuen: si n'hi ha més, segur que l'arxiu no és el que toca.
MAX_ERRORS = 30
ENLLACOS = ("Vicc", "Viq", "Diec")
# Els mateixos que al corregir_transcripcions.py.
NOMS_DIALECTES = {"ca": "central", "nw": "nord-occidental", "va": "valencià", "ba": "balear"}


def clau_dordre(paraula):
    text = paraula.strip().lower()
    for tros in ("·", "'", "’", "-", " "):
        text = text.replace(tros, "")
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def on_va(paraules, paraula):
    """La primera fila que ja no va abans que la paraula nova."""
    clau = clau_dordre(paraula)
    esquerra, dreta = 0, len(paraules)
    while esquerra < dreta:
        mig = (esquerra + dreta) // 2
        if clau_dordre(paraules[mig]) < clau:
            esquerra = mig + 1
        else:
            dreta = mig
    return esquerra


# --- Com un model -------------------------------------------------------------
#
# Per donar d'alta una família sencera (demoscòpic, demoscòpica, demoscòpics,
# demoscòpiques) n'hi ha prou amb el lema nou i una paraula que ja hi sigui i
# que es flexioni igual (microscòpic). De cada forma del model se'n treu una
# regla, "treu n lletres del final i posa-hi aquestes", tant per a com
# s'escriu com per a com sona a cada dialecte, i s'aplica al lema nou:
#
#     microscòpic    -> microscòpiques   treu "c", posa "ques"
#     demoscòpic     -> demoscòpiques
#     mikɾuskˈɔpik   -> mikɾuskˈɔpikəs   treu "", posa "əs"
#     dəmuskˈɔpik    -> dəmuskˈɔpikəs
#
# On falla és quan la forma mou l'accent a l'arrel (cantar -> canta: kəntˈa ->
# kˈantə), perquè llavors la regla s'endú la vocal de l'arrel del model. Aquestes
# formes es marquen per revisar-les: són les que la regla toca la síl·laba
# tònica del lema o més enrere.

# Quants models es proposen.
MAX_MODELS = 8


def regla(base, forma):
    """(quantes en treu del final, què hi posa) per anar de base a forma."""
    comunes = 0
    while comunes < min(len(base), len(forma)) and base[comunes] == forma[comunes]:
        comunes += 1
    return len(base) - comunes, forma[comunes:]


def aplicar(nou, regla_):
    treu, posa = regla_
    return (nou[:len(nou) - treu] if treu else nou) + posa


def toca_la_tonica(base, forma):
    """Si per anar de base a forma s'ha de tocar el que hi ha abans de l'accent
    primari: llavors l'accent passa a l'arrel, i la vocal de l'arrel del model
    (kəntˈa -> kˈantə) no té per què ser la del nou. Si l'accent només se
    n'endú cap al final (kəntˈa -> kəntəɾˈa), l'arrel queda intacta i la regla
    és bona."""
    accent = base.rfind(ACCENT)
    if accent < 0:
        return False
    treu, _ = regla(base, forma)
    return len(base) - treu < accent


def sufix_comu(a, b):
    a, b = clau_dordre(a), clau_dordre(b)
    n = 0
    while n < min(len(a), len(b)) and a[-1 - n] == b[-1 - n]:
        n += 1
    return n


def problemes(camps, transcripcions):
    """El que impedeix donar-la d'alta. camps són els set del diccionari i
    transcripcions, {codi: transcripció}. Torna una llista de textos (buida si
    va bé)."""
    errors = []
    paraula, lema, codi_eagles, silabes, *enllacos = camps
    for nom, valor in (("la paraula", paraula), ("el lema", lema), ("el codi", codi_eagles)):
        if not valor:
            errors.append(f"falta {nom}")
        # El $ partiria la fila del diccionari, i el €, la de la col_10.
        elif "$" in valor or "€" in valor:
            errors.append(f"{nom} no pot dur cap $ ni €")
    if not (silabes.isascii() and silabes.isdigit() and int(silabes) > 0):
        errors.append("les síl·labes han de ser un nombre enter positiu")
    for nom, valor in zip(ENLLACOS, enllacos):
        if valor not in (nom, "NO"):
            errors.append(f"l'enllaç {nom} ha de ser {nom} o NO, i és «{valor}»")
    for codi, transcripcio in transcripcions.items():
        if not transcripcio:
            errors.append(f"la transcripció en {codi} és buida")
        estranys = sorted(set(transcripcio) - INVENTARI)
        if estranys:
            errors.append(f"la transcripció en {codi} té símbols que no són a "
                          f"l'inventari: {' '.join(estranys)}")
    return errors


def del_formulari(peticio, codis):
    """Els set camps del diccionari i les transcripcions d'una paraula del
    formulari. El lema, si no n'hi ha, és la paraula."""
    text = lambda clau: str(peticio.get(clau) or "").strip()
    paraula = text("paraula")
    silabes = text("silabes")
    camps = [
        paraula,
        text("lema") or paraula,
        text("codi"),
        str(int(silabes)) if silabes.isdecimal() else silabes,
        "Vicc" if peticio.get("vicc") else "NO",
        "Viq" if peticio.get("viq") else "NO",
        "Diec" if peticio.get("diec") else "NO",
    ]
    transcripcions = peticio.get("transcripcions")
    if not isinstance(transcripcions, dict):
        transcripcions = {}
    return camps, {codi: str(transcripcions.get(codi) or "").strip() for codi in codis}


def dels_arxius(text_paraules, textos_transcripcions, codis):
    """Torna (noves, errors): noves és [(camps, {codi: transcripció}), ...].

    Les línies en blanc no compten, ni a l'un ni als altres: la tercera
    transcripció de cada arxiu és la de la tercera paraula, encara que entremig
    hi hagi línies buides."""
    linies = [(numero, linia.strip()) for numero, linia in enumerate(text_paraules.splitlines(), 1)
              if linia.strip()]
    if not linies:
        return [], ["L'arxiu de les paraules no en té cap."]

    errors = []
    columnes = {}
    for codi in codis:
        text = textos_transcripcions.get(codi)
        if not isinstance(text, str) or not text.strip():
            errors.append(f"Falta l'arxiu de les transcripcions en {NOMS_DIALECTES.get(codi, codi)}.")
            continue
        columnes[codi] = [linia.strip() for linia in text.splitlines() if linia.strip()]
        if len(columnes[codi]) != len(linies):
            errors.append(f"L'arxiu de {codi} té {camins.mil(len(columnes[codi]))} línies, però "
                          f"l'arxiu principal en té {camins.mil(len(linies))}.")
    if errors:
        return [], errors

    noves = []
    for i, (numero, linia) in enumerate(linies):
        camps = linia.split("$")
        if len(camps) != camins.CAMPS:
            errors.append(f"Línia {numero}: hi ha {len(camps)} camps i n'hi ha d'haver "
                          f"{camins.CAMPS} (paraula$lema$codi$síl·labes$Vicc$Viq$Diec).")
            continue
        seves = {codi: columnes[codi][i] for codi in codis}
        errors.extend(f"Línia {numero} ({camps[0]}): {problema}"
                      for problema in problemes(camps, seves))
        noves.append((camps, seves))
    return noves, errors


class Llistes:
    """El diccionari i la col_10 a la memòria.

    Línia per línia i sense partir: sis-centes mil llistes de set camps serien
    uns quants centenars de MB per no res, i per donar d'alta una paraula només
    cal saber on va, que surt de la paraula de cada fila."""

    def __init__(self):
        self.carregar()

    def mtimes(self):
        return [os.path.getmtime(cami) for cami in (camins.DICCIONARI, camins.COL_10)]

    def carregar(self):
        self.mtime = self.mtimes()
        linies = camins.llegir_columna(camins.DICCIONARI)
        self.col_10 = camins.llegir_columna(camins.COL_10)
        # Les línies buides del diccionari no són cap fila: llegir_diccionari()
        # se les salta i, en tornar-lo a escriure, desapareixen.
        self.diccionari = [linia for linia in linies if linia]
        self.paraules = [linia.split("$", 1)[0] for linia in self.diccionari]
        # Els dialectes, en l'ordre que ja hi són: la línia nova els ha de
        # portar com les altres (col_10.llegir() no en vol d'una altra manera).
        self.codis = modul_col_10.TROS.split(self.col_10[0])[1::2]
        self.error = self._desacord(linies)
        self._per_lema = None

    def per_lema(self):
        """{lema: [posicions]}, per trobar les famílies dels models. No es fa
        fins que algú el demana, i cada alta el desfà."""
        if self._per_lema is None:
            self._per_lema = {}
            for posicio, linia in enumerate(self.diccionari):
                self._per_lema.setdefault(linia.split("$", 2)[1], []).append(posicio)
        return self._per_lema

    def fila(self, posicio):
        """(els set camps, {codi: transcripció}) d'una fila."""
        trossos = modul_col_10.TROS.split(self.col_10[posicio])
        return self.diccionari[posicio].split("$"), dict(zip(trossos[1::2], trossos[2::2]))

    def _desacord(self, linies):
        """Per què no s'hi pot afegir res, o None. Tot és cosa del
        sincronitzar.py o de l'editor, abans."""
        for numero, linia in enumerate(linies, 1):
            if linia and linia.count("$") != camins.CAMPS - 1:
                return (f"diccionari.5.2.3.txt, línia {numero}: hi ha {linia.count('$') + 1} "
                        f"camps i n'hi ha d'haver {camins.CAMPS} (paraula, lema, codi, "
                        f"síl·labes, Vicc, Viq, Diec).")
        if len(self.col_10) != len(self.diccionari):
            return (f"la col_10 té {camins.mil(len(self.col_10))} línies i el diccionari "
                    f"{camins.mil(len(self.diccionari))}: primer passa el sincronitzar.py.")
        if sorted(self.codis) != camins.dialectes():
            return (f"la col_10 porta els dialectes {', '.join(self.codis) or '(cap)'} i a "
                    f"dialectes_col/ hi ha {', '.join(camins.dialectes())}: primer passa "
                    f"el sincronitzar.py.")
        return None

    def al_dia(self):
        """Si algú els ha tocat per fora des que els hem llegits, els tornem a llegir."""
        if self.mtimes() != self.mtime:
            self.carregar()

    def posicio(self, paraula, fila):
        """On va: la fila que diguis (1 = la primera) o, si no en dius cap, la
        que li toca per ordre alfabètic. Torna (posició, error)."""
        if fila is None or fila == "":
            return on_va(self.paraules, paraula), None
        if not str(fila).isdigit() or int(fila) < 1:
            return None, "La fila ha de ser un nombre enter a partir de l'1."
        posicio = int(fila) - 1
        if posicio > len(self.diccionari):
            return None, (f"La fila {fila} no existeix: n'hi ha {camins.mil(len(self.diccionari))} "
                          f"i la nova pot anar, com a molt, a la {camins.mil(len(self.diccionari) + 1)}.")
        return posicio, None

    def veins(self, posicio):
        """Les files de just abans i just després de la nova, amb el número
        que tindran quan hi sigui."""
        abans = [{"fila": i + 1, "linia": self.diccionari[i]}
                 for i in range(max(0, posicio - VEINS), posicio)]
        despres = [{"fila": i + 2, "linia": self.diccionari[i]}
                   for i in range(posicio, min(len(self.diccionari), posicio + VEINS))]
        return abans, despres

    def inserir(self, posicio, camps, transcripcions):
        linia = modul_col_10.SEPARADOR.join(camps[:camins.CAMPS_IDENTITAT])
        for codi in self.codis:
            linia += modul_col_10.marca(codi) + transcripcions[codi]
        self.diccionari.insert(posicio, "$".join(camps))
        self.col_10.insert(posicio, linia)
        self.paraules.insert(posicio, camps[0])
        self._per_lema = None

    def desar(self):
        """Tots dos sencers: primer els dos temporals i després els dos
        reemplaçaments, l'un darrere l'altre. Així el que es pot quedar a
        mitges és un rename, i no pas 76 MB."""
        textos = {
            # El diccionari acaba amb salt de línia i la col_10 no (vegeu camins.py).
            camins.DICCIONARI: "\n".join(self.diccionari) + "\n",
            camins.COL_10: "\n".join(self.col_10),
        }
        try:
            for cami, text in textos.items():
                with open(cami + ".desant", "w", encoding="utf-8") as sortida:
                    sortida.write(text)
            for cami in textos:
                os.replace(cami + ".desant", cami)
        except OSError:
            # La memòria ja porta les paraules noves i els fitxers potser no:
            # que manin els fitxers.
            self.carregar()
            raise
        self.mtime = self.mtimes()


class Servidor:
    def __init__(self):
        print("Carregant el diccionari i la col_10 (van uns segons)…", flush=True)
        self.llistes = Llistes()
        if self.llistes.error:
            avisos.plegar(self.llistes.error)
        self.pany = threading.Lock()
        print(f"  {camins.mil(len(self.llistes.diccionari))} files, "
              f"dialectes {', '.join(self.llistes.codis)}")

    def _al_dia(self):
        """Dins del pany. Torna l'error si ara els fitxers no es corresponen."""
        self.llistes.al_dia()
        if self.llistes.error:
            return 409, {"error": f"No s'hi pot afegir res: {self.llistes.error}"}
        return None

    def configuracio(self):
        with self.pany:
            self.llistes.al_dia()
            return {"codis": self.llistes.codis, "dialectes": NOMS_DIALECTES,
                    "vocals": VOCALS, "accent": ACCENT, "inventari": "".join(sorted(INVENTARI)),
                    "files": len(self.llistes.diccionari)}

    def veure(self, paraula, fila):
        """On aniria i què hi ha al voltant, per ensenyar-ho abans d'afegir-la."""
        paraula = paraula.strip()
        with self.pany:
            error = self._al_dia()
            if error:
                return error
            posicio, error = self.llistes.posicio(paraula, fila)
            if error:
                return 400, {"error": error}
            abans, despres = self.llistes.veins(posicio)
            return 200, {"fila": posicio + 1,
                         "proposada": on_va(self.llistes.paraules, paraula) + 1,
                         "files": len(self.llistes.diccionari),
                         "abans": abans, "despres": despres}

    def afegir(self, peticio):
        """Una paraula del formulari, a la fila que t'ha ensenyat veure()."""
        with self.pany:
            error = self._al_dia()
            if error:
                return error
            llistes = self.llistes
            camps, transcripcions = del_formulari(peticio, llistes.codis)
            errors = problemes(camps, transcripcions)
            if errors:
                text = "; ".join(errors)
                return 400, {"error": text[0].upper() + text[1:] + "."}
            posicio, error = llistes.posicio(camps[0], peticio.get("fila"))
            if error:
                return 400, {"error": error}

            # Entre les mateixes dues files que tenies a la pantalla, o res.
            abans, despres = llistes.veins(posicio)
            vistes = (abans[-1]["linia"] if abans else None, despres[0]["linia"] if despres else None)
            if vistes != (peticio.get("abans"), peticio.get("despres")):
                return 409, {"error": "Els fitxers han canviat des que ho has mirat (algú els "
                                      "ha tocat). Torna-ho a mirar abans d'afegir-la."}

            llistes.inserir(posicio, camps, transcripcions)
            try:
                llistes.desar()
            except OSError as excepcio:
                return 500, {"error": f"No s'ha pogut desar ({excepcio}). Mira amb el git com "
                                      f"han quedat el diccionari i la col_10."}
            files = len(llistes.diccionari)

        print(f"  afegida: {'$'.join(camps)} (fila {posicio + 1}): "
              + ", ".join(f"{codi} {valor}" for codi, valor in transcripcions.items()), flush=True)
        return 200, {"fila": posicio + 1, "files": files, "linia": "$".join(camps),
                     "transcripcions": transcripcions}

    def afegir_diverses(self, peticio):
        """Les dels arxius, cadascuna on li toca. Amb provar, no es desa res:
        només diu entre quines paraules aniria cadascuna."""
        text_paraules = peticio.get("paraules")
        textos = peticio.get("transcripcions")
        if not isinstance(text_paraules, str) or not isinstance(textos, dict):
            return 400, {"error": "Falten els arxius."}
        provar = bool(peticio.get("provar"))

        with self.pany:
            error = self._al_dia()
            if error:
                return error
            llistes = self.llistes
            noves, errors = dels_arxius(text_paraules, textos, llistes.codis)
            if errors:
                if len(errors) > MAX_ERRORS:
                    errors = errors[:MAX_ERRORS] + [f"…i {camins.mil(len(errors) - MAX_ERRORS)} més."]
                return 400, {"error": "Els arxius no es poden afegir així:", "errors": errors}

            # Cadascuna va on li toca comptant les d'abans, que ja hi seran. Per
            # provar, sobre una còpia de les paraules; per desar, sobre les de
            # debò, que inserir() fa créixer alhora que el diccionari i la col_10.
            paraules = list(llistes.paraules) if provar else llistes.paraules
            vista = []
            for camps, seves in noves:
                posicio = on_va(paraules, camps[0])
                if len(vista) < MAX_VISTA:
                    vista.append({"linia": "$".join(camps), "transcripcions": seves,
                                  "despres_de": paraules[posicio - 1] if posicio else None,
                                  "abans_de": paraules[posicio] if posicio < len(paraules) else None})
                if provar:
                    paraules.insert(posicio, camps[0])
                else:
                    llistes.inserir(posicio, camps, seves)
            if provar:
                return 200, {"n": len(noves), "vista": vista, "files": len(llistes.diccionari)}

            try:
                llistes.desar()
            except OSError as excepcio:
                return 500, {"error": f"No s'ha pogut desar ({excepcio}). Mira amb el git com "
                                      f"han quedat el diccionari i la col_10."}
            files = len(llistes.diccionari)

        print(f"  afegides {camins.mil(len(noves))} paraules des d'arxius", flush=True)
        return 200, {"n": len(noves), "files": files}

    def models(self, lema):
        """Lemes que ja hi són i que acaben com el nou, per fer-ne de model: els
        que hi comparteixen més lletres del final i, a igualtat, els de família
        més gran (els que tenen més formes per copiar)."""
        lema = lema.strip()
        if not lema:
            return 200, {"models": []}
        with self.pany:
            error = self._al_dia()
            if error:
                return error
            candidats = []
            for model, posicions in self.llistes.per_lema().items():
                if model == lema:
                    continue
                comu = sufix_comu(model, lema)
                if comu >= 2 and any(self.llistes.paraules[p] == model for p in posicions):
                    candidats.append((-comu, -len(posicions), model))
            candidats.sort()
            return 200, {"models": [{"lema": model, "formes": -formes}
                                    for _, formes, model in candidats[:MAX_MODELS]]}

    def derivar(self, peticio):
        """Les formes del lema nou fetes com les del model. No desa res: les
        ensenya perquè les miris, i s'afegeixen amb afegir_diverses()."""
        text = lambda clau: str(peticio.get(clau) or "").strip()
        model, lema, silabes = text("model"), text("lema"), text("silabes")
        noves = peticio.get("transcripcions")
        noves = {codi: str(valor).strip() for codi, valor in noves.items()} \
            if isinstance(noves, dict) else {}
        if not lema or not model:
            return 400, {"error": "Falten el lema nou i el model."}
        if not silabes.isdecimal():
            return 400, {"error": "Falten les síl·labes del lema nou."}

        with self.pany:
            error = self._al_dia()
            if error:
                return error
            llistes = self.llistes
            falten = [NOMS_DIALECTES.get(codi, codi) for codi in llistes.codis if not noves.get(codi)]
            if falten:
                return 400, {"error": f"Falta la transcripció del lema nou en {', '.join(falten)}."}
            posicions = llistes.per_lema().get(model)
            if not posicions:
                return 400, {"error": f"No hi ha cap paraula amb el lema «{model}»."}
            familia = [llistes.fila(posicio) for posicio in posicions]
            # La forma del model que és el lema mateix: d'ella surten les regles.
            bases = [(camps, trans) for camps, trans in familia if camps[0] == model]
            if not bases:
                return 400, {"error": f"El lema «{model}» no hi és com a paraula: no se'n "
                                      f"poden treure les regles."}
            base_camps, base_trans = bases[0]

            ja_hi_son = {(llistes.paraules[p], llistes.diccionari[p].split("$", 3)[2])
                         for p in llistes.per_lema().get(lema, [])}
            formes = []
            for camps, trans in familia:
                paraula = aplicar(lema, regla(model, camps[0]))
                # Tantes més o menys com el model respecte del seu lema.
                silabes_seves = int(silabes)
                if camps[3].isdecimal() and base_camps[3].isdecimal():
                    silabes_seves += int(camps[3]) - int(base_camps[3])
                formes.append({
                    "model": camps[0],
                    "paraula": paraula,
                    "codi": camps[2],
                    "silabes": str(max(1, silabes_seves)),
                    "transcripcions": {codi: aplicar(noves[codi], regla(base_trans[codi], trans[codi]))
                                       for codi in llistes.codis},
                    # Els dialectes on la forma mou l'accent: allà la regla no és fiable.
                    "revisar": [codi for codi in llistes.codis
                                if toca_la_tonica(base_trans[codi], trans[codi])],
                    "existeix": (paraula, camps[2]) in ja_hi_son,
                })
        return 200, {"formes": formes, "model": model}


def fer_handler(servidor):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def _json(self, codi, dades):
            cos = json.dumps(dades, ensure_ascii=False).encode("utf-8")
            self.send_response(codi)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(cos)))
            self.end_headers()
            self.wfile.write(cos)

        def do_GET(self):
            url = urlparse(self.path)
            if url.path == "/":
                with open(PAGINA, "rb") as fitxer:
                    cos = fitxer.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(cos)))
                self.end_headers()
                self.wfile.write(cos)
            elif url.path == "/api/configuracio":
                self._json(200, servidor.configuracio())
            elif url.path == "/api/posicio":
                consulta = parse_qs(url.query)
                paraula = consulta.get("paraula", [""])[0]
                fila = consulta.get("fila", [""])[0]
                self._json(*servidor.veure(paraula, fila))
            elif url.path == "/api/models":
                self._json(*servidor.models(parse_qs(url.query).get("lema", [""])[0]))
            else:
                self._json(404, {"error": "no hi és"})

        def do_POST(self):
            accions = {"/api/afegeix": servidor.afegir, "/api/diverses": servidor.afegir_diverses,
                       "/api/deriva": servidor.derivar}
            accio = accions.get(urlparse(self.path).path)
            if accio is None:
                return self._json(404, {"error": "no hi és"})
            llargada = int(self.headers.get("Content-Length", 0))
            try:
                peticio = json.loads(self.rfile.read(llargada) or b"{}")
            except json.JSONDecodeError:
                return self._json(400, {"error": "La petició no és JSON."})
            if not isinstance(peticio, dict):
                return self._json(400, {"error": "La petició no és un objecte JSON."})
            self._json(*accio(peticio))

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Donar d'alta paraules al diccionari i a la col_10.")
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--sense-navegador", action="store_true")
    opcions = parser.parse_args()

    servidor = Servidor()
    # Només localhost: aquesta pàgina escriu al repositori.
    http = ThreadingHTTPServer(("127.0.0.1", opcions.port), fer_handler(servidor))
    adreca = f"http://localhost:{opcions.port}"
    print(f"\nObert a {adreca}  (Ctrl+C per aturar-lo)")
    print("Recorda: git pull abans de començar, i commit del diccionari i la col_10 junts en acabar.\n")
    if not opcions.sense_navegador:
        webbrowser.open(adreca)
    try:
        http.serve_forever()
    except KeyboardInterrupt:
        print("\nAturat.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
