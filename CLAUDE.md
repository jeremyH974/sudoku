# Conventions du projet

## Langue

- **Commentaires, documentation et interface : français**, correctement accentué.
- **Identifiants, noms de fichiers, messages de commit : anglais.**

Cette règle est tenue partout depuis l'incrément 5, qui a normalisé les 10 fichiers du moteur
restés sans accents. Le contrôle qui accompagnait cette passe est réutilisable : après une
retouche de commentaires, `git diff` ne doit montrer **aucune** ligne modifiée qui ne commence
pas par `//`, `*` ou `/*`.

## Le moteur est sacré

`packages/engine/src` ne doit **jamais** dépendre de l'environnement d'exécution : pas de DOM,
pas de `console`, pas de `performance`, pas de stockage, pas de framework, aucune dépendance npm.

Ce n'est pas une consigne de style, c'est vérifié mécaniquement : le projet compile avec
`lib: ["ES2023"]` **et `types: []`**. Un `console.log` oublié casse le typecheck.

⚠ `types: []` est indispensable et facile à perdre de vue. Sans lui, tout `@types/*` installé à
la racine devient visible ici — c'est arrivé avec `@types/node`, et le garde-fou est resté
silencieusement inopérant jusqu'à ce qu'une vérification manuelle le révèle. Les tests du moteur
sont soumis à la même règle : pas de `console.log` dedans. Les scripts d'outillage qui
ont besoin de ces globals vivent dans `packages/engine/scripts` et ont leur propre `tsconfig`.

## Zéro dépendance copyleft

HoDoKu est en GPLv3, le portage Rust de jczsolve en AGPL, Sudoku Explainer en LGPL. Leurs
**algorithmes publiés** sont réimplémentables ; leur **code** ne doit jamais être copié, ni lié.

Sudoku Explainer sera utilisé comme **oracle en boîte noire** : on exécute le binaire pour
comparer ses scores aux nôtres, on ne lit pas ses sources. Cela préserve les options commerciale
et open source permissive.

## Tests

La suite de tests est le garde-fou de qualité du projet, pas une formalité. En particulier :

- Les invariants du moteur se testent **par propriété** (`fast-check`), pas par exemples.
- **Aucun fixture inventé.** Toute grille de référence doit avoir été vérifiée par le solveur
  avant d'être figée dans un test — une grille écrite de mémoire est presque toujours fausse.
- Les valeurs du PRNG sont verrouillées par des snapshots. **Elles ne doivent jamais changer.**

> ⚠ **Un PRNG figé ne suffit pas à reproduire une grille.** `generateAtLevel` n'est reproductible
> ni d'une version à l'autre — sa recherche locale appelle `rate()` et branche sur le score, donc
> elle dépend de `RATING_VERSION` — ni même d'une machine à l'autre : elle s'arrête sur un budget
> en millisecondes, donc sur la vitesse du processeur.
>
> Tout ce qui doit être **identique pour tout le monde et pour toujours** porte donc la grille
> elle-même, jamais la graine qui l'a produite : le code imprimé sous chaque grille
> (`io/encode.ts`) et le corpus des défis quotidiens (`packages/app/public/daily/corpus.json`).

## Ordre des techniques logiques

Le score dépend fortement de **l'ordre dans lequel les techniques sont essayées** : deux
implémentations divergent sur la même grille. L'ordre est donc figé, versionné
(`RATING_VERSION`) et sérialisé avec chaque grille. Le modifier exige un bump explicite — deux
tests le vérifient et casseront.

L'ordre retenu est **le tri par difficulté croissante**, établi par la calibration et non par la
documentation, qui décrivait un ordre par familles et se trouvait fausse. Ne pas le « corriger »
d'après une source écrite : seul `pnpm calibrate` tranche.

## Conformité à l'oracle

`corpus/oracle-reference.json` fige les verdicts de Sudoku Explainer grille par grille, et
`packages/cli/src/conformance.test.ts` rejoue la comparaison **sans Java**. Le seuil d'accord
est un garde-fou : une modification du registre, d'une valeur de difficulté ou d'une détection
le fait chuter et casse la suite.

Régénérer après un changement délibéré : `pnpm calibrate`, puis vérifier que le taux ne baisse
pas avant de valider.

> ⚠ **Une règle trouvée en balayant des variantes doit être validée hors échantillon.** À
> l'incrément 9, huit règles ont été essayées sur les 313 grilles de référence, et la meilleure
> gagnait six grilles — assez peu pour que le surapprentissage soit une hypothèse sérieuse. Un
> corpus neuf sous une autre graine a tranché : 95,0 % contre 97,8 %, les deux règles rejouées sur
> les **mêmes** grilles neuves. Sans cette étape, on ne saurait pas si la règle est vraie ou
> seulement bien ajustée.

