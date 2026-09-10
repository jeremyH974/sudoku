# Sudoku — Moteur & Studio

Générateur et jeu de Sudoku **sans rien à installer** : tout tourne dans le navigateur.
Aucune publicité, aucun compte, aucun suivi, aucune requête réseau après le chargement.

> **État : incrément 1 terminé.** Le moteur génère des grilles à solution unique garantie et
> l'interface est jouable. La **notation de difficulté n'est pas encore implémentée** — et
> l'application le dit explicitement plutôt que d'afficher un niveau qui serait faux.

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

## Le parti pris

La quasi-totalité des applications de Sudoku déduit la difficulté du **nombre d'indices**
(« Facile 36-45, Expert 22-27 »). C'est mesurablement faux : la corrélation entre le nombre
d'indices et la difficulté réellement ressentie par des joueurs humains est d'environ **0,27**,
là où une métrique simulant un raisonnement humain atteint **0,95**
([Pelánek, arXiv:1403.7373](https://arxiv.org/abs/1403.7373), 1 700+ grilles).

C'est la source directe de la plainte la plus répandue chez les joueurs — des niveaux
incohérents entre eux et entre applications. Ce projet part de là : **la difficulté sera
calculée à partir des techniques de raisonnement réellement nécessaires**, calibrée contre la
référence du domaine, et affichée en clair au lieu d'être cachée derrière un label marketing.

En attendant que ce solveur logique existe, l'application n'annonce aucun niveau. Le réglage
disponible dit exactement ce qu'il fait : combien de cases sont laissées vides.

## Architecture

```
packages/
├─ engine/       Le cœur. Zéro dépendance, zéro DOM, zéro accès au stockage.
│  ├─ rng/       PRNG seedable — tout est reproductible depuis une graine
│  ├─ grid/      Géométrie 9×9, masques de candidats, lecture/écriture
│  ├─ solver/    Solveur brut : propagation de contraintes + backtracking MRV
│  └─ generate/  Solution complète aléatoire, puis creusement à unicité garantie
└─ app/          L'application Svelte 5
   └─ src/lib/   Logique de partie (classe à runes) et grille accessible
```

Le moteur ne connaît ni le DOM, ni le navigateur, ni le framework, ni le stockage. C'est ce qui
garde ouvertes, sans dette, les options « outil en ligne de commande », « intégration dans un
site », « génération côté serveur » et « application native ».

Cette pureté est **vérifiée mécaniquement** : le moteur compile avec `lib: ["ES2023"]` seul, donc
un simple `console.log` oublié dans `packages/engine/src` casse le typecheck.

### Décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| Diversité des grilles | Solution complète tirée par backtracking randomisé à chaque fois | Transformer une grille germe unique (permutations, transposition, réétiquetage) ne produit que des grilles **isomorphes** — une seule classe d'équivalence sur les 5 472 730 538 existantes. La diversité vient du creusement. |
| Unicité | Arrêt dès la 2ᵉ solution trouvée | Compter toutes les solutions est du calcul jeté |
| Symétrie | Option purement esthétique | Elle n'a **aucun** effet sur la difficulté logique et ne doit jamais être présentée comme un réglage de difficulté |
| Dépendances | **Zéro copyleft** | HoDoKu est en GPLv3, le portage Rust de jczsolve en AGPL. Tout est réimplémenté depuis les algorithmes publiés, ce qui garde ouvertes les options commerciale et open source permissive. |
| Web Components | **Non**, composants Svelte standards | Le Shadow DOM empêche `aria-labelledby`, `aria-describedby` et `<label for>` de traverser sa frontière — en conflit frontal avec l'accessibilité de la grille. L'encapsulation pour embarquer le jeu se fera par **un seul** élément racine, le jour où le besoin existera. |

### Performance mesurée

Sur la machine de développement (`pnpm measure`) :

| Étape | p50 | p95 |
|---|---|---|
| Solution complète aléatoire | 0,5 ms | 0,6 ms |
| **Creusement avec vérification d'unicité** | **16,3 ms** | **17,8 ms** |
| Grille jouable de bout en bout | 16,6 ms | 19,4 ms |
| Unicité sur « Platinum Blonde » (843 hypothèses) | 13,2 ms | 14,0 ms |

Le creusement représente ~97 % du coût. Aucun Web Worker n'est nécessaire à ce stade ; il le
deviendra quand le solveur logique entrera dans la boucle de génération.

## Ce qui est garanti, et testé

- **Toute grille générée admet exactement une solution.** Vérifié par property test à chaque
  exécution de la suite, sur toutes les symétries.
- **Toute grille est reproductible** depuis sa graine — condition du partage par lien court et
  du défi quotidien sans serveur.
- **Aucune limite d'erreurs.** Les conflits sont signalés, jamais sanctionnés : une partie ne se
  perd pas.
- **L'annulation est illimitée et restaure aussi les notes**, pas seulement la valeur — sinon
  annuler détruit silencieusement le raisonnement qui précédait.
- **La couleur n'est jamais le seul porteur d'information** : un conflit est doublé d'un trait,
  le mode notes d'un changement de bordure.

## Suite

Incrément 2 : solveur logique humain (10 techniques, de Full House à X-Wing) et banc de débogage
montrant le chemin de résolution pas à pas. C'est la fondation des indices pédagogiques et de la
notation de difficulté.

Le plan complet — recherche concurrentielle, douleurs du marché, moats visés, feuille de route —
est dans `docs/plan.md`.
