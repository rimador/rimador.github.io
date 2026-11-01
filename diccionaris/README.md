# `diccionaris/` — quin diccionari es publica

Hi ha **dos** diccionaris i és important no confondre'ls.

| | qui l'escriu | per a què serveix |
|---|---|---|
| `diccionari.5.2.3.txt` | **tu, a mà** | l'origen de tot: quines paraules hi ha. D'aquí surt la columna 10 i d'aquí parteixen les formes amb pronom |
| `diccionari.6.txt` | el workflow | el base + les 3.406.083 formes verb+pronom. És el que es publica |

**El diccionari són set camps, no deu.** Ni la rima consonant, ni l'assonant, ni
la transcripció no hi són: depenen del dialecte i viuen a `dialectes_col/`, amb
un `col_9` per dialecte i la rima que se'n deriva al costat.

| camp | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| | paraula | lema | codi | síl·labes | Vicc | Viq | Diec |
| columna | `col_0` | `col_1` | `col_2` | `col_5` | `col_6` | `col_7` | `col_8` |

Els números de columna són els de sempre i hi ha forats (3, 4 i 9): el
navegador, les llistes i el joc les demanen pel nom del fitxer, i renumerar-les
voldria dir tocar-ho tot per no guanyar res.

El navegador no llegeix mai cap `diccionari*.txt`: llegeix `separat/col_0..col_8`,
`separat/internat/`, les internades del dialecte que serveixi
(`dialectes_col/<codi>/trans_dicc/internat/`), l'apendix d'aquell dialecte
(`dialectes_col/<codi>/apendix/col_0_<codi>.txt` i `apendix/internat/`) i
`versions.json` (vegeu `llegirFitxerAmbIndexedDB` a `js/script.js`).
**Aquestes columnes són les del diccionari publicat.**

**Només les del dialecte que se serveix.** En obrir la pàgina es baixa el
diccionari general i les dues meitats d'UN dialecte, i les d'un altre no es
demanen fins que algú el tria a la tira; llavors sí, i es queden a IndexedDB
com la resta. El navegador cus les dues meitats en un sol diccionari abans de
cercar-hi (vegeu `compondreDiccionari` a `js/script.js`): les paraules de
l'apendix van darrere les del diccionari i les taules de les columnes
internades es fonen, que és el que fa que una paraula de l'apendix i una del
diccionari amb la mateixa rima rimin de debò.

## Un dialecte són dues meitats

Fins ara un dialecte era només una manera de pronunciar el mateix diccionari.
Ara també és **una llista de paraules diferent**: hi ha formes que només es
diuen en un lloc (*cante*, *servisc*, *tenc*). Per això cada carpeta de
`dialectes_col/<codi>/` en té dues:

```
dialectes_col/<codi>/
  trans_dicc/        EL DICCIONARI, DIT EN AQUEST DIALECTE
    col_9_transcripcio_<codi>.txt   la transcripció   ─┐ sortides: es refan
    col_3_rimacons_<codi>.txt       rima consonant     │ senceres a cada
    col_4_rimaass_<codi>.txt        rima assonant      │ passada. NO S'EDITEN
    internat/                       taula + idx       ─┘
  apendix/           LES PARAULES QUE NOMÉS ES DIUEN AQUÍ
    col_10_<codi>.txt       la identitat i com sona   ← S'EDITA
    col_5,6,7,8_<codi>.txt  síl·labes i enllaços      ← S'EDITEN
    col_0,1,2_<codi>.txt    paraula, lema i codi      ─┐ sortides de la
    col_9_<codi>.txt        la transcripció            │ col_10 i de la
    col_3,4_<codi>.txt      la rima                    │ transcripció
    internat/               taula + idx               ─┘
```

**El `trans_dicc` va fila per fila amb el diccionari** (619.783 files, les
mateixes a tots els dialectes) i **l'apendix té les seves** (125.282 al
central, 271.866 al valencià). No es poden comparar entre elles, i cap script
no ho fa: hi ha `files_del_diccionari()` i `files_de_lapendix(codi)` a
`camins.py`, i mai la mateixa xifra per a les dues bandes.

Un dialecte pot no tenir apendix: un de nou és una carpeta amb la seva
transcripció, i les paraules pròpies vindran després o no vindran mai.

## L'interruptor

`python/config.py`, una línia:

```python
DICCIONARI_PUBLICAT = "diccionari.6.txt"      # amb formes amb pronom (ara)
DICCIONARI_PUBLICAT = DICCIONARI_BASE         # el de sempre, sense pronoms
```

No cal tocar res més:

* **base** → no es generen ni les formes amb pronom ni el `diccionari.6.txt`, i
  les columnes surten del 5.2.3.
