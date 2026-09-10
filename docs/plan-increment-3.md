# Incrément 3 — Calibration contre l'oracle Sudoku Explainer

> Le plan stratégique complet est dans `docs/plan.md`.

---

## Context

Les incréments 1 et 2 sont livrés et commités (`3b2c452`, `1cb8a06`). Le moteur mesure la
difficulté par les techniques réellement nécessaires, génère des grilles à niveau ciblé et
explique chaque déduction. 166 tests passent.

Mais **la promesse principale n'est pas encore tenue.** Notre notation reproduit le barème de
Sudoku Explainer à partir de valeurs lues dans son code et de sa documentation. Elle est donc
*cohérente*, jamais *prouvée conforme*. Deux choses peuvent nous faire diverger sans qu'aucun
test actuel ne le détecte :

1. **L'ordre d'essai des techniques.** SE teste par familles et retient le premier résultat, sans
   trier par difficulté. Nous avons reproduit cet ordre d'après une description, pas par mesure.
   Dès qu'une position admet plusieurs coups, l'ordre décide de la note.
2. **La détection elle-même.** Une technique qui trouve moins de motifs que SE — ou davantage —
   change le chemin, donc le score, sans jamais produire de déduction invalide. Nos tests de
   solidité sont aveugles à cela.

Tant que ce n'est pas mesuré, notre « Difficile » ne veut pas forcément dire la même chose que
partout ailleurs.

### Arbitrages validés

| Question | Décision |
|---|---|
| Accès à l'oracle | **Installer Java**, télécharger le binaire de SE |
| En cas de divergence | **Coller à SE**, la référence que parlent joueurs et sites tiers |
| Métriques supplémentaires | **Aucune.** Valider d'abord le score existant |
| Licence | Oracle en **boîte noire** : on exécute, on ne lit ni ne copie le code (SE est en LGPL v2.1) |

---

## Ce que la recherche a établi

**Le binaire existe, pré-compilé** — aucune compilation nécessaire :
`SukakuExplainer.jar`, 636 Ko, release v1.18.1 (23/09/2021),
`https://github.com/SudokuMonster/SukakuExplainer/releases/download/v1.18.1/SukakuExplainer.jar`

**Java** : `winget` est disponible et propose `EclipseAdoptium.Temurin.17.JRE`. Un JRE suffit —
nous n'avons rien à compiler.

**Le mode batch, syntaxe vérifiée sur le wiki du projet :**

```
java -Xrs -Xmx500m -cp SukakuExplainer.jar diuf.sudoku.test.serate \
  --format="%g ED=%r/%p/%d" --input=puzzles.txt --output=rated.txt
```

Entrée : une grille par ligne, 81 caractères, `.` pour une case vide — exactement ce que produit
déjà `formatGrid` (`packages/engine/src/grid/grid.ts`). Aucune conversion à écrire.

Sortie configurable. Les spécificateurs qui nous intéressent :

| Spéc. | Sens | Ce qu'on compare |
|---|---|---|
| `%r` | rating : plus haute difficulté du chemin complet | notre `rating.score` |
| `%R` | **nom de la technique la plus difficile** | notre `rating.hardestLabel` |
| `%p` / `%P` | *pearl* : difficulté jusqu'au premier placement, et sa technique | validation supplémentaire |
| `%d` / `%D` | *diamond* : difficulté jusqu'à la première élimination, et sa technique | idem |
| `%i`, `%n`, `%e` | grille, numéro d'ordre, temps écoulé | appariement et mesure |

