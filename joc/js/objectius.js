// Triar la paraula objectiu d'una partida.
//
// Nomes poden sortir paraules d'una clau de rima consonant amb mes de 50 rimes
// (mira MIN_RIMES a joc/eines/generar_dades.py). Com que la clau consonant
// implica la clau assonant, aixo garanteix que hi ha rimes de sobres tant en
// facil com en dificil: el minim que demana el joc (10) queda cobert de llarg.
//
// La tria es proporcional a la mida de cada grup, de manera que totes les
// paraules objectiu tenen la mateixa probabilitat de sortir.

// Barreja de bits d'una cadena (variant de cyrb53), per sembrar el generador.
function llavor(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
}

// mulberry32: petit, rapid i, sobretot, igual a tot arreu. Fa falta que sigui
// deterministic perque la paraula del dia ha de ser la mateixa per a tothom.
function generador(sembra) {
    let estat = sembra >>> 0;
    return function seguent() {
        estat = (estat + 0x6d2b79f5) | 0;
        let t = Math.imul(estat ^ (estat >>> 15), 1 | estat);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Cada entrada de l'index es [clauConsonant, numeroDeFitxer, nombreObjectius].
const CLAU = 0;
const FITXER = 1;
const OBJECTIUS = 2;

// Suma acumulada dels objectius de cada grup, per fer la tria ponderada: com mes
// paraules objectiu te un grup, mes probable es que en surti (aixi cada paraula
// objectiu es igual de probable).
let acumulatCache = null;

function acumulat(index) {
    if (acumulatCache && acumulatCache.claus === index.claus) return acumulatCache;
    let suma = 0;
    const talls = index.claus.map((entrada) => (suma += entrada[OBJECTIUS]));
    acumulatCache = { claus: index.claus, talls, total: suma };
    return acumulatCache;
}

function triarClau(index, aleatori) {
    const { talls, total } = acumulat(index);
    const objectiu = aleatori() * total;
    let baix = 0;
    let alt = talls.length - 1;
    while (baix < alt) {
        const mig = (baix + alt) >> 1;
        if (talls[mig] <= objectiu) baix = mig + 1;
        else alt = mig;
    }
    const entrada = index.claus[baix];
    return { clau: entrada[CLAU], fitxer: entrada[FITXER], objectius: entrada[OBJECTIUS] };
}

/** Una clau a l'atzar, per al mode il·limitat. */
export function clauAleatoria(index) {
    return triarClau(index, Math.random);
}

/**
 * La clau del dia. Depen nomes de la data, no de la dificultat: aixi tothom
 * juga la mateixa paraula, tant si la fa en facil com en dificil.
 */
export function clauDelDia(index, dataISO) {
    const aleatori = generador(llavor(`rimador-joc-${dataISO}`));
    const seleccio = triarClau(index, aleatori);
    return { ...seleccio, aleatori };
}

/**
 * La paraula objectiu concreta dins d'una seccio. Torna { normalitzada, mostrar }.
 * Nomes tria d'entre les paraules marcades com a objectiu (no verbs). La llista
 * ve ordenada des del generador, o sigui que amb la mateixa llavor i el mateix
 * fitxer surt sempre la mateixa paraula.
 */
export function triarParaula(fitxer, clau, aleatori = Math.random) {
    const seccio = fitxer.seccions.get(clau);
    if (!seccio || seccio.objectius.length === 0) {
        throw new Error(`Seccio sense objectius: "${clau}"`);
    }
    const normalitzada = seccio.objectius[Math.floor(aleatori() * seccio.objectius.length)];
    return { normalitzada, mostrar: seccio.paraules.get(normalitzada) };
}
