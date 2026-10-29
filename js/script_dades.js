// Quins dialectes hi ha i com es diuen. Surt de la llista DIALECTES de
// js/components.js, la mateixa que pinta la tira de pastilles i de la qual
// també beu el js/script.js: així el nom de cada dialecte és escrit en un sol
// lloc. El fallback és per si algun dia aquesta pàgina es carregués sense el
// components.js: val més ensenyar el codi pelat que no pas petar.
//
// L'ordre és el de la tira, i és el que fan servir la barra de dialectes i els
// codis del top de rimes.
const ORDRE_DIALECTES = (typeof DIALECTES !== 'undefined') ? DIALECTES.map(d => d.codi) : ['ca'];

// Com es diu un dialecte, sense l'asterisc, que a la pastilla vol dir
// "transcripció encara per repassar" (vegeu dialectes.html) i aquí no diria
// res. És el germà del nomDelDialecte() de js/script.js, que el vol en
// minúscula perquè el fica dins d'una frase; aquí va a llegendes i a títols
// emergents i s'hi vol tal com s'escriu.
function nomDeDialecte(codi) {
    const trobat = (typeof DIALECTES !== 'undefined') ? DIALECTES.find(d => d.codi === codi) : null;
    return trobat ? trobat.nom.replace('*', '').trim() : codi;
}

function pintarFiltresHTML(dadesSempre) {
    const contenidor = document.getElementById('contenidor-filtres');
    if (!contenidor) return;
    contenidor.innerHTML = '';

    const filtres = [
        // El dialecte encapçala la llista perquè al web també és el primer que
        // es tria: la tira va damunt del cercador. Mentre les cerques
        // registrades no en duguin cap (vegeu recompte_dialecte a
        // stats/stats.py), aquesta barra no es pinta.
        { id: 'recompte_dialecte', titol: 'Dialecte' },
        { id: 'recompte_num_sil', titol: 'Filtre de síl·labes' },
        { id: 'recompte_comenca_per', titol: 'Comença per...' },
        { id: 'recompte_incloure_np', titol: 'Incloure noms propis?' },
        { id: 'recompte_incloure_pl', titol: 'Incloure plurals?' }
    ];

    const nomsTraduïts = {
        '0': 'Indiferent', '1': '1s', '2': '2s', '3': '3s',
        '4': '4s', '5': '5s', '6': '6+',
        'indiferent': 'qualsevol lletra', 'consonant': 'consonant', 'vocal+h': 'vocal / h',
        'si': 'Sí', 'no': 'No'
    };

    // Els filtres que van en un ordre seu i no pas de més usat a menys usat:
    // les síl·labes perquè 1, 2, 3... és com es llegeix, i els dialectes perquè
    // és l'ordre de la tira de pastilles. Els que no hi són s'ordenen per pes.
    // Una opció que no surti a la llista se'n va al davant (indexOf torna -1),
    // que és justament on volem l'"Indiferent" de les síl·labes.
    const ordres = {
        recompte_num_sil: ['1', '2', '3', '4', '5', '6'],
        recompte_dialecte: ORDRE_DIALECTES
    };

    const temaSober = document.documentElement.getAttribute('data-theme') === 'sober' || document.body.getAttribute('data-theme') === 'sober';
    
    const paletaColors = temaSober 
        ? ['#4d4d4d', '#737373', '#999999', '#bfbfbf', '#d9d9d9', '#8c8c8c', '#e6e6e6']
        : ['#FF91FF', '#00ffff', '#ffe680', '#b3ffb3', '#ffb3b3', '#d9b3ff', '#ffc266']; 

    filtres.forEach(filtre => {
        const dadesFiltre = dadesSempre[filtre.id];
        if (!dadesFiltre) return;

        let totalFiltre = 0;
        let entrades = [];

        for (const [opcio, vegades] of Object.entries(dadesFiltre)) {
            if (opcio !== 'nan' && opcio !== 'None') {
                totalFiltre += vegades;
                entrades.push({ opcio, vegades });
            }
        }

        if (totalFiltre === 0) return;

        const ordreFixat = ordres[filtre.id];
        if (ordreFixat) {
            entrades.sort((a, b) => ordreFixat.indexOf(a.opcio) - ordreFixat.indexOf(b.opcio));
        } else {
            entrades.sort((a, b) => b.vegades - a.vegades);
        }

        const divCategoria = document.createElement('div');
        divCategoria.className = 'filtre-categoria';

        const titolElement = document.createElement('h4');
        titolElement.textContent = filtre.titol;
        divCategoria.appendChild(titolElement);

        const barraApilada = document.createElement('div');
        barraApilada.className = 'barra-apilada';

        const llegenda = document.createElement('div');
        llegenda.className = 'llegenda-filtre';

        entrades.forEach((item, index) => {
            const percentatge = ((item.vegades / totalFiltre) * 100).toFixed(1);
            const nomMostrar = filtre.id === 'recompte_dialecte'
                ? nomDeDialecte(item.opcio)
                : (nomsTraduïts[item.opcio] || item.opcio);
            const colorTros = paletaColors[index % paletaColors.length];

            const segment = document.createElement('div');
            segment.className = 'segment-barra';
            segment.style.width = `${percentatge}%`;
            segment.style.backgroundColor = colorTros;
            segment.title = `${nomMostrar}: ${percentatge}%`;
            // es pinta sempre, l'amaga depurarPercentatges() si no hi cap
            segment.innerHTML = `<span>${percentatge}%</span>`;

            barraApilada.appendChild(segment);

            const itemLlegenda = document.createElement('div');
            itemLlegenda.className = 'item-llegenda';
            itemLlegenda.style.width = `${percentatge}%`;
            itemLlegenda.dataset.pes = percentatge;

            itemLlegenda.innerHTML = `
                <div class="color-box" style="background-color: ${colorTros}"></div>
                <span>${nomMostrar}</span>
            `;
            llegenda.appendChild(itemLlegenda);
        });

        divCategoria.appendChild(barraApilada);
        divCategoria.appendChild(llegenda);
        contenidor.appendChild(divCategoria);
    });

    ajustarEtiquetesFiltres();
}

