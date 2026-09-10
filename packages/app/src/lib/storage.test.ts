import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatGrid, generatePuzzle, rate } from '@sudoku/engine';
import { SAVE_VERSION, clearGame, loadGame, saveGame, toSnapshot } from './storage.js';
import type { GameSnapshot } from './storage.js';

/**
 * `localStorage` n'existe pas sous Node : on en pose une implémentation
 * minimale, ce qui permet aussi de simuler les cas qui cassent une application
 * en production — quota dépassé, navigation privée, données corrompues.
 */
class MemoryStorage {
  #data = new Map<string, string>();
  throwOnAccess = false;

  getItem(key: string): string | null {
    if (this.throwOnAccess) throw new Error('accès refusé');
    return this.#data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnAccess) throw new Error('quota dépassé');
    this.#data.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOnAccess) throw new Error('accès refusé');
    this.#data.delete(key);
  }

  /** Écrit directement, sans passer par les protections : pour corrompre. */
  poke(key: string, value: string): void {
    this.#data.set(key, value);
  }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('localStorage', store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeSnapshot(seed = 'sauvegarde'): GameSnapshot {
  const { puzzle, solution } = generatePuzzle({ seed, minClues: 34 });
  const values = Uint8Array.from(puzzle);
  values[values.indexOf(0)] = 7; // une saisie du joueur
  return toSnapshot({
    puzzle: [...puzzle],
    solution: [...solution],
    values: [...values],
    notes: Array.from({ length: 81 }, (_, i) => (i % 7 === 0 ? 0b101 : 0)),
    // Deux bits par chiffre : ici, le 1 marqué « A » et le 3 marqué « B ».
    noteColors: Array.from({ length: 81 }, (_, i) => (i % 7 === 0 ? 0b10_0001 : 0)),
    /*
      Un geste à trois cases : celle sur laquelle le joueur a agi, et deux
      voisines dont la note a été effacée. C'est le cas que l'ancienne forme ne
      savait pas porter.
    */
    history: [
      {
        cells: [
          { cell: 3, previousValue: 0, previousNotes: 0b11, previousNoteColors: 0b01 },
          { cell: 12, previousValue: 0, previousNotes: 0b1001, previousNoteColors: 0 },
          { cell: 21, previousValue: 0, previousNotes: 0b110, previousNoteColors: 0b1000 },
        ],
      },
    ],
    selected: 42,
    rating: rate(puzzle),
    seed,
    clues: 34,
    elapsedMs: 125_000,
    startedOn: '2026-09-10',
    daily: null,
    hintsShown: 2,
    hintsApplied: 1,
    mistakes: 3,
    noteMode: true,
  });
}

describe('aller-retour de sauvegarde', () => {
  it('restaure une partie identique à l’originale', () => {
    const snapshot = makeSnapshot();
    saveGame(snapshot);
    const restored = loadGame();

    expect(restored).not.toBeNull();
    expect(formatGrid(restored!.puzzle)).toBe(
      formatGrid(Uint8Array.from(loadGame()!.puzzle)),
    );
    expect(restored!.notes).toHaveLength(81);
    expect(restored!.selected).toBe(42);
    expect(restored!.clues).toBe(34);
    expect(restored!.history).toHaveLength(1);
    expect(restored!.history[0]).toEqual({
      cell: 3,
      previousValue: 0,
      previousNotes: 0b11,
      previousNoteColors: 0b01,
      others: [
        { cell: 12, previousValue: 0, previousNotes: 0b1001, previousNoteColors: 0 },
        { cell: 21, previousValue: 0, previousNotes: 0b110, previousNoteColors: 0b1000 },
      ],
    });
  });

  it('conserve les saisies du joueur, distinctes de la grille de départ', () => {
    const snapshot = makeSnapshot();
    saveGame(snapshot);
    const restored = loadGame()!;
    // Les valeurs contiennent une case de plus que les indices de départ.
    const filled = (grid: Uint8Array): number => [...grid].filter((v) => v !== 0).length;
    expect(filled(restored.values)).toBe(filled(restored.puzzle) + 1);
  });

  it('conserve les notes case par case', () => {
    const snapshot = makeSnapshot();
    saveGame(snapshot);
    const restored = loadGame()!;
    expect(restored.notes[0]).toBe(0b101);
    expect(restored.notes[1]).toBe(0);
    expect(restored.notes[7]).toBe(0b101);
  });

  it('conserve les marques des candidats', () => {
    const snapshot = makeSnapshot();
    saveGame(snapshot);
    const restored = loadGame()!;
    expect(restored.noteColors).toHaveLength(81);
    expect(restored.noteColors[0]).toBe(0b10_0001);
    expect(restored.noteColors[1]).toBe(0);
  });

  it('relit une sauvegarde écrite avant que les marques existent', () => {
    /*
      Le cœur de la doctrine « on migre par ajout » : la sauvegarde d'un joueur
      qui met l'application à jour n'a pas de marques, et elle doit se rouvrir
      intacte. Un bump de `SAVE_VERSION` l'aurait purement et simplement jetée —
      c'est-à-dire effacé sa partie en cours au moment de la mise à jour.
    */
    const { noteColors, history, ...ancienne } = makeSnapshot();
    void noteColors;
    saveGame({
      ...ancienne,
      // Un coup d'avant l'incrément 8 **et** d'avant l'incrément 9 : une seule
      // case, sans marques et sans `others`.
      history: history.map(({ previousNoteColors, others, ...move }) => {
        void previousNoteColors;
        void others;
        return move;
      }),
    });

    const restored = loadGame();
    expect(restored).not.toBeNull();
    expect(restored!.noteColors).toHaveLength(81);
    expect(restored!.noteColors.every((c) => c === 0)).toBe(true);
    expect(restored!.history).toHaveLength(1);
  });

  it('rend null quand rien n’a été sauvegardé', () => {
    expect(loadGame()).toBeNull();
  });

  it('oublie la partie sur demande', () => {
    saveGame(makeSnapshot());
    expect(loadGame()).not.toBeNull();
    clearGame();
    expect(loadGame()).toBeNull();
  });
});

describe('robustesse', () => {
  /**
   * Le groupe qui compte : une sauvegarde abîmée ne doit jamais empêcher
   * l'application de démarrer. Repartir sur une partie neuve est désagréable ;
   * un écran blanc l'est infiniment plus.
   */
  it('ignore une sauvegarde d’une autre version du format', () => {
    const snapshot = makeSnapshot();
    saveGame(snapshot);
    const raw = JSON.parse(localStorage.getItem('sudoku.game')!) as Record<string, unknown>;
    store.poke('sudoku.game', JSON.stringify({ ...raw, version: SAVE_VERSION + 1 }));
    expect(loadGame()).toBeNull();
  });

  it('ignore un JSON invalide', () => {
    store.poke('sudoku.game', '{ceci n’est pas du JSON');
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });

  it('ignore une sauvegarde aux champs manquants', () => {
    store.poke('sudoku.game', JSON.stringify({ version: SAVE_VERSION, puzzle: 'abc' }));
    expect(loadGame()).toBeNull();
  });

  it('ignore un code de grille corrompu', () => {
    const raw = JSON.parse(
      (saveGame(makeSnapshot()), localStorage.getItem('sudoku.game')!),
    ) as Record<string, unknown>;
    store.poke('sudoku.game', JSON.stringify({ ...raw, puzzle: '!!!invalide!!!' }));
    expect(loadGame()).toBeNull();
  });

  it('ignore des notes de taille incorrecte', () => {
    const raw = JSON.parse(
      (saveGame(makeSnapshot()), localStorage.getItem('sudoku.game')!),
    ) as Record<string, unknown>;
    store.poke('sudoku.game', JSON.stringify({ ...raw, notes: [1, 2, 3] }));
    expect(loadGame()).toBeNull();
  });

  it('écarte les coups d’historique malformés sans tout perdre', () => {
    const raw = JSON.parse(
      (saveGame(makeSnapshot()), localStorage.getItem('sudoku.game')!),
    ) as Record<string, unknown>;
    store.poke(
      'sudoku.game',
      JSON.stringify({ ...raw, history: [{ cell: 3, previousValue: 0, previousNotes: 0 }, null, 42] }),
    );
    const restored = loadGame();
    expect(restored).not.toBeNull();
    expect(restored!.history).toHaveLength(1);
  });
});

describe('stockage indisponible', () => {
  /**
   * En navigation privée, ou données de site bloquées, le simple fait de lire
   * `localStorage` lève. Perdre la persistance est acceptable ; planter ne
   * l'est pas.
   */
  it('ne lève jamais quand le stockage refuse tout', () => {
    store.throwOnAccess = true;
    expect(() => saveGame(makeSnapshot())).not.toThrow();
    expect(() => loadGame()).not.toThrow();
    expect(() => clearGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });

  it('ne lève pas non plus quand localStorage est absent', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => loadGame()).not.toThrow();
    expect(() => saveGame(makeSnapshot())).not.toThrow();
  });
});
