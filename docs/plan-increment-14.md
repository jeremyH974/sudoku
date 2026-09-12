# Incrément 14 — Le langage visuel sur le Sudoku, et la question du papier

Porter la direction artistique illustrée au reste du site. Ce n'est **pas** une refonte
mécanique : la cartographie a trouvé, dans le code existant, des décisions **documentées et
mesurées** qui contredisent frontalement le nouveau langage. Un plan qui ne les tranche pas
produirait une régression déguisée en refonte.

L'incrément se coupe en deux, parce que l'écran et le papier n'ont pas les mêmes contraintes ni
les mêmes preuves.

---

## L'état des lieux, chiffré

**84 sélecteurs** déclarent une bordure, une ombre ou un rayon, sur **6 fichiers** : `App.svelte`
(33), `ProgressPanel` (13), `AnalysisPanel` (12), `LearnPanel` (11), `SudokuBoard` (10),
`UpdateBanner` (5). `Icon.svelte` n'en a aucun.

Bonne nouvelle : **toutes les paires `:hover` / `:active` sont déjà complètes**, et déjà sous
`@media (hover: hover)`. La migration ne peut pas casser cette règle-là.

---

## 14a — L'écran

### La doctrine, et ce qu'elle refuse

Le langage ne s'applique **pas partout**, et ce n'est pas une concession : c'est ce que la
cartographie impose.

> **Il s'applique à ce qu'on regarde et qu'on presse délibérément** — cartes, panneaux, boutons de
> page, le cadre extérieur du plateau.
>
> **Il ne s'applique pas à une grille dense d'information** — les cases du sudoku, les jours du
> calendrier —, ni à **ce que le pouce recouvre**.

Cinq conflits nommés, et leur résolution :

| Le code dit | Le nouveau langage dirait | Ce qu'on fait |
|---|---|---|
| `App.svelte:1292` — « Couleur seule, **sans décalage** — sous le doigt, un décalage est caché par la pulpe » | `transform: translate(3px, 3px)` à l'appui | **Le code a raison.** Le décalage ne s'applique qu'à ce que l'œil surveille. Le pavé du pouce garde la couleur seule |
| `SudokuBoard:370` — le liseré « chiffre identique » est **volontairement un cerclage, pas un remplissage** ; rempli, il se confondait avec la case jouée | une bordure d'encre de 2 px par case | **Aucune case ne reçoit de bordure.** Le plateau reçoit son cadre et son ombre à l'extérieur, rien à l'intérieur |
| `SudokuBoard:304` — le tramage 3×3 dépend de `border-box` pour que **toutes les cases gardent la même taille** | changer les bordures internes | **On n'y touche pas.** `--grid-strong` reste le trait du quadrillage ; `--ink` ne sert que le cadre |
| `App.svelte:1346` — l'état actif d'une marque **est** son passage à 2 px | si le repos est déjà à 2 px, le signal s'aplatit | L'actif passe au **liseré intérieur d'accent**, comme dans Enquête. Le signal change de nature, pas d'existence |
| `ProgressPanel:448` — les jours du calendrier sont dimensionnés au pixel `(375−40−12)/7 ≈ 46 px`, avec un `outline` à `-2px` | une bordure de 2 px | **Le calendrier est hors périmètre.** Deux pixels de moins par case y déplaceraient une arithmétique mesurée |

### Ce qui change, alors

- **Cartes et panneaux** (`.card`, `.notice`, `.technique`, `.intro`, `.table-wrap`, `.settings-panel`,
  `.banner`, `.verdict`, `.hint`) : bordure d'encre 2 px, `--shadow-hard`, rayon `lg`.
- **Boutons de page** (`.primary`, `.secondary`, `.ghost`, `.action`, `.transport button`,
  `.settings-toggle`, `.assists-link`, `select`) : bordure d'encre 2 px, `--shadow-hard`, et à
  l'appui le décalage de 3 px avec perte d'ombre.
- **Le cadre du plateau** seulement : `--ink` et `--shadow-hard` sur `.board`, rien sur `.cell`.
- **Les bascules** (`.size-option`, `.theme-option`, `.mark-key`) : bordure d'encre au repos,
  **liseré d'accent qui s'ajoute** à l'ombre quand elles sont actives — jamais qui la remplace. Ce
  défaut a déjà été commis et corrigé dans Enquête : la carte sélectionnée y était la seule à plat.
