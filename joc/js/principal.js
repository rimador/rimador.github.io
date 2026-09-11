// Fil conductor del joc: enllaça les pantalles amb el motor i amb les dades.
//
// EL ?v=dev DE LES IMPORTACIONS no és cap error: el deploy.yml el substitueix
// pels set primers caràcters del commit, igual que fa amb els ?v= dels HTML.
// Ha d'anar a cada importació perquè les importacions entre mòduls no hereten
// res de l'etiqueta <script> que carrega aquest fitxer: sense el ?v=, refrescar
// principal.js deixava els altres vuit mòduls a la memòria cau del navegador i
// es barrejaven versions.

import {
    carregarVersions, carregarIndex, carregarDialecte,
    grupDeRimes, respostesValides, escoltarProgres,
    carregarDiariesManuals, trobarObjectiu,
} from './dades.js?v=3b520f9';
import {
    clauAleatoria, paraulaDelDia, manualDelDia, triarParaula,
    marge, rondesPersonalitzades,
} from './objectius.js?v=3b520f9';
import * as personalitzat from './personalitzat.js?v=3b520f9';
import { Partida, RESULTAT, formatarTemps } from './motor.js?v=3b520f9';
import * as ui from './ui.js?v=3b520f9';
import * as dialecte from './dialecte.js?v=3b520f9';
import {
    avui, ahir, identificadorRecord, llegirRecord, desarRecord,
    resultatDiari, dificultatsJugades, desarResultatDiari,
    llegirTotsElsRecords, llegirSobrenom, desarSobrenom,
} from './magatzem.js?v=3b520f9';
import {
    textPerCompartir, textPersonalitzat, compartirResultat, copiar, enllacDeTwitter,
} from './compartir.js?v=3b520f9';
import {
    validarSobrenom, enviarPuntuacio, estaConfigurat,
    carregarClassificacio, nomsOcupats, enviarPendents, quantesPendents,
} from './classificacio.js?v=3b520f9';
import {
    estadistiquesDe, estadistiquesDelDia, ranquingDelDia,
} from './estadistiques.js?v=3b520f9';

const SEGONS_DIARIA = 60;
const NOM_DIFICULTAT = { facil: 'fàcil', dificil: 'difícil' };
const NOM_ACCENT = { 1: 'agudes', 2: 'planes', 3: 'esdrúixoles' };

// Si el versions.json no es pot llegir, el joc encara ha de poder-se jugar en
// central, que és el que hi havia abans que se'n pogués triar cap.
const DIALECTES_DE_RESERVA = [{ codi: dialecte.DIALECTE_PER_DEFECTE, nom: 'Central' }];

const estat = {
    mode: 'illimitat',
    dificultat: 'facil',
    segons: 60,
    dialecte: dialecte.DIALECTE_PER_DEFECTE,
    partida: null,
    ultimEnviament: null,
    // El text de compartir es fa un sol cop, en acabar la partida, i el fan
    // servir tant el boto de compartir com el de piular: aixi no poden dir dues
    // coses diferents, i no depen de si mentrestant s'ha tocat el dialecte o la
    // dificultat a la pantalla de configuracio. A null, no hi ha res a
    // compartir (nomes en te la paraula del dia).
    textCompartir: null,
    data: avui(),
};

let dialectes = DIALECTES_DE_RESERVA;
let opcionsDificultat = null;
let opcionsTemps = null;
let opcionsPvpDificultat = null;
let marquesPvpAccents = null;

// ------------------------------------------------------------------ Arrencada

ui.preparar();
opcionsDificultat = ui.grupOpcions(ui.el.opcionsDificultat, 'dificultat', (valor) => {
    estat.dificultat = valor;
    refrescarConfig();
});
opcionsTemps = ui.grupOpcions(ui.el.opcionsTemps, 'segons', (valor) => {
    estat.segons = Number(valor);
    refrescarConfig();
});
opcionsPvpDificultat = ui.grupOpcions(ui.el.persDificultat, 'dificultat', () => {
    refrescarPersonalitzat();
});
marquesPvpAccents = ui.grupMarques(ui.el.persAccents, 'accent', () => {
    refrescarPersonalitzat();
});

for (const boto of document.querySelectorAll('[data-mode]')) {
    boto.addEventListener('click', () => obrirConfig(boto.dataset.mode));
}
for (const boto of document.querySelectorAll('[data-accio="inici"]')) {
    boto.addEventListener('click', tornarAInici);
}
for (const boto of document.querySelectorAll('[data-vista]')) {
    boto.addEventListener('click', () => obrirVista(boto.dataset.vista));
}
for (const boto of document.querySelectorAll('.pestanya')) {
    boto.addEventListener('click', () => canviarPestanya(boto.dataset.taula));
}

ui.el.botoComencar.addEventListener('click', comencarPartida);
ui.el.botoRepetir.addEventListener('click', comencarPartida);
ui.el.botoCompartir.addEventListener('click', compartir);
for (const boto of document.querySelectorAll('[data-accio="personalitzat"]')) {
    boto.addEventListener('click', obrirPersonalitzat);
}
for (const camp of [ui.el.persMin, ui.el.persMax, ui.el.persSegons, ui.el.persRondes]) {
    camp.addEventListener('input', refrescarPersonalitzat);
}
ui.el.persSenseSostre.addEventListener('change', () => {
    ui.sostreActiu(ui.el.persSenseSostre.checked);
    refrescarPersonalitzat();
});
ui.el.persCrear.addEventListener('click', crearPartidaPersonalitzada);
ui.el.convitCopiar.addEventListener('click', copiarEnllac);
ui.el.convitComencar.addEventListener('click', comencarPartidaPersonalitzada);
ui.el.rondaSeguent.addEventListener('click', seguentRonda);
ui.el.resumUnaAltra.addEventListener('click', unaAltraPersonalitzada);
ui.el.resumCompartir.addEventListener('click', compartirPersonalitzat);

