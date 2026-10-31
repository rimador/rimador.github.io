# Proposta: com es tria la paraula del dia i la de l'il·limitat

Nota per a tu d'aquí a un temps. Això **encara no està fet**: és la proposta que
vam tancar el 31-10-2026 per substituir la roda de la paraula del dia i l'atzar
de l'il·limitat. El que hi ha ara ho explica el [`FUNCIONAMENT.md`](FUNCIONAMENT.md)
(apartat 7); aquí hi ha el que hi ha d'haver, per què, i el que encara falta
decidir.

El **mode personalitzat no canvia**: allà el jugador tria els paràmetres i la
llavor va dins de l'enllaç.

---

## 0. En deu línies

1. La paraula del dia la continua calculant **el navegador amb una fórmula amb
   llavor**, infinita: no hi ha cap calendari per allargar ni cap workflow.
2. Hi ha **dos carrils**: el fàcil tria grups assonants i el difícil, claus
   consonants. Cadascun té les seves **bosses** (trams de rimes) i les seves
   **quotes** (el tant per cent de dies de cada bossa).
3. Cada dia es decideix en tres passos: **quina bossa** (repartiment ponderat,
   exacte), **quina clau** (una baralla per bossa, sense repetir) i **quina
   variant i quina paraula** (torns entre les rimes dels altres dialectes).
4. La configuració i el contingut de les bosses es **congelen en eres**. Una era
   té una data d'inici i dura fins que comença la següent. Canviar quotes, talls
   o fer entrar paraules noves és començar una era nova, sempre a uns dies vista.
   El passat no es mou mai.
5. Es congela **quina paraula surt cada dia**; **amb quines rimes es juga** ho
   decideix sempre el diccionari del moment. Corregir transcripcions no demana
   cap era nova.
6. La paraula del dia és **la mateixa per a tothom**. Entre dialectes **mana el
   central**: la bossa la decideixen les seves rimes, i els altres dialectes han
   de tenir **entre ×0,5 i ×2** de les rimes del central.
7. Les **paraules manuals** substitueixen el dia sense moure res més. Es
   validen als quatre dialectes abans de publicar-les i es publiquen **xifrades**.
8. **Ofuscació com ara**: qui sàpiga programar ho pot calcular, però enlloc no hi
   ha cap llista pública de dates i paraules en clar.
9. La **previsió** es fa amb node, important el mateix mòdul del joc: no hi ha
   cap còpia en Python que s'hagi de mantenir igual.
10. L'**il·limitat** passa a ser **natiu per dialecte** (les bosses es calculen
    amb les rimes de cada dialecte, sense mirar els altres) i fa servir una
    **seqüència per jugador** que compleix les quotes exactament.

---

## 1. Què falla ara

- **La roda es mou sola.** La paraula del dia depèn del nombre de claus de la
  llista `diaries` (`cicle = dia / quantes`, i la barreja es fa amb `quantes`).
  Cada vegada que `generar_dades.py` dona una clau de més o de menys, **canvien
  totes les paraules, també les dels dies passats**. Va passar en canviar la
  finestra a 50–1000, i tornaria a passar cada cop que el diccionari creix.
- **Una sola bossa.** Totes les claus de la finestra surten amb la mateixa
  probabilitat. Com que hi ha moltes més claus amb poques rimes que amb moltes,
  la majoria de dies són difícils i no es pot decidir quant de sovint surt cada
  tram.
- **Les manuals són públiques i en clar.** `dades/diaries_manuals.json` diu a
  qualsevol que el 23-4-2027 toca *rosa* i *lectura*. A més, si un dialecte no té
  la paraula manual, aquell dialecte juga la de la roda: aquell dia no tothom té
  la mateixa paraula.
- **La previsió és una còpia.** `eines/predictor.py` reprodueix en Python el
  generador aleatori del JS; si un dels dos canvia, deixen de coincidir.
- **L'il·limitat va a l'atzar** (`Math.random`) i només fa servir paraules
  vàlides als quatre dialectes dins de la finestra 50–1000: unes 350 claus per
  dialecte.

## 2. Requisits

| # | Requisit |
|---|---|
| R1 | Paraula del dia: **la mateixa per a tothom**, jugui en el dialecte que jugui. |
| R2 | **Quotes reals, no atzaroses**: una bossa de l'1 % surt un dia de cada cent, de debò. |
| R3 | Poder escollir **paraules manuals** per a dies concrets, que substitueixen la de la fórmula. |
| R4 | **Poder canviar bosses i quotes** sense trencar res: el passat no es mou i tothom continua tenint la mateixa paraula. |
| R5 | **Previsió**: poder saber quines paraules sortiran. |
| R6 | **No gaire a la vista**: com ara, que si saps programar ho pots trobar, però sense cap fitxer amb les paraules en clar. |
| R7 | **Sense workflow**: res no s'ha d'anar allargant periòdicament. |
| R8 | **Llavor infinita**: no s'acaba mai. |
| R9 | Dins de cada rima, la paraula es tria **amb les regles d'ara**. |
| R10 | Il·limitat: **pot sortir qualsevol rima** del dialecte, amb les bosses i les quotes. |
| R11 | El mode personalitzat no canvia. |

