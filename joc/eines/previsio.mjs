// La previsió de la paraula del dia: quines paraules sortiran els propers dies.
//
//   node joc/eines/previsio.mjs                         els propers 30 dies, en text
//   node joc/eines/previsio.mjs --dies 90 --des-de 2026-12-01
//   node joc/eines/previsio.mjs --detall                amb la clau i el grup de cada dialecte
//   node joc/eines/previsio.mjs --html [RUTA]           una pàgina local (joc/eines/previsio.html)
//   node joc/eines/previsio.mjs --json                  per a altres programes (el bot de tuits)
//   node joc/eines/previsio.mjs --manuals [RUTA]        hi suma les manuals en clar que encara no s'han publicat
//   node joc/eines/previsio.mjs --dades RUTA            una altra carpeta de dades (per defecte, joc/dades)
//
// NO TÉ CAP CÒPIA DE LA FÓRMULA. Importa els mateixos mòduls que el navegador (joc/js/eres.js
// i especials.js) i llegeix els mateixos fitxers que el joc baixa (eres.json, index.json i
// especials.json, que desxifra), o sigui que la previsió no pot discrepar del que surt. Va
// substituir joc/eines/predictor.py, que n'era un port a Python.
//
// PER A CADA DIA I CARRIL DIU: la bossa (amb el seu tall i la seva quota), la clau (la
// consonant al difícil, l'assonant al fàcil), la variant que toca, la paraula, quantes rimes
// té a cada dialecte i si és manual. Una paraula manual no té forma per mostrar fins que es
// busca al fitxer del dialecte; això és el que es fa aquí (el del central), i també es mira
// que sigui jugable als quatre: el joc, si en un dialecte no ho és, hi fa servir la fórmula.
//
// ELS DIES COMPTEN A CATALUNYA, com al joc.
//
// QUAN VAL: mentre no es congeli cap era nova. Dins de l'era vigent només la poden canviar
// les substitucions al lloc de generar_dades.py (--aplica-substitucions) i les manuals.
//
// LA SORTIDA ES QUEDA EN LOCAL. Dates amb paraules en clar no s'han de publicar enlloc: la
// pàgina (previsio.html) i qualsevol previsio.txt o previsio.json són al .gitignore.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { normalitza } from '../js/normalitza.js';
import { manualsDelDia } from '../js/especials.js';
import { CARRILS, eraDelDia, parellaDelDia } from '../js/eres.js';
import {
    afegirDies, dataDAvui, esDataValida, llegirDialecte, llegirManuals, resoldreAlDialecte,
} from './manuals.mjs';

const DIR_EINES = path.dirname(fileURLToPath(import.meta.url));
const DIR_DADES = path.join(DIR_EINES, '..', 'dades');
const HTML_PER_DEFECTE = path.join(DIR_EINES, 'previsio.html');
const MANUALS_EN_CLAR = path.join(DIR_EINES, 'diaries_manuals.json');

const DIES_PER_DEFECTE = 30;
const MAX_DIES = 3660;
const CENTRAL = 'ca';
const NOM_CARRIL = { facil: 'fàcil', dificil: 'difícil' };

const mil = (n) => n.toLocaleString('ca-ES');

// ----------------------------------------------------------------- Les dades

/** On cau una paraula de l'era a cada dialecte, amb el que en diu l'index (index.eres). */
function dialectesDeLaFormula(index, formula, mostrar) {
    const resultat = {};
    for (const [codi, tros] of Object.entries(index.dialectes)) {
        const posicions = ((index.eres || {})[formula.era] || {})[codi];
        const entrada = posicions && tros.claus[posicions[formula.indexParaula]];
        resultat[codi] = entrada
            ? {
                ok: true, clau: entrada[0], grup: entrada[1], rimes: entrada[3],
                rimesDelGrup: tros.grups[entrada[1]][3], mostrar,
            }
            : {
                ok: false,
                motiu: posicions ? 'no és jugable en aquest dialecte' : `l'index no resol l'era ${formula.era}: cal passar generar_dades.py`,
            };
    }
    return resultat;
}

