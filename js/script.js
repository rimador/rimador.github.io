//DEBUG
const debugLevel = 0; // 0 = Off, 1 = Goatcounter, 2 = Errors, 3 = Logs, 4 = Temps

const Debug = {
    log: debugLevel >= 3 ? (label) => console.log(`[DEBUG] ${label}`) : () => {},
    logError: debugLevel >= 2 ? (...args) => console.error('[ERROR]', ...args) : () => {},
    logTime: debugLevel >= 4 ? (label) => console.time(`[TIMER] ${label}`) : () => {},
    logTimeEnd: debugLevel >= 4 ? (label) => console.timeEnd(`[TIMER] ${label}`) : () => {},
    contador: debugLevel >= 1 ? (label) => console.log(`[COUNTER] ${label}`) : () => {},
};

if (debugLevel >= 3) {
  window.addEventListener('DOMContentLoaded', () => {
    const boto = document.getElementById("botoNetejarCache");
    if (boto) boto.style.display = "block";
  });
}

// ============================================================= //
// LOADER
//
// Ensenyar el loader no és tan senzill com posar-li display i prou. El
// navegador té un sol fil per a la nostra feina i per a pintar: si li
// diem que ensenyi el loader i tot seguit ens passem tres segons
// escrivint HTML, no arriba a pintar res fins que hem acabat, i el
// loader s'ensenya i s'amaga dins el mateix fotograma. O sigui, com si
// no hi fos. Per això Loader.mentre() espera dos fotogrames abans de
// posar-se a treballar: el primer es programa abans del pròxim pintat i
// el segon no arriba fins que aquell pintat ja s'ha entregat a pantalla.
//
// La pila serveix per als encavallaments: una cerca demana el loader i,
// a mitges, la càrrega de les transcripcions el torna a demanar. Si el
// de dins l'apagués en acabar, la cerca es quedaria fent la feina grossa
// amb la pantalla destapada i tornaríem a on érem.
const Loader = {
  _pila: [],

  _pintar() {
    const caixa = document.getElementById('loader');
    if (!caixa) return;
    const text = document.getElementById('loader-text2');

    if (this._pila.length) {
      if (text) text.textContent = this._pila[this._pila.length - 1];
      caixa.style.display = '';
    } else {
      caixa.style.display = 'none';
      if (text) text.textContent = '';
    }
  },

  // Espera que el navegador hagi dibuixat de debò. El primer
  // requestAnimationFrame es programa abans del pròxim pintat i el segon
  // no arriba fins que aquell pintat ja s'ha entregat a la pantalla.
  //
  // Ara bé: si la pestanya no es veu (l'usuari ha canviat de pestanya o
  // ha abaixat la finestra), el navegador no dibuixa i aquests avisos no
  // arriben mai. Sense les dues sortides d'emergència d'aquí sota, la
  // cerca es quedaria esperant un fotograma que no ha de venir i no
  // arrencaria fins que algú tornés a mirar la pàgina.
  _dosFotogrames() {
    if (document.hidden) return Promise.resolve();

    return new Promise(resolve => {
      let fet = false;
      const acabar = () => { if (!fet) { fet = true; resolve(); } };

      requestAnimationFrame(() => requestAnimationFrame(acabar));
      setTimeout(acabar, 200); // per si els fotogrames no arriben igualment
    });
  },

  // Ensenya el loader, fa la feina i el treu passi el que passi.
  async mentre(missatge, feina) {
    this._pila.push(missatge);
    this._pintar();
    await this._dosFotogrames();

    try {
      return await feina();
    } finally {
      this._pila.pop();
      this._pintar();
    }
  },

  // Per a les estones en què la pàgina espera que l'usuari decideixi (el
  // diàleg d'homògrafs): el loader hi fa nosa, i deixar-lo donant voltes
  // al darrere fa pensar que la pàgina encara està carregant. El treu
  // mentre duri l'espera i el torna a deixar com estava.
  async apartat(feina) {
    const desada = this._pila;
    this._pila = [];
    this._pintar();

    try {
      return await feina();
    } finally {
      this._pila = desada;
      this._pintar();
      if (this._pila.length) await this._dosFotogrames();
    }
  }
};

// ============================================================= //

// PARAULES NÀUFRAGUES
//
// Una paraula és nàufraga quan no rima consonantment amb cap altra: el seu grup
// de rima només la conté a ella, encara que hi surti diverses vegades amb codis
// diferents.
//
// Abans això es mirava en un paraules_naufragues.json de 3,9 MB que es baixava
// a CADA visita (anava amb ?t=Date.now(), o sigui que no es cachejava mai).
// Amb la memòria cau calenta era gairebé l'única cosa que quedava per baixar.
//
// Però la resposta ja la tenim: l'índex de rimes diu quines files comparteixen
// rima amb la paraula cercada, i mirar-ne les poques que són (47 de mitjana) és
// instantani. La llista només la necessita la pàgina que les ensenya totes.
let paraulaEsNaufraga = false;

function calcularSiEsNaufraga(fila) {
  if (fila < 0 || !indexConsonant) return false;

  const rima = col3.idx[fila];
  const paraula = array0[fila].toLowerCase();
  const { inici, files } = indexConsonant;

  for (let k = inici[rima]; k < inici[rima + 1]; k++) {
    if (array0[files[k]].toLowerCase() !== paraula) return false;
  }
  return true;
}


//gestió de versions
let VERSIONS_FITXERS = {};

// Quins dialectes tenen apendix. No hi ha cap llista a part: un apendix es
// reconeix perquè la seva col_0 és al versions.json, i el versions.py només
// n'hi posa quan la carpeta hi és de debò (vegeu-hi te_apendix). Així no hi ha
// dos llocs que puguin dir coses diferents sobre el mateix.
//
// Si el versions.json no s'ha pogut llegir mai (primera visita sense xarxa),
// això dirà que no n'hi ha cap i se cercarà només sobre el diccionari. És a
// posta: val més un rimador que va amb menys paraules que no pas una pàgina
// que es planta demanant fitxers que no sap si existeixen.
function teApendix(codi) {
  return Boolean(VERSIONS_FITXERS[`col_0_${codi}.txt`]);
}

// Els resums de l'última vegada que el versions.json es va llegir bé. Fa un
// parell de quilobytes: hi cap de sobres al localStorage.
const CLAU_VERSIONS = 'rimadorVersions';

async function carregarVersions() {
  try {
    const resposta = await fetch(`${ARREL}diccionaris/versions.json?t=${Date.now()}`);
    const dades = await resposta.json();

    // La versió de cada columna és un resum del seu contingut, calculat
    // pels workflows amb diccionaris/generar_versions.py. Cada columna es
    // refresca exactament quan el seu fitxer ha canviat: ni abans (com
    // passava quan una columna reescrita mantenia el número vell i es
    // barrejaven generacions del diccionari) ni de més.
    if (!dades.columnes) throw new Error("versions.json no porta la llista de columnes");

    VERSIONS_FITXERS = dades.columnes;
    console.log("Versions carregades correctament:", VERSIONS_FITXERS);

    // Desats per a la pròxima visita que no tingui xarxa (vegeu el catch).
    try {
      localStorage.setItem(CLAU_VERSIONS, JSON.stringify(dades.columnes));
    } catch (err) {
      // Mode privat o disc ple: no és cap problema, només vol dir que la
      // pròxima visita sense xarxa no tindrà de què estirar.
    }
  } catch (err) {
    // Aquí hi arribem sense xarxa, però també si el servidor respon malament
    // o el fitxer ve romput. En tots tres casos, els resums de l'última
    // vegada valen més que no res:
    //
    // El que hi ha desat a IndexedDB s'hi va guardar amb AQUESTS resums. Si
    // els donem per bons, cada columna es llegeix de la còpia local i el que
    // se serveix és una generació sencera i coherent del diccionari —
    // l'última que es va baixar bé—, encara que entretant se n'hagi publicat
    // una de més nova. Quan torni la xarxa, el fetch de dalt se'n surt, els
    // resums canvien i llavors només es rebaixa el que hagi canviat de debò.
    //
    // Abans això es deixava buit, i llavors llegirFitxerAmbIndexedDB no es
    // fiava de cap còpia i les demanava totes al servidor: sense xarxa no en
    // podia baixar ni una i la pàgina es quedava en blanc amb el diccionari
    // sencer al disc sense fer-se servir.
    try {
      const desades = localStorage.getItem(CLAU_VERSIONS);
      if (desades) {
        VERSIONS_FITXERS = JSON.parse(desades);
        console.warn("No s'ha pogut llegir el versions.json: es faran servir els resums de l'última vegada", err);
        return;
      }
    } catch (err2) {
      // El localStorage no s'hi pot llegir o el que hi havia no és JSON:
      // es continua avall, com si no hi hagués hagut mai cap visita bona.
    }

    // Primera visita sense xarxa, o localStorage barrat: no hi ha res desat
    // de què fiar-se. Es deixa la llista buida i cada columna es demana al
    // servidor sense desar-ne còpia (vegeu llegirFitxerAmbIndexedDB).
    console.error("Error carregant versions.json: es baixarà tot el diccionari sense memòria cau", err);
    VERSIONS_FITXERS = {};
  }
}


//INICI

// array0 (les paraules) és una llista de text de tota la vida. La resta de
// columnes van internades: en lloc de repetir el mateix text milers de
// vegades, cadascuna és { taula, idx }, amb els valors diferents a la taula i
// un número per fila que hi apunta. Guardades així ocupen 11,6 MB en comptes
// de 111 (vegeu generar_columnes_internades.py).
let array0;

let col1, col2, col3, col4, col5, col6, col7, col8;

// Les tres últimes columnes són sí/no (surt al Viccionari, a la Viquipèdia, al
// DIEC). Tres arrays d'un byte per fila per guardar tres bits és malbaratar-ne
// vint-i-un: aquí van totes tres al mateix byte. Val null si algun dia alguna
// d'aquestes columnes deixa de tenir només dos valors, i llavors es llegeixen
// com les altres.
let banderes = null;

// Per a cada rima, quines files la tenen (vegeu indexarPerRima).
let indexConsonant = null;
let indexAssonant = null;

// Lectors de les columnes internades: tornen el text de sempre a partir del
// número que hi ha guardat a cada fila.
const t1 = i => col1.taula[col1.idx[i]];
const t2 = i => col2.taula[col2.idx[i]];
const t3 = i => col3.taula[col3.idx[i]];
const t4 = i => col4.taula[col4.idx[i]];
const t5 = i => col5.taula[col5.idx[i]];
const t6 = i => (banderes ? col6.taula[banderes[i] & 1] : col6.taula[col6.idx[i]]);
const t7 = i => (banderes ? col7.taula[(banderes[i] >> 1) & 1] : col7.taula[col7.idx[i]]);
const t8 = i => (banderes ? col8.taula[(banderes[i] >> 2) & 1] : col8.taula[col8.idx[i]]);

// col_9 (les transcripcions senceres) no hi és, i no s'hi baixa mai: fa 73 MB
// i quatre milions de línies. L'única cosa que en necessitava el web era el
// diàleg d'homògrafs, i per a saber-ho ja n'hi ha prou amb els números de rima
// de col_3 i col_4, que es carreguen igualment per cercar (vegeu buscarParaula).
const CAMI_PARAULES = `${ARREL}diccionaris/separat/col_0.txt`;

// La paraula, el lema, el codi, les síl·labes i els tres enllaços són les
// mateixes es parli com es parli, i continuen a separat/.
const COLUMNES_DEL_DICCIONARI = [1, 2, 5, 6, 7, 8];

// La rima, en canvi, ja no és al diccionari: depèn de com es parli i cada
// dialecte té la seva a dialectes_col/<codi>/.
const COLUMNES_DE_RIMA = [3, 4];

// L'APENDIX D'UN DIALECTE
//
// Un dialecte no és només una manera de dir el mateix diccionari: també és una
// llista de paraules diferent. "Cante", "servisc" o "tenc" no es diuen a tot
// arreu, i no poden ser al diccionari general perquè allà hi són totes les
// files a tots els dialectes. Per això cada dialecte pot dur, a més de la
// transcripció del diccionari, un apendix amb les seves paraules pròpies:
// dialectes_col/<codi>/apendix/ (vegeu diccionaris/README.md).
//
// L'apendix té les mateixes columnes que el diccionari i, a més, la seva
// pròpia rima (col_3 i col_4): les seves paraules no són al trans_dicc i per
// tant no en tenen allà. Per això aquí n'hi ha vuit i a dalt n'hi ha sis.
//
// Es cerca sobre les dues meitats juntes (vegeu compondreDiccionari), o sigui
// que qui rima "cantes" en valencià hi troba "cante", i qui hi cerca "cante"
// hi troba tot el que hi rima del diccionari.
const COLUMNES_DE_LAPENDIX = [1, 2, 3, 4, 5, 6, 7, 8];

function camiParaulesDeLApendix(codi) {
  return `${ARREL}dialectes_col/${codi}/apendix/col_0_${codi}.txt`;
}

// Quins dialectes hi ha. Surten de la llista DIALECTES de js/components.js,
// que és la mateixa que pinta les pastilles de la tira: així el que es baixa i
// el que es pot triar no poden dir coses diferents mai. Afegir-hi el
// rossellonès és tocar aquella llista i res més.
//
// El fallback és per a les pàgines que carreguen aquest fitxer sense passar
// pel components.js: allà no hi ha cap tira per triar res i el central és
// l'únic que fa falta.
const CODIS_DE_DIALECTE = (typeof DIALECTES !== 'undefined') ? DIALECTES.map(d => d.codi) : ['ca'];

