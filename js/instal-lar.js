// Banner d'instal·lació de l'aplicació (PWA).
//
// A Chrome, Edge i Samsung, el navegador dispara l'event
// "beforeinstallprompt" quan el lloc compleix els criteris d'instal·lació.
// Aquí el fem servir per ensenyar un bàner discret i, si l'usuari vol,
// llancem el diàleg natiu d'instal·lació.
//
// A iOS Safari no hi ha cap event equivalent: ensenyem unes instruccions
// per fer-ho a mà (compartir > afegir a la pantalla d'inici).
//
// COMPTE AMB QUAN ARRIBA L'EVENT: aquest fitxer va amb defer, o sigui que no
// s'executa fins que l'HTML està analitzat del tot. El Chrome, en canvi,
// dispara el beforeinstallprompt tan bon punt té el manifest i un service
// worker actiu, i en una segona visita això passa MENTRE l'index encara
// s'analitza. L'event es dispara un sol cop: si no hi ha ningú escoltant, es
// perd per sempre i el bàner no surt mai més. Per això cada pàgina el captura
// amb un bocí de <script> al <head> i el desa a window.__rimadorPrompt, i
// aquí el recollim d'allà.
//
// No és cap dialog modal a posta: el diàleg de la nova versió (banner.js)
// i l'avís de donatius (avis.js) ja en fan servir, i apilar-ne un tercer
// seria massa. Aquí és una barra fixa al peu de la pantalla, que no
// interromp res.
//
// QUI JA TÉ L'APLICACIÓ NO L'HA DE VEURE. El navegador no ho diu sempre:
//   - Si s'obre des de l'aplicació (display-mode: standalone), ho apuntem al
//     localStorage. A Android i a l'ordinador l'aplicació i el navegador
//     comparteixen el desament, o sigui que el navegador ja no la tornarà a
//     ensenyar.
//   - El Chrome (Android i Windows) ho pot preguntar amb
//     getInstalledRelatedApps(), si el manifest du "related_applications".
//   - A l'iPhone no hi ha manera: l'aplicació de la pantalla d'inici té el seu
//     propi desament, separat del Safari. Per això la barra du el botó "Ja
//     tinc l'aplicació", que la tanca per sempre igual que la creu.
//
// I QUI L'IGNORA TAMPOC NO L'HA DE VEURE A CADA PÀGINA. Abans tornava a sortir
// a cada càrrega fins que algú tocava la creu; ara, un cop vista, descansa
// PAUSA_MS.
(function () {
    'use strict';

    var CLAU = 'rimador_instal_descartat';
    var CLAU_VISTA = 'rimador_instal_vista';
    var RETARD_MS = 3000;
    var PAUSA_MS = 7 * 24 * 60 * 60 * 1000;

    // Moments en què la barra faria nosa: un <dialog> obert (vegeu
    // quanSiguiBonMoment) o una partida en marxa al joc, amb el rellotge
    // corrent i el teclat obert damunt del camp.
    var OCUPAT = 'dialog[open], #pantalla-joc:not([hidden])';

    var jo = document.currentScript;
    var ARREL = (jo && jo.src) ? new URL('../../', jo.src).pathname : '/';

    function jaInstalLat() {
        try {
            return window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone === true;
        } catch (e) { return false; }
    }

    function jaDescartat() {
        try { return !!localStorage.getItem(CLAU); } catch (e) { return true; }
    }

    function descartar() {
        try { localStorage.setItem(CLAU, '1'); } catch (e) {}
    }

    function vistaFaPoc() {
        try {
            var quan = Number(localStorage.getItem(CLAU_VISTA));
            return !!quan && Date.now() - quan < PAUSA_MS;
        } catch (e) { return true; }
    }

    function apuntarVista() {
        try { localStorage.setItem(CLAU_VISTA, String(Date.now())); } catch (e) {}
    }

    // Resol a true si el navegador sap que l'aplicació ja hi és. On no hi ha
    // la funció (Safari, Firefox, Chrome de Mac) o falla, resol a false i
    // decideix la resta.
    function hiHaLaAppInstalLada() {
        if (!navigator.getInstalledRelatedApps) return Promise.resolve(false);
        try {
            return navigator.getInstalledRelatedApps()
                .then(function (apps) { return apps.length > 0; })
                .catch(function () { return false; });
        } catch (e) { return Promise.resolve(false); }
    }

    if (jaInstalLat()) {
        descartar();
        return;
    }

    function esIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function esSafariIOS() {
        if (!esIOS()) return false;
        return !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
    }

    // El que hagi pogut capturar el bocí del <head> abans que arribéssim.
    var promptEvent = window.__rimadorPrompt || null;
    var bannerMostrat = false;
    var programat = false;

    // El banner.js i l'avis.js obren <dialog> modals, que deixen inert tot el
    // que hi ha a sota: si traguéssim la barra mentre n'hi ha un d'obert,
    // quedaria darrere la cortina i no s'hi podria tocar. Al joc, a més, no
    // ha de sortir enmig d'una partida. S'espera que acabi (vegeu OCUPAT).
    function quanSiguiBonMoment(fer) {
        if (!document.querySelector(OCUPAT)) { fer(); return; }
        var mirador = setInterval(function () {
            if (!document.querySelector(OCUPAT)) {
                clearInterval(mirador);
                fer();
            }
        }, 500);
    }

    function programar(tipus) {
        if (programat || bannerMostrat || jaDescartat() || vistaFaPoc() || jaInstalLat()) return;
        programat = true;
        setTimeout(function () {
            hiHaLaAppInstalLada().then(function (laTe) {
                if (laTe) { descartar(); return; }
                quanSiguiBonMoment(function () { mostrar(tipus); });
            });
        }, RETARD_MS);
    }

    function mostrar(tipus) {
        if (bannerMostrat || jaDescartat() || jaInstalLat()) return;
        bannerMostrat = true;
        apuntarVista();

        var barra = document.createElement('div');
        barra.className = 'instal-banner';
        barra.setAttribute('role', 'complementary');
        barra.setAttribute('aria-label', "Instal·lar l'aplicació");

        var icona = ARREL + 'assets/icon-192.png';
        var jaLaTinc = '<button class="instal-ja" type="button">Ja tinc l’aplicació</button>';

        if (tipus === 'ios') {
            barra.innerHTML =
                '<button class="instal-tanca" aria-label="Tanca">×</button>'
                + '<div class="instal-contingut">'
                + '<img class="instal-icona" src="' + icona + '" alt="" width="40" height="40">'
                + '<div class="instal-cos">'
                + '<p class="instal-text">Per afegir el <strong>Rimador</strong> a la pantalla d’inici, '
                + 'toca <svg class="instal-share-icona" viewBox="0 0 50 50" aria-hidden="true">'
                + '<path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z"/>'
                + '<path d="M24 7h2v21h-2z"/>'
                + '<path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z"/>'
                + '</svg> i després <strong>«Afegir a pantalla d’inici»</strong>.</p>'
                + jaLaTinc
                + '</div>'
                + '</div>';
        } else {
            barra.innerHTML =
                '<button class="instal-tanca" aria-label="Tanca">×</button>'
                + '<div class="instal-contingut">'
                + '<img class="instal-icona" src="' + icona + '" alt="" width="40" height="40">'
                + '<div class="instal-cos">'
                + '<p class="instal-text"><strong>Afegeix el Rimador</strong> al teu dispositiu per accedir-hi ràpidament.</p>'
                + jaLaTinc
                + '</div>'
                + '<button class="instal-boto">Instal·la</button>'
                + '</div>';
        }

        document.body.appendChild(barra);

        // El doble requestAnimationFrame és el que deixa el navegador pintar la
        // barra a baix abans de posar-li la classe, que si no no hi ha
        // transició. El setTimeout hi és perquè el rAF no corre a les pestanyes
        // que no es veuen: sense ell, qui canviés de pestanya durant l'espera
        // es trobaria la barra plantada fora de pantalla.
        var mostrada = false;
        function apareix() {
            if (mostrada) return;
            mostrada = true;
            barra.classList.add('instal-visible');
        }
        requestAnimationFrame(function () { requestAnimationFrame(apareix); });
        setTimeout(apareix, 100);

        // La creu i el "Ja tinc l'aplicació" fan el mateix: no tornar-la a
        // ensenyar mai més en aquest navegador.
        barra.querySelectorAll('.instal-tanca, .instal-ja').forEach(function (boto) {
            boto.addEventListener('click', function () {
                descartar();
                tancar(barra);
            });
        });

        var botoInstal = barra.querySelector('.instal-boto');
        if (botoInstal) {
            // El promptEvent es mira aquí dins i no pas en crear el botó: pot
            // haver arribat després de treure la barra.
            botoInstal.addEventListener('click', function () {
                if (!promptEvent) return;
                promptEvent.prompt();
                promptEvent.userChoice.then(function (result) {
                    if (result.outcome === 'accepted') descartar();
                    tancar(barra);
                    promptEvent = null;
                });
            });
        }
    }

    function tancar(barra) {
        barra.classList.remove('instal-visible');
        barra.addEventListener('transitionend', function () { barra.remove(); }, { once: true });
        setTimeout(function () { if (barra.parentNode) barra.remove(); }, 500);
    }

    // Encara escoltem l'event pel nostre compte: si el lloc compleix els
    // criteris més tard (el service worker s'acaba d'activar, la primera
    // visita), el Chrome el dispara ara i el bocí del <head> ja no hi és sol.
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        promptEvent = e;
        programar('prompt');
    });

    if (promptEvent) {
        programar('prompt');
    } else if (esSafariIOS()) {
        programar('ios');
    }

    window.addEventListener('appinstalled', function () {
        descartar();
        promptEvent = null;
        var barra = document.querySelector('.instal-banner');
        if (barra) tancar(barra);
    });
})();
