# Incrément 20 — Le studio du sudoku rattrape celui de l'enquête, et l'arrêt se mesure

## Ce que cet incrément traite

Le dernier point ouvert de l'incrément 19 : **le studio du cahier de sudoku n'avait ni annulation,
ni message d'échec, ni aucun test**, là où celui de l'enquête avait les trois. Les trois sont
livrés. En chemin, trois défauts se sont montrés — un défaut d'accessibilité dans le bandeau même
qui devait porter le message d'échec, un rejet non traité dans le chemin de partie, et un aperçu
qui mentait après un échec, celui-là dans le studio de l'enquête.

---

## 1. L'annulation : pourquoi il fallait **tuer**, et ce que cela coûte

### Le drapeau de l'enquête ne pouvait pas être recopié

Le studio de l'enquête s'arrête sur un **drapeau coopératif** relu entre deux affaires. Recopier ce
mécanisme ici aurait produit un bouton « Arrêter » qui ne répond pas : le gestionnaire du worker est
**synchrone**, donc il ne dépile aucun message tant qu'une grille n'est pas finie, et une grille
peut demander les **huit secondes** du budget de `generateAtLevel`.

Le mécanisme suit donc le coût de l'unité produite, et non le goût :

| | une unité coûte | mécanisme |
|---|---|---|
| cahier d'enquêtes | 19 ms médian, 470 ms au pire | drapeau seul |
| cahier de sudoku | jusqu'à 8 s (budget du générateur) | on tue le worker |

Mesuré, et c'est ce qui rend le pire cas trompeur : les **mêmes graines** prennent 217 ms à la
médiane dans Chromium et 1 029 ms sous `tsx`, avec un maximum passant de 447 à 2 531 ms. La raison
n'est pas linéaire — `generateAtLevel` s'arrête sur un **budget de temps**, donc une machine lente
échoue plus souvent à atteindre la bande demandée et y brûle le budget entier. **Le pire cas se
rapproche des huit secondes exactement sur les appareils où l'attente est la plus pénible.**

### `postMessage` d'un drapeau ne marcherait pas non plus

