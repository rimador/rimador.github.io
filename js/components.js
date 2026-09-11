const idPagina = document.body ? document.body.id : '';
const dataLlista = document.body ? document.body.dataset.llista : '';

// L'arrel del lloc, deduïda de la URL d'aquest mateix <script>.
//
// Aquest fitxer sempre se serveix des de dist/js/, o sigui que pujant-ne dos
// nivells s'arriba a l'arrel: a rimador.cat dona "/" i al repositori de proves
// (usuari.github.io/proves-rimador/) dona "/proves-rimador/". Com que és una
// ruta des de l'arrel, val igual des de qualsevol pàgina i a qualsevol
// fondària, inclòs el 404.html, que se serveix sota una URL arbitrària.
//
// És l'única definició de rutes de tot el JS: la fan servir menu.js,
// script.js, script_llistes.js i script_dades.js. No s'ha de tocar enlloc més.
const ARREL = (function () {
    const jo = document.currentScript;
    if (!jo || !jo.src) return '/';
    return new URL('../../', jo.src).pathname;
})();

const ruta1 = ARREL + 'assets/';
const ruta2 = ARREL + 'historial_canvis.html';
let estilSilabes = '';
let botoactualitzar = '';
let atributsRima = '';
let opcionsRima = /*html*/`
    <option value="r.consonant">Consonant</option>
    <option value="r.assonant">Assonant</option>
`;
let opcionsSilabes = /*html*/`
    <option value="0">Indiferent</option>
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3</option>
    <option value="4">4</option>
    <option value="5">5</option>
    <option value="6">6 o +</option>
`;

if (idPagina === 'llista') {
  botoactualitzar = '<button class="boto" role="button" id="actualitzaButton"><span class="text">Actualitzar</span></button>';
    if (dataLlista === 'naufragues') {
        // Una paraula és nàufraga justament perquè no rima consonantment amb
        // cap altra: la llista només té sentit en rima consonant. El desplegable
        // es queda a la vista perquè es vegi de quina rima parlem, però bloquejat.
        opcionsRima = /*html*/`<option value="r.consonant">Consonant</option>`;
        atributsRima = 'disabled';

  } else if (dataLlista === 'mots_de7_real') {
        estilSilabes = 'style="display: none;"';

  } else if (dataLlista === 'mots_de7_glosa') {
        opcionsSilabes = /*html*/`
            <option value="0">Indiferent</option>
            <option value="7">7 (mots aguts)</option>
            <option value="8">8 (mots plans)</option>
            <option value="9">9 (mots esdrúixols)</option> 
    `;
  }
}

/*
//botó ko-fi
const kofiWidgetHTML = /*html*/ /*`
<div class="btn-container">
    <a title="Support me on ko-fi.com" class="kofi-button" href="https://ko-fi.com/rimadorcat" target="_blank">
        <span class="kofitext">
            <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-fi donations" class="kofiimg">
            Regala'ns un cafè
        </span>
    </a>
</div>
`;

if (document.body) {
    document.body.insertAdjacentHTML('beforeend', kofiWidgetHTML);
}

*/

const loader = /*html*/`
<p class = "loader-text1" id="loader-text1"></p>
<div class="loader-inner">
    <div class="loader-line-wrap">
        <div class="loader-line"></div>
    </div>
    <div class="loader-line-wrap">
        <div class="loader-line"></div>
    </div>
    <div class="loader-line-wrap">
        <div class="loader-line"></div>
    </div>
    <div class="loader-line-wrap">
        <div class="loader-line"></div>
    </div>
    <div class="loader-line-wrap">
        <div class="loader-line"></div>
    </div>
</div>
<p class = "loader-text2" id="loader-text2"></p>
`;
const loaderHTML = document.getElementById('loader');
if (loaderHTML) { loaderHTML.innerHTML = loader; }


