"""
Proves de variants_era.py i congelar_era.py amb dades de joguina: res no llegeix
el diccionari. S'executen soles amb

    python3 -m unittest discover -s joc/eines/proves -p "test_*.py"

però no cal: la prova de node (python.test.mjs) les crida, i amb una sola ordre
-node --test "joc/eines/proves/*.test.mjs"- es corre tot.
"""

import collections
import contextlib
import copy
import io
import json
import os
import random
import shutil
import sys
import tempfile
import unittest
from datetime import date

DIR_EINES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, DIR_EINES)

import congelar_era as ce  # noqa: E402
import generar_dades as gd  # noqa: E402
import variants_era as ve  # noqa: E402

from ajuda_joguina import (  # noqa: E402
    CODIS, CONFIG, Joguina, crida_falsa, era_zero_de_joguina, joguina_basica,
)


# ------------------------------------------------------------- Les quotes

class Quotes(unittest.TestCase):
    def test_les_de_la_proposta_arriben_tal_qual(self):
        self.assertEqual(ve.normalitzar_quotes([1, 1.5, 4, 40, 36, 15, 1.4, 0.7, 0.4]),
                         [10, 15, 40, 400, 360, 150, 14, 7, 4])
        self.assertEqual(ve.normalitzar_quotes([1.5, 2.5, 28.5, 27.5, 27, 11, 2]),
                         [15, 25, 285, 275, 270, 110, 20])

    def test_el_residu_va_al_mes_gran_i_l_empat_al_numero_mes_baix(self):
        self.assertEqual(ve.normalitzar_quotes([1, 1, 1]), [334, 333, 333])
        self.assertEqual(ve.normalitzar_quotes([50, 30, 20]), [500, 300, 200])
        self.assertEqual(ve.normalitzar_quotes([0, 100]), [0, 1000])
        # 2/3 i 1/3 -> 666,67 i 333,33: el residu més gran és el del primer.
        self.assertEqual(ve.normalitzar_quotes([2, 1]), [667, 333])
        # Escales diferents, mateixes proporcions.
        self.assertEqual(ve.normalitzar_quotes([20, 10]), [667, 333])

    def test_sempre_sumen_mil_i_no_s_allunyen_d_una_unitat(self):
        atzar = random.Random(7)
        for _ in range(500):
            quotes = [atzar.choice([0, 0.1, 0.5, 1, 2.5, 7, 33.3, 40]) for _ in range(atzar.randint(1, 12))]
            if sum(quotes) <= 0:
                continue
            normalitzades = ve.normalitzar_quotes(quotes)
            self.assertEqual(sum(normalitzades), 1000)
            for quota, final in zip(quotes, normalitzades):
                self.assertLess(abs(final - quota * 1000 / sum(quotes)), 1)
                if quota == 0:
                    self.assertEqual(final, 0)

    def test_refusa_les_quotes_impossibles(self):
        for dolentes in ([], [0, 0], [10, -1, 5]):
            with self.assertRaises(ValueError):
                ve.normalitzar_quotes(dolentes)


class Talls(unittest.TestCase):
    def test_talls_i_bossa(self):
        talls = list(ve.talls_de({"des_de": 15, "bosses": [{"fins": 34}, {"fins": 49}, {"fins": 99}]}))
        self.assertEqual(talls, [(15, 34), (35, 49), (50, 99)])
        self.assertEqual([ve.bossa_de(n, talls) for n in (14, 15, 34, 35, 49, 50, 99, 100)],
                         [None, 0, 0, 1, 1, 2, 2, None])


# ---------------------------------------------------- Candidates i variants

