# Encàrrec: implementar el nou sistema de tria de paraules del joc

Treballes dins del repositori `rimador.github.io` (el web Rimador.cat). El joc és
a `joc/`: una pàgina estàtica, sense servidor, amb mòduls ES natius al navegador i
scripts de Python a `joc/eines/` que generen les dades.

La teva feina és **implementar el nou sistema de tria de paraules** de la paraula
del dia i del mode il·limitat, tal com el descriu
[`joc/PROPOSTA_TRIA_DE_PARAULES.md`](PROPOSTA_TRIA_DE_PARAULES.md).

---

## 1. La font de veritat

1. **Llegeix sencera `joc/PROPOSTA_TRIA_DE_PARAULES.md` abans de fer res.** És
   l'especificació. Aquest encàrrec només hi afegeix l'ordre de feina, els detalls
   tècnics que la proposta no diu i les comprovacions.
2. Si aquest encàrrec i la proposta es contradiuen, **mana la proposta**. Si la
   proposta és ambigua o impossible d'implementar tal com està, **atura't i
   pregunta**. No ho resolguis pel teu compte.
3. Llegeix també, per entendre el que hi ha ara:
   - `joc/FUNCIONAMENT.md` (sobretot els apartats 2, 3, 5 i 7);
   - `joc/js/objectius.js`, `joc/js/dades.js`, `joc/js/principal.js`,
     `joc/js/magatzem.js`, `joc/js/classificacio.js`;
   - `joc/eines/generar_dades.py`, `joc/eines/finestra_rimes.py`,
     `joc/eines/bosses_rimes.py` i `joc/eines/bosses_rimes.plantilla.html`,
     `joc/eines/comprovar_diaries_manuals.py`, `joc/eines/predictor.py`;
   - `joc/dades/index.json` (només l'estructura: `diaries`, `dialectes.<codi>.claus`
     i `grups`), `joc/dades/diaries_manuals.json`, `service-worker.js`.

## 2. Què has de fer i què no

**Sí:**
- La paraula del dia nova: fórmula infinita amb eres, bosses, quotes, variants i
  rotació (proposta, apartat 4).
- L'era 0, que congela la roda d'ara perquè els dies passats no canviïn.
- L'script per congelar eres i el panell de selecció.
- La resolució de les paraules congelades i les comprovacions a `generar_dades.py`.
- Les paraules manuals xifrades a `dades/especials.json`.
- L'il·limitat natiu per dialecte, amb una seqüència per jugador.
- La previsió amb node.
- La documentació.