ui.el.botoCanviarSobrenom.addEventListener('click', () => refrescarJugador(true));
ui.el.botoDesarSobrenom.addEventListener('click', desarNouSobrenom);
ui.el.campSobrenom.addEventListener('keydown', (esdeveniment) => {
    // El camp no és dins de cap <form>: la tecla de retorn no desa res tota
    // sola i, en una pantalla que acaba amb un botó gran de "Comença", deixar-la
    // morta és el camí curt per pensar-se que el nom ja s'ha desat.
    if (esdeveniment.key === 'Enter') {
        esdeveniment.preventDefault();
        desarNouSobrenom();
    }
});
ui.el.formulari.addEventListener('submit', enviarParaula);
// El formulari ja s'envia sol amb la tecla de retorn, pero ho deixem explicit
// com a js/cerca.js: hi ha teclats de mobil que no disparen l'enviament implicit.
ui.el.camp.addEventListener('keydown', (esdeveniment) => {
    if (esdeveniment.key === 'Enter') enviarParaula(esdeveniment);
});

// Les puntuacions que van quedar sense poder pujar (vegeu enviarPendents a
// classificacio.js): quan torna la connexio, i tambe en obrir el joc, que es
// l'altre moment en que la xarxa pot haver tornat sense que ho haguem vist.
window.addEventListener('online', () => {
    enviarPendents().then(avisarDePendents);
});

arrencar();

/**
 * Quins dialectes hi ha i quin es juga. Ho diu dades/versions.json, que és
 * petit i el volem a punt abans que ningú premi cap botó; l'índex del dialecte
 * triat, tot seguit, pel mateix motiu.
 */
async function arrencar() {
    try {
        const versions = await carregarVersions();
        if (versions.dialectes && versions.dialectes.length > 0) {
            dialectes = versions.dialectes;
        }
    } catch (error) {
        console.warn('No s\'ha pogut llegir el versions.json: es juga en central', error);
    }

    const codis = dialectes.map((d) => d.codi);
    ui.recordarNomsDeDialecte(dialectes);
    estat.dialecte = dialecte.inicial(codis);

    // Qui arriba amb un enllaç de partida personalitzada juga en el dialecte
    // que digui l'enllaç, i no pas en el seu: si no, tindria les mateixes
    // paraules però unes altres rimes vàlides, i els resultats no es podrien
    // comparar. És la raó per la qual el dialecte va dins de la signatura.
    const convit = personalitzat.llegirDeLAdreca();
    if (convit && codis.includes(convit.dialecte)) estat.dialecte = convit.dialecte;

    ui.pintarTiraDialectes(dialectes, estat.dialecte, triarDialecte);
    ui.enllacDePortada(estat.dialecte);

    refrescarInici();
    precarregar(estat.dialecte);

    // Si l'ultima visita va quedar cap puntuacio per enviar, ara es el moment.
    enviarPendents().catch(() => {});

    if (convit) {
        pvp.config = convit;
        pvp.config.signatura = personalitzat.signaturaDe(pvp.config);
        pintarConvit();
        ui.mostrarPantalla('convit');
    }
}

/**
 * L'índex i el fitxer del dialecte, demanats sense esperar-los.
 *
 * El fitxer fa 1,9 MB comprimits i és el que abans es baixava per trossos. Es
 * comença ara, mentre l'usuari llegeix el menú i tria mode i rellotge, perquè
 * quan premi "Comença" ja hi sigui. Si encara no hi és, la partida l'esperarà
 * igualment: carregarDialecte guarda la promesa i no en fa dues descàrregues.
 */
function precarregar(codi) {
    carregarIndex().catch(() => {});
    carregarDialecte(codi).catch(() => {});
    carregarDiariesManuals().catch(() => {});
    // I la classificació, que fa set quilobytes i és el que la pantalla de
    // final necessita per dir-te el percentil i la mitjana sense fer-te
    // esperar. Es demana un sol cop (la promesa es guarda a classificacio.js).
    carregarClassificacio().then((dades) => { classificacio = dades; }).catch(() => {});
}

// ------------------------------------------------------------------ Dialecte

function triarDialecte(codi) {
    if (codi === estat.dialecte) return;

    estat.dialecte = codi;
    // Només ho desa la tira: el dialecte que arriba per l'adreça val per a
    // aquella visita i prou (vegeu dialecte.js).
    dialecte.desar(codi);
    dialecte.escriureALAdreca(codi);
    ui.marcarDialecte(codi);

    // La paraula del dia és la mateixa a tot arreu, però els rècords van per
    // dialecte: el que la pantalla en diu s'ha de tornar a mirar.
    refrescarInici();
    ui.enllacDePortada(codi);
    // I el fitxer del dialecte nou, a punt per quan comenci la partida.
    precarregar(codi);
}

// ------------------------------------------------------------------ Pantalles

function refrescarInici() {
    estat.data = avui();
    const jugades = dificultatsJugades(estat.data);
    const etiqueta = ui.el.etiquetaDiaria;

    if (jugades.length === 0) {
        etiqueta.hidden = true;
        return;
    }
    etiqueta.hidden = false;
    etiqueta.textContent = jugades.length === 2
        ? 'Avui ja l\'has jugada en totes dues dificultats'
        : `Avui ja l'has jugada en ${NOM_DIFICULTAT[jugades[0]]}`;
}

function tornarAInici() {
    aturarPartida();
    refrescarInici();
    clearInterval(intervalCompteEnrere); // NOU
    // L'adreça torna a ser la de sempre: si no, refrescar la pàgina et tornaria
    // a obrir el convit d'una partida que ja has deixat.
    personalitzat.esborrarDeLAdreca();
    ui.mostrarPantalla('inici');
}

function obrirVista(vista) {
    if (vista === 'records') obrirRecords();
    else if (vista === 'classificacio') obrirClassificacio();
    else if (vista === 'ahir') obrirAhir();
    else if (vista === 'personalitzat') obrirPersonalitzat();
}

// ------------------------------------------------------------- Com va anar ahir

// Quina dificultat s'està mirant a la pantalla d'ahir. Per defecte, la que
// jugues: és la que et deus voler mirar.
let dificultatAhir = null;

/**
 * La pantalla d'ahir. Existeix per tancar el forat de la paraula del dia: el
 * classificacio.json es recompila un cop al dia, o sigui que de la paraula
 * d'AVUI no se'n pot saber res fins l'endemà, mentre que la d'ahir ja hi és
 * sencera (qui la va fer millor i quantes rimes en va treure la gent).
 *
 * La paraula la calculem aquí mateix amb la mateixa roda de sempre, en comptes
 * de treure-la del rànquing: així hi surt encara que ahir no hi jugués ningú.
 */
