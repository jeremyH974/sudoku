import { describe, expect, it } from 'vitest';
import { createRng } from '../src/rng/index.js';
import { generatePuzzle } from '../src/generate/index.js';
import { generateAtLevel } from '../src/generate/targeted.js';
import { LEVELS, rate } from '../src/logic/index.js';

describe('notation', () => {
  it('mesure le cout de la notation et la distribution naturelle', () => {
    for (const minClues of [45, 34, 26, 17]) {
      const rng = createRng(`dist-${String(minClues)}`);
      const counts = new Map<string, number>();
      let ratingMs = 0;
      const SAMPLES = 60;

      for (let i = 0; i < SAMPLES; i++) {
        const { puzzle } = generatePuzzle({ seed: rng.nextUint32(), minClues });
        const t = performance.now();
        const rating = rate(puzzle);
        ratingMs += performance.now() - t;
        const key = rating.level ?? 'hors-echelle';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      const order: string[] = [...LEVELS.map((l) => l.id as string), 'hors-echelle'];
      const distribution = order.filter((k) => counts.has(k)).map((k) => `${k}=${String(counts.get(k) ?? 0)}`).join(' ');
      console.log(
        `>=${String(minClues)} indices : notation ${(ratingMs / SAMPLES).toFixed(2)} ms/grille  |  ${distribution}`,
      );
    }
    expect(true).toBe(true);
  });
});

describe('generation ciblee par niveau', () => {
  it('atteint chaque niveau et mesure le cout', () => {
    const RUNS = 5;
    for (const level of LEVELS) {
      const rng = createRng(`cible-${level.id}`);
      let exact = 0;
      let totalMs = 0;
      let clues = 0;
      const hardest = new Map<string, number>();

      for (let i = 0; i < RUNS; i++) {
        const t = performance.now();
        const result = generateAtLevel({
          level: level.id,
          seed: rng.nextUint32(),
          timeBudgetMs: 15000,
        });
        totalMs += performance.now() - t;
        if (result === null) continue;
        if (result.exact) exact++;
        clues += result.clues;
        const h = result.rating.hardestLabel ?? '?';
        hardest.set(h, (hardest.get(h) ?? 0) + 1);
      }

      console.log(
        `${level.label.padEnd(11)} ${String(exact)}/${String(RUNS)} exactes  ` +
          `${(totalMs / RUNS / 1000).toFixed(2).padStart(6)} s/grille  ` +
          `${(clues / RUNS).toFixed(0).padStart(3)} indices  ` +
          `technique max : ${[...hardest.entries()].map(([k, v]) => `${k}x${String(v)}`).join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });
});
