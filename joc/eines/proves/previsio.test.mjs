// Proves de la previsió (joc/eines/previsio.mjs): que digui el mateix que el joc.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    preveure, textDeLaPrevisio, paginaDeLaPrevisio, jsonDeLaPrevisio,
} from '../previsio.mjs';
import { llegirDialecte, llegirManuals } from '../manuals.mjs';
import { CARRILS, parellaDelDia } from '../../js/eres.js';
import { xifrar, resumDeLaData } from '../../js/especials.js';
import { afegirDies, eraPerDefecte } from './ajuda_eres.mjs';

const PREVISIO = fileURLToPath(new URL('../previsio.mjs', import.meta.url));
const DADES = fileURLToPath(new URL('../../dades/', import.meta.url));

// ------------------------------------------------------------- Un món de joguina

const INICI = '2026-12-01';
const ERA = eraPerDefecte({ id: 1, inici: INICI });
// Les eres de debò porten el tall de cada bossa; la de joguina no, i se li posa.
for (const carril of CARRILS) {
    ERA.carrils[carril].bosses.forEach((bossa, i) => Object.assign(bossa, { de: 100 * (i + 1), fins: 100 * (i + 1) + 99 }));
}
const ERES = [ERA];
const CODIS = ['ca', 'nw'];
const GRUPS = 7;

/**
 * Un index que resol cada paraula de l'era a la clau «k<posició>» a tots els dialectes. Les
 * rimes de cada clau són 100 + posició (+1 al segon dialecte) i les del grup, 1000 + 10 · grup.
 */
function indexDeProva(era) {
    const dialectes = {};
    const resolucio = {};
    CODIS.forEach((codi, k) => {
        dialectes[codi] = {
            grups: Array.from({ length: GRUPS }, (_, g) => [0, 0, 9, 1000 + g * 10 + k]),
            claus: era.paraules.map((_, i) => [`k${i}`, i % GRUPS, 3, 100 + i + k, 3]),
            homografs: [],
        };
        resolucio[codi] = era.paraules.map((_, i) => i);
    });
    return { dialectes, eres: { [era.id]: resolucio } };
}

const INDEX = indexDeProva(ERA);

// Per provar una manual que en un dialecte no val: es posa a true i es torna a deixar a false.
const NO_VAL_A_NW = { value: false };

/** El fitxer d'un dialecte en què «pessebre» és paraula a rimar a la clau k5 (o no hi és). */
const trobadesAmbPessebre = (codi) => new Map(codi === 'nw' && NO_VAL_A_NW.value ? [] : [
    ['pessebre', [{ clau: 'k5', marca: '*', mostrar: codi === 'ca' ? 'pessebré' : 'pessebre' }]],
]);

function especialsDe(data, paraules) {
    return { v: 1, dies: { [resumDeLaData(data)]: xifrar(paraules, data) } };
}

// ------------------------------------------------------------ Sense manuals

test('cada dia i carril diu el mateix que la fórmula, amb la bossa, la clau i les rimes de cada dialecte', () => {
    const { dies, avisos } = preveure({ eres: ERES, index: INDEX, desDe: INICI, dies: 120 });
    assert.equal(dies.length, 120);
    assert.deepEqual(avisos, []);

    dies.forEach((dia, d) => {
        assert.equal(dia.data, afegirDies(INICI, d));
        const parella = parellaDelDia(ERES, dia.data);
        for (const carril of CARRILS) {
            const esperat = parella[carril];
            const c = dia[carril];
            assert.equal(c.paraula, esperat.objectiu.mostrar);
            assert.equal(c.normalitzada, esperat.objectiu.normalitzada);
            assert.equal(c.bossa, esperat.bossa);
            assert.equal(c.clau, esperat.clau);
            assert.equal(c.variant, esperat.variant);
            assert.equal(c.manual, false);
            assert.equal(c.era, 1);

            const bossa = ERA.carrils[carril].bosses[esperat.bossa];
            assert.deepEqual(c.tall, { de: bossa.de, fins: bossa.fins, quota: bossa.quota });
            assert.equal(c.variants, bossa.claus.find((k) => k.c === esperat.clau).v.length);

            const i = esperat.indexParaula;
            CODIS.forEach((codi, k) => {
                const lloc = c.dialectes[codi];
                assert.ok(lloc.ok);
                assert.equal(lloc.clau, `k${i}`);
                assert.equal(lloc.rimes, 100 + i + k);
                assert.equal(lloc.rimesDelGrup, 1000 + (i % GRUPS) * 10 + k);
            });
        }
    });
});

