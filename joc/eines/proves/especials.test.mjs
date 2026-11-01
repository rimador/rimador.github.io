// Proves de les paraules manuals xifrades (joc/js/especials.js).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MIDA, resumDeLaData, xifrar, desxifrar, manualsDelDia,
} from '../../js/especials.js';
import { afegirDies } from './ajuda_eres.mjs';

test('el resum d\'una data són 16 xifres hexadecimals i sempre el mateix', () => {
    assert.match(resumDeLaData('2026-12-25'), /^[0-9a-f]{16}$/);
    assert.equal(resumDeLaData('2026-12-25'), resumDeLaData('2026-12-25'));
    assert.notEqual(resumDeLaData('2026-12-25'), resumDeLaData('2026-12-26'));
});

test('en deu anys de dates no hi ha cap resum repetit', () => {
    const vistos = new Set();
    for (let dies = 0; dies < 3700; dies++) vistos.add(resumDeLaData(afegirDies('2026-01-01', dies)));
    assert.equal(vistos.size, 3700);
});

test('xifrar i desxifrar tornen les paraules, amb accents inclosos', () => {
    const casos = [
        { facil: 'rosa', dificil: 'lectura' },
        { facil: 'genocidi', dificil: '' },
        { facil: '', dificil: 'colonialisme' },
        { facil: 'caçador', dificil: 'paüra·l' },
        { facil: 'a', dificil: 'b' },
    ];
    for (const paraules of casos) {
        const xifrat = xifrar(paraules, '2027-04-23');
        assert.deepEqual(desxifrar(xifrat, '2027-04-23'),
            { facil: paraules.facil || '', dificil: paraules.dificil || '' });
    }
    // Un dia sense cap paraula de cap dificultat també és vàlid.
    assert.deepEqual(desxifrar(xifrar({}, '2027-04-23'), '2027-04-23'), { facil: '', dificil: '' });
});

test('totes les entrades fan la mateixa mida, tinguin les paraules que tinguin', () => {
    const mides = new Set([
        xifrar({ facil: 'a', dificil: 'b' }, '2027-01-01').length,
        xifrar({ facil: 'anticonstitucionalment', dificil: 'otorrinolaringòleg' }, '2027-01-02').length,
        xifrar({}, '2027-01-03').length,
    ]);
    assert.equal(mides.size, 1);
    // 96 bytes en base64: 4 · ceil(96 / 3).
    assert.equal([...mides][0], 4 * Math.ceil(MIDA / 3));
});

test('no hi ha cap paraula en clar, ni en base64, dins de l\'entrada', () => {
    const paraules = { facil: 'rosa', dificil: 'lectura' };
    const xifrat = xifrar(paraules, '2027-04-23');
    const desfet = Buffer.from(xifrat, 'base64').toString('latin1');
    for (const paraula of ['rosa', 'lectura']) {
        assert.ok(!xifrat.includes(paraula));
        assert.ok(!desfet.includes(paraula));
        assert.ok(!xifrat.includes(Buffer.from(paraula).toString('base64')));
    }
});

test('el mateix text xifrat en dos dies diferents no s\'assembla', () => {
    const a = xifrar({ facil: 'rosa', dificil: 'lectura' }, '2027-04-23');
    const b = xifrar({ facil: 'rosa', dificil: 'lectura' }, '2027-04-24');
    assert.notEqual(a, b);
});

test('una entrada només es desxifra amb la seva data', () => {
    const xifrat = xifrar({ facil: 'rosa', dificil: 'lectura' }, '2027-04-23');
    let desxifrades = 0;
    for (let dies = -50; dies <= 50; dies++) {
        if (dies !== 0 && desxifrar(xifrat, afegirDies('2027-04-23', dies))) desxifrades += 1;
    }
    assert.equal(desxifrades, 0);
    assert.ok(desxifrar(xifrat, '2027-04-23'));
});

test('un text malmès o que no és d\'aquest format es rebutja sense petar', () => {
    for (const dolent of ['', 'no és base64!', 'AAAA', btoa('curt'), btoa('x'.repeat(MIDA)), 12345, null, undefined]) {
        assert.equal(desxifrar(dolent, '2027-04-23'), null);
    }
});

test('unes paraules que no hi caben fan petar el xifrat, no el joc', () => {
    assert.throws(() => xifrar({ facil: 'a'.repeat(100), dificil: '' }, '2027-04-23'), /no caben/);
});

test('manualsDelDia busca el dia d\'avui al fitxer sencer i tolera que no n\'hi hagi', () => {
    const especials = {
        v: 1,
        dies: {
            [resumDeLaData('2026-12-25')]: xifrar({ facil: 'pessebre', dificil: 'torro' }, '2026-12-25'),
            [resumDeLaData('2027-01-06')]: xifrar({ facil: 'reis', dificil: '' }, '2027-01-06'),
        },
    };
    assert.deepEqual(manualsDelDia(especials, '2026-12-25'), { facil: 'pessebre', dificil: 'torro' });
    assert.deepEqual(manualsDelDia(especials, '2027-01-06'), { facil: 'reis', dificil: '' });
    assert.deepEqual(manualsDelDia(especials, '2027-01-07'), {});
    for (const buit of [null, undefined, {}, { v: 1 }, { v: 1, dies: {} }]) {
        assert.deepEqual(manualsDelDia(buit, '2026-12-25'), {});
    }
});
