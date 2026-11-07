// Backend de les estadístiques: apunta al full cada cerca que arriba del web.
//
// Enganxa'l a Extensions > Apps Script del full de càlcul de les cerques i
// desplega'l com a aplicació web (executa com: jo; accés: qualsevol). L'URL
// /exec va a URL_GOOGLE_SCRIPT de js/script.js, que és qui l'envia (vegeu
// registrarCerca).
//
// Després, stats/stats.py llegeix aquell full publicat en CSV cada nit i
// n'escriu stats/estadistiques_rimador.json, que és el que veu dades.html.
//
// LES COLUMNES DEL FULL, a la fila 1 i en aquest ordre:
//
//   Data | Usuari | Paraula | Codi | Rima | Tipus de rima | Num. síl· |
//   Comença per | Incloure NP | Incloure pl. | Dialecte
//
// Els noms han de ser EXACTAMENT aquests: l'stats.py hi busca les columnes pel
// nom, accents i punt de "Incloure pl." inclosos.
//
// SI EL FULL VE D'ABANS I NO TÉ LA COLUMNA "Dialecte", afegeix-la a la fila 1
// A L'ÚLTIMA POSICIÓ (K1), mai entremig: inserida al mig, totes les files
// velles queden desplaçades una columna i el full anterior es fa malbé. Les
// files d'abans del canvi la duran buida, i l'stats.py ja ho té previst: les
// deixa fora dels recomptes de dialecte en comptes de descartar-les.
//
// I RECORDA DESPLEGAR: l'aplicació web serveix la versió DESPLEGADA, no pas la
// que tens desada a l'editor. Desar el codi no canvia res del que rep el full;
// cal Desplega > Gestiona els desplegaments > editar el desplegament > versió
// nova. És l'errada d'una tarda sencera, aquesta.
//
// -------------------------------------------------------------------------
// SEGURETAT
// -------------------------------------------------------------------------
// L'adreça /exec és pública (la té qualsevol que obri el js/script.js), i un
// Apps Script no pot saber qui l'hi crida: no veu ni l'IP ni l'origen. Per això
// no es fia de res del que arriba, i fa dues coses:
//
//   1. VALIDA CADA CAMP. Els que només poden tenir uns quants valors (el tipus
//      de rima, les síl·labes...) s'accepten només si són un d'ells; els de
//      text lliure, amb la forma i la llargada que té el que envia el web. Una
//      cerca amb qualsevol cosa estranya es rebutja sencera i no s'apunta.
//      Això és el que tanca el forat per on es podia colar HTML a dades.html.
//
//   2. NO DEIXA QUE EL FULL INTERPRETI RES COM A FÓRMULA. Un valor que comenci
//      per "=" o "@" s'executaria com a fórmula; les cel·les de text lliure
//      s'escriuen com a text pla. (No s'hi pot treure el "-" del davant, perquè
//      hi ha cerques de debò que comencen així: "-otxe", "-neta".)
//
// LA PESTANYA "TRAMPES". Quan el web veu que algú ha arribat amb un marcador
// sense substituir (?q={search_term_string}: un visitant automàtic que ha pres
// la plantilla del SearchAction de l'index.html al peu de la lletra), no cerca
// res i envia aquí el que el seu navegador diu de si mateix (el User-Agent, si
// és un navegador automatitzat, d'on ve...). S'apunta a una pestanya a part,
// que es crea sola; la primera pestanya, la de les cerques, no es toca, i és
// la que publica el CSV per a stats.py (el gid=0 de l'adreça).
//
// El que NO es pot evitar des d'aquí: algú que respecti tots els formats pot
// continuar enviant cerques que semblin de veritat. Per això
// l'stats.py torna a filtrar tot el que llegeix del full.

// Les llargades màximes del text lliure (la més llarga que s'ha vist és 80).
var MAX_PARAULA = 100;
var MAX_RIMA = 60;

// Els camps que només poden dir una d'aquestes coses. Han de ser els mateixos
// valors dels <select> de js/components.js. Les síl·labes van de 0 (indiferent)
// a 9 (vegeu les opcions dels mots aguts, plans i esdrúixols).
var VALORS_PERMESOS = {
  tipusRima: ['r.consonant', 'r.assonant'],
  numeroSilabes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  comencaPer: ['indiferent', 'consonant', 'vocal+h'],
  inclourePropis: ['si', 'no'],
  inclourePlurals: ['si', 'no']
};

