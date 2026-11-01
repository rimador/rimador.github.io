"""
Proves de comprovar_eres.py (les comprovacions de l'apartat 4.10 de la proposta)
amb el diccionari de joguina de ajuda_joguina.py: res no llegeix el diccionari.
"""

import copy
import os
import sys
import unittest
from datetime import date

DIR_EINES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, DIR_EINES)

import comprovar_eres as cr  # noqa: E402
import congelar_era as ce  # noqa: E402
import variants_era as ve  # noqa: E402
from ajuda_joguina import (  # noqa: E402
    CODIS, CONFIG, crida_falsa, era_zero_de_joguina, joguina_basica,
)

AVUI = date(2026, 11, 1)
MOSTRAR = {"lloc": "llòc"}

# El difícil amb tres bosses (15-29, 30-99 i 100-999), per poder saltar-ne dues.
CONFIG3 = copy.deepcopy(CONFIG)
CONFIG3["dificil"]["bosses"] = [{"fins": 29, "quota": 10}, {"fins": 99, "quota": 0}, {"fins": 999, "quota": 90}]


def tros_de(j):
    """El tros d'index de cada dialecte: les claus consonants amb alguna rima, que
    són les publicades."""
    return {codi: {"claus": [[clau, 0, 1, n, 1] for clau, n in sorted(j.rimes["cons"][codi].items()) if n >= 2]}
            for codi in CODIS}


def era_de(j, config=CONFIG):
    era, _ = ce.construir_era(j.dades(MOSTRAR), config, "2026-12-01", era_zero_de_joguina(), crida=crida_falsa)
    return era


def comprovar(j, era, dates=None, era0=None):
    return cr.comprovar([era0 or era_zero_de_joguina(), era], j.dades(MOSTRAR), tros_de(j), AVUI, dates)


def text(resultat):
    return "\n".join(resultat["linies"])


class Resolucio(unittest.TestCase):
    def test_cada_paraula_apunta_a_la_posicio_de_la_seva_clau_a_cada_dialecte(self):
        j = joguina_basica()
        era = era_de(j)
        tros = tros_de(j)
        resolucio, problemes = cr.resoldre(era, j.dades(MOSTRAR), tros)
        self.assertEqual(problemes, [])
        for codi in CODIS:
            claus = [entrada[0] for entrada in tros[codi]["claus"]]
            self.assertEqual(len(resolucio[codi]), len(era["paraules"]))
            for cos, posicio in zip(era["paraules"], resolucio[codi]):
                paraula = cos.split(">")[0]
                self.assertEqual(claus[posicio], next(iter(j.claus["cons"][codi][paraula])))

    def test_els_motius_d_una_paraula_que_ja_no_es_pot_jugar(self):
        j = joguina_basica()
        era = era_de(j)
        del j.claus["cons"]["ba"]["pare"]                      # ja no és objectiu al balear
        del j.claus["asson"]["ba"]["pare"]
        j.claus["cons"]["ca"]["mare"].add("KX")                # cau a dues claus al central
        j.posa("cons", "ca", "KX", 100)
        j.posa("cons", "nw", "N2", 1)                          # la clau de «cara» té una sola rima
        resolucio, problemes = cr.resoldre(era, j.dades(MOSTRAR), tros_de(j))
        tipus = {(p.paraula, p.codi): (p.tipus, p.detall) for p in problemes}
        self.assertEqual(tipus[("pare", "ba")][0], "no_objectiu")
        self.assertEqual(tipus[("mare", "ca")][0], "dues_claus")
        self.assertEqual(tipus[("cara", "nw")], ("poques_rimes", "-N2: 1"))
        self.assertEqual(cr.descriure([p for p in problemes if p.paraula == "cara"]),
                         "cau en una clau amb massa poques rimes en nord-occidental (-N2: 1)")
        self.assertEqual(resolucio["ba"][era["paraules"].index("pare")], -1)
        self.assertEqual(len(problemes), 3)

    def test_una_paraula_que_l_era_ja_no_fa_servir_no_es_comprova(self):
        j = joguina_basica()
        era = era_de(j)
        era["paraules"].append("orfena")          # una paraula vella que cap variant no referencia
        resolucio, problemes = cr.resoldre(era, j.dades(MOSTRAR), tros_de(j))
        self.assertEqual(problemes, [])
        self.assertEqual(resolucio["ca"][-1], -1)

    def test_les_paraules_de_la_roda_tambe_es_resolen(self):
        j = joguina_basica()
        resolucio, problemes = cr.resoldre(era_zero_de_joguina(), j.dades(MOSTRAR), tros_de(j))
        self.assertEqual(problemes, [])
        self.assertTrue(all(posicio >= 0 for fila in resolucio.values() for posicio in fila))


