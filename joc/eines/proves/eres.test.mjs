// Proves de la paraula del dia amb eres: la fórmula, les manuals, la regla del
// fàcil i el difícil i el canvi d'era.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CARRILS, eraDelDia, formulaDelCarril, parellaDelDia, estatDeSortida, estatDeLaRoda,
} from '../../js/eres.js';
import { paraulaDelDia } from '../../js/objectius.js';
import {
    QUOTES_DIFICIL, QUOTES_FACIL, afegirDies, crearEra, eraPerDefecte, simular,
} from './ajuda_eres.mjs';

const QUOTES = { dificil: QUOTES_DIFICIL, facil: QUOTES_FACIL };

// ------------------------------------------------- La fórmula, dia a dia

test('en 20.000 dies cada bossa de cada carril surt exactament el que toca', () => {
    const dies = simular(eraPerDefecte(), 20000);
    for (const carril of CARRILS) {
        const quotes = QUOTES[carril];
        const compte = quotes.map(() => 0);
        dies.forEach((parella, d) => {
            compte[parella[carril].bossa] += 1;
            const fets = d + 1;
            quotes.forEach((quota, i) => {
                assert.ok(Math.abs(fets * quota - compte[i] * 1000) < 1000,
                    `${carril}: la bossa ${i} s'allunya un dia o més al dia ${fets}`);
            });
            if (fets % 1000 === 0) {
                quotes.forEach((quota, i) => assert.equal(compte[i], (fets / 1000) * quota));
            }
        });
    }
});

test('dues execucions donen exactament el mateix', () => {
    const era = eraPerDefecte();
    const a = simular(era, 3000);
    // Una còpia nova, sense res a la memòria: ha de donar el mateix igualment.
    const b = simular(structuredClone(era), 3000);
    assert.deepEqual(a, b);
    assert.deepEqual(simular(era, 3000), a);
});

test("cap clau no es repeteix dins d'una volta", () => {
    const dies = simular(eraPerDefecte(), 20000);
    for (const carril of CARRILS) {
        const voltes = new Map();
        for (const parella of dies) {
            const { bossa, volta, clau } = parella[carril];
            const id = `${bossa}|${volta}`;
            if (!voltes.has(id)) voltes.set(id, new Set());
            assert.ok(!voltes.get(id).has(clau), `${carril}: la clau ${clau} es repeteix a la volta ${volta}`);
            voltes.get(id).add(clau);
        }
    }
});

test("una clau torna quan la seva bossa s'ha buidat: cada K claus de la bossa", () => {
    // Una sola bossa de 7 claus que surt cada dia: cada clau torna cada 7 dies,
    // ni abans (dins d'una volta) ni, de mitjana, després.
    const era = crearEra({
        carrils: {
            dificil: [{ quota: 1000, claus: 7 }],
            facil: [{ quota: 1000, claus: 7 }],
        },
    });
    const dies = simular(era, 7 * 40);
    for (const carril of CARRILS) {
        const claus = dies.map((parella) => parella[carril].clau);
        for (let volta = 0; volta < 40; volta++) {
            assert.equal(new Set(claus.slice(volta * 7, volta * 7 + 7)).size, 7);
        }
    }
});

