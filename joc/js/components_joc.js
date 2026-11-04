// Peces que comparteixen les pagines del joc: el joc (joc/index.html) i el
// freestyle (freestyle_beta.html, que viu a l'arrel pero te la mateixa cara).
// Es el que js/components.js fa per al lloc principal, i pel mateix motiu: el
// que es repeteix a mes d'una pagina s'escriu UN sol cop.
//
// COM S'USA. Les pagines porten l'etiqueta d'aquest modul al <head> (la ruta
// canvia segons d'on es serveixi la pagina):
//
//     <script type="module" src="js/components_joc.js?v=..."></script>
//
// i, al cos, uns buits que aquí s'omplen. Cada peça es troba per com es diu:
//
//   [data-capcalera]    salta-al-contingut + capcalera + marquesina. Se la
//                       SUBSTITUEIX sencera. Atributs:
//                         data-nom          el nom que surt a la marca
//                         data-marca        a on porta la marca, des de l'arrel
//                                           ("joc/", "freestyle_beta.html")
//                         data-marquesina   el text de la marquesina; el
//                                           {Rimador.cat} es converteix en
//                                           l'enllac a la portada
//   #tira-dialectes-inici   el rotul "Dialecte:" i el contenidor on el ui.js
//                       pinta els botons.
//   #carregant          el loader. data-text és el que diu mentre carrega.
//   footer.peu          els credits i el patrocini.
//
// ELS IDS QUE EL JS DEL JOC BUSCA (capcalera-marca, tira-dialectes, carregant-*)
// els posa aquest fitxer. No els canviis sense canviar-los tambe a NOMS de
// joc/js/ui.js.
//
// L'ORDRE. Aquest modul ha d'anar ABANS que principal.js / freestyle.js al
// <head>. Els moduls s'executen en ordre de document i despres d'haver llegit
// tot l'HTML, aixi que quan ui.preparar() (que fa els getElementById) s'executa
// tot ja hi es. Si algun dia aquest script passa a async, es trenca.
//
// ELS CAMINS NO ES FIXEN A MA. Una pagina esta a joc/ i l'altra a l'arrel, o
// sigui que "../assets/..." d'una es "assets/..." de l'altra. Aqui es treuen de
// la ubicacio d'AQUEST fitxer (que sempre es joc/js/): dos nivells amunt hi ha
// l'arrel del lloc. Aixo tambe funciona als repositoris de proves, que GitHub
// Pages publica dins /NOM-DEL-REPOSITORI/ (mateix motiu que l'ARREL de
// js/components.js). Per aixo les pagines no porten cap "../".
//
// ELS ESTILS no son aqui: son al joc/css/joc.scss (.capcalera, .marquesina,
// .tira, .carregant, .peu...). Si canvies les classes d'aqui, canvia-les tambe
// alla.

const ARREL = new URL('../../', import.meta.url);

/** Adreca absoluta d'un fitxer del lloc, donada la seva ruta des de l'arrel. */
function desDeLArrel(ruta) {
    return new URL(ruta, ARREL).href;
}

/** Perque el text que ve d'un atribut no es pugui colar com a HTML. */
function escapar(text) {
    return text.replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// ------------------------------------------------------------- Capcalera

/**
 * L'enllac per saltar al contingut, la capcalera i la marquesina. La marca va
 * a la portada de la pagina (data-marca) i la pastilla de la dreta al
 * Rimador.cat, igual que al cercador. El principal.js i el freestyle.js hi
 * enganxen despres el ?d= del dialecte que s'esta fent servir (tornar a la
 * portada no te per que canviar-te'l).
 */
function pintarCapcalera(lloc) {
    const nom = lloc.dataset.nom || '';
    const marca = desDeLArrel(lloc.dataset.marca || './');
    const portada = desDeLArrel('./');
    const marquesina = escapar(lloc.dataset.marquesina || '')
        .replace('{Rimador.cat}', `<a href="${portada}">Rimador.cat</a>`);

    const plantilla = document.createElement('template');
    plantilla.innerHTML = /*html*/`
<a class="salta" href="#principal">Vés al contingut</a>

<header class="capcalera">
    <a class="capcalera__marca" id="capcalera-marca" href="${marca}">
        <img src="${desDeLArrel('assets/peixet.webp')}" alt="" width="46" height="46">
        <span class="capcalera__nom">${escapar(nom)}</span>
    </a>
    <a class="capcalera__estrella" href="${portada}">← Al Rimador.cat</a>
</header>

<div class="marquesina" id="separador">
    <p>${marquesina}</p>
</div>
`;
    lloc.replaceWith(plantilla.content);
}

// ------------------------------------------------------ Tira de dialectes

/**
 * El rotul "Dialecte:" (un enllac a dialectes.html, com al cercador: la
 * pregunta de per que les rimes canvien la te tothom i la resposta es la mateixa
 * pagina) i el contenidor on el ui.js pinta els botons.
 */
function pintarTira(tira) {
    tira.innerHTML = /*html*/`
    <a class="tira__rotul" href="${desDeLArrel('dialectes.html')}">Dialecte:</a>
    <div class="tira__tria" id="tira-dialectes" role="radiogroup" aria-label="Dialecte"></div>
`;
}

// ---------------------------------------------------------------- Loader

/**
 * El loader, amb els ids que pinten mostrarCarregant de joc/js/ui.js i
 * pintarProgres de joc/js/freestyle.js. Va amagat: el text per defecte es el
 * del primer cop, i despres el canvia qui l'ensenya.
 */
function pintarCarregant(loader) {
    const text = escapar(loader.dataset.text || 'Carregant…');
    loader.innerHTML = /*html*/`
    <div class="carregant__cercle"></div>
    <p id="carregant-text">${text}</p>
    <div class="carregant__barra" id="carregant-barra" hidden>
        <div class="carregant__barra-interior" id="carregant-progres"></div>
    </div>
    <p class="carregant__nota" id="carregant-nota" hidden>
        Les rimes d'aquest dialecte es baixen un sol cop.
    </p>
`;
}

// ------------------------------------------------------------------- Peu

function pintarPeu(peu) {
    peu.innerHTML = /*html*/`
    <div class="peu__credits">
        <a href="${desDeLArrel('./')}">Rimador.cat</a> · Marc i Ferran · Uns quants drets reservats
    </div>
    <div class="peu__suport">
        <span class="peu__suport-titol">Amb el suport de</span>
        <a href="https://cordecarxofa.cat/" target="_blank" rel="noopener">
            <img class="peu__logo" src="${desDeLArrel('assets/logo-web-cordecarxofa-ok.png')}" alt="Logo de Cor de carxofa, associació de foment del glosat" width="560" height="454" loading="lazy">
        </a>
    </div>
`;
}

// ----------------------------------------------------------------- Muntar

const capcalera = document.querySelector('[data-capcalera]');
if (capcalera) pintarCapcalera(capcalera);

const tira = document.getElementById('tira-dialectes-inici');
if (tira) pintarTira(tira);

const carregant = document.getElementById('carregant');
if (carregant) pintarCarregant(carregant);

const peu = document.querySelector('footer.peu');
if (peu) pintarPeu(peu);
