# Sudoku — Moteur & Studio

Générateur et jeu de Sudoku **sans rien à installer** : tout tourne dans le navigateur.
Aucune publicité, aucun compte, aucun suivi, aucune requête réseau après le chargement.

> **État : incrément 3 terminé.** La notation est désormais **calibrée contre Sudoku
> Explainer**, la référence du domaine : 91,4 % d'accord exact sur le domaine où il est
> exigible, et un test de non-régression qui tient ce résultat sans dépendre de Java.

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
| **Maître** | Triplet nu, Swordfish, triplet caché | ≤ 4,0 |
| **Diabolique** | Quadruplets, Jellyfish | ≤ 5,4 |

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

## Le thème

Trois états — clair, sombre, **système** — et non deux. « Système » n'est pas un défaut qu'on
remplacerait au premier clic : c'est le choix de suivre le rythme de la machine, qui bascule
souvent au coucher du soleil. Il se traduit par l'absence d'attribut sur le document, ce qui
laisse `prefers-color-scheme` reprendre la main et suivre un basculement sans rechargement.

La préférence est appliquée par un script inline **avant le premier rendu** : sans cela, la page
s'afficherait une fraction de seconde en clair avant de basculer — un flash blanc en pleine nuit.

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
│  ├─ logic/     Solveur humain : 19 techniques, chemin de résolution, notation
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

Génération à niveau ciblé, taux de réussite sur 5 tentatives :

| Niveau | Réussite | Temps moyen |
|---|---|---|
| Facile | 5/5 | 0,02 s |
| Moyen | 5/5 | 0,09 s |
| Difficile | 5/5 | 0,70 s |
| Expert | 5/5 | 1,47 s |
| Maître | 4/5 | 4,78 s |
| Diabolique | 2/5 | 8,05 s |

Diabolique reste aux limites du registre : quand le niveau n'est pas atteint, l'application le
**dit** et propose la grille la plus proche, plutôt que de mal l'étiqueter.

## La calibration

La notation ne se contente pas de reproduire un barème documenté : elle est **comparée à
l'oracle**. `pnpm calibrate` génère un corpus, le fait noter par Sudoku Explainer, et compare.

Le critère n'est pas une corrélation mais une **égalité exacte**. L'oracle possède bien plus de
techniques que nous, mais il les essaie dans un ordre où les nôtres viennent en premier : pour
une grille que notre registre résout, il devrait rendre le même nombre, pas un nombre proche.

Résultat sur 317 grilles :

| Mesure | Valeur |
|---|---|
| Accord exact, toutes grilles | 288/317 — **90,9 %** |
| Accord exact, score ≤ 4,0 | 288/315 — **91,4 %** |
| Grilles refusées à tort | 4 (notées 4,0 à 4,4 par l'oracle) |

Ce que la calibration a corrigé, et qu'aucun autre test ne pouvait révéler :

- **L'ordre des techniques était faux.** Voir le tableau ci-dessus.
- **Le garde-fou de pureté du moteur était cassé** depuis l'installation de `@types/node`, qui
  rendait `console` et `node:fs` utilisables dans `packages/engine`. Réparé par `types: []`.

Trois hypothèses ont été testées puis **rejetées par la mesure**, ce qui vaut d'être noté :
restreindre les variantes « Direct » à leur propre unité (89,3 %), les supprimer (79,5 %), et
énumérer tous les singles au lieu du premier (89,9 %). La dernière est pourtant plus rigoureuse
en théorie — l'oracle s'arrête donc lui aussi au premier candidat.

Les 4 grilles refusées à tort sont notées 4,0 à 4,4 : elles exigent XY-Wing, XYZ-Wing ou Turbot
Fish, absentes de notre registre. C'est exactement la zone prédite, et la piste de l'incrément
suivant.

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

## Suite

Les 4 grilles refusées à tort désignent la prochaine étape : ajouter XY-Wing (4,2), XYZ-Wing
(4,4), Skyscraper et Turbot Fish. Elles sont purement additives — le registre est fait pour
ça — et devraient à la fois combler ces refus et resserrer l'accord au-dessus de 4,0.

Le plan complet est dans `docs/plan.md`.
