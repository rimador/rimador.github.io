"""
Les comprovacions de les paraules congelades contra les dades d'ara (apartat 4.10
de la proposta), que fa generar_dades.py a cada passada.

EL QUE ES CONGELA A UNA ERA és quina paraula surt cada dia, no pas amb quines rimes
es juga: això ho decideix sempre el diccionari del moment. Per això un canvi al
diccionari no trenca l'era (es continua jugant, amb les rimes noves), però pot deixar
una paraula que ja no es pot jugar o desequilibrar el que es va triar. Aquí es mira
CADA paraula congelada de l'era vigent i de les futures, i no només les que s'han
editat: la bossa d'una paraula depèn de quantes rimes té la seva clau, i aquest
nombre canvia quan s'afegeixen o es corregeixen ALTRES paraules de la mateixa clau.

  ERROR (bloqueja)  una paraula congelada ja no es pot jugar en algun dialecte: no hi
                    és objectiu (desapareix, passa a ser verb...), cau a dues claus o
                    cau en una clau amb massa poques rimes. Es proposa substituir-la
                    al mateix lloc per una altra de la mateixa clau (i variant, si
                    pot ser). No s'esborra mai, perquè desplaçaria la baralla. No es
                    publica res fins que està resolt.
  avís              una clau ha canviat de bossa (la del costat només compta al
                    recompte; si salta dues bosses o més, surt amb nom); una variant
                    ha sortit de la tolerància de l'era; una paraula ha canviat de
                    rima en algun dialecte (pot desequilibrar la rotació).
  suggeriment       si s'han desplaçat més de l'1 % de les claus de l'era, o hi ha un
                    1 % de claus noves que podrien entrar, convé una era nova. No
                    trenca res: l'era manté cada clau a la seva bossa i tothom
                    continua tenint la mateixa paraula.

També escriu, per a cada era de l'eres.json, el bloc de resolució que va a
l'index.json: de cada paraula, a cada dialecte, la posició de la seva clau dins del
`claus` del dialecte (o -1). Vegeu resoldre.
"""

import collections
import os
import sys
from fractions import Fraction

DIR_EINES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_EINES)

import variants_era as ve  # noqa: E402
import generar_dades as gd  # noqa: E402
import camins  # noqa: E402  (el generar_dades ja l'ha posat al camí)

# Quin tros de les claus de l'era ha de canviar perquè convingui una era nova.
LLINDAR = Fraction(1, 100)

# Quants dies de futur es miren per dir quin dia surt cada paraula a l'informe.
DIES_DE_PREVISIO = 1100

NOM_CARRIL = {"dificil": "difícil", "facil": "fàcil", "roda": "roda"}

Problema = collections.namedtuple("Problema", "idx paraula codi tipus detall")

# Per què una paraula ja no es pot jugar en un dialecte.
MOTIUS = {
    "no_objectiu": "ja no és objectiu en",
    "dues_claus": "cau a dues claus en",
    "poques_rimes": "cau en una clau amb massa poques rimes en",
}
Referencia = collections.namedtuple("Referencia", "carril clau variant posicio")


mil = camins.mil


def nom_dialecte(codi):
    return gd.NOMS_DE_DIALECTE.get(codi, codi).lower()


def eres_a_comprovar(eres, avui):
    """L'era vigent (la darrera que ja ha començat) i les futures: les úniques que es
    comproven. Les passades ja han sortit, i l'anterior a la vigent només es conserva
    perquè la pantalla d'ahir pugui dir la paraula dels dies del canvi."""
    ordenades = sorted(eres, key=lambda era: era["inici"])
    iniciades = [era for era in ordenades if era["inici"] <= avui.isoformat()]
    futures = [era for era in ordenades if era["inici"] > avui.isoformat()]
    return iniciades[-1:] + futures


# --------------------------------------------------- Les paraules d'una era

