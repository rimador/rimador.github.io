# Baner de dies concrets

Cada dia que triïs, un quadre al mig de la pantalla (igual que el de "nova
actualització") a totes les pàgines, també el joc, amb el missatge que vulguis.
Si el visitant el tanca, no el veu durant 10 hores; passat aquest temps, si encara és
un dels dies del baner, torna a sortir (i cada cop que el tanqui, el mateix). Té el codi a `js/baner-dies.js`; això és només el contingut.

Els textos i els dies són a `baner/dies.json`. Es llegeix en temps real: canviar-lo
i desplegar és suficient, no cal recompilar res.

## Format

```json
{
  "banners": [
    {
      "id": "sant-jordi",
      "dies": ["04-23"],
      "titol": "Bon Sant Jordi!",
      "text": "Que els teus versos floreixin tant com les roses d'avui.",
      "enllac": { "text": "Juga al Joc del Rimar", "url": "joc/" }
    }
  ]
}
```

- `id` (obligatori): nom curt i únic, sense espais. Serveix per recordar què ha tancat cadascú.
- `dies` (obligatori): llista de dates. Admet:
  - `"MM-DD"`: cada any (`"04-23"` = cada 23 d'abril).
  - `"AAAA-MM-DD"`: només aquell any (`"2027-03-21"`).
  - Un interval amb `/`, amb les dues dates del mateix format: `"12-24/12-26"`,
    `"2027-06-23/2027-06-24"`. També val si travessa l'any: `"12-30/01-02"`.
- `titol` (opcional): el títol, en vermell.
- `text` (opcional): el missatge.
- `espera` (opcional): segons que la creu de tancar queda bloquejada (0-10), com al de "nova actualització". Per defecte 0.
- `enllac` (opcional): `text` i `url`, en un botó sota el missatge. La `url` pot ser relativa a l'arrel del lloc
  (`"joc/"`), completa (`"https://..."`) o un correu (`"mailto:marc@rimador.cat"`).

Si el mateix dia en toquen dos, surt el primer del fitxer. El text es mostra sempre
com a text pla (no s'interpreta HTML).

## Provar-lo sense esperar el dia

Afegeix `?baner=ID` a l'adreça de qualsevol pàgina, p. ex. `index.html?baner=sant-jordi`.
Així surt sempre, encara que l'hagis tancat.
