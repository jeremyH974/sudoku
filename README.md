# Sudoku — Moteur & Studio

Générateur et jeu de Sudoku **sans rien à installer** : tout tourne dans le navigateur.
Aucune publicité, aucun compte, aucun suivi, aucune requête réseau après le chargement.

> **État : incrément 5 terminé.** La partie en cours survit à la fermeture de l'onglet, et
> l'application est installable avec un service worker qui met tout en cache.
> ⚠️ Le fonctionnement hors ligne **n'a pas pu être vérifié** — voir la réserve plus bas.

## Démarrer

```bash
pnpm install
pnpm dev
```

| Commande | Rôle |
|---|---|
| `pnpm test` | Suite de tests (unitaires + property-based) |
| `pnpm typecheck` | `tsc` sur le moteur + `svelte-check` sur l'application |
| `pnpm lint` | ESLint en mode strict typé |
| `pnpm check` | Les trois ci-dessus, dans l'ordre |
| `pnpm measure` | Mesures de performance (hors CI, dépend de la machine) |
| `pnpm build` | Build de production de l'application |
| `pnpm calibrate` | Compare notre notation à celle de l'oracle (nécessite Java, hors CI) |
| `pnpm diagnose <grille>` | Chemin de résolution détaillé d'une grille |

Le studio d'impression est dans l'onglet « Imprimer » ; une grille scannée s'ouvre via une adresse
en `#g=…`.

## Le parti pris

