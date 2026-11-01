// Proves de l'il·limitat natiu (joc/js/illimitat.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { configNativa, triarNativa, triarParaulaNativa } from '../../js/illimitat.js';
import { llavor, generador } from '../../js/objectius.js';
import { llegirDialecte } from '../manuals.mjs';

// ------------------------------------------------------------- Les fixtures

/**
 * Una era amb aquests talls i quotes als dos carrils (les quotes, en per mil). Cada era de les
 * proves porta el seu identificador: configNativa desa la configuració per era, com al joc,
 * on dues eres no tenen mai el mateix.
 */
let propera = 1;
function eraDe(talls, quotes, facil = { talls, quotes }) {
    const carril = (t, q) => ({ bosses: t.map(([de, fins], i) => ({ de, fins, quota: q[i] })) });
    return { id: propera++, algorisme: 1, carrils: { dificil: carril(talls, quotes), facil: carril(facil.talls, facil.quotes) } };
}

const TALLS = [[15, 49], [50, 99], [100, 499], [500, 999]];
const QUOTES = [100, 200, 500, 200];

/**
 * Un índex de joguina d'un dialecte. `claus` són [nom, grup, objectius, rimes, natius?]; un
 * grup té les rimes que diu `grups`.
 */
function indexDe(claus, grups, homografs = []) {
    return {
        dialectes: {
            ca: {
                grups: grups.map((rimes) => [0, 0, 2, rimes]),
                claus: claus.map(([nom, grup, objectius, rimes, natius]) => (
                    natius === undefined ? [nom, grup, objectius, rimes, objectius] : [nom, grup, objectius, rimes, objectius, natius])),
                homografs,
            },
        },
    };
}

/** n claus: a00, a01... amb les rimes consecutives des de les donades, repartides entre els grups. */
const claus = (prefix, n, rimes, grups) => Array.from(
    { length: n }, (_, i) => [`${prefix}${String(i).padStart(2, '0')}`, grups[i % grups.length], 3, rimes + i]);

const INDEX = indexDe([
    ...claus('a', 6, 20, [0, 1, 2]),                // 15-49: 6 claus
    ...claus('b', 10, 55, [3, 4, 5, 6]),            // 50-99: 10
    ...claus('c', 20, 120, [7, 8, 9, 10, 11, 12]),  // 100-499: 20
    // 500-999: cap clau (la bossa surt del patró)
    ['z-sense-natives', 13, 2, 130, 0],     // les dues objectiu són homògrafs: no es pot triar
    ['z-fora-de-talls-baix', 13, 3, 5],
    ['z-fora-de-talls-alt', 13, 3, 5000],
], [30, 33, 36, 60, 70, 80, 90, 150, 200, 250, 300, 350, 400, 3000]);

// ------------------------------------------------------------- La configuració

test('cada clau va a la bossa que li toca amb les rimes PRÒPIES del dialecte', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    const noms = config.actives.map((b) => b.unitats.map((u) => u.id));
    assert.deepEqual(config.actives.map((b) => b.original), [0, 1, 2]);       // la 500-999 no té claus: fora del patró
    assert.equal(noms[0].length, 6);
    assert.equal(noms[1].length, 10);
    assert.equal(noms[2].length, 20);
    for (const bossa of config.actives) {
        const talls = TALLS[bossa.original];
        for (const unitat of bossa.unitats) assert.ok(unitat.rimes >= talls[0] && unitat.rimes <= talls[1]);
    }
    // Ni la que té totes les paraules homògrafes ni les que cauen fora dels talls.
    const totes = noms.flat();
    for (const fora of ['z-sense-natives', 'z-fora-de-talls-baix', 'z-fora-de-talls-alt']) assert.ok(!totes.includes(fora));
});

test('una bossa sense claus en aquest dialecte surt del patró i les altres es reparteixen els dies', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    assert.equal(config.patro.W, 800);                    // 100 + 200 + 500: la de 200 no hi és
    assert.deepEqual(config.patro.quotes, [100, 200, 500]);
});

test('una bossa amb quota 0 no surt mai, tingui claus o no', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, [100, 0, 700, 200]));
    assert.deepEqual(config.actives.map((b) => b.original), [0, 2]);
});

