// La paraula del dia amb eres.
//
// UNA ERA és una data d'inici, unes bosses amb les seves quotes i el contingut de
// cada bossa congelat. Dura fins que comença la següent, i l'última per sempre.
// Dins d'una era, la paraula d'un dia és una FUNCIÓ PURA de la data i del que hi
// ha congelat: no es desa res ni es recorre cap historial, i tothom que té els
// mateixos fitxers obté la mateixa paraula (vegeu PROPOSTA_TRIA_DE_PARAULES.md).
//
// ELS TRES PASSOS de cada dia, per a cada carril (fàcil o difícil):
//   1. Quina bossa: el patró ponderat de bosses.js, comptant els dies de l'era.
//   2. Quina clau de la bossa: la baralla de la volta que toca (bosses.js).
//   3. Quina variant i quina paraula: la clau porta un comptador de les vegades
//      que ha sortit (t). Toca la variant `t mod nVariants` i, dins d'ella, la
//      paraula `floor(t / nVariants) mod nParaules`: cada rima dels altres
//      dialectes té el seu torn, i tots els torns valen igual.
//
// EL FORMAT D'UNA ERA (joc/dades/eres.json és { v, eres: [era, ...] }):
//
//   { id: 1, inici: '2026-12-01', algorisme: 1,
//     paraules: ['pare', 'cami>camí', ...],        totes les paraules de l'era
//     carrils: {
//       dificil: {
//         bosses: [{ de: 15, fins: 34, quota: 10,
//                    claus: [{ c: 'aɾə', v: [[3, 7], [12]] }, ...] }, ...],
//         entrada: { comptadors: { 'aɾə': 4 }, sortides: ['bɔ'] },
//         ...                                    (els talls, la tolerància i les
//       },                                        paraules per variant, que només
//       facil: { ... } } }                        són informatius)
//
//   quota      en per mil i enters; les de totes les bosses d'un carril sumen 1.000
//   claus      en ordre canònic. `c` és la clau consonant (difícil) o el grup
//              assonant (fàcil), i `v` les seves variants en ordre, cada una amb
//              les posicions de `paraules` que té, també en ordre
//   entrada    l'estat de sortida de l'era anterior: quantes vegades ha sortit
//              cada clau abans d'aquesta era i quines havien sortit a la volta
//              a mitges (vegeu crearBaralles a bosses.js). El joc no ha de
//              recórrer mai les eres anteriors: ho calcula l'script de congelar,
//              amb node i aquest mateix mòdul (estatDeSortida)
//
// L'ERA 0 és la roda d'abans (algorisme 0): { id: 0, inici: '2026-01-01',
// algorisme: 0, paraules, roda: { claus } }, amb una còpia congelada del bloc
// "diaries" de l'index. Es calcula amb rodaDelDia d'objectius.js. Els dies passats
// no es poden moure, i per això la roda es manté tal com era, també sense la
// regla de «el fàcil no repeteix el difícil», que no hi era.

import { rodaDelDia, ordreDeLaRoda } from './objectius.js?v=dev';
import { normalitza } from './normalitza.js?v=dev';
import {
    diesEntre, patroDeBosses, quantesVegades, bossaDelDia, crearBaralles,
} from './bosses.js?v=dev';

/** Els dos carrils, en l'ordre en què es calculen: el difícil primer. */
export const CARRILS = ['dificil', 'facil'];

/** "pare" o "cami>camí": la paraula normalitzada i la forma per mostrar. */
function separarCos(cos) {
    const tall = cos.indexOf('>');
    return {
        normalitzada: tall === -1 ? cos : cos.slice(0, tall),
        mostrar: tall === -1 ? cos : cos.slice(tall + 1),
    };
}

/**
 * L'era d'un dia: la darrera que ja ha començat. `eres` és la llista d'eres o el
 * fitxer eres.json sencer.
 */
export function eraDelDia(eres, dataISO) {
    const llista = Array.isArray(eres) ? eres : (eres && eres.eres) || [];
    let triada = null;
    for (const era of llista) {
        // Les dates AAAA-MM-DD es comparen bé com a text.
        if (era.inici <= dataISO && (!triada || era.inici > triada.inici)) triada = era;
    }
    if (!triada) throw new Error(`Cap era no cobreix el ${dataISO}`);
    return triada;
}

