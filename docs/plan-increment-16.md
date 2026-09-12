# Incrément 16 — La bibliothèque d'images

Les seize portraits quittent le SVG écrit à la main pour devenir des **images**. Le plan, lui,
reste vectoriel et gagne du volume. C'est le premier incrément dont le livrable n'est pas du code.

---

## Pourquoi le SVG s'arrête ici, et c'est mesuré

| Fait | Source | Conséquence |
|---|---|---|
| Nos 26 tracés par portrait valent **avataaars (28)**, le plafond mesuré du genre « avatar plat » | Comptage direct sur les sorties SVG de DiceBear, avataaars, Draftbit Personas (sept. 2026) | On est au **bout** de ce style, pas en retard dessus |
| Une illustration vectorielle détaillée (1 000+ nœuds) pèse **84,5 ko**, dont 78 % de données de tracé | svgai.org, étude de 73 fichiers, 29/09/2025 | Seize portraits = **1,35 Mo** |
| Convention d'insertion en ligne : **4 ko** par fichier | kurtextrem.de / standard Astro, maj 02/06/2025 | On serait vingt fois au-dessus |
| Sur un dessin détaillé, l'avantage du SVG **s'inverse** — un cas mesuré donne 68× plus lourd qu'un JPG, 12× qu'un PNG | Bounteous, 06/06/2023 | Le vectoriel cesse d'être le choix économique |
| **Aucun précédent** de 16 à 100 illustrations à ce niveau livrées en SVG en ligne | Recherche sur unDraw, Open Peeps, Humaaans, DiceBear | Tous restent plats **exprès**, pour tenir à l'échelle |

La conclusion n'est pas « le SVG est mauvais ». C'est que **le SVG est excellent pour l'aplat
géométrique — donc pour le plan — et mauvais pour l'illustration rendue**. On met chaque médium là
où il gagne.

---

## Ce que la sonde a prouvé, et ce qu'elle a démenti

Deux tirages, quatre personnages aux coordonnées exactes de la table, `gpt-image-2`, 0,067 $ l'image.

**Ce qui a marché, contre l'attente :**

- **Fidélité aux attributs : 19/20 sur les deux tirages.** Les cinq axes sont respectés pour Adèle,
  Bruno et Clara ; seul Damien sort avec une peau plus claire que le `#5f3a24` demandé, aux deux
  tirages. Les benchmarks prédisaient pire (voir ci-dessous) : ils mesurent la préservation
  d'**identité** en composition multi-sujets, une tâche plus dure que l'assignation d'attributs
  depuis un texte dans un alignement.
- **La dérive entre deux tirages est faible.** Même épaisseur de trait, même encre brun chaud, même
  cadrage général, mêmes partis pris de couleur. C'est le résultat le plus encourageant.

**Ce qui a échoué, et qui décide de la suite :**

- **Le modèle n'a pas obéi au cel shading.** On demandait « un aplat plus exactement une ombre, pas
  de dégradé » ; il rend des dégradés doux sur la peau et les cheveux. Tel quel, le portrait **ne
  s'accorde pas** avec le plan en aplats francs. C'est le point dur de l'incrément.
- **Le cadrage n'est pas identique.** Les tailles de tête varient, la ligne des yeux flotte, et les
  quatre panneaux portent des coutures de fond. Rien de tout cela ne se règle par le prompt : ça se
  règle **après**, au recadrage.

---

## Ce que la recherche a corrigé dans mon approche

### Mon problème n'est pas celui que je croyais

La littérature parle de « cohérence de personnage » : garder **une** identité à travers plusieurs
scènes. Notre besoin est l'inverse — **seize identités différentes dans un même style**. Midjourney
sépare d'ailleurs explicitement les deux (`--cref` verrouille un personnage, `--sref` un style) ;
c'est de **cohérence de série** qu'il s'agit, et les outils ne sont pas les mêmes.

Pire : la littérature de verrouillage d'identité documente une tension qui nous serait **nuisible**.
IP-Adapter, InstantID et ConsistentID obtiennent de bons scores de visage mais une fidélité
textuelle « notablement pauvre » ; IP-Adapter-FaceID « perd l'information d'identité quand on la
combine à des prompts d'attributs faciaux ». Traduit : verrouiller un visage-gabarit puis faire
varier cheveux, peau et lunettes par-dessus ferait **résister** le verrou à nos changements. C'est
l'inverse de ce qu'il nous faut.

### Une planche unique est le meilleur choix pour le style et le pire pour les attributs