### Apèndix: Regles d'ara
#### Per valer com a resposta (rima):

-No pot ser un nom propi (codi NP).

-Només pot tenir lletres; s’hi permeten guionets i apòstrofs enmig (adeu-siau). Es descarten les que tenen xifres o símbols.

-Pot sortir del diccionari global o de l’apèndix del dialecte.

-Es compara normalitzada: en minúscules, sense accents, sense punt volat i amb ’ → '.


#### Per poder ser paraula a rimar (objectiu), a tots els modes:

-Ha de sortir del diccionari global, mai de l’apèndix.

-No pot ser verb: ni codi V ni codi W (formes amb pronoms enganxats, com havent-se’n).

-Els plurals hi valen (EXCLOURE_PLURALS_OBJECTIU = False).

-Si una forma té diverses entrades, n’hi ha prou que una sigui objectiu (poder com a nom).

-Es mostra la forma escrita més curta de les que es normalitzen igual.

-La seva clau ha d’estar publicada, és a dir, tenir com a mínim 2 rimes i alguna paraula objectiu.


## 3. Paraules que fem servir

| Paraula | Què vol dir |
|---|---|
| **Carril** | Fàcil o difícil. Cada carril té les seves bosses i quotes i la seva paraula del dia. |
| **Unitat de rima** | El que es tria: una **clau consonant** al difícil, un **grup assonant** al fàcil. Aquí en diem "clau" per abreujar. |
| **Bossa** | Un tram de rimes (per exemple, de 100 a 249). Cada clau va a la bossa que li toca segons les rimes que té **al central**. |
| **Quota** | El tant per cent de dies que s'endú una bossa, tingui les claus que tingui. |
| **Volta** | Una passada sencera per les claus d'una bossa. Cap clau no es repeteix dins d'una volta. |
| **Variant** | Dins d'una clau del central, les paraules que tenen la mateixa combinació de rimes als altres tres dialectes. |
| **Era** | Una data d'inici, les bosses amb les seves quotes i el contingut de cada bossa congelat. Dura fins que comença la següent. |
| **Congelar** | Escriure al fitxer d'eres el contingut de les bosses en un moment donat. No es congelen dies: els dies es calculen. |
| **Marge** | Els dies mínims (3 o 4) entre avui i l'inici d'una era nova, per a qui tingui una còpia desada sense xarxa. |

---

## 4. La paraula del dia

### 4.1 La idea

Cada dia, per a cada carril, la paraula és una **funció pura** de la data, de
l'era que hi correspon i del contingut congelat d'aquella era. No cal guardar cap
estat ni recórrer cap historial, i tothom que tingui els mateixos fitxers obté la
mateixa paraula.

El dia es compta **en hora de Catalunya** (`avui()` a `magatzem.js`). Dins d'una
era, el dia *n* és el nombre de dies des del seu inici.

### 4.2 Pas 1: quina bossa

Les quotes es guarden **en per mil i en nombres enters** (wᵢ), i sumen
W = 1.000. L'script de congelar les normalitza.

**El patró.** Es calcula un sol cop, a partir de les quotes:

- a cada pas, cada bossa suma la seva quota al seu "deute";
- surt la bossa que en deu més; en cas d'empat, la de número més baix;
- a la que surt se li resten W.

Al cap de W passos, com a màxim, tots els deutes tornen a zero i el patró es
repeteix idèntic. Amb les quotes per defecte del difícil, el període és de 1.000
dies; amb les del fàcil, de 200. És el mateix "deute" que ja fa servir la
previsió de `bosses_rimes`.

**El dia *n*.**

- La bossa és `patró[n mod W]`.
- Les vegades *m* que la bossa *i* ha sortit abans del dia *n* són
  `floor(n / W) · wᵢ` més les que surten al patró abans de la posició
  `n mod W` (es tenen precalculades).

**La garantia.** Comprovat per simulació, i tallant on es talli, cada bossa ha
tingut els seus dies amb **menys d'un dia d'error**. Una bossa de l'1 % surt
exactament 10 dies de cada 1.000, a tots els blocs, per sempre.

**La separació** entre aparicions no és perfectament regular, perquè les bosses
grosses empenyen les petites: amb les quotes per defecte, la bossa de l'1 % surt
cada 72–120 dies. Si cal, hi ha una variant que tria pel termini més proper i ho
fa més regular (pendent, apartat 10).

