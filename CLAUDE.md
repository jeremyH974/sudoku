# Conventions du projet

## Langue

- **Commentaires, documentation et interface : français**, correctement accentué.
- **Identifiants, noms de fichiers, messages de commit : anglais.**

Cette règle est tenue partout depuis l'incrément 5, qui a normalisé les 10 fichiers du moteur
restés sans accents. Le contrôle qui accompagnait cette passe est réutilisable : après une
retouche de commentaires, `git diff` ne doit montrer **aucune** ligne modifiée qui ne commence
pas par `//`, `*` ou `/*`.

## Le moteur est sacré

`packages/engine/src` ne doit **jamais** dépendre de l'environnement d'exécution : pas de DOM,
pas de `console`, pas de `performance`, pas de stockage, pas de framework, aucune dépendance npm.

Ce n'est pas une consigne de style, c'est vérifié mécaniquement : le projet compile avec
`lib: ["ES2023"]` **et `types: []`**. Un `console.log` oublié casse le typecheck.

⚠ `types: []` est indispensable et facile à perdre de vue. Sans lui, tout `@types/*` installé à
la racine devient visible ici — c'est arrivé avec `@types/node`, et le garde-fou est resté
silencieusement inopérant jusqu'à ce qu'une vérification manuelle le révèle. Les tests du moteur
sont soumis à la même règle : pas de `console.log` dedans. Les scripts d'outillage qui
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
- Les valeurs du PRNG sont verrouillées par des snapshots. **Elles ne doivent jamais changer.**

> ⚠ **Un PRNG figé ne suffit pas à reproduire une grille.** `generateAtLevel` n'est reproductible
> ni d'une version à l'autre — sa recherche locale appelle `rate()` et branche sur le score, donc
> elle dépend de `RATING_VERSION` — ni même d'une machine à l'autre : elle s'arrête sur un budget
> en millisecondes, donc sur la vitesse du processeur.
>
> Tout ce qui doit être **identique pour tout le monde et pour toujours** porte donc la grille
> elle-même, jamais la graine qui l'a produite : le code imprimé sous chaque grille
> (`io/encode.ts`) et le corpus des défis quotidiens (`packages/app/public/daily/corpus.json`).

## Ordre des techniques logiques

Le score dépend fortement de **l'ordre dans lequel les techniques sont essayées** : deux
implémentations divergent sur la même grille. L'ordre est donc figé, versionné
(`RATING_VERSION`) et sérialisé avec chaque grille. Le modifier exige un bump explicite — deux
tests le vérifient et casseront.

L'ordre retenu est **le tri par difficulté croissante**, établi par la calibration et non par la
documentation, qui décrivait un ordre par familles et se trouvait fausse. Ne pas le « corriger »
d'après une source écrite : seul `pnpm calibrate` tranche.

## Conformité à l'oracle

`corpus/oracle-reference.json` fige les verdicts de Sudoku Explainer grille par grille, et
`packages/cli/src/conformance.test.ts` rejoue la comparaison **sans Java**. Le seuil d'accord
est un garde-fou : une modification du registre, d'une valeur de difficulté ou d'une détection
le fait chuter et casse la suite.

Régénérer après un changement délibéré : `pnpm calibrate`, puis vérifier que le taux ne baisse
pas avant de valider.

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
- la notation est calibrée contre l'oracle (**94,6 % d'accord exact sous 4,0**, incrément 7),
  mais **pas parfaite** : il manque encore l'Unique Rectangle et les variantes groupées au-delà
  de 4,3, et une poignée d'écarts viennent de chemins de résolution qui bifurquent. L'interface
  ne doit pas laisser croire à une exactitude totale.

## Honnêteté envers le joueur, volet statistique

Même règle, appliquée aux chiffres de l'onglet Progression :

- **un indicateur que l'échantillon ne porte pas ne reçoit aucune valeur.** Un record se dit dès
  la première partie ; une médiane exige cinq parties du même niveau, et affiche sur combien elle
  porte. En deçà, on dit ce qui manque plutôt que d'afficher un à-peu-près ;
- **une durée non mesurable est `null`, jamais approximée** — exactement comme une grille que le
  registre ne sait pas résoudre ne reçoit aucun niveau ;
- **aucun taux de réussite** : il n'y a pas de bouton « abandonner », donc pas de dénominateur
  définissable ;
- **aucun compteur n'est persisté** (série, nombre de défis). Tout se recalcule depuis
  l'historique : deux sources de vérité finissent toujours par se contredire.

## Vérification avant de conclure

```bash
pnpm check
```

Typecheck, lint et tests. Rien n'est « terminé » tant que les trois ne passent pas.
