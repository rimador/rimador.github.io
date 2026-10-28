// La classificacio (leaderboard): enviar la teva puntuacio i llegir la de tothom.
//
// Funciona igual que el registre de cerques de la web (js/registre.js): el
// navegador fa un POST "no-cors" a un Google Apps Script, que apunta la fila a un
// full de calcul. Despres, joc/eines/compilar_classificacio.py llegeix el full
// publicat en CSV, en fa el rànquing i escriu joc/dades/classificacio.json, que
// es el que es veu a la pantalla de classificacio.

import { ahir } from './magatzem.js?v=dc42b4f';

// PER POSAR-HO EN MARXA cal omplir aquestes dues constants (mira el README i
// joc/eines/apps_script_classificacio.gs):
const URL_ENVIAMENT = 'https://script.google.com/macros/s/AKfycbz6mXph0DU7jZPKg-EAHSbVPJoFLDgvNbocAGv4HGkruOH_ZoauwNKAxUu3SaRLbxPbzg/exec';
const URL_CLASSIFICACIO = 'dades/classificacio.json';

// S'envia des d'on sigui: de rimador.cat, del repositori de proves i de local.
//
// El registre de cerques de la web no ho fa (vegeu ES_WEB_OFICIAL a
// js/script.js, que nomes deixa passar rimador.cat i rimador.github.io), pero
// aqui es a posta: la classificacio s'ha de poder provar mentre es fa, i un joc
// que no deixa enviar res mentre el proves no es pot provar de veritat.
//
// El preu es que les partides de prova van al full de debo. Qui filtra de debo
// es el compilador (joc/eines/compilar_classificacio.py), que es qui decideix
// que es publica: si un dia hi ha soroll, s'esborra la fila del full o s'afina
// alla, que es on es pot fer sense deixar el joc coix mentre s'hi treballa.


// sobrenom

const LLARG_MIN = 3;
const LLARG_MAX = 16;
const CARACTERS_OK = /^[\p{L}\p{N} _.\-]+$/u;

/**
 * La forma amb que es compara un sobrenom amb un altre: minuscules i sense
 * accents. Ha de coincidir amb el sense_accents() de
 * joc/eines/compilar_classificacio.py, que es qui escriu la llista de noms
 * ocupats.
 */
