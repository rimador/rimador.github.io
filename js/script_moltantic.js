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

const dades_processades = llegirFitxerDeText('diccionaris/noudiccionari2.3.txt')
  .then(llistaDeLlistes => {
    console.log('Llista de llistes processada');
    document.getElementById("loader").style.display = "none";
    return llistaDeLlistes;
  })
  .catch(error => {
    console.error('Error en processar el fitxer:', error);
});


function llegirFitxerDeText(url) {
  document.getElementById("loader").style.display = "block";
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Error en llegir el fitxer');
      }
      return response.text();
    })
    .then(contingut => {
      return processarFitxerDeText(contingut);
    })
    .catch(error => {
      console.error('Error:', error);
    });
}

function processarFitxerDeText(contingut) {
  console.time('processarFitxerDeText');
  var linies = contingut.split('\n');
  var llistaDeLlistes = [];

  linies.forEach(function (linia) {
    var elements = linia.split('$');
    llistaDeLlistes.push(elements);
  });

  console.timeEnd('processarFitxerDeText');
  return llistaDeLlistes;
}








//FUNCIONS
async function realitzarCerca() {
  console.time('realitzarCerca');
  console.log("Funció realitzarCerca");

  try {
    matches = [];
    
    var paraulaCercada = document.getElementById('paraulaCercada').value.toLowerCase();
    var numeroSeleccionat = document.getElementById('numeroSelector').value;
    var tipusRima = document.getElementById('rimaSelector').value;
    var comença = document.getElementById('categoriaSelector').value;
    var inclourePropis = document.getElementById('nomsPropis').value;


    const llistaDeLlistes = await dades_processades;

    const buscaparaula = buscarParaula(paraulaCercada, numeroSeleccionat, llistaDeLlistes, comença, tipusRima,  inclourePropis);
    matches = buscaparaula[0];
    paraulacerca = buscaparaula[1];
      
    matches_provisionals = matches.slice();

    actualitzarRimes();
    var checkboxes = document.querySelectorAll('.clickable-checkbox');

    checkboxes.forEach(function(checkbox) {
      checkbox.checked = true;
    });

    mostrarTotesLesLlistes();
    console.timeEnd('realitzarCerca');
  } catch (error) {
    console.error('Error en realitzar la cerca:', error);
  }
}

function buscarParaula(paraulaCercada, numeroSeleccionat, llistaDeLlistes, comença, tipusRima, inclourePropis) {
  console.time('buscarParaula');
  console.log("Funció buscarParaula")

  var llistaParaulaCerca = llistaDeLlistes.find(item => {
    return item[0].toLowerCase() === paraulaCercada;
  });
  

  console.log(llistaParaulaCerca)
  console.log(paraulaCercada)

  if (!llistaParaulaCerca) {
    llistaParaulaCerca = [0, 0, 0, 0, 0, 0, 0, 0]; // Assignem el valor per defecte
}
  
  for (var i = 0; i < llistaDeLlistes.length; i++) {
    let paraula = llistaDeLlistes[i]
    let bona = 1;
    while (bona === 1) {

      if (paraula.length > 7 && paraula[7] !== numeroSeleccionat && numeroSeleccionat !== "0" && numeroSeleccionat !== "5") {
        break;
      }

      if (paraula.length > 7 && numeroSeleccionat === "5" && parseInt(paraula[7]) < 5) {
        break;
      }

      if (comença === "vocal+h" && !'haeiou'.includes(paraula[0][0])) {
        break;
      }

      if (comença === "consonant" && 'haeiou'.includes(paraula[0][0])) {
        break;
      }

      if (tipusRima === 'r.consonant') {
        if (paraula[5] !== llistaParaulaCerca[5]) {
          break;
        }
      }

      if (tipusRima === 'r.assonant') {
        if (paraula[6] !== llistaParaulaCerca[6]) {
          break;
        }
      }

      if (inclourePropis === 'no') {
        if (paraula[2][0] === "N" && paraula[2][1] === "P") {
          break;
        }
      }

      matches.push(paraula);
      bona = 0;
    }
  }
  console.timeEnd('buscarParaula');
  return [matches, llistaParaulaCerca];
}

function actualitzarRimes() {
  console.time('actualitzarRimes');
  console.log("Funció actualitzarRimes")

  var numerorimes = "Nombre de rimes: " + matches_provisionals.length;
      document.getElementById("nombre").innerHTML = numerorimes;

  if (matches_provisionals.length > 0) {
    var rimes = "Rimes:<br>";
    for (var i = 0; i < matches_provisionals.length; i++) {
        var parts = matches_provisionals[i];
        rimes += parts[0] + "<br>";
  }
  } else {
    if (paraulacerca[0] === 0){
      var rimes = "No s\'ha trobat la paraula al diccionari."
    }
    else{
      var rimes = "No s\'han trobat rimes amb aquestes condicions. Ets massa exigent!";
    }
  }
  document.getElementById("rimes").innerHTML = rimes;
  console.timeEnd('actualitzarRimes');
}

