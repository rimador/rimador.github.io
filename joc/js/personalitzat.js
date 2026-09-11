// El mode personalitzat: la configuracio, l'adreca que la duu i el codi que
// permet a dos jugadors saber que juguen el mateix.
//
// LA IDEA. El jugador es tria tots els ajustos -dialecte, rellotge, rondes,
// quantes rimes ha de tenir la paraula, si vol agudes, planes o esdruixoles, i
// si es juga per rima assonant o consonant- i el joc en fa un ENLLAC. Qui obri
// aquell enllac juga exactament la mateixa partida: les mateixes paraules, en
// el mateix ordre i amb els mateixos filtres. No hi ha servidor pel mig; tot
// surt de la llavor i dels ajustos, que son a l'adreca.
//
// AQUEST MODE NO TOCA RES: ni la classificacio, ni els records, ni el bloqueig
// de la paraula del dia. Es per jugar amb algu, i prou.
//
// PER QUE LA SIGNATURA. Les paraules es deriven d'una cadena que duu TOTS els
// ajustos i la llavor (vegeu rondesPersonalitzades a objectius.js). Si algu
// canvia un filtre a l'adreca, les paraules canvien i el codi de partida ja no
// coincideix amb el de l'altre: es veu de seguida i no cal comprovar res mes.

import { normalitza } from './normalitza.js?v=3b520f9';

// Els limits del formulari.
export const LIMITS = {
    segons: { min: 10, max: 600 },
    rondes: { min: 1, max: 20 },
    // Les rimes no tenen sostre a posta: el fitxer publica totes les claus des
    // de dues rimes amunt, i part de la gracia del mode es poder demanar
    // justament les terminacions impossibles (o les que rimen amb mig
    // diccionari, que els modes normals no deixen sortir mai).
    rimes: { min: 1 },
};

export const PER_DEFECTE = {
    segons: 60,
    rondes: 3,
    min: 30,
    max: 800,
    accents: [1, 2, 3],
    dificultat: 'facil',
};

const ACCENTS_VALIDS = [1, 2, 3];

// --------------------------------------------------------------- La llavor

/** Una llavor nova, curta i facil de dir per telefon. */
export function llavorNova() {
    return Math.random().toString(36).slice(2, 8);
}

// ------------------------------------------------------- Netejar i validar

function enterEntre(valor, limits, perDefecte) {
    // Un camp buit no es un zero: Number('') val 0, i sense aixo escriure el
    // camp de nou et deixava el minim en comptes del que hi havia.
    if (valor === '' || valor === null || valor === undefined) return perDefecte;
    const numero = Math.round(Number(valor));
    if (!Number.isFinite(numero)) return perDefecte;
    if (numero < limits.min) return limits.min;
    if (limits.max !== undefined && numero > limits.max) return limits.max;
    return numero;
}

/**
 * Deixa una configuracio en condicions: valors dins dels limits, accents
 * ordenats i sense repetits, i un maxim que mai no sigui menor que el minim.
 * Tot el que entri per l'adreca hi ha de passar.
 */
export function netejar(cru) {
    const dades = cru || {};
    const accents = ACCENTS_VALIDS.filter((a) => (dades.accents || []).includes(a));
    const min = enterEntre(dades.min, LIMITS.rimes, PER_DEFECTE.min);
    // El maxim pot ser infinit ("sense sostre"), i llavors no es compara amb res.
    const sostreCru = dades.max === Infinity || dades.max === null
        ? Infinity : Number(dades.max);
    const max = Number.isFinite(sostreCru)
        ? Math.max(min, enterEntre(sostreCru, LIMITS.rimes, PER_DEFECTE.max))
        : Infinity;

    return {
        dialecte: String(dades.dialecte || ''),
        segons: enterEntre(dades.segons, LIMITS.segons, PER_DEFECTE.segons),
        rondes: enterEntre(dades.rondes, LIMITS.rondes, PER_DEFECTE.rondes),
        min,
        max,
        accents: accents.length > 0 ? accents : PER_DEFECTE.accents.slice(),
        dificultat: dades.dificultat === 'dificil' ? 'dificil' : 'facil',
        llavor: normalitza(String(dades.llavor || '')).slice(0, 12) || llavorNova(),
        partida: enterEntre(dades.partida, { min: 1, max: 999 }, 1),
    };
}

// ------------------------------------------------------------- La signatura

/**
 * La cadena que identifica una partida. Hi son tots els ajustos i la llavor, i
 * NO el numero de partida: la partida 2 de la mateixa gent ha de dur el mateix
 * codi.
 */