/** On cau una paraula manual a cada dialecte: la mateixa comprovació que fa manuals.mjs. */
function dialectesDeLaManual(index, normalitzada, trobadesDe) {
    return Object.fromEntries(Object.entries(index.dialectes).map(
        ([codi, tros]) => [codi, resoldreAlDialecte(normalitzada, trobadesDe(codi), tros)]));
}

// -------------------------------------------------------------- La previsió

/**
 * El que dona el joc un dia en un carril. `dia` és el que torna parellaDelDia per al carril
 * i `publicada` la paraula que diu especials.json per a aquell dia i carril (si en diu cap).
 */
function descriureCarril({ data, carril, era, dia, index, publicada, trobadesDe, avisos }) {
    const formula = dia.manual ? dia.formula : dia;
    const bossa = era.algorisme === 1 ? era.carrils[carril].bosses[formula.bossa] : null;
    const clau = bossa ? bossa.claus.find((k) => k.c === formula.clau) : null;
    const etiqueta = `${data} ${NOM_CARRIL[carril]}`;

    const descripcio = {
        carril, era: era.id,
        bossa: formula.bossa,
        // Una era de debò sempre en porta els talls; una de joguina (les proves) pot no tenir-ne.
        tall: bossa ? { de: bossa.de ?? null, fins: bossa.fins ?? null, quota: bossa.quota } : null,
        clau: formula.clau,
        variant: formula.variant,
        variants: clau ? clau.v.length : null,
        desplacada: formula.desplacada,
        manual: dia.manual,
    };

    if (!dia.manual) {
        descripcio.normalitzada = dia.objectiu.normalitzada;
        descripcio.paraula = dia.objectiu.mostrar;
        descripcio.dialectes = dialectesDeLaFormula(index, dia, dia.objectiu.mostrar);
        for (const [codi, lloc] of Object.entries(descripcio.dialectes)) {
            if (!lloc.ok) avisos.push(`${etiqueta}: «${dia.objectiu.normalitzada}» (fórmula) a ${codi}: ${lloc.motiu}`);
        }
        return descripcio;
    }

    const normalitzada = dia.objectiu.normalitzada;
    const dialectes = dialectesDeLaManual(index, normalitzada, trobadesDe);
    const central = dialectes[CENTRAL] && dialectes[CENTRAL].ok ? dialectes[CENTRAL] : Object.values(dialectes).find((lloc) => lloc.ok);

    Object.assign(descripcio, {
        normalitzada, paraula: central ? central.mostrar : normalitzada, dialectes,
        publicada: publicada === normalitzada,
        formula: { normalitzada: formula.objectiu.normalitzada, paraula: formula.objectiu.mostrar },
    });
    for (const [codi, lloc] of Object.entries(dialectes)) {
        if (!lloc.ok) {
            avisos.push(`${etiqueta}: la manual «${normalitzada}» no val a ${codi} (${lloc.motiu}): `
                + `allà hi sortirà la de la fórmula, «${formula.objectiu.mostrar}»`);
        }
    }
    if (!descripcio.publicada) {
        avisos.push(`${etiqueta}: la manual «${normalitzada}» no és a especials.json: el joc encara no la farà servir `
            + '(passa joc/eines/manuals.mjs)');
    }
    return descripcio;
}

/**
 * Els propers `dies` dies a partir de `desDe`, tal com els treu el joc.
 *
 *   eres, index, especials   els fitxers del joc ja llegits (especials pot faltar)
 *   locals                   manuals en clar (el que torna llegirManuals) que se sumen a les
 *                            publicades i les manen: serveixen per veure què passarà un cop
 *                            publicades
 *   trobadesDe(codi)         el fitxer d'un dialecte llegit amb llegirDialecte; només es
 *                            demana si algun dia té paraula manual
 *
 * Torna { dies, avisos }. Un dia que cap era no cobreix hi surt amb { data, error }.
 */