class Frases(unittest.TestCase):
    def test_els_motius_d_una_paraula_en_diversos_dialectes_es_ajunten_en_una_frase(self):
        P = cr.Problema
        problemes = [P(3, "x", "ba", "no_objectiu", ""), P(3, "x", "ca", "no_objectiu", ""),
                     P(3, "x", "nw", "no_objectiu", ""), P(3, "x", "va", "dues_claus", "")]
        self.assertEqual(cr.descriure(problemes),
                         "ja no és objectiu en balear, central i nord-occidental; cau a dues claus en valencià")
        self.assertEqual(cr.enumerar(["a"]), "a")
        self.assertEqual(cr.enumerar(["a", "b"]), "a i b")


class Errors(unittest.TestCase):
    def joguina_amb_un_error(self):
        j = joguina_basica()
        era = era_de(j)
        j.paraula("pera", "K1", "A1")                           # una candidata nova a la mateixa clau
        del j.claus["cons"]["ba"]["pare"]
        del j.claus["asson"]["ba"]["pare"]
        return j, era

    def test_l_error_diu_quina_paraula_quin_dia_quin_carril_i_per_que_i_proposa_una_substitucio(self):
        j, era = self.joguina_amb_un_error()
        idx = era["paraules"].index("pare")
        resultat = comprovar(j, era, {f"1:dificil:{idx}": "2027-08-14", f"1:facil:{idx}": "2027-09-02"})
        informe = text(resultat)
        self.assertIn("ERROR  «pare» (2027-08-14, difícil): ja no és objectiu en balear -> proposta: «pera»", informe)
        self.assertIn("ERROR  «pare» (2027-09-02, fàcil): ja no és objectiu en balear -> proposta: «pera»", informe)
        # I la de la roda de l'era 0, que també és vigent mentre no comenci l'1.
        self.assertIn("(roda): ja no és objectiu en balear", informe)
        self.assertEqual(len(resultat["errors"]), 3)
        self.assertEqual(sorted(resultat["substitucions"]), [0, 1])

    def test_una_paraula_invalida_a_tots_els_dialectes_surt_en_una_sola_linia_amb_una_proposta(self):
        j = joguina_basica()
        era = era_de(j)
        j.paraula("pera", "K1", "A1")
        for codi in CODIS:
            del j.claus["cons"][codi]["pare"]
            del j.claus["asson"][codi]["pare"]
        informe = text(comprovar(j, era))
        liniess = [linia for linia in informe.splitlines() if "«pare» (difícil)" in linia]
        self.assertEqual(len(liniess), 1)
        self.assertIn("ja no és objectiu en central, nord-occidental, valencià i balear -> proposta: «pera»", liniess[0])

    def test_les_paraules_proposades_no_es_repeteixen_dins_del_carril(self):
        j = joguina_basica()
        era = era_de(j)
        j.paraula("pera", "K1", "A1")
        for paraula in ("pare", "mare"):                        # dues paraules a substituir i una sola candidata
            del j.claus["cons"]["ba"][paraula]
            del j.claus["asson"]["ba"][paraula]
        resultat = comprovar(j, era)
        proposades = [paraula for referencia, paraula in resultat["substitucions"][1] if referencia.carril == "dificil"]
        self.assertEqual(proposades, ["pera"])
        self.assertIn("cal substituir-la a mà", text(resultat))

    def test_una_clau_sense_cap_altra_paraula_demana_la_substitucio_a_ma(self):
        j = joguina_basica()
        era = era_de(j)
        del j.claus["cons"]["ba"]["lloc"]
        del j.claus["asson"]["ba"]["lloc"]
        del j.claus["cons"]["ba"]["foc"]
        del j.claus["asson"]["ba"]["foc"]
        resultat = comprovar(j, era)
        self.assertIn("cal substituir-la a mà: la clau no té cap altra paraula", text(resultat))
        self.assertEqual(resultat["substitucions"], {})

    def test_aplicar_les_substitucions_deixa_l_era_igual_de_llarga_i_sense_errors(self):
        j, era = self.joguina_amb_un_error()
        era0 = era_zero_de_joguina()
        resultat = comprovar(j, era, era0=era0)
        abans = copy.deepcopy(era)
        mostrar = j.dades(MOSTRAR).mostrar_de
        cr.aplicar_substitucions(era, resultat["substitucions"][1], mostrar)
        cr.aplicar_substitucions(era0, resultat["substitucions"][0], mostrar)

        self.assertEqual(len(era["paraules"]), len(abans["paraules"]) + 1)
        self.assertEqual(era["paraules"][-1], "pera")
        for carril in ve.CARRILS:       # la mateixa forma: res no es mou, només una paraula canvia de lloc
            for b_ara, b_abans in zip(era["carrils"][carril]["bosses"], abans["carrils"][carril]["bosses"]):
                for k_ara, k_abans in zip(b_ara["claus"], b_abans["claus"]):
                    self.assertEqual([len(v) for v in k_ara["v"]], [len(v) for v in k_abans["v"]])
        self.assertNotIn(abans["paraules"].index("pare"),
                         [i for b in era["carrils"]["dificil"]["bosses"] for k in b["claus"] for v in k["v"] for i in v])

        # La roda també: la mateixa entrada, amb un altre número a la mateixa posició.
        self.assertEqual(len(era0["roda"]["claus"]), 2)
        self.assertNotEqual(era0["roda"]["claus"][0], [0, 1])
        self.assertEqual(len(era0["roda"]["claus"][0]), 2)

        despres = comprovar(j, era, era0=era0)
        self.assertEqual(despres["errors"], [])
        self.assertIn("sense canvis", text(despres))


