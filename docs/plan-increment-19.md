# Incrément 19 — Trois chantiers, un défaut livré, et un test qui mentait une fois sur deux

## Ce que cet incrément traite

Les trois chantiers restants après l'incrément 18 :

1. **la refonte constructive de `carve`** — chiffrée à l'incrément 18, autorisée ici, et elle
   divise le temps de composition par trois et demi ;
2. **la validation au lecteur d'écran** — rendue exécutable, et la question du rôle tranchée ;
3. **le cahier d'enquêtes en lot** — et, trouvé en le cartographiant, un défaut que l'incrément 18
   avait livré sans le voir.

S'y ajoute un quatrième sujet qui s'est imposé : une **flakiness reproductible** de la suite de
tests, qui tombait une passe sur deux.

---

## 1. `carve` taille désormais contre ce que le joueur fera

### La prémisse, prouvée avant d'être utilisée

`deduce.ts` affirmait en tête qu'il « n'essaie jamais une case pour voir ». C'était une
affirmation, pas une propriété : **rien ne la vérifiait**. Le sudoku tient la sienne depuis
l'incrément 1 (`logic/testing.ts`), et son commentaire dit pourquoi — vérifier qu'une grille finit
résolue ne dit rien de la justesse du chemin.

Tant que `carve` taillait contre un comptage de solutions, cette solidité n'engageait que la
qualité des explications. La refonte en fait le **témoin d'unicité**, donc une propriété porteuse
de correction. Elle est donc prouvée d'abord, dans `deduce.test.ts` :

- aucun placement ne tombe ailleurs que dans la solution, aucune élimination ne porte sur la case
  que la solution donne ;
- **y compris sur des jeux d'indices amaigris**, qui est exactement le régime que `carve`
  traverse — retirer des indices ne peut qu'agrandir l'ensemble des dispositions compatibles, donc
  la solution en reste une ;
- et dans le sens observable : chaque fois que `deduce` conclut sur un jeu amaigri, le solveur
  exact confirme qu'il n'y avait **qu'une** disposition.

### La refonte

Le critère de retrait passe de l'unicité à la **déductibilité**. Le raisonnement est celui de Seta
(*The Complexities of Puzzles, Cross Sum and their Another Solution Problems*, Université de
Tokyo, 2002, chapitre 4) : si l'on taille contre un solveur volontairement faible qui ne devine
jamais, une dérivation complète ne peut désigner qu'une disposition. **L'unicité cesse d'être une
chose à vérifier pour devenir une conséquence.**

Ce que cela supprime : `composeCase` taillait contre un critère puis jetait le résultat contre un
autre. **38 % des tailles terminées mouraient là**, après avoir payé la centaine de comptages que
coûte un parcours complet.

### Mesuré, 400 graines, les deux variantes sur les mêmes

| | avant | après |
|---|---|---|
| total | 40,5 s | **11,3 s** |
| médiane | 63 ms | **19 ms** |
| p99 | 570 ms | **103 ms** |
| pire cas | 609 ms | **129 ms** |
| tailles pour 400 affaires | 4 089 | **1 287** |
| appels au solveur exact | 580 024 | **400** |

Le taux de rejet s'effondre : 3,2 tailles par affaire produite au lieu de 10,2.

**Les affaires produites changent** — c'est un changement de conception, autorisé comme tel, et
non une optimisation. Ce qui ne change pas : la longueur moyenne (8,7 → 8,9 indices), la
répartition des décors (**identique**), et celle des techniques de pic. Le seul déplacement
visible est une raréfaction des affaires triviales, dont la déduction la plus dure n'était qu'une
lecture d'indice : dix sur quatre cents, contre quatre.

Rien de ce qui est distribué n'en souffre : **un code d'affaire porte l'affaire elle-même, jamais
la graine**. Le corpus quotidien n'est donc pas régénéré — ses 370 affaires restent uniques et
déductibles, et les refaire ferait retélécharger un fichier à tout le monde pour rien.

Les 400 appels au solveur exact qui restent sont délibérés : **un par affaire produite**, ceinture
et bretelles, parce que l'implication est désormais porteuse de correction et qu'une technique
future qui devinerait ne serait rattrapée par rien d'autre. Le banc descend son plafond de 3 000 à
600 ms.

---

## 2. Le lecteur d'écran : exécutable, et le rôle tranché

Le détail est dans `docs/lecteur-decran.md`. Trois résultats méritent d'être ici.

**Lire l'arbre UIA de Windows n'aurait pas répondu.** L'idée était de dépasser l'arbre interne de
Chromium pour celui de la plateforme. Mais **NVDA n'utilise pas UIA pour Chromium** : son guide
2026 place ce réglage sur « uniquement si nécessaire » et se rabat sur IAccessible2, et une issue
ouverte confirme que le code bloque UIA sur la fenêtre de rendu de Chrome. Chromium a bien gagné
une implémentation UIA native (Chrome 138), mais c'est sa plomberie, pas le client par défaut de
NVDA. On aurait mesuré **Narrator**, à 0,7 % des usages, pas NVDA à 37,7 %. Écartée.

**Le W3C publie un plan de test pour ce motif exact**, et il donne la sortie vocale *verbatim* de
vrais lecteurs : ARIA-AT, *Minimal Data Grid*. Sur l'implémentation de référence de l'APG,
**NVDA + Chrome échoue encore l'assertion « annoncer le rôle grid »**. C'est la mesure la plus
utile de cette recherche : le motif lui-même n'est pas tenu, et aucune correction de notre côté ne
rattraperait cela.