const header = /*html*/`
<a href="${ARREL}"><img class="rimador" id="rimadorImg" src="${ruta1}Rimador-1.webp" alt="Logo del Rimador.cat"></a>
<div class="header-icons">
    <button type="button" id="themeToggleBtn" class="peixet-btn" onclick="toggleTheme()" aria-label="Canvia entre mode festiu i mode sobri" title="Canvia d'estil"><img class="peixet" id="peixetImg" src="${ruta1}peixet.webp" alt="Peixet decoratiu"></button>
    <button type="button" id="menuToggleBtn" class="menu-hamburger" aria-label="Obre el menú" aria-expanded="false" aria-controls="paper-back" title="Menú">
        <span></span>
    </button>
</div>
`
const headerHTML = document.getElementById('header');
if (headerHTML) { headerHTML.innerHTML = header; }


/*
    La tira de dialectes d'index.html.

    Els codis són els de les carpetes de dialectes_col/ (vegeu dialectes() a
    diccionaris/python/camins.py), perquè són els que el dia de demà haurà de
    fer servir el DIALECTE de js/script.js per saber quina col_3 i quina col_4
    es baixa. El nom que es veu, en canvi, és cosa d'aquí: a la carpeta no hi
    ha cap lloc on posar-lo.

    El rossellonès i l'alguerès encara no hi són perquè encara no en tenim la
    transcripció. El dia que n'hi hagi, s'afegeixen en aquesta llista i prou:
    la tira els cap sense tocar cap CSS (a partir de quatre, i en pantalles
    estretes, les pastilles passen a dues ratlles totes soles).

    El rètol "Dialecte:" és un enllaç a dialectes.html, que explica d'on surten
    les transcripcions de cada dialecte (el transcriptor del Projecte AINA) i per
    què la rima canvia segons com es parli. Va a l'ARREL i no pas a una ruta
    relativa perquè la tira també surt a llistes/llista_naufragues.html, que és
    una carpeta més avall.

    Aquí només hi ha la marca. Qui hi enganxa els clics és el js/script.js
    (lligarTriaDeDialecte), i què passa en triar-ne un depèn de la pàgina:
    a l'index.html es canvia de columna de rima i es refà la cerca; a les
    nàufragues es torna a llegir el JSON d'aquell dialecte. El "triat" que es
    pinta aquí és sempre el central i el script.js el corregeix si n'hi havia
    un altre de desat, abans del primer pintat.
*/
const DIALECTES = [
    { codi: 'ca', nom: 'Central' },
    { codi: 'nw', nom: 'Nord-occidental' },
    { codi: 'va', nom: 'Valencià' },
    { codi: 'ba', nom: 'Balear' }
];

const DIALECTE_TRIAT = 'ca';

const dialectes = /*html*/`
<a class="dialectes-rotul" href="${ARREL}dialectes.html" title="D'on surten les transcripcions de cada dialecte">Dialecte:</a>
<div class="dialectes-tria" role="radiogroup" aria-label="Dialecte">
${DIALECTES.map(d => {
    const triat = d.codi === DIALECTE_TRIAT;
    return `    <button type="button" class="dialecte${triat ? ' triat' : ''}" data-dialecte="${d.codi}" role="radio" aria-checked="${triat}">${d.nom}</button>`;
}).join('\n')}
</div>
`
const dialectesHTML = document.getElementById('dialectes');
if (dialectesHTML) { dialectesHTML.innerHTML = dialectes; }


const separador_rosa1 = /*html*/`
<p>NOVETATS (11 de setembre): Llançament oficial!! Revisa tots els canvis de l'actualització <a id="enllaç" href="${ruta2}" target="_blank">aquí</a>.
<br>&nbsp;</p>
`
const separador_rosa1HTML = document.getElementById('separador_rosa1');
if (separador_rosa1HTML) { separador_rosa1HTML.innerHTML = separador_rosa1; }


const dropdowncontainer_llistes = /*html*/`
<div>
    <label for="rimaSelector">Tipus de rima:</label>
    <select id="rimaSelector" ${atributsRima}>
        ${opcionsRima}
    </select>
</div>

<div ${estilSilabes}>
    <label for="numeroSelector">Nombre de síl·labes:</label>
    <select id="numeroSelector">
        ${opcionsSilabes}
    </select>
</div>

<div>
    <label for="categoriaSelector">Comença per:</label>
    <select id="categoriaSelector">
        <option value="indiferent">Indiferent</option>
        <option value="vocal+h">Vocal / H</option>
        <option value="consonant">Consonant</option>
    </select>
</div>

<div>
    <label for="plurals">Incloure plurals:</label>
    <select id="plurals">
        <option value="si">Sí</option>
        <option value="no">No</option>
    </select>
</div>

<div>
    <label for="nomsPropis">Incloure noms propis:</label>
    <select id="nomsPropis">
        <option value="no">No</option>
        <option value="si">Sí</option>
    </select>
</div>
${botoactualitzar}
`

