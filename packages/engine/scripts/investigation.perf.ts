import { describe, expect, it } from 'vitest';
import { openCase } from '../src/investigation/case.js';
import { composeCase } from '../src/investigation/compose/generate.js';
import { deduce } from '../src/investigation/deduce/deduce.js';
import { openDomains, solveExact } from '../src/investigation/exact/solver.js';
import type { CaseFile } from '../src/investigation/types.js';

/**
 * Mesures du mode Enquête, hors suite de tests (`pnpm measure`).
 *
 * Ce que ces mesures ont déjà tranché, et qu'il faut pouvoir rejouer :
 *
 *   - la **queue** compte, pas la moyenne. Une fabrique à 80 ms de médiane et
 *     5 s au pire fait attendre le joueur une fois sur cinquante, ce qu'aucune
 *     moyenne ne montre. D'où p50 / p90 / p99 plutôt qu'une moyenne ;
 *   - c'est la **propagation binaire** qui dominait. Écrite en cohérence d'arc
 *     générique — chaque case de l'un contre chaque case de l'autre — elle
 *     coûtait |D|² par indice, sur une réserve de cent soixante-dix indices.
 *     Résolue par bornes de rangée, la queue est passée de 5 s à 0,65 s.
 */

const measure = (label: string, runs: number, fn: (i: number) => void): number[] => {
  fn(-1); // rodage : la première passe paie la compilation JIT
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn(i);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const at = (q: number): string =>
    samples[Math.min(samples.length - 1, Math.floor(samples.length * q))].toFixed(1).padStart(7);
  console.log(
    `${label.padEnd(46)} p50 ${at(0.5)}   p90 ${at(0.9)}   p99 ${at(0.99)}   max ${at(1)} ms`,
  );
  return samples;
};

describe('performance du mode Enquête', () => {
  it('mesure la fabrique et les deux solveurs', () => {
    const timings = measure('fabrique d’une affaire 6×6', 60, (i) => {
      composeCase(`perf-${String(i)}`);
    });

    const cases: CaseFile[] = Array.from({ length: 20 }, (_, i) => {
      const file = composeCase(`banc-${String(i)}`);
      if (file === null) throw new Error('la fabrique a rendu null pendant la mesure');
      return file;
    });
    const puzzles = cases.map((file) => openCase(file));

    measure('propagation seule (places possibles)', 200, (i) => {
      openDomains(puzzles[Math.abs(i) % puzzles.length]);
    });
    measure('solveur exact (unicité, arrêt à la 2ᵉ)', 200, (i) => {
      solveExact(puzzles[Math.abs(i) % puzzles.length], 2);
    });
    measure('registre de déduction (chemin complet)', 200, (i) => {
      deduce(puzzles[Math.abs(i) % puzzles.length]);
    });

    /*
      Un plafond, pas une cible : la mesure dépend de la machine.

      Relevé sur 400 graines, les quatre décors mêlés — p50 282 ms, p90 931 ms,
      p99 3 051 ms, pire 4 352 ms, zéro graine stérile. Le seuil était à 3 000,
      calibré quand le manoir était seul ; les trois décors ajoutés sont plus
      lents, et le pavillon le plus lent des quatre. C'est le prix de la
      variété, pas une régression de code.

      Ce que la queue coûte vraiment : une composition sur quatre cents fait
      attendre quatre secondes. Elle se fait dans un Worker, sous un libellé qui
      dit « Composition… ». Si ce seuil devait être abaissé un jour, ce serait en
      touchant le budget `attempts` — et en récupérant des graines stériles.
    */
    expect(timings[timings.length - 1]).toBeLessThan(6000);
  });
});