function ajustarEtiquetesFiltres() {
    depurarPercentatges();
    depurarLlegendes();
}

function depurarPercentatges() {
    const RESPIR = 6; 

    document.querySelectorAll('#contenidor-filtres .segment-barra').forEach(segment => {
        const text = segment.querySelector('span');
        if (!text) return;

        text.classList.remove('text-segment-amagat');

        const ampladaText = text.getBoundingClientRect().width;
        const ampladaSegment = segment.getBoundingClientRect().width;

        if (ampladaText + RESPIR > ampladaSegment) {
            text.classList.add('text-segment-amagat');
        }
    });
}

function depurarLlegendes() {
    const SEPARACIO_MINIMA = 4; 

    document.querySelectorAll('#contenidor-filtres .llegenda-filtre').forEach(llegenda => {
        const items = Array.from(llegenda.querySelectorAll('.item-llegenda'));
        items.forEach(item => item.classList.remove('item-llegenda-amagat'));

        const ocupats = [];

        items
            .sort((a, b) => parseFloat(b.dataset.pes) - parseFloat(a.dataset.pes))
            .forEach(item => {
                const text = item.querySelector('span').getBoundingClientRect();

                const xoca = ocupats.some(altre =>
                    text.left < altre.right + SEPARACIO_MINIMA &&
                    text.right + SEPARACIO_MINIMA > altre.left
                );

                if (xoca) {
                    item.classList.add('item-llegenda-amagat');
                } else {
                    ocupats.push(text);
                }
            });
    });
}

