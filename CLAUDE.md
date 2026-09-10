# Conventions du projet

## Langue

- **Commentaires, documentation et interface : français**, correctement accentué.
- **Identifiants, noms de fichiers, messages de commit : anglais.**

> Dette connue : une partie des commentaires écrits lors de l'incrément 1 est sans accents
> (contrainte technique de l'outillage d'écriture au moment de leur rédaction). À normaliser en
> une passe dédiée. Tout nouveau commentaire doit être accentué.

## Le moteur est sacré

`packages/engine/src` ne doit **jamais** dépendre de l'environnement d'exécution : pas de DOM,
pas de `console`, pas de `performance`, pas de stockage, pas de framework, aucune dépendance npm.

Ce n'est pas une consigne de style, c'est vérifié mécaniquement : le projet compile avec
`lib: ["ES2023"]` seul. Un `console.log` oublié casse le typecheck. Les scripts d'outillage qui
ont besoin de ces globals vivent dans `packages/engine/scripts` et ont leur propre `tsconfig`.

## Zéro dépendance copyleft

HoDoKu est en GPLv3, le portage Rust de jczsolve en AGPL, Sudoku Explainer en LGPL. Leurs
**algorithmes publiés** sont réimplémentables ; leur **code** ne doit jamais être copié, ni lié.

Sudoku Explainer sera utilisé comme **oracle en boîte noire** : on exécute le binaire pour
comparer ses scores aux nôtres, on ne lit pas ses sources. Cela préserve les options commerciale
et open source permissive.

## Tests

La suite de tests est le garde-fou de qualité du projet, pas une formalité. En particulier :

- Les invariants du moteur se testent **par propriété** (`fast-check`), pas par exemples.
- **Aucun fixture inventé.** Toute grille de référence doit avoir été vérifiée par le solveur
  avant d'être figée dans un test — une grille écrite de mémoire est presque toujours fausse.
- Les valeurs du PRNG sont verrouillées par des snapshots. **Elles ne doivent jamais changer** :
  elles garantissent qu'une grille regénérée depuis un lien ou une date reste identique d'une
  version à l'autre.

## Ordre des techniques logiques

Le score de difficulté dépend fortement de **l'ordre dans lequel les techniques sont essayées** :
deux implémentations divergent sur la même grille. Cet ordre est donc figé, versionné
(`ratingVersion`) et sérialisé avec chaque grille. Le modifier exige un bump explicite.

## Accessibilité

Non négociable, et traitée dès l'écriture, jamais en rattrapage :

- La couleur n'est **jamais** le seul porteur d'information (daltonisme, impression N&B).
- Contraste minimum 4,5:1. Palette bleu/orange, jamais rouge/vert seuls.
- Cibles tactiles ≥ 44 px.
- Toute l'interface est dimensionnée en `rem` depuis `html { font-size }` — c'est le point
  d'ancrage du futur réglage « gros caractères », attendu par un public senior très large.
- `role="grid"` est signalé comme anti-pattern potentiel hors données tabulaires : à valider par
  un test réel avec un lecteur d'écran avant de le considérer comme acquis.
- Le thème a **trois** états (clair, sombre, système) ; « système » retire l'attribut au lieu
  d'écrire une valeur. Tout accès à `localStorage` est enveloppé dans un `try` : en navigation
  privée, il lève.

## Honnêteté envers le joueur

Ne jamais afficher une difficulté qui n'est pas mesurée. Le nombre d'indices ne prédit pas la
difficulté (corrélation ≈ 0,27) ; l'annoncer comme un niveau serait mentir.

Le niveau affiché vient donc du solveur logique, et de lui seul. Trois conséquences à tenir :

- une grille que le registre ne sait pas résoudre ne reçoit **aucun** niveau ;
- quand la génération n'atteint pas le palier demandé, l'application le **dit** et propose la
  grille la plus proche, au lieu de l'étiqueter au jugé ;
- tant que la notation n'est pas calibrée contre l'oracle Sudoku Explainer, elle est cohérente
  mais **pas encore prouvée conforme** — et l'interface ne doit pas laisser croire l'inverse.

## Vérification avant de conclure

```bash
pnpm check
```

Typecheck, lint et tests. Rien n'est « terminé » tant que les trois ne passent pas.
