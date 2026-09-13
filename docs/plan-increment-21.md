# Incrément 21 — Quelqu'un a écouté, et la palette était fausse

## Ce que cet incrément traite

La seule règle écrite de `CLAUDE.md` qui n'était pas tenue depuis l'incrément 6 : **valider les
plateaux avec un vrai lecteur d'écran.** `docs/lecteur-decran.md` l'avait rendue exécutable à
l'incrément 19 ; elle est ici **exécutée**.

En la préparant, deux défauts de contraste sont apparus — présents depuis l'origine, et invisibles
à tout ce que le projet avait mis en place.

Le détail du protocole, les relevés verbatim et les verdicts sont dans `docs/lecteur-decran.md`.
Ce document garde ce qui s'en déduit pour la suite.

---

## 1. L'écoute

NVDA 2026.2 portable, Chrome 152, Windows 11, sur le site publié, grille figée par son code d'URL.
**NVDA tournait muet** — synthétiseur `silence` —, ce qui n'empêche pas la capture : elle se branche
sur `pre_speechQueued`, en amont de la synthèse. Il n'y avait donc rien à entendre, et tout à lire.

**Tenu** : le plateau ne consomme qu'un arrêt de tabulation sur vingt-six, les dimensions sont
annoncées, et la case prononce **notre** nom accessible — « ligne 1, colonne 1, vide », mot pour
mot, suivi de la lecture que NVDA fait lui-même de la position.

**Non tenu, et pas de notre fait** : NVDA annonce le plateau « tableau », jamais « grille ». C'est
l'échec ARIA-AT *Convey role 'grid'* reproduit sur notre plateau. Rien de notre côté ne le
rattraperait.

⚠ **Une conclusion de cet incrément était fausse**, et l'incrément 22 l'a corrigée : il en tirait
qu'il fallait forcer le mode formulaire par `NVDA+Espace`. Les deux exécutions avaient focalisé le
**conteneur** de la grille, où les flèches ne produisent rien — ce qui est normal. On ne conclut pas
d'un plateau ce qu'on a mesuré sur son conteneur.

---

## 2. Le contraste, mesuré pour la première fois

`CLAUDE.md` et le README écrivaient que le contraste « se mesure à la main ». C'était vrai de la
**composition rendue** — quelle couleur atterrit sur quel fond — et **faux de la palette**, dont
chaque paire est de l'arithmétique. Personne ne l'avait calculée, et « à la main » voulait dire
« jamais ».

Mesuré dans un vrai Chromium sur le site **publié** :

| jeton | pire cas | exigé |
|---|---|---|
| `--text-faint`, palette claire | **3,10:1** sur les quatre fonds | 4,5:1 |
| `--text-faint`, palette sombre | 4,08:1 sur deux fonds | 4,5:1 |
| `--accent` employé comme texte, sombre | **3,50:1** sur une carte survolée | 4,5:1 |

Dix-sept vues citaient le premier. Le second n'a rien d'hypothétique : `.game:hover` de l'accueil
pose exactement cette paire. Les deux étaient là depuis l'introduction des jetons.

`packages/cli/src/contrast.test.ts` calcule désormais chaque niveau de texte contre chaque fond,
dans les trois blocs de palette, **sans navigateur**, et exige que les deux blocs sombres soient
identiques. Il a mordu à sa première exécution : une première correction calée sur trois fonds
oubliait `--surface-hover` et laissait encore 4,48.

> ⚠ **Deux pièges qui reviendront.** Un jeton est soumis aux règles de **l'usage qu'on en fait, pas
> de son nom** : `--accent` est une couleur de texte. Et **`--surface-hover` est un fond** — un
> texte survolé reste du texte, et c'est celui qu'on oublie.

Après correction, quatorze combinaisons page × thème relevées dans un vrai navigateur : **zéro
violation**, contraste et taille de cible. `target-size` passait déjà partout avant.

---

## 3. Trois instruments qui mentaient

Aucun n'a produit de défaut livré, parce que chacun a été pris avant conclusion. Ils sont notés
parce qu'ils reviendront :

- **Un onglet masqué gèle les transitions CSS.** Le compositeur ne tourne pas, donc une transition
  en cours reste sur sa valeur de départ : la couleur rendue ment alors que les jetons ont déjà
  basculé. On coupe transitions et animations avant toute mesure de couleur.
- **Un onglet masqué bride `setTimeout` à une seconde.** Une latence sondée ainsi vaut donc
  1 000 ms, quelle qu'elle soit — trois relevés identiques l'ont trahi. Le bon instrument est le
  `MutationObserver`, dont les rappels passent par les microtâches.
- **Sonder la fenêtre de premier plan depuis PowerShell ouvre une console qui passe elle-même
  devant.** L'instrument mesurait son interférence. C'est NVDA qui donne le titre, et lui ne
  déplace rien.

---

## Ce qui reste ouvert

- **L'écoute par une personne qui s'en sert vraiment.** Une machine vérifie que la parole ne
  régresse pas ; elle ne dit pas que l'interface est confortable.
- **La composition rendue**, côté contraste : le test couvre la palette, pas ce que la page en fait.
- **WXYZ-Wing puis les chaînes**, si l'on veut étendre la portée du sudoku.
- **`LearnPanel.svelte` et `UpdateBanner.svelte`** posent des régions vivantes conditionnelles, du
  motif corrigé à l'incrément 20.