// Del JSON de l'era a les estructures que fan falta per calcular (el patró, les
// baralles de cada bossa...). Es guarda per objecte d'era: calcular-ho un sol
// cop, i no a cada dia, és el que fa que 20.000 dies es simulin en un instant.
const executables = new WeakMap();

function executable(era) {
    const desat = executables.get(era);
    if (desat) return desat;

    const carrils = {};
    for (const carril of CARRILS) {
        const dades = era.carrils && era.carrils[carril];
        if (!dades) throw new Error(`L'era ${era.id} no té el carril «${carril}»`);
        const entrada = dades.entrada || {};

        const bosses = dades.bosses.map((bossa, i) => {
            if (bossa.quota > 0 && bossa.claus.length === 0) {
                throw new Error(`L'era ${era.id}, ${carril}: la bossa ${i} té quota i cap clau`);
            }
            return {
                claus: bossa.claus,
                index: new Map(bossa.claus.map((clau, j) => [clau.c, j])),
                baralles: bossa.claus.length > 0
                    ? crearBaralles({
                        llavorBase: `${era.id}-${carril}-${i}`,
                        claus: bossa.claus.map((clau) => clau.c),
                        sortides: entrada.sortides || [],
                    })
                    : null,
            };
        });
        carrils[carril] = {
            patro: patroDeBosses(dades.bosses.map((bossa) => bossa.quota)),
            bosses,
            comptadors: entrada.comptadors || {},
        };
    }

    const resultat = { carrils };
    executables.set(era, resultat);
    return resultat;
}

// ------------------------------------------------------- La paraula d'un carril

/**
 * El que dona la fórmula un dia i en un carril, sense mirar si hi ha cap paraula
 * manual (vegeu parellaDelDia). Torna
 *
 *   { carril, era, dia, manual: false, desplacada,
 *     bossa, volta, posicio, t, clau, variant,
 *     indexParaula,            posició a era.paraules, que és la que diu a quina
 *                              clau i grup cau la paraula a cada dialecte
 *     objectiu: { normalitzada, mostrar } }
 *
 * A l'era 0 (la roda) no hi ha bossa, variant ni comptador, i `clau` és la
 * posició de l'entrada de la roda.
 *
 * `prohibida` és una paraula normalitzada que aquest dia no pot sortir (la del
 * difícil, quan es calcula el fàcil). Si la fórmula la dona, es passa a una altra
 * i `desplacada` ho diu: vegeu trobarAlternativa. L'ERA 0 NO LA MIRA: la roda dels
 * dies passats no tenia aquesta regla, i afegir-la ara faria canviar paraules que
 * ja han sortit.
 */
export function formulaDelCarril(era, carril, dataISO, prohibida = null) {
    if (era.algorisme === 0) return formulaDeLaRoda(era, carril, dataISO);
    if (era.algorisme !== 1) {
        throw new Error(`L'era ${era.id} té un algorisme desconegut (${era.algorisme})`);
    }

    const dia = diesEntre(era.inici, dataISO);
    if (dia < 0) {
        throw new RangeError(`El ${dataISO} és anterior a l'inici de l'era ${era.id} (${era.inici})`);
    }

    // 1. Quina bossa, i quantes vegades havia sortit abans d'avui.
    const rt = executable(era).carrils[carril];
    const { bossa, m } = bossaDelDia(rt.patro, dia);
    const b = rt.bosses[bossa];

    // 2. Quina clau: la m-ena de la bossa. Dins d'una volta no se'n repeteix cap.
    const { clau, volta, posicio } = b.baralles.clauDe(m);
    const k = b.claus[b.index.get(clau)];

    // 3. Quina variant i quina paraula. El comptador és el de les eres anteriors
    //    més les voltes d'aquesta: a cada volta, la clau surt una sola vegada.
    const t = (rt.comptadors[clau] || 0) + volta;
    const nVariants = k.v.length;
    const variant = t % nVariants;
    const propies = k.v[variant];
    const rotacio = Math.floor(t / nVariants);

    let escollida = { variant, indexParaula: propies[rotacio % propies.length] };
    let desplacada = false;
    if (prohibida !== null
        && separarCos(era.paraules[escollida.indexParaula]).normalitzada === prohibida) {
        const alternativa = trobarAlternativa(era, k, variant, rotacio, prohibida);
        if (alternativa) {
            escollida = alternativa;
            desplacada = true;
        }
    }

    return {
        carril, era: era.id, dia, manual: false, desplacada,
        bossa, volta, posicio, t, clau,
        variant: escollida.variant,
        indexParaula: escollida.indexParaula,
        objectiu: separarCos(era.paraules[escollida.indexParaula]),
    };
}

