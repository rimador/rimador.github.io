// Triar la paraula objectiu d'una partida.
//
// L'IL·LIMITAT es fa sobre l'index del dialecte que es juga: cada dialecte
// reparteix les paraules en claus de rima diferents i per tant te el seu index.
//
// LA PARAULA DEL DIA, NO. N'hi ha DUES al dia -una per dificultat- i son les
// mateixes per a tothom, jugui en el dialecte que jugui. No poden sortir de
// l'index d'un dialecte, doncs, sino d'una llista a part que es la interseccio
// dels quatre (el bloc "diaries" de l'index.json, que escriu construir_diaries
// a joc/eines/generar_dades.py). El que continua canviant amb el dialecte son
// les RIMES que valen, que es de que va el lloc.
//
// Nomes poden sortir paraules d'una clau de rima consonant que tingui entre 30
// i 800 rimes (mira MIN_RIMES i MAX_RIMES a joc/eines/generar_dades.py). El
// minim garanteix que sempre hi ha rimes de sobres -la clau consonant implica
// l'assonant, o sigui que si val en dificil val en facil-, i el maxim es el que
// treu del joc les terminacions on rima gairebe tot ("camio", "vent", "gos"),
// que era el problema que es volia arreglar vetant les agudes i que vetant-les
// no s'arreglava (hi ha agudes fines i planes barates).
//
// I LA FINESTRA ES COMPROVA ALS QUATRE DIALECTES, no nomes al que es juga. La
// mateixa paraula reparteix rimes molt diferents segons on la diguis ("reflux"
// en te 64 en central i 582 en balear), i la classificacio es UNA de sola per a
// tothom: una paraula que en central dona vint rimes i en valencia nou-centes
// no seria la mateixa partida segons qui la jugui. Ho decideix el generador, que
// marca cada paraula del fitxer segons si es pot rimar arreu ("*") o nomes al
// mode personalitzat ("+"), i l'index en porta el recompte de cada clau.
//
// EL PERSONALITZAT ES L'EXCEPCIO, i a posta: alla el jugador es tria la finestra
// -part de la gracia es poder demanar una terminacio de tres rimes o una de sis
// mil- i el dialecte va tancat dins de l'enllac, o sigui que tots dos jugadors
// juguen el mateix i no fa falta que la paraula valgui a tot arreu.
//
// ELS DOS MODES TRIEN PER CLAU DE RIMA, no per paraula: totes les terminacions
// jugables son igual de probables, tinguin les paraules que tinguin.
//
// La diferencia no es cap detall. Triant per paraula -amb probabilitat
// proporcional al nombre d'objectius de cada clau, que es com es feia-, les
// terminacions grosses se't queden la meitat de les partides, perque tenen mes
// paraules i hi caus mes sovint: la paraula que et tocava tenia 149 rimes de
// mediana i UNA DE CADA TRES PARTIDES en passava de 300, que en un minut es
// "escriu de pressa" i no pas "pensa". Triant per clau, la mediana baixa a 45 i
// nomes el 6% de les partides passen de 300.

import { normalitza } from './normalitza.js?v=3b520f9';

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

// Cada entrada de "claus" es
//   [clauConsonant, numeroDeGrup, nombreObjectius, nombreDeRimes, objectiusArreu]
// i cada entrada de "grups" es
//   [inici, llarg, classeDAccent, rimesDelGrup]
//
// ELS DOS RECOMPTES D'OBJECTIUS no son cap duplicat: "nombreObjectius" son totes
// les paraules no verbals de la clau (les que pot proposar el mode
// personalitzat) i "objectiusArreu" nomes les que es poden rimar als quatre
// dialectes (les que poden proposar la paraula del dia i l'il·limitat). Els dos
// fan de pes a clauDeLaRima, i barrejar-los faria sortir claus sense cap
// paraula jugable.
//
// El grup es un grup assonant dins el fitxer del dialecte; on comenca i quant
// ocupa ho diu index.dialectes[codi].grups (vegeu grupDeRimes a dades.js).
//
// LA CLASSE D'ACCENT es 1 aguda, 2 plana i 3 esdruixola, i surt de la llargada
// de la clau assonant: la clau assonant es la sequencia de vocals des de la
// tonica fins al final, o sigui que comptar-les es comptar les sillabes des de
// l'accent. Comprovat contra la transcripcio de 88.541 paraules sense ni un sol
// desacord, diftongs inclosos ("remei" surt aguda i "canvi" plana). Es la
// mateixa regla que llistes/generar_mots_de7_glosa.py.
const CLAU = 0;
const GRUP = 1;
const OBJECTIUS = 2;
const RIMES = 3;
const ARREU = 4;