function omplirLlistesHTML(idElement, arrayDades, esRima = false) {
    const contenidor = document.getElementById(idElement);
    if (!contenidor) return;
    contenidor.innerHTML = '';

    if (!Array.isArray(arrayDades)) {
        console.warn(`[dades] no hi ha dades per a "${idElement}"`);
        return;
    }

    arrayDades.forEach(item => {
        const li = document.createElement('li');
        const negreta = document.createElement('b');
        negreta.textContent = item.paraula;
        li.appendChild(negreta);
        if (esRima) {
            // Les rimes s'escriuen en transcripció fonètica (aðə, esək):
            // les dibuixem senceres amb la font que té l'AFI, si no la
            // 'a' i la 'ð' surten amb tipografies diferents.
            negreta.className = 'transcripcio';

            const tipusNet = String(item.tipus).replace('r.', '');
            li.appendChild(document.createTextNode(` (${tipusNet})`));
        }

        // Tots els tops duen el recompte. Es mira si hi és i no s'hi dona per
        // fet: el d'errors abans era una llista de les últimes cerques, sense
        // número, i un JSON d'abans del canvi hi escriuria ": undefined".
        if (item.cerques !== undefined) {
            li.appendChild(document.createTextNode(`: ${item.cerques}`));
        }
        // D'on venien les cerques que s'han comptat. Ho duen el top de rimes i
        // el de nàufragues; els altres dos no porten el camp i aquí no hi surt
        // res (vegeu amb_dialectes a stats/stats.py). No es mira l'esRima, sinó
        // si les dades ho porten: qui mana què duu codis és el guió que fa el
        // JSON, no pas aquesta funció.
        //
        // A les rimes, una mateixa terminació pot venir de més d'un dialecte
        // (la de "camí" rima igual es parli com es parli); a les nàufragues,
        // una mateixa paraula pot no rimar en més d'un. En tots dos casos el
        // número del costat les compta totes plegades, o sigui que cal dir-ho.
        //
        // Hi van els codis i no els noms sencers a posta: "Nord-occidental,
        // Valencià" fa més ratlla que la rima i el recompte junts i faria
        // saltar de línia la meitat del top. El nom sencer és al títol
        // emergent, per a qui no sàpiga què vol dir "nw".
        //
        // I separats per comes i no pas per punts volats: amb els quatre
        // dialectes, els punts s'enduien la línia a la de sota en una pantalla
        // estreta (mesurat a 360 px, amb una rima llarga i un recompte de tres
        // xifres), i amb comes hi cap.
        //
        // Sense dialectes (que és el cas mentre les cerques registrades no en
        // duguin cap) no s'hi posa res: val més la línia neta que un parèntesi
        // buit.
        const codis = Array.isArray(item.dialectes) ? item.dialectes : [];
        if (codis.length > 0) {
            const marca = document.createElement('span');
            marca.className = 'codis-de-dialecte';
            marca.textContent = codis.join(', ');
            marca.title = codis.map(nomDeDialecte).join(', ');
            li.appendChild(marca);
        }

        contenidor.appendChild(li);
    });
}

function omplirPodiHTML(idElement, arrayDades, etiqueta) {
    const contenidor = document.getElementById(idElement);
    if (!contenidor) return;
    contenidor.innerHTML = '';

    if (!Array.isArray(arrayDades)) return;

    contenidor.classList.add('podi-graella');

    // Dos dies amb la mateixa xifra es reparteixen la mateixa medalla: qui
    // empata amb el de sobre es queda amb el seu número i el seu bloc (or, or,
    // bronze), però sense moure's del lloc que li toca a la graella. Dins d'un
    // empat, l'ordre ja ve donat de les dades: primer el dia més recent.
    let medalla = 0;
    let totalAnterior = null;

    arrayDades.forEach((item, index) => {
        const lloc = index + 1;

        if (item.total !== totalAnterior) {
            medalla = lloc;
            totalAnterior = item.total;
        }

        const li = document.createElement('li');
        // podi-lloc-N diu on va la columna; podi-medalla-N, quin bloc li toca
        li.className = `podi-lloc podi-lloc-${lloc} podi-medalla-${medalla}`;
        li.title = `${item.data}: ${item.total} ${etiqueta}`;

        li.innerHTML = `
            <div class="podi-placa">
                <span class="podi-xifra">${item.total}</span>
                <span class="podi-data">${item.data}</span>
            </div>
            <div class="podi-bloc"><span class="podi-numero">${medalla}</span></div>
        `;
        contenidor.appendChild(li);
    });
}

