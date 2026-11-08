// Backend de la classificació del joc: apunta al full cada puntuació que arriba.
//
// Enganxa'l a Extensions > Apps Script del full de càlcul i desplega'l com a
// aplicació web (executa com: jo; accés: qualsevol). L'URL /exec va a
// URL_ENVIAMENT de joc/js/classificacio.js.
//
// EL FULL NO HA D'ESTAR PUBLICAT AL WEB: lliga cada sobrenom amb l'identificador
// de l'usuari. compilar_classificacio.py el demana a aquest mateix script amb
// una clau (vegeu llegirFull), que és a Configuració del projecte > Propietats
// de l'script, amb el nom CLAU_LECTURA. És la mateixa que el secret
// CLAU_LECTURA_FULLS de GitHub.
//
// I RECORDA DESPLEGAR: l'aplicació web serveix la versió DESPLEGADA, no pas la
// que tens desada a l'editor. Cal Desplega > Gestiona els desplegaments >
// editar el desplegament > versió nova.
//
// ESCRIU PER NOM DE COLUMNA, no per posició. Abans feia un appendRow() amb els
// valors en un ordre fix, i això vol dir que el full i aquest fitxer s'han de
// posar d'acord sense que ni l'un ni l'altre ho puguin comprovar: el dia que al
// full li faltava una columna (la DataPartida, per exemple, que es va afegir
// després), tot el que venia darrere quedava desplaçat una casella i el
// compilador llegia les dades barrejades sense adonar-se'n. Ara es llegeix la
// fila 1, es fa quadrar cada valor amb el seu títol i, si en falta cap, S'AFEGEIX
// SOLA al final. O sigui que per estrenar la DataPartida n'hi ha prou de tornar
// a desplegar aquest script: no s'ha de tocar el full a mà.
//
// LES COLUMNES, en l'ordre en què es creen si el full és buit:
//
//   Data | DataPartida | Sobrenom | Mode | Dificultat | Segons | Dialecte |
//   Punts | Paraula | Usuari
//
// Hi ha DUES dates a posta:
//   Data         quan ha arribat l'enviament (la posa el servidor de Google)
//   DataPartida  de quin dia era la partida (la diu el navegador)
//
// No són la mateixa cosa: qui juga la paraula del dia a les 23.55 i l'envia a
// les 00.05 ha jugat la d'ahir. El rànquing per dia de
// compilar_classificacio.py agrupa per DataPartida, que és la que ho diu bé; la
// Data serveix per veure quan va passar de debò i per desempatar.
//
// El dia de la partida el compta el joc en horari de Catalunya (vegeu avui() a
// joc/js/magatzem.js) i aquí s'apunta l'arribada en el mateix fus: les dues
// dates parlen del mateix rellotge.
//
// -------------------------------------------------------------------------
// SEGURETAT
// -------------------------------------------------------------------------
// L'adreça /exec és pública (la té qualsevol que obri el joc/js/classificacio.js)
// i un Apps Script no pot saber qui l'hi crida: no veu ni l'IP ni l'origen. Per
// això no es fia de res del que arriba, i fa dues coses:
//
//   1. VALIDA CADA CAMP amb les regles del joc: el mode, la dificultat i el
//      rellotge han de ser un dels que existeixen; el sobrenom, amb la mateixa
//      forma que li exigeix el navegador; el dia de la partida, una data real i
//      recent; i els punts, creïbles per al temps que dura la partida. Una
//      puntuació que no ho compleix es rebutja sencera i no s'apunta.
//
//   2. NO DEIXA QUE EL FULL INTERPRETI RES COM A FÓRMULA: el text lliure
//      (sobrenom i paraula) s'escriu com a text pla.
//
// El que NO es pot evitar des d'aquí: el joc corre al navegador, o sigui que
// ningú no pot comprovar que una partida s'hagi jugat de veritat. Qui enviï una
// puntuació creïble amb un sobrenom qualsevol la veurà al full. El tall dels
// punts per segon (MAX_PUNTS_PER_SEGON) només fa que el pitjor cas sigui una
// puntuació alta però possible, no pas "10000". Si hi ha trampa, s'esborra la
// fila del full: el compilador ja ho recull tot de nou cada vegada.

