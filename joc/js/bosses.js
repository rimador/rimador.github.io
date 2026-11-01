// La maquinària de les bosses: el repartiment ponderat dels dies entre bosses i
// les baralles de claus de cada bossa.
//
// ÉS LA PART COMUNA de la paraula del dia (eres.js) i de l'il·limitat natiu: els
// dos fan el mateix, un comptant dies des de l'inici d'una era i l'altre
// comptant les partides d'un jugador. Triar la bossa i triar la clau dins de la
// bossa és idèntic, i per això viu a part, sense saber res d'eres ni de
// jugadors.
//
// NOMÉS ENTERS I LES FUNCIONS llavor I generador D'objectius.js. Cap
// Math.random, cap Date.now, cap DOM ni localStorage: la paraula del dia és la
// mateixa per a tothom i, a més, la previsió i l'script de congelar eres criden
// node amb aquest mateix fitxer. Així no hi ha cap còpia en Python que s'hagi de
// mantenir igual.

import { llavor, generador } from './objectius.js?v=5681007';

const MS_PER_DIA = 86400000;

function dataEnMs(dataISO) {
    const [any, mes, dia] = String(dataISO).split('-').map(Number);
    const ms = Date.UTC(any, mes - 1, dia);
    if (!Number.isFinite(ms)) throw new Error(`Data no vàlida: «${dataISO}»`);
    return ms;
}

/**
 * Quants dies hi ha des de l'inici fins a una data (tots dos AAAA-MM-DD),
 * comptats en UTC com fa diaDeLaRoda a objectius.js: restar dues dates són
 * sempre un nombre enter de dies, sense cap canvi d'hora pel mig. Negatiu si la
 * data és anterior a l'inici.
 */
export function diesEntre(iniciISO, dataISO) {
    return Math.round((dataEnMs(dataISO) - dataEnMs(iniciISO)) / MS_PER_DIA);
}

// ---------------------------------------------------------------- Quina bossa

/**
 * El PATRÓ: l'ordre en què surten les bosses.
 *
 * Les quotes (w_i) són en per mil i enters, i W és la seva suma (1.000 si venen
 * del congelador; a l'il·limitat, la de les bosses que tenen claus al dialecte).
 * A cada pas, cada bossa suma la seva quota al seu «deute»; surt la que en té
 * més -en cas d'empat, la de número més baix- i a la que surt se li resta W.
 * Passats W passos tots els deutes tornen a zero: el patró es repeteix, i cada
 * bossa hi surt exactament w_i vegades.
 *
 * LA GARANTIA: tallant on es talli, cada bossa ha tingut els seus dies amb menys
 * d'un dia d'error. Una bossa de l'1 % surt exactament 10 dies de cada 1.000, a
 * tots els blocs i per sempre. És un repartiment «suau»: les bosses grosses
 * empenyen les petites, però ningú no s'hi queda sense torn.
 *
 * Torna { W, quotes, patro, acumulat }: patro[p] és la bossa que surt a la
 * posició p, i acumulat[i][p] quantes vegades ha sortit la bossa i abans de la
 * posició p (de 0 a W).
 */
export function patroDeBosses(quotes) {
    const W = quotes.reduce((suma, quota) => suma + quota, 0);
    if (!quotes.every((quota) => Number.isInteger(quota) && quota >= 0) || W <= 0) {
        throw new Error('Les quotes han de ser enters no negatius i sumar més de zero');
    }

    const n = quotes.length;
    const deute = new Array(n).fill(0);
    const patro = new Uint16Array(W);
    const acumulat = quotes.map(() => new Int32Array(W + 1));

    for (let pas = 0; pas < W; pas++) {
        let guanyadora = 0;
        for (let i = 0; i < n; i++) {
            deute[i] += quotes[i];
            // Estrictament més gran: l'empat es queda amb la de número més baix.
            if (deute[i] > deute[guanyadora]) guanyadora = i;
        }
        deute[guanyadora] -= W;
        patro[pas] = guanyadora;
        for (let i = 0; i < n; i++) {
            acumulat[i][pas + 1] = acumulat[i][pas] + (i === guanyadora ? 1 : 0);
        }
    }
    return { W, quotes: quotes.slice(), patro, acumulat };
}

/**
 * L'error màxim del patró, en dies: el que més s'allunya cap bossa del que li
 * tocaria exactament (n · w_i / W), tallant el patró on sigui. Com que el patró
 * es repeteix, amb una volta n'hi ha prou.
 *
 * COMPTE: «menys d'un dia» NO val per a qualsevol quota. Amb les per defecte és
 * 0,800 al difícil i 0,865 al fàcil, però a l'atzar hi ha configuracions de cinc
 * bosses o més que passen d'1 (el pitjor cas que s'ha trobat és 1,05). No trenca
 * res -són cinc centèsimes de dia-, però qui congela una era ho ha de poder
 * veure: l'script de congelar i el panell fan servir aquesta funció per avisar-ne.
 * La comparació es fa amb enters (|n·w - c·W| < W) perquè «menys d'un dia» sigui
 * exacte.
 */
export function errorMaximDelPatro(patro) {
    let maxim = 0;
    for (let n = 1; n <= patro.W; n++) {
        for (let i = 0; i < patro.quotes.length; i++) {
            const desviacio = Math.abs(n * patro.quotes[i] - patro.acumulat[i][n] * patro.W);
            if (desviacio > maxim) maxim = desviacio;
        }
    }
    return maxim / patro.W;
}

