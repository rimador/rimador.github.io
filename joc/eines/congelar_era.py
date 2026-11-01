"""
Congela una era de la paraula del dia: escriu a joc/dades/eres.json el contingut
de les bosses en un moment donat.

    python3 joc/eines/congelar_era.py --era0
    python3 joc/eines/congelar_era.py --inici 2026-12-01 [--config joc/eines/config_era.json]
    python3 joc/eines/congelar_era.py --inici 2026-12-01 --per-defecte --simula

QUÈ ÉS UNA ERA (vegeu PROPOSTA_TRIA_DE_PARAULES.md, apartat 4.7): una data d'inici,
les bosses amb les seves quotes i el contingut de cada bossa congelat. Dura fins
que comença la següent. No es congelen dies, els dies es calculen: el que es
congela és quines claus hi ha a cada bossa, en quines variants es parteixen i
quines paraules se'n guarden. Amb quines rimes es juga ho decideix sempre el
diccionari del moment, i per això corregir transcripcions no demana cap era nova.

LES DUES FEINES:

  --era0     Congela l'era 0, la roda d'abans, amb una còpia del bloc «diaries» de
             l'index.json d'ara. Els dies passats queden fixos per sempre. Només
             es fa un cop.
  --inici    Congela una era nova que comença aquell dia. La configuració (talls,
             quotes, tolerància i paraules per variant de cada carril) surt del
             panell, que l'exporta a joc/eines/config_era.json (vegeu
             bosses_rimes_eres.py), o de la proposta de PER_DEFECTE amb --per-defecte.

LES NORMES (apartat 7 de la proposta):

  - Una era nova comença com a mínim d'aquí a 7 dies: és el marge per a qui tingui
    una còpia desada sense xarxa.
  - Una era començada no es toca. Una de futura només es pot substituir
    (--substitueix) mentre en falten 7 dies o més.
  - Les quotes es normalitzen a enters que sumen 1.000 (per mil).
  - Es refusa una bossa amb quota i cap clau: aquells dies no hi hauria paraula.
  - Les paraules que ja eren a l'era anterior mantenen l'ordre i les noves van al
    final, i l'estat de sortida de l'era anterior (on s'havia quedat cada bossa i
    quantes vegades ha sortit cada clau) es desa a l'era nova. El calcula node, amb
    el mateix mòdul del joc (formula.mjs): aquí no hi ha cap còpia de la fórmula.
  - Les eres més velles que l'anterior a la vigent passen a eres_arxiu.json, que el
    joc no carrega.

Després de congelar, cal tornar a executar generar_dades.py: l'index.json ha de
portar a quina clau cau ara cada paraula de l'era nova a cada dialecte.

--simula fa tota la feina i l'informe sense escriure res.
"""

import argparse
import collections
import copy
import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

DIR_EINES = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_EINES)

import variants_era as ve  # noqa: E402
import generar_dades as gd  # noqa: E402
import camins  # noqa: E402

MARGE_DIES = 7
ERA_ZERO_INICI = "2026-01-01"       # l'època de la roda: no canvia mai
CONFIG = os.path.join(DIR_EINES, "config_era.json")
INFORME = os.path.join(DIR_EINES, "informe_era.txt")

# Quin carril és quina mena de rima a la configuració del panell (bosses_rimes_eres.py).
MENA_DEL_PANELL = {"consonant": "dificil", "assonant": "facil"}


# La crida a node (formula.mjs) es a variants_era.py, que tambe la fan servir les comprovacions.
crida_node = ve.crida_node


# ------------------------------------------------- Llegir i escriure

# Es llegeixen i s'escriuen igual des de generar_dades.py (que hi pot substituir
# paraules de l'era vigent), o sigui que viuen a variants_era.py.
llegir_eres = ve.llegir_eres
escriure_eres = ve.escriure_eres


def llegir_config(cami):
    with open(cami, encoding="utf-8") as fitxer:
        config = json.load(fitxer)
    carrils = config.get("carrils", config)
    return validar_config({carril: carrils.get(carril) for carril in ve.CARRILS})


