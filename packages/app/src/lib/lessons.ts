import type { TechniqueId } from '@sudoku/engine';

/**
 * Le contenu écrit de la campagne : une leçon par technique.
 *
 * ─── Pourquoi ici et pas dans le moteur ─────────────────────────────────────
 *
 * Le moteur produit déjà de la prose, mais d'une autre nature : `Step.explanation`
 * décrit **une déduction précise** sur une grille précise (« dans la boîte 5, le
 * 7 n'a plus qu'une case »). Une leçon décrit la technique en général. La
 * première est une propriété du raisonnement, la seconde un texte éditorial —
 * et le moteur voyage dans un Web Worker, où quinze kilo-octets de prose n'ont
 * rien à faire.
 *
 * ─── La garantie d'exhaustivité ─────────────────────────────────────────────
 *
 * `Record<TechniqueId, Lesson>` sur une union fermée : ajouter un identifiant à
 * `TechniqueId` sans écrire sa leçon **casse le typecheck**. Aucune vérification
 * à l'exécution n'est nécessaire, et aucun test ne peut se périmer.
 *
 * ─── La source ──────────────────────────────────────────────────────────────
 *
 * Les en-têtes des modules de techniques portent déjà une doctrine française de
 * bonne qualité, mais adressée à un développeur : elle parle de `findAll`, de
 * l'ordre d'essai, du barème. Ces textes-ci s'adressent à quelqu'un qui a une
 * grille sous les yeux et un crayon à la main.
 */

export interface Lesson {
  /** Une phrase : ce que la technique permet de conclure. */
  readonly summary: string;
  /** Le raisonnement, en un ou deux paragraphes. */
  readonly body: readonly string[];
  /** Comment la repérer à l'œil, sans la chercher case par case. */
  readonly howToSpot: string;
  /** Ce avec quoi on la confond, et pourquoi ce n'est pas la même chose. */
  readonly pitfall?: string;
}

