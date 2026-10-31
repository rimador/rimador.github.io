"""
EINA LOCAL. Donar d'alta una paraula a l'APENDIX d'un dialecte, als cinc
fitxers que s'editen a mà alhora.

    python3 diccionaris/python/afegir_paraula_apendix.py

ÉS PER ALS APENDIXS, o sigui per a una paraula que NOMÉS es diu en un dialecte
("cante" i "servisc" en valencià, "cant" i "tenc" en balear). Una paraula que
es digui a tot arreu i el que canviï sigui com sona no va aquí sinó al
diccionari: per a aquella hi ha l'afegir_paraula.py, que és el germà d'aquest.

    afegir_paraula.py           diccionari.5.2.3.txt + col_10.txt
    afegir_paraula_apendix.py   dialectes_col/<codi>/apendix/

No porta arguments: l'engegues (des del VS Code amb el botó de Run, o des del
terminal) i et va demanant a quin apendix vols afegir, la paraula, el lema, el
codi, les síl·labes, els enllaços i la transcripció d'aquell dialecte.

QUINS FITXERS TOCA. Un apendix es reparteix els fitxers igual que el
diccionari, però ja partits per columnes (vegeu camins.py):

    col_10_<codi>.txt          identitat i transcripció   ─┐ S'EDITEN A MÀ:
    col_5,6,7,8_<codi>.txt     síl·labes i enllaços       ─┘ els escriu això
    col_0,1,2,9_<codi>.txt     els escriu el sincronitzar.py
    col_3,4_<codi>.txt         la rima, del col_9

Per tant aquesta eina escriu a la col_10 i a les col_5 a 8, i A LA MATEIXA
FILA: van fila per fila i no porten cap paraula a dins, o sigui que
desquadrades cada paraula duria les síl·labes i els enllaços d'una altra. Si
no es corresponen, el sincronitzar.py s'atura i diu quina fila falta. Les
col_0, 1, 2 i 9 no es toquen: són sortides seves i les refarà ell.

LA POSICIÓ. L'apendix està ordenat alfabèticament ignorant accents,
majúscules, guions i punts volats, igual que el diccionari, i igual que allà
no del tot. Per això la fila es proposa i s'ensenya amb els veïns perquè la
miris, i sempre la pots dir tu quan et pregunti la fila.
"""

import os
import sys
import unicodedata

DIR_SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if DIR_SCRIPTS not in sys.path:
    sys.path.insert(0, DIR_SCRIPTS)

import avisos
import camins
import col_10 as modul_col_10

# La terminal del Windows no sempre és UTF-8, i aquí s'hi escriuen i s'hi
# llegeixen transcripcions: sense això, ensenyar-te els veïns d'una fila peta
# amb un UnicodeEncodeError just abans de preguntar-te si va bé. Els fitxers ja
# s'obren amb encoding="utf-8" i no depenen d'això.
for _canal in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _canal.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError, ValueError):
        pass


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


def _preguntar(text):
    """Un input que no peta si tanques la finestra o fas Ctrl+C."""
    try:
        return input(text).strip()
    except (EOFError, KeyboardInterrupt):
        print("\nDeixat córrer. No s'ha tocat res.")
        sys.exit(1)


def demanar(text, per_defecte=None):
    """Text obligatori. Si hi ha per_defecte, l'Enter el pren."""
    if per_defecte:
        text = f"{text} [{per_defecte}]: "
    else:
        text = f"{text}: "
    while True:
        resposta = _preguntar(text)
        if resposta:
            return resposta
        if per_defecte:
            return per_defecte
        print("   Cal posar-hi alguna cosa.")


def demanar_nombre(text):
    while True:
        resposta = _preguntar(f"{text}: ")
        if resposta.isdigit() and int(resposta) > 0:
            return int(resposta)
        print("   Ha de ser un nombre enter positiu.")


def demanar_si(text):
    """[s/N]: l'Enter és que no."""
    return _preguntar(f"{text} [s/N]: ").lower() in ("s", "si", "sí")


def demanar_apendix():
    """A quin dialecte. És l'única pregunta que l'afegir_paraula.py no fa: allà
    la paraula entra a tots alhora i aquí només a un."""
    codis = camins.dialectes_amb_apendix()
    if not codis:
        avisos.plegar("cap dialecte de dialectes_col/ no té carpeta apendix/. "
                      "Un apendix és una carpeta amb les seves columnes a dins.")

    sense = [codi for codi in camins.dialectes() if codi not in codis]
    print("\nApendixs que hi ha:")
    for i, codi in enumerate(codis, 1):
        print(f"   {i}) {codi}")
    if sense:
        print(f"   (els dialectes {', '.join(sense)} no tenen apendix)")

    while True:
        resposta = demanar("\nA quin apendix vols afegir (el codi o el número)")
        if resposta in codis:
            return resposta
        if resposta.isdigit() and 1 <= int(resposta) <= len(codis):
            return codis[int(resposta) - 1]
        print(f"   Ha de ser un d'aquests: {', '.join(codis)}.")


