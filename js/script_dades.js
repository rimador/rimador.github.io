// Funció d'ajuda per imprimir els rànquings a les llistes de l'HTML
function omplirLlistesHTML(idElement, arrayDades, esRima = false) {
    const contenidor = document.getElementById(idElement);
    contenidor.innerHTML = ''; // Netegem abans d'afegir per seguretat

    arrayDades.forEach(item => {
        const li = document.createElement('li');
        if (esRima) {
            // Netegem el text "r.consonant" a només "consonant" per estètica
            const tipusNet = item.tipus.replace('r.', '');
            li.innerHTML = `<b>${item.paraula}</b> <i>(${tipusNet})</i>: ${item.cerques}`;
        } else {
            li.innerHTML = `<b>${item.paraula}</b>: ${item.cerques}`;
        }
        contenidor.appendChild(li);
    });
}

async function carregarEstadistiques(arxiuJson) {
    const loaderText2 = document.getElementById('loader-text2');
    const loader = document.getElementById('loader');

    try {
        if (loaderText2) loaderText2.textContent = "Descarregant estadístiques (0/2)";

        const resposta = await fetch(arxiuJson);
        if (!resposta.ok) throw new Error(`Error HTTP: ${resposta.status}`);

        if (loaderText2) loaderText2.textContent = "Dibuixant els gràfics (1/2)";

        const dades = await resposta.json();

        // 1. INJECTEM DADES NUMÈRIQUES AÏLLADES
        document.getElementById('data-actualitzacio').textContent = dades.actualitzacio;
        document.getElementById('cerques-setmana').textContent = dades.setmana.total_cerques;
        document.getElementById('usuaris-setmana').textContent = dades.setmana.numero_usuaris;
        document.getElementById('cerques-sempre').textContent = dades.sempre.total_cerques;
        document.getElementById('usuaris-sempre').textContent = dades.sempre.numero_usuaris;
        document.getElementById('assonant-sempre').textContent = dades.sempre.recompte_tipus_rima.assonant;
        document.getElementById('consonant-sempre').textContent = dades.sempre.recompte_tipus_rima.consonant;

        // 2. INJECTEM ELS RÀNQUINGS A LES LLISTES (Les 6 categories)
        omplirLlistesHTML('llista-paraules-setmana', dades.setmana.top_5_paraules, false);
        omplirLlistesHTML('llista-rimes-setmana', dades.setmana.top_5_rimes, true);
        
        omplirLlistesHTML('llista-paraules-sempre', dades.sempre.top_10_paraules, false);
        omplirLlistesHTML('llista-rimes-sempre', dades.sempre.top_10_rimes, true);
        
        omplirLlistesHTML('llista-fenix', dades.sempre.top_5_fenix, false);
        omplirLlistesHTML('llista-typos', dades.sempre.top_5_typos, false);

        // 3. CREEM EL GRÀFIC DE LÍNIA (Correcció de buit)
        const dadesLinia = dades.sempre.grafic_linia_diaria;
        const ctxLinia = document.getElementById('graficLinia').getContext('2d');
        
        new Chart(ctxLinia, {
            type: 'line',
            data: {
                labels: dadesLinia.map(item => item.data),
                datasets: [{
                    label: 'Cerques',
                    data: dadesLinia.map(item => item.cerques),
                    borderColor: '#d30505',
                    backgroundColor: 'rgba(255, 145, 255, 0.55)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permet que no s'esclafi
                scales: {
                    y: {
                        beginAtZero: true, // Força a que comenci en 0 i mostri la línia plana
                        ticks: { stepSize: 1 } // Evita decimals estranys com "0.5 cerques"
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 4. CREEM EL GRÀFIC DE FORMATGE (TOTES LES RIMES)
        const dadesFormatge = dades.sempre.grafic_formatge_exit;
        const ctxFormatge = document.getElementById('graficFormatge').getContext('2d');
        
        // Paleta fixa (els colors del botó de cercar), per no canviar a cada recàrrega
        const PALETA = ['#ff0000', '#ff7300', '#fffb00', '#48ff00', '#00ffd5', '#002bff', '#7a00ff', '#ff00c8'];
        const colorsFormatge = dadesFormatge.map((_, i) => PALETA[i % PALETA.length]);

        new Chart(ctxFormatge, {
            type: 'pie',
            data: {
                labels: dadesFormatge.map(item => item.rima),
                datasets: [{
                    data: dadesFormatge.map(item => item.vegades),
                    backgroundColor: colorsFormatge,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
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

        // Fi de la càrrega
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
