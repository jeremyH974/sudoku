# Incrément 4 — Studio d'impression

> Le plan stratégique complet est dans `docs/plan.md`. Les incréments précédents sont dans
> `docs/plan-increment-2.md` et `docs/plan-increment-3.md`.

---

## Context

Trois incréments sont livrés (`3b2c452`, `1cb8a06`, `ba4e8a7`). Le moteur génère des grilles à
niveau ciblé, mesure la difficulté par les techniques réellement nécessaires, et cette mesure est
désormais **calibrée contre Sudoku Explainer** (91,4 % d'accord exact sous 4,0, tenu par un test
sans Java).

Tout cela ne sert encore qu'un écran. Or deux choses attendent :

1. **La cible n°2 validée — les enseignants — n'est pas servie du tout.** La recherche les a
   décrits comme « bien servis mais très fragmentés » : ils bricolent entre plusieurs sites,
   aucun ne combinant génération par niveau, corrigés et progression.
2. **Le moat n°2 reste théorique.** Personne, sur ce marché, ne propose la *même* grille avec la
   *même* difficulté calibrée, cohérente sur papier et à l'écran. Krazydad excelle en PDF sans
   version jouable ; le leader a une page d'impression visiblement secondaire. Nous avons
   maintenant la seule pièce qui manquait à tout le monde : une difficulté qui veut dire quelque
   chose.

Et le marché de l'impression est réel : une dizaine de sites français et autant d'anglophones
vivent uniquement de la distribution de grilles à imprimer.

### Décisions validées

| Question | Décision |
|---|---|
| Pont papier → écran | **QR code + identifiant lisible** |
| Corrigés | **Cahier séparable** : grilles d'abord, corrigés ensuite, pages numérotées |
| Formats | **Standard 1 grille/page** et **cahier relié** |
| Bibliothèque QR | `qrcode-generator` — MIT, **zéro dépendance transitive** (les alternatives tirent yargs ou tslib) |

---

## Comment on imprime : CSS, pas de bibliothèque PDF

Décision déjà arrêtée au plan global, et qui structure tout le reste : on compose en HTML/CSS et
on passe par `@page` et `window.print()`. L'utilisateur choisit « Enregistrer en PDF » dans la
boîte de dialogue de son navigateur.

La raison est nette : **les bibliothèques PDF en JavaScript ne rendent pas le CSS.** jsPDF et
pdfmake demandent de reconstruire la mise en page dans leur propre API ; seul le moteur du
navigateur restitue fidèlement une grille, ses filets de bloc et sa typographie. Pour un cahier
dont l'unique critère de qualité est le rendu papier, se priver du seul moteur qui rend
correctement serait absurde.

Contrepartie assumée : pas de téléchargement direct d'un fichier. C'est un clic de plus, contre
un rendu juste.

---

## Le pont papier → écran

Le point qui demande le plus de réflexion, parce qu'une contrainte d'information s'y cache.

**Un identifiant de huit caractères ne peut pas contenir une grille.** 81 cases à dix valeurs
représentent environ 269 bits ; huit caractères alphanumériques en portent une cinquantaine. Tout
« code court » qui prétendrait reconstituer une grille arbitraire est soit adossé à un serveur —
que nous n'avons pas et ne voulons pas — soit un mensonge.

D'où trois objets distincts, chacun avec son rôle :

| Objet | Contenu | Rôle |
|---|---|---|
| **QR code** | L'URL complète, grille encodée dedans (~34 caractères en base64url) | Le chemin normal : on scanne, la grille s'ouvre. Instantané, sans réseau, sans serveur. |
| **URL en clair**, sous le QR | La même chaîne, en groupes de cinq | Le recours sans téléphone. Long à saisir, mais **honnête** : ça marche vraiment. |
| **Étiquette courte** (ex. `E-7F3A`) | Niveau + empreinte de la graine | Repérer une grille dans le sommaire du cahier et sur son corrigé. Ne reconstitue rien, et ne prétend pas le faire. |

L'encodage vit dans `packages/engine/src/io/` — le dossier était prévu au plan initial et n'a
jamais été rempli. Format : masque de positions sur 81 bits, puis les valeurs des indices sur
4 bits chacune, le tout en base64url avec un octet de version en tête. Environ 25 octets pour une
grille de 27 indices, soit 34 caractères.

Point important : **cet encodage porte la grille, pas sa graine.** Une grille reproduite depuis sa
graine dépendrait de `RATING_VERSION` et changerait sous nos pieds à la prochaine évolution du
moteur. Un cahier imprimé doit rester valable dans dix ans.

---

## Architecture

```
packages/engine/src/io/
├─ encode.ts         grille ↔ chaîne compacte, versionnée
└─ index.ts

packages/app/src/print/
├─ layout.ts         pagination : grilles → feuilles, selon le format
├─ presets.ts        les deux formats et leurs réglages
├─ PrintStudio.svelte   l'onglet : réglages, progression, aperçu
├─ PrintSheet.svelte    une feuille imprimable (grilles ou corrigés)
├─ PrintableGrid.svelte une grille en rendu papier, sans interaction
└─ print.css         @page, sauts de page, encre
```

