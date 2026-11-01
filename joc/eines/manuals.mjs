// Valida les paraules del dia manuals i en publica la versió xifrada.
//
//   node joc/eines/manuals.mjs                      valida i escriu joc/dades/especials.json
//   node joc/eines/manuals.mjs --simula             només valida (no escriu res)
//   node joc/eines/manuals.mjs --detall             amb les rimes de cada paraula a cada dialecte
//   node joc/eines/manuals.mjs --entrada RUTA --dades RUTA --sortida RUTA --avui AAAA-MM-DD
//
// L'ENTRADA és un fitxer que s'edita a mà i es queda en local, fora del repositori:
// joc/eines/diaries_manuals.json (al .gitignore). Un objecte de data AAAA-MM-DD a
// paraula, amb la forma d'abans:
//
//   { "2026-12-25": { "facil": "pessebre", "dificil": "torró" },
//     "2027-01-06": "reis" }
//
// Amb un objecte es diu una paraula per dificultat (i se'n pot deixar una a la
// fórmula); amb una cadena, la mateixa per a totes dues. Les claus que no són una
// data ("_ajuda") s'ignoren. Les dels dies passats s'hi han de conservar: les fan
// servir la pantalla d'ahir i l'historial.
//
// QUE ES COMPROVA, i és el que fa que mai no hi hagi una paraula manual que valgui en
// uns dialectes i en altres no (que és com ha d'anar: la paraula del dia és la mateixa
// per a tothom):
//
//   - que a CADA dialecte sigui paraula a rimar (marcada amb «*» o «+» al fitxer del
//     dialecte: del diccionari global, no verb, no nom propi);
//   - que hi caigui a UNA sola clau consonant (sense homògrafs: «dona» / «dóna»);
//   - que la clau sigui publicada (amb prou rimes perquè l'index la porti).
//
// Si alguna paraula no ho compleix, l'script falla i no escriu res. I s'AVISA, sense
// fallar, si la paraula manual repeteix la d'un dia que surt de la fórmula (la mateixa
// paraula o la mateixa clau consonant) a menys de 30 dies.
//
// Els números de rimes que treu són els del dialecte: la paraula del dia és la mateixa
// per a tothom, però una paraula amb tres mil rimes en balear i cent en central no és
// la mateixa partida, i un dia assenyalat pot valer la pena una paraula fàcil.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { normalitza } from '../js/normalitza.js';
import { xifrar, resumDeLaData } from '../js/especials.js';
import { CARRILS, parellaDelDia } from '../js/eres.js';

const DIR_EINES = path.dirname(fileURLToPath(import.meta.url));
const DIR_DADES = path.join(DIR_EINES, '..', 'dades');

// On és la llista en clar: a joc/eines (que no es publica) i, mentre no s'hi hagi
// mogut, a l'antic lloc de joc/dades.
const ENTRADES = [
    path.join(DIR_EINES, 'diaries_manuals.json'),
    path.join(DIR_DADES, 'diaries_manuals.json'),
];

const CENTRAL = 'ca';
const DIES_DE_MARGE = 30;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const NOM_CARRIL = { facil: 'fàcil', dificil: 'difícil' };

const mil = (n) => n.toLocaleString('ca-ES');

/** El dia que és `dies` dies després d'una data AAAA-MM-DD (en pot ser de negatius). */
export function afegirDies(dataISO, dies) {
    const [any, mes, dia] = dataISO.split('-').map(Number);
    return new Date(Date.UTC(any, mes - 1, dia + dies)).toISOString().slice(0, 10);
}

export function esDataValida(text) {
    return DATA.test(text) && afegirDies(text, 0) === text;
}

/** Avui AAAA-MM-DD, comptat a Catalunya com al joc (avui() a magatzem.js). */
export function dataDAvui() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

// -------------------------------------------------------------- L'entrada

/**
 * Les entrades d'un fitxer de manuals: [{ data, carril, paraula }], una per dia i
 * dificultat. Falla si té mala forma.
 */
