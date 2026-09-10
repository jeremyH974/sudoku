import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CELL_COUNT,
  EMPTY,
  countSolutions,
  generatePuzzle,
  hasDigit,
  indexOf,
  parseGrid,
  rate,
} from '@sudoku/engine';
import type { LeveledPuzzle } from '@sudoku/engine';
import { Game } from './game.svelte.js';
import { MAX_HISTORY } from './storage.js';

/**
 * Fabrique une grille notée sans passer par le Web Worker : la logique de partie
 * doit rester testable seule, sans dépendre de l'infrastructure qui l'alimente
 * en production.
 */
function makePuzzle(seed: string): LeveledPuzzle {
  const generated = generatePuzzle({ seed, minClues: 34 });
  const rating = rate(generated.puzzle);
  return { ...generated, level: rating.level ?? 'facile', rating, exact: true };
}

const firstEmpty = (game: Game): number => game.puzzle.findIndex((v) => v === EMPTY);
const firstGiven = (game: Game): number => game.puzzle.findIndex((v) => v !== EMPTY);

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
    game.loadPuzzle(makePuzzle('partie-de-test'));
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
    other.loadPuzzle(makePuzzle('partie-de-test'));
    expect(other.toString()).toBe(game.toString());
  });
});

/** Remplit toute la grille avec la solution, sauf la dernière case laissée libre. */
function fillAllButLast(game: Game): number {
  let last = -1;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (game.puzzle[cell] !== EMPTY) continue;
    last = cell;
  }
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (game.puzzle[cell] !== EMPTY || cell === last) continue;
    game.select(cell);
    game.enter(game.solution[cell]);
  }
  return last;
}

