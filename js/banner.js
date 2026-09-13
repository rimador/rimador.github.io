// =========================================================
// BANNER D'ACTUALITZACIÓ (banner_actualitzacio.js)
// =========================================================

(function () {
    'use strict';

    const DATA_LIMIT_GLOBAL = new Date("2026-09-21T23:59:59").getTime(); 
    const CLAU_BANNER = 'rimador_actualitzacio_v3'; // Clau nova
    const RETARD = 800;

    const LINKS = {
        dialectes: "index.html",
        joc: "joc/index.html",
        naufragues: "llistes/llista_naufragues.html",
        heptasillabics: "llistes/llista_heptasilabs.html",
        setSillabes: "llistes/llista_mots_de7.html",
        estadistiques: "dades.html",
        historial: "historial_canvis.html"
    };

    function potMostrar() {
        if (Date.now() > DATA_LIMIT_GLOBAL) return false;
        try {
            if (localStorage.getItem(CLAU_BANNER)) return false;
        } catch (e) {
            return false;
        }
        return true;
    }

    function mostrarBanner() {
        const dialeg = document.createElement('dialog');
        dialeg.className = 'avis-dialeg';
        dialeg.setAttribute('aria-labelledby', 'avis-titol-act');
        
        dialeg.innerHTML = `
            <button class="avis-tanca-act" id="tancar-banner-act" aria-label="Tanca l'avís" disabled>✕ (5s)</button>
            <h2 id="avis-titol-act">Nova actualització!</h2>
            <p class="avis-text">Acaba de sortir del forn la nova versió del Rimador.cat! Descobreix totes les novetats:</p>
            
            <div class="avis-graella">
                <!-- 1. Rimador amb dialectes -->
                <a class="avis-boto-secundari avis-destacat boto-arc-iris" target="_blank">Rimes amb dialectes</a>
                
                <!-- 2. El Joc del Rimar -->
                <a href="${LINKS.joc}" class="avis-boto-secundari avis-destacat boto-arc-iris" target="_blank"><span class="text-color-joc">El Joc del Rimar</span></a>
                
                <!-- 3. Les tres llistes (En una sola línia via Grid) -->
                <div class="avis-llistes-grup">
                    <a href="${LINKS.naufragues}" class="avis-boto-secundari" target="_blank">Paraules nàufragues</a>
                    <a href="${LINKS.heptasillabics}" class="avis-boto-secundari" target="_blank">Mots heptasil·làbics</a>
                    <a href="${LINKS.setSillabes}" class="avis-boto-secundari" target="_blank">Mots de 7 síl·labes</a>
                </div>
                
                <!-- 4. Estadístiques -->
                <a href="${LINKS.estadistiques}" class="avis-boto-secundari avis-estadistiques" target="_blank">Estadístiques</a>
            </div>
            
            <p class="avis-text" style="margin-bottom: 0; font-size: 0.9em;">
                Revisa tots els canvis a l'<a href="${LINKS.historial}" target="_blank">historial de canvis</a>.
            </p>
        `;
        
        document.body.appendChild(dialeg);
        dialeg.showModal();

        const botoTancar = dialeg.querySelector('#tancar-banner-act');
        const enllacDialectes = dialeg.querySelector('#enllac-dialectes');
        
        let segonsRestants = 5;
        const interval = setInterval(() => {
            segonsRestants--;
            if (segonsRestants > 0) {
                botoTancar.textContent = `✕ (${segonsRestants}s)`;
            } else {
                clearInterval(interval);
                botoTancar.textContent = '✕'; 
                botoTancar.disabled = false;
            }
        }, 1000);

        const tancaDeVeres = () => {
            if (botoTancar.disabled) return;
            try { localStorage.setItem(CLAU_BANNER, 'true'); } catch (e) {}
            if (dialeg.open) dialeg.close();
            dialeg.remove();
        };

        botoTancar.addEventListener('click', tancaDeVeres);

        enllacDialectes.addEventListener('click', () => {
            try { localStorage.setItem(CLAU_BANNER, 'true'); } catch (e) {}
            if (dialeg.open) dialeg.close();
            dialeg.remove();
        });
        
        dialeg.addEventListener('click', event => {
            if (event.target !== dialeg) return;
            const caixa = dialeg.getBoundingClientRect();
            const aDins = event.clientX >= caixa.left && event.clientX <= caixa.right &&
                          event.clientY >= caixa.top && event.clientY <= caixa.bottom;
            if (!aDins) tancaDeVeres();
        });
        
        dialeg.addEventListener('cancel', event => {
            if (botoTancar.disabled) {
                event.preventDefault();
            } else {
                tancaDeVeres();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (potMostrar()) setTimeout(mostrarBanner, RETARD);
        });
    } else {
        if (potMostrar()) setTimeout(mostrarBanner, RETARD);
    }
})();