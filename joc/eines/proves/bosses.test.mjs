// Proves de la maquinària de les bosses: el patró ponderat i les baralles.

import test from 'node:test';
import assert from 'node:assert/strict';

import { llavor, generador } from '../../js/objectius.js';
import {
    diesEntre, patroDeBosses, quantesVegades, bossaDelDia, errorMaximDelPatro,
    barrejar, crearBaralles,
} from '../../js/bosses.js';
import { QUOTES_DIFICIL, QUOTES_FACIL } from './ajuda_eres.mjs';

/** El període més curt del patró: el menor divisor de W pel qual es repeteix. */
function periode(patro) {
    for (let p = 1; p <= patro.W; p++) {
        if (patro.W % p !== 0) continue;
        let igual = true;
        for (let i = 0; i < patro.W && igual; i++) igual = patro.patro[i] === patro.patro[(i + p) % patro.W];
        if (igual) return p;
    }
    return patro.W;
}

/** Quotes a l'atzar (però sempre les mateixes) que sumen 1.000, de 2 a 12 bosses. */
function quotesAlAtzar(llavorTexte, quantes) {
    const atzar = generador(llavor(llavorTexte));
    const configs = [];
    for (let c = 0; c < quantes; c++) {
        const n = 2 + Math.floor(atzar() * 11);
        const talls = new Set();
        while (talls.size < n - 1) talls.add(1 + Math.floor(atzar() * 999));
        const ordenats = [0, ...[...talls].sort((a, b) => a - b), 1000];
        configs.push(ordenats.slice(1).map((v, i) => v - ordenats[i]));
    }
    return configs;
}

// ---------------------------------------------------------------- El patró

test("el patró de l'exemple de la proposta: 5, 3 i 2 donen A B C A A B A C B A", () => {
    const patro = patroDeBosses([5, 3, 2]);
    assert.equal(Array.from(patro.patro, (b) => 'ABC'[b]).join(''), 'ABCAABACBA');
});

