import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePuzzle, rate } from '@sudoku/engine';
import type { LeveledPuzzle } from '@sudoku/engine';
import { Game } from './game.svelte.js';
import SudokuBoard from './SudokuBoard.svelte';
import { ASSIST_OPTIONS, assists } from './assists.svelte.js';
import { render, resetDocument } from '../test/render.js';
import type { Rendered } from '../test/render.js';

/*
  Deux choses se vérifient ici : que la préférence se lit et s'écrit comme les
  autres — stockage sous `try`, défaut jamais écrit —, et qu'une aide éteinte
  disparaît vraiment de la grille, à l'écran **et** dans le libellé lu à voix
  haute, sans que la partie cesse de savoir ce qu'elle sait.
*/

/** Le module tient un état de session : on le recharge pour relire le stockage. */
async function freshStore(): Promise<typeof import('./assists.svelte.js')> {
  vi.resetModules();
  return await import('./assists.svelte.js');
}

function makeGame(seed: string): Game {
  const generated = generatePuzzle({ seed, minClues: 34 });
  const rating = rate(generated.puzzle);
  const puzzle: LeveledPuzzle = {
    ...generated,
    level: rating.level ?? 'facile',
    rating,
    exact: true,
  };
  const game = new Game();
  game.loadPuzzle(puzzle);
  return game;
}

/** Une case vide et un chiffre donné de la même ligne : de quoi créer un conflit. */
function conflictIn(game: Game): { typed: number; given: number; digit: number } {
  for (let row = 0; row < 9; row++) {
    const cells = Array.from({ length: 9 }, (_, col) => row * 9 + col);
    const given = cells.find((cell) => game.isGiven(cell));
    const typed = cells.find((cell) => game.values[cell] === 0);
    if (given !== undefined && typed !== undefined) {
      return { typed, given, digit: game.values[given] };
    }
  }
  throw new Error('Aucune ligne ne porte à la fois un chiffre donné et une case vide.');
}

/** Un chiffre donné présent au moins deux fois : de quoi voir un surlignage. */
function repeatedGiven(game: Game): number {
  for (let cell = 0; cell < 81; cell++) {
    const digit = game.values[cell];
    if (!game.isGiven(cell)) continue;
    if (game.values.some((other, index) => index !== cell && other === digit)) return cell;
  }
  throw new Error('Aucun chiffre donné ne se répète.');
}

function cellAt(current: Rendered, index: number): Element {
  const cell = current.container.querySelectorAll('[role="gridcell"]').item(index);
  if (cell === null) throw new Error(`Case ${String(index)} introuvable.`);
  return cell;
}

let view: Rendered | null = null;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
  for (const { id } of ASSIST_OPTIONS) assists.set(id, true);
  localStorage.clear();
});

describe('préférence des aides', () => {
  it('démarre avec toutes les aides activées, sans rien écrire', async () => {
    const fresh = await freshStore();
    expect(fresh.assists.enabledCount).toBe(ASSIST_OPTIONS.length);
    expect(localStorage.getItem('sudoku.assists')).toBeNull();
  });

  it('retrouve une aide éteinte au chargement suivant', async () => {
    const first = await freshStore();
    first.assists.set('conflicts', false);

    const second = await freshStore();
    expect(second.assists.conflicts).toBe(false);
    expect(second.assists.peers).toBe(true);
  });

  it('efface le stockage quand toutes les aides reviennent', async () => {
    // Même règle que « système » pour le thème : l'état par défaut est une absence.
    const fresh = await freshStore();
    fresh.assists.set('peers', false);
    fresh.assists.set('peers', true);
    expect(localStorage.getItem('sudoku.assists')).toBeNull();
  });

  it('n’éteint rien sur la foi d’une préférence illisible', async () => {
    localStorage.setItem('sudoku.assists', '{"conflicts": "non", "peers": false}');
    const typed = await freshStore();
    // Un booléen valide est respecté ; une valeur d'un autre type retombe sur « activée ».
    expect(typed.assists.peers).toBe(false);
    expect(typed.assists.conflicts).toBe(true);

    localStorage.setItem('sudoku.assists', '{pas du json');
    const broken = await freshStore();
    expect(broken.assists.enabledCount).toBe(ASSIST_OPTIONS.length);
  });
});

describe('aides éteintes sur la grille', () => {
  it('retire le conflit de l’écran et du libellé, sans le retirer de la partie', () => {
    const game = makeGame('aides-conflit');
    const { typed, given, digit } = conflictIn(game);
    view = render(SudokuBoard, { game });
    game.select(typed);
    game.enter(digit);
    view.flush();

    expect(cellAt(view, given).classList.contains('conflict')).toBe(true);
    expect(cellAt(view, typed).getAttribute('aria-label')).toContain('en conflit');

    assists.set('conflicts', false);
    view.flush();

    expect(view.container.querySelectorAll('.conflict')).toHaveLength(0);
    expect(cellAt(view, typed).getAttribute('aria-label')).not.toContain('en conflit');
    // La partie sait toujours : c'est ce qui l'empêche de se déclarer terminée.
    expect(game.conflicts.has(typed)).toBe(true);
  });

  it('éteint le surlignage des chiffres identiques', () => {
    const game = makeGame('aides-identiques');
    view = render(SudokuBoard, { game });
    game.select(repeatedGiven(game));
    view.flush();
    expect(view.container.querySelectorAll('.same-value').length).toBeGreaterThan(0);

    assists.set('sameValue', false);
    view.flush();
    expect(view.container.querySelectorAll('.same-value')).toHaveLength(0);
  });

  it('éteint le surlignage de la ligne, de la colonne et du bloc', () => {
    const game = makeGame('aides-voisines');
    view = render(SudokuBoard, { game });
    game.select(40);
    view.flush();
    // Vingt voisines : huit dans la ligne, huit dans la colonne, quatre de plus dans le bloc.
    expect(view.container.querySelectorAll('.peer')).toHaveLength(20);

    assists.set('peers', false);
    view.flush();
    expect(view.container.querySelectorAll('.peer')).toHaveLength(0);
  });
});