// Com es diu el dialecte quan s'ha d'escriure DINS d'una frase, que ara mateix
// només passa al piulet (vegeu actualitzarBotoCompartir). Surt de la mateixa
// llista DIALECTES que les pastilles, per no tenir dos llocs on canviar-ho,
// amb dos retocs:
//
// - sense l'asterisc, que a la pastilla vol dir "transcripció encara per
//   repassar" (vegeu dialectes.html) i enmig d'una frase no diria res;
// - i en minúscula, que és com hi va: "té 34 rimes en dialecte central!".
//
// Un codi que no sigui a la llista torna el codi pelat, com el nomDialecte del
// joc (joc/js/ui.js): val més un piulet que digui "ba" que no pas cap piulet.
function nomDelDialecte(codi) {
  const trobat = (typeof DIALECTES !== 'undefined')
    ? DIALECTES.find(d => d.codi === codi)
    : null;
  return trobat ? trobat.nom.replace('*', '').trim().toLowerCase() : codi;
}

// El de sempre: l'únic amb la transcripció repassada a mà (els altres surten
// de l'espeak-ng) i el que es dona a qui no ha triat mai res. És el CENTRAL de
// diccionaris/python/camins.py.
const DIALECTE_PER_DEFECTE = 'ca';

// La tria es recorda entre visites, igual que el tema (vegeu THEME_STORAGE_KEY).
const CLAU_DIALECTE = 'rimadorDialecte';

// El dialecte demanat per l'adreça: rimador.cat/?d=ba
//
// Hi mana per damunt del que hi hagi desat, i és el que fa que una cerca
// enviada a algú li ensenyi el mateix que veia qui l'hi va enviar. Sense això,
// el ?q= de l'actualitzarBotoCompartir donaria a cadascú els resultats del
// dialecte que ell tingués triat: una cerca compartida que no es pot reproduir
// és pitjor que no poder-la compartir.
//
// Un codi que no existeix s'ignora i s'agafa el de sempre, igual que el &rima=
// mal escrit del cercarDesDeLaURL: val més servir el de costum que plantar-se.
function dialecteDeLAdreca() {
  const demanat = new URLSearchParams(window.location.search).get('d');
  return CODIS_DE_DIALECTE.includes(demanat) ? demanat : null;
}

// D'on surt el dialecte de la visita, per ordre: l'adreça, el que hi havia
// desat, i el central.
//
// El de l'adreça NO es desa (vegeu desarDialecte): la memòria només l'escriu
// la tira. Obrir l'enllaç que t'ha passat algú val per a aquella visita i no
// t'ha de canviar el dialecte de sempre; qui no n'hagi triat mai cap, el
// pròxim cop tornarà a tenir el central, que és el que no havia triat.
function dialecteInicial() {
  const deLAdreca = dialecteDeLAdreca();
  if (deLAdreca) return deLAdreca;

  try {
    const desat = localStorage.getItem(CLAU_DIALECTE);
    if (CODIS_DE_DIALECTE.includes(desat)) return desat;
  } catch (err) {
    // Mode privat o cookies barrades: no és cap problema, s'agafa el de sempre.
  }
  return DIALECTE_PER_DEFECTE;
}

// Quin se serveix ara mateix. Canvia amb la tira de dialectes (vegeu
// lligarTriaDeDialecte, més avall).
let dialecteActiu = dialecteInicial();

// El diccionari general, un cop llegit: { paraules, columnes: { 1: {taula,
// idx}, 2: ..., 5, 6, 7, 8 } }. És el mateix es parli com es parli i es baixa
// una sola vegada.
let diccionariBase = null;

// El que s'ha baixat de cada dialecte, a mesura que s'ha anat demanant:
//
//   { ca: { rima: { 3: {taula, idx}, 4: {taula, idx} },
//           apendix: { paraules, columnes: { 1: {taula, idx}, ... 8 } } } }
//
// Ara només s'hi baixa el que se serveix, no pas tots quatre. Abans se'n
// baixava la rima de tots a l'inici perquè canviar de dialecte fos immediat,
// però amb els apendixs són uns 8 MB per dialecte i no pas 3,5, i tres quartes
// parts d'això no les mira mai ningú: la immensa majoria de visites no toquen
// la tira.
//
// El que sí que es guarda és el que ja s'ha baixat: tornar a un dialecte on
// s'havia estat no espera res. I entre visites tot va a IndexedDB igualment
// (vegeu llegirFitxerAmbIndexedDB), o sigui que el segon cop que algú tria el
// valencià no es baixa res de la xarxa encara que hagi tancat la pàgina.
const dadesPerDialecte = {};

// EL COMPTADOR DEL LOADER
//
// Es compta i no s'escriu a mà: el dia que hi hagi una columna més, o un
// dialecte sense apendix, això continuarà dient la veritat sense que ningú
// se n'hagi de recordar.
const FITXERS_DEL_DICCIONARI = 1 + COLUMNES_DEL_DICCIONARI.length * 2;

function fitxersDelDialecte(codi) {
  return COLUMNES_DE_RIMA.length * 2 +
         (teApendix(codi) ? 1 + COLUMNES_DE_LAPENDIX.length * 2 : 0);
}

// Es torna a posar a zero cada vegada que comença una càrrega —l'inicial i
// cada canvi de dialecte que hagi de baixar res—, perquè digui quants en
// falten d'ARA i no des que la pàgina es va obrir.
let fitxersLlegits = 0;
let nombresDeFitxers = FITXERS_DEL_DICCIONARI;

// Què diu el loader mentre baixa. El comptador s'hi enganxa darrere:
// "Carregant el valencià... (7/21)".
let textDeCarrega = 'Carregant fitxers';

function escriureComptador() {
  const loaderText2 = document.getElementById('loader-text2');
  if (loaderText2) {
    //+1 per si de cas es queda penjat, que no quedi 10/10
    loaderText2.textContent = `${textDeCarrega} (${fitxersLlegits}/${nombresDeFitxers + 1})`;
  }
}

function comencarComptador(quants, text) {
  fitxersLlegits = 0;
  nombresDeFitxers = quants;
  textDeCarrega = text;
  escriureComptador();
}

// Com es diu la columna de rima de cada dialecte. El codi va DINS del nom del
// fitxer i no només a la carpeta, a posta: la memòria cau i el versions.json
// s'indexen pel nom del fitxer sol (vegeu llegirFitxerAmbIndexedDB, que fa
// rutaFitxer.split("/").pop()), i el col_3.idx.txt del valencià i el del
// balear serien la mateixa entrada.
const NOMS_DE_RIMA = { 3: 'rimacons', 4: 'rimaass' };

function arrelDeLaColumna(numero, codi) {
  if (NOMS_DE_RIMA[numero]) {
    return `${ARREL}dialectes_col/${codi}/trans_dicc/internat/col_${numero}_${NOMS_DE_RIMA[numero]}_${codi}`;
  }
  return `${ARREL}diccionaris/separat/internat/col_${numero}`;
}

// Les de l'apendix. Duen un ".apendix" al nom, i no és decoració: la memòria
// cau i el versions.json s'indexen pel nom del fitxer sol (vegeu
// llegirFitxerAmbIndexedDB, que fa rutaFitxer.split("/").pop()), i el col_3 de
// l'apendix del valencià i el del seu trans_dicc serien la mateixa entrada.
function arrelDeLaColumnaDeLApendix(numero, codi) {
  return `${ARREL}dialectes_col/${codi}/apendix/internat/col_${numero}_${codi}.apendix`;
}

// El tipus surt de la mida de la taula i no es declara enlloc: així el dia que
// el diccionari creixi i una columna passi dels 65.536 valors diferents, això
// puja de tipus tot sol.
function menaDArray(quantsValors) {
  if (quantsValors <= 256) return Uint8Array;
  if (quantsValors <= 65536) return Uint16Array;
  return Uint32Array;
}

// Els índexs es llegeixen xifra a xifra cap a un array de mida fixa. No es fa
// servir split('\n') a posta: partiria el text en 619.783 objectes de text, que
// és exactament el que estem mirant de no tenir.
function textAIndexs(contingut, Tipus) {
  let files = 1;
  for (let i = 0; i < contingut.length; i++) {
    if (contingut.charCodeAt(i) === 10) files++;
  }

  const indexs = new Tipus(files);
  let valor = 0;
  let fila = 0;

  for (let i = 0; i < contingut.length; i++) {
    const codi = contingut.charCodeAt(i);
    if (codi === 10) {
      indexs[fila++] = valor;
      valor = 0;
    } else {
      valor = valor * 10 + (codi - 48);
    }
  }
  indexs[fila] = valor;

  return indexs;
}

// La taula va primer perquè és qui diu de quina mena ha de ser l'array dels
// índexs. Totes dues passen pel mateix llegirFitxerAmbIndexedDB que la resta,
// o sigui que hereten la memòria cau i el control de versions sense res especial.
async function carregarColumnaDesDe(arrel) {
  const taula = await llegirFitxerAmbIndexedDB(`${arrel}.taula.txt`);
  const Tipus = menaDArray(taula.length);
  const idx = await llegirFitxerAmbIndexedDB(`${arrel}.idx.txt`, contingut => textAIndexs(contingut, Tipus));
  return { taula, idx };
}

function carregarColumnaInternada(numero, codi) {
  return carregarColumnaDesDe(arrelDeLaColumna(numero, codi));
}

function carregarColumnaDeLApendix(numero, codi) {
  return carregarColumnaDesDe(arrelDeLaColumnaDeLApendix(numero, codi));
}

// El diccionari general: les paraules i les columnes que són iguals a tots els
// dialectes. Es baixa una vegada i no torna a canviar en tota la visita.
async function carregarDiccionariBase() {
  const llegit = await Promise.all([
    llegirFitxerAmbIndexedDB(CAMI_PARAULES),
    ...COLUMNES_DEL_DICCIONARI.map(numero => carregarColumnaInternada(numero))
  ]);

  const columnes = {};
  COLUMNES_DEL_DICCIONARI.forEach((numero, i) => { columnes[numero] = llegit[i + 1]; });
  return { paraules: llegit[0], columnes };
}

// Les dues meitats d'un dialecte: la rima del diccionari dita en aquest
// dialecte i, si en té, el seu apendix sencer. Tot en paral·lel: el navegador
// fa la cua ell sol i no hi ha cap fase que s'esperi l'anterior sense
// necessitat.
async function carregarDialecte(codi) {
  const rima = {};
  const feines = COLUMNES_DE_RIMA.map(async numero => {
    rima[numero] = await carregarColumnaInternada(numero, codi);
  });

  let apendix = null;
  if (teApendix(codi)) {
    apendix = { paraules: null, columnes: {} };

    feines.push((async () => {
      apendix.paraules = await llegirFitxerAmbIndexedDB(camiParaulesDeLApendix(codi));
    })());

    for (const numero of COLUMNES_DE_LAPENDIX) {
      feines.push((async () => {
        apendix.columnes[numero] = await carregarColumnaDeLApendix(numero, codi);
      })());
    }
  }

  await Promise.all(feines);
  return { rima, apendix };
}

// Per a cada rima, les files que la tenen, amb dos arrays plans en lloc d'un
// array d'arrays: `inici` diu on comença cada grup dins de `files`, i `files`
// són els números de fila seguits, agrupats per rima. Deu mil arrays petits
// serien deu mil objectes i molta memòria de capçaleres.
//
// Dins de cada grup les files queden en ordre creixent, perquè s'omple
// recorrent el diccionari de dalt a baix. Això importa: és el que fa que les
// rimes surtin en el mateix ordre que quan es mirava el diccionari sencer.
function indexarPerRima(columna) {
  const quantesRimes = columna.taula.length;
  const inici = new Uint32Array(quantesRimes + 1);

  for (let i = 0; i < columna.idx.length; i++) inici[columna.idx[i] + 1]++;
  for (let r = 0; r < quantesRimes; r++) inici[r + 1] += inici[r];

  const files = new Uint32Array(columna.idx.length);
  const posicio = inici.slice(0, quantesRimes);
  for (let i = 0; i < columna.idx.length; i++) files[posicio[columna.idx[i]]++] = i;

  return { inici, files };
}

// El que es prepara un cop, en compondre el diccionari, i estalvia feina a
// cada cerca.
function prepararColumnes() {
  // Les tres banderes al mateix byte. El bit que ocupa cadascuna és el mateix
  // número que ja tenia a la seva taula, o sigui que llegir-lo torna el text bo.
  // El col6.idx i companyia es deixen anar aquí sota, i per això el
  // compondreDiccionari els torna a fer de nou cada vegada: aquestes columnes
  // són seves, no pas les del diccionariBase, que no s'han de tocar mai.
  if (col6.idx && col7.idx && col8.idx &&
      col6.taula.length <= 2 && col7.taula.length <= 2 && col8.taula.length <= 2) {
    const empaquetades = new Uint8Array(col6.idx.length);
    for (let i = 0; i < empaquetades.length; i++) {
      empaquetades[i] = col6.idx[i] | (col7.idx[i] << 1) | (col8.idx[i] << 2);
    }
    banderes = empaquetades;
    col6.idx = col7.idx = col8.idx = null; // ja no calen
  }
}

// AJUNTAR UNA COLUMNA DEL DICCIONARI AMB LA MATEIXA COLUMNA DE L'APENDIX
//
// Les dues meitats estan internades PER SEPARAT, i per tant els seus números
// no volen dir el mateix: la taula de la col_6 del diccionari és
// ['NO', 'Vicc'] i la de l'apendix és ['Vicc', 'NO']. Enganxar els índexs tal
// com són faria dir a cada paraula de l'apendix el contrari del que diu.
//
// Per això es fa una taula de debò: la del diccionari, i darrere els valors de
// l'apendix que no hi fossin. Els que ja hi són es queden amb el número que
// tenien. Això és el que fa que la rima funcioni entre meitats: si la col_3 de
// l'apendix diu "aɾa" i la del diccionari també, totes dues acaben amb el
// mateix número i les paraules rimen. Si es fes de qualsevol altra manera,
// "cante" no rimaria amb res del diccionari i l'apendix seria un rimador a
// part.
//
// Torna sempre un objecte NOU, encara que no hi hagi apendix: el
// prepararColumnes hi escriu (hi buida els idx de les banderes) i el
// diccionariBase ha de quedar tal com estava per a la pròxima composició.
function ajuntarColumnes(delDiccionari, delApendix) {
  if (!delApendix) return { taula: delDiccionari.taula, idx: delDiccionari.idx };

  const taula = delDiccionari.taula.slice();
  const on = new Map();
  for (let i = 0; i < taula.length; i++) {
    if (!on.has(taula[i])) on.set(taula[i], i);
  }

  const equivalencia = new Uint32Array(delApendix.taula.length);
  for (let i = 0; i < delApendix.taula.length; i++) {
    const valor = delApendix.taula[i];
    let numero = on.get(valor);
    if (numero === undefined) {
      numero = taula.length;
      taula.push(valor);
      on.set(valor, numero);
    }
    equivalencia[i] = numero;
  }

  // El tipus es torna a triar amb la taula ja ajuntada: pot haver crescut prou
  // per no cabre on cabia (vegeu menaDArray). El set() entre arrays de tipus
  // diferents ja fa la conversió, i mai no s'hi perd res perquè la taula
  // només creix.
  const files = delDiccionari.idx.length + delApendix.idx.length;
  const idx = new (menaDArray(taula.length))(files);
  idx.set(delDiccionari.idx);
  for (let i = 0; i < delApendix.idx.length; i++) {
    idx[delDiccionari.idx.length + i] = equivalencia[delApendix.idx[i]];
  }

  return { taula, idx };
}