**L'script de congelar ha de refusar** les bosses que tenen quota però cap clau:
aquells dies no hi hauria paraula.

### 4.3 Pas 2: quina clau dins de la bossa

En congelar, les claus de cada bossa es guarden **en un ordre canònic** (per
exemple, alfabètic per clau). Si és la *m*-ena vegada que surt una bossa de
*K* claus:

- la volta és `r = floor(m / K)` i la posició, `p = m mod K`;
- la baralla de la volta és una barreja de Fisher-Yates de les claus amb la
  llavor `era-carril-bossa-r`;
- la clau del dia és `baralla[p]`.

Cap clau no es repeteix dins d'una volta, i quan la volta s'acaba es torna a
barrejar amb una llavor diferent. Com que les voltes de cada bossa no van al
ritme del patró, **les paraules no es repeteixen cada 1.000 dies**: el que es
repeteix és l'ordre de les bosses, no el de les claus.

**Entre volta i volta**, si la primera clau de la volta *r+1* és la mateixa que
l'última de la *r*, s'intercanvien les dues primeres de la *r+1*. És una regla
fixa, igual per a tothom.

L'única repetició és la que no es pot evitar: una clau torna quan la seva bossa
s'ha buidat, cada *K / quota* dies (la columna «Dura» de `bosses_rimes`).

### 4.4 Pas 3: quina variant i quina paraula (els dialectes)

**El punt de partida.** La paraula és la mateixa per a tothom i cada dialecte la
juga amb la rima que té en la seva pronúncia. La rima balear, la valenciana i la
nord-occidental no es trien: surten de la paraula. Per tant, la decisió és quina
paraula de la clau del central es tria.

**El problema.** Una clau del central pot contenir paraules que en un altre
dialecte rimen diferent. Un exemple il·lustratiu: *pare*, *mare*, *cara* i *vara*
són -aɾə al central i al balear, però en valencià i nord-occidental es parteixen
en -aɾe i -aɾa. Triant una paraula a l'atzar, cada rima del valencià sortiria en
proporció a les paraules que té. Un cas real: de les 204 paraules de la clau
central -eʎə, 200 fan -eə en balear; a l'atzar, aquesta rima sortiria el 98 % de
les vegades.

**En congelar l'era**, per a cada clau del central:

1. Es prenen les **paraules candidates** (apartat 4.5).
2. S'agrupen per **variant**: la combinació de claus que tenen en nord-occidental,
   valencià i balear. A l'exemple hi ha la variant A (*pare*, *mare*: -aɾe / -aɾe /
   -aɾə) i la B (*cara*, *vara*: -aɾa / -aɾa / -aɾə).
3. Es treuen les variants que no compleixen la **tolerància**: a cada dialecte,
   la clau de la variant ha de tenir **entre ×0,5 i ×2** de les rimes que té la
   clau al central.
4. **No hi ha cap mínim de paraules per variant.** Les variants d'una sola paraula
   que passen la tolerància surten a l'informe per revisar-les a mà: n'hi ha de
   legítimes (*axis*, *bell*) i n'hi ha que fan pensar en un error de transcripció.
5. Les variants que queden s'ordenen amb una barreja amb llavor i es guarden en
   aquest ordre. Dins de cada variant, les paraules s'ordenen com ara
   (`barreja_estable`), i se'n guarden fins a `DIARIES_PER_CLAU` (avui, 4).
6. **Si no en queda cap**, la clau no entra a la bossa en tota l'era. Surt a
   l'informe. Continua valent com a resposta i es pot jugar a l'il·limitat i al
   personalitzat.

**Cada dia.** Si és la *r*-ena vegada que surt la clau (que és el número de volta
de la seva bossa):

- toca la variant `r mod nVariants`;
- dins de la variant, la paraula `floor(r / nVariants) mod nParaules`.

Així, cada rima dels altres dialectes que hi ha dins d'una clau del central té el
seu torn, i tots els torns valen igual, tingui cada rima les paraules que tingui.
És el mateix principi que el joc ja fa servir: **es tria per rima, no per
paraula**. Les variants combinen els tres dialectes alhora perquè una sola
paraula fixa la rima de tots tres.

Exemple de torns:

| Vegada que surt -aɾə | Variant | Paraula | Central | Nord-occ. | Valencià | Balear |
|---|---|---|---|---|---|---|
| 1a | B | *cara* | -aɾə | -aɾa | -aɾa | -aɾə |
| 2a | A | *pare* | -aɾə | -aɾe | -aɾe | -aɾə |
| 3a | B | *vara* | -aɾə | -aɾa | -aɾa | -aɾə |

Un cas real dels filtres: la clau central **-ul** té 33 rimes; els altres
dialectes n'han de tenir entre 16,5 i 66. En balear, *bagul* i *baül* cauen a -ul
(100 rimes: fora); *adult* i *indult*, a -ult (21: dins); *cool* (548) i *joule*
(2) queden fora. El dia que surt -ul, en balear es juga una paraula com *adult*.

