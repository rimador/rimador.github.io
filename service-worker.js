// Service worker del Rimador.
//
// Va a l'ARREL i no pas a dist/ a posta: un service worker només pot manar
// sobre la carpeta on viu i les que en pengen. Des de dist/js/ no veuria ni
// l'index ni el joc.
//
// QUÈ FA, EN UNA FRASE: guarda el shell (el css, el js, les fonts i les
// imatges) perquè la pàgina obri sense xarxa. NO toca el diccionari: d'això
// ja se n'ocupa l'IndexedDB de js/script.js, que ho fa millor i fa anys que
// funciona.
//
// -------------------------------------------------------------------------
// L'INTERRUPTOR D'EMERGÈNCIA
// -------------------------------------------------------------------------
// Posa ATURAT = true, desplega, i aquest service worker s'esborra ell mateix:
// buida tots els caches, es desregistra i deixa el lloc tal com era abans que
// existís. Els navegadors tornen a demanar aquest fitxer en cada navegació
// (com a molt cada 24 h), o sigui que l'aturada arriba a tothom sense que
// ningú hagi de fer res.
//
// És l'única sortida si algun dia això va malament, i per això existeix des
// del primer dia. Un service worker és l'única peça del projecte que, si peta,
// NO es pot arreglar desplegant una versió nova: els afectats ja no es baixen
// res de nou. Amb això, sí.
const ATURAT = false;

// -------------------------------------------------------------------------
// VERSIONS
// -------------------------------------------------------------------------
// El desplegament ja estampa el SHA del commit a tots els ?v= dels HTML
// (vegeu "Rebentar Memòria Cau" a .github/workflows/deploy.yml). El
// registrar-sw.js llegeix el seu propi ?v= i ens el passa aquí, de manera que
// cada desplegament de codi estrena cache i esborra el d'abans. Sense tocar
// el workflow: la versió surt de la que ja hi havia.
const VERSIO_DESPLEGAMENT = new URL(self.location).searchParams.get('v') || 'dev';

// Per si algun dia cal buidar el cache de tothom sense que hagi canviat cap
// ?v=: puja aquest número i prou.
const VERSIO_CODI = 'sw1';

const CACHE = `rimador-${VERSIO_CODI}-${VERSIO_DESPLEGAMENT}`;

// La carpeta on viu aquest fitxer. A rimador.cat és "/", i als repositoris de
// proves "/NOM-DEL-REPOSITORI/". Tot es compara contra això i no contra "/",
// que és el que fa que el web de proves funcioni igual (mateix motiu que
// l'ARREL de js/components.js).
const ABAST = new URL('./', self.location).pathname;