def paraules_referenciades(era):
    """Les posicions de `paraules` que l'era fa servir de debò. Si una substitució
    deixa una paraula vella sense cap referència, es queda a la llista (esborrar-la
    mouria les posicions de totes les altres) i ningú no la comprova."""
    if era["algorisme"] == 0:
        return {posicio for entrada in era["roda"]["claus"] for posicio in entrada}
    return {posicio
            for carril in era["carrils"].values()
            for bossa in carril["bosses"]
            for clau in bossa["claus"]
            for variant in clau["v"]
            for posicio in variant}


def referencies_de(era, posicio):
    """On fa servir l'era una paraula: [Referencia(carril, clau, variant, lloc)].

    A la roda de l'era 0 el «carril» és «roda» i la «clau» és només la llista de
    l'entrada que té la paraula ({"v": [entrada]}): substituir-la és canviar el
    número d'aquella llista, igual que a una variant."""
    if era["algorisme"] == 0:
        for entrada in era["roda"]["claus"]:
            for lloc, valor in enumerate(entrada):
                if valor == posicio:
                    yield Referencia("roda", {"v": [entrada]}, 0, lloc)
        return
    for carril, dades in era["carrils"].items():
        for bossa in dades["bosses"]:
            for clau in bossa["claus"]:
                for i, variant in enumerate(clau["v"]):
                    for lloc, valor in enumerate(variant):
                        if valor == posicio:
                            yield Referencia(carril, clau, i, lloc)


def normalitzada_de(cos):
    return cos.split(">", 1)[0]


# ------------------------------------------------------- La resolució

def enumerar(noms):
    """['a', 'b', 'c'] -> 'a, b i c'."""
    return noms[0] if len(noms) == 1 else ", ".join(noms[:-1]) + " i " + noms[-1]


def descriure(problemes):
    """Els problemes d'una mateixa paraula, en una sola frase: «ja no és objectiu en
    balear i central; cau a dues claus en valencià»."""
    per_tipus = {}
    for problema in problemes:
        per_tipus.setdefault(problema.tipus, []).append(problema)
    return "; ".join(
        f"{MOTIUS[tipus]} " + enumerar([nom_dialecte(p.codi) + (f" ({p.detall})" if p.detall else "") for p in llista])
        for tipus, llista in per_tipus.items())


def resoldre(era, dades, tros_per_dialecte):
    """Per a cada dialecte, de cada paraula de l'era, la posició de la seva clau
    dins del `claus` publicat del dialecte (o -1 si ja no es pot resoldre).

    Una paraula es resol si és objectiu a UNA sola clau consonant del dialecte i
    aquesta clau és publicada (té rimes de sobres perquè l'index la porti). Torna
    ({codi: [posicions]}, [Problema]); els problemes només són de les paraules que
    l'era fa servir de debò."""
    rimes_cons, claus_cons = dades.per_mena["cons"]
    usades = paraules_referenciades(era)
    resolucio = {}
    problemes = []
    for codi in dades.codis:
        posicions = {entrada[0]: i for i, entrada in enumerate(tros_per_dialecte[codi]["claus"])}
        fila = []
        for idx, cos in enumerate(era["paraules"]):
            paraula = normalitzada_de(cos)
            claus = claus_cons[codi].get(paraula)
            posicio, problema = -1, None
            if not claus:
                problema = ("no_objectiu", "")
            elif len(claus) > 1:
                problema = ("dues_claus", "")
            else:
                clau = next(iter(claus))
                if clau in posicions:
                    posicio = posicions[clau]
                else:
                    problema = ("poques_rimes", f"-{clau}: {rimes_cons[codi].get(clau, 0)}")
            fila.append(posicio)
            if problema and idx in usades:
                problemes.append(Problema(idx, paraula, codi, *problema))
        resolucio[codi] = fila
    return resolucio, problemes


# --------------------------------------- Què ha canviat des que es va congelar

def talls_de_l_era(carril):
    return [(bossa["de"], bossa["fins"]) for bossa in carril["bosses"]]


def dins_de_la_tolerancia(n, rimes, tolerancia):
    f = Fraction(str(tolerancia))
    return rimes * f >= n and rimes <= n * f


