// El text que es comparteix per ensenyar com t'ha anat una partida.
//
// HI DIU LA PARAULA QUE TOCAVA i en quin mode s'ha jugat, a mes de quantes en
// vas trobar, en quina dificultat i en quin dialecte. Aixo es un canvi de
// criteri: abans no deia la paraula, per no espatllar-li el dia a qui encara no
// hi hagues jugat. Dir-la fa que el text s'entengui tot sol -"3 rimes" no vol
// dir res sense saber amb que- i que dos resultats es puguin comparar de debo,
// que es de que va compartir-ho; el preu es que qui llegeixi el piulet abans de
// jugar ja sabra quina paraula li tocara.
//
// ABANS ERA UNA GRAELLA DE QUADRETS a l'estil del Wordle (■■■■■ / ■■□□□), i
// alla no deia res: al Wordle els quadrets son el JOC -cada fila es un intent i
// cada color una pista-, i aqui nomes eren una barra de progres feta a ma que
// repetia el numero de dues maneres. A mes, segons el tipus de lletra de cada
// aparell, els quadrets sortien desalineats o directament com a requadres
// buits. Una frase i prou: es mes curta, es llegeix a la primera i cap sencera
// en un piulet.

const NOM_DIFICULTAT = { facil: 'fàcil', dificil: 'difícil' };

/** "2026-09-08" -> "8/9/2026", sense els zeros del davant. */
function dataCurta(data) {
    const [any, mes, dia] = data.split('-');
    return `${Number(dia)}/${Number(mes)}/${any}`;
}

/**
 * De quina partida parlem: el mode, i el que el fa identificable.
 *
 * A la DIARIA, el dia: la paraula del dia es una per data i dir-la sense la
 * data no situa res. A l'IL·LIMITAT, el rellotge: la paraula surt a l'atzar i
 * no hi ha cap dia a que referir-se, pero trobar-ne vint en 30 segons i
 * trobar-ne vint en dos minuts no es el mateix.
 */
function capcaleraDe({ mode, data, segons }) {
    if (mode === 'diaria') {
        return `Paraula del dia del Rimador.cat (${dataCurta(data)})`;
    }
    return `Il·limitat del Rimador.cat (${segons} s)`;
}

/**
 * Com t'ha anat, en una frase.
 *
 * El DIALECTE hi va sempre: la paraula del dia es la mateixa per a tothom
 * (vegeu parellaDelDia a eres.js), pero les RIMES QUE VALEN no -en central
 * en pot haver-hi la meitat que en valencia amb la mateixa paraula-, i sense
 * dir-lo dos resultats del mateix dia no es podrien comparar.
 */
export function textPerCompartir({ mode, data, segons, dificultat, dialecte, punts, objectiu }) {
    const compte = `${punts} ${punts === 1 ? 'rima' : 'rimes'}`;
    const amb = objectiu ? ` amb «${objectiu}»` : '';
    const nomDificultat = NOM_DIFICULTAT[dificultat] || dificultat;
    const on = dialecte ? ` i en ${dialecte.toLowerCase()}` : '';

    return `${capcaleraDe({ mode, data, segons })}: ${compte}${amb}, `
        + `en ${nomDificultat}${on}. Juga-hi tu: rimador.cat/joc`;
}

/**
 * L'adreca per piular un text a X (Twitter).
 *
 * La mateixa que fa servir el cercador (vegeu actualitzarBotoCompartir a
 * js/script.js): l'adreca d'intencio d'ara. El twitter.com/intent/tweet de
 * sempre encara hi redirigeix, pero fem servir la d'ara per no dependre del
 * salt.
 */
export function enllacDeTwitter(text) {
    return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/**
 * El text del resultat d'una partida personalitzada.
 *
 * Aqui SI que hi van els numeros i les paraules: no hi ha res per espatllar,
 * perque qui el rep ja ha jugat la mateixa partida (o encara l'ha de jugar amb
 * el mateix enllac). El codi hi es perque els dos jugadors puguin comprovar
 * d'un cop d'ull que parlen de la mateixa partida.
 *
 * L'ULTIMA RATLLA ES L'ENLLAC DE LA PARTIDA, no pas el del joc. Abans hi deia
 * "rimador.cat/joc" i prou, i qui rebia el resultat anava a parar a la
 * portada: per jugar la mateixa partida encara havia de demanar l'enllac a
 * part, que es justament el que aquest text convida a fer. Amb l'enllac dels
 * ajustos (vegeu enllacDe a personalitzat.js) el resultat ja ho porta tot: les
 * mateixes paraules, en el mateix ordre i amb els mateixos filtres.
 */
export function textPersonalitzat({ codi, partida, rondes, total, enllac }) {
    const capcalera = `Rimador.cat · Personalitzat ${codi} · partida ${partida}`;
    const detall = rondes
        .map((ronda, i) => `R${i + 1} ${ronda.punts}`)
        .join(' · ');
    const cua = `${total} ${total === 1 ? 'rima' : 'rimes'} en total`;

    return [capcalera, detall, cua, enllac].filter(Boolean).join('\n');
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
