# Incrément 11 — Enquête

Un **second type de puzzle**, dans son propre onglet. Le sudoku garde le sien, intact.

---

## Ce que c'est

Un plateau N×N partitionné en **zones** (pièces). Des cases portent du **mobilier** — chaise,
tapis, plante, étagère, table, eau. **N suspects, un par ligne et un par colonne** : la solution
est une paire de permutations, pas un carré latin. Chaque suspect porte un **indice**. L'un d'eux
est la **victime**, « seule avec le meurtrier » : sa zone contient exactement deux personnes, et
l'autre est le coupable.

Une règle change toute la géométrie : **« à côté de » signifie orthogonalement adjacent _et dans
la même zone_**. Les murs bloquent le regard. Sans elle, le plateau ne serait qu'une grille ; avec
elle, le plan des pièces devient le sujet.

## Ce que la recherche a établi

Le genre existe et a son étalon grand public, `murdoku.com` — bestseller USA Today, seize
suspects sur 16×16 au palier expert. Trois faiblesses y ont été **mesurées**, pas ressenties :

| Constat | Preuve relevée |
|---|---|
| Les affaires **et leurs indices d'aide** sont écrits à la main, un par un | Le JSON d'une affaire ne contient que du texte : cinq `player_hint_N_fr` rédigés |
| La localisation est fragile — des avis rapportent des traductions qui rendent une affaire insoluble | Leur propre corpus laisse fuiter `Room 2`, `Salle 6`, `Pièce 4`, `Grotte (copie)` |
| Le plateau est **inopérable au clavier et invisible au lecteur d'écran** | Sur la page : **0** élément focalisable dans le plateau, **0** rôle de grille, **0** région `aria-live`, **225 `<img>` sur 226 sans `alt`**, trois `<canvas>` sans rôle ni nom |

La troisième ligne est le « gap n° 4 » que `plan.md` avait déjà relevé pour le sudoku —
*« Accessibilité : angle mort général »*. Il se répète ici, intact.

D'où les quatre choses que ce mode fait autrement, et qui ne sont pas des opinions :

1. **Générer au lieu d'écrire.** Décor, permutation, indices, unicité, minimisation. Et les
   indices d'aide **dérivent du solveur** : ils ne peuvent pas se désynchroniser de l'affaire,
   parce qu'ils ne sont pas stockés à côté d'elle.
2. **Un indice n'est pas du texte, c'est une contrainte typée.** Le français en est un _rendu_.
   Le solveur lit la contrainte, jamais la phrase. La classe de bug « la traduction rend
   l'affaire insoluble » devient structurellement impossible.
3. **Aucune affaire ne sort si le registre ne la résout pas sans deviner.**
4. **Le plateau est opérable au clavier et lisible au lecteur d'écran**, et le mobilier est
   *nommé*, jamais seulement dessiné.

## L'honnêteté, ici, ne se dit pas comme pour le sudoku

Le score sudoku est calibré : `serate` existe, on lui compare grille par grille. **Ce genre de
puzzle n'a aucun oracle.** La règle du projet s'applique donc telle quelle — *« une dimension sans
oracle se présente comme un compte »*.

Conséquences tenues à l'écran, pas dans ce fichier :

- l'affaire n'affiche **aucun score inventé**. Elle affiche **la technique la plus difficile que
  son chemin de résolution exige** — un fait vérifiable sur notre registre — et des **comptages**
  d'étapes ;
- l'interface **dit** que cet ordre est le nôtre et n'est calibré contre rien d'extérieur. C'est
  le même engagement que pour l'effort et la largeur du chemin au sudoku ;
- une affaire que le registre ne sait pas résoudre **ne reçoit aucun palier** — et n'est pas
  distribuée du tout, ce qui est plus simple : le générateur la rejette.

## Architecture

`packages/engine/src/investigation/` — **module frère de `logic/`, pas une variante de sudoku.**
`plan.md` interdit de généraliser en `ConstraintSet` sur un seul cas d'usage ; la question ne se
pose pas ici, c'est un autre jeu, pas un sudoku à contraintes ajoutées. Rien de `grid/`, `logic/`,
`rating/` ni `generate/` n'est touché.

