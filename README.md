# Sudoku — Moteur & Studio

Générateur et jeu de Sudoku **sans rien à installer** : tout tourne dans le navigateur.
Aucune publicité, aucun compte, aucun suivi, aucune requête réseau après le chargement.

> **En ligne : <https://jeremyh974.github.io/sudoku/>** — à ouvrir dans un navigateur, rien à
> installer. Hors ligne vérifié, installable comme une application, notation calibrée à 97,8 %
> d'accord exact avec l'oracle sous 4,0. Ce qui est garanti — et ce qui ne l'est pas — est plus bas.

## Démarrer

```bash
pnpm install
pnpm dev
```

`pnpm dev` sert l'application sous `http://localhost:5173/sudoku/`, et la racine y redirige. La
base est celle de la production, à dessein : un chemin qui l'ignorerait casse ici avant de casser
en ligne.

| Commande | Rôle |
|---|---|
| `pnpm test` | Suite de tests (unitaires + property-based) |
| `pnpm typecheck` | `tsc` sur le moteur + `svelte-check` sur l'application |
| `pnpm lint` | ESLint en mode strict typé |
| `pnpm check` | Les trois ci-dessus, dans l'ordre |
| `pnpm measure` | Mesures de performance (hors CI, dépend de la machine) |
| `pnpm build` | Build de production de l'application |
| `pnpm calibrate` | Compare notre notation à celle de l'oracle (nécessite Java, hors CI) |
| `pnpm diagnose <grille>` | Chemin de résolution détaillé d'une grille |

Le serveur sert l'accueil sous `/sudoku/`, le Sudoku sous `/sudoku/sudoku/` et Enquête sous
`/sudoku/enquete/`. Le studio d'impression est dans l'onglet « Imprimer » de la section Sudoku ;
une grille scannée s'ouvre via une adresse en `#g=…`, que l'accueil sait renvoyer.

## Le site, et ses deux sections

Ce dépôt ne sert plus une application mais un **site à deux sections**, chacune avec sa coquille
et — à terme — son habillage :

| Adresse | Ce qu'on y trouve | Poids du code de la page |
|---|---|---|
| `…/sudoku/` | **L'accueil** : deux jeux, et rien d'autre | 2,4 ko |
| `…/sudoku/sudoku/` | **Sudoku** | 134 ko |
| `…/sudoku/enquete/` | **Enquête** | 40 ko |

Ce ne sont pas des onglets d'une même application mais **trois entrées construites séparément**
(`build.rollupOptions.input`). La conséquence est mesurée dans le tableau : un joueur de sudoku ne
télécharge jamais le moteur d'Enquête, et l'accueil ne télécharge ni l'un ni l'autre. Un hébergeur
statique sert cela sans aucune réécriture d'adresse.

**La redondance de `/sudoku/sudoku/` reste, et c'est désormais un choix tenu.** Elle devait
disparaître avec un nom de domaine ; le domaine a été **écarté** (voir ci-dessous), donc elle
reste. Le choix inverse — un nom de section plus laid pour embellir l'adresse — aurait été le
mauvais arbitrage dans les deux cas.

> ⚠ **La règle qui sauve les cahiers déjà imprimés.** Un QR code imprimé encode `…/sudoku/#g=…` —
> l'adresse devenue celle de l'accueil, qui ne sait pas jouer une grille. L'accueil **renvoie donc
> tout `#g=` vers la section Sudoku**, en conservant le code, et `src/home/entry.test.ts` le tient.
> Le même renvoi couvrira le déménagement vers un domaine, puisque GitHub redirige en conservant le
> chemin et que le navigateur rattache le fragment.

### Le nom de domaine, écarté — et ce que cela engage

Les incréments 11 et 12 tenaient un nom de domaine pour acquis. Il ne l'est plus : le site reste
sur GitHub Pages, à son adresse actuelle. La décision a été prise en connaissance de son coût, et
ce coût tient en une phrase.

**GitHub Pages ne redirige pas l'adresse d'un site de projet quand le dépôt est renommé** — c'est
la seule chose que le renommage n'emporte pas. Donc, tant qu'il n'y a pas de domaine :

> ⚠ **Ce dépôt ne doit jamais être renommé.** Le jour où il cesserait de s'appeler « sudoku »,
> tous les cahiers déjà imprimés cesseraient de s'ouvrir, sans recours et sans avertissement.

Ce qu'une migration aurait coûté, mesuré avant d'être écarté, et qui vaut d'être écrit pour le
jour où la question se reposera :

- **changer de domaine change l'origine**, donc `localStorage` : l'historique, la progression, le
  thème et le réglage de taille de chaque joueur restent sur l'ancienne adresse. Aucune API ne les
  transfère ;
- **le service worker déjà installé survit à la bascule et fige l'application.** La spécification
  W3C impose au contrôle de mise à jour un `redirect mode: "error"` ; or l'ancienne adresse ne
  répondrait plus qu'en 301. La vérification échouerait indéfiniment sans jamais désenregistrer
  quoi que ce soit, et tout joueur ayant déjà ouvert le site garderait sa version **à vie**, sans
  jamais voir la redirection. Le remède existe — un service worker fossoyeur (`selfDestroying`) —
  mais il doit être déployé **avant** la bascule, puisque après, plus rien ne peut être servi à
  l'ancienne adresse ;
- **un `CNAME` n'aurait servi à rien.** Quand la publication passe par un artefact d'Actions, GitHub
  l'ignore : le réglage vit dans la configuration Pages du dépôt, et nulle part ailleurs.

Pour mémoire, `caseacase.fr` et `caseacase.com` étaient libres au RDAP le 13 septembre 2026.

## L'adresse publique

Le site est servi à **<https://jeremyh974.github.io/sudoku/>**, en fichiers statiques :
aucun serveur applicatif, aucun compte, aucune requête réseau une fois la page chargée. Chaque
push sur la branche principale la republie (`.github/workflows/ci.yml`), et **seulement si** le
typecheck, le lint et les tests passent. Ce qui part en ligne est le dossier que la CI vient de
vérifier, pas une seconde construction qui lui ressemble.

**L'installer.** Chrome et Edge proposent « Installer l'application » dans la barre d'adresse ;
Safari, sur iPhone et iPad, « Sur l'écran d'accueil » depuis le menu de partage. Installée, elle
démarre sans réseau — défi du jour compris. Une nouvelle version s'applique d'elle-même à
l'ouverture, avant le premier geste ; une fois la partie commencée, elle attend votre accord sur
une bannière, pour ne jamais recharger sous les doigts de quelqu'un en train de jouer.

**Les QR codes des cahiers** encodent l'adresse d'où le studio a été ouvert. Un cahier imprimé
depuis l'adresse publique s'ouvre donc sur n'importe quel téléphone ; un cahier imprimé depuis
`localhost` ne s'ouvre que sur la machine qui l'a produit.

**Pas de licence, et c'est délibéré.** Le dépôt est public mais n'a pas de fichier `LICENSE` :
sans licence, tous les droits restent réservés. Le code est lisible, il n'est pas réutilisable ;
l'application, elle, s'utilise librement. Les conditions de GitHub permettent seulement de le
consulter et d'en faire un fork sur GitHub même. Le choix entre MIT et Apache-2.0 reste ouvert
(`docs/plan.md`, point ouvert n° 1) : le trancher plus tard n'ouvre qu'une porte, le trancher trop
tôt pourrait en fermer une.

## Partager l'adresse

Un lien envoyé dans une conversation montre un aperçu : `og:title`, `og:description`, et une image
de 1200 × 630 qui montre **un vrai plateau avec un indice ouvert** — capturée sur la construction
de production, pas dessinée à côté du produit.

`og:url` est **omis** à dessein : les réseaux prennent alors l'adresse demandée, toujours juste, là
où une adresse écrite en dur vieillirait au premier déménagement. L'image n'a pas ce luxe — les
robots ne résolvent pas tous un chemin relatif —, alors `packages/cli/src/appBase.test.ts` la tient
à l'adresse annoncée ci-dessus, exactement comme il tient déjà la base de Vite. Elle est en
revanche **exclue du précache** : `png` fait partie des motifs, donc sans cette exclusion 47 ko
partiraient dans le cache de chaque visiteur pour une image que seuls les robots ouvrent.

Sur Android, la barre d'adresse suit enfin le thème. Deux `theme-color` sous leur `media` pour le
système ; et parce que le sélecteur a **trois** états là où une requête média en a deux, un choix
explicite insère une troisième balise devant les deux autres — le navigateur retient la première
dont le `media` correspond. Revenir à « système » la retire, comme l'attribut de thème qu'on retire
plutôt que d'y écrire « système ».

## Enquête — un second type de puzzle

La section **Enquête** n'est pas une variante de sudoku, c'est un autre jeu. Un plan de maison
découpé en **pièces**, du mobilier posé dessus, et autant de personnes que de rangées — **une par
rangée et une par colonne**. Chaque suspect porte un indice ; l'un d'eux est la victime, « seule
avec le meurtrier ». Une règle change toute la géométrie : **« à côté de » veut dire voisin
orthogonal _et dans la même pièce_**. Les murs bloquent le regard, donc le plan est le sujet.

