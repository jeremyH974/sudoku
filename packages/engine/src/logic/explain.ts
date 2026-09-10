import { UNITS, digitsOf, formatCell } from '../grid/index.js';
import type { Digit, DigitMask } from '../grid/index.js';

/**
 * Fabrique des explications en français à partir des données d'une étape.
 *
 * Les phrases sont composées dans chaque technique, qui seule connaît son
 * raisonnement ; ce module ne fournit que les briques communes, pour que le ton
 * et les conventions de nommage restent identiques partout.
 *
 * Les cellules sont désignées en notation r1c1, celle qu'emploie la communauté
 * sudoku — un joueur qui cherchera ailleurs retrouvera ses repères.
 */

/** « la boîte 5 », « la ligne 3 », « la colonne 7 ». */
export function unitName(unitIndex: number): string {
  const unit = UNITS[unitIndex];
  const position = String(unit.position + 1);
  switch (unit.kind) {
    case 'row':
      return `la ligne ${position}`;
    case 'column':
      return `la colonne ${position}`;
    case 'box':
      return `la boîte ${position}`;
  }
}

/** Article défini contracté : « de la ligne 3 », « de la boîte 5 ». */
export function ofUnit(unitIndex: number): string {
  return `de ${unitName(unitIndex)}`;
}

/** Énumération française : « a », « a et b », « a, b et c ». */
export function enumerate(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** « r1c2 et r3c4 ». */
export function cellList(cells: readonly number[]): string {
  return enumerate(cells.map(formatCell));
}

/** « 3 et 7 ». */
export function digitList(digits: readonly Digit[]): string {
  return enumerate(digits.map(String));
}

/** « 3 et 7 », depuis un masque. */
export function maskList(mask: DigitMask): string {
  return digitList(digitsOf(mask));
}

/** « le chiffre 4 » ou « les chiffres 4 et 7 », selon le nombre. */
export function digitsPhrase(digits: readonly Digit[]): string {
  return digits.length === 1
    ? `le chiffre ${String(digits[0])}`
    : `les chiffres ${digitList(digits)}`;
}

/** « la case r1c2 » ou « les cases r1c2 et r3c4 », selon le nombre. */
export function cellsPhrase(cells: readonly number[]): string {
  return cells.length === 1 ? `la case ${formatCell(cells[0])}` : `les cases ${cellList(cells)}`;
}
