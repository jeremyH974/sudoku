import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeCase } from '@sudoku/engine/investigation';
import type { CaseFile } from '@sudoku/engine/investigation';
import { CaseGame } from './caseGame.svelte.js';
import InvestigationPanel from './InvestigationPanel.svelte';
import SceneBoard from './SceneBoard.svelte';
import { expectNoViolations } from '../../test/axe.js';
import { render, resetDocument } from '../../test/render.js';
import type { Rendered } from '../../test/render.js';

/**
 * L'accessibilité du mode Enquête.
 *
 * ─── Ce que ce fichier vérifie, et ce qu'il ne peut pas vérifier ────────────
 *
 * Un DOM simulé ne calcule aucune mise en page : `axe` y voit les rôles, les
 * noms accessibles et l'ordre des titres, **jamais le contraste ni la taille
 * des cibles**. Ces deux-là se mesurent à la main, et une CI verte ne vaut pas
 * mesure. La règle vaut ici comme ailleurs dans le projet.
 *
 * Ce qui se vérifie mécaniquement, en revanche, c'est l'engagement pris en
 * choisissant de **dessiner** la scène : le dessin est une couche de
 * présentation, et tout ce qu'il montre est dit en toutes lettres dessous. Un
 * plan dont les meubles ne seraient que des tracés serait exactement ce que la
 * référence du genre livre aujourd'hui — un `<canvas>` sans rôle ni nom, zéro
 * élément focalisable, zéro région annoncée.
 */

/*
  Le délai est **mesuré**, et il signale un défaut plutôt qu'il ne le corrige.

  Chaque test de ce fichier engendre son affaire, et la composition est lente :
  sur les douze graines employées ici, la médiane est à 197 ms et le pire cas à
  1 005 ms — `a11y-tabulation`, suivie de `a11y-dimensions` et `a11y-mesure` à
  825 ms. Ces trois-là, et exactement ces trois-là, ont fait tomber la
  publication sur le coureur de la CI : deux cœurs partagés, quarante-quatre
  travailleurs qui se les disputent, et les cinq secondes du défaut de vitest
  franchies par composition + rendu + `axe`.

  Le symptôme ressemblait à un composant cassé ; la cause est le chronomètre,
  exactement comme pour le test de propriété de `composeCase`. Trente secondes
  laissent une marge de trente fois le pire cas local.

  ⚠ Ce n'est pas la correction. La correction est de rendre la composition
  assez rapide pour que la question ne se pose plus — le bouton « Nouvelle
  affaire » fait attendre le joueur du même temps. Le jour où c'est fait, ce
  délai doit **redescendre**, et sa disparition sera la preuve.
*/
vi.setConfig({ testTimeout: 30_000 });

/** Une affaire **engendrée**, jamais écrite à la main. */
function loadedGame(seed: string): CaseGame {
  const file = composeCase(seed);
  if (file === null) throw new Error(`La graine « ${seed} » n'a produit aucune affaire.`);
  const game = new CaseGame();
  game.load(file);
  return game;
}

const caseOf = (game: CaseGame): CaseFile => game.file as CaseFile;

let view: Rendered | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

/* `region` exige un repère de page, qu'un composant monté seul n'a pas. */
const COMPONENT_RULES = { rules: { region: { enabled: false } } };

