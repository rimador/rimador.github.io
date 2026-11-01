// Proves de l'script de les manuals (joc/eines/manuals.mjs): la validació als quatre
// dialectes, els avisos de coincidència i el fitxer xifrat.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    llegirManuals, llegirDialecte, resoldreAlDialecte, validar, coincidencies,
    construirEspecials, textDelFitxer,
} from '../manuals.mjs';
import { manualsDelDia } from '../../js/especials.js';
import { parellaDelDia } from '../../js/eres.js';
import { afegirDies, eraPerDefecte } from './ajuda_eres.mjs';

const SCRIPT = fileURLToPath(new URL('../manuals.mjs', import.meta.url));

// ----------------------------------------------------------------- L'entrada

test('una cadena val per a les dues dificultats i un objecte, per a les que digui', () => {
    const entrades = llegirManuals({
        _ajuda: 'això s\'ignora',
        '2026-12-25': { facil: 'pessebre', dificil: 'torró' },
        '2027-01-06': 'reis',
        '2027-02-01': { dificil: 'lluna' },
    });
    assert.deepEqual(entrades.map((e) => `${e.data} ${e.carril} ${e.paraula}`), [
        '2026-12-25 facil pessebre', '2026-12-25 dificil torró',
        '2027-01-06 facil reis', '2027-01-06 dificil reis',
        '2027-02-01 dificil lluna',
    ]);
});

test('una entrada mal feta es refusa amb el motiu', () => {
    for (const [dolent, motiu] of [
        [[], /objecte/],
        [null, /objecte/],
        [{ '2026-13-45': 'x' }, /no és una data/],
        [{ '25-12-2026': 'x' }, /no és una data/],
        [{ '2026-12-25': 12 }, /paraula o un objecte/],
        [{ '2026-12-25': { facil: 3 } }, /ha de ser una paraula/],
        [{ '2026-12-25': { dificlil: 'x' } }, /dificlil/],
        [{ '2026-12-25': '  ' }, /buida/],
    ]) {
        assert.throws(() => llegirManuals(dolent), motiu);
    }
});

// ----------------------------------------------------------- Els dialectes

const TEXT_DEL_DIALECTE = [
    '#K1', '*rosa', '+lectura', 'cantava', '*cami>camí',
    '#K2', '*dona', '#K3', '*dona',
    '#K4', '*rara',
].join('\n');

const TROS = {
    grups: [[0, 10, 2, 500], [11, 10, 2, 40]],
    claus: [['K1', 0, 3, 100, 2], ['K2', 1, 1, 20, 1], ['K3', 1, 1, 20, 1]],      // K4 no és publicada
};

test('una paraula marcada amb * o + a una sola clau publicada es resol', () => {
    const trobades = llegirDialecte(TEXT_DEL_DIALECTE);
    assert.deepEqual(resoldreAlDialecte('rosa', trobades, TROS),
        { ok: true, clau: 'K1', grup: 0, rimes: 100, rimesDelGrup: 500, mostrar: 'rosa', marca: '*' });
    assert.equal(resoldreAlDialecte('lectura', trobades, TROS).marca, '+');
    const camí = resoldreAlDialecte('cami', trobades, TROS);
    assert.equal(camí.ok && camí.mostrar, 'camí');
});

test('els motius pels quals una paraula no es pot fer servir', () => {
    const trobades = llegirDialecte(TEXT_DEL_DIALECTE);
    const motiu = (paraula) => resoldreAlDialecte(paraula, trobades, TROS).motiu;
    assert.match(motiu('cantava'), /no hi és com a paraula a rimar/);       // un verb: sense marca
    assert.match(motiu('inexistent'), /no hi és com a paraula a rimar/);
    assert.match(motiu('dona'), /cau a 2 claus \(-K2, -K3\)/);              // un homògraf
    assert.match(motiu('rara'), /no és publicada/);                         // la clau no és a l'index
});

// -------------------------------------------------------------- La validació

function dialectes(...llistes) {
    return new Map(llistes.map(([codi, text, tros]) => [codi, { trobades: llegirDialecte(text), tros }]));
}

test('una manual ha de valer a tots els dialectes, i els errors diuen on falla', () => {
    const sense = TEXT_DEL_DIALECTE.replace('*rosa', 'rosa');
    const { errors, resolucions } = validar(
        llegirManuals({ '2026-12-25': { facil: 'rosa', dificil: 'lectura' } }),
        dialectes(['ca', TEXT_DEL_DIALECTE, TROS], ['va', sense, TROS]));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /2026-12-25 fàcil: «rosa» va: no hi és com a paraula a rimar/);
    assert.ok(resolucions.has('2026-12-25|dificil'));
    assert.ok(!resolucions.has('2026-12-25|facil'));      // no val enlloc: no es compara amb res
});

