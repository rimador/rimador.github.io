/**
 * Google Apps Script per rebre les puntuacions del joc i apuntar-les a un full
 * de calcul. Es el mateix patro que fa servir la web per registrar cerques.
 *
 * COM ES MUNTA
 * 1. Crea un full de calcul nou a Google Sheets. A la primera fila, posa-hi
 *    aquestes capceleres (exactament, respecta accents i majuscules):
 *
 *      Data | Sobrenom | Mode | Dificultat | Segons | Punts | Paraula | Usuari
 *
 * 2. Extensions > Apps Script. Enganxa-hi aquest fitxer sencer.
 * 3. Desa i fes Desplega > Nou desplegament > Tipus: Aplicacio web.
 *      - Executa com a: tu mateix.
 *      - Qui hi te acces: Qualsevol.
 *    Copia l'URL que acaba en /exec i posa'l a URL_ENVIAMENT de
 *    joc/js/classificacio.js.
 * 4. Al full: Fitxer > Comparteix > Publica a la web > tot el full en CSV.
 *    Copia aquell URL i posa'l a URL_FULL_CSV de
 *    joc/eines/compilar_classificacio.py.
 *
 * A partir d'aqui, cada partida enviada s'apunta al full; quan executis el
 * compilador, els millors resultats surten a la pantalla de classificacio.
 */

// Mateixes regles basiques que el client i el compilador.
var LLARG_MIN = 2;
var LLARG_MAX = 16;
var VETADES = ['merda', 'puta', 'puto', 'collo', 'cabro', 'nazi', 'hitler', 'admin', 'moderador'];

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    var sobrenom = String(p.sobrenom || '').trim().replace(/\s+/g, ' ');
    var punts = parseInt(p.punts, 10);

    if (!validaSobrenom(sobrenom) || isNaN(punts) || punts < 0 || punts > 10000) {
      return resposta({ ok: false, motiu: 'dades invalides' });
    }

    var full = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    full.appendRow([
      Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM/yyyy HH:mm:ss'),
      sobrenom,
      String(p.mode || ''),
      String(p.dificultat || ''),
      String(p.segons || ''),
      punts,
      String(p.paraula || ''),
      String(p.usuari || '')
    ]);

    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, motiu: String(err) });
  }
}

function validaSobrenom(s) {
  if (s.length < LLARG_MIN || s.length > LLARG_MAX) return false;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(s)) return false;
  var pla = s.toLowerCase();
  for (var i = 0; i < VETADES.length; i++) {
    if (pla.indexOf(VETADES[i]) !== -1) return false;
  }
  return true;
}

function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