describe('accessibilité du plan', () => {
  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(SceneBoard, { game: loadedGame('a11y-plan') });
    await expectNoViolations(view.container, COMPONENT_RULES);
  });

  it('donne un nom à chacune des trente-six cases', () => {
    const game = loadedGame('a11y-noms');
    view = render(SceneBoard, { game });
    const cells = view.container.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(game.cellCount);
    for (const cell of cells) expect(cell.getAttribute('aria-label')?.trim()).toBeTruthy();
  });

  it('annonce ses dimensions, et six rangées de six', () => {
    const game = loadedGame('a11y-dimensions');
    view = render(SceneBoard, { game });
    const grid = view.container.querySelector('[role="grid"]');
    expect(grid?.getAttribute('aria-rowcount')).toBe('6');
    expect(grid?.getAttribute('aria-colcount')).toBe('6');

    const rows = grid?.querySelectorAll('[role="row"]') ?? [];
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(6);
  });

  it('n’expose qu’une seule case à la tabulation', () => {
    view = render(SceneBoard, { game: loadedGame('a11y-tabulation') });
    expect(view.container.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
  });

  it('nomme le mobilier, au lieu de seulement le dessiner', () => {
    /*
      La règle que ce test protège, et la raison d'être de tout le mode : le
      dessin peut disparaître sans que l'affaire devienne injouable. Si un jour
      quelqu'un allège le nom accessible en s'appuyant sur les tracés, ce test
      tombe — et c'est précisément ce qu'on veut.
    */
    const game = loadedGame('a11y-mobilier');
    view = render(SceneBoard, { game });
    const labels = [...view.container.querySelectorAll('[role="gridcell"]')].map((cell) =>
      cell.getAttribute('aria-label'),
    );

    const scene = game.puzzle?.scene;
    expect(scene).toBeDefined();
    // Chaque meuble présent sur le plan se retrouve nommé dans au moins une case.
    for (const label of ['chaise', 'tapis', 'plante', 'étagère', 'table', 'lampe']) {
      expect(labels.some((name) => name?.includes(label))).toBe(true);
    }
    // Et chaque pièce se nomme, elle aussi.
    for (const zone of scene?.zones ?? []) {
      expect(labels.some((name) => name?.includes(zone.name))).toBe(true);
    }
  });

  it('dit qui est posé, et pourquoi une case est fermée', () => {
    const game = loadedGame('a11y-etat');
    game.apply(0);
    view = render(SceneBoard, { game });
    const cells = [...view.container.querySelectorAll('[role="gridcell"]')];

    expect(cells[0]?.getAttribute('aria-label')).toContain('placé ici');
    // La rangée et la colonne de quelqu'un de posé sont fermées, et le nom
    // accessible le **dit** — le trait léger n'en est qu'un rappel visuel.
    expect(cells[1]?.getAttribute('aria-label')).toContain('impossible');
  });
});

describe('accessibilité de l’écran d’enquête', () => {
  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(InvestigationPanel, { game: loadedGame('a11y-ecran') });
    await expectNoViolations(view.container, COMPONENT_RULES);
  });

  it('donne une carte nommée à chaque suspect, avec ce qu’il a dit', () => {
    const game = loadedGame('a11y-cartes');
    view = render(InvestigationPanel, { game });
    const cards = view.container.querySelectorAll('.cards button');
    expect(cards).toHaveLength(game.suspects.length);
    for (const person of game.suspects) {
      const text = [...cards].map((card) => card.textContent ?? '').join(' ');
      expect(text).toContain(person.name);
    }
  });

  it('désigne la victime par un mot, pas par une teinte', () => {
    // « La couleur n'est jamais le seul porteur d'information. » La carte de la
    // victime a un fond distinct ; c'est l'étiquette qui porte.
    const game = loadedGame('a11y-victime');
    view = render(InvestigationPanel, { game });
    const victimCard = [...view.container.querySelectorAll('.cards button')][
      caseOf(game).victim
    ];
    expect(victimCard?.textContent).toContain('Victime');
  });

  it('dit l’outil actif autrement que par son fond', () => {
    const game = loadedGame('a11y-outils');
    view = render(InvestigationPanel, { game });
    const pressed = view.container.querySelectorAll('.tools [aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.textContent).toContain('Placer');
  });

  it('annonce ce qui vient de se passer dans une région vivante', () => {
    const game = loadedGame('a11y-annonce');
    view = render(InvestigationPanel, { game });
    const live = view.container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent?.trim()).toBeTruthy();
  });

  it('affiche des comptages, et dit qu’ils ne sont calibrés contre rien', () => {
    /*
      L'engagement d'honnêteté du plan, tenu à l'écran.

      Ce mode n'a aucun oracle. Afficher un score de difficulté serait inventer
      une mesure ; le texte doit donc dire lui-même ce que ces nombres sont —
      des comptages — et ce qu'ils ne sont pas.
    */
    const game = loadedGame('a11y-mesure');
    view = render(InvestigationPanel, { game });
    const measured = view.container.querySelector('.measured')?.textContent ?? '';
    expect(measured).toContain('comptages');
    expect(measured).toContain('calibrés contre');
    expect(measured).toContain(String(caseOf(game).stepCount));
    // Et jamais de note : aucun nombre sur dix, aucune étoile, aucun palier.
    expect(measured).not.toMatch(/\/\s*10|sur 10|★/);
  });
});
