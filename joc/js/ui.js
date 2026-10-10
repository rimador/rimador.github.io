// Tot el que toca el DOM. La resta de moduls no en saben res.

export const el = {};

const NOMS = [
    'pantalla-inici', 'pantalla-config', 'pantalla-joc', 'pantalla-final',
    'pantalla-records', 'pantalla-classificacio', 'pantalla-ahir',
    'pantalla-personalitzat', 'pantalla-convit', 'pantalla-ronda', 'pantalla-resum',
    'etiqueta-diaria', 'config-titol', 'config-avis', 'config-record', 'config-dialecte',
    'tira-dialectes',
    'opcions-dificultat', 'opcions-temps', 'grup-temps', 'boto-comencar',
    'rellotge', 'punts', 'barra-temps', 'objectiu', 'objectiu-rimes', 'modalitat', 'ronda-actual',
    'formulari', 'camp', 'toast', 'trobades',
    'resultat-punts', 'resultat-text', 'etiqueta-record', 'resum',
    'boto-compartir', 'boto-piular', 'boto-repetir', 'trobades-final', 'titol-llista',
    'bloc-estadistiques', 'estadistiques-percentil', 'estadistiques-mitjana',
    'estadistiques-nota',
    'bloc-classificacio', 'camp-sobrenom', 'fila-sobrenom', 'estat-enviament',
    'grup-jugador', 'jugador-nota', 'jugador-fet', 'jugador-nom', 'estat-sobrenom',
    'boto-desar-sobrenom', 'boto-canviar-sobrenom',
    'ahir-data', 'ahir-dificultat', 'ahir-paraula',
    'ahir-mitjana', 'ahir-estat', 'ahir-llista',
    'records-buit', 'llista-records',
    'classificacio-selector', 'classificacio-estat', 'classificacio-llista', 'classificacio-data',
    'classificacio-subtitol', 'classificacio-dificultat',
    'carregant', 'carregant-text', 'carregant-barra', 'carregant-progres', 'carregant-nota',
    'capcalera-marca',
    'pers-dialecte', 'pers-dificultat', 'pers-accents', 'pers-rimes-nota',
    'pers-min', 'pers-max', 'pers-sense-sostre', 'pers-segons', 'pers-rondes',
    'pers-recompte', 'pers-crear',
    'convit-codi', 'convit-resum', 'convit-enllac', 'convit-copiar', 'convit-estat',
    'convit-comencar',
    'ronda-titol', 'ronda-punts', 'ronda-text', 'ronda-resum', 'ronda-seguent',
    'ronda-titol-llista', 'ronda-trobades',
    'resum-partida', 'resum-total', 'resum-rondes', 'resum-una-altra',
    'resum-compartir',
];

export function preparar() {
    for (const nom of NOMS) {
        el[aCamell(nom)] = document.getElementById(nom);
    }
}

function aCamell(text) {
    return text.replace(/-([a-z])/g, (_, lletra) => lletra.toUpperCase());
}

// ------------------------------------------------------------- Pantalles

const PANTALLES = ['inici', 'config', 'joc', 'final', 'records', 'classificacio',
                   'ahir', 'personalitzat', 'convit', 'ronda', 'resum'];

