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

## Apprendre technique par technique

Les indices savaient déjà **nommer** une technique et expliquer la déduction. Ils ne savaient pas
l'**enseigner** : rien ne permettait de produire une grille qui exige une technique précise et rien
de plus difficile.

L'onglet **Apprendre** couvre les vingt-quatre techniques du registre, en quatre chapitres coupés
là où le genre de raisonnement change — voir à l'œil, écarter au lieu de poser, réserver des cases
ou des chiffres, raisonner à distance. Chaque technique se lit, puis se pratique.

### L'exercice commence au moment intéressant

Le défaut des tutoriels existants est de faire poser quarante singles avant de rencontrer le motif
annoncé. Ici, l'exercice **reprend la grille à l'instant précis où la technique devient
nécessaire** : les cases déjà déduites sont posées, les candidats sont écrits, et il ne reste que
le raisonnement à trouver.

Le mécanisme naïf — figer les valeurs de cette position en une nouvelle grille — ne marche pas, et
la mesure a été nette : **sur treize techniques, il ne tient que quatre fois**. Une position en
cours de résolution porte des candidats déjà écartés par les étapes précédentes, et ce sont
précisément ces éliminations qui rendent la technique nécessaire. Les redériver depuis les valeurs
les fait réapparaître, et une technique plus simple redevient applicable : l'amorce « X-Wing »
s'ouvrait alors sur une paire pointante. La position transporte donc ses candidats — et c'est
aussi ce qui empêche l'indice de contredire la leçon sur l'écran même qui prétend l'enseigner.

### Ce que la génération par technique a demandé

Les paliers ne suffisent pas : ce sont des bandes de scores, et une bande contient plusieurs
techniques. Sur vingt-quatre tirages ciblés par palier, le X-Wing sortait dix fois en Expert,
mais le Swordfish, le triplet caché, le XYZ-Wing et le Jellyfish **jamais**.

Deux mesures ont façonné la solution, toutes deux contre-intuitives :

- **un plafond serré vaut mieux qu'une marche libre.** À plafond ouvert, le triplet nu, le
  Swordfish et le Jellyfish échouent tous les trois en 45 s ; à leur propre difficulté, ils
  sortent en 3,7 s, 6,9 s et 39 s. Le plafond ne fait pas que filtrer la sortie : il **retient**
  la marche dans la région utile au lieu de la laisser fuir vers 4,2, où les wings abondent ;
- **récolter au vol** tout candidat qui convient déjà, au lieu de ne juger que le point d'arrivée
  de la marche, transforme un échec en 45 s en une réussite en 3,5 s.

Deux sondes préparatoires avaient conclu que le **quadruplet nu était structurellement hors
d'atteinte** — zéro occurrence sur près de 22 000 échanges. La génération complète en produit
**trois en 55 secondes**. La différence tient à trois choses : plusieurs graines, l'abandon de la
symétrie (décorative, mais très contraignante), et la récolte au vol. Les vingt-quatre techniques
ont donc un exercice, et ce nombre est une **mesure**, pas une intention : un test le vérifie et
tomberait si une évolution du registre en rendait une inatteignable.

### Le corpus, et ce qu'il ne porte pas

72 grilles, **2,1 Ko compressés**, figées et versionnées pour les deux raisons déjà connues du
défi quotidien : la génération dépend du barème *et* de la vitesse de la machine. Il ne porte que
**la grille** — ni le score, ni le niveau, ni l'index de l'étape. Ce dernier point est le plus
important : figer « la technique est à l'étape 41 » paraît économique, mais un changement de
barème ferait pointer cet index sur autre chose, en silence. En cherchant la première étape qui
emploie la technique, on obtient soit une vraie occurrence, soit rien — et « rien » se dit.

`pnpm lessons` régénère le corpus en cinq minutes.

### Une progression qui ne compte que ce qu'elle observe

Par technique : le nombre d'exercices terminés, et combien l'ont été sans indice. Rien d'autre.