function colorsGraficLinia(temaSober) {
    return {
        cerques: {
            linia: temaSober ? '#aa0000' : '#d30505',
            fons: temaSober ? 'rgba(170, 0, 0, 0.2)' : 'rgba(255, 145, 255, 0.55)'
        },
        usuaris: {
            linia: temaSober ? '#555555' : '#0055ff',
            fons: temaSober ? 'rgba(85, 85, 85, 0.2)' : 'rgba(0, 85, 255, 0.2)'
        }
    };
}

function calcularMitjanesDiaries(dadesLinia) {
    // La mitjana és la del que es veu dibuixat: tots els dies de la finestra,
    // hi hagi hagut cerques o no. Els dies a zero també hi compten.
    if (dadesLinia.length === 0) return { cerques: 0, usuaris: 0, dies: 0 };

    const mitjana = clau => dadesLinia.reduce((suma, item) => suma + item[clau], 0) / dadesLinia.length;

    return { cerques: mitjana('cerques'), usuaris: mitjana('usuaris'), dies: dadesLinia.length };
}

function formatarMitjana(valor) {
    return valor.toFixed(1).replace('.', ',');
}

// Gestió de versions igual que el diccionari i les llistes (vegeu
// carregarVersions a js/script.js i carregarVersionsLlistes a
// js/script_llistes.js): un resum sha256 del contingut, fusionat a
// VERSIONS_FITXERS perquè és la variable que fa servir
// llegirFitxerAmbIndexedDB per saber si la còpia guardada a IndexedDB
// encara val.
async function carregarVersionsStats() {
    try {
        const resposta = await fetch(`${ARREL}stats/versions_stats.json?t=${Date.now()}`);
        const dades = await resposta.json();
        if (!dades.fitxers) throw new Error("versions_stats.json no porta la llista de fitxers");

        Object.assign(VERSIONS_FITXERS, dades.fitxers);
        console.log("Versions de les estadístiques carregades correctament:", dades.fitxers);
    } catch (err) {
        console.error("Error carregant versions_stats.json: les estadístiques es baixaran sense memòria cau", err);
    }
}

