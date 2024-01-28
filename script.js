//Esdeveniments:

//Botó:
cercaButton.addEventListener('click', realitzarCerca);


//Checkboxes:
//Noms
checkbox1.addEventListener('click', function(event) {
  handleCheckboxClick(event, CriterisNoms);
});
nomsList.addEventListener('click', function(event) {
  handleCheckboxClick(event, CriterisNoms);
});
checkbox1.addEventListener('change', toggleList('nomsList', 'checkbox1'))

//Verbs
checkbox2.addEventListener('click', function(event) {
  handleCheckboxClick(event, CriterisVerbs);
});
verbsList.addEventListener('click', function(event) {
  handleCheckboxClick(event, CriterisVerbs);
});
checkbox2.addEventListener('change', toggleList('verbsList', 'checkbox2'))

//Pronoms
checkbox5.addEventListener('click', function(event) {
  handleCheckboxClick(event, CriterisPronoms);
});
pronomsList.addEventListener('click', function(event) {
  handleCheckboxClick(event, CriterisPronoms);
});
checkbox5.addEventListener('change', toggleList('pronomsList', 'checkbox5'))


//Variables:
var matches = [];

var resultats = obtenirValorsSegonsPrimerCaracter(matches);
var elementsAMostrarPronoms = resultats.resultatsP;
var elementsAMostrarVerbs = resultats.resultatsV;
var elementsAMostrarNoms = resultats.resultatsN;

function obtenirValorsSegonsPrimerCaracter(matches) {
  var resultatsP = [];
  var resultatsV = [];
  var resultatsN = [];

  for (var i = 0; i < matches.length; i++) {
      var terceraColumna = matches[i][2];
      var primerCaracter = terceraColumna.charAt(0);
      var segonCaracter = terceraColumna.charAt(1);

      switch (primerCaracter) {
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
          case "V": // Verbs
              switch (segonCaracter) {
                  case "I": resultatsV.push(2); break; // Indicatiu
                  case "S": resultatsV.push(2); break; // Subjuntiu
                  case "M": resultatsV.push(2); break; // Imperatiu
                  case "G": resultatsV.push(3); break; // Gerundi
                  case "P": resultatsV.push(4); break; // Participi
                  case "N": resultatsV.push(5); break; // Infinitiu
              }
              break;    
          case "N": // Noms
              switch (segonCaracter) {
                  case "P": resultatsN.push(0); break; // Propis
                  case "C": resultatsN.push(1); break; // Comuns
              }

              break;
      }
  }

  // Retornar les variables amb els resultats
  return {
      resultatsP: resultatsP,
      resultatsV: resultatsV,
      resultatsN: resultatsN,
  };
}

const CriterisNoms = {
  ...crearCriteris('Noms', 'N'),
  ...crearCriteris('Propis', 'NP'),
  ...crearCriteris('Comuns', 'NC'),
};

