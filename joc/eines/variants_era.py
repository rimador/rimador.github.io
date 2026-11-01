"""
Les claus, les variants i el contingut d'una era.

És tot el que el congelador (congelar_era.py) i el panell (bosses_rimes.py) saben
fer amb les dades: quines claus poden sortir, en quines variants es parteixen,
quines passen la tolerància, quines paraules se'n guarden i en quin ordre.

NO CONTÉ CAP FÓRMULA DE LA PARAULA DEL DIA. L'ordre en què surten les coses ho
decideix el JS (joc/js/eres.js) i aquí només es prepara el que s'hi congela; quan
cal saber on s'ha quedat una era, es crida node (vegeu formula.mjs).

Els mots (vegeu PROPOSTA_TRIA_DE_PARAULES.md, apartat 4.4):

  unitat     el que es tria: una clau consonant al difícil, un grup assonant al
             fàcil. Aquí en diem «clau» per abreujar.
  variant    dins d'una clau del central, les paraules que tenen la mateixa
             combinació de claus als altres tres dialectes. Cada rima dels altres
             dialectes té el seu torn, i tots els torns valen igual.
  tolerància a cada dialecte que no és el central, la clau de la variant ha de tenir
             entre n/f i n·f rimes, on n són les de la clau al central.
"""

import collections
import json
import os
import subprocess
import sys
from fractions import Fraction

DIR_EINES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_EINES)

import finestra_rimes as fr  # noqa: E402
import generar_dades as gd  # noqa: E402
import camins  # noqa: E402  (el generar_dades ja l'ha posat al camí)

# Els dos carrils amb la mena de rima que fan servir: el difícil tria claus
# consonants, el fàcil grups assonants. Els noms de les menes són els de
# finestra_rimes.py.
CARRILS = ("dificil", "facil")
MENA_DE = {"dificil": "cons", "facil": "asson"}


# ------------------------------------------------------------------- Node

def crida_node(ordre, entrada):
    """Una ordre de formula.mjs, el pont cap a la fórmula del joc: el JSON d'entrada
    per stdin i el de sortida per stdout. Python no té cap còpia de la fórmula."""
    cami = os.path.join(DIR_EINES, "formula.mjs")
    try:
        resultat = subprocess.run(["node", cami, ordre], input=json.dumps(entrada),
                                  capture_output=True, text=True, encoding="utf-8")
    except FileNotFoundError:
        raise SystemExit("Cal node (v18 o superior) per calcular amb la fórmula del joc "
                         "i no el trobo: la fórmula només és al JS.")
    if resultat.returncode != 0:
        raise SystemExit(f"node ha fallat amb «{ordre}»: {resultat.stderr.strip()}")
    return json.loads(resultat.stdout)


# --------------------------------------------------------------- Les quotes


def normalitzar_quotes(quotes, total=1000):
    """Quotes de qualsevol escala (15, 1.5, 0.4...) a enters que sumen exactament
    `total`: el per mil de la fórmula. Cada quota val la seva part de la suma, i
    el que falta per arribar a `total` es reparteix pel residu més gran; en cas
    d'empat, la bossa de número més baix. Tot en fraccions, sense decimals que
    arrodonir d'una manera o d'una altra segons l'ordinador."""
    valors = [Fraction(str(quota)) for quota in quotes]
    if not valors or any(valor < 0 for valor in valors) or sum(valors) <= 0:
        raise ValueError("Les quotes han de ser positives (o zero) i sumar més de zero")
    suma = sum(valors)
    exactes = [valor * total / suma for valor in valors]
    enters = [int(exacte) for exacte in exactes]
    falten = total - sum(enters)
    per_residu = sorted(range(len(valors)), key=lambda i: (-(exactes[i] - enters[i]), i))
    for i in per_residu[:falten]:
        enters[i] += 1
    return enters


def talls_de(config):
    """Els talls de les bosses com a (des de, fins a), tots dos inclosos."""
    de = config["des_de"]
    for bossa in config["bosses"]:
        yield de, bossa["fins"]
        de = bossa["fins"] + 1