const dropdowncontainer_general = /*html*/`
<div>
    <label for="rimaSelector">Tipus de rima:</label>
    <select id="rimaSelector" ${atributsRima}>
        ${opcionsRima}
    </select>
</div>

<div ${estilSilabes}>
    <label for="numeroSelector">Nombre de síl·labes:</label>
    <select id="numeroSelector">
        ${opcionsSilabes}
    </select>
</div>

<div>
    <label for="categoriaSelector">Comença per:</label>
    <select id="categoriaSelector">
        <option value="indiferent">Indiferent</option>
        <option value="vocal+h">Vocal / H</option>
        <option value="consonant">Consonant</option>
    </select>
</div>

<div>
    <label for="plurals">Incloure plurals:</label>
    <select id="plurals">
        <option value="si">Sí</option>
        <option value="no">No</option>
    </select>
</div>

<div>
    <label for="nomsPropis">Incloure noms propis:</label>
    <select id="nomsPropis">
        <option value="no">No</option>
        <option value="si">Sí</option>
    </select>
</div>

<div>
    <label>Verbs + pronoms: </label>
    <p id="avis_pronoms">
    <span class="pistes-pronoms" tabindex="0">
        <span class="pistes-llista" role="tooltip">
        <span>Pots buscar verbs amb pronoms utilitzant l'infinitiu i gerundi dels següents verbs:</span>
            <span>recitar</span>
            <br>            
            <span>absoldre</span>
            <span>aparèixer</span>
            <span>aprendre</span>
            <span>atendre</span>
            <span>batre</span>
            <span>beure</span>
            <span>caure</span>
            <span>cloure</span>
            <span>complaure</span>
            <span>confondre</span>
            <span>córrer</span>
            <span>créixer</span>
            <span>empènyer</span>
            <span>escriure</span>
            <span>fer</span>
            <span>haver</span>
            <span>pertànyer</span>
            <span>preveure</span>
            <span>prometre</span>
            <span>respondre</span>
            <span>riure</span>
            <span>romandre</span>
            <span>témer</span>
            <span>vèncer</span>
            <span>viure</span>
            <br>
            <span>llegir</span>
        </span>
    </span>
    </p>
</div>


${botoactualitzar}
`

if (idPagina === 'principal') {
    const dropdowncontainer_generalHTML = document.getElementById('dropdown-container');
    if (dropdowncontainer_generalHTML) { dropdowncontainer_generalHTML.innerHTML = dropdowncontainer_general; }
} else {
    const dropdowncontainer_llistesHTML = document.getElementById('dropdown-container');
    if (dropdowncontainer_llistesHTML) { dropdowncontainer_llistesHTML.innerHTML = dropdowncontainer_llistes; }
}