class Candidates(unittest.TestCase):
    def test_nomes_les_resolubles_als_quatre_dialectes(self):
        j = joguina_basica()
        # Un homògraf al central: cau a dues claus.
        j.paraula("dona", "K1")
        j.claus["cons"]["ca"]["dona"].add("K9")
        j.posa("cons", "ca", "K9", 100)
        # Una clau d'una sola rima al valencià (no publicada: l'index no hi apunta).
        j.paraula("rara", {"ca": "K1", "nw": "K1", "va": "K7", "ba": "K1"})
        j.posa("cons", "va", "K7", 1)
        # Una paraula que no és objectiu al balear.
        j.paraula("trio", "K1", dialectes=["ca", "nw", "va"])

        dades = j.dades()
        for mena in ("cons", "asson"):
            self.assertEqual(sorted(c.paraula for c in ve.candidates_de(dades, mena)),
                             ["cara", "foc", "lloc", "mare", "pare"], mena)

    def test_els_perfils_porten_les_claus_i_les_rimes_en_l_ordre_dels_dialectes(self):
        cara = [c for c in ve.candidates_de(joguina_basica().dades(), "cons") if c.paraula == "cara"][0]
        self.assertEqual(cara.claus, ("K1", "N2", "K1", "K1"))
        self.assertEqual(cara.rimes, (100, 60, 100, 100))

    def test_les_variants_es_parteixen_per_claus_dels_altres_dialectes(self):
        dades = joguina_basica().dades()
        unitats = ve.construir_unitats(ve.candidates_de(dades, "cons"), dades.i_canonic)
        self.assertEqual(sorted(unitats), ["K1", "K2"])
        self.assertEqual(unitats["K1"].n, 100)
        self.assertEqual(unitats["K2"].n, 20)
        self.assertEqual(sorted(sorted(v.paraules) for v in unitats["K1"].variants),
                         [["cara"], ["mare", "pare"]])

    def test_dues_claus_diferents_amb_les_mateixes_rimes_son_dues_variants(self):
        j = Joguina()
        j.paraula("a1", {"ca": "K", "nw": "X", "va": "K", "ba": "K"})
        j.paraula("a2", {"ca": "K", "nw": "Y", "va": "K", "ba": "K"})
        j.posa("cons", "nw", "X", 80)
        j.posa("cons", "nw", "Y", 80)
        dades = j.dades()
        unitats = ve.construir_unitats(ve.candidates_de(dades, "cons"), dades.i_canonic)
        self.assertEqual(len(unitats["K"].variants), 2)


class Tolerancia(unittest.TestCase):
    def unitat(self, rimes_del_nw):
        j = Joguina()
        for i, n in enumerate(rimes_del_nw):
            j.paraula(f"w{i}", {"ca": "K", "nw": f"N{i}", "va": "K", "ba": "K"})
            j.posa("cons", "nw", f"N{i}", n)
        dades = j.dades()
        unitat = ve.construir_unitats(ve.candidates_de(dades, "cons"), dades.i_canonic)["K"]
        return dades, unitat

    def valides(self, rimes_del_nw, tolerancia):
        dades, unitat = self.unitat(rimes_del_nw)
        return sorted(rimes for v in ve.variants_valides(unitat, dades.i_canonic, tolerancia)
                      for rimes in [v.rimes[1]])

    def test_entre_n_entre_f_i_n_per_f_amb_els_limits_inclosos(self):
        # n = 100, f = 2: entre 50 i 200.
        self.assertEqual(self.valides([49, 50, 100, 200, 201], 2), [50, 100, 200])

    def test_amb_una_tolerancia_que_no_es_entera(self):
        # n = 100, f = 1,5: entre 66,67 i 150.
        self.assertEqual(self.valides([66, 67, 150, 151], 1.5), [67, 150])

    def test_amb_tolerancia_1_nomes_les_que_tenen_exactament_les_mateixes_rimes(self):
        self.assertEqual(self.valides([99, 100, 101], 1), [100])

    def test_sense_terra_a_on_comença_la_primera_bossa(self):
        # n = 20: el límit de baix és 10, encara que la primera bossa comenci a 15.
        j = Joguina()
        j.paraula("w", {"ca": "K", "nw": "N", "va": "K", "ba": "K"})
        j.posa("cons", "ca", "K", 20)
        j.posa("cons", "va", "K", 20)
        j.posa("cons", "ba", "K", 20)
        j.posa("cons", "nw", "N", 10)
        dades = j.dades()
        unitat = ve.construir_unitats(ve.candidates_de(dades, "cons"), dades.i_canonic)["K"]
        self.assertEqual(len(ve.variants_valides(unitat, dades.i_canonic, 2)), 1)


