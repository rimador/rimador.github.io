# El joc del Rimador.cat — funcionament intern

Nota per a tu d'aquí a un any. El [`README.md`](README.md) explica **què és** el
joc i **com posar-lo en marxa**; això d'aquí explica **com funciona per dins**:
d'on surt cada dada, qui la transforma, què fa cada fitxer i on són les costures.

Al final hi ha un apartat de [**coses que convé saber**](#12-coses-que-convé-saber)
amb el que encara està obert.

---

## 1. La idea de tot plegat

El joc és una **pàgina estàtica** a `rimador.cat/joc/`. No té servidor propi. Tota
la lògica passa al navegador i les úniques coses que baixa són fitxers de text
que hi ha comitejats al repositori.

Està **aïllat de la resta del web** a propòsit:

| | web principal | joc |
|---|---|---|
| CSS | `css/*.scss` → gulp → `dist/css/styles.min.css` | `joc/css/joc.scss` → gulp → `dist/css/joc.min.css` (full a part, `_variables.scss` compartit) |
| JS | `js/*.js` → gulp → `dist/js/script.min.js` | `joc/js/*.js`, mòduls ES natius |
| dades | tot el diccionari (46 MB) a IndexedDB | 1 índex + 1 fitxer de rimes per partida |

Del `gulpfile.js`, el joc n'usa **una tasca pròpia** (`styles-joc`) per al CSS i
res per al JS: els mòduls els carrega el navegador tal com són. El full del joc
surt **a part** del del lloc i no pas concatenat amb ell, perquè tots dos posen
regles damunt de `html`, `body`, `a` i `*` (i el `general.scss` posa
`height: 100%` i `overflow: hidden` al `body`, que aquí trencaria el
desplaçament).

El que **sí** que comparteix amb el web principal són tres coses, i totes tres per
alguna raó:

- **L'estètica** (rosa/cian): full a part, però els colors de la casa surten del
  `css/_variables.scss` compartit, o sigui que són escrits un sol cop.
- **El dialecte triat** (`localStorage['rimadorDialecte']`) i **l'identificador
  d'usuari** (`rimador_usuari_id`): les dues meitats del lloc han de coincidir en
  què estàs mirant i qui ets.
- **La manera de gestionar versions**, que és la mateixa idea aplicada dues
  vegades (apartat 9).

---

## 2. D'on surten les dades

### La cadena sencera

```
diccionaris/diccionari.5.2.3.txt      ← l'edites tu a mà (quines paraules hi ha)
diccionaris/col_10.txt                ← l'edites tu a mà (com sona cadascuna)
        │
        │  diccionaris/python/*.py  (workflow diccionaris.yml)
        ▼
diccionaris/separat/col_0,1,2,5,6,7,8.txt          paraula, lema, codi, síl·labes…
dialectes_col/<ca|nw|va|ba>/col_3_rimacons_*.txt   clau de rima CONSONANT
dialectes_col/<ca|nw|va|ba>/col_4_rimaass_*.txt    clau de rima ASSONANT
dialectes_col/<ca|nw|va|ba>/apendix/col_0,2,3,4    l'APÈNDIX: les paraules que
                                                   només es diuen en aquell
                                                   dialecte (apartat 2 bis)
        │
        │  joc/eines/generar_dades.py   ← A MÀ, no hi ha cap workflow
        ▼
joc/dades/versions.json   quins dialectes hi ha i el resum de cada fitxer
joc/dades/index.json      les claus dels 4 dialectes + on és cada grup
joc/dades/<codi>.txt      totes les rimes d'un dialecte (4 fitxers)
        │
        │  fetch() des del navegador
        ▼
la partida
```

Les columnes són **fitxers paral·lels**: la línia *N* de `col_0.txt` és la
paraula, la de `col_2.txt` el seu codi gramatical i la de `col_3_rimacons_ca.txt`
la seva clau de rima consonant en central. Tot l'encaix és per número de línia;
per això el generador s'atura de seguida si les columnes no tenen la mateixa
llargada.

### On és cada cosa: `camins.py`

El generador **no sap cap ruta**. Les demana totes a
`diccionaris/python/camins.py`, que és el vocabulari compartit de tots els
scripts del repositori:

```python
sys.path.insert(0, os.path.join(ARREL, "diccionaris", "python"))
import camins

camins.dialectes()                 # ['ba', 'ca', 'nw', 'va'] — les carpetes de dialectes_col/
camins.cami_columna(0)             # diccionaris/separat/col_0.txt
camins.cami_dialecte('va', 3)      # dialectes_col/va/col_3_rimacons_va.txt
camins.llegir_columna(cami)        # una línia per fila, sense salt final
```

Això no és cosmètic. La rima **ja no és a `diccionaris/separat/`**: hi era fins a
l'agost del 2026 i llavors es va moure a `dialectes_col/<codi>/`, perquè depèn de
com es parli. El generador del joc apuntava a la ruta vella i havia deixat de
funcionar. Ara segueix els camins que digui `camins.py`, i si un dia es tornen a
moure, el joc hi va al darrere sense tocar res.

**Els dialectes tampoc no es declaren enlloc**: són les subcarpetes de
`dialectes_col/`. Un dialecte nou és una carpeta amb la seva transcripció, i el
generador ja el troba.

L'apèndix també surt del `camins.py` (`te_apendix()` i `cami_apendix()`).
Compte amb els noms: dins de l'apèndix les columnes **no duen el nom al mig**
(`col_3_va.txt`, i no pas `col_3_rimacons_va.txt`, que és com es diuen les del
`trans_dicc`). El generador s'ho endevinava i provava noms que no existeixen: el
resultat era que **l'apèndix no es llegia mai** i les dades del joc sortien només
del diccionari global.

### 2 bis. L'apèndix: el diccionari propi de cada dialecte

El diccionari global és el que comparteixen els quatre dialectes; l'**apèndix**
són les formes que només es diuen en un. El diccionari complet d'un dialecte és,
doncs, **global + apèndix**, i és el que el joc ha de fer servir per validar les
respostes: qui juga en valencià ha de poder respondre-hi una paraula valenciana.

```
dialectes_col/<codi>/apendix/
    col_0_<codi>.txt    la paraula
    col_2_<codi>.txt    el codi gramatical
    col_3_<codi>.txt    la clau de rima consonant
    col_4_<codi>.txt    la clau de rima assonant
```

Les mateixes columnes paral·leles que el global, i s'hi apliquen les mateixes
regles (fora els noms propis, fora el que no sigui alfabètic). Els noms els diu
`camins.cami_apendix()`.

Tres decisions:

- **Mai no són paraula objectiu.** La paraula que has de rimar surt sempre del
  diccionari global, perquè és la que tothom comparteix: si sortís de l'apèndix,
  la paraula del dia no podria ser la mateixa per a tothom i, a l'il·limitat, et
  tocaria rimar una paraula que en el teu dialecte no existeix. Al fitxer hi van
  sense cap marca, com els verbs.
- **Sí que compten com a rima**, i per tant **fan pujar el recompte de la seva
  terminació**. Això no és un detall: aquell recompte és el que decideix si una
  paraula entra a la finestra de `MIN_RIMES`–`MAX_RIMES`, o sigui que l'apèndix
  pot fer que una paraula sigui jugable en un dialecte i no en un altre.
- **Si la carpeta hi és a mitges, l'script peta.** Un apèndix sense la columna de
  rima donaria paraules que el joc hauria d'acceptar i no acceptaria, i no hi
  hauria cap error visible: només diria "No rima" a coses que hi rimen.

Els quatre dialectes ja en tenen, i el generador ho diu a cada passada:

```
apendixs: ba 201.764, ca 107.437, nw 107.437, va 236.333
```

Es nota d'una manera que val la pena veure: **amb l'apèndix comptant, les claus
jugables baixen** (del central, de 663 a 541), perquè hi ha terminacions que amb
les formes pròpies del dialecte se'n van per damunt de `MAX_RIMES`. És
exactament el que ha de passar: la finestra es mira sobre el diccionari que el
jugador té de debò.

### Els dos invariants que ho fan possible

Aquí hi ha tota la gràcia del disseny. El diccionari sencer fa 46 MB i el joc no
es pot permetre esperar-lo, o sigui que la generació es recolza en dues coses:

**1. Una clau consonant sempre implica la mateixa clau assonant.** El generador
ho comprova a cada passada, per a cada dialecte, i s'atura si algun dia deixa de
ser cert:

```python
anterior = cons_a_asson.setdefault(clau, rima_asson[i])
if anterior != rima_asson[i]:
    raise SystemExit(f"[{codi}] la clau consonant '{clau}' apunta a dues claus assonants …")
```

Conseqüència: si agrupes els fitxers **per clau assonant** i, a dins, els
subdivideixes **per clau consonant**, un sol fitxer serveix les dues dificultats.

- **Fàcil** (assonant) = *totes* les paraules del fitxer.
- **Difícil** (consonant) = només les de la secció on és la paraula objectiu.

**Una sola descàrrega per partida**, tant si jugues en fàcil com en difícil.

**2. No cal cap llista de paraules objectiu.** Pot ser objectiu qualsevol
paraula no verbal que tingui entre **`MIN_RIMES` (30)** i **`MAX_RIMES` (800)**
rimes **als quatre dialectes**. Quines són ho decideix el generador i ho escriu
al fitxer de rimes amb un `*` al davant (apartat 3); l'índex en porta el
recompte de cada terminació, o sigui que el joc tampoc no ha de llistar res.

La condició dels quatre dialectes és nova, i és l'apartat 2 ter.

**Els tres modes trien PER RIMA, mai per paraula** (`opcionsDeRima()` a
`js/objectius.js`), i **què és una rima depèn de la dificultat**:

| dificultat | una rima és | quantes n'hi ha (central, finestra normal) |
|---|---|---|
| difícil (consonant) | una **clau consonant** | 541 |
| fàcil (assonant) | un **grup assonant** | 38 |

En fàcil les respostes bones són el grup sencer, o sigui que dues claus del
mateix grup són **la mateixa partida amb una altra paraula al davant**: la rima
és el grup, no la clau. Un cop triada la rima, la paraula surt d'entre totes les
del grup, amb pes segons els objectius de cada clau —que és la manera de fer que
cada *paraula* sigui igual de probable un cop la rima ja està decidida.

El biaix té **dos pisos**, i s'han hagut de tapar tots dos:

| | efecte |
|---|---|
| triar per **paraula** | mediana de 156 rimes i **una de cada tres partides** passava de 300; per clau, mediana 45 i només el 6 % |
| triar la **clau consonant en fàcil** | el grup més gros del central (311 claus) s'enduia el **7,3 %** de les partides i els setze més petits es repartien el 0,6 %; per grup, cadascun té l'1,4 % |

**Per què un màxim de rimes.** La idea original era vetar les **agudes**, perquè
`camió` rima amb `campió`, `perdedor`, `guanyador` i tres mil més i la partida
deixa de ser un repte. Però el problema no és que sigui aguda: és que la seva
clau consonant (`o`) té **6.543 rimes**. Al costat, `estel` (clau `ɛl`) en té
118 i `esquirol` (clau `ɔl`) 467, i són agudes perfectament jugables; i les
claus `en` (5.067: *vent*, *dent*…) i `os` (3.490: *gos*, *os*…) no són agudes i
són igual de barates. Comptant rimes cauen exactament les que sobren: **81 claus
del central** passen de 800 i queden fora com a objectiu (hi són al fitxer i
valen com a resposta, és clar).

### 2 ter. La finestra es comprova als QUATRE dialectes

`reflux` té 64 rimes consonants en central, en nord-occidental i en valencià, i
**582** en balear. N'hi ha que en tenen vint en un dialecte i nou-centes en un
altre. Mentre cada dialecte tenia la seva finestra, la mateixa paraula podia ser
una partida raonable en un lloc i "escriu de pressa" en un altre; i com que **la
classificació és una de sola per a tothom** (apartat 8), això vol dir comparar
partides que no es poden comparar.

Ara la finestra qualifica **paraules i no claus**: una paraula pot ser objectiu
dels modes normals només si la seva clau de rima té entre `MIN_RIMES` i
`MAX_RIMES` rimes **a tots quatre**. Amb els homògrafs —les formes que, sense
accents, cauen en dues claus— s'hi demana que hi càpiguen **totes**: el joc
ensenya "dona" i prou, i les rimes que valdran són les d'una de les dues
lectures.

Això obliga a **dues passades** pel generador (apartat 4): la primera només
compta, la segona escriu.

I té **una excepció, el mode personalitzat**, on la finestra la tria el jugador
—part de la gràcia és poder demanar una terminació de tres rimes o una de sis
mil— i el dialecte va tancat dins de l'enllaç, o sigui que tots dos jugadors
juguen exactament el mateix i la comparació ja és justa. Per això el fitxer marca
les paraules de dues maneres (`*` i `+`, apartat 3) i l'índex en porta dos
recomptes.

### Els números d'ara

| dialecte | claus jugables | paraules objectiu | claus publicades | grups assonants |
|---|---|---|---|---|
| Central (`ca`) | 541 | 50.277 | 4.267 | 69 |
| Nord-occidental (`nw`) | 532 | 50.266 | 4.319 | 117 |
| Valencià (`va`) | 535 | 50.266 | 4.222 | 112 |
| Balear (`ba`) | 520 | 50.271 | 4.122 | 88 |

Les paraules objectiu són gairebé les mateixes als quatre perquè és, justament,
la llista de les que valen a tot arreu: **50.243** paraules amb entre 30 i 800
rimes en tots quatre dialectes, de les 151.913 formes no verbals que hi ha. Les
petites diferències entre columnes són les que en algun dialecte cauen en una
clau que no s'arriba a publicar.

Ha anat canviant tres vegades i val la pena tenir-ho junt:

| | mínim | comprovat a | claus jugables (ca) | objectius (ca) |
|---|---|---|---|---|
| al principi | 50, sense màxim | el dialecte que jugaves | ~500 | ~123.000 |
| amb el màxim de 800 | 20 | el dialecte que jugaves | 1.003 | 62.186 |
| ara | 30 | **els quatre** | 541 | 50.277 |

El mínim ha pujat de 20 a 30 perquè amb vint rimes i un minut la partida
s'acabava abans que el rellotge.

A part, l'`index.json` porta la llista de la **paraula del dia**: 2.140 paraules
en 541 claus de rima, les úniques que valen com a objectiu als quatre dialectes
alhora i que no són ambigües (apartat 7).

En total, `joc/dades/` fa **35 MB en sis fitxers** (amb l'apèndix hi són, els
fitxers han crescut: el balear i el valencià passen de 9 MB). Una visita en baixa
tres: el `versions.json` (500 B), l'`index.json` (437 KB, uns 120 comprimits) i
el fitxer del seu dialecte (7,7 MB en central i 9,3 en balear, que Pages serveix
comprimits a unes dues terceres parts menys). Després, totes les partides
d'aquell dialecte són gratis.

El nombre de grups no és el mateix a cada dialecte: el nord-occidental parteix
les paraules en 117 i el central en 69. Per això el número de grup **no vol dir
res per si sol**: és la posició dins la llista d'aquell dialecte, i canvia si es
regeneren les dades.

### Per què no són 183 fitxers

Ho van ser. N'hi havia un per grup assonant i dialecte, i cada partida es baixava
només el seu. Semblava clarament millor i no ho era:

| | 183 fitxers | 6 fitxers |
|---|---|---|
| primera partida | ~145 KB | 1,9 MB |
| cada partida següent | ~145 KB més | **0** |
| fitxers al repositori | 189 | 6 |

Els 145 KB són la mitjana **ponderada**, que és la que compta: la tria va per
nombre de paraules objectiu i els grups grossos en tenen més, o sigui que surten
més sovint. La mediana crua era d'11 KB i enganyava.

El monolític surt a compte **a partir de tretze partides**, i el repositori
s'estalvia 183 fitxers que no obre mai ningú (són generats: no s'hi corregeix res,
beuen del diccionari).

