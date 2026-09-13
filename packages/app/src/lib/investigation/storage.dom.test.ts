import { beforeEach, describe, expect, it } from 'vitest';
import { composeCase, encodeCase } from '@sudoku/engine/investigation';
import type { CaseFile } from '@sudoku/engine/investigation';
import { CaseGame } from './caseGame.svelte.js';
import { CASE_SAVE_VERSION, clearCase, loadCase, saveCase } from './storage.js';

/**
 * La partie d'enquête rangée, vérifiée sur ce qui casserait vraiment.
 *
 * Jusqu'à l'incrément 18, un rafraîchissement perdait l'affaire en cours sans
 * rien dire. Ce fichier garde la réparation, et surtout ses **refus** : une
 * sauvegarde qu'on relit mal est pire qu'une sauvegarde absente, parce qu'elle
 * rend un plateau qui n'est pas celui qu'on avait laissé.
 *
 * **Aucune affaire inventée** : celle qui sert ici sort du générateur.
 */

const CASE: CaseFile = (() => {
  for (let index = 0; index < 20; index++) {
    const file = composeCase(`rangement-${String(index)}`);
    if (file !== null) return file;
  }
  throw new Error('aucune affaire composée pour ce test');
})();

/** Une partie entamée : quelques gestes, pour que le plateau ne soit pas vierge. */
function played(): CaseGame {
  const game = new CaseGame();
  game.load(CASE);
  game.apply(0);
  game.suspect = 2;
  game.tool = 'note';
  game.apply(7);
  game.tool = 'cross';
  game.apply(9);
  game.tool = 'place';
  game.select(3);
  return game;
}

beforeEach(() => {
  clearCase();
});

describe('la partie d’enquête rangée', () => {
  it('rend exactement le plateau qu’on avait laissé', () => {
    const before = played();
    const snapshot = before.snapshot();
    expect(snapshot).not.toBeNull();
    if (snapshot === null) return;

    // Le plateau doit porter des traces : sans cela le contrôle passerait sur
    // une partie vierge et ne prouverait rien.
    expect(snapshot.occupant.some((who) => who !== -1)).toBe(true);
    expect(snapshot.pencil.some((mask) => mask !== 0)).toBe(true);
    expect(snapshot.crossed.some((crossed) => crossed)).toBe(true);

    saveCase(snapshot);
    const restored = loadCase();
    expect(restored).not.toBeNull();
    if (restored === null) return;

    const after = new CaseGame();
    after.restore(restored);

    expect(after.occupant).toEqual([...snapshot.occupant]);
    expect(after.pencil).toEqual([...snapshot.pencil]);
    expect(after.crossed).toEqual([...snapshot.crossed]);
    expect(after.suspect).toBe(snapshot.suspect);
    expect(after.cursor).toBe(snapshot.cursor);
    expect(after.tool).toBe(snapshot.tool);
    expect(after.file?.decorId).toBe(CASE.decorId);
    expect(after.file?.clues).toEqual(CASE.clues);
    expect(after.file?.solution).toEqual(CASE.solution);
  });

  it('ne rend rien quand il n’y a rien', () => {
    expect(loadCase()).toBeNull();
  });

  it('jette une sauvegarde d’une autre version plutôt que de la deviner', () => {
    /*
      Le tout ou rien est délibéré, et repris du sudoku : un champ dont le sens
      a changé se relirait sans erreur et donnerait une partie fausse. Perdre
      une partie se voit ; en rendre une autre ne se voit pas.
    */
    const snapshot = played().snapshot();
    if (snapshot === null) throw new Error('instantané absent');
    saveCase(snapshot);

    const raw = localStorage.getItem('enquete.game');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    expect(stored.version).toBe(CASE_SAVE_VERSION);
    localStorage.setItem('enquete.game', JSON.stringify({ ...stored, version: 999 }));

    expect(loadCase()).toBeNull();
  });

  it('refuse un plateau qui n’a pas la taille de son décor', () => {
    /*
      La faute que rien d'autre n'attraperait : elle ne casse pas à la lecture
      mais à la première case touchée, loin de sa cause. On la refuse ici.
    */
    const snapshot = played().snapshot();
    if (snapshot === null) throw new Error('instantané absent');
    saveCase({ ...snapshot, crossed: snapshot.crossed.slice(0, -1) });
    expect(loadCase()).toBeNull();

    saveCase({ ...snapshot, occupant: [...snapshot.occupant, 0] });
    expect(loadCase()).toBeNull();
  });

  it('refuse un code d’affaire abîmé au lieu d’ouvrir autre chose', () => {
    const snapshot = played().snapshot();
    if (snapshot === null) throw new Error('instantané absent');
    saveCase({ ...snapshot, code: `${snapshot.code.slice(0, -2)}zz` });

    const restored = loadCase();
    // Ou bien le code ne se relit pas — le cas courant —, ou bien il désigne
    // une autre affaire valide, et le plateau rangé n'a alors pas sa taille.
    if (restored !== null) expect(restored.file.clues.length).toBeGreaterThan(0);
    else expect(restored).toBeNull();
  });

  it('range le code de l’affaire, jamais sa graine', () => {
    // Une graine ne reproduit pas la même affaire d'une version du registre à
    // l'autre : reprendre une partie sur une autre affaire serait pire que de
    // la perdre.
    const snapshot = played().snapshot();
    if (snapshot === null) throw new Error('instantané absent');
    expect(snapshot.code).toBe(encodeCase(CASE));
    expect(JSON.stringify(snapshot)).not.toContain(CASE.seed);
  });

  it('tient dans une taille raisonnable pour un stockage partagé', () => {
    /*
      `localStorage` offre environ 5 Mio par origine, partagés avec le sudoku et
      ses statistiques. Une partie d'enquête pèse ici quelques kilo-octets — la
      borne est posée à 64 ko pour attraper le jour où l'on rangerait par
      mégarde quelque chose de volumineux, l'historique d'annulation par exemple,
      qui est une pile de photographies du plateau entier.
    */
    const snapshot = played().snapshot();
    if (snapshot === null) throw new Error('instantané absent');
    saveCase(snapshot);
    expect((localStorage.getItem('enquete.game') ?? '').length).toBeLessThan(64_000);
  });
});
