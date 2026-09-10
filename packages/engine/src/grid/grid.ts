import { BOX_OF, CELL_COUNT, COL_OF, PEERS, ROW_OF, SIZE, UNITS } from './constants.js';
import type { Digit } from './bitset.js';

/**
 * Une grille : 81 cellules, 0 pour vide, 1 à 9 pour une valeur posée.
 *
 * On garde volontairement un `Uint8Array` nu plutôt qu'un objet enveloppe :
 * c'est la structure que manipulent le solveur brut et le générateur des
 * millions de fois, et toute indirection s'y paierait. Les constructeurs de ce
 * module sont le seul point d'entrée — ils garantissent la taille.
 */
export type Grid = Uint8Array;

/** Cellule vide. */
export const EMPTY = 0;

export const createEmptyGrid = (): Grid => new Uint8Array(CELL_COUNT);

export const cloneGrid = (grid: Grid): Grid => new Uint8Array(grid);

export const countClues = (grid: Grid): number => {
  let n = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== EMPTY) n++;
  }
  return n;
};

export const isFilled = (grid: Grid): boolean => {
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] === EMPTY) return false;
  }
  return true;
};

/**
 * `true` si poser `digit` en `cell` ne heurte aucune valeur déjà présente.
 * Ne dit rien de la solvabilité de la grille résultante — seulement de la
 * légalité immédiate du coup.
 */
export const isValidPlacement = (grid: Grid, cell: number, digit: Digit): boolean => {
  const peers = PEERS[cell];
  for (let i = 0; i < peers.length; i++) {
    if (grid[peers[i]] === digit) return false;
  }
  return true;
};

/**
 * Cellules en conflit avec au moins une autre, triées.
 * C'est ce que l'UI surligne en rouge : on renvoie les DEUX côtés du conflit,
 * pas seulement le dernier coup joué — sinon l'utilisateur ne voit pas d'ou
 * vient le problème.
 */
export const findConflicts = (grid: Grid): number[] => {
  const conflicted = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const cell of unit.cells) {
      const value = grid[cell];
      if (value === EMPTY) continue;
      const previous = seen.get(value);
      if (previous === undefined) {
        seen.set(value, cell);
      } else {
        conflicted.add(previous);
        conflicted.add(cell);
      }
    }
  }
  return [...conflicted].sort((a, b) => a - b);
};

/** `true` si aucune valeur posée n'en heurte une autre (grille possiblement incomplète). */
export const isConsistent = (grid: Grid): boolean => {
  for (const unit of UNITS) {
    let seen = 0;
    for (const cell of unit.cells) {
      const value = grid[cell];
      if (value === EMPTY) continue;
      const bit = 1 << value;
      if ((seen & bit) !== 0) return false;
      seen |= bit;
    }
  }
  return true;
};

/** `true` si la grille est entièrement remplie et sans conflit. */
export const isSolved = (grid: Grid): boolean => isFilled(grid) && isConsistent(grid);

const EMPTY_CHARS = new Set(['.', '0', '*', '_']);
/**
 * Caractères de décoration tolérés dans une grille collée depuis un site tiers.
 *
 * Le tiret est ici et non dans EMPTY_CHARS : il sert bien plus souvent de
 * bordure ASCII que de case vide, et on ne peut pas avoir les deux. Une grille
 * qui noterait ses cases vides avec des tirets doit donc être normalisée en
 * amont — cas rare, contre un encadrement ASCII qui est la norme.
 */
const IGNORED_CHARS = new Set([' ', '\t', '\r', '\n', '|', '+', '/', '-']);

export class GridParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GridParseError';
  }
}

/**
 * Lit une grille depuis du texte.
 *
 * Tolérant à dessein : on accepte `.`, `0`, `-`, `*` et `_` pour une case vide,
 * et on ignore espaces, retours à la ligne et caractères de bordure. C'est ce
 * qui permet de coller une grille recopiée depuis à peu près n'importe quelle
 * source sans la nettoyer à la main.
 */
export const parseGrid = (text: string): Grid => {
  const grid = createEmptyGrid();
  let cell = 0;
  for (const char of text) {
    if (IGNORED_CHARS.has(char)) continue;
    if (cell >= CELL_COUNT) {
      throw new GridParseError(
        `Trop de cases : ${String(CELL_COUNT)} attendues, caractere surnumeraire "${char}".`,
      );
    }
    if (EMPTY_CHARS.has(char)) {
      grid[cell] = EMPTY;
    } else if (char >= '1' && char <= '9') {
      grid[cell] = char.charCodeAt(0) - 48;
    } else {
      throw new GridParseError(
        `Caractere invalide "${char}" a la case ${String(cell)} (ligne ${String(Math.floor(cell / SIZE) + 1)}, colonne ${String((cell % SIZE) + 1)}).`,
      );
    }
    cell++;
  }
  if (cell !== CELL_COUNT) {
    throw new GridParseError(`Grille incomplete : ${String(cell)} cases lues, ${String(CELL_COUNT)} attendues.`);
  }
  return grid;
};

/** Forme canonique sur une ligne : 81 caractères, `.` pour vide. */
export const formatGrid = (grid: Grid): string => {
  let out = '';
  for (let i = 0; i < CELL_COUNT; i++) {
    out += grid[i] === EMPTY ? '.' : String(grid[i]);
  }
  return out;
};

/** Rendu lisible en console, pour le debug et les messages de test. */
export const formatGridPretty = (grid: Grid): string => {
  const separator = '+-------+-------+-------+';
  const lines: string[] = [separator];
  for (let r = 0; r < SIZE; r++) {
    let line = '|';
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r * SIZE + c];
      line += ` ${value === EMPTY ? '.' : String(value)}`;
      if (c % 3 === 2) line += ' |';
    }
    lines.push(line);
    if (r % 3 === 2) lines.push(separator);
  }
  return lines.join('\n');
};

/** Coordonnées lisibles d'une cellule, convention r1c1 de la communauté sudoku. */
export const formatCell = (cell: number): string =>
  `r${String(ROW_OF[cell] + 1)}c${String(COL_OF[cell] + 1)}`;

export const cellCoordinates = (
  cell: number,
): { readonly row: number; readonly col: number; readonly box: number } => ({
  row: ROW_OF[cell],
  col: COL_OF[cell],
  box: BOX_OF[cell],
});
