const debugLevel = 0; // 0 = Off, 1 = Goatcounter, 2 = Errors, 3 = Logs, 4 = Temps

const VERSIO_TRANSCRIPCIONS = "v.2.8";  // Versió de col_3, col_4 i col_9
const VERSIO_TOTAL = "v.2.8"; // Versió de totes les altres columnes

const VERSIONS_FITXERS = {
  "col_0.txt": VERSIO_TOTAL, //paraula
  "col_1.txt": VERSIO_TOTAL, //d'on prové
  "col_2.txt": VERSIO_TOTAL, //codi
  "col_3.txt": VERSIO_TRANSCRIPCIONS, //consonant
  "col_4.txt": VERSIO_TRANSCRIPCIONS, //assonant
  "col_5.txt": VERSIO_TOTAL, //síl·labes
  "col_6.txt": VERSIO_TOTAL, //Vicc
  "col_7.txt": VERSIO_TOTAL, //Viq
  "col_8.txt": VERSIO_TOTAL, //Diec
  "col_9.txt": VERSIO_TRANSCRIPCIONS //transcripció sencera
  //col_10 - paraula + transcripció
};

const Debug = {
    log: debugLevel >= 3 ? (label) => console.log(`[DEBUG] ${label}`) : () => {},
    logError: debugLevel >= 2 ? (...args) => console.error('[ERROR]', ...args) : () => {},
    logTime: debugLevel >= 4 ? (label) => console.time(`[TIMER] ${label}`) : () => {},
    logTimeEnd: debugLevel >= 4 ? (label) => console.timeEnd(`[TIMER] ${label}`) : () => {},
    contador: debugLevel >= 1 ? (label) => console.log(`[COUNTER] ${label}`) : () => {},
};

if (debugLevel >= 3) {
  window.addEventListener('DOMContentLoaded', () => {
    const boto = document.getElementById("botoNetejarCache");
    if (boto) boto.style.display = "block";
  });
}


let array0, array1, array2, array3, array4, array5, array6, array7, array8, array9;
let fitxersLlegits = 0;
let nombresDeFitxers = 10;

const nombresSeleccionats = [0,1,2,3,4,5,6,7,8,9];
const camins = nombresSeleccionats.map(i => `diccionaris/separat/col_${i}.txt`);

document.addEventListener('DOMContentLoaded', async () => {
    Debug.logTime('Temps de càrrega');
    document.getElementById('loader-text2').textContent = `Carregant fitxers (${fitxersLlegits}/${nombresDeFitxers})`;

    try {
        const resultatFitxers = await Promise.all(camins.map(llegirFitxerAmbIndexedDB));
        [array0, array1, array2, array3, array4, array5, array6, array7, array8, array9] = resultatFitxers;
        console.log('Tots els fitxers carregats correctament');

        document.getElementById("loader").style.display = "none";
    } catch (error) {
        Debug.logError('Error en carregar els fitxers:', error);
        document.getElementById("loader").style.display = "none";
    } finally {
        Debug.logTimeEnd('Temps de càrrega');
    }
});

// --- FUNCIONS INDEXEDDB ---
function obrirIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('rimadorDB', 1);
        request.onerror = () => reject(null);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('fitxers')) {
                db.createObjectStore('fitxers', { keyPath: 'nom' });
            }
        };
    });
}

function recuperarFitxer(db, nom) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('fitxers', 'readonly');
        const store = tx.objectStore('fitxers');
        const req = store.get(nom);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(null);
    });
}

function guardarFitxer(db, nom, contingut, versio) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('fitxers', 'readwrite');
        const store = tx.objectStore('fitxers');
        store.put({ nom, contingut, versio });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
    });
}