function rutaRelativa(url) {
    return url.pathname.startsWith(ABAST)
        ? url.pathname.slice(ABAST.length)
        : url.pathname.replace(/^\//, '');
}

// -------------------------------------------------------------------------
// QUÈ ES FA AMB CADA COSA
// -------------------------------------------------------------------------

// MAI del cache. Són els fitxers que decideixen què és fresc: si algun dia
// se'n servís una còpia guardada, el lloc es quedaria congelat en aquella
// versió i no hi hauria manera d'actualitzar-lo ni d'anunciar res.
//
// Compte amb l'avis/missatges.json: js/avis.js el demana amb
// { cache: 'no-cache' }, però això només esquiva la memòria cau del navegador,
// NO un service worker. Sense posar-lo aquí, els avisos es congelarien.
const NOMES_XARXA = [
    'diccionaris/versions.json',
    'llistes/versions_llistes.json',
    'stats/versions_stats.json',
    'joc/dades/versions.json',
    'avis/missatges.json',
];

// Ni tocar-ho. El diccionari i la rima dels dialectes ja viuen a IndexedDB
// amb el seu control de resums (vegeu llegirFitxerAmbIndexedDB a
// js/script.js). Cachejar-ho aquí seria guardar 31 MB dues vegades i posar
// dos mecanismes a decidir el mateix, que és com es fabriquen els errors que
// després no hi ha manera de depurar.
//
// joc/dades/ tampoc no s'hi toca, de moment: el joc es baixa els seus fitxers
// amb ?v= i se'ls guarda a la memòria cau del navegador. Per fer el joc
// offline de debò, n'hi hauria prou d'afegir aquí una regla de cache per als
// dialectes que es juguin.
const NO_TOCAR = [
    'diccionaris/',
    'dialectes_col/',
    'joc/dades/',
];

// El shell: això sí que es guarda i se serveix del cache. Les URL ja porten
// el ?v= del desplegament, o sigui que no poden quedar velles: quan el ?v=
// canvia, l'adreça és una altra i es torna a baixar.
function esDelShell(ruta) {
    return ruta.startsWith('dist/')
        || ruta.startsWith('fonts/')
        || ruta.startsWith('assets/')
        || ruta.startsWith('joc/js/');
}

function esNomesXarxa(url, ruta) {
    // El ?t= vol dir "no em donis res guardat" allà on s'ha escrit (les
    // versions, la classificació del joc). Es respecta tal com raja.
    if (url.searchParams.has('t')) return true;
    return NOMES_XARXA.includes(ruta);
}

// -------------------------------------------------------------------------
// INSTAL·LACIÓ I ACTIVACIÓ
// -------------------------------------------------------------------------
// No es precacheja res a posta. Una llista fixa de pàgines és justament la
// cosa que es queda obsoleta quan s'afegeix o es treu un HTML, i llavors el
// service worker falla per un fitxer que ja no existeix. Aquí el cache
// s'omple sol amb el que la pàgina demana: la primera visita el guarda i la
// segona ja obre sense xarxa.
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        if (ATURAT) {
            await esborrarTot();
            await self.registration.unregister();
            // Les pestanyes obertes encara van pel service worker vell fins
            // que es recarreguen: les recarreguem nosaltres perquè quedi net
            // de seguida.
            const finestres = await self.clients.matchAll({ type: 'window' });
            for (const finestra of finestres) finestra.navigate(finestra.url);
            return;
        }

        // Fora els caches de desplegaments anteriors.
        const noms = await caches.keys();
        await Promise.all(
            noms.filter(nom => nom.startsWith('rimador-') && nom !== CACHE)
                .map(nom => caches.delete(nom))
        );

        await self.clients.claim();
    })());
});

async function esborrarTot() {
    const noms = await caches.keys();
    await Promise.all(noms.map(nom => caches.delete(nom)));
}

// -------------------------------------------------------------------------
// LES PETICIONS
// -------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    if (ATURAT) return;                       // passthrough total

    const peticio = event.request;
    if (peticio.method !== 'GET') return;     // els POST de les cerques, fora

    const url = new URL(peticio.url);
    if (url.origin !== self.location.origin) return;  // jsdelivr, ko-fi, X...

    const ruta = rutaRelativa(url);

    if (NO_TOCAR.some(prefix => ruta.startsWith(prefix))) return;
    if (esNomesXarxa(url, ruta)) return;

    // Les pàgines: primer la xarxa, i el cache només si no n'hi ha.
    //
    // Network-first i no pas cache-first, i això no és negociable: amb
    // cache-first, qui tingui l'HTML vell guardat el rebria per sempre, i com
    // que aquell HTML apunta als ?v= vells, no tornaria a veure cap
    // actualització mai més. Seria un usuari inarreglable.
    if (peticio.mode === 'navigate' || esHTML(peticio)) {
        event.respondWith(xarxaPrimer(peticio));
        return;
    }

    if (esDelShell(ruta)) {
        event.respondWith(cachePrimer(peticio));
    }
    // La resta (json de llistes, estadístiques...) va a la xarxa tal qual:
    // ja se la guarda l'IndexedDB de l'aplicació.
});

function esHTML(peticio) {
    const accepta = peticio.headers.get('accept') || '';
    return accepta.includes('text/html');
}