export function llegirManuals(manuals) {
    if (!manuals || typeof manuals !== 'object' || Array.isArray(manuals)) {
        throw new Error('ha de ser un objecte de data a paraula');
    }
    const entrades = [];
    for (const [data, valor] of Object.entries(manuals)) {
        if (data.startsWith('_')) continue;           // "_ajuda", "_exemple"...
        if (!esDataValida(data)) throw new Error(`«${data}» no és una data AAAA-MM-DD`);

        if (typeof valor === 'string') {
            entrades.push({ data, carril: 'facil', paraula: valor }, { data, carril: 'dificil', paraula: valor });
        } else if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
            for (const clau of Object.keys(valor)) {
                if (clau !== 'facil' && clau !== 'dificil') {
                    throw new Error(`${data}: la clau «${clau}» no és ni «facil» ni «dificil»`);
                }
            }
            for (const carril of ['facil', 'dificil']) {
                if (!(carril in valor)) continue;
                if (typeof valor[carril] !== 'string') throw new Error(`${data}/${carril}: ha de ser una paraula`);
                entrades.push({ data, carril, paraula: valor[carril] });
            }
        } else {
            throw new Error(`${data}: ha de ser una paraula o un objecte amb facil/dificil`);
        }
    }
    for (const entrada of entrades) {
        if (normalitza(entrada.paraula) === '') throw new Error(`${entrada.data}/${entrada.carril}: la paraula és buida`);
    }
    return entrades;
}

// ------------------------------------------------------ Els fitxers dels dialectes

/**
 * El fitxer d'un dialecte (el de dades/<codi>.txt) com a Map de paraula
 * normalitzada a [{ clau, marca, mostrar }]: on és com a paraula a rimar, amb la
 * clau consonant de la secció. Les que no duen «*» ni «+» (verbs, apèndix) no hi són.
 */
export function llegirDialecte(text) {
    const trobades = new Map();
    let clau = null;
    for (const linia of text.split('\n')) {
        if (!linia) continue;
        if (linia[0] === '#') {
            clau = linia.slice(1);
            continue;
        }
        if (linia[0] !== '*' && linia[0] !== '+') continue;
        const cos = linia.slice(1);
        const tall = cos.indexOf('>');
        const normalitzada = tall === -1 ? cos : cos.slice(0, tall);
        const lloc = { clau, marca: linia[0], mostrar: tall === -1 ? cos : cos.slice(tall + 1) };
        if (trobades.has(normalitzada)) trobades.get(normalitzada).push(lloc);
        else trobades.set(normalitzada, [lloc]);
    }
    return trobades;
}

/**
 * Si una paraula es pot jugar en un dialecte, i on cau: { ok, clau, grup, rimes,
 * rimesDelGrup, mostrar } o { ok: false, motiu }. `tros` és index.dialectes[codi].
 */
export function resoldreAlDialecte(normalitzada, trobades, tros) {
    const llocs = trobades.get(normalitzada);
    if (!llocs) return { ok: false, motiu: 'no hi és com a paraula a rimar (és un verb, un nom propi, de l\'apèndix o no existeix)' };

    const claus = [...new Set(llocs.map((lloc) => lloc.clau))];
    if (claus.length > 1) {
        return { ok: false, motiu: `cau a ${claus.length} claus (${claus.map((c) => '-' + c).join(', ')}): no se sabria quina lectura toca` };
    }
    const entrada = tros.claus.find((c) => c[0] === claus[0]);
    if (!entrada) return { ok: false, motiu: `la seva clau -${claus[0]} no és publicada: té massa poques rimes` };

    return {
        ok: true, clau: claus[0], grup: entrada[1], rimes: entrada[3],
        rimesDelGrup: tros.grups[entrada[1]][3], mostrar: llocs[0].mostrar, marca: llocs[0].marca,
    };
}

/**
 * Valida cada entrada als dialectes de `dialectes` (Map de codi a { trobades, tros }).
 * Torna { errors, files, resolucions }: `files` és el que s'imprimeix i
 * `resolucions` (clau "data|carril") on cau cada paraula vàlida al central.
 */
export function validar(entrades, dialectes) {
    const errors = [];
    const files = [];
    const resolucions = new Map();
    for (const entrada of entrades) {
        const paraula = normalitza(entrada.paraula);
        const perDialecte = {};
        let ok = true;
        for (const [codi, { trobades, tros }] of dialectes) {
            const resolucio = resoldreAlDialecte(paraula, trobades, tros);
            perDialecte[codi] = resolucio;
            if (!resolucio.ok) {
                ok = false;
                errors.push(`${entrada.data} ${NOM_CARRIL[entrada.carril]}: «${entrada.paraula}» ${codi}: ${resolucio.motiu}`);
            }
        }
        files.push({ ...entrada, paraula, perDialecte });
        if (ok) resolucions.set(`${entrada.data}|${entrada.carril}`, { paraula, central: perDialecte[CENTRAL] });
    }
    return { errors, files, resolucions };
}