// COMPONDRE EL DICCIONARI QUE SE SERVEIX
//
// El diccionari general amb l'apendix del dialecte enganxat al final, que és
// sobre el que es cerca. Aquí no es baixa res: tot el que fa falta ja ha
// passat pel carregarDiccionariBase i el carregarDialecte.
//
// L'apendix va AL FINAL i no pas escampat per ordre alfabètic. L'ordre del
// diccionari no és el de cap comparació que es pugui fer aquí (hi va la ç
// entre la c i la d, i la à compta com una a), i endevinar-lo per a vuit-
// centes mil paraules a cada canvi de dialecte costaria més que tota la
// resta. Es nota en una cosa i prou: dins de cada grup de síl·labes, les
// paraules pròpies del dialecte surten després de les del diccionari.
//
// Torna false si encara no hi ha de què compondre. Qui el crida no ha de
// tocar res en aquest cas: val més quedar-se com estàvem que marcar una
// pastilla i ensenyar les rimes de l'altre dialecte.
//
// No toca el dialecteActiu: qui mana la tria és la tira (vegeu
// lligarTriaDeDialecte), i això només és la feina que li toca a l'index.html.
function compondreDiccionari(codi) {
  const dades = dadesPerDialecte[codi];
  if (!diccionariBase || !dades || !dades.rima[3] || !dades.rima[4]) return false;

  const apendix = dades.apendix;
  const columnaDeLApendix = numero => (apendix ? apendix.columnes[numero] : null);

  array0 = apendix ? diccionariBase.paraules.concat(apendix.paraules)
                   : diccionariBase.paraules;

  col1 = ajuntarColumnes(diccionariBase.columnes[1], columnaDeLApendix(1));
  col2 = ajuntarColumnes(diccionariBase.columnes[2], columnaDeLApendix(2));
  col3 = ajuntarColumnes(dades.rima[3], columnaDeLApendix(3));
  col4 = ajuntarColumnes(dades.rima[4], columnaDeLApendix(4));
  col5 = ajuntarColumnes(diccionariBase.columnes[5], columnaDeLApendix(5));
  col6 = ajuntarColumnes(diccionariBase.columnes[6], columnaDeLApendix(6));
  col7 = ajuntarColumnes(diccionariBase.columnes[7], columnaDeLApendix(7));
  col8 = ajuntarColumnes(diccionariBase.columnes[8], columnaDeLApendix(8));

  banderes = null; // les d'abans són d'un altre dialecte i d'unes altres files
  prepararColumnes();

  indexConsonant = indexarPerRima(col3);
  indexAssonant = indexarPerRima(col4);
  return true;
}

// Passar a un altre dialecte. Ara sí que pot baixar fitxers: d'un dialecte
// només se'n baixa el que fa falta el dia que fa falta (vegeu
// dadesPerDialecte). Si ja se n'havien baixat, no s'espera res.
//
// Torna false si no s'ha pogut fer, i llavors el que hi ha a la pantalla es
// queda tal com estava.
async function aplicarDialecte(codi) {
  if (!diccionariBase || !CODIS_DE_DIALECTE.includes(codi)) return false;

  if (!dadesPerDialecte[codi]) {
    try {
      dadesPerDialecte[codi] = await carregarDialecte(codi);
    } catch (err) {
      // La xarxa que ha caigut a mitges, o un fitxer que no hi és. No es desa
      // res a mig fer: el pròxim intent hi tornarà de zero.
      Debug.logError(`No s'ha pogut carregar el dialecte ${codi}:`, err);
      return false;
    }
  }

  return compondreDiccionari(codi);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (idPagina !== 'principal') return;
    Debug.logTime('Temps de càrrega');
    escriureComptador();

    try {
        await carregarVersions();

        // Ara ja se sap si el dialecte que se serveix té apendix o no, i per
        // tant quants fitxers són de debò.
        comencarComptador(FITXERS_DEL_DICCIONARI + fitxersDelDialecte(dialecteActiu),
                          'Carregant fitxers');

        // Tot d'una tirada i en paral·lel: el diccionari general i les dues
        // meitats del dialecte que se serveix (la rima i l'apendix). Un sol
        // Promise.all i no pas un per grup, perquè així el navegador fa la cua
        // ell sol i no hi ha cap fase que s'esperi l'anterior sense necessitat.
        //
        // Només el dialecte que se serveix. Abans es baixava la rima de tots
        // quatre perquè triar-ne un altre fos immediat, però amb els apendixs
        // això són uns 8 MB per dialecte i la immensa majoria de visites no
        // toquen mai la tira: es paga a totes una espera que serveix a poques.
        // Ara el preu el paga qui en tria un altre, una sola vegada, i entre
        // visites ni això (vegeu llegirFitxerAmbIndexedDB).
        const [base, delDialecte] = await Promise.all([
            carregarDiccionariBase(),
            carregarDialecte(dialecteActiu)
        ]);

        diccionariBase = base;
        dadesPerDialecte[dialecteActiu] = delDialecte;

        // Si el dialecte que tocava s'hagués quedat sense carregar, tornaríem
        // al central abans de deixar cercar: sense col3 ni col4 no hi ha cerca
        // possible.
        if (!compondreDiccionari(dialecteActiu)) {
            dialecteActiu = DIALECTE_PER_DEFECTE;
            await aplicarDialecte(dialecteActiu);
        }
        marcarDialecteTriat();

        console.log('Tots els fitxers carregats correctament');

        document.getElementById("loader").style.display = "none";

        // Va aquí i no pas al principi del DOMContentLoaded: la cerca
        // necessita el diccionari llegit i indexat, que és justament el que
        // s'acaba de fer. Dins el try, perquè si la càrrega ha petat no hi ha
        // res per on cercar.
        cercarDesDeLaURL();
    } catch (error) {
        Debug.logError('Error en carregar els fitxers:', error);
        document.getElementById("loader").style.display = "none";
    } finally {
        Debug.logTimeEnd('Temps de càrrega');
    }
});


// --- FUNCIONS INDEXEDDB ---
// Versió 2: abans aquí s'hi desava el text tal com baixava del servidor i es
// tornava a interpretar a cada visita. Ara s'hi desa ja interpretat (la llista
// de paraules feta, els índexs com a array de nombres), que és el que estalvia
// la feina. Com que el que hi ha a dins canvia de forma però les claus i les
// versions es diuen igual, el codi nou llegiria text on ara espera estructures:
// per això puja el número i es buida la caixa. Els visitants de sempre es
// tornen a baixar el diccionari una vegada i s'acaba.
function obrirIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('rimadorDB', 2);
        request.onerror = () => reject(null);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains('fitxers')) {
                db.deleteObjectStore('fitxers');
            }
            db.createObjectStore('fitxers', { keyPath: 'nom' });
        };
    });
}

function recuperarFitxer(db, nom) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('fitxers', 'readonly');
        const store = tx.objectStore('fitxers');
        const req = store.get(nom);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(null);
    });
}

function guardarFitxer(db, nom, contingut, versio) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('fitxers', 'readwrite');
        const store = tx.objectStore('fitxers');
        store.put({ nom, contingut, versio });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
    });
}

// LECTURA AMB INDEXEDDB + VERSIÓ + BACKUP
// `processar` diu què s'ha de fer amb el text un cop el tenim. Per defecte,
// partir-lo per línies com sempre; els fitxers d'índexs passen el seu, que els
// converteix en un array de nombres sense crear cap objecte de text pel camí.
async function llegirFitxerAmbIndexedDB(rutaFitxer, processar = processarFitxerDeText) {
  const nomFitxer = rutaFitxer.split("/").pop();
  const versioActual = VERSIONS_FITXERS[nomFitxer];

  const comptarFitxer = () => {
    fitxersLlegits++;
    escriureComptador();
  };

  try {
    // Sense una versió de confiança no sabem si la còpia guardada encara
    // val: la baixem del servidor i no en desem cap (ho fa el catch).
    if (!versioActual) throw new Error(`Sense versió per a ${nomFitxer}`);

    const db = await obrirIndexedDB();
    if (!db) throw new Error("IndexedDB no disponible");

    const fitxerDesat = await recuperarFitxer(db, nomFitxer); 
    const versioGuardada = fitxerDesat ? fitxerDesat.versio : "cap";

    // El que hi ha desat ja està interpretat: es torna tal com surt, sense
    // tornar a partir cap text ni tornar a llegir cap xifra.
    if (fitxerDesat && fitxerDesat.versio === versioActual) {
      console.log(`[${nomFitxer}] Carregat d'IndexedDB (${versioGuardada} = ${versioActual})`);
      comptarFitxer();
      return fitxerDesat.contingut;
    }

    console.log(`[${nomFitxer}] obsolet o no guardat, fent fetch i guardant arxiu a IndexedDB (${versioGuardada} =/= ${versioActual})`);
    const contingut = await fetchFitxer(rutaFitxer);
    const interpretat = processar(contingut);
    await guardarFitxer(db, nomFitxer, interpretat, versioActual);

    comptarFitxer();
    return interpretat;

  } catch (err) {
    Debug.logError(`IndexedDB fallida per ${nomFitxer}, intentant fetch directe`);
    const errorMsg = document.getElementById("error-msg"); 
    if (errorMsg) errorMsg.textContent = `Problema amb cache. Carregant ${nomFitxer} manualment.`;

    const contingut = await fetchFitxer(rutaFitxer);
    comptarFitxer();
    return processar(contingut);
  }
}

// FETCH NORMAL
async function fetchFitxer(url) {
    const nomFitxer = url.split("/").pop();
    // Si no sabem la versió (versions.json ha fallat), posem un valor
    // sempre diferent perquè el navegador tampoc no ens doni una còpia
    // seva que podria ser vella.
    const versio = VERSIONS_FITXERS[nomFitxer] || `sense-versio-${Date.now()}`;
    const response = await fetch(`${url}?v=${versio}`);
    if (!response.ok) throw new Error(`Error en llegir ${url}`);
    return await response.text();
}

// PROCESSAR TXT
function processarFitxerDeText(contingut) {
    return contingut.split('\n');
}

// NETEJAR INDEXEDDB
function netejarIndexedDB() {
    const request = indexedDB.deleteDatabase('rimadorDB');
    request.onsuccess = () => console.log('IndexedDB esborrat correctament');
    request.onerror = () => console.error('Error en esborrar IndexedDB');
    request.onblocked = () => console.warn("L'esborrat d'IndexedDB està bloquejat");
}
  

// event listener per la tecla enter
const inputParaula = document.getElementById('paraulaCercada');
if (inputParaula) {
  inputParaula.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      realitzarCerca();
    }
  });
}


//Botó:
const cercaButton = document.getElementById('cercaButton');
if (cercaButton) {
  cercaButton.addEventListener('click', realitzarCerca);
}


// --- LA TIRA PER TRIAR EL DIALECTE ---
// La pinta el js/components.js a partir de la seva llista DIALECTES; el que
// fa és cosa d'aquí, que és qui té les columnes.

function botonsDeDialecte() {
  return document.querySelectorAll('#dialectes .dialecte');
}

// Quina pastilla surt marcada. El components.js sempre pinta el central, o
// sigui que si de l'altre cop en va quedar un altre de desat, es corregeix
// aquí. Passa abans del primer pintat (tots dos fitxers són defer i aquest va
// just darrere), i per tant no es veu cap salt.
function marcarDialecteTriat() {
  botonsDeDialecte().forEach(boto => {
    const es = boto.dataset.dialecte === dialecteActiu;
    boto.classList.toggle('triat', es);
    boto.setAttribute('aria-checked', es ? 'true' : 'false');
  });
}

// Què s'ha de fer, a més de marcar la pastilla i desar la tria, quan se'n tria
// un altre. Ho posa cada pàgina, perquè no és el mateix a totes:
//
//   index.html      canviar de columna de rima i refer la cerca (aquí sota)
//   les nàufragues  tornar a llegir el JSON del dialecte (js/script_llistes.js)
//
// Si torna false, la feina no s'ha pogut fer i la tira es queda com estava: val
// més no moure la pastilla que ensenyar-ne una que no diu la veritat.
let feinaDeCanviDeDialecte = null;

function quanEsCanviaDeDialecte(feina) {
  feinaDeCanviDeDialecte = feina;
}

// Només es crida des de la tira, mai amb el que ve del ?d= (vegeu
// dialecteInicial): la memòria ha de guardar el que algú ha triat, no el que
// li ha arribat per un enllaç.
function desarDialecte(codi) {
  try {
    localStorage.setItem(CLAU_DIALECTE, codi);
  } catch (err) {
    // Mode privat: la tria val per a aquesta visita i prou.
  }
}

