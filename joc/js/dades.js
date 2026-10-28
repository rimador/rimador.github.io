// Carrega de les dades de rimes, i la gestio de versions que la governa.
//
// Les dades les genera joc/eines/generar_dades.py a partir del diccionari i de
// la rima de cada dialecte. Son SIS fitxers:
//
//   dades/versions.json   quins dialectes hi ha i el resum de cada fitxer (500 B)
//   dades/index.json      les claus jugables dels quatre dialectes i, de cada
//                         grup assonant, on comenca i quant ocupa (33 KB)
//   dades/<codi>.txt      totes les rimes d'un dialecte (7,6 MB; 1,9 comprimit)
//
// EL DIALECTE SENCER, UN SOL COP. Abans hi havia un fitxer per grup assonant
// (183 en total) i cada partida es baixava el seu: 145 KB de mitjana, pero
// cada partida en pagava un altre. Ara la primera partida paga 1,9 MB i les
// segents no paguen res; a partir de tretze ja hi surt guanyant. I el
// repositori passa de 189 fitxers a 6.
//
// PER NO INTERPRETAR 7,6 MB PER JUGAR AMB UN GRUP, el fitxer es guarda com a
// ArrayBuffer i l'index diu de cada grup on comenca i quant ocupa, en BYTES.
// Per partida nomes es descodifica i es parteix aquell tros, que es exactament
// el que abans era un fitxer sencer.
//
// LA GESTIO DE VERSIONS es la mateixa que la del diccionari (vegeu
// carregarVersions a js/script.js i diccionaris/python/versions.py): la versio
// de cada fitxer es un resum del seu contingut, i per tant canvia exactament
// quan el fitxer ha canviat. El versions.json no es cacheja mai; tota la resta
// es demana amb ?v=<resum> i per tant es pot cachejar per sempre.

// Relativa al MODUL i no pas a la pagina: aquest fitxer viu a joc/js/ i les
// dades a joc/dades/, i el freestyle.html, que el fa servir des de l'arrel del
// lloc, les demanaria a /dades/ amb una ruta relativa a la pagina. El ?v= de
// l'adreca del modul no hi arriba: la ruta relativa ja el treu.
const BASE = new URL('../dades/', import.meta.url).href;

// Els resums de l'ultima vegada que el versions.json es va llegir be. Fa mig
// quilobyte: hi cap de sobres al localStorage.
const CLAU_VERSIONS = 'rimador.joc.versions.v1';

// nom del fitxer -> resum del contingut
let VERSIONS = {};

let versionsPromesa = null;
let indexPromesa = null;
const dialectesEnMemoria = new Map();   // codi -> Promise<ArrayBuffer>
const grupsEnMemoria = new Map();       // "codi/grup" -> { seccions }

// Com va la descarrega de cada dialecte, per poder-ho ensenyar. La precarrega
// comenca a l'arrencada i qui premi "Comenca" enmig s'hi ha de poder enganxar,
// o sigui que l'estat es guarda i no nomes s'emet.
const progressos = new Map();   // codi -> { rebut, total }
const oients = new Map();       // codi -> Set<funcio>

function avisarProgres(codi, estat) {
    progressos.set(codi, estat);
    const escoltants = oients.get(codi);
    if (escoltants) for (const fn of escoltants) fn(estat);
}

/**
 * Seguir la descarrega d'un dialecte. Avisa de seguida amb el que se sap ara
 * (que pot ser res, si encara no ha comencat, o tot, si ja ha acabat) i despres
 * a cada tros. Torna una funcio per deixar d'escoltar.
 */
export function escoltarProgres(codi, fn) {
    if (!oients.has(codi)) oients.set(codi, new Set());
    oients.get(codi).add(fn);
    if (progressos.has(codi)) fn(progressos.get(codi));
    return () => {
        const escoltants = oients.get(codi);
        if (escoltants) escoltants.delete(fn);
    };
}

const descodificador = new TextDecoder('utf-8');

/**
 * L'adreca d'un fitxer de dades, amb la seva versio.
 *
 * Sense resum de confianca hi posem un valor sempre diferent, exactament pel
 * mateix motiu que el fetchFitxer de js/script.js: val mes baixar-lo altre cop
 * que servir una copia del navegador que podria ser d'una generacio anterior i
 * no quadrar amb la resta.
 */
function adreca(nom) {
    const versio = VERSIONS[nom];
    return `${BASE}${nom}?v=${versio || 't' + Date.now()}`;
}