def bossa_de(rimes, talls):
    """A quina bossa cau una clau amb aquestes rimes al central, o None si cau fora
    de totes."""
    for i, (de, fins) in enumerate(talls):
        if de <= rimes <= fins:
            return i
    return None


# ------------------------------------------------------- Llegir les dades


class Dades:
    """El que surt de llegir el diccionari: per a cada mena de rima, quantes rimes
    té cada clau a cada dialecte i a quines claus cau cada paraula objectiu."""

    def __init__(self, codis, canonic, per_mena, mostrar_de):
        self.codis = codis
        self.canonic = canonic
        self.i_canonic = codis.index(canonic)
        self.per_mena = per_mena
        self.mostrar_de = mostrar_de
        self.resolubles = None      # es calcula el primer cop (vegeu paraules_resolubles)
        self.unitats = {}           # per mena de rima (vegeu unitats_de)

    def clau_central(self, mena, paraula):
        """La clau d'una paraula al central, o None si no hi és objectiu o hi cau
        a més d'una clau."""
        claus = self.per_mena[mena][1][self.canonic].get(paraula)
        return next(iter(claus)) if claus and len(claus) == 1 else None


def llegir_dades():
    """Llegeix el diccionari i compta les rimes de cada dialecte (uns trenta
    segons). És el mateix recompte que fa servir el generador del joc."""
    codis = gd.ordre_de_tira(camins.dialectes())
    canonic = camins.CENTRAL if camins.CENTRAL in codis else codis[0]
    print("Llegint el diccionari...")
    base = gd.preparar_diccionari()
    for codi in codis:
        apendix = gd.llegir_apendix(codi)
        if apendix:
            base["apendixs"][codi] = apendix
    print("Comptant les rimes de cada dialecte...")
    per_mena, mostrar_de = fr.comptar(base, codis)
    return Dades(codis, canonic, per_mena, mostrar_de)


# ------------------------------------------------- Candidates i variants

Candidata = collections.namedtuple("Candidata", "paraula claus rimes")


class Variant:
    """Les paraules d'una clau del central que tenen les mateixes claus als altres
    dialectes. `claus` i `rimes` van en l'ordre dels dialectes (`Dades.codis`)."""

    __slots__ = ("claus", "rimes", "paraules")

    def __init__(self, claus, rimes, paraules):
        self.claus = claus
        self.rimes = rimes
        self.paraules = paraules


class Unitat:
    """Una clau del central amb les seves variants (encara sense la tolerància) i
    les rimes que té al central (n)."""

    __slots__ = ("clau", "n", "variants")

    def __init__(self, clau, n, variants):
        self.clau = clau
        self.n = n
        self.variants = variants


def paraules_resolubles(dades):
    """Les paraules que el joc pot resoldre als quatre dialectes: objectiu a tots,
    i caient a UNA sola clau consonant PUBLICADA a cadascun (sense homògrafs com
    «dona» / «dóna»; i amb alguna rima, que és el que vol dir publicada).

    Que la clau sigui publicada és el que fa que l'index.json tingui on apuntar:
    una paraula la clau de la qual només té ella mateixa (la majoria de formes
    rares) és al fitxer però no a la llista de claus, i no es podria jugar. Passa
    també al fàcil, on el que es tria és el grup assonant: el grup pot tenir mil
    rimes i la paraula, però, no ser resoluble."""
    if dades.resolubles is None:
        rimes, claus_de = dades.per_mena["cons"]
        resolubles = None
        for codi in dades.codis:
            aqui = {p for p, claus in claus_de[codi].items()
                    if len(claus) == 1 and rimes[codi][next(iter(claus))] >= gd.MIN_RIMES_PUBLICADES}
            resolubles = aqui if resolubles is None else resolubles & aqui
        dades.resolubles = resolubles or set()
    return dades.resolubles


def candidates_de(dades, mena):
    """Les paraules que poden ser paraula del dia (apartat 4.5 de la proposta):
    les resolubles als quatre dialectes (vegeu paraules_resolubles), amb les claus
    i les rimes que tenen a cada dialecte en la mena de rima del carril."""
    rimes, claus_de = dades.per_mena[mena]
    candidates = []
    for paraula in sorted(paraules_resolubles(dades) & set(claus_de[dades.canonic])):
        claus = tuple(next(iter(claus_de[codi][paraula])) for codi in dades.codis)
        candidates.append(Candidata(
            paraula, claus, tuple(rimes[codi][clau] for codi, clau in zip(dades.codis, claus))))
    return candidates