| Mesure | Résultat | Source |
|---|---|---|
| **CogCanvas** — préservation d'identité selon le nombre de sujets dans une image | 45,3 à N=2, **18,3 à N=5** ; les méthodes concurrentes tombent quasi à zéro dès N=4. Modes d'échec nommés : **fuite d'attributs entre sujets**, régression du fond | arXiv 2606.15867, 2026 |
| **TRACE-Bench** — extraire un attribut précis contre composer une scène | **0,74/1,0** pour « Disentangle » contre 0,91 pour « Compose » | arXiv 2608.16765, 2026 |

Le goulot est donc **l'assignation d'attributs, pas la mise en page**. Une grille 4×4 portant seize
spécifications distinctes en un seul appel est le pire endroit où les demander.

> ⚠ Notre sonde a fait mieux que ces chiffres ne le laissaient craindre, à quatre sujets. Ça ne les
> contredit pas : ils mesurent autre chose, et à cinq sujets et plus. **Ne pas extrapoler de quatre
> à seize** — c'est exactement la faute que l'incrément 9 a appris à éviter.

---

## La recette retenue

1. **Verrouiller « la main » sur une petite planche.** Deux à quatre personnages choisis aux
   extrêmes de la table (cheveux courts / peau claire / sans lunettes contre cheveux longs / peau
   foncée / avec lunettes), en un seul appel. C'est cette planche, validée à l'œil, qui fixe
   proportions, ligne des yeux, épaisseur de trait et température de couleur.
2. **L'extraire comme référence de STYLE, jamais de personnage.** `style_id` chez Recraft,
   Style Reference chez Firefly, ou l'image jointe en entrée multi-image avec la consigne explicite
   « même rendu, personnage différent ».
3. **Engendrer les seize un par un**, à la résolution native maximale, chacun avec sa ligne de la
   table énoncée axe par axe.
4. **Filtrer, pas corriger à l'aveugle.** Chaque portrait est vérifié contre ses cinq axes ; s'il
   dévie, on régénère. Si un seul axe cloche sur un portrait par ailleurs réussi, on édite **cet
   axe seul** — et pas plus de deux éditions successives, le bruit s'accumule.
5. **Post-traiter uniformément**, et avec les bons outils :
   - **détourage** par un modèle entraîné sur l'illustration — BiRefNet, ou son affinage **ToonOut**
     — et non un détoureur photo ;
   - **alignement de la ligne des yeux** par un détecteur de points **spécifique aux visages
     stylisés** (`hysts/anime-face-detector`). Les aligneurs photographiques usuels (dlib,
     `face_recognition`) sont documentés comme défaillants sur du dessin : le jeu de données FLSC
     existe précisément pour cette raison ;
   - **normalisation colorimétrique** par appariement d'histogrammes vers la planche de référence.
6. **Engendrer grand, réduire ensuite.** Jamais de génération native en petit.

---

## La charte de série

Ce qui est **verrouillé** pour les seize — c'est la liste qui fait « une seule main » :

| Verrou | Valeur | Statut |
|---|---|---|
| Angle | Face stricte, jamais de trois-quarts | Imposé par la lisibilité à 56 px |
| Cadrage | Buste, sommet du crâne au milieu du torse ; visage à 70-75 % de la hauteur | Adapté de l'ICAO 9303 (photo d'identité) |
| Ligne des yeux | 58-63 % de la hauteur depuis le bas | Compromis entre ICAO et la règle des tiers — **aucune source ne la fixe pour du dessin** |
| Trait | Deux poids : silhouette extérieure, et détail interne à 40-50 % | Ratio adapté des design systems d'icônes (Material : 2 dp constant) |
| Couleur du trait | **Teinté**, jamais noir pur | Tendance 2024-2026 repérée ; notre sonde l'a fait spontanément |
| Ombres | **Deux valeurs**, bord identique pour les seize | Définition du cel shading, et ce qui survit à la réduction |
| Lumière | Haut-gauche, identique partout | Principe unanime des art bibles ; l'angle exact est un choix |
| Fond | Aplat uni, sans décor | Observé sur les castings de jeux à gros effectif |
| Palette | 3 à 4 couleurs dominantes par personnage | Convergence des design systems (Polaris, Carbon, Pajamas) |

Ce qui **doit varier** porte toute la distinction : coiffure, morphologie, âge apparent, teint,
sourcils, accessoires, vêtement. C'est déjà notre table à cinq axes.

### La tension qu'il faut trancher, et qu'aucune source ne tranche

> **Ce qui signale « moderne 2026 » est exactement ce qui disparaît à 56 px.**

Iris en dégradé, reflets multiples, épaisseur de trait variable : ce sont les marqueurs
contemporains, et ils sont **invisibles** à la taille d'affichage. Un budget de détail dépensé là
est un budget perdu.