- **aucun pourcentage de maîtrise** : il faudrait un dénominateur — les exercices *tentés* — que
  rien n'observe, puisqu'il n'y a pas de bouton « j'abandonne ». C'est la raison qui avait déjà
  fait écarter le taux de réussite ;
- **aucune médiane par technique** : cinq échantillons d'une tâche de trente secondes ne portent
  rien, et surtout les exercices d'une même technique **partent de positions différentes**. Leurs
  durées ne sont pas comparables entre elles, même en principe ;
- **aucune barre « 21 sur 24 »** : elle compterait comme des échecs des techniques que le joueur
  ne peut pas pratiquer.

Et les exercices sont **exclus** des statistiques par niveau. Un exercice de quarante secondes
dans la même médiane qu'une Diabolique de quarante minutes produirait un chiffre qui a l'air
mesuré et ne l'est pas.

## La progression, et le défi quotidien

Six grilles par jour, **une par niveau**. L'argument du « tout le monde résout la même grille »
vaut chez les concurrents parce qu'ils ont un classement en ligne ; nous n'en avons pas et n'en
voulons pas. Sans classement, une grille unique exclurait simplement le débutant le vendredi et
ennuierait l'expert le lundi.

**Le défi du jour fonctionne hors ligne** — ce que presque aucun concurrent ne sait faire, parce
que chez eux il vient d'un serveur.

### Pourquoi le quotidien est un fichier, et non un calcul

Le réflexe est de dériver la grille du jour d'une graine-date. La signature l'accepte déjà. C'est
un piège, et il se referme deux fois :

- **la génération dépend de la notation.** `climb()` appelle `rate()` à chaque échange et branche
  sur le score. `RATING_VERSION` est passé de 2 à 4 en deux incréments — le calendrier d'un joueur
  aurait continué d'afficher ses jours résolus, mais pour d'autres grilles ;
- **la génération dépend du temps réel.** Elle s'arrête sur un budget en millisecondes, donc sur
  la vitesse de la machine. Un vieux téléphone n'aurait jamais eu le même défi qu'un portable
  récent.

Le corpus est donc produit une fois par `pnpm dailies`, vérifié grille par grille, et versionné.
Le même raisonnement que pour le code imprimé : ce qui doit être identique pour tout le monde et
pour toujours porte **la grille**, jamais la graine.

274 jours, 1 644 grilles, **43 Ko compressés** — soit le poids de l'application elle-même, la
borne qu'on s'était fixée avant de mesurer. Un test échoue quand il reste moins de soixante jours
de corpus : l'échéance se signale avant la panne, pas après.

### La série a un filet

Les défis passés restent jouables indéfiniment, et la série compte les **jours résolus**, peu
importe quand ils l'ont été — rattraper dimanche les cinq jours de la semaine reconstitue la
série. Une série qui punit un jour manqué est exactement le levier de pression que ce projet
reproche au marché, au même titre que la limite de trois erreurs.

Un jour compte dès qu'**une** de ses six grilles est résolue : rien ne justifie qu'un débutant
régulier soit moins bien traité qu'un expert intermittent.

### Des statistiques qui ne mentent pas

La règle « ne jamais afficher une difficulté qui n'est pas mesurée » a un pendant chiffré :
**un indicateur que l'échantillon ne porte pas ne reçoit aucune valeur.**

| | |
|---|---|
| Un record | dit dès la première partie — un record sur un échantillon de un reste un record |
| Une médiane | cinq parties du même niveau minimum, et l'effectif est affiché à côté. En deçà : « encore 3 parties », plutôt qu'un chiffre présenté comme un fait |
| Médiane, pas moyenne | la distribution des durées a une longue queue ; une partie interrompue déplacerait une moyenne de plusieurs minutes |
| Jamais tous niveaux confondus | une durée agrégée ne mesure pas l'habileté du joueur, mais ce qu'il a choisi de jouer |
| Aucun taux de réussite | il n'y a pas de bouton « abandonner » : le dénominateur n'est pas définissable |

