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

export interface Sheet {
  readonly kind: SheetKind;
  /** Numéro de page imprimé, à partir de 1. */
  readonly pageNumber: number;
  readonly puzzles: readonly PrintablePuzzle[];
}

export interface Booklet {
  readonly title: string;
  readonly sheets: readonly Sheet[];
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
export function paginate(
  puzzles: readonly PrintablePuzzle[],
  format: PrintFormat,
  options: PaginateOptions,
): Booklet {
  const sheets: Sheet[] = [];
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

/** Répartition des grilles par niveau, pour le sommaire. */
export function summarise(
  puzzles: readonly PrintablePuzzle[],
): { readonly levelLabel: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const puzzle of puzzles) {
    counts.set(puzzle.levelLabel, (counts.get(puzzle.levelLabel) ?? 0) + 1);
  }
  return [...counts.entries()].map(([levelLabel, count]) => ({ levelLabel, count }));
}
