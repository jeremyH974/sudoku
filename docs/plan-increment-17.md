# Incrément 17 — Publier, puis finir le plan

## Ce que cet incrément traite

Cinq points, dans l'ordre où ils pesaient :

1. **publier** — treize commits vivaient sur `enquete` et n'avaient jamais atteint `master` ;
2. **le nom de domaine** — resté en suspens depuis l'incrément 12 ;
3. **les 4,35 s au pire cas** de la composition d'une affaire ;
4. **les portes du plan** — le dernier écart avec la référence visuelle ;
5. **la manuscrite sur l'accueil** — le seul écran resté en pile système.

---

## 1. Publier, et les deux défauts que la publication a révélés

### 3,7 Mo précachés que personne n'aurait jamais vus

La construction annonçait **74 entrées, 4 266 Kio** de précache pour une application dont le code
fait 240 ko. La cause : le glob du service worker avait gagné `avif` avec la bibliothèque de
portraits (incrément 16), et les **masters** — seize images de 1024 px, 230 ko pièce — vivaient
sous `packages/app/public/portraits/masters`, donc dans le dossier servi.

Personne ne pouvait le remarquer. Un cache hors ligne qui grossit ne casse rien : il ralentit
seulement la première visite de tout le monde, une fois, en silence.

Les masters sortent vers `assets/portraits/masters`. Ils ne sont pas supprimés — ce sont les
**négatifs** de la bibliothèque, et sans eux changer de taille ou de format imposerait de
régénérer, donc de repayer, donc d'accepter une nouvelle dérive de style.

| | avant | après |
|---|---|---|
| entrées précachées | 74 | **58** |
| poids précaché | 4 266 Kio | **600 Kio** |
| `dist` | 4,5 Mo | **824 ko** |

Deux gardes, **prouvés mordants avant d'être gardés** :

- un plafond **par fichier** sur `packages/app/public` — 96 ko, parce que c'est la forme que prend
  la faute : on dépose un fichier source dans le dossier servi. Le plus gros fichier légitime est
  le corpus du défi du jour, pesé à 66,7 ko ;
- un contrôle nommé que les masters restent hors du dossier servi, qui dit *pourquoi* là où le
  plafond ne dit que *combien*.

### La CI a échoué, et la cause était le point 3

Trois tests d'accessibilité ont fait tomber la première publication : `a11y-tabulation`,
`a11y-dimensions` et `a11y-mesure`. Ce sont **exactement les trois graines les plus lentes** du
fichier — 1 005, 825 et 825 ms de composition ici, contre une médiane à 197 ms.

Sur deux cœurs partagés avec quarante-quatre travailleurs qui se les disputent, composition + rendu
+ `axe` franchit les cinq secondes du défaut de vitest. Le symptôme ressemblait à un composant
cassé ; la cause était le chronomètre — exactement comme pour le test de propriété de `composeCase`
à l'incrément 16.

Un délai mesuré de trente secondes débloque la publication. **Ce n'est pas la correction**, et le
commentaire le dit : le joueur attend le même temps derrière « Nouvelle affaire ». Le jour où la
composition sera rapide, ce délai doit redescendre, et sa disparition sera la preuve.

---

## 2. Le nom de domaine — écarté, et ce que cela engage

### Ce que la recherche a corrigé

Trois choses tenues pour acquises étaient fausses :

- **le fichier `CNAME` ne sert à rien** quand la publication passe par un artefact d'Actions.
  GitHub l'ignore, et sa doc le dit depuis mars 2025 ; le réglage vit dans la configuration Pages
  du dépôt, nulle part ailleurs ;
- **l'ancienne adresse ne « continue pas de fonctionner »** : elle renvoie une `301` permanente,
  chemin et chaîne de requête conservés, segment du dépôt retiré. Mesuré sur cinq sites Pages
  réels, parce que GitHub ne le documente pas ;
- **et le service worker déjà installé survit à la bascule.** C'est le point qui décide de tout.

### Le piège que rien ne documente

La spécification W3C des service workers impose au contrôle de mise à jour un
`redirect mode: "error"`. Après une bascule de domaine, l'ancienne adresse ne répond plus qu'en
301 — donc précisément le cas interdit. Et la registration n'est retirée que si aucun worker actif
n'existe.