Les jeux à gros casting tranchent de la même façon : *Ace Attorney* ne réduit pas son portrait pour
en faire une icône de 32 px, il en **redessine** une version simplifiée. *Danganronpa* et *League of
Legends* conçoivent la silhouette pour la réduction dès le départ.

**Décision** : la version 56 px est un **objectif de conception**, pas une réduction automatique. Ce
qui doit y survivre — silhouette, une teinte dominante, un point de contraste fort — est ce qui
porte les cinq axes. Le reste est du luxe pour les usages en grand.

---

## Ce que les conditions d'utilisation imposent

> *Ce qui suit rapporte le texte de sources consultées le 12 septembre 2026. Ce n'est pas un avis
> juridique.*

| Fournisseur | Propriété | Commercial | Indemnisation | Entraînement |
|---|---|---|---|---|
| **OpenAI, par l'API** | Cédée à l'utilisateur | Oui, sans palier | **Oui** (Copyright Shield) | Non, par défaut depuis le 01/03/2023 |
| OpenAI, par ChatGPT Plus | Cédée | Oui | **Non** — le bouclier ne couvre ni Free ni Plus | Opt-out |
| Google, palier gratuit | Rien cédé | Oui | Non | **Oui, sans opt-out documenté** |
| Google, palier payant | Rien cédé | Oui | Oui (Vertex) | Non |
| **Recraft, palier gratuit** | **Cédée à Recraft** | **Non** | Non | Oui, opt-out |
| Midjourney | Payant seulement ; > 1 M$ de revenu exige Pro/Mega | Payant seulement | **Jamais** | Licence perpétuelle concédée, pas d'opt-out |
| FLUX.1 [dev] | Rien revendiqué | **Non — licence non commerciale** | Non | Sans objet |
| FLUX.1 [schnell], Qwen-Image | Apache 2.0 | Oui, sans restriction | Aucune | Sans objet |

**Conclusion pratique : l'API d'OpenAI est la meilleure combinaison** — propriété cédée, commercial
sans palier, indemnisation incluse, pas d'entraînement par défaut, et marquage C2PA apposé
automatiquement. Midjourney est écarté deux fois : pas d'API officielle, et ses conditions
interdisent l'automatisation.

> ⚠ **Un trou dans ma propre sonde.** Les images d'essai n'ont pas été produites par l'API d'OpenAI
> en direct, mais par un agrégateur tiers. La chaîne contractuelle est donc différente et **je ne
> l'ai pas vérifiée**. Avant qu'une seule image entre dans le dépôt, il faut lire les conditions du
> canal réellement employé.

### Le marquage

L'**article 50 de l'AI Act** s'applique depuis le **2 août 2026**. Deux paragraphes distincts :

- **§2, marquage lisible par machine** : l'obligation pèse sur le **fournisseur** du système
  (OpenAI, Google), pas sur nous. Un répit technique court jusqu'au 2 décembre 2026 pour les
  systèmes déjà sur le marché.
- **§4, deepfakes** : pèse sur le **déployeur** — donc sur nous. Mais un *deep fake* y est défini
  comme un contenu « qui ressemble à des personnes, objets, lieux ou événements **existants** ».
  Des personnages fictifs ne ressemblant à personne sortent du champ **en lecture littérale**.

> Cette lecture est une **déduction** à partir de la définition légale, corroborée par un seul
> commentaire juridique. Aucune source trouvée ne traite nommément notre cas — des images fixes,
> engendrées une fois, de personnes qui n'existent pas. Les sanctions vont jusqu'à 15 M€ ou 3 % du
> chiffre d'affaires : c'est un point à faire confirmer, pas à trancher ici.

### Et ce qui serait protégé

Un enregistrement a été **accordé** par l'USCO en janvier 2025 (« A Single Piece of American
Cheese ») sur le fondement de la « selection, coordination and arrangement » d'un matériau engendré.
La protection d'une compilation est donc possible, mince, et précédentée. Côté français, le rapport
remis au CSPLA le 9 juillet 2026 admet une originalité **en amont** — « les choix de conception et
de paramétrage qui orientent de manière décisive le résultat ».

Notre table à cinq axes, ses bornes de distinction et son ordre de composition sont exactement ce
genre de choix en amont. **Mais aucune source trouvée n'applique ce critère à une bibliothèque
d'images systématisée**, ni côté américain ni côté français. On écrit ce qu'on sait, pas ce qui
arrangerait.

---

## La livraison