def construir_unitats(candidates, i_canonic):
    """Agrupa les candidates per clau del central i, dins de cada clau, per
    variant: la combinació de claus que tenen als quatre dialectes."""
    per_unitat = collections.defaultdict(lambda: collections.defaultdict(list))
    for candidata in candidates:
        per_unitat[candidata.claus[i_canonic]][candidata.claus].append(candidata)

    unitats = {}
    for clau, variants in per_unitat.items():
        n = next(iter(variants.values()))[0].rimes[i_canonic]
        unitats[clau] = Unitat(clau, n, [
            Variant(claus, grup[0].rimes, [c.paraula for c in grup])
            for claus, grup in sorted(variants.items())
        ])
    return unitats


def unitats_de(dades, mena):
    """Les unitats candidates d'una mena de rima, que es calculen un sol cop per
    cada lectura del diccionari (n'hi ha mig milió de paraules per mirar)."""
    if mena not in dades.unitats:
        dades.unitats[mena] = construir_unitats(candidates_de(dades, mena), dades.i_canonic)
    return dades.unitats[mena]


def variants_valides(unitat, i_canonic, tolerancia):
    """Les variants que passen la tolerància. A cada dialecte que no és el central,
    la clau de la variant ha de tenir entre n/f i n·f rimes, on n són les de la
    clau al central i f la tolerància (2 vol dir ×0,5–×2). Els límits hi són
    inclosos. Es compta amb fraccions: n/f no ha de dependre dels decimals."""
    f = Fraction(str(tolerancia))
    return [variant for variant in unitat.variants
            if all(j == i_canonic
                   or (variant.rimes[j] * f >= unitat.n and variant.rimes[j] <= unitat.n * f)
                   for j in range(len(variant.rimes)))]


# ------------------------------------------ El contingut d'un carril

def ordre_estable(paraula):
    """L'ordre de sempre de les paraules d'una variant: un resum del text, sense
    cap llista escrita a mà i sense afavorir les que van primer per ordre
    alfabètic (vegeu barreja_estable a generar_dades.py)."""
    return (gd.barreja_estable(paraula), paraula)


def ordenar_variants(carril, unitat, valides, previes):
    """L'ordre de les variants d'una clau: una barreja estable, i si l'era anterior
    ja en tenia, les que hi eren mantenen el seu lloc i les noves van al final.
    Una variant «hi era» si comparteix alguna paraula amb una de l'era anterior
    (amb les paraules, i no amb les claus, una correcció de transcripció no la fa
    passar per nova)."""
    per_barreja = sorted(valides, key=lambda v: (
        gd.barreja_estable(f"{carril}|{unitat.clau}|{'|'.join(v.claus)}"), v.claus))
    if not previes:
        return per_barreja

    def lloc_antic(variant):
        paraules = set(variant.paraules)
        for lloc, antiga in enumerate(previes):
            if paraules.intersection(antiga):
                return lloc
        return None

    posicio = {id(v): i for i, v in enumerate(per_barreja)}
    amb_lloc = [(lloc_antic(v), posicio[id(v)], v) for v in per_barreja]
    # Primer les que ja hi eren (per l'ordre antic), després les noves.
    return [v for _, _, v in sorted(
        amb_lloc, key=lambda x: (x[0] is None, x[0] if x[0] is not None else 0, x[1]))]


def ordenar_paraules(variant, carril, previes, excloses, maxim):
    """Les paraules d'una variant que es guarden, en ordre.

    Les que ja hi eren a l'era anterior mantenen l'ordre i van primer, i les noves
    van al final: si es tornés a ordenar tot, la rotació podria tornar a començar
    per una paraula que acaba de sortir. Al fàcil, les noves porten primer les que
    no són a cap llista del difícil, perquè una mateixa paraula no surti als dos
    carrils; les altres només hi entren si no n'hi ha prou."""
    candidates = set(variant.paraules)
    mantingudes = []
    vistes = set()
    for antiga in previes or ():
        for paraula in antiga:
            if paraula in candidates and paraula not in vistes:
                mantingudes.append(paraula)
                vistes.add(paraula)

    if carril == "facil":
        noves = sorted((p for p in variant.paraules if p not in vistes),
                       key=lambda p: (p in excloses, *ordre_estable(p)))
    else:
        noves = sorted((p for p in variant.paraules if p not in vistes), key=ordre_estable)
    return (mantingudes + noves)[:maxim]