```
investigation/
├─ scene/     décor, zones, mobilier, adjacence-dans-la-zone     (pur, bitsets)
├─ clues/     contraintes typées · propagateurs · rendu français
├─ deduce/    registre de techniques nommées → Step{ technique, explication, mise en évidence }
├─ exact/     solveur exact, arrêt à la 2ᵉ solution (unicité)
└─ compose/   permutation → indices vrais → unicité → minimisation → exigence de résolubilité
```

Le `Step` reprend la structure de `logic/types.ts` : **une seule source alimente le palier, les
indices en trois paliers et le banc d'analyse**, donc ils ne peuvent pas se contredire. C'est ce
qui rend gratuit le « pourquoi » d'un indice, que la référence écrit à la main.

Le générateur suit l'état de l'art documenté pour ce type de puzzle : ajout d'indices vrais
jusqu'à unicité vérifiée par le solveur exact, puis **minimisation gloutonne avec redémarrage**.

### Le domaine, et pourquoi il est en bitsets

Un suspect a pour domaine l'ensemble des cases qu'il peut encore occuper — N² bits, donc jusqu'à
256 bits en 16×16. Les mêmes opérations entières que `grid/bitset.ts` rendent les techniques
exprimables en quelques instructions au lieu de parcours de tableaux ; la différence est que la
largeur dépend de N, d'où un petit type `CellSet` sur `Uint32Array` plutôt qu'un `number`.

## La scène est dessinée — et ce que ça ne change pas

Décision prise : le plateau est une **scène dessinée**, pas une surface typographique. C'est un
écart assumé à la direction artistique de l'incrément 10, qui disait l'inverse.

Ce qu'il ne coûte pas, parce qu'on refuse qu'il le coûte :

- **aucune exception au test des jetons.** La scène reçoit une **palette bornée déclarée dans
  `app.css`** — teintes de zone, encre du mobilier, murs, sols —, pas une dispense. Une exception
  aurait été plus rapide ; une palette déclarée est ce qui tient dans six mois ;
- **le dessin est la couche de présentation, pas la couche d'information.** Sous la scène, chaque
  case reste un élément réel, focalisable, avec un nom accessible qui énonce sa zone, son
  mobilier et son occupant. Le dessin peut disparaître sans que l'affaire devienne injouable ;
- **la couleur ne porte jamais seule.** Une zone se dit par son nom et son liseré autant que par
  sa teinte ; un suspect porte sa lettre.

## Points de couture — ce qui garde les portes ouvertes

Des **coutures nommées**, pas des abstractions spéculatives : `plan.md` dit que généraliser sur un
seul cas d'usage produit une mauvaise abstraction.

| Ouverture future | Posé maintenant | Coût plus tard |
|---|---|---|
| Décors générés (au lieu qu'écrits) | Un décor est une **donnée pure**, produite derrière `loadDecor()` ; rien d'autre ne sait d'où il vient | Le générateur seul |
| Indices du second ordre, prémisses globales | `Clue` est une **union discriminée** ouverte ; un cas de plus n'en casse aucun | Le propagateur et le rendu |
| Impression du dossier | L'affaire est **sérialisable** dès maintenant (`io`) | Une feuille dans `print/` |
| Affaire du jour, partage par lien | Même sérialisation, même dérivation par date que le sudoku | Le câblage |
| Progression, statistiques | L'issue d'une partie a la forme de celle du sudoku | Une branche dans `stats.ts` |
| Paliers plus grands (16×16) | `CellSet` est dimensionné par N dès l'origine, jamais par 9 | Mesurer, puis élargir |

## Hors périmètre, et dit

Impression · statistiques · leçons · défi du jour · indices du second ordre · prémisses globales ·
décors générés · plusieurs décors. Tous sont **additifs** au sens ci-dessus : aucun ne demande de
revenir sur une décision de cet incrément.

## Vérification

`pnpm check` — typecheck, lint, tests. Et, propres à cet incrément :

- les invariants du moteur **par propriété** (`fast-check`), pas par exemples ;
- **aucune affaire inventée** : toute affaire figée dans un test est produite par le générateur
  et vérifiée par le solveur exact avant d'être écrite ;
- le plateau passe `axe` et expose chaque case — sachant, comme partout ailleurs ici, qu'un DOM
  simulé ne mesure **ni le contraste ni la taille des cibles**, qui se vérifient à la main.
