import {
  ALL_DIGITS,
  CELL_COUNT,
  EMPTY,
  PEERS,
  PEER_COUNT,
  SIZE,
  UNITS,
  UNITS_OF_CELL,
  countDigits,
  digitsOf,
} from '../grid/index.js';
import type { Digit, Grid } from '../grid/index.js';
import type { Rng } from '../rng/index.js';

/**
 * Solveur brut : propagation de contraintes + backtracking guide par MRV.
 *
 * Son role n'est PAS de mesurer la difficulte — un solveur machine trouve les
 * grilles d'autant plus faciles qu'elles sont contraintes, c'est-a-dire
 * l'inverse du ressenti humain. Il sert a deux choses :
 *   - verifier l'unicite de la solution (le garde-fou de toute grille publiee) ;
 *   - servir d'oracle de verite aux tests du solveur logique.
 *
 * La difficulte humaine est calculee ailleurs, par le solveur logique.
 */

/** Candidats restants par cellule, sous forme de masque de 9 bits. */
type Candidates = Uint16Array;

export interface SolveOptions {
  /** Nombre de solutions a collecter avant de s'arreter. 1 par defaut. */
  readonly maxSolutions?: number;
  /**
   * Randomise l'ordre d'essai des chiffres. Indispensable au generateur :
   * sans lui, toutes les grilles completes produites seraient identiques.
   */
  readonly rng?: Rng;
}

export interface SolveResult {
  readonly solutions: readonly Grid[];
  /** Nombre de solutions trouvees, plafonne par `maxSolutions`. */
  readonly count: number;
  /**
   * `true` si l'espace de recherche a ete parcouru entierement — donc si
   * `count` est le nombre total de solutions et non un decompte tronque.
   */
  readonly exhausted: boolean;
  /** Nombre d'hypotheses posees. Proxy du cout machine, utile aux benchs. */
  readonly guesses: number;
}

const bitOf = (digit: Digit): number => 1 << (digit - 1);

/**
 * Retire `digit` des candidats de `cell` et propage les consequences.
 * Renvoie `false` des qu'une contradiction apparait.
 */
function eliminate(cands: Candidates, cell: number, digit: Digit): boolean {
  const bit = bitOf(digit);
  if ((cands[cell] & bit) === 0) return true;

  const remaining = (cands[cell] &= ~bit);
  if (remaining === 0) return false;

  // (1) La cellule n'a plus qu'un candidat : il est interdit a tous ses pairs.
  if ((remaining & (remaining - 1)) === 0) {
    const only = 32 - Math.clz32(remaining);
    const peers = PEERS[cell];
    for (let i = 0; i < PEER_COUNT; i++) {
      if (!eliminate(cands, peers[i], only)) return false;
    }
  }

  // (2) Le chiffre retire n'a peut-etre plus qu'une place dans l'une des
  //     unites de la cellule : c'est alors un single cache, a poser tout de suite.
  const unitIndexes = UNITS_OF_CELL[cell];
  for (let u = 0; u < unitIndexes.length; u++) {
    const cells = UNITS[unitIndexes[u]].cells;
    let places = 0;
    let lastPlace = -1;
    for (let i = 0; i < SIZE; i++) {
      if ((cands[cells[i]] & bit) !== 0) {
        places++;
        lastPlace = cells[i];
      }
    }
    if (places === 0) return false;
    if (places === 1 && cands[lastPlace] !== bit) {
      if (!assign(cands, lastPlace, digit)) return false;
    }
  }

  return true;
}

/** Fixe `digit` en `cell` en eliminant tous les autres candidats de la cellule. */
function assign(cands: Candidates, cell: number, digit: Digit): boolean {
  const bit = bitOf(digit);
  if ((cands[cell] & bit) === 0) return false;

  let others = cands[cell] & ~bit;
  while (others !== 0) {
    const low = others & -others;
    others ^= low;
    if (!eliminate(cands, cell, 32 - Math.clz32(low))) return false;
  }
  return true;
}

/**
 * Prepare les candidats a partir d'une grille. `null` si les indices donnes
 * sont deja contradictoires entre eux.
 */
function initCandidates(puzzle: Grid): Candidates | null {
  const cands = new Uint16Array(CELL_COUNT).fill(ALL_DIGITS);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const value = puzzle[cell];
    if (value !== EMPTY && !assign(cands, cell, value)) return null;
  }
  return cands;
}

const toGrid = (cands: Candidates): Grid => {
  const grid = new Uint8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) grid[cell] = 32 - Math.clz32(cands[cell]);
  return grid;
};

interface SearchContext {
  readonly solutions: Grid[];
  readonly maxSolutions: number;
  readonly rng: Rng | undefined;
  guesses: number;
}

/** Renvoie `true` quand il faut arreter : le quota de solutions est atteint. */
function search(cands: Candidates, ctx: SearchContext): boolean {
  // MRV : on branche sur la cellule la plus contrainte. Deux candidats est le
  // minimum possible pour une cellule non resolue, inutile de chercher mieux.
  let target = -1;
  let fewest = SIZE + 1;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const n = countDigits(cands[cell]);
    if (n > 1 && n < fewest) {
      fewest = n;
      target = cell;
      if (n === 2) break;
    }
  }

  if (target === -1) {
    ctx.solutions.push(toGrid(cands));
    return ctx.solutions.length >= ctx.maxSolutions;
  }

  const digits = digitsOf(cands[target]);
  if (ctx.rng !== undefined) ctx.rng.shuffle(digits);

  for (const digit of digits) {
    ctx.guesses++;
    const branch = new Uint16Array(cands);
    if (assign(branch, target, digit) && search(branch, ctx)) return true;
  }
  return false;
}

export function solve(puzzle: Grid, options: SolveOptions = {}): SolveResult {
  const maxSolutions = options.maxSolutions ?? 1;
  if (!Number.isInteger(maxSolutions) || maxSolutions < 1) {
    throw new RangeError(`maxSolutions attend un entier >= 1, recu ${String(maxSolutions)}`);
  }

  const cands = initCandidates(puzzle);
  if (cands === null) {
    return { solutions: [], count: 0, exhausted: true, guesses: 0 };
  }

  const ctx: SearchContext = { solutions: [], maxSolutions, rng: options.rng, guesses: 0 };
  const stoppedEarly = search(cands, ctx);

  return {
    solutions: ctx.solutions,
    count: ctx.solutions.length,
    exhausted: !stoppedEarly,
    guesses: ctx.guesses,
  };
}

/** Premiere solution trouvee, ou `null` si la grille n'en admet aucune. */
export function findSolution(puzzle: Grid, options: Omit<SolveOptions, 'maxSolutions'> = {}): Grid | null {
  const result = solve(puzzle, { ...options, maxSolutions: 1 });
  return result.solutions[0] ?? null;
}

/**
 * Nombre de solutions, plafonne a `cap`. Le plafond n'est pas une optimisation
 * accessoire : verifier l'unicite demande seulement de savoir s'il en existe
 * une seconde, et compter au-dela est du calcul jete.
 */
export function countSolutions(puzzle: Grid, cap = 2): number {
  return solve(puzzle, { maxSolutions: cap }).count;
}

/** Le garde-fou : aucune grille ne doit etre publiee sans passer par la. */
export function hasUniqueSolution(puzzle: Grid): boolean {
  return countSolutions(puzzle, 2) === 1;
}
