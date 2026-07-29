// Normalitzacio de paraules.
//
// El joc no ha de castigar ningu per no saber on va l'accent: "cami" ha de valer
// per "camí" i "forca" per "força". Totes les comparacions (validar respostes i
// detectar repeticions) es fan sobre la forma normalitzada.
//
// IMPORTANT: aixo ha de coincidir exactament amb normalitzar() de
// joc/eines/generar_dades.py, que es qui prepara les claus dels fitxers de rimes.

const DIACRITICS = /[̀-ͯ]/g;   // inclou la cedilla, o sigui que ç -> c
const APOSTROF_TIPOGRAFIC = /’/g;
const PUNT_VOLAT = /·/g;            // el de la l·l

export function normalitza(text) {
    return String(text)
        .trim()
        .toLowerCase()
        .replace(APOSTROF_TIPOGRAFIC, "'")
        .replace(PUNT_VOLAT, '')
        .normalize('NFD')
        .replace(DIACRITICS, '');
}

// Lletres, amb guionets o apostrofs enmig com a molt ("adeu-siau", "d'acord").
export function semblaParaula(normalitzada) {
    return /^[a-z]+(?:[-'][a-z]+)*$/.test(normalitzada);
}