def analitzar_carril(era, carril, dades):
    """El que ha canviat en un carril d'una era (algorisme 1) respecte de les dades
    d'ara: claus que han canviat de bossa, variants fora de la tolerància, paraules
    que han canviat de rima i claus noves que podrien entrar."""
    mena = ve.MENA_DE[carril]
    dades_carril = era["carrils"][carril]
    talls = talls_de_l_era(dades_carril)
    rimes, claus_de = dades.per_mena[mena]
    ic = dades.i_canonic
    altres = [j for j in range(len(dades.codis)) if j != ic]

    resultat = {"claus": 0, "costat": 0, "lluny": [], "fora_de_variants": [],
                "paraules_canviades": [], "noves": []}
    a_l_era = set()
    for b, bossa in enumerate(dades_carril["bosses"]):
        for clau in bossa["claus"]:
            resultat["claus"] += 1
            a_l_era.add(clau["c"])
            n_ara = rimes[dades.canonic].get(clau["c"])
            ara = ve.bossa_de(n_ara, talls) if n_ara is not None else None

            if ara != b:
                if ara is not None and abs(ara - b) == 1:
                    resultat["costat"] += 1
                else:
                    resultat["lluny"].append((clau["c"], clau["n"], n_ara, None if ara is None else ara - b))

            # Les variants: la tolerància de l'era amb les rimes d'ara, i si les
            # paraules continuen caient a les claus del perfil.
            for vi, perfil in enumerate(clau["p"]):
                claus_perfil = perfil.split("|")
                fora = []
                for j, clau_dialecte in zip(altres, claus_perfil):
                    codi = dades.codis[j]
                    if n_ara is None or not dins_de_la_tolerancia(
                            n_ara, rimes[codi].get(clau_dialecte, 0), dades_carril["tolerancia"]):
                        fora.append(nom_dialecte(codi))
                if fora:
                    resultat["fora_de_variants"].append((clau["c"], vi, ", ".join(fora)))

                for posicio in clau["v"][vi]:
                    paraula = normalitzada_de(era["paraules"][posicio])
                    for j, clau_dialecte in zip(altres, claus_perfil):
                        codi = dades.codis[j]
                        ara_claus = claus_de[codi].get(paraula)
                        # Sense claus és un ERROR (ja no és objectiu), no un canvi de rima.
                        if ara_claus and ara_claus != {clau_dialecte}:
                            resultat["paraules_canviades"].append(
                                (paraula, nom_dialecte(codi), clau_dialecte, sorted(ara_claus)))

    # Les claus noves: les que ara podrien entrar a l'era i no hi són.
    for clau, unitat in sorted(ve.unitats_de(dades, mena).items()):
        if clau in a_l_era or ve.bossa_de(unitat.n, talls) is None:
            continue
        if ve.variants_valides(unitat, ic, dades_carril["tolerancia"]):
            resultat["noves"].append(clau)
    return resultat


# ---------------------------------------------------------- Substitucions

def proposar_substitucio(era, referencia, dades, usades):
    """Una paraula per posar al lloc d'una que ja no val: de la mateixa clau i, si
    pot ser, de la mateixa variant (el mateix perfil de claus). No pot ser cap de les
    que ja són al carril (`usades`), que no es repetiria dins la rotació. Tria sempre
    la mateixa, per l'ordre estable de les paraules. Torna la paraula normalitzada,
    o None si la clau no en té cap altra."""
    if referencia.carril == "roda":
        return proposar_per_a_la_roda(era, referencia, dades, usades)

    unitat = ve.unitats_de(dades, ve.MENA_DE[referencia.carril]).get(referencia.clau["c"])
    if unitat is None:
        return None

    perfil = referencia.clau["p"][referencia.variant]
    mateixa_variant = [p for v in unitat.variants if ve.perfil_de(v, dades.i_canonic) == perfil
                       for p in v.paraules]
    tolerancia = era["carrils"][referencia.carril]["tolerancia"]
    d_una_altra = [p for v in ve.variants_valides(unitat, dades.i_canonic, tolerancia) for p in v.paraules]
    for grup in (mateixa_variant, d_una_altra):
        triades = sorted((p for p in grup if p not in usades), key=ve.ordre_estable)
        if triades:
            return triades[0]
    return None


