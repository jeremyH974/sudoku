import type { PropId } from '../scene/types.js';

/**
 * Les quatre points cardinaux du plan.
 *
 * Le nord est vers le haut, donc vers les petits numéros de rangée. Les
 * diagonales existent dans le genre ; elles ne sont pas de cet incrément, et
 * leur ajout n'est qu'un cas de plus dans l'union ci-dessous.
 */
export type Direction = 'north' | 'south' | 'east' | 'west';

/**
 * Un indice.
 *
 * ─── Le choix qui porte tout le mode ────────────────────────────────────────
 *
 * **Un indice n'est pas une phrase, c'est une contrainte.** Le français n'en est
 * qu'un rendu, calculé à l'affichage par `render.ts`.
 *
 * Ce n'est pas un raffinement d'architecture, c'est la correction d'un défaut
 * observé chez la référence du genre : ses indices sont du texte traduit à la
 * main, et des joueurs rapportent des traductions qui rendent une affaire
 * insoluble. Ici, le solveur lit `{ kind: 'next-to-prop', prop: 'shelf' }` — il
 * ne lit jamais « à côté d'une étagère ». Une faute de rendu reste une faute de
 * rendu ; elle ne peut pas rendre l'affaire fausse.
 *
 * L'union est **ouverte** à dessein : les indices du second ordre (« quelqu'un
 * d'autre était à côté d'une étagère dans sa zone ») et les prémisses globales
 * sont hors périmètre de cet incrément, et n'exigeront qu'un cas de plus.
 */
export type Clue =
  /** « Elle était assise sur une chaise. » / « Il n'était pas sur un tapis. » */
  | { readonly kind: 'on-prop'; readonly who: number; readonly prop: PropId; readonly not: boolean }
  /** « Elle était à côté d'une plante. » — voisin orthogonal **et même pièce**. */
  | {
      readonly kind: 'next-to-prop';
      readonly who: number;
      readonly prop: PropId;
      readonly not: boolean;
    }
  /** « Il était dans la Bibliothèque. » */
  | { readonly kind: 'in-zone'; readonly who: number; readonly zone: number; readonly not: boolean }
  /** « Elle était dans la première colonne. » */
  | {
      readonly kind: 'in-band';
      readonly who: number;
      readonly axis: 'row' | 'column';
      readonly index: number;
    }
  /** « Elle était au sud de Clara. » — strictement, quelle que soit la colonne. */
  | {
      readonly kind: 'direction';
      readonly who: number;
      readonly other: number;
      readonly direction: Direction;
    }
  /** « Il était exactement deux rangées au nord de Bruno. » */
  | {
      readonly kind: 'offset';
      readonly who: number;
      readonly other: number;
      readonly direction: Direction;
      readonly distance: number;
    }
  /** « Elle était dans la même pièce que Damien. » */
  | {
      readonly kind: 'same-zone';
      readonly who: number;
      readonly other: number;
      readonly not: boolean;
    }
  /** « Il était seul. » — personne d'autre dans sa pièce. */
  | { readonly kind: 'alone'; readonly who: number }
  /** « Elle était seule avec Hugo. » — sa pièce contient ces deux-là, et personne d'autre. */
  | { readonly kind: 'alone-with'; readonly who: number; readonly other: number }
  /**
   * « La victime. Elle était seule avec le meurtrier. »
   *
   * C'est l'indice qui fait de ce puzzle une enquête plutôt qu'un placement : il
   * ne nomme personne, mais impose que la pièce de la victime contienne
   * exactement deux personnes — et **désigne la seconde** une fois le plateau
   * rempli. Le coupable n'est donc jamais une donnée de l'affaire ; il en est
   * une conséquence.
   */
  | { readonly kind: 'victim'; readonly who: number };

export type ClueKind = Clue['kind'];

/** Le suspect dont l'indice est la parole. */
export const speakerOf = (clue: Clue): number => clue.who;

/** L'autre suspect cité par l'indice, s'il y en a un. */
export function subjectOf(clue: Clue): number | null {
  switch (clue.kind) {
    case 'direction':
    case 'offset':
    case 'same-zone':
    case 'alone-with':
      return clue.other;
    default:
      return null;
  }
}
