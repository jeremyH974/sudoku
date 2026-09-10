import { beforeEach, describe, expect, it } from 'vitest';
import { CELL_COUNT, EMPTY, countSolutions, hasDigit, indexOf, parseGrid } from '@sudoku/engine';
import { Game } from './game.svelte.js';

const firstEmpty = (game: Game): number => game.puzzle.findIndex((v) => v === EMPTY);
const firstGiven = (game: Game): number => game.puzzle.findIndex((v) => v !== EMPTY);

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
    game.newPuzzle({ seed: 'partie-de-test' });
  });

  it('demarre sur une grille a solution unique', () => {
    expect(countSolutions(Uint8Array.from(game.puzzle), 2)).toBe(1);
    expect(game.clues).toBeGreaterThan(0);
    expect(game.clues).toBeLessThan(CELL_COUNT);
  });

  it('selectionne d emblee une case modifiable', () => {
    expect(game.isGiven(game.selected)).toBe(false);
  });

  it('refuse de modifier un indice de depart', () => {
    const given = firstGiven(game);
    const before = game.values[given];
    game.select(given);
    game.enter(5);
    game.clear();
    expect(game.values[given]).toBe(before);
    expect(game.canUndo).toBe(false);
  });

  it('saisit un chiffre dans une case libre', () => {
    const cell = firstEmpty(game);
    game.select(cell);
    game.enter(7);
    expect(game.values[cell]).toBe(7);
  });

  it('efface en resaisissant le meme chiffre', () => {
    const cell = firstEmpty(game);
    game.select(cell);
    game.enter(7);
    game.enter(7);
    expect(game.values[cell]).toBe(EMPTY);
  });

  describe('notes', () => {
    it('ajoute et retire une note sans toucher a la valeur', () => {
      const cell = firstEmpty(game);
      game.select(cell);
      game.toggleNoteMode();
      game.enter(4);
      game.enter(9);
      expect(game.notesOf(cell)).toEqual([4, 9]);
      expect(game.values[cell]).toBe(EMPTY);
      game.enter(4);
      expect(game.notesOf(cell)).toEqual([9]);
    });

    it('retire le chiffre pose des notes des cellules voisines', () => {
      const cell = indexOf(0, 0);
      const peer = indexOf(0, 1);
      const outsider = indexOf(4, 4);
      if (game.isGiven(cell) || game.isGiven(peer)) return;

      game.select(peer);
      game.toggleNoteMode();
      game.enter(6);
      game.select(outsider);
      game.enter(6);
      game.toggleNoteMode();

      game.select(cell);
      game.enter(6);

      expect(hasDigit(game.notes[peer]!, 6)).toBe(false);
      // Une cellule hors de toute unite commune conserve sa note.
      expect(hasDigit(game.notes[outsider]!, 6)).toBe(true);
    });
  });

  describe('annulation', () => {
    it('est illimitee et remonte tout l historique', () => {
      const cells = game.puzzle
        .map((v, i) => (v === EMPTY ? i : -1))
        .filter((i) => i >= 0)
        .slice(0, 12);
      for (const cell of cells) {
        game.select(cell);
        game.enter(3);
      }
      expect(game.history).toHaveLength(12);
      while (game.canUndo) game.undo();
      for (const cell of cells) expect(game.values[cell]).toBe(EMPTY);
    });

    it('restaure les notes, pas seulement la valeur', () => {
      const cell = firstEmpty(game);
      game.select(cell);
      game.toggleNoteMode();
      game.enter(2);
      game.enter(5);
      game.toggleNoteMode();

      game.enter(8); // poser une valeur efface les notes
      expect(game.notesOf(cell)).toEqual([]);

      game.undo();
      // Sans restauration des notes, annuler detruirait silencieusement le
      // raisonnement qui precedait la saisie.
      expect(game.notesOf(cell)).toEqual([2, 5]);
      expect(game.values[cell]).toBe(EMPTY);
    });

    it('ne fait rien quand l historique est vide', () => {
      expect(game.canUndo).toBe(false);
      expect(() => game.undo()).not.toThrow();
    });
  });

  describe('conflits', () => {
    it('signale les deux cases en cause, sans bloquer la saisie', () => {
      const given = firstGiven(game);
      const value = game.values[given]!;
      const row = Math.floor(given / 9);
      const target = game.values
        .map((v, i) => (v === EMPTY && Math.floor(i / 9) === row ? i : -1))
        .find((i) => i >= 0);
      if (target === undefined) return;

      game.select(target);
      game.enter(value);
      expect(game.conflicts.has(target)).toBe(true);
      expect(game.conflicts.has(given)).toBe(true);
      // La saisie fautive reste en place : aucune limite d'erreurs.
      expect(game.values[target]).toBe(value);
    });
  });

  describe('fin de partie', () => {
    it('detecte la grille terminee sans erreur', () => {
      for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (game.puzzle[cell] !== EMPTY) continue;
        game.select(cell);
        game.enter(game.solution[cell]!);
      }
      expect(game.isComplete).toBe(true);
      expect(game.conflicts.size).toBe(0);
      expect(game.filledCount).toBe(CELL_COUNT);
    });

    it('ne se declare pas terminee si une case est fausse', () => {
      for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (game.puzzle[cell] !== EMPTY) continue;
        game.select(cell);
        game.enter(game.solution[cell]!);
      }
      const last = game.puzzle.findLastIndex((v) => v === EMPTY);
      game.select(last);
      game.enter(game.solution[last] === 9 ? 1 : 9);
      expect(game.isComplete).toBe(false);
    });
  });

  it('rend la grille en cours sous forme canonique', () => {
    expect(() => parseGrid(game.toString())).not.toThrow();
    expect(game.toString()).toHaveLength(CELL_COUNT);
  });

  it('est reproductible a seed egal', () => {
    const other = new Game();
    other.newPuzzle({ seed: 'partie-de-test' });
    expect(other.toString()).toBe(game.toString());
  });
});
