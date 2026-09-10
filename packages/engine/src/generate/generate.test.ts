import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CELL_COUNT,
  EMPTY,
  SIZE,
  countClues,
  formatGrid,
  indexOf,
  isSolved,
} from '../grid/index.js';
import { createRng } from '../rng/index.js';
import { countSolutions, hasUniqueSolution } from '../solver/index.js';
import { digHoles, generatePuzzle, generateSolvedGrid } from './generate.js';
import type { Symmetry } from './generate.js';

const SYMMETRIES: Symmetry[] = ['none', 'rotational180', 'diagonal'];

describe('generateSolvedGrid', () => {
  it('produit une grille complete et valide', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(isSolved(generateSolvedGrid(createRng(seed)))).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('ne produit pas toujours la meme grille', () => {
    const grids = new Set(
      Array.from({ length: 20 }, (_, i) => formatGrid(generateSolvedGrid(createRng(i)))),
    );
    expect(grids.size).toBe(20);
  });

  it('varie la premiere ligne, pas seulement l etiquetage des chiffres', () => {
    // Si l'on se contentait de permuter les chiffres d'une grille germe unique,
    // la STRUCTURE resterait identique. On verifie donc que la disposition
    // elle-meme change : on normalise l'etiquetage (la premiere ligne devient
    // 123456789) et on compte les grilles encore distinctes.
    const normalised = new Set<string>();
    for (let seed = 0; seed < 15; seed++) {
      const grid = generateSolvedGrid(createRng(seed));
      const relabel = new Map<number, number>();
      for (let c = 0; c < SIZE; c++) relabel.set(grid[c]!, c + 1);
      normalised.add([...grid].map((v) => relabel.get(v)!).join(''));
    }
    expect(normalised.size).toBeGreaterThan(10);
  });
});

describe('digHoles', () => {
  it.each(SYMMETRIES)('preserve l unicite de la solution (symetrie %s)', (symmetry) => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed);
        const puzzle = digHoles(generateSolvedGrid(rng), rng, { symmetry });
        expect(hasUniqueSolution(puzzle)).toBe(true);
      }),
      { numRuns: 6 },
    );
  });

  it('respecte le plancher d indices demande', () => {
    for (const minClues of [30, 45, 60]) {
      const rng = createRng(`plancher-${String(minClues)}`);
      const puzzle = digHoles(generateSolvedGrid(rng), rng, { minClues });
      expect(countClues(puzzle)).toBeGreaterThanOrEqual(minClues);
    }
  });

  it('retire effectivement des cases', () => {
    const rng = createRng('creuse');
    const puzzle = digHoles(generateSolvedGrid(rng), rng);
    expect(countClues(puzzle)).toBeLessThan(CELL_COUNT);
  });
});

describe('symetrie des cases vides', () => {
  const partner: Record<Symmetry, (cell: number) => number> = {
    none: (cell) => cell,
    rotational180: (cell) => CELL_COUNT - 1 - cell,
    diagonal: (cell) => indexOf(cell % SIZE, Math.floor(cell / SIZE)),
  };

  it.each(['rotational180', 'diagonal'] as const)('est respectee (%s)', (symmetry) => {
    const { puzzle } = generatePuzzle({ seed: `sym-${symmetry}`, symmetry });
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      const isEmptyHere = puzzle[cell] === EMPTY;
      const isEmptyThere = puzzle[partner[symmetry](cell)] === EMPTY;
      expect(isEmptyHere).toBe(isEmptyThere);
    }
  });
});

describe('generatePuzzle', () => {
  it('garantit une solution unique — le garde-fou de toute grille publiee', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const { puzzle } = generatePuzzle({ seed });
        expect(countSolutions(puzzle, 2)).toBe(1);
      }),
      { numRuns: 10 },
    );
  });

  it('rend une solution coherente avec les indices du puzzle', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const { puzzle, solution } = generatePuzzle({ seed });
        expect(isSolved(solution)).toBe(true);
        for (let cell = 0; cell < CELL_COUNT; cell++) {
          if (puzzle[cell] !== EMPTY) expect(puzzle[cell]).toBe(solution[cell]);
        }
      }),
      { numRuns: 10 },
    );
  });

  it('annonce un nombre d indices exact', () => {
    const result = generatePuzzle({ seed: 'comptage' });
    expect(result.clues).toBe(countClues(result.puzzle));
  });

  it('est reproductible a seed egal', () => {
    const a = generatePuzzle({ seed: 'reproductible' });
    const b = generatePuzzle({ seed: 'reproductible' });
    expect(formatGrid(a.puzzle)).toBe(formatGrid(b.puzzle));
    expect(formatGrid(a.solution)).toBe(formatGrid(b.solution));
  });

  it('renvoie le seed tire quand on ne lui en donne pas', () => {
    const generated = generatePuzzle();
    const replayed = generatePuzzle({ seed: generated.seed });
    expect(formatGrid(replayed.puzzle)).toBe(formatGrid(generated.puzzle));
  });

  it('produit des grilles differentes pour des seeds differents', () => {
    const puzzles = new Set(
      Array.from({ length: 10 }, (_, i) => formatGrid(generatePuzzle({ seed: i }).puzzle)),
    );
    expect(puzzles.size).toBe(10);
  });
});
