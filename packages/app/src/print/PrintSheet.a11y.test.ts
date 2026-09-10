import { afterEach, describe, expect, it } from 'vitest';
import { encodeGrid, findSolution, generatePuzzle, rate } from '@sudoku/engine';
import PrintSheet from './PrintSheet.svelte';
import { paginate } from './layout.js';
import type { PrintablePuzzle } from './layout.js';
import { formatById } from './presets.js';
import { expectNoViolations } from '../test/axe.js';
import { render, resetDocument } from '../test/render.js';
import type { Rendered } from '../test/render.js';

/*
  La feuille de garde ne se rend jamais tant qu'aucun cahier n'a été composé :
  le test de l'application entière ne la traverse donc pas, et son second `<h1>`
  y serait passé inaperçu. On la monte ici directement, avec un cahier de papier.
*/
function booklet() {
  const generated = generatePuzzle({ seed: 'a11y-impression', minClues: 34 });
  const solution = findSolution(Uint8Array.from(generated.puzzle))!;
  const rating = rate(generated.puzzle);
  const puzzle: PrintablePuzzle = {
    index: 1,
    puzzle: [...generated.puzzle],
    solution: [...solution],
    level: rating.level ?? 'facile',
    levelLabel: 'Facile',
    score: rating.score,
    label: 'F-1',
    code: encodeGrid(generated.puzzle),
  };
  return paginate([puzzle], formatById('booklet'), {
    title: 'Cahier de test',
    includeSolutions: true,
  });
}

let view: Rendered | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

describe('accessibilité de la feuille imprimée', () => {
  it('n’ouvre pas un second titre de niveau 1 dans la page', () => {
    const cahier = booklet();
    const summary = cahier.sheets.find((sheet) => sheet.kind === 'summary')!;

    view = render(PrintSheet, {
      sheet: summary,
      format: formatById('booklet'),
      booklet: cahier,
      baseUrl: 'https://exemple.test/',
    });

    expect(view.container.querySelectorAll('h1')).toHaveLength(0);
    expect(view.container.querySelector('h2')?.textContent).toBe('Cahier de test');
  });

  it('ne présente aucun manquement relevable sur ses trois sortes de feuilles', async () => {
    const cahier = booklet();
    for (const sheet of cahier.sheets) {
      const current = render(PrintSheet, {
        sheet,
        format: formatById('booklet'),
        booklet: cahier,
        baseUrl: 'https://exemple.test/',
      });
      try {
        // `region` est écartée : une feuille montée seule ne peut pas vivre dans
        // un repère de page. Le test de l'application entière s'en charge.
        await expectNoViolations(current.container, { rules: { region: { enabled: false } } });
      } finally {
        current.destroy();
      }
    }
  });
});