## Accessibilité

Non négociable, et traitée dès l'écriture, jamais en rattrapage :

- La couleur n'est **jamais** le seul porteur d'information (daltonisme, impression N&B).
- Contraste minimum 4,5:1. Palette bleu/orange, jamais rouge/vert seuls.
- Cibles tactiles ≥ 44 px.
- Toute l'interface est dimensionnée en `rem` depuis `html { font-size }`. **Aucune unité de
  fenêtre** (`vw`, `vh`, `dvh`…) dans `packages/app/src` : c'est ce qui avait rendu le réglage
  « gros caractères » totalement inopérant sur téléphone — la grille et ses chiffres se mesuraient
  contre la fenêtre, donc n'obéissaient plus à l'ancrage. La bonne mesure est `cqi` (une fraction
  du conteneur) ou `rem`. `packages/cli/src/appStyles.test.ts` le vérifie ; le modifier exige une
  raison écrite, pas un contournement.
- Le réglage de taille agit sur **deux** leviers, et il faut les deux : `font-size` sur la racine
  pour tout ce qui est en `rem`, et `--text-scale` pour les chiffres à l'intérieur d'une grille
  dont la largeur est déjà bornée par l'écran.
- `role="grid"` est **gardé**, et la raison est mécanique plutôt qu'esthétique : NVDA intercepte
  les flèches en mode navigation et ne les transmet à la page qu'en mode formulaire. Le
  raisonnement complet, ses sources et le protocole sont dans `docs/lecteur-decran.md`.

  ⚠ **La moitié de cet argument a été mesurée fausse** le 13 septembre 2026, NVDA 2026.2 + Chrome
  152 sur le site publié. Ce qui est confirmé : en mode navigation les flèches appartiennent bien à
  NVDA — la flèche droite a répondu « m », un caractère du bouton précédent, lu par son curseur
  virtuel. Ce qui ne l'est pas : **NVDA annonce le plateau « tableau », jamais « grille »**, et la
  bascule automatique en mode formulaire n'a pas été observée — il a fallu `NVDA+Espace`. Un rôle
  rendu « tableau » ne déclenche pas le traitement réservé aux grilles, donc `role="grid"` n'achète
  pas, en pratique, ce qu'on croyait lui devoir.

  C'est l'échec ARIA-AT *Convey role 'grid'* reproduit sur notre plateau, et **rien de notre côté ne
  le rattraperait**. Ne pas en conclure qu'il faut changer de rôle : la question décisive — une fois
  une **case** focalisée en mode formulaire, les flèches déplacent-elles le curseur du plateau ? —
  **n'est pas tranchée**, les deux exécutions ayant focalisé le conteneur et non une case.

  ⚠ La validation a été **exécutée** le 13 septembre 2026 : relevé verbatim et harnais rejouable
  dans `docs/lecteur-decran.md` et `scripts/lecteur-decran*.mjs`. Elle a confirmé que le nom de
  chaque case porte seul ce qu'il faut — « ligne 1, colonne 1, vide » est prononcé tel quel — et que
  le plateau ne consomme **qu'un** arrêt de tabulation sur vingt-six. Elle a aussi trouvé ce que le
  W3C annonçait, et une hypothèse du projet à corriger : voir le point sur `role="grid"` ci-dessus.
  Ce qui reste dû est nommé là-bas, et n'est plus « tout ». **`axe` ne peut pas le
  faire** — et plus généralement, un DOM simulé ne calcule aucune mise en page : les tests
  `*.a11y.test.ts` voient les rôles, les noms accessibles et l'ordre des titres, **jamais la
  taille des cibles**.
