const formatarEntrada = ({ paraula, infinitiu, codi, sil, vicc, viq, diec }) => 
    [paraula, infinitiu, codi, sil, vicc, viq, diec];

function compleixFiltres({ paraula = '', codi = '', sil = '' }, numSeleccionat, comenca, incPropis, incPlurals) {
    const silabes = String(sil);

    if (numSeleccionat && numSeleccionat !== '0' && numSeleccionat !== '5' && silabes !== numSeleccionat) return false;
    if (numSeleccionat === '5' && parseInt(silabes, 10) < 5) return false;

    if (comenca) {
        const esVocalOH = 'haeiou'.includes(paraula.trim().toLowerCase().charAt(0));
        if (comenca === 'vocal+h' && !esVocalOH) return false;
        if (comenca === 'consonant' && esVocalOH) return false;
    }

    if (incPropis === 'no' && codi.startsWith('NP')) return false;

    if (incPlurals === 'no') {
        const c0 = codi[0], c3 = codi[3], c4 = codi[4];
        if ((c4 === 'P' && (c0 === 'D' || c0 === 'A' || c0 === 'P')) || (c3 === 'P' && c0 === 'N')) {
            return false;
        }
    }

    return true;
}

function actualitzarLlista() {
    const getVal = id => {
        const el = document.getElementById(id);
        return el ? el.value : null;
    };

    const numSeleccionat = getVal('numeroSelector');
    const comenca = getVal('categoriaSelector');
    const incPropis = getVal('nomsPropis');
    const incPlurals = getVal('plurals');

    const dadesFiltrades = window.matches_base.filter(entrada =>
        compleixFiltres(entrada, numSeleccionat, comenca, incPropis, incPlurals)
    );

    window.matches = dadesFiltrades.map(formatarEntrada);
    window.matches_provisionals = [...window.matches];
    window.paraulacerca = window.matches.length > 0 ? window.matches[0] : [0, 0, 0, 0, 0, 0, 0];

    if (typeof actualitzarRimes === 'function') actualitzarRimes();
    if (typeof mostrarTotesLesLlistes === 'function') mostrarTotesLesLlistes();
}

let VERSIO_ACTUAL = "v.1";

async function carregarVersionsLlistes(clauVersio) {
    try {
        const resposta = await fetch(`versions_llistes.json?t=${Date.now()}`);
        const dades = await resposta.json();
        VERSIO_ACTUAL = `v.${dades[clauVersio] || '1'}`;
        console.log("Versions carregades correctament:", dades);
    } catch (err) {
        console.error("Error carregant versions_llistes.json, utilitzant valors per defecte", err);
        VERSIO_ACTUAL = "v.1";
    }
}

async function carregarDades(arxiuJson, clauVersio) {
    const loaderText2 = document.getElementById('loader-text2');
    if (loaderText2) loaderText2.textContent = "Carregant fitxer (0/1)";

    try {
        await carregarVersionsLlistes(clauVersio);

        const resParaules = await fetch(`${arxiuJson}?v=${VERSIO_ACTUAL}`);
        if (!resParaules.ok) throw new Error(`Error HTTP: ${resParaules.status}`);

        if (loaderText2) loaderText2.textContent = "Carregant fitxer (1/1)";

        const dades = await resParaules.json();
        window.matches_base = dades;

        actualitzarLlista();

        const btnActualitza = document.getElementById('actualitzaButton');
        if (btnActualitza) btnActualitza.addEventListener('click', actualitzarLlista);

        document.querySelectorAll('.clickable-checkbox').forEach(cb => cb.checked = true);
        
        if (typeof mostrarTotesLesLlistes === 'function') mostrarTotesLesLlistes();
        
        const divImpressio = document.querySelector('.impressio');
        if (divImpressio) divImpressio.style.display = 'flex';
        
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';

    } catch (error) {
        console.error(error);
        const textNombre = document.getElementById('nombre');
        if (textNombre) textNombre.textContent = `Error carregant les dades de ${arxiuJson}`;
        
        const rimaEnllac = document.getElementById('rima_enllac');
        if (rimaEnllac) rimaEnllac.innerHTML = `<ul><li>No s'ha pogut llegir el fitxer ${arxiuJson}.</li></ul>`;
        
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tipusLlista = document.body.dataset.llista;

    if (tipusLlista === 'fenixs') {
        carregarDades('paraules_fenixs.json', 'versio_fenix');
// ======= canviar aquí baix
    } else if (tipusLlista === 'mots_de7') {
        carregarDades('mots_de7.json', 'versio_hepta');
    } else {
        console.warn('Tipus de llista desconegut o no definit al data-llista de l\'etiqueta body.');
    }
});