const G_CLASSE = 2;
const G_RIMES = 3;

/** Les classes d'accent, per si algu les vol anomenar. */
export const ACCENT = { AGUDA: 1, PLANA: 2, ESDRUIXOLA: 3 };

function trosDe(index, dialecte) {
    const tros = (index.dialectes || {})[dialecte];
    if (!tros) throw new Error(`L'index no te el dialecte "${dialecte}"`);
    return tros;
}

/**
 * Les claus que valen per als modes normals: les que tenen alguna paraula que es
 * pugui rimar ALS QUATRE dialectes.
 *
 * El fitxer en porta MOLTES MES -tot el que te dues rimes o mes-, perque el
 * mode personalitzat deixa triar la finestra al jugador (vegeu
 * MIN_RIMES_PUBLICADES a joc/eines/generar_dades.py). Els modes normals, doncs,
 * s'han de retallar la llista aqui.
 *
 * La finestra de min_rimes a max_rimes es comprova igualment, i no es cap
 * redundancia gratuita: una paraula marcada com a jugable arreu te, per forca,
 * la clau d'aquest dialecte dins de la finestra, pero les constants viuen a
 * l'index i el marcatge al fitxer de rimes, i si un dia es desincronitzen val
 * mes quedar-se curt que servir una partida que no toca.
 *
 * El resultat es guarda en un WeakMap indexat per l'array de claus: amb quatre
 * dialectes, anar i venir de la tira alternaria quatre llistes i una sola
 * casella no encertaria mai.
 */
const finestresEnMemoria = new WeakMap();

export function clausDeLaFinestra(index, tros) {
    const desat = finestresEnMemoria.get(tros.claus);
    if (desat) return desat;

    const minim = index.min_rimes || 0;
    const maxim = index.max_rimes || Infinity;
    const dins = tros.claus.filter(
        (c) => objectiusArreuDe(c) > 0 && c[RIMES] >= minim && c[RIMES] <= maxim);
    finestresEnMemoria.set(tros.claus, dins);
    return dins;
}

/**
 * Quantes paraules d'una clau es poden rimar als quatre dialectes.
 *
 * Les entrades d'un index escrit abans que aixo existis nomes tenen quatre
 * camps: aleshores no hi havia cap distincio i totes les paraules objectiu
 * valien a tot arreu, o sigui que el recompte de sempre es el que toca.
 */
function objectiusArreuDe(entrada) {
    return entrada.length > ARREU ? entrada[ARREU] : entrada[OBJECTIUS];
}

// ------------------------------------------------------- La paraula del dia

/**
 * La paraula del dia triada A MA per a un dia, si n'hi ha: la del
 * dades/diaries_manuals.json, que s'edita a ma per als dies assenyalats (que
 * per Nadal toqui rimar amb un mot nadalenc). Torna la forma normalitzada, o
 * null si aquell dia va amb la roda de sempre.
 *
 * EL FORMAT del fitxer es un objecte de data AAAA-MM-DD a paraula:
 *
 *   { "2026-12-25": { "facil": "pessebre", "dificil": "torró" },
 *     "2027-01-06": "reis" }
 *
 * Amb un objecte es diu una paraula per dificultat (i es pot deixar una de les
 * dues a la roda); amb una cadena, la mateixa per a totes dues. La paraula pot
 * dur accents: es normalitza aqui.
 *
 * QUE HA DE SER LA PARAULA: una del diccionari global que pugui ser paraula a
 * rimar (no un verb, no una de l'apendix), i que es pot comprovar amb
 * eines/comprovar_diaries_manuals.py abans de publicar-la. Si el dia arriba i
 * en algun dialecte no s'hi troba, aquell dialecte juga amb la de la roda (vegeu
 * seleccioDelDia a principal.js), o sigui que val la pena passar l'script.
 */
