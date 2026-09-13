# Incrément 18 — Six chantiers, dont trois qui se ferment sur une mesure

## Ce que cet incrément traite

La liste des six chantiers restants, prise dans l'ordre où les mesures ont décidé :

1. **le résidu de désaccord avec l'oracle** — annoncé comme une bifurcation, c'était un défaut ;
2. **la sauvegarde d'Enquête** — le seul défaut fonctionnel vivant du projet ;
3. **la citoyenneté d'Enquête** — le lien de partage, et la pièce qui débloque le reste ;
4. **`role="grid"`** — la seule règle écrite du projet qui n'était pas tenue ;
5. **l'Unique Rectangle** — écarté sur mesure, et non reporté ;
6. **le rejet tardif de `carve`** — un chiffre corrigé, une piste fermée, une piste ouverte.

---

## 1. Le résidu n'était pas une bifurcation

### Ce qu'on croyait, et comment on l'a testé

Le README désignait « quatre grilles, mixtes en signe » comme un **résidu honnête de
bifurcation** : deux solveurs qui se séparent tôt et atterrissent ailleurs. Sept désaccords
subsistaient sur 317 grilles comparables.

Une bifurcation se teste. Le solveur n'a **qu'un seul degré de liberté** : parmi les trouvailles
de la technique la moins chère applicable, laquelle jouer. La technique, elle, est imposée —
l'ordre est par difficulté croissante, donc le choix est forcé. On a donc randomisé ce choix et
regardé la distribution des pics atteignables, 3 000 chemins par grille.

| | oracle | nous | pics atteints sur 3 000 chemins |
|---|---|---|---|
| grille 1 | 2,6 | 2,0 | 2,0 × 3000 |
| grille 2 | 3,0 | **3,4** | 3,4 × 3000 |
| grille 3 | 2,6 | 2,5 | 2,0 × 1492 · 2,5 × 1508 |
| grille 4 | 2,5 | 2,0 | 2,0 × 3000 |
| grille 5 | 2,6 | 2,5 | 2,5 × 3000 |
| grille 6 | 3,0 | 2,5 | 2,5 × 3000 |
| grille 7 | 3,0 | **3,4** | 3,4 × 3000 |

**Sur 21 000 chemins, le score de l'oracle n'est jamais atteint**, et cinq grilles sur sept ne
produisent qu'une seule valeur. Ce n'est pas une bifurcation : c'est une différence de ce que les
deux solveurs **voient**, pas de l'ordre dans lequel ils le voient.

### Le défaut

Les deux sur-évaluations portaient la même signature : l'oracle conclut par une paire **nue**
(3,0), nous par une paire **cachée** (3,4). Or la paire nue est essayée avant. Retirer les
variantes « Direct » ne change rien — elles n'expliquaient que trois désaccords sur sept.

Une implémentation naïve de la paire nue, écrite à part et sans partager la géométrie du moteur,
a tranché : **au moment exact où le solveur est contraint à 3,4, des paires nues éliminantes
existent** — deux sur la première grille, une sur la seconde.

```ts
    if (cells.length <= size) continue;   // ← le défaut
```

`cells` ne retient que les cases portant de 2 à N candidats, c'est-à-dire les **membres
possibles**. Mais les cases qu'un sous-ensemble nu élimine sont celles qui ont **plus** de N
candidats — exactement celles que le filtre vient d'écarter. Une colonne à quatre cases vides
dont deux tenaient en « 2 ou 8 » était abandonnée, alors que la paire nue y éliminait.

Aucun test ne pouvait le voir : la grille finissait résolue, par une technique plus chère. Le seul
symptôme était **une note trop haute**, et il aura fallu l'oracle pour l'apercevoir.

### Validé hors échantillon, sur les mêmes grilles

`CLAUDE.md` exige qu'une règle trouvée en mesurant soit rejouée sur un corpus neuf. 460 grilles
ont été produites sous une graine jamais employée, notées par l'oracle, et **les deux
détections rejouées dessus** :

| sur les mêmes grilles neuves | accord ≤ 4,0 | sur-éval | sous-éval |
|---|---|---|---|
| ancienne détection | 408/414 — 98,6 % | **4** | 2 |
| nouvelle détection | **413/415 — 99,5 %** | **0** | 2 |

Toutes les sur-évaluations disparaissent, aucune régression. Les deux sous-évaluations restantes
sont des variantes « Direct » — le mécanisme déjà documenté à l'incrément 9, qui ne peut produire
que des sous-évaluations.

### Ce que cela a coûté

