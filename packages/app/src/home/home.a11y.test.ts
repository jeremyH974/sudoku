import { afterEach, describe, expect, it } from 'vitest';
import Home from './Home.svelte';
import { expectNoViolations } from '../test/axe.js';
import { render, resetDocument } from '../test/render.js';
import type { Rendered } from '../test/render.js';

/**
 * L'accueil du site : deux destinations, et rien à comprendre.
 *
 * C'est la page la plus simple du produit, et c'est pour cela qu'elle mérite un
 * test : une page d'accueil ratée se remarque tard, parce que personne n'y
 * reste. Les deux règles qui comptent — des **liens** plutôt que des boutons, et
 * un nom pour chacun — se vérifient ici plutôt qu'à la relecture.
 *
 * Comme partout dans ce projet : un DOM simulé ne calcule aucune mise en page.
 * `axe` y voit les rôles et les noms, jamais le contraste ni la taille des
 * cibles, qui se mesurent à la main.
 */

let view: Rendered | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

describe('accessibilité de l’accueil', () => {
  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(Home, {});
    await expectNoViolations(view.container);
  });

  it('mène aux deux jeux par de vrais liens', () => {
    /*
      Un lien, et non un bouton piloté au JavaScript. La différence n'est pas
      théorique : un bouton perd l'ouverture dans un nouvel onglet, la copie de
      l'adresse, le menu contextuel et la navigation au clavier telle qu'un
      lecteur d'écran l'annonce — « lien Sudoku » plutôt que « bouton Sudoku ».
    */
    view = render(Home, {});
    const links = [...view.container.querySelectorAll('a[href]')];
    const named = links.map((link) => ({
      name: link.textContent?.trim() ?? '',
      href: link.getAttribute('href') ?? '',
    }));

    expect(named.some((link) => link.name.startsWith('Sudoku') && link.href.endsWith('sudoku/'))).toBe(
      true,
    );
    expect(
      named.some((link) => link.name.startsWith('Enquête') && link.href.endsWith('enquete/')),
    ).toBe(true);
  });

  it('n’écrit aucune adresse en dur : les liens suivent la base', () => {
    // La base change le jour du nom de domaine. Une adresse écrite en dur
    // survivrait à la construction et mènerait à un 404 que rien ne signale.
    view = render(Home, {});
    for (const link of view.container.querySelectorAll('a[href]')) {
      expect(link.getAttribute('href')?.startsWith(import.meta.env.BASE_URL)).toBe(true);
    }
  });

  it('annonce chaque jeu par son nom, et dit ce qu’il est', () => {
    view = render(Home, {});
    const text = view.container.textContent ?? '';
    expect(text).toContain('Sudoku');
    expect(text).toContain('Enquête');
    // La promesse du produit, tenue à l'accueil comme sur les deux sections.
    expect(text).toContain('aucun compte');
  });
});