# --------------------------------------------- El contingut d'un carril

class Ordres(unittest.TestCase):
    def variant(self, paraules):
        return ve.Variant(("K", "K", "K", "K"), (10, 10, 10, 10), list(paraules))

    def test_les_paraules_noves_van_per_l_ordre_estable_i_se_n_guarden_fins_al_maxim(self):
        paraules = [f"p{i}" for i in range(12)]
        esperades = sorted(paraules, key=ve.ordre_estable)
        self.assertEqual(ve.ordenar_paraules(self.variant(paraules), "dificil", None, frozenset(), 5),
                         esperades[:5])

    def test_les_que_ja_hi_eren_mantenen_l_ordre_i_les_noves_van_al_final(self):
        paraules = ["a", "b", "c", "d", "e"]
        previes = [["d", "zzz", "a"]]          # «zzz» ja no és candidata
        triades = ve.ordenar_paraules(self.variant(paraules), "dificil", previes, frozenset(), 10)
        self.assertEqual(triades[:2], ["d", "a"])
        self.assertEqual(triades[2:], sorted(["b", "c", "e"], key=ve.ordre_estable))

    def test_al_facil_primer_les_que_no_son_a_cap_llista_del_dificil(self):
        paraules = ["a", "b", "c", "d"]
        triades = ve.ordenar_paraules(self.variant(paraules), "facil", None, frozenset({"a", "b"}), 10)
        self.assertEqual(sorted(triades[:2]), ["c", "d"])
        self.assertEqual(sorted(triades[2:]), ["a", "b"])
        # Si no n'hi ha prou, les del difícil també hi entren (al final).
        self.assertEqual(sorted(ve.ordenar_paraules(self.variant(paraules), "facil", None,
                                                    frozenset({"a", "b"}), 3)[:2]), ["c", "d"])

    def test_la_regla_del_facil_nomes_val_per_a_les_noves(self):
        paraules = ["a", "b", "c", "d"]
        triades = ve.ordenar_paraules(self.variant(paraules), "facil", [["a"]], frozenset({"a", "b"}), 10)
        self.assertEqual(triades[0], "a")           # ja hi era: es queda al seu lloc
        self.assertEqual(sorted(triades[1:3]), ["c", "d"])
        self.assertEqual(triades[3], "b")

    def test_les_variants_que_ja_hi_eren_mantenen_el_lloc_i_les_noves_van_al_final(self):
        unitat = ve.Unitat("K", 100, [])
        a = ve.Variant(("K", "X", "K", "K"), (100,) * 4, ["w1", "w2"])
        b = ve.Variant(("K", "Y", "K", "K"), (100,) * 4, ["w3"])
        nova = ve.Variant(("K", "Z", "K", "K"), (100,) * 4, ["w9"])
        previes = [["w3"], ["w2", "w1"]]
        ordre = ve.ordenar_variants("dificil", unitat, [a, nova, b], previes)
        self.assertEqual([v.claus[1] for v in ordre], ["Y", "X", "Z"])

    def test_sense_variants_anteriors_van_per_barreja_estable_i_dues_execucions_coincideixen(self):
        unitat = ve.Unitat("K", 100, [])
        variants = [ve.Variant(("K", f"X{i}", "K", "K"), (100,) * 4, [f"w{i}"]) for i in range(6)]
        un = ve.ordenar_variants("dificil", unitat, variants, None)
        dos = ve.ordenar_variants("dificil", unitat, list(reversed(variants)), None)
        self.assertEqual([v.claus for v in un], [v.claus for v in dos])