Le genre a son étalon grand public, [`murdoku.com`](https://murdoku.com) — bestseller *USA Today*,
seize suspects sur 16×16 au palier le plus dur. Trois faiblesses y ont été **mesurées**, pas
ressenties, et ce sont elles qui ont dicté ce qui suit.

| Chez la référence | Preuve relevée | Ici |
|---|---|---|
| Affaires **et indices d'aide** écrits à la main, un par un | Le JSON d'une affaire ne contient que du texte : cinq `player_hint_N_fr` rédigés | Tout est **engendré** : décor, disposition, indices, unicité, minimisation |
| Localisation fragile — des avis rapportent des traductions qui rendent une affaire insoluble | Leur propre corpus laisse fuiter `Room 2`, `Salle 6`, `Pièce 4`, `Grotte (copie)` | **Un indice n'est pas du texte, c'est une contrainte typée** ; le français en est un rendu |
| Plan **inopérable au clavier et invisible au lecteur d'écran** | Sur la page : **0** élément focalisable dans le plan, **0** rôle de grille, **0** région `aria-live`, **225 `<img>` sur 226 sans `alt`**, trois `<canvas>` sans rôle ni nom | Chaque case est un élément réel, focalisable, dont le nom énonce la pièce, le mobilier et l'occupant |

### La partie est gardée, et l'affaire se partage

Jusqu'à l'incrément 18, rafraîchir l'onglet perdait l'affaire en cours, sans un mot. C'est réparé,
et la réparation a demandé la pièce qui manquait à **quatre** ouvertures à la fois : un **code
d'affaire**, 27 à 36 caractères, plus court qu'un code de grille.

Il porte trois choses — le décor, la victime, les indices — et **recalcule** tout le reste à la
lecture : la solution, le coupable, la difficulté. La graine, elle, n'y est pas : `composeCase`
branche sur le registre de déduction, donc une graine ne reproduit pas la même affaire d'une
version à l'autre. Ce qui doit être identique pour tout le monde et pour toujours porte donc
**l'affaire elle-même** — la même règle que le code imprimé sous une grille.

Le lien de partage s'écrit `#a=<code>`, dans le **fragment** : un fragment n'est jamais envoyé au
serveur, donc l'affaire qu'on s'échange n'apparaît dans aucun journal d'accès.

Le même code porte le **cahier imprimé** — le plan à remplir, les témoignages, un QR de reprise,
et le corrigé sur une feuille qu'on détache — d'une affaire à quarante, avec sommaire et marge de
reliure. Le plan y est dessiné à l'encre seule, sans une goutte de couleur : un navigateur
n'imprime pas les fonds par défaut, et une teinte ne survit pas à une laser noir et blanc. Sur le
papier, le nom de la pièce porte donc seul ce que la teinte double à l'écran.

Le sommaire compte les **décors**, jamais une difficulté : l'enquête n'a pas d'oracle qui la
calibrerait, et lui inventer un palier serait le mensonge que ce projet refuse partout ailleurs.

Le même code porte enfin l'**affaire du jour** : 370 jours composés une fois, vérifiés un par un, livrés
en 17 Kio avec l'application — donc jouables **hors ligne**, ce que presque aucun concurrent ne
sait faire puisque chez eux le défi vient d'un serveur. Rien n'y est promis sur la difficulté :
l'enquête n'affiche ni niveau ni score, faute d'oracle pour les calibrer.

Pas de somme de contrôle, et c'est mesuré plutôt que supposé : une affaire décodée doit avoir
exactement une solution, ce qui est un contrôle bien plus fort qu'un caractère de garde. Sur
20 000 corruptions de chaque sorte, **0 troncature** et 1 insertion se relisent encore — et la
troncature est justement le risque qu'un lien partagé court.

### L'aide ne peut pas se désynchroniser

Elle n'est pas rangée à côté de l'affaire : elle se **recalcule**, et depuis l'état du joueur. Le
registre repart de ce qui est posé sur le plan, et sa première étape *est* la prochaine déduction
possible. Les trois paliers sont ceux du sudoku — où regarder, quel raisonnement, puis le coup.

La validation suit la même logique : elle relit les **indices**, pas le corrigé. Comparer au
corrigé ne saurait dire que « trois erreurs », ce qui n'enseigne rien et laisse deviner la forme de
la solution. Relire les indices dit **lequel** est contredit.

### Ce qui est affiché, et ce qui ne le sera pas

Le score du sudoku est calibré : `serate` existe, on lui compare grille par grille. **Ce genre de
puzzle n'a aucun oracle.** La règle du projet s'applique donc telle quelle — *une dimension sans
oracle se présente comme un compte*.

Une affaire affiche donc deux **comptages** : le nombre de déductions de son chemin, et **la
technique la plus difficile qu'il exige** — un fait vérifiable sur notre registre, nommé et
versionné. Aucun score, aucune étoile, aucun palier inventé, et l'écran **dit lui-même** que cet
ordre est le nôtre et n'est calibré contre rien. Ce qui est garanti, en revanche : l'affaire
n'admet qu'une solution, et le registre sait la trouver **sans jamais essayer une case au hasard** —
une affaire qu'il ne termine pas n'est pas étiquetée « experte », elle n'est pas produite.

### L'habillage : reprendre un style, dessiner sa propre expression

Enquête emprunte la **grammaire visuelle** du genre — relevée sur `murdoku.com`, pas devinée :
ombre portée **décalée sans flou**, trait d'encre de 2 px, rayon de 12 px, **aplats sans dégradé
ni contour**, et une **manuscrite** sur les noms.

Ce qui n'est pas emprunté : leurs tracés, leurs portraits, leur logo, leurs plans, leurs textes,
leur police. C'est la frontière du droit d'auteur — le style n'est pas protégeable, *la combinaison
originale de costume, palette, proportions et traits distinctifs* l'est —, et c'est la même que ce
projet tient entre **algorithme publié** et **code copié**. Un sosie serait d'ailleurs une mauvaise
stratégie : un produit qui se confond avec un autre n'a pas d'identité à défendre. L'objectif est
« du même monde », pas « du même auteur ».

**Le système, et pourquoi c'en est un.** Cinq **matières** — bois, tissu, feuillage, métal,
pierre —, trois tons chacune, plus deux encres. Un meuble se dessine dans cette palette, jamais
avec une couleur à lui : il suit le thème sans retouche et se convertira en gris pour le papier.
Et comme des aplats n'ont pas de contour, la silhouette est une **forme pleine d'encre** posée
sous l'objet. Ce n'était pas un choix esthétique mais une mesure : les tons de matière plafonnent
à 3:1 contre les teintes de pièce, là où l'encre douce tient 5,2:1.

**La règle qui a bougé, et de combien.** `plan.md` disait « aucune webfont », et donnait sa
raison : *« 25 à 40 ko pour des chiffres tabulaires qu'on a déjà gratuitement »*. Aucune pile
système ne contient une écriture manuscrite, et c'est elle qui fait qu'une carte de suspect
ressemble à un dossier. Quatre candidates ont été **pesées** puis jugées à l'écran — Architects
Daughter 12 ko mais trop pâle, Kalam 43 ko, Shantell Sans 154 ko — et **Patrick Hand** l'emporte à
**23,4 ko**, une seule graisse, sous le plancher que la règle citait elle-même. Elle est servie par
nous, précachée, jamais par un tiers, et sa licence OFL l'accompagne comme l'OFL l'exige. Trois
tests le tiennent, dont un qui interdit le retour en arrière le plus tentant : une ligne d'import
Google Fonts collée « juste pour essayer ».

**Deux défauts trouvés en mesurant, pas en regardant.** L'encre douce à 4,28:1 sur la teinte de
pièce la plus claire — suffisant pour une silhouette, insuffisant pour le **nom manuscrit d'une
pièce**, qui est du texte et demande 4,5. Et l'ombre dure, invisible en thème sombre : un décalage
noir à 32 % n'existe pas sur un fond sombre. Elle y prend donc une **encre claire**, ce qui garde
la silhouette décalée sans compter sur une obscurité qui n'est pas là. La référence, elle, n'a pas
de thème sombre et n'a pas eu à trancher.

### Le plateau est dessiné, et cela ne coûte aucune règle

C'est un écart assumé à la direction artistique de l'incrément 10, qui disait « le plateau est une
surface d'information, pas une scène ». Le plan des pièces **est** le sujet des indices, et un plan
qui ne se voit pas ne se raisonne pas.

Ce que l'écart ne coûte pas : **aucune exemption** au test des jetons. La scène reçoit une palette
bornée, déclarée dans `app.css` comme le reste, qui suit le thème. Et le dessin reste une couche de
présentation : le mobilier est **nommé** dans le nom accessible de chaque case, un suspect porte sa
**lettre** et pas seulement une pastille, et une case fermée le dit en toutes lettres. Le dessin
peut disparaître sans que l'affaire devienne injouable.

Les contrastes de cette palette ont été **mesurés**, pas estimés, et la mesure a trouvé un vrai
défaut : en thème sombre, les murs valaient 2,87:1 contre la teinte de pièce la plus sombre — sous
le seuil de 3:1 que WCAG demande d'un objet graphique porteur d'information, et un mur est
exactement cela, puisque c'est par lui qu'une pièce se lit. À l'œil, ils semblaient parfaitement
nets. Le trait sombre a donc été éclairci (3,8:1) et ne suit plus celui du sudoku.

Mesuré aussi : sur quatre cents affaires et les quatre décors, une affaire 6×6 coûte **101 ms** à
la médiane, 343 ms au neuvième décile et 1,6 s au pire — elle passe par le Worker, comme les
grilles, sous un libellé qui dit « Composition… ». La propagation, le solveur exact et le registre valent 0,1 ms chacun. Et
sur 375 px : plan de 343 px, cases de 56 px, tous les boutons à 44 px ou plus, aucun débordement
horizontal, et le réglage « gros caractères » fait bien passer les lettres de 24,0 à 30,5 px — le
levier `--text-scale`, celui qui agit là où la largeur est déjà bornée par l'écran.

## Le parti pris

La quasi-totalité des applications de Sudoku déduit la difficulté du **nombre d'indices**
(« Facile 36-45, Expert 22-27 »). C'est mesurablement faux : la corrélation entre le nombre
d'indices et la difficulté réellement ressentie par des joueurs humains est d'environ **0,27**,
là où une métrique simulant un raisonnement humain atteint **0,95**
([Pelánek, arXiv:1403.7373](https://arxiv.org/abs/1403.7373), 1 700+ grilles).

C'est la source directe de la plainte la plus répandue chez les joueurs — des niveaux
incohérents entre eux et entre applications.

Ici, la difficulté est **mesurée** : un solveur logique résout la grille comme le ferait un
humain, en n'appliquant que des techniques nommées, et le niveau annoncé est celui de la
technique la plus difficile réellement nécessaire. Rien n'est déduit du nombre de cases vides.

## Les niveaux

Six paliers, définis par ce qu'ils exigent — jamais par le nombre d'indices. Le barème est celui
de **Sudoku Explainer**, la référence du domaine.

| Niveau | Exige au plus | Score |
|---|---|---|
| **Facile** | Singles cachés | ≤ 1,5 |
| **Moyen** | Single nu, variantes directes | ≤ 2,3 |
| **Difficile** | Paires pointantes et revendiquées | ≤ 2,8 |
| **Expert** | Paire nue, X-Wing, paire cachée | ≤ 3,4 |
| **Maître** | Triplet nu, Swordfish, triplet caché, Skyscraper | ≤ 4,0 |
| **Diabolique** | Cerf-volant, Turbot Fish, XY-Wing, XYZ-Wing, quadruplets, Jellyfish | ≤ 5,4 |

Repère : **les sudokus de presse plafonnent presque tous à 3,0.** Notre palier « Difficile »
atteint déjà ce plafond.

Au-delà de 5,4 il faut des chaînes, absentes de ce registre. Les grilles qui les exigent sont
**rejetées à la génération**, jamais étiquetées au jugé.

## Les indices, en trois paliers

Le reproche le plus constant fait aux applications existantes est que leur indice donne la
réponse sans rien enseigner — y compris chez les concurrents payants, qui ne nomment même pas
la technique employée. Ici la révélation est graduée :

1. **la zone** — « un raisonnement s'applique par ici » ;
2. **la technique**, nommée et expliquée, avec le motif encadré sur la grille ;
3. **le coup**, en dernier recours seulement.

L'indice part de **l'état réel de la partie**, pas de la grille de départ. Si une valeur posée
est fausse — même sans conflit visible — il le dit plutôt que de conseiller dans le vide.

## La partie est sauvegardée

Fermer l'onglet et revenir plus tard ne coûte rien : grille, saisies, notes, historique
d'annulation et case sélectionnée sont conservés. La perte de progression est la huitième
douleur relevée chez les joueurs de sudoku ; elle n'a pas lieu d'être.

`localStorage` plutôt qu'IndexedDB : une partie tient dans quelques centaines d'octets, et le
stockage synchrone garantit que l'état est là **avant le premier rendu**, sans scintillement.
IndexedDB imposerait un schéma, des migrations et de l'asynchrone pour un besoin qui tient en une
ligne — il se justifiera le jour où l'on stockera une bibliothèque ou des statistiques.

Trois règles tenues : le format est **versionné** (une sauvegarde d'une autre version est ignorée,
jamais devinée), tout accès est enveloppé dans un `try` (en navigation privée, la simple lecture
lève), et une sauvegarde corrompue fait repartir sur une partie neuve plutôt que de planter.

L'écriture est **différée** de 400 ms, avec un enregistrement immédiat quand l'onglet passe en
arrière-plan : sauvegarder à chaque frappe sérialiserait la partie des dizaines de fois par minute.

## Apprendre technique par technique

Les indices savaient déjà **nommer** une technique et expliquer la déduction. Ils ne savaient pas
l'**enseigner** : rien ne permettait de produire une grille qui exige une technique précise et rien
de plus difficile.

L'onglet **Apprendre** couvre les vingt-quatre techniques du registre, en quatre chapitres coupés
là où le genre de raisonnement change — voir à l'œil, écarter au lieu de poser, réserver des cases
ou des chiffres, raisonner à distance. Chaque technique se lit, puis se pratique.

### L'exercice commence au moment intéressant

Le défaut des tutoriels existants est de faire poser quarante singles avant de rencontrer le motif
annoncé. Ici, l'exercice **reprend la grille à l'instant précis où la technique devient
nécessaire** : les cases déjà déduites sont posées, les candidats sont écrits, et il ne reste que
le raisonnement à trouver.

Le mécanisme naïf — figer les valeurs de cette position en une nouvelle grille — ne marche pas, et
la mesure a été nette : **sur treize techniques, il ne tient que quatre fois**. Une position en
cours de résolution porte des candidats déjà écartés par les étapes précédentes, et ce sont
précisément ces éliminations qui rendent la technique nécessaire. Les redériver depuis les valeurs
les fait réapparaître, et une technique plus simple redevient applicable : l'amorce « X-Wing »
s'ouvrait alors sur une paire pointante. La position transporte donc ses candidats — et c'est
aussi ce qui empêche l'indice de contredire la leçon sur l'écran même qui prétend l'enseigner.

### Ce que la génération par technique a demandé

Les paliers ne suffisent pas : ce sont des bandes de scores, et une bande contient plusieurs
techniques. Sur vingt-quatre tirages ciblés par palier, le X-Wing sortait dix fois en Expert,
mais le Swordfish, le triplet caché, le XYZ-Wing et le Jellyfish **jamais**.

Deux mesures ont façonné la solution, toutes deux contre-intuitives :

- **un plafond serré vaut mieux qu'une marche libre.** À plafond ouvert, le triplet nu, le
  Swordfish et le Jellyfish échouent tous les trois en 45 s ; à leur propre difficulté, ils
  sortent en 3,7 s, 6,9 s et 39 s. Le plafond ne fait pas que filtrer la sortie : il **retient**
  la marche dans la région utile au lieu de la laisser fuir vers 4,2, où les wings abondent ;
- **récolter au vol** tout candidat qui convient déjà, au lieu de ne juger que le point d'arrivée
  de la marche, transforme un échec en 45 s en une réussite en 3,5 s.

Deux sondes préparatoires avaient conclu que le **quadruplet nu était structurellement hors
d'atteinte** — zéro occurrence sur près de 22 000 échanges. La génération complète en produit
**trois en 55 secondes**. La différence tient à trois choses : plusieurs graines, l'abandon de la
symétrie (décorative, mais très contraignante), et la récolte au vol. Les vingt-quatre techniques
ont donc un exercice, et ce nombre est une **mesure**, pas une intention : un test le vérifie et
tomberait si une évolution du registre en rendait une inatteignable.

### Le corpus, et ce qu'il ne porte pas

72 grilles, **2,1 Ko compressés**, figées et versionnées pour les deux raisons déjà connues du
défi quotidien : la génération dépend du barème *et* de la vitesse de la machine. Il ne porte que
**la grille** — ni le score, ni le niveau, ni l'index de l'étape. Ce dernier point est le plus
important : figer « la technique est à l'étape 41 » paraît économique, mais un changement de
barème ferait pointer cet index sur autre chose, en silence. En cherchant la première étape qui
emploie la technique, on obtient soit une vraie occurrence, soit rien — et « rien » se dit.

`pnpm lessons` régénère le corpus en cinq minutes.

### Une progression qui ne compte que ce qu'elle observe

Par technique : le nombre d'exercices terminés, et combien l'ont été sans indice. Rien d'autre.

- **aucun pourcentage de maîtrise** : il faudrait un dénominateur — les exercices *tentés* — que
  rien n'observe, puisqu'il n'y a pas de bouton « j'abandonne ». C'est la raison qui avait déjà
  fait écarter le taux de réussite ;
- **aucune médiane par technique** : cinq échantillons d'une tâche de trente secondes ne portent
  rien, et surtout les exercices d'une même technique **partent de positions différentes**. Leurs
  durées ne sont pas comparables entre elles, même en principe ;
- **aucune barre « 21 sur 24 »** : elle compterait comme des échecs des techniques que le joueur
  ne peut pas pratiquer.

Et les exercices sont **exclus** des statistiques par niveau. Un exercice de quarante secondes
dans la même médiane qu'une Diabolique de quarante minutes produirait un chiffre qui a l'air
mesuré et ne l'est pas.

## La progression, et le défi quotidien

Six grilles par jour, **une par niveau**. L'argument du « tout le monde résout la même grille »
vaut chez les concurrents parce qu'ils ont un classement en ligne ; nous n'en avons pas et n'en
voulons pas. Sans classement, une grille unique exclurait simplement le débutant le vendredi et
ennuierait l'expert le lundi.

**Le défi du jour fonctionne hors ligne** — ce que presque aucun concurrent ne sait faire, parce
que chez eux il vient d'un serveur.

### Pourquoi le quotidien est un fichier, et non un calcul

Le réflexe est de dériver la grille du jour d'une graine-date. La signature l'accepte déjà. C'est
un piège, et il se referme deux fois :

- **la génération dépend de la notation.** `climb()` appelle `rate()` à chaque échange et branche
  sur le score. `RATING_VERSION` est passé de 2 à 4 en deux incréments — le calendrier d'un joueur
  aurait continué d'afficher ses jours résolus, mais pour d'autres grilles ;
- **la génération dépend du temps réel.** Elle s'arrête sur un budget en millisecondes, donc sur
  la vitesse de la machine. Un vieux téléphone n'aurait jamais eu le même défi qu'un portable
  récent.

Le corpus est donc produit une fois par `pnpm dailies`, vérifié grille par grille, et versionné.
Le même raisonnement que pour le code imprimé : ce qui doit être identique pour tout le monde et
pour toujours porte **la grille**, jamais la graine.

274 jours, 1 644 grilles, **43 Ko compressés** — soit le poids de l'application elle-même, la
borne qu'on s'était fixée avant de mesurer. Un test échoue quand il reste moins de soixante jours
de corpus : l'échéance se signale avant la panne, pas après.

### La série a un filet

Les défis passés restent jouables indéfiniment, et la série compte les **jours résolus**, peu
importe quand ils l'ont été — rattraper dimanche les cinq jours de la semaine reconstitue la
série. Une série qui punit un jour manqué est exactement le levier de pression que ce projet
reproche au marché, au même titre que la limite de trois erreurs.

Un jour compte dès qu'**une** de ses six grilles est résolue : rien ne justifie qu'un débutant
régulier soit moins bien traité qu'un expert intermittent.

### Des statistiques qui ne mentent pas

La règle « ne jamais afficher une difficulté qui n'est pas mesurée » a un pendant chiffré :
**un indicateur que l'échantillon ne porte pas ne reçoit aucune valeur.**

| | |
|---|---|
| Un record | dit dès la première partie — un record sur un échantillon de un reste un record |
| Une médiane | cinq parties du même niveau minimum, et l'effectif est affiché à côté. En deçà : « encore 3 parties », plutôt qu'un chiffre présenté comme un fait |
| Médiane, pas moyenne | la distribution des durées a une longue queue ; une partie interrompue déplacerait une moyenne de plusieurs minutes |
| Jamais tous niveaux confondus | une durée agrégée ne mesure pas l'habileté du joueur, mais ce qu'il a choisi de jouer |
| Aucun taux de réussite | il n'y a pas de bouton « abandonner » : le dénominateur n'est pas définissable |

Le chronomètre se met en pause dès que l'onglet cesse d'être regardé — trois événements et non un
seul, car sur iOS `visibilitychange` n'est fiable ni au verrouillage ni au balayage vers
l'accueil. Et lorsqu'il ne peut pas savoir — l'onglet resté visible pendant un déjeuner — la
partie est enregistrée **sans durée** plutôt qu'avec une durée fausse.

## Le thème

Trois états — clair, sombre, **système** — et non deux. « Système » n'est pas un défaut qu'on
remplacerait au premier clic : c'est le choix de suivre le rythme de la machine, qui bascule
souvent au coucher du soleil. Il se traduit par l'absence d'attribut sur le document, ce qui
laisse `prefers-color-scheme` reprendre la main et suivre un basculement sans rechargement.

La préférence est appliquée par un script inline **avant le premier rendu** : sans cela, la page
s'afficherait une fraction de seconde en clair avant de basculer — un flash blanc en pleine nuit.

## Les réglages, et les aides qu'on peut éteindre

Les réglages — taille du texte et thème — occupaient la place de la navigation : l'en-tête portait
le titre, **puis** les préférences, et les onglets venaient après, sur chacun des cinq écrans. Ils
sont maintenant repliés derrière un bouton « Réglages », dans l'en-tête : un repère de page existe
déjà, le panneau s'y range sans qu'on en ajoute un.

Le même panneau porte les **aides pendant la partie**, activables une par une :

| Aide | Ce qu'elle fait |
|---|---|
| Surligner les chiffres identiques | Entoure d'un liseré les cases qui portent le chiffre de la case choisie |
| Surligner la ligne, la colonne et le bloc | Teinte les cases que la case choisie voit |
| Signaler les conflits | Marque les cases en contradiction — par un fond **et** une barre, jamais par la couleur seule |
| Compter les erreurs de saisie | Affiche le compte dans la ligne d'état |

Elles existent parce qu'un premier regard extérieur s'est arrêté là : « pourquoi quand j'ajoute un
chiffre dans une case, ça me met les mêmes chiffres dans les autres carrés ? » Le surlignage des
chiffres identiques avait été lu comme **une saisie de l'application**. D'où deux corrections : le
liseré a remplacé le fond plein — un cadre ne ressemble pas à un chiffre posé — et les aides
s'éteignent. Un bouton « Aides pendant la partie · 4 sur 4 · Modifier » les rend trouvables depuis
l'écran de jeu, puisque c'est là qu'on les cherche.

## L'échelle, et ce qui la tient

Neuf incréments avaient produit une couche de couleurs excellente — nommée par rôle, auditée en
contraste — et, à côté, un style improvisé fichier par fichier. Compté avant d'y toucher :

| Axe | Avant | Après |
|---|---|---|
| `border-radius` | 10 valeurs sur 40 sites (`9px`, `7px`, `6px`, `5px`, `3px`…) | 4 jetons |
| `font-size` | 22 valeurs en rem sur 62 sites — `0.85`, `0.86`, `0.87` et `0.88` sont quatre tailles dans un demi-pixel | 6 jetons |
| Espacement | ~38 magnitudes | 7 jetons |
| `:active` | **aucun**, sur une application dont la cible première est le doigt | partout où l'on presse |
| `:hover` | 5 règles, **aucune** sous `@media (hover: hover)` | protégées, et étendues |

Les deux dernières lignes sont des **défauts**, pas des inégalités de style : au doigt, un
navigateur mobile émule le survol au toucher et le laisse collé — on posait un chiffre et la touche
restait éclairée —, et sur tactile `:active` est le seul état qui existe.

Les graisses `620` et `650` ont disparu après mesure : le même texte rendu en canvas puis comparé
pixel à pixel donne **zéro** différence entre 620 et 600, **zéro** entre 650 et 700. Les chiffres
donnés du plateau et les candidats marqués avaient donc déjà la même graisse, sans que personne
l'ait voulu.

Ce qui tient l'échelle n'est pas ce paragraphe : c'est `packages/cli/src/appStyles.test.ts`, onze
règles qui refusent un rayon littéral, une taille en rem hors jeton, une graisse hors
{400, 500, 600, 700}, une couleur hors `app.css`, un mouvement de plus de 200 ms, un `:hover` hors
`@media (hover: hover)`, un survol sans son `:active`, ou une unité de fenêtre. **Une seule
exception, permanente : les quatre fichiers du papier**, qui vivent en millimètres et n'ont pas de
thème ; elle prend la forme d'une liste de chemins, de sorte qu'un fichier renommé en sorte au lieu
d'y entrer en silence.

Le reste se voit plus qu'il ne se raconte : les huit glyphes Unicode `☀ ☾ ◐ ◀ ▶ ⏮ ⏭ ✓` sont devenus
des tracés — leur couverture et leur poids optique variaient d'un appareil à l'autre, or la coche
dit « défi résolu » sans la couleur ; la marque du damier est posée à côté du titre, en
`currentColor` et dimensionnée en `em`, donc soumise au réglage de taille ; la barre de progression
du studio d'impression est dessinée, la balise native ignorant la palette en thème sombre.

**Aucune webfont**, et c'est un refus argumenté : un variable woff2 sous-ensemblé coûterait 25 à
40 ko sur les 79 ko compressés de l'application (61,7 de JavaScript, 8,4 pour le moteur en worker,
7,1 de CSS, 2,1 de runtime Workbox), pour une application dont l'argument est de peser peu et de
tourner hors ligne. Le seul gain technique réel — les chiffres tabulaires — est déjà là, et
gratuit. Toute la passe, jetons, états, icônes, marque et aides comprises, a coûté **1,4 ko
compressé**.

## Sur un téléphone, et pour qui en a besoin

L'incrément 8 a commencé par un audit, et l'audit a trouvé pire que ce qui était consigné.

| Constat, mesuré sur 375 × 667 | Après |
|---|---|
| La grille débordait horizontalement de 2 px sous 400 px — elle se mesurait contre la **fenêtre**, alors que sa boîte est la fenêtre moins le remplissage de page | Elle se mesure contre son conteneur. C'est la classe de défaut qui disparaît, pas l'occurrence |
| Le pavé de saisie était **entièrement sous la ligne de flottaison** : bord haut à 590 px pour 553 px visibles | Il quitte le flux et se pose sous le pouce, en cinq colonnes sur deux rangées |
| Le réglage « gros caractères » n'avait **aucun effet** sur la grille : plateau et chiffres étaient verrouillés à la fenêtre entre 338 et 585 px | Chiffres de 21,0 à 26,6 px sur le même téléphone |
| Des cibles tactiles à 36 px, sous un commentaire affirmant tenir les 44 | 44 px partout, mesuré bouton par bouton |

### Le pavé quitte le flux, et pourquoi c'était inévitable

L'arithmétique commande : en-tête, onglets, grille et ligne d'état consomment 543 px pour 553 px
visibles. **Aucune disposition** ne fait tenir en plus un pavé de saisie, et rétrécir la grille
donnerait des cases de 17 px. La barre se détache donc sur un critère de **hauteur** et non de
largeur — une tablette de 768 × 1024 a de la place et garde la disposition empilée, un téléphone
en paysage n'en a pas.

Ce qui reste, dit franchement : avec cinq onglets sur deux rangées et le bandeau des marques
ouvert, la grille commence à 218 px et il en reste 440 au-dessus de la barre. Une ou deux rangées
se font donc défiler. C'est le prix d'une grille carrée de 343 px sur un écran de 667, tenu sans
rogner une seule cible tactile.

### Deux leviers pour la taille du texte

Le réglage a trois paliers nommés, et agit sur deux choses à la fois, parce qu'un seul levier ne
suffisait pas : `html { font-size }` fait grandir tout ce qui est en `rem` — **y compris la
grille** là où l'écran le permet — et `--text-scale` fait grandir les chiffres **à l'intérieur**
d'une grille dont la largeur est déjà bornée par le téléphone. C'est le second qui sert au public
senior, et c'est exactement celui qui manquait.

Aucune unité de fenêtre ne subsiste dans les styles de l'application. **Un test le vérifie** :
c'est ce qui avait laissé l'ancrage `rem` pourrir sans que rien ne le signale.

### Colorier un candidat, pas une case

Réclamée depuis des années, absente presque partout. Trois marques, nommées **A**, **B** et **C** —
jamais par leur couleur. Chacune porte en plus un tracé distinct et **son nom dans le libellé lu à
voix haute** : « notes 5 7, 5 marqué A, 7 marqué C ». C'est le seul porteur qui ne se dégrade ni à
huit pixels, ni en noir et blanc, ni pour un daltonien.

À 375 px, un candidat occupe 12 px : **une cible de 44 px ne peut pas exister dans la grille.**
Rien ne demande donc d'en viser une — on touche la case, puis la touche de marque (109 × 46 px),
puis le chiffre. Le bandeau des marques n'apparaît qu'en mode notes, ce qui rend le lien visible
au lieu de l'expliquer.

Le modèle de données n'est pas celui auquel on pense : empiler les marques dans le tableau des
notes le porterait à 36 bits, au-delà d'un entier 32 — et ce tableau **est** le masque de
candidats transmis au moteur. Un second tableau de 81 nombres, deux bits par chiffre, garde le
premier intact et reste **additif** en sauvegarde : personne ne perd sa partie en cours à la mise
à jour. Un test relit une sauvegarde écrite avant l'existence des marques.

### Ce que les tests d'accessibilité vérifient, et ce qu'ils ne vérifient pas

`axe-core` tourne sur les cinq onglets à chaque `pnpm test` : rôles, noms accessibles, ordre des
titres, repères, validité ARIA. Il a déjà trouvé un enchaînement de titres rompu depuis
l'incrément 2, et un second `h1` sur la feuille imprimée.

**Il ne voit ni le contraste ni la taille des cibles** — aucun DOM simulé ne calcule de mise en
page. Ces deux règles restent vérifiées à la main, exactement comme l'impression : « manuel et
assumé ». Une exécution verte ne vaut pas mesure, et le code le dit à l'endroit où on pourrait
l'oublier.

Les avertissements d'accessibilité du compilateur Svelte sont désormais **bloquants**. Ils étaient
au nombre de zéro : c'est un cliquet gratuit, pas un chantier.

## La deuxième dimension : ce que le chemin coûte, et sa largeur

Le plan promettait trois dimensions de notation. Une seule existait — le score pic, calibré. Les
deux autres avaient été différées deux fois, explicitement, « une fois le score pic calibré contre
l'oracle ».

### La définition écrite dans le plan était fausse

Le plan définissait la tension comme « le nombre d'étapes où une seule technique débloque la
suite ». Mesuré sur **1 928 étapes** : 8,8 entrées du registre s'appliquent en moyenne à chaque
étape, et **0,3 %** n'en ont qu'une. Cette définition rendrait zéro pour presque toute grille.

La raison est structurelle : poser un chiffre le retire des candidats de vingt voisines, donc un
single caché réapparaît presque toujours quelque part. Ce n'est pas le jeu qui est tendu en
général — c'est **l'instant où la grille exige sa technique la plus difficile**.

### Ainsi mesurée, elle sépare deux grilles de même palier

Sur 360 grilles du corpus quotidien réellement livré :

| Niveau | min | médiane | max | grilles à **une seule issue** |
|---|---|---|---|---|
| Facile | 4 | 16 | 70 | 0 % |
| Moyen | 6 | 15 | 40 | 0 % |
| Difficile | 2 | 8 | 20 | 0 % |
| Expert | 1 | 4 | 12 | 8 % |
| Maître | 1 | 6 | 12 | 5 % |
| **Diabolique** | 1 | **2** | 6 | **37 %** |

Une Diabolique sur trois n'offre **qu'un seul coup jouable** au moment le plus dur. À « Expert »,
de 1 à 12 issues — un facteur douze que le score pic, identique, ne dit pas. C'est la différence
entre une grille franche et une grille brutale, et personne ne la mesure.

Ce sont des **conclusions** qui sont comptées, jamais des motifs. Un single caché se voit à la
fois dans sa boîte et dans sa ligne ; une paire nue et la paire cachée complémentaire écartent
les mêmes candidats. Compter les motifs ferait dépendre la mesure du découpage de notre registre.

### Le « score travail » n'est pas livré, et voici pourquoi

Le plan annonçait une somme pondérée à la HoDoKu, sur une échelle de 450 à 2000. Le calcul serait
gratuit. Mais **il n'existe aucun oracle pour le vérifier** — `serate` ne rend que le pic — et
notre registre de vingt-quatre techniques n'est pas celui de HoDoKu. Publier « travail : 1 250 »
serait annoncer un nombre que personne ne peut contredire, c'est-à-dire exactement le défaut que
ce projet existe pour corriger.

Ce qui est livré se compte : **combien de déductions demandent d'écrire les candidats**, c'est-à-
dire les étapes à 2,6 et au-delà. Ce n'est pas une pondération déguisée — le registre étant essayé
par difficulté croissante, une étape à 2,6 est littéralement un moment où aucun raisonnement
« à l'œil » n'était disponible. Mesuré : Difficile 1 en médiane, Expert 3, Maître 4, Diabolique 4,
sur des plages de 0 à 13. Le nombre **total** d'étapes, lui, ne sépare rien (49 à 63 partout).

### Ce qui est affiché, et ce qui ne sera pas prétendu

Le verdict porte les trois nombres et, sous un dépliant, **lequel est calibré et lesquels ne le
sont pas**. C'était l'engagement du plan — « tout est affiché, pas caché derrière un label
marketing » — et la ligne de partage est désormais à l'écran plutôt que dans un fichier.

L'onglet Analyse liste, à chaque étape, les autres coups qui étaient jouables. Deux commentaires
du moteur affirmaient depuis l'incrément 2 que le banc d'analyse le faisait déjà. Il ne le faisait
pas.

Ne sont **pas** prétendus : que la tension est une difficulté ; qu'une grille est « franche » ou
« tendue » (un adjectif suppose un seuil que rien ne fixe) ; une durée en minutes ; que le chemin
du solveur est celui du joueur. Ces comptages dépendent du registre, donc ils sont estampillés de
la version du barème comme le score.

Le coût est de 1,4 ms par grille, contre 1,35 ms pour la notation elle-même — et un test interdit
au module d'être importé depuis `logic/` ou `generate/`, parce que `rate()` est appelée jusqu'à
quatre cents fois par grille produite.

## Le studio d'impression

Cahiers au format standard ou relié, corrigés groupés **à la fin** sur des pages séparées :
l'enseignant imprime d'un bloc et détache les dernières pages avant de distribuer. Intercaler
les corrigés les rendrait visibles par transparence et impossibles à retirer.

Composé en HTML et CSS, imprimé par `@page` et `window.print()`. **Les bibliothèques PDF en
JavaScript ne rendent pas le CSS** : jsPDF et pdfmake demandent de reconstruire la mise en page
dans leur propre API. Pour un cahier dont l'unique critère est le rendu papier, seul le moteur du
navigateur convient. Contrepartie assumée : « Enregistrer en PDF » depuis la boîte de dialogue,
un clic de plus contre un rendu juste.

Détails qui comptent sur du papier : filets de bloc trois fois plus épais que les filets de case
(sans ce contraste l'œil ne découpe plus les blocs), marge de reliure **alternée** selon la parité
des pages (sinon une page sur deux disparaît dans la pliure), et `print-color-adjust: exact` pour
que le QR survive au mode économie d'encre.

**Le cahier s'arrête, et il dit quand il échoue.** Un cahier de quarante grilles est long à
produire : le bouton devient « Arrêter · 6 / 40 » plutôt que de se griser, et l'arrêt est
**immédiat** — mesuré sous 4 ms, contre les huit secondes qu'un simple drapeau aurait pu laisser
passer, puisqu'une grille difficile peut occuper tout le budget du générateur. Ce qui était produit
est gardé et montré ; ce qui a échoué est nommé. L'aperçu ne montre **jamais** un cahier dont le
bandeau ne parle pas : c'est celui-là qui sortirait de l'imprimante.

Le prix de cette promptitude est de **tuer le Web Worker**, seul moyen d'interrompre un calcul
synchrone, puis de le faire renaître — 36 ms sur le paquet de production, servi par le précache du
service worker. Le raisonnement complet, les options écartées et ce qui reste **non mesuré** sont
dans `docs/plan-increment-20.md`.

## Le pont papier ↔ écran

C'est le moat n°2, et il est **testé comme tel** : la grille encodée dans le QR, décodée, doit
être identique à celle imprimée et recevoir le même niveau.

Chaque grille imprimée porte trois choses :

| | Contenu | Rôle |
|---|---|---|
| **QR code** | L'URL complète, grille encodée dedans (35 caractères) | Le chemin normal : on scanne, la grille s'ouvre |
| **Le code en clair** | La même chaîne, en groupes de cinq | Le recours sans téléphone — long à saisir, mais ça marche vraiment |
| **Étiquette** (`CADZH`) | Empreinte de la grille | Repérer une grille dans le sommaire et sur son corrigé |

Pourquoi pas un « code court » de huit caractères qui contiendrait la grille : **c'est
impossible**. 81 cases à dix valeurs représentent environ 269 bits, huit caractères en portent une
cinquantaine. Un tel code supposerait un serveur — que nous n'avons pas et ne voulons pas.

L'encodage porte **la grille**, pas la graine qui l'a produite : reproduire depuis une graine
dépendrait de `RATING_VERSION`, donc de la moindre évolution du moteur. Un cahier imprimé
aujourd'hui doit s'ouvrir dans dix ans.

## L'onglet Analyse

Le chemin de résolution complet, étape par étape : candidats affichés, zone concernée, motif du
raisonnement, conclusion, et le décompte des techniques employées. C'est l'instrument qui valide
le solveur, et un outil d'apprentissage à part entière.

## Architecture

```
packages/
├─ engine/       Le cœur. Zéro dépendance, zéro DOM, zéro accès au stockage.
│  ├─ rng/       PRNG seedable — tout est reproductible depuis une graine
│  ├─ grid/      Géométrie 9×9, masques de candidats, lecture/écriture
│  ├─ solver/    Solveur brut : propagation de contraintes + backtracking MRV
│  ├─ logic/     Solveur humain : 24 techniques, chemin de résolution, notation
│  ├─ generate/  Creusement à unicité garantie, puis recherche dirigée — par
│  │             niveau, ou par **technique** visée
│  └─ rating/    Deuxième dimension : effort du chemin, et sa largeur au plus dur
├─ cli/          Outillage hors production : oracle, corpus quotidien, corpus des leçons
└─ app/          L'application Svelte 5
   ├─ src/lib/   Logique de partie, grille accessible, panneau d'analyse, Worker
   │             day · dates civiles pures    stopwatch · chronomètre honnête
   │             stats · historique persisté  progress · agrégats purs
   │             daily · corpus des défis      learn · corpus des leçons + amorce
   │             lessons · le texte des 24 leçons
   │             marks · marques de candidats  textSize · taille du texte
   ├─ src/test/  Montage de composants et exécution d'axe, pour les tests de DOM
   ├─ public/daily/corpus.json   274 jours de défis, figés et précachés
   └─ public/learn/corpus.json   72 grilles d'exercice, une par technique
```

Le moteur ne connaît ni le DOM, ni le navigateur, ni le framework, ni le stockage. Cette pureté
est **vérifiée mécaniquement** : il compile avec `lib: ["ES2023"]` seul, donc un simple
`console.log` oublié dans `packages/engine/src` casse le typecheck.

### Décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| Ordre des techniques | Figé, **trié par difficulté croissante** | Corrigé par la calibration. La documentation communautaire décrit un ordre par familles où la paire cachée (3,4) précéderait la paire nue (3,0) ; nous l'avions suivie. La mesure l'a démentie : trier par difficulté a fait passer l'accord de 92,7 % à 97,6 % sur le corpus de rodage. |
| Propagation | Le solveur logique **ne propage rien** au-delà de la règle du jeu | Le solveur brut pose les singles en cascade pour aller vite. Réutiliser cela ici résoudrait des cases sans créditer la technique qui les justifie : note faussée, indices absurdes. |
| Génération ciblée | Recherche locale dirigée, pas rejet simple | Mesuré : le rejet trouve une grille facile en 1,4 tirage, une difficile en 63, et **jamais** d'expert en 400. La difficulté vient de la structure, pas du nombre d'indices. |
| Diversité des grilles | Solution complète tirée à chaque fois | Transformer une grille germe ne produit que des grilles **isomorphes** — une classe d'équivalence sur 5 472 730 538. |
| Web Worker | Oui, depuis l'incrément 2 | La génération d'un niveau élevé prend de 1,5 à 8 secondes. |
| Dépendances | **Zéro copyleft** | HoDoKu est en GPLv3, le portage Rust de jczsolve en AGPL, Sudoku Explainer en LGPL. Tout est réimplémenté depuis les algorithmes publiés. |
| Génération par technique | Bande resserrée autour de la difficulté visée, **récolte au vol** | Mesuré : à plafond ouvert, triplet nu, Swordfish et Jellyfish échouent en 45 s ; à plafond serré ils sortent en 3,7 s, 6,9 s et 39 s. Le plafond retient la marche dans la région utile. |
| Position d'exercice | Valeurs **et** candidats, jamais les valeurs seules | Mesuré sur 13 techniques : figer les valeurs ne préserve l'étape attendue que 4 fois. Les éliminations déjà acquises sont ce qui rend la technique nécessaire. |
| Web Components | **Non**, composants Svelte standards | Le Shadow DOM empêche `aria-labelledby` et `<label for>` de traverser sa frontière — en conflit frontal avec l'accessibilité de la grille. |

### Performance mesurée

| Opération | p50 | p95 |
|---|---|---|
| Solution complète aléatoire | 0,5 ms | 0,6 ms |
| Creusement avec vérification d'unicité | 16,3 ms | 17,8 ms |
| Notation logique d'une grille | 0,4 à 1,6 ms | — |
| Unicité sur « Platinum Blonde » (843 hypothèses) | 13,2 ms | 14,0 ms |

Génération à niveau ciblé, taux de réussite sur 12 tentatives, temps médian :

| Niveau | Réussite | Temps médian |
|---|---|---|
| Facile | 12/12 | 0,03 s |
| Moyen | 12/12 | 0,11 s |
| Difficile | 12/12 | 0,99 s |
| Expert | 11/12 | 2,49 s |
| Maître | 12/12 | 0,39 s |
| Diabolique | 12/12 | 0,48 s |

**Maître et Diabolique sont devenus les paliers les plus rapides à produire** — ils l'étaient
auparavant le moins (4/5 en 4,8 s et 2/5 en 8,1 s). La raison n'est pas une optimisation mais un
comblement : la bande 4,0 à 4,4 était vide, et la recherche devait forcer des chemins tordus pour
y atteindre un score élevé. Cinq techniques plus tard, elle y trouve des grilles franches.

Le même ajout a révélé un défaut ancien, invisible tant que l'échelle était trouée : **la marche
locale ne connaissait pas son plafond**. Elle montait jusqu'à dépasser le plancher demandé, sans
regarder au-dessus — et un seul échange pouvait la faire passer de 2,3 à 4,4, ruinant la
tentative. Mesuré : à « Difficile » et « Expert », les échecs ne manquaient jamais le palier par
en dessous, ils le dépassaient. Une fois le plafond transmis à la marche, Difficile est passé de
10/12 à 12/12 et Expert de 9/12 à 11/12.

Quand le niveau n'est pas atteint, l'application le **dit** et propose la grille la plus proche,
plutôt que de mal l'étiqueter.

L'incrément 8 a corrigé un second défaut de la même marche : **le point de départ devenait la
référence même quand il était inutilisable.** Une grille creusée qui se bloque porte quand même un
score — celui de l'étape la plus dure atteinte avant le blocage, souvent élevé — et 13 % des
creusements sortent ainsi. La promotion exigeant un score strictement supérieur, une grille résolue
à 3,2 ne pouvait jamais déloger un départ bloqué à 4,0 : la marche brûlait ses quatre cents
échanges et le budget de temps partagé, donc aussi les tentatives suivantes. Mesuré sur les mêmes
graines à « Expert » : **52,9 s → 44,7 s**, à taux de réussite égal.

Production d'un corpus complet de leçons — 24 techniques, 3 grilles chacune : **5 minutes**. Le
Swordfish demande 44 s, le Jellyfish jusqu'à deux minutes ; tout le reste sort en quelques
secondes.

## La calibration

La notation ne se contente pas de reproduire un barème documenté : elle est **comparée à
l'oracle**. `pnpm calibrate` génère un corpus, le fait noter par Sudoku Explainer, et compare.

Le critère n'est pas une corrélation mais une **égalité exacte**. L'oracle possède bien plus de
techniques que nous, mais il les essaie dans un ordre où les nôtres viennent en premier : pour
une grille que notre registre résout, il devrait rendre le même nombre, pas un nombre proche.

Progression du taux d'accord exact sous 4,0, d'un incrément à l'autre :

| | Accord ≤ 4,0 | Ce qui l'a fait bouger |
|---|---|---|
| Incrément 3 | 91,4 % | Calibration initiale, ordre des techniques corrigé |
| Incrément 6 | 93,3 % | Liens forts et wings (4,0 à 4,4) |
| Incrément 7 | 94,6 % | Variantes « Direct » restreintes au single caché |
| Incrément 9 | 97,8 % | Le single débloqué doit être trouvé dans une boîte ou dans une maison du motif |
| **Incrément 18** | **99,5 %** | Les sous-ensembles nus cessaient de chercher dans une unité dès que les **membres possibles** n'étaient pas plus nombreux que le motif — alors que les cases éliminées sont précisément celles que ce filtre écarte |

### Le README s'était trompé de coupable

Il désignait « les chemins qui bifurquent » comme la source dominante des écarts restants, au
motif que 17 des 20 divergences n'employaient que des techniques déjà présentes. Vrai — mais
« ce n'est pas une lacune du registre » avait été assimilé à « c'est une bifurcation », et les
deux se séparent.

Une vraie bifurcation est **symétrique en signe** : deux solveurs qui se séparent tôt atterrissent
au-dessus aussi souvent qu'en dessous. On mesurait 15 sous-évaluations contre 2 sur-évaluations,
et **13 des 17** avaient une variante « Direct » pour technique de pic — toutes des
sous-évaluations. L'accord valait 73,5 % quand notre pic était une variante Direct, 97,5 % sinon.

Le mécanisme se lit tout seul : une variante Direct **pose une valeur**. Se déclencher là où
l'oracle ne le fait pas court-circuite une étape chère plus loin, donc abaisse le pic. Cela ne
peut produire que des sous-évaluations.

### Et le résidu n'était pas une bifurcation non plus

Ce qui restait — sept grilles — a été mis au compte d'un « résidu honnête de bifurcation ». C'était
encore une explication plausible qu'on n'avait pas testée, et elle était fausse.

Une bifurcation se mesure. Le solveur n'a **qu'un seul degré de liberté** : parmi les trouvailles
de la technique la moins chère applicable, laquelle jouer. On l'a randomisé, 3 000 chemins par
grille. Sur **21 000 chemins, le score de l'oracle n'est jamais atteint**, et cinq grilles sur
sept ne produisent qu'une seule valeur de pic, 3 000 fois sur 3 000.

La cause était un défaut de détection : la recherche de sous-ensembles nus abandonnait une unité
dès que les cases **candidates à être membres** n'étaient pas plus nombreuses que le motif — alors
que les cases qu'un sous-ensemble nu élimine sont celles qui portent **plus** de candidats, donc
exactement celles que ce filtre venait d'écarter. Aucun test ne pouvait le voir : la grille
finissait résolue, par une technique plus chère, et le seul symptôme était une note trop haute.

Rejoué hors échantillon sur 460 grilles neuves, les deux détections sur les **mêmes** grilles :
408/414 (98,6 %, dont 4 sur-évaluations) contre **413/415 (99,5 %, zéro sur-évaluation)**.

### La règle, et le doute qu'elle méritait

Une variante « Direct » n'est reconnue que si le single caché débloqué est trouvé **dans une
boîte, ou dans l'une des maisons que nomme le motif de base**. Huit règles ont été essayées en
remplaçant le registre depuis l'extérieur du dépôt — sans Java, sans rien modifier.

Six grilles de gain sur 313, c'est assez peu pour que le surapprentissage soit une hypothèse
sérieuse. Un **corpus neuf** a donc été produit sous une autre graine, et les deux règles rejouées
dessus :

| Sur 317 grilles neuves | Accord | sur-éval | sous-éval |
|---|---|---|---|
| Ancienne règle | 301/317 — 95,0 % | 1 | 15 |
| **Nouvelle règle** | **310/317 — 97,8 %** | 2 | 5 |

Le gain se reproduit hors échantillon, et l'erreur se **rééquilibre** — de 1 contre 15 à 2 contre
5. C'est la signature attendue quand on retire un biais systématique et qu'il ne reste que du
bruit.

### Ce que le changement de barème a coûté

74 créneaux quotidiens sur 1 644 (4,5 %) ont changé de palier et ont été régénérés ; les 1 570
autres n'ont pas bougé, et 59 jours n'ont vu que leurs **scores attendus** rafraîchis — les
étiquettes, jamais les grilles, exactement comme ce corpus s'y était engagé. Les deux générateurs
vérifient désormais ce qu'ils trouvent au lieu de se fier à sa présence : ils se réparent seuls au
prochain changement.

Une leçon a perdu son exercice : **aucune grille ne peut être produite où la paire revendiquée
directe soit la technique la plus difficile** — 4 000 tentatives, les deux symétries, trois
minutes chacune. Ce n'est pas une perte mais un **accord** : sur les 335 grilles du corpus,
l'oracle ne rapporte lui non plus aucune « Direct Claiming », là où il en rapporte quatre
« Direct Pointing » et trente « Direct Hidden Pair ».

État courant, sur 441 grilles produites sous une graine neuve :

| Mesure | Valeur |
|---|---|
| Accord exact, toutes grilles | 431/436 — **98,9 %** |
| Accord exact, score ≤ 4,0 | 413/415 — **99,5 %** |
| Grilles refusées à tort | **0** |
| Surévaluations | **0** |

Les cinq grilles hors de notre portée demandent trois **Forcing Chain** (7,1 à 7,2), un
**Bidirectional Y-Cycle** (6,8) et un **WXYZ-Wing** (5,6). Pas un Unique Rectangle : sur ces
441 grilles, l'oracle n'en rapporte **aucun** comme technique de pic, ce qui est la raison
mesurée pour laquelle il est écarté plutôt que reporté.

Le corpus ciblé change avec la notation, si bien que deux campagnes ne portent pas exactement sur
les mêmes grilles. Comparaison faite **grille par grille sur les 291 communes** aux deux, pour
que le progrès ne soit pas un effet d'échantillon : 4 corrigées, **0 régression**.

Ce que la calibration a corrigé, et qu'aucun autre test ne pouvait révéler :

- **L'ordre des techniques était faux.** Voir le tableau ci-dessus.
- **Le garde-fou de pureté du moteur était cassé** depuis l'installation de `@types/node`, qui
  rendait `console` et `node:fs` utilisables dans `packages/engine`. Réparé par `types: []`.
- **Les variantes « Direct » sur-détectaient**, et il aura fallu quatre hypothèses pour le voir.
  L'incrément 3 en avait mesuré trois, toutes perdantes : les restreindre à leur propre unité
  (92,9 %), les supprimer (84,3 %), énumérer tous les singles (92,6 %). La quatrième est la
  bonne : **ne reconnaître que le single caché, jamais le single nu** — 93,3 % → 95,2 % à corpus
  identique, 6 grilles corrigées, aucune régression. Elle colle au nom même des producteurs de
  l'oracle, `DirectHiddenSet` et `DirectIntersection` : ce qu'il appelle « direct » est une
  élimination qui rend un chiffre seul possible dans une **maison**, pas une case qui se retrouve
  avec un seul candidat.
- **Cinq techniques manquaient**, et l'oracle a dit lesquelles plutôt que de nous laisser
  deviner. Deux grilles refusées portaient un score de 4,0 — la valeur du triplet caché, que
  nous implémentions déjà : soit il nous manquait une technique de même valeur, soit notre
  détection était en défaut, et les deux corrections sont opposées. Interroger l'oracle avec son
  format `%R` a tranché en une exécution : `Skyscraper`. Aucun bug, une technique absente.

Trois hypothèses ont été testées puis **rejetées par la mesure**, ce qui vaut d'être noté :
restreindre les variantes « Direct » à leur propre unité (89,3 %), les supprimer (79,5 %), et
énumérer tous les singles au lieu du premier (89,9 %). La dernière est pourtant plus rigoureuse
en théorie — l'oracle s'arrête donc lui aussi au premier candidat.

Les quatre grilles alors refusées sont devenues des **cas de test nommés** : chacune doit être
résolue au score exact de l'oracle **et sous le même nom de technique**. Un score juste par un
chemin faux serait une coïncidence, pas une preuve.

Sept divergences de l'incrément 3 dépassaient 3,4. Elles n'ont **pas** été corrigées, et c'était
prévisible : renotées à l'identique, 0 sur 7. Elles n'emploient que des techniques que nous
avions déjà — elles viennent de chemins qui bifurquent, pas d'une lacune du registre. C'est un
problème distinct, et le dire vaut mieux que de laisser croire que l'ajout l'a réglé.

**La conformité est tenue par un test**, pas par ce rapport : `corpus/oracle-reference.json`
fige les verdicts de l'oracle grille par grille, et la CI rejoue la comparaison **sans Java**.
Un changement d'ordre ou de détection fait chuter le taux et casse la suite.

## Ce qui est garanti, et testé

- **Toute grille générée admet exactement une solution.**
- **Toute déduction produite est logiquement valide** — aucune technique n'écarte jamais un
  candidat appartenant à la solution. Vérifié en énumérant *tous* les motifs de *chaque*
  technique sur un corpus de grilles réelles, pas seulement ceux que le registre retient.
- **Aucune grille n'est résolue en devinant** : si le raisonnement ne suffit pas, le solveur
  s'arrête au lieu d'appeler le solveur brut.
- **Aucune affaire d'Enquête n'est distribuée si le registre ne la termine pas** — le dernier
  filtre du générateur n'est pas l'unicité, c'est la résolubilité. Et aucun de ses indices ne peut
  être faux : ils sont puisés dans une réserve construite en vérifiant chaque énoncé sur la
  solution.
- **Aucune limite d'erreurs**, et une annulation qui rend un geste entier — la valeur, les notes
  et les marques effacées chez les vingt voisines. Bornée à 200 gestes, ce qui est dit plutôt que
  laissé croire.
- **La couleur n'est jamais le seul porteur d'information.**
- **Chaque grille du corpus quotidien est renotée à chaque exécution des tests** : 1 644 grilles
  décodées, résolues et comparées au niveau annoncé. Un futur changement de barème fera échouer ce
  test — on rafraîchit alors les étiquettes, jamais les grilles.
- **Une partie terminée n'est enregistrée qu'une fois.** `isComplete` est un dérivé : annuler la
  dernière case le fait osciller, et un enregistrement branché dessus écrirait trois parties là où
  il y en a une. Un verrou fixe le moment de l'écriture, et un test l'exige.
- **Une durée non mesurable vaut `null`**, jamais une approximation.
- **Chaque grille du corpus des leçons est renotée à chaque exécution des tests** : décodée,
  vérifiée unique, et sa technique la plus difficile comparée à la leçon qu'elle illustre.
- **Aucune unité de fenêtre dans les styles de l'application** — c'est ce qui rendait le réglage
  de taille du texte inopérant là où il sert le plus.
- **Aucune valeur de style littérale hors de l'échelle** : rayons, tailles, graisses, couleurs et
  durées citent un jeton d'`app.css`. Le papier est la seule exemption, et elle est écrite comme
  une liste de chemins, pas comme un commentaire.
- **Tout survol est sous `@media (hover: hover)`, et tout sélecteur qui a un survol a un `:active`.**
  Le premier empêche un survol de rester collé au doigt ; le second garantit qu'un contrôle répond
  à l'appui — le seul état qui existe sur tactile.
- **L'adresse de l'image de partage ne peut ni diverger de l'adresse publique** annoncée dans ce
  fichier, **ni désigner un fichier absent.**
- **Une position n'a pas de niveau, et n'en reçoit aucun.** Un exercice affiche la technique qu'il
  enseigne, jamais la difficulté de la grille dont il est extrait.
- **La structure d'accessibilité est vérifiée par axe sur les cinq onglets** — mais ni le
  contraste ni la taille des cibles, qui restent mesurés à la main.
- **Un arrêt ne se présente jamais comme une panne, et un échec ne se taît jamais.** La boucle qui
  produit les deux cahiers distingue les deux cas, garde ce qui a été produit avant l'incident, et
  le montre. Vérifié sur les quatre situations — compte atteint, palier manqué, arrêt volontaire,
  moteur en panne — dont trois n'étaient atteignables par aucun test avant l'incrément 20.
- **Les régions vivantes existent avant leur texte.** Un `role="status"` créé en même temps que son
  message n'est pas annoncé ; un test l'exige désormais là où le message porte un échec.

> **Attention à la reproductibilité par graine.** Le PRNG est figé par des snapshots, mais cela ne
> suffit pas : `generateAtLevel` dépend de `RATING_VERSION` *et* du temps réel écoulé sur la
> machine. Deux joueurs, même graine, même version : deux grilles différentes. Tout ce qui doit
> être identique pour tout le monde et pour toujours porte donc **la grille**, jamais la graine —
> le code imprimé, et le corpus quotidien.

## Hors ligne : vérifié

L'application démarre et se joue **sans réseau**. Ce n'est plus une intention : la vérification a
été faite sur un build de production servi par `vite preview`, en coupant le serveur avant de
recharger. Elle a été **refaite à l'incrément 10, sous le sous-chemin de la mise en ligne**, dans
le navigateur intégré de l'environnement de développement. Relevé depuis la page elle-même,
serveur arrêté :

| Contrôle | Relevé |
|---|---|
| Requête réseau depuis la page | `TypeError: Failed to fetch` — le serveur est bien coupé |
| Service worker | `activated`, portée `/sudoku/`, script `/sudoku/sw.js` |
| Page servie par le service worker | oui (`navigator.serviceWorker.controller`) |
| Entrées en cache | 12, dont les deux corpus — défis quotidiens **et** leçons |
| Défi du jour hors ligne | bouton actif, jours du calendrier jouables, aucun message d'erreur |
| Onglet Apprendre hors ligne | 24 techniques listées, aucun message d'erreur |
| Cahier généré hors ligne | 6 grilles Moyen en une seconde, 7 pages corrigés compris |
| Grille rendue | 81 cases |

La construction annonce **16** entrées de précache et le cache en contient **12** : rien ne manque.
Les quatre icônes figurent deux fois dans le manifeste de précache — une fois comme ressources
déclarées (`includeAssets` et icônes du manifeste), une fois par le motif de fichiers —, avec la
même révision, et Workbox n'en garde qu'une. Le chiffre qui compte est celui du cache.

Le précache couvre l'intégralité de l'application : le HTML, la feuille de style, le bundle, le
Worker du moteur, le manifeste, les quatre icônes — **et les deux corpus**, 274 jours de défis et
72 grilles d'exercice. À ce format — une cinquantaine de kilo-octets
compressés, moteur compris — il n'y a rien à arbitrer entre ce qu'on met en cache et ce qu'on
laisse au réseau : il n'y a aucun réseau à solliciter une fois la page chargée. La mise à jour
passe par une bannière plutôt que par un rechargement forcé, car recharger la page sous les doigts
de quelqu'un en train de résoudre une grille est brutal — sauf à l'ouverture, avant le premier
geste, où elle s'applique d'office : à la mise en ligne, une bannière passée inaperçue avait laissé
l'auteur lui-même sur une version corrigée depuis (voir `lib/updatePolicy.ts`).

### Ce qui avait bloqué la vérification pendant deux incréments

`navigator.serviceWorker.register()` échouait dans le navigateur automatisé du poste de
développement avec un laconique « unknown error when fetching the script » — alors que le fichier
était servi en `200`, avec le bon type MIME, sans dépendance externe.

Le diagnostic tenait en une expérience : enregistrer un service worker **de 44 octets**, sans
logique ni import, servi par le même serveur. Il échoue exactement de la même manière, tandis que
la page récupère ce même fichier par `fetch()` sans difficulté. L'enregistrement est donc bloqué
par l'environnement, quel que soit le script — ce n'était ni notre code, ni notre build, ni notre
serveur. Reproduire le test dans un navigateur ordinaire l'a confirmé du premier coup.

À retenir : un contre-exemple minimal tranche là où l'acharnement sur le vrai fichier ne mène
nulle part.

Deux détails appris en chemin, consignés dans `vite.config.ts` : le service worker de
développement est **désactivé**, car il survit à l'arrêt du serveur et sert ensuite un cache
périmé sans rien indiquer ; et le runtime Workbox est **intégré** au service worker plutôt que
chargé à part, pour réduire le nombre de pièces mobiles au démarrage.

Pour refaire la vérification :

```bash
pnpm build && pnpm --filter @sudoku/app exec vite preview --port 4181
```

Le port n'est pas un détail. Un service worker installé par une vérification antérieure survit à
l'arrêt du serveur, et celui d'avant la mise en ligne avait la portée `/` : il intercepterait
`/sudoku/` et servirait l'ancien build — on croirait vérifier la nouvelle version en regardant la
précédente. Le port fait partie de l'origine ; en changer, c'est repartir d'un navigateur vierge.

## Suite

Ce qui reste ouvert, par ordre de valeur :

- **WXYZ-Wing, puis les chaînes**, si l'on veut étendre la portée. C'est ce que la mesure
  désigne — et **pas** l'Unique Rectangle, écarté sur preuve : zéro occurrence comme pic sur
  441 grilles, et une déduction qui conclurait d'une *promesse* sur la grille plutôt que de la
  grille.
- **La paire revendiquée directe et le quadruplet caché n'ont pas d'exercice.** Le second a perdu
  le sien à l'incrément 18, et c'est une conséquence plutôt qu'un défaut : un registre plus complet
  rend les techniques les plus chères moins souvent *nécessaires*. Même accord dans les deux cas —
  sur les 441 grilles de la référence, l'oracle n'en rapporte aucun non plus.
- **Le paysage sur téléphone** : la grille à gauche, le pavé à droite. C'est une troisième
  disposition ; la barre basse s'y dégrade en « il faut un peu défiler », pas en « cassé ».
- **La validation au lecteur d'écran**, que `CLAUDE.md` exige, et que personne n'a encore faite.
  `docs/lecteur-decran.md` la rend exécutable en une demi-heure — commandes NVDA, capture du
  journal, verdicts à remplir — et tranche au passage la question du rôle : `role="grid"` est gardé
  parce que c'est lui qui fait passer NVDA en mode formulaire, seul mode où les flèches parviennent
  au plateau. Le document mesure aussi ce qu'aucune correction de notre côté ne rattraperait : sur
  l'implémentation de référence du W3C, NVDA + Chrome n'annonce déjà pas le rôle. axe ne peut pas la fournir, et une CI verte ne doit pas être prise pour
  elle. L'incrément 18 a lu l'arbre d'accessibilité d'un vrai Chromium — ce que jsdom ne calcule
  jamais — et en a tiré une correction : `aria-selected` est retiré des deux plateaux, parce qu'il
  décrivait une sélection qui n'existe pas et posait « non sélectionné » sur 35 cases sur 36. Mais
  **rien n'a été entendu** : un arbre d'accessibilité dit ce qu'un lecteur d'écran a à sa
  disposition, jamais ce qu'il annonce.
- **Le rejet tardif de `carve`.** QuickXplain est fermé par le calcul — dans notre régime de
  densité, la dichotomie est *plus mauvaise* que le parcours linéaire (Junker, AAAI 2004,
  table 4) — et connaître la solution n'offre aucun raccourci de complexité (Yato & Seta, 2003 :
  le problème est NP-complet). La seule piste vivante est constructive : carver contre `deduce`
  plutôt que contre le comptage, ce qui rendrait l'unicité gratuite. `deduce` coûte 1,19 × un
  `solveExact` plafonné, donc l'échange est plausible — mais il **changerait les affaires
  produites**, ce qui n'est pas un arbitrage de vitesse.

### Le rating Glicko2 est écarté, et ce n'est plus un report

Il figurait en tête de cette liste depuis l'incrément 0. L'examiner sérieusement a montré qu'il se
heurte à **quatre** règles du projet, pas une :

- il n'existe **aucun résultat observable** — pas de bouton « abandonner », donc ni victoire ni
  défaite. Il faudrait en **inventer** un à partir de la durée ou des indices ;
- il exige un compteur persisté, quand `stats.ts` interdit tout compteur et recalcule tout depuis
  l'historique — « deux sources de vérité finissent toujours par se contredire » ;
- il agrège tous niveaux confondus, quand `progress.ts` s'y refuse explicitement : « agrégée, une
  médiane ne mesurerait pas l'habileté du joueur mais ce qu'il a choisi de jouer » ;
- l'élagage à 500 parties rendrait le calcul instable dans le temps.

Le construire supposerait donc d'inventer un dénominateur. C'est le contraire de ce que fait ce
projet, et il vaut mieux l'écrire que de le laisser en tête d'une liste d'intentions.

Écarté sur preuve, pas par oubli : **W-Wing** n'apparaît nulle part dans l'oracle. L'implémenter
nous ferait diverger sans aucune référence à laquelle comparer.

Le plan complet est dans `docs/plan.md`.
