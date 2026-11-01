// Com t'ha anat comparat amb tothom: el percentil i la mitjana que surten a la
// pantalla de final.
//
// D'ON SURTEN LES DADES: del bloc "estadistiques" de dades/classificacio.json,
// que escriu joc/eines/compilar_classificacio.py. No son els vint primers de la
// taula sino TOTES les partides, resumides en un histograma (quantes n'hi ha
// hagut de cada puntuacio). Amb l'histograma el percentil es calcula exacte
// aqui, sense haver de publicar la llista de totes les partides ni haver de
// demanar res a cap servidor.
//
// LA TEVA PARTIDA NO HI ES. El JSON es refa un cop al dia (vegeu
// .github/workflows/dades_nocturnes.yml), o sigui que el percentil compara la
// teva puntuacio amb les partides que hi havia l'ultim cop que es va compilar.
// Per la paraula del dia aixo vol dir que, si hi jugues abans que passi el
// compilador, encara no hi ha cap dada d'AVUI: aleshores es compara amb totes
// les paraules del dia d'aquella dificultat i es diu que s'esta fent (vegeu
// FONT i pintarEstadistiques a ui.js).

// D'on ha sortit la comparacio, perque la pantalla ho pugui dir tal com es.
export const FONT = {
    DIARIA_AVUI: 'diaria-avui',       // la paraula d'avui, en aquest dialecte
    DIARIA_SEMPRE: 'diaria-sempre',   // totes les paraules del dia, de reserva
    MODALITAT: 'modalitat',           // la modalitat d'il·limitat que has jugat
};

// NO HI HA MINIM DE PARTIDES. Es diu el que hi ha, encara que sigui una sola
// partida: el numero es de debo, i qui el llegeix ja veu al costat de quantes
// partides surt ("de 2 partides"). Amagar-ho hauria deixat la pantalla muda
// mentre el joc es nou, que es justament quan mes ganes hi ha de saber com ha
// anat. L'unic que fa falta es que hi hagi ALGUNA partida.

/**
 * Quin percentatge de partides has superat. Compta les que van fer MENYS punts
 * que tu: empatar amb algu no es superar-lo.
 */
export function percentil(histograma, punts) {
    let total = 0;
    let menors = 0;
    for (const [valor, quantes] of Object.entries(histograma || {})) {
        total += quantes;
        if (Number(valor) < punts) menors += quantes;
    }
    if (total === 0) return null;
    return Math.round((menors / total) * 100);
}

function blocDiari(estadistiques, data, dificultat) {
    return ((estadistiques.diaria || {})[data] || {})[dificultat] || null;
}

/**
 * El resum per a la pantalla de final, o null si encara no hi ha prou partides
 * per dir-ne res. Torna { font, partides, mitjana, percentil }, amb el percentil
 * a null si n'hi ha poques.
 *
 * La paraula del dia es compara amb tothom qui la va jugar el mateix dia i en
 * la mateixa dificultat: es LA MATEIXA paraula per a tothom (vegeu
 * parellaDelDia a eres.js). L'il·limitat es compara amb la seva modalitat
 * (mode, dificultat i rellotge), que es el mateix criteri que fa servir la
 * classificacio per fer les taules.
 */
export function estadistiquesDe(classificacio, { mode, dificultat, segons, data }, punts) {
    const estadistiques = (classificacio || {}).estadistiques;
    if (!estadistiques) return null;

    let bloc = null;
    let font = null;

    if (mode === 'diaria') {
        bloc = blocDiari(estadistiques, data, dificultat);
        font = FONT.DIARIA_AVUI;
        if (!bloc || bloc.partides < 1) {
            bloc = (estadistiques.diaria_totals || {})[dificultat] || null;
            font = FONT.DIARIA_SEMPRE;
        }
    } else {
        bloc = (estadistiques.modalitats || {})[`${mode}|${dificultat}|${segons}`] || null;
        font = FONT.MODALITAT;
    }

    if (!bloc || bloc.partides < 1) return null;

    return {
        font,
        partides: bloc.partides,
        mitjana: bloc.mitjana,
        percentil: percentil(bloc.histograma, punts),
    };
}

/**
 * Com va anar AHIR amb una paraula del dia: la mitjana i quanta gent hi va
 * jugar. Torna null si no hi va jugar ningu.
 *
 * Aquesta si que es una xifra tancada i de debo: el classificacio.json es refa
 * un cop al dia, o sigui que quan tu la mires, la d'ahir ja hi es sencera.
 * Es el que la d'avui no pot ser (vegeu FONT.DIARIA_SEMPRE), i per aixo el joc
 * te una pantalla per mirar com va anar ahir.
 */
export function estadistiquesDelDia(classificacio, dia, dificultat) {
    const estadistiques = (classificacio || {}).estadistiques;
    if (!estadistiques) return null;
    const bloc = blocDiari(estadistiques, dia, dificultat);
    return bloc && bloc.partides >= 1 ? bloc : null;
}

/**
 * El ranquing d'un dia i dificultat: tothom, jugui en el dialecte que jugui.
 * La paraula era la mateixa per a tots, i el dialecte surt entre parentesis a
 * cada fila (vegeu subtitolEntrada a ui.js).
 */
export function ranquingDelDia(classificacio, dia, dificultat) {
    const delDia = ((classificacio || {}).diaria || {})[dia] || {};
    return delDia[dificultat] || [];
}