**Per què mana el central**: és el dialecte per defecte, el de la majoria, i
l'únic amb la transcripció revisada a mà. Els altres surten de l'espeak-ng, i una
part de les seves separacions són soroll.

**Què no es resol**, i s'accepta:

- **És lent.** Una clau surt una vegada per volta de la seva bossa, que poden ser
  mesos. Una clau amb tres variants triga tres voltes a ensenyar-les totes.
- **El cas invers.** Hi ha claus d'un dialecte que reben paraules de més d'una
  clau del central (en balear, 99 de 1.430), i allà surten més sovint. L'informe
  de congelar les pot assenyalar.
- **Rimes d'un dialecte que no tenen cap paraula vàlida als quatre dialectes**
  no surten mai a la paraula del dia. Les cobreix l'il·limitat natiu.

### 4.5 Quines claus i paraules hi poden entrar

**Paraula candidata** (com ara):

- és paraula objectiu: no és verb (codis `V` i `W`, formes amb pronom incloses)
  ni nom propi;
- és objectiu **als quatre dialectes**;
- cau en **una sola clau a cada dialecte** (sense homògrafs com *dona* / *dóna*).

**Clau candidata**:

- les seves rimes al central cauen dins de les bosses del carril (entre el
  `des_de` de la primera i el `fins` de l'última);
- té almenys una variant que compleix la tolerància.

La finestra `MIN_RIMES`–`MAX_RIMES` (50–1000) **deixa de governar** la paraula
del dia i l'il·limitat: ho fan les bosses (apartat 10, què se'n fa).

### 4.6 Paraules manuals

- **L'entrada** continua sent un fitxer que edites a mà, amb el format d'ara
  (data → paraula, o `{facil, dificil}`), però **surt del repositori públic**: es
  queda en local, al `.gitignore` (igualment ja és a Dropbox).
- **Un script local** (evolució de `comprovar_diaries_manuals.py`) valida cada
  paraula als quatre dialectes (objectiu i una sola clau a cadascun) i **falla si
  no hi és**. Mai no hi ha una paraula manual que valgui en uns dialectes i en
  altres no.
- **El mateix script publica el fitxer xifrat.** Cada entrada s'identifica pel
  número de dia (o per un resum de la data), de manera que les dates tampoc no es
  veuen. El contingut es barreja (XOR) amb una seqüència de `mulberry32` sembrada
  amb `llavor("…" + dia)`, es codifica en base64 i totes les entrades fan la
  mateixa llargada.
- **Al joc**, la manual mana sobre la fórmula. El dia compta igualment per a la
  bossa que tocava (el repartiment no es desquadra), i la clau que hauria sortit
  no surt en aquesta volta: tornarà a la següent. **No es mou cap altre dia.**
- Les manuals dels **dies passats es conserven** (les fan servir la pantalla
  d'ahir i l'historial).
- Les manuals que **ja s'han comitejat** (23-4-2027, 11-9-2027) són a l'historial
  de git en clar: si han de ser sorpresa, cal canviar-les.

### 4.7 Les eres

Una era guarda:

- la **data d'inici**;
- la **versió de l'algorisme** amb què es calcula;
- per a cada carril, els **talls i les quotes** (en per mil);
- el **contingut congelat**: per a cada bossa, les claus en ordre canònic; per a
  cada clau, les variants ordenades; per a cada variant, les paraules ordenades.

Funcionament:

- Una era dura **des de la seva data fins que comença la següent**. L'última dura
  per sempre.
- **Fer una era nova** és executar en local un script de congelar (amb les dades
  i la configuració del moment), revisar l'informe i comitejar. Sense workflow.
- Una era nova pot començar **el dia que vulguis**, sempre que sigui almenys d'aquí
  a 3–4 dies (el marge). Tallar el patró a mitges no desquadra les quotes.
- **Les eres començades no es toquen.** L'única excepció és substituir al lloc una
  paraula de l'era vigent que hagi deixat de valer (apartat 4.10).
- **Quan convé una era nova**: quan vulguis canviar quotes o talls, o quan
  s'hagin acumulat prou paraules noves o desajustos (l'informe ho suggereix). Un o
  dos cops l'any, per exemple. **No cal fer-ne cap per cada correcció.**
- **Canviar la fórmula** (un desempat, la manera de barrejar) també vol dir era
  nova, amb una versió d'algorisme nova. Les eres antigues es continuen calculant
  amb la seva versió.

### 4.8 El canvi d'era: acabar les voltes a mitges

