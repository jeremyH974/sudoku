import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeGrid, generatePuzzle } from '@sudoku/engine';
import App from './App.svelte';
import { expectNoViolations, only } from './test/axe.js';
import { render, resetDocument } from './test/render.js';
import type { Rendered } from './test/render.js';

/*
  Monter l'application entière sans démarrer de Web Worker.

  `start()` essaie dans l'ordre : un code d'URL, une partie sauvegardée, puis une
  grille neuve — et seule la troisième branche passe par le Worker. On lui donne
  donc un code d'URL, ce qui est à la fois le chemin le plus court et un vrai
  parcours du produit : c'est exactement ce que fait un QR code imprimé.
*/
function seedGridInUrl(): void {
  const generated = generatePuzzle({ seed: 'a11y-application', minClues: 34 });
  window.location.hash = `#g=${encodeGrid(generated.puzzle)}`;
}

const TABS = ['Jouer', 'Progression', 'Analyse', 'Imprimer'];

let view: Rendered | null = null;

beforeEach(() => {
  seedGridInUrl();
});

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
  window.location.hash = '';
});

function openTab(current: Rendered, label: string): void {
  const button = [...current.container.querySelectorAll('nav button')].find(
    (element) => element.textContent?.trim() === label,
  );
  if (button === undefined) throw new Error(`Onglet introuvable : ${label}`);
  (button as HTMLButtonElement).click();
  current.flush();
}

describe('accessibilité de l’application', () => {
  it('n’a qu’un seul titre de niveau 1 dans tout le document', () => {
    view = render(App, {});
    for (const label of TABS) {
      openTab(view, label);
      // La feuille de garde du cahier imprimé en portait un second : un lecteur
      // d'écran perd alors son repère principal.
      expect(document.querySelectorAll('h1')).toHaveLength(1);
    }
  });

  it('ouvre la page sur son lien d’évitement', () => {
    view = render(App, {});
    const first = view.container.querySelector('a, button, input, select');
    expect(first?.textContent?.trim()).toBe('Aller au contenu');
    // Et la cible existe, focalisable : sans `tabindex`, le focus resterait sur
    // le lien et la tabulation suivante repartirait de la navigation.
    const target = view.container.querySelector('#contenu');
    expect(target).not.toBeNull();
    expect(target?.getAttribute('tabindex')).toBe('-1');
  });

  it('range tout le contenu dans un repère, sur chacun des onglets', async () => {
    view = render(App, {});
    for (const label of TABS) {
      openTab(view, label);
      await expectNoViolations(
        view.container,
        only('region', 'landmark-one-main', 'landmark-unique', 'page-has-heading-one'),
      );
    }
  });

  it('n’enchaîne pas les niveaux de titre, sur chacun des onglets', async () => {
    // L'onglet Analyse passait de `h1` à `h3` sans `h2` depuis l'incrément 2.
    view = render(App, {});
    for (const label of TABS) {
      openTab(view, label);
      await expectNoViolations(view.container, only('heading-order', 'empty-heading'));
    }
  });

  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(App, {});
    for (const label of TABS) {
      openTab(view, label);
      await expectNoViolations(view.container);
    }
  });

  it('dit « noter » et non « placer » quand le mode notes est actif', () => {
    // Le libellé décrivait le geste que le bouton ne faisait pas : en mode
    // notes, `enter()` pose une note, pas une valeur.
    view = render(App, {});
    const notes = [...view.container.querySelectorAll('button')].find((element) =>
      element.textContent?.includes('Notes'),
    )!;
    notes.click();
    view.flush();

    const key = view.container.querySelector('.pad button')!;
    expect(key.getAttribute('aria-label')).toMatch(/^Noter le 1/);
  });
});