Le chronomètre se met en pause dès que l'onglet cesse d'être regardé — trois événements et non un
seul, car sur iOS `visibilitychange` n'est fiable ni au verrouillage ni au balayage vers
l'accueil. Et lorsqu'il ne peut pas savoir — l'onglet resté visible pendant un déjeuner — la
partie est enregistrée **sans durée** plutôt qu'avec une durée fausse.

## Le thème

Trois états — clair, sombre, **système** — et non deux. « Système » n'est pas un défaut qu'on
remplacerait au premier clic : c'est le choix de suivre le rythme de la machine, qui bascule
souvent au coucher du soleil. Il se traduit par l'absence d'attribut sur le document, ce qui
laisse `prefers-color-scheme` reprendre la main et suivre un basculement sans rechargement.

La préférence est appliquée par un script inline **avant le premier rendu** : sans cela, la page
s'afficherait une fraction de seconde en clair avant de basculer — un flash blanc en pleine nuit.

## Sur un téléphone, et pour qui en a besoin

L'incrément 8 a commencé par un audit, et l'audit a trouvé pire que ce qui était consigné.

| Constat, mesuré sur 375 × 667 | Après |
|---|---|
| La grille débordait horizontalement de 2 px sous 400 px — elle se mesurait contre la **fenêtre**, alors que sa boîte est la fenêtre moins le remplissage de page | Elle se mesure contre son conteneur. C'est la classe de défaut qui disparaît, pas l'occurrence |
| Le pavé de saisie était **entièrement sous la ligne de flottaison** : bord haut à 590 px pour 553 px visibles | Il quitte le flux et se pose sous le pouce, en cinq colonnes sur deux rangées |
| Le réglage « gros caractères » n'avait **aucun effet** sur la grille : plateau et chiffres étaient verrouillés à la fenêtre entre 338 et 585 px | Chiffres de 21,0 à 26,6 px sur le même téléphone |
| Des cibles tactiles à 36 px, sous un commentaire affirmant tenir les 44 | 44 px partout, mesuré bouton par bouton |

### Le pavé quitte le flux, et pourquoi c'était inévitable

L'arithmétique commande : en-tête, onglets, grille et ligne d'état consomment 543 px pour 553 px
visibles. **Aucune disposition** ne fait tenir en plus un pavé de saisie, et rétrécir la grille
donnerait des cases de 17 px. La barre se détache donc sur un critère de **hauteur** et non de
largeur — une tablette de 768 × 1024 a de la place et garde la disposition empilée, un téléphone
en paysage n'en a pas.

Ce qui reste, dit franchement : avec cinq onglets sur deux rangées et le bandeau des marques
ouvert, la grille commence à 218 px et il en reste 440 au-dessus de la barre. Une ou deux rangées
se font donc défiler. C'est le prix d'une grille carrée de 343 px sur un écran de 667, tenu sans
rogner une seule cible tactile.

### Deux leviers pour la taille du texte

Le réglage a trois paliers nommés, et agit sur deux choses à la fois, parce qu'un seul levier ne
suffisait pas : `html { font-size }` fait grandir tout ce qui est en `rem` — **y compris la
grille** là où l'écran le permet — et `--text-scale` fait grandir les chiffres **à l'intérieur**
d'une grille dont la largeur est déjà bornée par le téléphone. C'est le second qui sert au public
senior, et c'est exactement celui qui manquait.

Aucune unité de fenêtre ne subsiste dans les styles de l'application. **Un test le vérifie** :
c'est ce qui avait laissé l'ancrage `rem` pourrir sans que rien ne le signale.

### Colorier un candidat, pas une case