// LECTURA AMB INDEXEDDB + VERSIÓ + BACKUP
async function llegirFitxerAmbIndexedDB(rutaFitxer) {
  const nomFitxer = rutaFitxer.split("/").pop();
  const versioActual = VERSIONS_FITXERS[nomFitxer] || "v.1.1"; // Fallback

  try {
    const db = await obrirIndexedDB();
    if (!db) throw new Error("IndexedDB no disponible");

    const fitxerDesat = await recuperarFitxer(db, nomFitxer);
    Debug.log(`Comparant versions: guardada=${fitxerDesat?.versio}, actual=${versioActual}`);

    if (fitxerDesat && fitxerDesat.versio === versioActual) {
      console.log(`${nomFitxer} carregat d'IndexedDB`);
      fitxersLlegits++;
      document.getElementById("loader-text2").textContent = `Carregant fitxers (${fitxersLlegits}/${nombresDeFitxers})`;
      return processarFitxerEnParalel(fitxerDesat.contingut);
    }

    console.log(`${nomFitxer} obsolet o no guardat, fent fetch i guardant arxiu a Indexed`);
    const contingut = await fetchFitxer(rutaFitxer);
    await guardarFitxer(db, nomFitxer, contingut, versioActual);
    Debug.log(`${nomFitxer} guardat a IndexedDB amb nova versió`);
    fitxersLlegits++;
    document.getElementById("loader-text2").textContent = `Carregant fitxers (${fitxersLlegits}/${nombresDeFitxers})`;
    return processarFitxerEnParalel(contingut);

  } catch (err) {
    Debug.logError(`IndexedDB fallida per ${nomFitxer}, intentant fetch directe`);
    const errorMsg = document.getElementById("error-msg");
    if (errorMsg) errorMsg.textContent = `Problema amb cache. Carregant ${nomFitxer} manualment.`;

    const contingut = await fetchFitxer(rutaFitxer);
    fitxersLlegits++;
    document.getElementById("loader-text2").textContent = `Carregant fitxers (${fitxersLlegits}/${nombresDeFitxers})`;
    return processarFitxerEnParalel(contingut);
  }
}

function processarFitxerEnParalel(contingut) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(processarFitxerDeText(contingut));
    }, 0);
  });
}

