const formatarEntrada = ({ paraula, infinitiu, codi, sil, vicc, viq, diec }) => 
    [paraula, infinitiu, codi, sil, vicc, viq, diec];

function compleixFiltresFenixs({ paraula = '', codi = '', sil = '' }, numSeleccionat, comenca, incPropis, incPlurals) {
    const silabes = String(sil);

    if (numSeleccionat !== '0' && numSeleccionat !== '5' && silabes !== numSeleccionat) return false;
    if (numSeleccionat === '5' && parseInt(silabes, 10) < 5) return false;

    const esVocalOH = 'haeiou'.includes(paraula.trim().toLowerCase().charAt(0));
    if (comenca === 'vocal+h' && !esVocalOH) return false;
    if (comenca === 'consonant' && esVocalOH) return false;

    if (incPropis === 'no' && codi.startsWith('NP')) return false;

    if (incPlurals === 'no') {
        const c0 = codi[0], c3 = codi[3], c4 = codi[4];
        if ((c4 === 'P' && (c0 === 'D' || c0 === 'A' || c0 === 'P')) || (c3 === 'P' && c0 === 'N')) {
            return false;
        }
    }

    return true;
}

function actualitzarLlistaFenixs() {
    const getVal = id => document.getElementById(id).value;
    const numSeleccionat = getVal('numeroSelector');
    const comenca = getVal('categoriaSelector');
    const incPropis = getVal('nomsPropis');
    const incPlurals = getVal('plurals');

    const dadesFiltrades = window.matches_base.filter(entrada =>
        compleixFiltresFenixs(entrada, numSeleccionat, comenca, incPropis, incPlurals)
    );

    window.matches = dadesFiltrades.map(formatarEntrada);
    window.matches_provisionals = [...window.matches];
    window.paraulacerca = window.matches.length > 0 ? window.matches[0] : [0, 0, 0, 0, 0, 0, 0];

    actualitzarRimes();
    mostrarTotesLesLlistes();
}

let VERSIO_FENIX = "v.1";

async function carregarVersionsLlistes() {
    try {
        const resposta = await fetch(`versions_llistes.json?t=${Date.now()}`);
        const dades = await resposta.json();
        VERSIO_FENIX = `v.${dades.versio_fenix}`;
        console.log("Versions carregades correctament:", dades);
    } catch (err) {
        console.error("Error carregant versions_llistes.json, utilitzant valors per defecte", err);
        VERSIO_FENIX = "v.1";
    }
}

async function carregarLlistaFenixs() {
    const loaderText2 = document.getElementById('loader-text2');
    if (loaderText2) loaderText2.textContent = "Carregant fitxer (0/1)";

    try {
        await carregarVersionsLlistes();

        const resParaules = await fetch(`paraules_fenixs.json?v=${VERSIO_FENIX}`);
        if (!resParaules.ok) throw new Error(`Error HTTP: ${resParaules.status}`);

        if (loaderText2) loaderText2.textContent = "Carregant fitxer (1/1)";

        const dades = await resParaules.json();

        window.matches_base = dades;

        actualitzarLlistaFenixs();

        document.getElementById('actualitzaButton')?.addEventListener('click', actualitzarLlistaFenixs);

        document.querySelectorAll('.clickable-checkbox').forEach(cb => cb.checked = true);
        
        mostrarTotesLesLlistes();
        document.querySelector('.impressio').style.display = 'flex';
        document.getElementById('loader').style.display = 'none';

    } catch (error) {
        console.error(error);
        document.getElementById('nombre').textContent = 'Error carregant les paraules fènixs';
        document.getElementById('rima_enllac').innerHTML = '<ul><li>No s\'ha pogut llegir el JSON.</li></ul>';
        document.getElementById('loader').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', carregarLlistaFenixs);