// ------------------------------------------------------ Els avisos de coincidència

/**
 * Els dies que surten de la fórmula (o són manuals) a menys de `dies` dies d'una
 * manual i en repeteixen la paraula (a qualsevol dificultat) o la clau consonant (a la
 * mateixa). Només es mira des d'avui: les dels dies passats ja han sortit.
 *
 * AL FÀCIL NO ES MIRA EL GRUP ASSONANT, que és el que la fórmula hi tria: n'hi ha
 * una trentena i cada un torna cada 14-36 dies per disseny, o sigui que avisaria
 * a totes les manuals i no diria res.
 *
 * Es fa amb el mateix mòdul del joc (parellaDelDia) i la resolució que porta l'index
 * (index.eres), sense cap còpia de la fórmula. Si l'era no té resolució a l'index, es
 * compara només la paraula.
 */
export function coincidencies({ entrades, resolucions, eres, index, avui, dies = DIES_DE_MARGE }) {
    const avisos = [];
    const manuals = new Map(entrades.map((e) => [`${e.data}|${e.carril}`, normalitza(e.paraula)]));

    // On cau al central una paraula de la fórmula, amb la resolució de l'index.
    const aCentral = (era, indexParaula) => {
        const posicions = (((index || {}).eres || {})[era] || {})[CENTRAL];
        const entrada = posicions && index.dialectes[CENTRAL].claus[posicions[indexParaula]];
        return entrada ? { clau: entrada[0], grup: entrada[1] } : null;
    };

    for (const entrada of entrades) {
        if (entrada.data < avui) continue;
        const meva = resolucions.get(`${entrada.data}|${entrada.carril}`);
        if (!meva) continue;
        const central = meva.central;

        for (let delta = -(dies - 1); delta <= dies - 1; delta++) {
            if (delta === 0) continue;
            const data = afegirDies(entrada.data, delta);
            let parella;
            try {
                parella = parellaDelDia(eres, data);
            } catch (error) {
                continue;            // abans de la primera era no hi ha fórmula
            }
            for (const carril of CARRILS) {
                const manual = manuals.get(`${data}|${carril}`);
                const auto = parella[carril];
                const paraula = manual || auto.objectiu.normalitzada;
                const altra = manual ? (resolucions.get(`${data}|${carril}`) || {}).central : aCentral(auto.era, auto.indexParaula);

                let que = null;
                if (paraula === meva.paraula) que = 'la mateixa paraula';
                else if (carril === entrada.carril && altra && altra.clau === central.clau) que = `la mateixa clau (-${central.clau})`;
                if (que) {
                    avisos.push(`${entrada.data} ${NOM_CARRIL[entrada.carril]} «${entrada.paraula}»: `
                        + `${que} el ${data} (${NOM_CARRIL[carril]}, «${paraula}»${manual ? ', manual' : ''})`);
                }
            }
        }
    }
    return avisos;
}

// ------------------------------------------------------- El fitxer xifrat

/** L'especials.json (l'objecte, sense escriure res) amb totes les entrades. */
export function construirEspecials(entrades) {
    const perData = new Map();
    for (const { data, carril, paraula } of entrades) {
        if (!perData.has(data)) perData.set(data, {});
        perData.get(data)[carril] = normalitza(paraula);
    }

    const dies = {};
    for (const [data, paraules] of perData) {
        const clau = resumDeLaData(data);
        if (clau in dies) throw new Error(`El resum de les dates ${data} i una altra coincideix: cal canviar la sal`);
        dies[clau] = xifrar(paraules, data);
    }
    return { v: 1, dies };
}

/** Una entrada per línia i per ordre del resum, no de la data: l'ordre no diu res. */
export function textDelFitxer(especials) {
    const files = Object.keys(especials.dies).sort()
        .map((clau) => `${JSON.stringify(clau)}:${JSON.stringify(especials.dies[clau])}`);
    return `{"v":${especials.v},"dies":{\n${files.join(',\n')}\n}}\n`;
}

