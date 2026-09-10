import { afterEach, describe, expect, it } from 'vitest';
import { generatePuzzle, rate } from '@sudoku/engine';
import type { LeveledPuzzle } from '@sudoku/engine';
import { Game } from './game.svelte.js';
import SudokuBoard from './SudokuBoard.svelte';
import { expectNoViolations } from '../test/axe.js';
import { render, resetDocument } from '../test/render.js';
import type { Rendered } from '../test/render.js';

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

let view: Rendered | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

/*
  `region` est écartée ici, et seulement ici : elle exige que tout contenu vive
  dans un repère de page, ce qu'un composant monté seul ne peut pas satisfaire.
  Le test de l'application entière, lui, la garde active — c'est là qu'elle a un
  sens.
*/
const COMPONENT_RULES = { rules: { region: { enabled: false } } };

describe('accessibilité de la grille', () => {
  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(SudokuBoard, { game: makeGame('a11y-grille') });
    await expectNoViolations(view.container, COMPONENT_RULES);
  });

  it('donne un nom à chacune des 81 cases', () => {
    view = render(SudokuBoard, { game: makeGame('a11y-noms') });
    const cells = view.container.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(81);
    for (const cell of cells) {
      // Le nom est le seul porteur qui ne se dégrade jamais : ni à 8 px, ni en
      // noir et blanc, ni pour un daltonien.
      expect(cell.getAttribute('aria-label')?.trim()).toBeTruthy();
    }
  });

  it('annonce ses dimensions, et neuf rangées de neuf', () => {
    view = render(SudokuBoard, { game: makeGame('a11y-dimensions') });
    const grid = view.container.querySelector('[role="grid"]')!;
    expect(grid.getAttribute('aria-rowcount')).toBe('9');
    expect(grid.getAttribute('aria-colcount')).toBe('9');

    const rows = grid.querySelectorAll('[role="row"]');
    expect(rows).toHaveLength(9);
    for (const row of rows) expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(9);
  });

  it('n’expose qu’une seule case à la tabulation', () => {
    // L'invariant du « roving tabindex », documenté dans le composant depuis
    // l'incrément 1 et jamais vérifié jusqu'ici : sans lui, traverser la grille
    // au clavier demanderait 81 tabulations.
    view = render(SudokuBoard, { game: makeGame('a11y-tabulation') });
    const focusable = view.container.querySelectorAll('[role="gridcell"][tabindex="0"]');
    expect(focusable).toHaveLength(1);
  });

  it('nomme les marques des candidats, pas seulement leur couleur', () => {
    /*
      La règle que ce test protège : « la couleur n'est jamais le seul porteur
      d'information ». Le nom accessible est le porteur qui ne se dégrade jamais.
      Si un jour quelqu'un simplifie le rendu des marques en une classe CSS, ce
      test tombe.
    */
    const game = makeGame('a11y-marques');
    const empty = game.puzzle.findIndex((v) => v === 0);
    game.select(empty);
    game.toggleNoteMode();
    game.setMarkMode(1);
    game.enter(4);
    game.setMarkMode(3);
    game.enter(6);

    view = render(SudokuBoard, { game });
    const label = view.container.querySelectorAll('[role="gridcell"]')[empty]!.getAttribute(
      'aria-label',
    );
    expect(label).toContain('4 marqué A');
    expect(label).toContain('6 marqué C');
  });

  it('n’expose aucune case à la tabulation en vue passive', () => {
    view = render(SudokuBoard, { game: makeGame('a11y-passive'), interactive: false });
    expect(view.container.querySelectorAll('[tabindex="0"]')).toHaveLength(0);
    expect(view.container.querySelector('[role="grid"]')?.getAttribute('aria-readonly')).toBe(
      'true',
    );
  });
});