**Et un argument mécanique tranche le rôle.** NVDA intercepte les flèches en mode navigation et ne
les transmet à la page qu'en mode formulaire — et c'est `role="grid"` qui déclenche ce
basculement. Un `role="table"` laisserait les flèches à NVDA et rendrait le plateau inutilisable
au clavier pour exactement ceux qu'on cherche à servir. **Le rôle est gardé**, et la raison est
écrite plutôt que supposée. `CLAUDE.md` porte la décision ; le doute qui y figurait depuis
l'incrément 6 est levé sur la question du rôle, et **maintenu** sur la validation elle-même.

Le protocole tient en une demi-heure : NVDA écrit ce qu'il prononce dans un fichier
(`--log-level=12 --log-file=`), huit gestes disent ce qui doit être annoncé, et trois verdicts
distinguent ce qui manque de notre fait de ce qui manque du fait du lecteur.

**Personne n'a encore écouté.** C'est la seule ligne du document qui devra changer.

---

## 3. Le cahier en lot, et le défaut qu'il a révélé

### Le défaut, d'abord

L'application est construite en **trois paquets indépendants** — accueil, sudoku, enquête — pour
qu'un joueur de sudoku ne télécharge jamais le moteur d'Enquête. La contrepartie n'avait pas été
tirée : une feuille de style globale importée d'un seul côté **n'existe pas de l'autre**.

`print.css` n'était importé que par `PrintStudio.svelte`, donc uniquement dans le paquet du
sudoku. **Le dossier d'enquête livré à l'incrément 18 sortait de l'imprimante avec l'en-tête, les
boutons, le plateau et les statistiques autour, et sans un seul saut de page.**

L'aperçu, lui, était parfaitement juste : rien ne pouvait le révéler avant d'appuyer sur Imprimer.
Le garde-fou est structurel — **qui pose une `.sheets` importe les règles qui la détachent** — et
il a été prouvé mordant en retirant l'import.

### Le cahier

`paginate` était déjà générique **dans son corps** : il ne lit aucun champ de ce qu'il répartit,
seulement la longueur du tableau. La dépendance ne vivait que dans les signatures. Il devient
`paginate<T>`, et `summarise` reçoit sa clef en paramètre au lieu de supposer un niveau. Aucun
opérateur n'a bougé.

**Une affaire par feuille, et ce n'est pas un réglage** : le plan doit rester assez grand pour
qu'on écrive dedans — 18 mm par case — et les témoignages doivent tenir au-dessus. Les corrigés
aussi ont leur feuille, ce qui est du papier qu'on pourrait économiser et qu'on choisit de
dépenser : chacun porte un plan complet, et un demi-plan se lit mal.

**Le sommaire compte les décors, pas une difficulté.** Le cahier de sudoku groupe par niveau parce
que ces niveaux sont calibrés contre un oracle ; l'enquête n'en a aucun. Un test vérifie les deux
moitiés — les comptes somment au total, et aucun mot de difficulté n'apparaît.

Deux choses que ce studio fait et que celui du sudoku ne fait pas : **il s'annule** et **il dit
quand il échoue**. L'annulation est un drapeau coopératif relu entre deux affaires, et non un
signal transféré au travailleur — `postMessage` d'un `AbortSignal` reste une proposition ouverte
du WHATWG, sans implémenteur.

Mesuré dans un vrai navigateur : douze affaires composées en 2,0 s, vingt-cinq feuilles sans
aucun débordement, 16,3 mm de marge au pire, et la reliure qui alterne recto-verso.

---

## 4. Une suite qui mentait une passe sur deux

Trouvé en mesurant, pas en relisant. Le projet `dom` échouait **une exécution sur deux**, toujours
sur le **premier test** de deux fichiers, toujours par dépassement de délai et jamais sur une
assertion.

La cause est le coût de l'outillage, que vitest chiffre lui-même : **40 à 84 secondes de
transformation par passe**, refaites à chaque exécution, et la variation est telle que le premier
test d'un fichier, s'il déclenche un import dynamique à froid, dépasse les cinq secondes du défaut.

Le délai du projet `dom` passe à vingt secondes, et c'est une propriété de **l'environnement** —
un jsdom par fichier, une compilation Svelte de tout ce qu'il importe.

⚠ **À ne pas confondre avec le délai supprimé à l'incrément 17.** Celui-là masquait un générateur
lent, et la vraie correction a été de le rendre rapide. Ici rien du produit n'est lent : composer
une affaire tient en 19 ms au médian. C'est l'outillage qui coûte, et un délai calé sur
l'outillage est le bon endroit pour le dire. Trois passes consécutives vertes après correction.

Un second cas, du même genre mais côté `unit` : le test d'aller-retour de l'encodage creuse
**soixante grilles réelles** à une vingtaine de millisecondes pièce. Son délai est désormais
explicite, comme ceux des corpus de `packages/cli`. Il ne masque rien — la lenteur est celle du
générateur qu'on veut éprouver.

---

## Ce qui reste ouvert

- **La validation au lecteur d'écran elle-même.** Le protocole existe ; personne ne l'a exécuté.
- **Guidepup en CI**, qui piloterait un vrai NVDA. C'est un engagement d'infrastructure — une
  session de bureau interactive sur la machine de CI — pas une ligne de code.
- **Deux corrigés par feuille**, à rouvrir le jour où quelqu'un imprimera vraiment quarante
  affaires.
- **WXYZ-Wing puis les chaînes**, si l'on veut étendre la portée du sudoku. C'est ce que la mesure
  désigne, et non l'Unique Rectangle, écarté à l'incrément 18.
- **Le studio du sudoku n'a ni annulation, ni message d'échec, ni aucun test.** L'enquête a
  maintenant les trois ; le sudoku les mérite.