**El problema.** Quan comença una era, les baralles es tornen a fer. Si l'era vella
s'acaba el 28 de febrer i la bossa de 100–249 rimes estava a mitja volta (de 150
claus, n'havien sortit 90, entre les quals -ɛl el dia 20), en barrejar de zero
-ɛl podria tornar a sortir el 3 de març. El primer dia que surt la bossa ja hi ha
un 60 % de probabilitats de repetir una clau dels últims mesos.

**La solució.** L'era nova acaba les voltes que l'anterior havia deixat a mitges:

- de cada bossa de l'era vella es calcula on s'havia quedat (volta *r* i posició
  *p*), de manera que les claus que ja havien sortit són les *p* primeres de
  la baralla *r*;
- a la **primera volta** de cada bossa de l'era nova hi van primer, barrejades,
  les claus que encara no havien sortit, i al final les que sí;
- si una clau ha canviat de bossa, rep el mateix tracte a la bossa nova;
- a partir de la segona volta, tot normal.

**El comptador de vegades que ha sortit cada clau** (el que fa girar les
variants) també continua d'una era a l'altra: les vegades que va sortir a les
eres anteriors es poden calcular igual.

Tot surt de la fórmula: cap navegador no ha de recordar res, tothom obté el mateix
resultat i el càlcul és d'una llista per bossa.

### 4.9 El diccionari canvia: què es congela i què no

| Es congela (a l'era) | Es continua actualitzant (amb `generar_dades.py`) |
|---|---|
| Quina paraula surt cada dia: claus de cada bossa, variants, paraules | Quines respostes valen (els fitxers de cada dialecte) |
| La bossa on es va classificar cada clau | A quina clau cau **ara** cada paraula congelada, a cada dialecte |

`generar_dades.py` escriu a l'`index.json` a quina clau cau ara cada paraula
congelada a cada dialecte, com fa avui el bloc `on` de `diaries`. Si corregeixes
la transcripció d'*adult* en balear, el dia que surti es jugarà amb la rima
corregida i les respostes actualitzades. Les paraules noves del diccionari valen
com a resposta des del primer dia, però no poden ser paraula del dia fins a l'era
següent.

Després de congelar una era, cal tornar a executar `generar_dades.py` perquè
l'índex porti la resolució de les paraules noves. L'`index.json` i el fitxer
d'eres passen tots dos pel `versions.json`, i per tant arriben sempre junts.

### 4.10 Comprovacions a cada `generar_dades.py`

Es compara **cada paraula congelada** de l'era vigent i de les futures (i les
manuals futures) amb les dades actuals, no només les que s'han editat. La bossa
d'una paraula depèn de quantes rimes té la seva clau, i aquest nombre canvia quan
s'afegeixen o es corregeixen **altres** paraules de la mateixa clau.

- **ERROR (bloqueja)**: una paraula congelada ja no es pot jugar en algun dialecte
  (desapareix, passa a ser verb, cau a dues claus, cau en una clau amb massa poques
  rimes). Es **substitueix al mateix lloc** per una altra de la mateixa clau (i de
  la mateixa variant, si pot ser). **No s'esborra mai**, perquè desplaçaria la
  baralla. No es publica fins que està resolt.
- **Avís**: una clau ha canviat de bossa. Si va a la del costat, només compta al
  recompte; si salta dues bosses o més, surt amb nom; si se n'han desplaçat més
  d'un tant per cent, l'informe suggereix fer una era nova. No trenca res: l'era
  la manté a la seva bossa i tothom continua tenint la mateixa paraula.
- **Avís**: una variant ha sortit de la tolerància ×0,5–×2.
- **Avís**: una paraula ha canviat de rima en algun dialecte (pot desequilibrar la
  rotació de variants).

Un exemple d'informe:

```
Paraules del dia congelades (era 2027-03-01): 924 claus
  ERROR  «bella» (2027-08-14, difícil): ja no és objectiu en balear → cal substituir-la
  avís   «adult»: la clau ha passat de 33 a 58 rimes (dues bosses més amunt)
  avís   12 paraules han canviat a la bossa del costat
  avís   3 paraules han canviat de rima en algun dialecte
```

Opcional: les eines de corregir i afegir paraules (`corregir_transcripcions.py`,
`afegir_paraula.py`) poden avisar al moment: «aquesta paraula és paraula del dia
el 3-5-2027».

### 4.11 Ofuscació

El nivell és **el d'ara**:

- Les llistes de paraules candidates són visibles al fitxer d'eres, com ara ho són
  a l'`index.json`. Per saber quin dia surt cadascuna, cal executar el codi.
- La llavor és dins del JS, i ha de ser-hi, perquè qui calcula és el navegador.
- Les manuals van xifrades i l'entrada en clar és en local.
- Les previsions es generen en local i van al `.gitignore`, com
  `bosses_rimes.html`.
- **Enlloc no hi ha cap fitxer públic amb dates i paraules en clar.**

És ofuscació, no seguretat: el que pot llegir el navegador, ho pot llegir
qualsevol que sàpiga programar.

