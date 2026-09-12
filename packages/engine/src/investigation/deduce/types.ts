import type { CellSet } from '../scene/cellset.js';

/**
 * Les techniques, par identifiant stable.
 *
 * Ces chaînes sont sérialisées avec une affaire : elles ne changent pas sans
 * migration, exactement comme celles de `logic/types.ts`.
 */
export type TechniqueId =
  /** Un suspect n'a plus qu'une case possible : on le pose. */
  | 'placement'
  /** Ce qu'un indice dit à lui seul, sans rien recouper. */
  | 'clue'
  /** Quelqu'un tient toute une rangée ou toute une colonne : les autres s'écartent. */
  | 'exclusion'
  /** Une rangée ou une colonne que plus personne ne peut occuper, sauf un. */
  | 'only-taker'
  /** Deux indices recoupés : ce que l'un permet borne ce que l'autre autorise. */
  | 'crossing'
  /** Combien de personnes une pièce peut contenir, et lesquelles. */
  | 'company'
  /** Un groupe de personnes qui se partage exactement autant de tranches. */
  | 'subset';

/**
 * L'ordre d'essai du registre, versionné.
 *
 * Le numéro change dès que l'ordre change, qu'une technique entre ou sorte, ou
 * qu'un rang bouge : les mesures rangées avec une affaire ne se comparent
 * qu'entre affaires de même version. C'est la même précaution que
 * `RATING_VERSION` côté sudoku, prise pour la même raison — l'ordre d'essai
 * change ce que le chemin traverse, donc ce qu'on en mesure.
 */
export const REGISTRY_VERSION = 1;

/**
 * Une déduction, et de quoi la raconter.
 *
 * La structure reprend celle de `logic/types.ts`, et pour la même raison : une
 * **seule** source alimente les trois usages — la mesure du chemin, l'indice
 * proposé au joueur, et le banc d'analyse. Ils ne peuvent donc pas se
 * contredire. C'est ce qui rend gratuit ce que la référence du genre écrit à la
 * main, affaire par affaire.
 *
 * Les trois paliers d'indice se lisent directement dedans :
 *   1. `clues` — « relis ces cartes » ;
 *   2. `technique` + `explanation` + `highlights` — « voici le raisonnement » ;
 *   3. `placements` + `eliminations` — « voici le coup ».
 */
export interface Step {
  readonly technique: TechniqueId;
  /** Nom affichable, en français. */
  readonly label: string;
  /**
   * Le rang dans l'ordre d'essai — **pas une note**.
   *
   * Ce mode n'a aucun oracle : rien ne permet de dire qu'un « groupe fermé »
   * vaut 3,2 sur une échelle partagée. Ce nombre ne sert qu'à trier le registre
   * et à désigner la technique la plus difficile d'un chemin. Il ne s'affiche
   * jamais, et c'est la raison pour laquelle il ne s'appelle pas `difficulty`.
   */
  readonly rank: number;
  /** Les indices qui portent le raisonnement, par position dans l'affaire. */
  readonly clues: readonly number[];
  /** Les suspects concernés. */
  readonly suspects: readonly number[];
  /** Ce qu'il faut montrer : les places encore possibles qui portent le motif. */
  readonly highlights: readonly SuspectCells[];
  /** Ce qu'on peut poser. Vide pour une technique purement éliminatoire. */
  readonly placements: readonly { readonly suspect: number; readonly cell: number }[];
  /** Ce qu'on peut écarter. Vide pour un placement. */
  readonly eliminations: readonly SuspectCells[];
  /** L'explication rédigée, prête à l'affichage. */
  readonly explanation: string;
}

export interface SuspectCells {
  readonly suspect: number;
  readonly cells: CellSet;
}

/** Ce que le registre a fait d'une affaire. */
export interface Deduction {
  readonly solved: boolean;
  /**
   * Les places de départ imposées mènent à une impasse.
   *
   * Ne peut arriver que sur un état fourni de l'extérieur — celui d'un joueur
   * qui a posé quelqu'un au mauvais endroit. Une affaire seule n'est jamais
   * contradictoire : le générateur ne distribue que ce qui a une solution.
   */
  readonly contradicted: boolean;
  readonly steps: readonly Step[];
  /** La technique la plus difficile du chemin, ou `null` si rien n'a marché. */
  readonly hardest: TechniqueId | null;
  /** Les places trouvées, ou celles restées ouvertes si l'affaire a bloqué. */
  readonly domains: readonly CellSet[];
}
