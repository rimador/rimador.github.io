// La classificacio (leaderboard): enviar la teva puntuacio i llegir la de tothom.
//
// Funciona igual que el registre de cerques de la web (js/registre.js): el
// navegador fa un POST "no-cors" a un Google Apps Script, que apunta la fila a un
// full de calcul. Despres, joc/eines/compilar_classificacio.py llegeix el full
// publicat en CSV, en fa el rànquing i escriu joc/dades/classificacio.json, que
// es el que es veu a la pantalla de classificacio.
//
// PER POSAR-HO EN MARXA cal omplir aquestes dues constants (mira el README i
// joc/eines/apps_script_classificacio.gs):
const URL_ENVIAMENT = 'https://script.google.com/macros/s/AKfycbzufsBU5PuCvn1-0jXaTRm39y90nE_sScKjeVv-CpEqNZ_CwYAIUHCGNseJVQ4ZH7-uyA/exec';   // el /exec del Google Apps Script desplegat
const URL_CLASSIFICACIO = 'dades/classificacio.json';

const VERSIO_CACHE = '1';

// --------------------------------------------------------------- Sobrenom

const LLARG_MIN = 2;
const LLARG_MAX = 16;
// Lletres (accents inclosos), xifres, espai i alguns signes suaus.
const CARACTERS_OK = /^[\p{L}\p{N} _.\-]+$/u;

// Un filtre minim: no pretenem tapar-ho tot, nomes els casos mes evidents.
const PARAULES_VETADES = [
    'merda', 'puta', 'puto', 'colló', 'collo', 'cabró', 'cabro', 'fill de',
    'nazi', 'hitler', 'admin', 'moderador',
];

export function validarSobrenom(text) {
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
    const enMinuscules = net.toLowerCase();
    if (PARAULES_VETADES.some((mot) => enMinuscules.includes(mot))) {
        return { ok: false, motiu: 'Aquest sobrenom no es pot fer servir.' };
    }
    return { ok: true, sobrenom: net };
}

export function estaConfigurat() {
    return URL_ENVIAMENT.length > 0;
}

// ------------------------------------------------------------- Enviar

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

/**
 * Envia una puntuacio a la classificacio. Com que el POST es "no-cors" no en
 * podem llegir la resposta, o sigui que considerem "enviat" si la crida no peta.
 * L'acceptacio de veritat (i qualsevol moderacio) la fa el compilador.
 */
export async function enviarPuntuacio({ sobrenom, mode, dificultat, segons, punts, paraula, data }) {
    if (!estaConfigurat()) {
        return { estat: 'sense-backend' };
    }

    const cos = new URLSearchParams();
    cos.append('sobrenom', sobrenom);
    cos.append('mode', mode);
    cos.append('dificultat', dificultat);
    cos.append('segons', String(segons));
    cos.append('punts', String(punts));
    cos.append('paraula', paraula || '');
    cos.append('data', data);
    cos.append('usuari', usuariID());

    try {
        await fetch(URL_ENVIAMENT, { method: 'POST', mode: 'no-cors', body: cos });
        return { estat: 'enviat' };
    } catch (error) {
        return { estat: 'error', motiu: error.message };
    }
}

// ------------------------------------------------------------- Llegir

let classificacioPromesa = null;

export function carregarClassificacio() {
    if (!classificacioPromesa) {
        classificacioPromesa = fetch(`${URL_CLASSIFICACIO}?v=${VERSIO_CACHE}&t=${Date.now()}`)
            .then((resposta) => {
                if (!resposta.ok) throw new Error(`classificacio.json: ${resposta.status}`);
                return resposta.json();
            })
            .catch((error) => {
                classificacioPromesa = null;
                throw error;
            });
    }
    return classificacioPromesa;
}