const checkboxContainer = /*html*/`
<!-- Secció "Noms" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox1" onchange="toggleList('nomsList', 'checkbox1')" onclick="handleCheckboxClick(event, CriterisNoms)"> Noms
</label>

<ul id="nomsList" style="display: none" onclick="handleCheckboxClick(event, CriterisNoms)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Propis</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Comuns</label></li>
</ul>

<!-- Secció "Adjectius" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox2" onchange="toggleList('adjectiusList', 'checkbox2')" onclick="handleCheckboxClick(event, CriterisAdjectius)"> Adjectius
</label>

<ul id="adjectiusList" style="display: none" onclick="handleCheckboxClick(event, CriterisAdjectius)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Qualificatius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Superlatius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Ordinals</label></li>
</ul>

<!-- Secció "Verbs" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox3" onchange="toggleList('verbsList', 'checkbox3')" onclick="handleCheckboxClick(event, CriterisVerbs)"> Verbs
</label>

<ul id="verbsList" style="display: none" onclick="handleCheckboxClick(event, CriterisVerbs)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Indicatiu</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Subjuntiu</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Imperatiu</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Gerundis</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Participis</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Infinitius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Condicional</label></li>
</ul>


<!-- Secció "infinitiu + pronoms" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox7" onchange="toggleList('infinitiupronomList', 'checkbox7')" onclick="handleCheckboxClick(event, CriterisInfinitiuPronom)"> Infinitiu + pronom(s)
</label>

<ul id="infinitiupronomList" style="display: none" onclick="handleCheckboxClick(event, CriterisInfinitiuPronom)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">+ 1 pronom</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">+ 2 pronoms</label></li>
</ul>

<!-- Secció "gerundi + 2 pronoms" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox8" onchange="toggleList('gerundipronomList', 'checkbox8')" onclick="handleCheckboxClick(event, CriterisGerundiPronom)"> Gerundi + pronom(s)
</label>

<ul id="gerundipronomList" style="display: none" onclick="handleCheckboxClick(event, CriterisGerundiPronom)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">+ 1 pronom</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">+ 2 pronoms</label></li>
</ul>


<!-- Secció "Determinants" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox4" onchange="toggleList('determinantsList', 'checkbox4')" onclick="handleCheckboxClick(event, CriterisDeterminants)"> Determinants
</label>

<ul id="determinantsList" style="display: none" onclick="handleCheckboxClick(event, CriterisDeterminants)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Números</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Articles</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Relatius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Interrogatius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Demostratius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Exclamatius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Indefinits</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Possessius</label></li>
</ul>

<!-- Secció "Pronoms" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox5" onchange="toggleList('pronomsList', 'checkbox5')" onclick="handleCheckboxClick(event, CriterisPronoms)"> Pronoms
</label>

<ul id="pronomsList"  style="display: none" onclick="handleCheckboxClick(event, CriterisPronoms)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Demostratius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Indefinits</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Interrogatius / Exclamatius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Personals (forts i febles)</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Possessius</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Relatius</label></li>
</ul>

<!-- Secció "Altres categories" -->
<label>
    <input type="checkbox" class="clickable-checkbox" id="checkbox6" onchange="toggleList('altresList', 'checkbox6')" onclick="handleCheckboxClick(event, CriterisAltres)"> Altres categories
</label>

<ul id="altresList"  style="display: none" onclick="handleCheckboxClick(event, CriterisAltres)">
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Adverbis</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Conjuncions</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Interjeccions</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Preposicions</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">Contraccions</label></li>
    <li class="no-list-style"><label><input type="checkbox" class="clickable-checkbox">"etcètera"</label></li>
</ul>
`
const checkboxContainerHTML = document.getElementById('checkboxContainer');
if (checkboxContainerHTML) { checkboxContainerHTML.innerHTML = checkboxContainer; }

const footer = /*html*/`
<br>v.6.0 &copy; Marc i Ferran. Uns quants drets reservats.
<br><br>
<br>Si has trobat una errada o tens una suggerència, ens pots enviar un correu a:
<br><br><a href="mailto:hola@rimador.cat">hola@rimador.cat</a>
<button id="botoNetejarCache" style="display:none;position:fixed;bottom:70px;right:15px;" onclick="netejarIndexedDB()">🗑 Esborrar memòria cau</button>
<br><br><br><br><br><br>
`
const footerHTML = document.getElementById('footer');
if (footerHTML) { footerHTML.innerHTML = footer; }


// El botó de tornar amunt. Aquí només hi ha la marca: qui l'ensenya i l'amaga
// segons el desplaçament és el final de js/script.js, i com es veu és cosa de
// css/botopujar.scss. Comença amagat (aria-hidden i sense tabindex) perquè a
// dalt de tot no hi ha res a on tornar.
const BotoPujar = /*html*/`
<button
  id="back-to-top"
  class="back-to-top"
  type="button"
  aria-label="Tornar amunt"
  title="Tornar amunt"
  aria-hidden="true"
  tabindex="-1"
><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
`
const BotoPujarHTML = document.getElementById('botopujar');
if (BotoPujarHTML) { BotoPujarHTML.innerHTML = BotoPujar; }