test('la paraula es normalitza abans de buscar-la', () => {
    const { errors } = validar(llegirManuals({ '2026-12-25': { facil: ' Camí ' } }),
        dialectes(['ca', TEXT_DEL_DIALECTE, TROS]));
    assert.deepEqual(errors, []);
});

// ----------------------------------------------- Els avisos de coincidència

test('s\'avisa si la manual repeteix una paraula o una clau de la fórmula a menys de 30 dies', () => {
    const era = eraPerDefecte({ id: 1, inici: '2026-12-01' });
    const eres = [era];
    // Una paraula i una clau reals de la fórmula, deu dies després del 2027-02-01.
    const dia = afegirDies('2027-02-01', 10);
    const auto = parellaDelDia(eres, dia).dificil;

    // L'index de joguina: el central resol cada posició de l'era a la seva clau.
    const claus = [];
    const posicioDeClau = new Map();
    const resolucio = era.paraules.map(() => -1);
    for (const carril of Object.values(era.carrils)) {
        for (const bossa of carril.bosses) {
            for (const clau of bossa.claus) {
                if (!posicioDeClau.has(clau.c)) {
                    posicioDeClau.set(clau.c, claus.length);
                    claus.push([clau.c, posicioDeClau.size, 1, 1, 1]);
                }
                for (const variant of clau.v) for (const idx of variant) resolucio[idx] = posicioDeClau.get(clau.c);
            }
        }
    }
    const index = { dialectes: { ca: { claus } }, eres: { 1: { ca: resolucio } } };

    const manual = (paraula, clau) => ({
        entrades: [{ data: '2027-02-01', carril: 'dificil', paraula }],
        resolucions: new Map([['2027-02-01|dificil', { paraula, central: { clau, grup: 0 } }]]),
        eres, index, avui: '2027-01-01',
    });

    // La mateixa paraula (a la mateixa dificultat o a una altra) que surt de la fórmula.
    const igual = coincidencies(manual(auto.objectiu.normalitzada, 'cap-altra'));
    assert.ok(igual.some((avis) => avis.includes(`la mateixa paraula el ${dia}`)), igual.join('\n'));

    // La mateixa clau, amb una altra paraula.
    const mateixaClau = coincidencies(manual('una-altra-paraula', auto.clau));
    assert.ok(mateixaClau.some((avis) => avis.includes(`la mateixa clau (-${auto.clau}) el ${dia}`)), mateixaClau.join('\n'));

    // Ni paraula ni clau a menys de 30 dies: res a dir.
    assert.deepEqual(coincidencies(manual('una-altra-paraula', 'cap-clau')), []);
    // Un dia passat ja ha sortit, i no es mira.
    assert.deepEqual(coincidencies({ ...manual(auto.objectiu.normalitzada, auto.clau), avui: '2027-03-01' }), []);
    // I a 30 dies o més, tampoc.
    const lluny = afegirDies('2027-02-01', 40);
    const autoLluny = parellaDelDia(eres, lluny).dificil;
    assert.deepEqual(coincidencies({
        ...manual(autoLluny.objectiu.normalitzada, 'cap-clau'),
        entrades: [{ data: '2027-02-01', carril: 'dificil', paraula: autoLluny.objectiu.normalitzada }],
        dies: 30,
    }).filter((avis) => avis.includes(lluny)), []);
});

test('dues manuals que es repeteixen entre elles també s\'avisen', () => {
    const era = eraPerDefecte({ id: 1, inici: '2026-12-01' });
    const entrades = [
        { data: '2027-02-01', carril: 'facil', paraula: 'rosa' },
        { data: '2027-02-11', carril: 'dificil', paraula: 'rosa' },
    ];
    const resolucions = new Map(entrades.map((e) => [`${e.data}|${e.carril}`, { paraula: 'rosa', central: { clau: 'K', grup: 1 } }]));
    const avisos = coincidencies({ entrades, resolucions, eres: [era], index: {}, avui: '2027-01-01' });
    assert.ok(avisos.some((avis) => avis.includes('2027-02-01 fàcil «rosa»: la mateixa paraula el 2027-02-11 (difícil, «rosa», manual)')));
});

// ----------------------------------------------------------- El fitxer xifrat