def config_per_defecte():
    """La proposta de bosses_rimes_eres.py (PER_DEFECTE) amb els noms dels carrils."""
    import bosses_rimes_eres
    return validar_config({
        carril: copy.deepcopy(bosses_rimes_eres.PER_DEFECTE[mena])
        for mena, carril in MENA_DEL_PANELL.items()
    })


def validar_config(config):
    for carril in ve.CARRILS:
        c = config.get(carril)
        if c is None:
            raise SystemExit(f"A la configuració li falta el carril «{carril}».")
        if int(c["des_de"]) < gd.MIN_RIMES_PUBLICADES:
            raise SystemExit(f"{carril}: la primera bossa no pot començar per sota de "
                             f"{gd.MIN_RIMES_PUBLICADES} rimes.")
        anterior = int(c["des_de"]) - 1
        for bossa in c["bosses"]:
            if int(bossa["fins"]) <= anterior:
                raise SystemExit(f"{carril}: els talls han de ser creixents (hi ha un {bossa['fins']} "
                                 f"després d'un {anterior}).")
            anterior = int(bossa["fins"])
        if float(c.get("tolerancia", 2)) < 1:
            raise SystemExit(f"{carril}: la tolerància ha de ser 1 o més (×0,5–×2 és un factor 2).")
        c.setdefault("tolerancia", 2)
        c["paraules_per_variant"] = int(c.get("paraules_per_variant", 10 if carril == "dificil" else 200))
        if c["paraules_per_variant"] < 1:
            raise SystemExit(f"{carril}: cal guardar com a mínim una paraula per variant.")
    return config


# ------------------------------------------------------------ L'era 0

def congelar_era0(index):
    """L'era 0: la roda d'abans amb la llista «diaries» d'avui copiada i congelada.
    No porta el bloc «on» (les posicions de les claus de cada dialecte), perquè
    canvien a cada regeneració: les paraules es resolen com les de qualsevol altra
    era, amb el bloc que escriu generar_dades.py."""
    diaries = index["diaries"]
    return {
        "id": 0,
        "inici": ERA_ZERO_INICI,
        "algorisme": 0,
        "congelada": date.today().isoformat(),
        "paraules": diaries["paraules"],
        "roda": {"claus": diaries["claus"]},
    }


# ---------------------------------------------------- L'estat d'entrada

def entrada_des_de_la_roda(estat, era0, clau_de):
    """L'estat de sortida de la roda (que ha calculat node) traduït a unitats de
    l'era nova: la roda treu entrades (claus del central) i l'era nova en treu
    claus consonants al difícil i grups assonants al fàcil. Un grup compta les
    vegades que ha sortit qualsevol de les seves entrades, i és «sortit» si n'ha
    sortit alguna a la volta a mitges."""
    entrada = {}
    for carril in ve.CARRILS:
        sortides_roda = set(estat[carril]["sortides"])
        comptadors = collections.Counter()
        sortides = set()
        for i, entrada_roda in enumerate(era0["roda"]["claus"]):
            unitat = clau_de(carril, era0["paraules"][entrada_roda[0]].split(">", 1)[0])
            if unitat is None:
                continue
            comptadors[unitat] += estat[carril]["comptadors"][i]
            if i in sortides_roda:
                sortides.add(unitat)
        entrada[carril] = {"comptadors": dict(sorted(comptadors.items())),
                           "sortides": sorted(sortides)}
    return entrada


# ------------------------------------------------------ Una era nova

