import { formatGrid, generateAtLevel, generatePuzzle, rate } from '@sudoku/engine';
import { createRng } from '@sudoku/engine';
import type { Level, SolveOutcome, TechniqueId } from '@sudoku/engine';

/**
 * Construction du corpus de calibration.
 *
 * Deux sources, pour une raison de coût :
 *
 *   - un **tirage large** de grilles ordinaires, très rapide (~17 ms pièce),
 *     qui couvre abondamment le bas de l'échelle ;
 *   - un **tirage ciblé** par niveau, bien plus lent (jusqu'à huit secondes aux
 *     paliers élevés), mais seul capable d'atteindre le haut de l'échelle.
 *
 * Sans le second, le corpus serait presque uniquement composé de grilles
 * faciles et ne dirait rien des paliers qui nous intéressent le plus.
 */

export interface OurRating {
  readonly outcome: SolveOutcome;
  readonly score: number;
  readonly technique: TechniqueId | null;
  readonly label: string | null;
  readonly level: Level | null;
  readonly steps: number;
}

export interface CorpusEntry {
  /** Graine, pour reproduire la grille exactement. */
  readonly seed: string;
  /** Origine : tirage large ou ciblage d'un niveau. */
  readonly source: string;
  /** Grille en 81 caractères, format attendu par l'oracle. */
  readonly puzzle: string;
  readonly ours: OurRating;
}

const measure = (puzzle: Uint8Array): OurRating => {
  const rating = rate(puzzle);
  return {
    outcome: rating.outcome,
    score: rating.score,
    technique: rating.hardestTechnique,
    label: rating.hardestLabel,
    level: rating.level,
    steps: rating.stepCount,
  };
};

export interface BuildCorpusOptions {
  /** Nombre de grilles tirées au hasard, toutes densités confondues. */
  readonly randomCount: number;
  /** Nombre de grilles visées par niveau. */
  readonly perLevel: number;
  readonly seed: string;
  readonly onProgress?: (done: number, total: number, label: string) => void;
}

const LEVELS_TO_TARGET: Level[] = ['moyen', 'difficile', 'expert', 'maitre', 'diabolique'];
const DENSITIES = [45, 38, 32, 26, 20];

export function buildCorpus(options: BuildCorpusOptions): CorpusEntry[] {
  const rng = createRng(options.seed);
  const entries: CorpusEntry[] = [];
  const total = options.randomCount + LEVELS_TO_TARGET.length * options.perLevel;

  for (let i = 0; i < options.randomCount; i++) {
    const minClues = DENSITIES[i % DENSITIES.length];
    const seed = `alea-${String(rng.nextUint32())}`;
    const { puzzle } = generatePuzzle({ seed, minClues });
    entries.push({
      seed,
      source: `aleatoire-${String(minClues)}`,
      puzzle: formatGrid(puzzle),
      ours: measure(puzzle),
    });
    options.onProgress?.(entries.length, total, 'tirage large');
  }

  for (const level of LEVELS_TO_TARGET) {
    for (let i = 0; i < options.perLevel; i++) {
      const seed = `cible-${level}-${String(rng.nextUint32())}`;
      const result = generateAtLevel({ level, seed, timeBudgetMs: 12_000 });
      if (result === null) continue;
      entries.push({
        seed,
        source: `cible-${level}`,
        puzzle: formatGrid(result.puzzle),
        ours: measure(result.puzzle),
      });
      options.onProgress?.(entries.length, total, `ciblage ${level}`);
    }
  }

  return entries;
}