async function carregarEstadistiques(arxiuJson) {
    const loaderText2 = document.getElementById('loader-text2');
    const loader = document.getElementById('loader');

    try {
        if (loaderText2) loaderText2.textContent = "Descarregant estadístiques (0/2)";

        await carregarVersionsStats();

        if (loaderText2) loaderText2.textContent = "Dibuixant els gràfics (1/2)";

        const dades = await llegirFitxerAmbIndexedDB(`${ARREL}${arxiuJson}`, JSON.parse);

        document.getElementById('data-actualitzacio').textContent = dades.actualitzacio;
        document.getElementById('rang-setmana').textContent = "(" + dades.setmana.text_dies + ")";
        document.getElementById('paraules_uniques_setmana').textContent = dades.setmana.paraules_cercades_uniques;
        document.getElementById('cerques-setmana').textContent = dades.setmana.total_cerques;
        document.getElementById('usuaris-setmana').textContent = dades.setmana.numero_usuaris;
        document.getElementById('paraules_uniques_sempre').textContent = dades.sempre.paraules_cercades_uniques;
        document.getElementById('cerques-totals').textContent = dades.sempre.total_cerques;
        document.getElementById('usuaris-sempre').textContent = dades.sempre.numero_usuaris;
        document.getElementById('assonant-sempre').textContent = dades.sempre.recompte_tipus_rima['r.assonant'];
        document.getElementById('consonant-sempre').textContent = dades.sempre.recompte_tipus_rima['r.consonant'];
        document.getElementById('noms-propis-sempre').textContent = dades.sempre.total_noms_propis;

        window.dadesSempre = dades.sempre; 
        pintarFiltresHTML(dades.sempre);
        
        omplirLlistesHTML('llista-paraules-setmana', dades.setmana.top_10_paraules, false);
        omplirLlistesHTML('llista-rimes-setmana', dades.setmana.top_10_rimes, true);
        
        omplirLlistesHTML('llista-paraules-sempre', dades.sempre.top_10_paraules, false);
        omplirLlistesHTML('llista-rimes-sempre', dades.sempre.top_10_rimes, true);
        
        omplirLlistesHTML('llista-naufragues', dades.sempre.top_10_naufragues, false);
        omplirLlistesHTML('llista-typos', dades.sempre.top_10_typos, false);
        
        if (dades.sempre.top_dies) {
            omplirPodiHTML('podi-cerques', dades.sempre.top_dies.top_cerques, 'cerques');
            omplirPodiHTML('podi-usuaris', dades.sempre.top_dies.top_usuaris, 'usuaris');
            omplirPodiHTML('anti-podi-cerques', dades.sempre.top_dies.anti_top_cerques, 'cerques');
            omplirPodiHTML('anti-podi-usuaris', dades.sempre.top_dies.anti_top_usuaris, 'usuaris');
        }

        // Les etiquetes dels gràfics de formatge també són rimes en
        // transcripció fonètica, i els gràfics es dibuixen en un canvas,
        // on el CSS no hi arriba: li hem de dir a Chart.js quina font ha
        // de fer servir.
        if (window.Chart) {
            Chart.defaults.font.family = getComputedStyle(document.documentElement)
                .getPropertyValue('--font-transcripcio').trim();
        }

        const temaSober = document.documentElement.getAttribute('data-theme') === 'sober' || document.body.getAttribute('data-theme') === 'sober';
        const dadesLinia = dades.grafics.grafic_linia_diaria;
        const colorsLinia = colorsGraficLinia(temaSober);
        const mitjanes = calcularMitjanesDiaries(dadesLinia);
        const ctxLinia = document.getElementById('graficLinia').getContext('2d');

        document.getElementById('mitjana-cerques').textContent = formatarMitjana(mitjanes.cerques);
        document.getElementById('mitjana-usuaris').textContent = formatarMitjana(mitjanes.usuaris);

        window.graficLiniaObj = new Chart(ctxLinia, {
            type: 'line',
            data: {
                labels: dadesLinia.map(item => item.data),
                datasets: [{
                    label: 'Cerques',
                    data: dadesLinia.map(item => item.cerques),
                    borderColor: colorsLinia.cerques.linia,
                    backgroundColor: colorsLinia.cerques.fons,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Usuaris únics',
                    data: dadesLinia.map(item => item.usuaris),
                    borderColor: colorsLinia.usuaris.linia,
                    backgroundColor: colorsLinia.usuaris.fons,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                },
                // Les mitjanes són ratlles horitzontals: Chart.js no en fa sense
                // el plugin d'anotacions, o sigui que les dibuixem com un dataset
                // més amb el mateix valor a tots els dies i sense punts.
                {
                    label: 'Mitjana de cerques',
                    data: dadesLinia.map(() => mitjanes.cerques),
                    borderColor: colorsLinia.cerques.linia,
                    backgroundColor: colorsLinia.cerques.linia,
                    borderWidth: 2,
                    borderDash: [6, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    esMitjana: true
                },
                {
                    label: 'Mitjana d\'usuaris únics',
                    data: dadesLinia.map(() => mitjanes.usuaris),
                    borderColor: colorsLinia.usuaris.linia,
                    backgroundColor: colorsLinia.usuaris.linia,
                    borderWidth: 2,
                    borderDash: [6, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    esMitjana: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            callback: function(val, index) {
                                const etiqueta = this.getLabelForValue(val);
                                if (window.innerWidth < 800) {
                                    return etiqueta.endsWith(':00') ? etiqueta : '';
                                }
                                return etiqueta;
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    // Les mitjanes no van a la llegenda: ja tenen el seu peu de
                    // text a sobre del gràfic, amb el color i tot, i posar-les
                    // aquí fa créixer la llegenda fins a menjar-se l'alçada del
                    // dibuix (al mòbil, sobretot).
                    legend: {
                        display: true,
                        labels: { filter: item => !item.text.startsWith('Mitjana') }
                    },
                    // La mitjana val el mateix tots els dies i ja surt escrita
                    // sobre el gràfic: al tooltip només faria nosa.
                    tooltip: { filter: context => !context.dataset.esMitjana }
                }
            }
        });

        // GRÀFIC PER HORES
        const dadesHores = dades.grafics.grafic_linia_hores;
        const ctxHores = document.getElementById('graficHores').getContext('2d');

        window.graficHoresObj = new Chart(ctxHores, {
            type: 'line',
            data: {
                labels: dadesHores.map(item => item.hora), // L'eix de sota: "00:00", "01:00"...
                datasets: [{
                    label: 'Percentatge de cerques',
                    data: dadesHores.map(item => item.percentatge), // L'eix vertical (0 a 100)
                    borderColor: colorsLinia.cerques.linia, // L'identic color vermell de la línia diària
                    backgroundColor: colorsLinia.cerques.fons, // L'identic fons rosa semi-transparent                    
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        // Afegim el símbol % als números de l'eix vertical
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Amaguem la llegenda si només hi ha una línia
                    },
                    tooltip: {
                        callbacks: {
                            // Que al posar-hi el ratolí a sobre digui "X%" i no només el número
                            label: function(context) {
                                return ` ${context.raw}% de les cerques`;
                            }
                        }
                    }
                }
            }
        });

        
        const PALETA = temaSober 
            ? ['#222222', '#4d4d4d', '#737373', '#999999', '#bfbfbf', '#aa0000', '#800000', '#555555'] 
            : ['#ff0000', '#ff7300', '#fffb00', '#48ff00', '#00ffd5', '#002bff', '#7a00ff', '#ff00c8'];

        //agrupar dades petites
        function agruparMenors(dadesArray) {
            const total = dadesArray.reduce((suma, item) => suma + item.vegades, 0);
            const resultat = [];
            let altres = 0;

            dadesArray.forEach(item => {
                const percentatge = (item.vegades / total) * 100;
                if (percentatge < 0.5) {
                    altres += item.vegades;
                } else {
                    resultat.push(item);
                }
            });

            resultat.sort((a, b) => b.vegades - a.vegades);

            if (altres > 0) {
                resultat.push({ rima: 'Altres', vegades: altres });
            }
            return resultat;
        }


        const dadesFormatgeAss = agruparMenors(dades.grafics.grafic_formatge_exit_assonant);
        const dadesFormatgeCons = agruparMenors(dades.grafics.grafic_formatge_exit_consonant);

        window.dadesFormatgeAss = dadesFormatgeAss; 
        window.dadesFormatgeCons = dadesFormatgeCons;

        //gràfic assonant
        const ctxFormatgeAss = document.getElementById('graficFormatgeASS').getContext('2d');
        const colorsFormatgeAss = dadesFormatgeAss.map((item, i) => 
                    item.rima === 'Altres' ? '#aeaeae' : PALETA[i % PALETA.length]
        );
        window.graficFormatgeAssObj = new Chart(ctxFormatgeAss, {
            type: 'pie',
            data: {
                labels: dadesFormatgeAss.map(item => item.rima),
                datasets: [{
                    data: dadesFormatgeAss.map(item => item.vegades),
                    backgroundColor: colorsFormatgeAss,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let valor = context.raw || 0;
                                return ` ${valor} cerques`;
                            }
                        }
                    }
                }
            }
        });

        //gràfic consonant
        const ctxFormatgeCons = document.getElementById('graficFormatgeCONS').getContext('2d');
        const colorsFormatgeCons = dadesFormatgeCons.map((item, i) => 
                    item.rima === 'Altres' ? '#aeaeae' : PALETA[i % PALETA.length]
        );

        window.graficFormatgeConsObj = new Chart(ctxFormatgeCons, { 
            type: 'pie',
            data: {
                labels: dadesFormatgeCons.map(item => item.rima),
                datasets: [{
                    data: dadesFormatgeCons.map(item => item.vegades),
                    backgroundColor: colorsFormatgeCons,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let valor = context.raw || 0;
                                return ` ${valor} cerques`;
                            }
                        }
                    }
                }
            }
        });

        setTimeout(() => {
            if (loader) loader.style.display = 'none';
        }, 300);

    } catch (error) {
        console.error(error);
        if (loaderText2) loaderText2.textContent = "ERROR REAL: " + error.message;
        setTimeout(() => {
            if (loader) loader.style.display = 'none';
        }, 5000); 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.id === 'dades') {
        carregarEstadistiques('stats/estadistiques_rimador.json');
    }
});