**No:**
- **No toquis el mode personalitzat.** Ha de continuar funcionant exactament igual.
- **No facis la segona fase** (apartat 10 d'aquest encàrrec): retirar la marca `*`
  i la passada dels quatre dialectes, i els avisos a les eines de correcció.
- **No creïs ni modifiquis cap workflow** de `.github/`. Cap pas pot dependre d'un
  workflow.
- **No comitegis ni facis push sense que l'usuari t'ho demani.** Treballa en una
  branca nova.
- **No esborris ni treguis del repositori cap fitxer comitejat** (per exemple
  `diaries_manuals.json`) sense preguntar-ho abans.
- **No triïs tu les quotes, els talls ni la data d'inici de l'era 1.** Els valors
  per defecte són els de `PER_DEFECTE` a `bosses_rimes.py`, amb tolerància
  ×0,5–×2 i 10 / 200 paraules per variant. La data i la configuració definitives
  les tria l'usuari al panell.

## 3. Convencions

- **Imita el codi del voltant**: comentaris en català, amb la mateixa densitat i el
  mateix to que el fitxer on escrius. Explica el *perquè* de les coses no òbvies,
  com fan els fitxers actuals.
- **Mòduls ES natius**, sense bundler. Els imports entre mòduls del joc porten un
  sufix `?v=…` (per exemple `./normalitza.js?v=5681007`): als imports nous, fes
  servir el mateix sufix que els imports veïns.
- **Python 3**, scripts a `joc/eines/`. Les rutes surten de `camins.py`, com a la
  resta d'scripts.
- **A la paraula del dia, només aritmètica entera i les funcions `llavor` i
  `generador` (mulberry32) d'`objectius.js`.** Cap `Math.random`.
- **Cap lògica de la fórmula duplicada en Python.** Quan un script de Python
  necessiti la fórmula (estat de sortida d'una era, previsió, coincidències de les
  manuals), ha de cridar node, que importa el mateix mòdul del joc.

## 4. Detalls tècnics que la proposta no diu

- **Node i els mòduls.** Hi ha node v22. El `package.json` de l'arrel no té
  `"type": "module"`, o sigui que node tractaria `joc/js/*.js` com a CommonJS i
  fallaria. Afegeix un `joc/js/package.json` amb `{"type": "module"}`: el navegador
  no el llegeix i no afecta gulp. Node accepta els sufixos `?v=` dels imports.
- **Proves.** No hi ha cap entorn de proves. Fes servir `node:test` i
  `node:assert`, en una carpeta nova (per exemple `joc/eines/proves/`), i que es
  puguin executar amb una sola ordre.
- **`versions.json`.** El genera `escriure_versions` a `generar_dades.py`. Hi has
  d'afegir `eres.json` perquè passi per la mateixa gestió de versions que l'índex.
  `especials.json`, en canvi, es demana com ara `diaries_manuals.json`: amb `?t=`,
  sense memòria cau, i amb l'última còpia bona al localStorage.
- **Service worker.** Mira les regles de `service-worker.js` per a `joc/dades/` i
  `joc/js/` i comprova que els fitxers nous reben el mateix tracte que els que ja
  hi ha.
- **L'identificador d'usuari** és `usuariID()` a `classificacio.js` (clau
  `rimador_usuari_id` del localStorage). L'il·limitat el necessita per a la
  llavor: exporta'l o mou-lo a `magatzem.js`, sense canviar-ne la clau.
- **El dia** es compta amb `avui()` de `magatzem.js` (hora de Catalunya). Dins
  d'una era, el dia *n* són els dies entre la data d'inici i la data, comptats en
  UTC com fa `diaDeLaRoda`.
- **Era 0.** És la roda d'ara (`paraulaDelDia`) amb una **còpia congelada** del bloc
  `diaries` d'avui. Compte: `diaries.on` guarda posicions dins de
  `dialectes.<codi>.claus`, que canvien a cada regeneració. Les paraules de l'era 0
  s'han de resoldre com les de qualsevol altra era (amb el bloc de resolució que
  escriu `generar_dades.py`), no amb aquell `on` congelat.
- **No facis servir `trobarObjectiu` per a cada dia**: descodifica el fitxer
  sencer del dialecte. La paraula del dia es resol amb el bloc de resolució de
  l'índex.
- **Homògrafs a l'il·limitat.** L'il·limitat natiu ha d'excloure les paraules que
  cauen a dues claus del mateix dialecte. Decideix com se'n marca la llista (per
  exemple, una llista per dialecte a l'índex) i documenta-ho. El personalitzat no
  pot canviar de comportament.

## 5. L'algorisme, en concret

Ho descriu la proposta. Aquí hi ha el que ha de quedar exactament així perquè
tothom obtingui el mateix:

1. **Quotes**: en per mil, enters, normalitzades perquè sumin 1.000 (si cal
   arrodonir, pel residu més gran, de manera determinista). L'script de congelar
   refusa les bosses que tenen quota però cap clau.