### 4.12 Previsió

- Un script de node (per exemple `joc/eines/previsio.mjs`) importa
  `joc/js/objectius.js`, el fitxer d'eres i les manuals (les en clar, en local) i
  treu els propers N dies: data, carril, bossa, clau, variant, paraula, rimes a
  cada dialecte i si és manual. Pot escriure una pàgina local.
- Com que és el mateix codi del joc, la previsió no pot discrepar del que surt.
- `predictor.py` es retira.
- La previsió val mentre no es faci cap era nova; dins de l'era vigent, només la
  poden canviar les substitucions al lloc.

### 4.13 Transició

- **Era 0**: la roda d'ara, amb la llista `diaries` d'avui **copiada i congelada**
  al fitxer d'eres. Els dies passats queden fixos per sempre i la pantalla d'ahir
  continua quadrant. El codi de la roda es manté només per a l'era 0.
- Les **manuals passades** es passen al fitxer xifrat.
- **Era 1**: la primera amb bosses. Comença el dia de posar-ho en marxa més el
  marge.
- Els dies passats que ja van canviar per regeneracions anteriors no es poden
  arreglar: només es congela d'ara endavant.

---

## 5. Mode il·limitat

### 5.1 La idea

No és compartit, o sigui que **no necessita eres ni congelar res**: fa servir
l'índex del moment. Però sí que necessita **quotes exactes**: el mateix
repartiment de la paraula del dia, aplicat a una **seqüència per jugador**.

### 5.2 Natiu per dialecte

- Les bosses i els filtres s'apliquen a les **claus del dialecte que es juga**
  (claus consonants al difícil, grups assonants al fàcil), comptant **les seves
  pròpies rimes**. Els altres dialectes no hi influeixen i no hi ha tolerància.
- Les paraules candidates són les **paraules objectiu d'aquell dialecte** (les
  marcades amb `+` i `*` al seu fitxer, que ja fa servir el personalitzat).
- S'**exclouen els homògrafs dins del dialecte** (paraules que cauen a dues claus
  del mateix dialecte): el jugador veuria «dona» sense saber quina lectura toca.
- Dins de la clau, la paraula es tria com ara, però amb la llavor de la seqüència.

**Per què la classificació continua sent justa.** La classificació de
l'il·limitat és conjunta (no es parteix per dialecte). El que la fa justa és que
tothom tingui la mateixa distribució de dificultats, i això és exactament el que
donen les bosses i les quotes comptades amb les rimes de cada dialecte. La regla
dels quatre dialectes només és necessària a la paraula del dia, on la paraula és
la mateixa per a tothom. A més, amb la seqüència per jugador, qui jugui N partides
té exactament les mateixes partides de cada bossa que qualsevol altre.

### 5.3 La seqüència per jugador

- **Llavor**: l'identificador d'usuari + el dialecte + la dificultat.
- **Comptador** de partides al localStorage, per dialecte i dificultat.
- **Bossa**: el mateix patró del pas 1, aplicat al comptador. Opcionalment, amb un
  desplaçament per jugador, perquè la primera partida de tothom no caigui a la
  mateixa bossa.
- **Clau**: una baralla per bossa i per volta, sembrada amb la llavor del jugador.
  No es repeteix cap clau fins que s'ha buidat la bossa.
- Si un dialecte té una bossa **sense cap clau**, aquella bossa no entra al seu
  patró.
- Si surt la clau de la **paraula del dia** d'aquell dialecte, se salta (perquè
  no la desvetlli).
- Si el jugador **perd el localStorage**, torna a començar. No passa res.
- Si es **regenera l'índex**, les baralles canvien i de tant en tant es pot
  repetir alguna clau dins d'una volta. És acceptable. Si molestés, es podrien
  desar al localStorage les claus vistes de cada volta.
- Aquí el JS **no ha de coincidir amb cap altre codi**: no hi ha cap resultat
  compartit.

### 5.4 Quotes

De moment, **les mateixes bosses i quotes que la paraula del dia** (pendent,
apartat 10). Un avís: amb aquestes quotes, la major part de les claus és a la
bossa de 15–34 rimes (entre 513 i 619 segons el dialecte), que té l'1 %. Cada una
d'aquestes claus surt un cop cada 51.000–62.000 partides: pot sortir qualsevol
rima, però a la pràctica un jugador no en veurà gairebé cap.

---

## 6. Mode personalitzat

**No canvia.** El jugador tria la finestra, la dificultat i els accents; tot surt
de la signatura de l'enllaç i dos jugadors amb el mateix enllaç juguen el mateix.

---

## 7. Normes que no es poden trencar

1. **L'època no canvia mai** (`2026-01-01`).
2. **Una era començada no es toca.** Només s'hi poden substituir al lloc paraules
   de l'era vigent que hagin deixat de valer.