export function clauDeSobrenom(text) {
    return String(text).trim().replace(/\s+/g, ' ').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Els noms que ja son a la classificacio, per no deixar-ne triar un de repetit.
 * Els escriu el compilador al bloc "noms_ocupats" del classificacio.json, ja
 * normalitzats.
 */
export function nomsOcupats(classificacio) {
    return new Set((classificacio || {}).noms_ocupats || []);
}

/**
 * Comprova un sobrenom abans d'enviar-lo.
 *
 * Amb `ocupats` (el Set de nomsOcupats) es comprova tambe que no sigui el
 * d'algu altre. `elMeu` es el que ja tens desat: el teu propi nom no te per que
 * xocar amb tu mateix, o sigui que tornar a desar-lo tal com esta ha de valer.
 *
 * Aixo NO es cap garantia: la classificacio es refa un cop al dia, i dues
 * persones poden triar el mateix nom el mateix dia sense que cap de les dues ho
 * pugui saber. No passa res, perque el compilador les separa per identificador
 * d'usuari i no pas pel nom (vegeu clau_persona a compilar_classificacio.py):
 * seran dues files, no una de barrejada. Aquesta comprovacio nomes evita el cas
 * normal, que es agafar sense voler un nom que ja surt a la taula.
 */
export function validarSobrenom(text, { ocupats, elMeu } = {}) {
    const net = String(text).trim().replace(/\s+/g, ' ');

    if (net.length < LLARG_MIN) {
        return { ok: false, motiu: `El sobrenom ha de tenir com a mínim ${LLARG_MIN} lletres.` };
    }
    if (net.length > LLARG_MAX) {
        return { ok: false, motiu: `El sobrenom no pot passar de ${LLARG_MAX} lletres.` };
    }
    if (!CARACTERS_OK.test(net)) {
        return { ok: false, motiu: 'Fes servir només lletres, xifres i espais.' };
    }
    const clau = clauDeSobrenom(net);

    //eliminem prohibir el sobrenom si ja està utilitzat
    // if (ocupats && ocupats.has(clau) && clau !== clauDeSobrenom(elMeu || '')) {
    //     return { ok: false, motiu: `Ja hi ha un «${net}» a la classificació. Tria'n un altre.` };
    // }

    // La validacio de debo (les paraules vetades, la desduplicacio) la fa
    // joc/eines/compilar_classificacio.py: aixo d'aqui nomes es per dir-ho de
    // seguida a qui escriu, i no es cap garantia de res.
    return { ok: true, sobrenom: net };
}

export function estaConfigurat() {
    return URL_ENVIAMENT.length > 0;
}

// enviar

function usuariID() {
    let id = null;
    try {
        id = localStorage.getItem('rimador_usuari_id');
        if (!id) {
            id = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
            localStorage.setItem('rimador_usuari_id', id);
        }
    } catch (error) {
        id = 'usr_anonim';
    }
    return id;
}

// --------------------------------------------------- Les que no han pogut anar
//
// SENSE XARXA, LA PUNTUACIO NO ES PERD: es desa i s'envia sola quan torni la
// connexio (quan el navegador dispara l'"online", o al proper cop que s'obri el
// joc). Abans es deia "no s'ha pogut enviar" i alla s'acabava: qui jugues al
// metro perdia la partida encara que despres tingues cobertura tot el dia.
//
// EL DIA DE LA PARTIDA VIATJA DINS DEL PAQUET (el camp "data"), o sigui que una
// puntuacio que puja dos dies tard continua comptant per al dia que es va
// jugar; el full en guarda l'arribada a part i el compilador agrupa per la
// DataPartida (vegeu apps_script_classificacio.gs i compilar_classificacio.py).
//
// I ELS REPETITS NO FAN MAL. Amb mode 'no-cors' la resposta es opaca i no es
// pot saber si el servidor l'ha apuntada: si el fetch peta a mitges, la
// puntuacio es torna a enviar i al full hi pot haver dues files iguals. El
// compilador ja ho preveu: al ranquing es queda la millor de cada persona i
// modalitat, i a les estadistiques treu els duplicats exactes (vegeu el
// drop_duplicates d'estadistiques()). Val mes una fila de mes que una partida
// perduda.
const CLAU_PENDENTS = 'rimador.joc.pendents.v1';

// Un sostre perque el magatzem no creixi sense aturador si algu juga dies
// sencers sense connexio. Es queden les mes NOVES.
const MAX_PENDENTS = 50;

function llegirPendents() {
    try {
        const cru = localStorage.getItem(CLAU_PENDENTS);
        const llista = cru ? JSON.parse(cru) : [];
        return Array.isArray(llista) ? llista : [];
    } catch (error) {
        return [];
    }
}

function desarPendents(llista) {
    try {
        localStorage.setItem(CLAU_PENDENTS, JSON.stringify(llista.slice(-MAX_PENDENTS)));
    } catch (error) {
        // Mode privat o disc ple: aleshores si que es perd, pero no hi ha res
        // mes a fer i el joc ha de continuar igual.
    }
}

/** Quantes puntuacions esperen connexio. */
export function quantesPendents() {
    return llegirPendents().length;
}

function encuar(camps) {
    const llista = llegirPendents();
    llista.push(camps);
    desarPendents(llista);
}

function paquetDe({ sobrenom, mode, dificultat, segons, dialecte, punts, paraula, data }) {
    return {
        sobrenom,
        mode,
        dificultat,
        segons: String(segons),
        dialecte,
        punts: String(punts),
        paraula: paraula || '',
        // El dia de la PARTIDA, que no es el mateix que quan s'envia: qui juga a
        // dos quarts de dotze de la nit i ho envia a les dotze i cinc, envia una
        // paraula del dia d'ahir. El full en guarda les dues dates en columnes
        // diferents (vegeu apps_script_classificacio.gs).
        data,
        usuari: usuariID(),
    };
}

/** Un intent d'enviament, sense xarxes de seguretat. Torna si ha anat be. */
async function provarDEnviar(camps) {
    try {
        await fetch(URL_ENVIAMENT, {
            method: 'POST', mode: 'no-cors', body: new URLSearchParams(camps),
        });
        return true;
    } catch (error) {
        return false;
    }
}

export async function enviarPuntuacio(partida) {
    if (!estaConfigurat()) {
        return { estat: 'sense-backend' };
    }

    const camps = paquetDe(partida);

    // Amb el navegador dient que no hi ha xarxa no cal ni provar-ho: a la cua i
    // avall. (El navigator.onLine nomes es de fiar quan diu que NO n'hi ha; que
    // digui que si no vol dir que s'hi arribi, i per aixo l'altre cami tambe
    // encua.)
    if (navigator.onLine === false || !(await provarDEnviar(camps))) {
        encuar(camps);
        return { estat: 'encuat' };
    }
    return { estat: 'enviat' };
}

// L'"online" es pot disparar dues vegades seguides i l'arrencada tambe hi
// crida: sense el pany, dues voltes alhora enviarien la mateixa fila dos cops.
let buidant = false;

/**
 * Torna a provar les puntuacions que van quedar per enviar. Torna quantes n'han
 * pogut anar.
 *
 * Es crida en arrencar el joc i cada cop que el navegador diu que ha tornat la
 * connexio (vegeu principal.js). Va d'una en una i para al primer error: si la
 * xarxa continua sense anar, no te sentit encadenar cinquanta intents.
 */
export async function enviarPendents() {
    if (!estaConfigurat() || buidant) return 0;

    buidant = true;
    let enviades = 0;
    try {
        for (;;) {
            const llista = llegirPendents();
            if (llista.length === 0) break;
            if (!(await provarDEnviar(llista[0]))) break;

            // Es rellegeix DESPRES d'enviar-la i no abans: mentre pujava, una
            // partida acabada pot haver-ne encuat una altra al final, i desar
            // la llista de fa un moment se l'enduria.
            const ara = llegirPendents();
            ara.shift();
            desarPendents(ara);
            enviades += 1;
        }
    } finally {
        buidant = false;
    }
    return enviades;
}

// llegir

let classificacioPromesa = null;
let classificacioBaixada = null;
let classificacioBaixadaA = 0;

// Cada quant, com a molt, es torna a demanar un fitxer que encara no porta el
// dia d'ahir (vegeu carregarClassificacio).
const ESPERA_REBAIXADA = 5 * 60 * 1000;

/**
 * Si el classificacio.json ja porta les partides d'un dia. El compilador
 * (eines/compilar_classificacio.py) passa cada nit cap a les 00:45 i només hi
 * posa els dies acabats, o sigui que un dia hi és sencer quan el fitxer s'ha
 * compilat l'endemà o més tard. De mitjanit fins aleshores, el dia d'ahir
 * encara no hi és: no és que no hi jugués ningú, és que no s'ha compilat.
 *
 * Es mira la data d'"actualitzacio" ("29/10/2026 00:45:27", hora de Madrid,
 * la mateixa que avui() de magatzem.js) i no pas el rellotge: així val igual
 * si l'Action s'endarrereix o si el mòbil va amb una altra hora.
 */
export function diaCompilat(classificacio, dia) {
    const [data] = String((classificacio || {}).actualitzacio || '').split(' ');
    const [d, m, a] = data.split('/');
    // Sense una data que es pugui llegir, com abans: el que hi ha és el que hi ha.
    if (!a) return true;
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` > dia;
}

export function carregarClassificacio() {
    // Es baixa un cop per pàgina, llevat que el que tenim encara no porti el
    // dia d'ahir: qui hagués obert el joc abans de la compilació de la nit
    // veuria "s'estan compilant" fins que recarregués la pàgina.
    //
    // Però com a molt cada cinc minuts: si una nit el compilador peta, el dia
    // d'ahir no arriba en tot el dia, i no cal tornar a baixar el fitxer cada
    // cop que s'obre una pantalla.
    if (classificacioBaixada && !diaCompilat(classificacioBaixada, ahir())
        && Date.now() - classificacioBaixadaA >= ESPERA_REBAIXADA) {
        classificacioPromesa = null;
        classificacioBaixada = null;
    }
    if (!classificacioPromesa) {
        // Amb ?t= i prou: el rànquing canvia cada cop que es passa el
        // compilador, sense que canviï cap versió de res. És la mateixa regla
        // que el versions.json (vegeu joc/js/dades.js): el fitxer que diu com
        // estan les coses ara no es pot cachejar mai.
        classificacioPromesa = fetch(`${URL_CLASSIFICACIO}?t=${Date.now()}`)
            .then((resposta) => {
                if (!resposta.ok) throw new Error(`classificacio.json: ${resposta.status}`);
                return resposta.json();
            })
            .then((dades) => {
                classificacioBaixada = dades;
                classificacioBaixadaA = Date.now();
                return dades;
            })
            .catch((error) => {
                classificacioPromesa = null;
                throw error;
            });
    }
    return classificacioPromesa;
}
