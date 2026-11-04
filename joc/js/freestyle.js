// El freestyle: un generador de paraules per improvisar-hi rimes.
//
// LA IDEA. Qui fa freestyle demana paraules i hi improvisa. Aqui no hi ha cap
// camp de text ni cap puntuacio: cada X segons surt una paraula nova en gran,
// amb quantes paraules hi rimen a sota, i prou. Abans de comencar es tria el
// ritme (cada quants segons i quantes paraules, que diu quant durara) i de
// quina mena han de ser les paraules.
//
// NO TOCA RES DEL JOC: ni la classificacio, ni els records, ni l'adreca (a
// banda del ?d= del dialecte, com a tot arreu). Els ajustos es recorden en
// aquest navegador i prou.
//
// LES PARAULES SURTEN COM AL MODE PERSONALITZAT, i amb el mateix codi: els
// filtres (rima, agudes/planes/esdruixoles, minim i maxim de rimes) son els de
// opcionsDeRima, i la tira de paraules la fa rondesPersonalitzades amb una
// llavor nova a cada sessio. Aixo vol dir que NO ES REPETEIX CAP RIMA fins que
// s'han fet servir totes les que permeten els filtres, que es el que es vol
// quan has d'improvisar: deu paraules seguides que rimin igual no serien deu
// paraules.
//
// I POT NO TENIR FINAL. Amb "Sense limit de paraules", la sessio dura fins que
// l'aturis. Les paraules es demanen per tandes a rondesPersonalitzades, amb la
// mateixa signatura i el numero de tanda fent de numero de partida: la roda no
// es reinicia d'una tanda a l'altra (vegeu el comentari d'aquella funcio), o
// sigui que una sessio sense final tampoc no repeteix cap rima fins que les ha
// fet servir totes.
//
// EL ?v= DE LES IMPORTACIONS el reescriu el deploy.yml, com a la resta de
// moduls del joc (vegeu el comentari de dalt de principal.js).

import {
    carregarVersions, carregarIndex, carregarDialecte,
    grupDeRimes, respostesValides, escoltarProgres,
} from './dades.js?v=7c6003d';
import { marge, rondesPersonalitzades, triarParaula } from './objectius.js?v=7c6003d';
import { llavorNova } from './personalitzat.js?v=7c6003d';
import { formatarTemps } from './motor.js?v=7c6003d';
import * as ui from './ui.js?v=7c6003d';
import * as dialecte from './dialecte.js?v=7c6003d';

// Els limits del formulari. Dos segons per paraula ja es un ritme de batalla;
// mes de dos minuts ja no es freestyle, es escriure una canco.
const LIMITS = {
    segons: { min: 2, max: 120 },
    paraules: { min: 1, max: 200 },
    rimes: { min: 1 },
};

const PER_DEFECTE = {
    segons: 15,
    paraules: 6,
    // Cada mena de rima porta el seu marge, perque no vol dir el mateix:
    //  - consonant: de 50 a 1.000 rimes es una paraula amb prou companyes per
    //    improvisar-hi i sense arribar als temes mes comuns.
    //  - assonant: compta el grup sencer, i n'hi ha molt pocs (uns 100 per
    //    dialecte, repartits de dues rimes a desenes de milers). De 100 a 5.000
    //    en queden entre 30 i 50 per dialecte, i queden fora els petits, que
    //    gairebe no tenen rimes, i la desena de grups de mes de 10.000, que no
    //    son gaire mes que "tot el diccionari".
    rimes: {
        dificil: { min: 50, max: 1000 },
        facil: { min: 100, max: 5000 },
    },
    // Tambe per mena: en assonant les esdruixoles hi queden fora per defecte.
    accents: {
        dificil: [1, 2, 3],
        facil: [1, 2],
    },
    // En consonant, i no en assonant com el personalitzat: el numero de sota
    // la paraula ha de dir alguna cosa, i en assonant compta el grup sencer, que
    // va de centenars a desenes de milers.
    dificultat: 'dificil',
};

const MENES = ['dificil', 'facil'];

const ACCENTS_VALIDS = [1, 2, 3];

// De quantes en quantes es demanen les paraules a rondesPersonalitzades. Amb un
// nombre de paraules n'hi ha prou amb una tanda (fins a 200); sense limit, se
// n'afegeix una altra quan s'acaba.
const TANDA = 200;

// El 3, 2, 1 d'abans de la primera paraula: el temps de deixar el mobil i
// agafar el micro.
const COMPTE_ENRERE = 3;

// v3: el marge de rimes i els accents es desen a part per a cada mena
// (consonant i assonant) i amb uns valors per defecte nous; el que hi havia
// desat a la v2 no sabria de quina mena era.
const CLAU_AJUSTOS = 'rimador.joc.freestyle.v3';

// El mateix que a principal.js: amb el fitxer ja baixat, preparar la primera
// paraula son mil·lisegons i el loader seria una fuetada de pantalla.
const ESPERA_ABANS_DEL_LOADER = 150;

const DIALECTES_DE_RESERVA = [{ codi: dialecte.DIALECTE_PER_DEFECTE, nom: 'Central' }];

// Les vocals de les claus de rima. Ha de coincidir amb el VOCALS_DE_LA_CLAU de
// ui.js: la clau assonant es la consonant sense les consonants.
const VOCALS_DE_LA_CLAU = /[^aeiouɔəɛ]/g;

const estat = {
    dialecte: dialecte.DIALECTE_PER_DEFECTE,
    config: null,
};

