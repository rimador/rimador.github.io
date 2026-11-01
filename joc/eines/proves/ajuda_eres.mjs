// Ajudes de les proves de la paraula del dia: eres sintètiques i simulacions.
//
// Les proves s'executen amb una sola ordre, des de l'arrel del repositori:
//
//     node --test "joc/eines/proves/*.test.mjs"
//
// (Amb la carpeta sola, sense el patró, node 22 no hi troba les proves.)
//
// Aquest fitxer no acaba en .test.mjs a posta: no és cap prova, només ajudes.

import { parellaDelDia } from '../../js/eres.js';

// Les bosses per defecte de bosses_rimes.py: quotes en per mil i, de les claus de
// cada bossa, les que hi havia el 31-10-2026 amb la tolerància ×0,5–×2.
export const QUOTES_DIFICIL = [10, 15, 40, 400, 360, 150, 14, 7, 4];
export const CLAUS_DIFICIL = [426, 114, 174, 88, 46, 32, 24, 6, 14];
export const QUOTES_FACIL = [15, 25, 285, 275, 270, 110, 20];
export const CLAUS_FACIL = [5, 3, 5, 5, 5, 4, 8];

/** El dia que és `n` dies després d'una data AAAA-MM-DD (n pot ser negatiu). */
export function afegirDies(dataISO, n) {
    const [any, mes, dia] = dataISO.split('-').map(Number);
    return new Date(Date.UTC(any, mes - 1, dia + n)).toISOString().slice(0, 10);
}

/**
 * Les bosses d'un carril a partir de les quotes i de quantes claus té cada una.
 * Cada clau té, per defecte, dues variants: una de dues paraules i una d'una.
 */
export function bossesDe(quotes, claus, variants = [2, 1]) {
    return quotes.map((quota, i) => ({ quota, claus: claus[i], variants }));
}

/**
 * Una era sintètica d'algorisme 1. `carrils` és { dificil: [bossa, ...], facil:
 * [...] } amb bossa = { quota, claus, variants } (vegeu bossesDe). Les claus es
 * diuen d00k0003, f02k0010... i són en ordre canònic (alfabètic); cada paraula es
 * diu com la seva clau, la variant i el lloc: d00k0003v1w0.
 *
 * `entrada` és { dificil: {comptadors, sortides}, facil: {...} } de l'era anterior.
 */
export function crearEra({ id = 1, inici = '2026-12-01', carrils, entrada = {} }) {
    const paraules = [];
    const nova = (text) => {
        paraules.push(text);
        return paraules.length - 1;
    };
    const era = { id, inici, algorisme: 1, paraules, carrils: {} };
    for (const [carril, bosses] of Object.entries(carrils)) {
        era.carrils[carril] = {
            bosses: bosses.map((bossa, i) => ({
                quota: bossa.quota,
                claus: Array.from({ length: bossa.claus }, (_, j) => {
                    const c = `${carril[0]}${String(i).padStart(2, '0')}k${String(j).padStart(4, '0')}`;
                    const variants = bossa.variants || [2, 1];
                    return {
                        c,
                        v: variants.map((quantes, vi) => Array.from(
                            { length: quantes }, (_x, w) => nova(`${c}v${vi}w${w}`))),
                    };
                }),
            })),
            entrada: entrada[carril] || { comptadors: {}, sortides: [] },
        };
    }
    return era;
}

/** L'era de les bosses per defecte, amb una mica de variants perquè hi hagi on rotar. */
export function eraPerDefecte(opcions = {}) {
    return crearEra({
        ...opcions,
        carrils: {
            dificil: bossesDe(QUOTES_DIFICIL, CLAUS_DIFICIL, [3, 1, 2]),
            facil: bossesDe(QUOTES_FACIL, CLAUS_FACIL, [4, 2]),
        },
    });
}

/**
 * Les parelles dels `dies` primers dies d'una era. `manuals(d)` diu les paraules
 * manuals del dia d (0 és el primer), si n'hi ha.
 */
export function simular(era, dies, manuals = () => ({})) {
    const resultat = [];
    for (let d = 0; d < dies; d++) {
        resultat.push(parellaDelDia([era], afegirDies(era.inici, d), manuals(d)));
    }
    return resultat;
}