class Avisos(unittest.TestCase):
    def test_sense_cap_canvi_no_hi_ha_avisos_ni_errors(self):
        j = joguina_basica()
        resultat = comprovar(j, era_de(j))
        self.assertEqual(resultat["errors"], [])
        self.assertIn("era 1, des del 2026-12-01", text(resultat))
        self.assertIn("sense canvis: 0 claus desplaçades, 0 noves", text(resultat))
        self.assertNotIn("avís", text(resultat))
        self.assertEqual(sorted(resultat["resolucio"]), [0, 1])

    def test_una_clau_que_passa_a_la_bossa_del_costat_nomes_compta(self):
        j = joguina_basica()
        era = era_de(j)
        j.posa("cons", "ca", "K1", 30)         # de la bossa 50-999 a la 15-49
        informe = text(comprovar(j, era))
        self.assertIn("avís   1 claus han canviat a la bossa del costat", informe)
        self.assertNotIn("-K1 ha passat", informe)

    def test_una_clau_que_salta_dues_bosses_surt_amb_nom(self):
        j = joguina_basica()
        era = era_de(j, CONFIG3)
        j.posa("cons", "ca", "K2", 500)         # de la bossa 15-29 a la 100-999
        informe = text(comprovar(j, era))
        self.assertIn("avís   difícil: la clau -K2 ha passat de 20 a 500 rimes (dues bosses més amunt)", informe)

    def test_una_clau_que_surt_dels_talls_o_del_central_tambe_surt_amb_nom(self):
        j = joguina_basica()
        era = era_de(j)
        j.posa("cons", "ca", "K1", 5)           # per sota de la primera bossa
        self.assertIn("la clau -K1 ha passat de 100 a 5 rimes i ja no cau a cap bossa de l'era",
                      text(comprovar(j, era)))
        j = joguina_basica()
        era = era_de(j)
        for paraula in ("lloc", "foc"):          # la clau K2 desapareix del central: les seves paraules passen a K3
            j.claus["cons"]["ca"][paraula] = {"K3"}
        j.posa("cons", "ca", "K3", 20)
        del j.rimes["cons"]["ca"]["K2"]
        self.assertIn("la clau -K2 ja no és al central (en tenia 20)", text(comprovar(j, era)))

    def test_una_variant_que_surt_de_la_tolerancia(self):
        j = joguina_basica()
        era = era_de(j)
        j.posa("cons", "nw", "N2", 10)          # n = 100: ha de tenir entre 50 i 200
        informe = text(comprovar(j, era))
        self.assertIn("1 variants han sortit de la tolerància de l'era: -K1 (nord-occidental)", informe)

    def test_una_paraula_que_canvia_de_rima_en_un_dialecte(self):
        j = joguina_basica()
        era = era_de(j)
        j.claus["cons"]["nw"]["cara"] = {"N3"}
        j.posa("cons", "nw", "N3", 60)
        informe = text(comprovar(j, era))
        self.assertIn("1 paraules han canviat de rima en algun dialecte: «cara» (nord-occidental)", informe)

    def test_amb_mes_d_un_per_cent_desplacat_o_nou_convé_una_era_nova(self):
        j = joguina_basica()
        era = era_de(j)
        j.posa("cons", "ca", "K1", 30)          # 1 de les 4 claus de l'era (25 %) es desplaça
        informe = text(comprovar(j, era))
        self.assertIn("s'han desplaçat 1 de 4 claus (25,0 %): convé una era nova", informe)

        j = joguina_basica()
        era = era_de(j)
        j.paraula("nou", "K9", "A9")            # una clau nova que podria entrar
        for codi in CODIS:
            j.posa("cons", codi, "K9", 100)
            j.posa("asson", codi, "A9", 100)
        informe = text(comprovar(j, era))
        self.assertIn("hi ha 2 claus noves que podrien entrar a l'era (50,0 % de les 4 que hi són): convé una era nova", informe)

    def test_amb_pocs_canvis_no_se_suggereix_res(self):
        # 1 de 200 claus és el 0,5 %: per sota del llindar.
        self.assertFalse(cr.LLINDAR < 0)
        from fractions import Fraction
        self.assertFalse(Fraction(1, 200) > cr.LLINDAR)
        self.assertTrue(Fraction(3, 200) > cr.LLINDAR)


