const idPagina = document.body ? document.body.id : '';

let ruta1 = '';
let ruta2 = '';
if (idPagina === 'principal' || idPagina === 'canvis' || idPagina === '404') {
  ruta1 = './assets/';
  ruta2 = 'historial_canvis.html';
  botoactualitzar = '';
} else if (idPagina === 'llista1') {
  ruta1 = '../assets/';
  ruta2 = '../historial_canvis.html';
  botoactualitzar = '<button class="boto" role="button" id="actualitzaButton"><span class="text">Actualitzar</span></button>';
}


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
<a href="https://rimador.cat"><img class="rimador" id="rimadorImg" src="${ruta1}Rimador-1.webp" alt="Logo del Rimador en català"></a>
<button type="button" id="themeToggleBtn" class="peixet-btn" onclick="toggleTheme()" aria-label="Canvia entre mode festiu i mode sobri" title="Canvia d'estil"><img class="peixet" id="peixetImg" src="${ruta1}peixet.webp" alt="Peixet decoratiu"></button>
`
const headerHTML = document.getElementById('header');
if (headerHTML) { headerHTML.innerHTML = header; }


const separador_rosa1 = /*html*/`
<p>Pàgina web en fase de correcció, versió en desenvolupament
<br>Novetat! (23 d'abril) Nou domini! Ara ens trobes a <a id="enllaçbrillant" href="https://rimador.cat" target="_blank">rimador.cat</a>. Revisa tots els canvis <a id="enllaç" href="${ruta2}" target="_blank">aquí</a>.</p>
`
const separador_rosa1HTML = document.getElementById('separador_rosa1');
if (separador_rosa1HTML) { separador_rosa1HTML.innerHTML = separador_rosa1; }


const dropdowncontainer = /*html*/`
<div>
    <label for="rimaSelector">Tipus de rima:</label>
    <select id="rimaSelector">
        <option value="r.consonant">Consonant</option>
        <option value="r.assonant">Assonant</option>
    </select>
</div>

<div>
    <label for="numeroSelector">Nombre de síl·labes:</label>
    <select id="numeroSelector">
        <option value="0">Indiferent</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5+</option>
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
const dropdowncontainerHTML = document.getElementById('dropdown-container');
if (dropdowncontainerHTML) { dropdowncontainerHTML.innerHTML = dropdowncontainer; }

const formulariContainer = /*html*/`
<form action="https://formspree.io/f/xeoazgnl" method="POST">
    <h3>Ajuda'ns a millorar!!!!!!!!!!!!!!</h3>
    <p>Si has trobat una errada o tens una suggerència, ens pots enviar un correu a <a href="mailto:rimadorcat@gmail.com">rimadorcat@gmail.com</a></p>
    
    <img class="gifok" src="${ruta1}ok1.webp" alt="Ok1">
    <img class="gifok" src="${ruta1}ok2.webp" alt="Ok2">

    <br>
                
</form>
`
const formulariContainerHTML = document.getElementById('formulariContainer');
if (formulariContainerHTML) { formulariContainerHTML.innerHTML = formulariContainer; }


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
<br>v.5.3 &copy; Marc i Ferran. Tots els drets reservats.
<br><br><a href="mailto:rimadorcat@gmail.com">rimadorcat@gmail.com</a>
<button id="botoNetejarCache" style="display:none;position:fixed;bottom:70px;right:15px;" onclick="netejarIndexedDB()">🗑 Esborrar memòria cau</button>
<br>
`
const footerHTML = document.getElementById('footer');
if (footerHTML) { footerHTML.innerHTML = footer; }