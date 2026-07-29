// El text que es copia per ensenyar com t'ha anat la paraula del dia.
//
// A l'estil del Wordle: una graella d'emojis que no diu ni la paraula que tocava
// ni cap de les rimes, o sigui que es pot penjar sense espatllar-li el dia a
// ningu.

const PER_FILA = 5;
const MAX_FILES = 6;   // a partir d'aqui, resumim

const NOM_DIFICULTAT = { facil: 'Fàcil', dificil: 'Difícil' };

export function textPerCompartir({ data, dificultat, punts }) {
    const [any, mes, dia] = data.split('-');
    const capcalera = `El Rimador · Paraula del dia ${dia}/${mes}/${any}`;
    const marcador = `${NOM_DIFICULTAT[dificultat] || dificultat} · ${punts} ${punts === 1 ? 'rima' : 'rimes'}`;

    return [capcalera, marcador, graella(punts), 'rimador.cat/joc'].join('\n');
}

function graella(punts) {
    if (punts === 0) return '⬜⬜⬜⬜⬜';

    // Si en surten masses, no omplim mitja pantalla de quadrets.
    if (punts > PER_FILA * MAX_FILES) {
        const files = Array(MAX_FILES).fill('🟦'.repeat(PER_FILA));
        files.push(`+${punts - PER_FILA * MAX_FILES} més`);
        return files.join('\n');
    }

    const filesPlenes = Math.floor(punts / PER_FILA);
    const files = [];
    for (let i = 0; i < filesPlenes; i++) files.push('🟦'.repeat(PER_FILA));

    const resta = punts % PER_FILA;
    if (resta > 0) files.push('🟦'.repeat(resta) + '⬜'.repeat(PER_FILA - resta));

    return files.join('\n');
}

/**
 * Compartir de la manera que toqui a cada aparell: al mobil, el menu de
 * compartir del sistema; si no hi es (o si l'usuari se'n desdiu), al
 * porta-retalls. Torna 'compartit', 'copiat', 'cancellat' o 'error'.
 */
export async function compartirResultat(text) {
    if (navigator.share) {
        try {
            await navigator.share({ text });
            return 'compartit';
        } catch (error) {
            // Si l'ha tancat expressament, no li encolomem res mes.
            if (error && error.name === 'AbortError') return 'cancellat';
        }
    }
    return (await copiar(text)) ? 'copiat' : 'error';
}

/** Copia al porta-retalls. Torna true si se n'ha sortit. */
export async function copiar(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        // Segurament l'usuari no ha donat permis; provem l'altra via.
    }

    // Els navegadors vells (i els http://) encara necessiten aixo.
    try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const fet = document.execCommand('copy');
        document.body.removeChild(area);
        return fet;
    } catch (error) {
        return false;
    }
}