export function manualDelDia(manuals, dataISO, dificultat) {
    const entrada = (manuals || {})[dataISO];
    const paraula = typeof entrada === 'string' ? entrada
        : entrada && typeof entrada === 'object' ? entrada[dificultat] : null;
    if (typeof paraula !== 'string') return null;
    const normalitzada = normalitza(paraula);
    return normalitzada || null;
}

// Des de quin dia es compten els cicles. Qualsevol data serveix mentre no
// canvii mai: canviar-la desplacaria tota la roda i faria sortir una altra
// paraula. Va en UTC per no dependre del rellotge de ningu (el dia de debo el
// diu avui() a magatzem.js, que el compta en horari de Catalunya).
const EPOCA = Date.UTC(2026, 0, 1);

/** Quants dies han passat des de l'epoca fins a una data AAAA-MM-DD. */
function diaDeLaRoda(dataISO) {
    const [any, mes, dia] = dataISO.split('-').map(Number);
    return Math.round((Date.UTC(any, mes - 1, dia) - EPOCA) / 86400000);
}

/**
 * L'ordre en que es faran servir les claus en un cicle: una barreja de
 * Fisher-Yates sembrada amb el numero de cicle i la dificultat.
 *
 * ES AIXO EL QUE FA QUE NO ES REPETEIXI CAP PARAULA. Recorrent una barreja en
 * ordre, cada clau surt una vegada i prou fins que s'han fet servir totes; quan
 * s'acaben, comenca un cicle nou amb una barreja diferent i tot torna a estar
 * disponible. No cal desar enlloc quines han sortit: la barreja es calcula
 * sempre igual a tot arreu, com la paraula del dia mateixa.
 *
 * La dificultat entra a la llavor perque el facil i el dificil han de recorrer
 * la roda en ordres diferents; si no, cada dia tocarien la mateixa clau i les
 * dues paraules del dia serien germanes.
 */
const rodesEnMemoria = new Map();   // "quantes|clau" -> [posicions]