Ce n'est pas qu'on ne l'a pas essayé : un message ne peut pas être **reçu** pendant un calcul
synchrone. Et `postMessage` d'un `AbortSignal` n'existe pas — la proposition
([`whatwg/dom#948`](https://github.com/whatwg/dom/issues/948)) est ouverte depuis février 2021,
sans activité depuis juillet 2023, étiquetée *needs implementer interest*.

L'option `SharedArrayBuffer` + `Atomics` a été **écartée sur une contrainte d'hébergement**, pas par
goût : la mémoire partagée exige l'isolation cross-origin (COOP/COEP), GitHub Pages ne pose aucun
en-tête ([discussion #13309](https://github.com/orgs/community/discussions/13309), « no ETA »,
toujours ouverte en août 2026), et le contournement connu (`coi-serviceworker`) impose un service
worker de plus **et un rechargement à la première visite**. Pour un bouton.

Reste la manière forte, qui est **l'idiome attesté** : `workerpool` annonce « the worker executing
the task is enforced to terminate immediately » et tue au bout d'une seconde d'attente polie ;
Comlink renvoie explicitement à `terminate()`, faute de mieux, et documente que les promesses en
attente ne sont **pas** rejetées — c'est donc à faire à la main, et c'est fait.

### Ce que cela coûte, mesuré sur le paquet de production

Ressusciter le worker et obtenir sa première réponse : **36 ms à la médiane, 45 ms au pire** sur
douze essais, dont 24 ms d'amorçage net. Le module est bien redemandé à chaque naissance — vérifié
au journal réseau, treize requêtes pour treize workers — mais il figure dans le précache du service
worker (`{url:"assets/engine.worker-….js"}`), donc il sort du cache et non du réseau. À 24 ms, sous
le seuil des 100 ms où une action se perçoit comme instantanée, **garder un worker de rechange au
chaud est inutile** — c'est ce que fait `workerpool` avec `minWorkers`, et on s'en passe pour une
raison chiffrée.

### La latence réelle du bouton, et les deux coûts séparés

Mesurée sur le produit, dans un vrai navigateur, du clic jusqu'à l'apparition du bandeau :

| grilles déjà produites | feuilles à repeindre | clic → bandeau |
|---|---|---|
| 0 | 0 | **0,2 – 3,9 ms** |
| 3 | 4 | 24 – 29 ms |
| 10 | 12 | 64 – 89 ms |

**L'annulation elle-même tient sous 4 ms.** Le reste est la repeinte de l'aperçu de ce qui est
gardé — environ 6 ms par feuille, QR code compris — et même à douze feuilles l'ensemble reste sous
les 100 ms. À comparer aux huit secondes que le drapeau seul aurait pu laisser passer.

> ⚠ **Deux relevés faux, et ce qui les a trahis.** Le premier donnait exactement 1 000 ms, trois
> fois de suite : l'onglet était masqué, et un onglet masqué **bride `setTimeout` à une seconde**.
> Un nombre trois fois identique n'est pas une mesure, c'est une constante à expliquer. Tout a été
> repris au `MutationObserver`, dont les rappels passent par les microtâches et ne sont pas bridés.

### Ce qui reste **non mesuré**, et qu'il serait facile d'affirmer

`terminate()` rend la main en moins de 0,01 ms et **plus aucune réponse n'arrive** : cela, c'est
mesuré (un travailleur en boucle infinie signalant sa progression passe de 77 signaux en 700 ms à
zéro). Mais ce relevé **ne prouve pas que le calcul s'arrête** : l'algorithme de la spécification
vide aussi la file du port, donc un zombie qui posterait encore serait invisible.

Or Chromium s'accorde un délai de grâce — `kForcibleTerminationDelay = base::Seconds(2)` dans
`worker_thread.cc` — avant de forcer l'arrêt du moteur JavaScript. Le « stopped at once » de MDN
est donc inexact pour Chrome, et l'écart entre la spécification et les implémentations est une
issue ouverte ([`whatwg/html#6210`](https://github.com/whatwg/html/issues/6210), depuis décembre
2020). Firefox, lui, interrompt tout de suite (`JS_RequestInterruptCallback`).

**Deux sondes ont échoué à voir cette queue de calcul depuis la page** : avec soixante travailleurs
en boucle infinie sur vingt cœurs, le débit du fil principal était indiscernable du repos — le
bruit dépassait l'effet cherché. Elle reste donc **non mesurée**, et c'est écrit ainsi dans
`engineClient.ts` plutôt que comblé par du vraisemblable.

---

## 2. Le message d'échec, et le défaut qui l'aurait rendu muet

Le studio du sudoku n'avait **aucun** `catch` : une exception du moteur remontait sans un mot, et
l'aperçu gardait silencieusement son contenu précédent. C'est corrigé — mais en l'écrivant, le
bandeau lui-même s'est révélé défectueux.

Il était posé ainsi : `{#if notice !== ''}<p role="status">{notice}</p>{/if}`. **Une région vivante
créée en même temps que son texte n'est pas annoncée** — un lecteur d'écran doit avoir vu la région
vide pour remarquer qu'elle change. Le message d'échec que ce studio venait de gagner serait resté
muet pour exactement les personnes qui ne voient pas l'aperçu. L'annonceur global d'`App.svelte`
suit le bon motif depuis toujours ; ce coin-ci l'avait manqué.

La région est désormais permanente, avec `aria-live="polite"`, et vide elle ne peint rien :
`padding: 0` et pas de fond, **hauteur relevée à 0 px**. Pas `display: none`, qui la retirerait de
l'arbre d'accessibilité et ramènerait le défaut.

L'aperçu suit maintenant le message, y compris quand il n'y a plus rien à montrer. Montrer les
feuilles du cahier précédent en annonçant un échec était le défaut : on affichait un cahier dont on
ne parlait pas, **et c'est celui-là qui serait sorti de l'imprimante**. Le prix assumé : un arrêt
avant la première grille efface le cahier précédent. Un message qui contredit l'écran est pire.

Le bandeau dit maintenant quatre choses, et se taît sur aucune : le compte atteint, les grilles qui
n'ont pas atteint le palier, un arrêt volontaire — **jamais présenté comme une panne** — et les
tentatives qui n'ont rien donné. Ce dernier cas « ne devrait pas arriver », ce qui est précisément
la raison de l'afficher s'il arrive.

---

## 3. Un rejet que personne n'attrapait

En rendant les rejets normaux, un défaut **déjà présent** est devenu atteignable : `game.newPuzzle`
n'avait pas de `catch`, et `App.svelte` awaitait sa promesse sans en avoir non plus. Un worker en
erreur produisait donc un rejet non traité **et** une annonce qui mentait — « Génération… » restait
à l'écran pour toujours. Le chemin existait avant cet incrément : l'écouteur `error` du client
rejette déjà tout ce qui attend.

Les deux sont corrigés, et ils distinguent les deux causes : un arrêt volontaire est **silencieux**
et conserve la grille en cours ; une vraie panne s'annonce.

---

## 4. La boucle sort des deux studios

Les deux cahiers enchaînaient la même boucle, écrite deux fois — compter, appeler le moteur,
ramasser, relire un drapeau, tenir la progression. Dupliquée, elle n'était testée **nulle part**,
et pour une raison mécanique : un composant qui appelle le moteur ne se monte pas sans Web Worker.

Extraite dans `batch.ts`, sa fabrique est un paramètre, donc elle se vérifie sans navigateur, sans
worker et sans moteur. C'est le mouvement de `plan.ts` à l'incrément 18, où la géométrie des murs
est sortie de la vue pour que l'écran et le papier la partagent.

Elle est **agnostique du mécanisme d'arrêt** : elle reçoit un prédicat, pas un signal. C'est ce qui
permet au sudoku de tuer et à l'enquête de se contenter du drapeau, sans deux boucles. Et elle lit
un rejet comme un arrêt quand l'arrêt est demandé — sans quoi chaque clic sur « Arrêter »
afficherait un message d'erreur, puisque tuer le worker **fait rejeter** la requête en vol.

Deux choses sont revenues vers l'enquête au passage : ce qui précède un échec est désormais
**conservé et montré** — ce studio gardait l'aperçu précédent sans un mot — et un arrêt ne se lit
plus comme une panne.

---

## 5. Les tests

Vingt-six tests neufs, en trois fichiers, et **chacun prouvé mordant** en cassant volontairement le
code qu'il surveille :

- `batch.test.ts` (8) — la boucle, dont une propriété `fast-check` sur 200 tirages. La propriété a
  d'abord été écrite avec une implication à sens unique (« si l'on s'est arrêté, alors… ») : elle
  passait sur une boucle qui **ignorait le drapeau**. Affirmée dans les deux sens, elle mord.
- `engineClient.test.ts` (8) — l'arrêt, contre un travailleur de mensonge : le rejet reconnaissable,
  le worker tué, la résurrection, et le compteur d'identifiants qui **ne repart pas de zéro** — la
  vraie protection contre une réponse égarée.
- `PrintStudio.dom.test.ts` (10) — le studio, avec une doublure qui **retient** les requêtes au lieu
  de les simuler, ce qui rend observables l'instant où le bouton devient « Arrêter », le contenu du
  bandeau dans les quatre situations, et le fait qu'un arrêt tue bien le moteur.

Aucune grille inventée : celles qui servent sortent du générateur.

Ce que ces tests ne disent pas, et qui a donc été fait à la main dans un vrai navigateur : que
`terminate()` interrompe un calcul, que l'arrêt soit rapide, que la région vide n'occupe aucune
hauteur, et qu'une partie retrouve une grille après six morts du worker.

---

## Ce qui reste ouvert

- **La validation au lecteur d'écran** (incrément 19) : le protocole existe, personne ne l'a exécuté.
  Le bandeau corrigé ici est précisément le genre de chose qu'elle aurait attrapée plus tôt.
- **Guidepup en CI** — engagement d'infrastructure, pas une ligne de code.
- **La queue de calcul après `terminate()` sur Chrome**, non mesurée. Mesurable le jour où Chrome 153
  étend LoAF aux *dedicated workers*.
- **Deux corrigés par feuille** dans le cahier d'enquêtes.
- **WXYZ-Wing puis les chaînes**, ce que la mesure désigne pour étendre la portée du sudoku.
- **`LearnPanel.svelte`** pose une région vivante conditionnelle, du même motif que celle corrigée
  ici. Moins grave — elle paraît au chargement, pas en réponse à une action — mais c'est le même
  défaut, et il reste.
