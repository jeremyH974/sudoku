# Sudoku — Moteur & Studio

---

## Context

Projet **from scratch** — `C:\Users\jerem\code\sudoku` est vide, pas de dépôt git.

Objectif : un Sudoku **zero-install** (rien à installer côté utilisateur), générant des grilles à difficulté choisie et des grilles imprimables. L'intention n'est **pas** d'être le premier sur une feature, mais d'avoir **toutes les grandes features des concurrents** puis de faire mieux là où **tous** échouent.

Trois flux de recherche sourcée ont été menés (benchmark concurrentiel, douleurs utilisateurs, état de l'art technique), puis le plan qui en découlait a été soumis à une **revue critique adversariale** qui a corrigé plusieurs erreurs. Les décisions ci-dessous intègrent ces corrections.

### Arbitrages validés

| Axe | Décision | Contrainte |
|---|---|---|
| Ambition | Projet perso premium | Ne fermer **aucune** porte : commercial, OSS, B2B activables plus tard |
| Périmètre | **Le moteur est le cœur**, mais séquencé en *walking skeleton* | Une grille jouable très tôt, comme instrument de validation |
| Infrastructure | 100% statique, zéro backend | Intégrable à un site web plus tard |
| Cible | Grand public/progression + Enseignants | Experts et Seniors/impression faciles à brancher |
| Registre V1 | **10 techniques** (Facile→Difficile) | Le registre est extensible : les suivantes sont purement additives |
| Calibration | **Oracle Sudoku Explainer en boîte noire** | Exécution du binaire, jamais lecture du code (zéro contamination LGPL) |
| Exécution | **Majoritairement via Claude Code** | Points de validation fréquents ; **la suite de tests est le garde-fou de qualité** |

---

## Ce que la recherche a établi

### Le fait technique qui fonde tout le projet

> **Le nombre d'indices est un très mauvais prédicteur de la difficulté : corrélation ≈ 0,27** avec la difficulté perçue par les humains. Une métrique simulant un solveur humain atteint **≈ 0,95**.
> — Pelánek, *Difficulty Rating of Sudoku Puzzles* ([arXiv:1403.7373](https://arxiv.org/abs/1403.7373)) — 1 700+ grilles, des centaines de solveurs humains par grille.

Or **la quasi-totalité du marché grand public calibre au nombre d'indices** (Easy 36-45, Medium 30-35, Expert 22-27…). C'est exactement pourquoi la douleur n°5 du marché est « difficulté mal calibrée », et pourquoi un joueur peut « enchaîner les expert puis n'en résoudre plus qu'un sur quatre ».

**Notre moteur de notation est donc le moat. Il n'y a pas de raccourci.**

### Les deux échelles de référence

| | **Sudoku Explainer (SE)** | **HoDoKu** |
|---|---|---|
| Formule | **max** des techniques du chemin | **somme** pondérée de toutes les techniques |
| Répond à | « Est-ce que je *sais* la résoudre ? » | « Combien de temps ça va prendre ? » |
| Échelle | 1.0 → 11.9 | ~450 → ~2000 |

Barème SE vérifié : 1.0 Last Digit · 1.2 Hidden Single (Box) · 1.5 Hidden Single (Line) · 1.7-2.8 Locked Candidates + Naked Single · 3.0-4.0 Subsets, **X-Wing = 3.2**, Swordfish · 6.5 X-Chain · 8.2 Forcing Chain · 9.5+ chaînes imbriquées.
Repère : **les sudokus de journaux plafonnent à SE 3.0** alors que l'échelle monte à 11.9.

### Les douleurs structurantes du marché

1. **Pubs intrusives** (pain n°1 universel) · 2. **Limite de 3 erreurs** qui termine la partie chez le leader — « récompense la victoire plutôt que l'apprentissage » · 3. **Hints qui donnent la réponse sans enseigner** — même Good Sudoku (payant) *ne nomme pas* les techniques · 4. **Grilles nécessitant du guessing** · 5. **Difficulté mal calibrée** · 6. **Candidats non colorables individuellement** — réclamé depuis des années, absent partout · 7. **Impression bâclée** — 4-6 grilles/page, illisible · 8. **Accessibilité ratée** — 11-12 pt au lieu de ≥16, cibles 30×30 px au lieu de 44×44, **apps inutilisables au lecteur d'écran**.

### Les gaps du marché

1. **Aucune PWA zero-install soignée** — les gros poussent vers le natif, les sites hardcore n'ont pas de PWA travaillée. Créneau vacant.
2. **Aucun pont impression ↔ digital unifié** — Krazydad excelle en PDF sans version jouable ; Sudoku.com a une page print secondaire. **Personne ne propose la même grille, même difficulté calibrée, cohérente papier et écran.**
3. **Aucun rating personnel type Glicko** — Lichess le fait sur 6M+ puzzles ; le monde Sudoku en est aux catégories statiques.
4. **Accessibilité : angle mort général.**

### Licences — conditionne les options « commercial » et « OSS »

| Ne PAS lier | Licence | Usage autorisé |
|---|---|---|
| HoDoKu | GPLv3 | Référence algorithmique à ré-implémenter |
| Emerentius/sudoku | AGPL-3.0 | Référence seulement |
| **Sudoku Explainer** | **LGPL** | **Oracle en boîte noire uniquement : on exécute le binaire, on ne lit pas le code** |

Réutilisables : tdoku (BSD-2), Interactive-Sudoku-Solver (MIT), sudoku-core / sudoku-gen (MIT), OR-Tools (Apache 2.0).

> **Règle du projet : zéro dépendance copyleft, tout ré-implémenté depuis les algorithmes publiés.** Licence du projet à trancher au moment de publier (MIT ou Apache-2.0 — les deux gardent les options ouvertes).

---

## Stratégie

### Table stakes — parité obligatoire
Multiples niveaux · notes/candidats · détection de conflits · undo · chrono · daily · thèmes + dark mode · gratuit · page imprimable.

### Les 3 moats

**1. La calibration la plus honnête du marché.** Score SE (pic) d'abord et validé contre l'oracle ; puis score travail (HoDoKu) ; puis une 3ᵉ dimension que personne ne mesure : la **tension** du chemin — le nombre d'étapes où une seule technique très spécifique débloque la suite. C'est la « structure de dépendance entre étapes » que Pelánek identifie comme 2ᵉ source de difficulté humaine, ignorée de tous. Et **tout est affiché**, pas caché derrière un label marketing.

**2. Le pont impression ↔ digital unifié.** La *même* grille, la *même* difficulté calibrée, cohérente papier et écran. QR code sur la feuille → grille jouable. Exactement le besoin des enseignants.

**3. Le rating personnel** *(préparé, activé plus tard)*. Glicko2 comme Lichess : la difficulté devient personnelle et mesurée au lieu d'être une catégorie. Moat de données — il se renforce avec l'usage.

### Anti-pains — décisions gravées

| Douleur du marché | Notre décision |
|---|---|
| Pubs, trackers, compte obligatoire | **Zéro.** Aucune requête réseau après chargement. |
| Limite de 3 erreurs | **Aucune limite.** Option existante, désactivée par défaut. |
| Hints qui donnent la réponse | Le hint **nomme la technique**, surligne les cellules, explique l'élimination — révélé en 3 paliers (zone → technique → coup). |
| Guessing | **Garantie vérifiée mécaniquement en CI** : toute grille publiée est résoluble par les techniques de son niveau, sans bifurcation. |
| Candidats non colorables | **Coloration individuelle des candidats** dès la V1 de l'UI. |
| Impression illisible | **1 grille/page par défaut**, preset gros caractères, corrigés séparables. |
| Accessibilité | Dès la V1 : clavier complet, contraste 4.5:1, taille réglable, **jamais la couleur seule** comme vecteur d'information. |

---

## Architecture

> **Principe directeur :** le moteur ne connaît ni le DOM, ni le navigateur, ni Svelte, ni le stockage. C'est ce qui rend gratuites les options CLI B2B, intégration site web, app native et génération server-side.

```
sudoku/
├─ packages/
│  ├─ engine/            # LE CŒUR. Zéro dépendance, zéro DOM.
│  │  ├─ rng/            #   PRNG seedable — tout est reproductible
│  │  ├─ grid/           #   bitmask, unités/voisinages, transformations, sérialisation
│  │  ├─ solver/         #   solveur brut : résolution + comptage avec arrêt à la 2ᵉ solution
│  │  ├─ logic/          #   solveur HUMAIN : registre de techniques ordonnées → solve path
│  │  ├─ rating/         #   score SE (pic), puis travail, puis tension → niveaux publics
│  │  ├─ generate/       #   seeds + dig holes + rejection sampling
│  │  └─ io/             #   .sdk + URL courte
│  ├─ engine-worker/     # wrapper Web Worker + pool de grilles pré-générées
│  ├─ ui/                # composants Svelte STANDARDS (pas Custom Elements — voir ci-dessous)
│  ├─ print/             # composition de cahiers → HTML + CSS @page
│  ├─ app/               # la PWA
│  └─ cli/               # oracle SE, corpus, pré-génération offline, plus tard B2B
└─ corpus/               # grilles de référence + scores oracle, pour valider la calibration
```

### Décisions techniques et justifications

| Sujet | Décision | Justification |
|---|---|---|
| Langage | TypeScript strict | Le moteur est le cœur ; c'est là que les types paient |
| Moteur | **TS pur d'abord, WASM différé derrière la même interface** | ⚠️ Le goulot n'est **pas** le solveur brut (0,01-1 ms) mais le **solveur logique** appelé pour noter chaque candidat de la boucle de génération. À benchmarker dès qu'il existe, avant de s'engager |
| **Génération** | **Pool de seeds générés par backtracking randomisé** + dig holes + rejection sampling | ⚠️ **Correction majeure post-revue.** Les transformations d'un seed unique (permutations, transposition, réétiquetage) ne produisent que des grilles **isomorphes** — une seule classe d'équivalence sur les **5 472 730 538** existantes (Russell & Jarvis, 2005). **La diversité vient du dig-holes, pas du seed.** Le remplissage backtracking coûte quelques ms : négligeable |
| Difficulté extrême | **Filet de sécurité prévu** : recherche locale dirigée (modèle Beer) + pré-génération offline via `cli` | ⚠️ Le rejet pur tombe dans des minima locaux au-delà d'un seuil ; des taux de rejet de 99,7 % sont documentés. Viable pour Facile→Difficile (cible V1), à mesurer avant de s'engager sur Expert+ |
| Unicité | Arrêt à la 2ᵉ solution trouvée | Compter toutes les solutions est un gaspillage classique |
| Symétrie | Option **esthétique** (aucune / 180° / diagonale) | **La symétrie n'affecte pas la difficulté logique.** Ne jamais la présenter comme un réglage de difficulté |
| **UI** | **Svelte 5 en composants standards. PAS de Custom Elements en V1.** | ⚠️ **Correction post-revue.** `aria-labelledby`, `aria-describedby` et `<label for>` **ne traversent pas le Shadow DOM** ; le correctif standard (Reference Target) est encore en prototype. Un composant top-level Svelte = un shadow root → conflit frontal avec notre pilier accessibilité, pour un bénéfice (embarquabilité) non exercé en V1. Le jour venu : **un seul** Custom Element racine, pas un par composant |
| Impression | **CSS `@page` + `window.print()`** | **Les libs JS pures (jsPDF, pdfmake) ne rendent pas le CSS.** Seul le moteur du navigateur respecte la mise en page. `@page` gère marges de reliure et sauts de page ; `print-color-adjust: exact` force les fonds |
| Stockage | IndexedDB + `navigator.storage.persist()`, **schéma versionné dès le jour 1** | Safari **évince après 7 jours d'inactivité** — critique pour une app ouverte irrégulièrement |
| PWA | Workbox, cache-first sur assets versionnés | iOS supporte les SW mais **sans prompt d'installation** : prévoir l'explication « Ajouter à l'écran d'accueil » |
| Variantes | **Pas de `ConstraintSet` générique maintenant.** Isoler les hypothèses 9×9 derrière des points nommés (unités, voisinage d'une cellule) | Généraliser sur un seul cas d'usage produit une mauvaise abstraction. L'extraction sera mécanique à la 2ᵉ variante réelle |
| E/S | `.sdk` + URL courte en V1. **fpuzzles-JSON différé** | Ce format sert l'interop variantes, qui n'est pas planifiée. C'est du reverse engineering sur un format mouvant |
| Tests | Vitest + **fast-check** (property-based) | Les invariants du moteur se testent par propriété. **C'est le garde-fou principal du projet** |

### Le registre de techniques

Chaque technique est un module autonome : `{ id, nom, scoreSE, ordre, chercher(état) → Étape[] }`. Le solveur applique **systématiquement la plus simple applicable** et journalise le solve path.

**V1 — les 10 qui couvrent Facile→Difficile et 100 % du besoin enseignants :**
Full House · Naked Single · Hidden Single (Box) · Hidden Single (Line) · Locked Candidates Pointing · Locked Candidates Claiming · Naked Pair · Naked Triple/Quad · Hidden Pair · Hidden Triple/Quad — puis **X-Wing** comme première technique « spectaculaire » pour démontrer les hints.

**Ensuite, purement additif :** Swordfish · Jellyfish · Skyscraper · Two-String Kite · Empty Rectangle · XY-Wing · XYZ-Wing · W-Wing · Unique Rectangle · BUG+1 · Simple Coloring · Remote Pairs → puis segment expert : AIC/Nice Loops · Forcing Chains · Finned/Sashimi Fish · ALS-XZ · ALS-XY-Wing · Sue de Coq · Death Blossom · SK Loop.

> **Piège à neutraliser dès le jour 1 :** le rating dépend fortement de **l'ordre d'essai des techniques** — deux implémentations divergent sur la même grille. L'ordre sera **figé, versionné (`ratingVersion`) et sérialisé avec chaque grille**.

### Points de couture — ce qui garde les portes ouvertes

| Option future | Prévu dès la V1 | Coût plus tard |
|---|---|---|
| Commercial / OSS | Licence permissive, zéro dépendance copyleft, moteur découplé, API documentée | Nul |
| B2B / masse | `packages/cli` existe déjà (il porte l'oracle) ; moteur sans dépendance navigateur | Quelques jours |
| Intégration site web | Moteur importable en ESM ; UI encapsulable en **un** Custom Element racine | Faible |
| Backend / sync | Interfaces `StorageAdapter` et `PuzzleSource` (impl. IndexedDB en V1) | Le backend seul |
| Experts | Registre de techniques extensible | Ajouter les modules |
| Seniors / impression pro | Presets de mise en page dans `print/` | Un preset |
| Variantes | Hypothèses 9×9 isolées derrière des points nommés | Extraction mécanique |
| Rating Glicko2 | Le score est déjà un nombre continu, pas une catégorie | Le calcul Glicko |

---

## Roadmap — en incréments validables

> Rythme retenu : exécution majoritairement via Claude Code. Chaque incrément se termine par un état **fonctionnel, testé et démontrable** — c'est ce qui rend le projet reprenable et la qualité vérifiable.

**Incrément 0 — Socle.** `git init`, pnpm workspaces, TS strict, Vitest, fast-check, ESLint, CI. **PRNG seedable posé dès le départ** (tout le reste en dépend : golden tests, daily puzzle, URL courte).

**Incrément 1 — Le squelette jouable.** `grid` bitmask minimal + solveur brut naïf + dig-holes aléatoire + grille Svelte jouable (saisie, notes, conflits, undo).
→ *Sortie : un sudoku valide à solution unique, réellement jouable dans le navigateur. La difficulté n'est pas encore calibrée et c'est annoncé comme tel.* Cet incrément valide le contrat moteur↔UI en conditions réelles, avant qu'il ne soit figé.

**Incrément 2 — Le solveur logique (10 techniques) + banc de debug.** Registre ordonné, solve path journalisé, et une vue de debug qui montre pas à pas la technique appliquée et les cellules impliquées.
→ *Sortie : on peut expliquer chaque grille. C'est la fondation des hints pédagogiques.*

**Incrément 3 — Notation SE + oracle.** Score pic SE, `cli` d'oracle (exécute SE sur des milliers de grilles générées, compare), **rapport de corrélation chiffré**, mapping vers les niveaux publics.
→ *Sortie : notre « Difficile » correspond prouvablement à celui du reste du monde.*

**Incrément 4 — Génération calibrée.** Rejection sampling, Worker, pool pré-généré, **bench p50/p95 par niveau sur cible matérielle basse** (tablette d'école). Filet de sécurité activé si les mesures l'imposent.

**Incrément 5 — Studio d'impression.** 1/2/4 grilles par page, presets standard / **gros caractères** / cahier relié, corrigés séparables, page d'indices, en-têtes personnalisables (élève, date, classe), A4 **et** Letter, QR code vers la grille jouable, génération par lot.

**Incrément 6 — La PWA complète.** Offline, installable, **hints en 3 paliers qui nomment la technique**, **coloration individuelle des candidats**, daily déterministe, stats, dark mode, accessibilité complète.

**Incrément 7 — Progression.** Campagne technique par technique, *skill profile*, achievements, streak avec « filet de sécurité » façon Chess.com.

**Ensuite :** techniques avancées (segment expert) · score travail + tension · variantes · rating Glicko2 · CLI B2B · backend optionnel.

---

## Vérification

| Quoi | Comment |
|---|---|
| **Correction du moteur** | `pnpm test` — property-based (fast-check) : unicité de solution, préservation par transformation, aller-retour d'E/S sans perte |
| **Solidité des éliminations** ⚠️ | *Angle mort corrigé.* Vérifier que **chaque élimination produite est logiquement valide** — pas seulement que le solveur atteint la solution. Oracle : une élimination est valide ssi aucune solution ne place cette valeur dans cette cellule (forcer la valeur, relancer le solveur brut). Sans ce test, un hint peut donner une explication **fausse** tout en passant les tests de complétude |
| **Garantie « zéro guessing »** | Test CI bloquant : toute grille de niveau N est résolue par le solveur logique **sans jamais appeler le solveur brut** |
| **Crédibilité de la calibration** | Harnais oracle SE : rapport de corrélation chiffré, priorité sur les paliers 1.0-4.0 (ceux qui concernent nos cibles) |
| **Reproductibilité** | Golden tests sur solve path figé ; toute évolution exige un bump explicite de `ratingVersion` |
| **Performance** | Bench p50/p95 du **solveur logique** (pas seulement du brut) et de la génération, sur cible matérielle basse, avec seuil de régression en CI |
| **Impression** | Rendu réel A4 et Letter dans Chrome et Firefox + checklist visuelle. L'impression ne se teste pas automatiquement de façon fiable — c'est manuel et assumé |
| **Accessibilité** | axe-core en CI + parcours clavier complet + test manuel lecteur d'écran. ⚠️ `role="grid"` est signalé comme **anti-pattern potentiel** hors données tabulaires : à valider par un test réel, pas à appliquer par défaut |
| **PWA** | Lighthouse (installabilité, offline) + vérification que `storage.persist()` est accordé |

---

## Corrections apportées après revue critique

Tracées ici pour mémoire, car elles changent des décisions structurantes :

1. **Diversité de génération** — l'argument « transformation de seed = des billions de grilles » était **faux** : ces grilles sont isomorphes, une seule classe d'équivalence. La diversité vient du dig-holes. → Pool de seeds par backtracking.
2. **Svelte Custom Elements** — abandonnés en V1 : le Shadow DOM casse les références ARIA, en conflit direct avec notre pilier accessibilité.
3. **Périmètre du registre** — 19 → 10 techniques, ce qui divise par deux le poste le plus lourd du projet.
4. **Séquence** — walking skeleton au lieu de « moteur complet avant tout pixel ».
5. **Oracle SE** — un corpus public bien labellisé n'existe pas ; on génère le nôtre et on le valide contre le binaire SE en boîte noire.
6. **Goulot de performance** — c'est le solveur *logique*, pas le solveur brut. À benchmarker avant de trancher sur WASM.
7. **Angles morts ajoutés** — PRNG seedable, solidité des éliminations, daily déterministe sans backend, versionnement du schéma IndexedDB, cible matérielle basse.

---

## Points ouverts (non bloquants)

1. **Licence** — MIT (adoption) vs Apache-2.0 (protection brevets). À trancher au moment de publier.
2. **Nombre de niveaux publics** — 6 (norme du marché) ou 12 (sudoku.coach). Le moteur produit un score continu : le découpage est un réglage, pas une décision d'architecture.
3. **UX de coloration des candidats sur mobile** — sélectionner 1 candidat parmi 9 dans une cellule, sur un écran de 375 px, tout en respectant les cibles de 44×44 px, est un vrai problème de conception que la concurrence résout mal. À traiter comme un sujet de design à part entière au moment de l'incrément 6, pas comme un composant à coder.
4. **Design visuel** — l'ambition « premium » n'apparaît dans aucun incrément. À arbitrer : une passe de direction artistique avant l'incrément 6, ou un design system minimal assumé.
