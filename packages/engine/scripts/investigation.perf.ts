import { describe, expect, it } from 'vitest';
import { openCase } from '../src/investigation/case.js';
import { CAST } from '../src/investigation/cast.js';
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

      Relevé sur 400 graines, les quatre décors mêlés :

        |        | avant  | après |
        | p50    |  282   |  101  |
        | p90    |  931   |  343  |
        | p99    | 3 051  | 1 122 |
        | pire   | 4 352  | 1 603 |

      Zéro graine stérile dans les deux cas, et les affaires produites sont
      **identiques** — vérifié graine par graine sur deux cents, indice par
      indice. Le gain vient de deux endroits et d'aucun changement de règle :
      la propagation mémoïse les ensembles de cases qu'elle reconstruisait à
      chaque nœud, et `SOLUTION_CAP` est descendu de douze à deux, ce qui est la
      valeur exacte de la question posée.

      Le pavillon reste le plus lent des quatre décors (p50 153 ms contre 60 pour
      la rotonde), et c'est le prix de la variété, pas une régression.

      ⚠ Le pire cas est l'indicateur le plus bruité de tous : il varie d'une
      passe à l'autre sur la même machine et le même code. Les quantiles, eux,
      sont stables — c'est sur eux qu'il faut juger une régression.

      Le seuil passe de 6 000 à 3 000 ms, soit près du double du pire cas relevé.
      S'il devait descendre encore, ce serait en touchant le budget `attempts` —
      et en récupérant des graines stériles.
    */
    expect(timings[timings.length - 1]).toBeLessThan(3000);
  });
});

/**
 * La culpabilité est-elle également répartie ?
 *
 * La question n'est pas cosmétique. Les guides de conception de personnages
 * nomment un piège précis et documenté : coder le méchant sur un trait physique
 * — cicatrice, asymétrie, traits « durs ». Ici il deviendrait littéral, puisque
 * le jeu attache une culpabilité **factuelle** à un visage. Si un suspect était
 * coupable plus souvent que les autres, son portrait deviendrait un indice.
 *
 * Par construction, ça ne devrait pas arriver : le coupable n'est assigné à
 * personne, il **émerge** du placement — c'est le seul autre occupant de la
 * pièce de la victime. Mais « ça ne devrait pas » est exactement le genre de
 * phrase que ce projet refuse de laisser non vérifiée.
 *
 * Mesuré sur 400 affaires, les quatre décors mêlés :
 *   victime   A 69  B 70  C 66  D 71  E 62  F 62   (χ² = 1,19)
 *   coupable  A 72  B 71  C 64  D 65  E 68  F 60   (χ² = 1,55)
 * Pour 5 degrés de liberté, le seuil à 5 % est 11,07. On en est très loin : la
 * répartition est indiscernable de l'uniforme.
 */
describe('équité du mode Enquête', () => {
  it('ne rend personne coupable plus souvent qu’un autre', () => {
    const runs = 400;
    const victim = new Array<number>(CAST.length).fill(0);
    const murderer = new Array<number>(CAST.length).fill(0);
    let cases = 0;
    for (let seed = 0; seed < runs; seed++) {
      const file = composeCase(`equite-${String(seed)}`);
      if (file === null) continue;
      cases++;
      victim[file.victim]++;
      murderer[file.murderer]++;
    }

    const suspects = 6;
    const chi = (tally: number[]): number => {
      const expected = cases / suspects;
      let sum = 0;
      for (let i = 0; i < suspects; i++) sum += (tally[i] - expected) ** 2 / expected;
      return sum;
    };
    const show = (label: string, tally: number[]): void => {
      console.log(
        `${label.padEnd(10)}${tally
          .slice(0, suspects)
          .map((v, i) => `${CAST[i].letter} ${String(v).padStart(3)}`)
          .join('  ')}   χ² ${chi(tally).toFixed(2)}`,
      );
    };
    show('victime', victim);
    show('coupable', murderer);

    // Seuil à 0,1 % pour 5 degrés de liberté : 20,5. Large exprès — ce garde
    // doit attraper un biais grossier, jamais clignoter sur du bruit.
    expect(chi(murderer)).toBeLessThan(20.5);
    expect(chi(victim)).toBeLessThan(20.5);
  });
});