/**
 * El versions.json: { generat, dialectes: [{codi, nom}], fitxers: {nom: resum} }.
 *
 * Es el fitxer que diu que hi ha, o sigui que es l'unic que no es pot cachejar
 * mai: va amb ?t= i prou.
 */
export function carregarVersions() {
    if (versionsPromesa) return versionsPromesa;

    versionsPromesa = fetch(`${BASE}versions.json?t=${Date.now()}`)
        .then((resposta) => {
            if (!resposta.ok) throw new Error(`versions.json: ${resposta.status}`);
            return resposta.json();
        })
        .then((dades) => {
            if (!dades.fitxers || !dades.dialectes) {
                throw new Error('versions.json no porta ni fitxers ni dialectes');
            }
            VERSIONS = dades.fitxers;
            try {
                localStorage.setItem(CLAU_VERSIONS, JSON.stringify(dades));
            } catch (error) {
                // Mode privat o disc ple: nomes vol dir que la propera visita
                // sense xarxa no tindra de que estirar.
            }
            return dades;
        })
        .catch((error) => {
            // Sense xarxa, o el servidor respon malament, o el fitxer ve
            // romput. Els resums de l'ultima vegada valen mes que no res: el
            // que el navegador tingui a la seva memoria cau es va demanar amb
            // AQUESTS resums, o sigui que donant-los per bons se serveix una
            // generacio sencera i coherent de les dades. Es el mateix rescat
            // que fa el carregarVersions de js/script.js.
            try {
                const desat = localStorage.getItem(CLAU_VERSIONS);
                if (desat) {
                    const dades = JSON.parse(desat);
                    VERSIONS = dades.fitxers || {};
                    console.warn('No s\'ha pogut llegir el versions.json: es fan servir els resums de l\'ultima vegada', error);
                    return dades;
                }
            } catch (error2) {
                // El localStorage no s'hi pot llegir o el que hi havia no es
                // JSON: es continua avall, com si no hi hagues hagut cap visita.
            }
            versionsPromesa = null;   // que es pugui tornar a provar
            throw error;
        });

    return versionsPromesa;
}

/**
 * L'index dels quatre dialectes:
 *   { min_rimes, dialectes: { ca: { grups: [[inici, llarg], ...],
 *                                   claus: [[clau, numeroDeGrup, objectius], ...] } } }
 */
export function carregarIndex() {
    if (!indexPromesa) {
        indexPromesa = carregarVersions()
            .then(() => fetch(adreca('index.json')))
            .then((resposta) => {
                if (!resposta.ok) throw new Error(`index.json: ${resposta.status}`);
                return resposta.json();
            })
            .catch((error) => {
                indexPromesa = null;
                throw error;
            });
    }
    return indexPromesa;
}

/**
 * El tros d'index d'un dialecte, que es el que fan servir objectius.js i
 * grupDeRimes. Torna { grups, claus }.
 */
export function indexDe(index, dialecte) {
    const tros = (index.dialectes || {})[dialecte];
    if (!tros) throw new Error(`L'index no te el dialecte "${dialecte}"`);
    return tros;
}

/**
 * El fitxer d'un dialecte, cru. Es guarda la PROMESA i no el resultat, de
 * manera que dues crides simultanies comparteixen la mateixa descarrega: la
 * precarrega de l'arrencada i la partida que es comenci mentre baixa no en fan
 * dues.
 */
export function carregarDialecte(dialecte) {
    if (dialectesEnMemoria.has(dialecte)) return dialectesEnMemoria.get(dialecte);

    const promesa = baixarDialecte(dialecte).catch((error) => {
        dialectesEnMemoria.delete(dialecte);
        progressos.delete(dialecte);
        throw error;
    });

    dialectesEnMemoria.set(dialecte, promesa);
    return promesa;
}

