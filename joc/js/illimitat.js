// L'il·limitat NATIU: una paraula nova a cada partida, amb les mateixes bosses i quotes
// que la paraula del dia, però aplicades a les claus del dialecte que es juga i
// comptant-hi LES SEVES PRÒPIES RIMES (vegeu PROPOSTA_TRIA_DE_PARAULES.md, apartat 5).
//
// QUÈ EL FA DIFERENT DE LA PARAULA DEL DIA:
//
//   - No és compartit. Cap jugador no necessita la partida d'un altre, o sigui que no hi
//     ha eres ni res que congelar: es fa servir l'índex del moment i les bosses i quotes
//     de l'era vigent.
//   - No hi ha tolerància ni la regla dels quatre dialectes. Les bosses es compten amb
//     les rimes del dialecte (claus consonants al difícil, grups assonants al fàcil) i la
//     paraula és qualsevol de les objectiu d'aquell dialecte (les marcades amb «*» i
//     «+» al seu fitxer), tret dels HOMÒGRAFS del dialecte: el jugador veuria «dona»
//     sense saber quina lectura toca.
//   - La seqüència és PER JUGADOR. La llavor és l'identificador d'usuari, el dialecte i
//     la dificultat; el comptador de partides viu al localStorage; i la primera partida
//     de cada jugador no cau a la mateixa bossa gràcies a un desplaçament del patró
//     (llavor mod W). Qui juga N partides té exactament les partides de cada bossa que
//     li toquen, i dins d'una bossa no se'n repeteix cap clau fins que s'ha buidat.
//
// Una bossa sense cap clau en aquest dialecte no entra al patró: les altres conserven
// la seva quota i es reparteixen els dies (W és la suma de les que queden).
//
// SI ES REGENERA L'ÍNDEX, les baralles canvien i de tant en tant es pot repetir una clau
// dins d'una volta; és acceptable (no hi ha cap resultat compartit que s'hagi de
// mantenir igual). I si el jugador perd el localStorage, torna a començar.
//
// Tot són funcions pures, sense DOM ni localStorage (el comptador el porta qui les
// crida; vegeu magatzem.js): només enters i llavor/generador, com la paraula del dia.

import { llavor, generador } from './objectius.js?v=dev';
import { patroDeBosses, bossaDelDia, crearBaralles } from './bosses.js?v=dev';

// Cada entrada de "claus" és [clau, grup, objectius, rimes, objectiusArreu, natius?];
// vegeu dades.js i generar_dades.py.
const CLAU = 0;
const GRUP = 1;
const OBJECTIUS = 2;
const RIMES = 3;
const NATIUS = 5;

const G_RIMES = 3;

// Quantes vegades es torna a mirar la partida següent de la seqüència si la que toca és
// la clau de la paraula del dia. Amb una sola unitat en joc no hi ha alternativa i es
// serveix igualment.
const MAX_INTENTS = 4;

/**
 * Les paraules NATIVES d'una clau: les objectiu que no són homògrafs. Una entrada d'un
 * índex escrit abans que existissin només té cinc camps, i aleshores ho són totes.
 */
function natiusDe(entrada) {
    return entrada.length > NATIUS ? entrada[NATIUS] : entrada[OBJECTIUS];
}

/**
 * Les unitats que es poden triar en un carril, amb les rimes del dialecte i en ordre
 * canònic (el que fa que la baralla sigui la mateixa a tot arreu): al difícil, les claus
 * consonants amb alguna paraula nativa; al fàcil, els grups assonants que en tenen
 * alguna, amb les seves claus i el pes de cadascuna.
 */
function unitatsDelCarril(tros, carril) {
    if (carril === 'dificil') {
        return tros.claus
            .filter((entrada) => natiusDe(entrada) > 0)
            .map((entrada) => ({
                id: entrada[CLAU], rimes: entrada[RIMES],
                claus: [{ entrada, pes: natiusDe(entrada) }],
            }));
    }

    const perGrup = new Map();
    for (const entrada of tros.claus) {
        const pes = natiusDe(entrada);
        if (pes === 0) continue;
        const grup = entrada[GRUP];
        if (!perGrup.has(grup)) {
            perGrup.set(grup, { id: String(grup), grup, rimes: tros.grups[grup][G_RIMES], claus: [] });
        }
        perGrup.get(grup).claus.push({ entrada, pes });
    }
    return [...perGrup.values()].sort((a, b) => a.grup - b.grup);
}

const configsEnMemoria = new WeakMap();   // index -> Map("era|dialecte|carril" -> config)

/**
 * Les bosses d'un carril per a un dialecte: les de l'era (talls i quotes) amb les unitats
 * del dialecte que hi cauen segons les seves pròpies rimes. Torna null si no hi ha res a
 * jugar (el carril no té bosses, o cap clau no cau a cap bossa amb quota), i aleshores qui
 * crida es queda amb la manera de sempre.
 *
 * `era` és una era d'algorisme 1 d'eres.json. La config es guarda per índex: es fa servir a
 * cada partida i recórrer quatre mil claus no és gratis.
 */