class Carril(unittest.TestCase):
    def construir(self, carril="dificil", config=None, previ=None, excloses=frozenset(), j=None):
        dades = (j or joguina_basica()).dades()
        unitats = ve.construir_unitats(ve.candidates_de(dades, ve.MENA_DE[carril]), dades.i_canonic)
        return ve.construir_carril(carril, unitats, (config or CONFIG)[carril], dades.i_canonic,
                                   previ, excloses)

    def test_cada_clau_va_a_la_bossa_que_li_toca_amb_les_variants_i_les_paraules(self):
        carril, informe = self.construir()
        self.assertEqual(informe["quotes"], [200, 800])
        k2, k1 = carril["bosses"][0]["claus"], carril["bosses"][1]["claus"]
        self.assertEqual([c["c"] for c in k2], ["K2"])
        self.assertEqual([c["c"] for c in k1], ["K1"])
        self.assertEqual(sorted(sorted(v) for v in k2[0]["v"]), [sorted(["lloc", "foc"])])
        self.assertEqual(sorted(sorted(v) for v in k1[0]["v"]), [["cara"], ["mare", "pare"]])
        self.assertEqual(informe["variants"], 3)
        self.assertEqual(informe["paraules"], 5)
        self.assertEqual(informe["variants_d_una_paraula"], [("K1", "cara")])

    def test_les_claus_de_cada_bossa_van_en_ordre_canonic(self):
        j = Joguina()
        for clau in ("zeta", "alfa", "mu", "beta"):
            j.paraula(f"p_{clau}", clau)
            for codi in CODIS:
                j.posa("cons", codi, clau, 100)
        carril, _ = self.construir(j=j)
        self.assertEqual([c["c"] for c in carril["bosses"][1]["claus"]], ["alfa", "beta", "mu", "zeta"])

    def test_el_maxim_de_paraules_per_variant_es_respecta(self):
        j = joguina_basica()
        for i in range(10):
            j.paraula(f"extra{i}", "K1", "A1")
        config = copy.deepcopy(CONFIG)
        config["dificil"]["paraules_per_variant"] = 4
        carril, informe = self.construir(config=config, j=j)
        grans = [v for v in carril["bosses"][1]["claus"][0]["v"] if len(v) > 1]
        self.assertEqual([len(v) for v in grans], [4])

    def test_una_clau_sense_variant_valida_o_fora_dels_talls_no_entra(self):
        j = joguina_basica()
        # K3: 30 rimes al central però 5 al valencià (fora de ×0,5–×2).
        j.paraula("cap", {"ca": "K3", "nw": "K3", "va": "V3", "ba": "K3"})
        for codi in CODIS:
            j.posa("cons", codi, "K3", 30)
        j.posa("cons", "va", "V3", 5)
        # K4: 5.000 rimes, més que l'última bossa (999).
        j.paraula("gran", "K4")
        for codi in CODIS:
            j.posa("cons", codi, "K4", 5000)
        carril, informe = self.construir(j=j)
        claus = [c["c"] for b in carril["bosses"] for c in b["claus"]]
        self.assertNotIn("K3", claus)
        self.assertNotIn("K4", claus)
        self.assertEqual(informe["sense_variant"], [("K3", 30)])
        self.assertEqual(informe["fora_de_talls"], [("K4", 5000)])

    def test_la_continuitat_de_l_era_anterior_mana_sobre_l_ordre_de_barreja(self):
        previ = {"K1": [["pare"], ["cara"]]}
        carril, _ = self.construir(previ=previ)
        variants = carril["bosses"][1]["claus"][0]["v"]
        # L'ordre antic de les variants ([pare...] abans que [cara]) es respecta, i
        # dins de la primera, «pare» surt abans que la nova «mare».
        self.assertEqual(variants, [["pare", "mare"], ["cara"]])

    def test_amb_una_roda_com_a_era_anterior_les_antigues_paraules_van_primer(self):
        # La roda deixa un sol «pseudo-variant» per clau, amb les paraules de l'entrada.
        previ = {"K1": [["mare"]]}
        carril, _ = self.construir(previ=previ)
        gran = [v for v in carril["bosses"][1]["claus"][0]["v"] if len(v) > 1][0]
        self.assertEqual(gran, ["mare", "pare"])

    def test_el_facil_treu_primer_les_que_no_son_al_dificil(self):
        j = joguina_basica()
        for i in range(3):
            j.paraula(f"nova{i}", "K1", "A1")
        carril, _ = self.construir("facil", j=j, excloses=frozenset({"pare", "mare", "cara"}))
        variant = carril["bosses"][1]["claus"][0]["v"][0]
        self.assertEqual(sorted(variant[:3]), ["nova0", "nova1", "nova2"])

    def test_indexar_paraules_posa_la_forma_per_mostrar_i_no_repeteix(self):
        carrils = {
            "dificil": {"bosses": [{"claus": [{"c": "K", "v": [["lloc", "foc"]]}]}]},
            "facil": {"bosses": [{"claus": [{"c": "A", "v": [["foc", "pare"]]}]}]},
        }
        paraules = ve.indexar_paraules(carrils, {"lloc": "llòc", "foc": "foc"})
        self.assertEqual(paraules, ["lloc>llòc", "foc", "pare"])
        self.assertEqual(carrils["dificil"]["bosses"][0]["claus"][0]["v"], [[0, 1]])
        self.assertEqual(carrils["facil"]["bosses"][0]["claus"][0]["v"], [[1, 2]])

    def test_previ_d_un_carril_torna_les_variants_en_ordre_amb_paraules_normalitzades(self):
        era = {"paraules": ["lloc>llòc", "foc", "pare"],
               "carrils": {"dificil": {"bosses": [{"claus": [{"c": "K", "v": [[1, 0], [2]]}]}]}}}
        self.assertEqual(ve.previ_d_un_carril(era, "dificil"), {"K": [["foc", "lloc"], ["pare"]]})