- **Le contraste se coupe en deux, et une moitié se calcule.** Jusqu'à l'incrément 21, le projet
  écrivait que le contraste « se mesure à la main ». C'était vrai de la **composition rendue** —
  quelle couleur atterrit sur quel fond — et faux de la **palette**, dont chaque paire est de
  l'arithmétique pure. `packages/cli/src/contrast.test.ts` la calcule désormais sans navigateur :
  chaque jeton de texte contre chaque fond, dans les trois blocs de palette, plus l'égalité des
  deux blocs sombres.

  Ce que cette lacune coûtait, mesuré dans un vrai Chromium sur le site publié : `--text-faint`
  ne tenait 4,5:1 sur **aucun** des quatre fonds clairs (3,10 à 3,51), et `--accent`, employé
  comme couleur de texte par six vues, tombait à 3,50 sur une carte survolée en sombre. Les deux
  étaient là depuis l'origine.

  ⚠ Deux pièges de méthode, tous deux rencontrés. **Un jeton est soumis aux règles de l'usage
  qu'on en fait, pas de son nom** : `--accent` est un texte. Et **`--surface-hover` est un fond** :
  un texte survolé reste du texte, et c'est le fond qu'on oublie — un premier correctif calé sur
  les trois autres laissait encore 4,48. La mesure dans un vrai navigateur reste due pour le
  reste, et une CI verte ne vaut pas mesure.
- **Une région vivante doit exister avant son texte.** Un `role="status"` créé en même temps que
  son message n'est **pas** annoncé : le lecteur d'écran doit avoir vu la région vide pour
  remarquer qu'elle change. Donc jamais de `<p role="status">` sous un `{#if}` qui dépend du
  message lui-même — on pose la région une fois pour toutes et l'on y écrit. Vide, elle se réduit
  par `padding: 0` et sans fond, **jamais** par `display: none`, qui la retirerait de l'arbre
  d'accessibilité et ramènerait le défaut.

  L'annonceur global d'`App.svelte` et celui d'`InvestigationPanel.svelte` tiennent le bon motif ;
  `PrintStudio.svelte` l'avait manqué jusqu'à l'incrément 20, ce qui aurait rendu son message
  d'échec muet pour exactement les personnes qui ne voient pas l'aperçu.

  Trois régions conditionnelles subsistent, et **elles ne se valent pas** :
  `UpdateBanner.svelte` (deux) et `LearnPanel.svelte` ont bien le défaut, à corriger.
  `App.svelte` (l'indice) l'a en apparence seulement — le texte de l'indice est **aussi** poussé
  dans l'annonceur global, qui lui est permanent, donc l'information est annoncée et le
  `role="status"` local n'est qu'une ceinture. Ne pas le « corriger » sans vérifier ce couplage.
- Le thème a **trois** états (clair, sombre, système) ; « système » retire l'attribut au lieu
  d'écrire une valeur. Tout accès à `localStorage` est enveloppé dans un `try` : en navigation
  privée, il lève.

## Les styles tiennent par des jetons

`packages/app/src/app.css` porte **toute** l'échelle : les couleurs, 4 rayons, 7 espaces, 6 tailles
de texte, 3 interlignes, 2 élévations, 3 durées, les cibles tactiles et les mesures de lecture. Un
fichier de vue n'écrit **aucune** valeur littérale : il cite un jeton.

Ce n'est pas une consigne de style, c'est vérifié — `packages/cli/src/appStyles.test.ts` casse sur
un `border-radius` littéral, une `font-size` en rem hors jeton, une graisse hors
{400, 500, 600, 700}, une couleur écrite ailleurs que dans `app.css`, un mouvement de plus de
200 ms, un `:hover` qui n'est pas sous `@media (hover: hover)`, ou un sélecteur qui a un `:hover`
sans `:active`. Les deux derniers sont des corrections de défauts vivants : au doigt, un navigateur
mobile émule le survol au toucher **et le laisse collé**, et sur tactile `:active` est le seul état
qui existe.

**Une exception, permanente : le papier.** `print/PrintSheet.svelte`, `print/PrintableGrid.svelte`,
`print/QrCode.svelte` et `print/print.css` vivent en millimètres et n'ont pas de thème —
`var(--text)` y imprimerait du gris clair. L'exception est **la liste de chemins du test**, pas un
commentaire : un fichier renommé en sort au lieu d'y entrer en silence.

> ⚠ Deux pièges avant d'y toucher. Les règles de jetons ne lisent que les blocs `<style>`, parce
> qu'`App.svelte` calcule trois tailles en ligne — **la taille du glyphe *est* le libellé du
> réglage**. La règle « aucune unité de fenêtre », elle, lit tout le fichier : un `vw` dans un
> `style=` est tout aussi mauvais. Et `print/PrintStudio.svelte` contient un `{@html '<style>…'}`
> dans son `<script>`, qui n'est pas une feuille de style du composant.

Une valeur **mesurée** n'entre pas dans une échelle : ni `--thumb-bar-reserve` (10,9 rem, la
hauteur relevée sous le pouce), ni les points de rupture. Mettre un point de rupture dans une
échelle d'espacement est la façon canonique de pourrir un design system.