La por raonable era el git: un fitxer derivat que s'ha de tornar a pujar sencer a
cada canvi és exactament pel que es va esborrar `bot/resultat_ordenat_cons.json`
(vegeu `diccionaris/README.md`). Està mesurat i aquí no passa: dues versions del
fitxer de 7,6 MB amb **una paraula de diferència** empaqueten a **1,93 MiB en
total**. El git fa deltes molt bé amb text ordenat de manera estable; aquell JSON
es reordenava.

Dues coses fan que no es pagui el preu del fitxer gros:

**Els desplaçaments.** L'índex diu de cada grup on comença i quant ocupa, o sigui
que el joc en talla un sense interpretar la resta (apartat 3).

**La precàrrega.** El fitxer del dialecte es comença a baixar en obrir la pàgina,
mentre l'usuari llegeix el menú i tria mode i rellotge. Quan prem «Comença» ja hi
és gairebé sempre; i si no, l'espera igualment, perquè `carregarDialecte` guarda
la promesa i no en fa dues descàrregues.

I quan no hi arriba a temps, hi ha el loader (apartat 6).

### Què hi ha i què no hi ha

| | |
|---|---|
| entrades del diccionari global | 520.418 |
| fora: noms propis (codi `NP*`) | 14.705 |
| formes úniques del global que valen com a rima | **412.845** |
| d'aquelles, al fitxer de cada dialecte | 410.471 – 411.026 (**99,4 – 99,6 %**) |
| fora: grups assonants sense cap clau publicable | segons el dialecte |

**Més l'apèndix**, que no és en aquesta taula perquè no surt del diccionari
global. Amb ell, el fitxer de cada dialecte té 475.142 formes (nord-occidental),
475.695 (central), 542.259 (valencià) i 564.467 (balear): la diferència entre
els dos últims i els dos primers **és l'apèndix**, i és exactament la raó per la
qual el joc l'ha de llegir.

El que falta són paraules de finals raríssims (*abutilon*, *acantolisi*,
*acefala*, *abraxas*): cauen en un grup assonant on **cap** clau consonant no
arriba a `MIN_RIMES`, i com que el generador només escriu els grups que fan falta
per a alguna clau jugable, aquell grup no s'escriu. No s'hi podria jugar igualment
—no tindrien prou rimes ni en fàcil—, i com a resposta només valdrien per a una
paraula objectiu que tampoc no pot sortir.

**Per a una partida concreta no falta cap rima.** El grup assonant va al fitxer
sencer, seccions no jugables incloses, precisament perquè el mode fàcil les
necessita.

Dels dos papers d'una paraula:

- **Com a resposta** hi valen les 475.695 formes del central, apèndix inclòs.
- **Com a paraula a rimar al mode personalitzat**, 151.913 (les `*` i les `+`):
  la resta són verbs (conjugats o amb pronom), o l'apèndix.
- **Com a paraula a rimar als modes normals**, només **50.243** (les `*`): les
  altres cent mil no passen la finestra de 30 a 800 rimes en algun dels quatre
  dialectes.

I un detall que sorprèn: de les claus consonants del central que queden dins del
rang de 30 a 800 rimes, unes 250 no poden donar cap paraula: tenen prou rimes
però **només contenen verbs** (`alin`, `anin`, `anən`…). Hi són al fitxer i
compten com a resposta; simplement no poden sortir mai com a paraula a rimar.

---

## 3. El format dels fitxers generats

### `dades/versions.json`

```json
{
  "generat": "2026-08-29 21:10:26 UTC",
  "dialectes": [
    { "codi": "ca", "nom": "Central" },
    { "codi": "nw", "nom": "Nord-occidental" }
  ],
  "fitxers": {
    "index.json": "826253d24091",
    "eres.json": "65b57475af7d",
    "ca.txt": "8a1f0e77bc32"
  }
}
```

Fa dues feines alhora: diu **quins dialectes hi ha** (i com es diuen, i en quin
ordre van a la tira) i **quina versió té cada fitxer**. El joc no sap res dels
dialectes si no és per aquí, o sigui que no pot oferir-ne cap del qual no tingui
les dades.

L'`eres.json` hi és igual que l'`index.json`, perquè van de la mà: l'índex diu on
cau cada paraula de les eres. L'`especials.json`, en canvi, **no hi és a posta**
(apartat 7).

### `dades/index.json`

Un de sol per als quatre dialectes:

```json
{"min_rimes":50,"max_rimes":1000,"min_publicades":2,
 "diaries":{ … la llista de la roda d'abans (l'era 0), apartat 7 … },
 "eres":{"0":{"ca":[88,412,-1, …],"nw":[…],"va":[…],"ba":[…]}, …},
 "dialectes":{
   "ca":{
     "bytes":8000623,
     "grups":[[0,1186001,1,79809],[1186002,111,2,8], …],
     "claus":[["a",0,1624,25514,0,1435],["abblə",11,961,963,959], …],
     "homografs":["dona", …]}}}
```

- **`claus`**: `[clauConsonant, númeroDeGrup, nombreDObjectius, nombreDeRimes,
  objectiusArreu, natius?]`. Van **ordenades alfabèticament**, i això importa
  (apartat 7: el bloc `eres` hi apunta per posició).

  **Els dos recomptes d'objectius no són cap duplicat.** El tercer camp són totes
  les paraules no verbals de la clau —les que pot proposar el mode
  personalitzat— i el cinquè, només les que es poden rimar als quatre dialectes,
  que són les dels modes normals. A l'exemple, la clau `a` té 1.624 paraules no
  verbals i cap de jugable arreu: amb 25.514 rimes, no passa el màxim enlloc.

  Tots dos fan de **pes** a l'hora de decidir de quina clau d'un grup assonant
  surt la paraula (`clauDeLaRima` a `js/objectius.js`), i **no es poden
  barrejar**. Per això el pes se'l guarda l'opció (`opcio.pesos`) i no es torna a
  llegir de l'entrada: la ruleta treu el tall d'un total i el va restant clau per
  clau, i si el total surt d'un camp i els sumands d'un altre —que són tres
  vegades més grossos— el tall s'acaba abans d'hora. Mesurat quan va passar: al
  grup més gros del central, les primeres claus s'enduien fins a un 20 % de més i
  **l'última no sortia mai** (zero vegades en 300.000 tirades). Amb el pes ben
  posat, khi² de 64 amb 55 graus de llibertat, que és exactament el que ha de
  donar.

  Una entrada d'un índex escrit abans que existís el cinquè camp només en té
  quatre; el joc ho aguanta i fa servir el tercer, que és el que volia dir el
  mateix quan totes les paraules objectiu valien a tot arreu.

  **El sisè camp** (`natius`) només hi és quan és diferent del tercer: són les
  paraules objectiu de la clau que **no** són homògrafs del dialecte, o sigui les
  que pot proposar l'il·limitat natiu (apartat 7 ter). A l'exemple, la clau `a`
  té 1.624 objectius i 1.435 de natius. Una entrada sense sisè camp vol dir que
  tots els objectius són natius.
- **`grups`**: `[inici, llarg, classeDAccent, rimesDelGrup]`. Els dos primers són
  en **bytes** dins `<codi>.txt`. La **classe d'accent** és 1 aguda, 2 plana i
  3 esdrúixola, i les **rimes del grup** són les respostes bones del mode fàcil:
  totes dues són per al mode personalitzat (apartat 7 bis). És el que permet
  tallar-ne un sense interpretar la resta.
- **`eres`**: de cada paraula de cada era, a cada dialecte, la posició de la seva
  clau dins del `claus` d'aquell dialecte (o `-1` si no es pot jugar). El fa
  `generar_dades.py` a cada passada de tots els dialectes (apartat 7).
- **`homografs`**: les formes (normalitzades) que cauen a més d'una clau consonant
  d'aquell dialecte (*dona* / *dóna*), ordenades. L'il·limitat natiu no les
  proposa mai (apartat 7 ter).

Per regenerar-ne un sol dialecte, el generador llegeix l'índex que hi ha i només
en substitueix el seu tros: els altres tres no es toquen.

### `dades/<codi>.txt`

```
#aðə              ← capçalera de secció: clau de rima consonant
*cascada          ← OBJECTIU A TOTS ELS DIALECTES: el pot proposar qualsevol mode
+panderola        ← objectiu NOMÉS al mode personalitzat
cavalcava         ← sense marca, només val com a RIMA (un verb, o l'apèndix)
*cami>camí        ← si la forma real porta accents, va després del ">"
```

Tres decisions que val la pena recordar:

- **La part esquerra ja és la forma normalitzada.** El joc no normalitza res del
  fitxer en temps d'execució: només parteix línies per `\n`, mira el primer
  caràcter i busca un `>`. Tot el cost de treure accents ja s'ha pagat al Python.
- **La marca separa els papers d'una paraula.** Objectiu (la que t'han de rimar)
  i resposta (la que pots escriure) no són el mateix conjunt, i n'hi ha tres
  menes:

  | marca | qui la pot proposar | qui hi ha |
  |---|---|---|
  | `*` | tots els modes | passa la finestra de rimes **als quatre dialectes** |
  | `+` | només el personalitzat | no és verb, però no la passa a tot arreu |
  | (res) | ningú | els verbs (conjugats i amb pronom) i tot l'apèndix del dialecte |

  Es decideix **quan es generen les dades**. Els verbs valen com a resposta però
  mai com a objectiu, perquè rimar-hi amb altres formes conjugades seria massa
  fàcil; i el `+` existeix perquè el mode personalitzat no s'ha de menjar la
  restricció dels quatre dialectes (apartat 2 ter): allà el jugador tria la
  finestra a posta i el dialecte va tancat dins de l'enllaç. L'`analitzar()` de
  `js/dades.js` les separa comparant codis de caràcter (`35` = `#`, `42` = `*`,
  `43` = `+`).
- **El `>` només hi és quan cal.** Si la paraula no porta accents, la línia és una
  sola paraula i el `mostrar` és el mateix que el `normalitzada`.

Els grups assonants van l'un darrere l'altre, separats per un salt de línia. El
joc no en llegeix mai més d'un: es guarda el fitxer com a `ArrayBuffer` i
descodifica només el tros que diu l'índex.

**Els desplaçaments són en bytes, no en caràcters**, a posta: un índex de Python
són punts de codi i un de JavaScript són unitats UTF-16. Amb IPA pel mig, comptar
caràcters seria demanar-se problemes. Per això el fitxer es baixa com a
`ArrayBuffer` (`Uint8Array` + `TextDecoder` sobre el tall) i no com a text.

Cost mesurat del tall: entre 8 i 49 ms segons el grup, i **90 ms** el cas
complet més dolent —el grup més gros del central, tallar-lo, partir-lo i muntar
el `Map` de 76.872 respostes.

### `dades/eres.json` i `dades/especials.json`

