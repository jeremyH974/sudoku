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
| **Une sortie d'IA pure n'est pas protégeable.** Aux États-Unis : *Thaler v. Perlmutter*, certiorari **refusé le 2 mars 2026** (dossier 25-449), ce qui laisse debout l'arrêt de la D.C. Circuit du 18 mars 2025 — « all eligible work [must be] authored in the first instance by a human being » | USCO, *Copyright and AI, Part 2: Copyrightability*, 29 janvier 2025 ; D.C. Cir. n° 23-5233 | Les images engendrées servent de **direction artistique**, jamais de livrable. C'est la repasse à la main qui rend l'asset protégeable |
| **Même principe en France, et formulé plus finement.** Le rapport de mission Bensamoun/Groffe-Charrier **présenté au CSPLA le 9 juillet 2026** distingue la « création hybride » — direction créative humaine identifiable, protégeable — de la « production synthétique », qui tombe dans le domaine public. L'originalité peut se loger **en amont, pendant ou en aval** : un seul de ces trois moments suffit | Rapport de mission remis au CSPLA, juillet 2026 (rapport, pas avis adopté) | La sélection et la repasse comptent comme des choix créatifs. Le prompt seul, non — des deux côtés de l'Atlantique |
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

---

# 15b — Ce que la recherche a tranché, et ce qu'on écrit

## Le résultat le plus utile est négatif

La recherche a balayé la littérature PCG (Nystrom, Adonaac, BSP, WFC, grammaires de graphes,
HouseGAN/Graph2Plan/HouseDiffusion), la conception de puzzles (Gilbert, Falstein, Nikoli), la
Space Syntax (Hillier & Hanson, 1984) et les papiers 2024-2026 sur l'entropie de puzzle. Verdict :

> **Aucune source ne chiffre une seule des bornes qu'on voulait écrire.** Ni le rapport d'aire
> acceptable entre pièces, ni la densité de mobilier, ni un diamètre ou un degré de connexion
> transposable à un plan de cinq à huit pièces. Tout ce que la Space Syntax fournit se lit
> **relativement à un corpus de bâtiments comparables**, jamais contre un seuil absolu.

Et surtout, rien ne relie empiriquement une **forme** de pièce à une richesse déductive mesurée :
la littérature de donjons parle de rythme d'action, celle de Gilbert de jeux d'aventure narratifs.
Murdoku, Clues by Sam et LinkedIn Queens sont des boîtes noires commerciales sans post-mortem.

C'est exactement la situation que le projet a déjà rencontrée avec l'effort du chemin et sa largeur
au moment le plus dur. La règle est écrite et s'applique ici sans changement :

> **Une dimension sans oracle se présente comme un compte, jamais comme une note.**

Donc : `measureScene()` **compte** et ne juge pas. Les seuils vivent à côté, sont **calibrés contre
le générateur** et non contre une source, et chacun porte en commentaire la mesure qui l'a fixé.

## L'erreur qu'on ne commettra pas

La recherche signale un piège que je n'avais pas vu : la **connexité globale du plan par les
portes** n'a aucun effet sur la logique du jeu. « À côté » se définit par l'adjacence orthogonale
**dans la même pièce** ; il n'existe pas de porte dans le modèle. Une borne de connexité globale
mesurerait donc la *plausibilité d'un appartement*, pas la richesse déductive — et la ranger avec
les autres ferait croire qu'elle sert au jeu. `buildScene()` vérifie déjà la connexité **par
pièce**, et c'est la seule qui compte.

## Ce que la géométrie change réellement, et qui se raisonne

Un seul mécanisme relie la forme au jeu, et il est assez net pour être écrit :

> **Une pièce longue ou coudée crée des paires « même pièce, mais pas à côté ».**

Dans une pièce compacte de quatre cases, presque toute paire est adjacente : « il était dans le
salon » et « il était à côté d'elle » disent presque la même chose. Dans un couloir de six cases en
ligne, les deux extrémités partagent la pièce sans jamais se toucher : les deux indices se
séparent. C'est **le** levier structurel, et les trois décors livrés l'exploitent différemment.

## Les trois décors, et le quatrième qui sert de repoussoir

Le manoir livré mesure : 5 pièces, de 4 à 10 cases (rapport 2,50), la plus grande à 28 % du plan,
19 cases meublées (53 %), 6 sortes de meubles dont 0 unique, 8 paires de pièces mitoyennes.

| Décor | Structure | Ce qu'il fait varier |
|---|---|---|
| **Manoir** (livré) | 5 pièces compactes, rapport 2,5 | La référence |
| **Le couloir** | Une pièce élancée qui traverse et touche toutes les autres | Beaucoup de paires « même pièce, non adjacentes » ; pivot **élancé** |
| **L'atelier** | Une grande salle en L (≈ 12 cases) contre de petites alcôves | Rapport d'aire élevé ; la forme en L éloigne deux coins d'une même pièce |
| **La rotonde** | Un pivot **compact** au centre, quatre pièces qui ne se touchent jamais entre elles | Diamètre minimal ; l'indice de pièce est fort, l'indice de voisinage faible |
| **L'enfilade** (*non livrée*) | Six bandes verticales en chaîne, diamètre 5 | **Cas pathologique**, gardé en fixture : les bornes doivent le **rejeter** |

L'enfilade est la preuve que les bornes servent à quelque chose. Une borne qu'aucun décor ne viole
n'est pas une borne, c'est un commentaire.

## Ce qu'on écrit maintenant pour le jour du procédural

`measureScene()` est déjà écrit et pur. S'y ajoutent :

- **`decorFaults(metrics)`** : la liste des bornes violées, vide si tout passe. Un générateur futur
  **rejettera** sur cette liste au lieu de corriger — c'est le contrat.
- **un test qui exige que chaque décor livré produise des affaires**, sur un corpus de graines,
  avec `{ decorId }` explicite. Aucun test ne le fait aujourd'hui : tout est épinglé sur `manor`.
- **un garde sur l'unicité des identifiants** : `loadDecor()` fait un `.find()`, donc un `id`
  dupliqué masquerait silencieusement le second décor.

## Vérification

`pnpm check`, plus :

- chaque décor livré produit des affaires **sur un corpus de graines**, pas sur un exemple ;
- l'enfilade est bien **rejetée** par les bornes, et pour la raison attendue ;
- les mesures des quatre décors sont affichées par `pnpm measure`, pas devinées.
