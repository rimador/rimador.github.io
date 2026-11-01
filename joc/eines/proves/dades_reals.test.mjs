// Proves de les dades publicades de debò (joc/dades/): que siguin coherents entre
// elles. Són les que fallen el dia que algú toca l'eres.json a mà, o canvia el
// diccionari, i es deixa de passar generar_dades.py.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { llegirDialecte } from '../manuals.mjs';
import { CARRILS } from '../../js/eres.js';

const DADES = fileURLToPath(new URL('../../dades/', import.meta.url));
const llegir = (nom) => fs.readFileSync(DADES + nom);
const json = (nom) => JSON.parse(llegir(nom).toString('utf8'));

const versions = json('versions.json');
const index = json('index.json');
const eres = json('eres.json').eres;
const CODIS = versions.dialectes.map((d) => d.codi);

test('el versions.json porta el resum de cada fitxer tal com és ara', () => {
    for (const [nom, resum] of Object.entries(versions.fitxers)) {
        const calculat = crypto.createHash('sha256').update(llegir(nom)).digest('hex').slice(0, 12);
        assert.equal(resum, calculat, `${nom} ha canviat i no s'ha tornat a passar generar_dades.py`);
    }
    assert.ok('eres.json' in versions.fitxers, 'eres.json ha de passar pel versions.json');
    assert.ok(!('especials.json' in versions.fitxers), 'especials.json es demana amb ?t=, no per versions');
});

test('les eres: ids creixents, algorismes coneguts i una època que no canvia', () => {
    assert.deepEqual(eres.map((e) => e.id), eres.map((_, i) => eres[0].id + i));
    for (let i = 1; i < eres.length; i++) assert.ok(eres[i].inici > eres[i - 1].inici);
    assert.ok(eres.every((e) => [0, 1].includes(e.algorisme)));
    // L'era 0, la roda, comença a l'època de sempre: canviar-la mouria tots els dies.
    const zero = eres.find((e) => e.id === 0);
    if (zero) assert.equal(zero.inici, '2026-01-01');
});

test('cada era d\'algorisme 1 té quotes que sumen 1.000 i claus úniques amb paraules vàlides', () => {
    for (const era of eres.filter((e) => e.algorisme === 1)) {
        for (const carril of CARRILS) {
            const dades = era.carrils[carril];
            assert.equal(dades.bosses.reduce((s, b) => s + b.quota, 0), 1000, `era ${era.id} ${carril}`);
            const claus = dades.bosses.flatMap((b) => b.claus.map((c) => c.c));
            assert.equal(new Set(claus).size, claus.length, `claus repetides a l'era ${era.id} ${carril}`);
            for (const bossa of dades.bosses) {
                if (bossa.quota > 0) assert.ok(bossa.claus.length > 0, `bossa amb quota i cap clau (era ${era.id})`);
                assert.deepEqual(bossa.claus.map((c) => c.c), bossa.claus.map((c) => c.c).sort(), 'ordre canònic');
                for (const clau of bossa.claus) {
                    assert.ok(clau.v.length > 0 && clau.v.every((v) => v.length > 0));
                    assert.equal(clau.p.length, clau.v.length);
                    for (const variant of clau.v) {
                        assert.ok(variant.every((i) => Number.isInteger(i) && i >= 0 && i < era.paraules.length));
                    }
                }
            }
        }
    }
});

test('cada paraula de cada era es resol, a cada dialecte, a la clau on és de debò', () => {
    for (const codi of CODIS) {
        const trobades = llegirDialecte(llegir(`${codi}.txt`).toString('utf8'));
        const claus = index.dialectes[codi].claus;

        for (const era of eres) {
            const resolucio = index.eres[String(era.id)][codi];
            assert.equal(resolucio.length, era.paraules.length, `l'index no resol l'era ${era.id} en ${codi}`);

            const usades = era.algorisme === 0
                ? era.roda.claus.flat()
                : CARRILS.flatMap((c) => era.carrils[c].bosses.flatMap((b) => b.claus.flatMap((k) => k.v.flat())));
            for (const i of new Set(usades)) {
                const paraula = era.paraules[i].split('>')[0];
                const llocs = trobades.get(paraula);
                assert.ok(llocs, `«${paraula}» (era ${era.id}) no és paraula a rimar en ${codi}`);
                assert.equal(new Set(llocs.map((l) => l.clau)).size, 1, `«${paraula}» cau a més d'una clau en ${codi}`);
                assert.ok(resolucio[i] >= 0, `«${paraula}» (era ${era.id}) sense resolució en ${codi}`);
                assert.equal(claus[resolucio[i]][0], llocs[0].clau, `«${paraula}» (era ${era.id}) apunta a una altra clau en ${codi}`);
            }
        }
    }
});

test('els homògrafs i els natius de l\'index són coherents amb el fitxer de cada dialecte', () => {
    for (const codi of CODIS) {
        const tros = index.dialectes[codi];
        const trobades = llegirDialecte(llegir(`${codi}.txt`).toString('utf8'));
        const homografs = new Set(tros.homografs);

        // Tots els homògrafs són al fitxer. (No sempre s'hi veu que cauen a dues claus: l'altra
        // pot ser en un grup assonant que el fitxer no porta, perquè no hi té cap clau publicada.)
        for (const paraula of homografs) assert.ok(trobades.has(paraula), `«${paraula}» no és al fitxer de ${codi}`);
        // I tota paraula que el fitxer porta a dues seccions, alguna de les quals és una clau
        // publicada (l'única que es pot triar), és a la llista.
        const publicades = new Set(tros.claus.map((c) => c[0]));
        for (const [paraula, llocs] of trobades) {
            const claus = new Set(llocs.map((l) => l.clau));
            if (claus.size > 1 && [...claus].some((c) => publicades.has(c))) {
                assert.ok(homografs.has(paraula), `«${paraula}» cau a dues claus en ${codi} i no és a la llista`);
            }
        }

        // El tercer camp de cada clau són les paraules objectiu; el sisè (o el tercer, si no hi és)
        // les que queden sense els homògrafs: les natives.
        const perClau = new Map();
        for (const [paraula, llocs] of trobades) {
            for (const clau of new Set(llocs.map((l) => l.clau))) {
                if (!perClau.has(clau)) perClau.set(clau, { objectius: 0, natius: 0 });
                perClau.get(clau).objectius += 1;
                if (!homografs.has(paraula)) perClau.get(clau).natius += 1;
            }
        }
        for (const entrada of tros.claus) {
            const esperat = perClau.get(entrada[0]);
            assert.equal(entrada[2], esperat.objectius, `objectius de -${entrada[0]} en ${codi}`);
            assert.equal(entrada.length > 5 ? entrada[5] : entrada[2], esperat.natius, `natius de -${entrada[0]} en ${codi}`);
            if (entrada.length > 5) assert.notEqual(entrada[5], entrada[2], 'el sisè camp només hi és si difereix');
        }
    }
});

test('l\'especials.json té el format esperat i cap data ni paraula en clar', () => {
    const text = llegir('especials.json').toString('utf8');
    const especials = JSON.parse(text);
    assert.equal(especials.v, 1);
    for (const [clau, valor] of Object.entries(especials.dies)) {
        assert.match(clau, /^[0-9a-f]{16}$/);
        assert.match(valor, /^[A-Za-z0-9+/]+=*$/);
    }
    assert.ok(!/20\d\d-\d\d-\d\d/.test(text), 'hi ha una data en clar');
});