const CriterisVerbs = {
  ...crearCriteris('Verbs', 'V'),
  ...crearCriteris('Indicatiu', 'VI'),
  ...crearCriteris('Subjuntiu', 'VS'),
  ...crearCriteris('Imperatiu', 'VM'),
  ...crearCriteris('Gerundis', 'VG'),
  ...crearCriteris('Participis', 'VP'),
  ...crearCriteris('Infinitius', 'VN'),
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





//FUNCIONS
function realitzarCerca() {
  matches = [];
  console.log("Funció realitzarCerca")
  var paraulaCercada = document.getElementById('paraulaCercada').value.toLowerCase();
  var numeroSeleccionat = document.getElementById('numeroSelector').value;
  var tipusRima = document.getElementById('rimaSelector').value;
  var comença = document.getElementById('categoriaSelector').value;

  // Obtenir la llista de llistes des del fitxer de text
  fetch('data.txt')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error de xarxa: ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
    .then(data => {
      // Processar el contingut del fitxer de text per construir la llista de llistes
      var llistaDeLlistes = processarFitxerDeText(data);

      // Buscar la paraula i obtenir les coincidències
      matches = buscarParaula(paraulaCercada, numeroSeleccionat, llistaDeLlistes, comença, tipusRima);

      // Mostrar els resultats
      console.log("Seguim")

      matches_provisionals = matches.slice();

      console.log("Matches")
      console.log(matches)

      console.log("Matches provisionals:")
      console.log(matches_provisionals)

      actualitzarRimes()
      var checkboxes = document.querySelectorAll('.clickable-checkbox');

      checkboxes.forEach(function(checkbox) {
        checkbox.checked = true;
      });

      mostrarTotesLesLlistes();
    })
    .catch(error => {
      console.error('Error carregant les llistes:', error);
      // Manejar l'error, com mostrar un missatge a l'usuari
    });
}



function processarFitxerDeText(contingut) {
  var linies = contingut.split('\n');
  var llistaDeLlistes = [];

  linies.forEach(function (linia) {
    var elements = linia.split('$');
    llistaDeLlistes.push(elements);
  });

  return llistaDeLlistes;
}

function buscarParaula(paraulaCercada, numeroSeleccionat, llistaDeLlistes, comença, tipusRima) {
  console.log('Comença buscarParaula');

  // Cerca prèvia per trobar la llista que conté la paraula cercada
  var llistaParaulaCerca = llistaDeLlistes.find(item => {
    console.log('Comparant:', item[0].toLowerCase(), paraulaCercada);
    return item[0].toLowerCase() === paraulaCercada;
  });
  
  for (var i = 0; i < llistaDeLlistes.length; i++) {
    console.log('Comença bucle for');
    let paraula = llistaDeLlistes[i]
    let bona = 1;
    while (bona === 1) {
      console.log('Comença while');
      if (paraula.length > 7 && paraula[7] !== numeroSeleccionat && numeroSeleccionat !== "0" && numeroSeleccionat !== "5") {
        break;
      }

      console.log('1/6');

      if (paraula.length > 7 && numeroSeleccionat === "5" && parseInt(paraula[7]) < 5) {
        break;
      }

      console.log('2/6');


      if (comença === "vocal+h" && !'haeiou'.includes(paraula[0][0])) {
        break;
      }

      console.log('3/6');


      if (comença === "consonant" && 'haeiou'.includes(paraula[0][0])) {
        break;
      }

      console.log('4/6');
      console.log(paraula);
      console.log(llistaParaulaCerca);



      if (tipusRima === 'Consonant') {
        if (paraula[5] !== llistaParaulaCerca[5]) {
          break;
        }
      }

      console.log('5/6');


      if (tipusRima === 'assonant') {
        if (paraula[6] !== llistaParaulaCerca[6]) {
          break;
        }
      }

      console.log('6/6');


      matches.push(paraula);
      console.log('paraula afegida, tornem a començar o saltem de funció');
      bona = 0;
    }
  }

  return matches;
}


function actualitzarRimes() {
  matches_provisionals.sort();
  var numerorimes = "Nombre de rimes: " + matches_provisionals.length;
      document.getElementById("nombre").innerHTML = numerorimes;

  if (matches_provisionals.length > 0) {
    var rimes = "Rimes:<br>";
    for (var i = 0; i < matches_provisionals.length; i++) {
        var parts = matches_provisionals[i];
        rimes += parts[0] + "<br>";
  }
  } else {
    var rimes = "No s\'ha trobat la paraula cercada.";

  }
  document.getElementById("rimes").innerHTML = rimes;
  
}



function mostrarTotesLesLlistes() {
  obtenirValorsSegonsPrimerCaracter(matches)

  mostrarLlista('pronoms', elementsAMostrarPronoms, 'checkbox5');
  mostrarLlista('verbs', elementsAMostrarVerbs, 'checkbox2');
  mostrarLlista('noms', elementsAMostrarNoms, 'checkbox1');
}

function mostrarLlista(tipusLlista, elementsAMostrar, checkboxId) {
  var titleSelector = '#' + checkboxId;
  var listSelector = '#' + tipusLlista + 'List';

  var listTitle = document.querySelector(titleSelector);
  var list = document.querySelector(listSelector);

  console.log('List Title:', listTitle);
  console.log('List:', list);
  console.log('Elements de la llista:', elementsDeLlista);    

  if (listTitle && list) {
      console.log('Entrant a la condició principal');

      listTitle.parentElement.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';
      list.style.display = elementsAMostrar.length > 0 ? 'block' : 'none';

      var elementsDeLlista = list.querySelectorAll('li');
      console.log('elementsDeLlista:', elementsDeLlista);

      elementsDeLlista.forEach(function (element, index) {
          element.style.display = 'none';  // Amagar tots els elements inicialment
      });

      elementsAMostrar.forEach(function (indexToShow) {
          console.log('indexToShow:', indexToShow);
          console.log('elementsDeLlista.length:', elementsDeLlista.length);

          if (indexToShow < elementsDeLlista.length) {
              elementsDeLlista[indexToShow].style.display = 'list-item';
          }
      });

  } else {
      console.log('No es compleixen les condicions per entrar a la lògica principal');
  }
}




function toggleList(listID, checkboxID) {
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
}

function handleCheckboxClick(event, checkboxCriteria) {
  // Comprova si l'esdeveniment està associat a una casella de verificació
  if (event.target.type === 'checkbox') {
      // Obté l'etiqueta de la casella de verificació des de l'element pare
      const checkboxLabel = event.target.parentNode.innerText.trim();

      // Verifica si l'etiqueta existeix com a clau a l'objecte checkboxCriteria
      if (checkboxLabel in checkboxCriteria) {
          // Obté la funció de filtre associada a l'etiqueta de la casella de verificació
          const { filterFunction } = checkboxCriteria[checkboxLabel];

          // Accions basades en l'estat de la casella de verificació
          if (event.target.checked) {
              // Si la casella està marcada, filtra l'array matches
              const linesToAdd = matches.filter(filterFunction);

              // Filtra només les línies que encara no estan a matches_provisionals
              const uniqueLinesToAdd = linesToAdd.filter(line => !matches_provisionals.includes(line));

              // Afegeix les línies úniques a matches_provisionals
              matches_provisionals = matches_provisionals.concat(uniqueLinesToAdd);

              // Imprimeix la informació al console
              console.log(`Checkbox "${checkboxLabel}" marcada`);
              console.log('Línies afegides:', uniqueLinesToAdd);
              console.log('Matches provisionals actuals:', matches_provisionals);
          
          } else {
              // Si la casella està desmarcada, elimina les línies corresponents de matches_provisionals
              console.log(`Checkbox "${checkboxLabel}" desclicat`);
              matches_provisionals = matches_provisionals.filter(item => !filterFunction(item));
          }

          matches_provisionals.sort();

          actualitzarRimes();

          console.log(matches);
          console.log(matches_provisionals);
  }   }
}