async function obrirAhir() {
    if (dificultatAhir === null) dificultatAhir = estat.dificultat;
    const dia = ahir();

    ui.mostrarPantalla('ahir');
    ui.pintarAhir({ dia, dificultat: dificultatAhir, paraula: '…', resum: null, top: [] },
                  llegirSobrenom());

    async function mostrar() {
        ui.pintarDificultatAhir(dificultatAhir, (dificultat) => {
            dificultatAhir = dificultat;
            mostrar();
        });

        let paraula = '';
        try {
            paraula = (await seleccioDelDia(dia, dificultatAhir)).objectiu.mostrar;
        } catch (error) {
            // Sense les rimes baixades no es pot saber quina paraula tocava; la
            // resta de la pantalla (el rànquing, la mitjana) sí que es pot
            // ensenyar, i val més això que no pas una pantalla d'error.
            console.warn("No s'ha pogut calcular la paraula d'ahir", error);
        }

        try {
            classificacio = await carregarClassificacio();
        } catch (error) {
            classificacio = classificacio || null;
        }

        ui.pintarAhir({
            dia,
            dificultat: dificultatAhir,
            paraula,
            resum: estadistiquesDelDia(classificacio, dia, dificultatAhir),
            top: ranquingDelDia(classificacio, dia, dificultatAhir),
        }, llegirSobrenom());
    }

    mostrar();
}

// ------------------------------------------------------------- Els meus rècords

function obrirRecords() {
    ui.pintarRecords(llegirTotsElsRecords());
    ui.mostrarPantalla('records');
}

// ------------------------------------------------------------- Classificació

/**
 * La modalitat de la classificació NO du el dialecte, a diferència de
 * l'identificadorRecord dels rècords personals: la classificació és una de sola
 * per modalitat i el dialecte es diu a cada fila (vegeu subtitolEntrada a ui.js).
 */
function modalitatDe({ mode, dificultat, segons }) {
    return `${mode}|${dificultat}|${segons}`;
}

/** El mateix ordre que les opcions de la pantalla de configuració. */
const ORDRE_DIFICULTAT = ['facil', 'dificil'];

let modalitatActiva = null;
let diaActiu = null;
let dificultatDiaria = null;
let pestanyaActiva = 'modalitats';
let classificacio = null;

async function obrirClassificacio() {
    ui.mostrarPantalla('classificacio');
    ui.el.classificacioData.textContent = '';
    ui.el.classificacioSelector.replaceChildren();
    ui.estatClassificacio('Carregant la classificació…');

    try {
        classificacio = await carregarClassificacio();
    } catch (error) {
        ui.estatClassificacio('No s\'ha pogut carregar la classificació. Torna-ho a provar més tard.');
        return;
    }

    ui.el.classificacioData.textContent = classificacio.actualitzacio
        ? `Última actualització: ${classificacio.actualitzacio} (s'actualitza 1 cop al dia, de matinada)`
        : '';
    pintarPestanyaActiva();
}

function canviarPestanya(quina) {
    pestanyaActiva = quina;
    if (classificacio) pintarPestanyaActiva();
}

function pintarPestanyaActiva() {
    ui.marcarPestanya(pestanyaActiva);
    ui.subtitolClassificacio(
        'Les millors puntuacions de tota la gent que hi juga, jugui en el '
        + 'dialecte que jugui.');

    if (pestanyaActiva === 'diaria') pintarDiaria();
    else pintarModalitats();
}

/**
 * Les modalitats d'il·limitat, juguin en el dialecte que juguin. La paraula del
 * dia no hi surt: té la seva pestanya, i barrejar-hi partides d'un minut amb un
 * sol intent al dia no comparava res.
 */
function pintarModalitats() {
    ui.amagarSelectorDificultat();

    const modalitats = Object.entries(classificacio.modalitats || {})
        .filter(([clau]) => clau.startsWith('illimitat|'))
        // La pestanya ja diu "Il·limitat": repetir-ho a cada pastilla només
        // faria més estret el que de debò les distingeix.
        .map(([clau, valor]) => ({
            clau,
            dificultat: clau.split('|')[1],
            segons: Number(clau.split('|')[2]),
            titol: (valor.titol || '').replace(/^Il·limitat · /, ''),
            top: valor.top || [],
        }))
        .filter((m) => m.top.length > 0);

    if (modalitats.length === 0) {
        ui.el.classificacioSelector.replaceChildren();
        ui.estatClassificacio(estaConfigurat()
            ? 'Encara no hi ha cap partida il·limitada. Sigues el primer!'
            : 'La classificació encara no està activada en aquest lloc.');
        return;
    }

    // Una fila de pastilles per dificultat i, dins de cada fila, del rellotge
    // més ràpid al més lent. L'ordre de les claus del JSON és el de la cadena
    // ("180" abans que "45"), que no vol dir res, i les sis pastilles seguides
    // no deixaven veure on s'acabava una dificultat i on començava l'altra.
    const grups = ORDRE_DIFICULTAT
        .map((dificultat) => ({
            dificultat,
            modalitats: modalitats
                .filter((m) => m.dificultat === dificultat)
                .sort((a, b) => a.segons - b.segons),
        }))
        .filter((grup) => grup.modalitats.length > 0);

    // Si venim de jugar, ensenyem la modalitat que acabem de jugar si hi surt.
    if (!modalitats.some((m) => m.clau === modalitatActiva)) {
        const jugada = modalitatDe(estat);
        modalitatActiva = modalitats.some((m) => m.clau === jugada)
            ? jugada
            : grups[0].modalitats[0].clau;
    }

    const perClau = new Map(modalitats.map((m) => [m.clau, m]));
    const elMeuSobrenom = llegirSobrenom();

    function mostrar(clau) {
        modalitatActiva = clau;
        ui.estatClassificacio('');
        ui.pintarSelectorModalitats(grups, clau, mostrar);
        ui.pintarClassificacio(perClau.get(clau), elMeuSobrenom);
    }

    mostrar(modalitatActiva);
}

/**
 * La pestanya de la paraula del dia: el rànquing del dia que triïs i, a sota, el
 * dels millors de sempre. Els dos en la dificultat que triïs.
 */