test('un dia que cap era no cobreix hi surt amb l\'error, i la resta de la previsió continua', () => {
    const { dies } = preveure({ eres: ERES, index: INDEX, desDe: afegirDies(INICI, -2), dies: 4 });
    assert.match(dies[0].error, /Cap era no cobreix/);
    assert.match(dies[1].error, /Cap era no cobreix/);
    assert.ok(dies[2].dificil && dies[3].facil);
});

test('si l\'index no resol l\'era, ho avisa i la paraula surt igualment', () => {
    const { dies, avisos } = preveure({
        eres: ERES, index: { dialectes: INDEX.dialectes, eres: {} }, desDe: INICI, dies: 1,
    });
    assert.ok(dies[0].dificil.paraula);
    assert.ok(!dies[0].dificil.dialectes.ca.ok);
    assert.equal(avisos.length, 4);            // dos carrils × dos dialectes
    assert.match(avisos[0], /generar_dades\.py/);
});

// -------------------------------------------------------------- Amb manuals

test('una manual publicada mana només el seu dia, i diu quina paraula hauria donat la fórmula', () => {
    const dia = afegirDies(INICI, 10);
    const sense = preveure({ eres: ERES, index: INDEX, desDe: INICI, dies: 30 });
    const amb = preveure({
        eres: ERES, index: INDEX, especials: especialsDe(dia, { facil: 'pessebre' }),
        desDe: INICI, dies: 30, trobadesDe: trobadesAmbPessebre,
    });

    amb.dies.forEach((d, i) => {
        if (i !== 10) {
            assert.deepEqual(d, sense.dies[i], `el dia ${d.data} no havia de canviar`);
            return;
        }
        assert.deepEqual(d.dificil, sense.dies[i].dificil);
        const manual = d.facil;
        assert.equal(manual.manual, true);
        assert.equal(manual.publicada, true);
        assert.equal(manual.normalitzada, 'pessebre');
        assert.equal(manual.paraula, 'pessebré');                 // la forma del fitxer del central
        assert.deepEqual(manual.formula, {
            normalitzada: sense.dies[i].facil.normalitzada, paraula: sense.dies[i].facil.paraula,
        });
        // La bossa i la clau són les del dia, com si no hi hagués manual: el dia compta.
        assert.equal(manual.bossa, sense.dies[i].facil.bossa);
        assert.equal(manual.clau, sense.dies[i].facil.clau);
        assert.equal(manual.dialectes.ca.rimes, 105);
        assert.equal(manual.dialectes.nw.rimesDelGrup, 1051);
    });
    assert.deepEqual(amb.avisos, []);
});

test('una manual en clar que encara no és a especials.json surt, i avisa que no és publicada', () => {
    const dia = afegirDies(INICI, 3);
    const locals = llegirManuals({ [dia]: { dificil: 'pessebre' } });
    const { dies, avisos } = preveure({
        eres: ERES, index: INDEX, locals, desDe: INICI, dies: 5, trobadesDe: trobadesAmbPessebre,
    });
    assert.equal(dies[3].dificil.manual, true);
    assert.equal(dies[3].dificil.publicada, false);
    assert.equal(dies[3].facil.manual, false);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /no és a especials\.json/);
});

test('les locals manen sobre les publicades, i una publicada no queda com a no publicada', () => {
    const dia = afegirDies(INICI, 2);
    const especials = especialsDe(dia, { dificil: 'pessebre' });
    const igual = preveure({
        eres: ERES, index: INDEX, especials, locals: llegirManuals({ [dia]: { dificil: 'pessebre' } }),
        desDe: INICI, dies: 4, trobadesDe: trobadesAmbPessebre,
    });
    assert.equal(igual.dies[2].dificil.publicada, true);
    assert.deepEqual(igual.avisos, []);
});

test('una manual que no val a un dialecte avisa que allà hi sortirà la fórmula', () => {
    const dia = afegirDies(INICI, 1);
    NO_VAL_A_NW.value = true;
    try {
        const { dies, avisos } = preveure({
            eres: ERES, index: INDEX, especials: especialsDe(dia, { dificil: 'pessebre' }),
            desDe: INICI, dies: 3, trobadesDe: trobadesAmbPessebre,
        });
        assert.equal(dies[1].dificil.dialectes.ca.ok, true);
        assert.equal(dies[1].dificil.dialectes.nw.ok, false);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /no val a nw/);
        assert.ok(avisos[0].includes(`«${dies[1].dificil.formula.paraula}»`));
    } finally {
        NO_VAL_A_NW.value = false;
    }
});