function ordreDeLaRoda(quantes, clauDeLaRoda) {
    const clau = `${quantes}|${clauDeLaRoda}`;
    const desat = rodesEnMemoria.get(clau);
    if (desat) return desat;

    const aleatori = generador(llavor(`rimador-joc-roda-${clauDeLaRoda}`));
    const ordre = Array.from({ length: quantes }, (_, i) => i);
    for (let i = quantes - 1; i > 0; i--) {
        const j = Math.floor(aleatori() * (i + 1));
        [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    }
    rodesEnMemoria.set(clau, ordre);
    return ordre;
}

/**
 * La paraula del dia: la MATEIXA per a tothom, jugui en el dialecte que jugui.
 * Nomes depen de la data i de la dificultat.
 *
 * Torna { clau, grup, objectiu: { normalitzada, mostrar } }, ja resolt per al
 * dialecte que es demani: la llista "diaries" diu, de cada paraula i dialecte,
 * a quina de les seves claus jugables cau (vegeu construir_diaries a
 * joc/eines/generar_dades.py).
 *
 * COM ES TRIA:
 *   1. Es compten els dies des de l'epoca i es parteixen en cicles tan llargs
 *      com claus de rima hi ha (663 ara mateix, un any i vuit mesos).
 *   2. Dins del cicle, la posicio del dia diu quina clau toca, seguint una
 *      barreja que nomes depen del cicle i la dificultat: cap clau no es
 *      repeteix fins que s'han fet servir totes.
 *   3. De les paraules d'aquella clau (fins a quatre), se'n tria una amb el
 *      mateix criteri. Aixi dos cicles seguits no donen la mateixa llista.
 */
export function paraulaDelDia(index, dataISO, dificultat, dialecte) {
    const diaries = index.diaries;
    if (!diaries || !diaries.claus || diaries.claus.length === 0) {
        throw new Error("L'index no porta la llista de paraules del dia");
    }

    const quantes = diaries.claus.length;
    const dia = diaDeLaRoda(dataISO);
    // Amb divisions de numeros negatius, el % de JavaScript torna negatius: les
    // dates anteriors a l'epoca han de donar una posicio valida igualment.
    const cicle = Math.floor(dia / quantes);
    const posicio = ((dia % quantes) + quantes) % quantes;

    const clauDeLaRoda = ordreDeLaRoda(quantes, `${cicle}-${dificultat}`)[posicio];
    const paraulesDeLaClau = diaries.claus[clauDeLaRoda];

    // Quina de les paraules de la clau, dins d'aquest cicle.
    const tria = llavor(`rimador-joc-paraula-${cicle}-${dificultat}-${clauDeLaRoda}`);
    const posicioParaula = paraulesDeLaClau[tria % paraulesDeLaClau.length];

    const cos = diaries.paraules[posicioParaula];
    const tall = cos.indexOf('>');
    const objectiu = {
        normalitzada: tall === -1 ? cos : cos.slice(0, tall),
        mostrar: tall === -1 ? cos : cos.slice(tall + 1),
    };

    const tros = trosDe(index, dialecte);
    const entrada = tros.claus[diaries.on[dialecte][posicioParaula]];
    if (!entrada) throw new Error(`La paraula del dia no es a l'index de "${dialecte}"`);

    return { clau: entrada[CLAU], grup: entrada[GRUP], objectiu };
}

// ------------------------------------------------------- Quina rima toca
//
// QUE ES UNA "RIMA" DEPEN DE LA DIFICULTAT, i aquesta es la peca clau de tot
// plegat:
//
//   dificil  -> cada CLAU CONSONANT es una rima. Les respostes bones son les
//               de la seva seccio i prou.
//   facil    -> cada GRUP ASSONANT es una rima. Les respostes bones son les del
//               grup SENCER, o sigui que dues claus del mateix grup son la
//               mateixa partida amb una altra paraula al davant.
//
// PER QUE IMPORTA. Si en facil es tries una clau consonant a l'atzar, els grups
// amb mes claus sortirien molt mes sovint: al central, el grup mes gros te 311
// claus i s'enduria el 7,3 % de les partides, mentre que els setze grups mes
// petits es reparteixen el 0,6 %. Triant per rima, cada grup te el seu 1,4 %.
// Es el mateix problema que triar per paraula en comptes de per clau, un pis
// mes amunt.
//
// I DINS D'UNA RIMA, quina paraula? La que sigui: en facil totes les del grup
// donen exactament la mateixa partida. Per aixo s'hi tria amb pes segons quants
// objectius te cada clau, que es la manera de fer que cada PARAULA del grup
// sigui igual de probable un cop la rima ja esta decidida.

/** Les rimes que encaixen amb uns filtres, en la unitat que toqui. */
export function opcionsDeRima(index, dialecte, filtres) {
    const tros = trosDe(index, dialecte);
    const esFacil = filtres.dificultat !== 'dificil';
    const minim = filtres.min || 0;
    const maxim = filtres.max || Infinity;
    const accents = filtres.accents || [1, 2, 3];

    if (!esFacil) {
        return tros.claus
            .filter((entrada) => accents.includes(tros.grups[entrada[GRUP]][G_CLASSE])
                && entrada[RIMES] >= minim && entrada[RIMES] <= maxim)
            .map((entrada) => ({
                grup: entrada[GRUP],
                claus: [entrada],
                pesos: [entrada[OBJECTIUS]],
                objectius: entrada[OBJECTIUS],
                rimes: entrada[RIMES],
            }));
    }

    // En facil, una entrada per grup assonant. El Map guarda l'ordre en que
    // s'hi posen les coses, i les claus venen ordenades alfabeticament: la
    // llista surt sempre igual, que es el que fa que dos jugadors coincideixin.
    const perGrup = new Map();
    for (const entrada of tros.claus) {
        const grup = tros.grups[entrada[GRUP]];
        if (!accents.includes(grup[G_CLASSE])) continue;
        if (grup[G_RIMES] < minim || grup[G_RIMES] > maxim) continue;

        let opcio = perGrup.get(entrada[GRUP]);
        if (!opcio) {
            opcio = { grup: entrada[GRUP], claus: [], pesos: [], objectius: 0,
                      rimes: grup[G_RIMES] };
            perGrup.set(entrada[GRUP], opcio);
        }
        opcio.claus.push(entrada);
        opcio.pesos.push(entrada[OBJECTIUS]);
        opcio.objectius += entrada[OBJECTIUS];
    }
    return [...perGrup.values()];
}

/**
 * Dins d'una rima, de quina clau surt la paraula. Amb pes segons els objectius
 * de cada clau, que es com cada paraula de la rima queda igual de probable.
 *
 * EL PES EL PORTA L'OPCIO (opcio.pesos), i no es cap floritura: cada mode compta
 * els objectius d'una manera -els normals nomes els que valen als quatre
 * dialectes, el personalitzat tots- i el total i els sumands han de sortir del
 * MATEIX lloc. Traient el total d'un camp i restant-ne un altre, la ruleta es
 * queda curta i les primeres claus del grup s'enduen mes del que els toca.
 */
function clauDeLaRima(opcio, aleatori) {
    if (opcio.claus.length === 1) return opcio.claus[0];
    let tall = aleatori() * opcio.objectius;
    for (let i = 0; i < opcio.claus.length; i++) {
        tall -= opcio.pesos[i];
        if (tall < 0) return opcio.claus[i];
    }
    return opcio.claus[opcio.claus.length - 1];
}

/**
 * Les rimes dels modes normals: les de la finestra de min_rimes a max_rimes.
 *
 * La finestra es mira SEMPRE sobre la clau consonant, tambe en facil, i es a
 * posta: es el que treu del joc les paraules com "camio", que son un mal
 * objectiu encara que les respostes surtin del grup sencer.
 */
const opcionsEnMemoria = new Map();   // "dialecte|dificultat" -> [opcions]

export function opcionsDeLaFinestra(index, dialecte, dificultat) {
    const memoria = `${dialecte}|${dificultat}`;
    const desat = opcionsEnMemoria.get(memoria);
    if (desat) return desat;

    const tros = trosDe(index, dialecte);
    const dins = clausDeLaFinestra(index, tros);
    // El pes es el nombre de paraules que es poden rimar ARREU, que son les
    // uniques que aquests modes poden proposar: amb el recompte de totes, una
    // clau plena de paraules que nomes valen al personalitzat s'enduria partides
    // que despres hauria de treure d'un grapat molt mes petit.
    const opcions = dificultat === 'dificil'
        ? dins.map((entrada) => ({
            grup: entrada[GRUP], claus: [entrada],
            pesos: [objectiusArreuDe(entrada)], objectius: objectiusArreuDe(entrada),
        }))
        : agruparPerGrup(dins);

    opcionsEnMemoria.set(memoria, opcions);
    return opcions;
}

function agruparPerGrup(claus) {
    const perGrup = new Map();
    for (const entrada of claus) {
        let opcio = perGrup.get(entrada[GRUP]);
        if (!opcio) {
            opcio = { grup: entrada[GRUP], claus: [], pesos: [], objectius: 0 };
            perGrup.set(entrada[GRUP], opcio);
        }
        const pes = objectiusArreuDe(entrada);
        opcio.claus.push(entrada);
        opcio.pesos.push(pes);
        opcio.objectius += pes;
    }
    return [...perGrup.values()];
}

/** Una rima a l'atzar, per al mode il·limitat. */
export function clauAleatoria(index, dialecte, dificultat) {
    const opcions = opcionsDeLaFinestra(index, dialecte, dificultat);
    const opcio = opcions[Math.floor(Math.random() * opcions.length)];
    const entrada = clauDeLaRima(opcio, Math.random);
    return { clau: entrada[CLAU], grup: entrada[GRUP] };
}

// ---------------------------------------------------- Mode personalitzat

/**
 * Que hi ha amb uns filtres: quantes rimes, quantes paraules es podrien
 * proposar i entre quantes respostes es mouen. Ho ensenya la pantalla de
 * configuracio perque no es pugui comencar una partida impossible.
 */
export function marge(index, dialecte, filtres) {
    const opcions = opcionsDeRima(index, dialecte, filtres);
    const tros = trosDe(index, dialecte);
    const esFacil = filtres.dificultat !== 'dificil';

    let objectius = 0;
    let menys = Infinity;
    let mes = 0;
    for (const opcio of opcions) {
        objectius += opcio.objectius;
        const rimes = esFacil ? tros.grups[opcio.grup][G_RIMES] : opcio.claus[0][RIMES];
        if (rimes < menys) menys = rimes;
        if (rimes > mes) mes = rimes;
    }
    return {
        rimes: opcions.length,
        objectius,
        minRimes: opcions.length ? menys : 0,
        maxRimes: mes,
    };
}

/**
 * Quines rimes toquen a cada ronda d'una partida personalitzada.
 *
 * NO SE'N REPETEIX CAP. Igual que la paraula del dia, les rimes es recorren
 * seguint una barreja de Fisher-Yates en comptes de tirar-les a l'atzar cada
 * vegada: aixi cada rima surt una vegada i prou fins que s'han fet servir
 * totes, i quan s'acaben comenca una volta nova amb una barreja diferent. No
 * cal desar enlloc quines han sortit.
 *
 * I la roda NO ES REINICIA a cada partida: la passa es compta des de la
 * primera, o sigui que qui juga tres partides de tres rondes veu nou rimes
 * diferents i no pas tres de repetides.
 *
 * TOT SURT DE LA SIGNATURA, que duu tots els ajustos i la llavor: dos jugadors
 * amb el mateix enllac tenen la mateixa barreja i, per tant, les mateixes
 * paraules a la mateixa ronda de la mateixa partida.
 */
export function rondesPersonalitzades(index, dialecte, config) {
    const opcions = opcionsDeRima(index, dialecte, config);
    if (opcions.length === 0) {
        throw new Error('Amb aquests filtres no hi ha cap paraula per jugar');
    }

    const rondes = [];
    for (let ronda = 0; ronda < config.rondes; ronda++) {
        const passa = (config.partida - 1) * config.rondes + ronda;
        const volta = Math.floor(passa / opcions.length);
        const posicio = passa % opcions.length;

        const ordre = ordreDeLaRoda(opcions.length,
                                    `${config.signatura}-${volta}`);
        const opcio = opcions[ordre[posicio]];

        // El mateix generador tria la clau dins de la rima i despres la paraula
        // dins de la clau (se'l passem a triarParaula): son dues tirades
        // seguides de la mateixa serie, i per tant iguals a tots dos aparells.
        const aleatori = generador(llavor(`rimador-joc-paraula-${config.signatura}-${passa}`));
        const entrada = clauDeLaRima(opcio, aleatori);
        rondes.push({ clau: entrada[CLAU], grup: entrada[GRUP], aleatori });
    }
    return rondes;
}

/**
 * La paraula objectiu concreta dins d'una seccio. Torna { normalitzada, mostrar }.
 *
 * Nomes tria d'entre les paraules marcades com a objectiu (vegeu
 * pot_ser_objectiu a joc/eines/generar_dades.py). La llista ve ordenada des del
 * generador, o sigui que amb la mateixa llavor i el mateix grup surt sempre la
 * mateixa paraula.
 *
 * Amb `arreu` (que es el que fan els modes normals) nomes s'hi trien les que es
 * poden rimar als quatre dialectes; el mode personalitzat les vol totes, perque
 * alla la finestra la tria el jugador i el dialecte va tancat dins de l'enllac.
 */
export function triarParaula(grup, clau, aleatori = Math.random, arreu = true) {
    const seccio = grup.seccions.get(clau);
    const tria = seccio && (arreu ? seccio.objectiusArreu : seccio.objectius);
    if (!tria || tria.length === 0) {
        throw new Error(`Seccio sense objectius${arreu ? ' jugables arreu' : ''}: "${clau}"`);
    }
    const normalitzada = tria[Math.floor(aleatori() * tria.length)];
    return { normalitzada, mostrar: seccio.paraules.get(normalitzada) };
}