async function baixarDialecte(dialecte) {
    const nom = `${dialecte}.txt`;
    // L'index diu quant ha de fer el fitxer, i per aixo el demanem abans: es el
    // que permet dir un percentatge de debo (mira el comentari del "bytes" a
    // generar_dades.py). Tots dos son promeses guardades: no costa cap peticio.
    const index = await carregarIndex();
    const total = indexDe(index, dialecte).bytes || 0;

    avisarProgres(dialecte, { rebut: 0, total });
    const resposta = await fetch(adreca(nom));
    if (!resposta.ok) throw new Error(`${nom}: ${resposta.status}`);

    // Sense cos llegible (navegador antic, o alguna extensio pel mig) no es pot
    // seguir el progres, pero el fitxer s'ha de baixar igual.
    if (!resposta.body || !resposta.body.getReader) {
        const dades = await resposta.arrayBuffer();
        avisarProgres(dialecte, { rebut: dades.byteLength, total: dades.byteLength });
        return dades;
    }

    const lector = resposta.body.getReader();
    const trossos = [];
    let rebut = 0;
    for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        trossos.push(value);
        rebut += value.length;
        avisarProgres(dialecte, { rebut, total });
    }

    // Ajuntar-ho tot en un sol buffer, que es el que despres es talla per grups.
    const dades = new Uint8Array(rebut);
    let posicio = 0;
    for (const tros of trossos) {
        dades.set(tros, posicio);
        posicio += tros.length;
    }
    avisarProgres(dialecte, { rebut, total: rebut });
    return dades.buffer;
}

/**
 * Un grup assonant, ja repartit per seccions.
 * Torna { seccions: Map<clauConsonant, {paraules, objectius}> }.
 *
 * Es aqui on es paga el tall: es descodifica nomes el tros que diu l'index i es
 * parteix nomes aquell. El grup interpretat es guarda, que tornar a jugar amb
 * el mateix no ha de costar res.
 */
// ------------------------------------------- Les paraules del dia manuals

/**
 * El dades/diaries_manuals.json: les paraules del dia triades a ma per a dies
 * assenyalats (vegeu manualDelDia a objectius.js pel format). S'edita a ma i
 * per aixo no passa pel versions.json: va amb ?t= i no es cacheja mai, com la
 * classificacio. La darrera copia bona es conserva a localStorage per poder
 * aplicar les excepcions manuals sense xarxa.
 *
 * Si no es pot llegir, es fa servir la darrera copia bona. Si no n'hi ha cap,
 * es juga amb la roda de sempre i prou: val mes una paraula automatica que cap
 * paraula. La promesa es guarda, que la partida i la pantalla d'ahir la
 * demanen totes dues.
 */
let manualsPromesa = null;
const CLAU_MANUALS = 'rimador.joc.diaries-manuals.v1';

export function carregarDiariesManuals() {
    if (!manualsPromesa) {
        manualsPromesa = fetch(`${BASE}diaries_manuals.json?t=${Date.now()}`)
            .then((resposta) => {
                if (!resposta.ok) throw new Error(`diaries_manuals.json: ${resposta.status}`);
                return resposta.json();
            })
            .then((dades) => {
                const manuals = dades && typeof dades === 'object' ? dades : {};
                try {
                    localStorage.setItem(CLAU_MANUALS, JSON.stringify(manuals));
                } catch (error) {
                    // Mode privat o disc ple: la partida actual encara funciona.
                }
                return manuals;
            })
            .catch((error) => {
                try {
                    const desats = localStorage.getItem(CLAU_MANUALS);
                    if (desats) {
                        const manuals = JSON.parse(desats);
                        if (manuals && typeof manuals === 'object') {
                            console.warn("No s'ha pogut llegir el diaries_manuals.json: es fa servir la darrera copia", error);
                            return manuals;
                        }
                    }
                } catch (error2) {
                    // Es continua amb la roda si el localStorage no es pot llegir.
                }
                console.warn("No s'ha pogut llegir el diaries_manuals.json: es fa servir la roda", error);
                manualsPromesa = null;   // que es pugui tornar a provar
                return {};
            });
    }
    return manualsPromesa;
}

// El fitxer d'un dialecte descodificat sencer, per a trobarObjectiu. Nomes es
// paga el dia que hi ha paraula manual, i un sol cop per dialecte.
const textosEnMemoria = new Map();   // codi -> string

/**
 * On es una paraula dins del fitxer d'un dialecte, per a la paraula del dia
 * manual: torna { clau, grup, objectiu: { normalitzada, mostrar } } amb la
 * mateixa forma que paraulaDelDia, o null si no hi es.
 *
 * NOMES VAL SI ES PARAULA A RIMAR: la linia ha de dur "*" o "+" (vegeu el
 * format mes avall). Una forma verbal o una de l'apendix son al fitxer sense
 * marca i aqui no es troben, que es el que toca: no poden ser objectiu. Si
 * una paraula es a dues seccions (els homografs), es queda la primera.
 */