// Deixar el dialecte a la barra d'adreces, perquè el que es veu i el que
// s'enllaça diguin sempre el mateix: copiar l'adreça d'aquí i enviar-la ha
// d'ensenyar a l'altre les mateixes rimes.
//
// replaceState i no pas pushState: triar un dialecte no és anar a cap altra
// pàgina. Amb pushState, la fletxa d'enrere aniria desfent les triades una per
// una en comptes de tornar d'on s'havia vingut.
//
// L'adreça només es toca quan algú tria: qui entra a rimador.cat i es queda
// amb el que tenia, es queda també amb l'adreça neta.
function escriureDialecteALAdreca(codi) {
  try {
    const adreca = new URL(window.location.href);
    adreca.searchParams.set('d', codi);
    history.replaceState(null, '', adreca);
  } catch (err) {
    // Obert com a fitxer local, o massa canvis seguits (el Safari els limita).
    // L'adreça no és la que tocaria, però la pàgina funciona igual.
  }
}

// Un canvi de dialecte ja no és instantani: pot haver de baixar fitxers.
// Mentre dura, la pastilla encara no s'ha mogut (no es mou fins que la feina
// ha anat bé), i sense això dos clics seguits engegarien dues càrregues que
// acabarien en desordre i deixarien marcada una pastilla que no és la del
// diccionari que s'ha compost. El loader tapa la pantalla mentrestant, però
// això no depèn que la tapi.
let canviDeDialecteEnCurs = false;

function lligarTriaDeDialecte() {
  const botons = botonsDeDialecte();
  if (!botons.length) return; // pàgines sense tira: dades, error, nosaltres...

  marcarDialecteTriat();

  botons.forEach(boto => {
    boto.addEventListener('click', async () => {
      const codi = boto.dataset.dialecte;
      if (codi === dialecteActiu || canviDeDialecteEnCurs) return;

      canviDeDialecteEnCurs = true;
      try {
        // L'await val tant si la feina torna una promesa (l'index.html, que
        // pot baixar el dialecte) com si torna el valor pelat (les llistes).
        if (feinaDeCanviDeDialecte && (await feinaDeCanviDeDialecte(codi)) === false) return;

        dialecteActiu = codi;
        marcarDialecteTriat();
        desarDialecte(codi);
        escriureDialecteALAdreca(codi);
      } finally {
        canviDeDialecteEnCurs = false;
      }
    });
  });
}

// Tornar la pàgina a com estava en arribar-hi: sense resultats, sense el
// número de rimes i sense les caselles de categories. NO toca ni la paraula
// escrita ni els filtres triats, perquè justament el que es vol tot seguit és
// tornar a pitjar Cercar i veure el mateix en el dialecte nou.
function tornarALInici() {
  matches = [];
  matches_provisionals = [];
  paraulacerca = [0, 0, 0, 0, 0, 0, 0];
  codiParaula = "";
  paraulaEsNaufraga = false;
  impressio = null;

  const rimes = document.getElementById('rima_enllac');
  if (rimes) {
    rimes.innerHTML = "";
    rimes.classList.remove("column-container", "cols-1", "cols-2", "cols-3");
  }

  const textNombre = document.getElementById('nombre');
  if (textNombre) textNombre.innerHTML = "";

  // El full que amaga les categories desmarcades es queda posat entre cerques.
  // Buidar-lo és tornar-les a ensenyar totes, que és com comença cada cerca.
  if (fullDeFiltres) fullDeFiltres.textContent = "";

  // Es TREUEN els estils que hi va posar la cerca, no se n'hi posen de nous:
  // el CSS ja diu que la caixa dels resultats no es veu (vegeu .impressio a
  // css/impressio.scss) i que l'espai buit de sota sí.
  const caixa = document.querySelector('.impressio');
  if (caixa) caixa.style.display = '';

  const espai = document.getElementById('espai_inicial');
  if (espai) espai.style.display = '';

  actualitzarBotoCompartir(); // sense paraula trobada, s'amaga tot sol
}

// La feina de l'index.html: refer el diccionari que se serveix, baixant el que
// falti d'aquell dialecte.
//
// Triar un dialecte TREU ELS RESULTATS de la pantalla i deixa la pàgina com en
// arribar-hi. Abans es quedaven tal com estaven, per no fer perdre el que
// s'estava mirant, però eren les rimes de l'altre dialecte i enlloc no ho
// deia: es veia una llista que ja no era la del dialecte marcat a la tira. Per
// veure la mateixa paraula en el dialecte nou s'ha de pitjar Cercar altre cop,
// que és el que la pàgina buida convida a fer.
//
// Es registra aquí i no pas quan el diccionari ja està llegit, perquè mentre
// es carrega també ha de saber dir que no: el loader tapa la pantalla sencera
// (z-index 99999 a css/loader.scss) i no hi hauria d'arribar cap clic, però si
// n'hi arribés cap, l'aplicarDialecte torna false (encara no hi ha
// diccionariBase) i la tira no es mou.
//
// El cercaEnCurs, en canvi, sí que passa: el diàleg d'homògrafs s'obre amb el
// loader apartat (vegeu realitzarCerca) i la tira queda al descobert amb una
// cerca a mitges. Canviar-li les columnes a sota voldria dir acabar-la amb la
// rima d'un dialecte i els números de l'altre.
if (idPagina === 'principal') {
  quanEsCanviaDeDialecte(async codi => {
    if (cercaEnCurs) return false;

    // EL LOADER NOMÉS HI VA SI S'HA DE BAIXAR ALGUNA COSA. Si el dialecte ja
    // s'ha baixat en aquesta visita, l'únic que queda és recompondre el
    // diccionari: feina seguida de poques dècimes i sense cap espera de xarxa.
    // Ensenyar-hi el loader volia dir obrir-lo i tancar-lo pràcticament dins
    // del mateix parpelleig, i una roda que apareix i desapareix de seguida fa
    // pitjor efecte que una espera curta sense res.
    const calBaixar = !dadesPerDialecte[codi];
    let fet;

    if (calBaixar) {
      const missatge = `Carregant el ${nomDelDialecte(codi)}...`;
      fet = await Loader.mentre(missatge, () => {
        // El comptador torna a començar: els que falten són els d'aquest
        // dialecte, no pas els de tota la visita. Va aquí dins i no pas abans
        // perquè el Loader escriu el missatge en obrir-se, i escrivint-lo
        // primer el comptador s'esborraria tot seguit.
        comencarComptador(fitxersDelDialecte(codi), missatge);
        return aplicarDialecte(codi);
      });
    } else {
      fet = await aplicarDialecte(codi);
    }

    // Només si el canvi ha anat bé: si no s'ha pogut fer, la tira es queda com
    // estava i el que hi ha a la pantalla continua sent del dialecte que se
    // serveix.
    if (fet) tornarALInici();
    return fet;
  });
}

lligarTriaDeDialecte();

// El botó de compartir la cerca a X (Twitter).
//
// Només surt quan la cerca ha trobat la paraula al diccionari: si no s'ha
// trobat no hi ha res per anar a consultar i el piulet convidaria a obrir una
// pàgina buida. Es refà a cada cerca, que és quan pot canviar res del que hi
// diu: el número que dona no depèn de les caselles (vegeu-ho més avall).
//
// L'adreça és la d'intenció de X. El twitter.com/intent/tweet de sempre encara
// hi redirigeix, però fem servir la d'ara per no dependre del salt; si mai
// canvia, es canvia aquí i a l'href de l'index.html i prou.
function actualitzarBotoCompartir() {
  const boto = document.getElementById('compartirButton');
  if (!boto) return;

  const paraula = paraulacerca[0];
  if (paraula === 0) {
    boto.hidden = true;
    return;
  }

  let piulet;

  // Les nàufragues només ho són en rima consonant: en assonant rimen com
  // qualsevol altra paraula, i aleshores el piulet ha de ser el de sempre. És
  // la mateixa condició que decideix què s'ensenya a la pantalla (vegeu
  // l'actualitzarRimes), i per força ha de dir el mateix que ella.
  const tipusRima = document.getElementById('rimaSelector').value;

  // El dialecte va a TOTES dues adreces, i sempre, també quan és el central.
  // No és com el &rima=assonant, que es pot ometre perquè qui obri l'enllaç
  // sense res trobarà la consonant igualment: aquí, qui l'obri sense ?d=
  // trobarà el dialecte que ell tingui desat, que pot ser qualsevol. Deixar-lo
  // fora no vol dir "el de sempre", vol dir "el que li toqui al qui ho llegeixi".
  const dialecte = "d=" + dialecteActiu;

  if (paraulaEsNaufraga && tipusRima === 'r.consonant') {
    // Ser nàufraga depèn del dialecte i la llista també (vegeu
    // fitxerDeNaufragues, a js/script_llistes.js): sense el ?d=, l'enllaç pot
    // dur a una llista on aquesta paraula no hi és.
    piulet = "He trobat una paraula nàufraga! '" + paraula + "' no rima " +
             "consonantment en dialecte " + nomDelDialecte(dialecteActiu) +
             " amb cap altra paraula del diccionari. Descobreix " +
             "totes les altres: rimador.cat/llistes/llista_naufragues.html?" + dialecte;

  } else {
    // matches i no pas matches_provisionals, que és el que es veu a la
    // pantalla: el piulet ha de dir quantes rimes té la paraula amb totes les
    // caselles marcades. Si comptés les que es veuen, qui obrís l'enllaç en
    // trobaria unes altres, perquè hi arriba amb els filtres per estrenar.
    const quantes = matches.length;
    const compte = quantes === 1 ? "1 rima" : quantes + " rimes";

    const esAssonant = tipusRima === 'r.assonant';

    // La paraula hi va dues vegades i de dues maneres: dins el text, tal com
    // s'escriu, i dins l'enllaç, codificada. L'encodeURIComponent no toca res
    // si la paraula és tota ASCII, o sigui que l'adreça només s'embruta quan
    // no hi ha manera de fer-ho altrament ('cançó' -> 'can%C3%A7%C3%B3').
    //
    // El &rima= només hi surt quan és assonant: la consonant ja és la que surt
    // si no s'hi posa res (vegeu cercarDesDeLaURL), i posar-l'hi només faria
    // l'enllaç més llarg per no dir res de nou.
    const adreca = "rimador.cat/?q=" + encodeURIComponent(paraula) +
                   "&" + dialecte +
                   (esAssonant ? "&rima=assonant" : "");

    piulet = "He cercat " + (esAssonant ? "assonantment" : "consonantment") +
             " '" + paraula + "' al rimador.cat i té " + compte +
             " en dialecte " + nomDelDialecte(dialecteActiu) + "! " +
             "Consulta-les totes a " + adreca;
  }

  boto.href = 'https://x.com/intent/post?text=' + encodeURIComponent(piulet);
  boto.hidden = false;
}

// Cerca demanada des de l'adreça: rimador.cat/?q=paraula
//
// Serveix per a dues coses. La primera, poder enllaçar una cerca concreta
// (compartir-la, desar-la, posar-la de cercador al navegador). La segona, que
// el SearchAction del JSON-LD de l'index.html digui la veritat: allà hi ha
// declarat exactament aquest patró d'URL, i sense això seria una mentida —
// l'adreça obriria la pàgina d'inici buida i no cercaria res.
//
// Només omple el camp i pitja el botó: tota la feina la fa el realitzarCerca
// de sempre, amb els filtres tal com els deixa el components.js. No toca la
// barra d'adreces quan es cerca des del formulari; el ?q= és una porta
// d'entrada, no un estat que la pàgina vagi mantenint.
//
// El ?d= del dialecte sí que s'hi manté (vegeu escriureDialecteALAdreca), i
// no és cap incoherència: la paraula cercada ja es veu escrita al camp, però
// el dialecte de qui rebi l'enllaç no es veu enlloc si no consta a l'adreça.
function cercarDesDeLaURL() {
  const parametres = new URLSearchParams(window.location.search);

  const paraula = parametres.get('q');
  if (!paraula || !paraula.trim()) return;

  const camp = document.getElementById('paraulaCercada');
  if (!camp) return;

  // El tipus de rima és opcional i l'única cosa que s'hi entén és 'assonant':
  // qualsevol altra cosa (o no posar-hi res) deixa el desplegable tal com ve,
  // que és amb la consonant triada (vegeu opcionsRima a js/components.js).
  // Així una adreça mal escrita no es queda sense cercar, només cerca com de
  // costum.
  const selector = document.getElementById('rimaSelector');
  if (selector && (parametres.get('rima') || '').trim().toLowerCase() === 'assonant') {
    selector.value = 'r.assonant';
  }

  camp.value = paraula.trim();
  realitzarCerca();
}

const CriterisNoms = {
  ...crearCriteris('Noms', 'N'),
  ...crearCriteris('Propis', 'NP'),
  ...crearCriteris('Comuns', 'NC'),
};

const CriterisVerbs = {
  ...crearCriteris('Verbs', 'V'),
  ...crearCriterisTriples('Indicatiu', 'VAI', 'VSI', 'VMI' ),
  ...crearCriterisTriples('Subjuntiu', 'VAS', 'VSS', 'VMS'),
  ...crearCriterisTriples('Imperatiu', 'VAM', 'VSM', 'VMM'),
  ...crearCriterisTriples('Gerundis', 'VAG', 'VSG', 'VMG'),
  ...crearCriterisTriples('Participis', 'VAP', 'VSP', 'VMP'),
  ...crearCriterisTriples('Infinitius', 'VAN', 'VSN', 'VMN'),
  ...crearCriterisTriples('Condicional', 'VAC', 'VSC', 'VMC' ),
};

const CriterisInfinitiuPronom = {
  ...crearCriteris('Infinitiu + pronom(s)', 'WN'),
  ...crearCriteris('+ 1 pronom', 'WN0001'),
  ...crearCriteris('+ 2 pronoms', 'WN0002'),
};

const CriterisGerundiPronom = {
  ...crearCriteris('Gerundi + pronom(s)', 'WG'),
  ...crearCriteris('+ 1 pronom', 'WG0001'),
  ...crearCriteris('+ 2 pronoms', 'WG0002'),
};

const CriterisAdjectius = {
  ...crearCriteris('Adjectius', 'A'),
  ...crearCriteris('Qualificatius', 'AQ0'),
  ...crearCriteris('Superlatius', 'AQA'),
  ...crearCriteris('Ordinals', 'AO'),
};

