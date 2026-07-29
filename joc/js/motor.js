// El motor de la partida: rellotge, validacio i puntuacio.
//
// No toca el DOM: nomes avisa amb els callbacks (alTic, alFinal). Aixi es pot
// provar sol i la pantalla es limita a dibuixar el que li diu.

import { normalitza, semblaParaula } from './normalitza.js';

export const RESULTAT = {
    BUIT: 'buit',
    OBJECTIU: 'objectiu',
    REPETIDA: 'repetida',
    NO_RIMA: 'no-rima',
    ENCERT: 'encert',
};

export class Partida {
    /**
     * @param {object} opcions
     * @param {{normalitzada: string, mostrar: string}} opcions.objectiu
     * @param {Map<string, string>} opcions.respostes  normalitzada -> forma per mostrar
     * @param {number} opcions.segons
     */
    constructor({ objectiu, respostes, segons, alTic, alFinal }) {
        this.objectiu = objectiu;
        this.respostes = respostes;
        // La paraula que s'ha de rimar no val com a resposta.
        this.respostes.delete(objectiu.normalitzada);

        this.segons = segons;
        this.alTic = alTic || (() => {});
        this.alFinal = alFinal || (() => {});

        this.trobades = [];
        this.enviades = new Set();
        this.acabada = false;
        this.instantFinal = 0;
        this.temporitzador = null;
    }

    get punts() {
        return this.trobades.length;
    }

    get rimesPossibles() {
        return this.respostes.size;
    }

    comencar() {
        this.instantFinal = Date.now() + this.segons * 1000;
        this.alTic(this.segonsRestants());
        // Cada 100 ms perque el rellotge no es vegi saltar; el temps de veritat
        // el marca instantFinal, no el nombre de tics.
        this.temporitzador = setInterval(() => {
            const restants = this.segonsRestants();
            this.alTic(restants);
            if (restants <= 0) this.acabar();
        }, 100);
    }

    segonsRestants() {
        return Math.max(0, (this.instantFinal - Date.now()) / 1000);
    }

    /**
     * Prova una paraula. Torna { resultat, mostrar } sense tocar res de fora.
     */
    provar(text) {
        if (this.acabada) return { resultat: RESULTAT.BUIT };

        const normalitzada = normalitza(text);
        if (!normalitzada || !semblaParaula(normalitzada)) {
            return { resultat: RESULTAT.BUIT };
        }
        if (normalitzada === this.objectiu.normalitzada) {
            return { resultat: RESULTAT.OBJECTIU };
        }
        if (this.enviades.has(normalitzada)) {
            return { resultat: RESULTAT.REPETIDA, mostrar: this.mostrarDe(normalitzada) };
        }

        const mostrar = this.respostes.get(normalitzada);
        if (mostrar === undefined) {
            // Les errades no s'apunten: si la torna a provar, tornara a fallar.
            return { resultat: RESULTAT.NO_RIMA };
        }

        this.enviades.add(normalitzada);
        this.trobades.push({ normalitzada, mostrar });
        return { resultat: RESULTAT.ENCERT, mostrar };
    }

    mostrarDe(normalitzada) {
        const trobada = this.trobades.find((paraula) => paraula.normalitzada === normalitzada);
        return trobada ? trobada.mostrar : normalitzada;
    }

    acabar() {
        if (this.acabada) return;
        this.acabada = true;
        clearInterval(this.temporitzador);
        this.temporitzador = null;
        this.alFinal(this.resum());
    }

    /** Deixar-ho corrent (l'usuari se'n va) sense comptar la partida. */
    cancellar() {
        this.acabada = true;
        clearInterval(this.temporitzador);
        this.temporitzador = null;
    }

    resum() {
        return {
            punts: this.punts,
            paraules: this.trobades.map((paraula) => paraula.mostrar),
            objectiu: this.objectiu.mostrar,
            rimesPossibles: this.rimesPossibles,
        };
    }
}

export function formatarTemps(segons) {
    const enters = Math.ceil(segons);
    const minuts = Math.floor(enters / 60);
    return `${minuts}:${String(enters % 60).padStart(2, '0')}`;
}
