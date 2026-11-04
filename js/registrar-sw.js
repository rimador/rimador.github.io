// Registre del service worker.
//
// Va en un fitxer a part i no dins del components.js perquè joc/index.html NO
// carrega el components.js (només el seu mòdul principal.js), i /joc/ és una
// porta d'entrada de ple dret: té els seus og:, surt al sitemap i la gent hi
// arriba per enllaç directe. Registrant-lo només des del components.js, qui
// entrés pel joc no tindria mai el service worker.
//
// Es carrega amb defer des de totes les pàgines.
(function () {
    if (!('serviceWorker' in navigator)) return;

    // On és l'arrel del lloc, calculat des d'aquest mateix fitxer: a
    // rimador.cat és "/", i als repositoris de proves "/NOM-DEL-REPOSITORI/".
    // Mateix truc i mateix motiu que l'ARREL de js/components.js.
    //
    // Importa que sigui l'arrel i no la carpeta de la pàgina: un service
    // worker només mana sobre la carpeta d'on es baixa, o sigui que si el
    // registréssim des de /joc/ manaria només sobre el joc.
    const jo = document.currentScript;
    if (!jo || !jo.src) return;
    const arrel = new URL('../../', jo.src);

    // La versió surt del nostre propi ?v=, que el desplegament ja estampa amb
    // el SHA del commit (vegeu "Rebentar Memòria Cau" a deploy.yml). Se li
    // passa al service worker per l'adreça, i ell la fa servir per anomenar el
    // seu cache: així cada desplegament de codi n'estrena un i esborra el vell,
    // sense haver de tocar el workflow ni mantenir cap número a mà.
    const versio = new URL(jo.src).searchParams.get('v') || 'dev';
    const adreca = new URL('service-worker.js?v=' + encodeURIComponent(versio), arrel);

    // Després del load, no abans: la primera visita a l'index ja s'està
    // baixant el diccionari sencer, i no li volem posar la instal·lació del
    // service worker a competir per la xarxa.
    window.addEventListener('load', function () {
        navigator.serviceWorker.register(adreca.href, { scope: arrel.pathname })
            .catch(function (err) {
                // Que no funcioni el service worker no ha de trencar res: el
                // lloc funciona igual sense, només que no obre sense xarxa.
                console.warn('No s\'ha pogut registrar el service worker', err);
            });
    });
})();