Són de la paraula del dia, i els explica l'apartat 7 (*Els fitxers de les eres* i
*Les paraules manuals*): l'`eres.json` porta el contingut congelat de cada era
(30 KB amb la roda d'abans, uns 400 KB amb una era de tretze mil paraules) i
l'`especials.json`, les paraules manuals xifrades (1 KB). El primer passa pel
`versions.json`; el segon es demana amb `?t=`.

---

## 4. `generar_dades.py`, pas a pas

```bash
python joc/eines/generar_dades.py            # tots els dialectes (~40 s)
python joc/eines/generar_dades.py ca va      # només aquests (no comprova les eres)
python joc/eines/generar_dades.py --aplica-substitucions
                                             # com el primer, i substitueix les paraules
                                             # congelades que ja no es poden jugar
```

Constants de dalt de tot que manen:

| constant | ara | què fa |
|---|---|---|
| `MIN_RIMES` | 50 | mínim de formes úniques perquè els modes normals hi juguin |
| `MAX_RIMES` | 1000 | i màxim: fora les terminacions on rima gairebé tot |
| `MIN_RIMES_PUBLICADES` | 2 | mínim per **publicar** la clau al fitxer |
| `DIARIES_PER_CLAU` | 4 | quantes paraules es guarden de cada clau al bloc `diaries` (la roda d'abans, que només alimenta l'era 0) |
| `EXCLOURE_VERBS_OBJECTIU` | `True` | els verbs no poden ser paraula a rimar |
| `CODIS_VERBALS` | `V`, `W` | quins codis són verb: conjugats (`V`) i amb pronom (`W`) |
| `EXCLOURE_PLURALS_OBJECTIU` | `False` | si es posés a `True`, els plurals tampoc |
| `NOMS_DE_DIALECTE` | 4 entrades | com es diu cada codi i en quin ordre va a la tira |

### Primer es prepara el diccionari, un sol cop

`preparar_diccionari()` llegeix la `col_0` i la `col_2`, normalitza les 520.418
paraules i decideix si cadascuna **val com a rima** (fora els noms propis i tot
el que no sigui alfabètic un cop trets els guionets i els apòstrofs, així
*adeu-siau* i *d'acord* hi entren) i si **podria ser objectiu** (no és verb).

Verb vol dir codi `V` **o `W`**: les formes amb pronom (*havent-se'n*,
*rient-li*, *prometent-se-la*) duen `W` i se n'escapaven, o sigui que sortien
com a paraula a rimar. Eren 19 paraules del dia i 133 objectius de l'il·limitat.
És el mateix problema que els verbs i pitjor: a més de rimar amb qualsevol altra
forma conjugada, mitja paraula és el pronom.

Tot això surt del diccionari i **no depèn del dialecte**, o sigui que es fa una
vegada i les quatre passades se'n reparteixen el resultat. Abans es normalitzava
dins de cada dialecte: 2,5 milions de crides a `normalitzar()` per no res.

Després, `llegir_apendix()` per a cada dialecte demanat (apartat 2 bis), i
`files_del_dialecte()` és qui ajunta les dues bandes: primer les files del
diccionari global amb la rima d'aquell dialecte, i tot seguit les del seu
apèndix, marcades com a **mai objectiu**.

### PASSADA 1: quantes rimes té cada paraula a cada dialecte

`marges_de_rima()` compta les formes úniques de cada clau i, de cada paraula que
podria ser objectiu, en desa **`[mínim, màxim]`** de les claus on cau. Només hi
ha més d'una clau amb els homògrafs (*dona* /dɔnə/ i *dóna* /donə/), i s'hi
demana que hi càpiguen totes dues perquè el joc ensenya la forma nua.

Dos números per paraula i prou: tenir els quatre dialectes sencers a la memòria
alhora no hi cabria.

Els dialectes que **no** es regeneren en aquesta passada surten del seu
`dades/<codi>.txt` ja publicat (`marges_publicats()`): cada secció diu quantes
rimes té —les seves línies— i quines paraules hi ha. No és exacte del tot (al
fitxer només hi ha les claus publicades), i per això després es comprova si les
marques que tenen han quedat desactualitzades i s'avisa.

`qualificar_objectius()` en fa la intersecció: les paraules que tenen entre
`MIN_RIMES` i `MAX_RIMES` rimes **a tots els dialectes**.

### PASSADA 2: escriure, un dialecte per un

`generar_dialecte()`, per a cada dialecte:

1. **Agrupa per clau consonant** en `{formaNormalitzada: formaPerMostrar}`. Si
   dues entrades col·lapsen a la mateixa forma normalitzada (*dona* / *dóna*), es
   queda **la més curta d'escriure**: només serveix per ensenyar-la.
2. **Marca els objectius.** Subtilesa: una forma és objectiu si **alguna** de les
   seves entrades no és verb. *Poder* és verb i nom alhora; com a nom, pot ser
   objectiu. I les que són a `qualificades` van, a més, a `objectius_arreu`.
3. **Comprova l'invariant** consonant → assonant i peta si falla.
4. **Qualifica les claus** dues vegades: les **publicades** (des de
   `MIN_RIMES_PUBLICADES` amunt, sense sostre, que són les que van al fitxer i
   les que veu el mode personalitzat) i les **jugables** (les que tenen alguna
   paraula que es pugui rimar arreu, que són les dels modes normals i de la
   paraula del dia).
5. **Munta el fitxer del dialecte**: els grups assonants un darrere l'altre,
   apuntant de cadascun on comença i quant ocupa. Cada paraula hi va amb la seva
   marca (`*`, `+` o cap). Cada grup hi va **sencer**, seccions no qualificades
   incloses: fan falta per validar el mode fàcil.
6. **Torna el seu tros d'índex** (`grups` + `claus`) i, a part, els seus
   **candidats a paraula del dia**: les paraules jugables arreu que són a una
   sola clau. Quan la passada ha cobert els quatre dialectes, el
   `construir_diaries()` en fa la intersecció i escriu el bloc `diaries` (la roda
   d'abans, vegeu l'apartat 7). En una passada parcial no es pot refer i es
   conserva la que hi havia; l'script ho diu.
7. **Els homògrafs i les paraules natives.** També en torna la llista de formes
   objectiu que cauen a més d'una clau (`homografs`) i, de cada clau, quantes de
   les seves paraules objectiu **no** hi són (el sisè camp de l'índex), per a
   l'il·limitat natiu (apartat 7 ter).

I al final de tot, **la comprovació de les eres** (apartat 7), **l'`index.json`**
(fusionant els dialectes que no s'hagin regenerat en aquesta passada, amb el bloc
`eres` que en resol les paraules) i **el `versions.json`**, que ara també porta
l'`eres.json`.

**Les escriptures es fan al final i només si tot és net.** Si una paraula
congelada ja no es pot jugar, l'script surt amb un error **sense escriure res**
(ni els `.txt`, ni l'índex): no es pot publicar mai un joc que no sap resoldre la
paraula d'un dia. Amb `--aplica-substitucions` la substitueix al mateix lloc i hi
torna.

Tres coses que fa i que no es veuen:

- **No reescriu el que no ha canviat** (`escriure_si_cal`, que compara bytes).
  Una passada sense canvis al diccionari no deixa cap diff ni toca cap data de
  fitxer.
- **Fusiona l'índex** en comptes de refer-lo: `generar_dades.py va` deixa els
  altres tres dialectes tal com estaven.
- **Neteja el que sobra**: els dialectes que hagin desaparegut de
  `dialectes_col/` i les carpetes `<codi>/` del format vell.

I una que sí que es veu: **llegeix i escriu allà on digui el `camins.py`**, o
sigui que amb `RIMADOR_ARREL` posat corre sencer contra la còpia de joguina de
l'arbre. Abans les sortides anaven sempre al repositori de debò encara que les
entrades vinguessin de la còpia, i provar un canvi volia dir reescriure 30 MB de
dades bones.

> ✅ **Regenerar les dades ja no canvia la paraula de cap dia**: el que surt
> cada dia és a `eres.json`, congelat (apartat 7). El que pot passar és que el
> generador no deixi publicar perquè una paraula congelada ja no es pot jugar.

> ⚠️ **Passa'l sense arguments.** Amb la finestra dels quatre dialectes, una
> passada parcial pot deixar les marques dels altres tres desactualitzades: la
> qualificació depèn de tots quatre alhora i canviar-ne un les pot moure a tot
> arreu. L'script ho detecta i ho diu amb un `ATENCIO`, però qui ho arregla és
> una passada sencera.

---

## 5. Els mòduls JS, un per un

Els mòduls ES principals són aquests. `index.html` només en carrega un
(`principal.js`) i la resta entren per `import`. La divisió és estricta: **`ui.js`
és l'únic que toca el DOM** i **`motor.js` no en sap res**. Els de la paraula del
dia i de l'il·limitat natiu (`eres.js`, `bosses.js`, `especials.js`,
`illimitat.js`) tampoc: són funcions pures, i per això també les carreguen node i
el panell.

```
index.html
    └── principal.js          el fil conductor
            ├── dades.js          versions, fetch i parsing
            ├── dialecte.js       quin dialecte es juga
            ├── objectius.js      llavor/generador, el personalitzat i la roda d'abans
            ├── eres.js           la paraula del dia: les eres i la fórmula
            │       └── bosses.js     el patró de bosses i les baralles
            ├── especials.js      les paraules manuals xifrades
            ├── illimitat.js      l'il·limitat natiu (també amb bosses.js)
            ├── motor.js          rellotge, validació, puntuació
            │       └── normalitza.js
            ├── ui.js             tot el DOM
            ├── magatzem.js       localStorage
            ├── compartir.js      text del resultat + porta-retalls + piulet
            └── classificacio.js  enviar/llegir el rànquing
```

### `principal.js` — el fil conductor

L'únic mòdul amb estat global de debò:

```js
const estat = { mode, dificultat, segons, dialecte, partida, ultimResum, data };
```

Lliga els botons amb les pantalles, demana les dades, construeix la `Partida`, i
quan s'acaba desa el rècord i pinta el final. No hi ha router ni framework:
`mostrarPantalla()` posa `hidden` a totes les `<section class="pantalla">` menys
una.

La paraula de cada partida es decideix aquí: **`seleccioDelDia(data,
dificultat)`** treu les dues paraules del dia (`eres.js`) amb les manuals
d'`especials.js` i en resol la clau i el grup al dialecte que es juga
(`resoldreDeLEra`), i la fan servir la partida diària i la pantalla d'ahir;
**`seleccioIllimitada()`** tria entre l'il·limitat natiu (`illimitat.js`,
apartat 7 ter) i el de sempre.

**L'arrencada és asíncrona** i té un ordre que importa: primer el `versions.json`
(per saber quins dialectes hi ha), després `dialecte.inicial()` (per saber quin
es juga), després la tira, i tot seguit l'`index.json` d'aquell dialecte, que es
demana sense esperar-lo perquè estigui a punt abans que ningú premi cap botó. Si
el `versions.json` no arriba, es juga en central i prou.

### `dades.js` — versions, descàrrega i lectura

- `carregarVersions()` — el `versions.json`, sempre amb `?t=` i mai cachejat. Si
  falla, estira dels resums desats al `localStorage` (apartat 9).
- `carregarIndex()` — l'índex dels quatre dialectes; `indexDe(index, codi)` en
  treu el tros d'un.
- `carregarEres()` i `carregarEspecials()` — l'`eres.json` (que va pel
  `versions.json`, amb `?v=`) i l'`especials.json` (que va amb `?t=`), amb una
  còpia al `localStorage` (`rimador.joc.eres.v1` i `rimador.joc.especials.v1`) per
  si no hi ha xarxa.
- `resoldreDeLEra(index, dialecte, eraId, indexParaula)` — a quina clau i grup del
  dialecte cau una paraula de l'era, segons el bloc `eres` de l'índex.
- `trobarObjectiu(dialecte, normalitzada)` — busca una paraula manual al fitxer del
  dialecte (les manuals no són a l'índex) i en treu la clau, el grup i la forma per
  mostrar.
- `carregarDialecte(codi)` — el fitxer, com a `ArrayBuffer`. Guarda **la
  promesa**, no el resultat, de manera que la precàrrega de l'arrencada i una
  partida que comenci mentre baixa no en fan dues descàrregues.
- `grupDeRimes(codi, numeroDeGrup)` — descodifica i parteix **només** el tros que
  diu l'índex. El grup interpretat també es guarda: repetir-hi no costa res.
- `respostesValides(grup, clau, dificultat)` — el `Map` de respostes: en
  **difícil** una còpia de la secció; en **fàcil** la fusió de totes les seccions
  del grup. Les paraules de l'apèndix del dialecte hi són com qualsevol altra:
  al fitxer no es distingeixen de la resta, només que no duen marca d'objectiu.

L'anàlisi (`analitzar`) recorre el tall una vegada comparant codis de caràcter
(`35` = `#`, `42` = `*`, `43` = `+`) i deixa cada secció com
`{ paraules, objectius, objectiusArreu }`: totes les paraules del `Map`, les que
poden ser objectiu al personalitzat i les que ho poden ser a tot arreu.

### `dialecte.js` — quin dialecte es juga

La germana de `dialecteInicial` / `lligarTriaDeDialecte` de `js/script.js`, amb
les mateixes regles i **la mateixa clau de `localStorage`**:

1. El `?d=` de l'adreça, si el codi existeix. **No es desa**: obrir l'enllaç que
   t'ha passat algú val per a aquella visita i no t'ha de canviar el de sempre.
2. El que hi hagi desat a `rimadorDialecte`.
3. El central.

Triar-ne un a la tira sí que el desa i l'escriu a l'adreça amb `replaceState`
(no `pushState`: triar un dialecte no és anar a cap altra pàgina).

Els codis vàlids no són aquí: els passa `principal.js` a partir del
`versions.json`.

### `objectius.js` — quina paraula toca

- **`llavor(text)`** — variant de cyrb53: barreja els bits d'una cadena en un
  enter de 32 bits.
- **`generador(sembra)`** — mulberry32, un PRNG petit i **determinista**.
- **`triarClauPerRima(index, aleatori)`** — una clau a l'atzar amb **totes igual
  de probables**. La fan servir els dos modes.
- **`clauAleatoria(index)`** — la de l'il·limitat: la de sobre amb `Math.random`.
- **`rodaDelDia(diaries, dataISO, dificultat)`** i **`ordreDeLaRoda`** — la roda
  d'abans (l'era 0, apartat 7): la barreja de Fisher-Yates d'un cicle i la paraula
  que hi toca. Ja no les crida el joc directament, sinó `eres.js`.
- **`paraulaDelDia(index, dataISO, dificultat, dialecte)`** — la mateixa roda
  sobre l'índex vell. El joc ja no la fa servir; es conserva com a referència de
  les proves (l'era 0 ha de donar exactament el mateix).
- **`llavor`** i **`generador`** s'exporten: les fan servir `bosses.js`,
  `especials.js` i el panell.
- **`triarParaula(grup, clau, aleatori, arreu)`** — la paraula concreta dins
  d'una secció. Amb `arreu` (els modes normals) només tria d'entre les que es
  poden rimar als quatre dialectes; el personalitzat li passa `false` i les vol
  totes.

Hi havia hagut una **tria ponderada** (cerca binària sobre la suma acumulada
dels objectius, amb l'acumulat en un `WeakMap`) per fer que cada *paraula* fos
igual de probable. Va fora: era el que deixava que les terminacions grosses es
quedessin la meitat de les partides.

### `eres.js` — la paraula del dia

La fórmula de l'apartat 7. Només enters i funcions pures: importa `bosses.js` i
`objectius.js` i res més.

- **`eraDelDia(eres, dataISO)`** — la darrera era que ja ha començat.
- **`formulaDelCarril(era, carril, dataISO, prohibida)`** — què dona la fórmula un
  dia i en un carril: bossa, volta, clau, variant, paraula. Si la paraula és la
  `prohibida` (la del difícil, quan es calcula el fàcil), passa a una altra.
- **`parellaDelDia(eres, dataISO, manuals)`** — les dues paraules del dia, amb la
  manual per sobre de la fórmula si n'hi ha.
- **`estatDeSortida(era, carril, finalISO)`** i **`estatDeLaRoda`** — on s'ha
  quedat una era quan en comença la següent: ho fa servir el congelador.

### `bosses.js` — el patró i les baralles

Les peces comunes de la paraula del dia i de l'il·limitat natiu:
**`patroDeBosses(quotes)`** (l'ordre en què surten les bosses),
**`bossaDelDia(patro, dia)`** (quina surt i quantes vegades havia sortit) i
**`crearBaralles({ llavorBase, claus, sortides })`** (la clau de cada sortida, per
voltes). Només enters i `llavor`/`generador`: cap `Math.random`, cap `Date.now`,
perquè la paraula del dia és la mateixa per a tothom.

### `especials.js` — les paraules manuals

`manualsDelDia(especials, dataISO)` troba l'entrada del dia pel seu resum i la
desxifra; `xifrar` fa l'operació inversa, i només la fa servir `manuals.mjs`. El
format és a l'apartat 7.

### `illimitat.js` — l'il·limitat natiu

`configNativa(index, dialecte, carril, era)` (les bosses de l'era amb les claus
del dialecte), `triarNativa(config, usuari, comptador, prohibida)` (la rima de la
partida següent d'un jugador) i `triarParaulaNativa(grup, clau, aleatori,
homografs)`. Funcions pures: el comptador el porta `magatzem.js`. Apartat 7 ter.

### `motor.js` — la partida

Una classe `Partida` que **no toca el DOM**: avisa amb els *callbacks* `alTic` i
`alFinal`.

- **El rellotge**: `setInterval` cada 100 ms perquè es vegi fluid, però el temps
  de veritat el marca `instantFinal = Date.now() + segons * 1000`. Si el
  navegador s'atura (pestanya de fons, mòbil que s'adorm), no es descompensa.
- **`provar(text)`** retorna un dels cinc `RESULTAT`: `BUIT`, `OBJECTIU`,
  `REPETIDA`, `NO_RIMA` o `ENCERT`. En aquest ordre exacte.
- **La paraula objectiu no val com a resposta**: el constructor fa
  `this.respostes.delete(objectiu.normalitzada)`. Pot fer-ho sense por perquè
  `respostesValides()` sempre torna un `Map` nou.
- **Les errades no s'apunten**: provar dues vegades una paraula que no rima torna
  a dir "No rima" i no pas "Ja introduïda".

### `normalitza.js` — el contracte amb el Python

Vint-i-set línies, però són **la peça més delicada del joc**:

```js
.trim().toLowerCase()
.replace(/’/g, "'")     // apòstrof tipogràfic
.replace(/·/g, '')      // el punt volat de la l·l
.normalize('NFD').replace(/[̀-ͯ]/g, '')   // fora diacrítics, cedilla inclosa
```

Ha de **coincidir exactament** amb `normalitzar()` de `generar_dades.py`. Si es
desincronitzen, hi ha paraules del fitxer que el joc no reconeixerà mai, i **no
hi haurà cap error visible**: simplement dirà "No rima" a coses que hi rimen.

### `ui.js` — tot el DOM

- `preparar()` omple l'objecte `el` amb tots els `getElementById`.
- `grupOpcions()` converteix un grup de `<button class="opcio">` en un
  *radiogroup* accessible, amb `valor()`, `seleccionar()` i `activar()`.
- `pintarTiraDialectes()` pinta la tira **tal com li arriba** la llista: no sap
  quins dialectes hi ha ni com es diuen.
- `texteBoto()` existeix perquè els botons de l'arc de Sant Martí porten el text
  dins d'un `<span>`.
- `animarEntrada()` força un *reflow* perquè l'animació es torni a disparar quan
  es repeteix el mateix resultat.
- `filaRecord()` és compartida per "Els meus rècords", la classificació per
  modalitats i la de cada dia, i `bombolla()` és la caixa que les recull: una
  capçalera que diu què s'hi mira i les files a sota. Les dues pantalles en
  pinten unes quantes, amb el rosa del fons entremig. El `subtitol` pot ser un
  text o un node, que és com el resum del mode personalitzat hi encasta l'enllaç
  a les rimes de cada ronda.
- `enllacDeRimes()` fa l'enllaç de **«x rimes possibles»** de la pantalla de
  final: `../?q=<paraula>&d=<dialecte>` i, en fàcil, `&rima=assonant`. Són els
  tres paràmetres que el cercador ja entén (vegeu `cercarDesDeLaURL` i
  `dialecteInicial` a `js/script.js`), i va amb `../` i no pas amb una adreça
  absoluta, com la resta dels enllaços del joc, perquè també funcioni al
  repositori de proves. És la sortida natural d'aquella pantalla: acabes de
  llegir que la paraula en tenia dues-centes i el que vols és saber quines.
- `pintarJugador()` i `estatSobrenom()` són el bloc «Qui juga» de la pantalla de
  configuració, que és on ara es tria el nom (apartat 8).
- `pintarRecords()` **agrupa els rècords per modalitat**, una bombolla cada una.
  Abans eren una sola llista ordenada de més punts a menys, i això no comparava
  res: en tres minuts en fas més que en quaranta-cinc segons sempre, o sigui que
  el "Lent" es quedava dalt de tot i el "Llampec" al fons diguessin el que
  diguessin. El teu millor llampec no és pitjor que el teu millor lent; són
  partides diferents. Dins de cada bombolla hi ha **una fila per dialecte** —que
  és com es guarden— amb **quina paraula** et va tocar.

### `magatzem.js` — el que es recorda

Tot embolcallat en `try/catch`: en navegació privada el `localStorage` peta i el
joc ha de continuar funcionant igual.

| clau | què hi ha |
|---|---|
| `rimador.joc.records.v2` | `{ "illimitat\|dificil\|30\|va": { punts: 12, paraula: "ferretera" }, … }` |
| `rimador.joc.diaria.v2` | `{ data: "2026-08-29", partides: { "facil": {…} } }` |
| `rimador.joc.sobrenom.v1` | el sobrenom de la classificació (el tries tu o te'l posa el joc) |
| `rimador.joc.versions.v1` | còpia dels resums, per si el `versions.json` falla |
| `rimador.joc.eres.v1` | còpia de l'`eres.json`, per si no hi ha xarxa |
| `rimador.joc.especials.v1` | còpia de l'`especials.json` |
| `rimador.joc.illimitat.v1` | `{ "ca\|facil": 12, … }`: les partides fetes a l'il·limitat natiu, per dialecte i dificultat |
| `rimadorDialecte` | **compartida amb el cercador** |
| `rimador_usuari_id` | **compartida amb el cercador** |

Un rècord desat pot ser un **número** (com es guardava abans de recordar amb
quina paraula el vas fer) o un **objecte** `{ punts, paraula }`. El `magatzem.js`
llegeix les dues formes i prou: afegir la paraula no havia de fer fora els
rècords de ningú, i un de vell val exactament igual encara que no sapiguem amb
quina paraula es va fer. El dia que en facis un de nou ja quedarà desat sencer.
No hi ha `v3` ni cap migració, doncs, perquè no hi ha res a migrar: la paraula
d'un rècord vell no se la pot inventar ningú.

- **Els rècords van per modalitat**, amb l'identificador
  `mode|dificultat|segons|dialecte`.
- **La migració v1 → v2** es fa un sol cop, en carregar el mòdul: els rècords
  vells (de tres trossos) eren tots en central i se'ls hi posa el codi `ca`.
  Després, la clau v1 s'esborra.
- **De la paraula del dia només es desa el dia d'avui.** Quan canvia la data,
  l'entrada vella se substitueix sencera i el magatzem no creix mai. La clau va
  per dialecte, perquè cadascun té la seva paraula.

`avui()` fa servir l'**hora local** del navegador, no UTC.

### `compartir.js` — el text del resultat

Una frase i prou:

```
Paraula del dia del Rimador.cat (8/9/2026): 12 rimes amb «quarts», en difícil i
en central. Juga-hi tu: rimador.cat/joc
```

Hi surt **de quina partida es tracta** (el mode, i el que la fa identificable: el
dia a la diària, el rellotge a l'il·limitat), **la paraula que tocava**, quantes
en vas trobar, la dificultat i el dialecte.

**La paraula abans no hi sortia**, per no espatllar-li el dia a qui encara no hi
hagués jugat. És un canvi de criteri: «12 rimes» tot sol no vol dir res —no es
pot saber si és molt o poc sense saber amb què—, i sense la paraula dos resultats
no es podien comparar, que és de què va compartir-ho. El preu és que qui llegeixi
el piulet abans de jugar ja sabrà quina paraula li tocarà.

El **dialecte** hi va sempre: la paraula del dia és la mateixa per a tothom, però
les rimes que valen no —en central en pot haver-hi la meitat que en valencià amb
la mateixa paraula—, i sense dir-lo dos resultats del mateix dia no es podrien
comparar i ningú no sabria per què.

**Abans era una graella de quadrets** a l'estil del Wordle (`■■■■■` / `■■□□□`).
Allà els quadrets són el joc —cada fila és un intent i cada color una pista—, i
aquí només eren una barra de progrés feta a mà que repetia el número de dues
maneres; a més, segons la lletra de cada aparell sortien desalineats o com a
requadres buits. La frase és més curta, es llegeix a la primera i cap sencera en
un piulet.

`compartirResultat()` prova `navigator.share`, i si no hi és cau al porta-retalls:
primer `navigator.clipboard`, i si tampoc, el `<textarea>` amagat amb
`document.execCommand('copy')`.

Al costat del botó gros hi ha el de **piular**, que és el mateix
`#compartirButton` del cercador (vegeu `actualitzarBotoCompartir` a
`js/script.js`): petit, blau i amb l'ocell. `enllacDeTwitter(text)` en munta
l'adreça d'intenció (`x.com/intent/post?text=…`) amb **el mateix text** que es
copia, i el `principal.js` li posa l'href en acabar la partida.

Tots dos botons només surten a la **paraula del dia**, que és l'única modalitat
que tothom juga igual el mateix dia. El `textPerCompartir()` sap escriure també
la frase de l'il·limitat (`Il·limitat del Rimador.cat (30 s): …`) per si algun
dia s'hi vol posar el botó: només caldria treure'n la condició de
l'`acabarPartida()`.

### `classificacio.js` — el rànquing

Vegeu l'apartat 8.

---

## 6. El flux d'una partida

### El loader

Preparar una partida amb el fitxer ja baixat són 90 ms: ensenyar un loader seria
una fuetada de pantalla que no informa de res. Per això no s'ensenya de cop, sinó
que **es demana amb 150 ms de retard** (`ESPERA_ABANS_DEL_LOADER`), i si la
partida s'ha preparat abans, no arriba a sortir. Comprovat: al camí ràpid,
l'atribut `hidden` del loader no canvia ni una vegada.

Quan sí que surt, no és una rodona i prou. `dades.js` llegeix el cos de la
resposta per trossos (`body.getReader()`) i va avisant de quants bytes porta;
`escoltarProgres(codi, fn)` deixa que la pantalla s'hi enganxi **encara que la
descàrrega l'hagi començada la precàrrega fa estona**, perquè l'últim estat es
guarda i s'entrega de seguida a qui arribi tard.

El total NO surt del `Content-Length`: amb `Content-Encoding: gzip` aquella
capçalera diu la mida **comprimida** i el lector va donant bytes ja
descomprimits, o sigui que el percentatge aniria fins al 400 %. Surt del camp
`bytes` que el generador escriu a l'índex, que és la mida de debò.

Si el navegador no dona un cos llegible, es cau a `arrayBuffer()` i el fitxer es
baixa igual, només que sense percentatge.

```
arrencar()
   ├─ carregarVersions()          dades/versions.json?t=…
   ├─ dialecte.inicial(codis)     ?d= → localStorage → 'ca'
   └─ precarregar(dialecte)       dades/index.json?v=…  +  dades/<codi>.txt?v=…
                                  + dades/eres.json?v=…  +  dades/especials.json?t=…
                                  (sense esperar-los: baixen mentre tries)

comencarPartida()
   │
   ├─ (sense sobrenom no s'hi arriba: el botó de començar és bloquejat)
   ├─ prepararParaula()
   │     ├─ indexDe(await carregarIndex(), dialecte)
   │     ├─ seleccioDelDia(data, dif)  o  seleccioIllimitada()
   │     ├─ grupDeRimes(dialecte, grup)          talla el tros i el parteix
   │     ├─ triarParaula(grup, clau)             → { normalitzada, mostrar }
   │     └─ respostesValides(grup, clau, dif)    → Map<normalitzada, mostrar>
   │
   ├─ ui.pintarObjectiu() / ui.mostrarPantalla('joc')
   └─ new Partida({…}).comencar()
            │  cada 100 ms → alTic  → ui.actualitzarRellotge()
            │  cada Enter  → provar() → ui.avisar() / ui.afegirTrobada()
            ▼
        alFinal(resum)  →  acabarPartida()
            ├─ desarRecord(identificador, punts, paraula)
            ├─ desarResultatDiari()   (només en mode diària)
            ├─ ui.pintarFinal()        amb l'enllaç de «x rimes possibles»
            ├─ enviarResultat()        POST sol: el nom ja el sabíem d'abans
            └─ mostrarEstadistiques()  percentil i mitjana, quan arribi el JSON
```

---

## 7. La paraula del dia

N'hi ha **DUES al dia i prou** —una de fàcil i una de difícil— i són **les
mateixes per a tothom**, jugui en el dialecte que jugui. No hi ha cap servidor
que les digui: tothom les calcula a partir de la data i d'uns fitxers que són al
repositori (`eres.json`, que diu què hi ha congelat, i l'`index.json`, que diu on
cau cada paraula a cada dialecte), i d'una paraula manual de `especials.json` si
aquell dia n'hi ha una.

El que canvia amb el dialecte no és la paraula sinó **quines rimes hi valen**.
L'11 de setembre del 2026, el difícil era *rimes* per a tothom, i la secció on cau
té 70 rimes en central, 70 en nord-occidental, 74 en valencià i 70 en balear; el
fàcil, *dialecte*, en tenia 13.143 en central, 2.355 en nord-occidental, 2.704 en
valencià i 7.909 en balear. És exactament de què va el lloc.

> Tot aquest apartat és el resultat de [`PROPOSTA_TRIA_DE_PARAULES.md`](PROPOSTA_TRIA_DE_PARAULES.md),
> que explica **per què** cada decisió és com és. Aquí només hi ha **com
> funciona**. La proposta, a més, porta una nota d'on s'ha desviat la
> implementació.

### Les eres: què es congela i per què

Una **ERA** és una data d'inici, unes bosses amb les seves quotes i el contingut
de cada bossa congelat. Dura fins que comença la següent, i l'última, per sempre.

**No es congelen dies, els dies es calculen**: el que es congela és quines claus
hi ha a cada bossa, en quines variants es parteixen i quines paraules se'n
guarden. Amb quines rimes es juga ho decideix sempre el diccionari del moment, i
per això corregir una transcripció no demana cap era nova. Dins d'una era, la
paraula d'un dia és una **funció pura** de la data i del que hi ha congelat: no
es desa res ni es recorre cap historial, i tothom que té els mateixos fitxers
treu la mateixa paraula.

Les normes (les fa complir `congelar_era.py`):

- Una era **començada no es toca**. Una de futura només es pot substituir mentre
  en falten set dies o més.
- Una era nova **comença com a mínim d'aquí a set dies**: és el marge per a qui
  tingui una còpia desada sense xarxa.
- Les paraules que ja eren a l'era anterior **mantenen la seva posició** i les
  noves van al final de la llista, perquè la baralla del dia no es mogui.

### La fórmula, en tres passos

Cada dia, per a cada carril (**difícil** = rima consonant, **fàcil** = rima
assonant):

```
1. Quina bossa      el patró ponderat de les quotes             (bosses.js)
2. Quina clau       la baralla de la bossa, volta a volta       (bosses.js)
3. Quina paraula    la variant i la rotació de la clau          (eres.js)
```

**1. La bossa.** Les claus es reparteixen per trams de rimes (les **bosses**: de
15 a 34 rimes, de 35 a 49…) i cada bossa té una **quota** en per mil, enters, que
sumen 1.000. Una bossa del 4 % surt 40 dies de cada 1.000 tingui les claus que
tingui. L'ordre el fa un repartiment *suau* (`patroDeBosses`): a cada pas cada
bossa suma la seva quota al seu «deute»; surt la que en té més —en cas d'empat,
la de número més baix— i se li resta W. Passats W dies tots els deutes tornen a
zero, el patró es repeteix, i **cada bossa hi surt exactament tantes vegades com
diu la quota**.

> ⚠️ **L'error d'un dia no és general.** Amb les quotes per defecte el patró no
> s'allunya mai d'un repartiment exacte en més de 0,800 dies (difícil) i 0,865
> (fàcil), però amb unes quotes qualssevol pot arribar a una mica més d'un dia
> (s'ha vist 1,05). El panell ho calcula amb el codi del joc i en dona l'avís.

**2. La clau.** Cada bossa té la seva **baralla**: les seves claus en ordre
canònic (alfabètic), barrejades per voltes amb Fisher-Yates sembrat amb
`<era>-<carril>-<bossa>-<volta>`. Cada cop que surt la bossa en surt la clau
següent de la baralla; **no se'n repeteix cap fins que s'han fet servir totes**,
i la regla de l'empalmament (si la primera d'una volta fos la darrera de
l'anterior, s'intercanvia amb la segona) evita que una clau surti dos cops
seguits. La primera volta d'una era posa al final les claus que ja havien sortit
a la volta a mitges de l'era anterior (`entrada.sortides`): el canvi d'era no
repeteix res.

**3. La paraula.** Una clau no és una paraula: és **un grapat de variants**, i
cada variant, un grapat de paraules. Una *variant* agrupa les paraules que tenen
la mateixa clau als altres tres dialectes (`ca|nw|va|ba`), perquè la rotació
passi per tots els «dibuixos» de rima que té la clau. La clau porta un comptador
de les vegades que ha sortit (`t`: les d'abans de l'era —`entrada.comptadors`—
més les voltes d'aquesta), i toca:

```
variant   = t mod nVariants
paraula   = floor(t / nVariants) mod paraules de la variant
```

Així cada variant té el seu torn, i dins de cada variant cada paraula el seu.

**El fàcil no repeteix el difícil.** Si el mateix dia les dues sortissin
iguals, el fàcil passa a la paraula següent de la seva variant (o a la variant
següent, si només en té una). És una regla fixa, igual per a tothom. Si la clau
no té cap altra paraula (una variant d'una sola paraula) no hi ha alternativa i
es queda la que toca: més val repetir un dia que inventar-se una paraula de fora
de la clau.

#### Quines paraules entren a una era

Una paraula pot ser a una era si és **jugable als quatre dialectes**:

- és objectiu (`*`) a tots quatre fitxers, i cau a **una sola clau consonant** a
  cada dialecte (sense homògrafs: *dona* / *dóna*);
- aquella clau és **publicada** (almenys dues rimes);
- el nombre de rimes de la seva clau, a cada dialecte, és dins de la **tolerància**
  respecte de les que té la clau al central (`n`): `n / f ≤ rimes ≤ n · f`, amb
  `f = 2` per defecte (×0,5–×2). Al fàcil és el mateix, amb les rimes de cada
  grup assonant. Es calcula amb fraccions.

**No hi ha cap mínim de paraules per variant**: les variants d'una sola paraula
que passen la tolerància surten a l'informe de congelar, per revisar-les a mà
(n'hi ha de legítimes, com *axis*, i n'hi ha que fan pensar en un error de
transcripció). Una clau que no té cap variant dins de la tolerància no entra a
cap bossa en tota l'era: surt a l'informe, i continua valent com a resposta i es
pot jugar a l'il·limitat i al personalitzat.

De cada variant es guarden les `paraules_per_variant` primeres en un ordre que no
depèn de l'ordre del diccionari (`barreja_estable`): 10 al difícil i 200 al
fàcil, que hi té variants de milers. Al fàcil, a més, **hi van primer les
paraules que no són a cap llista del difícil**, perquè la regla de dalt s'hagi
d'aplicar poques vegades.

### L'era 0: la roda d'abans

Els dies que ja han passat **no es poden moure**: la pantalla d'ahir, l'historial
i el que la gent ha compartit s'hi basen. Per això l'**era 0** (`inici:
2026-01-01`, `algorisme: 0`) és la roda d'abans, **congelada**: duu una còpia de la
llista del bloc `diaries` de l'`index.json` (1.405 paraules en 354 claus) i es
calcula amb el codi de sempre (`rodaDelDia` a `objectius.js`):

```js
const dia     = diaDeLaRoda(dataISO);            // dies des de l'època
const cicle   = Math.floor(dia / quantes);       // quantes = les claus de la roda
const posicio = ((dia % quantes) + quantes) % quantes;

const clau = ordreDeLaRoda(quantes, `${cicle}-${dificultat}`)[posicio];
```

Els dies es parteixen en **cicles tan llargs com claus hi ha**; dins del cicle,
la posició diu quina clau toca, seguint una barreja de Fisher-Yates sembrada amb
el número de cicle i la dificultat (i la dificultat hi entra perquè el fàcil i el
difícil recorrin la roda en ordres diferents). La paraula de la clau es tria
amb el mateix criteri. **No es desa enlloc què ha sortit.**

L'era 0 **no aplica** la regla «el fàcil no repeteix el difícil», que la roda
d'abans no tenia: afegir-la ara faria canviar paraules que ja han sortit. Es va
comprovar que la nova implementació dona, amb les dades d'abans, **exactament la
mateixa paraula tots els dies** (5.840 comparacions, cap diferència; i un
control negatiu que n'hi troba 52 quan es canvia res).

El bloc `diaries` continua a l'índex perquè és d'on l'era 0 va treure les seves
paraules; el projecte el retirarà quan la roda ja no calgui.

### Els fitxers de les eres

**`dades/eres.json`** — `{ "v": 1, "eres": [era, …] }`, una era per línia (un
canvi s'hi veu a la `diff`). Va pel `versions.json`, igual que l'índex, o sigui
que arriba sempre a la vegada amb el que en resol les paraules.

```json
{ "id": 1, "inici": "2026-12-01", "algorisme": 1,
  "paraules": ["pare", "cami>camí", …],           totes les paraules de l'era (forma normalitzada [>forma per mostrar])
  "carrils": {
    "dificil": {
      "des_de": 15, "tolerancia": 2, "paraules_per_variant": 10,   informatius
      "bosses": [{ "de": 15, "fins": 34, "quota": 10,
                   "claus": [{ "c": "aɾə", "n": 102,
                               "v": [[3, 7], [12]],              variants, amb posicions de `paraules`
                               "p": ["aɾə|aɾə|aɾə", "…"] }] }],  claus als altres dialectes (nw|va|ba)
      "entrada": { "comptadors": { "aɾə": 4 }, "sortides": ["bɔ"] } },
    "facil": { … } } }
```

`c` és la clau consonant del central (difícil) o el seu grup assonant (fàcil);
`n` és el nombre de rimes que tenia quan es va congelar. **`n` i `p` són només
per a les comprovacions** de `generar_dades.py`: el joc no les llegeix.
`entrada` és l'estat de sortida de l'era anterior (vegeu més amunt), que calcula
l'script de congelar amb node.

**`dades/eres_arxiu.json`** — les eres més velles que l'anterior a la vigent. El
joc no el carrega; serveix per a la història. (No existeix fins que hi hagi tres
eres.)

**`index.json`, bloc `eres`** — de cada paraula de cada era, a cada dialecte, **la
posició de la seva clau dins del `claus` del dialecte** (o `-1` si no es pot
jugar):

```json
"eres": { "0": { "ca": [88, 412, -1, …], "nw": […], "va": […], "ba": […] }, "1": { … } }
```

És el que permet al joc trobar el grup i la secció de la paraula del dia al
dialecte que sigui, sense buscar-la enlloc (`resoldreDeLEra` a `dades.js`). El fa
`generar_dades.py` a cada passada de tots els dialectes.

### Congelar una era

```bash
python3 joc/eines/bosses_rimes.py        # el panell: tria talls, quotes, tolerància i paraules per variant
                                         # → el botó d'exportar escriu config_era.json: mou-lo a joc/eines/
python3 joc/eines/congelar_era.py --inici 2026-12-01 --simula   # tot l'informe, sense escriure res
python3 joc/eines/congelar_era.py --inici 2026-12-01            # escriu eres.json (i eres_arxiu.json)
python3 joc/eines/generar_dades.py                              # resol les paraules a l'índex i comprova
```

- **El panell** (`bosses_rimes.py`) és una pàgina local que **no toca res**: hi
  veus, per a cada carril i abans de congelar, quantes claus entren a cada
  bossa i cada quan torna una clau, quines en queden fora, la dificultat que en
  surt, cada quan torna la mateixa paraula, què faria l'il·limitat natiu a cada
  dialecte, l'error del patró i una previsió dels propers dies. Fa servir el
  codi del joc **tal com és** (`llavor`, `generador` i tot `bosses.js` s'hi
  copien en temps de generació): cap còpia escrita a mà.
- **`congelar_era.py`** aplica les normes de dalt, normalitza les quotes, **refusa
  una bossa amb quota i cap clau**, i desa l'informe a
  `joc/eines/informe_era.txt`. `--per-defecte` fa servir la proposta de
  `PER_DEFECTE` (a `bosses_rimes.py`) en comptes del panell, i `--substitueix`
  refà una era futura. L'estat de sortida de l'era anterior el calcula **node**
  (`formula.mjs`): Python no té cap còpia de la fórmula.
- **L'era 0** es va congelar amb `congelar_era.py --era0`; només es fa un cop.
- Després **cal tornar a passar `generar_dades.py`**: l'índex ha de portar on cau
  cada paraula de l'era nova a cada dialecte.

`config_era.json` i `informe_era.txt` són locals (al `.gitignore`).

### Les comprovacions de cada passada de `generar_dades.py`

El que es congela és la paraula que surt cada dia, no pas amb quines rimes es
juga, i per això un canvi al diccionari no trenca l'era: es continua jugant amb
les rimes noves. Però pot deixar una paraula que ja no es pot jugar o
desequilibrar el que es va triar, i per això a **cada passada de tots els
dialectes** es mira **cada paraula** de l'era vigent i de les futures (no pas
només les editades: la bossa d'una paraula depèn de quantes rimes té la seva
clau, i aquest nombre canvia quan es corregeixen **altres** paraules de la
mateixa clau). Ho fa `comprovar_eres.py`.

| nivell | què | què passa |
|---|---|---|
| **ERROR** | una paraula congelada ja no es pot jugar en algun dialecte (ja no és objectiu, cau a dues claus o a una clau amb massa poques rimes) | **no es publica res**: l'script surt sense escriure cap fitxer, amb una substitució proposada |
| avís | una clau ha canviat de bossa (la del costat només compta; si salta dues bosses o més, surt amb nom), una variant ha sortit de la tolerància, o una paraula ha canviat de rima en algun dialecte | s'imprimeix i prou |
| suggeriment | s'ha desplaçat més de l'1 % de les claus de l'era, o hi ha un 1 % de claus noves que podrien entrar | convé una era nova; no trenca res |

Si hi ha un error, **`python3 joc/eines/generar_dades.py --aplica-substitucions`**
canvia la paraula **al mateix lloc**: n'hi posa una altra de la mateixa clau (i
variant, si pot ser), afegida al final de la llista, i en repunta l'entrada. **No
s'esborra mai cap paraula**: desplaçaria la baralla i mouria tots els dies. La
vella es queda a la llista, sense cap referència, i ningú no la comprova més.
Amb l'error, l'informe diu el primer dia futur en què hauria sortit cada paraula.
La passada parcial (`generar_dades.py ca va`) no comprova res.

Les eres passades només es conserven perquè la pantalla d'ahir sàpiga dir la
paraula dels dies del canvi. **L'era 0 també es pot substituir** al lloc.

### Les paraules manuals (`especials.json`)

Un dia assenyalat pot tenir la seva paraula (*pessebre* per Nadal). Se
n'escriuen a mà, **en local i en clar**, a `joc/eines/diaries_manuals.json`
(al `.gitignore`: allà no hi ha d'haver res publicat):

```json
{ "2026-12-25": { "facil": "pessebre", "dificil": "torró" },
  "2027-01-06": "reis" }
```

Amb un objecte es diu una paraula per dificultat (se'n pot deixar una a la
fórmula); amb una cadena, la mateixa per a totes dues. Les dels dies passats
s'hi han de conservar: les fan servir la pantalla d'ahir i l'historial.

```bash
node joc/eines/manuals.mjs               # valida i escriu joc/dades/especials.json
node joc/eines/manuals.mjs --simula --detall
python3 joc/eines/comprovar_diaries_manuals.py    # el mateix: només engega el de node
```

**Què es comprova**, perquè mai hi hagi una paraula manual que valgui en uns
dialectes i en uns altres no: que a **cada dialecte** sigui paraula a rimar
(marcada amb `*` o `+`), que hi caigui a **una sola clau** consonant i que la
clau sigui **publicada**. Si no ho compleix, **no s'escriu res**. I **s'avisa**,
sense fallar, si repeteix la paraula o la clau d'un dia de la fórmula a menys de
30 dies (amb el mateix codi del joc).

**El format**: `{"v": 1, "dies": {"<resum de la data>": "<base64>"}}`. La clau és
un resum de la data (16 xifres hexadecimals), o sigui que **les dates no es
veuen**; el valor són 96 bytes: la paraula del fàcil i la del difícil, omplertes
amb espais i barrejades (XOR) amb una seqüència de `generador(llavor(sal +
data))`. Totes les entrades fan la mateixa mida, i van ordenades pel resum. És
**ofuscació, no seguretat**: el que pot llegir el navegador, ho pot llegir
qualsevol que sàpiga programar. Enlloc no hi ha cap fitxer públic amb dates i
paraules en clar.

**Al joc**, una manual **mana sobre la fórmula, però el dia compta igualment**:
la fórmula es calcula igual, de manera que la bossa i la volta no es desquadren
i **no es mou cap altre dia**. Se'n desxifren les d'avui i d'ahir
(`manualsDelDia`), i la forma per mostrar surt del fitxer del dialecte que es
juga. Si en aquell dialecte la paraula ja no és objectiu —el diccionari pot haver
canviat—, el joc fa servir la de la fórmula i ho diu a la consola: val més una
paraula automàtica que cap. I si el difícil és manual, **el fàcil tampoc no pot
ser aquella paraula**.

`especials.json` **no** passa pel `versions.json`: es demana sempre amb `?t=`, de
manera que s'hi poden afegir dies sense tocar res més. Una còpia es guarda al
`localStorage` per si no hi ha xarxa.

> Les dues manuals que es van comitejar abans d'això (23-4-2027 i 11-9-2027) són
> a l'historial de git, **en clar**.

### La previsió

```bash
node joc/eines/previsio.mjs                                   # els propers 30 dies, en text
node joc/eines/previsio.mjs --dies 90 --des-de 2026-12-01 --detall
node joc/eines/previsio.mjs --html                            # pàgina local: joc/eines/previsio.html
node joc/eines/previsio.mjs --manuals                         # hi suma les manuals en clar, encara sense publicar
node joc/eines/previsio.mjs --json                            # per a altres programes (el bot)
```

Per a cada dia i carril diu la bossa (amb el seu tall i la seva quota), la clau,
la variant, la paraula, **quantes rimes té a cada dialecte** i si és manual (amb
la paraula que hauria donat la fórmula). **No té cap còpia de la fórmula**:
importa `eres.js` i `especials.js`, els mateixos del navegador, i desxifra
`especials.json` com ell. Substitueix `predictor.py`, que era un port a Python.
Surt en local (`previsio.html`, `.txt` i `.json` són al `.gitignore`).

**Val mentre no es congeli cap era nova**; dins de l'era vigent, només la poden
canviar les substitucions al lloc i les manuals.

El **bot de tuits** (`bot/generador_tuits.py`, `paraula_del_joc`) crida aquest
script per saber la paraula d'ahir: `node` ha d'estar instal·lat on corri el bot.

### Altres detalls que importen

- **La data és la de Catalunya**, no la del rellotge de qui juga. L'`avui()` de
  `js/magatzem.js` la calcula a `Europe/Madrid`:

  ```js
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  ```

  L'`en-CA` no és cap caprici: és l'única localització que dona `AAAA-MM-DD`
  directament, que és el format que fan servir el bloqueig diari, el
  `DataPartida` que viatja amb cada puntuació i les claus del bloc `diaria` del
  `classificacio.json`. El resultat es comprova amb una expressió regular abans
  de donar-lo per bo, i si el navegador no té dades de fusos horaris es cau a
  l'hora local. Les eines de node (`manuals.mjs`, `previsio.mjs`) compten el dia
  igual.

  Abans es feia amb `new Date()` i `getFullYear`/`getMonth`/`getDate`, que són
  l'hora del navegador: a Tòquio la paraula nova sortia set o vuit hores abans
  que a Barcelona i qui tingués el rellotge mal posat en veia una altra. Com que
  la paraula del dia és «la mateixa per a tothom», el dia l'ha de dir **un sol
  rellotge**, i és el mateix fus amb què el full de la classificació apunta quan
  arriba cada puntuació (vegeu `Europe/Madrid` a `apps_script_classificacio.gs`).

- **L'època és fixa**: l'era 0 comença el 2026-01-01 i el seu càlcul va en UTC
  (`Date.UTC(2026, 0, 1)`). Canviar-la desplaçaria tota la roda i faria sortir
  una altra paraula. `diesEntre` (a `bosses.js`) compta els dies de les eres
  igual, en UTC, per no dependre del rellotge de ningú.

- **Regenerar `dades/` ja no canvia la paraula de cap dia.** Abans la roda anava
  sobre les claus de l'índex i qualsevol canvi del diccionari les movia; ara el
  que surt cada dia és a `eres.json`. El que pot passar és un **error** de
  `generar_dades.py` perquè una paraula congelada ja no es pot jugar (vegeu
  dalt), i aleshores es pot substituir al lloc. Això sí: substituir-la mou els
  dies en què havia de sortir.

- **Un intent per dificultat i dia**, i **no** per dialecte. Abans el bloqueig
  duia el dialecte, perquè cadascun tenia la seva paraula; ara canviar de
  dialecte per tornar-la a jugar seria jugar dos cops la mateixa paraula. El
  bloqueig és a `localStorage` i prou: esborrar-lo, o obrir una finestra
  privada, permet repetir. És un joc, no un examen.

- **Les proves**: `node --test "joc/eines/proves/*.test.mjs"`, des de l'arrel del
  repositori (amb la carpeta sola, sense el patró, node 22 no hi troba les
  proves). Cobreixen la fórmula, les eres, les manuals, la previsió, l'il·limitat
  natiu, les dades publicades de debò i —a través de `python.test.mjs`— les
  eines de Python.

## 7 bis. El mode personalitzat

El mode per jugar contra algú. El jugador es tria tots els ajustos, el joc en fa
un **enllaç**, i qui l'obri juga exactament la mateixa partida. **No hi ha
servidor**: tot surt de la llavor i dels ajustos, que viatgen a l'adreça.

I **no toca res**: ni `desarRecord`, ni `desarResultatDiari`, ni
`enviarPuntuacio`. Per això té el seu propi final de partida
(`acabarRondaPersonalitzada`) i no passa per l'`acabarPartida()` de sempre.

### Agudes, planes i esdrúixoles surten de franc

La clau de rima **assonant** és la seqüència de vocals des de la tònica fins al
final. Comptar-les, doncs, és comptar les síl·labes des de l'accent:

| llargada de la clau | classe | exemple |
|---|---|---|
| 1 | aguda | `camió` → `o` |
| 2 | plana | `casa` → `aə` |
| 3 | esdrúixola | `màquina` → `aiə` |

Comprovat contra la transcripció de **88.541 paraules sense ni un desacord**,
diftongs inclosos: `remei` /rəmˈɛj/ dona `ɛ` (aguda) i `canvi` /kˈambi/ dona `ai`
(plana), que és el que ha de ser. És la mateixa regla que ja feia servir
`llistes/generar_mots_de7_glosa.py`. El generador ho desa a `grups[i][2]` i el
joc no ho ha de recalcular mai.

Com que **totes les claus d'un grup assonant tenen la mateixa llargada**, el
filtre val alhora per a la paraula objectiu i per a les respostes: si demanes
planes, tota rima que puguis escriure serà plana. No hi ha res a decidir.

### Per què el fitxer publica més claus que abans

Els modes normals només volen la finestra de 30 a 800 rimes, però aquí el
jugador ha de poder demanar una terminació que només en tingui tres, o una que
en tingui sis mil. Per això el generador publica **totes** les claus de dues
rimes amunt (`MIN_RIMES_PUBLICADES`) i **sense sostre**, i són els modes normals
els qui es retallen la llista en temps d'execució:

```js
// clausDeLaFinestra a js/objectius.js
tros.claus.filter((c) => objectiusArreuDe(c) > 0
                      && c[RIMES] >= index.min_rimes && c[RIMES] <= index.max_rimes)
```

El filtre de veritat és el primer: una clau val si té alguna paraula que es pugui
rimar als quatre dialectes. La finestra hi va igualment i no és cap redundància
gratuïta —una paraula marcada com a jugable arreu té, per força, la clau
d'aquest dialecte dins de la finestra—, però les constants viuen a l'índex i el
marcatge al fitxer de rimes: si un dia es desincronitzen, val més quedar-se curt
que servir una partida que no toca.

I **la paraula** també es tria de dues llistes diferents: `triarParaula(grup,
clau, aleatori, arreu)` mira `seccio.objectiusArreu` als modes normals i
`seccio.objectius` al personalitzat, que és qui li passa `false`.

Costa: unes 4.200 claus per dialecte en comptes de 660, i l'`index.json` passa
de 190 KB a 452 KB (**120 KB comprimits**, que és el que viatja). Els `.txt` no
creixen gairebé gens, perquè el 99 % del vocabulari ja hi era.

### «Quantes rimes» vol dir coses diferents a cada dificultat

I és a posta: el filtre ha de dir **quantes respostes bones tindràs**.

| dificultat | què es compta | marge real (central) |
|---|---|---|
| consonant | la secció on rimes (`claus[i][3]`) | 2 – 25.514 |
| assonant | el grup assonant sencer (`grups[g][3]`) | 2 – 99.495 |

Per això el mateix «de 30 a 800» dona coses molt diferents segons la dificultat,
i per això la pantalla porta un **recompte que es refà a cada canvi**: hi ha
combinacions que no donen cap paraula (esdrúixoles amb més de cinc-centes rimes)
i val més veure-ho abans de prémer el botó. Amb zero, el botó es bloqueja.

### La signatura, el codi i la roda de partides

```
signatura = dialecte|dificultat|segons|rondes|min|max|accents|llavor
```

Hi són **tots** els ajustos i la llavor, i **no** el número de partida: la
partida 2 de la mateixa gent ha de dur el mateix codi. D'aquí surten dues coses:

- **el codi de partida** (`QBNFZ`), cinc caràcters d'un alfabet sense O ni I ni
  els seus números, perquè es pugui dir en veu alta i comparar de cua d'ull;
- **les paraules**, que es deriven de la signatura *més* el número de partida.

Si algú toca l'enllaç i canvia un filtre, les paraules canvien **i el codi també**:
els dos jugadors ho veuen de seguida sense haver de comparar res més.

```js
// rondesPersonalitzades a js/objectius.js
const base = `${config.signatura}-${config.partida}`;
generador(llavor(`rimador-joc-tria-${base}`))            // quines terminacions
generador(llavor(`rimador-joc-paraula-${base}-${ronda}`)) // quina paraula de cada una
```

Cada ronda té el seu generador per a la paraula, i no un de compartit: així la
paraula d'una ronda no depèn de quantes vegades s'hagi girat el generador de les
terminacions.

**El «una altra partida»** puja el número de partida. Cadascú el prem quan vol i
tots dos juguen el mateix, perquè la partida 2 és la partida 2 per a tothom; el
número surt a la pantalla del resultat per no perdre el compte.

**Les rimes tampoc no es repeteixen**, i pel mateix mecanisme que la paraula del
dia: es recorren seguint una barreja de Fisher-Yates en comptes de tirar-les a
l'atzar. Cada rima surt una vegada i prou fins que s'han fet servir totes, i
llavors comença una volta nova amb una barreja diferent.

I **la roda no es reinicia a cada partida**: la passa es compta des de la
primera (`(partida - 1) * rondes + ronda`), o sigui que qui juga tres partides
de tres rondes veu **nou rimes diferents**. Comprovat amb 23 rimes disponibles:
la primera repetició arriba exactament a la passa 24.

### El dialecte va tancat dins de l'enllaç

Perquè la mateixa paraula té **rimes vàlides diferents** a cada dialecte:
*dialecte* té 30 rimes consonants en central i 52 en valencià. Si cadascú jugués
en el seu, els números no es podrien comparar. Per això el dialecte és a la
signatura i l'`arrencar()` el fa manar per damunt del que tinguis desat.

### Les pantalles

```
pantalla-personalitzat   el formulari + el recompte
        ↓ Crea la partida
pantalla-convit          el codi, el resum dels ajustos i l'enllaç per copiar
        ↓ Comença
pantalla-joc             (amb "Ronda 2 de 3" a sobre de la paraula)
        ↓ s'acaba el temps
pantalla-ronda           el resultat de la ronda → Següent ronda
        ↓ després de l'última
pantalla-resum           ronda a ronda, el total, i "Una altra partida"
```

Qui arriba amb un enllaç va **directament al convit**, sense passar pel
formulari: ja té els ajustos fets.

---

## 7 ter. L'il·limitat natiu

Una paraula nova a cada partida, amb **les mateixes bosses i quotes que la
paraula del dia** però aplicades a les claus del dialecte que es juga i
comptant-hi **les seves pròpies rimes**. Ho fa `js/illimitat.js`, sobre la
mateixa maquinària de `bosses.js` que fa servir la paraula del dia: triar la
bossa i triar la clau dins de la bossa és idèntic; només canvia que aquí es
compten les partides d'un jugador i no els dies d'una era.

**Quan s'activa.** Quan l'era d'avui té bosses (algorisme 1). Mentre l'era
vigent és la roda (l'era 0), o si l'`eres.json` no es pot llegir, l'il·limitat és
el de sempre: una clau a l'atzar de la finestra de rimes (`clauAleatoria`, entre
`MIN_RIMES` i `MAX_RIMES`).

**Què el fa diferent de la paraula del dia:**

- **No és compartit.** Cap jugador no necessita la partida d'un altre, o sigui
  que no hi ha res que congelar: es fa servir l'índex del moment i els talls i
  quotes de l'era vigent.
- **No hi ha tolerància ni la regla dels quatre dialectes.** La unitat és la
  clau consonant del dialecte al difícil i el grup assonant al fàcil, i cau a la
  bossa que li toca per les rimes que té **en aquell dialecte**. La paraula és
  qualsevol de les objectiu d'aquella clau (les marcades amb `*` i `+` al fitxer
  del dialecte), **tret dels homògrafs** (*dona* / *dóna*): el jugador veuria
  «dona» sense saber quina lectura toca. `generar_dades.py` escriu a l'índex la
  llista d'homògrafs de cada dialecte i, a cada clau, el sisè camp: quantes
  paraules natives té.
- **Una bossa sense cap clau en aquest dialecte no entra al patró**: les altres
  conserven la seva quota i es reparteixen els dies (W és la suma de les que
  queden).

**La seqüència és de cada jugador.** La llavor és `usuari|dialecte|carril`; el
patró de bosses comença al desplaçament `llavor(semilla) mod W` (perquè la
primera partida de cada jugador no caigui a la mateixa bossa) i les baralles de
cada bossa se sembren amb `<llavor>-<bossa>`. El comptador de partides és al
`localStorage` (`rimador.joc.illimitat.v1`, un número per
`dialecte|dificultat`) i **puja quan la partida ja té les rimes baixades**: si no
han pogut baixar, el jugador no perd cap torn.

Qui juga N partides té **exactament** les partides de cada bossa que li toquen
(cada W partides, tantes com diu la quota), i dins d'una bossa no se'n repeteix
cap clau fins que s'han fet servir totes.

**La paraula del dia no es proposa.** Se salta la unitat de la paraula del dia
d'avui, al mateix dialecte i dificultat (la clau al difícil, el grup al fàcil):
així l'il·limitat no la desvetlla. Es passa a la posició següent de la seqüència,
fins a tres cops, i el comptador puja de les posicions gastades. Amb una sola
unitat en joc no hi ha alternativa i es serveix igualment.

Al fàcil, **la clau d'un grup** surt amb probabilitat proporcional a les seves
paraules natives, i la paraula, d'un generador sembrat amb el jugador i la
posició.

Si es regenera l'índex, les baralles canvien i de tant en tant es pot repetir
una clau dins d'una volta; és acceptable, perquè no hi ha cap resultat compartit
que s'hagi de mantenir igual. I si el jugador perd el `localStorage`, torna a
començar.

**El mode personalitzat no hi té res a veure** i funciona exactament com abans.

---

## 8. La classificació: el circuit sencer

```
navegador                Google                    tu, a mà                 navegador
─────────                ──────                    ────────                 ─────────
classificacio.js   POST   Apps Script    →   full   compilar_          →   classificacio.json
enviarPuntuacio()  no-cors  doPost()        de      classificacio.py       carregarClassificacio()
                            appendRow()     càlcul  (llegeix el CSV        modalitats + diària
                                                     publicat, valida
                                                     i desdupla)
```

### L'enviament (`classificacio.js`)

`POST` amb `mode: 'no-cors'` — no es pot llegir la resposta, o sigui que "enviat"
vol dir "el `fetch` no ha petat", no pas "s'ha desat".

**El nom es tria ABANS de la partida, i només el primer cop.** Ha passat per
tres formes i les dues primeres tenien cadascuna el seu problema:

| | què passava |
|---|---|
| camp + botó «Enviar» a cada partida | qui no l'omplia —que era la majoria— no sortia enlloc encara que hagués fet una partidassa: el joc guardava un rècord que no veia ningú |
| el nom, la primera vegada, **al final de la partida** | el «Canvia el nom» d'aquella pantalla tornava a enviar la MATEIXA puntuació amb el nom nou. Dues files de la mateixa partida al full, i el compilador havent-les de desempatar per data (vegeu `top_entrades` a `compilar_classificacio.py`) |
| el nom **abans de començar** (ara) | quan la partida s'acaba ja se sap com et dius, i cada partida s'envia una vegada |

Ara el bloc «Qui juga» és a la pantalla de configuració (`#grup-jugador`), just a
sobre del botó de començar. Sense nom, el camp surt obert i el botó es queda
bloquejat (`faltaElNom()` a `principal.js`); amb nom, només hi surt qui ets i un
«Canvia el nom». El nom es desa a `rimador.joc.sobrenom.v1` i, a partir d'aquí,
l'`acabarPartida()` crida l'`enviarResultat()` sense esperar-lo: la pantalla no
s'atura per res i el bloc de sota del resultat només diu com ha anat.

Si la classificació **no està configurada** (sense `URL_ENVIAMENT`), no es demana
cap nom ni es bloqueja res: no hi hauria on enviar-ho. I el mode personalitzat
tampoc no en demana, perquè no toca la classificació.

Les partides de **zero rimes no s'envien**: no és cap puntuació i només faria
soroll al full.

### Sense connexió, la puntuació no es perd

Abans, si el `fetch` petava, la pantalla deia «no s'ha pogut enviar la puntuació»
i allà s'acabava: qui jugava al metro perdia la partida encara que després
tingués cobertura tot el dia.

Ara la puntuació que no pot anar es **desa** (`rimador.joc.pendents.v1`, un
màxim de 50, les més noves) i es torna a provar sola:

- quan el navegador dispara l'**`online`** (`principal.js` hi té l'oient), i
- **en obrir el joc**, que és l'altre moment en què la xarxa pot haver tornat
  sense que ho haguem vist (`arrencar()` crida `enviarPendents()`).

`enviarPendents()` va d'una en una i **para al primer error**: si la xarxa
continua sense anar, no té sentit encadenar cinquanta intents. Rellegeix la
llista després de cada enviament, perquè mentre pujava pot haver acabat una
partida i haver-n'hi encuat una altra. Té un pany (`buidant`) perquè l'`online`
es pot disparar dues vegades seguides.

**El dia de la partida viatja dins del paquet** (el camp `data`), o sigui que una
puntuació que puja dos dies tard continua comptant per al dia que es va jugar
—sempre que el full en tingui la columna, vegeu l'apartat 12.

**I els repetits no fan mal.** Amb `mode: 'no-cors'` la resposta és opaca i no es
pot saber si el servidor l'ha apuntada: si el `fetch` peta a mitges, la puntuació
es torna a enviar i al full hi pot haver dues files iguals. El compilador ja ho
preveu —al rànquing es queda la millor de cada persona i modalitat, i a les
estadístiques treu els duplicats exactes— i val més una fila de més que una
partida perduda.

Compte amb què vol dir «jugar sense connexió»: això arregla que **caigui la
xarxa amb el joc ja obert**, que és el cas normal. Obrir el joc de zero sense
connexió és una altra cosa i encara no funciona: el service worker guarda el
shell (`joc/js/`, `dist/`, `fonts/`, `assets/`) però **no** els fitxers de
rimes de `joc/dades/`, que són 8 MB per dialecte (vegeu `NO_TOCAR` a
`service-worker.js`).

### Dos jugadors no poden dir-se igual

El compilador publica `noms_ocupats`: tots els sobrenoms que ja són a la
classificació, en minúscules i sense accents (el mateix que fa el
`clauDeSobrenom()` de `js/classificacio.js`). El `validarSobrenom()` no en deixa
triar cap que hi sigui —tret que ja sigui el teu, perquè tornar a desar el teu
propi nom ha de valer.

Això **no és cap garantia i no ho ha de ser**: la llista és la de l'última
compilació, i dues persones poden triar el mateix nom el mateix dia sense que
cap de les dues ho pugui saber. No trenca res, perquè el rànquing no separa la
gent pel nom sinó per **identificador d'usuari** (vegeu `clau_persona`): en
aquest cas surten dues files amb el mateix nom, no una de barrejada, i qui
arribi més tard ja no el podrà tornar a agafar l'endemà.

**S'envia des d'on sigui.** `estaConfigurat()` només mira que hi hagi
`URL_ENVIAMENT`, o sigui que des de `localhost` i des del repositori de proves les
puntuacions arriben al full de debò.

El cercador no funciona així: `registrarCerca` (`js/script.js:985`) surt de
seguida si l'amfitrió no és `rimador.cat` o `rimador.github.io`, perquè les
cerques de prova no valen res i només fan soroll. Aquí la decisió és la
contrària, i a consciència: una classificació que no deixa enviar res mentre la
proves no es pot provar de veritat. El filtre de debò és el compilador, que és qui
decideix què es publica; si al full hi entra soroll, s'esborra la fila allà.

### Les dues dates

El navegador envia el **dia de la partida**; el servidor de Google apunta el **dia
que ha arribat l'enviament**. Són columnes diferents del full (`DataPartida` i
`Data`) perquè **no són el mateix**: qui juga la paraula del dia a les 23.55 i
l'envia a les 00.05 ha jugat la d'ahir. El rànquing per dia agrupa per
`DataPartida`; la `Data` serveix per veure quan va passar de debò.

### El backend (`apps_script_classificacio.gs`)

Poques línies. Valida que els punts siguin entre 0 i 10.000 i que la
`DataPartida` tingui la forma `AAAA-MM-DD`; si no la té, la deixa buida i ja hi
posarà el compilador la d'arribada. Les columnes són deu:

```
Data | DataPartida | Sobrenom | Mode | Dificultat | Segons | Dialecte | Punts | Paraula | Usuari
```

**Escriu per nom de columna, no per posició.** Abans feia un `appendRow()` amb
els valors en un ordre fix, i això vol dir que el full i l'script s'han de posar
d'acord sense que ni l'un ni l'altre ho puguin comprovar: el dia que al full li
faltava una columna —la `DataPartida`, per exemple, que es va afegir després—
tot el que venia darrere quedava **desplaçat una casella** i el compilador
llegia les dades barrejades sense adonar-se'n. Ara el `filaPerAlFull()` llegeix
la fila 1, fa quadrar cada valor amb el seu títol i **afegeix al final els que
hi falten**:

| el full té | què passa |
|---|---|
| res (full nou) | s'hi escriuen les deu columnes i es congela la fila 1 |
| les nou d'abans, sense `DataPartida` | s'hi afegeix la `DataPartida` al final i la fila hi quadra |
| les deu | no es toca res |
| una columna de collita pròpia enmig | es deixa buida, i la resta continua quadrant |

Les que falten van **al final** i no a la posició «bona» a posta: moure columnes
voldria dir moure totes les files que ja hi ha, i el compilador llegeix el CSV
per nom i no per posició (vegeu `COLUMNES` i `COLUMNES_NOVES` a
`compilar_classificacio.py`), o sigui que l'ordre li és ben igual.

O sigui que per estrenar la `DataPartida` en un full que ve d'abans n'hi ha prou
de **tornar a desplegar l'script**: la primera puntuació que arribi crearà la
columna, i a partir d'aquell moment el rànquing per dia agruparà per quan es va
jugar de debò i no per quan va arribar l'enviament.

### El compilador (`compilar_classificacio.py`)

Aquí és on es decideix de debò què es publica. Necessita `pandas`:

```bash
python joc/eines/compilar_classificacio.py
```

1. Llegeix el full publicat en CSV.
2. **Es planta si falten les columnes de sempre**, però **no si falten les noves**
   (`DataPartida`, `Dialecte`): les files d'abans dels dialectes es donen per
   centrals i pel dia que van arribar, i no es perden.
3. **Revalida els sobrenoms** i aplica la llista `PARAULES_VETADES`, comparant
   sense accents i en minúscules.
4. **Desdupla per persona**: la clau és l'`usr_…` si hi és, i si no el sobrenom
   sense accents. De cada persona i modalitat, només la millor puntuació, i si
   n'hi ha dues d'empatades, **la més nova** (canviar-se el sobrenom a la
   pantalla de final torna a enviar la mateixa puntuació amb el nom nou: amb
   l'ordre d'abans guanyava la fila vella i el nom nou no sortia mai).
5. Escriu els tres rànquings, **les estadístiques** —que no desdupliquen per
   persona sinó que compten partides (vegeu més avall)— i **`noms_ocupats`**, la
   llista de sobrenoms que el joc ja no deixarà triar a ningú més.

### Què en surt

```json
{
  "actualitzacio": "30/08/2026 20:40:52",
  "modalitats": {
    "illimitat|dificil|45": {
      "titol": "Il·limitat · Difícil · Llampec",
      "top": [ { "sobrenom": "Adm1n", "punts": 13,
                 "paraula": "resolutiu", "dialecte": "ca", "data": "…" } ]
    }
  },
  "diaria": { "2026-08-26": { "dificil": [ … ] } },
  "diaria_millors": { "dificil": [ … 10 entrades … ] },
  "noms_ocupats": [ "adm1n", "albert", "mireia", … ],
  "estadistiques": {
    "modalitats": {
      "illimitat|dificil|30": {
        "partides": 140, "mitjana": 6.5,
        "histograma": { "0": 3, "1": 7, "2": 11, … }
      }
    },
    "diaria": {
      "2026-09-05": { "dificil": { "ca": { "partides": 64, "mitjana": 7.2,
                                           "histograma": { … } } } }
    },
    "diaria_totals": { "dificil": { "partides": 812, "mitjana": 6.9,
                                    "histograma": { … } } }
  }
}
```

**Els tres es veuen al joc**, repartits en dues pestanyes:

| pestanya | què ensenya | d'on surt |
|---|---|---|
| **Il·limitat** | una taula per rellotge i dificultat | `modalitats`, filtrat a les claus `illimitat\|…` |
| **Paraula del dia** | el rànquing del dia que triïs i, a sota, els 10 millors de sempre | `diaria` i `diaria_millors` |

Les **estadístiques** no surten a cap de les dues: són per a la pantalla de
final (apartat 8 bis).

Les modalitats de la paraula del dia **no surten a la pestanya d'il·limitat**
encara que el compilador les hi posi: barrejar partides d'un minut amb un sol
intent al dia amb les d'il·limitat no comparava res. El filtre és al joc i no al
compilador, perquè el JSON continua sent una llista completa del que hi ha.

Com que la pestanya ja diu "Il·limitat", el joc treu aquest tros del títol de
cada pastilla (`Il·limitat · Difícil · Llampec` → `Difícil · Llampec`): repetir-ho
només faria més estret el que de debò les distingeix. Els segons sí que hi són,
en una pastilleta de color al final (`30s` groc, `60s` verd, `120s` rosa; els
rellotges d'abans, `45s`/`90s`/`180s`, van del color del que els ha substituït):
el nom
del rellotge no diu quant dura, i el color permet trobar-la sense llegir-la. El
color mai no és l'única pista —hi ha el nom i el número escrits—, o sigui que qui
no el vegi no s'hi perd res.

Les pastilles van **partides en dues files, una per dificultat i amb una ratlla
al mig**, i dins de cada fila del rellotge més ràpid al més lent. Per ordre de
clau sortien barrejades i amb els rellotges desordenats (`180`, `45`, `90`, que
és l'ordre de la cadena i no vol dir res), i totes seguides no es veia on
s'acabava una dificultat i on començava l'altra. Ara la graella queda com la de
la pantalla de configuració.

> Els rellotges són 30, 60 i 120 segons; abans eren 45, 90 i 180. Un rellotge
> que no sigui cap dels tres d'ara es titula amb els segons i prou (vegeu
> `NOM_TEMPS` a `js/ui.js` i a `eines/compilar_classificacio.py`), que és el que
> passa amb les partides velles que quedin al full o als rècords del navegador:
> no són comparables amb les d'ara —en 45 segons se'n fan més que en 30— i
> barrejar-les seria mentir.

A la pestanya de la paraula del dia hi ha **una sola tria de dificultat** que
mana sobre les dues taules. Són la mateixa pregunta feta dues vegades i poder-les
descordar no serviria de res. Per defecte agafa la dificultat que jugues.

Aquesta tria també **decideix quins dies es poden triar**: només hi surten els
dies que tenen algú en aquella dificultat. La paraula del dia es juga molt més en
difícil que en fàcil, i amb tots els dies a totes dues dificultats la meitat de
les pastilles obrien una taula buida. Si una dificultat no té cap dia, no hi ha
pastilles de dia i es diu amb un avís, amb la tria de dificultat encara a lloc
per poder tornar enrere.

Els dos rànquings del dia van **cadascun a la seva bombolla**, amb el rosa del
fons entremig i una capçalera que diu què s'hi mira (`Rànquing del 26 d'ag. ·
Difícil`, `Els millors de sempre · Difícil`). Dins d'una sola caixa i separats
només per un titolet semblaven una llista de vint noms. La taula d'il·limitat és
la mateixa bombolla, amb la modalitat triada a la capçalera: quan has baixat a
mirar la llista, el selector ja no es veu.

El `diaria_millors` es calcula **abans** de retallar als últims `DIES_DIARIA`
dies: és justament la taula que no ha de dependre de quin dia estiguis mirant.

El bloc `diaria` es calculava des del principi però no el llegia ningú; ara té la
seva pantalla.

### El dialecte no parteix el rànquing

Es guarda al full i **viatja amb cada entrada**, però no fa taules a part: hi ha
una classificació per modalitat i prou, i el dialecte surt **entre parèntesis a
cada fila** (`amb «bytownites» (Central)`, vegeu `subtitolEntrada` a `ui.js`).

Va provar-se de l'altra manera —una taula per dialecte, i la pantalla ensenyant
la del que tenies triat— i no s'aguanta: parteix un rànquing petit en quatre de
més petits, i qui jugués en balear es trobava una pantalla buida. Dit a cada
fila, tothom surt junt i es veu igualment en què jugava.

Per això la clau de modalitat de la classificació (`mode|dificultat|segons`) i
l'identificador dels rècords personals (`mode|dificultat|segons|dialecte`) **no
són el mateix**: els rècords sí que es parteixen, perquè són teus i comparar-te
amb tu mateix en dialectes diferents no vol dir res. `principal.js` en té dues
funcions, `modalitatDe()` i `identificadorRecord()`.

Al `diaria` tampoc no hi ha cap capçalera que digui quina era la paraula del
dia. Ara sí que n'hi ha una de sola (apartat 7), però la paraula viatja igualment
amb cada entrada: el JSON és el registre del que es va jugar, i el dia que la
paraula del dia canviï d'era, les taules velles han de continuar dient amb què es
van fer.

### La lectura

`carregarClassificacio()` fa `fetch` amb `?t=${Date.now()}`. És la mateixa regla
que el `versions.json`: **el fitxer que diu com estan les coses ara no es pot
cachejar mai**. Aquest canvia cada cop que passes el compilador, sense que canviï
la versió de res.

---

## 8 bis. Les estadístiques de la pantalla de final

En acabar, el joc no només diu quantes rimes has fet: diu **quin percentil has
fet** i **quantes en treu de mitjana la resta de gent**. Ho munta
`js/estadistiques.js` a partir del bloc `estadistiques` del `classificacio.json`.

### Per què un histograma i no una llista

El percentil s'ha de calcular amb **totes** les partides, no amb les vint que es
publiquen a cada taula: dir «has superat el 72 %» comparant-te amb els vint
millors seria una mentida amb números. Però publicar la llista sencera de
partides seria fer créixer el JSON sense aturador i sense necessitat.

La sortida és el terme mig: de cada cosa se'n publica **quantes partides hi ha
hagut de cada puntuació**. Les puntuacions són nombres petits (de 0 a un centenar
llarg), o sigui que són quatre parells de números, i amb això el navegador
calcula el percentil **exacte** ell sol:

```js
// percentil() a js/estadistiques.js
// Compta les partides que van fer MENYS punts que tu: empatar no és superar.
menors / total
```

### Amb què et compara

| mode | bloc | agrupat per |
|---|---|---|
| Paraula del dia | `diaria[dia][dificultat]` | el dia i la dificultat |
| Paraula del dia, si encara no hi ha dades d'avui | `diaria_totals[dificultat]` | totes les paraules del dia d'aquella dificultat |
| Il·limitat | `modalitats["mode\|dificultat\|segons"]` | la modalitat, juguis en el dialecte que juguis |

La paraula del dia **no es parteix per dialecte**: n'hi ha una de sola i tothom
la va jugar (apartat 7). El que canvia amb el dialecte és quantes rimes hi
valien, i això ja surt entre parèntesis a cada fila del rànquing.

### La xarxa de sota

El `classificacio.json` **es refà un cop al dia** (22:01 UTC, vegeu
`.github/workflows/dades_nocturnes.yml`), o sigui que **la teva partida no hi és
mai** i, si jugues la paraula del dia abans que hi torni a passar el compilador,
tampoc no hi ha cap dada d'avui. Quan passa això, el joc:

1. es fa enrere al `diaria_totals` d'aquella dificultat, i
2. **ho diu**, amb una nota a sota del bloc.

Fer passar la mitjana de sempre per la mitjana d'avui seria mentir; callar seria
deixar la pantalla mig buida sense explicar per què. Si es volgués la mitjana del
mateix dia, el que s'hauria de canviar és **la freqüència del workflow**, no el
joc.

### No hi ha cap mínim de partides

Es diu el que hi ha, encara que surti d'una sola partida. El número és de debò,
i al costat hi va sempre de quantes partides surt («de 2 partides»), que és el
que fa que s'entengui tot sol. Amagar-ho hauria deixat la pantalla muda mentre el
joc és nou, que és justament quan més ganes hi ha de saber com ha anat. L'única
condició és que n'hi hagi **alguna**.

### La pantalla d'ahir

La xarxa de sota explica per què la mitjana d'avui costa, però hi ha una xifra
que **sí que és tancada**: la d'ahir. Quan tu la mires, el compilador ja hi ha
passat i el `classificacio.json` la porta sencera.

Per això hi ha la pantalla **«Com va anar ahir»** (al menú d'inici i al final de
cada partida). Ensenya, per a la dificultat que triïs:

| què | d'on surt |
|---|---|
| la paraula d'ahir | **la calcula el joc**: `seleccioDelDia(ahir(), dificultat)` (apartat 7) |
| quantes rimes se'n van trobar de mitjana | `estadistiques.diaria[ahir][dificultat]` |
| qui la va fer millor | `diaria[ahir][dificultat]` |

La paraula no surt del rànquing sinó de la mateixa fórmula de sempre (amb les
eres i les manuals d'ahir), i això importa perquè **hi surt encara que ahir no hi
jugués ningú**. El rànquing no es filtra:
ahir tothom va jugar la mateixa paraula, i el dialecte de cadascú surt entre
parèntesis a la seva fila, com a la resta de la classificació.

---

## 9. La gestió de versions

És **una sola idea aplicada dues vegades**, i és la mateixa que la del diccionari.

### Les dades: resum de contingut

`generar_dades.py` calcula un `sha256` escurçat a 12 caràcters de cada fitxer i
l'escriu al `dades/versions.json` — exactament el que fa
`diccionaris/python/versions.py` amb les columnes. La versió d'un fitxer **canvia
exactament quan el fitxer ha canviat**: ni abans ni de més.

Al navegador:

```
dades/versions.json?t=1788119048827          ← mai cachejat
dades/index.json?v=826253d24091              ← cachejable per sempre
dades/eres.json?v=65b57475af7d               ← cachejable per sempre
dades/ca.txt?v=c257dc6fd178                  ← cachejable per sempre
dades/especials.json?t=1788119048999         ← mai cachejat (no té versió)
```

Si el `versions.json` no es pot llegir (sense xarxa, servidor caigut, fitxer
romput), s'estira dels resums de l'última vegada, desats al `localStorage`. El
que el navegador tingui a la memòria cau es va demanar amb **aquells** resums, o
sigui que donant-los per bons se serveix una generació sencera i coherent de les
dades. És el mateix rescat que fa `carregarVersions` a `js/script.js`. I si no hi
ha res de què estirar, cada fitxer es demana amb un `?v=t<ara>` sempre diferent,
que és pitjor però mai incoherent.

Són sis entrades: l'`index.json`, l'`eres.json` i els quatre `<codi>.txt`. Com
que tots viuen a `dades/` i tenen nom únic, les claus són noms de fitxer sols,
igual que al `versions.json` del diccionari. L'`especials.json` queda fora a
posta: es demana sempre amb `?t=`, perquè s'hi puguin afegir dies sense tocar res
més (apartat 7).

### El codi: el `?v=` del commit

El `deploy.yml` posa els set primers caràcters del `GITHUB_SHA` a tots els `?v=`
quan detecta canvis. Ara `joc/` hi entra com l'arrel:

```yaml
git diff … -- 'css/*.scss' 'js/*.js' 'avis/*.js' 'avis/*.css' 'joc/js/*.js' 'joc/css/*.scss'
```

I el `sed` no escriu només als HTML, sinó també **a les importacions entre
mòduls**:

```yaml
find joc/js -type f -name "*.js" -exec sed -i -E "s/(\.js\?v=)[^']*/\1$NOVA_VERSIO/g" {} +
```

Això últim fa falta perquè **una importació no hereta el `?v=` de l'etiqueta
`<script>`**. Abans només `principal.js` i `joc.css` en duien, i els altres vuit
mòduls s'importaven a pèl: refrescar l'entrada deixava la resta a la memòria cau
del navegador i es barrejaven versions. El `?v=dev` que hi ha al repositori és el
valor de treball; el desplegament el substitueix (i al repositori de proves, on el
pas de *cache busting* no corre, s'hi queda i funciona igual).

Les **dades** del joc no passen per aquí, i no és cap oblit: ja porten el resum
del seu contingut, que és millor. Un canvi al diccionari no ha de rebentar la
memòria cau del CSS, ni al revés.

---

## 10. `index.html` i `joc.css`

L'HTML té **totes les pantalles alhora**, amagades amb l'atribut `hidden`. No hi
ha plantilles ni generació de marcatge: `ui.js` només canvia `hidden`, textos i
llistes. Les úniques coses que es creen amb `createElement` són les files de
rècords, les de la classificació, les pastilles, la tira de dialectes i els `<li>`
de paraules trobades.

`joc.scss` són unes 1.300 línies escrites a mà, mòbil primer, amb tota la paleta
a `:root`. Fa **dos `@use`** del CSS del lloc, i cap altra cosa no comparteixen:

```scss
@use "../../css/variables" as *;   // els colors de la casa, escrits un sol cop
@use "../../css/fonts";            // les @font-face del lloc
```

### Els ginys, i per què no se sabia què tenies triat

Tot el que es prem al joc —botons, opcions de la configuració, pastilles de la
classificació, pestanyes i tira de dialectes— surt de **tres mixins** de dalt de
tot del full:

```scss
@mixin giny        { background: var(--gris-giny); border: var(--relleu); … }
@mixin giny-hover  { background: var(--rosa); }
@mixin giny-triat  { background: var(--cian); border-style: inset; … }
```

És el mateix botó del `css/dialectes.scss` del lloc: gris amb bisell, cantonades
vives, rosa quan hi passes per sobre i **enfonsat i cian** quan està triat. La
vora `outset` la dibuixa el navegador tot sol —clara a dalt i a l'esquerra, fosca
a baix i a la dreta—, i el triat només l'ha de canviar per `inset` i ja queda
premut, sense repetir cap color.

Abans **tot anava blanc amb vora negra gruixuda i una ombra dura desplaçada sis
píxels**, i el triat només es distingia perquè el blanc es tornava cian: dos
clars, l'un al costat de l'altre, i qui hi jugava no sabia què tenia seleccionat.
Ara el triat canvia **tres coses alhora**, i cap no depèn de les altres:

| pista | de què serveix |
|---|---|
| gris → cian | es veu de lluny |
| sortit → enfonsat | val si no distingeixes els colors |
| un `✓` al cantó (només a les opcions grosses, que tenen lloc) | val si no veus ni l'una ni l'altra |

I de passada **s'assembla a la resta del lloc**: aquell blanc amb vora negra i
ombra dura era l'aire de qualsevol plafó d'ara, i el Rimador.cat va de capçalera
vermella amb bombolles, franja rosa, barres grises amb bisell, plafó cian i botó
de l'arc de Sant Martí. Les ombres del joc ara són suaus i petites (`0 2px 4px`,
la del camp de cerca del lloc) i el `transform: translate()` dels botons premuts
se n'ha anat, que era la meitat de l'efecte.

**El cian vol dir "triat" i prou.** Per això els plafons de la configuració es
queden clars i no cians: una opció cian damunt d'un plafó cian tornaria a deixar
la pantalla muda. Els plafons cians que queden (les targetes del menú, les
capçaleres de les bombolles) no són res que es pugui triar.

### Els camps de text són els del cercador

L'altra meitat del "quin camp tinc seleccionat": `background` gris molt clar,
vora **blava** i vora **rosa** amb una resplendor quan hi tens el cursor, que és
exactament el `#paraulaCercada` del `css/container.scss`. Abans eren blancs amb
vora negra i, en rebre el focus, la vora es tornava d'un cian fosc damunt d'un
fons quasi blanc: en un formulari amb quatre camps no es veia quin escrivies.

Les regles del parpelleig d'encert i d'errada van **després** del `:focus` a
posta: mentre jugues el cursor és sempre al camp, i si el focus manés no es
veuria mai ni el verd ni el vermell.

### La tira de dialectes

Ara és la barra grisa amb bisell del cercador, rètol inclòs: el «Dialecte:» és un
enllaç blau subratllat a `../dialectes.html`, com allà. Per sota de 550 px el
rètol se'n va a dalt i el solc que separava les dues meitats desapareix, també
com allà.

El de les fonts és nou i arregla un error que només es veia al **mòbil**: el
gulp compila dos fulls (`styles` per al lloc, `styles-joc` per al joc) i les
`@font-face` només eren al primer, o sigui que el joc demanava una
`'Comic Sans MS'` que **no existeix ni a Android ni a iOS** i cada telèfon hi
posava el que li semblava (una serif a Android, la cal·ligràfica Snell Roundhand
a iOS). A les estadístiques del lloc, que sí que es baixen el fitxer del lloc, hi
sortia bé, i d'aquí venia la diferència. Amb el `@use`, el joc es baixa la
mateixa **Comic Relief** (clon lliure de la Comic Sans, compatible en mètriques)
i la `--tipus-accent` passa a ser la `--font-divertida` del lloc, amb la
`'Comic Sans MS'` del sistema com a simple reserva.

La **Impact** dels titulars tenia exactament el mateix problema, i el lloc no en
té cap solució per compartir: la `@font-face` de l'**Anton** (el clon lliure de
la Impact) es declara al mateix `joc.scss` i el fitxer viu a `joc/fonts/`. Va
**primera** de la pila, també a l'escriptori:

```scss
--tipus-titol: 'Anton', var(--font-afi), Impact, Haettenschweiler, …;
```

Si a l'ordinador es dibuixés amb la Impact i al telèfon amb l'Anton seguiríem
tenint dues cares del mateix joc, que és justament el que s'estava arreglant.
Són els subconjunts latin i latin-ext de Google Fonts, amb el `unicode-range`
posat, o sigui que el segon (31 KB) només es baixa si a la pantalla hi ha algun
caràcter que el necessiti.

La **Verdana** del cos es queda com estava: no hi ha cap clon lliure que puguem
allotjar, i quan falta el navegador la canvia per una altra sans-serif. No és la
mateixa lletra, però una sans-serif per una altra no trenca la pàgina com ho
feien la cursiva i la sans-serif genèrica dels titulars.

Val la pena recordar-ne dues més:

```css
[hidden] { display: none !important; }
```

L'`!important` hi és perquè hi ha regles (`.boto--gran`, `.carregant`) que fixen
el `display` i, sense això, guanyarien i les pantalles amagades es veurien.

```css
@media (prefers-reduced-motion: reduce) { /* anul·la totes les animacions */ }
```

---

## 11. Taula de referència ràpida

| fitxer | què fa | qui l'escriu |
|---|---|---|
| `index.html` | totes les pantalles, amagades amb `hidden` | tu |
| `css/joc.scss` | l'estètica; el gulp en fa `dist/css/joc.min.css` | tu |
| `js/principal.js` | fil conductor: pantalles, estat, esdeveniments | tu |
| `js/dades.js` | versions, `fetch` i anàlisi dels fitxers de rimes | tu |
| `js/dialecte.js` | quin dialecte es juga (`?d=`, `localStorage`, central) | tu |
| `js/objectius.js` | `llavor`/`generador`, tria de clau per rima i la roda d'abans (era 0) | tu |
| `js/eres.js` | la paraula del dia: eres, fórmula, parella del dia | tu |
| `js/bosses.js` | el patró de bosses i les baralles (comú a la paraula del dia i l'il·limitat) | tu |
| `js/especials.js` | les paraules manuals: resum de la data, xifrar i desxifrar | tu |
| `js/illimitat.js` | l'il·limitat natiu: bosses del dialecte, seqüència per jugador | tu |
| `js/package.json` | `{ "type": "module" }`: perquè node carregui els mòduls igual que el navegador | tu |
| `js/motor.js` | classe `Partida`: rellotge, validació, puntuació | tu |
| `js/normalitza.js` | fora accents — ha de coincidir amb el Python | tu |
| `js/ui.js` | l'únic mòdul que toca el DOM | tu |
| `js/magatzem.js` | `localStorage`: rècords, dia jugat, sobrenom, versions | tu |
| `js/compartir.js` | el text del resultat + `navigator.share` / porta-retalls / piulet | tu |
| `js/classificacio.js` | enviar la puntuació i llegir el rànquing | tu |
| `js/estadistiques.js` | percentil, mitjana i el rànquing d'ahir | tu |
| `js/personalitzat.js` | ajustos del mode personalitzat, enllaç i codi | tu |
| `dades/versions.json` | quins dialectes hi ha i el resum de cada fitxer | `generar_dades.py` |
| `dades/index.json` | les claus dels 4 dialectes, on és cada grup i què fa el fitxer | `generar_dades.py` |
| `dades/<codi>.txt` | totes les rimes d'un dialecte (global + apèndix) | `generar_dades.py` |
| `dades/eres.json` | les eres de la paraula del dia: contingut congelat de cada bossa | `congelar_era.py` (i `generar_dades.py --aplica-substitucions`) |
| `dades/eres_arxiu.json` | les eres més velles (el joc no el carrega) | `congelar_era.py` |
| `dades/especials.json` | les paraules manuals, xifrades | `manuals.mjs` |
| `dialectes_col/<codi>/apendix/` | les paraules pròpies del dialecte | tu |
| `dades/classificacio.json` | el rànquing publicat | `.github/workflows/dades_nocturnes.yml` (automàtic) |
| `eines/generar_dades.py` | diccionari + rima → `dades/`; comprova les eres i en resol les paraules | tu |
| `eines/bosses_rimes.py` | el panell de selecció d'una era (pàgina local `bosses_rimes.html`) | tu |
| `eines/congelar_era.py` | congela una era a `eres.json` (+ `informe_era.txt`) | tu |
| `eines/comprovar_eres.py`, `eines/variants_era.py` | les comprovacions de les paraules congelades; candidates, variants i tolerància | els crida `generar_dades.py` i `congelar_era.py` |
| `eines/formula.mjs` | el pont entre Python i la fórmula del joc (estat de sortida d'una era, error d'un patró) | els crida Python |
| `eines/manuals.mjs` | valida i xifra les manuals → `dades/especials.json` | tu |
| `eines/comprovar_diaries_manuals.py` | engega `manuals.mjs` | tu |
| `eines/diaries_manuals.json` | les manuals, en clar (**local**, al `.gitignore`) | tu |
| `eines/previsio.mjs` | quines paraules sortiran els propers dies | tu, i el bot de tuits |
| `eines/proves/` | les proves: `node --test "joc/eines/proves/*.test.mjs"` | tu |
| `eines/compilar_classificacio.py` | full CSV → `classificacio.json` | tu |
| `eines/apps_script_classificacio.gs` | codi que viu a Google, no aquí | tu |

---

## 12. Coses que convé saber

### L'Apps Script desplegat és vell 🔴

És **l'únic pas que queda per fer a mà**, i fins que no es faci, les puntuacions
que arriben **perden el dialecte i el dia de la partida**.

El codi que corre a Google és una **còpia** enganxada a mà, no el fitxer del
repositori, i la que hi ha desplegada és d'abans que existissin ni la
`DataPartida` ni el `Dialecte`: escriu vuit valors en un ordre fix. Es veu al
full publicat, que ara mateix diu això:

```
Data | Sobrenom | Mode | Dificultat | Segons | Punts | Paraula | Usuari | Dialecte
```

No hi ha `DataPartida` enlloc, i la columna `Dialecte` —afegida a mà— **és buida
a totes les files**, també a les de gent que hi juga en valencià. O sigui que:

- el rànquing per dia agrupa per l'hora d'**arribada** i no pel dia jugat (qui
  juga a les 23.55 i ho envia a les 00.05 compta per l'endemà);
- el compilador dona totes les files per **centrals** (`DIALECTE_ANTIC`), i per
  això a la classificació tothom surt amb «(Central)».

**El navegador ja ho envia tot bé**: al `POST` hi van els camps `data` i
`dialecte` (comprovat). El que falta és a l'altra banda.

**Com s'arregla**, i no s'ha de tocar el full a mà: obrir el full >
Extensions > Apps Script, enganxar-hi `eines/apps_script_classificacio.gs` tal
com és i **tornar a desplegar** (Desplega > Gestiona els desplegaments > edita
el que ja hi ha > versió nova, perquè l'URL `/exec` no canviï). Aquella versió
escriu **per nom de columna** i crea sola les capçaleres que faltin: en arribar
la primera puntuació, la `DataPartida` apareix al final del full i tot es posa
al seu lloc. El compilador llegeix per nom i no per posició, o sigui que l'ordre
li és igual.

Mentrestant no peta res: el compilador aguanta que les dues columnes no hi
siguin. Simplement no hi ha ni dia de partida ni dialecte per publicar.

### L'era 1 encara no està congelada 🟡

Tot el sistema d'eres és al lloc i provat, però **al repositori només hi ha l'era
0** (la roda d'abans). Mentre sigui així la paraula del dia és exactament la de
sempre i l'il·limitat natiu **no s'activa** (juga com abans). Per passar a
l'era 1:

1. Obrir el panell (`python3 joc/eines/bosses_rimes.py`), triar talls, quotes,
   tolerància i paraules per variant, i exportar la configuració.
2. `python3 joc/eines/congelar_era.py --inici AAAA-MM-DD` (mira l'informe abans
   amb `--simula`). La data ha de ser d'aquí a set dies o més.
3. `python3 joc/eines/generar_dades.py`, perquè l'índex en resolgui les paraules.

**Cost de descàrrega**: amb una era de tretze mil paraules l'`eres.json` fa uns
400 KB (134 KB comprimits) i l'`index.json` passa de 497 KB a uns 750 KB (154 KB
comprimits). Es baixen un sol cop per versió.

### Les eines de la paraula del dia demanen `node`

`manuals.mjs`, `previsio.mjs`, `formula.mjs` i les proves van amb node (v18 o
més). Python no té cap còpia de la fórmula: quan en necessita res, crida node. El
**bot de tuits** també (`paraula_del_joc`, a `bot/generador_tuits.py`, crida
`previsio.mjs`): el treball de GitHub on corre (`bot.yml`) no l'instal·la, i
funciona perquè `ubuntu-latest` ja el porta. Si algun dia es fixa una imatge
sense node, el bot s'ha d'ajustar.

### Els apèndixs ja hi són 🟢

`dialectes_col/<codi>/apendix/` existeix als quatre dialectes (ba 201.764 files,
ca i nw 107.437, va 236.333) i el generador els llegeix.

**No sempre va ser així, i no es notava.** El generador buscava les columnes amb
uns noms que no existeixen (`col_0.txt`, `col_3_rimacons_<codi>.txt`), i les de
debò es diuen `col_0_<codi>.txt` i `col_3_<codi>.txt`: com que la carpeta hi era
i els fitxers no, el joc s'havia estat publicant amb el diccionari global i prou.
Es notava que una paraula valenciana com *servisc* no comptava com a rima jugant
en valencià, i enlloc més.

L'efecte de segona volta és el que s'esperava: com que les paraules de l'apèndix
compten com a rima, hi ha terminacions que passen de 800 rimes en aquell dialecte
i deixen de ser jugables **a tot arreu** (apartat 2 ter). Del central, les claus
jugables passen de 663 a 541 i les paraules del dia de 2.554 a 2.140.

### Workflows automàtics

- **`compilar_classificacio.py`** ja té el seu workflow
(`.github/workflows/dades_nocturnes.yml`, que també hi passa les estadístiques
del lloc): cada dia a les 22:01 UTC i sota demanda.
- **`generar_dades.py`** continua sent manual: es passa quan canvies el diccionari
o els dialectes.

### La classificació és de confiança i prou

El `POST` no està autenticat: qualsevol pot enviar-hi el que vulgui fins a 10.000
punts, amb el sobrenom que vulgui. Per a un joc de rimes és una decisió
raonable, però convé saber-ho: l'única defensa real és que el rànquing el
publiques tu, a mà, executant el compilador — i que el compilador té l'última
paraula sobre què s'accepta.

### Les dades ocupen 30 MB al repositori

Quatre dialectes per 7,6 MB, en quatre fitxers. Es publiquen sencers a Pages, i
qui juga se'n baixa un (1,9 MB comprimits) un sol cop. Si un dia hi ha un cinquè
dialecte, seran uns 38 MB. El `.gitignore` no els toca a posta: han d'anar al
paquet que es publica.

El creixement del repositori a cada regeneració és petit encara que els fitxers
siguin grossos, perquè el git en fa deltes (mesurat a l'apartat 2). El que sí
que cal recordar és que **`escriure_si_cal` compara bytes**: si una passada no
canvia res, no es toca cap fitxer i no hi ha cap commit.

### El `?v=dev` no és cap error

És el valor de treball de les importacions i de l'HTML del joc. Al desplegament de
`rimador.cat` el substitueix el commit; al repositori de proves s'hi queda, perquè
allà el pas de *cache busting* no corre. En tots dos casos funciona.