const CriterisPronoms = {
  ...crearCriteris('Pronoms', 'P'),
  ...crearCriteris('Demostratius', 'PD'),
  ...crearCriteris('Indefinits', 'PI'),
  ...crearCriteris('Interrogatius / Exclamatius', 'PT'),
  ...crearCriterisDobles('Personals (forts i febles)', 'PP', 'P0'),
  ...crearCriteris('Possessius', 'PX'),
  ...crearCriteris('Relatius', 'PR'),
};

const CriterisDeterminants = {
  ...crearCriteris('Determinants', 'D'),
  ...crearCriteris('Números', 'DN'),
  ...crearCriteris('Articles', 'DA'),  
  ...crearCriteris('Relatius', 'DR'),
  ...crearCriteris('Interrogatius', 'DT'),
  ...crearCriteris('Demostratius', 'DD'),
  ...crearCriteris('Exclamatius', 'DE'),
  ...crearCriteris('Indefinits', 'DI'),
  ...crearCriteris('Possessius', 'DP'),
};

const CriterisAltres = {
  ...crearCriteris('Altres categories', 'Z'),
  ...crearCriteris('Adverbis', 'ZR'),
  ...crearCriteris('Conjuncions', 'ZC'),
  ...crearCriteris('Interjeccions', 'ZI'),
  ...crearCriteris('Preposicions', 'ZSPS'),
  ...crearCriteris('Contraccions', 'ZSP+'),
  ...crearCriteris('"etcètera"', 'ZF'),
};

function crearCriteris(nom, prefix) {  
  return {
      [`${nom}`]: {
          filterFunction: item => item[2].startsWith(`${prefix}`),},};
}

function crearCriterisDobles(nom, prefix1, prefix2) {
  return {
      [`${nom}`]: {
          filterFunction: item => item[2].startsWith(prefix1) || item[2].startsWith(prefix2),},};
}

function crearCriterisTriples(nom, prefix1, prefix2, prefix3) {
  return {
      [`${nom}`]: {
          filterFunction: item => item[2].startsWith(prefix1) || item[2].startsWith(prefix2) || item[2].startsWith(prefix3),},};
}



//excel per guardar cerques
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbw5uSetN-OKIEQjmEo9PFFJp0r7UclUnHEYhbkghbqQ4q7JnIM7i0Ljfa3W_Q7Z-s5f/exec";

// Les cerques només es registren des del web de debò: rimador.cat (el domini
// del CNAME) i rimador.github.io (l'adreça que GitHub Pages dona al
// repositori oficial). Al repositori de proves i en local, l'amfitrió no és
// cap d'aquests dos i no s'envia res, que és el que evita que les proves
// embrutin el full de càlcul.
//
// Va aquí fora i no dins de registrarCerca perquè l'amfitrió no canvia mentre
// la pàgina és oberta: no cal tornar-ho a mirar a cada cerca.
const ES_WEB_OFICIAL = window.location.hostname === 'rimador.cat'
                    || window.location.hostname === 'rimador.github.io';

function getUsuariID() {
  let usuariID = localStorage.getItem('rimador_usuari_id');
  if (!usuariID) {
    const temps = Date.now().toString(36);
    const aleatori = Math.random().toString(36).substring(2, 7);
    usuariID = 'usr_' + temps + '_' + aleatori;
    localStorage.setItem('rimador_usuari_id', usuariID);
  }
  return usuariID;
}

// --------------------------------------------------- Cerques sense connexió
//
// Mateix patró que la classificació del joc (joc/js/classificacio.js): si el
// fetch no pot anar, la cerca es desa al localStorage i s'envia sola quan
// torni la connexió (o al proper cop que s'obri la pàgina).
const CLAU_CERQUES_PENDENTS = 'rimador.cerques.pendents.v1';
const MAX_CERQUES_PENDENTS = 100;

function llegirCerquesPendents() {
    try {
        const cru = localStorage.getItem(CLAU_CERQUES_PENDENTS);
        const llista = cru ? JSON.parse(cru) : [];
        return Array.isArray(llista) ? llista : [];
    } catch (error) {
        return [];
    }
}

function desarCerquesPendents(llista) {
    try {
        localStorage.setItem(CLAU_CERQUES_PENDENTS, JSON.stringify(llista.slice(-MAX_CERQUES_PENDENTS)));
    } catch (error) {}
}

function encuarCerca(camps) {
    const llista = llegirCerquesPendents();
    llista.push(camps);
    desarCerquesPendents(llista);
}

async function provarDEnviarCerca(camps) {
    try {
        await fetch(URL_GOOGLE_SCRIPT, {
            method: 'POST', mode: 'no-cors', body: new URLSearchParams(camps),
        });
        return true;
    } catch (error) {
        return false;
    }
}

let buidantCerques = false;

async function enviarCerquesPendents() {
    if (buidantCerques) return 0;
    buidantCerques = true;
    let enviades = 0;
    try {
        for (;;) {
            const llista = llegirCerquesPendents();
            if (llista.length === 0) break;
            if (!(await provarDEnviarCerca(llista[0]))) break;
            const ara = llegirCerquesPendents();
            ara.shift();
            desarCerquesPendents(ara);
            enviades += 1;
        }
    } finally {
        buidantCerques = false;
    }
    return enviades;
}

window.addEventListener('online', () => enviarCerquesPendents());
enviarCerquesPendents();

function registrarCerca(paraulaBuscada, rimaTrobada, tipusRima, codiParaula, numeroSeleccionat, comenca, inclourePropis, inclourePlurals) {
  // Aquesta comprovació va la primera de totes. Abans era al final, just
  // abans del fetch, i per tant el web de proves i el navegador en local
  // arribaven a passar pel getUsuariID(), que fabrica un identificador
  // d'usuari i el desa al localStorage. Es creaven identificadors de
  // seguiment en llocs on no s'envia res i que no serviran mai per a res.
  // if (!ES_WEB_OFICIAL) return;
  if (!paraulaBuscada || paraulaBuscada.trim().length < 2) return;

  const camps = {
    paraula: paraulaBuscada.trim().toLowerCase(),
    rima: rimaTrobada || "***",
    codi: codiParaula || "***",
    numeroSilabes: numeroSeleccionat,
    comencaPer: comenca,
    inclourePropis: inclourePropis,
    inclourePlurals: inclourePlurals,
    tipusRima: tipusRima,
    dialecte: dialecteActiu,
    usuari: getUsuariID(),
horaReal: new Date().toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '') 
  };

  if (navigator.onLine === false) {
    encuarCerca(camps);
    return;
  }

  fetch(URL_GOOGLE_SCRIPT, {
    method: 'POST',
    mode: 'no-cors',
    body: new URLSearchParams(camps)
  }).catch(() => encuarCerca(camps));
}




//FUNCIONS PRINCIPALS

// Els resultats que hi ha ara mateix a la pantalla. Fins ara naixien
// sols, sense declarar enlloc, de la primera assignació que se'ls feia;
// això vol dir que amb el mode estricte el programa peta, i que una
// errada de tecleig en comptes de queixar-se crea una variable nova.
//
// - matches: tot el que ha trobat l'última cerca.
// - matches_provisionals: el subconjunt que passa el filtre de categories
//   de les caselles, que és el que s'imprimeix.
// - paraulacerca: la fila del diccionari de la paraula cercada.
// - codiParaula: la seva categoria gramatical.
//
// Van amb var i no amb let a posta: script_llistes.js les escriu com a
// window.matches, window.matches_provisionals i window.paraulacerca, i
// només var deixa la variable penjada del window. Amb let serien una
// variable del guió i les pàgines de llistes escriurien a un lloc que
// aquest fitxer no llegeix mai.
var matches = [];
var matches_provisionals = [];
var paraulacerca = [0, 0, 0, 0, 0, 0, 0];
var codiParaula = "";

// Mentre el diàleg d'homògrafs és obert, la cerca està a mitges. Si
// se'n comencés una altra, tindríem dues cerques en marxa i dos diàlegs
// oberts alhora. Amb el prompt() d'abans això no podia passar, perquè
// aturava tota la pàgina.
let cercaEnCurs = false;

async function realitzarCerca() {
  Debug.log("Botó clicat!");
  Debug.logTime('realitzarCerca');

  if (cercaEnCurs) {
    Debug.log("Ja hi ha una cerca en marxa; ignorem la nova.");
    return;
  }
  cercaEnCurs = true;

  document.getElementById("espai_inicial").style.display = "none";

  try {
    // Abans aquí hi havia `matches = []`. Ara que la cerca es pot aturar
    // esperant el diàleg d'homògrafs, buidar-ho d'entrada deixava la
    // pàgina en un estat incoherent mentre el diàleg era obert: a la
    // pantalla encara s'hi veien els resultats de la cerca anterior,
    // però la llista que els sosté era buida. Les substituïm de cop
    // quan les noves ja estan fetes (línia de sota del buscarParaula).
    var paraulaCercada = document.getElementById('paraulaCercada').value.trim().toLowerCase();
    var numeroSeleccionat = document.getElementById('numeroSelector').value;
    var tipusRima = document.getElementById('rimaSelector').value;
    var comença = document.getElementById('categoriaSelector').value;
    var inclourePropis = document.getElementById('nomsPropis').value;
    var inclourePlurals = document.getElementById('plurals').value;
    
    // Tota la feina va sota el loader. Aquí sí, i al clic de casella no,
    // perquè la cerca és l'única part que encara triga: pintar les rimes
    // per primera vegada són segons quan la rima és ampla. Amagar-ne unes
    // quantes després, en canvi, són mil·lisegons.
    //
    // El diàleg d'homògrafs, si surt, s'obre amb el loader apartat
    // (vegeu buscarParaula).
    await Loader.mentre("Cercant les rimes...", async () => {
      const buscaparaula = await buscarParaula(paraulaCercada, numeroSeleccionat, comença, tipusRima, inclourePropis, inclourePlurals);

      // null = s'ha tancat el diàleg d'homògrafs sense triar cap paraula.
      // No toquem res: ni els resultats de la pantalla ni el registre de
      // cerques.
      if (buscaparaula === null) {
        Debug.log("Cerca cancel·lada des del diàleg d'homògrafs.");
        return;
      }

      matches = buscaparaula[0];
      paraulacerca = buscaparaula[1];

      // lògica per a registrar les cerques
      let rimaTrobada = "***";

      if (paraulacerca[0] !== 0) {
          if (tipusRima === 'r.consonant') {
              rimaTrobada = paraulacerca[3];}
          else if (tipusRima === 'r.assonant') {
              rimaTrobada = paraulacerca[4];}
      }
      codiParaula = paraulacerca[2];

      registrarCerca(
            paraulaCercada,
            rimaTrobada,
            tipusRima,
            codiParaula,
            numeroSeleccionat,
            comença,
            inclourePropis,
            inclourePlurals
          );

      matches_provisionals = matches.slice();

      actualitzarRimes();
      var checkboxes = document.querySelectorAll('.clickable-checkbox');

      checkboxes.forEach(function(checkbox) {
        checkbox.checked = true;
      });

      mostrarTotesLesLlistes();
      document.querySelector('.impressio').style.display = 'flex';

      // Una cerca acabada compta com un dia d'ús per a l'avís periòdic
      // de donatius (avis/avis.js). És ell qui decideix si toca ensenyar
      // res o no; aquí només l'informem. Va aquí baix, i no al principi
      // de la funció, perquè només compti quan la cerca ha anat bé.
      if (window.AvisRimador) window.AvisRimador.registraUs();
    });

    Debug.logTimeEnd('realitzarCerca');
  } catch (error) {
    Debug.logError('Error en realitzar la cerca:', error);
  } finally {
    cercaEnCurs = false;
  }
}

function descriureCategoria(codi) {
  if (codi.startsWith("Y")) return "abreviació";
  if (codi.startsWith("CC")) return "conjunció";
  if (codi.startsWith("SP")) return "preposició";
  if (codi.startsWith("I")) return "interjecció";
  if (codi.startsWith("RG")) return "adverbi";
  if (codi.startsWith("V")) return "verb";
  if (codi.startsWith("N")) return "nom";
  if (codi.startsWith("A")) return "adjectiu";
  if (codi.startsWith("P")) return "pronom";
  if (codi.startsWith("D")) return "determinant";
  if (codi.startsWith("Z")) return "altre";
  return "altra categoria";
}

function obtenirPesJerarquia(codi) {
  if (!codi) return 10;
  if (codi.startsWith('NC')) return 1;
  if (codi.startsWith('A')) return 2;
  if (codi.startsWith('D')) return 3;
  if (codi.startsWith('P')) return 4;
  if (codi.startsWith('V')) return 5;
  if (codi.startsWith('W')) return 6;
  if (codi.startsWith('R')) return 7;
  if (codi.startsWith('I')) return 8;
  if (codi.startsWith('CC')) return 9;
  if (codi.startsWith('NP')) return 10;
  return 10;
}

