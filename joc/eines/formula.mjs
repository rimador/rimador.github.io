// Pont entre els scripts de Python i la fórmula del joc.
//
// Python no té cap còpia de la fórmula de la paraula del dia: quan en necessita
// alguna cosa (l'estat de sortida d'una era, l'error d'un patró...) crida aquest
// script, que importa els mateixos mòduls que el navegador (joc/js/). Llegeix un
// JSON per l'entrada estàndard i n'escriu un altre per la sortida.
//
//   node joc/eines/formula.mjs estat-sortida   { era, final }
//       -> { dificil: {...}, facil: {...} }    estatDeSortida de cada carril
//   node joc/eines/formula.mjs estat-roda      { era, final }
//       -> estatDeLaRoda (només per a l'era 0)
//   node joc/eines/formula.mjs patro           { quotes }
//       -> { W, periode, errorMaxim }          el patró d'unes quotes
//   node joc/eines/formula.mjs primeres-dates  { eres, des_de, dies }
//       -> { "<era>:<carril>:<posició>": data }
//          el primer dia en què surt cada paraula (per la seva posició a
//          era.paraules) en els `dies` dies que van des de `des_de`, sense manuals
//
// `final` és el primer dia de l'era següent (AAAA-MM-DD), que no es compta a
// l'era que s'acaba.

import { CARRILS, estatDeSortida, estatDeLaRoda, parellaDelDia } from '../js/eres.js';
import { patroDeBosses, errorMaximDelPatro } from '../js/bosses.js';

function afegirDies(dataISO, dies) {
    const [any, mes, dia] = dataISO.split('-').map(Number);
    return new Date(Date.UTC(any, mes - 1, dia + dies)).toISOString().slice(0, 10);
}

async function llegirEntrada() {
    const trossos = [];
    for await (const tros of process.stdin) trossos.push(tros);
    return JSON.parse(Buffer.concat(trossos).toString('utf8'));
}

/** El període més curt del patró: el menor divisor de W pel qual es repeteix. */
function periodeDelPatro(patro) {
    for (let p = 1; p <= patro.W; p++) {
        if (patro.W % p !== 0) continue;
        let igual = true;
        for (let i = 0; i < patro.W && igual; i++) igual = patro.patro[i] === patro.patro[(i + p) % patro.W];
        if (igual) return p;
    }
    return patro.W;
}

const ORDRES = {
    'estat-sortida': ({ era, final }) => Object.fromEntries(
        CARRILS.map((carril) => [carril, estatDeSortida(era, carril, final)])),

    'estat-roda': ({ era, final }) => estatDeLaRoda(era, final),

    patro: ({ quotes }) => {
        const patro = patroDeBosses(quotes);
        return { W: patro.W, periode: periodeDelPatro(patro), errorMaxim: errorMaximDelPatro(patro) };
    },

    'primeres-dates': ({ eres, des_de: desDe, dies }) => {
        const primeres = {};
        for (let d = 0; d < dies; d++) {
            const data = afegirDies(desDe, d);
            const parella = parellaDelDia(eres, data);
            for (const carril of CARRILS) {
                const clau = `${parella[carril].era}:${carril}:${parella[carril].indexParaula}`;
                if (!(clau in primeres)) primeres[clau] = data;
            }
        }
        return primeres;
    },
};

const ordre = process.argv[2];
if (!ORDRES[ordre]) {
    console.error(`Ordre desconeguda «${ordre || ''}». Hi ha: ${Object.keys(ORDRES).join(', ')}`);
    process.exit(2);
}

try {
    const resultat = ORDRES[ordre](await llegirEntrada());
    process.stdout.write(JSON.stringify(resultat));
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
