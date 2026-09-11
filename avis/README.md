# Avís periòdic de donatius

Quadre que surt al mig de la pantalla recordant que el Rimador.cat és voluntari.
No surt sempre: surt quan es compleixen alhora dues condicions, i el text que
hi apareix depèn del mes en què som.

Tot passa al navegador de cada visitant. No hi ha servidor, ni workflow, ni
base de dades: l'únic rastre és una clau de `localStorage` amb quatre xifres.

## Fitxers

| Fitxer | Què és |
|---|---|
| `missatges.json` | **Els textos.** És l'únic que cal tocar per canviar què diu l'avís. |
| `avis.js` | La lògica: quan surt, quin text tria, com es dibuixa el quadre. |
| `avis.css` | Els estils, en tema festiu i en tema sobri. |
| `README.md` | Això. |

## Quan surt

Han de complir-se **les dues** condicions:

1. **4 dies naturals diferents** amb ús del Rimador.cat. Un dia amb quaranta
   cerques compta 1.
2. **26 dies naturals** des de l'últim avís.

Els dos comptadors arrenquen de zero al mateix moment (quan es tanca un avís),
o sigui que els dies d'ús s'acumulen *durant* l'espera, no després.

La primera vegada no hi ha cap avís anterior, l'espera surt infinita i per tant
només compta la condició dels dies d'ús: el primer avís surt exactament el 4t
dia diferent.

Un "dia d'ús" es compta quan algú **acaba una cerca** (a `index.html`) o
**actualitza una llista** (a `llistes/`). No compta obrir la pàgina i marxar.

Exemple:

| Dia | diesUsats | Avís? |
|---|---|---|
| 1, 3, 4 | 1, 2, 3 | no |
| 9 | 4 | **SÍ** → tot a zero |
| 10–14 (cada dia) | 5 | no: només 5 dies naturals |
| 35 | 6 | **SÍ**: 26 dies naturals i ≥4 d'ús |
| 201, 205, 208, 210 | 1, 2, 3, 4 | **SÍ** el dia 210 |

## Quin text surt

Per ordre de prioritat:

1. Un **extraordinari** viu, si n'hi ha (tenen `des` i `fins`).
2. El del **mes en curs**, si el mes és a `mesos`.
3. Si aquest text ja va ser l'últim que es va veure, el del **mes següent**.
   (Cal perquè 26 dies és menys que un mes: dos avisos seguits poden caure
   dins el mateix mes.)
4. El de `defecte`.

**No cal omplir els 12 mesos.** Els que no hi siguin cauen al text genèric.

## Editar els textos

N'hi ha prou de canviar `missatges.json` i fer *push*. No cal recompilar res:
el navegador el llegeix en el moment d'obrir el quadre. Com que no és cap `.js`
ni cap `.css`, el desplegament tampoc no refresca les versions `?v=` dels HTML.

Camps de cada missatge:

| Camp | Què fa |
|---|---|
| `mes` | 1–12. En quin mes natural surt. Si dos comparteixen mes, guanya el primer. |
| `id` | Identificador únic. Serveix per no repetir dos cops seguits el mateix text. |
| `titol` | El títol vermell de dalt. |
| `text` | El cos. Admet HTML (`<br>`, `<strong>`...). |
| `botoAccio` | Etiqueta del botó principal. |
| `botoTancar` | Opcional. Etiqueta del botó secundari; per defecte, "Ara no". |

Un missatge extraordinari, fora del cicle mensual, va a `extraordinaris` i mana
mentre és dins la seva finestra:

```json
"extraordinaris": [
  { "id": "servidor-2027", "des": "2027-03-01", "fins": "2027-03-15",
    "titol": "Se'ns acaba l'allotjament", "text": "...",
    "botoAccio": "Ajuda'ns" }
]
```

Quan passa la data, tot torna al calendari mensual sol.

**On va el botó no es diu aquí.** L'adreça és una sola, a `ENLLAC_ACCIO`
d'`avis.js`, i val per a tots els missatges: així no hi ha dotze còpies de la
mateixa URL per canviar el dia que canviï. Del `missatges.json` només en surt
l'etiqueta del botó.

## Canviar el comportament

Els paràmetres són les primeres línies d'`avis.js`:

| Paràmetre | Valor | Què fa |
|---|---|---|
| `DIES_US` | `4` | Dies diferents d'ús que calen. |
| `DIES_ESPERA` | `26` | Dies naturals mínims entre dos avisos. |
| `RETARD` | `2500` | Mil·lisegons entre la cerca i l'obertura del quadre. |
| `ENLLAC_ACCIO` | Ko-fi | On va el botó principal, en tots els missatges. |

Totes les sortides del quadre valen igual: la creu, l'Esc, el clic al fons,
"Ara no" i "Ja hi he col·laborat" reinicien el cicle exactament de la mateixa
manera.

## Provar-lo sense esperar 4 dies

Afegint un paràmetre a l'URL:

| URL | Què fa |
|---|---|
| `?avis=test` | Obre el quadre ara, amb el text del mes en curs, sense tocar cap comptador. |
| `?avis=12` | Igual, però amb el text del mes que diguis (1–12). |
| `?avis=reinicia` | Esborra l'estat i torna a començar de zero. |

I des de la consola del navegador:

```js
AvisRimador.estat()      // per on va el comptador
AvisRimador.mostraAra(4) // obre el quadre amb el text d'abril
AvisRimador.reinicia()   // esborra l'estat
```

## Afegir-lo a una altra pàgina

Dues línies al `<head>` (amb els `../` que calguin segons la fondària):

```html
<link rel="stylesheet" href="avis/avis.css?v=xxxxxxx">
<script src="avis/avis.js?v=xxxxxxx" defer></script>
```

I una línia allà on es consideri que l'usuari ha fet servir el Rimador.cat:

```js
if (window.AvisRimador) window.AvisRimador.registraUs();
```

Compte de no posar-la en codi que s'executi en carregar la pàgina: llavors una
simple visita ja comptaria com un dia d'ús.

## Detalls que val la pena saber

- **L'estat és per navegador i dispositiu.** El mateix usuari al mòbil i a
  l'ordinador compta com dues persones. No hi ha manera d'evitar-ho sense
  comptes d'usuari.
- **Si `localStorage` no és accessible** (navegació privada d'alguns
  navegadors, cookies bloquejades), el mòdul es queda quiet i no ensenya res
  mai. Val més això que ensenyar-lo a cada visita.
- **Si `missatges.json` falla**, es calla i prou. Un avís de donatius no pot
  trencar mai una cerca de rimes.
- **El botó "Ja hi he col·laborat" no fa res d'especial**: és una segona manera
  de dir que no. Tanca el quadre igual que "Ara no" i el cicle continua igual.
  Hi és perquè qui ja ens ha ajudat tingui una sortida que no li faci sentir
  que ens deixa penjats.
- **El focus va a "Ara no"**, no al botó de donar: prémer Enter sense mirar
  tanca el quadre i no obre cap pestanya.
- **La carpeta no passa pel gulp.** `avis.js` i `avis.css` se serveixen tal
  qual, sense minificar (7 KB en total), perquè tot el mòdul es pugui moure o
  esborrar d'una peça. El `deploy.yml` sí que els vigila per refrescar les
  versions `?v=` dels HTML quan canvien.