# ------------------------------------------------------ Les eres

class Eres(unittest.TestCase):
    def test_previ_i_entrada_des_de_la_roda(self):
        era0 = era_zero_de_joguina()
        dades = joguina_basica().dades()

        def clau_de(carril, paraula):
            return dades.clau_central(ve.MENA_DE[carril], paraula)

        previ = ve.previ_de_la_roda(era0, clau_de)
        self.assertEqual(previ["dificil"], {"K1": [["pare", "mare"]], "K2": [["lloc", "foc"]]})
        # Al fàcil, cada entrada va al seu grup assonant.
        self.assertEqual(previ["facil"], {"A1": [["pare", "mare"]], "A2": [["lloc", "foc"]]})

        estat = crida_falsa("estat-roda", None)
        entrada = ce.entrada_des_de_la_roda(estat, era0, clau_de)
        self.assertEqual(entrada["dificil"], {"comptadors": {"K1": 3, "K2": 1}, "sortides": ["K1"]})
        self.assertEqual(entrada["facil"], {"comptadors": {"A1": 2, "A2": 4}, "sortides": ["A2"]})

    def test_un_grup_compta_les_vegades_de_totes_les_seves_entrades(self):
        era0 = {"id": 0, "inici": "2026-01-01", "algorisme": 0, "paraules": ["pare", "lloc", "foc"],
                "roda": {"claus": [[0], [1], [2]]}}
        estat = {"dificil": {"sortides": [], "comptadors": [0, 0, 0]},
                 "facil": {"sortides": [2], "comptadors": [2, 3, 4]}}
        entrada = ce.entrada_des_de_la_roda(estat, era0, lambda carril, p: "G" if carril == "facil" else p)
        self.assertEqual(entrada["facil"], {"comptadors": {"G": 9}, "sortides": ["G"]})

    def test_construir_era_munta_l_era_nova_a_partir_de_la_roda(self):
        j = joguina_basica()
        era, informes = ce.construir_era(j.dades({"lloc": "llòc"}), CONFIG, "2026-12-01",
                                         era_zero_de_joguina(), crida=crida_falsa)
        self.assertEqual((era["id"], era["inici"], era["algorisme"]), (1, "2026-12-01", 1))
        self.assertEqual(sorted(era["paraules"]), ["cara", "foc", "lloc>llòc", "mare", "pare"])
        self.assertEqual(era["carrils"]["dificil"]["entrada"],
                         {"comptadors": {"K1": 3, "K2": 1}, "sortides": ["K1"]})
        self.assertEqual(era["carrils"]["facil"]["entrada"],
                         {"comptadors": {"A1": 2, "A2": 4}, "sortides": ["A2"]})
        self.assertEqual(informes["dificil"]["patro"]["errorMaxim"], 0.5)

        # Cada posició de cada variant apunta a una paraula de l'era, sense repetir-se.
        for carril in ve.CARRILS:
            tretes = [i for b in era["carrils"][carril]["bosses"] for c in b["claus"]
                      for v in c["v"] for i in v]
            self.assertEqual(len(tretes), len(set(tretes)) if carril == "dificil" else len(tretes))
            self.assertTrue(all(0 <= i < len(era["paraules"]) for i in tretes))

        # I l'era es pot passar pel JSON sense perdre res.
        self.assertEqual(json.loads(json.dumps(era, ensure_ascii=False)), era)

    def test_una_bossa_amb_quota_i_cap_clau_es_refusa(self):
        config = copy.deepcopy(CONFIG)
        config["dificil"]["bosses"] = [{"fins": 49, "quota": 20}, {"fins": 99, "quota": 30},
                                       {"fins": 999, "quota": 50}]
        with self.assertRaises(ValueError) as error:
            ce.construir_era(joguina_basica().dades(), config, "2026-12-01",
                             era_zero_de_joguina(), crida=crida_falsa)
        self.assertIn("50-99", str(error.exception))

    def test_construir_era_amb_el_node_de_debo(self):
        if shutil.which("node") is None:
            self.skipTest("no hi ha node")
        j = joguina_basica()
        era1, _ = ce.construir_era(j.dades(), CONFIG, "2026-12-01", era_zero_de_joguina(),
                                   crida=crida_falsa)
        era2, informes = ce.construir_era(j.dades(), CONFIG, "2027-03-01", era1)   # node de debò
        self.assertEqual(era2["id"], 2)
        self.assertEqual(informes["dificil"]["patro"]["W"], 1000)
        # Cada clau ha sortit, com a mínim, tantes vegades com a l'era 1 (que són 90 dies).
        comptadors = era2["carrils"]["dificil"]["entrada"]["comptadors"]
        self.assertGreaterEqual(comptadors["K1"], 3)
        self.assertEqual(comptadors["K1"] + comptadors["K2"] > 0, True)

    def test_les_eres_velles_passen_a_l_arxiu(self):
        eres = [{"id": 0, "inici": "2026-01-01"}, {"id": 1, "inici": "2026-12-01"},
                {"id": 2, "inici": "2027-03-01"}]
        nova = {"id": 3, "inici": "2027-09-01"}
        # Amb l'era 2 vigent, es queda l'anterior (1), la vigent i la nova.
        actives, arxivades = ce.ordenar_i_arxivar(eres, nova, date(2027, 3, 2))
        self.assertEqual([e["id"] for e in actives], [1, 2, 3])
        self.assertEqual([e["id"] for e in arxivades], [0])
        # Abans que comenci l'era 1, la vigent és la 0 i no hi ha res a arxivar.
        actives, arxivades = ce.ordenar_i_arxivar(eres[:1], eres[1], date(2026, 11, 1))
        self.assertEqual([e["id"] for e in actives], [0, 1])
        self.assertEqual(arxivades, [])