3. **Una era nova comença com a mínim d'aquí a 3–4 dies.**
4. **Una paraula congelada no s'esborra mai**: se substitueix al lloc.
5. **Quotes en per mil enters**, desempat per la bossa de número més baix i claus
   en ordre canònic abans de barrejar.
6. **A la paraula del dia, aritmètica entera i les funcions `llavor` i
   `mulberry32`**. Cap `Math.random`.
7. **Canviar la fórmula és fer una era nova** amb una versió d'algorisme nova. Les
   eres antigues es continuen calculant amb la seva.
8. **Les manuals es validen als quatre dialectes abans de publicar-les.** Mai no
   hi ha una paraula diferent per dialecte.
9. **Enlloc no hi ha cap fitxer públic amb dates i paraules futures en clar.**
10. **El dia es compta en hora de Catalunya.**
11. **Cap pas depèn d'un workflow.**

---

## 8. Fitxers i peces (els noms són provisionals)

**Publicats** (`joc/dades/`, tots pel `versions.json`):

| Fitxer | Què hi ha |
|---|---|
| `eres.json` (nou) | Les eres: data, versió d'algorisme, talls, quotes i contingut congelat de cada carril. També la configuració de l'il·limitat. |
| manuals xifrades (nou, amb un nom neutre) | Una entrada opaca per dia manual. |
| `index.json` | Hi afegeix a quina clau cau ara cada paraula congelada a cada dialecte. |

**Locals** (al `.gitignore`):

- les manuals en clar;
- les previsions.

**Scripts** (`joc/eines/`):

| Script | Feina |
|---|---|
| `congelar_era.py` (nou) | Calcula les candidates, les variants i la tolerància, normalitza les quotes, escriu l'era nova (refusant dates dins del marge o al passat) i treu l'informe. |
| `generar_dades.py` | Escriu la resolució de les paraules congelades i fa les comprovacions de l'apartat 4.10. |
| `comprovar_diaries_manuals.py` | Valida les manuals als quatre dialectes i en publica la versió xifrada. |
| `previsio.mjs` (nou) | La previsió amb node, important el mòdul del joc. |
| `bosses_rimes.py` | Hi afegeix la regla ×0,5–×2, la vista per dialecte (quines claus poden sortir), les variants de cada clau i la vista de l'il·limitat natiu. |
| `predictor.py` | Es retira. |

**JS** (`joc/js/`):

