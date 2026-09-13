# Valider les plateaux au lecteur d'écran

`CLAUDE.md` exige depuis l'incrément 6 que `role="grid"` soit **validé par un test réel avec un
lecteur d'écran** avant d'être considéré comme acquis, et note qu'`axe` ne peut pas le fournir.
C'est la seule règle écrite du projet qui ne soit pas tenue. Ce document ne la tient pas non plus :
il rend la validation **exécutable en une demi-heure par un humain**, et il dit ce qui a été
établi sans elle.

> ⚠ **Rien de ce qui suit n'a été entendu.** Les mesures citées viennent de rapports de bogues
> datés, du texte normatif, et des rapports publics du projet ARIA-AT du W3C. Une CI verte ne vaut
> pas mesure, et un arbre d'accessibilité non plus : il dit ce qu'un lecteur d'écran a **à sa
> disposition**, jamais ce qu'il **annonce**.

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
- et que **personne n'a encore écouté**. C'est la seule ligne de ce document qui devra changer.