class Configuracio(unittest.TestCase):
    def config(self, **canvis):
        config = copy.deepcopy(CONFIG)
        config["dificil"].update(canvis)
        return config

    def test_una_configuracio_bona_passa_amb_els_valors_per_defecte(self):
        c = {"dificil": {"des_de": 15, "bosses": [{"fins": 50, "quota": 1}]},
             "facil": {"des_de": 15, "bosses": [{"fins": 50, "quota": 1}]}}
        c = ce.validar_config(c)
        self.assertEqual((c["dificil"]["tolerancia"], c["dificil"]["paraules_per_variant"]), (2, 10))
        self.assertEqual((c["facil"]["tolerancia"], c["facil"]["paraules_per_variant"]), (2, 200))

    def test_refusa_el_que_no_te_sentit(self):
        for dolenta in (self.config(des_de=1),
                        self.config(bosses=[{"fins": 50, "quota": 1}, {"fins": 40, "quota": 1}]),
                        self.config(tolerancia=0.5),
                        self.config(paraules_per_variant=0)):
            with self.assertRaises(SystemExit):
                ce.validar_config(dolenta)
        with self.assertRaises(SystemExit):
            ce.validar_config({"dificil": CONFIG["dificil"]})

    def test_la_proposta_de_bosses_rimes_eres_es_una_configuracio_valida(self):
        config = ce.config_per_defecte()
        self.assertEqual(config["dificil"]["paraules_per_variant"], 10)
        self.assertEqual(config["facil"]["paraules_per_variant"], 200)
        self.assertEqual(ve.normalitzar_quotes([b["quota"] for b in config["dificil"]["bosses"]]),
                         [10, 15, 40, 400, 360, 150, 14, 7, 4])
        self.assertEqual(ve.normalitzar_quotes([b["quota"] for b in config["facil"]["bosses"]]),
                         [15, 25, 285, 275, 270, 110, 20])