function pintarDiaria() {
    const perDia = classificacio.diaria || {};
    const millors = classificacio.diaria_millors || {};
    const dies = Object.keys(perDia).sort().reverse();

    /**
     * Els dies que tenen algú EN AQUESTA dificultat i prou. Abans hi sortien
     * tots els dies jugats, i la meitat de les pastilles obrien una taula
     * buida: la paraula del dia es juga molt més en difícil que en fàcil.
     */
    function diesAmbDades(dificultat) {
        return dies.filter((dia) => ((perDia[dia] || {})[dificultat] || []).length > 0);
    }

    if (dies.length === 0) {
        ui.amagarSelectorDificultat();
        ui.el.classificacioSelector.replaceChildren();
        ui.estatClassificacio(estaConfigurat()
            ? 'Encara no hi ha cap paraula del dia jugada.'
            : 'La classificació encara no està activada en aquest lloc.');
        return;
    }

    // Per defecte, la dificultat que jugues: és la que et deus voler mirar.
    if (dificultatDiaria === null) dificultatDiaria = estat.dificultat;
    const elMeuSobrenom = llegirSobrenom();

    function mostrar() {
        ui.pintarSelectorDificultat(dificultatDiaria, (dificultat) => {
            dificultatDiaria = dificultat;
            mostrar();
        });

        const diesTriables = diesAmbDades(dificultatDiaria);
        if (diesTriables.length === 0) {
            ui.el.classificacioSelector.replaceChildren();
            ui.estatClassificacio('Encara no hi ha cap paraula del dia jugada en '
                + 'aquesta dificultat.');
            return;
        }

        // Canviar de dificultat pot deixar el dia que miraves fora de la
        // llista: aleshores cap al més nou dels que queden.
        if (!diesTriables.includes(diaActiu)) diaActiu = diesTriables[0];

        ui.estatClassificacio('');
        ui.pintarSelectorDies(diesTriables, diaActiu, (dia) => {
            diaActiu = dia;
            mostrar();
        });
        ui.pintarDiaria({
            delDia: (perDia[diaActiu] || {})[dificultatDiaria],
            millors: millors[dificultatDiaria],
            dia: diaActiu,
            dificultat: dificultatDiaria,
        }, elMeuSobrenom);
    }

    mostrar();
}

// ------------------------------------------------------------ Configuració
let intervalCompteEnrere;

function obrirConfig(mode) {
    estat.mode = mode;
    estat.data = avui();

    const esDiaria = mode === 'diaria';
    ui.el.configTitol.textContent = esDiaria ? 'Paraula del dia' : 'Il·limitat';
    ui.el.grupTemps.hidden = esDiaria;
    ui.el.configDialecte.textContent = `En ${ui.nomDialecte(estat.dialecte).toLowerCase()}`;
estat.segons = esDiaria ? SEGONS_DIARIA : Number(opcionsTemps.valor());

    // NOU: Lògica per al compte enrere
    const subtitolCompteEnrere = document.getElementById('compte-enrere-diaria');
    clearInterval(intervalCompteEnrere); // Parem per si ja estava funcionant
    
    if (esDiaria) {
        subtitolCompteEnrere.style.display = 'block';
        actualitzarCompteEnrere(); // primera crida
        intervalCompteEnrere = setInterval(actualitzarCompteEnrere, 1000);
    } else {
        subtitolCompteEnrere.style.display = 'none';
    }

    if (esDiaria) {
        // Un intent per dificultat i dia: les jugades es bloquegen.
        for (const dificultat of ['facil', 'dificil']) {
            opcionsDificultat.activar(dificultat, !resultatDiari(estat.data, dificultat));
        }
        const lliure = ['facil', 'dificil']
            .find((d) => !resultatDiari(estat.data, d));
        if (lliure) opcionsDificultat.seleccionar(lliure);
    } else {
        opcionsDificultat.activar('facil', true);
        opcionsDificultat.activar('dificil', true);
    }

    estat.dificultat = opcionsDificultat.valor();
    refrescarJugador();
    refrescarConfig();
    ui.mostrarPantalla('config');
}

/**
 * El bloc de "Qui juga": el nom es tria ABANS de la partida.
 *
 * Si el joc ja el sap, aquí només s'hi veu; si no, el camp surt obert i el botó
 * de començar es queda bloquejat fins que el diguis. Sense classificació
 * activada no es demana res: no hi hauria on enviar-ho.
 */
function refrescarJugador(obert = false) {
    ui.pintarJugador(llegirSobrenom(), { obert, calNom: estaConfigurat() });
    ui.estatSobrenom('');
}

/** Falta el nom per poder jugar? */
function faltaElNom() {
    return estaConfigurat() && !llegirSobrenom();
}

function refrescarConfig() {
    const esDiaria = estat.mode === 'diaria';
    const jugada = esDiaria ? resultatDiari(estat.data, estat.dificultat) : null;
    const totJugat = esDiaria && dificultatsJugades(estat.data).length === 2;

    ui.el.botoComencar.disabled = Boolean(jugada) || faltaElNom();
    ui.texteBoto(ui.el.botoComencar, jugada ? 'Torna-hi demà' : 'Comença');

    let avis = '';
    if (totJugat) {
        avis = 'Avui ja has jugat la paraula del dia en totes dues dificultats. Demà n\'hi haurà una de nova!';
    } else if (jugada) {
        avis = `Avui ja has jugat en ${NOM_DIFICULTAT[estat.dificultat]}: ${jugada.punts} ${jugada.punts === 1 ? 'rima' : 'rimes'}. Prova l'altra dificultat o torna demà.`;
    } else if (esDiaria) {
        avis = "La mateixa paraula per a tothom, jugui en el dialecte que jugui. "
            + "1 minut i un sol intent.";
    }
    ui.el.configAvis.textContent = avis;
    ui.el.configAvis.hidden = avis === '';

    const record = llegirRecord(identificadorRecord(estat));
    ui.el.configRecord.textContent = record > 0
        ? `Rècord en aquesta modalitat: ${record}`
        : '';
}
    // NOU: Afegeix la funció aquí, a prop de les de configuració
    function actualitzarCompteEnrere() {
        const element = document.getElementById('compte-enrere-diaria');
        if (!element) return;

        const ara = new Date();
        const dema = new Date();
        dema.setHours(24, 0, 0, 0); 

        const diferencia = dema - ara;

        const hores = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minuts = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        const segons = Math.floor((diferencia % (1000 * 60)) / 1000);

        const h = hores.toString().padStart(2, '0');
        const m = minuts.toString().padStart(2, '0');
        const s = segons.toString().padStart(2, '0');

        element.innerHTML = `Queda <span style="color: red; font-weight: bold;">${h}h ${m}m ${s}s</span> perquè s'actualitzi la paraula del dia...`;
    }