def perfil_de(variant, i_canonic):
    """Les claus d'una variant als dialectes que no són el central, en l'ordre dels
    dialectes i separades per «|» («nw|va|ba»): és el que fa que una variant sigui
    aquesta i no una altra, i amb el que es veu si una paraula ha canviat de rima."""
    return "|".join(clau for j, clau in enumerate(variant.claus) if j != i_canonic)


def construir_carril(carril, unitats, config, i_canonic, previ=None, excloses=frozenset()):
    """El contingut congelat d'un carril: les bosses, amb les claus de cada una en
    ordre canònic i, de cada clau, les variants i les paraules en ordre.

    Cada clau és { c, n, v, p }: la clau, les rimes que tenia al central en congelar,
    les variants (llistes de paraules) i, de cada variant, el seu perfil (perfil_de).

    `config` és { des_de, bosses: [{fins, quota}], tolerancia, paraules_per_variant }.
    `previ` és el que hi havia a l'era anterior: { clau: [[paraules], ...] }, les
    variants de cada clau en ordre. `excloses` són les paraules de les llistes del
    difícil (només per al fàcil).

    Torna (carril, informe). Les paraules són text normalitzat; qui ho acaba de
    muntar les canvia per posicions (vegeu indexar_paraules)."""
    talls = list(talls_de(config))
    quotes = normalitzar_quotes([bossa["quota"] for bossa in config["bosses"]])
    maxim = int(config["paraules_per_variant"])
    bosses = [{"de": de, "fins": fins, "quota": quota, "claus": []}
              for (de, fins), quota in zip(talls, quotes)]
    informe = {
        "quotes": quotes,
        "candidates": [0] * len(talls),     # claus que cauen a la bossa pel central
        "fora_de_talls": [],                # claus amb menys de des_de o més que l'última bossa
        "sense_variant": [],                # claus de la bossa sense cap variant que passi la tolerància
        "variants": 0,
        "variants_d_una_paraula": [],
        "paraules": 0,
    }

    for clau in sorted(unitats):
        unitat = unitats[clau]
        i = bossa_de(unitat.n, talls)
        if i is None:
            informe["fora_de_talls"].append((clau, unitat.n))
            continue
        informe["candidates"][i] += 1
        valides = variants_valides(unitat, i_canonic, config["tolerancia"])
        if not valides:
            informe["sense_variant"].append((clau, unitat.n))
            continue

        antigues = (previ or {}).get(clau)
        variants = []
        perfils = []
        for variant in ordenar_variants(carril, unitat, valides, antigues):
            paraules = ordenar_paraules(variant, carril, antigues, excloses, maxim)
            variants.append(paraules)
            perfils.append(perfil_de(variant, i_canonic))
            informe["variants"] += 1
            informe["paraules"] += len(paraules)
            if len(variant.paraules) == 1:
                informe["variants_d_una_paraula"].append((clau, paraules[0]))
        # `n` i `p` no els fa servir la fórmula (vegeu eres.js): són perquè
        # generar_dades.py pugui dir què ha canviat des que es va congelar.
        bosses[i]["claus"].append({"c": clau, "n": unitat.n, "v": variants, "p": perfils})

    carril_json = {
        "des_de": config["des_de"],
        "tolerancia": config["tolerancia"],
        "paraules_per_variant": maxim,
        "bosses": bosses,
    }
    return carril_json, informe


def paraules_del_carril(carril_json):
    """Totes les paraules guardades d'un carril, sense repetir."""
    return {paraula
            for bossa in carril_json["bosses"]
            for clau in bossa["claus"]
            for variant in clau["v"]
            for paraula in variant}