var FUS = 'Europe/Madrid';

// L'ordre en què es creen les columnes si el full encara no en té cap. Si ja en
// té, mana el que digui la fila 1 i aquí només se n'afegeixen les que faltin.
var CAPCALERES = ['Data', 'DataPartida', 'Sobrenom', 'Mode', 'Dificultat',
                  'Segons', 'Dialecte', 'Punts', 'Paraula', 'Usuari'];

// Les columnes amb text lliure o de valors fixos: s'hi escriu com a text pla
// perquè el full no les interpreti mai com a fórmula.
var COLUMNES_DE_TEXT = ['Sobrenom', 'Mode', 'Dificultat', 'Dialecte', 'Paraula', 'Usuari'];

// --- Què és una partida possible ---------------------------------------------
// Si s'afegeix un mode o un rellotge nou al joc, cal afegir-lo aquí TAMBÉ: fins
// que no es faci, aquest script en rebutjarà les puntuacions (i el navegador no
// ho sabrà, perquè envia en mode 'no-cors' i no llegeix la resposta).
var MODES = ['illimitat', 'diaria'];
var DIFICULTATS = ['facil', 'dificil'];
// Els rellotges de l'il·limitat (vegeu les opcions de temps de joc/index.html)...
var SEGONS_PERMESOS = [30, 60, 120];
// ...i el de la paraula del dia (SEGONS_DIARIA a joc/js/principal.js).
var SEGONS_DIARIA = 60;

// El rècord vist és de 68 punts en 120 s (0,57 per segon). Amb 1,5 hi ha marge
// de sobra per a qui sigui molt ràpid i, en canvi, no hi caben puntuacions
// inventades. Si algun dia es canvia la manera de puntuar, aquest és el número
// a revisar.
var MAX_PUNTS_PER_SEGON = 1.5;

// Quants dies enrere es dóna per bona una partida: una puntuació que va quedar
// sense enviar per falta de connexió (vegeu les pendents a classificacio.js)
// pot arribar dies tard.
var MAX_DIES_ENRERE = 30;

// El sobrenom: la mateixa forma que exigeix validarSobrenom() a classificacio.js.
var SOBRENOM_MIN = 3;
var SOBRENOM_MAX = 16;
var SOBRENOM_CARACTERS = /^[\p{L}\p{N} _.\-]+$/u;
var MAX_PARAULA = 40;

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    if (p.tipus === 'llegir') {
      return llegirFull(p);
    }

    var partida = validar(p);
    if (partida.motiu) {
      return resposta({ ok: false, motiu: partida.motiu });
    }

    // El pany fa que dues puntuacions simultànies no triïn la mateixa "última
    // fila" i es trepitgin.
    var pany = LockService.getScriptLock();
    if (!pany.tryLock(10000)) {
      return resposta({ ok: false, motiu: 'massa feina, torna-ho a provar' });
    }
    try {
      var full = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      escriureFila(full, partida.valors);
    } finally {
      pany.releaseLock();
    }

    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, motiu: String(err) });
  }
}

/**
 * Comprova una puntuació. Torna {motiu} si no és vàlida (el motiu diu quin camp
 * falla) o {usuari, valors} amb el que s'ha d'escriure a cada columna.
 */