class QuinesEres(unittest.TestCase):
    def test_es_comproven_la_vigent_i_les_futures_i_no_les_passades(self):
        eres = [{"id": 0, "inici": "2026-01-01"}, {"id": 1, "inici": "2026-12-01"},
                {"id": 2, "inici": "2027-03-01"}, {"id": 3, "inici": "2027-09-01"}]
        ids = lambda avui: [e["id"] for e in cr.eres_a_comprovar(eres, avui)]  # noqa: E731
        self.assertEqual(ids(date(2026, 11, 1)), [0, 1, 2, 3])
        self.assertEqual(ids(date(2026, 12, 1)), [1, 2, 3])
        self.assertEqual(ids(date(2027, 3, 2)), [2, 3])
        self.assertEqual(ids(date(2028, 1, 1)), [3])

    def test_les_eres_passades_es_resolen_pero_els_seus_problemes_no_bloquegen(self):
        j = joguina_basica()
        era = era_de(j)
        del j.claus["cons"]["ba"]["pare"]
        del j.claus["asson"]["ba"]["pare"]
        # Amb l'era 1 ja vigent, l'era 0 és l'anterior: es resol (el joc la necessita
        # per a la pantalla d'ahir) però no s'hi mira res més.
        resultat = cr.comprovar([era_zero_de_joguina(), era], j.dades(MOSTRAR), tros_de(j), date(2026, 12, 2))
        self.assertTrue(all(e[0]["id"] == 1 for e in resultat["errors"]))
        self.assertEqual(sorted(resultat["resolucio"]), [0, 1])
        self.assertEqual(resultat["resolucio"][0]["ba"][0], -1)


if __name__ == "__main__":
    unittest.main()