// Les columnes (la primera és la 1) on va text lliure: s'hi escriu com a text
// pla perquè el full no les interpreti mai com a fórmula. Paraula, Codi i Rima.
var COLUMNES_DE_TEXT = [3, 4, 5];

// La pestanya on van les notes dels visitants automàtics, i els seus títols.
var NOM_FULL_TRAMPES = 'Trampes';
var CAPCALERES_TRAMPES = ['Data', 'Marcador', 'Usuari', 'User-Agent', 'Marques',
  'Webdriver', 'Referrer', 'URL', 'Idioma', 'Idiomes', 'Fus', 'Pantalla',
  'Finestra', 'Nuclis', 'Plugins'];

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    if (p.tipus === 'trampa') {
      return rebreTrampa(p);
    }

    var cerca = validar(p);
    if (cerca.motiu) {
      return resposta('Rebutjat: ' + cerca.motiu);
    }

    // El pany fa que dues cerques simultànies no triïn la mateixa "última
    // fila" i es trepitgin.
    var pany = LockService.getScriptLock();
    if (!pany.tryLock(10000)) {
      return resposta('Error: massa feina, torna-ho a provar');
    }
    try {
      // getSheets()[0] i no getActiveSheet(): en una crida web no hi ha ningú
      // mirant cap pestanya, i "l'activa" acaba depenent de coses que no manem.
      // El full de les cerques és el primer i prou. Mateix criteri que
      // joc/eines/apps_script_classificacio.gs.
      var full = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      escriureFila(full, cerca.fila);
    } finally {
      pany.releaseLock();
    }

    return resposta('OK');

  } catch (error) {
    // El motiu, escrit: el web fa el fetch amb mode 'no-cors' i no llegeix mai
    // la resposta, però quan es prova l'adreça a mà des del navegador, un
    // "Error" pelat no diu on mirar.
    return resposta('Error: ' + error);
  }
}

/**
 * Comprova una cerca. Torna {motiu} si no és vàlida (el motiu diu quin camp
 * falla) o {usuari, fila} amb la fila ja a punt per escriure-la.
 */
function validar(p) {
  var paraula = net(p.paraula, MAX_PARAULA);
  // El web no n'envia cap de menys de dues lletres (vegeu registrarCerca).
  if (paraula.length < 2) return { motiu: 'paraula' };

  // usr_<temps en base 36>_<cinc lletres>, que és com el fabrica getUsuariID().
  // També hi ha identificadors del format antic ("usuari_72383") desats al
  // localStorage de qui va entrar fa temps: només es miren els caràcters.
  var usuari = String(p.usuari || '');
  if (!/^[a-z0-9_]{3,48}$/.test(usuari)) return { motiu: 'usuari' };

  // Els codis gramaticals són lletres i xifres, '*' quan no n'hi ha ("***") i
  // algun '+' (ZSP+DA). Alguns arriben del diccionari amb un salt de línia al
  // darrere (vegeu "VSSI2S02\r" al full), per això el trim().
  var codi = String(p.codi || '').trim();
  if (!/^[A-Za-z0-9*][A-Za-z0-9*+]{0,15}$/.test(codi)) return { motiu: 'codi' };

  var rima = net(p.rima, MAX_RIMA);
  if (!rima) return { motiu: 'rima' };

  for (var camp in VALORS_PERMESOS) {
    if (VALORS_PERMESOS.hasOwnProperty(camp) &&
        VALORS_PERMESOS[camp].indexOf(String(p[camp])) === -1) {
      return { motiu: camp };
    }
  }

  // El dialecte: dues o tres lletres, o buit si ve d'un web d'abans que n'hi
  // hagués. NO es comprova que sigui un dels quatre d'ara, a posta. Qui sap quins
  // hi ha és la llista DIALECTES de js/components.js, i el dia que s'hi
  // afegeixi el rossellonès ningú no se'n recordaria, d'aquest fitxer: una
  // llista escrita aquí voldria dir tirar a les escombraries, sense dir-ho,
  // les cerques del dialecte nou. Els codis estranys ja els deixa fora
  // l'stats.py, que sí que té la llista al costat de tota la resta.
  var dialecte = String(p.dialecte || '');
  if (dialecte !== '' && !/^[a-z]{2,3}$/.test(dialecte)) return { motiu: 'dialecte' };

  return {
    usuari: usuari,
    fila: [
      // La data com a TEXT amb un format fixat, i no pas un new Date().
      //
      // Amb un objecte Date, el que surt al CSV publicat és com el full
      // decideixi ENSENYAR la data, i l'stats.py el llegeix amb un format
      // clavat ('%d/%m/%Y %H:%M:%S'). Si algú toca el format de la columna A,
      // el pd.to_datetime no reconeix res, l'errors='coerce' ho torna tot buit
      // i el dropna se salta totes les files: unes estadístiques a zero sense
      // que peti res enlloc. Escrivint-la nosaltres, el que llegeix l'stats.py
      // no depèn de com es vegi el full.
      //
      // La zona horària també la diem aquí: el servidor de Google no corre a
      // Barcelona, i les dades es tallen per dies (vegeu tz_espanya a
      // stats/stats.py).
      araFormatada(),
      usuari,
      paraula,
      codi,
      rima,
      p.tipusRima,
      p.numeroSilabes,
      p.comencaPer,
      p.inclourePropis,
      p.inclourePlurals,
      dialecte
    ]
  };
}