// Les pàgines es guarden per la seva ruta i prou, sense els paràmetres de
// l'adreça. Dos motius, i tots dos són bugs que hi havia:
//
//   1. rimador.cat/?q=cançó&d=ba és una cerca compartida. L'HTML que se
//      serveix és exactament el mateix que el de rimador.cat/ (el
//      cercarDesDeLaURL ja llegeix els paràmetres quan arrenca), però com a
//      clau de cache serien adreces diferents: obrir un enllaç que t'han
//      passat, sense cobertura, donava la pàgina de "sense connexió" tot i
//      tenir la pàgina guardada. I al revés: cada enllaç compartit hauria
//      anat deixant una còpia de la mateixa pàgina al cache.
//
//   2. "/" i "/index.html" són la mateixa pàgina i dues claus diferents. Qui
//      entrés per l'arrel es guardava "/", i si després obria "/index.html"
//      (un marcador vell, un enllaç escrit a mà) no el trobava.
function clauDePagina(adreca) {
    const url = new URL(adreca);
    url.search = '';
    url.hash = '';
    if (url.pathname.endsWith('/index.html')) {
        url.pathname = url.pathname.slice(0, -'index.html'.length);
    }
    return url.href;
}

async function xarxaPrimer(peticio) {
    const cache = await caches.open(CACHE);
    const clau = clauDePagina(peticio.url);
    try {
        const resposta = await fetch(peticio);
        if (resposta && resposta.ok) cache.put(clau, resposta.clone());
        return resposta;
    } catch (err) {
        const guardada = await cache.match(clau);
        if (guardada) return guardada;
        return respostaSenseXarxa();
    }
}

async function cachePrimer(peticio) {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(peticio);
    if (guardada) return guardada;

    const resposta = await fetch(peticio);
    // Només les respostes bones i del mateix origen. Una opaca (type
    // 'opaque') no es pot mirar per dins: guardar-la seria guardar un error
    // sense saber-ho i servir-lo per sempre.
    if (resposta && resposta.ok && resposta.type === 'basic') {
        cache.put(peticio, resposta.clone());
    }
    return resposta;
}

// L'última xarxa de seguretat: primera visita, sense xarxa i sense res
// guardat. No es fa servir cap HTML del lloc a posta (no el tindríem
// tampoc), sinó una pàgina mínima escrita aquí mateix.
function respostaSenseXarxa() {
    return new Response(
        `<!DOCTYPE html><html lang="ca"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sense connexió | Rimador.cat</title>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;
display:flex;align-items:center;justify-content:center;background:#fff;
color:#333;text-align:center;padding:1.5rem}
h1{color:#b500b5;font-size:1.4rem;margin:0 0 .5rem}
p{margin:.25rem 0;line-height:1.5}</style></head>
<body><div><h1>Ara mateix no hi ha connexió</h1>
<p>El Rimador necessita xarxa el primer cop que s'obre.</p>
<p>Quan la tinguis, torna-ho a provar i ja et funcionarà sense connexió.</p>
</div></body></html>`,
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

// -------------------------------------------------------------------------
// L'ALTRA MANERA D'ATURAR-HO
// -------------------------------------------------------------------------
// L'ATURAT de dalt necessita un desplegament i fins a 24 h per arribar a
// tothom. Això d'aquí és per a tu, ara mateix, des de la consola del
// navegador:
//
//   navigator.serviceWorker.controller.postMessage('aturat')
//
// Buida els caches i es desregistra a l'instant en aquell navegador. Serveix
// per a provar-ho i per a sortir del pas mentre el desplegament arriba.
self.addEventListener('message', (event) => {
    if (event.data !== 'aturat') return;
    event.waitUntil((async () => {
        await esborrarTot();
        await self.registration.unregister();
        const finestres = await self.clients.matchAll({ type: 'window' });
        for (const finestra of finestres) finestra.navigate(finestra.url);
    })());
});