* **v.6** → es generen les formes amb pronom, se'n fa el `diccionari.6.txt` i
  les columnes surten d'ell.

En tots dos casos es fan les columnes internades, el `versions.json` i les
llistes: aquests passos no miren quin diccionari hi ha al darrere.

## L'ordre, i per què és aquest

**Només es fan canvis en dos fitxers**, i tota la resta són sortides que es
refan senceres a cada passada:

| edites | per a |
|---|---|
| `diccionari.5.2.3.txt` | **quines** paraules hi ha: afegir-ne, treure'n, i el lema, el codi, les síl·labes i els enllaços |
| `col_10.txt` | **com** sona cadascuna, als quatre dialectes alhora. També hi pots corregir la paraula, el lema i el codi |
| `<codi>/apendix/col_10_<codi>.txt` | **quines** paraules pròpies té un dialecte i **com** sonen |
| `<codi>/apendix/col_5,6,7,8_<codi>.txt` | les seves síl·labes i enllaços |

```
             els fitxers que s'editen
                          │
   1. sincronitzar.py     ▼   posa d'acord el diccionari i la col_10 i escriu
                              els col_9; i, de la col_10 de cada apendix,
                              les col_0, 1, 2 i 9 d'aquell apendix
   2. columnes.py             diccionari -> col_0,1,2,5,6,7,8
                              cada col_9 -> la seva col_3 i col_4
                              (la del trans_dicc i la de l'apendix)
   3. internar.py             cada columna -> taula + índexs
   4. versions.py             ho comprova tot i escriu el versions.json
                          ▼
                   UN SOL COMMIT
                          ▼
              nàufragues i mots de 7      (job a part)
                          ▼
                       deploy
```

Un sol workflow (`.github/workflows/diccionaris.yml`) i un sol camí: els scripts
miren les dades, no què s'ha pujat. Tres workflows (un per fitxer) no
aguantarien el cas normal d'afegir una paraula, que **toca els dos fitxers al
mateix commit** i en dispararia dos alhora, tots dos fent `git push`.

### Com se sap qui té raó

Paraula, lema i codi són als **dos** fitxers, i per tant és l'únic lloc on hi pot
haver desacord. Per resoldre'l fan falta tres referències:

| | què és |
|---|---|
| **base** | `separat/col_0`, `col_1` i `col_2`: la identitat de l'última publicació. Les escriu el workflow i no les edita ningú |
| **diccionari** | com és ara |
| **col_10** | com és ara |

Si només ha canviat un costat, guanya aquell i l'altre s'actualitza; si han
canviat tots dos igual, no hi ha res a fer; si han canviat tots dos diferent,
és un conflicte i s'atura dient quines files són. El `versions.py` comprova que
la base sigui de debò la identitat del diccionari: si una execució peta a
mitges i algú comiteja a mà, deixaria de ser-ho i el repartiment de culpes
atribuiria els canvis al costat que no toca, en silenci.

Amb `git show` no es podria fer: als workflows, el commit que dispara
l'execució **ja és HEAD**, i la comparació sempre sortiria igual.

### I a l'apendix, qui mana

**La seva `col_10`.** Allà no hi ha cap conflicte possible perquè la identitat
només és a un lloc: les `col_0`, `col_1` i `col_2` de l'apendix en són
sortides i no s'editen. El repartiment és el mateix que al diccionari, amb els
fitxers canviats de nom:

| el diccionari | un apendix |
|---|---|
| `diccionari.5.2.3.txt` — síl·labes i enllaços | `col_5,6,7,8_<codi>.txt` |
| `col_10.txt` — identitat i transcripció | `col_10_<codi>.txt` |
| `separat/col_0,1,2` — la identitat d'abans | les seves `col_0,1,2` |

**Les `col_5` a `8` van en pas amb la `col_10`.** Quan hi dones una paraula
d'alta, posa-la als dos llocs i a la mateixa fila, igual que fas al
diccionari; si te'n descuides, el `sincronitzar.py` s'atura i et diu quina
fila és. L'única excepció són les baixes: si l'únic que has fet és treure
línies de la `col_10`, les `col_5` a `8` es retallen soles, perquè és l'únic
cas on no hi ha cap ambigüitat sobre quina fila era quina.

### Els avisos