`RATING_VERSION` passe de 5 à 6. Aucune valeur, aucun rang n'a bougé : c'est une correction de
**détection**. Corpus quotidien régénéré (99 jours retouchés, 574 créneaux, 45 jours dont les
scores attendus ont changé), corpus des leçons régénéré.

**Le quadruplet caché a perdu ses trois exercices**, et c'est la conséquence, pas un défaut : un
registre plus complet rend les techniques les plus chères moins souvent **nécessaires**. Deux
campagnes, 109 s puis 114 s, n'ont produit aucune grille où il soit le pic. L'accord vaut ici
aussi — sur les 441 grilles de la référence, **l'oracle ne rapporte lui non plus aucun « Hidden
Quad »**. Même figure que la paire revendiquée directe à l'incrément 9.

### Un défaut trouvé en chemin, non corrigé

**`pnpm dailies` ne converge pas en une passe** après un changement de barème : la première
exécution a laissé deux jours dont le score attendu était périmé, et seule la seconde les a
rafraîchis. Le test les a attrapés, donc rien n'a échappé — mais l'outil devrait converger seul.

---

## 2 et 3. Enquête cesse de perdre les parties

### Le codec, d'abord, parce que tout en dépend

Quatre ouvertures nommées au plan d'incrément 11 — sauvegarde, lien, affaire du jour, dossier
imprimé — attendaient **la même pièce manquante** : une sérialisation de l'affaire. Elle est
écrite une fois.

Le code porte trois choses : le décor, la victime, les indices. La solution, le coupable, la
technique la plus dure et le nombre d'étapes sont **recalculés** à la lecture. C'est la doctrine
du codec de grille, mot pour mot.

**La graine n'y est pas.** `composeCase` boucle sur des tentatives et branche sur `deduce` : un
changement du registre change l'affaire qu'une graine produit. Ce qui doit être identique pour
tout le monde et pour toujours porte donc l'affaire elle-même — la leçon que `CLAUDE.md` avait
déjà payée pour le sudoku.

Les familles d'indices, les meubles et les points cardinaux sont numérotés dans des tables
**figées, locales au module**, et non indexés dans `PROP_ORDER`. Réordonner `PROP_ORDER` est un
remaniement anodin partout ailleurs ; il changerait en silence la lecture de tous les codes
imprimés.

Mesuré : **27 à 36 caractères**, plus court qu'un code de grille, 60 aller-retours identiques
sur 60.

### Pas de somme de contrôle, et c'est mesuré

L'usage voudrait un caractère de contrôle façon base32 de Crockford. Il n'y en a pas, parce qu'il
y a mieux et que c'est gratuit : une affaire décodée doit avoir **exactement une solution**.

| 20 000 corruptions de chaque sorte | relues quand même |
|---|---|
| caractère **perdu** (troncature) | **0** |
| caractère **ajouté** | 1 (0,01 %) |
| caractère **substitué** | 611 (3,10 %) |

La troncature est le risque que la littérature nomme pour un lien partagé — un client de courrier
qui replie à 76 colonnes, une passerelle SMS qui recolle mal. On l'attrape intégralement, là où un
caractère de contrôle ne ferait pas mieux. Et ce qui survit n'est pas cassé : c'est une **autre
affaire valide**, à solution unique et déductible, parce que le décodage reconstruit tout.

### La sauvegarde

Écriture amortie de 400 ms, forcée sur `visibilitychange`, `pagehide` et `freeze`.
**`beforeunload` en est absent délibérément** : il ne se déclenche pas quand un navigateur mobile
est fermé depuis le gestionnaire d'applications — le cas le plus fréquent — et sa seule présence
rend la page inéligible au cache avant-arrière (Chrome for Developers, *Page Lifecycle API*).

Deux choses ne sont **pas** rangées, et le module dit pourquoi :

- **l'historique d'annulation**, qui est ici une pile de photographies du plateau entier, jusqu'à
  deux cents. L'écrire multiplierait la sauvegarde par deux ordres de grandeur pour une commodité
  que personne n'attend au retour ;
- **la durée**, parce que rien ne la mesure. Ranger un champ que rien n'alimente donnerait un
  nombre qui a l'air mesuré.

### Le lien, et le cas que le sudoku avait déjà tranché

`#a=<code>`, dans le **fragment** : un fragment n'est jamais envoyé au serveur, donc l'affaire
qu'on se partage n'apparaît dans aucun journal d'accès.

Un lien ouvert dans un onglet **déjà ouvert** ne recharge rien — changer de fragment est une
navigation dans le même document. Sans écoute de `hashchange`, cliquer le lien d'un ami pendant
qu'on joue ne ferait rien du tout. Vérifié dans un vrai navigateur, pas seulement sous jsdom :

