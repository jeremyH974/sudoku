import {
  ALL_DIGITS,
  CELL_COUNT,
  EMPTY,
  PEERS,
  PEER_COUNT,
  UNITS,
  hasDigit,
  maskOf,
  withoutDigit,
} from '../grid/index.js';
import type { Digit, DigitMask, Grid } from '../grid/index.js';
import type { LogicStateView } from './types.js';

/**
 * État de résolution manipulé par le solveur logique.
 *
 * ─── Le point critique de tout cet incrément ───────────────────────────────
 *
 * Cet état ne propage **rien** automatiquement, à une seule exception près :
 * poser une valeur la retire des candidats des vingt cellules qui voient la
 * case. C'est la règle du jeu, pas une technique.
 *
 * En particulier, il ne pose pas les singles cachés en cascade — contrairement
 * au solveur brut de `solver/solver.ts`, qui le fait pour aller vite. Réutiliser
 * cette propagation ici résoudrait des cases sans jamais créditer la technique
 * qui les justifie : la note serait sous-évaluée et les indices raconteraient
 * n'importe quoi. Tout ce qui n'est pas la règle du jeu doit être attribué à une
 * technique nommée.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Invariant : une cellule résolue a `values[cell] != 0` et `candidates[cell] == 0`.
 * Les techniques ne regardent donc que les cellules dont le masque est non nul.
 */
export class LogicState implements LogicStateView {
  private readonly values: Uint8Array;
  private readonly candidates: Uint16Array;

  private constructor(values: Uint8Array, candidates: Uint16Array) {
    this.values = values;
    this.candidates = candidates;
  }

  /**
   * Construit l'état depuis une grille.
   * Renvoie `null` si les indices se contredisent, ou si une cellule vide se
   * retrouve sans aucun candidat — dans les deux cas la grille est insoluble et
   * il n'y a rien à noter.
   */
  static fromGrid(grid: Grid): LogicState | null {
    const values = new Uint8Array(CELL_COUNT);
    const candidates = new Uint16Array(CELL_COUNT).fill(ALL_DIGITS);
    const state = new LogicState(values, candidates);

    for (let cell = 0; cell < CELL_COUNT; cell++) {
      const digit = grid[cell];
      if (digit === EMPTY) continue;
      if (!hasDigit(candidates[cell], digit)) return null;
      state.place(cell, digit);
    }

    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (values[cell] === EMPTY && candidates[cell] === 0) return null;
    }
    return state;
  }

  /**
   * Pose une valeur et la retire des candidats des pairs.
   * Aucune autre déduction n'est faite — voir la note en tête de classe.
   */
  place(cell: number, digit: Digit): void {
    this.values[cell] = digit;
    this.candidates[cell] = 0;
    const peers = PEERS[cell];
    for (let i = 0; i < PEER_COUNT; i++) {
      this.candidates[peers[i]] &= ~maskOf(digit);
    }
  }

  /** Écarte un candidat. Renvoie `true` s'il était bien présent. */
  eliminate(cell: number, digit: Digit): boolean {
    const before = this.candidates[cell];
    const after = withoutDigit(before, digit);
    this.candidates[cell] = after;
    return before !== after;
  }

  valueAt(cell: number): number {
    return this.values[cell];
  }

  candidatesAt(cell: number): DigitMask {
    return this.candidates[cell];
  }

  isEmpty(cell: number): boolean {
    return this.values[cell] === EMPTY;
  }

  placesFor(unitIndex: number, digit: Digit): number[] {
    const mask = maskOf(digit);
    const found: number[] = [];
    for (const cell of UNITS[unitIndex].cells) {
      if ((this.candidates[cell] & mask) !== 0) found.push(cell);
    }
    return found;
  }

  emptyCellsOf(unitIndex: number): number[] {
    const found: number[] = [];
    for (const cell of UNITS[unitIndex].cells) {
      if (this.values[cell] === EMPTY) found.push(cell);
    }
    return found;
  }

  /** `true` si toutes les cellules ont une valeur. */
  isSolved(): boolean {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (this.values[cell] === EMPTY) return false;
    }
    return true;
  }

  /**
   * `true` si une cellule vide n'a plus aucun candidat. Signale soit une grille
   * insoluble, soit un bug dans une technique — d'où la vérification à chaque
   * tour de la boucle de résolution.
   */
  hasContradiction(): boolean {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (this.values[cell] === EMPTY && this.candidates[cell] === 0) return true;
    }
    return false;
  }

  /** Instantané des candidats, pour l'affichage du chemin de résolution. */
  candidatesSnapshot(): Uint16Array {
    return new Uint16Array(this.candidates);
  }

  /** Copie indépendante, pour explorer sans altérer l'original. */
  clone(): LogicState {
    return new LogicState(new Uint8Array(this.values), new Uint16Array(this.candidates));
  }

  /** Grille correspondant à l'état courant. */
  toGrid(): Grid {
    return new Uint8Array(this.values);
  }
}