Réclamée depuis des années, absente presque partout. Trois marques, nommées **A**, **B** et **C** —
jamais par leur couleur. Chacune porte en plus un tracé distinct et **son nom dans le libellé lu à
voix haute** : « notes 5 7, 5 marqué A, 7 marqué C ». C'est le seul porteur qui ne se dégrade ni à
huit pixels, ni en noir et blanc, ni pour un daltonien.

À 375 px, un candidat occupe 12 px : **une cible de 44 px ne peut pas exister dans la grille.**
Rien ne demande donc d'en viser une — on touche la case, puis la touche de marque (109 × 46 px),
puis le chiffre. Le bandeau des marques n'apparaît qu'en mode notes, ce qui rend le lien visible
au lieu de l'expliquer.

Le modèle de données n'est pas celui auquel on pense : empiler les marques dans le tableau des
notes le porterait à 36 bits, au-delà d'un entier 32 — et ce tableau **est** le masque de
candidats transmis au moteur. Un second tableau de 81 nombres, deux bits par chiffre, garde le
premier intact et reste **additif** en sauvegarde : personne ne perd sa partie en cours à la mise
à jour. Un test relit une sauvegarde écrite avant l'existence des marques.

### Ce que les tests d'accessibilité vérifient, et ce qu'ils ne vérifient pas

`axe-core` tourne sur les cinq onglets à chaque `pnpm test` : rôles, noms accessibles, ordre des
titres, repères, validité ARIA. Il a déjà trouvé un enchaînement de titres rompu depuis
l'incrément 2, et un second `h1` sur la feuille imprimée.

**Il ne voit ni le contraste ni la taille des cibles** — aucun DOM simulé ne calcule de mise en
page. Ces deux règles restent vérifiées à la main, exactement comme l'impression : « manuel et
assumé ». Une exécution verte ne vaut pas mesure, et le code le dit à l'endroit où on pourrait
l'oublier.

Les avertissements d'accessibilité du compilateur Svelte sont désormais **bloquants**. Ils étaient
au nombre de zéro : c'est un cliquet gratuit, pas un chantier.

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
│  └─ generate/  Creusement à unicité garantie, puis recherche dirigée — par
│                niveau, ou par **technique** visée
├─ cli/          Outillage hors production : oracle, corpus quotidien, corpus des leçons
└─ app/          L'application Svelte 5
   ├─ src/lib/   Logique de partie, grille accessible, panneau d'analyse, Worker
   │             day · dates civiles pures    stopwatch · chronomètre honnête
   │             stats · historique persisté  progress · agrégats purs
   │             daily · corpus des défis      learn · corpus des leçons + amorce
   │             lessons · le texte des 24 leçons
   │             marks · marques de candidats  textSize · taille du texte
   ├─ src/test/  Montage de composants et exécution d'axe, pour les tests de DOM
   ├─ public/daily/corpus.json   274 jours de défis, figés et précachés
   └─ public/learn/corpus.json   72 grilles d'exercice, une par technique
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
| Génération par technique | Bande resserrée autour de la difficulté visée, **récolte au vol** | Mesuré : à plafond ouvert, triplet nu, Swordfish et Jellyfish échouent en 45 s ; à plafond serré ils sortent en 3,7 s, 6,9 s et 39 s. Le plafond retient la marche dans la région utile. |
| Position d'exercice | Valeurs **et** candidats, jamais les valeurs seules | Mesuré sur 13 techniques : figer les valeurs ne préserve l'étape attendue que 4 fois. Les éliminations déjà acquises sont ce qui rend la technique nécessaire. |
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

L'incrément 8 a corrigé un second défaut de la même marche : **le point de départ devenait la
référence même quand il était inutilisable.** Une grille creusée qui se bloque porte quand même un
score — celui de l'étape la plus dure atteinte avant le blocage, souvent élevé — et 13 % des
creusements sortent ainsi. La promotion exigeant un score strictement supérieur, une grille résolue
à 3,2 ne pouvait jamais déloger un départ bloqué à 4,0 : la marche brûlait ses quatre cents
échanges et le budget de temps partagé, donc aussi les tentatives suivantes. Mesuré sur les mêmes
graines à « Expert » : **52,9 s → 44,7 s**, à taux de réussite égal.