function mostrarTotesLesLlistes() {
  console.time('mostrarTotesLesLlistes');
  console.log("Funció mostrarTotesLesLlistes")

  var resultats = obtenirValorsSegonsPrimerCaracter(matches)

  mostrarLlista('noms', resultats.resultatsN, 'checkbox1');
  mostrarLlista('adjectius', resultats.resultatsA, 'checkbox2');
  mostrarLlista('verbs', resultats.resultatsV, 'checkbox3');
  mostrarLlista('determinants', resultats.resultatsD, 'checkbox4');
  mostrarLlista('pronoms', resultats.resultatsP, 'checkbox5');

  console.timeEnd('mostrarTotesLesLlistes');

}

function mostrarLlista(tipusLlista, elementsAMostrar, checkboxId) {
  console.time('mostrarLlista');
  console.log("Funció mostrarLlista")

  var titleSelector = '#' + checkboxId;
  var listSelector = '#' + tipusLlista + 'List';

  var listTitle = document.querySelector(titleSelector);
  var list = document.querySelector(listSelector);

  if (listTitle && list) {
      listTitle.parentElement.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';
      list.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';

      var elementsDeLlista = list.querySelectorAll('li');

      elementsDeLlista.forEach(function (element, index) {
          element.style.display = 'none';  // Amagar tots els elements inicialment
      });

      elementsAMostrar.forEach(function (indexToShow) {
          if (indexToShow < elementsDeLlista.length) {
              elementsDeLlista[indexToShow].style.display = 'list-item';
          }
      });

  } else {
      console.log('No es compleixen les condicions per entrar a la lògica principal');
  }
  console.timeEnd('mostrarLlista');
}

function toggleList(listID, checkboxID) {
  console.time('toggleList');
  console.log("Funció toggleList")

  var list = document.getElementById(listID);
  var checkboxTitle = document.getElementById(checkboxID);

  // Obtenim totes les checkboxes dins de la llista
  var checkboxes = list.querySelectorAll('input[type="checkbox"]');

  if (checkboxTitle.checked) {
    // Si el checkbox de títol està marcat, iterem sobre totes les checkboxes i les marquem
    checkboxes.forEach(function (checkbox) {
      checkbox.checked = true;
    });
  } else {
    // Si el checkbox de títol està desmarcat, iterem sobre totes les checkboxes i les desmarquem
    checkboxes.forEach(function (checkbox) {
      checkbox.checked = false;
    });
  }
  console.timeEnd('toggleList');

}

function handleCheckboxClick(event, checkboxCriteria) {
  console.time('handleCheckboxClick');
  console.log("Funció handleCheckboxClick")

  if (event.target.type === 'checkbox') {
      const checkboxLabel = event.target.parentNode.innerText.trim();

      if (checkboxLabel in checkboxCriteria) {
          const { filterFunction } = checkboxCriteria[checkboxLabel];

          if (event.target.checked) {
              const linesToAdd = matches.filter(filterFunction);

              const uniqueLinesToAdd = linesToAdd.filter(line => !matches_provisionals.includes(line));

              matches_provisionals = matches_provisionals.concat(uniqueLinesToAdd);

              console.log(`Checkbox "${checkboxLabel}" marcada`);
              console.log('Línies afegides:', uniqueLinesToAdd);
          
          } else {
              console.log(`Checkbox "${checkboxLabel}" desclicat`);
              matches_provisionals = matches_provisionals.filter(item => !filterFunction(item));
          }

          actualitzarRimes();
  }   }
  console.timeEnd('handleCheckboxClick');

}

function obtenirValorsSegonsPrimerCaracter(matches) {
  console.time('obtenirValorsSegonsPrimerCaracter');
  console.log("Funció obtenirValorsSegonsPrimerCaracter")

  var resultatsN = [];
  var resultatsA = [];
  var resultatsV = [];
  var resultatsD = [];
  var resultatsP = [];


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
              }
              break; 
          
          case "D": // Determinants
              switch (segonCaracter) {
                  case "N": resultatsP.push(0); break; // Números
                  case "A": resultatsP.push(1); break; // Articles
                  case "R": resultatsP.push(2); break; // Relatius
                  case "T": resultatsP.push(3); break; // Interrogatius
                  case "D": resultatsP.push(4); break; // Demostratius
                  case "E": resultatsP.push(5); break; // Exclamatius
                  case "I": resultatsP.push(5); break; // Indefinits
                  case "P": resultatsP.push(5); break; // Possessius
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
      }
  }

  // Retornar les variables amb els resultats
  console.timeEnd('obtenirValorsSegonsPrimerCaracter');
  return {
      resultatsN: resultatsN,
      resultatsA: resultatsA,
      resultatsV: resultatsV,
      resultatsD: resultatsD,
      resultatsP: resultatsP,

  };
}