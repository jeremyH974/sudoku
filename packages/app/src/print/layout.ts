import type { Level } from '@sudoku/engine';
import type { PrintFormat } from './presets.js';

/**
 * Pagination d'un cahier.
 *
 * Volontairement sans aucune dépendance au DOM : c'est la partie qui décide
 * quelle grille va sur quelle page, et elle doit pouvoir être vérifiée par des
 * tests plutôt qu'à l'œil sur une impression. C'est aussi ce qui rendra son
 * extraction mécanique le jour où l'outil en ligne de commande produira des
 * cahiers en lot.
 */

export interface PrintablePuzzle {
  /** Numéro dans le cahier, à partir de 1. */
  readonly index: number;
  readonly puzzle: readonly number[];
  readonly solution: readonly number[];
  readonly level: Level;
  readonly levelLabel: string;
  readonly score: number;
  /** Étiquette courte, pour le sommaire et le corrigé. */
  readonly label: string;
  /** Encodage complet, pour le QR code et le lien. */
  readonly code: string;
}

export type SheetKind = 'summary' | 'puzzles' | 'solutions';

/**
 * Une feuille, quelle que soit la charge utile qu'elle porte.
 *
 * Le paramètre de type est arrivé à l'incrément 19, quand un second cahier a eu
 * besoin de la même pagination pour une charge toute différente — un dossier
 * d'enquête plutôt qu'une grille. Le corps de `paginate` n'a pas bougé d'une
 * ligne : il ne lisait **aucun** champ de ce qu'il répartit, seulement la
 * longueur du tableau. La dépendance n'était que dans les signatures.
 *
 * Le défaut par commodité reste `PrintablePuzzle`, pour que le chemin du sudoku
 * s'écrive comme avant.
 */
export interface Sheet<T = PrintablePuzzle> {
  readonly kind: SheetKind;
  /** Numéro de page imprimé, à partir de 1. */
  readonly pageNumber: number;
  readonly puzzles: readonly T[];
}

export interface Booklet<T = PrintablePuzzle> {
  readonly title: string;
  readonly sheets: readonly Sheet<T>[];
  readonly puzzleCount: number;
  /** Première page de corrigés, celle où détacher. */
  readonly firstSolutionPage: number | null;
}

export interface PaginateOptions {
  readonly title: string;
  readonly includeSolutions: boolean;
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Répartit les grilles en feuilles.
 *
 * Ordre retenu : sommaire éventuel, puis **toutes** les grilles, puis **tous**
 * les corrigés. C'est ce qui rend le cahier séparable — l'enseignant imprime
 * l'ensemble et détache les dernières pages. Intercaler les corrigés les
 * rendrait visibles par transparence, et impossibles à retirer.
 */
export function paginate<T>(
  puzzles: readonly T[],
  format: PrintFormat,
  options: PaginateOptions,
): Booklet<T> {
  const sheets: Sheet<T>[] = [];
  let pageNumber = 1;

  if (format.showSummary && puzzles.length > 0) {
    sheets.push({ kind: 'summary', pageNumber, puzzles });
    pageNumber++;
  }

  for (const group of chunk(puzzles, format.puzzlesPerSheet)) {
    sheets.push({ kind: 'puzzles', pageNumber, puzzles: group });
    pageNumber++;
  }

  let firstSolutionPage: number | null = null;
  if (options.includeSolutions && puzzles.length > 0) {
    firstSolutionPage = pageNumber;
    for (const group of chunk(puzzles, format.solutionsPerSheet)) {
      sheets.push({ kind: 'solutions', pageNumber, puzzles: group });
      pageNumber++;
    }
  }

  return {
    title: options.title,
    sheets,
    puzzleCount: puzzles.length,
    firstSolutionPage,
  };
}

/**
 * Répartition pour le sommaire, par la clef qu'on lui donne.
 *
 * C'est la seule fonction de ce module qui lisait vraiment un champ de sa charge
 * utile — le niveau d'une grille. Un cahier d'enquêtes n'a pas de niveau et
 * compte ses décors : la clef devient donc un paramètre, et non une hypothèse.
 */
export function summarise<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): { readonly levelLabel: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([levelLabel, count]) => ({ levelLabel, count }));
}
