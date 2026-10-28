// Tot el que el joc recorda entre partides: els records de cada modalitat i si
// avui ja s'ha jugat la paraula del dia.
//
// Si el localStorage no hi es (navegacio privada, cookies bloquejades) el joc ha
// de seguir funcionant igual; simplement no es recorda res.

const CLAU_RECORDS = 'rimador.joc.records.v2';
const CLAU_RECORDS_V1 = 'rimador.joc.records.v1';
const CLAU_DIARIA = 'rimador.joc.diaria.v2';
const CLAU_SOBRENOM = 'rimador.joc.sobrenom.v1';

// El dialecte que tenien els records d'abans que se'n pogues triar cap. Fa
// falta per a la migracio de sota i per a les modalitats velles que arriben de
// la classificacio sense dialecte.
export const DIALECTE_ANTIC = 'ca';

function llegir(clau) {
    try {
        const cru = localStorage.getItem(clau);
        return cru ? JSON.parse(cru) : null;
    } catch (error) {
        return null;
    }
}

function desar(clau, valor) {
    try {
        localStorage.setItem(clau, JSON.stringify(valor));
        return true;
    } catch (error) {
        return false;
    }
}

// EL DIA DEL JOC ES EL DE CATALUNYA, no el del rellotge de qui juga.
//
// Abans es feia amb new Date() i getFullYear/getMonth/getDate, que son l'hora
// LOCAL del navegador: la paraula del dia canviava a la mitjanit de cadascu i
// no pas a la mitjanit CET. A Tokyo n'hi havia una de nova set o vuit hores
// abans que a Barcelona, i qui tenia el rellotge mal posat en veia una altra.
// Com que la paraula del dia es "la mateixa per a tothom", el dia l'ha de dir
// un sol rellotge, i el que toca es el d'aqui.
//
// Es el mateix fus que fa servir el full de la classificacio per apuntar quan
// arriba cada puntuacio (vegeu Europe/Madrid a apps_script_classificacio.gs),
// o sigui que les dues meitats del sistema parlen del mateix dia.
const FUS = 'Europe/Madrid';

// 'en-CA' no es cap caprici: es la localitzacio que dona AAAA-MM-DD directament,
// que es el format que fan servir el bloqueig diari, el DataPartida que viatja
// amb cada puntuacio i les claus del bloc "diaria" del classificacio.json.
let formatadorDeDia = null;
try {
    formatadorDeDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUS });
} catch (error) {
    // Navegador sense dades de fusos horaris: s'agafa l'hora local, que es el
    // que es feia abans. Val mes jugar amb la paraula d'ahir que no pas no
    // poder jugar.
}

function dataLocal(ara) {
    const mes = String(ara.getMonth() + 1).padStart(2, '0');
    const dia = String(ara.getDate()).padStart(2, '0');
    return `${ara.getFullYear()}-${mes}-${dia}`;
}

/** La data d'avui a Catalunya, en format AAAA-MM-DD. */
export function avui() {
    if (formatadorDeDia) {
        const text = formatadorDeDia.format(new Date());
        // Comprovat i no donat per fet: si algun navegador no dona AAAA-MM-DD,
        // val mes caure a l'hora local que no pas escriure una data que despres
        // no quadraria amb res.
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    }
    return dataLocal(new Date());
}

/**
 * El dia abans d'una data AAAA-MM-DD. Es fa amb Date.UTC i no amb el
 * constructor de sempre a posta: aixi restar un dia son 24 hores exactes i no
 * hi ha canvi d'hora que hi pugui ficar cullerada.
 */
export function diaAnterior(dataISO) {
    const [any, mes, dia] = dataISO.split('-').map(Number);
    return new Date(Date.UTC(any, mes - 1, dia - 1)).toISOString().slice(0, 10);
}

/** Ahir a Catalunya. */
export function ahir() {
    return diaAnterior(avui());
}

// 'h23' i no pas hour12: false, que en alguns navegadors dona "24" a mitjanit.
let formatadorDHora = null;
try {
    formatadorDHora = new Intl.DateTimeFormat('en-GB',
        { timeZone: FUS, hour: 'numeric', hourCycle: 'h23' });
} catch (error) {
    // Com amb formatadorDeDia: sense fusos horaris, l'hora local.
}

/**
 * L'hora que es ara a Catalunya (0-23), amb el mateix rellotge que avui(). Es
 * la que diu si el compilador de la nit ja hauria d'haver passat (vegeu
 * obrirAhir a principal.js).
 */
export function horaCatalunya() {
    if (formatadorDHora) {
        const hora = Number(formatadorDHora.format(new Date()));
        if (Number.isInteger(hora) && hora >= 0 && hora < 24) return hora;
    }
    return new Date().getHours();
}

// --------------------------------------------------------------- Records

// Els records van per mode, dificultat, rellotge i dialecte: no es el mateix
// trobar rimes en 45 segons que en 3 minuts, ni en central que en valencia (son
// paraules diferents i grups de rima diferents).
export function identificadorRecord({ mode, dificultat, segons, dialecte }) {
    return `${mode}|${dificultat}|${segons}|${dialecte}`;
}

