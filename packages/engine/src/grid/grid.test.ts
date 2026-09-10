import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CELL_COUNT,
  EMPTY,
  GridParseError,
  cloneGrid,
  countClues,
  createEmptyGrid,
  findConflicts,
  formatCell,
  formatGrid,
  formatGridPretty,
  isConsistent,
  isFilled,
  isSolved,
  isValidPlacement,
  parseGrid,
} from './index.js';

const SOLVED = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const PUZZLE = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';

const arbGridText = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: CELL_COUNT, maxLength: CELL_COUNT })
  .map((values) => values.map((v) => (v === 0 ? '.' : String(v))).join(''));

describe('parseGrid / formatGrid', () => {
  it('fait un aller-retour sans perte', () => {
    fc.assert(
      fc.property(arbGridText, (text) => {
        expect(formatGrid(parseGrid(text))).toBe(text);
      }),
    );
  });

  it('accepte les differentes conventions de case vide', () => {
    const canonical = formatGrid(parseGrid(PUZZLE));
    for (const emptyChar of ['0', '*', '_']) {
      expect(formatGrid(parseGrid(PUZZLE.replaceAll('.', emptyChar)))).toBe(canonical);
    }
  });

  it('ignore la mise en forme d une grille collee depuis un site tiers', () => {
    const decorated = formatGridPretty(parseGrid(PUZZLE));
    expect(formatGrid(parseGrid(decorated))).toBe(PUZZLE);
  });

  it('traite le tiret comme une bordure, pas comme une case vide', () => {
    expect(formatGrid(parseGrid('+---+ ' + PUZZLE + ' +---+'))).toBe(PUZZLE);
  });

  it('signale une grille trop courte', () => {
    expect(() => parseGrid('123')).toThrow(GridParseError);
    expect(() => parseGrid('123')).toThrow(/incomplete/i);
  });

  it('signale une grille trop longue', () => {
    expect(() => parseGrid(SOLVED + '1')).toThrow(/surnumeraire/i);
  });

  it('situe un caractere invalide en ligne et colonne', () => {
    expect(() => parseGrid('5X' + '.'.repeat(79))).toThrow(/ligne 1, colonne 2/);
  });
});

describe('etat d une grille', () => {
  it('compte les indices', () => {
    expect(countClues(createEmptyGrid())).toBe(0);
    expect(countClues(parseGrid(SOLVED))).toBe(CELL_COUNT);
    expect(countClues(parseGrid(PUZZLE))).toBe(PUZZLE.replaceAll('.', '').length);
  });

  it('distingue remplie, coherente et resolue', () => {
    const solved = parseGrid(SOLVED);
    expect(isFilled(solved)).toBe(true);
    expect(isConsistent(solved)).toBe(true);
    expect(isSolved(solved)).toBe(true);

    const partial = parseGrid(PUZZLE);
    expect(isFilled(partial)).toBe(false);
    expect(isConsistent(partial)).toBe(true);
    expect(isSolved(partial)).toBe(false);
  });

  it('detecte une grille remplie mais incoherente', () => {
    const broken = parseGrid(SOLVED);
    broken[1] = broken[0];
    expect(isFilled(broken)).toBe(true);
    expect(isConsistent(broken)).toBe(false);
    expect(isSolved(broken)).toBe(false);
  });
});

describe('findConflicts', () => {
  it('ne rapporte rien sur une grille valide', () => {
    expect(findConflicts(parseGrid(SOLVED))).toEqual([]);
    expect(findConflicts(parseGrid(PUZZLE))).toEqual([]);
  });

  it('rapporte les DEUX cellules en cause, pas seulement la derniere posee', () => {
    const grid = createEmptyGrid();
    grid[0] = 5;
    grid[4] = 5; // meme ligne
    expect(findConflicts(grid)).toEqual([0, 4]);
  });

  it('detecte un conflit de boite entre deux lignes differentes', () => {
    const grid = createEmptyGrid();
    grid[0] = 7;
    grid[10] = 7; // r2c2, meme boite
    expect(findConflicts(grid)).toEqual([0, 10]);
  });

  it('reste vide exactement quand la grille est coherente', () => {
    fc.assert(
      fc.property(arbGridText, (text) => {
        const grid = parseGrid(text);
        expect(findConflicts(grid).length === 0).toBe(isConsistent(grid));
      }),
    );
  });
});

describe('isValidPlacement', () => {
  it('refuse un chiffre deja present chez un pair', () => {
    const grid = parseGrid(PUZZLE);
    expect(isValidPlacement(grid, 2, 5)).toBe(false); // 5 deja en r1c1
    expect(isValidPlacement(grid, 2, 4)).toBe(true);
  });

  it('accepte tous les chiffres sur une grille vide', () => {
    const grid = createEmptyGrid();
    for (let d = 1; d <= 9; d++) expect(isValidPlacement(grid, 40, d)).toBe(true);
  });
});

describe('utilitaires', () => {
  it('clone sans partager la memoire', () => {
    const original = parseGrid(PUZZLE);
    const copy = cloneGrid(original);
    copy[0] = EMPTY;
    expect(original[0]).not.toBe(EMPTY);
  });

  it('nomme les cellules selon la convention r1c1', () => {
    expect(formatCell(0)).toBe('r1c1');
    expect(formatCell(80)).toBe('r9c9');
    expect(formatCell(9)).toBe('r2c1');
  });
});