/**
 * Quan el fàcil i el difícil donarien la mateixa paraula el mateix dia, el fàcil
 * passa a la paraula següent de la seva variant; si la variant només en té una,
 * a la variant següent. És una regla fixa, igual per a tothom.
 *
 * EL CAS EXTREM: si la clau no té cap altra paraula que no sigui la prohibida
 * (una sola variant d'una sola paraula), no hi ha alternativa i es queda la que
 * toca: dos carrils amb la mateixa paraula un dia val més que no pas inventar-se
 * una paraula fora de la clau. Torna null en aquest cas.
 */
function trobarAlternativa(era, k, variant, rotacio, prohibida) {
    const valida = (indexParaula) => separarCos(era.paraules[indexParaula]).normalitzada !== prohibida;

    const propies = k.v[variant];
    const inici = rotacio % propies.length;
    for (let pas = 1; pas < propies.length; pas++) {
        const indexParaula = propies[(inici + pas) % propies.length];
        if (valida(indexParaula)) return { variant, indexParaula };
    }

    for (let pas = 1; pas < k.v.length; pas++) {
        const v = (variant + pas) % k.v.length;
        const paraules = k.v[v];
        const primera = rotacio % paraules.length;
        for (let i = 0; i < paraules.length; i++) {
            const indexParaula = paraules[(primera + i) % paraules.length];
            if (valida(indexParaula)) return { variant: v, indexParaula };
        }
    }
    return null;
}

function formulaDeLaRoda(era, carril, dataISO) {
    const roda = rodaDelDia(era.roda, dataISO, carril);
    return {
        carril, era: era.id, dia: roda.dia, manual: false, desplacada: false,
        bossa: null, volta: roda.cicle, posicio: roda.posicio,
        t: null, clau: roda.clauDeLaRoda, variant: null,
        indexParaula: roda.posicioParaula,
        objectiu: separarCos(era.paraules[roda.posicioParaula]),
    };
}

// ------------------------------------------------------ La parella del dia

/**
 * Les dues paraules del dia, { dificil, facil }. Es fan juntes perquè la regla de
 * «el fàcil no repeteix el difícil» les lliga.
 *
 * `manuals` és { facil, dificil } amb les paraules manuals d'aquell dia, ja
 * desxifrades (vegeu especials.js), o res si no n'hi ha. UNA MANUAL MANA SOBRE LA
 * FÓRMULA, però el dia compta igualment per a la bossa i per a la posició de la
 * volta: la fórmula es calcula igual i la manual només la substitueix, de manera
 * que no es mou cap altre dia. Una manual no té forma per mostrar fins que el joc
 * la busca al fitxer del dialecte (mostrar: null), i `formula` du el que hauria
 * sortit.
 */
export function parellaDelDia(eres, dataISO, manuals = {}) {
    const era = eraDelDia(eres, dataISO);

    const parella = {};
    let prohibida = null;
    for (const carril of CARRILS) {
        const manual = manuals[carril] ? normalitza(manuals[carril]) : '';
        const formula = formulaDelCarril(
            era, carril, dataISO, carril === 'facil' && !manual ? prohibida : null);
        parella[carril] = manual
            ? {
                carril, era: era.id, dia: formula.dia, manual: true,
                objectiu: { normalitzada: manual, mostrar: null }, formula,
            }
            : formula;
        // Si el difícil és manual, el fàcil tampoc no ha de ser aquella paraula.
        if (carril === 'dificil') prohibida = parella[carril].objectiu.normalitzada;
    }
    return parella;
}