## Honnêteté envers le joueur

Ne jamais afficher une difficulté qui n'est pas mesurée. Le nombre d'indices ne prédit pas la
difficulté (corrélation ≈ 0,27) ; l'annoncer comme un niveau serait mentir.

Le niveau affiché vient donc du solveur logique, et de lui seul. Trois conséquences à tenir :

- une grille que le registre ne sait pas résoudre ne reçoit **aucun** niveau ;
- quand la génération n'atteint pas le palier demandé, l'application le **dit** et propose la
  grille la plus proche, au lieu de l'étiqueter au jugé ;
- la notation est calibrée contre l'oracle (**99,5 % d'accord exact sous 4,0**, incrément 18,
  **validé hors échantillon**), mais **pas parfaite** : il manque les variantes groupées au-delà
  de 4,3, et deux grilles sur 415 restent sous-évaluées par une variante « Direct ».

  > ⚠ Le « résidu de bifurcation » n'existait pas. Randomiser le seul degré de liberté du
  > solveur sur 21 000 chemins n'a **jamais** atteint le score de l'oracle : les sept désaccords
  > venaient d'un défaut de détection des sous-ensembles nus, corrigé à l'incrément 18. Avant de
  > mettre un écart sur le compte du hasard, le tester coûte une heure.
  >
  > L'**Unique Rectangle** est écarté sur mesure, et non reporté : sur 441 grilles, l'oracle ne
  > le rapporte comme technique de pic **aucune fois**. Ce que la mesure désigne comme prochaine
  > technique utile, c'est le WXYZ-Wing puis les chaînes.

  L'interface ne doit pas laisser croire à une exactitude totale.

## Honnêteté envers le joueur, volet statistique

Même règle, appliquée aux chiffres de l'onglet Progression :

- **un indicateur que l'échantillon ne porte pas ne reçoit aucune valeur.** Un record se dit dès
  la première partie ; une médiane exige cinq parties du même niveau, et affiche sur combien elle
  porte. En deçà, on dit ce qui manque plutôt que d'afficher un à-peu-près ;
- **une durée non mesurable est `null`, jamais approximée** — exactement comme une grille que le
  registre ne sait pas résoudre ne reçoit aucun niveau ;
- **aucun taux de réussite** : il n'y a pas de bouton « abandonner », donc pas de dénominateur
  définissable ;
- **aucun compteur n'est persisté** (série, nombre de défis). Tout se recalcule depuis
  l'historique : deux sources de vérité finissent toujours par se contredire.

## Une dimension sans oracle se présente comme un compte

Le score pic est **calibré** : on peut le confronter à Sudoku Explainer, grille par grille. Les
deux autres dimensions — l'effort du chemin et sa largeur au moment le plus dur — n'ont aucun
oracle : `serate` ne rend que le pic, et le barème de HoDoKu ne porte pas sur notre registre.

La règle qui en découle, et qui ne se négocie pas :

- ces mesures sont affichées comme des **comptages** de choses observables, jamais comme des
  notes. « Au moment le plus dur, 2 coups étaient jouables » se vérifie ; « tension : 78/100 » ne
  se vérifie pas ;
- aucun adjectif attaché à une grille — « franche », « tendue » — : un adjectif suppose un seuil
  que rien ne fixe ;
- l'interface **dit** lequel des nombres affichés est calibré et lesquels ne le sont pas. C'est
  l'engagement « tout est affiché » du plan, et il se tient à l'écran, pas dans un fichier ;
- ces comptages dépendent du registre : ils portent la version du barème, comme le score.

Le « score travail » à la HoDoKu a été **écarté pour cette raison**, pas par manque de temps : son
calcul est gratuit, mais personne au monde ne pourrait le contredire.

> ⚠ **Ne jamais faire entrer ces mesures dans `rate()`.** Celle-ci est la boucle chaude du
> générateur — jusqu'à quatre cents appels par grille produite. Un test structurel interdit à
> `logic/` et `generate/` d'importer `rating/` ; la dépendance ne va que dans l'autre sens.

## Enseigner sans mentir

La campagne d'apprentissage suit la même règle que la difficulté : **on n'invente pas un
exercice.**

- Une grille d'exercice doit avoir la technique enseignée pour **technique la plus difficile**,
  vérifié à la génération et rejoué à chaque exécution des tests. Une technique sans grille reçoit
  un tableau vide, et l'interface explique pourquoi — elle ne fabrique pas un exercice où la
  technique ne serait pas nécessaire.
