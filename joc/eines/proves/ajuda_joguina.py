"""
Ajudes de les proves de Python: un diccionari de joguina i les eres que en surten.
No acaba en test_ a posta: no és cap prova (vegeu test_variants_era.py).
"""

import collections
import os
import sys

DIR_EINES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, DIR_EINES)

import variants_era as ve  # noqa: E402

CODIS = ["ca", "nw", "va", "ba"]


class Joguina:
    """Un diccionari de joguina: per a cada paraula, la clau consonant i l'assonant
    que té a cada dialecte i quantes rimes té cada clau (les mateixes estructures
    que llegeix variants_era.Dades)."""

    def __init__(self):
        self.rimes = {mena: {codi: {} for codi in CODIS} for mena in ("cons", "asson")}
        self.claus = {mena: {codi: collections.defaultdict(set) for codi in CODIS}
                      for mena in ("cons", "asson")}

    def paraula(self, text, cons, asson="a", dialectes=CODIS):
        """`cons` i `asson` són una clau (la mateixa a tots els dialectes) o un
        { dialecte: clau }. Una clau que no té rimes encara en té 100."""
        for codi in dialectes:
            for mena, claus in (("cons", cons), ("asson", asson)):
                clau = claus[codi] if isinstance(claus, dict) else claus
                self.claus[mena][codi][text].add(clau)
                self.rimes[mena][codi].setdefault(clau, 100)

    def posa(self, mena, codi, clau, rimes):
        self.rimes[mena][codi][clau] = rimes

    def dades(self, mostrar_de=None):
        return ve.Dades(CODIS, "ca",
                        {mena: (self.rimes[mena], self.claus[mena]) for mena in ("cons", "asson")},
                        mostrar_de or {})


def joguina_basica():
    """K1 (100 rimes) amb dues variants: [pare, mare] i [cara], aquesta amb una clau
    de 60 rimes al nord-occidental; i K2 (20 rimes) amb [lloc, foc]. Els grups
    assonants són A1 (5.000) i A2 (300)."""
    j = Joguina()
    j.paraula("pare", "K1", "A1")
    j.paraula("mare", "K1", "A1")
    j.paraula("cara", {"ca": "K1", "nw": "N2", "va": "K1", "ba": "K1"}, "A1")
    j.paraula("lloc", "K2", "A2")
    j.paraula("foc", "K2", "A2")
    for codi in CODIS:
        j.posa("cons", codi, "K1", 100)
        j.posa("cons", codi, "K2", 20)
        j.posa("asson", codi, "A1", 5000)
        j.posa("asson", codi, "A2", 300)
    j.posa("cons", "nw", "N2", 60)
    return j


CONFIG = {
    "dificil": {"des_de": 15, "tolerancia": 2, "paraules_per_variant": 2,
                "bosses": [{"fins": 49, "quota": 20}, {"fins": 999, "quota": 80}]},
    "facil": {"des_de": 15, "tolerancia": 2, "paraules_per_variant": 5,
              "bosses": [{"fins": 999, "quota": 50}, {"fins": 9999, "quota": 50}]},
}


def era_zero_de_joguina():
    return {"id": 0, "inici": "2026-01-01", "algorisme": 0,
            "paraules": ["pare", "mare", "lloc>llòc", "foc"],
            "roda": {"claus": [[0, 1], [2, 3]]}}


def crida_falsa(ordre, entrada):
    """El node de mentida: respostes fixes."""
    if ordre == "estat-roda":
        return {"dies": 10, "cicle": 0, "posicio": 10,
                "dificil": {"sortides": [0], "comptadors": [3, 1]},
                "facil": {"sortides": [1], "comptadors": [2, 4]}}
    if ordre == "patro":
        return {"W": 1000, "periode": 1000, "errorMaxim": 0.5}
    raise AssertionError(f"ordre inesperada: {ordre}")