// Diàleg per triar entre paraules homògrafes ('dona', 'soc', 'coure'...).
// Abans això era un prompt() del navegador: una finestra que no es pot
// estilar de cap manera, o sigui que les transcripcions hi sortien amb
// la tipografia del sistema i cada aparell hi feia el que volia amb els
// caràcters de l'AFI. Fet a casa, hereta les fonts del web.
// Retorna una promesa amb l'opció triada, o amb null si es tanca sense
// triar res. Mai no tria per compte de l'usuari: si la cerca continués
// amb una opció posada per nosaltres, sortirien les rimes de l'altra
// paraula sense que ningú ho hagués demanat.
function triarHomograf(paraulaCercada, opcions) {
  return new Promise(resolve => {
    // Xarxa de seguretat per a navegadors sense <dialog> (iOS anterior
    // al 15.4): tornem al prompt() de tota la vida.
    if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) {
      const text = opcions.map(o => `${o.numero}: ${o.paraula} (${o.categoria}, ${o.arrel}) ${o.transcripcio}`).join("\n");
      const eleccio = parseInt(prompt(`Hi ha ${opcions.length} coincidències per "${paraulaCercada}".\nEscull una opció:\n\n${text}`));
      resolve(isNaN(eleccio) || eleccio <= 0 || eleccio > opcions.length ? null : opcions[eleccio - 1]);
      return;
    }

    const dialeg = document.createElement('dialog');
    dialeg.className = 'dialeg-homografs focus-inicial';

    const titol = document.createElement('h2');
    titol.textContent = `Quina "${paraulaCercada}" cerques?`;
    dialeg.appendChild(titol);

    const explicacio = document.createElement('p');
    explicacio.className = 'dialeg-explicacio';
    explicacio.textContent = `S'escriuen igual però es pronuncien de manera diferent, i per tant no rimen amb les mateixes paraules.`;
    dialeg.appendChild(explicacio);

    const llista = document.createElement('div');
    llista.className = 'dialeg-opcions';

    // Tanquem, netegem i responem sempre des d'aquí. No ens refiem de
    // l'esdeveniment 'close' del <dialog> (hi ha navegadors que no
    // l'envien, i llavors el diàleg es quedaria enganxat al document i
    // la cerca no acabaria mai).
    let tancat = false;

    const tancar = opcio => {
      if (tancat) return;
      tancat = true;
      dialeg.close();
      dialeg.remove();
      resolve(opcio);
    };

    opcions.forEach(opcio => {
      const boto = document.createElement('button');
      boto.type = 'button';
      boto.className = 'dialeg-opcio';

      const transcripcio = document.createElement('span');
      transcripcio.className = 'transcripcio dialeg-transcripcio';
      transcripcio.textContent = opcio.transcripcio;

      const detall = document.createElement('span');
      detall.className = 'dialeg-detall';
      detall.textContent = `${opcio.categoria}, ${opcio.arrel}`;

      boto.appendChild(transcripcio);
      boto.appendChild(detall);
      boto.addEventListener('click', () => tancar(opcio));

      llista.appendChild(boto);
    });

    dialeg.appendChild(llista);

    // Esc: es cancel·la la cerca sencera. No triem nosaltres cap opció.
    dialeg.addEventListener('cancel', event => {
      event.preventDefault();
      tancar(null);
    });
    dialeg.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        tancar(null);
      }
      // El primer keydown de debò (normalment Tab) vol dir que l'usuari
      // navega amb teclat: a partir d'aquí el contorn de focus ha de
      // funcionar amb normalitat. Vegeu la classe .focus-inicial a
      // css/dialeg.scss.
      dialeg.classList.remove('focus-inicial');
    });

    // Clic al fons fosc: també cancel·la. Compte, que event.target és el
    // <dialog> tant si es clica el fons com si es clica el farciment del
    // quadre o l'espai entre dues opcions; si no ho distingíssim, un toc
    // una mica desviat tancaria el diàleg com si fos un clic a fora.
    // Comparem les coordenades amb el rectangle del quadre.
    dialeg.addEventListener('click', event => {
      if (event.target !== dialeg) return;

      const caixa = dialeg.getBoundingClientRect();
      const aDins = event.clientX >= caixa.left && event.clientX <= caixa.right &&
                    event.clientY >= caixa.top && event.clientY <= caixa.bottom;

      if (!aDins) tancar(null);
    });

    document.body.appendChild(dialeg);
    dialeg.showModal();
    llista.querySelector('button').focus();
  });
}

// Les columnes no són paràmetres: es llegeixen d'on són. Ho eren, però passar-
// ho tot per la porta (les banderes empaquetades, els índexs de rima...) era
// una llista d'arguments que no deia res que no se sabés.
async function buscarParaula(paraulaCercada, numeroSeleccionat, comença, tipusRima, inclourePropis, inclourePlurals) {
  Debug.logTime('buscarParaula');

  // Aquesta era una variable global. Ara que la funció és asíncrona (s'atura
  // a esperar el diàleg d'homògrafs), dues cerques poden estar en marxa
  // alhora, i si totes dues hi escrivien els resultats es barrejaven: sortien
  // rimes d'una altra paraula. Cada cerca es guarda les seves i les retorna
  // al final.
  let llistaParaulaCerca;
  const matches = [];

  // Quina fila del diccionari és la paraula que s'ha cercat, o -1 si no hi és.
  // Ens la guardem perquè és d'on surt el número de la rima que hem de buscar.
  let filaTrobada = -1;

  // Abans això era un .map() que fabricava 619.783 objectes { paraula, index }
  // a cada cerca, només per trobar-ne un grapat. Un bucle normal fa la mateixa
  // feina sense deixar res per escombrar.
  const buscada = paraulaCercada.toLowerCase();
  const coincidencies = [];
  for (let i = 0; i < array0.length; i++) {
    if (array0[i].toLowerCase() === buscada) coincidencies.push(i);
  }

  // L'ordenació és estable, o sigui que les del mateix pes es queden en
  // l'ordre del diccionari, com abans.
  coincidencies.sort((a, b) => obtenirPesJerarquia(t2(a)) - obtenirPesJerarquia(t2(b)));

  if (coincidencies.length === 0) {
    llistaParaulaCerca = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  } else if (coincidencies.length === 1) {
    var indexparaula = coincidencies[0];
    filaTrobada = indexparaula;
    llistaParaulaCerca = [
      array0[indexparaula], t1(indexparaula), t2(indexparaula),
      t3(indexparaula), t4(indexparaula), t5(indexparaula),
      t6(indexparaula), t7(indexparaula), t8(indexparaula)
    ];
  } else {
    // No fa falta la transcripció sencera de la col_9 per saber si aquestes
    // entrades "sonen igual": ens val que rimin igual, i això ja ho diu el
    // número de rima que porten col_3 (consonant) o col_4 (assonant), que
    // igualment es carreguen per cercar. És el mateix criteri que la cerca
    // fa servir més avall per triar les files candidates (vegeu la "rima").
    const columna = tipusRima === 'r.consonant' ? col3 : col4;
    const rimes = new Set(coincidencies.map(fila => columna.idx[fila]));

    // Si totes les entrades tenen el mateix número de rima, tant se val
    // quina agafem: no cal preguntar res. És el cas de gairebé totes les
    // paraules repetides.
    if (rimes.size === 1) {
      var indexparaula = coincidencies[0];
      filaTrobada = indexparaula;
      llistaParaulaCerca = [
        array0[indexparaula], t1(indexparaula), t2(indexparaula),
        t3(indexparaula), t4(indexparaula), t5(indexparaula),
        t6(indexparaula), t7(indexparaula), t8(indexparaula)
      ];
    } else {
      // Només oferim una opció per número de rima: si dues entrades rimen
      // igual (per exemple dues formes verbals de 'donar'), donarien
      // exactament les mateixes rimes i al diàleg hi sortirien dues opcions
      // idèntiques.
      const vistes = new Set();
      const opcions = [];

      coincidencies.forEach(index => {
        const seva = columna.idx[index];
        if (vistes.has(seva)) return;
        vistes.add(seva);

        const terminacio = tipusRima === 'r.consonant' ? t3(index) : t4(index);
        opcions.push({
          index,
          numero: opcions.length + 1,
          paraula: array0[index],
          arrel: t1(index),
          categoria: descriureCategoria(t2(index)),
          transcripcio: "/-" + terminacio + "/"
        });
      });

      // Amb el loader tapant la pantalla, el diàleg sortiria amb la roda
      // donant voltes al darrere i semblaria que encara carrega alguna
      // cosa. Mentre esperem que l'usuari triï, fora.
      const triada = await Loader.apartat(() => triarHomograf(paraulaCercada, opcions));

      // S'ha tancat el diàleg sense triar: la cerca s'atura aquí i la
      // pantalla es queda tal com estava. Abans agafàvem la primera
      // opció, i això volia dir ensenyar les rimes d'una altra paraula
      // (les de 'dona' nom quan potser volies el verb) sense avisar.
      if (!triada) return null;

      const indexparaula = triada.index;
      filaTrobada = indexparaula;
      llistaParaulaCerca = [
        array0[indexparaula], t1(indexparaula), t2(indexparaula),
        t3(indexparaula), t4(indexparaula), t5(indexparaula),
        t6(indexparaula), t7(indexparaula), t8(indexparaula)
      ];
    }
  }

  paraulaEsNaufraga = calcularSiEsNaufraga(filaTrobada);

  // Els filtres de síl·labes i de categoria no depenen de la paraula sinó del
  // seu valor de columna, i valors diferents només n'hi ha 15 i 337. En lloc
  // de fer la mateixa pregunta 619.783 vegades, es respon un cop per valor i
  // el bucle només mira la resposta a la taula.
  const silabesOK = new Uint8Array(col5.taula.length);
  for (let v = 0; v < col5.taula.length; v++) {
    const silabes = col5.taula[v];
    let passa = true;
    if (silabes !== numeroSeleccionat && numeroSeleccionat !== "0" && numeroSeleccionat !== "6") passa = false;
    if (numeroSeleccionat === "6" && parseInt(silabes) < 6) passa = false;
    silabesOK[v] = passa ? 1 : 0;
  }

  const codiOK = new Uint8Array(col2.taula.length);
  for (let v = 0; v < col2.taula.length; v++) {
    const codi = col2.taula[v];
    let passa = true;
    if (inclourePropis === 'no' && codi[0] === "N" && codi[1] === "P") passa = false;
    if (inclourePlurals === 'no') {
      if (codi[0] === "D" && codi[4] === "P") passa = false; //Determinants
      if (codi[0] === "A" && codi[4] === "P") passa = false; //Adjectius
      if (codi[0] === "N" && codi[3] === "P") passa = false; //Noms
      if (codi[0] === "P" && codi[4] === "P") passa = false; //Pronoms
    }
    codiOK[v] = passa ? 1 : 0;
  }

  // Quines files s'han de mirar. Amb l'índex de rimes no cal recórrer el
  // diccionari sencer: n'hi ha prou amb les files de la rima que busquem, que
  // en consonant són dues de mediana. I la rima es compara com a número, que
  // és el que hi ha guardat: no cal anar a buscar-ne el text.
  let candidates = null; // null = mirar-les totes, de la primera a l'última
  let desDe = 0;
  let finsA = array0.length;

  if (tipusRima === 'r.consonant' || tipusRima === 'r.assonant') {
    if (filaTrobada < 0) {
      finsA = 0; // la paraula no és al diccionari: no rima amb res
    } else {
      const columna = tipusRima === 'r.consonant' ? col3 : col4;
      const index = tipusRima === 'r.consonant' ? indexConsonant : indexAssonant;
      const rima = columna.idx[filaTrobada];
      candidates = index.files;
      desDe = index.inici[rima];
      finsA = index.inici[rima + 1];
    }
  }

  const vocalsValides = 'haeiouàèéíïòóúüHAEIOUÀÈÉÍÏÒÓÚÜ';

  for (let k = desDe; k < finsA; k++) {
    const i = candidates ? candidates[k] : k;

    if (!silabesOK[col5.idx[i]]) continue;
    if (!codiOK[col2.idx[i]]) continue;

    const inicial = array0[i][0];
    if (comença === "vocal+h" && !vocalsValides.includes(inicial)) continue;
    if (comença === "consonant" && vocalsValides.includes(inicial)) continue;

    matches.push([array0[i], t1(i), t2(i), t5(i), t6(i), t7(i), t8(i)]); //no cal guardar les rimes (col3 i col4)
  }

  Debug.logTimeEnd('buscarParaula');
  return [matches, llistaParaulaCerca];
}

//gestió logos per a imprimir
//
// Els logos són el fons de l'enllaç (.logo-vicc, .logo-viq i .logo-diec a
// css/impressio.scss), no pas una imatge a dins. Una cerca ampla ensenya
// desenes de milers de rimes amb fins a tres enllaços cadascuna, i cada <img>
// era un element més del DOM i una feina més per al navegador abans de pintar
// res. Com que el dibuix no diu res que l'enllaç no digui, l'aria-label fa la
// feina que abans feia l'alt.
//
// Les ADRECES tampoc no s'imprimeixen: cada enllaç surt amb un href="#" i la
// bona s'hi posa el primer cop que el ratolí hi passa per sobre o que hi
// arriba el focus del teclat, coses que sempre passen abans del clic. Escrites
// a l'HTML eren una tercera part de tot el que el navegador havia de llegir, i
// de cent mil rimes la gent no en clica cap o en clica una.
const ADRECES = {
  'logo-vicc': 'https://ca.wiktionary.org/wiki/',
  'logo-viq': 'https://ca.wikipedia.org/wiki/',
  'logo-diec': 'https://dlc.iec.cat/Results?DecEntradaText='
};

function completarEnllac(event) {
  const enllac = event.target.closest ? event.target.closest('a.logo') : null;
  if (!enllac || enllac.dataset.fet) return;

  const fila = enllac.closest('li');
  const paraula = fila && fila.dataset.e;
  if (!paraula) return;

  for (const classe in ADRECES) {
    if (enllac.classList.contains(classe)) {
      // La Viquipèdia és l'única que vol la forma tal com es veu i no pas el
      // lema: allà els articles porten el títol sencer, no l'entrada de
      // diccionari. El data-v només hi és quan les dues formes no coincideixen.
      const mot = (classe === 'logo-viq' && fila.dataset.v) || paraula;
      enllac.href = ADRECES[classe] + mot;
      enllac.target = '_blank';
      enllac.dataset.fet = '1';
      return;
    }
  }
}

let enllacosEscoltats = false;

function escoltarElsEnllacos() {
  if (enllacosEscoltats) return;
  const contenidor = document.getElementById('rima_enllac');
  if (!contenidor) return;
  // Un sol escoltador per a tot el contenidor: cent mil enllaços amb el seu
  // escoltador cadascun tornaria a ser el problema que estem evitant.
  contenidor.addEventListener('pointerover', completarEnllac);
  contenidor.addEventListener('focusin', completarEnllac);
  enllacosEscoltats = true;
}

function crearEnllacViccionari() {
  return '<a href="#" class="logo logo-vicc" aria-label="Viccionari"></a>';
}

function crearEnllacViquipedia() {
  return '<a href="#" class="logo logo-viq" aria-label="Viquipèdia"></a>';
}