- un suspect posé survit au rechargement (« Partie reprise — Le manoir. ») ;
- un lien valide change l'affaire dans un onglet resté ouvert ;
- un lien abîmé **le dit** au lieu d'ouvrir autre chose en silence.

### Ce qui n'est pas fait, et reste ouvert

L'affaire du jour, l'impression du dossier et les statistiques. La cartographie a relevé au
passage que la promesse du plan 11 — « l'issue d'une partie a la forme de celle du sudoku, une
branche dans `stats.ts` » — **n'est pas vraie au niveau des types** : `GameRecord.level` et
`GameRecord.lesson` viennent de `logic/`, et l'enquête a son propre `TechniqueId`, de même nom et
structurellement distinct. Ce n'est pas une branche, c'est une conception à trancher.

---

## 4. `role="grid"` — ce qu'on a pu mesurer, et ce qui reste dû

`CLAUDE.md` exige une validation au lecteur d'écran depuis l'incrément 6. Elle n'est **toujours
pas faite**, et rien ici ne la remplace. Ce qui a changé, c'est qu'on a lu l'**arbre
d'accessibilité d'un vrai Chromium**, que jsdom ne calcule jamais — et cela a produit une mesure.

Les deux plateaux posaient `aria-selected` sur chaque case pour marquer le curseur. Compté dans le
navigateur : **35 cases sur 36 portaient `aria-selected="false"`**, que NVDA énonce « non
sélectionné » — un mot de bruit sur presque chaque case.

Et l'attribut décrit autre chose que ce qui se passe. Une sélection ARIA, c'est un ensemble de
cases retenues pour une opération ; ici il y a un **curseur**, que le `tabindex` roving amène déjà
sous le focus, et un lecteur d'écran annonce toujours ce qui prend le focus.

