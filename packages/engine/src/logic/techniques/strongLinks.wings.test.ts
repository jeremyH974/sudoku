import { describe, expect, it } from 'vitest';
import { formatCell, parseGrid } from '../../grid/index.js';
import { findSolution } from '../../solver/index.js';
import { rate } from '../rate.js';
import { REGISTRY } from '../registry.js';
import { solveLogically } from '../solve.js';
import { LogicState } from '../state.js';
import { checkPathSoundness, checkStepSoundness } from '../testing.js';
import { skyscraper, turbotFish, twoStringKite } from './strongLinks.js';
import { xyWing, xyzWing } from './wings.js';
import type { TechniqueEntry, TechniqueId } from '../types.js';

/**
 * Les quatre grilles que l'oracle résolvait et que nous refusions.
 *
 * Ce ne sont pas des exemples choisis pour illustrer : ce sont exactement les
 * quatre défauts de couverture relevés par la calibration de l'incrément 3, et
 * la raison d'être des techniques ajoutées ici. Le score **et** le nom viennent
 * de Sudoku Explainer, interrogé en boîte noire avec son format `%R`.
 *
 * Elles restent donc utiles longtemps après le correctif : elles disent, pour
 * chacune des trois familles ajoutées, qu'elle est détectée et notée à l'endroit
 * précis où l'oracle la voit.
 */
const ORACLE_CASES: readonly {
  readonly puzzle: string;
  readonly oracleEr: number;
  readonly oracleName: string;
  readonly expected: TechniqueId;
}[] = [
  {
    puzzle: '6.7.9....3....7...59....7.8..8..3..1...286...2..5..3..4.2....53...3....2....5.4.6',
    oracleEr: 4.0,
    oracleName: 'Skyscraper 011',
    expected: 'skyscraper',
  },
  {
    puzzle: '3...951.2..1..2..7.9......47..1.......86.37.......8..36......4.2..8..9..5.926...8',
    oracleEr: 4.0,
    oracleName: 'Skyscraper 011',
    expected: 'skyscraper',
  },
  {
    puzzle: '68.9..5....9.......2.8.3..4.....1.9...32.71...6.5.....7..1.5.8.......2....1..4.35',
    oracleEr: 4.2,
    oracleName: 'XY-Wing',
    expected: 'xy-wing',
  },
  {
    puzzle: '....39..831...4.....42.......74..35.4.......6.25..17.......34.....8...219..56....',
    oracleEr: 4.4,
    oracleName: 'XYZ-Wing',
    expected: 'xyz-wing',
  },
];

describe('les quatre grilles refusées à tort', () => {
  it.each(ORACLE_CASES.map((c) => [c.oracleName, c] as const))(
    'résout celle que l’oracle note %s, au même score et sous le même nom',
    (_name, testCase) => {
      const rating = rate(parseGrid(testCase.puzzle));
      expect(rating.outcome).toBe('solved');
      expect(rating.score).toBeCloseTo(testCase.oracleEr, 5);
      expect(rating.hardestTechnique).toBe(testCase.expected);
    },
  );

  it('n’y produit que des déductions valides, pas seulement le bon score', () => {
    // Un score juste par un chemin faux serait une coïncidence, pas une preuve.
    for (const testCase of ORACLE_CASES) {
      const puzzle = parseGrid(testCase.puzzle);
      const solution = findSolution(puzzle);
      expect(solution).not.toBeNull();
      checkPathSoundness(solveLogically(puzzle).steps, solution!);
    }
  });
});

/**
 * Parcourt une grille étape par étape avec le registre complet et rend chaque
 * position rencontrée — le seul moyen honnête d'exercer une technique tardive,
 * qui n'apparaît qu'une fois les motifs plus simples épuisés.
 */
function* statesAlong(puzzle: string): Generator<LogicState> {
  const state = LogicState.fromGrid(parseGrid(puzzle));
  if (state === null) return;

  for (let guard = 0; guard < 400; guard++) {
    if (state.isSolved() || state.hasContradiction()) return;
    yield state;

    let applied = null;
    for (const entry of REGISTRY) {
      const step = entry.find(state);
      if (step !== null) {
        applied = step;
        break;
      }
    }
    if (applied === null) return;
    for (const e of applied.eliminations) state.eliminate(e.cell, e.digit);
    for (const p of applied.placements) {
      if (state.isEmpty(p.cell)) state.place(p.cell, p.digit);
    }
  }
}

describe('anatomie des motifs ajoutés', () => {
  /**
   * On ne se contente pas de vérifier que le score tombe juste : on regarde la
   * forme du motif. Une technique peut rendre la bonne note pour de mauvaises
   * raisons — c'est précisément ce que la calibration ne sait pas voir.
   */
  const shapes: readonly [string, TechniqueEntry, number, number][] = [
    ['Skyscraper', skyscraper, 4.0, 4],
    ['Cerf-volant', twoStringKite, 4.1, 4],
    ['Turbot Fish', turbotFish, 4.2, 4],
    ['XY-Wing', xyWing, 4.2, 3],
    ['XYZ-Wing', xyzWing, 4.4, 3],
  ];

  it.each(shapes)('« %s » décrit un motif de la bonne forme', (name, entry, difficulty, cells) => {
    let seen = 0;
    for (const testCase of ORACLE_CASES) {
      for (const state of statesAlong(testCase.puzzle)) {
        for (const step of entry.findAll(state)) {
          expect(step.difficulty).toBeCloseTo(difficulty, 5);
          expect(step.highlights).toHaveLength(cells);
          // Un motif purement éliminatoire : il ne pose jamais de valeur.
          expect(step.placements).toHaveLength(0);
          expect(step.eliminations.length).toBeGreaterThan(0);
          // Les cases visées sont hors du motif, sinon il se mordrait la queue.
          const pattern = new Set(step.highlights.map((h) => h.cell));
          for (const elimination of step.eliminations) {
            expect(pattern.has(elimination.cell), formatCell(elimination.cell)).toBe(false);
          }
          seen++;
          if (seen > 60) return;
        }
      }
    }
    expect(seen, `« ${name} » n'apparaît sur aucune des quatre grilles`).toBeGreaterThan(0);
  });

  it('n’écarte jamais un candidat de la solution', () => {
    // Le contrôle décisif, et le seul qui ne pardonne rien : une élimination
    // fausse retirerait un chiffre qui appartient bel et bien à la solution.
    for (const testCase of ORACLE_CASES) {
      const solution = findSolution(parseGrid(testCase.puzzle))!;
      for (const [, entry] of shapes) {
        for (const state of statesAlong(testCase.puzzle)) {
          for (const step of entry.findAll(state)) checkStepSoundness(step, solution);
        }
      }
    }
  });
});