// --------------------------------------------------------------- L'ordre

function llegirArguments(arguments_) {
    const opcions = { simula: false, detall: false };
    for (let i = 0; i < arguments_.length; i++) {
        const argument = arguments_[i];
        if (argument === '--simula') opcions.simula = true;
        else if (argument === '--detall') opcions.detall = true;
        else if (['--entrada', '--dades', '--sortida', '--avui'].includes(argument)) opcions[argument.slice(2)] = arguments_[++i];
        else throw new Error(`No entenc «${argument}»`);
    }
    return opcions;
}

function main() {
    let opcions;
    try {
        opcions = llegirArguments(process.argv.slice(2));
    } catch (error) {
        console.error(error.message);
        process.exit(2);
    }

    const dades = opcions.dades || DIR_DADES;
    const entrada = opcions.entrada || ENTRADES.find((cami) => fs.existsSync(cami));
    if (!entrada || !fs.existsSync(entrada)) {
        console.error(`No trobo la llista de manuals (${path.relative(process.cwd(), ENTRADES[0])}). `
            + 'Crea-la o digues-ne una amb --entrada.');
        process.exit(2);
    }
    const sortida = opcions.sortida || path.join(dades, 'especials.json');
    const avui = opcions.avui || dataDAvui();

    let entrades;
    try {
        entrades = llegirManuals(JSON.parse(fs.readFileSync(entrada, 'utf8')));
    } catch (error) {
        console.error(`${path.relative(process.cwd(), entrada)}: ${error.message}`);
        process.exit(1);
    }
    if (entrades.length === 0) {
        console.log('No hi ha cap paraula manual: tot va amb la fórmula.');
        return;
    }

    const index = JSON.parse(fs.readFileSync(path.join(dades, 'index.json'), 'utf8'));
    const versions = JSON.parse(fs.readFileSync(path.join(dades, 'versions.json'), 'utf8'));
    console.log('Llegint els fitxers dels dialectes...');
    const dialectes = new Map(versions.dialectes.map(({ codi }) => [codi, {
        trobades: llegirDialecte(fs.readFileSync(path.join(dades, `${codi}.txt`), 'utf8')),
        tros: index.dialectes[codi],
    }]));

    const { errors, files, resolucions } = validar(entrades, dialectes);
    for (const fila of files.sort((a, b) => (a.data + a.carril).localeCompare(b.data + b.carril))) {
        const rimes = Object.entries(fila.perDialecte).map(([codi, r]) => (r.ok
            ? `${codi} ${mil(fila.carril === 'dificil' ? r.rimes : r.rimesDelGrup)}`
            : `${codi} NO`)).join(' · ');
        console.log(`${fila.data} ${NOM_CARRIL[fila.carril].padEnd(7)} «${fila.paraula}»  ${rimes} rimes`);
        if (opcions.detall) {
            for (const [codi, r] of Object.entries(fila.perDialecte)) {
                console.log(r.ok ? `    ${codi}: «${r.mostrar}» ${r.marca} -${r.clau}` : `    ${codi}: ${r.motiu}`);
            }
        }
    }

    if (errors.length) {
        console.error(`\n${errors.length} problema(es): una paraula manual ha de ser paraula a rimar, i caure a una sola clau, `
            + 'a tots els dialectes.\n  ' + errors.join('\n  '));
        console.error('\nNo s\'ha escrit res.');
        process.exit(1);
    }

    const avisos = coincidencies({ entrades, resolucions, eres: JSON.parse(fs.readFileSync(path.join(dades, 'eres.json'), 'utf8')).eres, index, avui });
    if (avisos.length) {
        console.log(`\nAvisos (a menys de ${DIES_DE_MARGE} dies d'una altra paraula igual o de la mateixa clau):`);
        for (const avis of avisos) console.log(`  avís   ${avis}`);
    }

    const especials = construirEspecials(entrades);
    console.log(`\nTot correcte: ${entrades.length} paraules en ${Object.keys(especials.dies).length} dies, `
        + `bones als ${dialectes.size} dialectes.`);
    if (opcions.simula) {
        console.log('(--simula: no s\'ha escrit res)');
        return;
    }
    fs.writeFileSync(sortida, textDelFitxer(especials));
    console.log(`Desat a ${path.relative(process.cwd(), sortida)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
