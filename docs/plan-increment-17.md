# Incrément 17 — Publier, puis finir le plan

## Ce que cet incrément traite

Cinq points, dans l'ordre où ils pesaient :

1. **publier** — treize commits vivaient sur `enquete` et n'avaient jamais atteint `master` ;
2. **le nom de domaine** — resté en suspens depuis l'incrément 12 ;
3. **les 4,35 s au pire cas** de la composition d'une affaire ;
4. **les portes du plan** — le dernier écart avec la référence visuelle ;
5. **la manuscrite sur l'accueil** — le seul écran resté en pile système.

---

## 1. Publier, et les deux défauts que la publication a révélés

### 3,7 Mo précachés que personne n'aurait jamais vus

La construction annonçait **74 entrées, 4 266 Kio** de précache pour une application dont le code
fait 240 ko. La cause : le glob du service worker avait gagné `avif` avec la bibliothèque de
portraits (incrément 16), et les **masters** — seize images de 1024 px, 230 ko pièce — vivaient
sous `packages/app/public/portraits/masters`, donc dans le dossier servi.

Personne ne pouvait le remarquer. Un cache hors ligne qui grossit ne casse rien : il ralentit
seulement la première visite de tout le monde, une fois, en silence.

Les masters sortent vers `assets/portraits/masters`. Ils ne sont pas supprimés — ce sont les
**négatifs** de la bibliothèque, et sans eux changer de taille ou de format imposerait de
régénérer, donc de repayer, donc d'accepter une nouvelle dérive de style.

| | avant | après |
|---|---|---|
| entrées précachées | 74 | **58** |
| poids précaché | 4 266 Kio | **600 Kio** |
| `dist` | 4,5 Mo | **824 ko** |

Deux gardes, **prouvés mordants avant d'être gardés** :

- un plafond **par fichier** sur `packages/app/public` — 96 ko, parce que c'est la forme que prend
  la faute : on dépose un fichier source dans le dossier servi. Le plus gros fichier légitime est
  le corpus du défi du jour, pesé à 66,7 ko ;
- un contrôle nommé que les masters restent hors du dossier servi, qui dit *pourquoi* là où le
  plafond ne dit que *combien*.

### La CI a échoué, et la cause était le point 3

Trois tests d'accessibilité ont fait tomber la première publication : `a11y-tabulation`,
`a11y-dimensions` et `a11y-mesure`. Ce sont **exactement les trois graines les plus lentes** du
fichier — 1 005, 825 et 825 ms de composition ici, contre une médiane à 197 ms.

Sur deux cœurs partagés avec quarante-quatre travailleurs qui se les disputent, composition + rendu
+ `axe` franchit les cinq secondes du défaut de vitest. Le symptôme ressemblait à un composant
cassé ; la cause était le chronomètre — exactement comme pour le test de propriété de `composeCase`
à l'incrément 16.

Un délai mesuré de trente secondes débloque la publication. **Ce n'est pas la correction**, et le
commentaire le dit : le joueur attend le même temps derrière « Nouvelle affaire ». Le jour où la
composition sera rapide, ce délai doit redescendre, et sa disparition sera la preuve.

---

## 2. Le nom de domaine — écarté, et ce que cela engage

### Ce que la recherche a corrigé

Trois choses tenues pour acquises étaient fausses :

- **le fichier `CNAME` ne sert à rien** quand la publication passe par un artefact d'Actions.
  GitHub l'ignore, et sa doc le dit depuis mars 2025 ; le réglage vit dans la configuration Pages
  du dépôt, nulle part ailleurs ;
- **l'ancienne adresse ne « continue pas de fonctionner »** : elle renvoie une `301` permanente,
  chemin et chaîne de requête conservés, segment du dépôt retiré. Mesuré sur cinq sites Pages
  réels, parce que GitHub ne le documente pas ;
- **et le service worker déjà installé survit à la bascule.** C'est le point qui décide de tout.