/**
 * Un record desat pot ser un numero (com es guardava abans de recordar amb
 * quina paraula el vas fer) o un objecte {punts, paraula}. Es llegeixen les
 * dues formes i prou: afegir la paraula no havia de fer fora els records de
 * ningu, i un de vell val exactament igual encara que no sapiguem amb quina
 * paraula es va fer. El dia que en facis un de nou ja quedara desat sencer.
 */
function normalitzar(valor) {
    if (valor && typeof valor === 'object') {
        return { punts: Number(valor.punts) || 0, paraula: valor.paraula || '' };
    }
    return { punts: Number(valor) || 0, paraula: '' };
}

// Els records de quan el joc nomes es jugava en central no duien el dialecte a
// l'identificador. Se'ls hi posa el central, que es el que eren, en lloc de
// deixar-los com a modalitats fantasma que no es podrien igualar mai. Nomes es
// fa un cop: despres de copiar-los, la clau v1 s'esborra.
function migrarRecords() {
    const antics = llegir(CLAU_RECORDS_V1);
    if (!antics) return;

    const records = llegir(CLAU_RECORDS) || {};
    for (const [id, punts] of Object.entries(antics)) {
        // Les que ja duen dialecte no s'han de tocar; les de tres trossos, si.
        const identificador = id.split('|').length === 3 ? `${id}|${DIALECTE_ANTIC}` : id;
        if (normalitzar(records[identificador]).punts < Number(punts)) {
            records[identificador] = { punts: Number(punts), paraula: '' };
        }
    }
    if (desar(CLAU_RECORDS, records)) {
        try {
            localStorage.removeItem(CLAU_RECORDS_V1);
        } catch (error) {
            // Si no es pot esborrar, la propera migracio nomes tornara a
            // copiar el mateix: es idempotent i no fa cap mal.
        }
    }
}

migrarRecords();

export function llegirRecord(identificador) {
    const records = llegir(CLAU_RECORDS) || {};
    return normalitzar(records[identificador]).punts;
}

/**
 * Desa la puntuacio si supera l'anterior. Torna true si es record nou.
 *
 * Es desa tambe amb quina paraula el vas fer, perque la pantalla dels records
 * ho pugui dir: un 12 no diu res tot sol, i "12 amb «estel»" ja es una partida
 * que recordes. Si nomes iguales el record, no es toca res: el que hi ha desat
 * continua sent el de la primera vegada que hi vas arribar.
 */
export function desarRecord(identificador, punts, paraula) {
    const records = llegir(CLAU_RECORDS) || {};
    if (punts <= normalitzar(records[identificador]).punts) return false;
    records[identificador] = { punts, paraula: paraula || '' };
    desar(CLAU_RECORDS, records);
    return true;
}

/**
 * Tots els records desats, ja desxifrats de l'identificador
 * "mode|dificultat|segons|dialecte". Ordenats de mes punts a menys, que es
 * l'ordre que val DINS d'una modalitat: qui els agrupa es la pantalla (vegeu
 * pintarRecords a ui.js).
 */
export function llegirTotsElsRecords() {
    const records = llegir(CLAU_RECORDS) || {};
    return Object.entries(records)
        .map(([id, valor]) => {
            const [mode, dificultat, segons, dialecte] = id.split('|');
            return {
                mode, dificultat,
                segons: Number(segons),
                dialecte: dialecte || DIALECTE_ANTIC,
                ...normalitzar(valor),
            };
        })
        .filter((r) => r.punts > 0)
        .sort((a, b) => b.punts - a.punts);
}

// --------------------------------------------------- Paraula del dia

// Nomes guardem el dia d'avui: si canvia la data, l'entrada vella se substitueix
// i el magatzem no creix mai.
//
// EL BLOQUEIG VA PER DIFICULTAT I PROU. Abans anava tambe per dialecte, perque
// cada dialecte tenia la seva paraula del dia i bloquejar-los tots alhora era
// barrar-li a algu una paraula que no havia vist mai; ara la paraula del dia es
// LA MATEIXA per a tothom (vegeu paraulaDelDia a objectius.js), o sigui que
// canviar de dialecte per tornar-la a jugar seria jugar dues vegades la mateixa
// paraula. Son dues partides al dia: una de facil i una de dificil.
function partidesDelDia(data) {
    const desat = llegir(CLAU_DIARIA);
    return desat && desat.data === data ? desat.partides || {} : {};
}

/** El resultat d'avui en una dificultat, o null si no s'ha jugat. */
export function resultatDiari(data, dificultat) {
    return partidesDelDia(data)[dificultat] || null;
}

/** Quines dificultats s'han jugat avui. */
export function dificultatsJugades(data) {
    // Les entrades de quan el bloqueig duia el dialecte ("ca|facil") es
    // descarten soles: nomes es guarda el dia d'avui, i l'endema ja no hi son.
    return Object.keys(partidesDelDia(data)).filter((clau) => !clau.includes('|'));
}

export function desarResultatDiari(data, dificultat, resultat) {
    const partides = partidesDelDia(data);
    partides[dificultat] = resultat;
    desar(CLAU_DIARIA, { data, partides });
}

// ------------------------------------------------------------- Sobrenom

export function llegirSobrenom() {
    return llegir(CLAU_SOBRENOM) || '';
}

export function desarSobrenom(sobrenom) {
    desar(CLAU_SOBRENOM, sobrenom);
}