La quasi-totalité des applications de Sudoku déduit la difficulté du **nombre d'indices**
(« Facile 36-45, Expert 22-27 »). C'est mesurablement faux : la corrélation entre le nombre
d'indices et la difficulté réellement ressentie par des joueurs humains est d'environ **0,27**,
là où une métrique simulant un raisonnement humain atteint **0,95**
([Pelánek, arXiv:1403.7373](https://arxiv.org/abs/1403.7373), 1 700+ grilles).

C'est la source directe de la plainte la plus répandue chez les joueurs — des niveaux
incohérents entre eux et entre applications.

Ici, la difficulté est **mesurée** : un solveur logique résout la grille comme le ferait un
humain, en n'appliquant que des techniques nommées, et le niveau annoncé est celui de la
technique la plus difficile réellement nécessaire. Rien n'est déduit du nombre de cases vides.

## Les niveaux

Six paliers, définis par ce qu'ils exigent — jamais par le nombre d'indices. Le barème est celui
de **Sudoku Explainer**, la référence du domaine.

| Niveau | Exige au plus | Score |
|---|---|---|
| **Facile** | Singles cachés | ≤ 1,5 |
| **Moyen** | Single nu, variantes directes | ≤ 2,3 |
| **Difficile** | Paires pointantes et revendiquées | ≤ 2,8 |
| **Expert** | Paire nue, X-Wing, paire cachée | ≤ 3,4 |
| **Maître** | Triplet nu, Swordfish, triplet caché, Skyscraper | ≤ 4,0 |
| **Diabolique** | Cerf-volant, Turbot Fish, XY-Wing, XYZ-Wing, quadruplets, Jellyfish | ≤ 5,4 |

Repère : **les sudokus de presse plafonnent presque tous à 3,0.** Notre palier « Difficile »
atteint déjà ce plafond.

Au-delà de 5,4 il faut des chaînes, absentes de ce registre. Les grilles qui les exigent sont
**rejetées à la génération**, jamais étiquetées au jugé.

## Les indices, en trois paliers

Le reproche le plus constant fait aux applications existantes est que leur indice donne la
réponse sans rien enseigner — y compris chez les concurrents payants, qui ne nomment même pas
la technique employée. Ici la révélation est graduée :

1. **la zone** — « un raisonnement s'applique par ici » ;
2. **la technique**, nommée et expliquée, avec le motif encadré sur la grille ;
3. **le coup**, en dernier recours seulement.

L'indice part de **l'état réel de la partie**, pas de la grille de départ. Si une valeur posée
est fausse — même sans conflit visible — il le dit plutôt que de conseiller dans le vide.

## La partie est sauvegardée

Fermer l'onglet et revenir plus tard ne coûte rien : grille, saisies, notes, historique
d'annulation et case sélectionnée sont conservés. La perte de progression est la huitième
douleur relevée chez les joueurs de sudoku ; elle n'a pas lieu d'être.

`localStorage` plutôt qu'IndexedDB : une partie tient dans quelques centaines d'octets, et le
stockage synchrone garantit que l'état est là **avant le premier rendu**, sans scintillement.
IndexedDB imposerait un schéma, des migrations et de l'asynchrone pour un besoin qui tient en une
ligne — il se justifiera le jour où l'on stockera une bibliothèque ou des statistiques.

Trois règles tenues : le format est **versionné** (une sauvegarde d'une autre version est ignorée,
jamais devinée), tout accès est enveloppé dans un `try` (en navigation privée, la simple lecture
lève), et une sauvegarde corrompue fait repartir sur une partie neuve plutôt que de planter.

L'écriture est **différée** de 400 ms, avec un enregistrement immédiat quand l'onglet passe en
arrière-plan : sauvegarder à chaque frappe sérialiserait la partie des dizaines de fois par minute.

## Le thème

Trois états — clair, sombre, **système** — et non deux. « Système » n'est pas un défaut qu'on
remplacerait au premier clic : c'est le choix de suivre le rythme de la machine, qui bascule
souvent au coucher du soleil. Il se traduit par l'absence d'attribut sur le document, ce qui
laisse `prefers-color-scheme` reprendre la main et suivre un basculement sans rechargement.

La préférence est appliquée par un script inline **avant le premier rendu** : sans cela, la page
s'afficherait une fraction de seconde en clair avant de basculer — un flash blanc en pleine nuit.

## Le studio d'impression

Cahiers au format standard ou relié, corrigés groupés **à la fin** sur des pages séparées :
l'enseignant imprime d'un bloc et détache les dernières pages avant de distribuer. Intercaler
les corrigés les rendrait visibles par transparence et impossibles à retirer.

Composé en HTML et CSS, imprimé par `@page` et `window.print()`. **Les bibliothèques PDF en
JavaScript ne rendent pas le CSS** : jsPDF et pdfmake demandent de reconstruire la mise en page
dans leur propre API. Pour un cahier dont l'unique critère est le rendu papier, seul le moteur du
navigateur convient. Contrepartie assumée : « Enregistrer en PDF » depuis la boîte de dialogue,
un clic de plus contre un rendu juste.

Détails qui comptent sur du papier : filets de bloc trois fois plus épais que les filets de case
(sans ce contraste l'œil ne découpe plus les blocs), marge de reliure **alternée** selon la parité
des pages (sinon une page sur deux disparaît dans la pliure), et `print-color-adjust: exact` pour
que le QR survive au mode économie d'encre.

## Le pont papier ↔ écran

C'est le moat n°2, et il est **testé comme tel** : la grille encodée dans le QR, décodée, doit
être identique à celle imprimée et recevoir le même niveau.

Chaque grille imprimée porte trois choses :

| | Contenu | Rôle |
|---|---|---|
| **QR code** | L'URL complète, grille encodée dedans (35 caractères) | Le chemin normal : on scanne, la grille s'ouvre |
| **Le code en clair** | La même chaîne, en groupes de cinq | Le recours sans téléphone — long à saisir, mais ça marche vraiment |
| **Étiquette** (`CADZH`) | Empreinte de la grille | Repérer une grille dans le sommaire et sur son corrigé |

Pourquoi pas un « code court » de huit caractères qui contiendrait la grille : **c'est
impossible**. 81 cases à dix valeurs représentent environ 269 bits, huit caractères en portent une
cinquantaine. Un tel code supposerait un serveur — que nous n'avons pas et ne voulons pas.

L'encodage porte **la grille**, pas la graine qui l'a produite : reproduire depuis une graine
dépendrait de `RATING_VERSION`, donc de la moindre évolution du moteur. Un cahier imprimé
aujourd'hui doit s'ouvrir dans dix ans.

## L'onglet Analyse

Le chemin de résolution complet, étape par étape : candidats affichés, zone concernée, motif du
raisonnement, conclusion, et le décompte des techniques employées. C'est l'instrument qui valide
le solveur, et un outil d'apprentissage à part entière.

## Architecture

```
packages/
├─ engine/       Le cœur. Zéro dépendance, zéro DOM, zéro accès au stockage.
│  ├─ rng/       PRNG seedable — tout est reproductible depuis une graine
│  ├─ grid/      Géométrie 9×9, masques de candidats, lecture/écriture
│  ├─ solver/    Solveur brut : propagation de contraintes + backtracking MRV
│  ├─ logic/     Solveur humain : 24 techniques, chemin de résolution, notation
│  └─ generate/  Creusement à unicité garantie, puis recherche dirigée par niveau
└─ app/          L'application Svelte 5
   └─ src/lib/   Logique de partie, grille accessible, panneau d'analyse, Worker
```

Le moteur ne connaît ni le DOM, ni le navigateur, ni le framework, ni le stockage. Cette pureté
est **vérifiée mécaniquement** : il compile avec `lib: ["ES2023"]` seul, donc un simple
`console.log` oublié dans `packages/engine/src` casse le typecheck.

### Décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| Ordre des techniques | Figé, **trié par difficulté croissante** | Corrigé par la calibration. La documentation communautaire décrit un ordre par familles où la paire cachée (3,4) précéderait la paire nue (3,0) ; nous l'avions suivie. La mesure l'a démentie : trier par difficulté a fait passer l'accord de 92,7 % à 97,6 % sur le corpus de rodage. |
| Propagation | Le solveur logique **ne propage rien** au-delà de la règle du jeu | Le solveur brut pose les singles en cascade pour aller vite. Réutiliser cela ici résoudrait des cases sans créditer la technique qui les justifie : note faussée, indices absurdes. |
| Génération ciblée | Recherche locale dirigée, pas rejet simple | Mesuré : le rejet trouve une grille facile en 1,4 tirage, une difficile en 63, et **jamais** d'expert en 400. La difficulté vient de la structure, pas du nombre d'indices. |
| Diversité des grilles | Solution complète tirée à chaque fois | Transformer une grille germe ne produit que des grilles **isomorphes** — une classe d'équivalence sur 5 472 730 538. |
| Web Worker | Oui, depuis l'incrément 2 | La génération d'un niveau élevé prend de 1,5 à 8 secondes. |
| Dépendances | **Zéro copyleft** | HoDoKu est en GPLv3, le portage Rust de jczsolve en AGPL, Sudoku Explainer en LGPL. Tout est réimplémenté depuis les algorithmes publiés. |
| Web Components | **Non**, composants Svelte standards | Le Shadow DOM empêche `aria-labelledby` et `<label for>` de traverser sa frontière — en conflit frontal avec l'accessibilité de la grille. |

### Performance mesurée

| Opération | p50 | p95 |
|---|---|---|
| Solution complète aléatoire | 0,5 ms | 0,6 ms |
| Creusement avec vérification d'unicité | 16,3 ms | 17,8 ms |
| Notation logique d'une grille | 0,4 à 1,6 ms | — |
| Unicité sur « Platinum Blonde » (843 hypothèses) | 13,2 ms | 14,0 ms |

Génération à niveau ciblé, taux de réussite sur 12 tentatives, temps médian :

| Niveau | Réussite | Temps médian |
|---|---|---|
| Facile | 12/12 | 0,03 s |
| Moyen | 12/12 | 0,11 s |
| Difficile | 12/12 | 0,99 s |
| Expert | 11/12 | 2,49 s |
| Maître | 12/12 | 0,39 s |
| Diabolique | 12/12 | 0,48 s |

**Maître et Diabolique sont devenus les paliers les plus rapides à produire** — ils l'étaient
auparavant le moins (4/5 en 4,8 s et 2/5 en 8,1 s). La raison n'est pas une optimisation mais un
comblement : la bande 4,0 à 4,4 était vide, et la recherche devait forcer des chemins tordus pour
y atteindre un score élevé. Cinq techniques plus tard, elle y trouve des grilles franches.

Le même ajout a révélé un défaut ancien, invisible tant que l'échelle était trouée : **la marche
locale ne connaissait pas son plafond**. Elle montait jusqu'à dépasser le plancher demandé, sans
regarder au-dessus — et un seul échange pouvait la faire passer de 2,3 à 4,4, ruinant la
tentative. Mesuré : à « Difficile » et « Expert », les échecs ne manquaient jamais le palier par
en dessous, ils le dépassaient. Une fois le plafond transmis à la marche, Difficile est passé de
10/12 à 12/12 et Expert de 9/12 à 11/12.

Quand le niveau n'est pas atteint, l'application le **dit** et propose la grille la plus proche,
plutôt que de mal l'étiqueter.

## La calibration

La notation ne se contente pas de reproduire un barème documenté : elle est **comparée à
l'oracle**. `pnpm calibrate` génère un corpus, le fait noter par Sudoku Explainer, et compare.

Le critère n'est pas une corrélation mais une **égalité exacte**. L'oracle possède bien plus de
techniques que nous, mais il les essaie dans un ordre où les nôtres viennent en premier : pour
une grille que notre registre résout, il devrait rendre le même nombre, pas un nombre proche.

Résultat sur 329 grilles, après l'ajout des liens forts et des wings :

| Mesure | Valeur | Avant l'incrément 6 |
|---|---|---|
| Accord exact, toutes grilles | 306/329 — **93,0 %** | 90,9 % |
| Accord exact, score ≤ 4,0 | 291/312 — **93,3 %** | 91,4 % |
| Grilles refusées à tort | **1**, notée 4,5 — un Unique Rectangle, hors registre | 4 |
| Surévaluations | **1 sur 329**, de 0,2 point | — |
| Même palier public annoncé que l'oracle | 319/329 — **97,0 %** | — |

Le corpus ciblé change avec la notation, si bien que deux campagnes ne portent pas exactement sur
les mêmes grilles. Comparaison faite **grille par grille sur les 291 communes** aux deux, pour
que le progrès ne soit pas un effet d'échantillon : 4 corrigées, **0 régression**.

Ce que la calibration a corrigé, et qu'aucun autre test ne pouvait révéler :

- **L'ordre des techniques était faux.** Voir le tableau ci-dessus.
- **Le garde-fou de pureté du moteur était cassé** depuis l'installation de `@types/node`, qui
  rendait `console` et `node:fs` utilisables dans `packages/engine`. Réparé par `types: []`.
- **Cinq techniques manquaient**, et l'oracle a dit lesquelles plutôt que de nous laisser
  deviner. Deux grilles refusées portaient un score de 4,0 — la valeur du triplet caché, que
  nous implémentions déjà : soit il nous manquait une technique de même valeur, soit notre
  détection était en défaut, et les deux corrections sont opposées. Interroger l'oracle avec son
  format `%R` a tranché en une exécution : `Skyscraper`. Aucun bug, une technique absente.

Trois hypothèses ont été testées puis **rejetées par la mesure**, ce qui vaut d'être noté :
restreindre les variantes « Direct » à leur propre unité (89,3 %), les supprimer (79,5 %), et
énumérer tous les singles au lieu du premier (89,9 %). La dernière est pourtant plus rigoureuse
en théorie — l'oracle s'arrête donc lui aussi au premier candidat.

Les quatre grilles alors refusées sont devenues des **cas de test nommés** : chacune doit être
résolue au score exact de l'oracle **et sous le même nom de technique**. Un score juste par un
chemin faux serait une coïncidence, pas une preuve.

Sept divergences de l'incrément 3 dépassaient 3,4. Elles n'ont **pas** été corrigées, et c'était
prévisible : renotées à l'identique, 0 sur 7. Elles n'emploient que des techniques que nous
avions déjà — elles viennent de chemins qui bifurquent, pas d'une lacune du registre. C'est un
problème distinct, et le dire vaut mieux que de laisser croire que l'ajout l'a réglé.

**La conformité est tenue par un test**, pas par ce rapport : `corpus/oracle-reference.json`
fige les verdicts de l'oracle grille par grille, et la CI rejoue la comparaison **sans Java**.
Un changement d'ordre ou de détection fait chuter le taux et casse la suite.

## Ce qui est garanti, et testé

- **Toute grille générée admet exactement une solution.**
- **Toute déduction produite est logiquement valide** — aucune technique n'écarte jamais un
  candidat appartenant à la solution. Vérifié en énumérant *tous* les motifs de *chaque*
  technique sur un corpus de grilles réelles, pas seulement ceux que le registre retient.
- **Aucune grille n'est résolue en devinant** : si le raisonnement ne suffit pas, le solveur
  s'arrête au lieu d'appeler le solveur brut.
- **Toute grille est reproductible** depuis sa graine.
- **Aucune limite d'erreurs**, annulation illimitée qui restaure aussi les notes.
- **La couleur n'est jamais le seul porteur d'information.**

## Hors ligne : vérifié

L'application démarre et se joue **sans réseau**. Ce n'est plus une intention : la vérification a
été faite dans un vrai Chrome, sur un build de production servi par `vite preview`, en coupant le
serveur avant de recharger. Relevé depuis la page elle-même, serveur arrêté :

| Contrôle | Relevé |
|---|---|
| Requête réseau depuis la page | `TypeError: Failed to fetch` — le serveur est bien coupé |
| Service worker | `activated`, portée `/`, script `/sw.js` |
| Page servie par le service worker | oui (`navigator.serviceWorker.controller`) |
| Entrées en cache | 10 |
| Grille rendue | 81 cases |

Le précache couvre l'intégralité de l'application : le HTML, la feuille de style, le bundle, le
Worker du moteur, le manifeste et les quatre icônes. À ce format — une cinquantaine de kilo-octets
compressés, moteur compris — il n'y a rien à arbitrer entre ce qu'on met en cache et ce qu'on
laisse au réseau : il n'y a aucun réseau à solliciter une fois la page chargée. La mise à jour
passe par une bannière plutôt que par un rechargement forcé, car recharger la page sous les doigts
de quelqu'un en train de résoudre une grille est brutal.

### Ce qui avait bloqué la vérification pendant deux incréments

`navigator.serviceWorker.register()` échouait dans le navigateur automatisé du poste de
développement avec un laconique « unknown error when fetching the script » — alors que le fichier
était servi en `200`, avec le bon type MIME, sans dépendance externe.

Le diagnostic tenait en une expérience : enregistrer un service worker **de 44 octets**, sans
logique ni import, servi par le même serveur. Il échoue exactement de la même manière, tandis que
la page récupère ce même fichier par `fetch()` sans difficulté. L'enregistrement est donc bloqué
par l'environnement, quel que soit le script — ce n'était ni notre code, ni notre build, ni notre
serveur. Reproduire le test dans un navigateur ordinaire l'a confirmé du premier coup.

À retenir : un contre-exemple minimal tranche là où l'acharnement sur le vrai fichier ne mène
nulle part.

Deux détails appris en chemin, consignés dans `vite.config.ts` : le service worker de
développement est **désactivé**, car il survit à l'arrêt du serveur et sert ensuite un cache
périmé sans rien indiquer ; et le runtime Workbox est **intégré** au service worker plutôt que
chargé à part, pour réduire le nombre de pièces mobiles au démarrage.

Pour refaire la vérification :

```bash
pnpm build && pnpm --filter @sudoku/app exec vite preview
```

## Suite

Ce qui reste ouvert, par ordre de valeur :

- **Les chemins qui bifurquent.** Le registre ne manque plus de technique sous 4,5, mais notre
  chemin de résolution et celui de l'oracle divergent parfois dès les premières étapes, et le
  score pic s'en ressent. Les divergences restantes se concentrent sur les variantes « Direct » :
  17 des 23 écarts viennent de là, et toujours dans le même sens — nous notons trop bas.
- **Unique Rectangle** (4,5 et au-delà) : la seule grille encore refusée à tort en réclame une.
  Famille distincte, fondée sur l'unicité de la solution plutôt que sur l'élimination directe.
- **Progression, défi quotidien, statistiques**, dont la sauvegarde est déjà le socle.
- **Finition mobile** : saisie des candidats, réglage « gros caractères ».

Écarté sur preuve, pas par oubli : **W-Wing** n'apparaît nulle part dans l'oracle. L'implémenter
nous ferait diverger sans aucune référence à laquelle nous comparer.

Le plan complet est dans `docs/plan.md`.
