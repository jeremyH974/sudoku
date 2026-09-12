# Incrément 12 — Le site, et sa direction artistique

Deux décisions ont été prises, et elles changent la nature du projet : il cesse d'être **une**
application pour devenir **un site à sections**, et il adopte une direction artistique **illustrée**
partout, y compris là où le Sudoku en avait déjà une.

Ce fichier dit le programme entier, puis ce que l'incrément 12 livre seul. Le reste est
explicitement daté d'un incrément ultérieur — pas oublié.

---

## Le programme, en quatre incréments

| | Livre | Pourquoi dans cet ordre |
|---|---|---|
| **12** | La **structure** : page d'accueil, deux sections autonomes, une construction multi-pages, l'adresse prête pour un domaine | Rien d'autre ne peut être décidé avant : c'est elle qui autorise deux directions artistiques, ou une seule, sans arbitrage forcé |
| **13** | Le **langage visuel** : ombre dure, bordure d'encre, cartes, manuscrite auto-hébergée, jetons de matière — appliqué d'abord à Enquête | Le langage se met au point là où il n'y a rien à casser |
| **14** | La **migration du Sudoku et du papier** au nouveau langage | Le plus risqué : cinq écrans qui marchent, et des cahiers imprimés dont la mise en page est mesurée |
| **15** | La **bibliothèque dessinée** : portraits, décors thématiques, mobilier par décor | Le plus long, et le seul qui dépende de la qualité des dessins plutôt que du code |

## Ce que « le même style » veut dire, et ne veut pas dire

Relevé **sur le produit de référence**, pas deviné :

| | Mesuré chez `murdoku.com` |
|---|---|
| Ombre | `rgba(0,0,0,.4) 4px 4px 0 0` — décalée, **sans flou** |
| Trait | bordure `2px solid #000`, rayon `12px` |
| Dessin | SVG plats : **0 dégradé, 0 contour**, 28 chemins et **4 couleurs** pour une plante |
| Typo | Inter 400/600/800 pour l'interface, Caveat 500/700 (manuscrite) pour les noms |
| Poids | 933 ko par affaire, dont **731 ko de JavaScript** |

**On reprend la grammaire. On ne reprend aucun dessin.** La frontière n'est pas de la prudence,
c'est la ligne du droit d'auteur : le **style** n'est pas protégeable, l'**expression spécifique**
l'est — une combinaison originale de costume, palette, proportions et traits distinctifs est
protégée. C'est exactement la frontière que le projet tient déjà entre *algorithme publié* et *code
copié*.

En pratique : leurs 28 chemins de plante, leurs portraits, leur logo, leurs plans et leurs textes
sont hors de portée. La recette — aplats sans dégradé ni contour, quatre tons par objet, ombre
dure, trait d'encre — ne l'est pas.

> ⚠ **Un sosie serait aussi une mauvaise stratégie.** Au-delà du droit, un produit qui se confond
> avec un autre n'a pas d'identité à défendre. L'objectif est « du même monde », pas « du même
> auteur ».

## Les trois règles écrites que ce programme fait bouger

Aucune n'est contournée en silence ; chacune est rouverte avec sa raison.

1. **« Aucune webfont. »** Sa raison écrite était *« 25 à 40 ko pour des chiffres tabulaires qu'on
   a déjà gratuitement »*. Une manuscrite ne se trouve dans aucune pile système, et c'est elle qui
   fait qu'une carte de suspect ressemble à un dossier plutôt qu'à un formulaire. La règle devient
   donc : **une seule fonte, auto-hébergée, découpée aux caractères réellement employés,
   précachée** — jamais un tiers, jamais une requête après le chargement.
2. **« Deux élévations, douces. »** L'ombre dure est un troisième jeton, borné et déclaré.
3. **« Aucune animation d'entrée »** et **« rien ne dure plus de 200 ms »**, tenu par un test. La
   référence anime l'arrivée des cartes. À trancher à l'incrément 13, pas ici — et si la règle
   change, elle change **dans le test**, avec sa raison.

## Ce que l'incrément 12 livre

### Trois entrées, une construction

```
packages/app/
├─ index.html            → l'accueil          (src/home/main.ts)
├─ sudoku/index.html     → la section Sudoku  (src/main.ts, inchangé)
└─ enquete/index.html    → la section Enquête (src/enquete/main.ts)
```

Vite construit les trois (`build.rollupOptions.input`). Conséquence recherchée : **un joueur de
sudoku ne télécharge jamais le moteur d'Enquête**, et l'accueil ne télécharge ni l'un ni l'autre.
Un hébergeur statique sert cela nativement ; GitHub Pages aussi.

### L'adresse, et le seul vrai piège

Le choix retenu est un **nom de domaine**. Ce n'est pas un confort : GitHub Pages **ne redirige
pas** l'URL d'un site de projet quand le dépôt est renommé, et un domaine est la prévention que
GitHub documente lui-même. Sans lui, le jour où ce dépôt cesse de s'appeler « sudoku », **tous les
cahiers déjà imprimés cessent de s'ouvrir**.

En attendant que le domaine existe, la base reste `/sudoku/` et rien ne casse :

| Aujourd'hui | Le jour du domaine |
|---|---|
| `…github.io/sudoku/` — accueil | `exemple.fr/` — accueil |
| `…github.io/sudoku/sudoku/` — Sudoku | `exemple.fr/sudoku/` |
| `…github.io/sudoku/enquete/` — Enquête | `exemple.fr/enquete/` |

La redondance de `/sudoku/sudoku/` est temporaire et **assumée** : choisir un nom de section plus
laid pour embellir une adresse provisoire serait le mauvais arbitrage.

> ⚠ **La règle qui sauve les cahiers, et qu'un test tient.** Un QR code imprimé encode
> `…/sudoku/#g=…`. Cette adresse est désormais celle de **l'accueil**, qui ne sait pas jouer une
> grille. L'accueil doit donc **renvoyer tout `#g=` vers la section Sudoku**, en conservant le
> code. Le même renvoi couvre le déménagement vers le domaine, puisque GitHub redirige en
> conservant le chemin et que le navigateur rattache le fragment.

### Ce qui reste partagé, et ce qui ne l'est plus

Partagé parce que cela sert les deux sections : le moteur, `app.css`, le service worker, le thème,
le réglage de taille. Plus partagé : la coquille, la navigation, et — dès l'incrément 13 — la
direction artistique, si les deux sections devaient diverger.

## Hors périmètre de l'incrément 12, et dit

Le langage visuel · la manuscrite · les portraits · les décors · la migration du Sudoku et du
papier · les sons. Tout cela vient après, et **dans cet ordre**.

## Vérification

`pnpm check`, plus, propres à cet incrément :

- les trois entrées existent, et chacune ne cite que des fichiers qui existent ;
- **l'accueil renvoie un `#g=` vers la section Sudoku** — la règle qui sauve les cahiers ;
- la base annoncée par le README est celle que la construction sert, pour les trois entrées ;
- l'accueil passe `axe`, et ses deux destinations sont des liens nommés.