def indexar_paraules(carrils, mostrar_de):
    """Canvia les paraules de cada variant per la seva posició a una llista única
    de l'era (`paraules`), amb la forma per mostrar després d'un «>» quan porta
    accents, com a la llista «diaries» de l'index.json. Torna la llista."""
    paraules = []
    posicions = {}

    def posicio(paraula):
        if paraula not in posicions:
            mostrar = mostrar_de.get(paraula, paraula)
            posicions[paraula] = len(paraules)
            paraules.append(paraula if mostrar == paraula else f"{paraula}>{mostrar}")
        return posicions[paraula]

    for carril in CARRILS:
        for bossa in carrils[carril]["bosses"]:
            for clau in bossa["claus"]:
                clau["v"] = [[posicio(p) for p in variant] for variant in clau["v"]]
    return paraules


def llegir_eres(cami):
    """Les eres d'un eres.json (o d'un eres_arxiu.json), o res si no existeix."""
    if not os.path.exists(cami):
        return []
    with open(cami, encoding="utf-8") as fitxer:
        return json.load(fitxer)["eres"]


def escriure_eres(cami, eres):
    """Una era per línia: un canvi es veu al diff sense haver de buscar-lo dins
    d'una sola línia de mig megabyte. Torna si ha calgut escriure'l."""
    cos = ",\n".join(json.dumps(era, ensure_ascii=False, separators=(",", ":")) for era in eres)
    return gd.escriure_si_cal(cami, '{"v":1,"eres":[\n' + cos + '\n]}\n')


def previ_d_un_carril(era, carril):
    """El que una era ja congelada (algorisme 1) deixa a la següent: de cada clau,
    les variants en ordre i, de cada variant, les paraules normalitzades en ordre."""
    normalitzades = [cos.split(">", 1)[0] for cos in era["paraules"]]
    return {
        clau["c"]: [[normalitzades[i] for i in variant] for variant in clau["v"]]
        for bossa in era["carrils"][carril]["bosses"]
        for clau in bossa["claus"]
    }


def previ_de_la_roda(era0, clau_de):
    """El mateix per a l'era 0, la roda: cada entrada és una clau del central amb
    fins a quatre paraules, sense variants. `clau_de(carril, paraula)` diu a quina
    unitat cau cada paraula (la clau consonant al difícil, el grup assonant al
    fàcil). Al fàcil, les entrades d'un mateix grup es junten en l'ordre de la roda."""
    previ = {carril: collections.defaultdict(lambda: [[]]) for carril in CARRILS}
    for entrada in era0["roda"]["claus"]:
        paraules = [era0["paraules"][i].split(">", 1)[0] for i in entrada]
        for carril in CARRILS:
            unitat = clau_de(carril, paraules[0])
            if unitat is not None:
                previ[carril][unitat][0].extend(paraules)
    return {carril: dict(previ[carril]) for carril in CARRILS}


# ------------------------------------------- L'il·limitat natiu (el panell)


def unitats_natives(dades, codi, mena):
    """Les unitats que l'il·limitat natiu pot treure en un dialecte: [clau, rimes,
    paraules jugables]. Es compten amb les rimes PRÒPIES del dialecte (sense mirar
    els altres) i només amb les paraules objectiu que es poden jugar en aquell
    dialecte:

      - que no cauen a dues claus consonants del dialecte: els homògrafs no hi
        surten mai, perquè el jugador veuria «dona» sense saber quina lectura toca;
      - que la seva clau consonant sigui publicada (amb alguna rima): l'index del
        joc només porta les claus publicades, i una paraula d'una clau que només
        té ella mateixa no es pot servir. També al fàcil, on la unitat és el grup."""
    rimes_cons, claus_cons = dades.per_mena["cons"]
    rimes, claus_de = dades.per_mena[mena]
    jugables = collections.Counter()
    for paraula, claus in claus_cons[codi].items():
        if len(claus) != 1:
            continue
        clau_cons = next(iter(claus))
        if rimes_cons[codi][clau_cons] < gd.MIN_RIMES_PUBLICADES:
            continue
        unitat = clau_cons if mena == "cons" else next(iter(claus_de[codi][paraula]))
        jugables[unitat] += 1
    return [[clau, rimes[codi][clau], quantes] for clau, quantes in sorted(jugables.items())]