// -------------------------------------------------------------------- Partida

// Quant esperem abans d'ensenyar el loader. Amb el fitxer del dialecte ja
// baixat, preparar una partida són 90 ms: ensenyar-lo de seguida seria una
// fuetada de pantalla que no informa de res. Si passa d'això, és que hi ha
// alguna cosa baixant i llavors sí que s'ha de veure.
const ESPERA_ABANS_DEL_LOADER = 150;

/**
 * Fa una feina que pot haver d'esperar les rimes, amb el loader pel mig.
 *
 * El loader no s'ensenya de cop: es demana, i si la feina s'acaba abans no
 * arriba a sortir. Torna si ha anat be; qui la crida decideix on va a parar
 * l'error, que no es el mateix a la partida normal que a una ronda del mode
 * personalitzat.
 */
async function ambCarregant(dialecte, feina) {
    // Enganxar-se a la descarrega que ja hi hagi en marxa. La precarrega de
    // l'arrencada l'ha comencada fa estona, o sigui que aqui normalment nomes
    // en recollim el final.
    let progres = { rebut: 0, total: 0 };
    let visible = false;
    const deixarEscoltar = escoltarProgres(dialecte, (estatDescarrega) => {
        progres = estatDescarrega;
        if (visible) ui.progresCarregant(progres);
    });

    const temporitzador = setTimeout(() => {
        visible = true;
        ui.mostrarCarregant(true, 'Preparant la partida…');
        ui.progresCarregant(progres);
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

async function comencarPartida() {
    clearInterval(intervalCompteEnrere); // NOU
    if (estat.mode === 'diaria' && resultatDiari(estat.data, estat.dificultat)) return;
    // Sense nom no es comença: la puntuació s'envia sola en acabar i, si no
    // sabem com et dius, la partida no aniria enlloc.
    if (faltaElNom()) {
        refrescarJugador(true);
        ui.estatSobrenom("Digue'ns com et vols dir abans de començar.", 'error');
        return;
    }

    // Per si en quedava cap de viva: vegeu el mateix a seguentRonda().
    aturarPartida();

    const anatBe = await ambCarregant(estat.dialecte, async () => {
        const { objectiu, respostes, clau } = await prepararParaula();

        // La partida es fa ABANS de pintar la pantalla: es ella qui sap quantes
        // rimes queden un cop treta la paraula objectiu (rimesPossibles).
        estat.partida = new Partida({
            objectiu,
            respostes,
            segons: estat.segons,
            alTic: (restants) => ui.actualitzarRellotge(restants, estat.segons, formatarTemps(restants)),
            alFinal: acabarPartida,
        });

        ui.buidarPartida();
        ui.pintarObjectiu(objectiu.mostrar, estat.dificultat,
                          { rimes: estat.partida.rimesPossibles, clau });
        ui.pintarRonda(0, 0);
        ui.actualitzarPunts(0);
        ui.mostrarPantalla('joc');

        estat.partida.comencar();
        ui.el.camp.focus();
    });

    if (!anatBe) {
        ui.el.configAvis.textContent = "No s'han pogut carregar les rimes. Comprova la connexió i torna-ho a provar.";
        ui.el.configAvis.hidden = false;
        ui.mostrarPantalla('config');
    }
}

/**
 * La paraula del dia d'una data i dificultat. És la MATEIXA per a tothom; el
 * dialecte només serveix per saber a quina secció del seu fitxer cau. La fa
 * servir la partida diària i també la pantalla d'ahir.
 *
 * Primer es mira si aquell dia té paraula triada a mà (dades/diaries_manuals.json,
 * vegeu manualDelDia a objectius.js); si no en té, o si la que té no és al
 * fitxer d'aquest dialecte com a paraula a rimar, la roda de sempre.
 */
async function seleccioDelDia(data, dificultat) {
    const manual = manualDelDia(await carregarDiariesManuals(), data, dificultat);
    if (manual) {
        const trobada = await trobarObjectiu(estat.dialecte, manual);
        if (trobada) return trobada;
        console.warn(`La paraula del dia manual «${manual}» (${data}, ${dificultat}) `
            + `no és al fitxer de "${estat.dialecte}" com a paraula a rimar: es fa servir la de la roda`);
    }
    return paraulaDelDia(await carregarIndex(), data, dificultat, estat.dialecte);
}

async function prepararParaula() {
    const esDiaria = estat.mode === 'diaria';
    const seleccio = esDiaria
        ? await seleccioDelDia(estat.data, estat.dificultat)
        : clauAleatoria(await carregarIndex(), estat.dialecte, estat.dificultat);

    const grup = await grupDeRimes(estat.dialecte, seleccio.grup);
    // A la diària la paraula ja ve triada (és la de tothom); a l'il·limitat es
    // tria ara, a l'atzar, d'entre les objectiu de la clau que ha sortit.
    const objectiu = seleccio.objectiu || triarParaula(grup, seleccio.clau);
    const respostes = respostesValides(grup, seleccio.clau, estat.dificultat);

    return { objectiu, respostes, clau: seleccio.clau };
}

function enviarParaula(esdeveniment) {
    esdeveniment.preventDefault();
    const partida = estat.partida;
    if (!partida || partida.acabada) return;

    const { resultat, mostrar } = partida.provar(ui.el.camp.value);
    if (resultat === RESULTAT.BUIT) {
        ui.el.camp.value = '';
        return;
    }

    ui.el.camp.value = '';

    if (resultat === RESULTAT.ENCERT) {
        ui.actualitzarPunts(partida.punts);
        ui.afegirTrobada(mostrar);
        ui.animarEntrada('encert');
        ui.avisar('Molt bé!', 'encert');
        return;
    }

    ui.animarEntrada('error');
    if (resultat === RESULTAT.REPETIDA) {
        ui.avisar('Ja introduïda', 'neutre');
    } else if (resultat === RESULTAT.OBJECTIU) {
        ui.avisar('Aquesta és la paraula que has de rimar', 'neutre');
    } else {
        ui.avisar('No rima', 'error');
    }
}

function aturarPartida() {
    if (estat.partida) estat.partida.cancellar();
    estat.partida = null;
}

function acabarPartida(resum) {
    ui.bloquejarEntrada();

    const identificador = identificadorRecord(estat);
    const recordAnterior = llegirRecord(identificador);
    const recordNou = desarRecord(identificador, resum.punts, resum.objectiu);

    const esDiaria = estat.mode === 'diaria';
    if (esDiaria) {
        desarResultatDiari(estat.data, estat.dificultat, {
            punts: resum.punts,
            paraules: resum.paraules,
        });
    }

    ui.pintarFinal({
        ...resum,
        recordNou,
        record: recordAnterior,
        titolLlista: resum.punts === 1 ? 'La teva paraula' : 'Les teves paraules',
        // Per a l'enllaç de «x rimes possibles», que porta al cercador amb
        // aquesta paraula, aquest dialecte i aquesta mena de rima.
        dialecte: estat.dialecte,
        dificultat: estat.dificultat,
    });

    estat.textCompartir = esDiaria ? textPerCompartir({
        mode: estat.mode,
        data: estat.data,
        segons: estat.segons,
        dificultat: estat.dificultat,
        dialecte: ui.nomDialecte(estat.dialecte),
        punts: resum.punts,
        // La paraula que tocava. Hi va a posta: vegeu la capçalera de
        // compartir.js, que explica per què s'ha deixat de guardar el secret.
        objectiu: resum.objectiu,
    }) : null;

    ui.el.botoCompartir.hidden = !esDiaria;
    ui.texteBoto(ui.el.botoCompartir, 'Comparteix el resultat');
    // El mateix text al piulet: dos botons per a la mateixa cosa no poden dir
    // coses diferents.
    ui.botoDePiular(estat.textCompartir ? enllacDeTwitter(estat.textCompartir) : null);
    ui.el.botoRepetir.hidden = esDiaria;

    // La modalitat que s'acaba de jugar es la que s'ensenyara si despres s'obre
    // la classificacio.
    modalitatActiva = modalitatDe(estat);
    diaActiu = esDiaria ? estat.data : diaActiu;

    // De quina partida parlen l'enviament i les estadistiques. Es guarda perque
    // canviar-se el sobrenom la torna a enviar, i llavors ja no hi ha cap
    // partida en marxa d'on treure-ho.
    estat.ultimEnviament = {
        mode: estat.mode,
        dificultat: estat.dificultat,
        segons: estat.segons,
        dialecte: estat.dialecte,
        data: esDiaria ? estat.data : avui(),
        punts: resum.punts,
        objectiu: resum.objectiu,
    };

    ui.reiniciarEnviament();
    // Les dues coses van soles i no fan esperar la pantalla: si triguen, el que
    // s'ha de veure de seguida (els punts i les paraules) ja hi es.
    enviarResultat();
    mostrarEstadistiques();

    // Petita pausa perque es vegi que el rellotge ha arribat a zero.
    setTimeout(() => ui.mostrarPantalla('final'), 500);
}

// ---------------------------------------------------- Mode personalitzat
//
// El mode per jugar contra algú. Tot el que es tria acaba dins de l'enllaç, i
// l'enllaç és el que fa que dos jugadors tinguin les mateixes paraules: no hi
// ha servidor pel mig (vegeu js/personalitzat.js i rondesPersonalitzades a
// js/objectius.js).
//
// NO TOCA RES DE LA RESTA DEL JOC: ni la classificació, ni els rècords, ni el
// bloqueig de la paraula del dia. Per això l'acabarPartida() se'n desentén i
// aquest tros té el seu propi final de partida.

const pvp = {
    config: null,      // la configuració neta, amb la llavor i el número de partida
    rondes: [],        // el que toca a cada ronda: { clau, grup, aleatori }
    ronda: 0,          // quina s'està jugant (0 = cap)
    resultats: [],     // { objectiu, punts, paraules, rimesPossibles } de cada ronda
};

function obrirPersonalitzat() {
    if (!pvp.config) pvp.config = configuracioInicial();
    pvp.config.dialecte = estat.dialecte;

    // Primer el formulari i despres els botons: seleccionar-los dispara el
    // refresc, i el refresc llegeix el formulari.
    ui.omplirPersonalitzat(pvp.config, ui.nomDialecte(estat.dialecte));
    opcionsPvpDificultat.seleccionar(pvp.config.dificultat);
    marquesPvpAccents.seleccionar(pvp.config.accents);
    refrescarPersonalitzat();
    ui.mostrarPantalla('personalitzat');
}

/** La configuració de sortida: la de l'adreça si n'hi ha, i si no, la de casa. */
function configuracioInicial() {
    const delAdreca = personalitzat.llegirDeLAdreca();
    if (delAdreca) return delAdreca;
    return personalitzat.netejar({
        ...personalitzat.PER_DEFECTE,
        dialecte: estat.dialecte,
        llavor: personalitzat.llavorNova(),
    });
}

/**
 * Torna a llegir el formulari i diu quantes paraules hi ha amb aquests filtres.
 * Es crida a cada canvi: és el que impedeix començar una partida impossible.
 */
async function refrescarPersonalitzat() {
    const config = personalitzat.netejar({
        ...pvp.config,
        ...ui.llegirPersonalitzat(),
        dialecte: estat.dialecte,
        dificultat: opcionsPvpDificultat.valor(),
        accents: marquesPvpAccents.valor(),
    });
    pvp.config = config;
    ui.notaDeRimes(config.dificultat);

    try {
        const index = await carregarIndex();
        ui.pintarRecompte(marge(index, config.dialecte, config), config.dificultat);
    } catch (error) {
        // Sense índex no es pot dir res del marge; el botó es queda actiu i la
        // partida ja fallarà amb un avís si de debò no es pot preparar.
        ui.pintarRecompte({ rimes: -1, objectius: 0, minRimes: 0, maxRimes: 0 },
                          config.dificultat);
    }
}

/** Del formulari al convit: es fixa la partida i se'n fa l'enllaç. */
function crearPartidaPersonalitzada() {
    pvp.config.partida = 1;
    pvp.config.signatura = personalitzat.signaturaDe(pvp.config);
    personalitzat.escriureALAdreca(pvp.config);
    pintarConvit();
    ui.mostrarPantalla('convit');
}

function pintarConvit() {
    const c = pvp.config;
    const sostre = c.max === Infinity ? 'sense màxim' : `fins a ${c.max}`;
    ui.pintarConvit({
        codi: personalitzat.codiDe(c),
        enllac: personalitzat.enllacDe(c),
        resum: `${ui.nomDialecte(c.dialecte)} · rima `
            + `${c.dificultat === 'dificil' ? 'consonant' : 'assonant'} · `
            + `${c.rondes} ${c.rondes === 1 ? 'ronda' : 'rondes'} de ${c.segons} s · `
            + `${c.accents.map((a) => NOM_ACCENT[a]).join(', ')} · `
            + `de ${c.min} rimes ${sostre}`,
    });
}

async function copiarEnllac() {
    const fet = await copiar(personalitzat.enllacDe(pvp.config));
    ui.estatConvit(fet ? 'Enllaç copiat!' : 'No s\'ha pogut copiar: selecciona\'l i copia\'l a mà.',
                   fet ? 'ok' : 'error');
    if (!fet) ui.seleccionarEnllac();
}

// ------------------------------------------------------------ Les rondes

/** Comença la partida sencera: es preparen totes les rondes i s'obre la primera. */
async function comencarPartidaPersonalitzada() {
    try {
        const index = await carregarIndex();
        pvp.rondes = rondesPersonalitzades(index, pvp.config.dialecte, pvp.config);
    } catch (error) {
        ui.estatConvit('Amb aquests filtres no hi ha cap paraula per jugar.', 'error');
        return;
    }
    pvp.ronda = 0;
    pvp.resultats = [];
    seguentRonda();
}

async function seguentRonda() {
    if (pvp.ronda >= pvp.rondes.length) {
        acabarPartidaPersonalitzada();
        return;
    }
    const numero = pvp.ronda + 1;
    const seleccio = pvp.rondes[pvp.ronda];
    pvp.ronda += 1;

    // La ronda d'abans, si encara respirava. Substituir estat.partida sense
    // aturar-la deixaria el seu setInterval viu: quan arribés al zero cridaria
    // l'alFinal i apuntaria una ronda de més al resum.
    aturarPartida();

    const anatBe = await ambCarregant(pvp.config.dialecte, async () => {
        const grup = await grupDeRimes(pvp.config.dialecte, seleccio.grup);
        // El darrer "false": aquí sí que valen les paraules que només es poden
        // rimar en aquest dialecte. La finestra la tria el jugador i el dialecte
        // va tancat dins de l'enllaç, o sigui que tots dos juguen el mateix.
        const objectiu = triarParaula(grup, seleccio.clau, seleccio.aleatori, false);
        const respostes = respostesValides(grup, seleccio.clau, pvp.config.dificultat);

        // Primer la partida i despres la pantalla, com a comencarPartida().
        estat.partida = new Partida({
            objectiu,
            respostes,
            segons: pvp.config.segons,
            alTic: (restants) => ui.actualitzarRellotge(
                restants, pvp.config.segons, formatarTemps(restants)),
            alFinal: acabarRondaPersonalitzada,
        });

        ui.buidarPartida();
        ui.pintarObjectiu(objectiu.mostrar, pvp.config.dificultat,
                          { rimes: estat.partida.rimesPossibles, clau: seleccio.clau });
        ui.pintarRonda(numero, pvp.config.rondes);
        ui.actualitzarPunts(0);
        ui.mostrarPantalla('joc');

        estat.partida.comencar();
        ui.el.camp.focus();
    });

    if (!anatBe) {
        pvp.ronda -= 1;
        ui.estatConvit("No s'han pogut carregar les rimes. Torna-ho a provar.", 'error');
        ui.mostrarPantalla('convit');
    }
}

function acabarRondaPersonalitzada(resum) {
    ui.bloquejarEntrada();
    pvp.resultats.push({
        objectiu: resum.objectiu,
        punts: resum.punts,
        paraules: resum.paraules,
        rimesPossibles: resum.rimesPossibles,
    });

    const ultima = pvp.ronda >= pvp.rondes.length;
    ui.pintarRondaAcabada({
        ronda: pvp.ronda,
        rondes: pvp.config.rondes,
        punts: resum.punts,
        paraules: resum.paraules,
        objectiu: resum.objectiu,
        rimesPossibles: resum.rimesPossibles,
        ultima,
        dialecte: pvp.config.dialecte,
        dificultat: pvp.config.dificultat,
    });
    setTimeout(() => ui.mostrarPantalla('ronda'), 500);
}

function acabarPartidaPersonalitzada() {
    ui.pintarResum({
        codi: personalitzat.codiDe(pvp.config),
        partida: pvp.config.partida,
        rondes: pvp.resultats,
        total: puntsTotals(),
        dialecte: pvp.config.dialecte,
        dificultat: pvp.config.dificultat,
    });
    ui.mostrarPantalla('resum');
}

function puntsTotals() {
    return pvp.resultats.reduce((suma, ronda) => suma + ronda.punts, 0);
}

/** Una altra partida amb els mateixos ajustos: paraules noves per a tots dos. */
function unaAltraPersonalitzada() {
    pvp.config.partida += 1;
    comencarPartidaPersonalitzada();
}

async function compartirPersonalitzat() {
    const text = textPersonalitzat({
        codi: personalitzat.codiDe(pvp.config),
        partida: pvp.config.partida,
        rondes: pvp.resultats,
        total: puntsTotals(),
        // El mateix enllaç del convit: qui rebi el resultat pot jugar la
        // partida exacta sense haver de demanar res més (vegeu copiarEnllaç).
        enllac: personalitzat.enllacDe(pvp.config),
    });
    const com = await compartirResultat(text);
    if (com === 'cancellat' || com === 'compartit') return;
    ui.texteBoto(ui.el.resumCompartir, com === 'copiat' ? 'Copiat!' : 'No s\'ha pogut copiar');
    setTimeout(() => ui.texteBoto(ui.el.resumCompartir, 'Comparteix el resultat'), 1600);
}

// -------------------------------------------------- Enviar a la classificació

/**
 * La puntuació se'n va sola en acabar la partida.
 *
 * ABANS CALIA ESCRIURE EL NOM I PRÉMER "ENVIAR" CADA VEGADA, i qui no ho feia
 * -que era la majoria- no sortia enlloc encara que hagués fet una partidassa.
 * Després el nom es demanava un sol cop, però al final de la primera partida, i
 * el "Canvia el nom" d'aquella pantalla tornava a enviar la MATEIXA puntuació
 * amb el nom nou: dues files de la mateixa partida al full, i el compilador
 * havent de desempatar-les per data.
 *
 * Ara el nom es tria a la pantalla d'abans de començar (vegeu refrescarJugador),
 * o sigui que quan s'acaba la partida ja se sap com et dius i cada partida
 * s'envia UNA vegada.
 */
async function enviarResultat() {
    const partida = estat.ultimEnviament;
    if (!partida) return;

    if (partida.punts === 0) {
        ui.estatEnviament("Zero rimes no pugen a la classificació. La propera!", null);
        return;
    }

    const sobrenom = llegirSobrenom();
    if (!sobrenom) {
        // No hi hauríem d'arribar (sense nom no es pot començar), però si la
        // classificació no està activada tampoc no cal dir res.
        if (estaConfigurat()) {
            ui.estatEnviament("Sense nom la puntuació no puja a la classificació.", null);
        }
        return;
    }

    ui.estatEnviament("Enviant la puntuació…", null);

    const resposta = await enviarPuntuacio({
        sobrenom,
        mode: partida.mode,
        dificultat: partida.dificultat,
        segons: partida.segons,
        dialecte: partida.dialecte,
        punts: partida.punts,
        paraula: partida.objectiu,
        data: partida.data,
    });

    if (resposta.estat === "enviat") {
        ui.estatEnviament(`Apuntat a la classificació com a «${sobrenom}». `
            + "Hi sortiràs quan s'actualitzi.", "ok");
    } else if (resposta.estat === "encuat") {
        // No s'ha perdut: es desa i puja sola quan torni la xarxa (vegeu
        // enviarPendents a classificacio.js). El dia de la partida viatja amb
        // la puntuació, o sigui que continuarà comptant per avui.
        ui.estatEnviament("Ara mateix no hi ha connexió. La puntuació s'ha desat i "
            + "pujarà a la classificació tota sola quan en tornis a tenir.", null);
    } else if (resposta.estat === "sense-backend") {
        ui.estatEnviament("La classificació d'aquest lloc encara no està activada.", null);
    } else {
        ui.estatEnviament("No s'ha pogut enviar la puntuació a la classificació.", "error");
    }
}

/**
 * Quan torna la connexió i les puntuacions que esperaven ja han pujat, es diu a
 * la pantalla de final, que és on l'avís de "s'enviarà quan tornis a tenir
 * xarxa" es va quedar escrit. A la resta de pantalles no es diu res: no hi ha
 * cap lloc on això no sembli sortit del no-res.
 */
function avisarDePendents(enviades) {
    if (enviades === 0 || ui.el.pantallaFinal.hidden) return;
    const queden = quantesPendents();
    ui.estatEnviament(
        enviades === 1
            ? 'Ha tornat la connexió: la puntuació ja ha pujat a la classificació.'
            : `Ha tornat la connexió: ${enviades} puntuacions ja han pujat a la classificació.`,
        queden === 0 ? 'ok' : null);
}

/**
 * Desar el nom, a la pantalla d'abans de començar: el primer cop és el que
 * desbloqueja el botó de començar, i després és el "Canvia el nom".
 *
 * NO ES POT AGAFAR UN NOM QUE JA SIGUI A LA CLASSIFICACIÓ. La llista de noms
 * ocupats la publica el compilador (vegeu noms_ocupats a
 * eines/compilar_classificacio.py) i és, per força, la d'ahir: dues persones
 * poden triar el mateix nom el mateix dia sense que cap de les dues ho pugui
 * saber. No passa res, perquè el rànquing separa la gent per identificador
 * d'usuari i no pas pel nom: en aquest cas surten dues files i no una de
 * barrejada.
 */
function desarNouSobrenom() {
    const anterior = llegirSobrenom();
    const comprovacio = validarSobrenom(ui.nomEscrit(), {
        ocupats: nomsOcupats(classificacio),
        elMeu: anterior,
    });
    if (!comprovacio.ok) {
        ui.estatSobrenom(comprovacio.motiu, 'error');
        return;
    }

    if (comprovacio.sobrenom !== anterior) desarSobrenom(comprovacio.sobrenom);
    refrescarJugador();
    refrescarConfig();
}

// ------------------------------------------------------------- Estadístiques

// Quina partida s'està mirant. La classificació es demana sense esperar-la, i
// sense això una resposta que arribés tard pintaria el percentil d'una partida
// que ja no és la que es veu a la pantalla.
let comptadorDePartides = 0;

/**
 * El percentil i la mitjana de la pantalla de final, quan la classificació
 * n'hagi dit prou (vegeu estadistiques.js). Si no n'hi ha prou -o si el fitxer
 * no es pot llegir- el bloc no surt i la pantalla queda com abans.
 */
async function mostrarEstadistiques() {
    const partida = estat.ultimEnviament;
    const meu = ++comptadorDePartides;
    ui.pintarEstadistiques(null, {});

    try {
        classificacio = await carregarClassificacio();
    } catch (error) {
        return;
    }
    if (meu !== comptadorDePartides) return;

    ui.pintarEstadistiques(
        estadistiquesDe(classificacio, partida, partida.punts),
        { mode: partida.mode, dificultat: partida.dificultat, objectiu: partida.objectiu });
}

// ----------------------------------------------------------------- Compartir

async function compartir() {
    // El text el va fer l'acabarPartida, que es qui sap de quina partida parlem
    // (vegeu estat.textCompartir). Sense partida acabada no hi ha boto.
    if (!estat.textCompartir) return;

    const com = await compartirResultat(estat.textCompartir);
    if (com === 'cancellat' || com === 'compartit') return;

    ui.texteBoto(ui.el.botoCompartir, com === 'copiat' ? 'Copiat!' : 'No s\'ha pogut copiar');
    setTimeout(() => {
        ui.texteBoto(ui.el.botoCompartir, 'Comparteix el resultat');
    }, 1600);
}