### Le piège que rien ne documente

La spécification W3C des service workers impose au contrôle de mise à jour un
`redirect mode: "error"`. Après une bascule de domaine, l'ancienne adresse ne répond plus qu'en
301 — donc précisément le cas interdit. Et la registration n'est retirée que si aucun worker actif
n'existe.

Conséquence : **tout joueur ayant déjà ouvert le site garderait sa version à vie**, servie depuis
son précache, sans jamais voir la redirection. Un rechargement n'y suffirait pas. Le remède existe
— un service worker fossoyeur — mais il doit être déployé **avant** la bascule, puisque après, plus
rien ne peut être servi à l'ancienne adresse.

S'ajoute la perte de `localStorage` : changer de domaine change l'origine, donc l'historique, la
progression, le thème et le réglage de taille de chaque joueur restent sur l'ancienne adresse.
Aucune API ne les transfère.

### La décision

**Le site reste sur GitHub Pages.** La décision engage une chose, et une seule :

> Ce dépôt ne doit **jamais** être renommé. GitHub Pages ne redirige pas l'adresse d'un site de
> projet après un renommage, et tous les cahiers déjà imprimés cesseraient de s'ouvrir.

La redondance de `/sudoku/sudoku/` reste donc, et devient un choix tenu plutôt qu'une étape.

Pour mémoire, trente-huit noms ont été testés au RDAP le 13 septembre 2026 ; dix-neuf étaient
libres en `.fr` **et** `.com`, dont `caseacase`, `deducase` et `cahierdencre`.

---

## 4. Les portes

### Pourquoi elles manquaient

Les murs étaient des **bordures de case** : deux pixels par côté, colorés là où deux pièces se
touchent. Cela tient tant qu'un mur est plein — et une bordure CSS ne sait pas s'interrompre au
milieu. Une porte y était structurellement impossible, et les cinq pièces d'un plan étaient donc
cinq boîtes hermétiques. Personne ne le remarque consciemment ; tout le monde le voit.

### La règle, tranchée en comptant

| | une porte par mitoyenneté | arbre couvrant |
|---|---|---|
| Le manoir | 8 | **4** |
| Le pavillon | 6 | **4** |
| L'atelier | 8 | **4** |
| La rotonde | 8 | **4** |

Et deux paires de pièces ne partagent qu'**une seule arête** : la porte y mangerait tout le mur.

L'arbre couvrant donne exactement `pièces − 1`, et il est **de poids maximal** — entre deux
mitoyennetés, on perce la plus large. C'est là que les portes se mettent dans un vrai bâtiment, et
cela garantit qu'un mur subsiste de chaque côté.

Une subtilité que les données ont imposée : **les frontières partagées ne sont pas toujours d'un
seul tenant.** Quatre paires, sur les quatre décors, se rencontrent en deux pans séparés. Centrer
la porte sur « toutes les arêtes » la poserait dans le mur qui les sépare, c'est-à-dire nulle part.
On regroupe donc par contiguïté et on perce le plus long pan.

### Les proportions viennent de la norme

ISO 128-23 fixe la hiérarchie des traits d'un plan de bâtiment : le mur coupé porte le trait le
plus fort, le symbole de porte le plus fin, dans un rapport de **quatre pour un**. D'où un mur de
0,12 case et un seuil de 0,03.

Mesuré au bas de la plage — fenêtre de 375 px, cases de 56,2 px :

| | mesure | seuil de la littérature |
|---|---|---|
| mur | 6,74 px | — |
| seuil | 1,68 px | 1,2 px (Ledermann 2022, tableau 8.1) |
| vide de la porte | 33,7 px | 12 px pour identifier une icône composite |

### Ce qu'on ne dessine pas, et pourquoi

**Ni vantail ni arc de débattement.** Ils codent un sens d'ouverture dont aucun décor ne dispose ;
les dessiner au hasard mettrait une information fausse sur un plan par ailleurs exact. C'est la
règle « ne jamais afficher une difficulté qu'on n'a pas mesurée », appliquée au dessin.