// La sessio que corre (o l'ultima que ha corregut, per a la pantalla de final).
const sessio = {
    config: null,
    dialecte: null,
    index: null,
    signatura: '',
    seleccions: [],         // { clau, grup, aleatori } de cada paraula, per tandes
    preparades: [],         // Promise<{ objectiu, rimes, clau }>, a mesura que calen
    sortides: [],           // les que ja s'han ensenyat
    pas: -1,                // -1 = el compte enrere; 0.. = quina paraula es a la pantalla
    durada: 0,              // segons del pas que corre
    instantFinal: 0,
    restantsEnPausa: null,  // ms que li quedaven al pas; si no es null, esta en pausa
    temporitzador: null,
    enMarxa: false,
    avancant: false,        // esperant la paraula seguent (gairebe mai, i molt poc)
    compteVist: null,       // l'ultim numero del compte enrere que s'ha pintat
    fet: 0,                 // ms de les paraules que ja han marxat, pauses fora
};

let opcionsDificultat = null;
let marquesAccents = null;

// Mentre una sessio s'esta preparant (el loader, o el fitxer del dialecte que
// baixa), una segona crida a comencarSessio -un doble clic- deixaria dos
// intervals a la vegada, i nomes se'n podria aturar un.
let iniciant = false;

// ------------------------------------------------------------------- El DOM

const el = {};

const NOMS = [
    'pantalla-ajustos', 'pantalla-generador', 'pantalla-fi',
    'fs-segons', 'fs-paraules', 'fs-sense-limit', 'fs-durada', 'fs-dificultat',
    'fs-accents', 'fs-rimes-nota', 'fs-min', 'fs-max', 'fs-sense-sostre',
    'fs-recompte', 'fs-avis', 'fs-comencar',
    'fs-comptador', 'fs-seguent', 'fs-temps', 'fs-barra', 'fs-etiqueta',
    'fs-paraula', 'fs-pausa-rotul', 'fs-rimes', 'fs-locutor',
    'fs-pausa', 'fs-salta', 'fs-atura',
    'fs-fi-titol', 'fs-fi-total', 'fs-fi-text', 'fs-fi-llista', 'fs-una-altra',
    'fs-ajustos',
];

function aCamell(text) {
    return text.replace(/-([a-z])/g, (_, lletra) => lletra.toUpperCase());
}

const PANTALLES = ['ajustos', 'generador', 'fi'];