Un `print` va al registre, i el registre d'una execució verda no el llegeix
ningú. `diccionaris/python/avisos.py` fa servir els tres canals de GitHub:
`::error::` (requadre vermell i, com que el procés surt amb codi 1, correu),
`::warning::` (triangle groc encara que l'execució acabi verda) i el *Summary*
de l'execució per al detall. Quan l'anotació duu fitxer i línia, surt dins del
diff del commit.

**Els avisos no envien correu, mai.** Si una cosa t'ha d'arribar, ha de fer
petar el workflow. El que és per mirar i no per aturar (transcripcions sense
accent primari, paraules que han canviat com s'escriuen) va al *Summary* i a
`dialectes_col/a_revisar.txt`, que és un fitxer comitejat: així la llista surt
al diff quan canvia i no fa soroll quan no.

### Donar d'alta una paraula

Ha d'entrar als dos fitxers, a la mateixa fila i al mateix commit. A mà vol dir
encertar la mateixa posició en dos fitxers de sis-centes mil línies, o sigui que
val més l'eina:

```bash
python3 diccionaris/python/afegir_paraula.py
```

Obre una pàgina a `http://localhost:8773` amb tres maneres. D'una en una, un
formulari amb la paraula, el lema, el codi, les síl·labes, els enllaços i la
transcripció de cada dialecte; la fila te la proposa i te l'ensenya amb els
veïns perquè la miris, i la pots canviar. Després d'afegir-ne una, la resta de
camps es queden per a la següent. Una família, com un model: escrius el lema
nou (síl·labes i transcripcions) i una paraula que ja hi sigui i es flexioni
igual (te'n proposa), i en fa totes les formes; les que mouen l'accent a
l'arrel surten marcades per revisar-les. Diverses alhora, des d'arxius: un amb
les files del diccionari (`paraula$lema$codi$síl·labes$Vicc$Viq$Diec`) i un per
dialecte amb les transcripcions a la mateixa línia; abans d'afegir-les et diu
entre quines paraules va cadascuna. Les transcripcions es comproven amb
l'inventari del `columnes.py`, com al corregir.

No comiteja: abans, `git pull`; després, commit del diccionari i la `col_10`
junts.

Si només és a un dels dos fitxers, el `sincronitzar.py` s'atura i diu quina
paraula és i on.

**Al diccionari o a un apendix.** A dalt de la pàgina tries on va. El
diccionari és per a una paraula que es diu a tots els dialectes. Una paraula
que només es digui en un lloc va a l'apendix d'aquell dialecte: tries
l'apendix i la mateixa eina hi escriu una línia a la seva `col_10` i les
síl·labes i els enllaços a les `col_5` a `8`, a la mateixa fila. Les tres
maneres hi funcionen igual, però amb només la transcripció d'aquell dialecte;
en una família, si el lema del model no és a l'apendix (sovint només hi ha
les formes pròpies del dialecte), la forma base es pren del diccionari. Les
altres columnes de l'apendix les refà el `sincronitzar.py`.

### Corregir una transcripció

```bash
python3 diccionaris/python/corregir_transcripcions.py
```

Obre una pàgina a `http://localhost:8771`: cerques una paraula (exacta, que
comenci per o que acabi en) o una transcripció (igual, en tots els dialectes o
en un; sense accents a la cerca, els de la transcripció no compten) i et surt
cada entrada, la del diccionari i les dels apendixs, amb la transcripció de
cada dialecte en un camp editable. Mentre
escrius et diu quina rima en sortirà, si hi falta l'accent primari i si hi ha
cap símbol fora de l'inventari del `columnes.py`. En desar, reescriu aquella
línia de la `col_10` que toqui i res més.

Amb el botó *Edita* de cada entrada s'hi corregeix la resta: la paraula, el
lema, el codi, les síl·labes i els enllaços. Cada camp va on ja és: en una
entrada del diccionari, la identitat a la `col_10` i al diccionari alhora (així
el `sincronitzar.py` hi veu el mateix canvi a banda i banda) i les síl·labes i
els enllaços al diccionari; en una de l'apendix, la identitat a la seva
`col_10` i la resta a les `col_5` a `8`. Si aquella fila no diu el mateix al
diccionari que a la `col_10`, només s'hi poden corregir les transcripcions:
primer el `sincronitzar.py`.

Si canvies com s'escriu una paraula i per ordre alfabètic li tocaria un altre
lloc, t'avisa i et diu entre quines paraules aniria; la fila només s'hi mou si
marques *Mou-la allà en desar*. Llavors es mou a tots els fitxers de la seva
banda alhora. Moure una fila sense canviar-ne la paraula no es pot: per al
`sincronitzar.py` seria una reordenació, i s'aturaria.

No comiteja: abans, `git pull`; després, commit de la `col_10` (i del
diccionari o de les `col_5` a `8`, si n'has tocat res) i el workflow fa la resta.

### Si el diccionari es perd

Les columnes de `separat/` el contenen sencer, camp per camp:

```bash
python3 "diccionaris/python/refer_diccionari (no s'usa).py" --sortida /tmp/mira-te-la.txt
python3 "diccionaris/python/refer_diccionari (no s'usa).py"   # sobre el de debò, preguntant
```

(Les cometes són perquè el nom du espais i un apòstrof. El "(no s'usa)" vol dir
que no és cap pas dels workflows, com el `provar.py` i l'`afegir_paraula.py`.)

És el camí contrari del `columnes.py` i no corre mai als workflows. Si el que hi
ha no diu el mateix, ensenya en què es diferencien i pregunta abans de
sobreescriure'l. La col_10 no la refà (no surt de `separat/` sinó de les
transcripcions): si també l'has perduda, passa després el `sincronitzar.py`.

## El diàleg d'homògrafs

Quan cerques una paraula que surt més d'un cop al diccionari, el web ha de
decidir si les entrades rimen totes igual (i tant se val quina agafi) o no (i
t'ho pregunta amb el diàleg d'homògrafs). Abans això calia esbrinar-ho amb la
`col_9` (les transcripcions senceres): amb el diccionari base ja eren 9,8 MB
per respondre un sí o un no, i amb el publicat són **73 MB i quatre milions de
línies**, prou per deixar el navegador penjat amb el loader en cercar
qualsevol paraula repetida. Per això hi va haver un `homografs.txt` intermedi
amb només les files discrepants.

Ara no cal cap fitxer a part: la cerca ja té carregades `col_3.idx` (rima
consonant) i `col_4.idx` (rima assonant) per fer la cerca de rimes, i n'hi ha
prou de mirar-hi el número de rima de cada entrada (segons `tipusRima`). Si
totes les entrades tenen el mateix número, rimen amb les mateixes paraules i
tant se val quina s'agafi; si no, es demana (vegeu `buscarParaula` a
`js/script.js`).

Com que ja no la demana ningú, la transcripció no s'acosta al paquet que es
publica a Pages. Al repositori s'hi queda, a
`dialectes_col/<codi>/trans_dicc/`: és la font de la rima i d'ella surten les
llistes de mots de 7.

## El json de rimes sencer, esborrat

`bot/resultat_ordenat_cons.json` (la taula rima → paraules, 16,9 MB) **ja no
existeix**, ni el `bot/generador_rimes_cons.py` que el feia, ni els dos passos
del `generar_llistes.yml` que el generaven i el comitejaven.

Qui el llegia era el bot de Twitter, i el bot tampoc no hi és: ara els tuits es
programen a mà amb `bot/programador/`, que s'aplega la mateixa taula a la
memòria des de la `col_0` i la `col_3` cada cop que s'engega (vegeu
`carregar_rimes()` a `bot/generador_tuits.py`). En fa una per dialecte, que el
lot de tuits els diu tots quatre: 6 s i 155 MB en total, contra 0,5 s per
llegir el fitxer d'un sol dialecte, i dona exactament el mateix.

Els 155 MB són de tots quatre junts perquè el tros del diccionari es llegeix
una sola vegada i les quatre taules s'ho reparteixen (vegeu
`carregar_paraules_del_diccionari()`): una còpia de les 619.783 paraules per
dialecte serien 240 MB. El que sí que és de cadascú són les seves paraules
pròpies, que s'hi enganxen al final (`carregar_paraules(dialecte)`). Dels segons, un és
de la `col_2`, que diu quines formes són nom propi (`carregar_noms_propis()`,
que als tuits no hi surten), i un altre d'aplanar les paraules per al cercador
(`aplanar_paraules()`): fent-ho en engegar, cercar-hi costa una dècima de
segon en comptes d'un segon sencer.