function validar(p) {
  // usr_<temps en base 36>_<cinc lletres>, que és com el fabrica usuariID(); o
  // usr_anonim, que és el que posa quan el navegador no deixa desar res. Hi ha
  // també identificadors del format antic ("usuari_12345") desats al
  // localStorage de qui va entrar fa temps: només es miren els caràcters.
  var usuari = String(p.usuari || '');
  if (!/^[a-z0-9_]{3,48}$/.test(usuari)) return { motiu: 'usuari' };

  var mode = String(p.mode || '');
  if (MODES.indexOf(mode) === -1) return { motiu: 'mode' };

  var dificultat = String(p.dificultat || '');
  if (DIFICULTATS.indexOf(dificultat) === -1) return { motiu: 'dificultat' };

  var segons = String(p.segons || '');
  var valids = (mode === 'diaria') ? [SEGONS_DIARIA] : SEGONS_PERMESOS;
  if (!/^\d{1,3}$/.test(segons) || valids.indexOf(parseInt(segons, 10)) === -1) {
    return { motiu: 'segons' };
  }
  segons = parseInt(segons, 10);

  // Com a molt els punts que caben en aquest temps (vegeu MAX_PUNTS_PER_SEGON).
  var puntsText = String(p.punts || '');
  if (!/^\d{1,5}$/.test(puntsText)) return { motiu: 'punts' };
  var punts = parseInt(puntsText, 10);
  if (punts > Math.ceil(segons * MAX_PUNTS_PER_SEGON)) return { motiu: 'punts' };

  var sobrenom = String(p.sobrenom || '').replace(/\s+/g, ' ').trim();
  if (sobrenom.length < SOBRENOM_MIN || sobrenom.length > SOBRENOM_MAX ||
      !SOBRENOM_CARACTERS.test(sobrenom)) {
    return { motiu: 'sobrenom' };
  }

  // El dialecte: dues o tres lletres. NO es comprova que sigui un dels quatre
  // d'ara, a posta: el dia que s'afegeixi un dialecte nou, una llista escrita
  // aquí tiraria a les escombraries les seves puntuacions sense dir-ho.
  var dialecte = String(p.dialecte || '');
  if (!/^[a-z]{2,3}$/.test(dialecte)) return { motiu: 'dialecte' };

  // El dia de la partida: una data que existeixi, d'avui o fa com a molt un mes.
  // Es deixa passar fins a demà per si el rellotge del mòbil va avançat.
  var dataPartida = String(p.data || '');
  if (!dataValida(dataPartida)) return { motiu: 'data' };
  if (dataPartida > diaRelatiu(1) || dataPartida < diaRelatiu(-MAX_DIES_ENRERE)) {
    return { motiu: 'data' };
  }

  return {
    usuari: usuari,
    valors: {
      'Data': Utilities.formatDate(new Date(), FUS, 'dd/MM/yyyy HH:mm:ss'),
      'DataPartida': dataPartida,
      'Sobrenom': sobrenom,
      'Mode': mode,
      'Dificultat': dificultat,
      'Segons': segons,
      'Dialecte': dialecte,
      'Punts': punts,
      'Paraula': net(p.paraula, MAX_PARAULA),
      'Usuari': usuari
    }
  };
}

/** AAAA-MM-DD i que el dia existi (res de 2026-02-31). */
function dataValida(text) {
  var tros = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!tros) return false;
  var d = new Date(Date.UTC(+tros[1], +tros[2] - 1, +tros[3]));
  return d.getUTCFullYear() === +tros[1] &&
         d.getUTCMonth() === +tros[2] - 1 &&
         d.getUTCDate() === +tros[3];
}

/** El dia d'avui més (o menys) tants dies, en AAAA-MM-DD i en horari de Catalunya. */
function diaRelatiu(dies) {
  var instant = new Date(new Date().getTime() + dies * 86400000);
  return Utilities.formatDate(instant, FUS, 'yyyy-MM-dd');
}