function crearEnllacDiec() {
  return '<a href="#" class="logo logo-diec" aria-label="DIEC"></a>';
}


// El que s'ha imprès a la pantalla i que aplicarFiltres necessita per saber
// què amagar: quin número de classe té cada codi gramatical, i quins codis hi
// ha a cada grup de síl·labes. Val null quan el que hi ha imprès no és una
// llista de rimes (la paraula nàufraga, o el missatge de no trobada).
let impressio = null;

// El full d'estil que amaga les categories desmarcades. És sempre el mateix i
// se'n reescriu el contingut sencer a cada clic: una sola assignació.
let fullDeFiltres = null;

// Amb poques rimes, redueix el nombre de columnes (l'amplada es manté)
function aplicarNombreDeColumnes(contenidor, nombreResultats) {
  contenidor.classList.remove("cols-1", "cols-2", "cols-3");

  if (nombreResultats < 6) {
    contenidor.classList.add("cols-1");
  } else if (nombreResultats < 14) {
    contenidor.classList.add("cols-2");
  } else if (nombreResultats < 20) {
    contenidor.classList.add("cols-3");
  }
}

function textDelNombre() {
  // A la pàgina principal el rètol diu amb quina paraula es rima, que és la
  // pregunta que s'ha fet l'usuari. Surt la forma del diccionari
  // (paraulacerca[0]) i no pas la que s'ha escrit al camp: si algú cerca
  // "AMOR" o tria una homògrafa al diàleg, el rètol ensenya la paraula tal
  // com és al diccionari.
  //
  // Va amb innerHTML per la negreta, i no cal escapar res: paraulacerca[0]
  // surt del diccionari, no del que escriu l'usuari. Quan no s'ha trobat la
  // paraula val 0, i aleshores es queda el rètol de sempre, que acompanya el
  // missatge de "no s'ha trobat".
  if (idPagina === 'principal') {
    if (paraulacerca[0] === 0) {
      return "Nombre de rimes: " + matches_provisionals.length;
    }
    return "Paraules que rimen amb <strong>" + paraulacerca[0] + "</strong>: " + matches_provisionals.length;
  }

  let text = '';
  if (idPagina === 'llista') {
    if (dataLlista === 'naufragues') {
      text = 'de paraules nàufragues';
    } else if (dataLlista === 'mots_de7_real') {
      text = 'de paraules de set síl·labes';
    } else if (dataLlista === 'mots_de7_glosa') {
      text = "d'heptasíl·labs";
    }
  }
  return "Nombre " + text + ": " + matches_provisionals.length;
}

function actualitzarRimes() {
  Debug.logTime('actualitzarRimes');

  var numerorimes = textDelNombre();
  document.getElementById("nombre").innerHTML = numerorimes;

  actualitzarBotoCompartir();

  var rimesPerSilabes = {};
  var rima_enllac = "";

  var contenidorRimes = document.getElementById("rima_enllac");
  var checkboxContainer = document.getElementById("checkboxContainer");
  var resultatsContainer = document.querySelector(".resultats");

  var textNombre = document.getElementById("nombre");

  if (matches.length > 0) {
    var esNaufraga = paraulaEsNaufraga;
    var tipusRima = document.getElementById('rimaSelector').value;
    if (esNaufraga && tipusRima === 'r.consonant') {
      impressio = null;
      textNombre.innerHTML = ""; 

      contenidorRimes.classList.remove("column-container", "cols-1", "cols-2", "cols-3");

      if (checkboxContainer) checkboxContainer.style.display = "none";
      if (resultatsContainer) resultatsContainer.style.width = "100%";

      var isSober = document.documentElement.getAttribute("data-theme") === "sober";

      if (isSober) {       
        rima_enllac = /*html*/`
          <div class="alerta-naufraga" style="text-align: center; width: 100%; margin-top: 20px;">
            <p><strong>Has trobat una paraula nàufraga.</strong></p>
            <p>La paraula <strong>${paraulacerca[0]}</strong> no rima consonantment amb cap altra paraula del diccionari...</p>
            <p>Consulta la llista de <a id="enllaç" href="${ARREL}llistes/llista_naufragues.html" target="_blank">Paraules nàufragues</a></p>
          </div>
        `;  
      } else {
        rima_enllac = /*html*/`
          <div class="alerta-naufraga" style="
              background-color: #ffff00;
              border: 6px dashed #ff00ff;
              box-shadow: 10px 10px 0px #00ffff;
              padding: 25px;
              text-align: center;
              width: 80%;
              max-width: 600px;
              margin: 40px auto;
              font-family: var(--font-divertida);
              color: #0000cc;
              border-radius: 15px;
              transform: rotate(-1deg);
          ">
            <h2 style="color: #ff0000; text-shadow: 3px 3px 0px #00ff00; font-size: 28px; text-transform: uppercase; margin-top: 0;">Paraula nàufraga!!!</h2>
            <p style="font-size: 18px;">La paraula <strong style="font-size: 24px; color: #ff00ff; text-decoration: underline;">${paraulacerca[0]}</strong> no rima consonantment amb cap altra paraula del diccionari...</p>

            <div style="margin-top: 25px; background: #817f7f; padding: 10px; border-radius: 8px; border: 2px solid #00ffff;">
              <p style="font-weight: bold; font-size: 18px; color: white; margin: 0;">
                Consulta la llista de <a id="enllaçbrillant" href="${ARREL}llistes/llista_naufragues.html" target="_blank">Paraules nàufragues</a>
              </p>
            </div>
          </div>
        `;
      }
      
    } else {
        if (checkboxContainer) checkboxContainer.style.display = "";
        if (resultatsContainer) resultatsContainer.style.width = "";
        contenidorRimes.classList.add("column-container");

        // Es pinten TOTES les rimes trobades, no només les que passen el filtre
        // de categories d'ara mateix. Amagar-ne unes quantes passa a ser una
        // sola regla de CSS (vegeu aplicarFiltres). Abans, cada clic de casella
        // refeia l'HTML sencer: muntar-lo són mig segon i que el navegador se'l
        // torni a llegir, dos segons més.
        //
        // El que fa possible que una regla de CSS n'hi hagi prou: tots els
        // criteris de les caselles miren el codi gramatical i res més, o sigui
        // que dues rimes amb el mateix codi sempre hi entren i en surten
        // juntes. Amb una classe per codi n'hi ha prou per a totes.
        //
        // Els trossos de text s'apilen directament al seu grup de síl·labes. La
        // versió d'abans fabricava un objecte per rima només per reagrupar-les
        // i tot seguit els tornava a recórrer.
        const codis = new Map();
        const perSilabes = new Map();

        for (let i = 0; i < matches.length; i++) {
          const parts = matches[i];
          const codi = parts[2];

          let numCodi = codis.get(codi);
          if (numCodi === undefined) { numCodi = codis.size; codis.set(codi, numCodi); }

          let grup = perSilabes.get(parts[3]);
          if (!grup) { grup = { trossos: [], codis: new Set() }; perSilabes.set(parts[3], grup); }
          grup.codis.add(numCodi);

          // El data-e és la paraula amb què es munten les adreces dels enllaços
          // (vegeu completarEnllac). No sempre és la que es veu: de cada cent
          // rimes, noranta-tres vénen d'una altra forma.
          //
          // El data-v és la forma que es veu, i només per a la Viquipèdia. No
          // s'imprimeix si no cal: sense enllaç de Viquipèdia, o si la forma i
          // el lema ja són el mateix, l'atribut seria pes mort a cada <li>.
          let dadaViq = "";
          if (parts[5] === "Viq" && parts[0] !== parts[1]) dadaViq = " data-v=\"" + parts[0] + "\"";

          let tros = "<li class='k" + numCodi + "' data-e=\"" + parts[1] + "\"" + dadaViq + ">" + parts[0];

          // Abans hi havia un <span class='classeParaula'> al voltant de la
          // paraula. No el gastava ningú: no hi ha cap regla de CSS que el miri.
          if (codi[0] === "V") tros += "<span class='classeParaulaMare'> (" + parts[1] + ") </span>";

          if (parts[4] === "Vicc") tros += " " + crearEnllacViccionari();
          if (parts[5] === "Viq") tros += " " + crearEnllacViquipedia();
          if (parts[6] === "Diec") tros += " " + crearEnllacDiec();

          grup.trossos.push(tros + "</li>");
        }

        const grups = [];
        const ordenades = [...perSilabes.keys()].sort((a, b) => a - b);

        for (const sil of ordenades) {
          const grup = perSilabes.get(sil);
          const classe = "g" + grups.length;
          grups.push({ classe, codis: grup.codis });

          let titol = "";
          if (dataLlista === 'mots_de7_glosa') {
            if (sil == 7) titol = "7 síl·labes (mots aguts):";
            else if (sil == 8) titol = "8 síl·labes (mots plans):";
            else if (sil == 9) titol = "9 síl·labes (mots esdrúixols):";
          } else {
            titol = sil + (sil > 1 ? " síl·labes" : " síl·laba") + ":";
          }
          if (sil == 0) titol = "verb + pronom(s):";


          // El <br> el treu el CSS al primer títol que es veu, que no sempre és
          // el mateix: depèn de quins grups hagin quedat buits pel filtre.
          if (titol) rima_enllac += "<h3 class='" + classe + "'><br class='salt'>" + titol + "</h3>";
          rima_enllac += "<ul class='" + classe + "'>" + grup.trossos.join("") + "</ul>";
        }

        // Surt quan les caselles ho amaguen tot. Va imprès des del principi
        // perquè ensenyar-lo també sigui cosa de la regla de CSS.
        rima_enllac += "<ul class='capRima'><li>Ets massa exigent! Aquesta paraula existeix i té més resultats, però per trobar-los hauràs de canviar els filtres</li></ul>";

        impressio = { codis, grups };
    }

  } else {
    impressio = null;
    textNombre.innerHTML = numerorimes;
    contenidorRimes.classList.remove("column-container", "cols-1", "cols-2", "cols-3");
    var rimes;
    if (paraulacerca[0] === 0) {
      if (checkboxContainer) checkboxContainer.style.display = "none";
      if (resultatsContainer) resultatsContainer.style.width = "100%";
      rimes = "<span class='missatgeNoTrobat'><br>No s'ha trobat la paraula al diccionari. Revisa l'ortografia i recorda cercar la paraula sencera, no la terminació.</span>";
    } else {
      if (checkboxContainer) checkboxContainer.style.display = "";
      if (resultatsContainer) resultatsContainer.style.width = "";
      rimes = "Ets massa exigent! Aquesta paraula existeix i té més resultats, però per trobar-los hauràs de canviar els filtres";
    }
    
    rima_enllac = "<ul><li>" + rimes + "</li></ul>";
  }

  document.getElementById("rima_enllac").innerHTML = rima_enllac;
  escoltarElsEnllacos();
  aplicarFiltres();

  Debug.logTimeEnd('actualitzarRimes');
}


// Amaga i ensenya les rimes segons les caselles marcades, sense tocar l'HTML:
// escriu una sola regla de CSS. Abans, cada clic refeia la llista sencera.
function aplicarFiltres() {
  const contenidorRimes = document.getElementById("rima_enllac");
  const textNombre = document.getElementById("nombre");
  if (textNombre && impressio) textNombre.innerHTML = textDelNombre();
  if (!impressio) return;

  Debug.logTime('aplicarFiltres');

  // Quins codis han quedat. Com que els criteris de les caselles només miren
  // el codi, saber quins codis hi ha és saber quines rimes s'han de veure.
  const visibles = new Set();
  for (let i = 0; i < matches_provisionals.length; i++) {
    const numero = impressio.codis.get(matches_provisionals[i][2]);
    if (numero !== undefined) visibles.add(numero);
  }

  const amagats = [];
  for (const numero of impressio.codis.values()) {
    if (!visibles.has(numero)) amagats.push(".k" + numero);
  }

  // Un grup de síl·labes que es queda sense cap rima visible perd el títol.
  let primerGrup = null;
  for (const grup of impressio.grups) {
    let enTeAlguna = false;
    for (const numero of grup.codis) {
      if (visibles.has(numero)) { enTeAlguna = true; break; }
    }
    if (!enTeAlguna) amagats.push("." + grup.classe);
    else if (!primerGrup) primerGrup = grup.classe;
  }

  // Les rimes s'amaguen amb content-visibility i no amb display:none. Totes
  // dues les treuen de la pantalla igual i el resultat es veu idèntic, però
  // display:none llença la feina que el navegador ja tenia feta per dibuixar-
  // les, i tornar-les a ensenyar vol dir tornar-la a fer de zero.
  // content-visibility:hidden se la guarda: el navegador se salta el
  // contingut però recorda com el tenia col·locat.
  //
  // Mesurat amb una llista d'aquestes mides, amagar-la i tornar-la a
  // ensenyar: amb display:none, 10.278 ms. Amb content-visibility, 2.000 ms
  // la primera vegada i 624 la segona, que és quan ja se'n recorda.
  //
  // L'alçada, els marges i el farciment es posen a zero perquè la rima amagada
  // no deixi el seu forat: a diferència de display:none, la caixa hi continua
  // sent encara que no s'hi vegi res.
  const AMAGAR = "{content-visibility:hidden;contain-intrinsic-size:0;height:0;margin:0;padding:0}";

  const capRima = matches_provisionals.length === 0;
  let css = amagats.length ? "#rima_enllac " + amagats.join(",#rima_enllac ") + AMAGAR : "";
  if (capRima) css += "#rima_enllac .capRima{display:block}";

  if (!fullDeFiltres) {
    fullDeFiltres = document.createElement("style");
    document.head.appendChild(fullDeFiltres);
  }
  fullDeFiltres.textContent = css;

  // El primer títol que es veu no porta el salt de línia de davant, i quin és
  // depèn de quins grups hagin quedat buits.
  const anterior = contenidorRimes.querySelector("h3.primer");
  if (anterior) anterior.classList.remove("primer");
  if (primerGrup) {
    const titol = contenidorRimes.querySelector("h3." + primerGrup);
    if (titol) titol.classList.add("primer");
  }

  contenidorRimes.classList.toggle("column-container", !capRima);
  aplicarNombreDeColumnes(contenidorRimes, matches_provisionals.length);

  Debug.logTimeEnd('aplicarFiltres');
}