def construir_era(dades, config, inici, previ_era, crida=crida_node):
    """L'era nova a partir de les dades, la configuració i l'era anterior.
    Torna (era, informe)."""
    unitats = {
        carril: ve.construir_unitats(ve.candidates_de(dades, ve.MENA_DE[carril]), dades.i_canonic)
        for carril in ve.CARRILS
    }

    def clau_de(carril, paraula):
        return dades.clau_central(ve.MENA_DE[carril], paraula)

    # Què deixa l'era anterior: l'ordre de les seves variants i paraules, i on
    # s'havia quedat cada clau.
    if previ_era["algorisme"] == 0:
        previ = ve.previ_de_la_roda(previ_era, clau_de)
        entrada = entrada_des_de_la_roda(
            crida("estat-roda", {"era": previ_era, "final": inici}), previ_era, clau_de)
    else:
        previ = {carril: ve.previ_d_un_carril(previ_era, carril) for carril in ve.CARRILS}
        estat = crida("estat-sortida", {"era": previ_era, "final": inici})
        entrada = {carril: {"comptadors": estat[carril]["comptadors"],
                            "sortides": estat[carril]["sortides"]} for carril in ve.CARRILS}

    carrils = {}
    informes = {}
    carrils["dificil"], informes["dificil"] = ve.construir_carril(
        "dificil", unitats["dificil"], config["dificil"], dades.i_canonic, previ["dificil"])
    # Al fàcil, primer les paraules que no són a cap llista del difícil.
    carrils["facil"], informes["facil"] = ve.construir_carril(
        "facil", unitats["facil"], config["facil"], dades.i_canonic, previ["facil"],
        excloses=ve.paraules_del_carril(carrils["dificil"]))

    # Una bossa amb quota i cap clau: aquells dies no hi hauria paraula.
    errors = []
    for carril in ve.CARRILS:
        for bossa, quota in zip(carrils[carril]["bosses"], informes[carril]["quotes"]):
            if quota > 0 and not bossa["claus"]:
                errors.append(f"{carril}: la bossa {bossa['de']}-{bossa['fins']} té quota "
                              f"({decimal(quota / 10)} %) i cap clau.")
    if errors:
        raise ValueError("\n".join(errors))

    for carril in ve.CARRILS:
        informes[carril]["patro"] = crida("patro", {"quotes": informes[carril]["quotes"]})
        carrils[carril]["entrada"] = entrada[carril]

    paraules = ve.indexar_paraules(carrils, dades.mostrar_de)
    era = {"id": previ_era["id"] + 1, "inici": inici, "algorisme": 1,
           "paraules": paraules, "carrils": carrils}
    return era, informes


def ordenar_i_arxivar(eres, nova, avui):
    """Les eres que es queden a eres.json (l'anterior a la vigent, la vigent i les
    futures) i les que passen a l'arxiu."""
    totes = sorted(eres + [nova], key=lambda era: era["inici"])
    vigent = max(i for i, era in enumerate(totes) if era["inici"] <= avui.isoformat())
    primera = max(0, vigent - 1)
    return totes[primera:], totes[:primera]


# --------------------------------------------------------- L'informe

def decimal(x):
    """0.5 -> '0,5', 2.0 -> '2', 0.6667 -> '0,67': amb coma, que és com
    s'escriu en català, i amb dues xifres decimals com a màxim."""
    return f"{round(x, 2):g}".replace(".", ",")


def durada(dies):
    if dies is None:
        return "mai"
    if dies < 45:
        return f"{dies:.0f} dies"
    anys, mesos = divmod(round(dies / 30.44), 12)
    parts = ([f"{anys} any" + ("s" if anys > 1 else "")] if anys else []) + \
            ([f"{mesos} mes" + ("os" if mesos > 1 else "")] if mesos else [])
    return "uns " + " i ".join(parts)


