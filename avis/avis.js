// =========================================================
// AVÍS PERIÒDIC DE DONATIUS
//
// Ensenya un quadre al mig de la pantalla recordant que el
// Rimador.cat és voluntari. La gràcia és que NO surt sempre: surt
// quan es compleixen alhora dues condicions (vegeu POTMOSTRAR),
// i el text que hi apareix depèn del mes en què som.
//
// Tot passa al navegador de cada visitant. No hi ha servidor,
// ni cap workflow, ni es demana res a ningú: l'únic rastre és
// una clau de localStorage amb quatre xifres.
//
// Aquest fitxer i tot el que necessita (estils, textos i
// documentació) viuen dins la carpeta avis/ i no depenen de la
// resta del codi. L'única cosa que cal des de fora és avisar-lo
// que l'usuari ha fet servir el Rimador.cat:
//
//     if (window.AvisRimador) window.AvisRimador.registraUs();
//
// que és el que fan js/script.js (en acabar una cerca) i
// js/script_llistes.js (en actualitzar una llista).
// =========================================================

(function () {
    'use strict';

    // ---------------------------------------------------------
    // PARÀMETRES
    // Tot el comportament es controla des d'aquestes vuit línies.
    // ---------------------------------------------------------

    // Dies naturals DIFERENTS en què cal haver fet servir el Rimador.cat
    // perquè surti l'avís. Un dia amb quaranta cerques compta 1.


    const DIES_US = 365; //abans 4, posem 365 per evitar que surti

    // Dies naturals mínims des de l'últim avís. És el sostre de
    // freqüència: ningú no el veurà dos cops en menys d'aquest temps.
    
    const DIES_ESPERA = 365; //abans 26, posem 365 per evitar que surti

    // Estona (en mil·lisegons) entre l'acció de l'usuari i l'obertura
    // del quadre. Que no salti damunt d'una cerca que s'acaba de fer.
    const RETARD = 2500;

    // On es desa l'estat i d'on es llegeixen els textos.
    const CLAU = 'rimador_avis';
    const FITXER = 'avis/missatges.json';

    // Enllaç del botó principal. És únic i val per a tots els
    // missatges: el missatges.json només hi posa l'etiqueta.
    const ENLLAC_ACCIO = 'https://ko-fi.com/rimadorcat';

    // Nom del paràmetre d'URL per provar-lo sense esperar (vegeu més avall).
    const PARAM_PROVA = 'avis';

    // ---------------------------------------------------------
    // L'arrel del lloc, deduïda de la URL d'aquest mateix <script>.
    // Mateix truc que js/components.js, però pujant un sol nivell
    // perquè aquest fitxer no viu a dist/js/ sinó a avis/. A
    // rimador.cat dona "/" i al repositori de proves dona
    // "/proves-rimador/".
    // ---------------------------------------------------------
    const ARREL = (function () {
        const jo = document.currentScript;
        if (!jo || !jo.src) return '/';
        return new URL('../', jo.src).pathname;
    })();

    // Un sol avís per càrrega de pàgina, passi el que passi.
    let jaMostrat = false;

    // ---------------------------------------------------------
    // ESTAT
    //
    // Es guarda un únic objecte a localStorage:
    //
    //   diesUsats       dies diferents acumulats des de l'últim avís
    //   ultimDiaComptat perquè un mateix dia no compti dos cops
    //   ultimAvis       marca de temps de l'últim avís (null = mai)
    //   ultimId         quin missatge va ser, per no repetir-lo
    //   copsMostrat     total històric, només informatiu
    //
    // No es desa cap llista de dates ni res que permeti reconstruir
    // quan va entrar ningú: només un comptador.
    // ---------------------------------------------------------

    function estatBuit() {
        return {
            diesUsats: 0,
            ultimDiaComptat: null,
            ultimAvis: null,
            ultimId: null,
            copsMostrat: 0
        };
    }

    // Torna null si localStorage no és accessible (navegació privada
    // d'alguns navegadors, cookies bloquejades...). En aquest cas no
    // podem comptar res i el mòdul es queda quiet per sempre: val més
    // no ensenyar l'avís que ensenyar-lo a cada visita.
    function llegirEstat() {
        try {
            const cru = localStorage.getItem(CLAU);
            if (!cru) return estatBuit();
            const desat = JSON.parse(cru);
            return {
                diesUsats: Number(desat.diesUsats) || 0,
                ultimDiaComptat: typeof desat.ultimDiaComptat === 'string' ? desat.ultimDiaComptat : null,
                ultimAvis: Number(desat.ultimAvis) || null,
                ultimId: typeof desat.ultimId === 'string' ? desat.ultimId : null,
                copsMostrat: Number(desat.copsMostrat) || 0
            };
        } catch (e) {
            return null;
        }
    }

    function desarEstat(estat) {
        try {
            localStorage.setItem(CLAU, JSON.stringify(estat));
        } catch (e) {
            // Sense espai o sense permís. No passa res: com a molt es
            // tornarà a comptar el dia d'avui la propera vegada.
        }
    }

    // La data d'avui en hora LOCAL del dispositiu, en format
    // "2026-08-09". No es fa servir toISOString() perquè aquell va en
    // UTC i, a Catalunya, a partir de les 22 h (o 23 h a l'estiu) ja
    // diria que és demà: un usuari nocturn acumularia dies de més.
    function avui() {
        const ara = new Date();
        const dos = n => String(n).padStart(2, '0');
        return ara.getFullYear() + '-' + dos(ara.getMonth() + 1) + '-' + dos(ara.getDate());
    }

    // ---------------------------------------------------------
    // LES DUES CONDICIONS
    //
    // Han de complir-se totes dues alhora. Els dos comptadors
    // arrenquen de zero al mateix moment (quan es tanca un avís), o
    // sigui que els dies d'ús s'acumulen DURANT l'espera, no després.
    //
    // La primera vegada ultimAvis és null, l'espera surt infinita i
    // per tant només compta la condició dels dies d'ús: l'avís surt
    // exactament el 4t dia diferent. Amb això no cal cap cas especial
    // per al primer cop.
    // ---------------------------------------------------------
    function potMostrar(estat) {
        if (jaMostrat) return false;
        if (estat.diesUsats < DIES_US) return false;
        const diesNaturals = estat.ultimAvis
            ? (Date.now() - estat.ultimAvis) / 86400000
            : Infinity;
        return diesNaturals >= DIES_ESPERA;
    }

    // ---------------------------------------------------------
    // QUIN MISSATGE TOCA
    // ---------------------------------------------------------
    function triarMissatge(dades, estat) {
        const dia = avui();

        // 1. Els extraordinaris manen mentre són dins la seva finestra
        //    de dates. Les cadenes "2026-08-09" es comparen bé lletra a
        //    lletra, o sigui que no cal convertir res a Date.
        const extraordinaris = Array.isArray(dades.extraordinaris) ? dades.extraordinaris : [];
        const extra = extraordinaris.find(m =>
            (!m.des || m.des <= dia) && (!m.fins || dia <= m.fins)
        );
        if (extra) return extra;

        // 2. El del mes en curs.
        const mesos = Array.isArray(dades.mesos) ? dades.mesos : [];
        const mes = new Date().getMonth() + 1;
        let missatge = mesos.find(m => Number(m.mes) === mes);

        // 3. Com que l'espera (26 dies) és més curta que un mes, dos
        //    avisos seguits poden caure dins el mateix mes i repetir
        //    text. Si passa, s'agafa el del mes següent.
        if (missatge && missatge.id && missatge.id === estat.ultimId) {
            const seguent = mesos.find(m => Number(m.mes) === (mes % 12) + 1);
            if (seguent && seguent.id !== estat.ultimId) missatge = seguent;
        }

        // 4. Els mesos que no siguin al fitxer cauen al text genèric.
        return missatge || dades.defecte || null;
    }

    async function carregarMissatges() {
        const resposta = await fetch(ARREL + FITXER, { cache: 'no-cache' });
        if (!resposta.ok) throw new Error('No s\'ha pogut llegir ' + FITXER + ' (' + resposta.status + ')');
        return resposta.json();
    }

    // ---------------------------------------------------------
    // EL QUADRE
    //
    // Mateix patró que el diàleg d'homògrafs de js/script.js: un
    // <dialog> amb showModal(), que ja dona centrat, fons enfosquit,
    // focus atrapat a dins i tecla Esc de franc.
    // ---------------------------------------------------------
    function construirQuadre(missatge, alTancar) {
        const dialeg = document.createElement('dialog');
        dialeg.className = 'avis-dialeg';
        dialeg.setAttribute('aria-labelledby', 'avis-titol');

        const titol = document.createElement('h2');
        titol.id = 'avis-titol';
        titol.textContent = missatge.titol || '';

        const text = document.createElement('p');
        text.className = 'avis-text';
        // El contingut surt d'avis/missatges.json, un fitxer del
        // repositori escrit per nosaltres, no de cap font externa:
        // per això s'hi admet HTML (<br>, <strong>...).
        text.innerHTML = missatge.text || '';

        const botons = document.createElement('div');
        botons.className = 'avis-botons';

        // Botó principal: un <a> de debò, perquè es pugui obrir amb el
        // botó del mig, copiar l'adreça, etc.
        const accio = document.createElement('a');
        accio.className = 'avis-boto-accio';
        accio.textContent = missatge.botoAccio || 'Ajuda\'ns';
        accio.href = ENLLAC_ACCIO;
        accio.target = '_blank';
        accio.rel = 'noopener';
        accio.addEventListener('click', () => alTancar('accio'));

        const araNo = document.createElement('button');
        araNo.type = 'button';
        araNo.className = 'avis-boto-secundari';
        araNo.textContent = missatge.botoTancar || 'Ara no';
        araNo.addEventListener('click', () => alTancar('araNo'));

        botons.appendChild(accio);
        botons.appendChild(araNo);

        // "Ja hi he col·laborat" és, a efectes pràctics, una segona
        // manera de dir que no: tanca el quadre igual que "Ara no" i el
        // cicle continua igual. Hi és perquè qui ja ens ha ajudat tingui
        // una sortida que no li faci sentir que ens deixa penjats.
        const collaborat = document.createElement('button');
        collaborat.type = 'button';
        collaborat.className = 'avis-boto-tercer';
        collaborat.textContent = 'Ja hi he col·laborat';
        collaborat.addEventListener('click', () => alTancar('collaborat'));

        const tanca = document.createElement('button');
        tanca.type = 'button';
        tanca.className = 'avis-tanca';
        tanca.setAttribute('aria-label', 'Tanca l\'avís');
        tanca.textContent = '×';
        tanca.addEventListener('click', () => alTancar('creu'));

        dialeg.appendChild(tanca);
        dialeg.appendChild(titol);
        dialeg.appendChild(text);
        dialeg.appendChild(botons);
        dialeg.appendChild(collaborat);

        // Esc.
        dialeg.addEventListener('cancel', event => {
            event.preventDefault();
            alTancar('esc');
        });

        // Clic al fons fosc. Compte, que event.target és el <dialog>
        // tant si es clica el fons com si es clica el farciment del
        // quadre; si no ho distingíssim, un toc una mica desviat el
        // tancaria. Es comparen les coordenades amb el rectangle.
        dialeg.addEventListener('click', event => {
            if (event.target !== dialeg) return;
            const caixa = dialeg.getBoundingClientRect();
            const aDins = event.clientX >= caixa.left && event.clientX <= caixa.right &&
                          event.clientY >= caixa.top && event.clientY <= caixa.bottom;
            if (!aDins) alTancar('fons');
        });

        return { dialeg, araNo };
    }

    // guardar = false quan l'obrim per provar-lo des de l'URL: es veu
    // igual, però no toca els comptadors de ningú.
    async function mostrar(estat, guardar, mesForcat) {
        if (jaMostrat) return;
        jaMostrat = true;

        let dades;
        try {
            dades = await carregarMissatges();
        } catch (e) {
            // Si el fitxer falla, es calla i prou. Un avís de donatius
            // no pot trencar mai una cerca de rimes.
            jaMostrat = false;
            return;
        }

        let missatge;
        if (mesForcat) {
            const mesos = Array.isArray(dades.mesos) ? dades.mesos : [];
            missatge = mesos.find(m => Number(m.mes) === mesForcat) || dades.defecte;
        } else {
            missatge = triarMissatge(dades, estat);
        }
        if (!missatge) {
            jaMostrat = false;
            return;
        }

        let tancat = false;
        const alTancar = motiu => {
            if (tancat) return;
            tancat = true;

            // Totes les sortides valen igual: la creu, l'Esc, el clic al
            // fons, "Ara no" i "Ja hi he col·laborat" reinicien el cicle
            // exactament de la mateixa manera. El motiu només serveix per
            // saber si cal deixar temps que s'obri l'enllaç.
            if (guardar) {
                estat.diesUsats = 0;
                estat.ultimAvis = Date.now();
                estat.ultimId = missatge.id || null;
                estat.copsMostrat += 1;
                desarEstat(estat);
            }

            // El clic al botó principal ha d'obrir l'enllaç abans que
            // el <dialog> desaparegui de sota el dit.
            const tancaDeVeres = () => {
                if (dialeg.open) dialeg.close();
                dialeg.remove();
            };
            if (motiu === 'accio') setTimeout(tancaDeVeres, 120);
            else tancaDeVeres();
        };

        const { dialeg, araNo } = construirQuadre(missatge, alTancar);
        document.body.appendChild(dialeg);
        dialeg.showModal();

        // El focus va a "Ara no", no al botó de donar: així prémer
        // Enter sense mirar tanca el quadre i no obre cap pestanya.
        araNo.focus();
    }

    // ---------------------------------------------------------
    // API
    // ---------------------------------------------------------

    // Es crida des de fora cada cop que algú fa servir el Rimador.cat de
    // debò (una cerca acabada, una llista actualitzada).
    function registraUs() {
        const estat = llegirEstat();
        if (!estat) return;

        const dia = avui();
        if (estat.ultimDiaComptat !== dia) {
            estat.diesUsats += 1;
            estat.ultimDiaComptat = dia;
            desarEstat(estat);
        }

        if (potMostrar(estat)) {
            setTimeout(() => mostrar(estat, true, null), RETARD);
        }
    }

    // ---------------------------------------------------------
    // PROVES
    //
    //   ?avis=test      obre el quadre ara mateix, amb el text del mes
    //                   en curs, sense tocar cap comptador
    //   ?avis=12        igual, però amb el text del mes que diguis
    //   ?avis=reinicia  esborra l'estat i torna a començar de zero
    //
    // Des de la consola també hi ha window.AvisRimador.mostraAra(),
    // .reinicia() i .estat().
    // ---------------------------------------------------------
    function comprovarParametreDeProva() {
        let valor;
        try {
            valor = new URLSearchParams(window.location.search).get(PARAM_PROVA);
        } catch (e) {
            return;
        }
        if (!valor) return;

        if (valor === 'reinicia') {
            try { localStorage.removeItem(CLAU); } catch (e) {}
            return;
        }

        const mes = Number(valor);
        const mesForcat = mes >= 1 && mes <= 12 ? mes : null;
        mostrar(llegirEstat() || estatBuit(), false, mesForcat);
    }

    window.AvisRimador = {
        registraUs: registraUs,
        // Obre el quadre ara mateix sense tocar res (per provar-lo).
        mostraAra: function (mes) {
            jaMostrat = false;
            return mostrar(llegirEstat() || estatBuit(), false, mes || null);
        },
        // Esborra l'estat: el pròxim cop tornarà a comptar des de zero.
        reinicia: function () {
            try { localStorage.removeItem(CLAU); } catch (e) {}
        },
        // Per mirar per on va el comptador des de la consola.
        estat: llegirEstat
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', comprovarParametreDeProva);
    } else {
        comprovarParametreDeProva();
    }
})();
