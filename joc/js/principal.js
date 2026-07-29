// Fil conductor del joc: enllaça les pantalles amb el motor i amb les dades.

import { carregarIndex, carregarFitxerDeRimes, respostesValides } from './dades.js';
import { clauAleatoria, clauDelDia, triarParaula } from './objectius.js';
import { Partida, RESULTAT, formatarTemps } from './motor.js';
import * as ui from './ui.js';
import {
    avui, identificadorRecord, llegirRecord, desarRecord,
    resultatDiari, dificultatsJugades, desarResultatDiari,
    llegirTotsElsRecords, llegirSobrenom, desarSobrenom,
} from './magatzem.js';
import { textPerCompartir, compartirResultat } from './compartir.js';
import {
    validarSobrenom, enviarPuntuacio, estaConfigurat,
    carregarClassificacio,
} from './classificacio.js';

const SEGONS_DIARIA = 60;
const NOM_DIFICULTAT = { facil: 'fàcil', dificil: 'difícil' };

const estat = {
    mode: 'illimitat',
    dificultat: 'facil',
    segons: 90,
    partida: null,
    ultimResum: null,
    data: avui(),
};

let opcionsDificultat = null;
let opcionsTemps = null;

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

for (const boto of document.querySelectorAll('[data-mode]')) {
    boto.addEventListener('click', () => obrirConfig(boto.dataset.mode));
}
for (const boto of document.querySelectorAll('[data-accio="inici"]')) {
    boto.addEventListener('click', tornarAInici);
}
for (const boto of document.querySelectorAll('[data-vista]')) {
    boto.addEventListener('click', () => obrirVista(boto.dataset.vista));
}

ui.el.botoComencar.addEventListener('click', comencarPartida);
ui.el.botoRepetir.addEventListener('click', comencarPartida);
ui.el.botoCompartir.addEventListener('click', compartir);
ui.el.botoEnviarRecord.addEventListener('click', enviarARanquing);
ui.el.formulari.addEventListener('submit', enviarParaula);
// El formulari ja s'envia sol amb la tecla de retorn, pero ho deixem explicit
// com a js/cerca.js: hi ha teclats de mobil que no disparen l'enviament implicit.
ui.el.camp.addEventListener('keydown', (esdeveniment) => {
    if (esdeveniment.key === 'Enter') enviarParaula(esdeveniment);
});

// L'index es petit i el volem a punt abans que ningu premi cap boto.
carregarIndex().catch(() => {});

refrescarInici();

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
    ui.mostrarPantalla('inici');
}

function obrirVista(vista) {
    if (vista === 'records') obrirRecords();
    else if (vista === 'classificacio') obrirClassificacio();
}

// ------------------------------------------------------------- Els meus rècords

function obrirRecords() {
    ui.pintarRecords(llegirTotsElsRecords());
    ui.mostrarPantalla('records');
}

// ------------------------------------------------------------- Classificació

let modalitatActiva = null;

async function obrirClassificacio() {
    ui.mostrarPantalla('classificacio');
    ui.el.classificacioData.textContent = '';
    ui.el.classificacioSelector.replaceChildren();
    ui.estatClassificacio('Carregant la classificació…');

    let dades;
    try {
        dades = await carregarClassificacio();
    } catch (error) {
        ui.estatClassificacio('No s\'ha pogut carregar la classificació. Torna-ho a provar més tard.');
        return;
    }

    const modalitats = Object.entries(dades.modalitats || {})
        .map(([clau, valor]) => ({ clau, titol: valor.titol, top: valor.top || [] }))
        .filter((m) => m.top.length > 0);

    if (modalitats.length === 0) {
        ui.estatClassificacio(estaConfigurat()
            ? 'Encara no hi ha cap puntuació. Sigues el primer!'
            : 'La classificació encara no està activada en aquest lloc.');
        ui.el.classificacioData.textContent = dades.actualitzacio
            ? `Última actualització: ${dades.actualitzacio}`
            : '';
        return;
    }

    // Si venim de jugar, mostrem la modalitat que acabem de jugar si hi surt.
    if (!modalitats.some((m) => m.clau === modalitatActiva)) {
        const jugada = `${estat.mode}|${estat.dificultat}|${estat.segons}`;
        modalitatActiva = modalitats.some((m) => m.clau === jugada) ? jugada : modalitats[0].clau;
    }

    const perClau = new Map(modalitats.map((m) => [m.clau, m.top]));
    const elMeuSobrenom = llegirSobrenom();

    function mostrar(clau) {
        modalitatActiva = clau;
        ui.estatClassificacio('');
        ui.pintarSelectorModalitats(modalitats, clau, mostrar);
        ui.pintarClassificacio(perClau.get(clau) || [], elMeuSobrenom);
    }

    mostrar(modalitatActiva);
    ui.el.classificacioData.textContent = dades.actualitzacio
        ? `Última actualització: ${dades.actualitzacio}`
        : '';
}