/**
 * Quantes vegades ha sortit una bossa abans del dia `dies` (el 0 és el primer):
 * els patrons sencers que ja han passat, que hi surt w_i cops cadascun, més el
 * que hi ha al patró abans de la posició d'aquell dia.
 */
export function quantesVegades(patro, bossa, dies) {
    if (!Number.isInteger(dies) || dies < 0) throw new RangeError(`Dia no vàlid: ${dies}`);
    return Math.floor(dies / patro.W) * patro.quotes[bossa] + patro.acumulat[bossa][dies % patro.W];
}

/**
 * La bossa que toca el dia `dia` i quantes vegades havia sortit abans (m), que és
 * el que diu a quina volta i a quina posició de la baralla és la clau d'avui.
 */
export function bossaDelDia(patro, dia) {
    if (!Number.isInteger(dia) || dia < 0) throw new RangeError(`Dia no vàlid: ${dia}`);
    const bossa = patro.patro[dia % patro.W];
    return { bossa, m: quantesVegades(patro, bossa, dia) };
}

// ----------------------------------------------------- Quina clau de la bossa

/**
 * Una barreja de Fisher-Yates sembrada amb un text. És la de la roda
 * (ordreDeLaRoda a objectius.js) aplicada a una llista qualsevol; no modifica
 * l'original.
 */
export function barrejar(llista, text) {
    const aleatori = generador(llavor(text));
    const copia = llista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(aleatori() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

/**
 * Les baralles d'una bossa: en quin ordre surten les claus.
 *
 * La bossa es recorre per VOLTES. Cada volta és una barreja de Fisher-Yates de
 * totes les claus, sembrada amb `<llavorBase>-<volta>`, i dins d'una volta no se
 * n'ha de repetir cap. Entre dues voltes, si la primera clau de la nova és
 * l'última de l'anterior, s'intercanvien les dues primeres de la nova. No es
 * desa enlloc quines han sortit: la barreja es calcula sempre igual, a tot
 * arreu.
 *
 * LA PRIMERA VOLTA D'UNA ERA NOVA no és una barreja neta: si l'era anterior va
 * acabar amb la volta a mitges, hi van primer les claus que encara no havien
 * sortit, barrejades, i al final les que sí (`sortides`), també barrejades.
 * Sense això, en barrejar de zero, una clau que va sortir fa quatre dies podria
 * tornar a sortir demà. Una clau nova (que no era a l'era anterior) compta com
 * una que encara no ha sortit. Amb `sortides` buit, és la barreja de sempre.
 *
 * Torna:
 *   volta(r)       la baralla de la volta r (no la modifiquis)
 *   clauDe(m)      la m-ena vegada que surt la bossa: { clau, volta, posicio }
 *   despresDe(m)   on s'ha quedat la bossa després de m sortides (vegeu sota)
 */
export function crearBaralles({ llavorBase, claus, sortides = [] }) {
    const K = claus.length;
    if (K === 0) throw new Error('Una bossa sense claus no té baralles');

    const jaSortides = new Set(sortides);
    const pendents = claus.filter((clau) => !jaSortides.has(clau));
    const sortidesDeLaBossa = claus.filter((clau) => jaSortides.has(clau));
    const voltes = [];

    function construir(r) {
        if (r === 0) {
            return [
                ...barrejar(pendents, `${llavorBase}-0`),
                ...barrejar(sortidesDeLaBossa, `${llavorBase}-0s`),
            ];
        }
        const baralla = barrejar(claus, `${llavorBase}-${r}`);
        if (K > 1 && baralla[0] === voltes[r - 1][K - 1]) {
            [baralla[0], baralla[1]] = [baralla[1], baralla[0]];
        }
        return baralla;
    }

    function volta(r) {
        // Una volta depèn de l'anterior (només per la clau que l'acaba), o sigui
        // que es construeixen en ordre i es guarden: amb K = 2 l'intercanvi de
        // dues primeres canvia també l'última, i la cadena no es pot saltar.
        while (voltes.length <= r) voltes.push(construir(voltes.length));
        return voltes[r];
    }

    return {
        claus: K,
        pendents: pendents.length,
        volta,

        clauDe(m) {
            const r = Math.floor(m / K);
            const posicio = m % K;
            return { clau: volta(r)[posicio], volta: r, posicio };
        },

        /**
         * On s'ha quedat la bossa després de m sortides: la volta a mitges (r) i
         * la posició (p) hi diuen que cada clau ha sortit r vegades i que les p
         * primeres de la baralla r, una més (`surten`).
         *
         * `sortides` són les claus que la volta a mitges deixa «ja sortides»,
         * que és el que l'era següent posarà al final de la seva primera volta.
         * Són les p primeres de la baralla, amb una excepció: a la primera volta
         * d'una era, que ja comença amb les antigues sortides al final, mentre no
         * s'han esgotat les pendents (p < pendents) aquestes antigues continuen
         * sent les més recents després de les que acaben de sortir, i hi tornen.
         */
        despresDe(m) {
            const r = Math.floor(m / K);
            const posicio = m % K;
            const baralla = volta(r);
            const pendentsDeLaVolta = r === 0 ? pendents.length : 0;
            const tall = posicio < pendentsDeLaVolta ? pendentsDeLaVolta : K;
            return {
                volta: r,
                posicio,
                surten: baralla.slice(0, posicio),
                sortides: [...baralla.slice(0, posicio), ...baralla.slice(tall)],
            };
        },
    };
}
