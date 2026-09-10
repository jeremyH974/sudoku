import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CELL_COUNT,
  EMPTY,
  cloneGrid,
  formatGrid,
  isSolved,
  parseGrid,
} from '../grid/index.js';
import { createRng } from '../rng/index.js';
import { findSolution } from '../solver/index.js';
import { generatePuzzle } from '../generate/index.js';
import { LogicState } from './state.js';
import { findNextStep, solveLogically } from './solve.js';
import { checkPathSoundness } from './testing.js';
import { hiddenSingle } from './techniques/hiddenSingle.js';
import { nakedSingle } from './techniques/nakedSingle.js';

const SOLVED =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

/** Vide des cases d'une solution complète, sans toucher au reste. */
const emptyOut = (solution: string, cells: readonly number[]): Uint8Array => {
  const grid = parseGrid(solution);
  for (const cell of cells) grid[cell] = EMPTY;
  return grid;
};

describe('LogicState', () => {
  it('ne propage rien au-delà de la règle du jeu', () => {
    // Une seule case vide : son unique candidat est evident, mais l'etat ne doit
    // PAS le poser tout seul. Le poser reviendrait a resoudre une case sans
    // crediter la technique qui la justifie, et fausserait toute la notation.
    const state = LogicState.fromGrid(emptyOut(SOLVED, [0]))!;
    expect(state.isEmpty(0)).toBe(true);
    expect(state.valueAt(0)).toBe(EMPTY);
    expect(state.candidatesAt(0)).not.toBe(0);
  });

  it('retire la valeur posée des candidats des vingt pairs', () => {
    const state = LogicState.fromGrid(new Uint8Array(CELL_COUNT))!;
    state.place(0, 5);
    expect(state.candidatesAt(1)).toBe(0b1_1110_1111); // le 5 a disparu
    expect(state.candidatesAt(80)).toBe(0b1_1111_1111); // hors de portee
  });

  it('rejette des indices contradictoires', () => {
    const grid = new Uint8Array(CELL_COUNT);
    grid[0] = 5;
    grid[1] = 5;
    expect(LogicState.fromGrid(grid)).toBeNull();
  });

  it('rejette une grille où une case vide n a plus aucun candidat', () => {
    // Les huit premieres cases de la ligne 1 plus un 9 en colonne 9 ne laissent
    // rien pour r1c9.
    const grid = parseGrid('12345678.' + '........9' + '.'.repeat(63));
    expect(LogicState.fromGrid(grid)).toBeNull();
  });
});

describe('hiddenSingle', () => {
  it('reconnaît la dernière case d une unité comme « dernière case »', () => {
    const step = hiddenSingle.find(LogicState.fromGrid(emptyOut(SOLVED, [40]))!);
    expect(step?.technique).toBe('full-house');
    expect(step?.difficulty).toBe(1.0);
    expect(step?.placements).toEqual([{ cell: 40, digit: 5 }]);
  });

  it('crédite la boîte avant la ligne quand les deux s appliquent', () => {
    // Rectangle r1c1 / r1c4 / r2c1 / r2c4 : deux lignes de la meme bande, deux
    // colonnes de piles differentes. Chaque ligne, chaque colonne et chacune des
    // deux boites concernees garde donc DEUX cases vides — aucune « derniere
    // case » possible. Le chiffre reste pourtant force, et doit etre credite au
    // tarif de la boite (1,2) et non de la ligne (1,5).
    const step = hiddenSingle.find(LogicState.fromGrid(emptyOut(SOLVED, [0, 3, 9, 12]))!);
    expect(step?.technique).toBe('hidden-single-box');
    expect(step?.difficulty).toBe(1.2);
  });

  it('ne trouve rien sur une grille complète', () => {
    expect(hiddenSingle.find(LogicState.fromGrid(parseGrid(SOLVED))!)).toBeNull();
  });

  it('explique son raisonnement en nommant la zone', () => {
    const step = hiddenSingle.find(LogicState.fromGrid(emptyOut(SOLVED, [40]))!);
    expect(step?.explanation).toContain('r5c5');
    expect(step?.explanation).toMatch(/ligne|colonne|boîte/);
  });
});

describe('nakedSingle', () => {
  it('trouve une case réduite à un seul candidat', () => {
    const step = nakedSingle.find(LogicState.fromGrid(emptyOut(SOLVED, [40]))!);
    expect(step?.technique).toBe('naked-single');
    expect(step?.difficulty).toBe(2.3);
    expect(step?.placements).toEqual([{ cell: 40, digit: 5 }]);
  });

  it('ne trouve rien quand toutes les cases vides gardent plusieurs candidats', () => {
    const state = LogicState.fromGrid(new Uint8Array(CELL_COUNT))!;
    expect(nakedSingle.find(state)).toBeNull();
  });
});