function obrirConfig(mode) {
    estat.mode = mode;
    estat.data = avui();

    const esDiaria = mode === 'diaria';
    ui.el.configTitol.textContent = esDiaria ? 'Paraula del dia' : 'Il·limitat';
    ui.el.grupTemps.hidden = esDiaria;
    estat.segons = esDiaria ? SEGONS_DIARIA : Number(opcionsTemps.valor());

    if (esDiaria) {
        // Un intent per dificultat i dia: les que ja s'han jugat es bloquegen.
        for (const dificultat of ['facil', 'dificil']) {
            opcionsDificultat.activar(dificultat, !resultatDiari(estat.data, dificultat));
        }
        const lliure = ['facil', 'dificil'].find((d) => !resultatDiari(estat.data, d));
        if (lliure) opcionsDificultat.seleccionar(lliure);
    } else {
        opcionsDificultat.activar('facil', true);
        opcionsDificultat.activar('dificil', true);
    }

    estat.dificultat = opcionsDificultat.valor();
    refrescarConfig();
    ui.mostrarPantalla('config');
}

function refrescarConfig() {
    const esDiaria = estat.mode === 'diaria';
    const jugada = esDiaria ? resultatDiari(estat.data, estat.dificultat) : null;
    const totJugat = esDiaria && dificultatsJugades(estat.data).length === 2;

    ui.el.botoComencar.disabled = Boolean(jugada);
    ui.texteBoto(ui.el.botoComencar, jugada ? 'Torna-hi demà' : 'Comença');

    let avis = '';
    if (totJugat) {
        avis = 'Avui ja has jugat la paraula del dia en totes dues dificultats. Demà n\'hi haurà una de nova!';
    } else if (jugada) {
        avis = `Avui ja has jugat en ${NOM_DIFICULTAT[estat.dificultat]}: ${jugada.punts} ${jugada.punts === 1 ? 'rima' : 'rimes'}. Prova l'altra dificultat o torna demà.`;
    } else if (esDiaria) {
        avis = 'La mateixa paraula per a tothom, 1 minut i un sol intent.';
    }
    ui.el.configAvis.textContent = avis;
    ui.el.configAvis.hidden = avis === '';

    const record = llegirRecord(identificadorRecord(estat));
    ui.el.configRecord.textContent = record > 0
        ? `Rècord en aquesta modalitat: ${record}`
        : '';
}

// -------------------------------------------------------------------- Partida

async function comencarPartida() {
    if (estat.mode === 'diaria' && resultatDiari(estat.data, estat.dificultat)) return;

    ui.mostrarCarregant(true, 'Preparant la partida…');
    try {
        const { objectiu, respostes } = await prepararParaula();

        ui.buidarPartida();
        ui.pintarObjectiu(objectiu.mostrar, estat.dificultat);
        ui.actualitzarPunts(0);
        ui.mostrarPantalla('joc');
        ui.mostrarCarregant(false);

        estat.partida = new Partida({
            objectiu,
            respostes,
            segons: estat.segons,
            alTic: (restants) => ui.actualitzarRellotge(restants, estat.segons, formatarTemps(restants)),
            alFinal: acabarPartida,
        });
        estat.partida.comencar();
        ui.el.camp.focus();
    } catch (error) {
        console.error(error);
        ui.mostrarCarregant(false);
        ui.el.configAvis.textContent = 'No s\'han pogut carregar les rimes. Comprova la connexió i torna-ho a provar.';
        ui.el.configAvis.hidden = false;
        ui.mostrarPantalla('config');
    }
}