export const LESSONS: Record<TechniqueId, Lesson> = {
  'full-house': {
    summary: 'Une maison à laquelle il ne manque qu’une case : le chiffre absent y va.',
    body: [
      'Une ligne, une colonne ou une boîte contient les neuf chiffres, une fois chacun. S’il n’y reste qu’une case vide, le chiffre qui manque n’a nulle part ailleurs où aller.',
      'C’est le raisonnement le plus simple du sudoku, et le seul qui ne demande aucun candidat : il suffit de compter.',
    ],
    howToSpot:
      'Balayez les vingt-sept maisons du regard et arrêtez-vous sur celles où il ne reste qu’un trou.',
  },

  'hidden-single-box': {
    summary: 'Dans une boîte, un chiffre n’a plus qu’une seule case possible.',
    body: [
      'Prenez un chiffre et une boîte. Barrez mentalement toutes les cases de la boîte que ce chiffre ne peut pas occuper, parce qu’il est déjà présent sur leur ligne ou leur colonne. S’il n’en reste qu’une, le chiffre y va.',
      'Remarquez le renversement : on ne cherche plus ce qu’une case peut accueillir, mais où un chiffre peut se poser. C’est ce changement de point de vue qui fait tout le sudoku.',
    ],
    howToSpot:
      'Prenez un chiffre fréquent sur la grille et suivez ses lignes et ses colonnes à travers les boîtes voisines : les cases restantes se comptent vite.',
  },

  'hidden-single-line': {
    summary: 'Dans une ligne ou une colonne, un chiffre n’a plus qu’une seule case possible.',
    body: [
      'Exactement le même raisonnement que dans une boîte, mais sur une ligne ou une colonne.',
      'Il est jugé un peu plus difficile, et à raison : une boîte tient dans un seul coup d’œil, une ligne traverse toute la grille et demande de vérifier neuf colonnes.',
    ],
    howToSpot:
      'Choisissez une ligne bien remplie, listez les chiffres qui lui manquent, et testez-les un par un.',
  },

  'direct-pointing': {
    summary: 'Une paire pointante qui débloque immédiatement un chiffre.',
    body: [
      'C’est la paire pointante ordinaire — un chiffre confiné à une seule ligne à l’intérieur d’une boîte, donc chassé du reste de cette ligne — mais dont l’élimination laisse aussitôt un chiffre sans autre place dans une maison.',
      'Ce n’est donc pas une technique de plus à apprendre : c’est la même, remarquée plus tôt. Elle est jugée plus facile parce qu’on n’a pas besoin d’écrire les candidats pour en tirer un coup.',
    ],
    howToSpot:
      'Quand un alignement dans une boîte vous saute aux yeux, regardez tout de suite si la ligne ou la colonne visée s’en trouve résolue.',
    pitfall:
      'Les quatre variantes « directes » ne sont pas des techniques distinctes. Les compter comme telles ferait croire à vingt-quatre choses à apprendre, alors qu’il y en a une vingtaine.',
  },

  'direct-claiming': {
    summary: 'Une paire revendiquée qui débloque immédiatement un chiffre.',
    body: [
      'Le miroir du cas précédent : le chiffre est confiné, dans une ligne ou une colonne, à une seule boîte ; il quitte donc le reste de cette boîte, et l’élimination suffit à conclure.',
    ],
    howToSpot:
      'Suivez une ligne où un chiffre ne peut se poser que dans un tiers de son parcours.',
  },

  'direct-hidden-pair': {
    summary: 'Une paire cachée dont on n’a besoin que pour poser un chiffre tout de suite.',
    body: [
      'Deux chiffres qui ne tiennent que dans deux cases se les réservent, ce qui chasse tous les autres candidats de ces deux cases. Quand cette élimination laisse un chiffre sans autre place, la conclusion tombe sans avoir eu à écrire quoi que ce soit.',
    ],
    howToSpot:
      'Cherchez, dans une maison presque pleine, deux chiffres qui reviennent aux deux mêmes endroits.',
  },

  'naked-single': {
    summary: 'Une case à laquelle il ne reste qu’un seul candidat.',
    body: [
      'Retirez de la case tous les chiffres déjà présents sur sa ligne, sa colonne et sa boîte. S’il n’en survit qu’un, il y va.',
      'C’est le raisonnement le plus naturel — celui que tout le monde tente en premier — et pourtant il est noté plus difficile que le single caché. La raison est humaine : il demande de tenir les candidats d’une case, quand le single caché se voit d’un balayage du regard.',
    ],
    howToSpot:
      'Regardez les cases situées au croisement d’une ligne et d’une colonne toutes deux bien remplies.',
    pitfall:
      'Ne confondez pas « il ne reste qu’un candidat dans cette case » avec « ce chiffre n’a qu’une place dans cette maison ». Les deux concluent, mais ce ne sont pas les mêmes raisonnements, et le second se voit bien plus vite.',
  },

  'direct-hidden-triple': {
    summary: 'Un triplet caché dont l’élimination pose aussitôt un chiffre.',
    body: [
      'Trois chiffres qui ne tiennent que dans trois cases se les réservent. Comme pour la paire, l’intérêt est ici que le nettoyage suffit à conclure immédiatement.',
    ],
    howToSpot:
      'Rare, et difficile à voir sans notes. C’est le premier motif où écrire les candidats devient vraiment payant.',
  },

  pointing: {
    summary:
      'Dans une boîte, un chiffre est confiné à une seule ligne ou colonne : il quitte le reste de celle-ci.',
    body: [
      'Si, dans une boîte, toutes les places possibles d’un chiffre se trouvent sur la même ligne, alors ce chiffre occupera forcément cette ligne — quelque part dans la boîte. Il ne peut donc pas se trouver ailleurs sur cette ligne, hors de la boîte.',
      'C’est la première technique qui ne pose aucune valeur. Elle ne fait qu’écarter des candidats — et c’est le passage du sudoku « à l’œil » au sudoku « aux notes ».',
    ],
    howToSpot:
      'Dans chaque boîte, cherchez un chiffre dont les deux ou trois places possibles sont alignées.',
    pitfall:
      'Ne vous attendez pas à un chiffre posé. Une technique d’élimination prépare le terrain ; le coup vient ensuite, parfois plusieurs étapes plus loin.',
  },

  claiming: {
    summary:
      'Dans une ligne ou une colonne, un chiffre est confiné à une seule boîte : il quitte le reste de celle-ci.',
    body: [
      'Le sens de lecture inverse de la paire pointante. Si toutes les places possibles d’un chiffre sur une ligne tombent dans la même boîte, cette boîte devra le loger sur cette ligne — donc pas ailleurs dans la boîte.',
      'Les deux motifs sont géométriquement identiques : c’est la même intersection entre une boîte et une ligne, lue depuis l’un ou l’autre côté.',
    ],
    howToSpot:
      'Prenez une ligne, un chiffre absent, et regardez si ses places possibles tiennent toutes dans un même tiers.',
  },

  'naked-pair': {
    summary:
      'Deux cases d’une maison n’ont que les deux mêmes candidats : ces deux chiffres n’iront nulle part ailleurs.',
    body: [
      'Si deux cases d’une même maison ne peuvent accueillir que 3 ou 7, alors l’une prendra le 3 et l’autre le 7 — on ne sait pas dans quel ordre, et cela n’a aucune importance. Ce qui compte, c’est que le 3 et le 7 sont désormais consommés : aucune autre case de la maison ne peut les prendre.',
      'C’est le premier raisonnement qui conclut quelque chose sans savoir laquelle des deux possibilités est vraie. Il n’y a plus rien à deviner : les deux cas mènent à la même élimination.',
    ],
    howToSpot:
      'Repérez deux cases à deux candidats, dans la même maison, portant exactement la même paire.',
    pitfall:
      'Il faut que les deux cases portent *exactement* la même paire. Une case à trois candidats dont deux coïncident ne forme pas une paire nue.',
  },

  'x-wing': {
    summary:
      'Un chiffre confiné aux deux mêmes colonnes sur deux lignes : il quitte ces colonnes ailleurs.',
    body: [
      'Prenez deux lignes où un chiffre n’a plus que deux places, et où ces places tombent sur les deux mêmes colonnes. Les quatre cases dessinent un rectangle.',
      'Quel que soit le cas, le chiffre occupe une diagonale de ce rectangle : haut-gauche et bas-droite, ou haut-droite et bas-gauche. Les deux colonnes sont donc servies dans tous les cas, et le chiffre disparaît du reste de ces colonnes.',
      'C’est le premier raisonnement qui relie deux endroits éloignés de la grille. Il y a un avant et un après.',
    ],
    howToSpot:
      'Choisissez un chiffre et notez, ligne par ligne, où il peut aller. Cherchez deux lignes qui répondent par le même couple de colonnes.',
    pitfall:
      'Le motif fonctionne aussi en partant des colonnes et en éliminant sur les lignes. C’est le même raisonnement pivoté d’un quart de tour.',
  },

  'hidden-pair': {
    summary:
      'Deux chiffres d’une maison ne tiennent que dans deux cases : ces cases perdent tous leurs autres candidats.',
    body: [
      'Le miroir de la paire nue. Ici on ne regarde pas ce que les cases peuvent accueillir, mais où les chiffres peuvent aller. Si le 2 et le 9 n’ont que deux places possibles dans une maison, et que ce sont les mêmes deux places, alors ces deux cases leur sont réservées.',
      'Tout ce qu’elles portaient d’autre disparaît, même si cela semblait solide.',
    ],
    howToSpot:
      'Comptez, pour chaque chiffre absent d’une maison, le nombre de places qui lui restent. Deux chiffres à deux places identiques forment le motif.',
    pitfall:
      'Beaucoup plus difficile à voir que la paire nue, alors que c’est le même raisonnement retourné — d’où sa note plus élevée. Une paire nue se lit dans les cases, une paire cachée se compte à travers la maison.',
  },

  'naked-triple': {
    summary:
      'Trois cases d’une maison ne portent, à elles trois, que trois chiffres différents.',
    body: [
      'Trois cases, trois chiffres au total : ces trois cases se répartiront ces trois chiffres, et personne d’autre dans la maison n’y aura droit.',
      'Attention, chaque case n’a pas besoin de porter les trois. Des candidats {2,5}, {5,8} et {2,8} forment un triplet parfaitement valide : l’union fait bien trois chiffres.',
    ],
    howToSpot:
      'Cherchez, dans une maison, trois cases à deux ou trois candidats dont l’union ne dépasse pas trois chiffres.',
    pitfall:
      'C’est l’erreur classique : croire qu’il faut trois cases portant les trois mêmes chiffres. C’est l’union qui compte, pas la ressemblance.',
  },

  swordfish: {
    summary: 'Un X-Wing à trois lignes et trois colonnes.',
    body: [
      'Même raisonnement que le X-Wing, d’un cran plus large. Trois lignes sur lesquelles un chiffre ne peut aller que dans trois colonnes — pas forcément trois places par ligne, deux suffisent.',
      'Les trois lignes réclament trois colonnes distinctes ; ces trois colonnes sont donc entièrement consommées par ces trois lignes, et le chiffre disparaît du reste de chacune.',
    ],
    howToSpot:
      'Dressez la carte d’un chiffre sur toute la grille et cherchez trois lignes dont les places tiennent dans trois colonnes.',
    pitfall:
      'Ne cherchez pas trois lignes à trois places chacune : une ligne à deux places convient très bien, du moment que ses colonnes appartiennent aux trois retenues.',
  },

  'hidden-triple': {
    summary:
      'Trois chiffres d’une maison ne tiennent que dans trois cases : ces cases perdent le reste.',
    body: [
      'La paire cachée d’un cran plus large. Trois chiffres dont toutes les places possibles se concentrent sur trois cases se les réservent, et ces trois cases perdent tous leurs autres candidats.',
    ],
    howToSpot:
      'Comptez les places restantes de chaque chiffre absent. Trois chiffres dont les places tiennent dans trois cases forment le motif.',
    pitfall:
      'Comme pour le triplet nu, chaque chiffre n’a pas besoin d’apparaître dans les trois cases.',
  },

  skyscraper: {
    summary:
      'Deux lignes où un chiffre n’a que deux places, avec deux places alignées : les toits couvrent le reste.',
    body: [
      'Une maison où un chiffre n’a plus que deux places est un « lien fort » : l’une des deux est nécessairement la bonne.',
      'Prenez deux liens forts sur le même chiffre, portés par deux lignes parallèles, dont les deux extrémités basses — les « pieds » — se trouvent sur la même colonne. Comme une colonne ne porte le chiffre qu’une fois, les deux pieds ne peuvent pas être vrais ensemble : au moins un est faux, donc au moins un des deux « toits » porte le chiffre.',
      'Toute case qui voit les deux toits à la fois perd donc le chiffre — sans qu’on sache lequel des deux est le bon.',
    ],
    howToSpot:
      'Cherchez un chiffre qui n’a que deux places sur deux lignes différentes, dont deux se partagent une colonne.',
    pitfall:
      'Si les deux toits partagent eux aussi une colonne, le motif est un X-Wing — moins cher, et à créditer comme tel.',
  },

  'two-string-kite': {
    summary: 'Le même raisonnement que le Skyscraper, mais entre une ligne et une colonne.',
    body: [
      'Deux liens forts sur le même chiffre : l’un sur une ligne, l’autre sur une colonne, dont les pieds tombent dans la même boîte.',
      'Les deux pieds se voient — ils partagent une boîte — donc l’un des deux est faux, donc l’un des deux toits porte le chiffre. La case qui voit les deux toits le perd.',
    ],
    howToSpot:
      'Cherchez une boîte contenant deux places d’un même chiffre, appartenant à une ligne et à une colonne qui n’en ont chacune que deux.',
  },

  'turbot-fish': {
    summary: 'La même famille, quand une boîte sert de maison à l’un des deux liens forts.',
    body: [
      'Skyscraper, cerf-volant et Turbot Fish sont exactement le même raisonnement : deux liens forts sur un chiffre, deux pieds qui se voient, donc au moins un toit vrai. Seule la géométrie des deux maisons change, et c’est elle qui décide du nom.',
      'Le Turbot Fish est le cas où au moins l’une des deux maisons est une boîte. Il absorbe au passage le motif souvent appelé « rectangle vide ».',
    ],
    howToSpot:
      'Une fois le raisonnement des liens forts acquis, ne cherchez plus les trois noms séparément : cherchez deux liens forts dont les pieds se voient.',
  },

  'xy-wing': {
    summary: 'Trois cases à deux candidats en chaîne : ce qu’elles partagent tombe.',
    body: [
      'Une case pivot porte {A,B}. Elle voit une aile portant {A,C} et une autre portant {B,C}.',
      'Le pivot vaut A ou B. S’il vaut A, la première aile ne peut plus être A, donc elle vaut C. S’il vaut B, la seconde aile vaut C. Dans les deux cas, **une des deux ailes vaut C** — et toute case qui voit les deux ailes perd le C.',
      'On ne saura pas laquelle. On n’en a pas besoin : les deux branches concluent pareil.',
    ],
    howToSpot:
      'Repérez une case à exactement deux candidats, puis cherchez parmi celles qu’elle voit deux autres cases à deux candidats partageant un chiffre entre elles.',
    pitfall:
      'Les trois cases doivent avoir exactement deux candidats. Une case à trois candidats ne peut pas jouer ce rôle — sauf comme pivot d’un XYZ-Wing, qui est un motif distinct.',
  },

  'xyz-wing': {
    summary: 'Un XY-Wing dont le pivot porte aussi le troisième chiffre.',
    body: [
      'Le pivot porte cette fois {A,B,C}, et ses deux ailes {A,C} et {B,C}.',
      'Trois cas au lieu de deux : le pivot vaut A, B ou C. S’il vaut A, la première aile vaut C ; s’il vaut B, la seconde vaut C ; s’il vaut C, c’est le pivot lui-même. Le C est donc quelque part parmi les trois.',
      'L’élimination est plus étroite : seule une case voyant **les trois** perd le C. C’est ce qui rend le motif plus difficile à exploiter, et non plus difficile à comprendre.',
    ],
    howToSpot:
      'Cherchez une case à trois candidats qui voit deux cases à deux candidats, toutes deux incluses dans les siens.',
  },

  'naked-quad': {
    summary: 'Quatre cases d’une maison ne portent, à elles quatre, que quatre chiffres.',
    body: [
      'Le triplet nu d’un cran plus large : quatre cases dont l’union des candidats fait exactement quatre chiffres se les réservent, et ces quatre chiffres quittent le reste de la maison.',
      'Le raisonnement est le même que pour la paire et le triplet. Ce n’est pas sa difficulté qui le rend rare, c’est sa géométrie : dans une maison à cinq cases vides, le complément d’un quadruplet nu est un single nu ; à six, une paire nue ; à sept, un triplet nu. Toutes moins chères, donc trouvées avant.',
    ],
    howToSpot:
      'Autant chercher son complément : si quatre cases se réservent quatre chiffres, les autres cases de la maison se partagent le reste, et cela se voit mieux.',
  },

  jellyfish: {
    summary: 'Le X-Wing porté à quatre lignes et quatre colonnes.',
    body: [
      'Quatre lignes sur lesquelles un chiffre ne peut se placer que dans quatre colonnes. Ces quatre colonnes sont entièrement consommées par ces quatre lignes, et le chiffre disparaît du reste de chacune.',
      'X-Wing, Swordfish et Jellyfish sont un seul raisonnement à trois tailles. Au-delà de quatre, il n’apporte plus rien : le complément devient plus petit, donc plus facile à voir de l’autre côté.',
    ],
    howToSpot:
      'À ce stade, la carte complète du chiffre sur la grille est indispensable. Cherchez quatre lignes dont l’union des colonnes ne dépasse pas quatre.',
  },

  'hidden-quad': {
    summary: 'Quatre chiffres d’une maison ne tiennent que dans quatre cases.',
    body: [
      'Le plus large des sous-ensembles cachés, et le plus difficile à voir : quatre chiffres dont toutes les places possibles se concentrent sur quatre cases se les réservent, et ces cases perdent tout le reste.',
    ],
    howToSpot:
      'Comme pour le quadruplet nu, le complément est souvent plus facile à repérer que le motif lui-même.',
  },
};