export function signaturaDe(config) {
    const sostre = config.max === Infinity ? '*' : config.max;
    return [
        config.dialecte, config.dificultat, config.segons, config.rondes,
        config.min, sostre, config.accents.join(''), config.llavor,
    ].join('|');
}

// Lletres i xifres sense les que es confonen a la pantalla d'un mobil (la O i
// el 0, la I i l'1): el codi es per dir-lo en veu alta o comparar-lo de cua
// d'ull, no per copiar-lo.
const ALFABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** El codi de partida: cinc caracters que resumeixen la signatura. */
export function codiDe(config) {
    const text = signaturaDe(config);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
    }
    let barreja = ((h1 ^ (h1 >>> 16)) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>> 0;

    let codi = '';
    for (let i = 0; i < 5; i++) {
        codi += ALFABET[barreja % ALFABET.length];
        barreja = Math.floor(barreja / ALFABET.length) + 7;
    }
    return codi;
}

// --------------------------------------------------------------- L'adreca

// Els noms dels parametres son curts perque l'enllac s'ha d'enganxar a un xat i
// no ha de fer basarda. El "d" es el mateix de sempre (el dialecte), que ja
// enten la resta del joc (vegeu dialecte.js).
const PARAM = {
    mode: 'p', dialecte: 'd', segons: 't', rondes: 'r',
    min: 'n', max: 'x', accents: 'a', dificultat: 'm', llavor: 's',
};

/**
 * La configuracio que digui l'adreca, o null si no n'hi ha cap.
 * El numero de partida no hi va: cadascu porta el seu compte.
 */
export function llegirDeLAdreca(cerca) {
    const text = cerca === undefined ? window.location.search : cerca;
    const params = new URLSearchParams(text);
    if (params.get(PARAM.mode) !== '1') return null;

    const accents = (params.get(PARAM.accents) || '')
        .split('')
        .map(Number)
        .filter((a) => ACCENTS_VALIDS.includes(a));

    const sostre = params.get(PARAM.max);
    return netejar({
        dialecte: params.get(PARAM.dialecte) || '',
        segons: params.get(PARAM.segons),
        rondes: params.get(PARAM.rondes),
        min: params.get(PARAM.min),
        max: sostre === null || sostre === '*' ? Infinity : sostre,
        accents,
        dificultat: params.get(PARAM.dificultat) === 'c' ? 'dificil' : 'facil',
        llavor: params.get(PARAM.llavor) || '',
    });
}

/** Els parametres d'una configuracio, per muntar-ne l'adreca. */
function parametresDe(config) {
    const params = new URLSearchParams();
    params.set(PARAM.mode, '1');
    params.set(PARAM.dialecte, config.dialecte);
    params.set(PARAM.dificultat, config.dificultat === 'dificil' ? 'c' : 'a');
    params.set(PARAM.segons, String(config.segons));
    params.set(PARAM.rondes, String(config.rondes));
    params.set(PARAM.min, String(config.min));
    params.set(PARAM.max, config.max === Infinity ? '*' : String(config.max));
    params.set(PARAM.accents, config.accents.join(''));
    params.set(PARAM.llavor, config.llavor);
    return params;
}

/**
 * L'enllac per convidar algu. Es absolut perque s'ha d'enganxar en un xat, i es
 * calcula a partir d'on som ara: aixi funciona igual a rimador.cat/joc/, al
 * repositori de proves i en local, sense saber on es.
 */
export function enllacDe(config) {
    const adreca = new URL(window.location.href);
    adreca.hash = '';
    adreca.search = parametresDe(config).toString();
    return adreca.toString();
}

/**
 * Deixa la configuracio a la barra d'adreces. replaceState i no pushState, com
 * a la resta del joc: obrir una pantalla no es anar a cap altra pagina.
 */
export function escriureALAdreca(config) {
    try {
        const adreca = new URL(window.location.href);
        adreca.search = parametresDe(config).toString();
        window.history.replaceState(null, '', adreca);
    } catch (error) {
        // Si el navegador no ho deixa fer, l'enllac de compartir encara va: es
        // munta a part i no depen d'aixo.
    }
}

/** Treu els parametres del mode personalitzat de la barra d'adreces. */
export function esborrarDeLAdreca() {
    try {
        const adreca = new URL(window.location.href);
        const params = new URLSearchParams(adreca.search);
        for (const nom of Object.keys(PARAM)) {
            if (PARAM[nom] !== PARAM.dialecte) params.delete(PARAM[nom]);
        }
        adreca.search = params.toString();
        window.history.replaceState(null, '', adreca);
    } catch (error) {
        // Cosmetic: si falla, no passa res.
    }
}