test('sense res a jugar torna null, i la config es guarda per índex', () => {
    assert.equal(configNativa(INDEX, 'ca', 'dificil', eraDe([[900000, 900001]], [1000])), null);
    assert.equal(configNativa(INDEX, 'xx', 'dificil', eraDe(TALLS, QUOTES)), null);
    const era = eraDe(TALLS, QUOTES);
    assert.equal(configNativa(INDEX, 'ca', 'dificil', era), configNativa(INDEX, 'ca', 'dificil', era));
});

test('les paraules natives manen: una clau que només en té d\'homògrafes no entra al difícil', () => {
    // El sisè camp (natius) hi és quan difereix de les objectiu; sense ell, són les mateixes.
    const indexSenseCamp = indexDe([['a', 0, 2, 20], ['b', 0, 2, 30, 0]], [100]);
    const config = configNativa(indexSenseCamp, 'ca', 'dificil', eraDe([[15, 49]], [1000]));
    assert.deepEqual(config.actives[0].unitats.map((u) => u.id), ['a']);
});

// ---------------------------------------------------------------- La seqüència

function jugar(config, usuari, partides) {
    const resultats = [];
    let comptador = 0;
    for (let i = 0; i < partides; i++) {
        const triada = triarNativa(config, usuari, comptador);
        comptador += triada.consumides;
        resultats.push(triada);
    }
    return resultats;
}

test('qui fa N partides té exactament les de cada bossa que li toquen, amb l\'error d\'un dia', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    const { W, quotes } = config.patro;
    for (const usuari of ['usr_a', 'usr_b', 'usr_c', 'usr_d']) {
        const partides = jugar(config, usuari, 5 * W);
        const compte = new Map();
        partides.forEach((p, i) => {
            compte.set(p.bossa, (compte.get(p.bossa) || 0) + 1);
            const fets = i + 1;
            // |fets · quota / W - vegades| < 1, en enters, per a cada bossa del patró.
            config.actives.forEach((bossa, k) => {
                assert.ok(Math.abs(fets * quotes[k] - (compte.get(bossa.original) || 0) * W) < W * 1.05,
                    `${usuari}: la bossa ${bossa.original} s'allunya massa a la partida ${fets}`);
            });
        });
        // I cada cop que passa un patró sencer, exactament.
        config.actives.forEach((bossa, k) => assert.equal(compte.get(bossa.original), 5 * quotes[k]));
    }
});

test('dins d\'una volta d\'una bossa no es repeteix cap clau', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    const partides = jugar(config, 'usr_voltes', 6000);
    const voltes = new Map();
    for (const p of partides) {
        const id = `${p.bossa}|${p.volta}`;
        if (!voltes.has(id)) voltes.set(id, new Set());
        assert.ok(!voltes.get(id).has(p.clau), `la clau ${p.clau} es repeteix a la volta ${id}`);
        voltes.get(id).add(p.clau);
    }
    // I totes hi surten, volta rere volta: la bossa petita (6 claus) en fa moltes de senceres.
    const sencera = [...voltes.entries()].filter(([id]) => id.startsWith('0|') && voltes.get(id).size === 6);
    assert.ok(sencera.length > 20);
});

test('cada jugador té la seva seqüència i cap no comença a la mateixa bossa', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    const primeres = Array.from({ length: 40 }, (_, i) => triarNativa(config, `usr_${i}`, 0));
    const bosses = new Set(primeres.map((p) => p.bossa));
    assert.ok(bosses.size >= 3, 'tots els jugadors comencen igual');
    const claus = new Set(primeres.map((p) => p.clau));
    assert.ok(claus.size > 15);
    // Un mateix jugador, la mateixa seqüència: no depèn de res més.
    assert.deepEqual(jugar(config, 'usr_x', 300).map((p) => p.clau), jugar(config, 'usr_x', 300).map((p) => p.clau));
    assert.notDeepEqual(jugar(config, 'usr_x', 50).map((p) => p.clau), jugar(config, 'usr_y', 50).map((p) => p.clau));
});

test('el dialecte i la dificultat també canvien la seqüència del jugador', () => {
    const era = eraDe(TALLS, QUOTES);
    const a = configNativa(INDEX, 'ca', 'dificil', era);
    const b = configNativa(INDEX, 'ca', 'facil', era);
    assert.notDeepEqual(jugar(a, 'usr_x', 40).map((p) => p.bossa), jugar(b, 'usr_x', 40).map((p) => p.bossa));
});