// FETCH NORMAL
async function fetchFitxer(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error en llegir ${url}`);
    return await response.text();
}

// PROCESSAR TXT
function processarFitxerDeText(contingut) {
    return contingut.split('\n');
}

// NETEJAR INDEXEDDB
function netejarIndexedDB() {
    const request = indexedDB.deleteDatabase('rimadorDB');
    request.onsuccess = () => console.log('IndexedDB esborrat correctament');
    request.onerror = () => console.error('Error en esborrar IndexedDB');
    request.onblocked = () => console.warn("L'esborrat d'IndexedDB està bloquejat");
}
  
// Afegir event listener per la tecla Enter
const inputParaula = document.getElementById('paraulaCercada');
inputParaula.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    realitzarCerca();
  }
});


//Botó:
cercaButton.addEventListener('click', realitzarCerca);

const CriterisNoms = {
  ...crearCriteris('Noms', 'N'),
  ...crearCriteris('Propis', 'NP'),
  ...crearCriteris('Comuns', 'NC'),
};

const CriterisVerbs = {
  ...crearCriteris('Verbs', 'V'),
  ...crearCriterisTriples('Indicatiu', 'VAI', 'VSI', 'VMI' ),
  ...crearCriterisTriples('Subjuntiu', 'VAS', 'VSS', 'VMS'),
  ...crearCriterisTriples('Imperatiu', 'VAM', 'VSM', 'VMM'),
  ...crearCriterisTriples('Gerundis', 'VAG', 'VSG', 'VMG'),
  ...crearCriterisTriples('Participis', 'VAP', 'VSP', 'VMP'),
  ...crearCriterisTriples('Infinitius', 'VAN', 'VSN', 'VMN'),
  ...crearCriterisTriples('Condicional', 'VAC', 'VSC', 'VMC' ),
};

const CriterisAdjectius = {
  ...crearCriteris('Adjectius', 'A'),
  ...crearCriteris('Qualificatius', 'AQ0'),
  ...crearCriteris('Superlatius', 'AQA'),
  ...crearCriteris('Ordinals', 'AO'),
};

const CriterisPronoms = {
  ...crearCriteris('Pronoms', 'P'),
  ...crearCriteris('Demostratius', 'PD'),
  ...crearCriteris('Indefinits', 'PI'),
  ...crearCriteris('Interrogatius / Exclamatius', 'PT'),
  ...crearCriterisDobles('Personals (forts i febles)', 'PP', 'P0'),
  ...crearCriteris('Possessius', 'PX'),
  ...crearCriteris('Relatius', 'PR'),
};

const CriterisDeterminants = {
  ...crearCriteris('Determinants', 'D'),
  ...crearCriteris('Números', 'DN'),
  ...crearCriteris('Articles', 'DA'),  
  ...crearCriteris('Relatius', 'DR'),
  ...crearCriteris('Interrogatius', 'DT'),
  ...crearCriteris('Demostratius', 'DD'),
  ...crearCriteris('Exclamatius', 'DE'),
  ...crearCriteris('Indefinits', 'DI'),
  ...crearCriteris('Possessius', 'DP'),
};

const CriterisAltres = {
  ...crearCriteris('Altres categories', 'Z'),
  ...crearCriteris('Adverbis', 'ZR'),
  ...crearCriteris('Conjuncions', 'ZC'),
  ...crearCriteris('Interjeccions', 'ZI'),
  ...crearCriteris('Preposicions', 'ZSPS'),
  ...crearCriteris('Contraccions', 'ZSP+'),
  ...crearCriteris('"etcètera"', 'ZF'),
};

function crearCriteris(nom, prefix) {  
  return {
      [`${nom}`]: {
          filterFunction: item => item[2].startsWith(`${prefix}`),},};

}

function crearCriterisDobles(nom, prefix1, prefix2) {
  return {
      [`${nom}`]: {
          filterFunction: item => item[2].startsWith(prefix1) || item[2].startsWith(prefix2),},};
}

function crearCriterisTriples(nom, prefix1, prefix2, prefix3) {
  return {
      [`${nom}`]: {
          filterFunction: item => item[2].startsWith(prefix1) || item[2].startsWith(prefix2) || item[2].startsWith(prefix3),},};
}


//FUNCIONS
async function realitzarCerca() {
  Debug.log("Botó clicat!");
  Debug.logTime('realitzarCerca');
  document.getElementById("espai_inicial").style.display = "none";

  try {
    matches = [];
    
    var paraulaCercada = document.getElementById('paraulaCercada').value.trim().toLowerCase();
    var numeroSeleccionat = document.getElementById('numeroSelector').value;
    var tipusRima = document.getElementById('rimaSelector').value;
    var comença = document.getElementById('categoriaSelector').value;
    var inclourePropis = document.getElementById('nomsPropis').value;
    var inclourePlurals = document.getElementById('plurals').value;
    
    const buscaparaula = buscarParaula(paraulaCercada, numeroSeleccionat, comença, tipusRima, inclourePropis, inclourePlurals, array0, array1, array2, array3, array4, array5, array6, array7, array8, array9);
    matches = buscaparaula[0];
    
    paraulacerca = buscaparaula[1];
      
    matches_provisionals = matches.slice();

    actualitzarRimes();
    var checkboxes = document.querySelectorAll('.clickable-checkbox');

    checkboxes.forEach(function(checkbox) {
      checkbox.checked = true;
    });

    mostrarTotesLesLlistes();
    document.querySelector('.impressio').style.display = 'flex';
    Debug.logTimeEnd('realitzarCerca');
  } catch (error) {
    Debug.logError('Error en realitzar la cerca:', error);
  }
}

function descriureCategoria(codi) {
  if (codi.startsWith("Y")) return "abreviació";
  if (codi.startsWith("CC")) return "conjunció";
  if (codi.startsWith("SP")) return "preposició";
  if (codi.startsWith("I")) return "interjecció";
  if (codi.startsWith("RG")) return "adverbi";
  if (codi.startsWith("V")) return "verb";
  if (codi.startsWith("N")) return "nom";
  if (codi.startsWith("A")) return "adjectiu";
  if (codi.startsWith("P")) return "pronom";
  if (codi.startsWith("D")) return "determinant";
  if (codi.startsWith("Z")) return "altre";
  return "altra categoria";
}

function buscarParaula(paraulaCercada, numeroSeleccionat, comença, tipusRima, inclourePropis, inclourePlurals, array0, array1, array2, array3, array4, array5, array6, array7, array8, array9) {
  Debug.logTime('buscarParaula');

  const coincidencies = array0
    .map((item, index) => ({ paraula: item, index }))
    .filter(obj => obj.paraula.toLowerCase() === paraulaCercada.toLowerCase());

  if (coincidencies.length === 0) {
    llistaParaulaCerca = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    
  } else if (coincidencies.length === 1) {
    var indexparaula = coincidencies[0].index;
    llistaParaulaCerca = [
      array0[indexparaula], array1[indexparaula], array2[indexparaula],
      array3[indexparaula], array4[indexparaula], array5[indexparaula],
      array6[indexparaula], array7[indexparaula], array8[indexparaula], array9[indexparaula]
    ];
  } else {
    const transcripcions = new Set(coincidencies.map(c => array9[c.index]));
    if (transcripcions.size === 1) {
      var indexparaula = coincidencies[0].index;
      llistaParaulaCerca = [
        array0[indexparaula], array1[indexparaula], array2[indexparaula],
        array3[indexparaula], array4[indexparaula], array5[indexparaula],
        array6[indexparaula], array7[indexparaula], array8[indexparaula], array9[indexparaula]
      ];
    } else {
      const ordenat = coincidencies; // podríem afegir `.sort(...)` si volem ordenar els resultats???

      let opcions = coincidencies.map((c, i) => {
        const index = c.index;
        const paraula = array0[index];
        const arrel = array1[index];
        const categoria = descriureCategoria(array2[index]);
        const transcripcio = array9[index];
        return `${i + 1}: ${paraula} (${categoria}, ${arrel}) ${transcripcio.startsWith("/") ? transcripcio : "/" + transcripcio + "/"}`;
      }).join("\n");

      let eleccio = prompt(`Hi ha ${ordenat.length} coincidències per "${paraulaCercada}".\nEscull una opció:\n\n${opcions}`);

      let num = parseInt(eleccio);
      if (!isNaN(num) && num > 0 && num <= ordenat.length) {
        const indexparaula = ordenat[num - 1].index;
        llistaParaulaCerca = [
          array0[indexparaula], array1[indexparaula], array2[indexparaula],
          array3[indexparaula], array4[indexparaula], array5[indexparaula],
          array6[indexparaula], array7[indexparaula], array8[indexparaula], array9[indexparaula]
        ];
      } else {
        alert("Selecció invàlida. Cerca cancel·lada.");
        return [[], [0, 0, 0, 0, 0, 0, 0, 0, 0]];
      }
    }
  }

  
  
  for (var i = 0; i < array0.length; i++) {
    let bona = 1;
    while (bona === 1) {
      if (array5[i] !== numeroSeleccionat && numeroSeleccionat !== "0" && numeroSeleccionat !== "5") {
        break;
      }

      if (numeroSeleccionat === "5" && parseInt(array5[i]) < 5) {
        break;
      }

      if (comença === "vocal+h" && !'haeiou'.includes(array0[i][0])) {
        break;
      }

      if (comença === "consonant" && 'haeiou'.includes(array0[i][0])) {
        break;
      }

      if (tipusRima === 'r.consonant') {
        if (array3[i] !== llistaParaulaCerca[3]) {
          break;
        }
      }

      if (tipusRima === 'r.assonant') {
        if (array4[i] !== llistaParaulaCerca[4]) {
          break;
        }
      }

      if (inclourePropis === 'no') {
        if (array2[i][0] === "N" && array2[i][1] === "P") {
          break;
        }
      }

      if (inclourePlurals === 'no') {
        if (array2[i][0] === "D" && array2[i][4] === "P") { //Determinants
          break;
        }
        if (array2[i][0] === "A" && array2[i][4] === "P") { //Adjectius
          break;
        }
        if (array2[i][0] === "N" && array2[i][3] === "P") { //Noms
          break;
        }
        if (array2[i][0] === "P" && array2[i][4] === "P") { //Pronoms
          break;
        }
      }
      
      let paraula = [array0[i], array1[i], array2[i], array5[i], array6[i], array7[i], array8[i]] //no cal guardar les rimes (array3 i 4)
      matches.push(paraula);
      bona = 0;
    }
  }
  Debug.logTimeEnd('buscarParaula');
  return [matches, llistaParaulaCerca];
}

function crearEnllacViccionari(paraula) {
  var enllac_vicc = '<a href="https://ca.wiktionary.org/wiki/' + paraula + '" target="_blank">';
  enllac_vicc += '<img src="./assets/logovicc (240x240).png" loading="lazy" alt="Logo" class="logo">';
  enllac_vicc += '</a>';
  return enllac_vicc;
}

function crearEnllacViquipedia(paraula) {
  var enllac_viq = '<a href="https://ca.wikipedia.org/wiki/' + paraula + '" target="_blank">';
  enllac_viq += '<img src="./assets/logowiki (263x240).png" loading="lazy" alt="Logo" class="logo">';
  enllac_viq += '</a>';
  return enllac_viq;
}

function crearEnllacDiec(paraula) {
  var enllac_diec = '<a href="https://dlc.iec.cat/Results?DecEntradaText=' + paraula + '&AllInfoMorf=False&OperEntrada=0&OperDef=0&OperEx=0&OperSubEntrada=0&OperAreaTematica=0&InfoMorfType=0&OperCatGram=False&AccentSen=False&CurrentPage=0&refineSearch=0&Actualitzacions=False" target="_blank">';
  enllac_diec += '<img src="./assets/logodiec (200x200).png" loading="lazy" alt="Logo" class="logo">';
  enllac_diec += '</a>';
  return enllac_diec;
}


function actualitzarRimes() {
  Debug.logTime('actualitzarRimes');

  var numerorimes = "Nombre de rimes: " + matches_provisionals.length;
  document.getElementById("nombre").innerHTML = numerorimes;

  var rimesPerSilabes = {};
  var rima_enllac = "";

  if (matches_provisionals.length > 0) {
    for (var i = 0; i < matches_provisionals.length; i++) {
      var parts = matches_provisionals[i];
      var paraula = parts[0];
      var paraula_mare = "";

      if (parts[2][0] === "V") {
        paraula_mare = " (" + parts[1] + ") ";
      }      
      var enllac_vicc = "";
      var enllac_viq = "";
      var enllac_diec = "";

      if (parts[4] === "Vicc") {
        enllac_vicc = crearEnllacViccionari(parts[1]);
      }

      if (parts[5] === "Viq") {
        enllac_viq = crearEnllacViquipedia(parts[1]);
      }
      
      if (parts[6] === "Diec") {
        enllac_diec = crearEnllacDiec(parts[1]);
      }

      var numsilabes = parts[3];

      if (!rimesPerSilabes[numsilabes]) {
        rimesPerSilabes[numsilabes] = [];
      }

      rimesPerSilabes[numsilabes].push({ paraula: paraula, paraula_mare: paraula_mare, enllac_vicc: enllac_vicc, enllac_viq: enllac_viq, enllac_diec: enllac_diec });
    }

    for (var silabes in rimesPerSilabes) {
      rima_enllac += "<h3><br>" + silabes + (silabes > 1 ? " síl·labes" : " síl·laba") + ":</h3><ul>";
      for (var j = 0; j < rimesPerSilabes[silabes].length; j++) {
        var item = rimesPerSilabes[silabes][j];
        var enllacText = "";
        
        if (item.enllac_vicc) {
          enllacText += item.enllac_vicc + " ";
        }
        if (item.enllac_viq) {
          enllacText += item.enllac_viq + " ";
        }
        if (item.enllac_diec) {
          enllacText += item.enllac_diec + " ";
        }

        rima_enllac += "<li><span class='classeParaula'>" + item.paraula + "</span><span class='classeParaulaMare'>" + item.paraula_mare + "</span> " + enllacText.trim() + "</li>";
      }
      rima_enllac += "</ul>";
    }
    
  } else {
    var rimes;
    if (paraulacerca[0] === 0) {
      rimes = "No s'ha trobat la paraula al diccionari.";
    } else {
      rimes = "No s'han trobat rimes amb aquestes condicions. Ets massa exigent!";
    }
    
    rima_enllac = "<ul><li>" + rimes + "</li></ul>";
  }

  document.getElementById("rima_enllac").innerHTML = rima_enllac;

  Debug.logTimeEnd('actualitzarRimes');
}



function mostrarTotesLesLlistes() {
  Debug.logTime('mostrarTotesLesLlistes');

  var resultats = obtenirValorsSegonsPrimerCaracter(matches)

  mostrarLlista('noms', resultats.resultatsN, 'checkbox1');
  mostrarLlista('adjectius', resultats.resultatsA, 'checkbox2');
  mostrarLlista('verbs', resultats.resultatsV, 'checkbox3');
  mostrarLlista('determinants', resultats.resultatsD, 'checkbox4');
  mostrarLlista('pronoms', resultats.resultatsP, 'checkbox5');
  mostrarLlista('altres', resultats.resultatsAlt, 'checkbox6');

  Debug.logTimeEnd('mostrarTotesLesLlistes');
}

function mostrarLlista(tipusLlista, elementsAMostrar, checkboxId) {
  Debug.logTime('mostrarLlista');

  var titleSelector = '#' + checkboxId;
  var listSelector = '#' + tipusLlista + 'List';

  var listTitle = document.querySelector(titleSelector);
  var list = document.querySelector(listSelector);

  if (listTitle && list) {
      listTitle.parentElement.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';
      list.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';

      var elementsDeLlista = list.querySelectorAll('li');

      elementsDeLlista.forEach(function (element, index) {
          element.style.display = 'none';
      });

      elementsAMostrar.forEach(function (indexToShow) {
          if (indexToShow < elementsDeLlista.length) {
              elementsDeLlista[indexToShow].style.display = 'list-item';
          }
      });

  } else {
      Debug.log('No es compleixen les condicions per entrar a la lògica principal');
  }
  Debug.logTimeEnd('mostrarLlista');
}

function toggleList(listID, checkboxID) {
  Debug.logTime('toggleList');

  var list = document.getElementById(listID);
  var checkboxTitle = document.getElementById(checkboxID);

  var checkboxes = list.querySelectorAll('input[type="checkbox"]');

  if (checkboxTitle.checked) {
    checkboxes.forEach(function (checkbox) {
      checkbox.checked = true;
    });
  } else {
    checkboxes.forEach(function (checkbox) {
      checkbox.checked = false;
    });
  }
  Debug.logTimeEnd('toggleList');

}

function handleCheckboxClick(event, checkboxCriteria) {
  Debug.logTime('handleCheckboxClick');

  if (event.target.type === 'checkbox') {
      const checkboxLabel = event.target.parentNode.innerText.trim();

      if (checkboxLabel in checkboxCriteria) {
          const { filterFunction } = checkboxCriteria[checkboxLabel];

          if (event.target.checked) {
              const linesToAdd = matches.filter(filterFunction);

              const uniqueLinesToAdd = linesToAdd.filter(line => !matches_provisionals.includes(line));

              matches_provisionals = matches_provisionals.concat(uniqueLinesToAdd);

              Debug.log(`Checkbox "${checkboxLabel}" marcada`);
          
          } else {
              Debug.log(`Checkbox "${checkboxLabel}" desclicat`);
              matches_provisionals = matches_provisionals.filter(item => !filterFunction(item));
          }

          actualitzarRimes();
  }   }
  Debug.logTimeEnd('handleCheckboxClick');

}

function obtenirValorsSegonsPrimerCaracter(matches) {
  Debug.logTime('obtenirValorsSegonsPrimerCaracter');

  var resultatsN = [];
  var resultatsA = [];
  var resultatsV = [];
  var resultatsD = [];
  var resultatsP = [];
  var resultatsAlt = [];

  for (var i = 0; i < matches.length; i++) {
      var terceraColumna = matches[i][2];
      var primerCaracter = terceraColumna.charAt(0);
      var segonCaracter = terceraColumna.charAt(1);
      var tercerCaracter = terceraColumna.charAt(2);

      switch (primerCaracter) {   
          
          case "N": // Noms
              switch (segonCaracter) {
                  case "P": resultatsN.push(0); break; // Propis
                  case "C": resultatsN.push(1); break; // Comuns
              }
              break;

          case "A": // Adjectius
              switch (segonCaracter) {
                  case "Q": // Adjectius
                    switch (tercerCaracter) {
                        case "0": resultatsA.push(0); break; // Qualificatius
                        case "A": resultatsA.push(1); break; // Superlatius
                    }
                    break;
                  case "O": resultatsA.push(2); break; // Ordinals
              }
              break;
          
          case "V": // Verbs
              switch (tercerCaracter) {
                  case "I": resultatsV.push(0); break; // Indicatiu
                  case "S": resultatsV.push(1); break; // Subjuntiu
                  case "M": resultatsV.push(2); break; // Imperatiu
                  case "G": resultatsV.push(3); break; // Gerundi
                  case "P": resultatsV.push(4); break; // Participi
                  case "N": resultatsV.push(5); break; // Infinitiu
                  case "C": resultatsV.push(6); break; // Condicional

              }
              break; 
          
          case "D": // Determinants
              switch (segonCaracter) {
                  case "N": resultatsD.push(0); break; // Números
                  case "A": resultatsD.push(1); break; // Articles
                  case "R": resultatsD.push(2); break; // Relatius
                  case "T": resultatsD.push(3); break; // Interrogatius
                  case "D": resultatsD.push(4); break; // Demostratius
                  case "E": resultatsD.push(5); break; // Exclamatius
                  case "I": resultatsD.push(6); break; // Indefinits
                  case "P": resultatsD.push(7); break; // Possessius
              }
              break;

          case "P": // Pronoms
              switch (segonCaracter) {
                  case "D": resultatsP.push(0); break; // Demostratius
                  case "I": resultatsP.push(1); break; // Indefinits
                  case "T": resultatsP.push(2); break; // Interrogatius / Exclamatius
                  case "P": case "0": resultatsP.push(3); break; // Personals
                  case "X": resultatsP.push(4); break; // Possessius
                  case "R": resultatsP.push(5); break; // Relatius
              }
              break;

          case "Z": // Altres
              switch (segonCaracter) {
                  case "R": resultatsAlt.push(0); break; // Adverbis
                  case "C": resultatsAlt.push(1); break; // Conjuncions
                  case "I": resultatsAlt.push(2); break; // Interjeccions
                  case "F": resultatsAlt.push(5); break; // "etcètera"
              }
              switch (tercerCaracter) {
                  case "S": resultatsAlt.push(3); break; // Preposicions
                  case "+": resultatsAlt.push(4); break; // Contraccions
              }
              break;
      }
  }

  // Retornar les variables amb els resultats
  Debug.logTimeEnd('obtenirValorsSegonsPrimerCaracter');
  return {
      resultatsN: resultatsN,
      resultatsA: resultatsA,
      resultatsV: resultatsV,
      resultatsD: resultatsD,
      resultatsP: resultatsP,
      resultatsAlt: resultatsAlt,
  };
}


//CSS
window.addEventListener('scroll', function() {
  var container = document.getElementById('container');
  var checkboxContainer = document.getElementById('checkboxContainer');
  var separador_rosa2 = document.getElementById('separador_rosa2')
  
  var dades_container = container.getBoundingClientRect();
  
  if (dades_container.height > 120) {
    checkboxContainer.style.top = (40 + dades_container.height + 40) + 'px';
    separador_rosa2.style.top = (40 + dades_container.height) + 'px';
  }
  else {
    checkboxContainer.style.top = '200px';
    separador_rosa2.style.top = '160px';
  }
});


//Mostrar i amagar el formulari de contacte
function toggleForm() {
  var formContainer = document.getElementById("formulariContainer");
  if (formContainer.style.display === "none" || formContainer.style.display === "") {
      formContainer.style.display = "block";
      document.addEventListener("click", closeFormOnClickOutside);
  } else {
      formContainer.style.display = "none";
      document.removeEventListener("click", closeFormOnClickOutside);
  }
}

function closeFormOnClickOutside(event) {
  var formContainer = document.getElementById("formulariContainer");
  if (!formContainer.contains(event.target) && event.target.id !== "mostrarFormulari") {
      formContainer.style.display = "none";
      document.removeEventListener("click", closeFormOnClickOutside);
  }
}
