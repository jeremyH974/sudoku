import { afterEach, describe, expect, it } from 'vitest';
import {
  composeCase,
  decodeCase,
  encodeCase,
  openCase,
  renderClue,
} from '@sudoku/engine/investigation';
import type { CaseFile } from '@sudoku/engine/investigation';
import CaseSheet from './CaseSheet.svelte';
import { formatById } from './presets.js';
import { expectNoViolations } from '../test/axe.js';
import { render, resetDocument } from '../test/render.js';
import type { Rendered } from '../test/render.js';

/**
 * Le dossier imprimé d'une affaire.
 *
 * Une feuille imprimée est une promesse sans recours : le cahier est distribué,
 * et rien ne peut plus être corrigé. Les contrôles portent donc sur ce qui la
 * rendrait fausse — un témoignage manquant, un plan sans ses pièces, et surtout
 * **la réponse qui fuite sur la feuille à remplir**.
 *
 * ⚠ Ce qu'un DOM simulé ne peut pas vérifier, et qui reste manuel : la taille
 * réelle sur le papier, l'épaisseur des traits, et le fait que tout tienne sur
 * une page. Ces trois-là se mesurent dans un vrai navigateur, et une CI verte ne
 * vaut pas mesure — c'est la même réserve que pour le contraste.
 */

/** Une affaire réelle : aucune affaire inventée, jamais. */
const CASE: CaseFile = (() => {
  for (let index = 0; index < 20; index++) {
    const file = composeCase(`dossier-${String(index)}`);
    if (file !== null) return file;
  }
  throw new Error('aucune affaire composée pour ce test');
})();

const CODE = encodeCase(CASE);
const format = formatById('standard');
const base = { file: CASE, code: CODE, format, baseUrl: 'https://exemple.test/enquete/' };

let view: Rendered | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

describe('le dossier imprimé', () => {
  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(CaseSheet, { ...base, kind: 'dossier' as const, pageNumber: 1 });
    await expectNoViolations(view.container);
  });

  it('porte tous les témoignages de l’affaire, et dans la langue du joueur', () => {
    /*
      Un indice manquant rend l'affaire insoluble sur le papier alors qu'elle
      l'est à l'écran — et le joueur n'aurait aucun moyen de le savoir. On
      compare donc au rendu du moteur, pas à une liste écrite ici.
    */
    view = render(CaseSheet, { ...base, kind: 'dossier' as const, pageNumber: 1 });
    const puzzle = openCase(CASE);
    const printed = view.container.textContent ?? '';
    for (const clue of CASE.clues) {
      expect(printed, `indice absent : ${clue.kind}`).toContain(
        renderClue(clue, puzzle.scene, puzzle.suspects),
      );
    }
  });

  it('nomme chaque pièce du plan', () => {
    // Sur le papier, le nom de la pièce est **seul** porteur : le plan imprimé
    // n'a aucune couleur, exprès, parce qu'un navigateur n'imprime pas les fonds
    // et qu'une teinte ne survit pas à une laser noir et blanc.
    view = render(CaseSheet, { ...base, kind: 'dossier' as const, pageNumber: 1 });
    const printed = view.container.textContent ?? '';
    for (const zone of openCase(CASE).scene.zones) {
      expect(printed, `pièce absente : ${zone.name}`).toContain(zone.name);
    }
  });

  it('ne laisse jamais fuiter la réponse sur la feuille à remplir', () => {
    /*
      Le contrôle qui compte. Une feuille qui trahirait sa solution ne casserait
      aucun test fonctionnel et ruinerait chaque exemplaire imprimé.

      Deux fuites possibles, et on les ferme toutes les deux : une initiale posée
      sur le plan, et la phrase du verdict.
    */
    view = render(CaseSheet, { ...base, kind: 'dossier' as const, pageNumber: 1 });
    expect(view.container.querySelectorAll('svg text.letter')).toHaveLength(0);
    expect(view.container.textContent ?? '').not.toContain('Le meurtrier est');
  });

  it('rend le corrigé complet, sur sa propre feuille', () => {
    view = render(CaseSheet, { ...base, kind: 'solution' as const, pageNumber: 2 });
    const puzzle = openCase(CASE);

    // Une initiale par personne, et pas une de plus.
    const letters = [...view.container.querySelectorAll('svg text.letter')].map(
      (node) => node.textContent,
    );
    expect(letters).toHaveLength(puzzle.suspects.length);
    expect(new Set(letters).size).toBe(puzzle.suspects.length);

    const printed = view.container.textContent ?? '';
    expect(printed).toContain(puzzle.suspects[CASE.murderer].name);
    expect(printed).toContain(puzzle.suspects[CASE.victim].name);
    // La feuille du corrigé est une `section.sheet` à elle seule : c'est ce qui
    // la rend détachable, et l'intercaler la rendrait visible par transparence.
    expect(view.container.querySelectorAll('.sheet')).toHaveLength(1);
  });

  it('imprime un code qui rouvre exactement la même affaire', () => {
    /*
      La promesse du QR et du code saisi à la main. Un code imprimé qui
      ouvrirait autre chose serait la pire des fautes : le cahier est distribué,
      et personne ne peut plus le corriger.
    */
    view = render(CaseSheet, { ...base, kind: 'dossier' as const, pageNumber: 1 });
    const printed = (view.container.textContent ?? '').replace(/\s+/g, '');
    expect(printed).toContain(CODE);

    const reopened = decodeCase(CODE);
    expect(reopened.decorId).toBe(CASE.decorId);
    expect(reopened.clues).toEqual(CASE.clues);
    expect(reopened.solution).toEqual(CASE.solution);
    expect(reopened.murderer).toBe(CASE.murderer);
  });

  it('numérote ses pages quand le format le demande', () => {
    view = render(CaseSheet, { ...base, kind: 'solution' as const, pageNumber: 2 });
    expect(format.showPageNumbers).toBe(true);
    expect(view.container.querySelector('.folio')?.textContent).toBe('2');
  });
});
