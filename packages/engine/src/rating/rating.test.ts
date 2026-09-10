import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { generatePuzzle } from '../generate/index.js';
import { rate } from '../logic/rate.js';
import { replayPath } from '../logic/solve.js';
import { checkStepSoundness } from '../logic/testing.js';
import { findSolution } from '../solver/index.js';
import { DEMANDING_FROM, analysePath } from './path.js';
import { conclusionKey, waysForward } from './tension.js';

/** Une grille résolue par le seul raisonnement, produite ici et pas recopiée. */
function solvable(seed: string, minClues = 26): { puzzle: Uint8Array; rating: ReturnType<typeof rate> } {
  for (let i = 0; i < 40; i++) {
    const { puzzle } = generatePuzzle({ seed: `${seed}-${String(i)}`, minClues });
    const rating = rate(puzzle);
    if (rating.outcome === 'solved') return { puzzle, rating };
  }
  throw new Error('aucune grille résoluble : la génération est en cause');
}

describe('issues d’une position', () => {
  it('contient toujours le coup que le solveur a joué', () => {
    /*
      La propriété qui tient tout le module. Si l'énumération dérivait de ce que
      le solveur fait — un état mal repris, un registre différent, une technique
      qui mute l'état — elle tomberait ici. Elle garantit du même coup que le
      compte n'est jamais nul là où une étape a eu lieu : l'affichage ne peut pas
      mentir par omission.
    */
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), (n) => {
        const { puzzle, rating } = solvable(`issues-${String(n)}`);
        const frames = replayPath(puzzle, rating.steps);

        for (let index = 0; index < rating.steps.length; index++) {
          const frame = frames[index]!;
          const step = rating.steps[index]!;
          const ways = waysForward({ values: frame.values, candidates: frame.candidates });
          expect(ways).not.toBeNull();

          const matching = ways!.filter((way) => conclusionKey(way.step) === conclusionKey(step));
          // **Exactement une** : la déduplication garantit qu'une conclusion
          // n'apparaît qu'une fois, et c'est ce qui permet à l'interface de
          // marquer « jouée » sans se tromper de coup.
          expect(matching, `étape ${String(index)} absente de ses propres issues`).toHaveLength(1);
        }
      }),
      { numRuns: 8 },
    );
  });

  it('rend la moins chère en tête, et c’est celle que le solveur a jouée', () => {
    // Le registre est essayé par difficulté croissante : si quelqu'un le
    // réordonne sans bumper la version, cette égalité tombe.
    const { puzzle, rating } = solvable('issues-ordre');
    const frames = replayPath(puzzle, rating.steps);
    for (let index = 0; index < rating.steps.length; index++) {
      const ways = waysForward({
        values: frames[index]!.values,
        candidates: frames[index]!.candidates,
      })!;
      expect(ways[0]!.step.difficulty).toBe(rating.steps[index]!.difficulty);
    }
  });

  it('ne propose que des coups sains', () => {
    const { puzzle, rating } = solvable('issues-solidite');
    const solution = findSolution(Uint8Array.from(puzzle))!;
    const frames = replayPath(puzzle, rating.steps);
    for (const frame of frames.slice(0, 12)) {
      for (const way of waysForward({ values: frame.values, candidates: frame.candidates })!) {
        expect(() => {
          checkStepSoundness(way.step, solution);
        }).not.toThrow();
      }
    }
  });

  it('déduplique : un même coup démontré deux fois ne compte qu’une', () => {
    /*
      Un single caché se voit à la fois dans sa boîte et dans sa ligne. Compter
      les motifs ferait dépendre la mesure du découpage du registre ; on compte
      donc ce qui change sur le plateau. Le cas est cherché, jamais supposé — et
      l'assertion finale interdit au test de passer en n'en trouvant aucun.
    */
    let collapsed = 0;
    for (let i = 0; i < 12 && collapsed === 0; i++) {
      const { puzzle, rating } = solvable(`issues-dedup-${String(i)}`, 34);
      for (const frame of replayPath(puzzle, rating.steps)) {
        const ways = waysForward({ values: frame.values, candidates: frame.candidates })!;
        collapsed += ways.filter((way) => way.patterns >= 2).length;
      }
    }
    expect(collapsed).toBeGreaterThan(0);
  });

  it('refuse une position incohérente plutôt que de rendre zéro', () => {
    // Zéro veut dire « bloquée », ce qui est une réponse. Une position
    // impossible n'en est pas une.
    const { puzzle, rating } = solvable('issues-invalide');
    const frame = replayPath(puzzle, rating.steps)[0]!;
    const broken = new Uint16Array(frame.candidates);
    broken[frame.values.indexOf(0)] = 0;
    expect(waysForward({ values: frame.values, candidates: broken })).toBeNull();
  });
});

describe('mesure du chemin', () => {
  it('rend au moins une issue au moment le plus étroit', () => {
    // S'il n'y avait eu aucun coup jouable au pic, l'étape n'aurait pas eu lieu.
    const { puzzle, rating } = solvable('chemin-minimum');
    const analysis = analysePath(puzzle, rating)!;
    expect(analysis.narrowest.waysForward).toBeGreaterThanOrEqual(1);
    expect(analysis.peakSteps).toBeGreaterThanOrEqual(1);
    expect(analysis.narrowest.emptyCells).toBeGreaterThan(0);
    expect(analysis.ratingVersion).toBe(rating.ratingVersion);
  });

  it('ne compte comme exigeantes que les étapes hors du sudoku « à l’œil »', () => {
    const { puzzle, rating } = solvable('chemin-exigeantes');
    const analysis = analysePath(puzzle, rating)!;
    expect(analysis.demandingSteps).toBe(
      rating.steps.filter((step) => step.difficulty >= DEMANDING_FROM).length,
    );
    expect(analysis.stepCount).toBe(rating.stepCount);
  });

  it('ne mesure pas un chemin que le registre n’a pas terminé', () => {
    // Un chemin partiel porterait des comptages qui auraient l'air mesurés.
    const empty = new Uint8Array(81);
    expect(analysePath(empty, rate(empty))).toBeNull();
  });
});