- Le raccourci tentant, à refuser : appeler le `findAll` d'une technique sur une position
  quelconque produirait toujours un motif sain. Mais si une technique moins chère s'applique au
  même endroit, la leçon enseignerait « ici il faut un quadruplet nu » alors qu'il n'en faut pas.
- **Une position n'a pas de niveau.** Un exercice affiche la technique qu'il enseigne, jamais la
  difficulté de la grille dont il est extrait.
- Le corpus des leçons ne porte **que la grille** : ni score, ni niveau, ni index d'étape. Un index
  figé pointerait silencieusement ailleurs après un changement de barème ; on cherche donc la
  première étape qui emploie la technique, et l'absence se dit.
- Les exercices sont **exclus** des statistiques par niveau : quarante secondes et quarante minutes
  dans la même médiane produiraient un chiffre qui a l'air mesuré et ne l'est pas.

> ⚠ **Ne pas conclure trop vite à l'impossible.** Deux sondes avaient établi que le quadruplet nu
> était hors d'atteinte — zéro occurrence sur ~22 000 échanges — et la conclusion était fausse.
> Plusieurs graines, l'abandon de la symétrie et la récolte au vol en produisent trois en
> 55 secondes. Une mesure négative sur une configuration ne vaut que pour cette configuration.
>
> L'inverse vaut aussi. À l'incrément 9, la **paire revendiquée directe** est devenue introuvable
> après un resserrement du barème : 4 000 tentatives, les deux symétries, rien. Avant de le
> déplorer, il fallait regarder l'oracle — qui n'en rapporte lui non plus aucune sur 335 grilles.
> Ne pas savoir en produire était un **accord**, pas une lacune.

## Annuler un travail du moteur

Le gestionnaire du Web Worker est **synchrone** : tant qu'un calcul n'est pas fini, il ne dépile
aucun message. Trois conséquences qui ne se devinent pas :

- **Un drapeau envoyé par `postMessage` n'arrive jamais à temps** — il serait lu *après* le calcul
  qu'il cherche à interrompre. Et `postMessage` d'un `AbortSignal` n'existe pas : la proposition
  (`whatwg/dom#948`) dort depuis juillet 2023, étiquetée « needs implementer interest ».
- **`SharedArrayBuffer` est hors d'atteinte ici**, et c'est une contrainte d'hébergement, non un
  choix : la mémoire partagée exige COOP/COEP, et GitHub Pages ne pose aucun en-tête. Le
  contournement (`coi-serviceworker`) coûte un service worker de plus et un rechargement à la
  première visite.
- **Le mécanisme suit donc le coût de l'unité produite**, et c'est une règle, pas un goût. Une
  affaire d'enquête coûte 19 ms à la médiane : un drapeau coopératif relu entre deux affaires
  suffit. Une grille de sudoku peut coûter les 8 s du budget de `generateAtLevel` : il faut
  **tuer le worker** (`engine.stop()`), seule façon d'interrompre un calcul synchrone. Mesuré, la
  résurrection coûte 36 ms à la médiane sur le paquet de production — inutile d'entretenir un
  worker de rechange.

⚠ `stop()` emporte **tout** ce qui est en vol, puisqu'un seul worker sert toute l'application. Tout
appelant doit donc gérer un rejet : `EngineStopped` se distingue d'une panne, et le confondre avec
elle afficherait une erreur pour une action volontaire. La boucle de production partagée
(`print/batch.ts`) tranche ce cas à un seul endroit.

⚠ `terminate()` rend la main tout de suite et plus aucune réponse n'arrive — mais **rien ne prouve
que le calcul s'arrête** : Chromium s'accorde deux secondes de grâce
(`kForcibleTerminationDelay`), le « stopped at once » de MDN est inexact pour Chrome, et deux sondes
n'ont pas réussi à voir cette queue depuis la page. Ne pas l'affirmer.

## Vérification avant de conclure

```bash
pnpm check
```

Typecheck, lint et tests. Rien n'est « terminé » tant que les trois ne passent pas.

> ⚠ **Un onglet masqué bride `setTimeout` à une seconde.** Toute latence mesurée par un sondage en
> `setTimeout` dans un onglet d'arrière-plan vaut donc 1 000 ms, quelle qu'elle soit — c'est
> exactement ce qu'un relevé a donné trois fois de suite à l'incrément 20 avant d'être jeté. Un
> nombre trois fois identique n'est pas une mesure, c'est une constante à expliquer. Le bon
> instrument est le `MutationObserver` : ses rappels passent par les microtâches et ne sont pas
> bridés.