test("en cas d'empat surt la bossa de número més baix", () => {
    // Dues bosses iguals: el primer pas ja és un empat (5 i 5) i guanya la A.
    const patro = patroDeBosses([5, 5]);
    assert.deepEqual(Array.from(patro.patro), [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
});

test('cada bossa surt exactament la seva quota en un patró sencer', () => {
    for (const quotes of [QUOTES_DIFICIL, QUOTES_FACIL, [1000], [1, 999], [500, 500]]) {
        const patro = patroDeBosses(quotes);
        assert.equal(patro.W, 1000);
        quotes.forEach((quota, i) => assert.equal(patro.acumulat[i][patro.W], quota));
    }
});

test('el patró és periòdic, amb un període que divideix W', () => {
    const configs = [QUOTES_DIFICIL, QUOTES_FACIL, ...quotesAlAtzar('periode', 100)];
    for (const quotes of configs) {
        const patro = patroDeBosses(quotes);
        assert.equal(patro.W % periode(patro), 0);
    }
    // Les del difícil no tenen cap divisor comú; les del fàcil són totes múltiples de 5.
    assert.equal(periode(patroDeBosses(QUOTES_DIFICIL)), 1000);
    assert.equal(periode(patroDeBosses(QUOTES_FACIL)), 200);
});

test('en 20.000 dies cada bossa surt exactament el que toca i l\'error mai arriba a un dia', () => {
    const DIES = 20000;
    for (const quotes of [QUOTES_DIFICIL, QUOTES_FACIL]) {
        const patro = patroDeBosses(quotes);
        const compte = quotes.map(() => 0);
        for (let dia = 0; dia < DIES; dia++) {
            const { bossa, m } = bossaDelDia(patro, dia);
            // Les vegades que havia sortit abans d'avui són les que s'han comptat.
            assert.equal(m, compte[bossa]);
            compte[bossa] += 1;

            const fets = dia + 1;
            quotes.forEach((quota, i) => {
                // |dies · quota / W - vegades| < 1, en enters.
                assert.ok(Math.abs(fets * quota - compte[i] * patro.W) < patro.W,
                    `la bossa ${i} s'allunya un dia o més al dia ${fets}`);
            });
            // I just quan s'acaba un patró, el compte és exacte.
            if (fets % patro.W === 0) {
                quotes.forEach((quota, i) => assert.equal(compte[i], (fets / patro.W) * quota));
            }
        }
    }
});

test("l'error màxim del patró: 0,800 al difícil i 0,865 al fàcil", () => {
    assert.equal(errorMaximDelPatro(patroDeBosses(QUOTES_DIFICIL)).toFixed(3), '0.800');
    assert.equal(errorMaximDelPatro(patroDeBosses(QUOTES_FACIL)).toFixed(3), '0.865');
});

test('«menys d\'un dia» no val per a qualsevol quota, i errorMaximDelPatro ho diu', () => {
    // Una configuració de vuit bosses en què el repartiment passa d'un dia. No és
    // cap error del codi: és així (comprovat amb una implementació independent).
    const error = errorMaximDelPatro(patroDeBosses([336, 163, 37, 28, 105, 325, 4, 2]));
    assert.ok(error > 1 && error < 1.1, `error ${error}`);

    // La funció coincideix amb comptar-ho a força bruta, i els comptes són exactes.
    for (const quotes of [QUOTES_DIFICIL, QUOTES_FACIL, ...quotesAlAtzar('error', 40)]) {
        const patro = patroDeBosses(quotes);
        const compte = quotes.map(() => 0);
        let maxim = 0;
        for (let n = 1; n <= patro.W; n++) {
            compte[patro.patro[n - 1]] += 1;
            quotes.forEach((quota, i) => {
                maxim = Math.max(maxim, Math.abs((n * quota) / patro.W - compte[i]));
            });
        }
        assert.ok(Math.abs(errorMaximDelPatro(patro) - maxim) < 1e-9);
    }
});

test('les quotes han de ser enters no negatius que sumen més de zero', () => {
    assert.throws(() => patroDeBosses([]), /quotes/);
    assert.throws(() => patroDeBosses([0, 0]), /quotes/);
    assert.throws(() => patroDeBosses([500, -1, 501]), /quotes/);
    assert.throws(() => patroDeBosses([500.5, 499.5]), /quotes/);
});

test('una bossa sense quota no surt mai', () => {
    const patro = patroDeBosses([0, 700, 0, 300]);
    assert.ok(!Array.from(patro.patro).includes(0));
    assert.ok(!Array.from(patro.patro).includes(2));
});

test('quantesVegades i bossaDelDia coincideixen amb comptar pas a pas', () => {
    const patro = patroDeBosses([5, 3, 2]);
    const compte = [0, 0, 0];
    for (let dia = 0; dia < 1234; dia++) {
        compte.forEach((c, i) => assert.equal(quantesVegades(patro, i, dia), c));
        const { bossa, m } = bossaDelDia(patro, dia);
        assert.equal(m, compte[bossa]);
        compte[bossa] += 1;
    }
    assert.throws(() => bossaDelDia(patro, -1), RangeError);
    assert.throws(() => quantesVegades(patro, 0, 1.5), RangeError);
});

test('diesEntre compta en UTC, sense canvis d\'hora pel mig', () => {
    assert.equal(diesEntre('2026-01-01', '2026-01-01'), 0);
    assert.equal(diesEntre('2026-03-28', '2026-03-30'), 2);   // el canvi d'hora de primavera
    assert.equal(diesEntre('2026-10-24', '2026-10-26'), 2);   // i el de tardor
    assert.equal(diesEntre('2026-01-01', '2027-01-01'), 365);
    assert.equal(diesEntre('2026-12-01', '2026-11-30'), -1);
    assert.throws(() => diesEntre('2026-01-01', 'ahir'), /no vàlida/);
});

// ------------------------------------------------------------- Les baralles

test('barrejar és una permutació determinista que no toca l\'original', () => {
    const original = Array.from({ length: 50 }, (_, i) => `k${i}`);
    const copia = original.slice();
    const a = barrejar(original, 'llavor');
    assert.deepEqual(original, copia);
    assert.deepEqual([...a].sort(), [...original].sort());
    assert.deepEqual(barrejar(original, 'llavor'), a);
    assert.notDeepEqual(barrejar(original, 'altra'), a);
    assert.deepEqual(barrejar([], 'x'), []);
});

test('cap clau no es repeteix dins d\'una volta, i totes hi són', () => {
    for (const quantes of [1, 2, 3, 7, 40]) {
        const claus = Array.from({ length: quantes }, (_, i) => `c${i}`);
        const baralles = crearBaralles({ llavorBase: `1-dificil-${quantes}`, claus });
        for (let r = 0; r < 200; r++) {
            assert.deepEqual([...baralles.volta(r)].sort(), [...claus].sort());
        }
    }
});

test('entre voltes la primera clau mai no és l\'última de l\'anterior', () => {
    for (const quantes of [2, 3, 4, 10]) {
        const claus = Array.from({ length: quantes }, (_, i) => `c${i}`);
        const baralles = crearBaralles({ llavorBase: `1-facil-${quantes}`, claus });
        for (let r = 1; r < 3000; r++) {
            assert.notEqual(baralles.volta(r)[0], baralles.volta(r - 1)[quantes - 1],
                `la volta ${r} de ${quantes} claus comença com acaba l'anterior`);
        }
    }
});

test('amb dues claus alternen sempre, i amb una surt sempre la mateixa', () => {
    const dues = crearBaralles({ llavorBase: 'x', claus: ['a', 'b'] });
    const seq = Array.from({ length: 400 }, (_, m) => dues.clauDe(m).clau);
    for (let m = 1; m < seq.length; m++) assert.notEqual(seq[m], seq[m - 1]);

    const una = crearBaralles({ llavorBase: 'x', claus: ['a'] });
    assert.deepEqual(Array.from({ length: 5 }, (_, m) => una.clauDe(m).clau), ['a', 'a', 'a', 'a', 'a']);

    assert.throws(() => crearBaralles({ llavorBase: 'x', claus: [] }), /sense claus/);
});

test('clauDe dona la volta i la posició de la m-ena sortida', () => {
    const claus = Array.from({ length: 6 }, (_, i) => `c${i}`);
    const baralles = crearBaralles({ llavorBase: 'z', claus });
    for (const m of [0, 1, 5, 6, 7, 29, 30, 31]) {
        const { clau, volta, posicio } = baralles.clauDe(m);
        assert.equal(volta, Math.floor(m / 6));
        assert.equal(posicio, m % 6);
        assert.equal(clau, baralles.volta(volta)[posicio]);
    }
});

test('dues execucions donen exactament les mateixes baralles', () => {
    const claus = Array.from({ length: 30 }, (_, i) => `c${i}`);
    const a = crearBaralles({ llavorBase: '2-dificil-3', claus, sortides: ['c4', 'c9'] });
    const b = crearBaralles({ llavorBase: '2-dificil-3', claus, sortides: ['c4', 'c9'] });
    for (let r = 0; r < 20; r++) assert.deepEqual(a.volta(r), b.volta(r));
});

test('sense sortides, la primera volta és la barreja de sempre', () => {
    const claus = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const baralles = crearBaralles({ llavorBase: '1-facil-0', claus });
    assert.deepEqual(baralles.volta(0), barrejar(claus, '1-facil-0-0'));
});

test('a la primera volta d\'una era nova, les claus ja sortides van al final', () => {
    const claus = Array.from({ length: 20 }, (_, i) => `c${String(i).padStart(2, '0')}`);
    const sortides = ['c03', 'c07', 'c11', 'c15', 'c19'];
    const baralles = crearBaralles({ llavorBase: '2-dificil-0', claus, sortides });
    const primera = baralles.volta(0);

    assert.equal(baralles.pendents, 15);
    assert.deepEqual([...primera].sort(), [...claus].sort());
    assert.deepEqual(primera.slice(0, 15).filter((c) => sortides.includes(c)), []);
    assert.deepEqual([...primera.slice(15)].sort(), sortides);
    // I a partir de la segona volta, tot normal: una barreja neta, que tampoc no
    // comença amb l'última clau de la primera.
    assert.deepEqual([...baralles.volta(1)].sort(), [...claus].sort());
    assert.notEqual(baralles.volta(1)[0], primera[19]);
});

test('les sortides que no són a la bossa s\'ignoren', () => {
    const baralles = crearBaralles({ llavorBase: 'q', claus: ['a', 'b', 'c'], sortides: ['z', 'b'] });
    assert.equal(baralles.pendents, 2);
    assert.equal(baralles.volta(0)[2], 'b');
});

test('despresDe: a una volta a mitges, les p primeres són les sortides', () => {
    const claus = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const baralles = crearBaralles({ llavorBase: 'w', claus });
    for (const m of [10, 13, 17, 25, 39]) {
        const estat = baralles.despresDe(m);
        const r = Math.floor(m / 10);
        const p = m % 10;
        assert.equal(estat.volta, r);
        assert.equal(estat.posicio, p);
        assert.deepEqual(estat.surten, baralles.volta(r).slice(0, p));
        assert.deepEqual(estat.sortides, estat.surten);
    }
    // Amb la volta acabada (p = 0) no n'hi ha cap de sortida.
    assert.deepEqual(baralles.despresDe(20).sortides, []);
});

test('despresDe a la primera volta: les antigues sortides continuen al final', () => {
    const claus = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const antigues = ['c2', 'c5', 'c8'];
    const baralles = crearBaralles({ llavorBase: 'e', claus, sortides: antigues });
    const primera = baralles.volta(0);

    // Encara queden pendents per treure (p < 7): les antigues i les noves
    // sortides són les «recents», i les pendents que queden, les primeres.
    const alMig = baralles.despresDe(4);
    assert.deepEqual([...alMig.sortides].sort(), [...primera.slice(0, 4), ...antigues].sort());

    // Just quan s'han tret totes les pendents (p = 7), les antigues encara no han
    // sortit en aquesta era: les més antigues són elles, i no tornen a la cua.
    const justAlFinal = baralles.despresDe(7);
    assert.deepEqual([...justAlFinal.sortides].sort(), [...primera.slice(0, 7)].sort());

    // I més enllà (p > 7), les que han sortit són les p primeres.
    const mesEnlla = baralles.despresDe(9);
    assert.deepEqual(mesEnlla.sortides, primera.slice(0, 9));

    // Sense cap sortida a l'era (m = 0), l'estat d'entrada es manté tal qual.
    assert.deepEqual([...baralles.despresDe(0).sortides].sort(), antigues);
});
