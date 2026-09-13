# Valider les plateaux au lecteur d'écran

`CLAUDE.md` exige depuis l'incrément 6 que `role="grid"` soit **validé par un test réel avec un
lecteur d'écran** avant d'être considéré comme acquis, et note qu'`axe` ne peut pas le fournir.
C'est la seule règle écrite du projet qui ne soit pas tenue. Ce document ne la tient pas non plus :
il rend la validation **exécutable en une demi-heure par un humain**, et il dit ce qui a été
établi sans elle.

> ✅ **Exécuté le 13 septembre 2026** — NVDA 2026.2 portable, Chrome 152, Windows 11, sur le site
> publié. Les relevés sont au bas de ce document, **mot pour mot**. Ce qui suit garde sa valeur :
> un arbre d'accessibilité dit ce qu'un lecteur d'écran a **à sa disposition**, jamais ce qu'il
> **annonce** — et c'est précisément l'écart que la mesure a trouvé.

---

## Ce qui a été établi sans lecteur d'écran, et qui change la question

### 1. Lire l'arbre UIA de Windows n'aurait pas répondu

L'idée était séduisante : plutôt que l'arbre interne de Chromium, lire l'arbre **UI Automation**
de la plateforme, celui que consomme le système. Elle ne tient pas.

**NVDA n'utilise pas UIA pour Chromium.** Son guide (version 2026.1.1) décrit le réglage *« Use UIA
with Microsoft Edge and other Chromium based browsers when available »* comme valant par défaut
*« Only when necessary »* — NVDA ne bascule sur UIA que s'il échoue à s'injecter pour utiliser
**IAccessible2**, et le guide ajoute que son support UIA pour Chromium « est au début de son
développement ». Une [issue ouverte en septembre 2026](https://github.com/nvaccess/nvda/issues/19276)
confirme que le code bloque volontairement UIA sur la fenêtre de rendu de Chrome.

Chromium a bien gagné une implémentation UIA **native** ([Chrome for Developers, 14 août
2025](https://developer.chrome.com/blog/windows-uia-support-update), activée par défaut depuis
Chrome 138) — mais c'est la plomberie du navigateur qui a changé, pas le client par défaut de
NVDA. Lire UIA nous renseignerait sur **Narrator**, qui pèse 0,7 % des usages
([WebAIM #10](https://webaim.org/projects/screenreadersurvey10/)), pas sur NVDA à 37,7 %.

Jamie Teh, de NV Access, explique [pourquoi UIA reste insuffisante pour le
web](https://www.jantrid.net/2025/03/19/why-uia-insufficient-web/) : `LabeledBy` limité à une
cible, granularité insuffisante des régions vivantes, propriétés fourre-tout `AriaRole` et
`AriaProperties` qui traitent le web en citoyen de seconde zone.

**Conclusion : écartée.** Ce serait un troisième arbre d'accessibilité, pas une annonce.

### 2. Le W3C publie un plan de test pour ce motif exact — et NVDA y échoue

Le projet **ARIA-AT** du W3C fait exécuter des plans de test, commande par commande, par de vrais
NVDA, JAWS et VoiceOver, et publie la sortie vocale **verbatim**. Il en existe un pour le motif
`grid` : [*Minimal Data Grid*, rapport 163680](https://aria-at.w3.org/report/163680), statut
**Candidate**, onze tests nommés — entrer dans la grille, demander des informations sur une
cellule, aller à la colonne suivante, à la ligne suivante, au premier et au dernier de chaque.

**Et sur l'exemple canonique de l'APG, NVDA + Chrome échoue encore l'assertion la plus basique —
`Convey role 'grid'` — sur plusieurs de ses commandes**, au rapport de juillet 2026.

C'est la mesure la plus utile que cette recherche ait produite. Elle ne dit pas que notre plateau
est mauvais : elle dit que **le motif lui-même n'est pas tenu** par le lecteur d'écran le plus
répandu sous Windows, y compris sur l'implémentation de référence du W3C. Aucune correction de
notre côté ne rattraperait cela.

### 3. Ce qui décide malgré tout de garder `role="grid"`

Le doute inscrit dans `CLAUDE.md` portait sur l'opportunité du rôle. Un argument le tranche, et il
est mécanique plutôt qu'esthétique.

NVDA a deux modes. En **mode navigation**, il **intercepte les flèches** pour déplacer son propre
curseur virtuel. En **mode formulaire**, il les transmet au code de la page. Un plateau qui se
parcourt aux flèches — ce qui est notre cas, `tabindex` roving — n'est donc utilisable **que** si
NVDA passe en mode formulaire, et c'est `role="grid"` qui déclenche ce basculement automatique.

Un `role="table"` laisserait NVDA en mode navigation : les flèches ne parviendraient jamais à
notre gestionnaire, et le plateau deviendrait inutilisable au clavier pour exactement les
personnes qu'on cherche à servir. Le rapport ARIA-AT teste d'ailleurs la bascule séparément, sous
l'assertion *« Switch from browse mode to focus mode »*.

**Décision : on garde `role="grid"`**, et la raison est écrite ici plutôt que supposée. Ce que le
rôle achète — un seul arrêt de tabulation, les flèches transmises — vaut ce qu'il coûte. Ce qu'il
ne garantit pas est documenté au point 2, et c'est pourquoi le protocole ci-dessous reste dû.

---

## Le protocole

À exécuter sur **Windows 11**, avec **NVDA** (gratuit, [nvaccess.org](https://www.nvaccess.org/))
et **Chrome** — la combinaison la plus utilisée après JAWS + Chrome
([WebAIM #10](https://webaim.org/projects/screenreadersurvey10/) : NVDA 37,7 %, JAWS 40,5 %).

### Préparer une trace exploitable

NVDA sait écrire ce qu'il prononce dans un fichier. Le niveau **input/output** journalise, dans
les termes de son guide, « la parole et la sortie braille » en plus des touches :

```bash
nvda --log-level=12 --log-file=%USERPROFILE%\Desktop\nvda-plateau.log
```

Le résultat est un fichier texte qu'on relit, qu'on cherche et qu'on joint à un rapport — pas un
souvenir. ⚠ Il contient aussi les touches frappées : ne pas le publier sans le relire.

Le *Speech Viewer* (menu NVDA → Outils) affiche la même chose à l'écran, sans fichier.

### Les commandes, et ce qu'on regarde

| # | Geste | NVDA | Ce qui doit être annoncé |
|---|---|---|---|
| 1 | Entrer dans le plateau | `Tab` jusqu'au plateau | Le rôle (« grille » / *grid*), les dimensions, puis la case |
| 2 | Vérifier le mode | — | NVDA doit **basculer en mode formulaire** tout seul |
| 3 | Se déplacer | `→` `←` `↑` `↓` | Le **curseur du plateau** bouge, pas celui de NVDA |
| 4 | Relire la case | `NVDA+Tab` | Rangée, colonne, pièce, état — sans rien supposer d'ailleurs |
| 5 | Poser quelqu'un | `Entrée` ou `Espace` | Le nom posé, et la mise à jour de la case |
| 6 | Entendre le retour | — | La région `role="status"` doit énoncer l'annonce |
| 7 | Sortir | `Tab` | Un seul arrêt de tabulation a été consommé, pas trente-six |
| 8 | Forcer le mode navigation | `NVDA+Espace` | Les flèches reviennent à NVDA — c'est attendu, pas un défaut |

Sur le plateau de sudoku, mêmes gestes ; la case doit énoncer sa valeur, son caractère donné ou
non, et son conflit éventuel.

### Ce qu'on note

Pour chaque ligne : **ce qui a été entendu, mot pour mot**. Pas « ça marche ». Le rapport ARIA-AT
publie la sortie verbatim parce que c'est la seule forme qui se conteste.

Trois verdicts possibles, et le troisième compte autant que les autres :

- **tenu** — l'information est annoncée ;
- **manquant de notre fait** — un nom accessible incomplet, un état non exposé : c'est à corriger ;
- **manquant du fait du lecteur** — l'information est dans l'arbre et n'est pas annoncée. À
  rapporter en amont, et à écrire ici. Le rôle `grid` non annoncé par NVDA + Chrome entre dans
  cette catégorie, et le rapport ARIA-AT le montre déjà sur l'exemple du W3C.

---

## Automatiser, le jour où

**Guidepup** ([guidepup.dev](https://www.guidepup.dev)) pilote un vrai NVDA depuis un test
Playwright ou Jest. `npx @guidepup/setup install nvda` dépose une **copie portable** de NVDA sous
le profil utilisateur — le gestionnaire `win32` de sa commande de configuration ne fait rien, donc
aucune élévation ne paraît nécessaire. Sa CI tourne sur Windows Server 2022/2025 **et** sur un
runner Windows 11.

Ce n'est pas fait ici, et pour une raison qui se dit : cela demanderait d'installer NVDA sur la
machine de développement et sur celle de la CI, et de faire tourner une session de bureau
interactive. C'est un engagement d'infrastructure, pas une ligne de code — il appartient à Jérémy,
pas à un incrément.

**`@guidepup/virtual-screen-reader`**, lui, tourne sans rien installer. Ses auteurs sont explicites
sur sa portée : il n'y a pas de substitut à un vrai lecteur d'écran. Il attraperait des régressions
de structure ; il ne validerait rien.

---

## Ce que ce document ne dit pas

Il ne dit pas que les plateaux sont accessibles. Il dit :

- que `role="grid"` est **gardé pour une raison mécanique** — les flèches n'arrivent au code
  qu'en mode formulaire, et c'est le rôle qui l'obtient ;
- que le motif lui-même est **imparfaitement tenu** par NVDA + Chrome, mesuré par le W3C sur sa
  propre implémentation de référence ;
- que le nom de chaque case porte **seul** ce qu'il faut, ce qu'un test de CI vérifie sur les
  trente-six ;
- et ce que **l'écoute a effectivement donné** : voir le relevé ci-dessous. C'est la seule ligne de
  ce document qui a changé.

Une phrase pour résumer les trois heures : **l'application expose tout ce qu'il faut, et NVDA +
Chrome n'en engage qu'une partie.** Le plateau se parcourt, après un `NVDA+Espace` que rien
n'annonce.

---

## Le relevé — 13 septembre 2026

**Conditions.** NVDA **2026.2** (copie portable de `guidepup/nvda`, aucune installation système),
Chrome **152**, Windows 11, sur le site publié, grille figée par son code d'URL
(`#g=AdIU2wEX0AG3UZYAdDYhRUiTEUVyYjQnWGOXhzE`). NVDA tournait **muet** — synthétiseur `silence` —
ce qui ne gêne pas la capture : elle se branche sur `pre_speechQueued`, en amont de la synthèse.
Les phrases ci-dessous sont ce que NVDA a **mis en file pour être prononcé**, sans reformulation.

Le harnais est dans `scripts/lecteur-decran.mjs` et `scripts/lecteur-decran-modes.mjs`. Il n'est
**pas** câblé à la CI et n'ajoute aucune dépendance au dépôt : voir « Rejouer » plus bas.

### Ce qui est tenu

| Point | Attendu | Entendu |
|---|---|---|
| Un seul arrêt de tabulation | le plateau en consomme 1, pas 81 | **tenu** — 9ᵉ arrêt sur 26, puis le pavé de chiffres au suivant |
| Les dimensions | 9 lignes sur 9 colonnes | « de 9 lignes et 9 colonnes » |
| Le nom du plateau | « Grille de sudoku, 9 lignes sur 9 colonnes » | mot pour mot |
| Le nom d'une case | « ligne 1, colonne 1, vide » | « ligne 1, colonne 1, vide, ligne 1, colonne 1 » |

La dernière ligne mérite d'être lue deux fois : NVDA énonce **notre** nom accessible, puis y ajoute
sa propre lecture de la position. Le nom de chaque case porte donc bien, seul, ce qu'il faut.

### Ce qui n'est pas tenu, et de qui cela manque

**Le rôle est annoncé « tableau », jamais « grille ».** Verbatim, en mode navigation puis en mode
formulaire :

> « principale région, **tableau**, de 9 lignes et 9 colonnes, Grille de sudoku, 9 lignes sur 9 colonnes »
>
> « Grille de sudoku, 9 lignes sur 9 colonnes, **tableau**, focalisé, de 9 lignes et 9 colonnes »

C'est **l'échec ARIA-AT reproduit sur notre plateau** : *Convey role 'grid'*, que le W3C mesure déjà
en échec sur sa propre implémentation de référence. Rien de notre côté ne le rattraperait —
verdict : **manquant du fait du lecteur**.

**Et la bascule automatique en mode formulaire n'a pas été observée.** En arrivant sur la case par
tabulation, NVDA n'a annoncé que « principale région » — ni rôle, ni dimensions, ni nom de case.
Il a fallu `NVDA+Espace` pour passer en mode formulaire.

⚠ **C'est le point qui contredit une hypothèse écrite du projet.** `CLAUDE.md` gardait `role="grid"`
au motif mécanique que c'est lui qui fait basculer NVDA en mode formulaire, seul mode où les flèches
parviennent au plateau. La moitié « les flèches appartiennent à NVDA en mode navigation » est
**confirmée**, et joliment : la flèche droite a répondu

> « **m** »

— un caractère d'« Imprimer », lu par le curseur virtuel. Mais la moitié « le rôle `grid` obtient la
bascule » n'a **pas** été observée, ce qui est cohérent : un rôle annoncé « tableau » ne déclenche
pas le traitement réservé aux grilles.

### Le verdict, en deux moitiés

La question décisive — « les flèches déplacent-elles le curseur du plateau pour quelqu'un qui
utilise NVDA ? » — se coupe en deux, et chaque moitié a été mesurée séparément.

**Côté application : tout fonctionne.** Une case ayant le focus DOM, une flèche déplace le curseur
**et** le focus, case par case. Relevé sur le site publié, en partant de la case 1 :

| touche | case atteinte | focus DOM |
|---|---|---|
| → | « ligne 1, colonne 2, 7, indice de départ » | suit |
| ↓ | « ligne 2, colonne 2, 2, indice de départ » | suit |
| ← | « ligne 2, colonne 1, vide » | suit |
| ↑ | « ligne 1, colonne 1, vide » | suit |

Le focus suivant le curseur, **un lecteur d'écran qui suit le focus annonce la nouvelle case**. Et
NVDA le fait : en mode formulaire, il a prononcé « ligne 1, colonne 1, vide » en arrivant sur une
case.

**Côté lecteur : le traitement des grilles ne s'engage jamais.** En mode navigation — celui où NVDA
arrive sur une page — tabuler sur une case n'annonce que « principale région », dans un sens comme
dans l'autre (au retour, `Maj+Tab` annonce le conteneur : « Grille de sudoku, 9 lignes sur
9 colonnes, tableau »). Et les flèches restent au curseur virtuel.

**Donc : le plateau est parcourable avec NVDA, mais seulement après `NVDA+Espace`.**

> ⚠ **Cette conclusion était fausse, et l'incrément 22 l'a corrigée.** Voir plus bas : les flèches
> fonctionnent **sans** `NVDA+Espace`. Ce qui manquait à ces deux relevés n'était pas le mode, mais
> le **focus sur une case** : il était sur le conteneur, où les flèches ne produisent rien. La
> phrase est laissée telle quelle plutôt que réécrite — se relire est plus instructif que se
> corriger en silence.

### Trois pièges de méthode, payés comptant

Ils sont notés parce qu'ils reviendront à la prochaine exécution :

1. **Les frappes vont à la fenêtre qui a le focus.** La première exécution en a envoyé trois dans
   Discord. Le harnais refuse désormais de mesurer si NVDA ne confirme pas le bon titre de fenêtre.
2. **Sonder la fenêtre de premier plan depuis PowerShell ouvre une console qui passe elle-même
   devant** : l'instrument mesurait son interférence. C'est NVDA qui donne le titre (`NVDA+T`).
3. **Le nombre de tabulations avant le plateau n'est pas stable** : le curseur virtuel démarre là où
   l'on a cliqué. Un `F5` avant de compter aide, sans y suffire — d'où la mesure indépendante de
   l'ordre de tabulation dans le DOM (26 arrêts, le plateau au 9ᵉ), qui sert de référence.

### Rejouer

Deux paquets, hors du dépôt, et une copie portable de NVDA qui n'installe rien dans le système :

```bash
npm install @guidepup/guidepup @guidepup/setup
npx guidepup install nvda
node scripts/lecteur-decran.mjs
```

⚠ NVDA ré-injecte les frappes dans la fenêtre au premier plan. Le script ouvre Chrome puis **attend
un clic humain** : Windows interdit à un processus d'arrière-plan de mettre une fenêtre devant.

---

## Le relevé automatisé — 14 septembre 2026, sur machine d'intégration

Depuis l'incrément 22, le protocole s'exécute **tout seul** : `.github/workflows/lecteur-decran.yml`,
sur un runner Windows, à la demande et une fois par semaine. **1 min 38 s** au total, dont 34 s
d'écoute. Le relevé est joint à chaque exécution.

### Ce que la machine a entendu, mot pour mot

```
[tab.7] « Imprimer, button »
[tab.8] « main landmark »                                        ← le plateau
[tab.9] « Saisie des chiffres, grouping, Placer le 1, … »        ← on l'a dépassé
[retour] Maj+Tab   « Grille de sudoku, 9 lignes sur 9 colonnes, table »
[ou] NVDA+Tab      « ligne 1, colonne 1, vide, cell, focused »
[droite] →         « ligne 1, colonne 2, 7, indice de départ, row 1, column 2 »
[bas] ↓            « ligne 2, colonne 2, 2, indice de départ, row 2, column 2 »
```

(Les noms de rôles sont en anglais : le NVDA du runner l'est, là où celui de la machine de
développement est en français. Nos propres libellés, eux, sont identiques des deux côtés.)

### La correction

**Les flèches font annoncer la case voisine, et aucun `NVDA+Espace` n'a été pressé.** Le relevé du
13 septembre concluait l'inverse ; il se trompait, parce que ses deux exécutions avaient focalisé le
**conteneur** de la grille et non une case. Sur le conteneur, les flèches ne produisent rien — ce
qui est normal — et j'en avais tiré une conclusion sur le mode.

Ce qui est donc établi, et vérifié à chaque exécution :

| | |
|---|---|
| le plateau consomme **un** arrêt de tabulation | ✓ après huit autres, avant le pavé de chiffres |
| la case focalisée prononce **notre** nom | « ligne 1, colonne 1, vide » |
| `→` annonce la case voisine | change de colonne, garde la ligne |
| `↓` annonce la case du dessous | change de ligne |

**Le plateau est parcourable au clavier avec NVDA.** Ce qui reste vrai du relevé précédent : le
conteneur est annoncé « table », jamais « grid ». C'est l'échec ARIA-AT, et il coûte moins cher
qu'on ne le croyait — il prive l'utilisateur de l'annonce du rôle, pas de la navigation.

### Pourquoi ce job n'est pas dans `ci.yml`

`ci.yml` tourne en une minute sur Linux et **garde la publication**. Faire dépendre une mise en
ligne d'un lecteur d'écran tiers serait accepter qu'une régression de NVDA bloque le site. Le job
d'écoute est donc à part, sur `workflow_dispatch` et un rendez-vous hebdomadaire. Guidepup, lui,
déclenche le sien sur chaque poussée ; ARIA-AT ne le déclenche qu'à la main. Nous sommes entre les
deux, et c'est un choix, pas un défaut.

### Deux choses que l'automatisation a apprises

**Le clic humain n'était pas nécessaire.** Cinq clics ont été dépensés à l'incrément 21 parce que
`AppActivate` et `SetForegroundWindow` rendent `True` sans rien faire — Windows interdit à un
processus d'arrière-plan de voler le premier plan. La parade n'est pas de ruser avec l'OS : on
**cycle les fenêtres avec `Alt+Échap`**, frappe injectée par NVDA, et l'on **vérifie par la parole**
qu'on est arrivé. C'est ce que fait la fixture Playwright de guidepup, et cela marche aussi sur un
poste de travail.

**`@guidepup/setup` n'entre pas dans ce dépôt.** Il dépend de `@guidepup/record`, qui dépend de
`ffmpeg-static` : quatre-vingts mégaoctets téléchargés à chaque installation, y compris sur la CI
Linux qui n'a que faire d'un encodeur vidéo. Le workflow télécharge donc l'archive lui-même, et y
gagne ce que l'outil ne montrait pas — **la somme de contrôle est vérifiée**, et elle vient du
manifeste de guidepup, pas de nous.

### Ce que cela ne remplace toujours pas

Une CI verte dit que la parole **n'a pas régressé**. Elle ne dit pas que l'interface est utilisable :
cela demande quelqu'un qui s'en serve pour de vrai. Les mainteneurs de `virtual-screen-reader`
l'écrivent de leur propre outil, et c'est vrai du nôtre.