def proposar_per_a_la_roda(era, referencia, dades, usades):
    """El mateix per a una paraula de la roda: les entrades de la roda són claus
    consonants del central, o sigui que la substituta és d'una altra paraula de la
    mateixa entrada que encara es pugui jugar. Sense variants ni tolerància: la roda
    no en té."""
    entrada = referencia.clau["v"][0]
    clau = None
    for posicio in entrada:
        clau = dades.clau_central("cons", normalitzada_de(era["paraules"][posicio]))
        if clau:
            break
    unitat = ve.unitats_de(dades, "cons").get(clau) if clau else None
    if unitat is None:
        return None
    triades = sorted((p for v in unitat.variants for p in v.paraules if p not in usades),
                     key=ve.ordre_estable)
    return triades[0] if triades else None


def aplicar_substitucions(era, substitucions, mostrar_de):
    """Posa cada paraula proposada al lloc de la que ja no val: la variant en té la
    mateixa llargada i res no es mou. `substitucions` és [(Referencia, paraula)].
    La paraula nova s'afegeix al final de `paraules` si encara no hi era."""
    posicions = {normalitzada_de(cos): i for i, cos in enumerate(era["paraules"])}
    for referencia, paraula in substitucions:
        if paraula not in posicions:
            mostrar = mostrar_de.get(paraula, paraula)
            posicions[paraula] = len(era["paraules"])
            era["paraules"].append(paraula if mostrar == paraula else f"{paraula}>{mostrar}")
        referencia.clau["v"][referencia.variant][referencia.posicio] = posicions[paraula]


# ------------------------------------------------------------- L'informe

