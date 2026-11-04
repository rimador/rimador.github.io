// Les paraules del dia manuals, xifrades.
//
// Una paraula manual substitueix la de la fórmula un dia concret (que per Nadal
// toqui rimar amb un mot nadalenc). L'ENTRADA, amb les paraules en clar, s'edita a mà
// i es queda en local (joc/eines/diaries_manuals.json, fora del repositori); el que
// es publica és joc/dades/especials.json, que no diu enlloc ni quins dies ni quines
// paraules:
//
//   { "v": 1, "dies": { "<resum de la data>": "<base64>", ... } }
//
//   resum de la data  16 caràcters que surten d'una data (resumDeLaData). No es veu
//                     quins dies hi ha manual sense provar-los un per un, i les
//                     entrades van ordenades pel resum i no per data.
//   base64            { f, d } -la paraula del fàcil i la del difícil, o res- en
//                     JSON, ampliat amb espais fins a una mida fixa (MIDA) perquè la
//                     llargada no digui res, i barrejat amb XOR amb una seqüència de
//                     `generador` sembrada amb `llavor` d'un text que inclou la data.
//
// ÉS OFUSCACIÓ, NO SEGURETAT, i ho és a posta: qui sàpiga programar (i tingui la
// data) ho pot desfer, perquè el navegador ho ha de poder fer. L'únic que es vol és
// que enlloc no hi hagi cap fitxer públic amb dates i paraules futures en clar.
//
// Es xifra amb node, amb aquestes mateixes funcions (vegeu joc/eines/manuals.mjs):
// no hi ha cap port a Python que pugui discrepar.

import { llavor, generador } from './objectius.js?v=dev';

// Dues sals diferents: la del resum de la data i la de la seqüència que barreja el
// contingut. Si fossin la mateixa, el resum donaria la llavor del XOR.
const SAL_DE_LA_CLAU = 'rimador-joc-especials-dia-';
const SAL_DEL_XIFRAT = 'rimador-joc-especials-xifra-';

/** Quants bytes fa el contingut en clar. Dues paraules llargues hi caben de sobres. */
export const MIDA = 96;

function hex(numero) {
    return numero.toString(16).padStart(8, '0');
}

/** El resum d'una data AAAA-MM-DD: la clau de l'entrada dins d'especials.json. */
export function resumDeLaData(dataISO) {
    return hex(llavor(`${SAL_DE_LA_CLAU}a-${dataISO}`)) + hex(llavor(`${SAL_DE_LA_CLAU}b-${dataISO}`));
}

function barrejar(bytes, dataISO) {
    const flux = generador(llavor(SAL_DEL_XIFRAT + dataISO));
    return bytes.map((byte) => byte ^ Math.floor(flux() * 256));
}

/**
 * Les paraules d'un dia, { facil, dificil } (qualsevol de les dues pot faltar), com
 * a text en base64. Falla si no hi caben (vegeu MIDA).
 */
export function xifrar(paraules, dataISO) {
    const text = JSON.stringify({ f: paraules.facil || '', d: paraules.dificil || '' });
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > MIDA) {
        throw new Error(`Les paraules del ${dataISO} no caben a ${MIDA} bytes (n'ocupen ${bytes.length})`);
    }
    const net = new Uint8Array(MIDA).fill(32);       // espais: el JSON els accepta al final
    net.set(bytes);
    return btoa(String.fromCharCode(...barrejar(net, dataISO)));
}

/**
 * El contrari: { facil, dificil } o null si el text no és una entrada d'aquell dia
 * (una entrada d'una altra data, o un text malmès, dona porqueria que no és JSON).
 * Una paraula que no hi era es torna com a text buit.
 */
export function desxifrar(base64, dataISO) {
    try {
        const xifrat = Uint8Array.from(atob(base64), (lletra) => lletra.charCodeAt(0));
        if (xifrat.length !== MIDA) return null;
        const dades = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(barrejar(xifrat, dataISO)));
        if (!dades || typeof dades.f !== 'string' || typeof dades.d !== 'string') return null;
        return { facil: dades.f, dificil: dades.d };
    } catch (error) {
        return null;
    }
}

/**
 * Les paraules manuals d'un dia segons un especials.json, o {} si no n'hi ha. És el
 * que es passa a parellaDelDia (eres.js) com a `manuals`.
 */
export function manualsDelDia(especials, dataISO) {
    const entrada = especials && especials.dies && especials.dies[resumDeLaData(dataISO)];
    return (entrada && desxifrar(entrada, dataISO)) || {};
}
