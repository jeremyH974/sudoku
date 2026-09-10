import type { Digit, DigitMask } from '../grid/index.js';

/**
 * Identifiants stables des techniques.
 *
 * Ces chaînes sont sérialisées avec les grilles notées : elles ne doivent pas
 * changer sans migration. Les valeurs de difficulté associées sont celles de
 * Sudoku Explainer, la référence du domaine (voir `registry.ts`).
 */
export type TechniqueId =
  | 'full-house'
  | 'hidden-single-box'
  | 'hidden-single-line'
  | 'naked-single'
  | 'direct-pointing'
  | 'direct-claiming'
  | 'direct-hidden-pair'
  | 'direct-hidden-triple'
  | 'pointing'
  | 'claiming'
  | 'naked-pair'
  | 'naked-triple'
  | 'naked-quad'
  | 'hidden-pair'
  | 'hidden-triple'
  | 'hidden-quad'
  | 'x-wing'
  | 'swordfish'
  | 'jellyfish'
  | 'skyscraper'
  | 'two-string-kite'
  | 'turbot-fish'
  | 'xy-wing'
  | 'xyz-wing';

/** Une valeur qu'on peut poser avec certitude. */
export interface Placement {
  readonly cell: number;
  readonly digit: Digit;
}

/** Un candidat qu'on peut écarter avec certitude. */
export interface Elimination {
  readonly cell: number;
  readonly digit: Digit;
}

/** Cellule mise en évidence, avec les chiffres qui portent le raisonnement. */
export interface CellDigits {
  readonly cell: number;
  readonly digits: DigitMask;
}

/**
 * Une étape de résolution.
 *
 * Cette structure alimente les trois usages du solveur logique — la notation de
 * difficulté, le banc d'analyse et les indices en trois paliers — ce qui garantit
 * qu'ils ne peuvent pas se contredire : l'indice montre exactement ce que la
 * notation a compté.
 *
 * Les trois paliers d'indice se lisent directement dedans :
 *   1. `units` — « regarde par ici » ;
 *   2. `technique` + `explanation` + `highlights` — « voici le raisonnement » ;
 *   3. `placements` + `eliminations` — « voici le coup ».
 */
export interface Step {
  readonly technique: TechniqueId;
  /** Nom affichable, en français. */
  readonly label: string;
  /** Difficulté selon le barème Sudoku Explainer. */
  readonly difficulty: number;
  /** Unités concernées (index dans `UNITS`), à surligner. */
  readonly units: readonly number[];
  /** Le motif : les cellules et chiffres qui justifient la conclusion. */
  readonly highlights: readonly CellDigits[];
  /** Valeurs à poser. Vide pour une technique purement éliminatoire. */
  readonly placements: readonly Placement[];
  /** Candidats à écarter. Vide pour un placement direct. */
  readonly eliminations: readonly Elimination[];
  /** Explication rédigée, prête à l'affichage. */
  readonly explanation: string;
}

/**
 * Une entrée du registre.
 *
 * Une entrée peut couvrir plusieurs techniques nommées : `locking` produit aussi
 * bien un Pointing qu'un X-Wing selon son degré, exactement comme le fait Sudoku
 * Explainer, dont c'est une seule classe paramétrée. C'est le `Step` retourné qui
 * porte l'identifiant précis, pas l'entrée.
 */
export interface TechniqueEntry {
  /** Nom de l'entrée, pour le débogage et les messages de test. */
  readonly name: string;
  /**
   * Énumère **toutes** les applications de la technique, par ordre de priorité,
   * paresseusement.
   *
   * L'énumération complète n'est pas un luxe : les variantes « Direct » de
   * Sudoku Explainer doivent trouver, parmi tous les motifs disponibles, celui
   * dont les éliminations débloquent immédiatement une case. Se contenter du
   * premier motif ferait manquer ces cas et surévaluerait la note. Le banc
   * d'analyse s'en sert également pour montrer les alternatives.
   */
  readonly findAll: (state: LogicStateView) => Generator<Step>;
  /** Première application trouvée, ou `null`. Raccourci sur `findAll`. */
  readonly find: (state: LogicStateView) => Step | null;
}

/**
 * Ce qu'une technique a le droit de voir : un état en lecture seule.
 *
 * Les techniques ne modifient jamais l'état — elles décrivent ce qu'elles ont
 * trouvé, et c'est la boucle de résolution qui applique. Sans cette séparation,
 * une technique pourrait appliquer un effet sans le déclarer, et la notation
 * comme l'indice deviendraient faux.
 */
export interface LogicStateView {
  /** Valeur posée, ou 0 si la cellule est vide. */
  valueAt(cell: number): number;
  /** Candidats restants d'une cellule vide. 0 pour une cellule résolue. */
  candidatesAt(cell: number): DigitMask;
  /** `true` si la cellule n'a pas encore de valeur. */
  isEmpty(cell: number): boolean;
  /** Cellules vides d'une unité où `digit` est encore candidat. */
  placesFor(unitIndex: number, digit: Digit): number[];
  /** Cellules vides d'une unité. */
  emptyCellsOf(unitIndex: number): number[];
}