test('es salta la unitat de la paraula del dia, i s\'han gastat dues posicions', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    const normal = triarNativa(config, 'usr_salt', 7);
    const saltada = triarNativa(config, 'usr_salt', 7, normal.clau);
    assert.notEqual(saltada.clau, normal.clau);
    assert.equal(saltada.consumides, 2);
    assert.deepEqual(triarNativa(config, 'usr_salt', 8).clau, saltada.clau);     // és la partida següent de la seqüència
    // Amb una paraula del dia que no hi surt, res no canvia.
    assert.deepEqual(triarNativa(config, 'usr_salt', 7, 'una-altra').clau, normal.clau);
    assert.equal(triarNativa(config, 'usr_salt', 7, 'una-altra').consumides, 1);
});

test('en 5.000 partides amb una clau del dia canviant, mai no surt la del dia', () => {
    const config = configNativa(INDEX, 'ca', 'dificil', eraDe(TALLS, QUOTES));
    const totes = config.actives.flatMap((b) => b.unitats.map((u) => u.id));
    let comptador = 0, saltades = 0;
    for (let i = 0; i < 5000; i++) {
        const delDia = totes[i % totes.length];
        const triada = triarNativa(config, 'usr_dia', comptador, delDia);
        assert.notEqual(triada.clau, delDia);
        if (triada.consumides > 1) saltades += 1;
        comptador += triada.consumides;
    }
    assert.ok(saltades > 30 && saltades < 400, `${saltades} saltades`);
});

test('amb una sola unitat en joc no hi ha alternativa i es serveix igualment', () => {
    const index = indexDe([['unica', 0, 2, 30]], [100]);
    const config = configNativa(index, 'ca', 'dificil', eraDe([[15, 49]], [1000]));
    const triada = triarNativa(config, 'usr_unic', 0, 'unica');
    assert.equal(triada.clau, 'unica');
    assert.ok(triada.consumides >= 1);
});

// ------------------------------------------------------------------ El fàcil

test('al fàcil la unitat és el grup assonant, amb les seves rimes, i les claus pesen per les paraules natives', () => {
    const index = indexDe([
        ['x1', 0, 1, 20], ['x2', 0, 3, 20],                   // un grup de dues claus (pesos 1 i 3)
        ['y1', 1, 2, 300], ['y2', 2, 2, 300],                 // dos grups d'una clau
    ], [40, 400, 400]);
    const config = configNativa(index, 'ca', 'facil', eraDe([[15, 49], [50, 999]], [100, 900]));
    assert.deepEqual(config.actives.map((b) => b.unitats.map((u) => u.id)), [['0'], ['1', '2']]);
    // Només hi ha un grup a la bossa 15-49: totes les seves sortides són d'aquell grup, i la clau
    // surt en proporció a les paraules natives (1 contra 3).
    const compte = { x1: 0, x2: 0 };
    let comptador = 0;
    for (let i = 0; i < 20000; i++) {
        const triada = triarNativa(config, 'usr_pes', comptador);
        comptador += triada.consumides;
        if (triada.bossa === 0) compte[triada.clau] += 1;
    }
    const total = compte.x1 + compte.x2;
    assert.ok(total > 1900 && total < 2100, `${total} sortides de la bossa petita`);
    assert.ok(Math.abs(compte.x2 / total - 0.75) < 0.03, `x2: ${compte.x2 / total}`);
    // El grup (no la clau) és el que es compara amb el de la paraula del dia.
    const del = triarNativa(config, 'usr_pes', 0);
    const saltada = triarNativa(config, 'usr_pes', 0, String(del.grup));
    assert.notEqual(saltada.grup, del.grup);
});

// ------------------------------------------------------------- La paraula

function grupDe(clau, objectius) {
    return { seccions: new Map([[clau, { objectius, paraules: new Map(objectius.map((p) => [p, p.toUpperCase()])) }]]) };
}

test('la paraula surt de les objectiu de la clau, sense els homògrafs, i és la mateixa amb el mateix generador', () => {
    const grup = grupDe('k', ['alfa', 'beta', 'dona', 'gamma', 'dóna']);
    const homografs = new Set(['dona', 'dóna']);
    const vistes = new Set();
    for (let i = 0; i < 400; i++) {
        const triada = triarParaulaNativa(grup, 'k', generador(llavor(`prova-${i}`)), homografs);
        assert.ok(!homografs.has(triada.normalitzada));
        assert.equal(triada.mostrar, triada.normalitzada.toUpperCase());
        vistes.add(triada.normalitzada);
        assert.deepEqual(triada, triarParaulaNativa(grup, 'k', generador(llavor(`prova-${i}`)), homografs));
    }
    assert.deepEqual([...vistes].sort(), ['alfa', 'beta', 'gamma']);
});