- `objectius.js`: la fórmula de la paraula del dia amb eres (i la roda, només per
  a l'era 0) i la seqüència de l'il·limitat natiu;
- `dades.js`: carregar el fitxer d'eres i les manuals xifrades, amb l'última còpia
  bona al localStorage;
- `principal.js`: `seleccioDelDia` i `prepararParaula`;
- `magatzem.js`: el comptador de l'il·limitat.

---

## 9. Decisions preses

| Tema | Decisió | Descartat | Per què |
|---|---|---|---|
| Com es calcula el dia | Fórmula infinita al navegador, amb eres | Calendari precomputat | El calendari s'hauria d'anar allargant (a mà o amb workflow) i seria una llista pública de paraules |
| Paraula compartida | Una per carril i dia, per a tothom | Una per dialecte | La classificació del dia és conjunta |
| Quotes | Repartiment ponderat periòdic | Tirada a l'atzar amb pesos | Les quotes han de ser reals, no de mitjana |
| Canviar la configuració | Eres amb data d'inici a uns dies vista | Reescriure la configuració | El passat no s'ha de moure |
| Correccions del diccionari | No demanen era nova | Regenerar l'era a cada canvi | Es congela quina paraula surt, no amb quines rimes es juga |
| Canvi d'era | Acabar les voltes a mitges | Barrejar de zero | Si no, gairebé segur que torna alguna clau recent |
| Qui mana entre dialectes | El central | Rima pandialectal; paraula per dialecte | El central és el de defecte i l'únic revisat a mà; la pandialectal el penalitza i amplifica el soroll de l'espeak-ng; una per dialecte trenca la paraula compartida |
| Tolerància dels altres dialectes | Entre ×0,5 i ×2 del central | Bossa del costat; dues bosses; ×⅓–×3 | La mateixa tolerància per a totes les claus, independent d'on caiguin els talls |
| Rima dels altres dialectes | Torns entre variants | Paraula a l'atzar | A l'atzar, la rima amb més paraules s'ho emporta gairebé tot |
| Mínim de paraules per variant | No n'hi ha | Mínim de 2 | La tolerància ja treu gairebé tots els casos; els pocs que queden es revisen a l'informe |
| Claus sense variant vàlida | Fora de la paraula del dia en aquella era | Forçar-les en una altra bossa | La bossa la decideix el central |
| Manuals | Validades, xifrades, substitueixen el dia sense moure res | Aplicar-les dialecte per dialecte | Tothom ha de tenir la mateixa paraula |
| Ofuscació | Com ara (cal executar el codi) | JSON en clar; només resums; finestra lliscant amb workflow | El JSON és massa a la vista; els resums compliquen sense guanyar gaire; la finestra demana workflow |
| Previsió | Node amb el mateix mòdul del joc | Port a Python | Un sol codi, cap discrepància possible |
| Il·limitat | Natiu per dialecte, seqüència per jugador | Regla dels quatre dialectes; `Math.random` | Hi poden sortir totes les rimes del dialecte, amb quotes exactes i la classificació justa |
| Mode personalitzat | No canvia | — | El jugador ja tria els paràmetres |

## 10. Pendent de decidir

1. **Quotes de l'il·limitat**: les mateixes que la paraula del dia o unes de
   pròpies. Proposta: una configuració separada que de moment tingui els mateixos
   valors.
2. **Tolerància al fàcil**: si els grups assonants també fan servir ×0,5–×2.
3. **Talls i quotes definitius** de cada carril. Els de `PER_DEFECTE` de
   `bosses_rimes.py` són el punt de partida, però s'han de tornar a mirar amb la
   regla ×0,5–×2.
4. **El marge**: 3 o 4 dies.
5. **El llindar** de paraules desplaçades a partir del qual l'informe suggereix una
   era nova.
6. **Separació més regular** per a les bosses petites (la variant del termini més
   proper).
7. **Revisar anomalies del balear**: -afs i -aks hi tenen totes dues exactament
   10.327 rimes, que fa pensar en una clau gegant per error de transcripció.
8. **Què es fa amb `MIN_RIMES`/`MAX_RIMES` i la marca `*`**, que deixen de
   governar la paraula del dia i l'il·limitat. Potser només com a valors per
   defecte del personalitzat.
9. **Paraules per variant**: si se'n guarden 4, com ara amb les claus.
10. **Desplaçament per jugador** del patró a l'il·limitat.
11. **Avisos a les eines de correcció** (opcional).
12. **Format i nom** del fitxer de manuals xifrades.

---

## 11. Números de referència

Mesurats el 31-10-2026 amb les dades d'aquell dia i les bosses de `PER_DEFECTE`.

**La roda d'ara**: 354 claus (finestra 50–1000) i 1.405 paraules; 350 claus en
tenen 4. Cicles de 354 dies.

**El repartiment ponderat** (simulació de 20.000 dies):

- totes les bosses surten exactament les vegades que toquen;
- error màxim: 0,8 dies (difícil) i 0,865 (fàcil); període: 1.000 i 200 dies;
- 300 configuracions a l'atzar, d'entre 2 i 12 bosses: totes periòdiques i amb
  un error màxim de 0,991 dies;
- separació entre aparicions: 1 % → 72–120 dies; 0,4 % → 205–267; 40 % → 1–3.

**Com es parteixen les claus del central** (1.297 claus de 15–26.000 rimes amb
paraula compartida):

| | 1 clau | 2 claus | 3 o més |
|---|---|---|---|
| Balear | 1.068 (82 %) | 202 | 27 |
| Nord-occidental | 969 (75 %) | 297 | 31 |
| Valencià | 898 (69 %) | 314 | 85 |

**Variants**: 1.960 en total. Distància en bosses del dialecte que queda més lluny:
0 → 769, 1 → 184, 2 → 113, 3 o més → 894. El dialecte que en fa caure més és el
valencià (781), després el balear (489) i el nord-occidental (456). Amb la regla
de la bossa del costat, 34 de les variants vàlides eren d'una sola paraula.

**Toleràncies**:

| Regla | Claus amb variant | Variants | Rimes que poden sortir (nw / va / ba) |
|---|---|---|---|
| Bossa del costat | 910 | 953 | 908 / 914 / 908 |
| Fins a dues bosses | 984 | 1.066 | 975 / 986 / 964 |
| **Entre ×0,5 i ×2 (la triada)** | **924** | **951** | **926 / 928 / 926** |
| Entre ×⅓ i ×3 | 1.000 | 1.081 | 1.018 / 1.026 / 1.003 |

**Il·limitat natiu**:

| | Central | Nord-occ. | Valencià | Balear |
|---|---|---|---|---|
| Difícil, claus ara | 354 | 349 | 353 | 347 |
| Difícil, claus natives | 1.305 | 1.255 | 1.137 | 1.212 |
| Fàcil, grups natius | 62 | 103 | 98 | 73 |
| Bossa 15–34 (1 %): claus | 619 | 586 | 513 | 556 |
| Bossa 100–249 (40 %): claus | 126 | 130 | 108 | 117 |
| Bossa 100–249: cada quantes partides es repeteix una clau | 315 | 325 | 270 | 292 |