Le support est documenté comme inconstant sur ce point précis : NVDA n'annonce rien sous Chrome et
rapporte toutes les cellules comme sélectionnées sous Firefox (`nvaccess/nvda` #15198, juillet
2023) ; l'état sélectionné n'est pas annoncé dans le **calendrier-grille de l'APG lui-même**, qui
est le cas officiel le plus proche du nôtre (#16454, avril 2024, clos en « needs external fix »).
Sarah Higley range `aria-selected` sur `gridcell` parmi les attributs à n'employer qu'en sachant
exactement ce qu'on fait.

L'attribut est retiré des deux plateaux. **« No ARIA is better than bad ARIA »** est la première
règle de l'APG.

En échange, le contrôle que le rôle `grid` **coûte** est désormais tenu. Le texte normatif de
l'APG dit qu'en mode application, l'utilisateur « n'entend que les éléments focalisables et le
contenu qui les nomme » : tout ce qui n'est pas dans le nom d'une case est inaudible. Un test
vérifie donc que les trente-six noms portent **seuls** leur rangée, leur colonne, leur pièce et
leur état.

⚠ **Rien de tout cela n'a été entendu.** Ce sont des rapports de bogues datés et du texte
normatif, pas une mesure à l'oreille. L'arbre d'accessibilité dit ce qu'un lecteur d'écran a à
sa disposition, jamais ce qu'il annonce. La validation reste due, et les outils repérés pour la
faire un jour sont Guidepup (NVDA piloté, gratuit, exige une machine Windows Server) et Assistiv
Labs (19 $/mois, NVDA et Narrator ; JAWS au palier supérieur).

---

## 5. L'Unique Rectangle est écarté, sur mesure

Il figurait en tête des manques depuis l'incrément 3. L'examiner a produit un chiffre qui tranche.

**Sur les 441 grilles de la référence, l'oracle ne rapporte aucun Unique Rectangle comme technique
de pic.** Aucun. Et les cinq grilles que nous ne savons pas résoudre demandent autre chose :

| ce que l'oracle exige | valeur |
|---|---|
| Forcing Chain × 3 | 7,1 · 7,2 · 7,2 |
| Bidirectional Y-Cycle | 6,8 |
| WXYZ-Wing 137 | 5,6 |

**Implémenter l'Unique Rectangle corrigerait zéro grille de ce corpus.** Ce que la mesure désigne
comme prochaine technique utile, si l'on veut étendre la portée, c'est le **WXYZ-Wing** puis les
chaînes — pas l'UR.

Une réserve, pour être juste : SudokuWiki mesure l'UR dans ~1,5 % de 141 672 grilles, mais compte
« employé par son solveur », pas « pic ». Les deux nombres ne se contredisent donc pas.

S'ajoute une raison qui engage une règle du projet. Toutes les sources s'accordent sur un point :
l'hypothèse d'unicité est une information **externe** à la grille. Une déduction par UR ne conclut
pas de la grille mais d'une **promesse sur la grille** — « l'auteur garantit une solution unique ».
C'est une autre nature de revendication que celle de toutes nos autres techniques, sur un projet
dont l'engagement central est de ne rien affirmer qu'il ne puisse soutenir. Le débat est d'ailleurs
vivant depuis 2006 et ne s'est pas clos : Denis Berthier a publié un contre-exemple où une
variante-limite (« UR1.1 ») pose une valeur **fausse** sur une grille pourtant unique.

Deux pièges d'implémentation sont notés ici pour le jour où la question se rouvrirait : la
condition porte sur les candidats que les quatre cases **auraient pu** porter, pas sur ceux
qu'elles portent encore (HoDoKu, « missing candidates ») ; et « donné » n'est pas « déjà résolu ».

---

## 6. Le rejet tardif de `carve`

### Un chiffre à remettre en place

J'ai résumé le gisement par « 91,3 % du travail est jeté ». C'est **91,3 % des `carve`
terminés** — dont la moitié parce qu'un suspect garde plus de deux cartes, et 36,9 % parce que
`deduce` ne sait pas résoudre le résultat. Les retraits réellement **refusés** pour perte
d'unicité ne font que **4,6 %** des tentatives. Le volume vient donc du nombre d'appels, pas de
leur taux de rejet.

### QuickXplain : fermé par le calcul, avec sa source

La reformulation tentante est connue : le problème est un **MSMP** (*Minimal Set subject to a
Monotone Predicate*), et la propriété requise est bien là — retirer des indices ne peut
qu'agrandir l'ensemble des solutions. QuickXplain (Junker, AAAI 2004) résout ce problème en
`O(k·log(n/k))` appels d'oracle au lieu de `O(n)`.

Sauf que sa Table 4 donne les bornes exactes, et qu'elles dépendent de `k/n` :

| n = 81 (sudoku) | dichotomie, pire cas | linéaire, pire cas |
|---|---|---|
| k = 17 | 110 | **98** |
| k = 25 | 135 | **106** |
| k = 30 | 146 | **111** |
| k = 40 | 161 | **121** |

L'exemple de Junker lui-même porte sur `k/n = 0,000008`. Le nôtre vaut 0,21 à 0,49 — un régime
dense où le gain s'inverse. **La dichotomie est plus mauvaise que ce que nous faisons déjà.**
Fermé, avec la référence.

### Un résultat négatif publié, qui vaut d'être su

« Chercher une **seconde** solution en en connaissant déjà une » est étudié sous le nom *Another
Solution Problem*. Yato & Seta (IEICE, 2003) prouvent qu'**ASP est NP-complet pour le sudoku**, par
réduction parcimonieuse — et que la complexité ne baisse pas quand on connaît déjà *n* solutions.
Connaître la solution n'offre donc **aucun raccourci de classe de complexité**. Les gains
éventuels seraient heuristiques, pas structurels.

### La seule piste vivante, et son chiffre

Seta (2002, chapitre 4) décrit l'approche inverse : construire en **ajoutant** des indices
jusqu'à ce qu'un solveur volontairement faible — notre `deduce` — résolve seul. L'argument de
correction est solide : une dérivation saine et complète ne peut désigner qu'une grille, donc
l'unicité devient **gratuite**, et la classe de rejet des 36,9 % disparaît par construction.

Reste le prix par appel. Mesuré sur 60 affaires : **`deduce` coûte 1,19 × un `solveExact` plafonné
à 2**. L'échange est donc arithmétiquement plausible.

**Ce n'est pas une décision de vitesse.** Elle changerait les affaires produites — exactement le
motif pour lequel l'incrément 17 a refusé de diriger l'ordre de retrait par la taille des cartes.
Elle est donc posée ici avec son chiffre, et laissée à trancher.

---

## Ce qui reste ouvert

- **La validation au lecteur d'écran**, toujours due, et toujours la seule règle écrite du projet
  qui ne soit pas tenue.
- **L'affaire du jour, l'impression du dossier, les statistiques d'Enquête.** Le codec les
  débloque toutes les trois ; les statistiques demandent en plus une conception, parce que
  `GameRecord` est plus spécifique au sudoku que le plan 11 ne le supposait.
- **`pnpm dailies` ne converge pas en une passe** après un changement de barème.
- **Le quadruplet caché sans exercice**, et l'accord avec l'oracle qui le rend acceptable.
- **La refonte constructive de `carve`**, chiffrée mais non tranchée.
- **WXYZ-Wing puis les chaînes**, si l'on veut un jour étendre la portée — et non l'Unique
  Rectangle, que la mesure écarte.