let temporitzadorEtiquetes;
window.addEventListener('resize', () => {
    clearTimeout(temporitzadorEtiquetes);
    temporitzadorEtiquetes = setTimeout(ajustarEtiquetesFiltres, 150);
});

function actualitzarColorsGrafics() {
    const temaSober = document.documentElement.getAttribute('data-theme') === 'sober' || document.body.getAttribute('data-theme') === 'sober';
    
    if (window.dadesSempre) {
        pintarFiltresHTML(window.dadesSempre);
    }

    if (window.graficLiniaObj) {
        const colorsLinia = colorsGraficLinia(temaSober);
        const datasets = window.graficLiniaObj.data.datasets;

        datasets[0].borderColor = colorsLinia.cerques.linia;
        datasets[0].backgroundColor = colorsLinia.cerques.fons;

        datasets[1].borderColor = colorsLinia.usuaris.linia;
        datasets[1].backgroundColor = colorsLinia.usuaris.fons;

        // Les mitjanes van del color de la seva línia, farcit inclòs: així el
        // quadradet de la llegenda no queda de l'altre color.
        if (datasets[2]) {
            datasets[2].borderColor = colorsLinia.cerques.linia;
            datasets[2].backgroundColor = colorsLinia.cerques.linia;
        }

        if (datasets[3]) {
            datasets[3].borderColor = colorsLinia.usuaris.linia;
            datasets[3].backgroundColor = colorsLinia.usuaris.linia;
        }

        window.graficLiniaObj.update();

        if (window.graficHoresObj) {
        window.graficHoresObj.data.datasets[0].borderColor = colorsLinia.cerques.linia;
        window.graficHoresObj.data.datasets[0].backgroundColor = colorsLinia.cerques.fons;
        window.graficHoresObj.update();
    }
    }

    const PALETA = temaSober 
        ? ['#222222', '#4d4d4d', '#737373', '#999999', '#bfbfbf', '#aa0000', '#800000', '#555555'] 
        : ['#ff0000', '#ff7300', '#fffb00', '#48ff00', '#00ffd5', '#002bff', '#7a00ff', '#ff00c8'];

    if (window.graficFormatgeAssObj && window.dadesFormatgeAss) {
        window.graficFormatgeAssObj.data.datasets[0].backgroundColor = window.dadesFormatgeAss.map((item, i) => 
            item.rima === 'Altres' ? (temaSober ? '#e6e4e5' : '#aeaeae') : PALETA[i % PALETA.length]
        );
        window.graficFormatgeAssObj.update();
    }

    if (window.graficFormatgeConsObj && window.dadesFormatgeCons) {
        window.graficFormatgeConsObj.data.datasets[0].backgroundColor = window.dadesFormatgeCons.map((item, i) => 
            item.rima === 'Altres' ? (temaSober ? '#e6e4e5' : '#aeaeae') : PALETA[i % PALETA.length]
        );
        window.graficFormatgeConsObj.update();
    }
}