/**
 * Neteja un text lliure: treu els caràcters de control, els invisibles i els que giren la direcció
 * del text (que serveixen per fer passar una cosa per una altra), els < >,
 * ajunta els
 * espais i el talla a la llargada màxima.
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
 * Escriu la fila a sota de tot, amb cada valor sota el seu títol, i crea els
 * títols que faltin. Ha d'anar dins del pany.
 *
 * Fa servir getRange().setValues() i no pas appendRow() perquè així es pot dir,
 * ABANS d'escriure, que les columnes de text són text pla: amb appendRow el full
 * interpreta el que arriba com si ho haguessis teclejat, i un sobrenom que
 * comencés per "=" o "-" seria una fórmula. Les altres cel·les es comporten com
 * sempre.
 */
function escriureFila(full, valors) {
  var capcalera = capcaleraDelFull(full);

  var numFila = full.getLastRow() + 1;
  // setValues no afegeix files com feia appendRow: si el full s'ha acabat, se'n
  // fan de noves.
  if (numFila > full.getMaxRows()) {
    full.insertRowsAfter(full.getMaxRows(), 1000);
  }

  var fila = capcalera.map(function (nom) {
    return valors.hasOwnProperty(nom) ? valors[nom] : '';
  });

  capcalera.forEach(function (nom, i) {
    if (COLUMNES_DE_TEXT.indexOf(nom) !== -1) {
      full.getRange(numFila, i + 1).setNumberFormat('@');
    }
  });
  full.getRange(numFila, 1, 1, fila.length).setValues([fila]);
}

/**
 * Els títols de la fila 1, amb els que faltin ja afegits.
 *
 * Una columna que el full tingui i que aquí no sapiguem omplir (una que hi hagi
 * afegit algú a mà) es deixa buida en comptes de desplaçar-ho tot.
 */
function capcaleraDelFull(full) {
  var columnes = full.getLastColumn();

  // Full acabat de fer: se li escriu la capçalera sencera.
  if (columnes === 0) {
    full.getRange(1, 1, 1, CAPCALERES.length).setValues([CAPCALERES]);
    full.setFrozenRows(1);
    return CAPCALERES.slice();
  }

  var capcalera = full.getRange(1, 1, 1, columnes).getValues()[0]
    .map(function (casella) { return String(casella).trim(); });

  // Les que falten, al final. Al final i no a la posició "bona" a posta: moure
  // columnes voldria dir moure totes les files que ja hi ha, i el compilador
  // llegeix el CSV per nom de columna i no per posició (vegeu COLUMNES i
  // COLUMNES_NOVES a compilar_classificacio.py), o sigui que l'ordre li és ben
  // igual.
  var afegides = [];
  for (var i = 0; i < CAPCALERES.length; i++) {
    if (capcalera.indexOf(CAPCALERES[i]) === -1) afegides.push(CAPCALERES[i]);
  }
  if (afegides.length > 0) {
    full.getRange(1, capcalera.length + 1, 1, afegides.length)
        .setValues([afegides]);
    capcalera = capcalera.concat(afegides);
  }

  return capcalera;
}

/**
 * Torna el full sencer en CSV a qui dugui la clau (stats/llegir_full.py).
 *
 * La clau no és al codi, que és públic: és a les Propietats de l'script, amb el
 * nom CLAU_LECTURA. Si no n'hi ha cap, o és curta, no es deixa llegir a ningú.
 * getDisplayValues() dóna cada cel·la tal com es veu, que és el mateix que
 * sortia quan el full estava publicat al web.
 */
function llegirFull(p) {
  var bona = PropertiesService.getScriptProperties().getProperty('CLAU_LECTURA');
  if (!bona || bona.length < 32 || String(p.clau || '') !== bona) {
    return resposta({ ok: false, motiu: 'clau' });
  }
  var full = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var files = full.getDataRange().getDisplayValues();
  var linies = [];
  for (var i = 0; i < files.length; i++) {
    linies.push(files[i].map(casellaCsv).join(','));
  }
  return ContentService.createTextOutput(linies.join('\n') + '\n')
    .setMimeType(ContentService.MimeType.CSV);
}

function casellaCsv(valor) {
  var text = String(valor);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
