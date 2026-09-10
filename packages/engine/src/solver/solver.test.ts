import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CELL_COUNT,
  EMPTY,
  createEmptyGrid,
  formatGrid,
  isSolved,
  parseGrid,
} from '../grid/index.js';
import { createRng } from '../rng/index.js';
import { countSolutions, findSolution, hasUniqueSolution, solve } from './solver.js';

const EASY = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
const EASY_SOLUTION =
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

/** 17 indices : le minimum prouve pour une solution unique (McGuire et al., 2012). */
const SEVENTEEN_CLUES =
  '000000010400000000020000000000050407008000300001090000300400200050100000000806000';

/**
 * Grilles reputees parmi les plus dures pour un solveur a backtracking.
 * Solutions verifiees par ce meme solveur puis figees ici comme references.
 */
const AI_ESCARGOT = '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..';
const AI_ESCARGOT_SOLUTION =
  '162857493534129678789643521475312986913586742628794135356478219241935867897261354';
const PLATINUM_BLONDE = '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...';
const GOLDEN_NUGGET = '.......39.....1..5..3.5.8....8.9...6.7...2...1..4.......9.8..5..2....6..4..7.....';

/**
 * Motif fatal : quatre cases en 2 lignes x 2 colonnes, reparties sur exactement
 * deux boites, ne contenant que les chiffres 6 et 7 croises. Les vider rend les
 * deux dispositions interchangeables — la solution n'est plus unique.
 * C'est le cas que la verification d'unicite doit imperativement attraper.
 */
const AMBIGUOUS = '534..8912672195348198342567859..1423426853791713924856961537284287419635345286179';

const respectsClues = (puzzle: string, solution: string): boolean =>
  [...puzzle].every((c, i) => c === '.' || c === '0' || c === solution[i]);

describe('solve', () => {
  it('resout une grille facile et retrouve la solution attendue', () => {
    const solution = findSolution(parseGrid(EASY));
    expect(solution).not.toBeNull();
    expect(formatGrid(solution!)).toBe(EASY_SOLUTION);
  });

  it('resout une grille a 17 indices', () => {
    const solution = findSolution(parseGrid(SEVENTEEN_CLUES));
    expect(solution).not.toBeNull();
    expect(isSolved(solution!)).toBe(true);
    expect(respectsClues(SEVENTEEN_CLUES, formatGrid(solution!))).toBe(true);
  });

  it.each([
    ['AI Escargot', AI_ESCARGOT],
    ['Platinum Blonde', PLATINUM_BLONDE],
    ['Golden Nugget', GOLDEN_NUGGET],
  ])('resout %s, reputee tres difficile', (_name, puzzle) => {
    const result = solve(parseGrid(puzzle), { maxSolutions: 2 });
    expect(result.count).toBe(1);
    expect(isSolved(result.solutions[0]!)).toBe(true);
    expect(respectsClues(puzzle, formatGrid(result.solutions[0]!))).toBe(true);
  });

  it('retrouve la solution connue d AI Escargot', () => {
    expect(formatGrid(findSolution(parseGrid(AI_ESCARGOT))!)).toBe(AI_ESCARGOT_SOLUTION);
  });

  it('remplit une grille vide', () => {
    const solution = findSolution(createEmptyGrid());
    expect(solution).not.toBeNull();
    expect(isSolved(solution!)).toBe(true);
  });

  it('rend une solution deja complete telle quelle', () => {
    expect(formatGrid(findSolution(parseGrid(EASY_SOLUTION))!)).toBe(EASY_SOLUTION);
  });

  it('rejette les bornes invalides', () => {
    expect(() => solve(createEmptyGrid(), { maxSolutions: 0 })).toThrow(RangeError);
  });
});

describe('grilles insolubles', () => {
  it('ne rend rien pour des indices contradictoires', () => {
    const grid = createEmptyGrid();
    grid[0] = 5;
    grid[1] = 5;
    const result = solve(grid);
    expect(result.count).toBe(0);
    expect(result.exhausted).toBe(true);
    expect(findSolution(grid)).toBeNull();
  });

  it('ne rend rien pour une grille coherente mais sans issue', () => {
    // Les 8 premieres cases de la ligne 1 forcent un 9 en r1c9, deja pris en colonne.
    const grid = parseGrid('12345678.' + '........9' + '.'.repeat(63));
    expect(findSolution(grid)).toBeNull();
  });
});

describe('unicite', () => {
  it('reconnait une grille a solution unique', () => {
    expect(hasUniqueSolution(parseGrid(EASY))).toBe(true);
    expect(hasUniqueSolution(parseGrid(SEVENTEEN_CLUES))).toBe(true);
    expect(hasUniqueSolution(parseGrid(PLATINUM_BLONDE))).toBe(true);
    expect(countSolutions(parseGrid(EASY))).toBe(1);
  });

  it('reconnait un motif fatal a deux solutions', () => {
    expect(hasUniqueSolution(parseGrid(AMBIGUOUS))).toBe(false);
    // Plafond large et espace epuise : il y en a exactement deux, pas "au moins".
    const result = solve(parseGrid(AMBIGUOUS), { maxSolutions: 10 });
    expect(result.count).toBe(2);
    expect(result.exhausted).toBe(true);
  });

  it('rejette une grille vide comme non unique', () => {
    expect(hasUniqueSolution(createEmptyGrid())).toBe(false);
  });

  it('s arrete des la seconde solution au lieu de tout compter', () => {
    const result = solve(createEmptyGrid(), { maxSolutions: 2 });
    expect(result.count).toBe(2);
    // Une grille vide admet 6,67 x 10^21 solutions : si on n'avait pas coupe,
    // ce test ne se terminerait jamais.
    expect(result.exhausted).toBe(false);
  });
});

describe('randomisation', () => {
  it('produit des grilles completes differentes selon le seed', () => {
    const a = findSolution(createEmptyGrid(), { rng: createRng('seed-a') });
    const b = findSolution(createEmptyGrid(), { rng: createRng('seed-b') });
    expect(formatGrid(a!)).not.toBe(formatGrid(b!));
  });

  it('reste reproductible a seed egal', () => {
    const a = findSolution(createEmptyGrid(), { rng: createRng(7) });
    const b = findSolution(createEmptyGrid(), { rng: createRng(7) });
    expect(formatGrid(a!)).toBe(formatGrid(b!));
  });

  it('produit une grille complete valide quel que soit le seed', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const grid = findSolution(createEmptyGrid(), { rng: createRng(seed) });
        expect(grid).not.toBeNull();
        expect(isSolved(grid!)).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});

describe('invariants', () => {
  it('rend toujours une grille resolue qui respecte les indices de depart', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 20, max: 60 }), (seed, holes) => {
        const rng = createRng(seed);
        // On creuse une solution valide : la grille reste forcement soluble.
        const puzzle = parseGrid(EASY_SOLUTION);
        const cells = rng.shuffle(Array.from({ length: CELL_COUNT }, (_, i) => i));
        for (let i = 0; i < holes; i++) puzzle[cells[i]] = EMPTY;

        const solution = findSolution(puzzle);
        expect(solution).not.toBeNull();
        expect(isSolved(solution!)).toBe(true);
        expect(respectsClues(formatGrid(puzzle), formatGrid(solution!))).toBe(true);
      }),
      { numRuns: 40 },
    );
  });
});