export function preveure({ eres, index, especials = null, locals = [], desDe, dies, trobadesDe = null }) {
    const desades = new Map();
    for (const { data, carril, paraula } of locals) {
        if (!desades.has(data)) desades.set(data, {});
        desades.get(data)[carril] = normalitza(paraula);
    }

    const avisos = [];
    const resultat = [];
    for (let i = 0; i < dies; i++) {
        const data = afegirDies(desDe, i);
        const publicades = manualsDelDia(especials, data);
        const manuals = { ...publicades, ...(desades.get(data) || {}) };

        let parella;
        let era;
        try {
            parella = parellaDelDia(eres, data, manuals);
            era = eraDelDia(eres, data);
        } catch (error) {
            resultat.push({ data, error: error.message });
            continue;
        }

        const dia = { data, era: era.id };
        for (const carril of CARRILS) {
            dia[carril] = descriureCarril({
                data, carril, era, dia: parella[carril], index,
                publicada: publicades[carril] || null, trobadesDe, avisos,
            });
        }
        resultat.push(dia);
    }
    return { dies: resultat, avisos };
}

// ------------------------------------------------------------- La sortida

function textDeLaBossa(carril) {
    if (carril.bossa === null) return 'roda';
    const { de, fins, quota } = carril.tall;
    const talls = de === null || fins === null ? '' : `${mil(de)}-${mil(fins)}, `;
    return `${carril.bossa} (${talls}${String(quota / 10).replace('.', ',')} %)`;
}

function textDeLaClau(carril) {
    return typeof carril.clau === 'number' ? `#${carril.clau}` : carril.clau;
}

function textDeLaVariant(carril) {
    return carril.variant === null || carril.variants === null ? '-' : `${carril.variant + 1}/${carril.variants}`;
}

function textDeLesRimes(carril, codis) {
    return codis.map((codi) => {
        const lloc = carril.dialectes[codi];
        if (!lloc || !lloc.ok) return '-';
        return mil(carril.carril === 'dificil' ? lloc.rimes : lloc.rimesDelGrup);
    }).join(' / ');
}

function textDeLesNotes(carril) {
    const notes = [];
    if (carril.manual) {
        notes.push(carril.publicada ? 'manual' : 'manual SENSE PUBLICAR');
        notes.push(`fórmula: «${carril.formula.paraula}»`);
    }
    if (carril.desplacada) notes.push('desplaçada (el difícil dona la mateixa)');
    return notes.join(' · ');
}

function textDeLaFila(carril, data, codis) {
    return [
        data, NOM_CARRIL[carril.carril], textDeLaBossa(carril), textDeLaClau(carril),
        textDeLaVariant(carril), carril.paraula, textDeLesRimes(carril, codis), textDeLesNotes(carril),
    ];
}

/** El que es veu per pantalla: una taula amb una fila per dia i carril. */
export function textDeLaPrevisio({ dies, avisos }, codis, { detall = false } = {}) {
    const capcalera = ['DATA', 'CARRIL', 'BOSSA', 'CLAU', 'VAR.', 'PARAULA', `RIMES (${codis.join('/')})`, 'NOTES'];
    const files = [];
    const detalls = new Map();
    for (const dia of dies) {
        if (dia.error) {
            files.push([dia.data, '-', dia.error]);
            continue;
        }
        for (const carril of CARRILS) {
            const fila = textDeLaFila(dia[carril], dia.data, codis);
            files.push(fila);
            if (detall) {
                detalls.set(fila, codis.map((codi) => {
                    const lloc = dia[carril].dialectes[codi];
                    if (!lloc || !lloc.ok) return `${codi} -`;
                    return carril === 'dificil' ? `${codi} -${lloc.clau}` : `${codi} g${lloc.grup} (-${lloc.clau})`;
                }).join(' · '));
            }
        }
    }

    const amples = capcalera.map((titol, i) => Math.max(titol.length, ...files.map((fila) => (fila[i] || '').length)));
    const linia = (fila) => fila.map((cel, i) => (i === fila.length - 1 ? cel : cel.padEnd(amples[i]))).join('  ').trimEnd();

    const text = [linia(capcalera)];
    for (const fila of files) {
        text.push(fila.length === capcalera.length ? linia(fila) : fila.join('  '));
        if (detalls.has(fila)) text.push(`${' '.repeat(amples[0] + 2)}${detalls.get(fila)}`);
    }
    if (avisos.length) text.push('', 'AVISOS', ...avisos.map((avis) => `  ${avis}`));
    return text.join('\n');
}

