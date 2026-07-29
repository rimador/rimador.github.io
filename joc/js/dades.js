// Carrega de les dades de rimes.
//
// Les dades les genera joc/eines/generar_dades.py a partir del diccionari gran.
// El diccionari sencer fa 46 MB i la web principal se'l carrega tot; el joc no
// s'ho pot permetre, o sigui que descarrega nomes el que fa falta:
//
//   dades/index.json   -> 599 claus de rima consonant jugables (uns 20 KB)
//   dades/rimes/N.txt  -> el grup de rimes de la partida (70 KB de mediana)
//
// Com que la clau consonant sempre implica la mateixa clau assonant, un sol
// fitxer serveix les dues dificultats: en facil valen totes les paraules del
// fitxer i en dificil nomes les de la seccio de la paraula objectiu.

const BASE = 'dades/';
const VERSIO_CACHE = '1';

let indexPromesa = null;
const fitxersEnMemoria = new Map();

/**
 * L'index de claus jugables.
 * Cada clau: [clauConsonant, numeroDeFitxer, rimesConsonants, rimesAssonants]
 */
export function carregarIndex() {
    if (!indexPromesa) {
        indexPromesa = fetch(`${BASE}index.json?v=${VERSIO_CACHE}`)
            .then((resposta) => {
                if (!resposta.ok) throw new Error(`index.json: ${resposta.status}`);
                return resposta.json();
            })
            .catch((error) => {
                indexPromesa = null;   // que es pugui tornar a provar
                throw error;
            });
    }
    return indexPromesa;
}

/**
 * Un fitxer de rimes, ja repartit per seccions.
 * Torna { seccions: Map<clauConsonant, Map<normalitzada, mostrar>> }.
 */
export async function carregarFitxerDeRimes(numero) {
    if (fitxersEnMemoria.has(numero)) return fitxersEnMemoria.get(numero);

    const promesa = fetch(`${BASE}rimes/${numero}.txt?v=${VERSIO_CACHE}`)
        .then((resposta) => {
            if (!resposta.ok) throw new Error(`rimes/${numero}.txt: ${resposta.status}`);
            return resposta.text();
        })
        .then(analitzar)
        .catch((error) => {
            fitxersEnMemoria.delete(numero);
            throw error;
        });

    fitxersEnMemoria.set(numero, promesa);
    return promesa;
}

// El format es una linia per paraula, amb capcaleres "#clau" que obren seccio.
// Un "*" al davant marca les paraules que poden ser OBJECTIU (no son verbs); la
// resta nomes valen com a rima. Si la forma real porta accents va despres d'un
// ">" ("cami>camí"); si no, la linia ja es la forma normalitzada. Aixi no hem de
// normalitzar res aqui.
//
// Cada seccio guarda:
//   paraules  -> Map<normalitzada, formaPerMostrar>  (totes: valen com a rima)
//   objectius -> [normalitzada, ...]                  (nomes les que poden sortir)
function analitzar(text) {
    const seccions = new Map();
    let actual = null;

    for (let linia of text.split('\n')) {
        if (!linia) continue;
        if (linia.charCodeAt(0) === 35 /* # */) {
            actual = { paraules: new Map(), objectius: [] };
            seccions.set(linia.slice(1), actual);
            continue;
        }
        if (!actual) continue;

        const esObjectiu = linia.charCodeAt(0) === 42; /* * */
        if (esObjectiu) linia = linia.slice(1);

        const tall = linia.indexOf('>');
        const normalitzada = tall === -1 ? linia : linia.slice(0, tall);
        const mostrar = tall === -1 ? linia : linia.slice(tall + 1);

        actual.paraules.set(normalitzada, mostrar);
        if (esObjectiu) actual.objectius.push(normalitzada);
    }

    return { seccions };
}

/**
 * Les respostes valides d'una partida: Map<normalitzada, formaPerMostrar>.
 * En facil, tot el grup assonant (o sigui, totes les seccions del fitxer).
 * En dificil, nomes la seccio de la clau consonant de la paraula objectiu.
 * Els verbs hi son inclosos: valen sempre com a rima.
 */
export function respostesValides(fitxer, clauConsonant, dificultat) {
    if (dificultat === 'dificil') {
        const seccio = fitxer.seccions.get(clauConsonant);
        if (!seccio) throw new Error(`No hi ha la seccio "${clauConsonant}"`);
        return new Map(seccio.paraules);
    }

    const totes = new Map();
    for (const seccio of fitxer.seccions.values()) {
        for (const [normalitzada, mostrar] of seccio.paraules) {
            totes.set(normalitzada, mostrar);
        }
    }
    return totes;
}