| Décision | Valeur | Pourquoi |
|---|---|---|
| Formats | **AVIF + WebP** par `<picture>` | 95,36 % et 96,82 % de support (caniuse, août 2026). JPEG XL écarté : activé par défaut nulle part sauf Safari, et les deux fils d'*intent to ship* sont ouverts et contestés |
| Chroma | **4:4:4**, ou `--sharpyuv` à défaut | Le 4:2:0 par défaut fait baver les transitions de couleur saturées — exactement nos contours d'encre |
| Encodeur | `avifenc` ≥ libavif 1.4.0, `tune=iq` | Le guide web.dev que tout le monde cite **date de 2021** et recommande `tune=ssim`, calé sur la photo |
| **Résolution source** | **224 px** | 56 px à densité 3 donnent 168 — mais le réglage « très grand » porte la racine à **125 %**, donc 70 px de côté, donc **210 px**. 224 couvre ça et laisse une marge |
| Fichiers | **Seize fichiers séparés**, pas de sprite | Workbox versionne chaque URL : retoucher un seul portrait dans un sprite ferait retélécharger l'ensemble, à chaque déploiement, en silence |
| Balisage | `alt=""` sur l'`<img>` | Suffit à le retirer de l'arbre d'accessibilité. **Pas** d'`aria-hidden` en plus : le W3C déconseille de cumuler les deux |
| Poids attendu | **65 à 260 ko** pour les 32 fichiers | Estimation raisonnée, **pas une mesure** — aucun benchmark public n'existe pour de l'illustration à aplats à cette taille. À peser après encodage réel |

Deux rappels factuels utiles : `image-rendering: high-quality` **n'est implémenté dans aucun
navigateur** (MDN, modifié le 10/09/2026), et les navigateurs **ignorent totalement** les métadonnées
DPI — retagger un export ne change rien, ni à l'écran ni au papier.

---

## Le piège propre à ce jeu, et sa réponse mesurée

Les guides de conception de personnages nomment un raccourci classique : **coder le méchant sur un
trait physique**. Ici il deviendrait littéral, puisque le jeu attache une culpabilité *factuelle* à
un visage. S'y ajoute le colorisme interne au casting — une corrélation entre teint et degré
d'exagération des traits, documentée sur des œuvres grand public.

Le moteur y répond déjà par construction : le coupable n'est assigné à personne, il **émerge** du
placement — c'est le seul autre occupant de la pièce de la victime. Mais « par construction » est
exactement le genre d'affirmation que ce projet vérifie. Mesuré sur 400 affaires, quatre décors
mêlés :

```
victime   A  69  B  70  C  66  D  71  E  62  F  62   χ² 1,19
coupable  A  72  B  71  C  64  D  65  E  68  F  60   χ² 1,55
```

Pour 5 degrés de liberté, le seuil à 5 % est 11,07. La répartition est **indiscernable de
l'uniforme**, et la mesure est désormais au banc (`pnpm measure`).

Reste ce qu'aucune mesure ne couvre, et qui se regarde à l'œil sur la planche finale : **aucune
corrélation entre teint et exagération des traits, entre âge et qualité du vêtement, entre
morphologie et tout autre marqueur de statut.**

---

## Ce que cet incrément refuse

- **La grille unique de seize.** Meilleure pour le style, pire pour les attributs — et les deux
  benchmarks le chiffrent.
- **Le verrouillage d'identité** (`--cref`, IP-Adapter, LoRA de personnage). Il résisterait à nos
  changements d'attributs au lieu de les accepter.
- **Les paliers gratuits de Recraft et Midjourney.** Le premier cède les images *à Recraft* ; le
  second n'en donne pas la propriété.
- **FLUX.1 [dev].** Licence non commerciale, quelle que soit la permissivité affichée sur les
  sorties.
- **Le détourage par un modèle photo.** Les cheveux dessinés ne sont pas des cheveux photographiés.
- **JPEG XL en 2026.**
- **Le portrait comme porteur d'identité.** Il reste décoratif : c'est la lettre qui identifie, sur
  le plateau comme sur la carte. Le changement de médium ne change pas cette règle.

## Vérification

`pnpm check`, plus ce qui ne se voit qu'à l'œil ou à la balance :

- les seize portraits vérifiés **axe par axe** contre la table, pas au jugé ;
- le poids réel de la bibliothèque **pesé**, pas estimé ;
- la lisibilité à 56 px jugée sur une planche de contact, aux deux thèmes et en niveaux de gris,
  comme pour les portraits vectoriels ;
- les contrastes mesurés contre les fonds de carte ;
- la matrice traits visuels × issue narrative relue, au-delà du χ² ;
- les conditions du canal de génération réellement employé, lues avant la première image versée.