def comprovar(eres, dades, tros_per_dialecte, avui, dates=None):
    """Totes les comprovacions. Torna un diccionari:
         resolucio   {id d'era: {codi: [posicions]}} per a TOTES les eres
         errors      [(era, [Problema], Referencia, data, proposta)]: un per paraula i lloc
         linies      l'informe, llest per imprimir
         substitucions {id d'era: [(Referencia, paraula)]}
    `dates` és {"era:carril:posicio": primera data} (vegeu formula.mjs), si n'hi ha."""
    dates = dates or {}
    resolucio = {}
    linies = []
    errors = []
    substitucions = {}
    comprovades = {era["id"] for era in eres_a_comprovar(eres, avui)}

    for era in sorted(eres, key=lambda e: e["id"]):
        resolucio[era["id"]], problemes = resoldre(era, dades, tros_per_dialecte)
        if era["id"] not in comprovades:
            continue

        errors_abans = len(errors)
        carrils = era["carrils"] if era["algorisme"] == 1 else {}
        if carrils:
            quantes = {carril: sum(len(b["claus"]) for b in carrils[carril]["bosses"]) for carril in ve.CARRILS}
            titol = (f"Paraules del dia congelades (era {era['id']}, des del {era['inici']}): "
                     f"{mil(quantes['dificil'])} claus consonants i {mil(quantes['facil'])} grups assonants")
        else:
            titol = (f"Paraules del dia congelades (era {era['id']}, la roda, des del {era['inici']}): "
                     f"{mil(len(paraules_referenciades(era)))} paraules")
        linies.append(titol)

        # --- Els errors, amb una substitució proposada
        if carrils:
            usades = {carril: {normalitzada_de(era["paraules"][p])
                               for bossa in dades_c["bosses"] for clau in bossa["claus"]
                               for variant in clau["v"] for p in variant}
                      for carril, dades_c in carrils.items()}
        else:
            usades = {"roda": {normalitzada_de(era["paraules"][p]) for p in paraules_referenciades(era)}}
        per_paraula = {}
        # Els dialectes, en l'ordre de la tira (central, nord-occidental, valencià, balear).
        for problema in sorted(problemes, key=lambda p: (p.idx, dades.codis.index(p.codi))):
            per_paraula.setdefault(problema.idx, []).append(problema)
        for idx, dels_dialectes in per_paraula.items():
            motiu = descriure(dels_dialectes)
            for referencia in referencies_de(era, idx):
                data = dates.get(f"{era['id']}:{referencia.carril}:{idx}")
                proposta = proposar_substitucio(era, referencia, dades, usades[referencia.carril])
                if proposta:
                    usades[referencia.carril].add(proposta)
                    substitucions.setdefault(era["id"], []).append((referencia, proposta))
                lloc = f"{data}, " if data else ""
                linies.append(
                    f"  ERROR  «{dels_dialectes[0].paraula}» ({lloc}{NOM_CARRIL[referencia.carril]}): {motiu} "
                    + (f"-> proposta: «{dades.mostrar_de.get(proposta, proposta)}»" if proposta
                       else "-> cal substituir-la a mà: la clau no té cap altra paraula"))
                errors.append((era, dels_dialectes, referencia, data, proposta))

        if not carrils:
            if len(errors) == errors_abans:
                linies.append("  totes les paraules de la roda es poden jugar als quatre dialectes")
            continue

        # --- Els avisos
        analisi = {carril: analitzar_carril(era, carril, dades) for carril in ve.CARRILS}
        total = sum(a["claus"] for a in analisi.values())
        desplacades = sum(a["costat"] + len(a["lluny"]) for a in analisi.values())
        for carril, a in analisi.items():
            for clau, n_antiga, n_ara, salt in a["lluny"]:
                if n_ara is None:
                    linies.append(f"  avís   {NOM_CARRIL[carril]}: la clau -{clau} ja no és al central "
                                  f"(en tenia {mil(n_antiga)})")
                elif salt is None:
                    linies.append(f"  avís   {NOM_CARRIL[carril]}: la clau -{clau} ha passat de {mil(n_antiga)} a "
                                  f"{mil(n_ara)} rimes i ja no cau a cap bossa de l'era")
                else:
                    linies.append(f"  avís   {NOM_CARRIL[carril]}: la clau -{clau} ha passat de {mil(n_antiga)} a "
                                  f"{mil(n_ara)} rimes ({_bosses(salt)})")
        costat = sum(a["costat"] for a in analisi.values())
        if costat:
            linies.append(f"  avís   {mil(costat)} claus han canviat a la bossa del costat")
        for carril, a in analisi.items():
            if a["fora_de_variants"]:
                noms = ", ".join(f"-{c} ({d})" for c, _, d in a["fora_de_variants"][:5])
                linies.append(f"  avís   {NOM_CARRIL[carril]}: {mil(len(a['fora_de_variants']))} variants han sortit de la "
                              f"tolerància de l'era: {noms}{'...' if len(a['fora_de_variants']) > 5 else ''}")
        canviades = {(p, d) for a in analisi.values() for p, d, _, _ in a["paraules_canviades"]}
        if canviades:
            noms = ", ".join(f"«{p}» ({d})" for p, d in sorted(canviades)[:5])
            linies.append(f"  avís   {mil(len(canviades))} paraules han canviat de rima en algun dialecte: "
                          f"{noms}{'...' if len(canviades) > 5 else ''}")

        # --- Quan convé una era nova
        noves = sum(len(a["noves"]) for a in analisi.values())
        if total and Fraction(desplacades, total) > LLINDAR:
            linies.append(f"  -> s'han desplaçat {mil(desplacades)} de {mil(total)} claus "
                          f"({_percentatge(desplacades, total)}): convé una era nova")
        if total and Fraction(noves, total) > LLINDAR:
            linies.append(f"  -> hi ha {mil(noves)} claus noves que podrien entrar a l'era "
                          f"({_percentatge(noves, total)} de les {mil(total)} que hi són): convé una era nova")
        if len(linies) and linies[-1] == titol:
            linies.append(f"  sense canvis: {mil(desplacades)} claus desplaçades, {mil(noves)} noves")

    return {"resolucio": resolucio, "errors": errors, "linies": linies, "substitucions": substitucions}


def _percentatge(a, b):
    return f"{100 * a / b:.1f} %".replace(".", ",")


def _bosses(salt):
    quantes = abs(salt)
    cap = "amunt" if salt > 0 else "avall"
    nombre = {2: "dues"}.get(quantes, str(quantes))
    return f"{nombre} bosses més {cap}"