export async function trobarObjectiu(dialecte, normalitzada) {
    const [dades, index] = await Promise.all([carregarDialecte(dialecte), carregarIndex()]);
    let text = textosEnMemoria.get(dialecte);
    if (text === undefined) {
        text = descodificador.decode(new Uint8Array(dades));
        textosEnMemoria.set(dialecte, text);
    }

    const escapada = normalitzada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trobada = new RegExp(`^[*+]${escapada}(?:>(.*))?$`, 'm').exec(text);
    if (!trobada) return null;

    const capcalera = text.lastIndexOf('\n#', trobada.index);
    if (capcalera === -1) return null;
    const clau = text.slice(capcalera + 2, text.indexOf('\n', capcalera + 1));
    const entrada = indexDe(index, dialecte).claus.find((c) => c[0] === clau);
    if (!entrada) return null;

    return {
        clau,
        grup: entrada[1],
        objectiu: { normalitzada, mostrar: trobada[1] || normalitzada },
    };
}

export async function grupDeRimes(dialecte, numeroDeGrup) {
    const clau = `${dialecte}/${numeroDeGrup}`;
    if (grupsEnMemoria.has(clau)) return grupsEnMemoria.get(clau);

    const [dades, index] = await Promise.all([
        carregarDialecte(dialecte),
        carregarIndex(),
    ]);
    const grups = indexDe(index, dialecte).grups;
    const desplacament = grups[numeroDeGrup];
    if (!desplacament) throw new Error(`El dialecte "${dialecte}" no te el grup ${numeroDeGrup}`);

    const [inici, llarg] = desplacament;
    const grup = analitzar(descodificador.decode(new Uint8Array(dades, inici, llarg)));
    grupsEnMemoria.set(clau, grup);
    return grup;
}

// El format es una linia per paraula, amb capcaleres "#clau" que obren seccio.
// La primera lletra diu que en pots fer (vegeu generar_dades.py):
//
//   *paraula   pot ser OBJECTIU A TOTS ELS DIALECTES: la seva clau de rima te
//              entre min_rimes i max_rimes rimes als quatre. Es l'unica mena
//              que poden proposar la paraula del dia i l'il·limitat.
//   +paraula   objectiu NOMES al mode personalitzat, que es on el jugador es
//              tria la finestra i el dialecte va tancat dins de l'enllac.
//   paraula    nomes val com a RIMA: els verbs i tot l'apendix del dialecte.
//
// Si la forma real porta accents va despres d'un ">" ("cami>camí"); si no, la
// linia ja es la forma normalitzada. Aixi no hem de normalitzar res aqui.
//
// Cada seccio guarda:
//   paraules       -> Map<normalitzada, formaPerMostrar>  (totes: valen com a rima)
//   objectius      -> [normalitzada, ...]   les que poden sortir al personalitzat
//   objectiusArreu -> [normalitzada, ...]   les que poden sortir a tot arreu
function analitzar(text) {
    const seccions = new Map();
    let actual = null;

    for (let linia of text.split('\n')) {
        if (!linia) continue;
        if (linia.charCodeAt(0) === 35 /* # */) {
            actual = { paraules: new Map(), objectius: [], objectiusArreu: [] };
            seccions.set(linia.slice(1), actual);
            continue;
        }
        if (!actual) continue;

        const marca = linia.charCodeAt(0);
        const esArreu = marca === 42;          /* * */
        const esObjectiu = esArreu || marca === 43;   /* + */
        if (esObjectiu) linia = linia.slice(1);

        const tall = linia.indexOf('>');
        const normalitzada = tall === -1 ? linia : linia.slice(0, tall);
        const mostrar = tall === -1 ? linia : linia.slice(tall + 1);

        actual.paraules.set(normalitzada, mostrar);
        if (esObjectiu) actual.objectius.push(normalitzada);
        if (esArreu) actual.objectiusArreu.push(normalitzada);
    }

    return { seccions };
}

/**
 * Les respostes valides d'una partida: Map<normalitzada, formaPerMostrar>.
 * En facil, tot el grup assonant (o sigui, totes les seccions del grup).
 * En dificil, nomes la seccio de la clau consonant de la paraula objectiu.
 * Els verbs hi son inclosos: valen sempre com a rima.
 */
export function respostesValides(grup, clauConsonant, dificultat) {
    if (dificultat === 'dificil') {
        const seccio = grup.seccions.get(clauConsonant);
        if (!seccio) throw new Error(`No hi ha la seccio "${clauConsonant}"`);
        return new Map(seccio.paraules);
    }

    const totes = new Map();
    for (const seccio of grup.seccions.values()) {
        for (const [normalitzada, mostrar] of seccio.paraules) {
            totes.set(normalitzada, mostrar);
        }
    }
    return totes;
}