Autres options utiles : `--revisedRating=0` (barème classique — à passer **explicitement**, un
défaut n'est pas une garantie), `--threads`, `--totalTime`.

Limite connue : **aucun spécificateur ne liste toutes les techniques du chemin**, seulement la
plus difficile. Le diagnostic se fera donc sur le sommet du chemin, ce qui suffit puisque c'est
précisément ce que le score mesure.

---

## La prédiction que cet incrément met à l'épreuve

Un point de méthode, qui change la nature du test.

SE possède bien plus de techniques que nous, mais il les essaie **dans un ordre où les nôtres
viennent en premier**. Donc, pour une grille que notre registre sait résoudre, SE devrait suivre
le même chemin et rendre **exactement le même nombre** — pas un nombre corrélé. Le critère n'est
pas une corrélation à 0,95, c'est une **égalité stricte**. Toute différence est un défaut
localisable : un ordre erroné, ou une technique qui ne détecte pas ce qu'elle devrait.

Sauf dans une zone précise. Entre 4,0 et 5,4, SE dispose de techniques que nous n'avons pas —
XY-Wing (4,2), XYZ-Wing (4,4), Skyscraper et Two-String Kite, Unique Rectangle. Là où nous
serions contraints à un quadruplet caché (5,4), SE peut conclure moins cher. La prédiction est
donc :

- **score ≤ 4,0 → accord exact attendu.** Tout écart est un bug de notre côté.
- **score > 4,0 → écart attendu et explicable** par les techniques manquantes.

Si la mesure confirme cela, deux options s'ouvriront, à trancher **avec les chiffres en main** :
ajouter les techniques manquantes (elles sont purement additives, le registre est fait pour ça),
ou **ramener l'échelle publique à ce que nous savons mesurer fidèlement** et déclarer hors
échelle au-delà. La seconde est plus honnête à court terme, la première plus ambitieuse.

Si la mesure infirme cela — des écarts sous 4,0 — c'est encore plus utile : nous aurons trouvé
des bugs que rien d'autre ne pouvait révéler.

---

## Architecture

```
packages/cli/                    ← nouveau paquet, prévu de longue date par le plan global
├─ package.json                  (bin: sudoku-oracle)
├─ tsconfig.json                 (projet outillage : accès à Node, comme engine/tsconfig.scripts.json)
└─ src/
   ├─ oracle/
   │  ├─ setup.ts                vérifie Java, localise ou télécharge le JAR
   │  ├─ serate.ts               invoque serate en lot, analyse la sortie
   │  └─ types.ts                OracleRating { score, hardestTechnique, pearl, diamond }
   ├─ corpus.ts                  génère un corpus reproductible et l'écrit au format serate
   ├─ compare.ts                 apparie notre notation et celle de SE, produit le rapport
   └─ main.ts                    sous-commandes : corpus | rate | compare | report

corpus/
├─ generated/                    (déjà dans .gitignore) grilles et sorties brutes de serate
└─ calibration.json              LE livrable : divergences figées, versionné
tools/sudoku-explainer/          (déjà dans .gitignore) le JAR, jamais versionné
```

**Pourquoi un paquet et non un script.** Le harnais fait tourner un processus externe, écrit des
fichiers, télécharge un binaire : rien de tout cela n'a sa place dans `packages/engine`, dont la
pureté est vérifiée mécaniquement (il compile avec `lib: ["ES2023"]` seul). Et le plan global
prévoit déjà `packages/cli` pour la génération en masse — l'oracle lui sert de premier habitant.

**Réutilisation.** `formatGrid` / `parseGrid` (`grid/grid.ts`) produisent déjà le format attendu
par serate. `rate` (`logic/rate.ts`) donne `score`, `hardestTechnique`, `hardestLabel`,
`outcome`. `generatePuzzle` et `generateAtLevel` (`generate/`) fournissent le corpus.
`createRng` (`rng/`) le rend reproductible.

**Correspondance des noms de techniques.** SE écrit ses noms en anglais (« Hidden Single »,
« Naked Pair »…), nous en français. Une table de correspondance explicite, dans `compare.ts`,
fera le pont — et servira aussi de test : un nom rendu par SE qui ne serait pas dans la table
signale une technique que nous n'avions pas anticipée.

---

## Étapes

**3a — Mise en place de l'oracle.** Installer le JRE Temurin 17 (`winget`), télécharger le JAR
depuis l'URL ci-dessus, vérifier sa taille, et le faire tourner sur une poignée de grilles dont
nous connaissons déjà le rating de réputation (AI Escargot, Platinum Blonde, Golden Nugget).
*Sortie : l'oracle répond, et sa sortie est analysée correctement.*

> L'approbation de ce plan vaut autorisation pour ces deux opérations précises : l'installation du
> JRE Temurin 17 par winget, et le téléchargement du seul fichier `SukakuExplainer.jar` depuis
> l'URL GitHub citée. Rien d'autre ne sera installé ni téléchargé.

**3b — Corpus reproductible.** Générer quelques milliers de grilles couvrant toute l'échelle,
depuis une graine figée, et les écrire au format serate. Inclure délibérément des grilles que
notre registre ne résout pas : savoir ce que SE en dit vaut confirmation de notre honnêteté.
*Sortie : `corpus/generated/`, régénérable à l'identique.*

**3c — Comparaison et rapport.** Apparier les deux notations, produire un rapport chiffré :
taux d'accord exact global et par palier, distribution des écarts, matrice de confusion des
techniques (ce que nous disons × ce que SE dit), et la liste des grilles divergentes avec leur
chemin de résolution.
*Sortie : `corpus/calibration.json`, versionné, plus un résumé lisible en console.*

**3d — Correction.** Traiter les divergences par ordre de fréquence. Les deux causes attendues
sont un ordre de registre erroné et une détection incomplète ; chaque correction devient un test
de non-régression avec la grille qui l'a révélée. Bump de `RATING_VERSION` si l'ordre change.
*Sortie : accord exact sur le domaine que nous prétendons couvrir.*

**3e — Verrouillage.** Un test de CI rejoue un échantillon réduit du corpus contre des attentes
figées, sans exiger Java. La calibration cesse ainsi d'être une opération ponctuelle pour devenir
un invariant : une régression de notation casse la suite.
*Sortie : la conformité est tenue par les tests, pas par un rapport daté.*

---

## Vérification

| Quoi | Comment |
|---|---|
| **Accord exact sous 4,0** | Le critère central. Sur le corpus, part des grilles où notre score égale celui de SE **au centième près**. Objectif : 100 % sous 4,0 ; tout manquant est un défaut à corriger, pas une tolérance à accepter. |
| **Accord sur la technique** | Notre `hardestLabel` correspond au `%R` de SE. Un écart de nom avec un score identique révèle deux techniques de même valeur, donc un ordre à examiner. |
| Cohérence pearl / diamond | `%p` et `%d` donnent deux points de contrôle supplémentaires sans coût : ils valident le **début** du chemin, là où `%r` n'en valide que le sommet. |
| Honnêteté sur les refus | Les grilles que nous déclarons hors échelle doivent recevoir de SE un rating supérieur à 5,4. Une seule grille refusée par nous mais notée 2,0 par SE serait un aveu grave. |
| Reproductibilité | Le corpus se régénère à l'identique depuis sa graine ; le rapport ne bouge pas à moteur inchangé. |
| Non-régression | `pnpm check` reste vert, et le nouveau test de conformité tourne **sans Java** sur des attentes figées. |
| Performance | Temps de notation de SE par grille (via `%e` et `--totalTime`), pour dimensionner les futures campagnes. |

---

## Hors périmètre

- **Les scores « travail » et « tension ».** Ils viendront sur une base prouvée.
- **L'ajout des techniques manquantes** (XY-Wing, Skyscraper, Unique Rectangle…). La mesure dira
  s'il le faut ; la décision se prendra alors avec les chiffres, pas maintenant.
- **La normalisation des accents** des commentaires de l'incrément 1 (dette notée dans
  `CLAUDE.md`), à traiter dans une passe séparée.
