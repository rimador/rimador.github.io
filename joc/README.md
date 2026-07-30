# El joc del Rimador

Joc de rimes fet damunt del mateix diccionari fonètic que fa servir el cercador.
Viu a `rimador.cat/joc/` i és independent de la resta de la web: no comparteix ni
CSS ni JS amb el lloc principal (el `gulpfile.js` només mira `css/` i `js/` de
l'arrel, o sigui que res d'aquesta carpeta no entra al paquet general). L'estètica,
això sí, és la mateixa de sempre: fons rosa, plafons cians, vores gruixudes i
tipografies de tota la vida.

## Com es juga

Et donem una paraula i has d'escriure-hi totes les rimes que puguis abans que
s'acabi el temps.

- **Fàcil** valida contra rimes **assonants** (només les vocals a partir de la
  tònica). **Difícil**, contra rimes **consonants**.
- **Paraula del dia**: la mateixa paraula per a tothom, 1 minut, un intent per
  dificultat i dia.
- **Il·limitat**: paraula nova cada partida i tres rellotges (45 s, 1 min 30 s,
  3 min).

Els accents no compten enlloc: escriure *cami* val per *camí* i *forca* per
*força*. Si una paraula ja s'ha enviat (amb accents o sense), es rebutja.

**La paraula objectiu mai és un verb** (seria massa fàcil rimar-hi amb altres
formes verbals conjugades), però els verbs sí que valen com a resposta. Això es
decideix quan es generen les dades, no en temps d'execució.

Des del menú pots veure **Els meus rècords** (les teves millors puntuacions,
desades en aquest navegador) i la **Classificació** (les de tothom).

## Per què les dades són com són

El diccionari sencer (`diccionaris/separat/col_*.txt`) fa 46 MB i 619.785
entrades. La web principal se'l carrega tot a IndexedDB, però un joc no es pot
permetre esperar això. La sortida d'aquí es basa en dues observacions:

1. **La clau de rima consonant sempre implica la mateixa clau assonant**
   (comprovat: 0 conflictes en tot el diccionari). O sigui que un sol fitxer per
   grup assonant serveix les dues dificultats: en fàcil valen totes les paraules
   del fitxer i en difícil només les de la secció de la paraula objectiu.
   **Una sola descàrrega per partida.**
2. **No cal cap llista de paraules objectiu.** Poden ser objectiu totes les
   paraules d'una clau consonant amb més de 50 rimes, i això ja se sap només
   amb l'índex. La tria és proporcional a la mida de cada grup, de manera que
   totes les paraules objectiu són igual de probables.

Resultat: `dades/index.json` fa uns 20 KB i el fitxer de rimes d'una partida en
fa 70 KB de mediana (el més gros, 1,5 MB, que GitHub Pages serveix comprimit a
uns 300 KB). Amb 599 claus jugables surten 463.929 paraules objectiu possibles.

### Format dels fitxers de rimes

```
#aðə              <- capçalera de secció: clau de rima consonant
*cascada          <- l'* marca les paraules que poden ser OBJECTIU (no verbs)
cavalcava         <- sense *, només val com a RIMA (aquí, una forma verbal)
*cami>camí        <- si la forma real porta accents, va després del ">"
```

Com que la part esquerra ja és la clau normalitzada, el joc no ha de normalitzar
res en temps d'execució: només parteix línies. L'`*` li diu de seguida quines
paraules pot proposar com a objectiu (les que no són verbs) i quines només
accepta com a rima. L'`index.json` guarda, per cada clau, el nombre d'objectius,
que és el pes amb què es tria (així totes les paraules objectiu són igual de
probables).

## Regenerar les dades

Cal fer-ho a mà quan canviï el diccionari:

```bash
python joc/eines/generar_dades.py
```

Llegeix `diccionaris/separat/col_*.txt` i reescriu `joc/dades/`. Els paràmetres
(rimes mínimes, si els noms propis compten, si els verbs conjugats poden ser
objectiu) són constants a dalt de tot de l'script.

Els objectius són tots els mots amb prou rimes que **no siguin verbs** (els verbs
continuen valent com a resposta). Surten 500 claus jugables i ~123.000 paraules
objectiu possibles. Les constants de dalt de l'script permeten afinar-ho
(`EXCLOURE_VERBS_OBJECTIU`, `EXCLOURE_PLURALS_OBJECTIU`, `MIN_RIMES`).