const escapa = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** La pàgina local: la mateixa taula, amb les manuals i els avisos ressaltats. */
export function paginaDeLaPrevisio({ dies, avisos }, codis, { desDe, generat }) {
    const files = [];
    for (const dia of dies) {
        if (dia.error) {
            files.push(`<tr class="error"><td>${escapa(dia.data)}</td><td colspan="${5 + codis.length}">${escapa(dia.error)}</td></tr>`);
            continue;
        }
        for (const carril of CARRILS) {
            const c = dia[carril];
            const rimes = codis.map((codi) => {
                const lloc = c.dialectes[codi];
                return `<td class="num">${lloc && lloc.ok ? mil(carril === 'dificil' ? lloc.rimes : lloc.rimesDelGrup) : '-'}</td>`;
            }).join('');
            files.push(`<tr class="${carril}${c.manual ? ' manual' : ''}">`
                + `<td>${escapa(dia.data)}</td><td>${NOM_CARRIL[carril]}</td><td>${escapa(textDeLaBossa(c))}</td>`
                + `<td class="clau">${escapa(textDeLaClau(c))}</td><td>${escapa(textDeLaVariant(c))}</td>`
                + `<td class="paraula">${escapa(c.paraula)}</td>${rimes}<td>${escapa(textDeLesNotes(c))}</td></tr>`);
        }
    }

    return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Previsió de la paraula del dia</title>
<style>
:root { --fons: #fff; --text: #1d1d1f; --suau: #6e6e73; --linia: #d8d8dc; --manual: #fff4c2; --error: #fde0e0; }
@media (prefers-color-scheme: dark) {
  :root { --fons: #17171a; --text: #ececf0; --suau: #9a9aa3; --linia: #34343a; --manual: #4a4220; --error: #4a2323; }
}
body { margin: 0; padding: 16px; background: var(--fons); color: var(--text); font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 1.3rem; margin: 0 0 4px; }
p { margin: 0 0 12px; color: var(--suau); }
.taula { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 4px 10px; border-bottom: 1px solid var(--linia); text-align: left; white-space: nowrap; }
th { position: sticky; top: 0; background: var(--fons); }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
td.paraula { font-weight: 600; }
td.clau { font-family: ui-monospace, monospace; }
tr.manual { background: var(--manual); }
tr.error { background: var(--error); }
tr.facil td:first-child { color: var(--suau); }
ul { padding-left: 20px; }
</style>
</head>
<body>
<h1>Previsió de la paraula del dia</h1>
<p>${dies.length} dies des del ${escapa(desDe)} · generada el ${escapa(generat)} amb el mateix codi del joc.
Val mentre no es congeli cap era nova.</p>
<div class="taula">
<table>
<thead><tr><th>Data</th><th>Carril</th><th>Bossa</th><th>Clau</th><th>Var.</th><th>Paraula</th>${codis.map((codi) => `<th>${escapa(codi)}</th>`).join('')}<th>Notes</th></tr></thead>
<tbody>
${files.join('\n')}
</tbody>
</table>
</div>
${avisos.length ? `<h2>Avisos</h2>\n<ul>\n${avisos.map((avis) => `<li>${escapa(avis)}</li>`).join('\n')}\n</ul>` : ''}
</body>
</html>
`;
}

/** El JSON per a altres programes (el bot): el mateix que la taula, sense perdre res. */
export function jsonDeLaPrevisio({ dies, avisos }, desDe) {
    return { v: 1, des_de: desDe, dies, avisos };
}

// --------------------------------------------------------------- L'ordre

const AMB_VALOR_OPCIONAL = new Set(['--html', '--manuals']);
const AMB_VALOR = new Set(['--dies', '--des-de', '--dades']);

function llegirArguments(arguments_) {
    const opcions = { detall: false, json: false };
    for (let i = 0; i < arguments_.length; i++) {
        const argument = arguments_[i];
        if (argument === '--detall') opcions.detall = true;
        else if (argument === '--json') opcions.json = true;
        else if (AMB_VALOR.has(argument)) {
            if (i + 1 >= arguments_.length) throw new Error(`${argument} necessita un valor`);
            opcions[argument.slice(2)] = arguments_[++i];
        } else if (AMB_VALOR_OPCIONAL.has(argument)) {
            const seguent = arguments_[i + 1];
            opcions[argument.slice(2)] = seguent !== undefined && !seguent.startsWith('--') ? arguments_[++i] : true;
        } else throw new Error(`No entenc «${argument}»`);
    }

    if (opcions['des-de'] !== undefined && !esDataValida(opcions['des-de'])) {
        throw new Error(`«${opcions['des-de']}» no és una data AAAA-MM-DD`);
    }
    if (opcions.dies !== undefined) {
        const dies = Number(opcions.dies);
        if (!Number.isInteger(dies) || dies < 1 || dies > MAX_DIES) throw new Error(`--dies ha de ser un enter de 1 a ${MAX_DIES}`);
        opcions.dies = dies;
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
    const llegirJson = (nom, opcional = false) => {
        const cami = path.join(dades, nom);
        if (opcional && !fs.existsSync(cami)) return null;
        return JSON.parse(fs.readFileSync(cami, 'utf8'));
    };

    let eres;
    let index;
    let especials;
    let locals = [];
    try {
        eres = llegirJson('eres.json');
        index = llegirJson('index.json');
        especials = llegirJson('especials.json', true);
        if (opcions.manuals) {
            const cami = opcions.manuals === true ? MANUALS_EN_CLAR : opcions.manuals;
            locals = llegirManuals(JSON.parse(fs.readFileSync(cami, 'utf8')));
        }
    } catch (error) {
        console.error(`No puc llegir les dades: ${error.message}`);
        process.exit(1);
    }

    const memoria = new Map();
    const trobadesDe = (codi) => {
        if (!memoria.has(codi)) memoria.set(codi, llegirDialecte(fs.readFileSync(path.join(dades, `${codi}.txt`), 'utf8')));
        return memoria.get(codi);
    };

    const desDe = opcions['des-de'] || dataDAvui();
    const previsio = preveure({
        eres: eres.eres, index, especials, locals, desDe, dies: opcions.dies || DIES_PER_DEFECTE, trobadesDe,
    });
    const codis = Object.keys(index.dialectes);

    if (opcions.json) {
        process.stdout.write(`${JSON.stringify(jsonDeLaPrevisio(previsio, desDe))}\n`);
        return;
    }

    if (opcions.html) {
        const sortida = opcions.html === true ? HTML_PER_DEFECTE : opcions.html;
        const generat = new Intl.DateTimeFormat('ca-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date());
        fs.writeFileSync(sortida, paginaDeLaPrevisio(previsio, codis, { desDe, generat }));
        console.log(`Desada a ${path.relative(process.cwd(), sortida) || sortida}`);
        return;
    }

    console.log(textDeLaPrevisio(previsio, codis, { detall: opcions.detall }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