// ----------------------------------------------------- L'estat de sortida

function ordenat(objecte) {
    return Object.fromEntries(
        Object.entries(objecte).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * On s'ha quedat un carril d'una era quan arriba `finalISO` (el primer dia de
 * l'era següent, que no s'hi compta): és l'ESTAT DE SORTIDA que l'era nova du com
 * a `entrada`. Ho calcula l'script de congelar, amb node i aquest mateix mòdul.
 *
 * Torna { dies, comptadors, sortides, bosses }:
 *   comptadors  quantes vegades ha sortit cada clau, comptant les de les eres
 *               anteriors (la clau que ja hi era i la que s'ha afegit)
 *   sortides    les claus que la volta a mitges de cada bossa deixa «ja sortides»,
 *               que l'era següent posarà al final de la seva primera volta
 *   bosses      per a l'informe: sortides, volta i posició de cada bossa
 *
 * Els dies manuals no hi compten de manera diferent: una manual substitueix la
 * paraula però la clau surt igual.
 */
export function estatDeSortida(era, carril, finalISO) {
    if (era.algorisme !== 1) throw new Error("L'estat de sortida de la roda és a estatDeLaRoda");
    const dies = diesEntre(era.inici, finalISO);
    if (dies < 0) {
        throw new RangeError(`El ${finalISO} és anterior a l'inici de l'era ${era.id} (${era.inici})`);
    }

    const rt = executable(era).carrils[carril];
    const comptadors = { ...rt.comptadors };
    const sortides = [];
    const informe = [];

    rt.bosses.forEach((b, i) => {
        if (!b.baralles) return;
        const m = quantesVegades(rt.patro, i, dies);
        const estat = b.baralles.despresDe(m);

        // Cada volta sencera ha fet sortir cada clau una vegada, i la volta a
        // mitges, les p primeres.
        for (const clau of b.claus) comptadors[clau.c] = (comptadors[clau.c] || 0) + estat.volta;
        for (const clau of estat.surten) comptadors[clau] += 1;
        sortides.push(...estat.sortides);
        informe.push({ bossa: i, sortides: m, volta: estat.volta, posicio: estat.posicio });
    });

    return { dies, comptadors: ordenat(comptadors), sortides: sortides.sort(), bosses: informe };
}

/**
 * L'estat de sortida de la roda (l'era 0), per passar a l'era 1. La roda no té
 * bosses ni voltes de debò, només un cicle de totes les claus per carril, i això
 * en fa el que té més sentit:
 *
 *   sortides    les entrades de la roda que han sortit al cicle a mitges
 *   comptadors  quantes vegades ha sortit cada entrada des de l'època: un cicle
 *               sencer cadascuna per cada cicle acabat, i una més les sortides
 *
 * Són posicions dins de `era.roda.claus`: qui congela les ha de traduir a les
 * claus de l'era nova (és una feina de dades, no de fórmula). Compte que el
 * passat de debò es va jugar amb altres llistes de claus; això és el que la roda
 * congelada hauria fet, que és només un punt de partida decidit.
 */
export function estatDeLaRoda(era, finalISO) {
    if (era.algorisme !== 0) throw new Error("Això només val per a l'era 0, la roda");
    const quantes = era.roda.claus.length;
    const dia = diesEntre(era.inici, finalISO);
    if (dia < 0) throw new RangeError(`El ${finalISO} és anterior a l'inici de l'era ${era.id}`);

    const cicle = Math.floor(dia / quantes);
    const posicio = dia % quantes;
    const resultat = { dies: dia, cicle, posicio };
    for (const carril of CARRILS) {
        const sortides = ordreDeLaRoda(quantes, `${cicle}-${carril}`).slice(0, posicio);
        const comptadors = new Array(quantes).fill(cicle);
        for (const entrada of sortides) comptadors[entrada] += 1;
        resultat[carril] = { sortides: sortides.slice().sort((a, b) => a - b), comptadors };
    }
    return resultat;
}