// ------------------------------------------------------------------ La sortida

test('la taula té una fila per dia i carril, amb la capçalera i els avisos al final', () => {
    const previsio = preveure({ eres: ERES, index: INDEX, desDe: INICI, dies: 3 });
    previsio.avisos.push('un avís de prova');
    const linies = textDeLaPrevisio(previsio, CODIS).split('\n');
    assert.match(linies[0], /^DATA\s+CARRIL\s+BOSSA\s+CLAU\s+VAR\.\s+PARAULA\s+RIMES \(ca\/nw\)\s+NOTES$/);
    assert.equal(linies.slice(1, 7).filter((l) => /^2026-12-0[123]/.test(l)).length, 6);
    assert.deepEqual(linies.slice(-3), ['', 'AVISOS', '  un avís de prova']);
    assert.ok(linies[1].includes('difícil') && linies[2].includes('fàcil'));
    // La bossa diu el número, el tall i la quota en %.
    assert.match(linies[1], /\s\d \(\d+-\d+, \d+(,\d)? %\)\s/);
});

test('una era sense talls (les de joguina) es mostra igualment, amb la quota sola', () => {
    const sense = { ...ERA, carrils: Object.fromEntries(CARRILS.map((carril) => [carril, {
        ...ERA.carrils[carril], bosses: ERA.carrils[carril].bosses.map(({ de, fins, ...resta }) => resta),
    }])) };
    const previsio = preveure({ eres: [sense], index: INDEX, desDe: INICI, dies: 2 });
    assert.deepEqual(previsio.dies[0].dificil.tall.de, null);
    assert.match(textDeLaPrevisio(previsio, CODIS).split('\n')[1], /\s\d \(\d+(,\d)? %\)\s/);
    assert.deepEqual(JSON.parse(JSON.stringify(previsio.dies)), previsio.dies);
});

test('la taula amb detall diu la clau de cada dialecte, i el difícil i el fàcil la diuen diferent', () => {
    const previsio = preveure({ eres: ERES, index: INDEX, desDe: INICI, dies: 1 });
    const text = textDeLaPrevisio(previsio, CODIS, { detall: true });
    const i = previsio.dies[0].dificil.dialectes.ca.clau;
    assert.ok(text.includes(`ca -${i} · nw -${i}`));
    assert.match(text, /ca g\d \(-k\d+\) · nw g\d \(-k\d+\)/);
});

test('la pàgina local escapa el text i ressalta les manuals', () => {
    const dia = afegirDies(INICI, 0);
    const previsio = preveure({
        eres: ERES, index: INDEX, especials: especialsDe(dia, { facil: 'pessebre' }), desDe: INICI, dies: 2,
        trobadesDe: () => new Map([['pessebre', [{ clau: 'k5', marca: '*', mostrar: '<b>&"pessebre' }]]]),
    });
    previsio.avisos.push('<script>alert(1)</script>');
    const pagina = paginaDeLaPrevisio(previsio, CODIS, { desDe: INICI, generat: 'ara' });
    assert.match(pagina, /^<!doctype html>/);
    assert.ok(pagina.includes('&lt;b&gt;&amp;&quot;pessebre'));
    assert.ok(!pagina.includes('<script>alert'));
    assert.ok(pagina.includes('class="facil manual"'));
    assert.equal((pagina.match(/<tr class=/g) || []).length, 4);
});

test('el JSON porta els dies i els avisos tal com són', () => {
    const previsio = preveure({ eres: ERES, index: INDEX, desDe: INICI, dies: 2 });
    const json = JSON.parse(JSON.stringify(jsonDeLaPrevisio(previsio, INICI)));
    assert.equal(json.v, 1);
    assert.equal(json.des_de, INICI);
    assert.deepEqual(json.dies, previsio.dies);
});

// ------------------------------------------------------- Amb les dades de debò

const llegir = (nom) => JSON.parse(fs.readFileSync(`${DADES}${nom}`, 'utf8'));