Conséquence : **tout joueur ayant déjà ouvert le site garderait sa version à vie**, servie depuis
son précache, sans jamais voir la redirection. Un rechargement n'y suffirait pas. Le remède existe
— un service worker fossoyeur — mais il doit être déployé **avant** la bascule, puisque après, plus
rien ne peut être servi à l'ancienne adresse.

S'ajoute la perte de `localStorage` : changer de domaine change l'origine, donc l'historique, la
progression, le thème et le réglage de taille de chaque joueur restent sur l'ancienne adresse.
Aucune API ne les transfère.

### La décision

**Le site reste sur GitHub Pages.** La décision engage une chose, et une seule :

> Ce dépôt ne doit **jamais** être renommé. GitHub Pages ne redirige pas l'adresse d'un site de
> projet après un renommage, et tous les cahiers déjà imprimés cesseraient de s'ouvrir.

La redondance de `/sudoku/sudoku/` reste donc, et devient un choix tenu plutôt qu'une étape.

Pour mémoire, trente-huit noms ont été testés au RDAP le 13 septembre 2026 ; dix-neuf étaient
libres en `.fr` **et** `.com`, dont `caseacase`, `deducase` et `cahierdencre`.

---

## 3. La composition, deux fois plus rapide sans changer une seule affaire

### Ce que le profilage a établi

Première mesure, sans instrumenter le moteur : `composeCase(seed, { attempts: k })` rejoue
exactement les `k` premières tentatives de l'appel complet, donc le plus petit `k` qui rend une
affaire est le **rang de la tentative gagnante**.

| | rang moyen | ms par tentative |
|---|---|---|
| graines rapides | 7,6 | 21,4 |
| graines lentes | **45,0** | 24,4 |

Le prix d'une tentative est presque constant. **La lenteur n'est pas une étape lente, c'est un taux
de rejet.**

Le profilage détaillé, sur 400 graines et 118 977 ms, l'a confirmé et localisé :

- **96,8 % du temps** est dans `solveExact`, appelé depuis la boucle de retrait de `carve` —
  651 435 appels ;
- **≈ 69 % du temps total** dans la seule fonction `pruneClue` ;
- **1,16 milliard de `Uint32Array` alloués** dans ce module, soit 6,69 par appel de `pruneClue` ;
- et sur 4 597 `carve` menés à terme, **4 197 sont jetés — 91,3 %** : 51,6 % parce qu'un suspect
  garde plus de deux cartes, 36,9 % parce que le registre ne sait pas résoudre. Aucune graine ne
  tourne en rond ; elles paient simplement le plein tarif à chaque essai.

### Les deux corrections

**Mémoïser la propagation.** `bandsToCells` et `zoneReach` reconstruisaient à chaque nœud deux
ensembles qui ne dépendent que du décor et d'un masque de six bits — au plus 128 résultats distincts
par décor. La table vit sur `Scene`, à côté de `cellsNextToProp`, qui existe déjà pour exactement
cette raison. Elle se remplit à la demande : remplir d'avance coûterait `2^taille` entrées par axe,
ce qui tient à six suspects et plus du tout à seize.

L'invariant qui autorise le partage est écrit noir sur blanc : **aucune opération de `cellset` ne
mute son entrée**, elles allouent toutes leur sortie. Un appelant qui muterait un ensemble rendu
corromprait toutes les déductions suivantes.

**Ramener `SOLUTION_CAP` de 12 à 2.** Les deux seuls appelants de `countSolutions` comparent à
**un** : « cette disposition est-elle encore la seule ? ». Une seconde solution suffit à répondre
non. Le commentaire justifiait qu'il y **ait** un plafond, jamais qu'il vaille douze — et le
`countSolutions` du sudoku s'arrête à deux depuis toujours.

### Le résultat, et la vérification qui compte

| 400 graines | avant | après | |
|---|---|---|---|
| p50 | 282 ms | **101 ms** | −64 % |
| p90 | 931 ms | **343 ms** | −63 % |
| p99 | 3 051 ms | **1 122 ms** | −63 % |
| pire | 4 352 ms | **1 603 ms** | −63 % |

Sur les douze graines des tests d'accessibilité : total 4 232 → 1 927 ms (−54,5 %), pire cas
1 005 → 438 ms.

**Les affaires produites sont identiques.** Vérifié graine par graine sur deux cents compositions,
en comparant décor, victime, coupable, **chaque indice sérialisé**, technique la plus dure, nombre
d'étapes et solution complète : 200 sur 200. C'est la vérification qui décide — un gain de vitesse
qui changerait les affaires serait un changement de jeu déguisé.

