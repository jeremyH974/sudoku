import { describe, expect, it } from 'vitest';
import { createEmptyGrid, formatGrid, parseGrid } from '../src/grid/index.js';
import { createRng } from '../src/rng/index.js';
import { findSolution, solve } from '../src/solver/index.js';
import { digHoles, generatePuzzle, generateSolvedGrid } from '../src/generate/index.js';

/**
 * Mesures de performance, hors suite de tests (lancer `pnpm measure`).
 *
 * Objectif : trancher une question laissee ouverte par le plan — ou part
 * reellement le temps ? L'hypothese est que la solution complete est quasi
 * gratuite et que tout le cout est dans les verifications d'unicite du
 * creusement. C'est ce qui determine s'il faut un Worker, un pool pre-genere,
 * et un jour du WASM.
 *
 * Vitest 5 a retire l'API `bench` ; on mesure donc a la main, ce qui suffit
 * amplement ici. Le bench formel avec seuils de regression viendra avec la
 * generation calibree.
 */

const measure = (label: string, runs: number, fn: (i: number) => void): number => {
  fn(-1); // rodage : on ne mesure pas la compilation JIT du premier passage
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn(i);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const p = (q: number): string => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))].toFixed(1);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  console.log(
    `${label.padEnd(46)} moyenne ${mean.toFixed(1).padStart(7)} ms   p50 ${p(0.5).padStart(7)}   p95 ${p(0.95).padStart(7)}`,
  );
  return mean;
};

describe('performance de generation', () => {
  it('mesure chaque etape du pipeline', () => {
    measure('solveur brut, grille vide', 50, (i) => {
      findSolution(createEmptyGrid(), { rng: createRng(i) });
    });

    measure('solution complete aleatoire', 50, (i) => {
      generateSolvedGrid(createRng(`sol-${String(i)}`));
    });

    const solutions = Array.from({ length: 30 }, (_, i) => generateSolvedGrid(createRng(`d-${String(i)}`)));
    measure('creusement symetrique (unicite a chaque retrait)', 30, (i) => {
      digHoles(solutions[Math.max(0, i)], createRng(`dig-${String(i)}`));
    });

    measure('grille jouable de bout en bout', 30, (i) => {
      generatePuzzle({ seed: `bout-${String(i)}` });
    });

    expect(true).toBe(true);
  });

  it('mesure le solveur sur les grilles reputees les plus dures', () => {
    const HARD: Record<string, string> = {
      'AI Escargot': '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..',
      'Platinum Blonde': '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
      'Golden Nugget': '.......39.....1..5..3.5.8....8.9...6.7...2...1..4.......9.8..5..2....6..4..7.....',
    };
    for (const [name, puzzle] of Object.entries(HARD)) {
      const grid = parseGrid(puzzle);
      let guesses = 0;
      measure(`unicite verifiee — ${name}`, 20, () => {
        guesses = solve(grid, { maxSolutions: 2 }).guesses;
      });
      console.log(`${''.padEnd(46)} hypotheses posees : ${String(guesses)}`);
    }
    expect(formatGrid(createEmptyGrid())).toHaveLength(81);
  });
});