export function configNativa(index, dialecte, carril, era) {
    const tros = (index.dialectes || {})[dialecte];
    const dades = era && era.carrils && era.carrils[carril];
    if (!tros || !dades) return null;

    const clau = `${era.id}|${dialecte}|${carril}`;
    let desades = configsEnMemoria.get(index);
    if (!desades) configsEnMemoria.set(index, (desades = new Map()));
    if (desades.has(clau)) return desades.get(clau);

    const bosses = dades.bosses.map((bossa, original) => ({ original, quota: bossa.quota, unitats: [] }));
    for (const unitat of unitatsDelCarril(tros, carril)) {
        const i = dades.bosses.findIndex((bossa) => unitat.rimes >= bossa.de && unitat.rimes <= bossa.fins);
        if (i >= 0) bosses[i].unitats.push(unitat);
    }
    // Només entren al patró les que tenen quota i alguna unitat.
    const actives = bosses.filter((bossa) => bossa.quota > 0 && bossa.unitats.length > 0);

    const config = actives.length === 0 ? null : {
        era: era.id, dialecte, carril, actives,
        patro: patroDeBosses(actives.map((bossa) => bossa.quota)),
        homografs: new Set(tros.homografs || []),
    };
    desades.set(clau, config);
    return config;
}

const barallesEnMemoria = new WeakMap();   // config -> Map(semilla -> [baralles de cada bossa])

function barallesDe(config, semilla) {
    let desades = barallesEnMemoria.get(config);
    if (!desades) barallesEnMemoria.set(config, (desades = new Map()));
    if (!desades.has(semilla)) {
        desades.set(semilla, config.actives.map((bossa) => crearBaralles({
            llavorBase: `${semilla}-${bossa.original}`,
            claus: bossa.unitats.map((unitat) => String(unitat.id)),
        })));
    }
    return desades.get(semilla);
}

/** Una clau d'un grup assonant, amb probabilitat proporcional a les seves paraules natives. */
function triarPerPes(claus, aleatori) {
    const total = claus.reduce((suma, clau) => suma + clau.pes, 0);
    let tall = aleatori() * total;
    for (const clau of claus) {
        tall -= clau.pes;
        if (tall < 0) return clau.entrada;
    }
    return claus[claus.length - 1].entrada;
}

/**
 * La rima de la partida següent d'un jugador. `comptador` són les partides que ja ha fet en
 * aquest dialecte i dificultat, i `prohibida`, si n'hi ha, la unitat de la paraula del dia
 * d'avui (la clau consonant al difícil, el número de grup al fàcil): no es proposa perquè
 * no la desvetlli, i es passa a la partida següent de la seqüència.
 *
 * Torna { clau, grup, aleatori, bossa, volta, posicio, consumides }:
 *   aleatori     el generador amb què encara cal triar la paraula (vegeu triarParaulaNativa)
 *   consumides   quantes posicions de la seqüència ha gastat (1, o més si se n'ha saltat
 *                alguna): el comptador del jugador ha de pujar d'aquest tant
 */
export function triarNativa(config, usuari, comptador, prohibida = null) {
    const semilla = `${usuari}|${config.dialecte}|${config.carril}`;
    // La primera partida de cada jugador no cau a la mateixa bossa.
    const desplacament = llavor(semilla) % config.patro.W;
    const baralles = barallesDe(config, semilla);

    for (let consumides = 1; ; consumides++) {
        const n = comptador + consumides - 1 + desplacament;
        const { bossa, m } = bossaDelDia(config.patro, n);
        const bossaDelPatro = config.actives[bossa];
        const { clau: id, volta, posicio } = baralles[bossa].clauDe(m);

        const esLaDelDia = prohibida !== null && String(prohibida) === id;
        if (esLaDelDia && consumides < MAX_INTENTS) continue;

        const unitat = bossaDelPatro.unitats.find((candidata) => String(candidata.id) === id);
        const aleatori = generador(llavor(`${semilla}|paraula|${n}`));
        const entrada = config.carril === 'dificil' ? unitat.claus[0].entrada : triarPerPes(unitat.claus, aleatori);
        return {
            clau: entrada[CLAU], grup: entrada[GRUP], aleatori,
            bossa: bossaDelPatro.original, volta, posicio, consumides,
        };
    }
}

/**
 * La paraula d'una secció, d'entre les objectiu del dialecte (les de «*» i «+») que no són
 * homògrafs. Torna { normalitzada, mostrar }, com triarParaula a objectius.js, que és la que fa
 * servir el personalitzat i NO canvia: aquesta té la seva pròpia regla.
 */
export function triarParaulaNativa(grup, clau, aleatori, homografs) {
    const seccio = grup.seccions.get(clau);
    const triables = seccio ? seccio.objectius.filter((paraula) => !homografs.has(paraula)) : [];
    if (triables.length === 0) throw new Error(`Secció sense paraules natives: "${clau}"`);
    const normalitzada = triables[Math.floor(aleatori() * triables.length)];
    return { normalitzada, mostrar: seccio.paraules.get(normalitzada) };
}