**Important:** si es regeneren les dades, la paraula del dia d'aquell dia pot
canviar per a qui encara no l'hagi jugada, perquè la tria depèn de l'ordre de
l'índex. Val més fer-ho de nit.

## Classificació (leaderboard)

Funciona igual que el registre de cerques de la web: el navegador envia la
puntuació a un Google Apps Script, que l'apunta a un full de càlcul; un script de
Python llegeix el full publicat en CSV i en fa el rànquing que es veu al joc.

Fitxers:

```
joc/js/classificacio.js              enviar la puntuació + llegir el rànquing
joc/eines/apps_script_classificacio.gs   codi per enganxar a Google Apps Script
joc/eines/compilar_classificacio.py  full CSV -> joc/dades/classificacio.json
joc/dades/classificacio.json         el rànquing que mostra el joc
```

### Posar-la en marxa (un sol cop)

1. Crea un full de càlcul a Google Sheets amb aquestes capçaleres a la fila 1:
   `Data | Sobrenom | Mode | Dificultat | Segons | Punts | Paraula | Usuari`.
2. Extensions → Apps Script → enganxa-hi `eines/apps_script_classificacio.gs`.
   Desplega'l com a aplicació web (accés: qualsevol) i copia l'URL `/exec`.
3. Posa aquell URL a `URL_ENVIAMENT` de `joc/js/classificacio.js`.
4. Publica el full en CSV (Fitxer → Comparteix → Publica a la web → CSV) i posa
   aquell URL a `URL_FULL_CSV` de `joc/eines/compilar_classificacio.py`.

Mentre `URL_ENVIAMENT` estigui buit, el joc ensenya la pantalla de classificació
però diu que encara no està activada, i el botó d'enviar contesta amb un
"Desat!" local sense trencar res.

### Refrescar el rànquing

```bash
python joc/eines/compilar_classificacio.py
```

Llegeix el full, valida els sobrenoms, es queda la millor puntuació de cada
persona i modalitat, i reescriu `joc/dades/classificacio.json`. Necessita
`pandas` (`pip install pandas`), igual que `stats/stats.py`. Es pot programar al
mateix estil que els altres workflows de `.github/workflows/`.

## Estructura

```
joc/
  index.html            totes les pantalles, amagades amb l'atribut hidden
  css/joc.css           estètica rosa/cian dels 90, disseny mòbil primer
  js/
    principal.js        lliga pantalles, motor i dades
    dades.js            descàrrega i lectura dels fitxers de rimes
    objectius.js        tria de la paraula (a l'atzar o la del dia)
    motor.js            rellotge, validació i puntuació (no toca el DOM)
    normalitza.js       accents fora; ha de coincidir amb el generador
    ui.js               tot el que toca el DOM
    magatzem.js         localStorage: rècords, paraula del dia i sobrenom
    compartir.js        graella d'emojis i porta-retalls
    classificacio.js    enviar/llegir el rànquing global
  dades/                generat pels scripts d'eines/
  eines/
    generar_dades.py            diccionari -> index.json + rimes/*.txt
    compilar_classificacio.py   full CSV -> classificacio.json
    apps_script_classificacio.gs  backend per a Google Apps Script
```

Són mòduls ES natius i no passen per cap procés de compilació: el navegador se'ls
carrega tal com són.

## Coses que convé saber

- **La paraula del dia** surt d'un generador pseudoaleatori sembrat amb la data
  (mulberry32 + hash tipus cyrb53). No hi ha servidor: tothom calcula la mateixa
  paraula a partir del mateix índex. La dificultat no entra a la llavor, o sigui
  que la paraula és la mateixa tant si la jugues en fàcil com en difícil.
- **El bloqueig diari** es guarda a `localStorage`, amb un sol dia desat cada
  vegada: quan canvia la data, l'entrada vella se substitueix.
- **Els rècords** van per mode, dificultat i rellotge (`illimitat|dificil|45`) i
  es veuen a la pantalla "Els meus rècords".
- **La classificació** es pot enviar en qualsevol partida amb un sobrenom; la
  validació de veritat (i la desduplicació) la fa el compilador de Python.
- Si el `localStorage` no hi és (navegació privada), el joc funciona igual;
  simplement no recorda res.
- El *cache busting* del `deploy.yml` només vigila `css/*.css` i `js/*.js` de
  l'arrel, o sigui que els `?v=` de `joc/index.html` s'han de pujar a mà quan es
  toqui alguna cosa d'aquí (o afegir `joc/**` al `git diff` d'aquell workflow).