**Pourquoi dans l'application et non dans un `packages/print`.** Le plan global prévoyait un
paquet dédié, utile le jour où le CLI produira des cahiers en masse. Il n'a aujourd'hui qu'un seul
consommateur, et nous avons déjà écarté deux fois une abstraction posée sur un cas unique. La
logique de pagination (`layout.ts`, `presets.ts`) est écrite sans dépendance au DOM : son
extraction sera mécanique le jour où elle servira ailleurs.

**Pourquoi un composant de grille distinct.** `SudokuBoard.svelte` porte la sélection, le focus,
les conflits, le survol — tout ce qui n'a aucun sens sur du papier, et dont les couleurs
coûteraient de l'encre. Une grille imprimée n'a besoin que de filets nets et de chiffres lisibles.

**Réutilisation.** `generateAtLevel` et `rate` (moteur) pour produire et étiqueter ;
`LEVELS`/`levelInfo` (`logic/rate.ts`) pour les libellés ; `formatGrid`/`parseGrid`
(`grid/grid.ts`) pour l'encodage ; le Worker existant (`engineClient.ts`) pour ne pas figer
l'interface.

**Le Worker doit apprendre à rendre compte.** Un cahier de vingt grilles expertes demande une
trentaine de secondes ; sans indication de progression, l'utilisateur croit à un plantage.
`engineClient.ts` gagne un canal de messages intermédiaires — le protocole le prévoit déjà, il
suffit d'émettre.

---

## Étapes

**4a — Encodage.** `io/encode.ts` : grille ↔ chaîne compacte, versionnée. Property test d'aller-
retour sans perte sur des milliers de grilles. C'est le socle du pont, et la seule partie qui doit
rester valable des années.

**4b — Mise en page.** `layout.ts` et `presets.ts` : répartition des grilles en feuilles, ordre
des corrigés, pagination, sommaire. Pure logique, donc testable sans navigateur.

**4c — Rendu papier.** `PrintableGrid.svelte`, `PrintSheet.svelte`, `print.css`. Le rendu à
l'écran doit **ressembler au papier** : aperçu sur fond de page, marges visibles.

**4d — Le studio.** Onglet « Imprimer » : niveau, nombre de grilles, format, options de corrigé,
en-tête personnalisable. Génération par lot avec progression réelle.

**4e — Le pont.** QR code et étiquettes sur les grilles ; à l'ouverture, l'application lit
l'URL et charge la grille encodée. Le tour complet — imprimer, scanner, jouer — doit fonctionner.

---

## Vérification

| Quoi | Comment |
|---|---|
| **Encodage** | Property test : `decode(encode(grille))` rend la grille d'origine, sur des milliers de cas. Un aller-retour qui perd une case rendrait un cahier entier faux. |
| **Compatibilité ascendante** | Golden test : des chaînes figées doivent continuer à décoder. Un cahier imprimé aujourd'hui doit s'ouvrir demain. |
| Pagination | Tests unitaires : nombre de feuilles, position des corrigés, numérotation, sommaire. |
| Cohérence papier/écran | Test : la grille encodée dans le QR, décodée, est **identique** à celle imprimée, et son niveau est le même. C'est le moat n°2 réduit à une assertion. |
| Le tour complet | Dans le navigateur : générer un cahier, ouvrir l'aperçu d'impression, lire l'URL d'un QR, la charger, vérifier que c'est la bonne grille. |
| **Rendu réel** | ⚠️ Ne se teste pas automatiquement. Checklist manuelle : aperçu Chrome **et** Firefox, A4, vérifier filets de bloc, absence de coupure de grille entre deux pages, lisibilité des chiffres, marge de reliure. |
| Non-régression | `pnpm check` reste vert, dont le test de conformité de l'incrément 3. |

---

## Hors périmètre, assumé

- **Gros caractères et feuille d'exercices multi-grilles** : écartés à l'arbitrage. Les presets
  étant des données (`presets.ts`), les ajouter plus tard sera une entrée de plus, pas un chantier.
- **Génération de cahiers en masse par le CLI** (B2B) : le moteur et la mise en page seront prêts,
  mais rien ne l'exige aujourd'hui.
- **Les techniques manquantes** (XY-Wing, XYZ-Wing, Turbot Fish) et les 4 grilles refusées à tort
  de l'incrément 3 : dette connue, toujours ouverte.
- **La PWA hors-ligne.** À noter : le README affirme « aucune requête réseau après le chargement »,
  ce qui est exact, mais recharger la page sans réseau échoue faute de service worker. La formule
  mérite d'être précisée tant que ce n'est pas fait.
- **La normalisation des accents** des commentaires de l'incrément 1.