describe('instrumentation de la partie', () => {
  let game: Game;
  let solved: number;

  beforeEach(() => {
    game = new Game();
    solved = 0;
    game.onSolved = () => {
      solved++;
    };
    game.loadPuzzle(makePuzzle('instrumentation'));
  });

  it('signale la fin de partie une seule fois', () => {
    const last = fillAllButLast(game);
    expect(solved).toBe(0);

    game.select(last);
    game.enter(game.solution[last]);
    expect(game.isComplete).toBe(true);
    expect(solved).toBe(1);
  });

  it('n’enregistre pas trois parties quand on annule puis rejoue la dernière case', () => {
    /*
      Le piège que ce verrou existe pour éviter : `isComplete` est un dérivé.
      Annuler la dernière case le fait retomber à `false`, la reposer le fait
      remonter à `true`. Branché naïvement, l'enregistrement écrirait trois
      parties là où il y en a une.
    */
    const last = fillAllButLast(game);
    game.select(last);
    game.enter(game.solution[last]);
    expect(solved).toBe(1);

    game.undo();
    expect(game.isComplete).toBe(false);
    game.select(last);
    game.enter(game.solution[last]);
    expect(game.isComplete).toBe(true);

    expect(solved).toBe(1);
  });

  it('constate aussi la fin quand c’est une annulation qui referme la grille', () => {
    const last = fillAllButLast(game);
    game.select(last);
    game.enter(game.solution[last]);
    // Nouvelle grille : le verrou repart à zéro.
    game.loadPuzzle(makePuzzle('instrumentation-2'));
    solved = 0;

    const other = fillAllButLast(game);
    game.select(other);
    game.enter(game.solution[other]);
    expect(solved).toBe(1);
    solved = 0;

    // On efface la dernière case, puis on annule l'effacement : la grille est
    // à nouveau complète, mais elle a déjà été enregistrée.
    game.clear();
    game.undo();
    expect(game.isComplete).toBe(true);
    expect(solved).toBe(0);
  });

  it('compte les valeurs fausses à la saisie, sans jamais les décompter', () => {
    const cell = firstEmpty(game);
    const wrong = game.solution[cell] === 9 ? 1 : 9;

    game.select(cell);
    game.enter(wrong);
    expect(game.mistakes).toBe(1);

    // Corriger ne réécrit pas le passé.
    game.enter(game.solution[cell]);
    expect(game.mistakes).toBe(1);
  });

  it('ne compte pas une note comme une erreur', () => {
    const cell = firstEmpty(game);
    const wrong = game.solution[cell] === 9 ? 1 : 9;
    game.select(cell);
    game.toggleNoteMode();
    game.enter(wrong);
    expect(game.mistakes).toBe(0);
  });

  it('compte un indice consulté une fois, pas une fois par palier', () => {
    game.requestHint();
    expect(game.hintsShown).toBe(1);
    game.requestHint();
    game.requestHint();
    expect(game.hintTier).toBe(3);
    expect(game.hintsShown).toBe(1);
    expect(game.hintsApplied).toBe(0);
  });

  it('distingue l’indice consulté de l’indice appliqué', () => {
    game.requestHint();
    game.applyHint();
    expect(game.hintsShown).toBe(1);
    expect(game.hintsApplied).toBe(1);
  });

  it('remet les compteurs à zéro à la grille suivante', () => {
    const cell = firstEmpty(game);
    game.select(cell);
    game.enter(game.solution[cell] === 9 ? 1 : 9);
    game.requestHint();
    expect(game.mistakes).toBe(1);

    game.loadPuzzle(makePuzzle('grille-suivante'));
    expect(game.mistakes).toBe(0);
    expect(game.hintsShown).toBe(0);
    expect(game.hintsApplied).toBe(0);
    expect(game.clock.elapsedMs).toBe(0);
  });

  it('produit une partie enregistrable, estampillée de la version du barème', () => {
    const record = game.toRecord();
    expect(record.id).toHaveLength(record.id.length);
    expect(record.id.length).toBeGreaterThan(20);
    expect(record.ratingVersion).toBeGreaterThanOrEqual(4);
    expect(record.daily).toBeNull();
    expect(record.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('retient la date du défi quand la grille en est un', () => {
    game.loadPuzzle(makePuzzle('quotidien'), '2026-09-10');
    expect(game.daily).toBe('2026-09-10');
    expect(game.toRecord().daily).toBe('2026-09-10');
  });
});

describe('annulation : le geste, et non l’écriture de case', () => {
  /** L'état visible du plateau, réduit à une chaîne comparable. */
  const board = (g: Game): string =>
    JSON.stringify([[...g.values], [...g.notes], [...g.noteColors]]);

  it('restaure aussi les notes effacées chez les voisines', () => {
    /*
      Le trou que les deux tests voisins laissaient entre eux : l'un vérifiait
      la case jouée, l'autre le nettoyage des voisines, aucun n'annulait après
      le nettoyage. Le README garantissait pourtant « une annulation qui restaure
      aussi les notes » depuis l'incrément 5.
    */
    const game = new Game();
    game.loadPuzzle(makePuzzle('annulation-voisines'));

    const cell = firstEmpty(game);
    const digit = game.solution[cell]!;
    // Une voisine de la même ligne qui porte ce chiffre en note.
    const row = Math.floor(cell / 9);
    const peer = game.values.findIndex(
      (v, i) => v === EMPTY && i !== cell && Math.floor(i / 9) === row,
    );
    expect(peer).toBeGreaterThanOrEqual(0);

    game.select(peer);
    game.toggleNoteMode();
    game.enter(digit);
    game.setMarkMode(2);
    game.enter(digit); // le même candidat, marqué « B »
    game.setMarkMode(0);
    game.toggleNoteMode();

    const before = board(game);
    expect(game.notesOf(peer)).toContain(digit);

    game.select(cell);
    game.enter(digit);
    expect(game.notesOf(peer)).not.toContain(digit);

    game.undo();
    // La note **et** sa marque : la marque était perdue deux fois, puisque
    // `restrictToNotes` s'exécute après le retrait du candidat.
    expect(board(game)).toBe(before);
    expect(game.notesOf(peer)).toContain(digit);
    expect(game.marksOf(peer)).not.toBe(0);
  });

  it('défait un indice appliqué en une seule fois', () => {
    const game = new Game();
    game.loadPuzzle(makePuzzle('annulation-indice'));
    /*
      Écrire les neuf candidats partout : sans notes, un indice éliminatoire n'a
      rien à retirer — c'est justement le cas que `applyHint` comptait à tort.
      Le sur-ensemble suffit, l'indice vise des candidats réels.
    */
    game.toggleNoteMode();
    for (let cell = 0; cell < 81; cell++) {
      if (game.values[cell] !== EMPTY) continue;
      game.select(cell);
      for (let digit = 1; digit <= 9; digit++) game.enter(digit);
    }
    game.toggleNoteMode();

    const before = board(game);

    game.requestHint();
    expect(game.hint).not.toBeNull();
    expect(game.applyHint()).toBe(true);
    expect(board(game)).not.toBe(before);

    /*
      **Un seul** Ctrl+Z. C'est la formulation qui tient : compter les entrées
      d'historique dépendrait de la borne, que ce test vient d'atteindre en
      écrivant sept cent vingt-neuf notes. Un indice qui élimine dans trois
      cases en poussait trois, et il en fallait trois pour le défaire.
    */
    game.undo();
    expect(board(game)).toBe(before);
  });

  it('oublie les gestes les plus anciens au-delà de la borne', () => {
    const game = new Game();
    game.loadPuzzle(makePuzzle('annulation-borne'));
    const cell = firstEmpty(game);
    game.select(cell);
    game.toggleNoteMode();
    for (let i = 0; i < MAX_HISTORY + 20; i++) game.enter((i % 9) + 1);
    expect(game.history).toHaveLength(MAX_HISTORY);
  });

  it('toute annulation ramène la grille à un état qu’elle a traversé', () => {
    /*
      L'invariant qui rend le mécanisme sûr, et qui tombe au premier oubli de
      `#asOneMove` : une écriture non capturée ferait diverger le plateau de
      l'état enregistré, ou changerait le plateau sans que l'historique bouge.
      Les deux branches sont vérifiées.

      La grille est produite **une seule fois** : la générer dans la propriété
      la referait cent fois.
    */
    const puzzle = makePuzzle('annulation-propriete');
    const command = fc.oneof(
      fc.record({ kind: fc.constant('enter' as const), digit: fc.integer({ min: 1, max: 9 }) }),
      fc.record({ kind: fc.constant('clear' as const) }),
      fc.record({ kind: fc.constant('notes' as const) }),
      fc.record({ kind: fc.constant('mark' as const), mark: fc.constantFrom(0, 1, 2, 3) }),
      fc.record({ kind: fc.constant('select' as const), cell: fc.integer({ min: 0, max: 80 }) }),
      fc.record({ kind: fc.constant('undo' as const) }),
    );

    fc.assert(
      fc.property(fc.array(command, { maxLength: 60 }), (commands) => {
        const game = new Game();
        game.loadPuzzle(puzzle);

        /*
          Amorcer des notes sur une dizaine de cases, sinon la propriété ne
          rencontre presque jamais le cas qui compte : une voisine ne perd une
          note que si elle en avait une. Sans cette amorce elle restait verte
          alors que la capture des voisines était retirée — vérifié.
        */
        const passed: string[] = [];
        let seeded = 0;
        for (let cell = 0; cell < 81 && seeded < 10; cell++) {
          if (game.values[cell] !== EMPTY) continue;
          game.select(cell);
          game.toggleNoteMode();
          for (let digit = 1; digit <= 9; digit++) {
            // L'amorce passe par la même comptabilité : ces gestes sont
            // annulables comme les autres, et la propriété doit pouvoir y entrer.
            passed.push(board(game));
            game.enter(digit);
          }
          game.toggleNoteMode();
          seeded++;
        }

        for (const c of commands) {
          const before = board(game);
          const depth = game.history.length;

          if (c.kind === 'enter') game.enter(c.digit);
          else if (c.kind === 'clear') game.clear();
          else if (c.kind === 'notes') game.toggleNoteMode();
          else if (c.kind === 'mark') game.setMarkMode(c.mark as 0 | 1 | 2 | 3);
          else if (c.kind === 'select') game.select(c.cell);
          else game.undo();

          if (c.kind === 'undo') {
            expect(board(game)).toBe(passed.length === 0 ? before : passed.pop());
          } else if (game.history.length > depth) {
            passed.push(before);
          } else {
            // Un geste refusé — case donnée, valeur déjà posée — ne change rien.
            expect(board(game)).toBe(before);
          }
          expect(game.history).toHaveLength(passed.length);
        }
      }),
    );
  });
});

describe('les compteurs disent ce qu’ils nomment', () => {
  it('ne compte aucun indice consulté quand aucun n’a été montré', () => {
    /*
      `hintsShown` s'incrémentait avant les trois gardes. Dix appuis sur
      « Indice » avec un conflit à l'écran enregistraient dix indices consultés,
      alors qu'aucun n'avait rien montré.
    */
    const game = new Game();
    game.loadPuzzle(makePuzzle('compteur-indices'));

    const given = firstGiven(game);
    const value = game.values[given]!;
    const row = Math.floor(given / 9);
    const target = game.values.findIndex(
      (v, i) => v === EMPTY && Math.floor(i / 9) === row,
    );
    game.select(target);
    game.enter(value); // conflit délibéré

    for (let i = 0; i < 10; i++) game.requestHint();
    expect(game.hintNotice).not.toBeNull();
    expect(game.hint).toBeNull();
    expect(game.hintsShown).toBe(0);
  });

  it('compte un indice consulté dès qu’il en montre un', () => {
    const game = new Game();
    game.loadPuzzle(makePuzzle('compteur-indices-ok'));
    game.requestHint();
    expect(game.hint).not.toBeNull();
    expect(game.hintsShown).toBe(1);
    // Monter d'un palier approfondit le même indice.
    game.requestHint();
    game.requestHint();
    expect(game.hintsShown).toBe(1);
  });

  it('ne compte pas un indice qui n’a rien appliqué', () => {
    /*
      Sur une grille sans notes, un indice éliminatoire ne touche rien.
      `hintsApplied` montait quand même — or c'est lui qui décide de « terminée
      sans indice » dans deux agrégats.
    */
    /*
      Une grille dont le chemin comporte une étape purement éliminatoire —
      cherchée, jamais recopiée de mémoire. Elle n'est jamais la première : le
      registre essaie les singles avant, donc on rejoue le chemin jusqu'à elle
      en posant les valeurs à la main.
    */
    let found: { puzzle: LeveledPuzzle; upTo: number } | null = null;
    for (let i = 0; i < 60 && found === null; i++) {
      const generated = generatePuzzle({ seed: `compteur-applique-${String(i)}`, minClues: 26 });
      const rating = rate(generated.puzzle);
      if (rating.outcome !== 'solved') continue;
      const index = rating.steps.findIndex(
        (step) => step.placements.length === 0 && step.eliminations.length > 0,
      );
      if (index > 0) {
        found = {
          puzzle: { ...generated, level: rating.level ?? 'facile', rating, exact: true },
          upTo: index,
        };
      }
    }
    expect(found, 'aucune grille au chemin purement éliminatoire').not.toBeNull();

    const game = new Game();
    game.loadPuzzle(found!.puzzle);
    for (const step of found!.puzzle.rating.steps.slice(0, found!.upTo)) {
      for (const placement of step.placements) {
        game.select(placement.cell);
        game.enter(placement.digit);
      }
    }

    game.requestHint();
    expect(game.hint?.placements).toHaveLength(0);
    expect(game.hint?.eliminations.length).toBeGreaterThan(0);

    // La grille ne porte aucune note : il n'y a rien à écarter.
    const depth = game.history.length;
    expect(game.applyHint()).toBe(false);
    expect(game.hintsApplied).toBe(0);
    // Et aucun geste vide poussé dans l'historique.
    expect(game.history).toHaveLength(depth);
  });
});