def escriure_informe(era, informes, config, sortida):
    """L'informe de la congelació: el resum per pantalla i, a `sortida`, el detall
    (les claus que han quedat fora i les variants d'una sola paraula, que convé
    revisar a mà: n'hi ha de legítimes, com «axis», i n'hi ha que fan pensar en un
    error de transcripció)."""
    mil = camins.mil
    linies = [f"Era {era['id']} des del {era['inici']}"]
    detall = list(linies)
    for carril in ve.CARRILS:
        informe = informes[carril]
        c = era["carrils"][carril]
        nom = {"dificil": "difícil", "facil": "fàcil"}[carril]
        tolerancia = float(c["tolerancia"])
        linies += ["", f"Carril {nom} (tolerància ×{decimal(1 / tolerancia)}–×{decimal(tolerancia)}, "
                       f"{c['paraules_per_variant']} paraules per variant)"]
        linies.append(f"  {'bossa':>16} {'claus':>6} {'al central':>11} {'quota':>7}   torna cada")
        for i, bossa in enumerate(c["bosses"]):
            quota = informe["quotes"][i]
            torna = len(bossa["claus"]) * 1000 / quota if quota else None
            linies.append(f"  {mil(bossa['de']) + '-' + mil(bossa['fins']):>16} {mil(len(bossa['claus'])):>6} "
                          f"{mil(informe['candidates'][i]):>11} {decimal(quota / 10) + '%':>7}   {durada(torna)}")
        claus = sum(len(b["claus"]) for b in c["bosses"])
        linies.append(f"  {mil(claus)} claus en joc; {mil(len(informe['sense_variant']))} sense cap variant que passi "
                      f"la tolerància; {mil(len(informe['fora_de_talls']))} fora dels talls")
        linies.append(f"  {mil(informe['variants'])} variants, {mil(informe['paraules'])} paraules guardades; "
                      f"{mil(len(informe['variants_d_una_paraula']))} variants d'una sola paraula")
        patro = informe["patro"]
        avis = "" if patro["errorMaxim"] < 1 else "  ATENCIÓ: passa d'un dia, vegeu la proposta (4.2)"
        linies.append(f"  patró de {mil(patro['periode'])} dies; error màxim de les quotes: "
                      f"{decimal(round(patro['errorMaxim'], 3))} dies{avis}")

        detall += ["", f"== {nom}: claus sense cap variant que passi la tolerància =="]
        detall += [f"  {clau}  ({mil(n)} rimes al central)" for clau, n in informe["sense_variant"]]
        detall += [f"== {nom}: claus fora dels talls =="]
        detall += [f"  {clau}  ({mil(n)} rimes al central)" for clau, n in informe["fora_de_talls"]]
        detall += [f"== {nom}: variants d'una sola paraula =="]
        detall += [f"  {clau}: {paraula}" for clau, paraula in informe["variants_d_una_paraula"]]

    mida = len(json.dumps(era, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    linies += ["", f"Mida de l'era: {mida / 1024:.0f} KB; {mil(len(era['paraules']))} paraules diferents."]
    texte = "\n".join(linies)
    if sortida:
        with open(sortida, "w", encoding="utf-8", newline="\n") as fitxer:
            fitxer.write("\n".join(linies + [""] + detall[1:]) + "\n")
    return texte


# ------------------------------------------------------------- Procés

def avui_a_catalunya():
    return datetime.now(ZoneInfo("Europe/Madrid")).date()


def main():
    analitzador = argparse.ArgumentParser(description="Congela una era de la paraula del dia.")
    analitzador.add_argument("--era0", action="store_true",
                             help="congela l'era 0 (la roda d'abans) amb el «diaries» d'avui")
    analitzador.add_argument("--inici", help="primer dia de l'era nova (AAAA-MM-DD)")
    analitzador.add_argument("--config", default=CONFIG,
                             help=f"la configuració que exporta el panell ({camins.relatiu(CONFIG)})")
    analitzador.add_argument("--per-defecte", action="store_true",
                             help="fa servir la proposta de PER_DEFECTE (bosses_rimes_eres.py) en lloc del panell")
    analitzador.add_argument("--simula", action="store_true", help="no escriu res: només l'informe")
    analitzador.add_argument("--substitueix", action="store_true",
                             help="substitueix l'última era si encara no ha començat (i en falten 7 dies o més)")
    analitzador.add_argument("--dades", default=gd.DIR_DADES,
                             help=f"on són eres.json i index.json ({camins.relatiu(gd.DIR_DADES)})")
    analitzador.add_argument("--informe", default=INFORME,
                             help=f"on es desa el detall de l'informe ({camins.relatiu(INFORME)})")
    analitzador.add_argument("--avui", help="AAAA-MM-DD: per provar el marge amb un altre «avui»")
    args = analitzador.parse_args()

    cami_eres = os.path.join(args.dades, "eres.json")
    cami_arxiu = os.path.join(args.dades, "eres_arxiu.json")
    eres = llegir_eres(cami_eres)

    if args.era0 == bool(args.inici):
        raise SystemExit("Cal triar una feina: --era0 o --inici AAAA-MM-DD.")

    # ----- L'era 0
    if args.era0:
        if any(era["id"] == 0 for era in eres):
            raise SystemExit("L'era 0 ja és congelada i no es toca: els dies passats són fixos.")
        with open(os.path.join(args.dades, "index.json"), encoding="utf-8") as fitxer:
            era0 = congelar_era0(json.load(fitxer))
        print(f"Era 0: la roda amb {camins.mil(len(era0['roda']['claus']))} claus i "
              f"{camins.mil(len(era0['paraules']))} paraules, des del {era0['inici']}.")
        if not args.simula:
            escriure_eres(cami_eres, sorted(eres + [era0], key=lambda era: era["inici"]))
            print(f"Desat a {camins.relatiu(cami_eres)}")
        return

    # ----- Una era nova
    try:
        inici = date.fromisoformat(args.inici)
    except ValueError:
        raise SystemExit(f"«{args.inici}» no és una data AAAA-MM-DD.")
    avui = date.fromisoformat(args.avui) if args.avui else avui_a_catalunya()
    if inici < avui + timedelta(days=MARGE_DIES):
        raise SystemExit(f"Una era nova ha de començar d'aquí a {MARGE_DIES} dies o més (el marge per a "
                         f"qui té una còpia desada sense xarxa): avui és {avui.isoformat()} i "
                         f"el primer dia possible és el {(avui + timedelta(days=MARGE_DIES)).isoformat()}.")

    if not eres:
        raise SystemExit("No hi ha cap era: congela primer l'era 0 (--era0).")
    eres.sort(key=lambda era: era["inici"])
    ultima = eres[-1]
    if date.fromisoformat(ultima["inici"]) > avui:
        # Una era futura encara es pot refer, mentre en falti el marge.
        if not args.substitueix:
            raise SystemExit(f"Ja hi ha una era {ultima['id']} congelada per al {ultima['inici']} que encara "
                             f"no ha començat. Per refer-la, --substitueix.")
        if date.fromisoformat(ultima["inici"]) < avui + timedelta(days=MARGE_DIES):
            raise SystemExit(f"L'era {ultima['id']} comença el {ultima['inici']}, d'aquí a menys de "
                             f"{MARGE_DIES} dies: ja no es pot tocar.")
        eres.pop()
        ultima = eres[-1]
    if inici <= date.fromisoformat(ultima["inici"]):
        raise SystemExit(f"L'era nova ha de començar després de l'era {ultima['id']} ({ultima['inici']}).")

    if args.per_defecte:
        config = config_per_defecte()
    elif os.path.exists(args.config):
        config = llegir_config(args.config)
    else:
        raise SystemExit(f"No trobo {camins.relatiu(args.config)}: exporta la configuració del panell "
                         f"(bosses_rimes_eres.py) o fes servir --per-defecte.")

    dades = ve.llegir_dades()
    try:
        era, informes = construir_era(dades, config, inici.isoformat(), ultima)
    except ValueError as error:
        raise SystemExit(f"No es pot congelar:\n{error}")

    print()
    print(escriure_informe(era, informes, config, None if args.simula else args.informe))

    actives, arxivades = ordenar_i_arxivar(eres, era, avui)
    if args.simula:
        print("\n(--simula: no s'ha escrit res)")
        return
    escriure_eres(cami_eres, actives)
    print(f"\nDesat a {camins.relatiu(cami_eres)}: eres {', '.join(str(e['id']) for e in actives)}.")
    print(f"Detall de l'informe: {camins.relatiu(args.informe)}")
    if arxivades:
        arxiu = {era["id"]: era for era in llegir_eres(cami_arxiu)}
        arxiu.update({era["id"]: era for era in arxivades})
        escriure_eres(cami_arxiu, [arxiu[i] for i in sorted(arxiu)])
        print(f"Passen a l'arxiu: eres {', '.join(str(e['id']) for e in arxivades)}.")
    print("Ara cal tornar a executar generar_dades.py: l'index.json ha de portar a quina clau "
          "cau cada paraula de l'era nova a cada dialecte.")


if __name__ == "__main__":
    main()
