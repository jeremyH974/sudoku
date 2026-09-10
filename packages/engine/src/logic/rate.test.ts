import { describe, expect, it } from 'vitest';
import { CELL_COUNT, EMPTY, parseGrid } from '../grid/index.js';
import { createRng } from '../rng/index.js';
import { generatePuzzle } from '../generate/index.js';
import { generateAtLevel } from '../generate/targeted.js';
import { LEVELS, levelForScore, levelInfo, rate } from './rate.js';
import { checkPathSoundness } from './testing.js';
import { hasUniqueSolution } from '../solver/index.js';
import type { Level } from './rate.js';

const SOLVED =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

describe('échelle de niveaux', () => {
  it('couvre six paliers, ordonnés et sans trou', () => {
    expect(LEVELS).toHaveLength(6);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.maxScore).toBeGreaterThan(LEVELS[i - 1]!.maxScore);
    }
  });

  it('place chaque score dans le bon palier', () => {
    expect(levelForScore(1.0)).toBe('facile'); // dernière case
    expect(levelForScore(1.5)).toBe('facile'); // single caché en ligne
    expect(levelForScore(2.3)).toBe('moyen'); // single nu
    expect(levelForScore(2.8)).toBe('difficile'); // paire revendiquée
    expect(levelForScore(3.2)).toBe('expert'); // X-Wing
    expect(levelForScore(3.4)).toBe('expert'); // paire cachée
    expect(levelForScore(4.0)).toBe('maitre'); // triplet caché
    expect(levelForScore(5.4)).toBe('diabolique'); // quadruplet caché
  });

  it('refuse d étiqueter un score hors de l échelle connue', () => {
    // Au-delà, il faut des chaînes, absentes de ce registre. Mieux vaut ne rien
    // annoncer que d'apposer un niveau au jugé.
    expect(levelForScore(6.5)).toBeNull();
    expect(levelForScore(11.9)).toBeNull();
  });

  it('décrit chaque palier par ce qu il exige du joueur', () => {
    for (const level of LEVELS) {
      expect(levelInfo(level.id)).toBe(level);
      expect(level.description.length).toBeGreaterThan(30);
      expect(level.label.length).toBeGreaterThan(0);
    }
  });
});