Le plafond du banc descend de 6 000 à 3 000 ms, et le délai des tests d'accessibilité de 30 à 15 s.

### Une piste mesurée, et écartée pour cette raison

Mémoïser `unaryCells` paraissait le gain évident : pure en (indice, décor), rappelée à chacun des
172,8 millions d'appels. Mesurée, cache compris : **+1,8 % sur la somme**, plus rapide sur seulement
161 graines sur 400. La raison est instructive — **zéro appel sur 172,8 millions** porte sur un
indice unaire **nié**, parce qu'`isUseful` les élimine tous en amont. La boucle coûteuse ne tourne
donc jamais.

### Rejeter plus tôt : la borne existe, elle est exacte, et elle ne rapporte rien

91,3 % des `carve` terminés sont jetés, dont la moitié parce qu'un suspect garde plus de deux
cartes. On ne l'apprenait qu'à la fin, après avoir payé la centaine de vérifications d'unicité que
coûte un parcours complet. Il y a pourtant une borne exacte, et elle est jolie.

`removalOrder` émet **exactement une entrée par carte**, la victime exceptée — elle n'en a qu'une,
celle qui fait l'affaire. Pour un suspect, en notant `n` ses cartes de départ :

```
n = réussites + refus + passes        (chaque entrée fait l'un des trois)
cartes finales = n − réussites = refus + passes ≥ refus
```

Donc **plus de `maxCards` refus sur un même suspect condamne la taille**, quoi qu'il arrive ensuite.
Et les « passes » — les entrées sautées parce qu'il ne reste qu'une carte — ne comptent pas comme
des refus : c'est ce qui rend la borne exacte plutôt que seulement prudente. Le hasard n'est pas
touché non plus, puisque `removalOrder` consomme le générateur **avant** la boucle.

Écrit, vérifié identique sur 200 affaires… et **retiré**.

Le chronomètre n'arrivait pas à trancher : quatre passes appariées, alternées, ont donné +0,5 %,
−10,8 %, −7,9 % et −0,5 %, et un pire cas médian **plus mauvais** avec l'abandon qu'avec. Un banc
qui dit tout et son contraire ne dit rien.

La question s'est donc posée autrement : compter le **travail** plutôt que le chronométrer. Un
compteur temporaire sur `countSolutions`, deux exécutions sur les mêmes 400 graines :

| | appels à `countSolutions` |
|---|---|
| sans l'abandon | 651 435 |
| avec | **643 834** |

**−1,17 %.** Voilà pourquoi aucun chronomètre ne pouvait le voir. La raison tient à
l'arithmétique : les refus ne font que 4,6 % des retraits, soit 1,3 par suspect en moyenne — en
atteindre trois sur un même suspect demande une concentration inhabituelle, et quand elle arrive,
elle arrive tout à la fin du parcours.

Quinze lignes et une preuve de vingt-cinq pour un centième : même verdict que `unaryCells`, et pour
une raison mesurée plutôt que sentie.

**Ce qui reste possible, et qu'on ne fait pas :** diriger l'ordre de retrait par la taille des
cartes. Ce serait un changement de conception, et il **changerait les affaires produites** — ce
n'est pas un arbitrage qu'on tranche sur un gain de vitesse.

---

### Le délai des tests d'accessibilité, supprimé

Trois tests de ce fichier avaient fait tomber la publication en dépassant les cinq secondes du
défaut de vitest, sur le coureur et nulle part ailleurs. On a posé trente secondes, puis quinze, en
écrivant que « le rendu et `axe` dominent désormais ».

**C'était faux.** Il a fallu chronométrer chaque phase **dans** vitest pour le voir :

| phase | part |
|---|---|
| `composeCase` | **87,7 %** |
| `render()` | 7,8 % |
| `axe` | 4,3 % |
| chargement de l'affaire | 0,04 % |

Le rendu d'un plan coûte 43 à 88 ms ; charger une affaire, moins d'une milliseconde. L'apparente
incohérence — les deux tests qui exécutent `axe` n'étaient pas les plus lents — tenait entièrement
aux graines : ces deux-là tiraient les deux affaires les moins chères du fichier.

#### Pourquoi la composition coûtait quatre fois son prix

Le facteur se scinde en deux, mesurés sur le **même code gelé**, douze graines :