Production d'un corpus complet de leçons — 24 techniques, 3 grilles chacune : **5 minutes**. Le
Swordfish demande 44 s, le Jellyfish jusqu'à deux minutes ; tout le reste sort en quelques
secondes.

## La calibration

La notation ne se contente pas de reproduire un barème documenté : elle est **comparée à
l'oracle**. `pnpm calibrate` génère un corpus, le fait noter par Sudoku Explainer, et compare.

Le critère n'est pas une corrélation mais une **égalité exacte**. L'oracle possède bien plus de
techniques que nous, mais il les essaie dans un ordre où les nôtres viennent en premier : pour
une grille que notre registre résout, il devrait rendre le même nombre, pas un nombre proche.

Progression du taux d'accord exact sous 4,0, d'un incrément à l'autre :

| | Accord ≤ 4,0 | Ce qui l'a fait bouger |
|---|---|---|
| Incrément 3 | 91,4 % | Calibration initiale, ordre des techniques corrigé |
| Incrément 6 | 93,3 % | Liens forts et wings (4,0 à 4,4) |
| **Incrément 7** | **94,6 %** | Variantes « Direct » restreintes au single caché |

État courant, sur 329 grilles :

| Mesure | Valeur |
|---|---|
| Accord exact, toutes grilles | 309/329 — **93,9 %** |
| Accord exact, score ≤ 4,0 | 296/313 — **94,6 %** |
| Grilles refusées à tort | **1**, notée 4,5 — un Unique Rectangle, hors registre |
| Surévaluations | **1 sur 329**, de 0,2 point |

Le corpus ciblé change avec la notation, si bien que deux campagnes ne portent pas exactement sur
les mêmes grilles. Comparaison faite **grille par grille sur les 291 communes** aux deux, pour
que le progrès ne soit pas un effet d'échantillon : 4 corrigées, **0 régression**.

Ce que la calibration a corrigé, et qu'aucun autre test ne pouvait révéler :

- **L'ordre des techniques était faux.** Voir le tableau ci-dessus.
- **Le garde-fou de pureté du moteur était cassé** depuis l'installation de `@types/node`, qui
  rendait `console` et `node:fs` utilisables dans `packages/engine`. Réparé par `types: []`.
- **Les variantes « Direct » sur-détectaient**, et il aura fallu quatre hypothèses pour le voir.
  L'incrément 3 en avait mesuré trois, toutes perdantes : les restreindre à leur propre unité
  (92,9 %), les supprimer (84,3 %), énumérer tous les singles (92,6 %). La quatrième est la
  bonne : **ne reconnaître que le single caché, jamais le single nu** — 93,3 % → 95,2 % à corpus
  identique, 6 grilles corrigées, aucune régression. Elle colle au nom même des producteurs de
  l'oracle, `DirectHiddenSet` et `DirectIntersection` : ce qu'il appelle « direct » est une
  élimination qui rend un chiffre seul possible dans une **maison**, pas une case qui se retrouve
  avec un seul candidat.
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
- **Aucune limite d'erreurs**, annulation illimitée qui restaure aussi les notes.
- **La couleur n'est jamais le seul porteur d'information.**
- **Chaque grille du corpus quotidien est renotée à chaque exécution des tests** : 1 644 grilles
  décodées, résolues et comparées au niveau annoncé. Un futur changement de barème fera échouer ce
  test — on rafraîchit alors les étiquettes, jamais les grilles.
- **Une partie terminée n'est enregistrée qu'une fois.** `isComplete` est un dérivé : annuler la
  dernière case le fait osciller, et un enregistrement branché dessus écrirait trois parties là où
  il y en a une. Un verrou fixe le moment de l'écriture, et un test l'exige.