**Ni porte d'entrée.** Une ouverture sur l'extérieur demanderait de savoir où est la façade, et
rien dans un décor ne le dit.

### Un seul chemin, et c'est technique

Les moteurs anticrénèlent **chaque forme séparément contre le canevas** au lieu de faire un
anticrénelage de scène. Deux segments exactement jointifs laissent donc apparaître une couture
claire, qui va et vient selon le zoom et la densité d'écran. Des pans d'un seul tenant n'ont pas de
jonction à trahir — et les bouts carrés remplissent les angles en L et en T sans un tracé de plus.

En contrepartie, l'ouverture est **élargie d'un demi-mur de chaque côté** avant d'être retranchée,
pour que le vide visible mesure exactement ce que le moteur a calculé.

---

## 5. La manuscrite, et un gras qui n'existait pas

### Le défaut, livré en production

Le `h1` d'Enquête demandait `font-weight: 700` à Patrick Hand, qui ne livre **qu'un seul fichier,
en 400**. Le navigateur comblait l'écart en fabriquant le gras.

Mesuré sur ce titre même, en comptant les pixels sombres d'un rendu sur canevas :

- **+41,5 % d'encre** pour la même fonte ;
- **à chasse rigoureusement identique** — 92,72 px dans les deux cas.

Cette seconde moitié est le piège : Chromium cerne le contour au lieu d'élargir la lettre, donc une
vérification par la largeur du texte donne un **faux négatif**. C'est ce qui est arrivé à la
première mesure de cette session.

### La règle, et pourquoi pas `font-synthesis`

`font-synthesis-weight: none` aurait corrigé le rendu de la manuscrite — mais aurait laissé la
**demande** à 700. La pile de repli, elle, a un vrai gras : le titre se serait affiché en Arial gras
puis aurait basculé en manuscrite maigre. Écrire `font-weight: 400` supprime les deux défauts d'un
coup.

Un garde dans `appStyles.test.ts` refuse désormais toute règle qui cite `--font-hand` sans écrire sa
graisse, et nomme le fichier et le sélecteur fautifs.

### L'accueil entre dans le langage illustré

Il était resté à l'ancienne interface plate : pile système, bordure d'un pixel, ombre floue — sur
le **premier** écran qu'un visiteur voit. Il prend la manuscrite sur le titre et les deux noms de
jeu, le trait d'encre de deux pixels, l'ombre dure décalée de trois, et le geste d'enfoncement au
doigt.

Le corps de texte reste en pile système. Le partage titres/corps est le point, pas la décoration
partout — c'est ce que documentent Mozilla Protocol, le design system de l'État de New York, l'USWDS
et Material 3, qui réservent tous la police d'affichage aux titres et aux noms, jamais aux libellés
de contrôle.

---

## Ce qui reste ouvert

- **Le point 3 n'est pas traité.** Le délai de trente secondes des tests d'accessibilité est un
  symptôme assumé, pas une correction.
- **Les étiquettes de pièce peuvent tomber sur un meuble.** Ancrées au coin bas-gauche, elles
  évitent désormais les murs mais pas le mobilier — visible sur « Salon » du pavillon.
- **Patrick Hand a une hauteur d'x 10 % plus petite qu'Arial** et une chasse 19 % plus étroite
  (mesuré sur les binaires). Les noms de jeu sont à 22 px, sous le seuil de 24 px que Mozilla
  s'impose pour sa propre police d'affichage. À regarder si la lisibilité est mise en cause.
- **Le décalage de mise en page au chargement de la fonte n'a pas été mesuré.** Il est borné — la
  manuscrite ne sert qu'à des titres courts — mais la vérification à faire est : ces titres
  tiennent-ils sur une ligne dans les deux polices, à toutes les largeurs ?