/**
 * Apunta a la pestanya "Trampes" qui ha arribat amb un marcador sense
 * substituir. Només s'accepta si el marcador té aquesta forma ({...}), i la
 * resta de camps són informació del navegador, tallada i neta com tot el text
 * lliure. No es rebutja per cap altre motiu: el que ens interessa és
 * justament que sigui estrany.
 */
function rebreTrampa(p) {
  var marcador = net(p.marcador, 60);
  if (!/^\{[^{}]*\}$/.test(marcador)) return resposta('Rebutjat: marcador');

  var fila = [
    araFormatada(),
    marcador,
    net(p.usuari, 48),
    net(p.userAgent, 300),
    net(p.marques, 200),
    net(p.webdriver, 10),
    net(p.referrer, 300),
    net(p.url, 300),
    net(p.idioma, 20),
    net(p.idiomes, 100),
    net(p.fus, 60),
    net(p.pantalla, 20),
    net(p.finestra, 20),
    net(p.nuclis, 10),
    net(p.plugins, 10)
  ];

  var pany = LockService.getScriptLock();
  if (!pany.tryLock(10000)) {
    return resposta('Error: massa feina, torna-ho a provar');
  }
  try {
    var llibre = SpreadsheetApp.getActiveSpreadsheet();
    var full = llibre.getSheetByName(NOM_FULL_TRAMPES);
    if (!full) {
      // Al final de tot: la primera pestanya ha de continuar sent la de les
      // cerques (getSheets()[0]).
      full = llibre.insertSheet(NOM_FULL_TRAMPES, llibre.getSheets().length);
      full.getRange(1, 1, 1, CAPCALERES_TRAMPES.length).setValues([CAPCALERES_TRAMPES]);
      full.setFrozenRows(1);
    }
    var totes = [];
    for (var i = 1; i <= fila.length; i++) totes.push(i);
    escriureFila(full, fila, totes);
  } finally {
    pany.releaseLock();
  }
  return resposta('OK');
}

function araFormatada() {
  return Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM/yyyy HH:mm:ss');
}

/**
 * Neteja un text lliure: treu els caràcters de control, els invisibles i els que giren la direcció
 * del text (que serveixen per fer passar una cosa per una altra), els < >,
 * ajunta els
 * espais i el talla a la llargada màxima. Els < > no fan cap falta a una paraula
 * ni a una transcripció fonètica, i fora d'aquí no hi ha qui ho hagi de pintar
 * com a HTML (dades.html ho posa amb textContent), però val més no guardar-ho.
 */
function net(valor, maxim) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxim);
}

/**
 * Escriu la fila a sota de tot. Ha d'anar dins del pany.
 *
 * Fa servir getRange().setValues() i no pas appendRow() perquè així es pot dir,
 * ABANS d'escriure, que les columnes de text lliure són text pla. Amb appendRow
 * el full interpreta el que arriba com si ho haguessis teclejat: una cerca que
 * comencés per "=" es convertiria en una fórmula. Les altres cel·les es
 * comporten com sempre (la data es continua llegint com a data).
 */
function escriureFila(full, fila, columnesDeText) {
  columnesDeText = columnesDeText || COLUMNES_DE_TEXT;
  var numFila = full.getLastRow() + 1;

  // setValues no afegeix files com feia appendRow: si el full s'ha acabat, se'n
  // fan de noves.
  if (numFila > full.getMaxRows()) {
    full.insertRowsAfter(full.getMaxRows(), 1000);
  }

  for (var i = 0; i < columnesDeText.length; i++) {
    full.getRange(numFila, columnesDeText[i]).setNumberFormat('@');
  }
  full.getRange(numFila, 1, 1, fila.length).setValues([fila]);
}

function resposta(text) {
  return ContentService.createTextOutput(text);
}