- **Une durée non mesurable vaut `null`**, jamais une approximation.
- **Chaque grille du corpus des leçons est renotée à chaque exécution des tests** : décodée,
  vérifiée unique, et sa technique la plus difficile comparée à la leçon qu'elle illustre.
- **Aucune unité de fenêtre dans les styles de l'application** — c'est ce qui rendait le réglage
  de taille du texte inopérant là où il sert le plus.
- **Une position n'a pas de niveau, et n'en reçoit aucun.** Un exercice affiche la technique qu'il
  enseigne, jamais la difficulté de la grille dont il est extrait.
- **La structure d'accessibilité est vérifiée par axe sur les cinq onglets** — mais ni le
  contraste ni la taille des cibles, qui restent mesurés à la main.

> **Attention à la reproductibilité par graine.** Le PRNG est figé par des snapshots, mais cela ne
> suffit pas : `generateAtLevel` dépend de `RATING_VERSION` *et* du temps réel écoulé sur la
> machine. Deux joueurs, même graine, même version : deux grilles différentes. Tout ce qui doit
> être identique pour tout le monde et pour toujours porte donc **la grille**, jamais la graine —
> le code imprimé, et le corpus quotidien.

## Hors ligne : vérifié

L'application démarre et se joue **sans réseau**. Ce n'est plus une intention : la vérification a
été faite dans un vrai Chrome, sur un build de production servi par `vite preview`, en coupant le
serveur avant de recharger. Relevé depuis la page elle-même, serveur arrêté :

| Contrôle | Relevé |
|---|---|
| Requête réseau depuis la page | `TypeError: Failed to fetch` — le serveur est bien coupé |
| Service worker | `activated`, portée `/`, script `/sw.js` |
| Page servie par le service worker | oui (`navigator.serviceWorker.controller`) |
| Entrées en cache | 12, dont les deux corpus — défis quotidiens **et** leçons |
| Défi du jour ouvert hors ligne | 274 jours lus depuis le cache, grille rendue, niveau mesuré |
| Onglet Apprendre hors ligne | 24 techniques listées, exercice Swordfish ouvert |
| Grille rendue | 81 cases, 53 portant des candidats |

Le précache couvre l'intégralité de l'application : le HTML, la feuille de style, le bundle, le
Worker du moteur, le manifeste, les quatre icônes — **et les deux corpus**, 274 jours de défis et
72 grilles d'exercice. À ce format — une cinquantaine de kilo-octets
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
  score pic s'en ressent. C'est désormais la source dominante des écarts restants.
- **Unique Rectangle** (4,5 et au-delà) : la seule grille encore refusée à tort en réclame une.
  Famille distincte, fondée sur l'unicité de la solution plutôt que sur l'élimination directe.
- **Le rating Glicko2** : point de couture, pas fonctionnalité. Chaque partie enregistrée porte
  déjà niveau, score, durée, indices, technique enseignée et version du barème.
- **Le paysage sur téléphone** : la grille à gauche, le pavé à droite. C'est une troisième
  disposition ; la barre basse s'y dégrade en « il faut un peu défiler », pas en « cassé ».
- **L'annulation multi-cases** : poser une valeur efface des notes chez jusqu'à vingt voisines
  sans les enregistrer, donc annuler ne les restaure pas. Le corriger change la forme d'un coup
  sauvegardé — le seul changement qui imposerait vraiment une montée de version de sauvegarde.
  À faire seul, délibérément.
- **La validation au lecteur d'écran de `role="grid"`**, que `CLAUDE.md` exige avant de le
  considérer comme acquis. axe ne peut pas la fournir, et une CI verte ne doit pas être prise
  pour elle.

Écarté sur preuve, pas par oubli : **W-Wing** n'apparaît nulle part dans l'oracle. L'implémenter
nous ferait diverger sans aucune référence à laquelle comparer.

Le plan complet est dans `docs/plan.md`.