export function mostrarPantalla(nom) {
    for (const pantalla of PANTALLES) {
        el[aCamell(`pantalla-${pantalla}`)].hidden = pantalla !== nom;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

export function mostrarCarregant(visible, text) {
    if (text) el.carregantText.textContent = text;
    el.carregant.hidden = !visible;
    if (!visible) {
        el.carregantBarra.hidden = true;
        el.carregantNota.hidden = true;
        el.carregantProgres.style.width = '0%';
    }
}

/**
 * Com va la descàrrega de les rimes.
 *
 * Només surt quan hi ha alguna cosa a baixar: si el fitxer del dialecte ja és a
 * la memòria (perquè la precàrrega de l'arrencada ha tingut temps), la partida
 * s'obre en 90 ms i això no s'arriba a veure.
 */
export function progresCarregant({ rebut, total }) {
    if (!total || rebut >= total) {
        el.carregantText.textContent = 'Preparant la partida…';
        el.carregantBarra.hidden = true;
        el.carregantNota.hidden = true;
        return;
    }

    const percentatge = Math.max(0, Math.min(100, Math.round((rebut / total) * 100)));
    el.carregantText.textContent = `Baixant les rimes… ${percentatge} %`;
    el.carregantBarra.hidden = false;
    el.carregantNota.hidden = false;
    el.carregantProgres.style.width = `${percentatge}%`;
}

// Alguns botons (els de l'arc de Sant Martí) porten el text dins d'un <span>.
// Escriure directament a textContent l'esborraria, o sigui que si hi ha span,
// hi escrivim a dins.
export function texteBoto(boto, text) {
    const span = boto.querySelector('span');
    (span || boto).textContent = text;
}

// ---------------------------------------------------------------- Opcions

/**
 * Un grup de botons que fa de radiogroup. Torna una funcio per llegir el valor
 * escollit i una per canviar-lo.
 */
export function grupOpcions(contenidor, atribut, alCanviar) {
    const botons = [...contenidor.querySelectorAll('.opcio')];

    function seleccionar(valor) {
        for (const boto of botons) {
            boto.setAttribute('aria-checked', String(boto.dataset[atribut] === valor));
        }
        if (alCanviar) alCanviar(valor);
    }

    contenidor.addEventListener('click', (esdeveniment) => {
        const boto = esdeveniment.target.closest('.opcio');
        if (boto && !boto.disabled) seleccionar(boto.dataset[atribut]);
    });

    return {
        valor: () => {
            const triat = botons.find((boto) => boto.getAttribute('aria-checked') === 'true');
            return triat ? triat.dataset[atribut] : botons[0].dataset[atribut];
        },
        seleccionar,
        activar: (valor, actiu) => {
            const boto = botons.find((b) => b.dataset[atribut] === valor);
            if (boto) boto.disabled = !actiu;
        },
    };
}

// ------------------------------------------------------ Tira de dialectes

/**
 * La tira per triar el dialecte, com la del cercador (vegeu el DIALECTES de
 * js/components.js). La llista ve de dades/versions.json i ja arriba ordenada:
 * aqui nomes es pinta tal com ve, sense saber quins dialectes hi ha ni com es
 * diuen.
 */
export function pintarTiraDialectes(dialectes, actiu, alTriar) {
    el.tiraDialectes.replaceChildren(
        ...dialectes.map(({ codi, nom }) => {
            const boto = document.createElement('button');
            boto.type = 'button';
            boto.className = 'dialecte';
            boto.dataset.dialecte = codi;
            boto.setAttribute('role', 'radio');
            boto.setAttribute('aria-checked', String(codi === actiu));
            boto.textContent = nom;
            boto.addEventListener('click', () => alTriar(codi));
            return boto;
        })
    );
}

/**
 * L'enllaç de la marca de la capçalera, que torna a la portada del joc. Hi
 * enganxem el dialecte que s'està jugant: tornar a la portada no ha de
 * canviar-te'l, i qui ha arribat amb un ?d= d'algú altre no el té desat enlloc
 * (vegeu inicial i desar a dialecte.js).
 */
export function enllacDePortada(codi) {
    el.capcaleraMarca.setAttribute('href', `./?d=${encodeURIComponent(codi)}`);
}

export function marcarDialecte(codi) {
    for (const boto of el.tiraDialectes.querySelectorAll('.dialecte')) {
        boto.setAttribute('aria-checked', String(boto.dataset.dialecte === codi));
    }
}

// ----------------------------------------------------------------- Partida

// La modalitat es diu mentre es juga perque, un cop dins la partida, ja no es
// veu enlloc quina de les dues s'ha triat a la pantalla de configuracio.
const MODALITAT = {
    facil: 'Fàcil (rima assonant)',
    dificil: 'Difícil (rima consonant)',
};

// Les vocals de les claus de rima, tal com les escriu la transcripcio (les
// mateixes als quatre dialectes). La clau ASSONANT es exactament la clau
// consonant sense les consonants: comprovat contra les 520.418 files de la
// col_3 i la col_4 de cada dialecte sense cap desacord, o sigui que no cal
// portar-la a l'index.
const VOCALS_DE_LA_CLAU = /[^aeiouɔəɛ]/g;

/**
 * La paraula a rimar i, a sota, quantes paraules hi rimen i amb quina
 * terminacio, en fonetica: «Hi ha 195 paraules que rimen amb \aɾts\».
 * En facil la terminacio es l'assonant (nomes les vocals), perque es el que val.
 *
 * `detall` es { rimes, clau }: les rimes ja sense la paraula objectiu (les
 * rimesPossibles de la partida) i la clau consonant de la seccio.
 */
export function pintarObjectiu(paraula, dificultat, detall) {
    el.objectiu.textContent = paraula;
    el.modalitat.textContent = MODALITAT[dificultat] || MODALITAT.facil;
    el.modalitat.classList.toggle('modalitat--dificil', dificultat === 'dificil');

    el.objectiuRimes.hidden = !detall;
    if (!detall) return;
    const clau = dificultat === 'dificil'
        ? detall.clau
        : detall.clau.replace(VOCALS_DE_LA_CLAU, '');
    el.objectiuRimes.textContent = `Hi ha ${detall.rimes.toLocaleString('ca-ES')} `
        + `${detall.rimes === 1 ? 'paraula que rima' : 'paraules que rimen'} amb \\${clau}\\`;
}

/**
 * Quina ronda s'està jugant. Només surt al mode personalitzat, que és l'únic
 * que en té més d'una: amb tres o quatre partides seguides és fàcil perdre el
 * compte de per on vas.
 */
export function pintarRonda(ronda, rondes) {
    const hiEs = Boolean(rondes) && rondes > 1;
    el.rondaActual.hidden = !hiEs;
    if (hiEs) el.rondaActual.textContent = `Ronda ${ronda} de ${rondes}`;
}

export function actualitzarPunts(punts) {
    el.punts.textContent = String(punts);
}

export function actualitzarRellotge(segonsRestants, segonsTotals, textFormatat) {
    el.rellotge.textContent = textFormatat;
    const percentatge = Math.max(0, Math.min(100, (segonsRestants / segonsTotals) * 100));
    el.barraTemps.style.width = `${percentatge}%`;

    const alerta = segonsRestants <= 10;
    el.rellotge.classList.toggle('marcador__valor--alerta', alerta);
    el.barraTemps.classList.toggle('barra-temps__interior--alerta', alerta);
}

let temporitzadorToast = null;

export function avisar(text, tipus) {
    el.toast.textContent = text;
    el.toast.className = `toast toast--visible toast--${tipus}`;
    clearTimeout(temporitzadorToast);
    temporitzadorToast = setTimeout(() => {
        el.toast.className = 'toast';
    }, 1200);
}

let temporitzadorAnimacio = null;

export function animarEntrada(tipus) {
    const forma = el.formulari;
    forma.classList.remove('entrada--encert', 'entrada--error');
    // Forcem un reflow perque l'animacio es torni a disparar si es repeteix.
    void forma.offsetWidth;
    forma.classList.add(`entrada--${tipus}`);
    clearTimeout(temporitzadorAnimacio);
    temporitzadorAnimacio = setTimeout(() => {
        forma.classList.remove('entrada--encert', 'entrada--error');
    }, 400);
}

export function afegirTrobada(paraula) {
    const item = document.createElement('li');
    item.textContent = paraula;
    el.trobades.prepend(item);
}

export function buidarPartida() {
    el.trobades.replaceChildren();
    el.toast.className = 'toast';
    el.toast.textContent = '';
    el.camp.value = '';
    el.camp.disabled = false;
    el.formulari.querySelector('button').disabled = false;
}

export function bloquejarEntrada() {
    el.camp.disabled = true;
    el.formulari.querySelector('button').disabled = true;
    el.camp.blur();
}

// ------------------------------------------------------------------- Final

/**
 * L'enllaç al cercador amb la paraula ja cercada, en el dialecte i la mena de
 * rima que s'acabaven de jugar.
 *
 * És la sortida natural de la pantalla de final: acabes de veure que la paraula
 * en tenia dues-centes i el que vols és saber quines eren. El cercador ja entén
 * els tres paràmetres (vegeu cercarDesDeLaURL i dialecteInicial a js/script.js):
 *
 *   ../?q=<paraula>&d=<dialecte>[&rima=assonant]
 *
 * Amb "../" i no pas amb una adreça absoluta, com la resta dels enllaços del
 * joc: així també funciona al repositori de proves, que GitHub Pages publica
 * dins /NOM-DEL-REPOSITORI/. El `rima=assonant` només hi va en fàcil; qualsevol
 * altra cosa deixa el cercador amb la consonant, que és el que ja fa per
 * defecte.
 */
export function enllacDeRimes(text, { objectiu, dialecte, dificultat }) {
    const enllac = document.createElement('a');
    const params = new URLSearchParams({ q: objectiu, d: dialecte });
    
    if (dificultat !== 'dificil') params.set('rima', 'assonant');
    
    enllac.className = 'enllac-rimes';
    enllac.href = `../?${params}`;
    enllac.textContent = text;
    enllac.title = `Mira les rimes de «${objectiu}» al Rimador.cat`;
    
    
    // Obre l'enllaç en una pestanya nova
    enllac.target = '_blank';
    // Mesura de seguretat recomanada en obrir noves pestanyes
    enllac.rel = 'noopener noreferrer';
    return enllac;
}

/**
 * Quantes rimes tenia la paraula, com a enllaç al cercador. Torna els nodes
 * perquè el text de sota (el rècord) hi va enganxat a la mateixa frase.
 */
function fraseDeRimes({ objectiu, rimesPossibles, dialecte, dificultat }) {
    const compte = `${rimesPossibles.toLocaleString('ca-ES')} `
        + `${rimesPossibles === 1 ? 'rima possible' : 'rimes possibles'}`;
    return [
        `«${objectiu}» tenia `,
        enllacDeRimes(compte, { objectiu, dialecte, dificultat }),
        '.',
    ];
}

export function pintarFinal({ punts, paraules, objectiu, rimesPossibles, recordNou,
                             record, titolLlista, dialecte, dificultat }) {
    el.resultatPunts.textContent = String(punts);
    el.resultatText.textContent = punts === 1 ? 'rima trobada' : 'rimes trobades';
    el.etiquetaRecord.hidden = !recordNou;

    const trobables = fraseDeRimes({ objectiu, rimesPossibles, dialecte, dificultat });
    el.resum.replaceChildren(...(recordNou || !record
        ? trobables
        : [...trobables, ` El teu rècord en aquesta modalitat és ${record}.`]));

    el.titolLlista.textContent = titolLlista;
    el.titolLlista.hidden = paraules.length === 0;
    el.trobadesFinal.replaceChildren(
        ...paraules.map((paraula) => {
            const item = document.createElement('li');
            item.textContent = paraula;
            return item;
        })
    );
}

/**
 * El botó de piular el resultat a X (Twitter). Amb `adreca` a null es queda
 * amagat, que és el que toca a tot el que no sigui la paraula del dia: el text
 * parla d'un dia i d'una paraula que són les mateixes per a tothom, i d'una
 * partida il·limitada no en diria res que ningú pogués comparar.
 */
export function botoDePiular(adreca) {
    el.botoPiular.hidden = !adreca;
    if (adreca) el.botoPiular.href = adreca;
}

// -------------------------------------------------- Noms de les modalitats

const NOM_MODE = { illimitat: 'Il·limitat', diaria: 'Paraula del dia' };
const NOM_DIFICULTAT = { facil: 'Fàcil', dificil: 'Difícil' };
// Els tres rellotges de l'il·limitat. Han de dir el mateix que el NOM_TEMPS de
// joc/eines/compilar_classificacio.py. Un rellotge que no hi sigui es titula
// amb els segons i prou (vegeu titolModalitat).
const NOM_TEMPS = { 30: 'Llampec', 60: 'Estàndard', 120: 'Lent' };

// Els noms dels dialectes els diu el versions.json (els escriu el generador a
// partir del NOMS_DE_DIALECTE de generar_dades.py). Aqui nomes se'n guarda una
// copia per poder titular els records sense haver d'anar a buscar-la cada cop.
let nomsDeDialecte = {};

export function recordarNomsDeDialecte(dialectes) {
    nomsDeDialecte = Object.fromEntries(dialectes.map((d) => [d.codi, d.nom]));
}

export function nomDialecte(codi) {
    return nomsDeDialecte[codi] || codi;
}

export function titolModalitat({ mode, dificultat, segons, dialecte }) {
    const parts = [NOM_MODE[mode] || mode, NOM_DIFICULTAT[dificultat] || dificultat];
    if (mode !== 'diaria') parts.push(NOM_TEMPS[segons] || `${segons}s`);
    if (dialecte) parts.push(nomDialecte(dialecte));
    return parts.join(' · ');
}

function filaRecord({ posicio, etiqueta, subtitol, punts, destacada }) {
    const fila = document.createElement('div');
    fila.className = 'fila-record';
    if (posicio && posicio <= 3) fila.classList.add(`fila-record--${posicio}`);
    if (destacada) fila.classList.add('fila-record--jo');

    const nom = document.createElement('div');
    nom.className = 'fila-record__nom';
    if (posicio) {
        const pos = document.createElement('span');
        pos.className = 'fila-record__pos';
        pos.textContent = posicio;
        nom.appendChild(pos);
    }
    const text = document.createElement('div');
    text.className = 'fila-record__etiqueta';
    text.textContent = etiqueta;
    if (subtitol) {
        const sub = document.createElement('span');
        sub.className = 'fila-record__sub';
        // Pot ser un text o un node: al resum del mode personalitzat el
        // subtítol és l'enllaç a les rimes d'aquella ronda.
        sub.append(subtitol);
        text.appendChild(sub);
    }
    nom.appendChild(text);

    const valor = document.createElement('span');
    valor.className = 'fila-record__punts';
    valor.textContent = punts;

    fila.append(nom, valor);
    return fila;
}

// ------------------------------------------------------- Els meus rècords

// L'ordre de les bombolles dels records: el mateix que trobes jugant, primer la
// paraula del dia i despres l'il·limitat, i dins de cada mode el fàcil abans que
// el difícil i el rellotge de mes rapid a mes lent.
const ORDRE_MODE = ['diaria', 'illimitat'];
const ORDRE_DIFICULTAT = ['facil', 'dificil'];

function posicio(llista, valor) {
    const on = llista.indexOf(valor);
    return on < 0 ? llista.length : on;
}

/**
 * Els teus rècords: una bombolla per modalitat.
 *
 * Abans eren una sola llista ordenada de mes punts a menys, i aixo no comparava
 * res: en tres minuts en fas mes que en quaranta-cinc segons sempre, o sigui que
 * el "Lent" es quedava dalt de tot i el "Llampec" al fons, diguessin el que
 * diguessin. El teu millor llampec no es pitjor que el teu millor lent; son
 * partides diferents. Partides per modalitat, cada numero nomes es compara amb
 * els que li toca.
 *
 * Dins de cada bombolla hi ha una fila per dialecte, perque els records es
 * guarden per dialecte (paraules diferents i grups de rima diferents), amb quina
 * paraula el vas fer. Si sempre jugues igual, es una fila i prou.
 */
export function pintarRecords(records) {
    el.recordsBuit.hidden = records.length > 0;
    el.llistaRecords.hidden = records.length === 0;

    const grups = new Map();
    for (const r of records) {
        const clau = `${r.mode}|${r.dificultat}|${r.segons}`;
        if (!grups.has(clau)) grups.set(clau, []);
        grups.get(clau).push(r);
    }

    const ordenats = [...grups.values()].sort((a, b) => {
        const [x, y] = [a[0], b[0]];
        return posicio(ORDRE_MODE, x.mode) - posicio(ORDRE_MODE, y.mode)
            || posicio(ORDRE_DIFICULTAT, x.dificultat) - posicio(ORDRE_DIFICULTAT, y.dificultat)
            || x.segons - y.segons;
    });

    el.llistaRecords.replaceChildren(...ordenats.map(bombollaRecord));
}

function bombollaRecord(entrades) {
    const { mode, dificultat, segons } = entrades[0];

    // El dialecte no va al titol: la bombolla es de la modalitat i el dialecte
    // es el que distingeix les files de dins.
    const titol = [titolModalitat({ mode, dificultat, segons })];
    if (mode !== 'diaria') titol.push(marcaTemps(segons));

    // Els records desats abans que se'n guardes la paraula no la poden tenir, i
    // deixar-los amb el renglo buit sembla que allo no funcioni. Ho diuen, i el
    // dia que els bats ja queda desada.
    return bombolla(titol, entrades.map((r) => filaRecord({
        etiqueta: nomDialecte(r.dialecte),
        subtitol: r.paraula ? `amb «${r.paraula}»` : 'd\'abans que es desés la paraula',
        punts: r.punts,
    })));
}

// ------------------------------------------------------------ Classificació

/**
 * Els segons de la modalitat, en una pastilleta de color.
 *
 * El nom del rellotge («Llampec», «Estàndard», «Lent») no diu quant dura, i tres
 * taules que només es distingeixen per aquesta paraula s'acaben confonent: el
 * número ho diu, i el color deixa veure d'un cop d'ull en quina de les tres ets.
 * El color és de més a més i mai l'única pista: qui no el vegi té igualment el
 * nom i els segons escrits.
 */
function marcaTemps(segons) {
    const marca = document.createElement('span');
    marca.className = `marca-temps marca-temps--${segons}`;
    marca.textContent = `${segons}s`;
    return marca;
}

/**
 * Una bombolla: la capçalera que diu què s'hi mira i les files de sota. La fan
 * servir les dues pantalles de llistes —la classificació i els rècords—, i cada
 * llista va a la seva amb rosa entremig, perquè es vegi de seguida que són
 * coses diferents i no pas una llista llarga.
 *
 * El títol pot ser un text o una llista de trossos, que és com s'hi encasta la
 * marca de temps de la modalitat.
 */
function bombolla(titol, files, buit) {
    const caixa = document.createElement('section');
    caixa.className = 'bombolla';

    const capcalera = document.createElement('h3');
    capcalera.className = 'bombolla__titol';
    capcalera.append(...(Array.isArray(titol) ? titol : [titol]));
    caixa.appendChild(capcalera);

    if (files.length === 0) {
        const avis = document.createElement('p');
        avis.className = 'taula-buida';
        avis.textContent = buit || 'Encara no hi ha ningú.';
        caixa.appendChild(avis);
        return caixa;
    }

    caixa.append(...files);
    return caixa;
}

/** Les files d'un rànquing: la posició, el sobrenom i amb què ho va fer. */
/** Les files d'un rànquing: la posició (amb empats), el sobrenom i amb què ho va fer. */
function filesRanquing(entrades, elMeuSobrenom) {
    let posicioVisual = 1;
    let puntuacioAnterior = null;

    return (entrades || []).map((e, i) => {
        // Si no és el primer i té menys punts que l'anterior, actualitzem la posició a l'índex real
        if (puntuacioAnterior !== null && e.punts < puntuacioAnterior) {
            posicioVisual = i + 1;
        }
        puntuacioAnterior = e.punts;

        return filaRecord({
            posicio: posicioVisual,
            etiqueta: e.sobrenom,
            subtitol: subtitolEntrada(e),
            punts: e.punts,
            destacada: elMeuSobrenom && e.sobrenom.toLowerCase() === elMeuSobrenom.toLowerCase(),
        });
    });
}

/**
 * Les pastilles d'il·limitat: una fila per dificultat, separades per una ratlla.
 *
 * Totes sis seguides no es llegien: «Difícil · Llampec» i «Fàcil · Llampec»
 * s'assemblen massa per distingir-les de cua d'ull, i per ordre de clau sortien
 * barrejades i amb els rellotges desordenats (180, 45, 90). Partides per
 * dificultat i de la més ràpida a la més lenta, la graella queda com la de la
 * pantalla de configuració.
 */
export function pintarSelectorModalitats(grups, actiu, alTriar) {
    el.classificacioSelector.className = 'selector-modalitat selector-modalitat--grups';
    el.classificacioSelector.replaceChildren(
        ...grups.map((grup) => {
            const fila = document.createElement('div');
            fila.className = 'selector-fila';
            fila.append(...grup.modalitats.map(({ clau, titol, segons }) => {
                const boto = document.createElement('button');
                boto.type = 'button';
                boto.className = 'pastilla';
                boto.append(titol, marcaTemps(segons));
                boto.setAttribute('aria-pressed', String(clau === actiu));
                boto.addEventListener('click', () => alTriar(clau));
                return boto;
            }));
            return fila;
        })
    );
}

/**
 * El subtítol d'una entrada de la classificació: amb quina paraula ho va fer i,
 * entre parèntesis, en quin dialecte.
 *
 * El dialecte va aquí i no pas al títol de la taula a posta: la classificació és
 * una de sola per modalitat, i partir-la en quatre voldria dir quatre taules de
 * quatre persones. Dit a cada fila, tothom surt junt i es veu en què jugava.
 */
function subtitolEntrada(e) {
    const trossos = [];
    if (e.paraula) trossos.push(`amb «${e.paraula}»`);
    if (e.dialecte) trossos.push(`(${nomDialecte(e.dialecte)})`);
    return trossos.join(' ');
}

/**
 * La taula d'una modalitat d'il·limitat. La capçalera repeteix la pastilla que
 * has triat: quan has baixat a mirar la llista, el selector ja no es veu.
 */
export function pintarClassificacio({ titol, segons, top }, elMeuSobrenom) {
    el.classificacioLlista.replaceChildren(
        bombolla([titol, marcaTemps(segons)], filesRanquing(top, elMeuSobrenom))
    );
}

export function estatClassificacio(text) {
    el.classificacioEstat.textContent = text || '';
    el.classificacioEstat.hidden = !text;
    if (text) el.classificacioLlista.replaceChildren();
}

export function subtitolClassificacio(text) {
    el.classificacioSubtitol.textContent = text;
}

/** Quina pestanya de la classificació es veu: 'modalitats' o 'diaria'. */
export function marcarPestanya(quina) {
    for (const boto of document.querySelectorAll('.pestanya')) {
        boto.setAttribute('aria-selected', String(boto.dataset.taula === quina));
    }
}

// -------------------------------------------------- Classificació del dia

const MESOS = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny',
               'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];

/** "2026-08-26" -> "26 d'ag." — prou curt per cabre en una pastilla. */
export function diaCurt(dia) {
    const [, mes, numero] = dia.split('-');
    const nom = MESOS[Number(mes) - 1] || mes;
    const de = 'aeiou'.includes(nom[0]) ? "d'" : 'de ';
    return `${Number(numero)} ${de}${nom}`;
}

/**
 * La tria de dificultat de la pestanya de la paraula del dia. Val tant per al
 * rànquing del dia com per al dels millors de sempre: són la mateixa pregunta
 * feta dues vegades i no tindria sentit poder-les descordar.
 */
export function pintarSelectorDificultat(actiu, alTriar) {
    el.classificacioDificultat.hidden = false;
    el.classificacioDificultat.replaceChildren(
        ...['facil', 'dificil'].map((dificultat) => {
            const boto = document.createElement('button');
            boto.type = 'button';
            boto.className = 'pastilla';
            boto.textContent = NOM_DIFICULTAT[dificultat];
            boto.setAttribute('role', 'radio');
            boto.setAttribute('aria-checked', String(dificultat === actiu));
            boto.setAttribute('aria-pressed', String(dificultat === actiu));
            boto.addEventListener('click', () => alTriar(dificultat));
            return boto;
        })
    );
}

export function amagarSelectorDificultat() {
    el.classificacioDificultat.hidden = true;
    el.classificacioDificultat.replaceChildren();
}

export function pintarSelectorDies(dies, actiu, alTriar) {
    // El mateix calaix que les pastilles d'il·limitat, que hi van per files:
    // aqui van totes seguides i cal treure-li la classe.
    el.classificacioSelector.className = 'selector-modalitat';
    el.classificacioSelector.replaceChildren(
        ...dies.map((dia) => {
            const boto = document.createElement('button');
            boto.type = 'button';
            boto.className = 'pastilla';
            boto.textContent = diaCurt(dia);
            boto.setAttribute('aria-pressed', String(dia === actiu));
            boto.addEventListener('click', () => alTriar(dia));
            return boto;
        })
    );
}

/**
 * La pestanya de la paraula del dia: el rànquing del dia que estiguis mirant i,
 * a sota, el dels millors de sempre. Tots dos en la dificultat triada, i cadascun
 * a la seva bombolla: enganxats semblaven una sola llista de vint noms.
 *
 * Vénen dels blocs "diaria" i "diaria_millors" de dades/classificacio.json, que
 * munta joc/eines/compilar_classificacio.py.
 *
 * No hi ha cap capçalera que digui quina era la paraula del dia: n'hi ha una de
 * sola (vegeu paraulaDelDia a objectius.js), però la taula pot barrejar dies, i
 * la paraula viatja amb cada entrada, al costat del dialecte.
 */
export function pintarDiaria({ delDia, millors, dia, dificultat }, elMeuSobrenom) {
    el.classificacioLlista.replaceChildren(
        bombolla(`Rànquing del ${diaCurt(dia)} · ${NOM_DIFICULTAT[dificultat]}`,
                 filesRanquing(delDia, elMeuSobrenom)),
        bombolla(`Els millors de sempre · ${NOM_DIFICULTAT[dificultat]}`,
                 filesRanquing(millors, elMeuSobrenom)),
    );
}

// -------------------------------------------------- Mode personalitzat

/** Un grup de botons que es poden prémer tots alhora (els tipus de paraula). */
export function grupMarques(contenidor, atribut, alCanviar) {
    const botons = [...contenidor.querySelectorAll('.opcio')];

    contenidor.addEventListener('click', (esdeveniment) => {
        const boto = esdeveniment.target.closest('.opcio');
        if (!boto) return;
        const premut = boto.getAttribute('aria-pressed') === 'true';
        // Sempre n'hi ha d'haver un de premut: desmarcar l'últim deixaria una
        // partida sense cap paraula possible, que no vol dir res.
        const quants = botons.filter((b) => b.getAttribute('aria-pressed') === 'true').length;
        if (premut && quants <= 1) return;
        boto.setAttribute('aria-pressed', String(!premut));
        if (alCanviar) alCanviar();
    });

    return {
        valor: () => botons
            .filter((b) => b.getAttribute('aria-pressed') === 'true')
            .map((b) => Number(b.dataset[atribut])),
        seleccionar: (valors) => {
            for (const boto of botons) {
                boto.setAttribute('aria-pressed',
                                  String(valors.includes(Number(boto.dataset[atribut]))));
            }
        },
    };
}

/** Escriu la configuració al formulari. */
export function omplirPersonalitzat(config, nom) {
    el.persDialecte.textContent = `En ${nom.toLowerCase()}`;
    el.persMin.value = String(config.min);
    el.persSenseSostre.checked = config.max === Infinity;
    el.persMax.value = config.max === Infinity ? '' : String(config.max);
    el.persMax.disabled = config.max === Infinity;
    el.persSegons.value = String(config.segons);
    el.persRondes.value = String(config.rondes);
}

/**
 * El que hi ha escrit al formulari, tal qual: ja ho netejarà personalitzat.js.
 *
 * Els camps BUITS no s'hi posen. Mentre s'escriu un número el camp passa per
 * buit, i si el donéssim per bo el valor saltaria al mínim entremig: deixant-lo
 * fora, es queda el que ja hi havia fins que s'escriu un número de debò.
 */
export function llegirPersonalitzat() {
    const dades = {};
    if (el.persMin.value !== '') dades.min = el.persMin.value;
    if (el.persSenseSostre.checked) dades.max = Infinity;
    else if (el.persMax.value !== '') dades.max = el.persMax.value;
    if (el.persSegons.value !== '') dades.segons = el.persSegons.value;
    if (el.persRondes.value !== '') dades.rondes = el.persRondes.value;
    return dades;
}

export function sostreActiu(senseSostre) {
    el.persMax.disabled = senseSostre;
}

/**
 * Quantes paraules hi ha amb els filtres que hi ha ara.
 *
 * Surt mentre es toca el formulari perquè hi ha combinacions que no donen res
 * (esdrúixoles amb més de cinc-centes rimes, per exemple) i val més veure-ho
 * abans de prémer el botó que no pas després.
 */
export function pintarRecompte(marge, dificultat) {
    const buit = marge.rimes === 0;
    el.persCrear.disabled = buit;
    el.persRecompte.classList.toggle('recompte--buit', buit);

    if (buit) {
        el.persRecompte.textContent =
            "Amb aquests filtres no hi ha cap paraula. Prova d'eixamplar el marge.";
        return;
    }
    const quines = dificultat === 'dificil' ? 'terminacions' : 'grups de rima';
    el.persRecompte.textContent =
        `${marge.rimes.toLocaleString('ca-ES')} ${quines} · `
        + `${marge.objectius.toLocaleString('ca-ES')} paraules possibles · `
        + `de ${marge.minRimes.toLocaleString('ca-ES')} a `
        + `${marge.maxRimes.toLocaleString('ca-ES')} rimes cadascuna`;
}

/** Què vol dir "quantes rimes" a cada dificultat. */
export function notaDeRimes(dificultat) {
    el.persRimesNota.textContent = dificultat === 'dificil'
        ? 'Quantes rimes consonants tindrà la paraula: són, exactament, les respostes bones.'
        : 'En assonant valen totes les paraules del grup, o sigui que els números '
          + 'són molt més grossos que en consonant.';
}

// ------------------------------------------------------------ El convit

export function pintarConvit({ codi, enllac, resum }) {
    el.convitCodi.textContent = codi;
    el.convitEnllac.value = enllac;
    el.convitResum.textContent = resum;
    el.convitEstat.textContent = '';
    el.convitEstat.className = 'estat-enviament';
}

export function estatConvit(text, tipus) {
    el.convitEstat.textContent = text;
    el.convitEstat.className = `estat-enviament${tipus ? ' estat-enviament--' + tipus : ''}`;
}

export function seleccionarEnllac() {
    el.convitEnllac.focus();
    el.convitEnllac.select();
}

// ------------------------------------------------------- Entre rondes

export function pintarRondaAcabada({ ronda, rondes, punts, paraules, objectiu,
                                    rimesPossibles, ultima, dialecte, dificultat }) {
    el.rondaTitol.textContent = `Ronda ${ronda} de ${rondes}`;
    el.rondaPunts.textContent = String(punts);
    el.rondaText.textContent = punts === 1 ? 'rima trobada' : 'rimes trobades';
    el.rondaResum.replaceChildren(
        ...fraseDeRimes({ objectiu, rimesPossibles, dialecte, dificultat }));
    texteBoto(el.rondaSeguent, ultima ? 'Veure el resultat' : 'Següent ronda');

    el.rondaTitolLlista.hidden = paraules.length === 0;
    el.rondaTrobades.replaceChildren(...paraules.map((paraula) => {
        const item = document.createElement('li');
        item.textContent = paraula;
        return item;
    }));
}

// --------------------------------------------------------- Resum final

export function pintarResum({ codi, partida, rondes, total, dialecte, dificultat }) {
    el.resumPartida.textContent = `Codi ${codi} · partida ${partida}`;
    el.resumTotal.textContent = String(total);

    el.resumRondes.replaceChildren(...rondes.map((ronda, i) => filaRecord({
        posicio: i + 1,
        etiqueta: ronda.objectiu,
        // El "de N rimes possibles" també hi porta l'enllaç al cercador: és la
        // manera de repassar les que se t'han escapat, ronda per ronda.
        subtitol: enllacDeRimes(
            `de ${ronda.rimesPossibles.toLocaleString('ca-ES')} rimes possibles`,
            { objectiu: ronda.objectiu, dialecte, dificultat }),
        punts: ronda.punts,
    })));
}

// ------------------------------------------------------------- Qui juga
//
// EL NOM ES TRIA ABANS DE LA PARTIDA, a la pantalla de configuració. Abans es
// demanava al final: la puntuació pujava sola i el "Canvia el nom" tornava a
// enviar la mateixa partida amb el nom nou, o sigui que al full hi arribaven
// dues files de la mateixa cosa. Preguntant-ho abans, cada partida s'envia una
// vegada i prou.
//
// Només es demana el PRIMER COP. Després només hi surt qui ets, amb un botó per
// canviar-t'ho si vols.

/**
 * El bloc de "Qui juga" de la pantalla de configuració.
 *
 * Sense nom, el camp surt obert i la nota diu per què cal; amb nom, hi surt qui
 * ets i el camp queda darrere el "Canvia el nom". Amb `obert` es força el camp
 * (és el que fa aquell botó).
 */
export function pintarJugador(sobrenom, { obert = false, calNom = true } = {}) {
    const teNom = Boolean(sobrenom);
    const escriure = obert || !teNom;

    el.grupJugador.hidden = !calNom && !teNom;
    el.filaSobrenom.hidden = !escriure;
    el.jugadorFet.hidden = escriure;
    el.campSobrenom.value = sobrenom || '';
    el.jugadorNom.textContent = teNom ? `Jugues com a «${sobrenom}»` : '';

    el.jugadorNota.textContent = teNom
        ? 'Amb aquest nom sortiràs a la classificació.'
        : "Com et vols dir a la classificació? Només t'ho preguntem un cop: "
          + 'després la puntuació hi puja sola en acabar cada partida.';

    if (obert && teNom) {
        el.campSobrenom.focus();
        // Amb el text seleccionat: qui obre això és per posar-hi un altre nom,
        // no per afegir-lo al que ja hi havia.
        el.campSobrenom.select();
    }
}

export function estatSobrenom(text, tipus) {
    el.estatSobrenom.textContent = text || '';
    el.estatSobrenom.className = `estat-enviament${tipus ? ' estat-enviament--' + tipus : ''}`;
}

export function nomEscrit() {
    return el.campSobrenom.value;
}

// ------------------------------------------------ Enviament a la classificació

// El bloc de sota del resultat només diu com ha anat l'enviament: el nom ja el
// sabíem abans de començar i la puntuació puja sola.

export function reiniciarEnviament() {
    el.blocClassificacio.hidden = false;
    el.estatEnviament.textContent = '';
    el.estatEnviament.className = 'estat-enviament';
}

export function estatEnviament(text, tipus) {
    el.estatEnviament.textContent = text;
    el.estatEnviament.className = `estat-enviament${tipus ? ' estat-enviament--' + tipus : ''}`;
}

// ---------------------------------------------------------- Com va anar ahir

/**
 * La pantalla d'ahir: quina paraula tocava en aquest dialecte, quantes rimes en
 * va treure la gent de mitjana i qui la va fer millor.
 *
 * Existeix perquè de la paraula d'AVUI no se'n pot saber res fins l'endemà: el
 * classificacio.json es recompila un cop al dia. La d'ahir, en canvi, ja hi és
 * sencera, i mirar-se-la és el que dona la sensació de tancar el dia.
 *
 * La paraula no surt del rànquing sinó que la calcula el joc (`paraulaDelDia`),
 * o sigui que hi és encara que no hi hagués jugat ningú. És la mateixa per a
 * tothom; el que canvia amb el dialecte són les rimes que valien.
 */
export function pintarAhir({ dia, dificultat, paraula, resum, top }, elMeuSobrenom) {
    el.ahirData.textContent = `El ${diaLlarg(dia)}`;
    el.ahirParaula.textContent = paraula || '—';

    el.ahirMitjana.textContent = resum
        ? `De mitjana es van trobar ${decimal(resum.mitjana)} rimes, `
          + `en ${partidesText(resum.partides)}.`
        : 'Ahir ningú no la va jugar en aquesta dificultat.';

    // Sense ningú, la frase de sobre ja ho diu: repetir-ho amb un avís groc
    // seria dir dos cops el mateix amb dues cares diferents.
    
    const files = filesRanquing(top, elMeuSobrenom);
    if (files.length === 0) {
        el.ahirEstat.hidden = Boolean(!resum);
        
        const ara = new Date();
        const sEstanCompilant = ara.getHours() === 0 || (ara.getHours() === 1 && ara.getMinutes() <= 15);
        
        el.ahirEstat.textContent = sEstanCompilant 
            ? "Les dades s'estan compilant, torna a consultar la classificació d'aquí una estona..."
            : 'Ahir no va pujar cap puntuació a la classificació.';
            
        el.ahirLlista.replaceChildren();
        return;
    }
}
/** La tria de dificultat de la pantalla d'ahir. */
export function pintarDificultatAhir(actiu, alTriar) {
    el.ahirDificultat.replaceChildren(
        ...['facil', 'dificil'].map((dificultat) => {
            const boto = document.createElement('button');
            boto.type = 'button';
            boto.className = 'pastilla';
            boto.textContent = NOM_DIFICULTAT[dificultat];
            boto.setAttribute('role', 'radio');
            boto.setAttribute('aria-checked', String(dificultat === actiu));
            boto.setAttribute('aria-pressed', String(dificultat === actiu));
            boto.addEventListener('click', () => alTriar(dificultat));
            return boto;
        })
    );
}

// "2026-09-04" -> "4 de setembre" — a la pantalla d'ahir hi cap sencer.
const MESOS_LLARGS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny',
                      'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];

export function diaLlarg(dia) {
    const [, mes, numero] = dia.split('-');
    const nom = MESOS_LLARGS[Number(mes) - 1] || mes;
    const de = 'aeiou'.includes(nom[0]) ? "d'" : 'de ';
    return `${Number(numero)} ${de}${nom}`;
}

// ------------------------------------------------------------ Estadístiques

const NOM_DIFICULTAT_MINUSCULA = { facil: 'fàcil', dificil: 'difícil' };

function decimal(numero) {
    return numero.toLocaleString('ca-ES', {
        minimumFractionDigits: 1, maximumFractionDigits: 1,
    });
}

function partidesText(quantes) {
    return `${quantes.toLocaleString('ca-ES')} ${quantes === 1 ? 'partida' : 'partides'}`;
}

/**
 * Com t'ha anat comparat amb tothom. Ho calcula estadistiques.js a partir del
 * bloc "estadistiques" de dades/classificacio.json; aquí només es redacta.
 *
 * Amb resum a null, el bloc no surt: quan encara no s'hi ha jugat prou, no dir
 * res és més honest que dir un percentil sortit de quatre partides.
 */
export function pintarEstadistiques(resum, { mode, dificultat, objectiu }) {
    if (!resum) {
        el.blocEstadistiques.hidden = true;
        return;
    }
    el.blocEstadistiques.hidden = false;

    const nomDificultat = NOM_DIFICULTAT_MINUSCULA[dificultat] || dificultat;
    const esDelDia = resum.font === 'diaria-avui';

    if (resum.percentil === null) {
        el.estadistiquesPercentil.textContent = "Encara hi ha poques partides per comparar-t'hi.";
    } else {
        el.estadistiquesPercentil.textContent = esDelDia
            ? `Has superat el ${resum.percentil} % de les partides d'avui`
            : `Has superat el ${resum.percentil} % de les partides`;
    }

    if (esDelDia) {
        el.estadistiquesMitjana.textContent =
            `Avui, amb «${objectiu}» en ${nomDificultat}, la mitjana és de `
            + `${decimal(resum.mitjana)} rimes (${partidesText(resum.partides)}).`;
    } else if (mode === 'diaria') {
        el.estadistiquesMitjana.textContent =
            `De mitjana, la paraula del dia en ${nomDificultat} en dona `
            + `${decimal(resum.mitjana)} (${partidesText(resum.partides)}).`;
    } else {
        el.estadistiquesMitjana.textContent =
            `La mitjana d'aquesta modalitat és de ${decimal(resum.mitjana)} rimes `
            + `(${partidesText(resum.partides)}).`;
    }

    // Per què el número no és el d'avui: la classificació es refà un cop al dia
    // i qui juga abans que passi encara no hi surt. Val més dir-ho que no pas
    // fer passar la mitjana de sempre per la d'avui.
    const nota = resum.font === 'diaria-sempre'
        ? "De la paraula d'avui encara no n'hi ha prou dades: la classificació "
          + 'es refà un cop al dia. Mentrestant et comparem amb totes les paraules '
          + "del dia d'aquesta dificultat."
        : '';
    el.estadistiquesNota.textContent = nota;
    el.estadistiquesNota.hidden = nota === '';
}