describe('rate', () => {
  it('note une grille résolue par la technique la plus difficile employée', () => {
    const grid = parseGrid(SOLVED);
    grid[40] = EMPTY;
    const rating = rate(grid);
    expect(rating.outcome).toBe('solved');
    expect(rating.score).toBe(1.0);
    expect(rating.hardestTechnique).toBe('full-house');
    expect(rating.level).toBe('facile');
    expect(rating.stepCount).toBe(1);
  });

  it('prend le maximum et non la somme des difficultés', () => {
    // Un chemin de cent « dernières cases » (1,0) reste noté 1,0 : le score pic
    // répond à « saurai-je la résoudre ? », pas à « combien de temps ? ».
    const { puzzle } = generatePuzzle({ seed: 'maximum', minClues: 55 });
    const rating = rate(puzzle);
    if (rating.outcome !== 'solved') return;
    const maximum = Math.max(...rating.steps.map((s) => s.difficulty));
    expect(rating.score).toBe(maximum);
    expect(rating.stepCount).toBeGreaterThan(1);
  });

  it('compte les techniques employées', () => {
    const { puzzle } = generatePuzzle({ seed: 'decompte', minClues: 30 });
    const rating = rate(puzzle);
    const total = [...rating.techniqueCounts.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(rating.stepCount);
  });

  it('n étiquette pas une grille qu il ne sait pas résoudre', () => {
    // « AI Escargot » exige des chaînes, hors registre.
    const rating = rate(
      parseGrid('1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'),
    );
    if (rating.outcome !== 'solved') {
      expect(rating.level).toBeNull();
    }
  });

  it('signale une grille incohérente', () => {
    const grid = new Uint8Array(CELL_COUNT);
    grid[0] = 5;
    grid[1] = 5;
    const rating = rate(grid);
    expect(rating.outcome).toBe('invalid');
    expect(rating.level).toBeNull();
  });

  it('estampille la version du barème', () => {
    expect(rate(parseGrid(SOLVED)).ratingVersion).toBe(1);
  });
});

describe('generateAtLevel', () => {
  /**
   * Ces cas sont lents à dessein : produire une grille de haut niveau demande
   * une recherche dirigée. On limite donc le nombre d'exécutions et on borne le
   * budget, plutôt que de retirer la vérification.
   */
  it.each(['facile', 'moyen', 'difficile'] as const)(
    'produit une grille de niveau %s, exacte et à solution unique',
    (level: Level) => {
      const result = generateAtLevel({ level, seed: `test-${level}`, timeBudgetMs: 20_000 });
      expect(result).not.toBeNull();
      expect(result!.exact).toBe(true);
      expect(result!.rating.level).toBe(level);
      expect(hasUniqueSolution(result!.puzzle)).toBe(true);
    },
    30_000,
  );

  it(
    'produit une grille experte, hors de portée d une simple boucle de rejet',
    () => {
      const result = generateAtLevel({ level: 'expert', seed: 'test-expert', timeBudgetMs: 25_000 });
      expect(result).not.toBeNull();
      expect(result!.rating.level).toBe('expert');
      expect(result!.rating.score).toBeGreaterThan(2.8);
    },
    40_000,
  );

  it(
    'rend des grilles dont chaque déduction reste valide',
    () => {
      const result = generateAtLevel({ level: 'difficile', seed: 'solide', timeBudgetMs: 20_000 });
      expect(result).not.toBeNull();
      checkPathSoundness(result!.rating.steps, result!.solution);
    },
    30_000,
  );

  it(
    'est reproductible à graine égale',
    () => {
      const a = generateAtLevel({ level: 'moyen', seed: 'repro', timeBudgetMs: 20_000 });
      const b = generateAtLevel({ level: 'moyen', seed: 'repro', timeBudgetMs: 20_000 });
      expect([...b!.puzzle]).toEqual([...a!.puzzle]);
    },
    40_000,
  );

  it(
    'signale honnêtement quand le niveau demandé n a pas été atteint',
    () => {
      // Budget volontairement minuscule : la fonction doit rendre sa meilleure
      // approximation avec `exact: false`, jamais une étiquette mensongère.
      const result = generateAtLevel({
        level: 'diabolique',
        seed: 'budget-court',
        timeBudgetMs: 250,
        maxAttempts: 1,
      });
      if (result !== null && !result.exact) {
        expect(result.rating.level).not.toBe('diabolique');
        expect(hasUniqueSolution(result.puzzle)).toBe(true);
      }
    },
    20_000,
  );

  it('respecte la symétrie demandée', () => {
    const result = generateAtLevel({
      level: 'facile',
      seed: 'symetrie',
      symmetry: 'rotational180',
      timeBudgetMs: 20_000,
    });
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      const mirror = CELL_COUNT - 1 - cell;
      expect(result!.puzzle[cell] === EMPTY).toBe(result!.puzzle[mirror] === EMPTY);
    }
  }, 30_000);
});

describe('cohérence entre notation et corpus aléatoire', () => {
  it('ne produit jamais un niveau sans chemin de résolution', () => {
    const rng = createRng('coherence');
    for (let i = 0; i < 30; i++) {
      const { puzzle } = generatePuzzle({ seed: rng.nextUint32(), minClues: 28 });
      const rating = rate(puzzle);
      if (rating.level !== null) {
        expect(rating.outcome).toBe('solved');
        expect(rating.stepCount).toBeGreaterThan(0);
        expect(rating.score).toBeLessThanOrEqual(levelInfo(rating.level).maxScore);
      }
    }
  });
});
