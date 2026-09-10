# Incrément 2 — Solveur logique, niveaux honnêtes, indices pédagogiques

> Le plan stratégique complet (recherche concurrentielle, douleurs du marché, moats, feuille de
> route) est dans `docs/plan.md`. Ce fichier ne couvre que l'incrément en cours.

---

## Context

L'incrément 1 est livré et commité (`3b2c452`) : le moteur génère des grilles à solution unique
garantie, l'interface est jouable, 97 tests passent. Mais l'application **n'affiche aucun niveau
de difficulté** — délibérément, parce que le seul critère disponible (le nombre d'indices) ne
prédit quasiment pas la difficulté réelle (corrélation ≈ 0,27, Pelánek).

C'est la promesse centrale du projet, et elle est aujourd'hui tenue par une abstention. Cet
incrément la tient pour de bon : mesurer la difficulté par les **techniques de raisonnement
réellement nécessaires**, générer des grilles à niveau ciblé, et s'en servir pour expliquer au
joueur *pourquoi* un coup est possible — le seul acteur du marché à le faire vraiment étant
sudoku.coach.

### Arbitrages validés

| Question | Décision |
|---|---|
| Périmètre | Solveur logique **+ niveaux + indices pédagogiques** dans le jeu |
| Banc d'analyse | **Visible dans l'application** (onglet Analyse), pas un outil de dev caché |
| Variantes « Direct » de SE | **Implémentées dès maintenant**, pour coller au barème de référence |
| Nommage des niveaux | S'appuyer sur les **niveaux conventionnels** du marché et de la presse |

---

## Ce que la recherche a établi (sources primaires)

Barème vérifié dans le code Java de [SukakuExplainer](https://github.com/SudokuMonster/SukakuExplainer)
(méthodes `getDifficulty()`) **et** recoupé avec son [wiki v1.2.1](https://github.com/SudokuMonster/SukakuExplainer/wiki/Difficulty-ratings-in-Sudoku-Explainer-v1.2.1).

| Technique | SE | | Technique | SE |
|---|---|---|---|---|
| Full House / Last Digit | 1.0 | | Claiming | 2.8 |
| Hidden Single (boîte) | 1.2 | | Naked Pair | 3.0 |
| Hidden Single (ligne) | 1.5 | | X-Wing | 3.2 |
| Direct Pointing | 1.7 | | Hidden Pair | 3.4 |
| Direct Claiming | 1.9 | | Naked Triple | 3.6 |
| Direct Hidden Pair | 2.0 | | Swordfish | 3.8 |
| Naked Single | 2.3 | | Hidden Triple | 4.0 |
| Direct Hidden Triple | 2.5 | | Naked Quad | 5.0 |
| Pointing | 2.6 | | Jellyfish | 5.2 |
| | | | Hidden Quad | 5.4 |

**Trois faits qui dictent la conception :**

1. **L'ordre d'essai de SE n'est PAS trié par difficulté croissante.** Il suit des catégories
   déclarées (`directHintProducers` puis `indirectHintProducers`), et retient le premier hint
   trouvé. Dans les indirectes, Hidden Pair (3.4) est testé **avant** Naked Pair (3.0), et Hidden
   Triple (4.0) **avant** Swordfish (3.8). Trier par score, réflexe naturel, ferait diverger notre
   note dès qu'une position admet plusieurs techniques.
2. **Locking et Fish sont la même classe**, paramétrée par un degré : degré 1 → Pointing/Claiming,
   degré 2/3/4 → X-Wing/Swordfish/Jellyfish. Idem pour les sous-ensembles nus et cachés, paramétrés
   par la taille. **8 modules suffisent pour les 19 techniques nommées ci-dessus.**
3. **Une variante « Direct » a exactement la même logique d'élimination** que sa version normale ;
   SE la classe « Direct », et la note plus bas, uniquement quand l'élimination produit
   immédiatement un single. C'est donc un post-traitement, pas une technique à part.

*Piège à éviter : le mode `revisedRating` du fork (désactivé par défaut) donne d'autres valeurs
— Naked Single 1.6, Hidden Pair 2.9… Ce n'est pas le barème de référence.*

---

## L'échelle de niveaux

Six niveaux, alignés sur la convention dominante (Sudoku.com en a six ; la presse française et les
sites d'impression en ont quatre à cinq, tous contenus dans ceux-ci). Chaque niveau est défini par
**la technique la plus difficile que la grille exige**, pas par un nombre d'indices.

| Niveau | Exige au plus | SE max |
|---|---|---|
| **Facile** | Singles cachés | 1.5 |
| **Moyen** | Single nu, variantes directes | 2.3 |
| **Difficile** | Paires pointantes et revendiquées | 2.8 |
| **Expert** | Paire nue, X-Wing, paire cachée | 3.4 |
| **Maître** | Triple nu, Swordfish, triple caché | 4.0 |
| **Diabolique** | Quadruplets, Jellyfish | 5.4 |

Repère utile, et argument produit : **les sudokus de presse plafonnent presque tous à SE 3.0.**
Notre « Difficile » atteint déjà ce plafond, et l'échelle va bien au-delà.

Limite assumée : au-delà de SE 5.4, il faut des chaînes (AIC, forcing chains, ALS) qui ne sont pas
dans ce registre. Les grilles les exigeant seront **rejetées à la génération**, pas mal étiquetées.
L'interface annoncera l'étendue réelle de l'échelle au lieu de laisser croire qu'elle est infinie.

---

## Architecture

```
packages/engine/src/logic/
├─ types.ts          Step, Technique, TechniqueId, Placement, Elimination
├─ state.ts          LogicState : valeurs + candidats, SANS propagation automatique
├─ registry.ts       ordre d'essai figé et versionné (RATING_VERSION)
├─ solve.ts          boucle : premier hint trouvé, journalisé
├─ rate.ts           chemin de résolution → score pic + niveau public
├─ explain.ts        Step → explication française en 3 paliers
└─ techniques/
   ├─ hiddenSingle.ts      Full House 1.0, boîte 1.2, ligne 1.5
   ├─ nakedSingle.ts       2.3
   ├─ locking.ts           Pointing/Claiming 2.6/2.8 + degrés Fish 3.2/3.8/5.2
   ├─ nakedSet.ts          Pair/Triple/Quad 3.0/3.6/5.0
   ├─ hiddenSet.ts         Pair/Triple/Quad 3.4/4.0/5.4
   └─ direct.ts            post-traitement : reclasse en Direct* et renote
```

### Le point de conception le plus délicat

**Le solveur logique ne doit pas réutiliser la propagation du solveur brut.**
`packages/engine/src/solver/solver.ts` applique automatiquement les singles cachés en cascade
(`eliminate` → `assign`). C'est excellent pour trouver une solution vite, mais catastrophique ici :
le solveur résoudrait des cases sans jamais créditer la technique qui les justifie, et la note
serait fausse.

`LogicState` ne fera donc qu'une seule chose automatiquement : quand une valeur est posée, la
retirer des candidats de ses 20 pairs. C'est la règle du jeu, pas une technique. **Tout le reste
doit être attribué à une technique nommée.**

### Le type `Step`, colonne vertébrale de l'incrément

Une même structure alimente les trois usages, ce qui garantit qu'ils ne peuvent pas diverger :

```ts
interface Step {
  technique: TechniqueId;      // identifiant stable
  label: string;               // « Paire cachée »
  difficulty: number;          // valeur SE
  units: number[];             // zone à surligner        → indice palier 1
  highlights: CellDigits[];    // le motif du raisonnement → indice palier 2
  placements: Placement[];     // ce qu'on peut poser      → indice palier 3
  eliminations: Elimination[]; // ce qu'on peut éliminer   → indice palier 3
  explanation: string;         // phrase française générée
}
```

### Réutilisation

Tout est déjà là et rien n'est à réécrire : `UNITS`, `UNITS_OF_CELL`, `PEERS`, `UnitInfo`
(`grid/constants.ts`) ; `ALL_DIGITS`, `countDigits`, `digitsOf`, `forEachDigit`, `withoutDigit`,
`formatMask` (`grid/bitset.ts`) ; `formatCell`, `isConsistent`, `findConflicts` (`grid/grid.ts`) ;
`hasUniqueSolution`, `findSolution` (`solver/`) — ce dernier restant l'oracle de vérité des tests.

---

## Étapes

**2a — Socle du solveur.** `types.ts`, `state.ts`, `registry.ts`, `solve.ts`, plus les deux
premières techniques (singles cachés, single nu). Sortie : une grille facile est résolue et chaque
coup est attribué à une technique nommée.

**2b — Le reste du registre.** Locking + Fish (une classe, quatre degrés), sous-ensembles nus et
cachés (une classe, trois tailles), puis le post-traitement Direct. Sortie : 19 techniques
nommées, 8 modules.

**2c — Notation et niveaux.** `rate.ts` : score pic (maximum, comme SE), technique la plus dure
requise, niveau public. Sortie : `rate(grid)` rend un verdict complet et honnête.

**2d — Génération ciblée.** Boucle de rejet dans `generate/` : générer, noter, accepter si le
niveau correspond. **Mesurer le taux de rejet et le temps par niveau avant de s'engager** — c'est
le risque technique identifié par la revue critique. Filet de sécurité prévu si les hauts niveaux
ne convergent pas : creusement guidé par le score plutôt qu'aléatoire.

**2e — Onglet Analyse.** Navigation pas à pas dans le chemin de résolution : technique, cases
impliquées, éliminations, explication. Réutilise `SudokuBoard.svelte` en mode surlignage.

**2f — Indices en 3 paliers.** Bouton Indice dans le jeu. Part de **l'état actuel du joueur**, pas
de la grille initiale. Si la grille du joueur est incohérente, le dire au lieu de donner un indice
absurde. Trois révélations successives : la zone, puis la technique nommée et expliquée, puis le
coup.

---

## Vérification

| Quoi | Comment |
|---|---|
| **Solidité des éliminations** ⚠️ | Le test le plus important de l'incrément. Chaque élimination produite doit être **logiquement valide** : sur une grille à solution unique, aucune technique ne doit jamais éliminer un candidat qui appartient à la solution, ni proposer un placement qui la contredit. Property test sur des centaines de grilles générées. Sans lui, un indice peut donner une explication **fausse** tout en résolvant correctement. |
| Complétude | Toute grille annoncée niveau N est résolue **sans jamais appeler le solveur brut** — la garantie « zéro devinette », en test bloquant. |
| Exactitude par technique | Chaque technique a ses grilles de référence, **vérifiées avant d'être figées** (règle du projet : aucun fixture inventé). |
| Reproductibilité | Golden test sur le chemin de résolution complet d'un corpus figé. Toute évolution exige un bump explicite de `RATING_VERSION`. |
| Performance | `pnpm measure` étendu : coût du solveur logique seul, puis taux de rejet et temps par niveau. C'est ce qui décidera du passage en Web Worker. |
| Interface | Vérification dans le navigateur : onglet Analyse sur plusieurs niveaux, indices aux trois paliers, comportement sur grille incohérente. |

---

## Hors périmètre, assumé

- **Le score « travail » (façon HoDoKu) et la métrique de tension.** Ils viendront une fois le
  score pic calibré contre l'oracle — inutile d'empiler trois métriques dont aucune n'est validée.
- **L'oracle Sudoku Explainer.** C'est l'incrément 3. D'ici là notre notation reproduit un barème
  documenté sans être vérifiée contre lui ; l'échelle est donc **cohérente et honnête, mais pas
  encore prouvée conforme**. L'interface doit le refléter.
- **Les chaînes** (AIC, forcing chains, ALS) et le segment expert.
- **La normalisation des accents** dans les commentaires de l'incrément 1 (dette notée dans
  `CLAUDE.md`) — à faire dans une passe séparée pour ne pas polluer le diff de celui-ci.