describe('ordre du registre', () => {
  it('crédite le single caché plutôt que le single nu quand les deux existent', () => {
    // Sur une case unique vide, les trois techniques s'appliquent. Le barème de
    // reference note « derniere case » 1,0 et « single nu » 2,3 : c'est la moins
    // chere qui doit gagner.
    const path = solveLogically(emptyOut(SOLVED, [40]));
    expect(path.steps[0]?.technique).toBe('full-house');
  });
});

describe('solveLogically', () => {
  it('résout une grille simple et retrouve la solution du solveur brut', () => {
    const puzzle = emptyOut(SOLVED, [0, 3, 27, 30, 40, 55, 70]);
    const path = solveLogically(puzzle);
    expect(path.outcome).toBe('solved');
    expect(formatGrid(path.grid)).toBe(SOLVED);
    expect(isSolved(path.grid)).toBe(true);
  });

  it('journalise une étape par déduction, dans l ordre', () => {
    const puzzle = emptyOut(SOLVED, [0, 40, 80]);
    const path = solveLogically(puzzle);
    expect(path.steps).toHaveLength(3);
    for (const step of path.steps) {
      expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0);
      expect(step.explanation.length).toBeGreaterThan(10);
    }
  });

  it('signale une grille dont les indices se contredisent', () => {
    const grid = new Uint8Array(CELL_COUNT);
    grid[0] = 5;
    grid[1] = 5;
    expect(solveLogically(grid).outcome).toBe('invalid');
  });

  it('s arrête sur « stuck » au lieu de deviner', () => {
    // Avec les seuls singles, une grille vraiment creusee finit par bloquer.
    // C'est le comportement attendu : mieux vaut refuser de conclure que
    // produire une note inventee.
    const path = solveLogically(parseGrid('.'.repeat(CELL_COUNT)));
    expect(path.outcome).toBe('stuck');
    expect(path.steps).toHaveLength(0);
  });

  it('n abîme jamais la grille quand il bloque', () => {
    const { puzzle, solution } = generatePuzzle({ seed: 'bloque', minClues: 22 });
    const path = solveLogically(puzzle);
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (path.grid[cell] !== EMPTY) expect(path.grid[cell]).toBe(solution[cell]);
    }
  });

  it('estampille la version du barème', () => {
    expect(solveLogically(parseGrid(SOLVED)).ratingVersion).toBe(1);
  });

  it('accepte un registre restreint, pour isoler une technique', () => {
    const path = solveLogically(emptyOut(SOLVED, [40]), { registry: [nakedSingle] });
    expect(path.outcome).toBe('solved');
    expect(path.steps[0]?.technique).toBe('naked-single');
  });
});

describe('solidité du raisonnement', () => {
  it('ne pose et n élimine jamais à contresens de la solution', () => {
    // LE test central de l'increment. Verifier qu'une grille finit resolue ne dit
    // rien de la justesse du chemin : une technique boguee peut ecarter un
    // candidat pour une mauvaise raison sans empecher la resolution. L'indice
    // affiche au joueur raconterait alors une explication fausse.
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const { puzzle, solution } = generatePuzzle({ seed, minClues: 40 });
        const path = solveLogically(puzzle);
        checkPathSoundness(path.steps, solution);
      }),
      { numRuns: 60 },
    );
  });

  it('ne dépend pas de l ordre de découverte : rejouer donne le même chemin', () => {
    const { puzzle } = generatePuzzle({ seed: 'deterministe', minClues: 40 });
    const first = solveLogically(cloneGrid(puzzle));
    const second = solveLogically(cloneGrid(puzzle));
    expect(second.steps.map((s) => s.technique)).toEqual(first.steps.map((s) => s.technique));
  });

  it('converge vers la solution du solveur brut quand il résout', () => {
    const rng = createRng('convergence');
    for (let i = 0; i < 25; i++) {
      const { puzzle } = generatePuzzle({ seed: rng.nextUint32(), minClues: 40 });
      const path = solveLogically(puzzle);
      if (path.outcome !== 'solved') continue;
      expect(formatGrid(path.grid)).toBe(formatGrid(findSolution(puzzle)!));
    }
  });
});

describe('findNextStep', () => {
  it('rend la première étape sans résoudre la suite', () => {
    const step = findNextStep(emptyOut(SOLVED, [0, 40, 80]));
    expect(step).not.toBeNull();
    expect(step?.placements).toHaveLength(1);
  });

  it('ne rend rien sur une grille incohérente', () => {
    const grid = new Uint8Array(CELL_COUNT);
    grid[0] = 5;
    grid[1] = 5;
    expect(findNextStep(grid)).toBeNull();
  });

  it('ne rend rien sur une grille déjà résolue', () => {
    expect(findNextStep(parseGrid(SOLVED))).toBeNull();
  });
});