test('una secció sense cap paraula nativa fa un error clar', () => {
    assert.throws(() => triarParaulaNativa(grupDe('k', ['dona']), 'k', Math.random, new Set(['dona'])), /sense paraules natives/);
    assert.throws(() => triarParaulaNativa(grupDe('k', ['a']), 'altra', Math.random, new Set()), /sense paraules natives/);
});

// -------------------------------------------------------- Amb les dades de debò

const DADES = fileURLToPath(new URL('../../dades/', import.meta.url));
const indexReal = JSON.parse(fs.readFileSync(`${DADES}index.json`, 'utf8'));

// Les bosses de la proposta (PER_DEFECTE a bosses_rimes_eres.py), en per mil.
const ERA_REAL = eraDe(
    [[15, 34], [35, 49], [50, 99], [100, 249], [250, 499], [500, 999], [1000, 4999], [5000, 8999], [9000, 26000]],
    [10, 15, 40, 400, 360, 150, 14, 7, 4],
    { talls: [[15, 49], [50, 99], [100, 499], [500, 1999], [2000, 4999], [5000, 13999], [14000, 150000]],
        quotes: [15, 25, 285, 275, 270, 110, 20] });

test('amb l\'índex de debò, a cada dialecte i dificultat, les bosses són coherents', () => {
    for (const codi of Object.keys(indexReal.dialectes)) {
        for (const carril of ['dificil', 'facil']) {
            const config = configNativa(indexReal, codi, carril, ERA_REAL);
            assert.ok(config, `${codi} ${carril}`);
            const vistes = new Set();
            for (const bossa of config.actives) {
                const talls = ERA_REAL.carrils[carril].bosses[bossa.original];
                for (const unitat of bossa.unitats) {
                    assert.ok(unitat.rimes >= talls.de && unitat.rimes <= talls.fins);
                    assert.ok(!vistes.has(unitat.id));
                    vistes.add(unitat.id);
                    assert.ok(unitat.claus.every((c) => (c.entrada.length > 5 ? c.entrada[5] : c.entrada[2]) > 0));
                }
            }
        }
    }
    // Una referència: al central, la bossa de 100 a 249 rimes del difícil té unes 126 claus natives.
    const central = configNativa(indexReal, 'ca', 'dificil', ERA_REAL);
    const gran = central.actives.find((b) => b.original === 3);
    assert.ok(gran.unitats.length > 100 && gran.unitats.length < 150, `${gran.unitats.length} claus`);
});

test('amb els fitxers de debò, en 3.000 partides mai no surt una paraula homògrafa ni de fora de la clau', () => {
    for (const [codi, carril] of [['ca', 'dificil'], ['va', 'facil']]) {
        const config = configNativa(indexReal, codi, carril, ERA_REAL);
        const trobades = llegirDialecte(fs.readFileSync(`${DADES}${codi}.txt`, 'utf8'));
        const perClau = new Map();      // clau -> paraules objectiu, en l'ordre del fitxer
        for (const [paraula, llocs] of trobades) {
            for (const { clau } of llocs) {
                if (!perClau.has(clau)) perClau.set(clau, []);
                perClau.get(clau).push(paraula);
            }
        }
        let comptador = 0;
        for (let i = 0; i < 3000; i++) {
            const triada = triarNativa(config, `usr_real_${codi}`, comptador);
            comptador += triada.consumides;
            const entrada = indexReal.dialectes[codi].claus.find((c) => c[0] === triada.clau);
            assert.equal(entrada[1], triada.grup, 'el grup és el de la clau');
            const grup = { seccions: new Map([[triada.clau, {
                objectius: perClau.get(triada.clau),
                paraules: new Map(perClau.get(triada.clau).map((p) => [p, p])),
            }]]) };
            const paraula = triarParaulaNativa(grup, triada.clau, triada.aleatori, config.homografs);
            assert.ok(!config.homografs.has(paraula.normalitzada));
            assert.ok(trobades.get(paraula.normalitzada).some((l) => l.clau === triada.clau));
        }
    }
});