test('l\'especials.json no té cap paraula ni cap data en clar i el joc el desxifra', () => {
    const entrades = llegirManuals({
        '2026-09-11': { facil: 'dialecte', dificil: 'rimes' },
        '2027-04-23': { facil: 'rosa', dificil: 'lectura' },
        '2027-09-11': 'aniversari',
    });
    const especials = construirEspecials(entrades);
    const text = textDelFitxer(especials);
    for (const secret of ['dialecte', 'rimes', 'rosa', 'lectura', 'aniversari', '2026', '2027', '09-11', '04-23']) {
        assert.ok(!text.includes(secret), `«${secret}» surt a l'especials.json`);
    }
    assert.equal(Object.keys(especials.dies).length, 3);

    const llegit = JSON.parse(text);
    assert.equal(llegit.v, 1);
    assert.deepEqual(manualsDelDia(llegit, '2027-04-23'), { facil: 'rosa', dificil: 'lectura' });
    assert.deepEqual(manualsDelDia(llegit, '2027-09-11'), { facil: 'aniversari', dificil: 'aniversari' });
    assert.deepEqual(manualsDelDia(llegit, '2027-04-24'), {});
});

test('les entrades no van per ordre de data (l\'ordre tampoc no ha de dir res)', () => {
    const dates = Array.from({ length: 40 }, (_, i) => afegirDies('2027-01-01', i));
    const especials = construirEspecials(llegirManuals(Object.fromEntries(dates.map((d) => [d, 'rosa']))));
    const claus = JSON.parse(textDelFitxer(especials)).dies;
    const iguals = Object.keys(claus).join() === Object.keys(claus).sort().join();
    assert.ok(iguals);       // per resum: ordenades pel resum
    const ordreDeDates = Object.keys(claus).map((clau) => dates.find((d) => manualsDelDia({ dies: { [clau]: claus[clau] } }, d).facil === 'rosa'));
    assert.notDeepEqual(ordreDeDates, [...ordreDeDates].sort());
});

// -------------------------------------------------------- L'ordre, de punta a punta

function carpetaDeProva() {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'manuals-'));
    const index = { dialectes: {}, eres: {} };
    for (const codi of ['ca', 'nw', 'va', 'ba']) {
        fs.writeFileSync(path.join(carpeta, `${codi}.txt`), TEXT_DEL_DIALECTE);
        index.dialectes[codi] = TROS;
    }
    fs.writeFileSync(path.join(carpeta, 'index.json'), JSON.stringify(index));
    fs.writeFileSync(path.join(carpeta, 'versions.json'), JSON.stringify({
        dialectes: ['ca', 'nw', 'va', 'ba'].map((codi) => ({ codi, nom: codi })), fitxers: {},
    }));
    fs.writeFileSync(path.join(carpeta, 'eres.json'), JSON.stringify({ v: 1, eres: [eraPerDefecte({ id: 1, inici: '2026-12-01' })] }));
    return carpeta;
}

function executar(carpeta, manuals, ...mes) {
    const entrada = path.join(carpeta, 'manuals.json');
    fs.writeFileSync(entrada, JSON.stringify(manuals));
    return spawnSync('node', [SCRIPT, '--entrada', entrada, '--dades', carpeta, '--avui', '2027-01-01', ...mes],
        { encoding: 'utf8' });
}

test('l\'ordre valida, escriu especials.json i el joc el pot llegir', () => {
    const carpeta = carpetaDeProva();
    const resultat = executar(carpeta, { _ajuda: 'x', '2027-04-23': { facil: 'rosa', dificil: 'lectura' } });
    assert.equal(resultat.status, 0, resultat.stderr + resultat.stdout);
    assert.match(resultat.stdout, /Tot correcte: 2 paraules en 1 dies, bones als 4 dialectes/);
    const especials = JSON.parse(fs.readFileSync(path.join(carpeta, 'especials.json'), 'utf8'));
    assert.deepEqual(manualsDelDia(especials, '2027-04-23'), { facil: 'rosa', dificil: 'lectura' });
    fs.rmSync(carpeta, { recursive: true });
});

test('si una paraula no val a algun dialecte, l\'ordre falla i no escriu res', () => {
    const carpeta = carpetaDeProva();
    const resultat = executar(carpeta, { '2027-04-23': { facil: 'rosa', dificil: 'cantava' } });
    assert.equal(resultat.status, 1);
    assert.match(resultat.stderr, /«cantava» ca: no hi és com a paraula a rimar/);
    assert.match(resultat.stderr, /No s'ha escrit res/);
    assert.ok(!fs.existsSync(path.join(carpeta, 'especials.json')));
    fs.rmSync(carpeta, { recursive: true });
});

test('--simula valida però no escriu', () => {
    const carpeta = carpetaDeProva();
    const resultat = executar(carpeta, { '2027-04-23': 'rosa' }, '--simula');
    assert.equal(resultat.status, 0);
    assert.match(resultat.stdout, /--simula/);
    assert.ok(!fs.existsSync(path.join(carpeta, 'especials.json')));
    fs.rmSync(carpeta, { recursive: true });
});