test('la variant i la paraula giren amb el comptador de la clau', () => {
    // Una sola clau amb tres variants de 2, 1 i 3 paraules: cada dia és una volta
    // nova, o sigui que t és el número de dia.
    const era = crearEra({
        carrils: {
            dificil: [{ quota: 1000, claus: 1, variants: [2, 1, 3] }],
            facil: [{ quota: 1000, claus: 1, variants: [2, 1, 3] }],
        },
    });
    const esperat = [
        'v0w0', 'v1w0', 'v2w0',    // t = 0, 1, 2: les tres variants, la primera paraula
        'v0w1', 'v1w0', 'v2w1',    // t = 3, 4, 5: la segona (la variant d'una sola paraula torna a la mateixa)
        'v0w0', 'v1w0', 'v2w2',    // t = 6, 7, 8: la variant de dues ha fet la volta
    ];
    const dies = simular(era, 9);
    for (const carril of CARRILS) {
        const clau = era.carrils[carril].bosses[0].claus[0].c;
        assert.deepEqual(dies.map((parella) => parella[carril].objectiu.normalitzada),
            esperat.map((final) => clau + final));
        assert.deepEqual(dies.map((parella) => parella[carril].t), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
});

test("el comptador d'entrada fa continuar la rotació de l'era anterior", () => {
    const entrada = (clau) => ({ comptadors: { [clau]: 5 }, sortides: [] });
    const base = {
        dificil: [{ quota: 1000, claus: 1, variants: [2, 1, 3] }],
        facil: [{ quota: 1000, claus: 1, variants: [2, 1, 3] }],
    };
    const era = crearEra({
        carrils: base,
        entrada: { dificil: entrada('d00k0000'), facil: entrada('f00k0000') },
    });
    const dies = simular(era, 4);
    // t = 5, 6, 7, 8
    assert.deepEqual(dies.map((parella) => parella.dificil.t), [5, 6, 7, 8]);
    assert.deepEqual(dies.map((parella) => parella.dificil.objectiu.normalitzada),
        ['v2w1', 'v0w0', 'v1w0', 'v2w2'].map((final) => `d00k0000${final}`));
});

// ------------------------------------------------------- Les paraules manuals

test('una manual substitueix el seu dia i no en mou cap altre', () => {
    const era = eraPerDefecte();
    const base = simular(era, 600);
    const amb = simular(era, 600, (d) => {
        if (d === 123) return { dificil: 'rosa' };
        if (d === 200) return { facil: 'lectura', dificil: 'aniversari' };
        return {};
    });

    for (let d = 0; d < 600; d++) {
        if (d !== 123 && d !== 200) assert.deepEqual(amb[d], base[d], `el dia ${d} s'ha mogut`);
    }

    assert.equal(amb[123].dificil.manual, true);
    assert.equal(amb[123].dificil.objectiu.normalitzada, 'rosa');
    assert.deepEqual(amb[123].dificil.formula, base[123].dificil);
    assert.deepEqual(amb[123].facil, base[123].facil);

    assert.equal(amb[200].facil.objectiu.normalitzada, 'lectura');
    assert.equal(amb[200].dificil.objectiu.normalitzada, 'aniversari');
    assert.deepEqual(amb[200].facil.formula, base[200].facil);
    assert.deepEqual(amb[200].dificil.formula, base[200].dificil);
});

test('la manual es normalitza, i el dia compta igualment per a la bossa i la volta', () => {
    const era = eraPerDefecte();
    const base = simular(era, 50);
    const amb = simular(era, 50, (d) => (d === 10 ? { facil: ' Genocïdi ' } : {}));
    assert.equal(amb[10].facil.objectiu.normalitzada, 'genocidi');
    assert.equal(amb[10].facil.objectiu.mostrar, null);
    // La clau que hauria sortit no es perd: surt a la fórmula, i les següents no es mouen.
    assert.equal(amb[10].facil.formula.clau, base[10].facil.clau);
    assert.equal(amb[10].facil.formula.bossa, base[10].facil.bossa);
});

// ---------------------------------------------- El fàcil no repeteix el difícil

/** Una era d'una bossa i una clau per carril, amb les paraules que es diguin. */
function eraAmbParaules(paraules, variantsDificil, variantsFacil) {
    return {
        id: 1, inici: '2026-12-01', algorisme: 1, paraules,
        carrils: {
            dificil: { bosses: [{ quota: 1000, claus: [{ c: 'aa', v: variantsDificil }] }], entrada: {} },
            facil: { bosses: [{ quota: 1000, claus: [{ c: 'ff', v: variantsFacil }] }], entrada: {} },
        },
    };
}

const paraulesDelFacil = (era, dies, manuals) => simular(era, dies, manuals).map((p) => p.facil);

test('si el fàcil i el difícil donen la mateixa paraula, el fàcil passa a la següent de la seva variant', () => {
    // El difícil és sempre «pare». El fàcil gira entre [pare, mare], [fada] i [sala].
    const era = eraAmbParaules(['pare', 'mare', 'fada', 'sala'], [[0]], [[0, 1], [2], [3]]);
    const facils = paraulesDelFacil(era, 7);
    // t = 0: toca «pare» i és la del difícil -> «mare». t = 3: toca «mare». t = 6: «pare» -> «mare».
    assert.deepEqual(facils.map((f) => f.objectiu.normalitzada),
        ['mare', 'fada', 'sala', 'mare', 'fada', 'sala', 'mare']);
    assert.deepEqual(facils.map((f) => f.desplacada), [true, false, false, false, false, false, true]);
});

test('si la variant només té una paraula, el fàcil passa a la variant següent', () => {
    const era = eraAmbParaules(['pare', 'mare'], [[0]], [[0], [1]]);
    const facils = paraulesDelFacil(era, 4);
    // t = 0: «pare» coincideix i la variant en té una sola -> la variant següent, «mare».
    assert.deepEqual(facils.map((f) => f.objectiu.normalitzada), ['mare', 'mare', 'mare', 'mare']);
    assert.deepEqual(facils.map((f) => f.variant), [1, 1, 1, 1]);
    assert.deepEqual(facils.map((f) => f.desplacada), [true, false, true, false]);
});

test("el cas extrem: sense cap alternativa a la clau, el fàcil es queda la que toca", () => {
    const era = eraAmbParaules(['pare'], [[0]], [[0]]);
    const facils = paraulesDelFacil(era, 3);
    assert.deepEqual(facils.map((f) => f.objectiu.normalitzada), ['pare', 'pare', 'pare']);
    assert.deepEqual(facils.map((f) => f.desplacada), [false, false, false]);
});

test('si el difícil és manual, el fàcil tampoc no pot ser aquella paraula', () => {
    const era = eraAmbParaules(['pare', 'mare', 'fada', 'sala'], [[0]], [[0, 1], [2], [3]]);
    // El dia 1 el fàcil donaria «fada» (variant d'una paraula) i el difícil és manual: «fada».
    const parella = simular(era, 2, (d) => (d === 1 ? { dificil: 'fada' } : {}))[1];
    assert.equal(parella.dificil.manual, true);
    assert.equal(parella.facil.objectiu.normalitzada, 'sala');
    assert.equal(parella.facil.desplacada, true);
});

test('si el fàcil és manual, no es toca', () => {
    const era = eraAmbParaules(['pare', 'mare'], [[0]], [[1]]);
    const parella = simular(era, 1, () => ({ facil: 'pare' }))[0];
    assert.equal(parella.facil.manual, true);
    assert.equal(parella.facil.objectiu.normalitzada, 'pare');
    assert.equal(parella.dificil.objectiu.normalitzada, 'pare');
});

// ---------------------------------------------------------- El canvi d'era

const BOSSES_DE_CANVI = [{ quota: 600, claus: 5 }, { quota: 400, claus: 4 }];
const DIES_DE_L_ERA_A = 14;

function eraDeCanvi(opcions = {}) {
    return crearEra({
        carrils: { dificil: BOSSES_DE_CANVI, facil: BOSSES_DE_CANVI },
        ...opcions,
    });
}

/** Les claus d'un carril d'una era, bossa per bossa. */
function clausPerBossa(era, carril) {
    return era.carrils[carril].bosses.map((bossa) => bossa.claus.map((clau) => clau.c));
}

test("l'estat de sortida: els comptadors són les vegades que ha sortit cada clau", () => {
    const entrada = { dificil: { comptadors: { d00k0001: 7, zzz: 3 }, sortides: [] } };
    const era = eraDeCanvi({ entrada });
    const dies = simular(era, 41);
    for (const carril of CARRILS) {
        const vegades = {};
        for (const parella of dies) vegades[parella[carril].clau] = (vegades[parella[carril].clau] || 0) + 1;

        const final = afegirDies(era.inici, 41);
        const estat = estatDeSortida(era, carril, final);
        assert.equal(estat.dies, 41);
        for (const clau of clausPerBossa(era, carril).flat()) {
            const abans = (entrada[carril]?.comptadors || {})[clau] || 0;
            assert.equal(estat.comptadors[clau], abans + (vegades[clau] || 0), clau);
        }
    }
    // Un comptador d'una clau que ja no hi és es conserva, per si algun dia torna.
    assert.equal(estatDeSortida(era, 'dificil', afegirDies(era.inici, 3)).comptadors.zzz, 3);
});

test("l'estat de sortida: les sortides són les de la volta a mitges", () => {
    const era = eraDeCanvi();
    const dies = simular(era, DIES_DE_L_ERA_A);
    for (const carril of CARRILS) {
        const estat = estatDeSortida(era, carril, afegirDies(era.inici, DIES_DE_L_ERA_A));
        const esperades = [];
        clausPerBossa(era, carril).forEach((claus, bossa) => {
            const sortides = dies.map((parella) => parella[carril])
                .filter((f) => f.bossa === bossa).map((f) => f.clau);
            const p = sortides.length % claus.length;
            assert.ok(sortides.length > claus.length, 'cal que la bossa hagi passat de la primera volta');
            // Les que han sortit des de l'últim cop que s'ha començat una volta.
            esperades.push(...sortides.slice(sortides.length - p));
        });
        assert.deepEqual(estat.sortides, esperades.sort());
        assert.ok(estat.sortides.length > 0);
    }
});

test('en canviar d\'era, les claus de la volta a mitges van al final de la primera volta', () => {
    const a = eraDeCanvi();
    const final = afegirDies(a.inici, DIES_DE_L_ERA_A);
    const entrada = {};
    for (const carril of CARRILS) {
        const { comptadors, sortides } = estatDeSortida(a, carril, final);
        entrada[carril] = { comptadors, sortides };
    }
    const b = eraDeCanvi({ id: 2, inici: final, entrada });
    const dies = simular(b, 60);

    for (const carril of CARRILS) {
        clausPerBossa(b, carril).forEach((claus, bossa) => {
            const primeraVolta = dies.map((parella) => parella[carril])
                .filter((f) => f.bossa === bossa).slice(0, claus.length).map((f) => f.clau);
            const sortides = claus.filter((clau) => entrada[carril].sortides.includes(clau));
            assert.ok(sortides.length > 0 && sortides.length < claus.length);

            assert.deepEqual([...primeraVolta].sort(), [...claus].sort());
            const pendents = primeraVolta.slice(0, claus.length - sortides.length);
            assert.deepEqual(pendents.filter((clau) => sortides.includes(clau)), [],
                `${carril}, bossa ${bossa}: una clau ja sortida surt abans d'hora`);
            assert.deepEqual(primeraVolta.slice(claus.length - sortides.length).sort(), sortides.sort());
        });
    }
});

test("una clau nova a l'era següent compta com una que encara no ha sortit", () => {
    const a = eraDeCanvi();
    const final = afegirDies(a.inici, DIES_DE_L_ERA_A);
    const { comptadors, sortides } = estatDeSortida(a, 'dificil', final);

    // L'era nova afegeix tres claus a la bossa 0.
    const b = crearEra({
        id: 2, inici: final,
        carrils: {
            dificil: [{ quota: 600, claus: 8 }, { quota: 400, claus: 4 }],
            facil: BOSSES_DE_CANVI,
        },
        entrada: { dificil: { comptadors, sortides } },
    });
    const claus = b.carrils.dificil.bosses[0].claus.map((clau) => clau.c);
    const dies = simular(b, 40).map((parella) => parella.dificil).filter((f) => f.bossa === 0);
    const primeraVolta = dies.slice(0, 8).map((f) => f.clau);
    const antigues = claus.filter((clau) => sortides.includes(clau));
    assert.ok(antigues.length > 0);
    assert.deepEqual(primeraVolta.slice(8 - antigues.length).sort(), antigues.sort());
    assert.deepEqual(primeraVolta.slice(0, 8 - antigues.length).filter((clau) => sortides.includes(clau)), []);
    // Les noves no havien comptat mai: comencen de zero.
    assert.equal(b.carrils.dificil.entrada.comptadors.d00k0007, undefined);
    assert.equal(dies.find((f) => f.clau === 'd00k0007').t, dies.find((f) => f.clau === 'd00k0007').volta);
});

test("el comptador continua d'una era a l'altra", () => {
    const a = eraDeCanvi();
    const final = afegirDies(a.inici, DIES_DE_L_ERA_A);
    const entrada = {};
    for (const carril of CARRILS) {
        const { comptadors, sortides } = estatDeSortida(a, carril, final);
        entrada[carril] = { comptadors, sortides };
    }
    const b = eraDeCanvi({ id: 2, inici: final, entrada });
    for (const parella of simular(b, 80)) {
        for (const carril of CARRILS) {
            const f = parella[carril];
            assert.equal(f.t, (entrada[carril].comptadors[f.clau] || 0) + f.volta);
        }
    }
});

test("una era que acaba amb la primera volta a mitges també deixa l'estat bé", () => {
    // L'era A ve ja amb antigues sortides i dura tan poc que no arriba a buidar-les.
    const sortidesAntigues = ['d00k0001', 'd00k0003', 'd01k0000'];
    const a = eraDeCanvi({
        entrada: { dificil: { comptadors: {}, sortides: sortidesAntigues } },
    });
    const final = afegirDies(a.inici, 2);
    const dies = simular(a, 2).map((parella) => parella.dificil);
    const estat = estatDeSortida(a, 'dificil', final);

    // Les que han sortit en aquests dos dies i les antigues, que continuen sent recents.
    const sortidesAra = dies.map((f) => f.clau);
    assert.deepEqual(estat.sortides, [...new Set([...sortidesAra, ...sortidesAntigues])].sort());
});

test('una bossa amb quota i cap clau no es pot calcular', () => {
    const era = crearEra({
        carrils: {
            dificil: [{ quota: 500, claus: 3 }, { quota: 500, claus: 0 }],
            facil: [{ quota: 1000, claus: 3 }],
        },
    });
    assert.throws(() => simular(era, 1), /quota i cap clau/);
});

test("una bossa sense quota pot no tenir claus (no surt mai)", () => {
    const era = crearEra({
        carrils: {
            dificil: [{ quota: 1000, claus: 3 }, { quota: 0, claus: 0 }],
            facil: [{ quota: 1000, claus: 3 }],
        },
    });
    assert.equal(simular(era, 30).filter((p) => p.dificil.bossa !== 0).length, 0);
});

// ----------------------------------------------------------------- Les eres

test("l'era d'un dia és la darrera que ja ha començat", () => {
    const zero = { id: 0, inici: '2026-01-01', algorisme: 0 };
    const una = { id: 1, inici: '2026-12-01', algorisme: 1 };
    const dues = { id: 2, inici: '2027-03-01', algorisme: 1 };
    const eres = [dues, zero, una];     // l'ordre del fitxer no importa

    assert.equal(eraDelDia(eres, '2026-01-01').id, 0);
    assert.equal(eraDelDia(eres, '2026-11-30').id, 0);
    assert.equal(eraDelDia(eres, '2026-12-01').id, 1);
    assert.equal(eraDelDia(eres, '2027-02-28').id, 1);
    assert.equal(eraDelDia(eres, '2027-03-01').id, 2);
    assert.equal(eraDelDia(eres, '2099-01-01').id, 2);
    assert.equal(eraDelDia({ v: 1, eres }, '2027-03-01').id, 2);
    assert.throws(() => eraDelDia(eres, '2025-12-31'), /Cap era/);
});

test("el canvi d'era es nota al dia que toca, i abans de l'inici no hi ha fórmula", () => {
    const a = eraDeCanvi();
    const final = afegirDies(a.inici, DIES_DE_L_ERA_A);
    const entrada = {};
    for (const carril of CARRILS) entrada[carril] = estatDeSortida(a, carril, final);
    const b = eraDeCanvi({ id: 2, inici: final, entrada });

    assert.equal(parellaDelDia([a, b], afegirDies(final, -1)).dificil.era, 1);
    assert.equal(parellaDelDia([a, b], final).dificil.era, 2);
    assert.equal(parellaDelDia([a, b], final).dificil.dia, 0);
    assert.throws(() => formulaDelCarril(b, 'dificil', afegirDies(final, -1)), RangeError);
});

// ------------------------------------------------------------ L'era 0: la roda

/** Una roda de joguina: 10 claus de 3 paraules, i l'índex que hi correspon. */
function rodaDeJoguina() {
    const paraules = Array.from({ length: 30 }, (_, i) => (i % 4 === 1 ? `cami${i}>camí${i}` : `paraula${i}`));
    const claus = Array.from({ length: 10 }, (_, i) => [3 * i, 3 * i + 1, 3 * i + 2]);
    const index = {
        diaries: { paraules, claus, on: { ca: paraules.map((_, i) => i) } },
        dialectes: { ca: { claus: paraules.map((_, i) => [`k${i}`, i % 4, 1, 100, 1]) } },
    };
    const era = { id: 0, inici: '2026-01-01', algorisme: 0, paraules, roda: { claus } };
    return { index, era };
}

test("l'era 0 dona exactament el mateix que la roda d'abans, cada dia i en les dues dificultats", () => {
    const { index, era } = rodaDeJoguina();
    for (let d = 0; d < 900; d++) {
        const dia = afegirDies(era.inici, d);
        const parella = parellaDelDia([era], dia);
        for (const dificultat of CARRILS) {
            const roda = paraulaDelDia(index, dia, dificultat, 'ca');
            assert.deepEqual(parella[dificultat].objectiu, roda.objectiu, `${dia} ${dificultat}`);
        }
    }
});

test("l'era 0 no aplica la regla del fàcil i el difícil: els dies passats no es poden moure", () => {
    const { index, era } = rodaDeJoguina();
    let iguals = 0;
    for (let d = 0; d < 900; d++) {
        const dia = afegirDies(era.inici, d);
        const parella = parellaDelDia([era], dia);
        if (parella.facil.objectiu.normalitzada === parella.dificil.objectiu.normalitzada) {
            iguals += 1;
            assert.equal(parella.facil.desplacada, false);
            assert.equal(parella.facil.objectiu.normalitzada,
                paraulaDelDia(index, dia, 'facil', 'ca').objectiu.normalitzada);
        }
    }
    assert.ok(iguals > 0, 'la roda de joguina havia de tenir algun dia amb la mateixa paraula');
});

test("una manual a l'era 0 mana igual que a qualsevol altra", () => {
    const { era } = rodaDeJoguina();
    const dia = afegirDies(era.inici, 100);
    const parella = parellaDelDia([era], dia, { dificil: 'genocïdi' });
    assert.equal(parella.dificil.manual, true);
    assert.equal(parella.dificil.objectiu.normalitzada, 'genocidi');
    assert.equal(parella.facil.manual, false);
});

test("l'estat de sortida de la roda: el cicle a mitges i les vegades que ha sortit cada entrada", () => {
    const { era } = rodaDeJoguina();
    const final = '2026-11-02';
    const estat = estatDeLaRoda(era, final);
    assert.equal(estat.dies, 305);
    assert.equal(estat.cicle, 30);
    assert.equal(estat.posicio, 5);

    for (const carril of CARRILS) {
        const vegades = new Array(10).fill(0);
        const delCicle = [];
        for (let d = 0; d < estat.dies; d++) {
            const clau = parellaDelDia([era], afegirDies(era.inici, d))[carril].clau;
            vegades[clau] += 1;
            if (d >= estat.cicle * 10) delCicle.push(clau);
        }
        assert.deepEqual(estat[carril].comptadors, vegades);
        assert.deepEqual(estat[carril].sortides, delCicle.sort((a, b) => a - b));
    }
    assert.throws(() => estatDeSortida(era, 'dificil', final), /roda/);
    assert.throws(() => estatDeLaRoda(eraDeCanvi(), final), /era 0/);
});