| | total |
|---|---|
| `tsx` + node | 1 956 ms |
| vitest, environment node | 3 636 ms — **×1,86**, la tuyauterie de vitest |
| vitest, environment jsdom | 7 766 ms — **×2,14**, jsdom sur du calcul pur |

Un calcul qui ne touche à aucun DOM coûte deux fois plus cher sous jsdom. Le mécanisme n'est **pas
identifié** : ni le tas retenu ni la forme de `globalThis` ne l'expliquent, tous deux écartés par
mesure. C'est une question ouverte, pas une piste.

#### Ce qui a été fait

**Une affaire par décor, et non une par test.** Chaque test composait la sienne sur une graine
nommée d'après lui — `a11y-noms`, `a11y-plan`… — d'où une répartition en décors purement
accidentelle : cinq fois l'atelier, trois fois le manoir, deux fois le reste. Quatre affaires, une
par plan, couvrent mieux en coûtant quatre fois moins.

**La graine, choisie par la mesure.** Aucune assertion n'en dépend : c'est un paramètre de coût, et
un paramètre de coût se mesure. Huit mots quelconques passés sur les quatre décors :

| graine | total des quatre | le pire |
|---|---|---|
| `test` | 4 955 ms | 2 692 ms |
| `a11y` (l'ancienne) | 2 161 ms | 1 287 ms |
| **`fiche`** | **686 ms** | **378 ms** |

#### Le résultat, et la preuve

| | avant | après |
|---|---|---|
| le fichier, ici | 11,93 s | **3,15 s** |
| le pire test, ici | 2 190 ms | **518 ms** |
| **le fichier, sur le coureur** | **41 519 ms, trois échecs** | **5 153 ms, tout vert** |

Le délai explicite est **supprimé**. Ce n'est pas une estimation : le journal du coureur ne signale
plus aucun test de ce fichier comme lent, et les cinq secondes du défaut protègent désormais seules.

Ce que cela coûte, dit franchement : douze jeux d'indices distincts deviennent quatre. La variété
des énoncés se vérifie dans `clues.test.ts`, qui est fait pour ça.

---

### Le facteur jsdom, expliqué

Un calcul purement arithmétique coûtait **2,14 fois plus cher** sous `environment: 'jsdom'` que
sous `node`, à code identique et configuration identique. Deux explications avaient été écartées
par la mesure — le tas retenu et la forme de `globalThis`. Il y en avait **deux autres**, et elles
se cumulent.

#### Première cause : la liaison globale, pour deux raisons à la fois

Une micro-mesure des primitives que le moteur emploie a isolé une seule anomalie :

| | jsdom | node | |
|---|---|---|---|
| **`new Uint32Array(2)`** | **76,2 ms** | **18,2 ms** | **×4,19** |
| lecture/écriture dans un tableau typé | 1,9 ms | 1,9 ms | ×1,0 |
| objet littéral | 8,8 ms | 9,2 ms | ×0,96 |
| `Array.prototype.filter` | 18,9 ms | 16,4 ms | ×1,15 |
| `Map` set/get | 8,0 ms | 8,3 ms | ×0,96 |
| arithmétique pure | 31,1 ms | 32,9 ms | ×0,95 |

**Seule l'allocation d'un tableau typé diffère.** L'indice qui l'explique tient en une ligne :

```
Buffer.from([1]) instanceof Uint8Array   →  jsdom : false   node : true
```

`Buffer` est toujours celui de Node. S'il n'est plus un `Uint8Array`, c'est que la liaison globale a
été remplacée. Deux mécanismes s'y superposent, et il a fallu les séparer pour les croire.

jsdom construit sa fenêtre dans un contexte `vm` — donc un autre realm — et Vitest recopie ses
globales sur `globalThis`, **sous forme d'accesseurs**. Chaque évaluation de l'identifiant
`Uint32Array` exécute donc un *getter*, qui rend un constructeur *étranger*.

Mesuré sous jsdom, en remplaçant l'un puis l'autre :

| | médiane | écart |
|---|---|---|
| accesseur + realm de jsdom *(tel quel)* | 1 483 ms | — |
| **propriété de données** + realm de jsdom | 1 278 ms | **−13,9 %** |
| propriété de données + **constructeur de Node** | 1 035 ms | **−30,2 %** |

**L'accesseur coûte 13,9 %, le franchissement de realm 16,3 % de plus.** Les deux se tiennent :
V8 refuse catégoriquement d'inliner une fonction d'un autre *native context*
(`js-inlining.cc`, « Disallow cross native-context inlining for now »), et ne replie en constante
qu'une globale qui est une **cellule de données**, jamais un accesseur
(`js-native-context-specialization.cc`).

Sont ainsi remplacés **neuf constructeurs de tableaux typés et `ArrayBuffer`** — exactement
l'intersection des soixante-six intrinsèques que jsdom installe depuis son realm avec la liste
`KEYS` de Vitest. `Array`, `Object`, `Function`, `RegExp` et `Promise` ne le sont pas : le filtre de
`populateGlobal` ne recopie une clef déjà présente chez Node que si elle figure dans cette liste.

C'est un défaut connu — mais comme un défaut de **correction**, jamais de performance :
[vitest#4043](https://github.com/vitest-dev/vitest/issues/4043) est ouverte depuis le 29 août 2023,
et son mainteneur y écrit « I am not sure where the middle ground is ».

#### Seconde cause : ce n'est **pas** le ramasse-miettes

C'était l'hypothèse évidente, et elle est fausse. Hors de Vitest, avec une fenêtre jsdom vivante et
**aucune globale touchée** — donc ni accesseur ni realm —, sous `--trace-gc` :

| | médiane | scavenges | temps de GC |
|---|---|---|---|
| avant la fenêtre | 303 ms | 22 | **3,4 ms** |
| après | 422 ms | 21 | **7,3 ms** |

**+39 % de temps, soit 119 ms par passe, pour 3,9 ms de GC en plus.** Un ordre de grandeur d'écart.
Figer le semi-espace ne change rien non plus : 58,6 % en adaptatif, 52,8 % à 16 Mo, 50,2 % à 4 Mo.

C'est cohérent avec ce que V8 documente — le coût d'un *scavenge* est borné par les objets
**survivants** et les pointeurs vieux→jeune, pas par la taille d'un graphe statique
([v8.dev/blog/trash-talk](https://v8.dev/blog/trash-talk)).

#### Ce que c'est, alors : le tas occupé, et la diversité des formes

Le coût n'a même pas besoin d'une fenêtre. **Importer le module jsdom, sans rien construire**, suffit :

| | médiane | tas | écart |
|---|---|---|---|
| nu | 304 ms | 21 Mo | — |
| jsdom **importé**, aucune fenêtre | 509 ms | 126 Mo | **+67 %** |
| + fenêtre minimale | 466 ms | 138 Mo | +56 % |
| + `runScripts: 'dangerously'` | 502 ms | 142 Mo | +68 % |

Deux témoins synthétiques, sans jsdom du tout, séparent ce qui compte :

| ce qui remplit le tas | tas | écart |
|---|---|---|
| un graphe de 600 000 nœuds, **2 formes** | 205 Mo | **+29 %** |
| 600 000 objets, **3 000 formes distinctes**, lues une fois | 274 Mo | **+42 %** |
| jsdom importé | 127 Mo | **+46 %** |

À taille de tas **moitié moindre**, jsdom coûte autant que trois mille formes — et deux fois plus
qu'un gros tas de deux formes. La diversité des *hidden classes* compte donc autant que le volume :
jsdom engendre des milliers de classes d'enveloppe, et le cache d'appoint mégamorphique de V8 est
une table **de taille fixe partagée par tout l'isolat**. Le code sans rapport en paie les défauts.

⚠ **Ce dernier point est une explication cohérente avec quatre mesures, pas une démonstration.** Je
n'ai pas instrumenté V8 pour compter les défauts de cache ; les pourcentages de jsdom varient de 46
à 67 % d'une passe à l'autre sur une machine occupée. Ce qui est **établi**, c'est que la seconde
cause n'est ni le temps de GC, ni la taille du semi-espace, ni la présence d'une fenêtre.

#### Ce qu'on en fait : rien, et c'est mesuré aussi

Rendre à Node ses constructeurs dans un fichier de préparation **fonctionne** et ne casse rien —
les cinquante tests du projet DOM passent. Le gain :

| | |
|---|---|
| sur la composition seule | −14 % à −26 % selon la passe |
| **sur le projet DOM entier** | 8,39 s → **8,24 s**, soit 1,8 % — du bruit |

La correction précédente a déplacé le goulot : la composition ne pèse plus assez pour que le
facteur jsdom se voie. Le correctif est donc **écarté** — il fait combattre l'environnement pour
un gain qui n'existe plus.

**Et surtout : rien de tout cela n'atteint l'application.** Un navigateur n'a qu'un realm et
aucun travailleur de vitest. C'est un artefact de mesure, entièrement, et il fallait le savoir pour
cesser d'en tenir compte.

---

### Une piste que vitest suggère lui-même, et qui ne donne rien

Le journal de la CI imprime un conseil à chaque exécution :

> `44 workers spawned · ~316ms startup each` — *at least ~4.31s faster with `isolate: false`*

Quarante-quatre travailleurs à trois cent seize millisecondes, c'est quatorze secondes de démarrage
pour une suite qui en dure vingt-six. Sur le coureur, à deux cœurs partagés, la part est pire.

Mesuré, la suite entière, deux exécutions consécutives :

| | durée |
|---|---|
| avec isolation (défaut) | 36,12 s |
| `--no-isolate` | **36,82 s** |

**Aucun gain**, et les 547 tests passent dans les deux cas. Le conseil ne se vérifie pas ici : il
chiffre le démarrage des travailleurs, pas ce qu'on récupère en les réutilisant — le temps repart
ailleurs, probablement dans le registre de modules qui cesse d'être remis à neuf.

C'est une piste fermée, et c'est utile de l'écrire : elle est visible dans chaque journal de CI, et
quelqu'un la rouvrira.

---

## 4. Les portes

### Pourquoi elles manquaient

Les murs étaient des **bordures de case** : deux pixels par côté, colorés là où deux pièces se
touchent. Cela tient tant qu'un mur est plein — et une bordure CSS ne sait pas s'interrompre au
milieu. Une porte y était structurellement impossible, et les cinq pièces d'un plan étaient donc
cinq boîtes hermétiques. Personne ne le remarque consciemment ; tout le monde le voit.

### La règle, tranchée en comptant

| | une porte par mitoyenneté | arbre couvrant |
|---|---|---|
| Le manoir | 8 | **4** |
| Le pavillon | 6 | **4** |
| L'atelier | 8 | **4** |
| La rotonde | 8 | **4** |

Et deux paires de pièces ne partagent qu'**une seule arête** : la porte y mangerait tout le mur.

L'arbre couvrant donne exactement `pièces − 1`, et il est **de poids maximal** — entre deux
mitoyennetés, on perce la plus large. C'est là que les portes se mettent dans un vrai bâtiment, et
cela garantit qu'un mur subsiste de chaque côté.

Une subtilité que les données ont imposée : **les frontières partagées ne sont pas toujours d'un
seul tenant.** Quatre paires, sur les quatre décors, se rencontrent en deux pans séparés. Centrer
la porte sur « toutes les arêtes » la poserait dans le mur qui les sépare, c'est-à-dire nulle part.
On regroupe donc par contiguïté et on perce le plus long pan.

### Les proportions viennent de la norme

ISO 128-23 fixe la hiérarchie des traits d'un plan de bâtiment : le mur coupé porte le trait le
plus fort, le symbole de porte le plus fin, dans un rapport de **quatre pour un**. D'où un mur de
0,12 case et un seuil de 0,03.

Mesuré au bas de la plage — fenêtre de 375 px, cases de 56,2 px :

| | mesure | seuil de la littérature |
|---|---|---|
| mur | 6,74 px | — |
| seuil | 1,68 px | 1,2 px (Ledermann 2022, tableau 8.1) |
| vide de la porte | 33,7 px | 12 px pour identifier une icône composite |

### Ce qu'on ne dessine pas, et pourquoi

**Ni vantail ni arc de débattement.** Ils codent un sens d'ouverture dont aucun décor ne dispose ;
les dessiner au hasard mettrait une information fausse sur un plan par ailleurs exact. C'est la
règle « ne jamais afficher une difficulté qu'on n'a pas mesurée », appliquée au dessin.

**Ni porte d'entrée.** Une ouverture sur l'extérieur demanderait de savoir où est la façade, et
rien dans un décor ne le dit.

### Un seul chemin, et c'est technique

Les moteurs anticrénèlent **chaque forme séparément contre le canevas** au lieu de faire un
anticrénelage de scène. Deux segments exactement jointifs laissent donc apparaître une couture
claire, qui va et vient selon le zoom et la densité d'écran. Des pans d'un seul tenant n'ont pas de
jonction à trahir — et les bouts carrés remplissent les angles en L et en T sans un tracé de plus.

En contrepartie, l'ouverture est **élargie d'un demi-mur de chaque côté** avant d'être retranchée,
pour que le vide visible mesure exactement ce que le moteur a calculé.

---

### Les noms de pièce, posés sur leur propre sol

Le nom d'une pièce s'ancre dans son coin bas-gauche et déborde volontairement : un nom tronqué à la
case ne se lirait pas, et c'est le nom qui distingue deux pièces de teinte voisine. Il flottait donc
au-dessus de ce qui s'y trouvait, et tombait régulièrement sur un meuble — « Salon » sur un
fauteuil, « Hall » sur une table. C'était déjà vrai ; l'épaississement des murs l'a rendu voyant.

Il repose désormais sur un morceau du sol de **sa propre pièce**, par le même mécanisme `data-zone`
que les cases. La teinte compte, et pas une plaque neutre : le nom se lit alors comme du mobilier
écarté pour le laisser passer, ce que fait un plan d'architecte. Une plaque blanche se lirait comme
un objet posé sur le plan.

Mesuré plutôt que supposé, sur les six teintes : **4,80:1 au pire en thème clair, 5,11:1 en
sombre**, contre les 4,5:1 que WCAG demande d'un texte normal. C'est une amélioration et pas un
rangement — avant, un nom pouvait tomber sur de l'encre de mobilier, et le rapport n'était garanti
par rien.

---

## 5. La manuscrite, et un gras qui n'existait pas

### Le défaut, livré en production

Le `h1` d'Enquête demandait `font-weight: 700` à Patrick Hand, qui ne livre **qu'un seul fichier,
en 400**. Le navigateur comblait l'écart en fabriquant le gras.

Mesuré sur ce titre même, en comptant les pixels sombres d'un rendu sur canevas :

- **+41,5 % d'encre** pour la même fonte ;
- **à chasse rigoureusement identique** — 92,72 px dans les deux cas.

Cette seconde moitié est le piège : Chromium cerne le contour au lieu d'élargir la lettre, donc une
vérification par la largeur du texte donne un **faux négatif**. C'est ce qui est arrivé à la
première mesure de cette session.

### La règle, et pourquoi pas `font-synthesis`

`font-synthesis-weight: none` aurait corrigé le rendu de la manuscrite — mais aurait laissé la
**demande** à 700. La pile de repli, elle, a un vrai gras : le titre se serait affiché en Arial gras
puis aurait basculé en manuscrite maigre. Écrire `font-weight: 400` supprime les deux défauts d'un
coup.

Un garde dans `appStyles.test.ts` refuse désormais toute règle qui cite `--font-hand` sans écrire sa
graisse, et nomme le fichier et le sélecteur fautifs.

### L'accueil entre dans le langage illustré

Il était resté à l'ancienne interface plate : pile système, bordure d'un pixel, ombre floue — sur
le **premier** écran qu'un visiteur voit. Il prend la manuscrite sur le titre et les deux noms de
jeu, le trait d'encre de deux pixels, l'ombre dure décalée de trois, et le geste d'enfoncement au
doigt.

Le corps de texte reste en pile système. Le partage titres/corps est le point, pas la décoration
partout — c'est ce que documentent Mozilla Protocol, le design system de l'État de New York, l'USWDS
et Material 3, qui réservent tous la police d'affichage aux titres et aux noms, jamais aux libellés
de contrôle.

---

## Ce qui reste ouvert

- **Le rejet tardif de `carve` reste entier** — 91,3 % du travail est jeté, et la seule borne
  exacte disponible ne récupère que 1,17 % (mesurée, puis retirée). Le gisement demande un
  changement de conception qui changerait les affaires.
- **Patrick Hand a une hauteur d'x 10 % plus petite qu'Arial** et une chasse 19 % plus étroite
  (mesuré sur les binaires). Les noms de jeu sont à 22 px, sous le seuil de 24 px que Mozilla
  s'impose pour sa propre police d'affichage. À regarder si la lisibilité est mise en cause.
- **Le décalage de mise en page au chargement de la fonte n'a pas été mesuré.** Il est borné — la
  manuscrite ne sert qu'à des titres courts — mais la vérification à faire est : ces titres
  tiennent-ils sur une ligne dans les deux polices, à toutes les largeurs ?
