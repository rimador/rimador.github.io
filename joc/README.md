# El joc del Rimador.cat

Joc de rimes fet damunt del mateix diccionari fonètic que fa servir el cercador.
Viu a `rimador.cat/joc/` i va gairebé sol. El **JS** no comparteix res amb el lloc
principal: són mòduls ES que se serveixen tal com són. El **CSS** sí que passa pel
gulp (`joc/css/joc.scss` → tasca `styles-joc` → `dist/css/joc.min.css`) i comparteix
el `css/_variables.scss` amb el full del lloc, però en **surt un full a part**: els
dos tenen regles damunt de `html`, `body`, `a` i `*`, i ajuntar-los les faria xocar.
Compartir el fitxer de variables és, doncs, tot el que comparteixen: els colors de
la casa són escrits un sol cop. Des del `joc.scss` també s'hi fa un `@use` del
`css/fonts.scss`, que és on viuen les `@font-face` del lloc, i s'hi declara
l'**Anton** (allotjada a `joc/fonts/`): sense això el joc demanava una
`'Comic Sans MS'` i una `Impact` que **no existeixen ni a Android ni a iOS**, i
cada telèfon hi posava el que li semblava. L'estètica és la mateixa de sempre:
fons rosa, capçalera vermella amb bombolles, plafons cians, tipografies de tota
la vida i **els botons dels ginys d'aleshores** —gris amb bisell, cantonades
vives, rosa quan hi passes per sobre i enfonsat i cian quan està triat—, que són
exactament els de la tira de dialectes del cercador (`css/dialectes.scss`). Els
camps de text també són els del cercador: vora blava, i rosa quan hi tens el
cursor.

Això últim és nou i arregla dues coses alhora. Abans tot anava blanc amb vora
negra gruixuda i una ombra dura desplaçada sis píxels —l'aire de qualsevol plafó
d'ara, no el d'aquesta casa— i, sobretot, **el botó triat només es distingia
perquè el blanc es tornava cian**: dos colors igual de clars, l'un al costat de
l'altre, i qui hi jugava no sabia què tenia seleccionat. Ara el triat canvia de
color (gris → cian), de relleu (surt → enfonsat) i duu un ✓: tres pistes
independents, que és el que fa que no calgui distingir colors per saber-ho.

Si el que vols és entendre com funciona per dins, mira
[FUNCIONAMENT.md](FUNCIONAMENT.md).

## Com es juga

Et donem una paraula i has d'escriure-hi totes les rimes que puguis abans que
s'acabi el temps.

- **Fàcil** valida contra rimes **assonants** (només les vocals a partir de la
  tònica). **Difícil**, contra rimes **consonants**.
- **Paraula del dia**: n'hi ha **dues al dia i prou** —una de fàcil i una de
  difícil— i són **les mateixes per a tothom**, jugui en el dialecte que jugui.
  1 minut i un sol intent per dificultat. El que canvia amb el dialecte no és la
  paraula sinó **quines rimes valen**, que és de què va el lloc.
- **Il·limitat**: paraula nova cada partida i tres rellotges (30 s, 1 min,
  2 min).
- **Personalitzat**: t'ho tries tot i en surt un **enllaç**. Qui l'obri juga
  exactament la mateixa partida, i al final podeu comparar. No compta ni per a
  la classificació ni per als rècords.

Els accents no compten enlloc: escriure *cami* val per *camí* i *forca* per
*força*. Si una paraula ja s'ha enviat (amb accents o sense), es rebutja.

**La paraula objectiu mai és un verb** (seria massa fàcil rimar-hi amb altres
formes verbals conjugades), però els verbs sí que valen com a resposta. Això es
decideix quan es generen les dades, no en temps d'execució.

**Tampoc no hi surten les terminacions on rima gairebé tot.** Una paraula ha de
tenir entre **30 i 800 rimes** per poder ser jugada. El mínim és perquè hi hagi
prou joc; el màxim és el que treu del sac paraules com *camió*, *vent* o *gos*,
que tenen milers de rimes i converteixen la partida en escriure de pressa en
comptes de pensar.

