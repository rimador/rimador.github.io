// =========================================================
// BANER DE DIES CONCRETS (baner-dies.js)
//
// Ensenya un quadre al mig de la pantalla només els dies que tries
// tu, amb el missatge que hi vulguis. Té el mateix aspecte i el mateix
// comportament que el de "nova actualització" (banner.js), però no hi
// té res a veure ni amb l'avís de donatius (avis/): és un sistema a part.
//
// Els dies i els textos NO són aquí sinó a baner/dies.json, que el
// navegador demana en temps real (com avis/missatges.json): per canviar
// un missatge n'hi ha prou de tocar aquell fitxer, sense recompilar.
// Vegeu baner/LLEGEIX.md per al format.
//
// Tot passa al navegador de cada visitant. L'únic que es desa és, a
// localStorage, quan ha tancat cada baner. Qui el tanca no el veu durant
// 10 hores; passat aquest temps, si encara és el dia del baner, torna a
// sortir (i cada cop que el tanqui, el mateix).
//
// Per provar-lo sense esperar el dia: afegeix ?baner=ID-DEL-BANER a
// l'adreça de qualsevol pàgina.
// =========================================================

(function () {
    'use strict';

    const FITXER = 'baner/dies.json';
    const CLAU = 'rimador_baner_tancat';
    const PARAM_PROVA = 'baner';
    const RETARD = 600;

    // Quant de temps descansa un baner un cop tancat.
    const ESPERA_MS = 10 * 60 * 60 * 1000;

    // L'arrel del lloc, deduïda de la URL d'aquest mateix <script>, que sempre
    // se serveix des de dist/js/ (mateix truc que js/components.js).
    const ARREL = (function () {
        const jo = document.currentScript;
        if (!jo || !jo.src) return '/';
        return new URL('../../', jo.src).pathname;
    })();

    // ---------------------------------------------------------
    // DATES
    // ---------------------------------------------------------

    function dosXifres(n) { return String(n).padStart(2, '0'); }

    // Avui segons el rellotge del visitant (no UTC): el 23 d'abril a les
    // 00:30 a Barcelona ha de ser Sant Jordi, no el dia 22.
    function avui() {
        const d = new Date();
        const mes = dosXifres(d.getMonth() + 1);
        const dia = dosXifres(d.getDate());
        return { any: String(d.getFullYear()), mesDia: mes + '-' + dia, complet: d.getFullYear() + '-' + mes + '-' + dia };
    }

    // Una "data" és MM-DD (cada any) o AAAA-MM-DD (només aquell any).
    // Un "interval" és DATA/DATA, amb les dues del mateix format.
    function coincideix(especificacio, ara) {
        if (typeof especificacio !== 'string') return false;
        const parts = especificacio.trim().split('/');
        const clau = (data) => (data.length === 5 ? ara.mesDia : ara.complet);

        if (parts.length === 1) {
            return parts[0] === clau(parts[0]);
        }
        if (parts.length !== 2 || parts[0].length !== parts[1].length) return false;

        const [inici, fi] = parts;
        const avuiComparable = clau(inici);
        if (inici <= fi) return avuiComparable >= inici && avuiComparable <= fi;
        // Un MM-DD que travessa el canvi d'any (p. ex. 12-24/01-06).
        return avuiComparable >= inici || avuiComparable <= fi;
    }

    function toca(baner, ara) {
        const dies = Array.isArray(baner.dies) ? baner.dies : [baner.dies];
        return dies.some(d => coincideix(d, ara));
    }

    // ---------------------------------------------------------
    // ESTAT (què s'ha tancat i quan)
    // ---------------------------------------------------------

    function llegirTancats() {
        try {
            return JSON.parse(localStorage.getItem(CLAU)) || {};
        } catch (e) {
            return {};
        }
    }

    // Es desa el moment (en ms) en què s'ha tancat. Els valors que no són un
    // número (el format d'una versió anterior) compten com a "no tancat".
    function jaTancat(id) {
        const quan = Number(llegirTancats()[id]);
        return Number.isFinite(quan) && quan > 0 && Date.now() - quan < ESPERA_MS;
    }

    function recordarTancat(id) {
        try {
            const tancats = llegirTancats();
            tancats[id] = Date.now();
            // Es netegen els que ja han caducat per no anar acumulant claus.
            Object.keys(tancats).forEach(k => {
                if (!(Date.now() - Number(tancats[k]) < ESPERA_MS)) delete tancats[k];
            });
            localStorage.setItem(CLAU, JSON.stringify(tancats));
        } catch (e) { /* sense localStorage, simplement tornarà a sortir */ }
    }

    // ---------------------------------------------------------
    // ESTILS
    // Són els del diàleg del banner.js (.avis-dialeg, de l'avis.css), copiats
    // aquí amb un nom propi perquè aquest mòdul no depengui de cap altre
    // fitxer: el joc compila el seu propi full i l'avis.css no és a totes les
    // pàgines. Si algun dia canvieu la paleta, són les vuit variables de dalt.
    // ---------------------------------------------------------

    function afegirEstils() {
        if (document.getElementById('estil-baner-dies')) return;
        const estil = document.createElement('style');
        estil.id = 'estil-baner-dies';
        estil.textContent = `
            .baner-dialeg {
                --baner-fons: #00ffff;
                --baner-vora: #ff00ff;
                --baner-titol: #d30505;
                --baner-text: rgb(5, 6, 45);
                --baner-boto-vora: #3498db;
                --baner-boto-fons: #ffffff;
                --baner-boto-text: #333333;

                position: relative;
                box-sizing: border-box;
                max-width: 440px;
                width: calc(100% - 40px);
                padding: 30px 28px 22px;
                border: 4px solid var(--baner-vora);
                border-radius: 15px;
                background-color: var(--baner-fons);
                color: var(--baner-text);
                font-family: var(--font-divertida, inherit);
                box-shadow: 8px 8px 0 rgba(0, 0, 0, 0.25);
                text-align: center;
            }
            .baner-dialeg::backdrop { background-color: rgba(0, 0, 0, 0.55); }
            .baner-dialeg[open] { animation: baner-entrada 0.25s ease-out; }
            @keyframes baner-entrada {
                from { opacity: 0; transform: translateY(12px) scale(0.97); }
                to   { opacity: 1; transform: none; }
            }
            .baner-dialeg h2 {
                margin: 0 0 12px;
                font-size: 1.35em;
                color: var(--baner-titol);
            }
            .baner-text {
                margin: 0 0 22px;
                font-size: 0.95em;
                line-height: 1.45;
            }
            .baner-text:last-child { margin-bottom: 0; }
            .baner-boto {
                display: block;
                box-sizing: border-box;
                width: 100%;
                padding: 12px 15px;
                border: 2px solid var(--baner-boto-vora);
                border-radius: 8px;
                background-color: var(--baner-boto-fons);
                color: var(--baner-boto-text);
                font-family: inherit;
                font-size: 1em;
                font-weight: bold;
                text-align: center;
                text-decoration: none;
                cursor: pointer;
                transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
            }
            .baner-boto:hover,
            .baner-boto:focus-visible {
                border-color: #d975d9;
                background-color: #f2f2f2;
                outline: none;
            }
            .baner-tanca {
                position: absolute;
                top: 6px;
                right: 10px;
                height: 32px;
                padding: 0 8px;
                border: none;
                background: none;
                color: var(--baner-text);
                font-family: inherit;
                font-size: 1em;
                font-weight: bold;
                line-height: 1;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.3s ease;
            }
            .baner-tanca:hover:not(:disabled),
            .baner-tanca:focus-visible:not(:disabled) { opacity: 1; outline: none; }
            .baner-tanca:disabled { cursor: not-allowed; opacity: 0.4; }

            [data-theme="sober"] .baner-dialeg {
                --baner-fons: var(--sober-panel-bg);
                --baner-vora: var(--sober-border);
                --baner-titol: var(--sober-accent);
                --baner-text: var(--sober-text);
                --baner-boto-vora: var(--sober-border);
                --baner-boto-fons: var(--sober-bg);
                --baner-boto-text: var(--sober-text);
                border-width: 1px;
                border-radius: 4px;
                font-family: var(--sober-font);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            [data-theme="sober"] .baner-boto { border-width: 1px; border-radius: 4px; }

            @media screen and (max-width: 550px) {
                .baner-dialeg { padding: 26px 18px 18px; }
                .baner-dialeg h2 { font-size: 1.2em; }
            }
            @media (prefers-reduced-motion: reduce) {
                .baner-dialeg[open] { animation: none; }
            }
        `;
        document.head.appendChild(estil);
    }

    // ---------------------------------------------------------
    // MOSTRAR
    // Tot el text entra amb textContent: el JSON mai no es tracta com a HTML.
    // ---------------------------------------------------------

    function enllacSegur(url) {
        try {
            const u = new URL(url, location.href);
            // Només protocols innocus: mai javascript: ni res semblant.
            return ['https:', 'http:', 'mailto:'].includes(u.protocol) ? u.href : null;
        } catch (e) {
            return null;
        }
    }

    function mostrar(baner, ara, prova) {
        if (document.querySelector('.baner-dialeg')) return;
        afegirEstils();

        const dialeg = document.createElement('dialog');
        dialeg.className = 'baner-dialeg';
        dialeg.setAttribute('aria-labelledby', 'baner-titol');

        // Segons de la creu bloquejada, com al banner.js. Per defecte 0: una
        // felicitació no ha de fer esperar ningú. Es pot demanar per baner.
        let segons = Math.max(0, Math.min(10, Math.floor(Number(baner.espera) || 0)));

        const tanca = document.createElement('button');
        tanca.type = 'button';
        tanca.className = 'baner-tanca';
        tanca.setAttribute('aria-label', 'Tanca l\'avís');
        tanca.textContent = segons > 0 ? `✕ (${segons}s)` : '✕';
        tanca.disabled = segons > 0;
        dialeg.appendChild(tanca);

        const titol = document.createElement('h2');
        titol.id = 'baner-titol';
        titol.textContent = baner.titol || '';
        if (baner.titol) dialeg.appendChild(titol);

        if (baner.text) {
            const text = document.createElement('p');
            text.className = 'baner-text';
            text.textContent = baner.text;
            dialeg.appendChild(text);
        }

        const href = baner.enllac && baner.enllac.url ? enllacSegur(baner.enllac.url) : null;
        if (href) {
            const a = document.createElement('a');
            a.className = 'baner-boto';
            a.href = href;
            a.textContent = baner.enllac.text || 'Més informació';
            const url = new URL(href);
            // Un mailto: s'obre amb el programa de correu, no en una pestanya nova.
            if (url.protocol !== 'mailto:' && url.origin !== location.origin) {
                a.target = '_blank';
                a.rel = 'noopener';
            }
            a.addEventListener('click', () => tancaDeVeres());
            dialeg.appendChild(a);
        }

        let interval = null;
        const tancaDeVeres = () => {
            if (tanca.disabled) return;
            if (!prova) {
                recordarTancat(baner.id);
                // Si la pestanya queda oberta tantes hores, que torni igualment.
                // arrencar() torna a mirar si encara és el dia del baner.
                setTimeout(arrencar, ESPERA_MS + 1000);
            }
            if (dialeg.open) dialeg.close();
            dialeg.remove();
        };

        if (segons > 0) {
            interval = setInterval(() => {
                segons--;
                if (segons > 0) {
                    tanca.textContent = `✕ (${segons}s)`;
                } else {
                    clearInterval(interval);
                    tanca.textContent = '✕';
                    tanca.disabled = false;
                }
            }, 1000);
        }

        tanca.addEventListener('click', tancaDeVeres);

        // Un clic al fons enfosquit (fora del quadre) també tanca.
        dialeg.addEventListener('click', event => {
            if (event.target !== dialeg) return;
            const caixa = dialeg.getBoundingClientRect();
            const aDins = event.clientX >= caixa.left && event.clientX <= caixa.right &&
                          event.clientY >= caixa.top && event.clientY <= caixa.bottom;
            if (!aDins) tancaDeVeres();
        });

        // Esc.
        dialeg.addEventListener('cancel', event => {
            if (tanca.disabled) event.preventDefault();
            else tancaDeVeres();
        });

        document.body.appendChild(dialeg);
        dialeg.showModal();
    }

    // No s'obre enmig d'una partida del joc ni damunt d'un altre diàleg
    // (p. ex. el de "nova actualització"): s'espera que acabin.
    function quanSiguiBonMoment(fer) {
        const OCUPAT = 'dialog[open], #pantalla-joc:not([hidden])';
        if (!document.querySelector(OCUPAT)) { fer(); return; }
        const mirador = setInterval(() => {
            if (!document.querySelector(OCUPAT)) {
                clearInterval(mirador);
                fer();
            }
        }, 500);
    }

    // ---------------------------------------------------------
    // ARRENCADA
    // ---------------------------------------------------------

    async function arrencar() {
        let dades;
        try {
            const resposta = await fetch(ARREL + FITXER, { cache: 'no-cache' });
            if (!resposta.ok) return;
            dades = await resposta.json();
        } catch (e) {
            return; // sense fitxer o sense xarxa: simplement no surt res
        }

        const llista = Array.isArray(dades && dades.banners) ? dades.banners : [];
        const ara = avui();
        const forcat = new URLSearchParams(location.search).get(PARAM_PROVA);

        let triat = null;
        if (forcat) {
            triat = llista.find(b => b && b.id === forcat) || null;
        } else {
            // Si en toquen dos el mateix dia, surt el primer del fitxer, i un
            // cop tancat no en surt cap altre fins que passin les 10 hores.
            triat = llista.find(b => b && b.id && toca(b, ara)) || null;
            if (triat && jaTancat(triat.id)) return;
        }
        if (!triat) return;

        setTimeout(() => quanSiguiBonMoment(() => mostrar(triat, ara, !!forcat)), RETARD);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arrencar);
    } else {
        arrencar();
    }
})();