async function prepararParaula() {
    const index = await carregarIndex();
    const esDiaria = estat.mode === 'diaria';
    const seleccio = esDiaria ? clauDelDia(index, estat.data) : clauAleatoria(index);

    const fitxer = await carregarFitxerDeRimes(seleccio.fitxer);
    const objectiu = triarParaula(fitxer, seleccio.clau, seleccio.aleatori);
    const respostes = respostesValides(fitxer, seleccio.clau, estat.dificultat);

    return { objectiu, respostes };
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
    estat.ultimResum = resum;

    const identificador = identificadorRecord(estat);
    const recordAnterior = llegirRecord(identificador);
    const recordNou = desarRecord(identificador, resum.punts);

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
    });

    ui.el.botoCompartir.hidden = !esDiaria;
    ui.texteBoto(ui.el.botoCompartir, 'Comparteix el resultat');
    ui.el.botoRepetir.hidden = esDiaria;

    // Preparem el bloc d'enviament a la classificacio (per a totes les partides).
    modalitatActiva = `${estat.mode}|${estat.dificultat}|${estat.segons}`;
    ui.reiniciarEnviament();
    ui.el.campSobrenom.value = llegirSobrenom();
    if (resum.punts === 0) {
        ui.estatEnviament('Fes almenys una rima per pujar a la classificació.', null);
        ui.el.campSobrenom.disabled = true;
        ui.el.botoEnviarRecord.disabled = true;
    }

    // Petita pausa perque es vegi que el rellotge ha arribat a zero.
    setTimeout(() => ui.mostrarPantalla('final'), 500);
}

// -------------------------------------------------- Enviar a la classificació

async function enviarARanquing() {
    const resum = estat.ultimResum;
    if (!resum || resum.punts === 0) return;

    const comprovacio = validarSobrenom(ui.el.campSobrenom.value);
    if (!comprovacio.ok) {
        ui.estatEnviament(comprovacio.motiu, 'error');
        return;
    }

    desarSobrenom(comprovacio.sobrenom);
    ui.el.botoEnviarRecord.disabled = true;
    ui.estatEnviament('Enviant…', null);

    const resposta = await enviarPuntuacio({
        sobrenom: comprovacio.sobrenom,
        mode: estat.mode,
        dificultat: estat.dificultat,
        segons: estat.segons,
        punts: resum.punts,
        paraula: resum.objectiu,
        data: estat.mode === 'diaria' ? estat.data : avui(),
    });

    if (resposta.estat === 'enviat') {
        ui.enviamentFet('Enviat! Sortiràs a la classificació quan s\'actualitzi.');
    } else if (resposta.estat === 'sense-backend') {
        ui.enviamentFet('Desat! (La classificació d\'aquest lloc encara no està activada.)');
    } else {
        ui.el.botoEnviarRecord.disabled = false;
        ui.estatEnviament('No s\'ha pogut enviar. Torna-ho a provar.', 'error');
    }
}

// ----------------------------------------------------------------- Compartir

async function compartir() {
    const text = textPerCompartir({
        data: estat.data,
        dificultat: estat.dificultat,
        punts: estat.ultimResum ? estat.ultimResum.punts : 0,
    });

    const com = await compartirResultat(text);
    if (com === 'cancellat' || com === 'compartit') return;

    ui.texteBoto(ui.el.botoCompartir, com === 'copiat' ? 'Copiat!' : 'No s\'ha pogut copiar');
    setTimeout(() => {
        ui.texteBoto(ui.el.botoCompartir, 'Comparteix el resultat');
    }, 1600);
}