I **la finestra es mira als quatre dialectes alhora**: una paraula només pot
sortir si té entre 30 i 800 rimes en central *i* en nord-occidental *i* en
valencià *i* en balear. La mateixa paraula en reparteix de molt diferents segons
on la diguis —*reflux* en té 64 en tres dialectes i 582 en balear—, i com que la
classificació és una de sola per a tothom, una paraula que en un dialecte en
dona vint i en un altre nou-centes no seria la mateixa partida segons qui la
jugui. De 152.000 paraules que no són verbs, n'hi ha **50.243** que passen el
filtre als quatre, i encara en queden unes 530 terminacions jugables per
dialecte. (L'única excepció és el mode **personalitzat**, on la finestra la
tries tu i el dialecte va tancat dins de l'enllaç.)

Abans de començar el joc et pregunta **com et vols dir**, i només t'ho pregunta
un cop: a partir d'aquí se'n recorda i, en acabar cada partida, el resultat es
**puja sol** a la classificació. També se't diu **quin percentil has fet** i
quantes rimes en treu de mitjana la resta de gent, i **quantes rimes tenia la
paraula**, que és un enllaç al cercador amb aquella paraula i aquell dialecte
per si les vols veure totes. Des del menú també pots mirar **com va anar ahir**:
quina paraula tocava, qui la va fer millor i quantes rimes se'n van trobar de
mitjana.

Des del menú pots veure **Com va anar ahir** (la paraula del dia d'ahir en el
teu dialecte, la mitjana de rimes que se'n van trobar i el rànquing d'aquell
dia), **Els meus rècords** (les teves millors puntuacions,
desades en aquest navegador: una bombolla per modalitat, amb quina paraula i en
quin dialecte les vas fer) i la **Classificació** (les de tothom), amb dues
pestanyes: **Il·limitat**, amb una taula per cada rellotge i dificultat, i
**Paraula del dia**, on tries dia i dificultat i veus el rànquing d'aquell dia i,
a sota, els deu millors de sempre.

## Les tipografies

Totes les que fa servir el joc s'**allotgen al mateix servidor**, i és a posta:
demanar-les al sistema vol dir que a l'ordinador se'n veu una i al mòbil una
altra.

| on | què es demana | on és |
|---|---|---|
| textos i accents (`--tipus-accent`) | Comic Relief | `/fonts/`, via `@use "../../css/fonts"` |
| titulars (`--tipus-titol`) | Anton | `joc/fonts/`, declarada al `joc/css/joc.scss` |
| cos (`--tipus`) | Verdana | la del sistema |

La Comic Relief i l'Anton són els clons lliures (OFL) de la Comic Sans i de la
Impact, que **no existeixen ni a Android ni a iOS**: abans el joc les demanava
directament i cada telèfon hi posava el que li semblava (una serif a Android, la
cal·ligràfica Snell Roundhand a iOS per a la Comic Sans; la sans-serif genèrica
per a tots els títols). Van les primeres de la pila, també a l'escriptori, perquè
si a l'ordinador es dibuixessin amb la font del sistema i al telèfon amb la
nostra seguiríem tenint dues cares del mateix joc.

La **Verdana** es queda com estava: no hi ha cap clon lliure que puguem
allotjar, i quan falta el navegador la canvia per una altra sans-serif (la Roboto
a Android, la del sistema a iOS). No és la mateixa lletra, però tampoc no és cap
sorpresa: una sans-serif per una altra sans-serif no trenca la pàgina com ho feia
la cursiva.

## La paraula del dia

N'hi ha **dues al dia** —una de fàcil i una de difícil— i són **les mateixes per
a tothom**, jugui en el dialecte que jugui. El que canvia amb el dialecte no és
la paraula sinó **quines rimes hi valen**: el mateix dia i la mateixa paraula
poden tenir 30 rimes en central i 52 en valencià.

Això no es pot treure de l'índex d'un dialecte, perquè cadascun reparteix les
paraules en claus de rima diferents i la mateixa llavor hi cauria en una paraula
diferent. Hi ha, doncs, una **llista a part** al mateix `index.json` (bloc
`diaries`), que és la intersecció dels quatre: **2.140 paraules en 541 claus de
rima**, les úniques que són objectiu d'una clau jugable **als quatre dialectes
alhora** i que no són ambigües (les que, sense accents, cauen en dues claus
—*dona* /dɔnə/ i *dóna* /donə/— queden fora, perquè no se sabria amb quina
estàs jugant). Les claus de la llista són les del **central**, que fa de
referència.

### Com es tria, i per què no es repeteix

1. Es compten els dies des d'una època fixa i es parteixen en **cicles de 541
   dies**, un per clau de rima.
2. Dins del cicle, la posició del dia diu quina clau toca, seguint una barreja
   de Fisher-Yates que només depèn del **número de cicle** i de la
   **dificultat**. Recorrent una barreja en ordre, **cap clau no es repeteix
   fins que s'han fet servir totes**; quan s'acaben, comença un cicle nou amb
   una barreja diferent i tot torna a estar disponible.
3. De les paraules d'aquella clau (fins a quatre) se'n tria una amb el mateix
   criteri, de manera que dos cicles seguits no donen la mateixa llista.

**No hi ha cap registre desat de les paraules que ja han sortit**, ni al
navegador ni al servidor: no caldria: la barreja es calcula sempre igual a tot
arreu, exactament com la paraula del dia mateixa. Comprovat sobre les dades de
debò: 541 claus i 541 paraules diferents en un cicle de 541 dies, en totes dues
dificultats, i el fàcil i el difícil mai no coincideixen el mateix dia (comprovat
sobre 400 dies seguits).

## El mode personalitzat

El mode per **jugar contra algú**. Et tries tots els ajustos, el joc en fa un
enllaç, i qui l'obri juga **exactament la mateixa partida**: les mateixes
paraules, en el mateix ordre i amb els mateixos filtres. Al final compareu els
números a la pantalla, o us passeu el resultat.

**No toca res de la resta del joc**: ni la classificació, ni els rècords, ni el
bloqueig de la paraula del dia.

### Què es pot triar

| ajust | marge | per defecte |
|---|---|---|
| Rima | assonant o consonant | assonant |
| Quines paraules | agudes, planes, esdrúixoles (les que vulguis) | totes tres |
| Quantes rimes | d'1 fins on vulguis, o sense màxim | de 30 a 800 |
| Segons per ronda | 10 a 600 | 60 |
| Rondes | 1 a 20 | 3 |

El **dialecte** és el que tinguis triat a la tira, i queda tancat dins de
l'enllaç: qui l'obri jugarà en aquell, encara que en tingui un altre de desat.
Ha de ser així, perquè la mateixa paraula té rimes vàlides diferents a cada
dialecte i si no els resultats no es podrien comparar.

**Agudes, planes i esdrúixoles surten de franc.** La clau de rima assonant és la
seqüència de vocals des de la tònica, o sigui que la seva llargada *és* la
classe: 1 aguda, 2 plana, 3 esdrúixola. Comprovat contra la transcripció de
88.541 paraules sense ni un desacord, diftongs inclosos (*remei* surt aguda i
*canvi* plana). I com que totes les claus d'un grup assonant tenen la mateixa
llargada, **el filtre val també per a les respostes**: si demanes planes, tota
rima que puguis escriure serà plana.

> **«Quantes rimes» vol dir coses diferents a cada dificultat**, i és a posta: el
> filtre diu quantes respostes bones tindràs. En consonant és la secció on rimes
> (de 2 a ~25.000); en assonant val el grup sencer, que sempre és molt més gros
> (de 2 a ~99.000). La pantalla ho diu i el recompte de sota s'actualitza sol.

### El recompte

Mentre toques el formulari, a sota hi surt quantes paraules hi ha amb aquests
filtres. Hi ha combinacions que no en donen cap —esdrúixoles amb més de
cinc-centes rimes, per exemple— i val més veure-ho abans de prémer el botó que
no pas després: quan surt zero, el botó es bloqueja.

### El codi de partida

Cinc caràcters (`QBNFZ`) que resumeixen **tots** els ajustos i la llavor. Surt a
la pantalla d'abans de començar i al resultat final. Si algú toca l'enllaç i
canvia un filtre, les paraules canvien i **el codi ja no coincideix**: es veu de
seguida, sense haver de comparar res més.

L'alfabet del codi no té ni la O ni la I ni els seus números, que a la pantalla
d'un mòbil es confonen: és per dir-lo en veu alta.

### Una altra partida

Al final hi ha **«Una altra partida»**: els mateixos ajustos, paraules noves.
Les paraules surten de la llavor, els ajustos i **el número de partida**, o sigui
que cadascú la demana quan vol i tots dos juguen el mateix: la partida 2 és la
partida 2 per a tothom. El número surt a la pantalla del resultat per no perdre
el compte.

### Com es reparteixen les paraules, i per què no es repeteixen

Igual que la paraula del dia, **les rimes es recorren seguint una barreja**, no
es tiren a l'atzar cada vegada: cada rima surt una vegada i prou fins que s'han
fet servir totes, i llavors comença una volta nova amb una barreja diferent. No
cal desar enlloc quines han sortit.

I **la roda no es reinicia a cada partida**: la passa es compta des de la
primera, o sigui que qui juga tres partides de tres rondes veu **nou rimes
diferents**, no tres de repetides. Només es repeteix quan s'han exhaurit totes
les que permeten els filtres.

```
signatura = dialecte|dificultat|segons|rondes|min|max|accents|llavor
                        │
                        ├─ + volta      → la barreja de les rimes
                        └─ + passa      → quina paraula de la rima que toca
```

### L'enllaç

```
rimador.cat/joc/?p=1&d=ca&m=c&t=15&r=2&n=20&x=200&a=123&s=5dawtj
```

| | |
|---|---|
| `p=1` | és una partida personalitzada |
| `d` | dialecte (el mateix paràmetre de sempre) |
| `m` | `a` assonant / `c` consonant |
| `t` | segons per ronda · `r` rondes |
| `n` / `x` | mínim i màxim de rimes (`*` = sense màxim) |
| `a` | quines paraules: `1` agudes, `2` planes, `3` esdrúixoles |
| `s` | la llavor |

## El freestyle

Una pàgina a part, `freestyle.html` **a l'arrel del lloc**
(`rimador.cat/freestyle.html`), que **no és un joc**: és un generador de
paraules per a qui fa freestyle. Cada X segons en surt una de nova en gran, amb
la caixa groga de la partida, i a sota quantes paraules hi rimen. No hi ha cap
camp de text, ni punts, ni classificació. **Encara no surt al menú** (ni al del
lloc ni a la portada del joc), però sí al `sitemap.xml` i es pot indexar.

La pàgina és a l'arrel, però **tota la resta és del joc**: el full d'estil
(`dist/css/joc.min.css`), el seu mòdul (`joc/js/freestyle.js`, al costat dels
altres perquè s'importen entre ells i el deploy els reescriu el `?v=` junts) i
les dades. Perquè les dades es trobin des de l'arrel, `joc/js/dades.js` les
demana **relatives al mòdul** (`new URL('../dades/', import.meta.url)`) i no
pas a la pàgina; per al joc no canvia res, perquè tots dos camins donen
`joc/dades/`.

Abans de començar es tria:

| ajust | marge | per defecte |
|---|---|---|
| Segons per paraula | 2 a 120 | 10 |
| Paraules | 1 a 200, o **sense límit** | 12 |
| Rima | assonant o consonant | consonant |
| Quines paraules | agudes, planes, esdrúixoles | totes tres |
| Quantes rimes | d'1 fins on vulguis, o sense màxim | de 30 a 800 |

La pantalla diu **quant durarà** (paraules × segons) i quantes paraules hi ha amb
aquells filtres, com el recompte del personalitzat. Els ajustos es recorden en el
navegador (`localStorage['rimador.joc.freestyle.v1']`).

Durant la sessió, el marcador du **dos rellotges**: quants segons falten perquè
canviï la paraula (el mateix que diu la barra) i quanta estona fa que
improvises, sense les pauses. No hi ha cap compte enrere de la sessió sencera, a
posta: mentre rimes, el que importa és la paraula d'ara. La capçalera diu
**Freestyle del Rimador.cat** i la marca torna als ajustos.

Hi ha **Pausa** (amaga la paraula i la terminació), **Següent** i **Atura**, i
també l'espai, la fletxa → i l'Esc. Si la pestanya s'amaga, es posa en pausa
sola, i al mòbil es demana que la pantalla no s'apagui (Wake Lock API, on n'hi
ha). Al final surt quantes paraules han sortit i en quanta estona, i la llista
de paraules, cadascuna amb un enllaç al cercador amb totes les seves rimes.

La terminació fonètica (`\ɛsə\`) va en **pes normal**, com al joc: la lletra
fonètica del lloc només en té aquest pes, i en negreta les lletres llatines
sortien gruixudes al costat de les fonètiques primes.

**Les paraules surten amb el codi del personalitzat**: els filtres són els de
`opcionsDeRima` i la tira la fa `rondesPersonalitzades`, amb una llavor nova a
cada sessió. O sigui que **no es repeteix cap rima** fins que s'han fet servir
totes les que permeten els filtres. Sense límit, es demanen per tandes de 200
amb la mateixa signatura, i la roda continua d'una tanda a l'altra.

> **Quantes rimes, aquí, no compta la paraula mateixa.** L'índex compta les
> paraules de cada secció, ella inclosa, i el personalitzat filtra amb aquest
> número; el freestyle desplaça la finestra un lloc perquè el número de sota la
> paraula (que és el `rimesPossibles` de la partida, sense ella) quedi dins del
> mínim i el màxim que has triat.

## Els dialectes

S'hi juga en els **quatre dialectes** que serveix el cercador, i es tria amb la
tira de la pantalla d'inici. Comparteix la memòria amb el cercador
(`localStorage['rimadorDialecte']`) i entén el mateix paràmetre a l'adreça
(`rimador.cat/joc/?d=va`), o sigui que qui hagi triat el valencià al cercador es
troba el joc en valencià sense haver-ho de tornar a dir.

El dialecte no és cap capa per sobre: **canvia les rimes de debò**, perquè cada
dialecte reparteix les paraules en grups de rima diferents. Per això:

- **La paraula del dia és la mateixa a tot arreu.** N'hi ha dues al dia (una
  per dificultat) i no depenen del dialecte. Com que cada dialecte reparteix les
  paraules en claus de rima diferents, això no es pot treure de l'índex de cap
  d'ells: hi ha una **llista a part**, la intersecció dels quatre, amb les
  paraules que valen com a objectiu a tots (vegeu més avall).
- **La paraula a rimar surt sempre del diccionari global**, el que comparteixen
  els quatre; però **les paraules pròpies del dialecte valen com a resposta**.
  Cada dialecte té el seu **apèndix** —les formes que només es diuen allà— i el
  diccionari complet d'un dialecte és *global + apèndix*: qui juga en valencià
  ha de poder respondre-hi una paraula valenciana. Compten també per al recompte
  de rimes, o sigui que una terminació pot tenir més rimes en un dialecte que en
  un altre justament perquè l'apèndix n'hi afegeix.
- **La finestra de rimes es comprova als quatre dialectes.** Una paraula només
  pot ser la que has de rimar si té entre 30 i 800 rimes a tots quatre: si no,
  la mateixa partida seria fàcil en un dialecte i impossible en un altre, i la
  classificació és una de sola per a tothom.
- **El bloqueig diari és per dificultat i prou**, no per dialecte: dues partides
  al dia. Canviar de dialecte ja no dona una paraula nova, perquè ara és la
  mateixa.
- **Els rècords van per dialecte**, com van per rellotge i dificultat. Són
  personals i locals: comparar-te amb tu mateix en dialectes diferents no vol dir
  res.
- **La classificació, en canvi, NO es parteix.** Hi ha una taula per modalitat i
  prou, amb tothom qui hi ha jugat. El dialecte de cada intent surt entre
  parèntesis a la seva fila (`amb «bytownites» (Central)`). Quatre
  classificacions de quatre persones cadascuna no serien cap classificació.

Els codis no es declaren enlloc del joc: surten de `dades/versions.json`, que els
escriu el generador a partir de les carpetes de `dialectes_col/`. Els noms que es
veuen a la tira són el `NOMS_DE_DIALECTE` de `eines/generar_dades.py` i han de
coincidir amb el `DIALECTES` de `js/components.js`, que és el que pinta la tira
del cercador.

## Per què les dades són com són

El diccionari global fa 520.418 entrades (i cada dialecte hi suma el seu
apèndix: entre 107.000 i 236.000 formes més). La web principal se'l carrega
tot a IndexedDB, però un joc no es pot permetre esperar això. La sortida d'aquí
es basa en dues observacions:

1. **La clau de rima consonant sempre implica la mateixa clau assonant**
   (el generador ho comprova a cada passada i s'atura si algun dia deixa de ser
   cert). O sigui que un sol fitxer per grup assonant serveix les dues
   dificultats: en fàcil valen totes les paraules del fitxer i en difícil només
   les de la secció de la paraula objectiu. **Una sola descàrrega per partida.**
2. **No cal cap llista de paraules objectiu.** Poden ser objectiu totes les
   paraules no verbals que tinguin entre 30 i 800 rimes **als quatre dialectes**,
   i quines són ho decideix el generador: al fitxer de rimes hi van marcades amb
   un `*` i l'índex en porta el recompte de cada terminació.

   **Es tria SEMPRE per rima, mai per paraula**, i què és una rima depèn de la
   dificultat:

   | | què és una rima | quantes n'hi ha (central) |
   |---|---|---|
   | **Difícil** (consonant) | cada terminació consonant | 541 |
   | **Fàcil** (assonant) | cada **grup assonant** | 36 |

   En fàcil les respostes bones són el grup sencer, o sigui que dues
   terminacions del mateix grup són la mateixa partida amb una altra paraula al
   davant: la rima és el grup. Un cop triada la rima, la paraula surt d'entre
   totes les del grup, totes igual de probables.

   No és cap detall, i té dos pisos:

   - **triar per paraula** (com es feia) donava una mediana de 156 rimes i
     **una de cada tres partides passava de 300**; per clau, la mediana és 45 i
     només hi passa el 6 %;
   - **triar la clau consonant en mode fàcil** (com es feia fins ara) afavoria
     els grups amb més terminacions: al central, el grup més gros s'enduia el
     **7,3 %** de les partides i els setze més petits es repartien el 0,6 %.
     Triant per grup, cadascun té el seu 1,4 %.

Resultat: **sis fitxers**, i el joc es baixa el dialecte sencer un sol cop.

```
joc/dades/versions.json   500 B    els resums
joc/dades/index.json      452 KB   les claus dels 4 dialectes + on és cada grup
joc/dades/ca.txt          7,6 MB   (1,9 MB comprimits, que és el que viatja)
joc/dades/nw.txt  va.txt  ba.txt
```

| dialecte | claus jugables | paraules objectiu | claus publicades | grups assonants |
|---|---|---|---|---|
| Central (`ca`) | 541 | 50.277 | 4.267 | 69 |
| Nord-occidental (`nw`) | 532 | 50.266 | 4.319 | 117 |
| Valencià (`va`) | 535 | 50.266 | 4.222 | 112 |
| Balear (`ba`) | 520 | 50.271 | 4.122 | 88 |

Les dues primeres columnes són **el que fan servir els modes normals**, i les
paraules objectiu són gairebé les mateixes als quatre perquè és, justament, la
llista de les que valen a tot arreu: **50.243** paraules que tenen entre 30 i 800
rimes en tots quatre dialectes.

Al fitxer, però, hi ha molt més. Des que hi ha el mode personalitzat s'hi
publiquen **totes** les claus de dues rimes amunt i sense sostre (unes 4.200 per
dialecte) i **totes** les paraules no verbals (unes 150.000), perquè el jugador
es pugui triar la finestra que vulgui. Cada paraula del fitxer duu escrit de
quina mena és: `*` si es pot rimar als quatre dialectes, `+` si només la pot
proposar el personalitzat, i res si només val com a resposta (els verbs i
l'apèndix). Els modes normals es retallen la llista en temps d'execució (vegeu
`clausDeLaFinestra` a `js/objectius.js`).

A part, l'índex porta la llista de la **paraula del dia**: 2.140 paraules
repartides en 541 claus de rima, les úniques que valen com a objectiu **als
quatre dialectes alhora** i que no són ambigües. Vegeu més avall.

**Abans n'hi havia 183**, un per grup assonant i dialecte, perquè una partida
només necessita un grup. Sortia a 145 KB per partida —la mediana era de 11 KB,
però la tria és ponderada i els grups grossos surten més sovint—, i omplia el
repositori de fitxers que no mira mai ningú. Ara la primera partida paga 1,9 MB
i les següents no paguen res: **a partir de tretze ja s'hi guanya**.

El fitxer del dialecte es comença a baixar en obrir la pàgina, mentre tries mode
i rellotge, o sigui que quan prems «Comença» ja acostuma a ser-hi. Si encara no
hi és, surt un loader amb el percentatge de debò i una barra; si ja hi és, no
surt res, perquè preparar la partida són 90 ms.

### Què hi ha i què no

Del diccionari global (520.418 entrades) en surten **412.845 formes úniques** un
cop tretes les repeticions d'accent. Fora en queden **14.705 noms propis**, que
no valen ni com a paraula a rimar ni com a resposta.

Al fitxer de cada dialecte hi arriba el **99,4–99,6 %** d'aquelles formes, **més
tot l'apèndix del dialecte**: el central en té 475.695 en total i el balear
564.467, i la diferència són justament les paraules que només es diuen allà. El
que falta del global són unes 1.800 paraules per dialecte: les que cauen en un
grup assonant on **cap** clau consonant arriba al mínim de rimes (*abutilon*,
*acantolisi*, *acefala*…). Són finals raríssims i no es publiquen perquè no s'hi
podria jugar de cap manera.

Per a una partida concreta, en canvi, **no falta cap rima**: el grup assonant
sencer va al fitxer, seccions no jugables incloses, o sigui que tot el que rima
amb la paraula que t'ha tocat hi és.

De les formes del fitxer, poden **sortir com a paraula a rimar** unes 151.000
per dialecte al mode personalitzat i **50.243** als modes normals: la resta són
verbs (exclosos a posta, conjugats i amb pronom), o són de l'apèndix, o són en
claus amb menys de 30 rimes o amb més de 800. I hi ha claus amb prou rimes que només contenen verbs:
hi són al fitxer i valen com a resposta, però no poden ser mai la paraula
objectiu.

`joc/dades/` continua fent 30 MB al repositori. La por que un fitxer derivat
s'hagi de tornar a pujar sencer a cada canvi (el motiu pel qual es va esborrar
`bot/resultat_ordenat_cons.json`) aquí no s'aplica: està mesurat que dues
versions del fitxer amb una paraula de diferència empaqueten a 1,93 MiB en
total, perquè el git fa deltes molt bé amb text ordenat de manera estable.

### Format dels fitxers de rimes

```
#aðə              <- capçalera de secció: clau de rima consonant
*cascada          <- OBJECTIU A TOTS ELS DIALECTES: la pot proposar qualsevol mode
+panderola        <- objectiu NOMÉS al mode personalitzat
cavalcava         <- sense marca, només val com a RIMA (un verb, o l'apèndix)
*cami>camí        <- si la forma real porta accents, va després del ">"
```

Els grups assonants van l'un darrere l'altre dins el fitxer del dialecte.

Com que la part esquerra ja és la clau normalitzada, el joc no ha de normalitzar
res en temps d'execució: només parteix línies i mira el primer caràcter.

Les **tres menes de paraula** són el que fa que la finestra dels quatre dialectes
no s'endugui el mode personalitzat pel davant:

| | qui la pot proposar | qui hi ha |
|---|---|---|
| `*` | tots els modes | té entre `MIN_RIMES` i `MAX_RIMES` rimes **als quatre dialectes** |
| `+` | només el personalitzat | no és verb, però no passa la finestra a tot arreu |
| (res) | ningú | els verbs (conjugats i amb pronom) i tot l'apèndix del dialecte |

L'`index.json` guarda dues coses per dialecte: de cada clau publicada, a quin
grup és, quantes rimes té i **dos** recomptes de paraules objectiu —les de
qualsevol mena i les que valen arreu—, que són els pesos amb què es tria; i de
cada grup, **on comença i quant ocupa, en bytes**. Això
últim és el que permet al joc no interpretar els 7,6 MB per jugar amb un grup:
es guarda el fitxer com a `ArrayBuffer` i només descodifica el tros que li toca.
El pitjor cas mesurat —el grup més gros del central, 77.000 paraules— són 90 ms.

Els desplaçaments són en **bytes** i no en caràcters a posta: un índex de Python
són punts de codi i un de JavaScript són unitats UTF-16, i amb IPA pel mig no val
la pena jugar-s'hi.

## Regenerar les dades

Cal fer-ho a mà quan canviï el diccionari o la transcripció d'algun dialecte:

```bash
python joc/eines/generar_dades.py            # tots els dialectes
python joc/eines/generar_dades.py ca va      # només aquests
```

Els camins no els sap l'script: surten de `diccionaris/python/camins.py`, que és
el vocabulari compartit de tots els scripts del repositori. Llegeix la `col_0` i
la `col_2` de `diccionaris/separat/` i la rima de `dialectes_col/<codi>/`, i
reescriu `joc/dades/`. Triga un minut llarg per als quatre dialectes.

### L'apèndix de cada dialecte

Surt del `camins.py` (`te_apendix()` i `cami_apendix()`):

```
dialectes_col/<codi>/apendix/
    col_0_<codi>.txt    la paraula
    col_2_<codi>.txt    el codi gramatical
    col_3_<codi>.txt    la clau de rima consonant
    col_4_<codi>.txt    la clau de rima assonant
```

Les mateixes columnes paral·leles que el diccionari global, i **sense el nom al
mig**: dins de l'apèndix, `col_3` i `col_4` no es poden confondre amb res. Si la
carpeta no hi és, el dialecte no en té i no passa res; si hi és i hi falta alguna
columna, l'script s'atura, perquè un apèndix a mitges donaria rimes vàlides que
el joc no acceptaria i **no hi hauria cap error visible**.

Les paraules de l'apèndix **compten com a rima i mai com a paraula a rimar**, i
per tant fan pujar el recompte de la seva terminació en aquell dialecte.

### Els paràmetres

`MIN_RIMES`, `MAX_RIMES`, `MIN_RIMES_PUBLICADES`, `DIARIES_PER_CLAU`, si els
verbs conjugats poden ser objectiu i com es diu cada dialecte: són constants a
dalt de tot de l'script.

**Passa'l sempre sense arguments.** Dues coses només es poden fer amb una passada
de tots els dialectes:

- la llista de la **paraula del dia**, que és la intersecció dels quatre (en una
  passada parcial es conserva la que hi havia i l'script ho diu);
- i **quines paraules es poden rimar arreu**, que és el que decideix la marca de
  cada paraula del fitxer. En una passada parcial, els comptes dels dialectes que
  no es regeneren es treuen del seu `dades/<codi>.txt` ja publicat —que no és
  exacte del tot— i, si les seves marques han quedat desactualitzades, l'script
  avisa amb un `ATENCIO` i diu que la refacis sencera.

Els fitxers que no canvien no es reescriuen, o sigui que una passada sense canvis
al diccionari no deixa cap diff.

Per provar-lo sense tocar les dades bones, `RIMADOR_ARREL` el fa córrer contra
una còpia de joguina de l'arbre (entrades **i** sortides, vegeu `camins.py`).

**Important:** si es regeneren les dades, la paraula del dia d'aquell dia pot
canviar per a qui encara no l'hagi jugada, perquè la tria depèn de l'ordre i dels
pesos de l'índex. Val més fer-ho de nit.

## La gestió de versions

És **la mateixa que la del diccionari**, i val tant per a les dades com per al
codi.

**Les dades** van amb resum de contingut. `generar_dades.py` escriu
`dades/versions.json` amb un sha256 escurçat de cada fitxer, igual que fa
`diccionaris/python/versions.py` amb les columnes. El joc es baixa el
`versions.json` sense memòria cau (`?t=`) i tota la resta amb `?v=<resum>`, o
sigui que cada fitxer es torna a baixar exactament quan ha canviat i mai més.
Si el `versions.json` no es pot llegir, es fan servir els resums de l'última
vegada (desats al `localStorage`), que és el mateix rescat que fa el
`carregarVersions` de `js/script.js`.

A diferència del `versions.json` del diccionari, aquí les claus són **camins** i
no noms de fitxer sols: allà el navegador indexa la memòria cau pel nom
(`rutaFitxer.split("/").pop()`) i cada fitxer és únic, però aquí el
`ca/rimes/0.txt` i el `va/rimes/0.txt` es dirien igual.

**El codi** va amb el `?v=` de sempre, el que escriu el `deploy.yml` amb els set
primers caràcters del commit. Ara `joc/` hi entra com l'arrel: tocar
`joc/js/*.js` o `joc/css/*.scss` dispara el refresc, i el `sed` no escriu només
als HTML sinó també **a les importacions entre mòduls** (`from './ui.js?v=...'`).
Sense això, refrescar `principal.js` deixava els altres vuit mòduls a la memòria
cau del navegador, perquè una importació no hereta el `?v=` de l'etiqueta
`<script>` que va carregar el primer. El `?v=dev` que hi ha al repositori és el
valor de treball: el desplegament el substitueix.

## Classificació (leaderboard)

Funciona igual que el registre de cerques de la web: el navegador envia la
puntuació a un Google Apps Script, que l'apunta a un full de càlcul; un script de
Python llegeix el full publicat en CSV i en fa el rànquing que es veu al joc.

**El nom es tria ABANS de la partida, i només el primer cop.** A la pantalla on
tries dificultat i rellotge hi ha un bloc «Qui juga»: si el joc encara no sap com
et dius, el camp surt obert i el botó de començar es queda bloquejat fins que ho
diguis; si ja ho sap, només hi surt qui ets i un botó per canviar-t'ho. En acabar
la partida, la puntuació **puja sola** i no s'hi ha de tocar res.

Ha passat per tres formes i val la pena recordar per què:

| | què passava |
|---|---|
| camp + botó «Enviar» a cada partida | qui no l'omplia —que era la majoria— no sortia enlloc encara que hagués fet una partidassa |
| el nom, la primera vegada, **al final** | el «Canvia el nom» d'aquella pantalla tornava a enviar la MATEIXA puntuació amb el nom nou: dues files de la mateixa partida al full, i el compilador havent de desempatar-les per data |
| el nom **abans de començar** (ara) | quan la partida s'acaba ja se sap com et dius, i cada partida s'envia una vegada |

Les partides de zero rimes no s'envien. I el mode personalitzat no en demana cap,
perquè no toca la classificació.

**No es pot agafar un nom que ja sigui a la classificació.** El compilador
publica la llista de noms ocupats (`noms_ocupats`) i el joc no en deixa triar
cap de repetit. La llista és, per força, la de l'última compilació: dues
persones poden triar el mateix nom el mateix dia sense poder-ho saber, i això no
trenca res, perquè el rànquing separa la gent per **identificador d'usuari** i no
pas pel nom (surten dues files, no una de barrejada).

Fitxers:

```
joc/js/classificacio.js                  enviar la puntuació + llegir el rànquing
joc/eines/apps_script_classificacio.gs   codi per enganxar a Google Apps Script
joc/eines/compilar_classificacio.py      full CSV -> joc/dades/classificacio.json
joc/dades/classificacio.json             el rànquing que mostra el joc
```

### Posar-la en marxa (un sol cop)

1. Crea un full de càlcul a Google Sheets amb aquestes capçaleres a la fila 1:

   `Data | DataPartida | Sobrenom | Mode | Dificultat | Segons | Dialecte | Punts | Paraula | Usuari`

   Hi ha **dues dates** a posta: la `Data` és quan va arribar l'enviament (la
   posa Google) i la `DataPartida` de quin dia era la partida (la diu el
   navegador, en horari de Catalunya). Qui juga la paraula del dia a les 23.55 i
   l'envia a les 00.05 ha jugat la d'ahir, i el rànquing per dia ha d'agrupar
   per la segona.

   **No cal preparar les columnes a mà.** L'Apps Script llegeix la fila 1, hi fa
   quadrar cada valor pel seu títol i afegeix al final les que hi falten. Si el
   teu full ve d'abans i no té la `DataPartida` (o la `Dialecte`), n'hi ha prou
   de tornar a desplegar l'script: la primera puntuació que arribi crearà la
   columna. Abans s'escrivia per posició, i un full amb una columna de menys
   feia que tot el que venia darrere quedés desplaçat una casella sense que
   ningú se n'adonés.
2. Extensions → Apps Script → enganxa-hi `eines/apps_script_classificacio.gs`.
   Desplega'l com a aplicació web (accés: qualsevol) i copia l'URL `/exec`.
3. Posa aquell URL a `URL_ENVIAMENT` de `joc/js/classificacio.js`.
4. Publica el full en CSV (Fitxer → Comparteix → Publica a la web → CSV) i posa
   aquell URL a `URL_FULL_CSV` de `joc/eines/compilar_classificacio.py`.

> El compilador no perd les files velles: les que no duguin `DataPartida` o
> `Dialecte` es donen per centrals i pel dia que van arribar.

Les puntuacions **s'envien des d'on sigui**: de `rimador.cat`, del repositori de
proves i de `localhost`. El registre de cerques de la web no ho fa (vegeu
`ES_WEB_OFICIAL` a `js/script.js`, que només deixa passar els dos dominis de
debò), però aquí és a posta: una classificació que no deixa enviar res mentre la
proves no es pot provar.

El preu és que les partides de prova van al full de debò. Qui filtra de veritat és
el compilador: si un dia hi ha soroll, s'esborra la fila del full o s'afina allà,
que és on es pot fer sense deixar el joc coix mentre s'hi treballa.

### Refrescar el rànquing

**L'actualització és automàtica**: cada dia a les 22:01 UTC, el workflow
`.github/workflows/dades_nocturnes.yml` executa `eines/compilar_classificacio.py`,
que llegeix el full, valida els sobrenoms, es queda la millor puntuació de cada
persona i modalitat, i reescriu `joc/dades/classificacio.json`.

Per **forçar una actualització manual** (p. ex., si has esborrat una fila del full):

- **Des de GitHub** → Actions → «Actualització automàtica de la classificació del
  joc» → «Run workflow».
- **Des de local**:
  ```bash
  python joc/eines/compilar_classificacio.py
  ```
  (Necessita `pandas`: `pip install pandas`, igual que `stats/stats.py`.)

En surten quatre coses: el rànquing de cada **modalitat**
(`mode|dificultat|segons`), el de cada **dia** de la paraula del dia, el dels
**millors de sempre** a la paraula del dia (`TOP_DIARIA`, ara 10) —els dos
últims per dificultat— i les **estadístiques**. Els tres rànquings es veuen a
les dues pestanyes de la pantalla de classificació: la d'**Il·limitat** només
ensenya les modalitats `illimitat|…`, i la de **Paraula del dia**, les altres
dues taules. Les estadístiques no es veuen enlloc d'allà: són per a la pantalla
de final (vegeu més avall).

### Les estadístiques de la pantalla de final

El bloc `estadistiques` del `classificacio.json` no és cap rànquing: són
**totes** les partides, resumides en un histograma (quantes n'hi ha hagut de cada
puntuació) amb el recompte i la mitjana al costat. És el que permet dir-li a qui
acaba de jugar «has superat el 72 % de les partides» sense publicar la llista
sencera ni preguntar res a cap servidor: el percentil el calcula el navegador
(vegeu `js/estadistiques.js`).

N'hi ha de tres menes:

| clau | agrupat per | per a què |
|---|---|---|
| `modalitats` | `mode\|dificultat\|segons` | el percentil de l'il·limitat |
| `diaria` | dia + dificultat + **dialecte** | la mitjana d'un dia amb aquella paraula (avui i, sobretot, ahir) |
| `diaria_totals` | dificultat | la xarxa de sota, quan encara no hi ha dades d'avui |

La paraula del dia va per dialecte perquè **cada dialecte té la seva paraula**:
barrejar-los seria fer la mitjana de paraules diferents. Es compten partides i no
persones (la pregunta és «aquesta partida, com ha anat comparada amb les
altres»), tret dels enviaments repetits de la mateixa partida, que es descarten.

**El JSON es refà un cop al dia**, o sigui que qui juga la paraula del dia abans
que hi torni a passar el compilador encara no té cap dada d'avui. Quan passa,
el joc ho diu i compara amb totes les paraules del dia d'aquella dificultat en
comptes de callar.

El que sí que és una xifra tancada és **la d'ahir**, i per això hi ha la pantalla
«Com va anar ahir» (al menú d'inici i al final de cada partida): quina paraula
tocava en el teu dialecte, quantes rimes se'n van trobar de mitjana i qui la va
fer millor. La paraula la calcula el joc mateix amb la llavor de sempre, o sigui
que hi surt encara que ahir no hi jugués ningú, i el rànquing es filtra pel teu
dialecte, perquè cada dialecte va jugar amb una paraula diferent.

**No hi ha cap mínim de partides**: si de la modalitat només n'hi ha una, es diu
que n'hi ha una i s'ensenya igualment el número. Un percentil sortit de poques
partides ja s'entén tot sol quan al costat hi diu de quantes surt.

El dialecte **es guarda al full i viatja amb cada entrada**, però no parteix cap
taula: el joc el posa entre parèntesis a cada fila. Els noms (*Central*,
*Valencià*…) no són al JSON, que hi porta el codi: els tradueix el joc amb el que
digui el `versions.json`, per dir-los en un sol lloc.

## Estructura

```
joc/
  index.html            totes les pantalles, amagades amb l'atribut hidden
  css/joc.scss          estètica rosa/cian dels 90, disseny mòbil primer;
                        el gulp en fa dist/css/joc.min.css
  js/
    principal.js        lliga pantalles, motor i dades
    dades.js            versions, descàrrega i lectura dels fitxers de rimes
    dialecte.js         quin dialecte es juga (comparteix memòria amb el cercador)
    objectius.js        tria de la paraula (a l'atzar o la del dia)
    estadistiques.js    percentil, mitjana i el rànquing d'ahir
    personalitzat.js    els ajustos del mode personalitzat, l'enllaç i el codi
    freestyle.js        tot el freestyle.html de l'arrel (fa servir dades, objectius i ui)
    motor.js            rellotge, validació i puntuació (no toca el DOM)
    normalitza.js       accents fora; ha de coincidir amb el generador
    ui.js               tot el que toca el DOM
    magatzem.js         localStorage: rècords, paraula del dia i sobrenom
    compartir.js        el text del resultat, el porta-retalls i el piulet
    classificacio.js    enviar/llegir el rànquing global
  fonts/                l'Anton (clon lliure de la Impact), allotjada aquí
  dades/                generat pels scripts d'eines/
    versions.json         quins dialectes hi ha i el resum de cada fitxer
    index.json            les claus dels 4 dialectes i on és cada grup
    <codi>.txt            totes les rimes d'un dialecte
    classificacio.json    el rànquing publicat
  eines/
    generar_dades.py            diccionari + rima -> dades/
    compilar_classificacio.py   full CSV -> classificacio.json
    apps_script_classificacio.gs  backend per a Google Apps Script
```

El JS són mòduls ES natius i no passen per cap procés de compilació: el navegador
se'ls carrega tal com són. El CSS sí que es compila (vegeu la tasca `styles-joc`
del `gulpfile.js`), o sigui que l'`index.html` no apunta a `css/joc.scss` sinó a
`../dist/css/joc.min.css`.

## Mentre hi hagi `joc/` i `joc2/`

Aquesta carpeta és la versió que ha de substituir `joc/`. Fins que això passi,
les dues conviuen, i hi ha **set llocs** que ho han de saber perquè `joc2/`
funcioni. Tots duen un comentari que ho recorda; això és la llista completa:

| on | què hi ha |
|---|---|
| `gulpfile.js` | `CARPETES_DEL_JOC = ['joc', 'joc2']`. Cada carpeta té el seu full (les classes no són les mateixes) i el nom de la carpeta mana: `joc/css/joc.scss` → `dist/css/joc.min.css`, i el d'aquí → `dist/css/joc2.min.css` |
| `index.html` | el `<link>` demana `../dist/css/joc2.min.css` |
| `css/joc.scss` | les `@font-face` apunten a `../../joc2/fonts/` (són relatives al full compilat, no a aquest fitxer) |
| `index.html` | `robots: noindex` mentre `joc/` també sigui indexable: totes dues declaren el mateix `canonical` |
| `service-worker.js` | `joc2/js/` al shell i `joc2/dades/` a `NO_TOCAR`, com les de `joc/` |
| `.github/workflows/deploy.yml` | `joc2/js` i `joc2/css` a la detecció de canvis, al *cache busting* del `?v=` i als fitxers que es comiten; `dist/css/joc2.min.css` i `joc2/dades/versions.json` a la xarxa de seguretat |
| `.github/workflows/dades_nocturnes.yml` | també passa `joc2/eines/compilar_classificacio.py` i comiteja `joc2/dades/classificacio.json` |

Els **scripts de Python no hi surten**: tots dos es calculen la carpeta a partir
d'on són ells mateixos (`DIR_JOC`), o sigui que `python joc2/eines/…` escriu dins
de `joc2/` i prou. Abans hi tenien el `"joc"` escrit a mà i reescrivien les dades
de l'altra carpeta.

**El dia que `joc/` s'esborri** i aquesta carpeta passi a dir-se `joc`: treure el
`joc2` de les set entrades de la taula, tornar l'`index.html` a `index, follow` i
al full `joc.min.css`, i les `@font-face` a `../../joc/fonts/`. No hi ha res més.

## Coses que convé saber

- **La paraula del dia no es repeteix.** Els dies es parteixen en **cicles de
  541 dies** (un per clau de rima, un any i mig llarg). Dins d'un cicle, les
  claus es recorren seguint una barreja que només depèn del número de cicle i de
  la dificultat: cap paraula no torna a sortir fins que s'han fet servir totes
  les claus, i llavors comença un cicle nou amb una barreja diferent. **No cal
  desar enlloc quines han sortit**: la barreja es calcula sempre igual a tot
  arreu, com la paraula del dia mateixa. Comprovat: 541 paraules diferents de
  541 dies, en totes dues dificultats.
- Com que de cada clau se'n guarden fins a quatre paraules (`DIARIES_PER_CLAU`),
  dos cicles seguits **no donen la mateixa llista**: només en repeteixen 136 de
  541 en fàcil i 150 en difícil.
- **El dia és el de Catalunya, no el del rellotge de qui juga.** L'`avui()` de
  `js/magatzem.js` calcula la data a `Europe/Madrid`
  (`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })`, que és
  l'única localització que dona `AAAA-MM-DD` directament), o sigui que **la
  paraula del dia canvia a la mitjanit CET a tot el món**. Abans es feia amb
  l'hora local i a Tòquio n'hi havia una de nova set o vuit hores abans que a
  Barcelona. És el mateix fus que fa servir el full de la classificació per
  apuntar quan arriba cada puntuació. Si el navegador no té dades de fusos, es
  cau a l'hora local, que és el que es feia abans.
- **El bloqueig diari** es guarda a `localStorage`, amb un sol dia desat cada
  vegada: quan canvia la data, l'entrada vella se substitueix. Va **per
  dificultat i prou**, no per dialecte: la paraula del dia és una de sola i
  canviar de dialecte per tornar-la a jugar seria jugar-la dues vegades.
- **Els rècords** van per mode, dificultat, rellotge i dialecte
  (`illimitat|dificil|30|va`) i es veuen a la pantalla "Els meus rècords", una
  bombolla per modalitat i una fila per dialecte. De cada un se'n desa la
  puntuació i **amb quina paraula el vas fer**; els que ja hi hagués desats de
  quan només se'n desava el número continuen valent, però sense paraula. Els que
  hi hagués d'abans dels dialectes es migren al central el primer cop que s'obre
  el joc.
- **La classificació** s'envia sola en acabar qualsevol partida amb almenys una
  rima; la validació de veritat (les paraules vetades, la desduplicació) la fa el
  compilador de Python.
- **Els rellotges de l'il·limitat** són 30 s, 1 min i 2 min. Abans eren 45 s,
  1 min 30 s i 3 min; una modalitat que no sigui cap de les tres d'ara es titula
  amb els segons i prou.
- Si el `localStorage` no hi és (navegació privada), el joc funciona igual;
  simplement no recorda res.