- **Le titre de la section** prend la manuscrite, comme Enquête.

### Ce qui ne change pas, et pourquoi c'est écrit

Les liserés `inset` qui **portent de l'information** — chiffre identique, zone d'indice, motif,
conclusion, conflit — restent tels quels. Ce sont des porteurs sémantiques, pas des élévations ;
les confondre ferait entrer le décor en concurrence avec le sens.

---

## 14b — Le papier

La recherche a rapporté quatre faits qui décident, et aucun n'était connu quand la décision
« tout le site adopte le style illustré » a été prise.

1. **`box-shadow` s'imprime parfois en bloc noir plein.** Bug Chromium documenté et récent, encore
   actif dans le pipeline PDF. Une ombre décalée sur un gabarit imprimable est un risque réel, pas
   une hypothèse. Si elle devait exister sur papier, elle devrait être **reconstruite en géométrie**
   — une forme dupliquée et décalée —, jamais en `box-shadow`.
2. **`print-color-adjust: exact` n'est jamais garanti.** La spécification dit que le réglage de
   l'utilisateur — la case « graphiques d'arrière-plan », **décochée par défaut** — prime toujours.
   Une couleur de fond sur papier est donc une couleur qu'on espère, pas une couleur qu'on a.
3. **Aucun moyen de détecter une imprimante noir et blanc en CSS.** `monochrome` vise les écrans
   e-ink, pas le pilote ; le CSSWG a explicitement refusé de normaliser `prefers-color-scheme` à
   l'impression. On ne peut donc pas adapter, seulement concevoir pour le pire cas.
4. **Le code a déjà tranché, et l'a mesuré.** `print.css` force `box-shadow: none !important` à
   l'impression — la signature du style y est déjà annulée. Et `PrintableGrid` écrit que « les
   aplats de couleur coûteraient de l'encre sans rien apporter ». Ce n'est pas un oubli.

S'y ajoute une contrainte physique : les corrigés sont passés à trois colonnes après un
**débordement silencieux** — deux colonnes faisaient 311 mm sur une page de 297 —, et `.sheet`
masque le dépassement. Un cadre, une ombre ou un espacement de plus **réintroduisent une panne
qu'on ne verrait pas**.

### Ce qu'on retient pour le papier

- **La manuscrite sur les titres du cahier** : elle coûte de l'encre noire, comme le reste du
  texte, et elle relie le papier à l'écran. C'est le seul emprunt qui se paie de rien.
- **Rien d'autre.** Pas d'aplat de pièce, pas d'ombre, pas de cadre supplémentaire.
- **L'échelle de luminance**, déjà appliquée à l'écran, est ce qui rendra un plan d'Enquête
  imprimable le jour venu : les six teintes s'échelonnent désormais de 235 à 190 en gris, huit
  niveaux au moins entre voisines, là où le Salon et le Couloir tombaient tous deux sur 217.
- Si le plan d'Enquête rejoint un jour le cahier : **SVG en ligne, couleurs littérales**, sans
  `var()` ni `currentColor` ni `<mask>` — un SVG externe n'hérite d'aucune variable de la page, et
  Firefox diverge entre aperçu et impression sur les masques.

> ⚠ **Ceci contredit une instruction reçue** (« tout le site adopte le style illustré »). La
> contradiction est assumée et motivée par quatre mesures. Si la couleur sur papier est maintenue
> malgré elles, il faudra : élargir la liste d'exemption du test des jetons, reconstruire les
> ombres en géométrie, réimprimer pour recalibrer les filets, et accepter que le rendu dépende
> d'une case à cocher dans une boîte de dialogue.

---

## Vérification

`pnpm check`, plus :

- la discipline des jetons intacte — aucune couleur littérale hors `app.css`, aucun rayon hors
  échelle, toute paire `:hover` / `:active` conservée ;
- les contrastes **mesurés** de `--shadow-hard` dans les deux thèmes sur les surfaces du Sudoku,
  comme ils l'ont été pour Enquête ;
- les tests d'accessibilité existants des cinq écrans, inchangés ;
- une vérification **sur papier réel** si quoi que ce soit touche `print/` — une capture d'écran
  ne vaut pas mesure, et les filets sont calibrés à 0,5 pt.