def llegir_apendix(codi):
    """Torna (identitats, transcripcions, dades):

        identitats     [[paraula, lema, codi], ...]   de la col_10
        transcripcions [transcripció, ...]            de la col_10, un sol dialecte
        dades          {5: [...], 6: [...], ...}      les síl·labes i els enllaços

    Peta si les cinc llistes no tenen la mateixa llargada: desquadrades, cada
    paraula duria les dades d'una altra i no hi ha manera d'endevinar-ho."""
    cami_c10 = camins.cami_col_10_apendix(codi)
    if not modul_col_10.existeix(cami_c10):
        avisos.plegar(f"l'apendix del '{codi}' no té {os.path.basename(cami_c10)}. "
                      f"Passa-hi primer el sincronitzar.py, que te'n farà una de les "
                      f"columnes que hi ha.")

    identitats, per_dialecte = modul_col_10.llegir(cami_c10)
    dins = list(per_dialecte)
    if dins != [codi]:
        avisos.plegar(
            f"la col_10 de l'apendix del '{codi}' porta "
            + (f"els dialectes {', '.join(dins)}" if dins else "cap dialecte")
            + f", i només n'hi pot dur un: el seu.", camins.relatiu(cami_c10))

    dades = {}
    for numero in camins.APENDIX_A_MA:
        cami = camins.cami_apendix(codi, numero)
        if not os.path.exists(cami):
            avisos.plegar(f"falta {camins.relatiu(cami)}. L'apendix d'un dialecte ha de "
                          f"dur les col_5 a 8 (les síl·labes i els enllaços).")
        dades[numero] = camins.llegir_columna(cami)

    quantes = {10: len(identitats)}
    quantes.update({numero: len(valors) for numero, valors in dades.items()})
    if len(set(quantes.values())) > 1:
        detall = ", ".join(f"col_{n}: {camins.mil(q)}" for n, q in sorted(quantes.items()))
        avisos.plegar(f"els fitxers de l'apendix del '{codi}' no tenen el mateix nombre "
                      f"de files ({detall}): primer passa el sincronitzar.py.")

    return identitats, per_dialecte[codi], dades


def escriure_apendix(codi, identitats, transcripcions, dades):
    modul_col_10.escriure(identitats, {codi: transcripcions},
                          camins.cami_col_10_apendix(codi))
    for numero in camins.APENDIX_A_MA:
        camins.escriure_columna(camins.cami_apendix(codi, numero), dades[numero])


def dades_de_la_fila(fila):
    """Dels set camps d'una fila (els mateixos que al diccionari), què va a
    cada columna de les que s'editen a mà."""
    return {5: fila[3], 6: fila[4], 7: fila[5], 8: fila[6]}


def afegir_en_bulk(codi):
    print(f"\nAFEGIR PARAULES EN BULK A L'APENDIX DEL '{codi}' "
          f"(Ctrl+C per deixar-ho córrer)\n")
    print("L'arxiu principal ha de dur una paraula per línia i els mateixos set camps")
    print("que el diccionari, partits per '$':\n")
    print("   paraula$lema$codi$síl·labes$Vicc$Viq$Diec\n")
    fitxer_paraules = demanar("Ruta de l'arxiu principal amb les paraules")

    if not os.path.exists(fitxer_paraules):
        avisos.plegar(f"No s'ha trobat l'arxiu {fitxer_paraules}")

    with open(fitxer_paraules, 'r', encoding='utf-8') as f:
        noves_files = [linia.strip().split('$') for linia in f if linia.strip()]

    for numero, fila in enumerate(noves_files, 1):
        if len(fila) != camins.CAMPS:
            avisos.plegar(f"{fitxer_paraules}, línia {numero}: hi ha {len(fila)} camps i "
                          f"n'hi ha d'haver {camins.CAMPS} (paraula, lema, codi, "
                          f"síl·labes, Vicc, Viq, Diec). Ni la rima ni la transcripció "
                          f"no hi van: la transcripció va a l'altre arxiu.")

    ruta = demanar(f"Ruta de l'arxiu de transcripcions per a '{codi}'")
    if not os.path.exists(ruta):
        avisos.plegar(f"No s'ha trobat l'arxiu {ruta}")
    with open(ruta, 'r', encoding='utf-8') as f:
        noves_transcripcions = [linia.strip() for linia in f if linia.strip()]

    # Les dues llistes van fila per fila: si no tenen la mateixa llargada, cada
    # paraula duria la transcripció d'una altra.
    n_paraules = len(noves_files)
    if len(noves_transcripcions) != n_paraules:
        avisos.plegar(f"L'arxiu de transcripcions té {len(noves_transcripcions)} línies, "
                      f"però l'arxiu principal en té {n_paraules}.")

    print(f"Carregant l'apendix del '{codi}'...")
    identitats, transcripcions, dades = llegir_apendix(codi)
    paraules = [identitat[0] for identitat in identitats]

    print(f"\nInserint {n_paraules} paraules en bulk...")

    for i, nova_fila in enumerate(noves_files):
        paraula = nova_fila[0]
        posicio = on_va(paraules, paraula)

        identitats.insert(posicio, nova_fila[:camins.CAMPS_IDENTITAT])
        transcripcions.insert(posicio, noves_transcripcions[i])
        noves_dades = dades_de_la_fila(nova_fila)
        for numero in camins.APENDIX_A_MA:
            dades[numero].insert(posicio, noves_dades[numero])

        # Actualitzem la referència de l'ordre perquè la següent paraula sàpiga on cau
        paraules.insert(posicio, paraula)

    escriure_apendix(codi, identitats, transcripcions, dades)

    print(f"\nFeta. S'han afegit {n_paraules} paraules. L'apendix del '{codi}' té "
          f"{camins.mil(len(identitats))} files.")
    print("Comiteja'ls tots junts: el workflow s'espera trobar-los d'acord.")
    return 0


