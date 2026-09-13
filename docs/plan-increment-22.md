# Incrément 22 — La machine écoute, et elle corrige l'incrément 21

## Ce que cet incrément traite

« Guidepup en CI », ouvert depuis l'incrément 19 et décrit là-bas comme **un engagement
d'infrastructure, pas une ligne de code**. C'était les deux, et l'infrastructure a coûté quatre
tentatives.

Le résultat n'est pas seulement un job vert : il **corrige une conclusion** de l'incrément 21.

---

## 1. Ce que la machine entend

`.github/workflows/lecteur-decran.yml`, runner Windows, **1 min 38 s** — dont 34 s d'écoute.

```
[tab.8]  « main landmark »                                      ← le plateau
[tab.9]  « Saisie des chiffres, grouping, Placer le 1, … »      ← on l'a dépassé
[retour] « Grille de sudoku, 9 lignes sur 9 colonnes, table »
[ou]     « ligne 1, colonne 1, vide, cell, focused »
[droite] « ligne 1, colonne 2, 7, indice de départ, row 1, column 2 »
[bas]    « ligne 2, colonne 2, 2, indice de départ, row 2, column 2 »
```

**Les flèches annoncent la case voisine, et aucun `NVDA+Espace` n'a été pressé.** L'incrément 21
concluait l'inverse. Il se trompait : ses deux exécutions avaient focalisé le **conteneur** de la
grille, où les flèches ne produisent rien — ce qui est normal. Une conclusion sur le mode, tirée
d'une mesure sur le conteneur.

La phrase fautive est **laissée en place** dans `docs/lecteur-decran.md`, avec l'avertissement à
côté. Se relire est plus instructif que se corriger en silence.

Ce qui survit de l'incrément 21 : le conteneur est annoncé « table », jamais « grid ». L'échec
ARIA-AT est réel, et il coûte **moins cher qu'on ne le croyait** — il prive l'utilisateur de
l'annonce du rôle, pas de la navigation.

---

## 2. Le clic humain n'était pas nécessaire

Cinq clics ont été dépensés à l'incrément 21 parce que `AppActivate` et `SetForegroundWindow`
rendent `True` sans rien faire : Windows interdit à un processus d'arrière-plan de voler le premier
plan.

La parade n'est pas de ruser avec l'OS. La fixture Playwright de guidepup **cycle les fenêtres avec
`Alt+Échap`** — une frappe injectée par NVDA, qui lui en a le droit — et **vérifie par la parole**
qu'elle est arrivée, dix fois à une demi-seconde. On ne demande jamais à l'OS de remonter une
fenêtre ; on tourne jusqu'à tomber dessus, et on écoute pour le savoir.

Cela marche en CI **et** sur un poste de travail : le clic humain n'est plus qu'un dernier recours,
proposé seulement là où quelqu'un regarde.

---

## 3. Deux décisions de dépendances

**`@guidepup/setup` n'entre pas.** Il dépend de `@guidepup/record`, qui dépend de `ffmpeg-static` :
**quatre-vingts mégaoctets** téléchargés à chaque installation du dépôt, y compris sur la CI Linux
qui tourne en une minute et n'a que faire d'un encodeur vidéo. Le workflow télécharge donc l'archive
lui-même — et y gagne ce que l'outil ne montrait pas : **la somme de contrôle est vérifiée**, et
elle vient du manifeste de guidepup, pas de nous. La clé de cache vient du même manifeste, si bien
qu'une montée de version l'invalide toute seule. Vérifié : restauration en 14 s, installation
sautée.

**`@guidepup/virtual-screen-reader` non plus**, et c'est un refus délibéré. Il calculerait un arbre
d'accessibilité à chaque poussée — plus que ce que voit `axe` — mais il tire dix-neuf paquets, dont
`@testing-library/dom`, la famille que ce projet a explicitement écartée (`test/render.ts` : « une
enveloppe de vingt lignes que nous maîtrisons vaut mieux qu'une dépendance de plus à suivre »). Ses
propres auteurs écrivent qu'il *n'est pas un substitut*. Écarté pour la raison, pas par oubli.

Reste `@guidepup/guidepup` : aucune restriction d'OS, aucun script post-installation, deux petites
dépendances, 1,4 Mo.

---

## 4. Pourquoi ce job n'est pas dans `ci.yml`

`ci.yml` tourne en une minute sur Linux et **garde la publication**. Y mettre l'écoute reviendrait à
faire dépendre une mise en ligne d'un lecteur d'écran tiers — celui-là même dont on vient de mesurer
qu'il n'annonce pas le rôle `grid`. Le job est donc à part : `workflow_dispatch` et un rendez-vous
hebdomadaire.

Ce n'est pas la seule pratique possible, et le dire est honnête : guidepup déclenche la sienne sur
chaque poussée ; ARIA-AT ne déclenche qu'à la main. Nous sommes entre les deux, par choix.

---

## 5. Quatre tentatives, quatre causes

Elles sont notées parce qu'aucune n'était devinable :

1. **`npx guidepup`** cherchait sur le registre un paquet nommé `guidepup` : le binaire porte ce
   nom, le paquet s'appelle `@guidepup/setup`.
2. **`Start-Process`** ne survivait pas à la fin de son étape ; l'attente qui suivait expirait sur
   un serveur mort-né. `bash` et `&` traversent les étapes.
3. et 4. **Deux assertions à moi ont échoué sur de bonnes réponses.** Elles demandaient à `NVDA+Tab`
   les dimensions du plateau — mais cette commande rapporte l'**objet focalisé**, qui est une case —,
   puis cherchaient une case **après** avoir tabulé au-delà du plateau. Le produit allait bien ;
   c'est la séquence qui était fausse.

---

## Ce qui reste ouvert

- **L'écoute par une personne.** Une CI verte dit que la parole n'a pas régressé. Elle ne dit pas
  que l'interface est utilisable — cela demande quelqu'un qui s'en serve.
- **Un seul plateau est écouté**, celui du sudoku. Celui d'Enquête ne l'est pas encore.
- **La fragilité n'est pas mesurée.** Guidepup encaisse la sienne avec cinq essais par test ; notre
  job n'en fait aucun. Deux exécutions vertes ne sont pas un taux.
