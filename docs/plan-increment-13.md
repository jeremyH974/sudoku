# Incrément 13 — Le langage visuel

Donner à Enquête l'habillage du genre : **reprendre la grammaire, dessiner notre propre
expression.** Le Sudoku et le papier suivront à l'incrément 14 — ce sont cinq écrans qui marchent
et des mises en page mesurées, et on ne les touche pas avant que le langage soit éprouvé là où il
n'y a rien à casser.

---

## La grammaire, relevée et non devinée

| | Mesuré sur le produit de référence |
|---|---|
| Ombre | `rgba(0,0,0,.4) 4px 4px 0 0` — décalée, **sans flou** |
| Trait | bordure `2px solid #000`, rayon `12px` |
| Dessin | SVG plats : **0 dégradé, 0 contour**, 28 chemins et **4 couleurs** pour une plante |
| Typo | une grotesque pour l'interface, une **manuscrite** pour les noms |

**Ce qu'on reprend** : la recette — aplats sans dégradé ni contour, peu de tons par objet, ombre
dure, trait d'encre, manuscrite sur les noms.

**Ce qu'on ne reprend pas** : leurs tracés, leurs portraits, leur logo, leurs plans, leurs textes,
leur police. C'est la frontière du droit d'auteur — le style n'est pas protégeable, *la combinaison
originale de costume, palette, proportions et traits distinctifs* l'est —, et c'est la même que le
projet tient déjà entre algorithme publié et code copié.

> Un sosie serait aussi une mauvaise stratégie : un produit qui se confond avec un autre n'a pas
> d'identité à défendre. L'objectif est **« du même monde »**, pas « du même auteur ».

## La police — une règle qui bouge, et pourquoi elle bouge moins qu'il n'y paraît

`docs/plan.md` dit **« aucune webfont »**, et donne sa raison : *« 25 à 40 ko sur 79, pour des
chiffres tabulaires qu'on a déjà gratuitement »*. La raison est bonne, et elle ne s'applique pas
ici : une manuscrite n'existe dans aucune pile système, et c'est elle qui fait qu'une carte de
suspect ressemble à un dossier plutôt qu'à un formulaire.

Quatre candidates ont été **pesées**, sous-ensemble latin, et jugées à l'écran :

| | Poids | Verdict |
|---|---|---|
| Architects Daughter | **12 ko** | La moins chère, thématiquement juste — mais trop pâle à 16 px |
| **Patrick Hand** | **23 ko** | Retenue : lisible à 16 comme à 40 px, chaude, une seule graisse |
| Kalam 400 + 700 | 43 ko | La plus affirmée, et deux fois le budget |
| Shantell Sans 400 + 700 | 154 ko | Hors de question |

La règle devient donc : **une seule fonte, une seule graisse, auto-hébergée, précachée, jamais un
tiers.** 23 ko, soit sous le plancher que la règle elle-même citait comme son objection. Et pas
Caveat, qui est la leur.

> ⚠ **L'OFL impose de distribuer sa licence avec la fonte.** `public/fonts/OFL.txt` n'est donc pas
> une politesse mais une obligation, et un test vérifie que le fichier est là — au même titre que
> le projet vérifie déjà qu'il ne dépend d'aucun copyleft.

## Les jetons qui s'ajoutent

Bornés, déclarés dans `app.css` comme le reste, et **aucune exemption** au test des jetons.

- **`--ink`, `--ink-soft`** — le trait. Pas `#000` : un noir pur sur fond sombre n'existe pas.
- **`--shadow-hard`** — l'ombre décalée. Voir la réserve ci-dessous.
- **Cinq matières, trois tons chacune** : `--mat-wood`, `--mat-fabric`, `--mat-leaf`,
  `--mat-metal`, `--mat-stone`, chacune en `-light` / (mid) / `-dark`. Quinze jetons, et c'est
  tout : un objet se dessine avec deux ou trois d'entre eux, jamais avec une couleur à lui.

C'est ce qui distingue un **système** d'une bibliothèque d'images : un meuble nouveau se dessine
dans la palette existante, suit le thème sans retouche, et se convertit en gris pour le papier.

> ⚠ **L'ombre dure ne survit pas au thème sombre, et c'est un vrai problème.** Un décalage noir à
> 40 % est invisible sur un fond sombre — `app.css` a déjà rencontré exactement cela pour
> `--shadow-raised`, et y a répondu par un liseré. La référence, elle, n'a pas de thème sombre et
> n'a donc pas eu à trancher. Notre réponse : en sombre, l'ombre dure devient un **décalage d'encre
> claire**, qui garde la silhouette décalée sans compter sur une obscurité qui n'existe pas. À
> mesurer, pas à supposer.

## Le dessin

Refaire le mobilier en **aplats**, vu de dessus, sans contour :

- deux ou trois tons par objet, pris dans les matières ;
- un **contact** sous l'objet (un aplat décalé de la même encre douce), qui est ce qui donne le
  relief sans ombre CSS ;
- toujours la même grille de 24, pour que la scène et l'interface aient la même main.

Six meubles existent déjà en trait ; ils sont redessinés. Les portraits et les décors thématiques
restent l'incrément 15.

## Ce qui ne change pas, et ne changera pas

- **Le dessin ne porte jamais seul.** Le nom accessible de chaque case énonce la pièce, le
  mobilier et l'occupant ; un suspect porte sa **lettre**, pas seulement une couleur. Toute la
  scène peut disparaître sans que l'affaire devienne injouable, et un test le tient.
- **La couleur n'est jamais le seul porteur.** Une matière se distingue par sa **silhouette**
  autant que par son ton.
- **Aucune requête réseau après le chargement.** La fonte est servie par nous et précachée.

## La règle qu'il faudra peut-être rouvrir, et qu'on ne rouvre pas ici

La référence anime l'arrivée des cartes. Le projet interdit les animations d'entrée et plafonne
tout mouvement à 200 ms, tenu par un test. **Cet incrément n'y touche pas.** Si l'animation
s'impose, elle se décidera séparément, et la règle changera **dans le test avec sa raison écrite**
— jamais par contournement.

## Vérification

`pnpm check`, plus :

- **les contrastes mesurés, pas estimés.** La dernière passe de ce genre a trouvé un vrai défaut
  que l'œil avait laissé passer (murs sombres à 2,87:1). Tout porteur graphique d'information —
  murs, trait, jeton — passe le seuil de 3:1, et tout texte 4,5:1 ;
- **aucune adresse de fonte tierce** nulle part dans le produit ;
- **la licence OFL présente** à côté de la fonte ;
- la discipline des jetons intacte : aucune couleur littérale hors `app.css`, aucun rayon hors
  échelle, aucun mouvement au-delà de 200 ms.