class Ordre(unittest.TestCase):
    """La línia d'ordres, amb els fitxers en una carpeta temporal."""

    def setUp(self):
        self.carpeta = tempfile.mkdtemp()
        with open(os.path.join(self.carpeta, "index.json"), "w", encoding="utf-8") as fitxer:
            json.dump({"diaries": {"paraules": ["pare", "lloc>llòc"], "claus": [[0], [1]], "on": {}}}, fitxer)

    def tearDown(self):
        shutil.rmtree(self.carpeta)

    def executa(self, *arguments):
        antics = sys.argv
        sys.argv = ["congelar_era.py", "--dades", self.carpeta, *arguments]
        sortida = io.StringIO()
        try:
            with contextlib.redirect_stdout(sortida):
                ce.main()
        finally:
            sys.argv = antics
        return sortida.getvalue()

    def test_l_era_0_es_congela_un_sol_cop_i_no_porta_el_bloc_on(self):
        self.executa("--era0")
        with open(os.path.join(self.carpeta, "eres.json"), encoding="utf-8") as fitxer:
            eres = json.load(fitxer)["eres"]
        self.assertEqual(len(eres), 1)
        self.assertEqual(eres[0]["id"], 0)
        self.assertEqual(eres[0]["inici"], "2026-01-01")
        self.assertEqual(eres[0]["algorisme"], 0)
        self.assertEqual(eres[0]["paraules"], ["pare", "lloc>llòc"])
        self.assertEqual(eres[0]["roda"], {"claus": [[0], [1]]})
        # Les posicions del bloc «on» canvien a cada regeneració: no es congelen.
        self.assertEqual(sorted(eres[0]), ["algorisme", "congelada", "id", "inici", "paraules", "roda"])
        with self.assertRaises(SystemExit):
            self.executa("--era0")

    def test_simula_no_escriu_res(self):
        self.executa("--era0", "--simula")
        self.assertFalse(os.path.exists(os.path.join(self.carpeta, "eres.json")))

    def test_una_era_nova_ha_de_comencar_d_aqui_a_set_dies_com_a_minim(self):
        self.executa("--era0")
        with self.assertRaises(SystemExit) as error:
            self.executa("--inici", "2026-11-07", "--per-defecte", "--avui", "2026-11-01")
        self.assertIn("7 dies", str(error.exception))
        with self.assertRaises(SystemExit):
            self.executa("--inici", "2026-11-01", "--per-defecte", "--avui", "2026-11-01")
        with self.assertRaises(SystemExit):
            self.executa("--inici", "no-es-una-data", "--per-defecte")

    def test_cal_triar_una_feina(self):
        with self.assertRaises(SystemExit):
            self.executa()
        with self.assertRaises(SystemExit):
            self.executa("--era0", "--inici", "2027-01-01")


if __name__ == "__main__":
    unittest.main()