export interface Chapter {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly techniques: readonly TechniqueId[];
}

/**
 * Quatre chapitres, coupés là où **le genre de raisonnement** change, et non à
 * des scores ronds.
 *
 * L'ordre à l'intérieur d'un chapitre s'écarte parfois de l'ordre de difficulté :
 * les sous-ensembles nus et cachés sont présentés par paires pour que le miroir
 * se voie, et les poissons sont groupés. L'ordre figé est celui du registre —
 * qui commande la notation — pas celui de la campagne, qui ne commande que la
 * lecture.
 */
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'voir',
    title: 'Voir la seule place possible',
    intro:
      'Ces quatre raisonnements se jouent à l’œil, sans écrire un seul candidat. Ils suffisent à résoudre une grille facile de bout en bout.',
    techniques: ['full-house', 'hidden-single-box', 'hidden-single-line', 'naked-single'],
  },
  {
    id: 'ecarter',
    title: 'Écarter au lieu de poser',
    intro:
      'Ici commence le sudoku aux notes. Ces raisonnements ne posent aucun chiffre : ils retirent des possibilités, et c’est ce nettoyage qui rend le coup suivant visible. Les variantes « directes » ne sont pas des techniques de plus — c’est le même raisonnement, remarqué assez tôt pour conclure sans écrire.',
    techniques: [
      'direct-pointing',
      'direct-claiming',
      'direct-hidden-pair',
      'direct-hidden-triple',
      'pointing',
      'claiming',
    ],
  },
  {
    id: 'reserver',
    title: 'Réserver des cases, réserver des chiffres',
    intro:
      'Deux familles qui sont le miroir l’une de l’autre : dans l’une on raisonne sur ce que les cases peuvent accueillir, dans l’autre sur les places qui restent aux chiffres. Les confondre est l’erreur la plus fréquente — d’où leur présentation par paires.',
    techniques: [
      'naked-pair',
      'hidden-pair',
      'naked-triple',
      'hidden-triple',
      'naked-quad',
      'hidden-quad',
    ],
  },
  {
    id: 'distance',
    title: 'Raisonner à distance',
    intro:
      'À partir d’ici, la conclusion ne tient plus dans une seule maison : elle relie deux endroits éloignés de la grille. C’est aussi ici qu’on cesse d’avoir besoin de savoir laquelle des deux branches est vraie — les deux mènent à la même élimination.',
    techniques: [
      'x-wing',
      'swordfish',
      'jellyfish',
      'skyscraper',
      'two-string-kite',
      'turbot-fish',
      'xy-wing',
      'xyz-wing',
    ],
  },
];