function mostrarTotesLesLlistes() {
  Debug.logTime('mostrarTotesLesLlistes');

  var resultats = obtenirValorsSegonsPrimerCaracter(matches)

  mostrarLlista('noms', resultats.resultatsN, 'checkbox1');
  mostrarLlista('adjectius', resultats.resultatsA, 'checkbox2');
  mostrarLlista('verbs', resultats.resultatsV, 'checkbox3');
  mostrarLlista('infinitiupronom', resultats.resultatsWN, 'checkbox7');
  mostrarLlista('gerundipronom', resultats.resultatsWG, 'checkbox8');
  mostrarLlista('determinants', resultats.resultatsD, 'checkbox4');
  mostrarLlista('pronoms', resultats.resultatsP, 'checkbox5');
  mostrarLlista('altres', resultats.resultatsAlt, 'checkbox6');

  Debug.logTimeEnd('mostrarTotesLesLlistes');
}

function mostrarLlista(tipusLlista, elementsAMostrar, checkboxId) {
  Debug.logTime('mostrarLlista');

  var titleSelector = '#' + checkboxId;
  var listSelector = '#' + tipusLlista + 'List';

  var listTitle = document.querySelector(titleSelector);
  var list = document.querySelector(listSelector);

  if (listTitle && list) {
      listTitle.parentElement.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';
      list.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';

      var elementsDeLlista = list.querySelectorAll('li');

      elementsDeLlista.forEach(function (element, index) {
          element.style.display = 'none';
      });

      elementsAMostrar.forEach(function (indexToShow) {
          if (indexToShow < elementsDeLlista.length) {
              elementsDeLlista[indexToShow].style.display = 'list-item';
          }
      });

  } else {
      Debug.log('No es compleixen les condicions per entrar a la lògica principal');
  }
  Debug.logTimeEnd('mostrarLlista');
}


function toggleList(listID, checkboxID) {
  Debug.logTime('toggleList');

  var list = document.getElementById(listID);
  var checkboxTitle = document.getElementById(checkboxID);

  var checkboxes = list.querySelectorAll('input[type="checkbox"]');

  if (checkboxTitle.checked) {
    checkboxes.forEach(function (checkbox) {
      checkbox.checked = true;
    });
  } else {
    checkboxes.forEach(function (checkbox) {
      checkbox.checked = false;
    });
  }
  Debug.logTimeEnd('toggleList');
}


async function handleCheckboxClick(event, checkboxCriteria) {
  Debug.logTime('handleCheckboxClick');

  if (event.target.type === 'checkbox') {
      // textContent, no pas innerText. Tots dos donen la mateixa paraula
      // ("Verbs", "Propis"...), però innerText promet el text tal com es
      // veu, i per poder-ho prometre el navegador ha de tenir la pàgina
      // ben col·locada: en demanar-lo, atura tot i recalcula la
      // disposició sencera. Amb cent mil rimes repartides en columnes
      // això eren vint segons per llegir una etiqueta que ja tenim
      // escrita a l'HTML. El textContent el llegeix de l'arbre i prou.
      const checkboxLabel = event.target.parentNode.textContent.trim();

      const elementLi = event.target.closest('li');
      if (elementLi) {
          const elementUl = elementLi.closest('ul');
          if (elementUl) {
              const casellesMarcadesVisibles = Array.from(elementUl.querySelectorAll('li')).filter(li => {
                  if (li.style.display === 'none') return false;
                  const input = li.querySelector('input[type="checkbox"]');
                  return input && input.checked;
              });
              
              const checkboxPrincipal = document.querySelector(`input[onchange*="${elementUl.id}"]`);
              
              if (checkboxPrincipal) {
                  checkboxPrincipal.checked = casellesMarcadesVisibles.length > 0;
              }
          }
      }


      if (checkboxLabel in checkboxCriteria) {
          const { filterFunction } = checkboxCriteria[checkboxLabel];

          // Sense loader. En tenia un, amb un llindar de deu mil rimes, de
          // quan clicar una casella volia dir refer la llista sencera i podia
          // trigar segons. Ara que amagar-les és una regla de CSS, la feina
          // més llarga que s'ha mesurat són 46 mil·lisegons: el loader només
          // hi feia una pampalluga negra.
          if (event.target.checked) {
              // Unió del que ja hi havia amb el que acaba d'entrar, d'una
              // sola passada i ordenat com el diccionari.
              //
              // Abans això es feia amb un includes() per cada resultat nou
              // i un sort() que a dins hi tenia un indexOf(): totes dues
              // coses recorren la llista sencera cada vegada. Amb una rima
              // ampla (n'hi ha que passen de les cent mil paraules) volia
              // dir milers de milions de comparacions per un sol clic, i
              // el navegador es quedava penjat.
              const inclosos = new Set(matches_provisionals);
              for (let i = 0; i < matches.length; i++) {
                  if (filterFunction(matches[i])) inclosos.add(matches[i]);
              }
              matches_provisionals = matches.filter(item => inclosos.has(item));

              Debug.log(`Checkbox "${checkboxLabel}" marcada`);

          } else {
              Debug.log(`Checkbox "${checkboxLabel}" desclicat`);
              matches_provisionals = matches_provisionals.filter(item => !filterFunction(item));
          }

          aplicarFiltres();
  }   }
  Debug.logTimeEnd('handleCheckboxClick');
}


function obtenirValorsSegonsPrimerCaracter(matches) {
  Debug.logTime('obtenirValorsSegonsPrimerCaracter');

  var resultatsN = [];
  var resultatsA = [];
  var resultatsV = [];
  var resultatsWN = [];
  var resultatsWG = [];
  var resultatsD = [];
  var resultatsP = [];
  var resultatsAlt = [];

  for (var i = 0; i < matches.length; i++) {
      var terceraColumna = matches[i][2];
      var primerCaracter = terceraColumna.charAt(0);
      var segonCaracter = terceraColumna.charAt(1);
      var tercerCaracter = terceraColumna.charAt(2);
      var siseCaracter = terceraColumna.charAt(5);
      // Les preposicions (ZSPS) i les contraccions (ZSP+) es distingeixen per
      // la QUARTA lletra del codi, no per la tercera: totes dues tenen una P
      // a la tercera. Mirant-hi el tercerCaracter no s'hi acomplia mai cap
      // dels dos casos i les dues subcaselles no s'ensenyaven mai, tot i que
      // les paraules (a, amb, de, per, sense, al, del, pel...) sí que
      // s'imprimien a les rimes.
      var quartCaracter = terceraColumna.charAt(3);

      switch (primerCaracter) {   
          
          case "N": // Noms
              switch (segonCaracter) {
                  case "P": resultatsN.push(0); break; // Propis
                  case "C": resultatsN.push(1); break; // Comuns
              }
              break;

          case "A": // Adjectius
              switch (segonCaracter) {
                  case "Q": // Adjectius
                    switch (tercerCaracter) {
                        case "0": resultatsA.push(0); break; // Qualificatius
                        case "A": resultatsA.push(1); break; // Superlatius
                    }
                    break;
                  case "O": resultatsA.push(2); break; // Ordinals
              }
              break;
          
          case "V": // Verbs
              switch (tercerCaracter) {
                  case "I": resultatsV.push(0); break; // Indicatiu
                  case "S": resultatsV.push(1); break; // Subjuntiu
                  case "M": resultatsV.push(2); break; // Imperatiu
                  case "G": resultatsV.push(3); break; // Gerundi
                  case "P": resultatsV.push(4); break; // Participi
                  case "N": resultatsV.push(5); break; // Infinitiu
                  case "C": resultatsV.push(6); break; // Condicional

              }
              break; 
          
          case "W": // Verbs + pronoms              
              if (segonCaracter === "N") { // infinitiu
                  switch (siseCaracter) {
                      case "1": resultatsWN.push(0); break; // + 1 pronom
                      case "2": resultatsWN.push(1); break; // + 2 pronoms
                  }
              } else if (segonCaracter === "G") { // gerundi
                  switch (siseCaracter) {
                      case "1": resultatsWG.push(0); break; // + 1 pronom
                      case "2": resultatsWG.push(1); break; // + 2 pronoms
                  }
              }
              break;
              
          case "D": // Determinants
              switch (segonCaracter) {
                  case "N": resultatsD.push(0); break; // Números
                  case "A": resultatsD.push(1); break; // Articles
                  case "R": resultatsD.push(2); break; // Relatius
                  case "T": resultatsD.push(3); break; // Interrogatius
                  case "D": resultatsD.push(4); break; // Demostratius
                  case "E": resultatsD.push(5); break; // Exclamatius
                  case "I": resultatsD.push(6); break; // Indefinits
                  case "P": resultatsD.push(7); break; // Possessius
              }
              break;

          case "P": // Pronoms
              switch (segonCaracter) {
                  case "D": resultatsP.push(0); break; // Demostratius
                  case "I": resultatsP.push(1); break; // Indefinits
                  case "T": resultatsP.push(2); break; // Interrogatius / Exclamatius
                  case "P": case "0": resultatsP.push(3); break; // Personals
                  case "X": resultatsP.push(4); break; // Possessius
                  case "R": resultatsP.push(5); break; // Relatius
              }
              break;

          case "Z": // Altres
              switch (segonCaracter) {
                  case "R": resultatsAlt.push(0); break; // Adverbis
                  case "C": resultatsAlt.push(1); break; // Conjuncions
                  case "I": resultatsAlt.push(2); break; // Interjeccions
                  case "F": resultatsAlt.push(5); break; // "etcètera"
              }
              if (segonCaracter === "S") {
                  switch (quartCaracter) {
                      case "S": resultatsAlt.push(3); break; // Preposicions
                      case "+": resultatsAlt.push(4); break; // Contraccions
                  }
              }
              break;
      }
  }

  Debug.logTimeEnd('obtenirValorsSegonsPrimerCaracter');
  return {
      resultatsN: resultatsN,
      resultatsA: resultatsA,
      resultatsV: resultatsV,
      resultatsWN: resultatsWN,
      resultatsWG: resultatsWG,
      resultatsD: resultatsD,
      resultatsP: resultatsP,
      resultatsAlt: resultatsAlt,
  };
}

// ============================================================= //
// ============================================================= //

//CSS
function ajustarPosicionsSticky() {
  var container = document.getElementById('container');
  var checkboxContainer = document.getElementById('checkboxContainer');
  var separador_rosa2 = document.getElementById('separador_rosa2');
  
  if (!container || !checkboxContainer || !separador_rosa2) return;
  
  var calculTop = 40 + container.offsetHeight;
  
  separador_rosa2.style.top = calculTop + 'px';
  checkboxContainer.style.top = (calculTop + 40) + 'px'; 
}

document.addEventListener('DOMContentLoaded', ajustarPosicionsSticky);

var observer = new ResizeObserver(function() {
    ajustarPosicionsSticky();
});

var containerEl = document.getElementById('container');
if (containerEl) {
    observer.observe(containerEl);
}

// ============================================================= //
// ============================================================= //

// boring style
const THEME_STORAGE_KEY = "rimadorTheme";

let colorFestiuOriginal = null;

function aplicarTema(tema) {
  var peixetImg = document.getElementById("peixetImg");
  var rimadorImg = document.getElementById("rimadorImg");
  var themeColorMeta = document.getElementById("themeColor");

  if (themeColorMeta && !colorFestiuOriginal) {
    colorFestiuOriginal = themeColorMeta.getAttribute("content");
  }

  // La ruta dels assets surt de components.js, només s'ha de tocar allà
  const ruta = ruta1;

  if (tema === "sober") {
    document.documentElement.setAttribute("data-theme", "sober");
    if (peixetImg) {
      peixetImg.src = ruta + "boringlogo.webp";
      peixetImg.alt = "Logo (mode sobri)";
    }
    if (rimadorImg) {
      rimadorImg.src = ruta + "Rimador-1-sober.webp";
      rimadorImg.alt = "El Rimador.cat (mode sobri)";
    }
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", "#e6e4e5");
    }
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (peixetImg) {
      peixetImg.src = ruta + "peixet.webp";
      peixetImg.alt = "Peixet decoratiu";
    }
    if (rimadorImg) {
      rimadorImg.src = ruta + "Rimador_nou.webp";
      rimadorImg.alt = "Logo del Rimador.cat";
    }
    if (themeColorMeta && colorFestiuOriginal) {
      themeColorMeta.setAttribute("content", colorFestiuOriginal);
    }
  }
}

function toggleTheme() {
  var temaActual = localStorage.getItem(THEME_STORAGE_KEY) === "sober" ? "sober" : "festiu";
  var temaNou = temaActual === "sober" ? "festiu" : "sober";

  try {
    localStorage.setItem(THEME_STORAGE_KEY, temaNou);
  } catch (e) {
    console.error("No s'ha pogut desar el tema a localStorage", e);
  }

  aplicarTema(temaNou);
  if (document.querySelector('.alerta-naufraga')) {
      actualitzarRimes();
    }
  if (typeof actualitzarColorsGrafics === 'function') {
      actualitzarColorsGrafics();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  var temaDesat = null;
  try {
    temaDesat = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (e) {}
  aplicarTema(temaDesat === "sober" ? "sober" : "festiu");
});

// ============================================================= //
// ============================================================= //


/// Botó per pujar
(function () {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  const scroller = document.getElementById('paper-window') || window;
  const getScrollY = () =>
    scroller === window ? window.scrollY : scroller.scrollTop;
 
  const SHOW_AFTER_PX = 400;
 
  const toggle = () => {
    const visible = getScrollY() > SHOW_AFTER_PX;
    btn.classList.toggle('is-visible', visible);
    btn.setAttribute('aria-hidden', String(!visible));
    btn.tabIndex = visible ? 0 : -1;
  };
 
  btn.addEventListener('click', () => {
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    scroller.scrollTo({ top: 0, behavior });
  });
 
  scroller.addEventListener('scroll', toggle, { passive: true });
  toggle();
})();