def afegir_una_paraula(codi):
    print(f"\nDONAR D'ALTA UNA PARAULA A L'APENDIX DEL '{codi}' "
          f"(Ctrl+C per deixar-ho córrer)\n")
    print(f"Carregant l'apendix del '{codi}'...")
    identitats, transcripcions, dades = llegir_apendix(codi)

    paraules = [identitat[0] for identitat in identitats]
    print(f"Hi ha {camins.mil(len(identitats))} files.\n")

    paraula = demanar("Paraula")
    lema = demanar("Lema", per_defecte=paraula)
    codi_eagles = demanar("Codi EAGLES (p. ex. NCFS000)")
    silabes = demanar_nombre("Síl·labes")
    vicc = demanar_si("Surt al Viccionari?")
    viq = demanar_si("Surt a la Viquipèdia?")
    diec = demanar_si("Surt al DIEC?")
    transcripcio = demanar(f"Transcripció en {codi}")

    fila = _preguntar("\nFila on posar-la (1 = la primera; Enter = la que et proposi): ")
    if fila:
        if not fila.isdigit() or int(fila) < 1:
            avisos.plegar("la fila ha de ser un nombre enter a partir de l'1.")
        posicio = int(fila) - 1
    else:
        posicio = on_va(paraules, paraula)
    if not 0 <= posicio <= len(identitats):
        avisos.plegar(f"la fila {posicio + 1} no existeix "
                      f"(n'hi ha {camins.mil(len(identitats))}).")

    nova = [
        paraula,
        lema,
        codi_eagles,
        str(silabes),
        "Vicc" if vicc else "NO",
        "Viq" if viq else "NO",
        "Diec" if diec else "NO",
    ]
    nova_identitat = nova[:camins.CAMPS_IDENTITAT]
    noves_dades = dades_de_la_fila(nova)

    def com_es_veu(i):
        """La fila i de l'apendix, tal com quedaria a la seva col_10 i amb les
        síl·labes i els enllaços al costat."""
        return (modul_col_10.SEPARADOR.join(identitats[i])
                + modul_col_10.marca(codi) + transcripcions[i]
                + "   [" + " ".join(dades[numero][i] for numero in camins.APENDIX_A_MA) + "]")

    def com_es_veuria_la_nova():
        return (modul_col_10.SEPARADOR.join(nova_identitat)
                + modul_col_10.marca(codi) + transcripcio
                + "   [" + " ".join(noves_dades[numero]
                                    for numero in camins.APENDIX_A_MA) + "]")

    print(f"\nA la fila {posicio + 1} de l'apendix del '{codi}':\n")
    for i in range(max(0, posicio - 2), posicio):
        print(f"   {i + 1:>7}  {com_es_veu(i)}")
    print(f"   {posicio + 1:>7}  {com_es_veuria_la_nova()}   <-- nova")
    for i in range(posicio, min(len(identitats), posicio + 2)):
        print(f"   {i + 2:>7}  {com_es_veu(i)}")
    print("\n   (entre claudàtors: síl·labes, Vicc, Viq i Diec — les col_5 a 8)")

    if not demanar_si("\nVa bé?"):
        print("No s'ha tocat res.")
        return 1

    identitats.insert(posicio, nova_identitat)
    transcripcions.insert(posicio, transcripcio)
    for numero in camins.APENDIX_A_MA:
        dades[numero].insert(posicio, noves_dades[numero])

    escriure_apendix(codi, identitats, transcripcions, dades)

    print(f"\nFeta. L'apendix del '{codi}' té {camins.mil(len(identitats))} files.")
    print("Comiteja'ls tots junts: el workflow s'espera trobar-los d'acord.")
    return 0


def main():
    print("\nEINA D'AFEGIR PARAULES ALS APENDIXS (Ctrl+C per deixar-ho córrer)")
    print("Per a les paraules que només es diuen en un dialecte. Les que es diuen")
    print("a tot arreu van al diccionari: per a aquelles hi ha l'afegir_paraula.py.")

    codi = demanar_apendix()

    opcio = demanar("\nVols afegir una sola paraula (1) o diverses en bulk des d'arxius (2)? [1/2]")
    while opcio not in ("1", "2"):
        opcio = demanar("   Si us plau, tria 1 o 2")

    if opcio == "1":
        return afegir_una_paraula(codi)
    else:
        return afegir_en_bulk(codi)


if __name__ == "__main__":
    sys.exit(main())
