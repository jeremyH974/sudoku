# Incrément 15 — La bibliothèque dessinée

Des portraits, des décors, et le mobilier qui va avec. C'est le plus long des quatre incréments, et
le seul dont la réussite dépend des **dessins** plutôt que du code. D'où la règle qui le gouverne :

> **Un système qui engendre la cohérence, jamais seize dessins faits l'un après l'autre.**

Seize illustrations dessinées séparément ne se ressemblent pas ; seize combinaisons d'un même jeu de
pièces, si. C'est aussi ce qui rend le dix-septième personnage gratuit.

---

## Ce que la recherche a établi, et qui contraint tout le reste

| Fait | Source | Conséquence ici |
|---|---|---|
| **40 px est sous le plancher de lisibilité.** Le détail se perd sous ~60 px ; un style plat à formes franches tient jusqu'à ~48 px | Praticiens (Rec Room, Icons8) | Le portrait passe à **56 px** sur la carte. Et il reste **décoratif** : c'est la lettre qui identifie |
| **La silhouette se lit avant la couleur** ; le sourcil pèse plus que l'œil | Sinha et al., MIT | L'axe principal de distinction est la **silhouette de cheveux**, pas la teinte |
| **Aucune étude ne chiffre** le lien entre nombre de couches et distinctivité perçue | — | On ne prétendra pas le contraire. La combinatoire trompe : les Mii atteignent 10¹⁰ combinaisons pour des visages qui se ressemblent |
| **Le trait effilé n'existe pas en SVG.** Proposé en 2002, suivi depuis 2009, écarté de SVG2, toujours un brouillon non implémenté | W3C SVG WG | La ligne d'encre expressive est un **chemin rempli**, jamais un `stroke` |
| **Le cel shading est du SVG plat par nature** — un cel peint était déjà des aplats superposés | Praticiens animation | 1 aplat + 2 blocs d'ombre + 1 ligne. 20 à 40 tracés, 5 à 12 ko par portrait |
| **Une sortie d'IA pure n'est pas protégeable** — tranché aux États-Unis (certiorari refusé, mars 2026), même principe en France | USCO, Thaler v. Perlmutter, CSPLA | Les images engendrées servent de **direction artistique**, jamais de livrable. C'est la repasse à la main qui rend l'asset protégeable |
| **Écrire les décors thématiques à la main est la norme du marché**, pas un pis-aller | Observation du secteur | On continue. Le procédural est réservé à la variété de fond |
| **BSP en pavage complet** : la pièce est connexe par construction | Littérature PCG | C'est l'algorithme du jour où l'on engendrera des plans — mais la connexité se **revérifie** au flood-fill, jamais ne se déclare |

---

## 15a — Le système de portraits

### Quatre couches, seize identités choisies

| Couche | Ce qu'elle porte | Variantes |
|---|---|---|
| **Silhouette de cheveux** | l'axe principal — c'est elle qu'on lit en premier | 8 |
| **Teinte de peau** | échantillonnée sur une échelle ouverte à dix tons | 4 |
| **Teinte de cheveux** | un contraste de **valeur**, pour tenir en noir et blanc | 4 |
| **Accessoire binaire** | lève l'ambiguïté résiduelle, jamais seul porteur | 2 |

256 combinaisons pour 16 nécessaires. **On ne tire pas au hasard** : les seize sont assignées à la
main dans une table figée, en s'imposant qu'aucune paire ne partage plus d'un axe. Un tirage par
graine donnerait des sosies, comme il en donne partout ailleurs.

### Le piège nommé, pour ne pas y tomber

Faire varier **seulement** la teinte de peau produit « un seul visage, plusieurs couleurs ». C'est
un défaut documenté des systèmes d'avatars, et il se corrige en amont : chaque identité change de
silhouette **et** de teinte, jamais de teinte seule.

### Ce que le portrait n'est pas

Il est `aria-hidden`. Le nom est écrit à côté, la lettre est sur le plateau : le dessin est
**décoratif** au sens strict, et le dire est plus honnête que de lui inventer un texte de
remplacement. C'est déjà la règle du mobilier.

---

## 15b — Les décors

Trois décors de plus, écrits à la main comme le manoir, et **vérifiés par le générateur** avant
d'entrer : un décor qui ne produit pas d'affaire n'est pas un décor.

Ce qui les distingue doit être **structurel**, pas décoratif — des pièces de tailles très
différentes, un couloir qui traverse, une grande salle unique, une pièce en L. C'est la géométrie
qui fait varier les affaires, pas le nom des pièces.

Le format reste **le texte, une lettre par case** : diffable, relisible à l'œil, vérifiable sans
exécuter. La recherche le recommande explicitement tant que les décors sont écrits à la main.

### Ce qu'on écrit maintenant pour le jour du procédural

Rien de spéculatif — seulement des **bornes nommées**, qu'un générateur futur devra respecter et
qu'un décor écrit doit déjà passer : nombre de pièces, rapport entre la plus grande et la plus
petite, part de cases meublées, et **connexité vérifiée au flood-fill**. Le générateur, quand il
viendra, **rejettera** un plan hors bornes au lieu de le corriger.

---

## 15c — Le traitement

- **La ligne** : chemin rempli pour la silhouette et une ou deux mèches signature ; contour
  uniforme partout ailleurs. Le SVG ne sait pas faire autrement, et le prétendre serait faux.
- **Les tons** : les jetons de matière existants, plus un jeu de teintes de peau et de cheveux.
  Aucune couleur propre à un personnage.
- **Le thème** : SVG **en ligne** uniquement. Un `<img>` ne voit pas l'attribut de thème posé sur
  la racine — seul l'inline suit.
- **Les trames** (`<pattern>`), signature du manga : possibles, en `currentColor`, mais **petites**
  et avec une variante grossière sous `@media print` — le moiré entre la trame et le tramage de
  l'imprimante est un risque réel.

---

## Ce que cet incrément refuse

- **Les portraits engendrés livrés tels quels.** Ils ne seraient protégés par rien, ce qui
  contredit la position « tous droits réservés » du dépôt.
- **Le tirage aléatoire des identités.** Il produit des sosies.
- **Les décors procéduraux.** Pas avant que les bornes de qualité soient écrites et éprouvées sur
  des décors écrits à la main.
- **Un portrait qui porterait l'identité.** À 56 px un dessin aide ; il n'identifie pas. La lettre,
  si.

## Vérification

`pnpm check`, plus :

- chaque décor livré **produit des affaires** — vérifié par le générateur, pas par l'œil ;
- chaque décor passe les bornes nommées, connexité comprise ;
- les seize portraits sont **deux à deux distincts sur au moins deux axes**, vérifié par un test
  sur la table d'assignation plutôt que par relecture ;
- le poids du jeu de portraits reste dans le budget, mesuré et non estimé ;
- les contrastes des teintes de peau et de cheveux mesurés contre les fonds de carte, dans les
  deux thèmes.