2. **Patró**: a cada pas, cada bossa suma wᵢ al seu deute; surt la de deute més
   gran (en cas d'empat, la de número més baix); a la que surt se li resta W. Es
   precalculen `patró[0..W-1]` i els recomptes acumulats de cada bossa.
3. **Dia *n* d'una era**: bossa `patró[n mod W]`. Vegades que ha sortit la bossa
   abans del dia *n*: `m = floor(n / W) · wᵢ + acumulat_i[n mod W]`.
4. **Clau**: si la bossa té *K* claus (en ordre canònic dins de l'era),
   `r = floor(m / K)` i `p = m mod K`. La baralla de la volta *r* és un Fisher-Yates
   amb ``generador(llavor(`<era>-<carril>-<bossa>-<r>`))``. Si la primera clau de la
   volta *r+1* és l'última de la *r*, s'intercanvien les dues primeres de la *r+1*.
5. **Primera volta d'una era nova**: primer les claus que no havien sortit a la
   volta a mitges de l'era anterior, barrejades, i al final les que sí, també
   barrejades. Aquest estat (volta, posició i claus sortides de cada bossa, i el
   comptador de cada clau) **es calcula en congelar, amb node, i es desa a l'era
   nova**. El joc no ha de recórrer mai les eres anteriors.
6. **Variant i paraula**: si *t* és el nombre de vegades que la clau ha sortit
   abans (comptador de les eres anteriors + *r*), toca la variant `t mod nVariants`
   i, dins de la variant, la paraula `floor(t / nVariants) mod nParaules`.
7. **Fàcil i difícil el mateix dia**: si donen la mateixa paraula, el fàcil passa a
   la paraula següent de la seva variant. Si la variant només té una paraula, passa
   a la variant següent. Documenta el cas extrem que no tingui alternativa.
8. **Paraula manual**: mana sobre la fórmula. El dia compta igualment per a la
   bossa i per a la posició de la volta, de manera que **no es mou cap altre dia**.
9. **En congelar**:
   - candidates i variants com diu la proposta (apartats 4.4 i 4.5);
   - tolerància ×0,5–×2 per defecte (paràmetre per carril; al fàcil, amb les rimes
     dels grups assonants);
   - paraules per variant: 10 al difícil i 200 al fàcil per defecte (paràmetre per
     carril);
   - al fàcil, primer les paraules que no són a cap llista del difícil;
   - les paraules que ja eren a l'era anterior mantenen l'ordre i les noves van al
     final;
   - la data d'inici ha de ser com a mínim d'aquí a 7 dies;
   - cap era començada no es modifica.

## 6. Formats de dades

Tens llibertat per concretar-los, però **documenta'ls** a `FUNCIONAMENT.md` i
respecta això:

- **`joc/dades/eres.json`**: l'era anterior, la vigent i les futures ja congelades.
  Cada era porta: id, data d'inici, versió d'algorisme i, per carril, talls,
  quotes en per mil, tolerància, paraules per variant, el contingut congelat (claus
  de cada bossa en ordre canònic; variants de cada clau en ordre; paraules de cada
  variant en ordre, amb la forma per mostrar) i l'estat de sortida de l'era
  anterior. L'era 0 porta la còpia de `diaries` i diu que es calcula amb
  l'algorisme de la roda.
- **`joc/dades/eres_arxiu.json`**: les eres més velles. El joc no el carrega.
- **`joc/dades/index.json`**: un bloc nou amb la resolució, a cada dialecte, de
  cada paraula de les eres de `eres.json` (en quina clau i grup cau ara).
- **`joc/dades/especials.json`**: `{"v": 1, "dies": {"<resum de la data>": "<base64>"}}`.
  El valor és el JSON `{f, d}` barrejat (XOR) amb una seqüència de `generador`
  sembrada amb `llavor` d'una cadena que inclogui la data (amb una sal diferent de
  la del resum de la clau), allargat fins a una mida fixa i codificat en base64.
  Xifra amb node, amb les mateixes funcions del joc, perquè no hi hagi cap port a
  Python que pugui discrepar.
- **Les manuals en clar** (l'entrada que edita l'usuari) es queden en local i van
  al `.gitignore`. Com que ara `diaries_manuals.json` és comitejat, **pregunta**
  com es fa el canvi abans de tocar-lo.
- **La configuració triada al panell** s'ha d'exportar en un fitxer (per exemple
  `joc/eines/config_era.json`) que llegeix l'script de congelar.

## 7. Pla de feina

Fes-ho per fases. **Al final de cada fase**, informa de què has fet i com ho has
comprovat, i continua només si les comprovacions passen.

**Fase 0. Pla.** Llegeix el que diu l'apartat 1 i presenta un pla curt amb els
dubtes que tinguis. Espera la resposta abans d'escriure codi.

**Fase 1. El nucli de la fórmula** (`joc/js/`, sense tocar encara la pantalla).
- El patró ponderat, les baralles per volta, la primera volta d'una era nova, la
  rotació de variants i paraules, la regla de fàcil i difícil i la paraula manual.
- Funcions pures exportades i proves amb `node:test`:
  - en 20.000 dies, cada bossa surt exactament el que toca i l'error mai arriba a
    un dia;
  - el patró és periòdic, amb un període que divideix W;
  - cap clau no es repeteix dins d'una volta;
  - dues execucions donen exactament el mateix;
  - una manual no mou cap altre dia;
  - en canviar d'era, les claus de la volta a mitges van al final.

**Fase 2. Congelar eres i el panell.**
- `joc/eines/congelar_era.py`: candidates, variants, tolerància, paraules per
  variant, llistes del fàcil separades, continuïtat de l'ordre, normalització de
  quotes, comprovació del marge i informe (incloses les variants d'una sola paraula
  i les claus sense cap variant). Crida node per calcular l'estat de sortida de
  l'era anterior. Escriu `eres.json` i passa les eres velles a l'arxiu.
- `bosses_rimes.py` i la seva plantilla com a **panell de selecció**: talls,
  quotes, tolerància i paraules per variant de cada carril, amb la vista per
  dialecte, les variants de cada clau, la vista de l'il·limitat natiu, cada quan
  torna la mateixa paraula, la mida de l'era, i un botó per exportar la
  configuració.
- Congela l'**era 0** (la roda d'ara amb el `diaries` d'avui).
- **No congelis l'era 1 de debò**: deixa-la preparada i demana a l'usuari la data
  d'inici i la configuració.

**Fase 3. `generar_dades.py`.**
- Escriu el bloc de resolució de les paraules de `eres.json` a l'índex i afegeix
  `eres.json` al `versions.json`.
- Les comprovacions de l'apartat 4.10 de la proposta:
  - **ERROR que bloqueja** si una paraula congelada ja no es pot jugar en algun
    dialecte. Es proposa una substitució al mateix lloc; no s'esborra mai.
  - **Avisos**: claus que han canviat de bossa (les de la bossa del costat només
    al recompte; les que salten dues bosses o més, amb nom); variants que han
    sortit de la tolerància; paraules que han canviat de rima.
  - **Llindar de l'1 %** de claus desplaçades, o d'un 1 % de claus noves que
    podrien entrar, per suggerir una era nova.

**Fase 4. Manuals.**
- Un script (millor en node) que valida cada manual als quatre dialectes (objectiu
  i una sola clau a cadascun) i falla si no hi és.
- Avisa si la paraula o la seva clau coincideix amb la fórmula a menys de 30 dies.
- Escriu `especials.json`.
- Hi passa totes les manuals actuals, també les dels dies passats.

**Fase 5. Integració al joc.**
- `dades.js`: carregar `eres.json` (per versions) i `especials.json` (amb `?t=`),
  amb l'última còpia bona al localStorage.
- `principal.js`: `seleccioDelDia` i `prepararParaula`, la pantalla d'ahir i el
  canvi d'era 0 a era 1.
- **La comprovació més important**: per a cada dia des del primer dia del joc fins
  a avui, i per a les dues dificultats, la paraula de l'era 0 és **idèntica** a la
  que dona avui la roda (`paraulaDelDia` amb l'índex actual), manuals incloses. Si
  no ho és, atura't i informa.

**Fase 6. Il·limitat natiu.**
- Bosses i quotes de l'era vigent, cada carril les seves, aplicades a les claus o
  grups del dialecte amb les seves pròpies rimes.
- Paraules objectiu del dialecte (`+` i `*`), sense homògrafs del dialecte.
- Seqüència per jugador: llavor = `usuariID()` + dialecte + dificultat; comptador
  al localStorage per dialecte i dificultat; desplaçament `llavor(id) mod W`.
- Les bosses sense claus en aquell dialecte no entren al seu patró.
- Se salta la clau de la paraula del dia del mateix dialecte i dificultat.
- Proves: un jugador que fa N partides té exactament les partides de cada bossa
  que toquen; no es repeteix cap clau dins d'una volta.

**Fase 7. Previsió.**
- `joc/eines/previsio.mjs`: els propers N dies (data, carril, bossa, clau,
  variant, paraula, rimes a cada dialecte, si és manual), amb la sortida en local
  i al `.gitignore`.
- Retira `predictor.py`.

**Fase 8. Documentació.**
- Actualitza `joc/FUNCIONAMENT.md` (sobretot l'apartat 7 i els formats nous) i el
  `README.md` del joc si cal.
- Marca la proposta com a implementada, dient-ne la data i qualsevol diferència
  respecte del que deia.

## 8. Comprovació final

Abans de dir que està fet, comprova i informa de cada punt:

- [ ] Totes les proves de node passen amb una sola ordre.
- [ ] Els dies passats no han canviat (fase 5).
- [ ] Els propers 400 dies, la paraula del dia es resol als quatre dialectes per
      a les dues dificultats, i és la mateixa a tots quatre.
- [ ] En 10.000 dies simulats, les quotes de cada carril es compleixen amb menys
      d'un dia d'error.
- [ ] Una manual nova a `especials.json` substitueix el seu dia i cap altre dia no
      canvia.
- [ ] Amb `eres.json` i `especials.json` desats i sense xarxa, el joc continua
      donant la paraula del dia.
- [ ] El mode personalitzat dona exactament el mateix que abans per a un parell
      d'enllaços de prova.
- [ ] El panell s'obre, deixa canviar els quatre paràmetres de cada carril i
      exporta la configuració.
- [ ] `generar_dades.py` passa sense errors i l'informe surt com descriu la
      proposta.
- [ ] Les proves al navegador: obre el joc amb un servidor local, juga la paraula
      del dia en dos dialectes, mira la pantalla d'ahir i juga dues partides de
      l'il·limitat.

**Números de referència** per veure que vas bé (amb les dades del 31-10-2026; si
les dades han canviat, poden variar una mica):
- amb `PER_DEFECTE` i ×0,5–×2, unes 924 claus del central tenen alguna variant al
  difícil i 35 grups al fàcil;
- amb 10 paraules per variant al difícil se'n guarden unes 9.000; amb 200 al fàcil,
  unes 4.800 (abans de separar les llistes);
- al difícil, la bossa de 100–249 rimes torna cada 220 dies i la de 250–499, cada
  128; al fàcil, les bosses del mig tornen cada 18–19 dies.

## 9. Com has d'informar

- Al final de cada fase: què has fet, quins fitxers has tocat, com ho has
  comprovat i què no has pogut comprovar.
- Si una comprovació falla, digues-ho amb la sortida, no ho amaguis.
- Si una decisió de la proposta resulta impracticable, explica per què i proposa
  una alternativa abans d'aplicar-la.
- **No comitegis** fins que l'usuari t'ho demani.

## 10. Segona fase (no ara)

Queda per a més endavant, i **no s'ha de fer en aquest encàrrec**:
- retirar la marca `*` i la passada dels quatre dialectes de `generar_dades.py`;
- que les eines de corregir i afegir paraules avisin quan una paraula és paraula
  del dia.