Es va treure perquè un fitxer derivat de les columnes s'ha de tornar a pujar
sencer a cada canvi del diccionari —30 versions a la història del repositori—
i, amb la generació aturada, deia el que digués el diccionari del dia que
s'hagués generat. Les nàufragues ja feia temps que no en depenien.

## El que costa publicar el v.6

| | base | v.6 |
|---|---|---|
| files | 619.783 | 4.025.866 |
| `separat/col_0..col_8` | 25,7 MB | ~170 MB |
| `dialectes_col/` (quatre dialectes) | 68 MB | per fer: cada forma amb pronom hauria de portar la seva transcripció a cada dialecte |
| `col_10.txt` | **76,3 MB** | no hi cabria |
| baixada real (Pages comprimeix) | 2,9 MB | ~20 MB |
| taules de rimes del programador, quatre dialectes (memòria, ja no és cap fitxer) | 155 MB | ~980 MB, estimat de les files: s'hauria de repensar |

⚠️ **La `col_10.txt` a 76,3 MB va just.** GitHub avisa als 50 MB i **bloqueja
als 100**: quan el diccionari creixi un 30 % més (o quan s'hi afegeixi un
cinquè dialecte), el push serà rebutjat. Llavors caldrà partir-la, i la manera
natural és un fitxer per dialecte: uns 20 MB cadascun, i el `col_10.py` és
l'únic que s'hi ha de tocar.