function mostrarPantalla(nom) {
    for (const pantalla of PANTALLES) {
        el[aCamell(`pantalla-${pantalla}`)].hidden = pantalla !== nom;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

function numero(n) {
    return n.toLocaleString('ca-ES');
}

// ------------------------------------------------------------------ Arrencada

for (const nom of NOMS) {
    el[aCamell(nom)] = document.getElementById(nom);
}
// El ui.js del joc pinta la tira de dialectes i el loader, que aqui porten els
// mateixos ids que al joc/index.html.
ui.preparar();

opcionsDificultat = ui.grupOpcions(el.fsDificultat, 'dificultat', () => refrescarAjustos());
marquesAccents = ui.grupMarques(el.fsAccents, 'accent', () => refrescarAjustos());

for (const camp of [el.fsSegons, el.fsParaules, el.fsMin, el.fsMax]) {
    camp.addEventListener('input', () => refrescarAjustos());
    // En marxar del camp, el formulari ensenya el que s'usara de debo: 500
    // segons passen a 120, i un maxim menor que el minim puja fins al minim.
    // Mentre s'escriu no es toca, que el camp passa per valors a mig fer.
    camp.addEventListener('change', () => omplirFormulari(estat.config));
}
el.fsSenseSostre.addEventListener('change', () => {
    const senseSostre = el.fsSenseSostre.checked;
    el.fsMax.disabled = senseSostre;
    // Tornant a posar sostre amb el camp buit, el maxim es quedaria infinit
    // sense que ho digues res: hi escrivim el de sempre (o el minim, si es mes).
    if (!senseSostre && el.fsMax.value === '') {
        el.fsMax.value = String(Math.max(
            PER_DEFECTE.rimes[estat.config.dificultat].max, estat.config.min));
    }
    refrescarAjustos();
});
el.fsSenseLimit.addEventListener('change', () => {
    const senseLimit = el.fsSenseLimit.checked;
    el.fsParaules.disabled = senseLimit;
    // El mateix que amb el maxim: tornar a posar limit amb el camp buit.
    if (!senseLimit && el.fsParaules.value === '') {
        el.fsParaules.value = String(PER_DEFECTE.paraules);
    }
    refrescarAjustos();
});

el.fsComencar.addEventListener('click', comencarSessio);
el.fsUnaAltra.addEventListener('click', comencarSessio);
el.fsAjustos.addEventListener('click', () => mostrarPantalla('ajustos'));
el.fsPausa.addEventListener('click', alternarPausa);
el.fsSalta.addEventListener('click', saltar);
el.fsAtura.addEventListener('click', aturar);

// Despres d'un clic de ratolí o de dit, el focus es queda al boto, i llavors
// l'espai tornaria a prémer-lo (saltant paraula, per exemple) en comptes de fer
// la pausa. El clic de teclat (detail 0) en conserva el focus, que qui navega
// amb teclat no el perdi.
for (const boto of [el.fsPausa, el.fsSalta, el.fsAtura]) {
    boto.addEventListener('click', (esdeveniment) => {
        if (esdeveniment.detail > 0) boto.blur();
    });
}

// Espai per fer pausa i fletxa dreta per saltar. Cap tecla atura la sessio: un
// Esc sense voler et deixava sense paraules enmig d'una improvisacio, i per
// aturar-la ja hi ha el boto.
document.addEventListener('keydown', (esdeveniment) => {
    if (!sessio.enMarxa || el.pantallaGenerador.hidden) return;
    // Amb ctrl, cmd o alt les tecles son del navegador (alt + fletxa dreta es
    // "endavant" a l'historial, per exemple).
    if (esdeveniment.ctrlKey || esdeveniment.metaKey || esdeveniment.altKey) return;
    // Damunt d'un boto, l'espai i el retorn ja el premen: si tambe els
    // agafessim aqui, la pausa s'activaria i es desactivaria d'una tirada.
    const objectiu = esdeveniment.target;
    const damuntDUnBoto = objectiu instanceof Element && objectiu.closest('button, a, input');
    if (esdeveniment.key === ' ' && !damuntDUnBoto) {
        esdeveniment.preventDefault();
        if (!esdeveniment.repeat) alternarPausa();
    } else if (esdeveniment.key === 'ArrowRight') {
        esdeveniment.preventDefault();
        saltar();
    }
});

// Si canvies de pestanya o s'apaga la pantalla, la sessio s'espera: les
// paraules no tenen gaire sentit si no les veu ningu. I el bloqueig de pantalla
// el treu el navegador tot sol quan la pagina s'amaga, o sigui que en tornar
// s'ha de demanar de nou.
document.addEventListener('visibilitychange', () => {
    if (!sessio.enMarxa) return;
    if (document.visibilityState === 'hidden') pausar();
    else mantenirPantallaEncesa();
});

// Els accents primer i la rima despres: seleccionar la rima dispara el refresc,
// i el refresc llegeix els botons dels accents tal com estiguin en aquell
// moment.
estat.config = llegirAjustosDesats();
omplirFormulari(estat.config);
marquesAccents.seleccionar(estat.config.accents);
opcionsDificultat.seleccionar(estat.config.dificultat);

arrencar();

/** Quins dialectes hi ha i quin es fa servir: el mateix que fa el joc. */
async function arrencar() {
    let dialectes = DIALECTES_DE_RESERVA;
    try {
        const versions = await carregarVersions();
        if (versions.dialectes && versions.dialectes.length > 0) {
            dialectes = versions.dialectes;
        }
    } catch (error) {
        console.warn('No s\'ha pogut llegir el versions.json: es fa servir el central', error);
    }

    ui.recordarNomsDeDialecte(dialectes);
    estat.dialecte = dialecte.inicial(dialectes.map((d) => d.codi));
    ui.pintarTiraDialectes(dialectes, estat.dialecte, triarDialecte);
    enllacDeLaMarca(estat.dialecte);

    // El fitxer del dialecte es comenca a baixar ara, mentre es toquen els
    // ajustos, perque quan es premi "Comenca" ja hi sigui (vegeu precarregar a
    // principal.js).
    carregarIndex().catch(() => {});
    carregarDialecte(estat.dialecte).catch(() => {});
    refrescarAjustos();
}

function triarDialecte(codi) {
    if (codi === estat.dialecte) return;

    estat.dialecte = codi;
    dialecte.desar(codi);
    dialecte.escriureALAdreca(codi);
    ui.marcarDialecte(codi);
    enllacDeLaMarca(codi);
    carregarDialecte(codi).catch(() => {});
    // Cada dialecte reparteix les paraules en rimes diferents: el recompte
    // s'ha de tornar a fer.
    refrescarAjustos();
}

/**
 * La marca de la capcalera torna a la pantalla d'ajustos, amb el dialecte que
 * s'esta fent servir, com l'enllacDePortada de ui.js fa amb la portada del joc:
 * qui ha arribat amb un ?d= d'algu altre no el te desat enlloc.
 */
function enllacDeLaMarca(codi) {
    ui.el.capcaleraMarca.setAttribute('href', `freestyle_beta.html?d=${encodeURIComponent(codi)}`);
}

// ------------------------------------------------------------------- Ajustos

function enterEntre(valor, limits, perDefecte) {
    // Un camp buit no es un zero (vegeu el mateix a personalitzat.js).
    if (valor === '' || valor === null || valor === undefined) return perDefecte;
    const enter = Math.round(Number(valor));
    if (!Number.isFinite(enter)) return perDefecte;
    if (enter < limits.min) return limits.min;
    if (limits.max !== undefined && enter > limits.max) return limits.max;
    return enter;
}

/**
 * El minim i el maxim de rimes d'una mena, amb un maxim que mai no sigui menor
 * que el minim. El maxim pot ser infinit: es desa com a null (el JSON no sap
 * que es l'Infinity) i aqui torna a ser infinit.
 */
function rimesNetes(cru, mena) {
    const dades = cru || {};
    const perDefecte = PER_DEFECTE.rimes[mena];
    const min = enterEntre(dades.min, LIMITS.rimes, perDefecte.min);
    const senseSostre = dades.max === Infinity || dades.max === null;
    const max = senseSostre
        ? Infinity
        : Math.max(min, enterEntre(dades.max, LIMITS.rimes, perDefecte.max));
    return { min, max };
}

/** Els accents d'una mena, ordenats i sense repetits; buits, els de sempre. */
function accentsNets(cru, mena) {
    const accents = ACCENTS_VALIDS.filter((a) => (cru || []).includes(a));
    return accents.length > 0 ? accents : PER_DEFECTE.accents[mena].slice();
}

/**
 * Deixa els ajustos en condicions, vinguin del formulari o del localStorage:
 * valors dins dels limits i accents sense repetits. El nombre de paraules
 * tambe pot ser infinit, amb el mateix null al JSON.
 *
 * El marge de rimes i els accents es recorden a part per a cada mena (`rimes` i
 * `accentsPerMena`), perque 50-1.000 en consonant i 100-5.000 en assonant no
 * tenen res a veure: canviar de mena posa els de l'altra, i tornar-hi recupera
 * el que havies triat. `min`, `max` i `accents` son els de la mena activa, i
 * son els que llegeix la resta del modul.
 */
function netejar(cru) {
    const dades = cru || {};
    const dificultat = dades.dificultat === 'facil' ? 'facil' : 'dificil';
    const senseLimit = dades.paraules === Infinity || dades.paraules === null;

    const rimes = {};
    for (const mena of MENES) rimes[mena] = rimesNetes((dades.rimes || {})[mena], mena);
    rimes[dificultat] = rimesNetes(dades, dificultat);

    const accentsPerMena = {};
    for (const mena of MENES) {
        accentsPerMena[mena] = accentsNets((dades.accentsPerMena || {})[mena], mena);
    }
    accentsPerMena[dificultat] = accentsNets(dades.accents, dificultat);

    return {
        segons: enterEntre(dades.segons, LIMITS.segons, PER_DEFECTE.segons),
        paraules: senseLimit
            ? Infinity
            : enterEntre(dades.paraules, LIMITS.paraules, PER_DEFECTE.paraules),
        min: rimes[dificultat].min,
        max: rimes[dificultat].max,
        rimes,
        accents: accentsPerMena[dificultat],
        accentsPerMena,
        dificultat,
    };
}

/**
 * Canvi de consonant a assonant (o al reves): el formulari passa a ensenyar el
 * marge d'aquella mena. Primer es desa el que hi havia escrit, que si no es
 * perdria.
 */
function canviarDeMena(dificultat) {
    const abans = netejar({
        ...estat.config, ...llegirFormulari(), accents: marquesAccents.valor(),
    });
    const { min, max } = abans.rimes[dificultat];
    estat.config = netejar({
        ...abans, dificultat, min, max, accents: abans.accentsPerMena[dificultat],
    });
    omplirFormulari(estat.config);
    marquesAccents.seleccionar(estat.config.accents);
}

function llegirAjustosDesats() {
    try {
        const desat = localStorage.getItem(CLAU_AJUSTOS);
        if (desat) return netejar(JSON.parse(desat));
    } catch (error) {
        // Mode privat, o el que hi havia no es JSON: els de sempre.
    }
    return netejar({ ...PER_DEFECTE, accents: PER_DEFECTE.accents[PER_DEFECTE.dificultat] });
}

function desarAjustos(config) {
    try {
        localStorage.setItem(CLAU_AJUSTOS, JSON.stringify(config));
    } catch (error) {
        // Sense memoria, la propera visita tornara a comencar pels de sempre.
    }
}

function omplirFormulari(config) {
    el.fsSegons.value = String(config.segons);
    el.fsSenseLimit.checked = config.paraules === Infinity;
    el.fsParaules.value = config.paraules === Infinity ? '' : String(config.paraules);
    el.fsParaules.disabled = config.paraules === Infinity;
    el.fsMin.value = String(config.min);
    el.fsSenseSostre.checked = config.max === Infinity;
    el.fsMax.value = config.max === Infinity ? '' : String(config.max);
    el.fsMax.disabled = config.max === Infinity;
}

/**
 * El que hi ha escrit al formulari. Els camps BUITS no s'hi posen, com a
 * llegirPersonalitzat de ui.js: mentre s'escriu un numero el camp passa per
 * buit, i el valor no ha de saltar al minim entremig.
 */
function llegirFormulari() {
    const dades = {};
    if (el.fsSegons.value !== '') dades.segons = el.fsSegons.value;
    if (el.fsSenseLimit.checked) dades.paraules = Infinity;
    else if (el.fsParaules.value !== '') dades.paraules = el.fsParaules.value;
    if (el.fsMin.value !== '') dades.min = el.fsMin.value;
    if (el.fsSenseSostre.checked) dades.max = Infinity;
    else if (el.fsMax.value !== '') dades.max = el.fsMax.value;
    return dades;
}

/**
 * "Quantes rimes te una paraula" vol dir aqui quantes ALTRES paraules hi
 * rimen, que es el numero que surt a sota de la paraula (el mateix
 * rimesPossibles de la partida). L'index, en canvi, compta les paraules de la
 * seccio, ella inclosa (el len(seccio) de joc/eines/generar_dades.py): amb un
 * minim de 30 i el filtre tal qual, sortien paraules amb "29 rimes". Per aixo
 * la finestra es desplaca un lloc amunt aqui, i el recompte es pinta un lloc
 * avall a pintarRecompte.
 */
function filtresDe(config) {
    return {
        dificultat: config.dificultat,
        accents: config.accents,
        min: config.min + 1,
        max: config.max === Infinity ? Infinity : config.max + 1,
    };
}

/** Torna a llegir el formulari i diu quant durara i quantes paraules hi ha. */
async function refrescarAjustos() {
    const dificultat = opcionsDificultat.valor();
    if (dificultat !== estat.config.dificultat) canviarDeMena(dificultat);

    const config = netejar({
        ...estat.config,
        ...llegirFormulari(),
        dificultat,
        accents: marquesAccents.valor(),
    });
    estat.config = config;
    pintarDurada(config);
    pintarNotaDeRimes(config.dificultat);

    try {
        const index = await carregarIndex();
        pintarRecompte(marge(index, estat.dialecte, filtresDe(config)), config);
    } catch (error) {
        // Sense index no es pot dir res del marge; el boto es queda actiu i, si
        // de debo no es pot preparar res, ja ho dira l'avis.
        pintarRecompte(null, config);
    }
}

/** "1 h 5 min", "2 min 30 s", "45 s". */
function durada(total) {
    const hores = Math.floor(total / 3600);
    const minuts = Math.floor((total % 3600) / 60);
    const segons = total % 60;
    const trossos = [];
    if (hores) trossos.push(`${hores} h`);
    if (minuts) trossos.push(`${minuts} min`);
    if (segons || trossos.length === 0) trossos.push(`${segons} s`);
    return trossos.join(' ');
}

function pintarDurada({ segons, paraules }) {
    if (paraules === Infinity) {
        const quan = document.createElement('strong');
        quan.textContent = "fins que l'aturis";
        el.fsDurada.replaceChildren(
            'La sessió durarà ', quan, ` (una paraula cada ${segons} s)`);
        return;
    }
    const total = document.createElement('strong');
    total.textContent = durada(segons * paraules);
    el.fsDurada.replaceChildren(
        'La sessió durarà ', total,
        ` (${paraules} ${paraules === 1 ? 'paraula' : 'paraules'} × ${segons} s)`,
    );
}

function pintarNotaDeRimes(dificultat) {
    el.fsRimesNota.textContent = dificultat === 'dificil'
        ? 'Quantes paraules han de rimar en consonant amb cada paraula que surti.'
        : 'En assonant compten totes les paraules del grup, o sigui que els números '
          + 'són molt més grossos que en consonant.';
}

/**
 * Quantes paraules hi ha amb els filtres d'ara, com al personalitzat (vegeu
 * pintarRecompte a ui.js): hi ha combinacions que no en donen cap, i val mes
 * veure-ho abans de premer el boto.
 */
function pintarRecompte(dades, config) {
    if (!dades) {
        el.fsRecompte.hidden = true;
        el.fsComencar.disabled = false;
        return;
    }

    const buit = dades.rimes === 0;
    el.fsRecompte.hidden = false;
    el.fsComencar.disabled = buit;
    el.fsRecompte.classList.toggle('recompte--buit', buit);

    if (buit) {
        el.fsRecompte.textContent =
            "Amb aquests filtres no hi ha cap paraula. Prova d'eixamplar el marge.";
        return;
    }
    const quines = config.dificultat === 'dificil' ? 'terminacions' : 'grups de rima';
    let text = `${numero(dades.rimes)} ${quines} · `
        + `${numero(dades.objectius)} paraules possibles · `
        + `de ${numero(dades.minRimes - 1)} a ${numero(dades.maxRimes - 1)} rimes cadascuna`;
    // No es cap error, pero s'ha de saber: quan s'acaben, la roda torna a
    // comencar (vegeu rondesPersonalitzades a objectius.js).
    if (config.paraules === Infinity) {
        text += config.dificultat === 'dificil'
            ? '. Quan hagin sortit totes les terminacions, tornaran a començar'
            : '. Quan hagin sortit tots els grups, tornaran a començar';
    } else if (config.paraules > dades.rimes) {
        text += `. Demanes més paraules que ${quines}: alguna rima es repetirà`;
    }
    el.fsRecompte.textContent = text;
}

// ------------------------------------------------------------------- Loader

/**
 * Una feina que pot haver d'esperar les rimes, amb el loader pel mig. Es el
 * mateix que ambCarregant de principal.js: si la feina s'acaba abans de
 * ESPERA_ABANS_DEL_LOADER, el loader no arriba a sortir.
 */
async function ambCarregant(codi, feina) {
    let progres = { rebut: 0, total: 0 };
    let visible = false;
    const deixarEscoltar = escoltarProgres(codi, (estatDescarrega) => {
        progres = estatDescarrega;
        if (visible) pintarProgres(progres);
    });

    const temporitzador = setTimeout(() => {
        visible = true;
        ui.mostrarCarregant(true);
        pintarProgres(progres);
    }, ESPERA_ABANS_DEL_LOADER);

    try {
        await feina();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    } finally {
        clearTimeout(temporitzador);
        ui.mostrarCarregant(false);
        deixarEscoltar();
    }
}

/**
 * Com va la descarrega. El progresCarregant de ui.js fa el mateix, pero diu
 * "Preparant la partida", i aqui no hi ha cap partida.
 */
function pintarProgres({ rebut, total }) {
    const baixant = total > 0 && rebut < total;
    const percentatge = baixant ? Math.max(0, Math.min(100, Math.round((rebut / total) * 100))) : 0;
    ui.el.carregantText.textContent = baixant
        ? `Baixant les rimes… ${percentatge} %`
        : 'Preparant les paraules…';
    ui.el.carregantBarra.hidden = !baixant;
    ui.el.carregantNota.hidden = !baixant;
    ui.el.carregantProgres.style.width = `${percentatge}%`;
}

// ------------------------------------------------------------------- Sessio

async function comencarSessio() {
    if (iniciant) return;
    iniciant = true;
    try {
        await engegarSessio();
    } finally {
        iniciant = false;
    }
}

async function engegarSessio() {
    aturarSessio();
    el.fsAvis.hidden = true;

    const config = estat.config;
    desarAjustos(config);

    const anatBe = await ambCarregant(estat.dialecte, async () => {
        sessio.index = await carregarIndex();
        sessio.config = config;
        sessio.dialecte = estat.dialecte;
        // Una llavor nova a cada sessio: les paraules no s'han de poder
        // repetir d'una sessio a l'altra, ni coincidir amb les de ningu.
        sessio.signatura = `freestyle|${llavorNova()}`;
        sessio.seleccions = [];
        sessio.preparades = [];
        sessio.sortides = [];
        // La primera, abans d'obrir la pantalla: es la que pot haver d'esperar
        // que baixi el fitxer del dialecte, i val mes que ho faci amb el loader.
        await prepararParaula(0);
    });

    if (!anatBe) {
        el.fsAvis.textContent = "No s'han pogut preparar les paraules. Comprova la connexió i torna-ho a provar.";
        el.fsAvis.hidden = false;
        mostrarPantalla('ajustos');
        return;
    }

    mostrarPantalla('generador');
    sessio.enMarxa = true;
    // Despres de l'enMarxa: si la sessio s'acaba abans que el navegador
    // contesti, mantenirPantallaEncesa ho veu i deixa anar el bloqueig.
    mantenirPantallaEncesa();
    sessio.compteVist = null;
    sessio.fet = 0;
    comencarPas(-1);
    // Cada 100 ms perque la barra no es vegi saltar; el temps de debo el marca
    // instantFinal, no pas el nombre de tics (com a la Partida de motor.js).
    clearInterval(sessio.temporitzador);
    sessio.temporitzador = setInterval(tic, 100);
}

/**
 * La paraula d'una posicio, amb quantes n'hi rimen. Es guarda la promesa, de
 * manera que demanar-la dues vegades no la tria dues vegades.
 *
 * Es van preparant d'una en una, la seguent mentre es veu l'actual: amb el
 * fitxer del dialecte a la memoria es cosa de mil·lisegons, pero preparar-les
 * totes de cop podria voler dir descodificar mig fitxer abans de comencar.
 */
function prepararParaula(posicio) {
    if (posicio >= sessio.config.paraules) return null;
    if (!sessio.preparades[posicio]) {
        const { clau, grup: numeroDeGrup, aleatori } = seleccioDe(posicio);
        const { dialecte: codi, config } = sessio;
        sessio.preparades[posicio] = grupDeRimes(codi, numeroDeGrup).then((grup) => {
            // El darrer "false", com al personalitzat: la finestra la tria qui
            // juga, o sigui que valen totes les paraules no verbals de la clau.
            const objectiu = triarParaula(grup, clau, aleatori, false);
            const respostes = respostesValides(grup, clau, config.dificultat);
            respostes.delete(objectiu.normalitzada);
            return { objectiu, rimes: respostes.size, clau };
        });
    }
    return sessio.preparades[posicio];
}

/**
 * Quina rima toca a una posicio. Es demanen per tandes de TANDA: la tanda fa
 * de numero de partida a rondesPersonalitzades, que compta la roda des de la
 * primera partida, o sigui que la tanda dos continua on s'havia quedat la u.
 * Llanca si amb els filtres no hi ha cap paraula.
 */
function seleccioDe(posicio) {
    while (posicio >= sessio.seleccions.length) {
        sessio.seleccions.push(...rondesPersonalitzades(sessio.index, sessio.dialecte, {
            ...filtresDe(sessio.config),
            rondes: TANDA,
            partida: sessio.seleccions.length / TANDA + 1,
            signatura: sessio.signatura,
        }));
    }
    return sessio.seleccions[posicio];
}

/**
 * `inici` es quan comenca el pas. Quan el temps s'acaba sol, es l'instant en
 * que havia d'acabar l'anterior, i no pas ara: el tic arriba fins a 100 ms
 * tard, i comptant des d'ara cada paraula durava 3,1 s en comptes de 3 i, en
 * una sessio de dues-centes, el retard s'anava sumant.
 *
 * Pero nomes si el retard es petit. Si el navegador ha deixat la pagina
 * aturada una bona estona (un mobil que va just, una pestanya al fons abans
 * que arribi el visibilitychange), recuperar el compte voldria dir passar les
 * paraules seguents en un no res: val mes comencar des d'ara.
 */
function comencarPas(pas, inici) {
    const ara = Date.now();
    sessio.pas = pas;
    sessio.durada = pas < 0 ? COMPTE_ENRERE : sessio.config.segons;
    sessio.instantFinal = (inici !== undefined && ara - inici < 1000 ? inici : ara)
        + sessio.durada * 1000;
    tic();
}

function tic() {
    if (!sessio.enMarxa || sessio.avancant || sessio.restantsEnPausa !== null) return;

    const restants = Math.max(0, (sessio.instantFinal - Date.now()) / 1000);
    pintarRellotges(restants);

    if (sessio.pas < 0) {
        const compte = Math.max(1, Math.ceil(restants));
        if (compte !== sessio.compteVist) {
            sessio.compteVist = compte;
            pintarCompteEnrere(compte);
        }
    }

    if (restants <= 0) avancar(sessio.instantFinal);
}

/** `inici`, el de comencarPas: sense, la paraula seguent compta des d'ara. */
async function avancar(inici) {
    const seguent = sessio.pas + 1;
    if (seguent >= sessio.config.paraules) {
        acabarSessio(true);
        return;
    }

    sessio.avancant = true;
    // Es llegeix ara, abans d'esperar la paraula seguent: es el moment en que
    // s'ha saltat (o en que s'ha acabat el temps).
    const quedava = quedavaAlPas();
    let paraula;
    try {
        paraula = await prepararParaula(seguent);
    } catch (error) {
        console.error(error);
        acabarSessio(false);
        return;
    }
    // L'han aturada mentre s'esperava.
    if (!sessio.enMarxa) return;
    sessio.avancant = false;
    comptarPas(quedava);
    sessio.restantsEnPausa = null;

    sessio.sortides.push(paraula);
    pintarParaula(paraula, seguent);
    comencarPas(seguent, inici);

    // I la de despres, que ja s'esperi a punt.
    const propera = prepararParaula(seguent + 1);
    if (propera) propera.catch(() => {});
}

function pausar() {
    if (!sessio.enMarxa || sessio.avancant || sessio.restantsEnPausa !== null) return;
    sessio.restantsEnPausa = Math.max(0, sessio.instantFinal - Date.now());
    pintarPausa(true);
}

function continuar() {
    if (!sessio.enMarxa || sessio.restantsEnPausa === null) return;
    sessio.instantFinal = Date.now() + sessio.restantsEnPausa;
    sessio.restantsEnPausa = null;
    pintarPausa(false);
    tic();
}

function alternarPausa() {
    if (sessio.restantsEnPausa === null) pausar();
    else continuar();
}

/** Passa a la paraula seguent ara mateix. En pausa, s'hi queda. */
async function saltar() {
    if (!sessio.enMarxa || sessio.avancant) return;
    const enPausa = sessio.restantsEnPausa !== null;
    // avancar ja treu la pausa, despres de llegir que li quedava a la paraula.
    await avancar();
    if (enPausa && sessio.enMarxa) pausar();
}

/** El boto d'aturar: si encara no ha sortit cap paraula, no hi ha res a resumir. */
function aturar() {
    if (sessio.sortides.length === 0) {
        aturarSessio();
        mostrarPantalla('ajustos');
        return;
    }
    acabarSessio(false);
}

function acabarSessio(completa) {
    // La paraula que hi havia a la pantalla tambe compta per al temps del final.
    comptarPas(quedavaAlPas());
    aturarSessio();
    pintarFi(completa);
    mostrarPantalla('fi');
}

function aturarSessio() {
    clearInterval(sessio.temporitzador);
    sessio.temporitzador = null;
    sessio.enMarxa = false;
    sessio.avancant = false;
    sessio.restantsEnPausa = null;
    pintarPausa(false);
    deixarAnarPantalla();
}

// --------------------------------------------------------- Pantalla encesa

// Al mobil, la pantalla s'apagaria enmig de la sessio: ningu no la toca,
// perque qui improvisa te les mans ocupades. On el navegador no ho sap fer
// (o no ho deixa, amb la bateria baixa), no passa res: es continua igual.
let bloqueigPantalla = null;

// El navegador contesta tard: la peticio d'abans de la sessio que s'acaba no
// pot quedar-se amb el bloqueig. Cada peticio porta un numero i deixarAnar
// l'avanca, de manera que les que encara volten ho saben quan arriben.
let peticioBloqueig = 0;

async function mantenirPantallaEncesa() {
    if (!('wakeLock' in navigator)) return;
    const meva = ++peticioBloqueig;
    try {
        const bloqueig = await navigator.wakeLock.request('screen');
        if (meva !== peticioBloqueig || !sessio.enMarxa) {
            bloqueig.release().catch(() => {});
            return;
        }
        // Un d'anterior ja el deixa anar, si en quedava (en tornar a la
        // pestanya, el navegador ja havia treta el seu).
        deixarAnarPantalla();
        bloqueigPantalla = bloqueig;
    } catch (error) {
        bloqueigPantalla = null;
    }
}

function deixarAnarPantalla() {
    peticioBloqueig++;
    if (!bloqueigPantalla) return;
    bloqueigPantalla.release().catch(() => {});
    bloqueigPantalla = null;
}

// ------------------------------------------------------------------ Pintar

/** Torna a engegar l'animacio d'entrada, encara que la paraula ja la tingues. */
function destacar(element) {
    element.classList.remove('objectiu--nova');
    void element.offsetWidth;
    element.classList.add('objectiu--nova');
}

/** "3/12" amb un nombre de paraules, i "3" sense limit. */
function pintarComptador(quantes) {
    const { paraules } = sessio.config;
    el.fsComptador.textContent = paraules === Infinity ? String(quantes) : `${quantes}/${paraules}`;
}

function pintarCompteEnrere(compte) {
    el.fsEtiqueta.textContent = "Prepara't";
    el.fsParaula.textContent = String(compte);
    el.fsParaula.style.setProperty('--lletres', '1');
    el.fsParaula.classList.add('objectiu--compte');
    el.fsRimes.hidden = true;
    pintarComptador(0);
    destacar(el.fsParaula);
}

/**
 * La paraula i, a sota, quantes n'hi rimen i amb quina terminacio, com a
 * pintarObjectiu de ui.js: «Hi ha 45 paraules que rimen amb \aðə\». En
 * assonant la terminacio es nomes la de les vocals, que es el que val.
 */
function pintarParaula({ objectiu, rimes, clau }, posicio) {
    el.fsEtiqueta.textContent = 'Rima amb';
    el.fsParaula.textContent = objectiu.mostrar;
    // Perque les llargues s'encongeixin en comptes de partir-se (vegeu
    // .objectiu--freestyle a joc.scss).
    el.fsParaula.style.setProperty('--lletres', String(objectiu.mostrar.length));
    el.fsParaula.classList.remove('objectiu--compte');
    destacar(el.fsParaula);

    const terminacio = sessio.config.dificultat === 'dificil'
        ? clau
        : clau.replace(VOCALS_DE_LA_CLAU, '');
    const compte = document.createElement('strong');
    compte.textContent = numero(rimes);
    // La transcripcio va a part perque no surti en negreta: la lletra fonetica
    // (la 'Rimador Fonetica' de css/fonts.scss) nomes te el pes normal, i en
    // negreta la "s" o la "ŋ" sortien gruixudes al costat d'una "ɛ" o una "ə"
    // primes. En pes normal es veu igual que al joc.
    const transcripcio = document.createElement('span');
    transcripcio.className = 'objectiu__terminacio';
    transcripcio.textContent = `\\${terminacio}\\`;
    el.fsRimes.replaceChildren(
        'Hi ha ', compte,
        ` ${rimes === 1 ? 'paraula que rima' : 'paraules que rimen'} amb `, transcripcio,
    );
    el.fsRimes.hidden = false;
    // Per als lectors de pantalla, que anuncien nomes aixo: la paraula i el
    // compte. El 3, 2, 1 i el rellotge canvien cada segon i no s'han de llegir.
    el.fsLocutor.textContent = `${objectiu.mostrar}: ${numero(rimes)} `
        + `${rimes === 1 ? 'paraula que rima' : 'paraules que rimen'}`;
    pintarComptador(posicio + 1);
}

/**
 * Els dos rellotges. La caixa del mig (i la barra) diu quants segons falten
 * perque canvii la paraula, tambe durant el 3, 2, 1. La de la dreta, quanta
 * estona fa que improvises: sense les pauses ni el compte enrere, i comptant
 * de debo les paraules saltades. Va amb floor i no pas amb el ceil de
 * formatarTemps, que comptant endavant faria sortir l'1 de seguida.
 */
function pintarRellotges(restants) {
    const { pas, durada: duradaDelPas } = sessio;
    el.fsBarra.style.width = `${Math.max(0, Math.min(100, (restants / duradaDelPas) * 100))}%`;
    el.fsSeguent.textContent = formatarTemps(restants);

    const alerta = pas >= 0 && restants <= Math.min(3, duradaDelPas / 3);
    el.fsBarra.classList.toggle('barra-temps__interior--alerta', alerta);
    el.fsSeguent.classList.toggle('marcador__valor--alerta', alerta);

    const fet = pas < 0 ? 0 : sessio.fet / 1000 + (duradaDelPas - restants);
    el.fsTemps.textContent = formatarTemps(Math.floor(fet));
}

/**
 * Suma a sessio.fet el que ha durat la paraula que hi ha a la pantalla: tota,
 * si el temps s'ha acabat sol, i un tros si s'ha saltat o s'ha aturat la
 * sessio. `quedava` son els ms que li faltaven; en pausa, els que s'hi van
 * desar.
 */
function comptarPas(quedava) {
    if (sessio.pas >= 0) sessio.fet += sessio.durada * 1000 - quedava;
}

function quedavaAlPas() {
    return sessio.restantsEnPausa !== null
        ? sessio.restantsEnPausa
        : Math.max(0, sessio.instantFinal - Date.now());
}

/**
 * En pausa no es veu la paraula, ni la terminacio de sota, que la delataria:
 * la pausa es per respirar, no per anar-hi pensant amb avantatge.
 */
function pintarPausa(enPausa) {
    // Sense aria-pressed: el text ja diu que fara el boto, i amb tots dos un
    // lector de pantalla llegiria "Continua, premut".
    el.fsPausa.textContent = enPausa ? 'Continua' : 'Pausa';
    el.fsPausaRotul.hidden = !enPausa;
    el.pantallaGenerador.classList.toggle('generador--pausa', enPausa);
}

/**
 * El ritme que has fet de debo. sessio.fet ja compta cada paraula pel que hi
 * has estat: una de saltada als 5 s en suma 5, no 15, i l'ultima d'una sessio
 * aturada, el que va durar. Per tant la mitjana es la de l'estona que has
 * improvisat, i quan no n'has saltat ni aturat cap surt exactament el ritme
 * triat, que es el que es diu sense "de mitjana".
 */
function ritmeReal(quantes, segonsTriats) {
    if (quantes === 0) return '';
    const mitjana = Math.round(sessio.fet / 1000 / quantes);
    return mitjana === segonsTriats
        ? `, una cada ${segonsTriats} s`
        : `, de mitjana una cada ${mitjana} s`;
}

function pintarFi(completa) {
    const { sortides, config, dialecte: codi } = sessio;
    const quantes = sortides.length;

    el.fsFiTitol.textContent = completa ? "S'ha acabat!" : 'Sessió aturada';
    el.fsFiTotal.textContent = numero(quantes);
    el.fsFiText.textContent = `${quantes === 1 ? 'paraula' : 'paraules'} en `
        + `${durada(Math.round(sessio.fet / 1000))}${ritmeReal(quantes, config.segons)}`;

    // Cada paraula, sencera, es un enllac al cercador amb totes les seves rimes:
    // el mateix dialecte i la mateixa mena de rima que la sessio, en una
    // pestanya nova perque no es perdi la llista (vegeu enllacDeRimes a ui.js).
    // L'arrel del lloc es "./": la pagina penja de l'arrel, no pas de joc/.
    el.fsFiLlista.replaceChildren(...sortides.map(({ objectiu, rimes }) => {
        const enllac = ui.enllacDeRimes(objectiu.mostrar, {
            objectiu: objectiu.mostrar, dialecte: codi, dificultat: config.dificultat,
            arrel: './',
        });
        const rimesText = document.createElement('span');
        rimesText.className = 'trobades__rimes';
        rimesText.textContent = `${numero(rimes)} ${rimes === 1 ? 'rima' : 'rimes'}`;
        enllac.append(rimesText);

        const fila = document.createElement('li');
        fila.append(enllac);
        return fila;
    }));
}