test('amb les dades de debò, els propers 400 dies surten i es resolen als quatre dialectes', () => {
    const eres = llegir('eres.json').eres;
    const index = llegir('index.json');
    const especials = llegir('especials.json');
    const codis = Object.keys(index.dialectes);
    assert.deepEqual(codis.length, 4);

    const memoria = new Map();
    const trobadesDe = (codi) => {
        if (!memoria.has(codi)) memoria.set(codi, llegirDialecte(fs.readFileSync(`${DADES}${codi}.txt`, 'utf8')));
        return memoria.get(codi);
    };
    // Des d'un dia concret, i no d'avui: la prova ha de donar el mateix demà. Els 400 dies
    // inclouen dues manuals (23-4-2027 i 11-9-2027).
    const { dies, avisos } = preveure({ eres, index, especials, desDe: '2026-11-01', dies: 400, trobadesDe });

    assert.equal(dies.length, 400);
    let manuals = 0;
    for (const dia of dies) {
        assert.ok(!dia.error, `${dia.data}: ${dia.error}`);
        for (const carril of CARRILS) {
            const c = dia[carril];
            assert.ok(c.paraula, `${dia.data} ${carril}: sense paraula`);
            for (const codi of codis) assert.ok(c.dialectes[codi].ok, `${dia.data} ${carril} ${codi}: ${c.dialectes[codi].motiu}`);
            // És la mateixa paraula a tots els dialectes.
            assert.equal(new Set(codis.map((codi) => c.dialectes[codi].mostrar)).size, 1, `${dia.data} ${carril}`);
            if (c.manual) manuals += 1;
        }
    }
    assert.equal(manuals, 4);
    assert.deepEqual(avisos, []);

    // I és el que dona la fórmula del joc, dia a dia.
    for (const dia of dies) {
        const parella = parellaDelDia(eres, dia.data, {});
        for (const carril of CARRILS) {
            if (!dia[carril].manual) assert.equal(dia[carril].paraula, parella[carril].objectiu.mostrar);
        }
    }
});

// ---------------------------------------------------------- La línia d'ordres

function executar(...arguments_) {
    return spawnSync('node', [PREVISIO, ...arguments_], { encoding: 'utf8' });
}

test('--json treu els dies que demana, igual que la previsió feta des de dins', () => {
    const resultat = executar('--json', '--des-de', '2026-11-02', '--dies', '3');
    assert.equal(resultat.status, 0, resultat.stderr);
    const json = JSON.parse(resultat.stdout);
    assert.equal(json.dies.length, 3);
    assert.equal(json.des_de, '2026-11-02');
    const eres = llegir('eres.json').eres;
    json.dies.forEach((dia) => {
        const parella = parellaDelDia(eres, dia.data);
        assert.equal(dia.dificil.paraula, parella.dificil.objectiu.mostrar);
        assert.equal(dia.facil.paraula, parella.facil.objectiu.mostrar);
    });
});

test('--html escriu la pàgina on es diu, i --manuals hi suma les manuals en clar', () => {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'previsio-'));
    try {
        const manuals = path.join(carpeta, 'manuals.json');
        fs.writeFileSync(manuals, JSON.stringify({ '2026-11-03': { dificil: 'rosa' } }));
        const pagina = path.join(carpeta, 'previsio.html');
        const resultat = executar('--des-de', '2026-11-02', '--dies', '3', '--manuals', manuals, '--html', pagina);
        assert.equal(resultat.status, 0, resultat.stderr);

        const text = fs.readFileSync(pagina, 'utf8');
        assert.match(text, /<title>Previsió de la paraula del dia<\/title>/);
        assert.ok(text.includes('class="dificil manual"'), 'la manual en clar ha de sortir ressaltada');
        assert.ok(text.includes('no és a especials.json'), 'i com a no publicada');
        assert.equal((text.match(/<tr class=/g) || []).length, 6);
    } finally {
        fs.rmSync(carpeta, { recursive: true, force: true });
    }
});

test('la línia d\'ordres rebutja el que no entén', () => {
    for (const malament of [['--dies', '0'], ['--dies', 'molts'], ['--des-de', '1-11-2026'], ['--cap-opcio'], ['--dies']]) {
        const resultat = executar(...malament);
        assert.equal(resultat.status, 2, malament.join(' '));
        assert.equal(resultat.stdout, '');
        assert.ok(resultat.stderr.length > 0);
    }
});
