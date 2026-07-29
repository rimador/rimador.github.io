// Tot el que el joc recorda entre partides: els records de cada modalitat i si
// avui ja s'ha jugat la paraula del dia.
//
// Si el localStorage no hi es (navegacio privada, cookies bloquejades) el joc ha
// de seguir funcionant igual; simplement no es recorda res.

const CLAU_RECORDS = 'rimador.joc.records.v1';
const CLAU_DIARIA = 'rimador.joc.diaria.v1';
const CLAU_SOBRENOM = 'rimador.joc.sobrenom.v1';

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

/** La data d'avui en horari local, en format AAAA-MM-DD. */
export function avui() {
    const ara = new Date();
    const mes = String(ara.getMonth() + 1).padStart(2, '0');
    const dia = String(ara.getDate()).padStart(2, '0');
    return `${ara.getFullYear()}-${mes}-${dia}`;
}

// --------------------------------------------------------------- Records

// Els records van per mode, dificultat i rellotge, que no es el mateix trobar
// rimes en 45 segons que en 3 minuts.
export function identificadorRecord({ mode, dificultat, segons }) {
    return `${mode}|${dificultat}|${segons}`;
}

export function llegirRecord(identificador) {
    const records = llegir(CLAU_RECORDS) || {};
    return Number(records[identificador]) || 0;
}

/** Desa la puntuacio si supera l'anterior. Torna true si es record nou. */
export function desarRecord(identificador, punts) {
    const records = llegir(CLAU_RECORDS) || {};
    const anterior = Number(records[identificador]) || 0;
    if (punts <= anterior) return false;
    records[identificador] = punts;
    desar(CLAU_RECORDS, records);
    return true;
}

/**
 * Tots els records desats, ja desxifrats de l'identificador
 * "mode|dificultat|segons". Ordenats de mes punts a menys.
 */
export function llegirTotsElsRecords() {
    const records = llegir(CLAU_RECORDS) || {};
    return Object.entries(records)
        .map(([id, punts]) => {
            const [mode, dificultat, segons] = id.split('|');
            return { mode, dificultat, segons: Number(segons), punts: Number(punts) };
        })
        .filter((r) => r.punts > 0)
        .sort((a, b) => b.punts - a.punts);
}

// --------------------------------------------------- Paraula del dia

// Nomes guardem el dia d'avui: si canvia la data, l'entrada vella se substitueix
// i el magatzem no creix mai.
function partidesDelDia(data) {
    const desat = llegir(CLAU_DIARIA);
    return desat && desat.data === data ? desat.partides || {} : {};
}

/** El resultat d'avui en una dificultat, o null si encara no s'ha jugat. */
export function resultatDiari(data, dificultat) {
    return partidesDelDia(data)[dificultat] || null;
}

export function dificultatsJugades(data) {
    return Object.keys(partidesDelDia(data));
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
