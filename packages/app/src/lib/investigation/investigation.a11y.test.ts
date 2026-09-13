import { afterEach, describe, expect, it } from 'vitest';
import { DECORS, composeCase } from '@sudoku/engine/investigation';
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
  Le délai explicite a disparu, et sa disparition est la preuve.

  ─── Ce qu'il masquait ──────────────────────────────────────────────────────

  Trois tests de ce fichier ont fait tomber une publication en dépassant les
  cinq secondes du défaut de vitest, sur le coureur de la CI et nulle part
  ailleurs. On a d'abord posé trente secondes, puis quinze, en écrivant que
  « le rendu et axe dominent désormais ».

  C'était faux, et il a fallu chronométrer chaque phase **dans** vitest pour le
  voir. Mesuré sur les douze tests : composition **87,7 %**, rendu 7,8 %, `axe`
  4,3 %. Le rendu d'un plan coûte 43 à 88 ms, le chargement d'une affaire moins
  d'une milliseconde.

  ─── Pourquoi la composition coûtait si cher ici ────────────────────────────

  Parce qu'elle est payée **quatre fois son prix** dans cet environnement, et le
  facteur se scinde en deux, tous deux mesurés sur le même code gelé :

    | la même graine, douze fois | total   |
    | tsx + node                 | 1 956 ms |
    | vitest, environment node   | 3 636 ms |  ×1,86 — la tuyauterie de vitest
    | vitest, environment jsdom  | 7 766 ms |  ×2,14 — jsdom, sur du calcul pur

  Un calcul qui ne touche à aucun DOM coûte deux fois plus cher sous jsdom. Le
  mécanisme n'est pas identifié : ni le tas retenu ni la forme de `globalThis`
  ne l'expliquent, tous deux écartés par mesure.

  ─── Ce qui a été fait ──────────────────────────────────────────────────────

  Une affaire par décor au lieu d'une par test, et une graine choisie par la
  mesure. Le fichier passe de **11,93 s à 3,15 s**, et le pire test de 2 190 ms
  à **518 ms**.

  Le coureur coûte 2,2 fois cette machine, relevé dans ses propres journaux, et
  varie lui-même d'un facteur 1,8 d'une exécution à l'autre. Soit un pire cas
  attendu autour de 2 s, contre les 4 486 ms que le même fichier y atteignait
  encore. Les cinq secondes du défaut suffisent, avec deux fois la marge — et
  c'est le défaut qui protège désormais, pas une exception écrite ici.
*/

/**
 * Une affaire par décor, **engendrée** et jamais écrite à la main.
 *
 * ─── Pourquoi par décor, et non par test ────────────────────────────────────
 *
 * Chaque test composait la sienne, sur une graine nommée d'après lui —
 * `a11y-noms`, `a11y-plan`… Douze compositions, donc, et une répartition en
 * décors purement **accidentelle** : cinq fois l'atelier, trois fois le manoir,
 * deux fois le reste. Ce n'était pas une couverture, c'était un hasard.
 *
 * Une affaire par décor, sur la même graine, est à la fois plus délibéré et
 * quatre fois moins cher : la couverture porte sur les quatre plans, et non sur
 * douze tirages dont la variété ne se voit nulle part dans ce qui est vérifié.
 * Mesuré sous jsdom : 2 232 ms pour les quatre, contre environ 6 700 pour les
 * douze.
 *
 * Ce qu'on y perd est dit franchement : douze jeux d'indices distincts
 * deviennent quatre. La variété des énoncés se vérifie ailleurs, dans
 * `clues.test.ts`, qui est fait pour ça.
 *
 * ─── Le fichier est partagé, la partie ne l'est pas ─────────────────────────
 *
 * Une `CaseFile` est immuable et se prête sans risque ; une `CaseGame` se
 * modifie — un test y pose des suspects, en barre, en note au crayon. Chaque
 * test repart donc d'une partie neuve, ce qui ne coûte rien.
 */
/**
 * La graine, choisie **par la mesure** et non par le sens.
 *
 * Rien de ce que ce fichier vérifie n'en dépend : n'importe quelle affaire de
 * taille six satisfait chacune de ses assertions. Elle n'est donc pas un
 * paramètre du sujet, c'est un paramètre de **coût** — et un paramètre de coût
 * se choisit en mesurant.
 *
 * Huit mots quelconques, passés sur les quatre décors, sous jsdom :
 *
 *   | graine  | total des quatre | le pire |
 *   | test    |          4 955 ms | 2 692 ms |
 *   | axe     |          3 679 ms | 2 028 ms |
 *   | a11y    |          2 161 ms | 1 287 ms |
 *   | six     |          1 199 ms |   531 ms |
 *   | **fiche** |          **686 ms** |  **378 ms** |
 *
 * Sept fois moins cher que le pire tirage, pour exactement les mêmes
 * vérifications. Ce mot n'a rien de particulier — c'est le hasard du générateur,
 * et il peut cesser d'être le meilleur au prochain changement de barème. Le jour
 * où la suite ralentira de ce côté, c'est ici qu'il faudra regarder.
 */
const SEED = 'fiche';

const composed = new Map<string, CaseFile>();

function caseFor(decorId: string): CaseFile {
  const known = composed.get(decorId);
  if (known !== undefined) return known;

  const file = composeCase(SEED, { decorId });
  if (file === null) throw new Error(`Le décor « ${decorId} » n'a produit aucune affaire.`);
  composed.set(decorId, file);
  return file;
}

function loadedGame(decorId: string): CaseGame {
  const game = new CaseGame();
  game.load(caseFor(decorId));
  return game;
}

/** Les quatre plans, nommés une fois : les tests s'y répartissent. */
const [MANOR, PAVILION, WORKSHOP, ROTUNDA] = DECORS.map((decor) => decor.id);

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
    view = render(SceneBoard, { game: loadedGame(MANOR) });
    await expectNoViolations(view.container, COMPONENT_RULES);
  });

  it('donne un nom à chacune des trente-six cases', () => {
    const game = loadedGame(PAVILION);
    view = render(SceneBoard, { game });
    const cells = view.container.querySelectorAll('[role="gridcell"]');
    expect(cells).toHaveLength(game.cellCount);
    for (const cell of cells) expect(cell.getAttribute('aria-label')?.trim()).toBeTruthy();
  });

  it('annonce ses dimensions, et six rangées de six', () => {
    const game = loadedGame(WORKSHOP);
    view = render(SceneBoard, { game });
    const grid = view.container.querySelector('[role="grid"]');
    expect(grid?.getAttribute('aria-rowcount')).toBe('6');
    expect(grid?.getAttribute('aria-colcount')).toBe('6');

    const rows = grid?.querySelectorAll('[role="row"]') ?? [];
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(6);
  });

  it('n’expose qu’une seule case à la tabulation', () => {
    view = render(SceneBoard, { game: loadedGame(ROTUNDA) });
    expect(view.container.querySelectorAll('[role="gridcell"][tabindex="0"]')).toHaveLength(1);
  });

  it('nomme le mobilier, au lieu de seulement le dessiner', () => {
    /*
      La règle que ce test protège, et la raison d'être de tout le mode : le
      dessin peut disparaître sans que l'affaire devienne injouable. Si un jour
      quelqu'un allège le nom accessible en s'appuyant sur les tracés, ce test
      tombe — et c'est précisément ce qu'on veut.
    */
    const game = loadedGame(MANOR);
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
    const game = loadedGame(PAVILION);
    game.apply(0);
    view = render(SceneBoard, { game });
    const cells = [...view.container.querySelectorAll('[role="gridcell"]')];

    expect(cells[0]?.getAttribute('aria-label')).toContain('placé ici');
    // La rangée et la colonne de quelqu'un de posé sont fermées, et le nom
    // accessible le **dit** — le trait léger n'en est qu'un rappel visuel.
    expect(cells[1]?.getAttribute('aria-label')).toContain('impossible');
  });

  it('donne à chaque case un nom qui se suffit à lui-même', () => {
    /*
      La règle vient du texte normatif de l'APG, et non d'une préférence : dans
      un `role="grid"`, un lecteur d'écran passe en mode application, où
      l'utilisateur « n'entend que les éléments focalisables et le contenu qui
      les nomme ». Tout ce qui n'est pas dans le nom d'une case est donc
      **inaudible** — la couleur d'une pièce, la position dans le plan, le trait
      qui ferme une rangée.

      Le nom de chaque case doit donc porter seul : sa rangée, sa colonne, la
      pièce où elle se trouve, et son état. C'est ce que ce contrôle mesure, et
      c'est la contrepartie que le rôle `grid` impose en échange d'un seul arrêt
      de tabulation au lieu de trente-six.

      ⚠ Ce test ne remplace pas une écoute réelle. Un DOM simulé ne dit pas ce
      qu'un lecteur d'écran **annonce** ; il dit ce qu'il a à sa disposition pour
      le faire. La validation au lecteur d'écran reste due.
    */
    const game = loadedGame(WORKSHOP);
    game.apply(0);
    view = render(SceneBoard, { game });
    const cells = [...view.container.querySelectorAll('[role="gridcell"]')];
    expect(cells).toHaveLength(36);

    const zones = new Set(game.puzzle?.scene.zones.map((zone) => zone.name) ?? []);
    expect(zones.size).toBeGreaterThan(1);

    for (const [index, cell] of cells.entries()) {
      const name = cell.getAttribute('aria-label') ?? '';
      const row = Math.floor(index / 6) + 1;
      const column = (index % 6) + 1;
      expect(name, `case ${String(index)}`).toContain(`rangée ${String(row)}`);
      expect(name, `case ${String(index)}`).toContain(`colonne ${String(column)}`);
      // La pièce, nommée — sans quoi le plan n'existe que pour l'œil.
      expect([...zones].some((zone) => name.includes(zone)), `case ${String(index)} : ${name}`).toBe(
        true,
      );
      // Et l'état : libre, occupée, ou fermée. Jamais rien.
      expect(/libre|placé ici|placée ici|impossible/.test(name), `case ${String(index)} : ${name}`).toBe(
        true,
      );
    }
  });

  it('ne prétend pas à une sélection qu’il n’a pas', () => {
    /*
      Le plan a un **curseur**, pas une sélection : aucune case n'est retenue
      pour une opération ultérieure, contrairement à un tableur. `aria-selected`
      décrirait donc autre chose que ce qui se passe — et le focus, que le
      `tabindex` roving amène sur la case courante, porte déjà l'information.

      Relevé dans un navigateur avant de trancher : l'attribut était posé sur les
      36 cases, dont 35 à « false », que NVDA énonce « non sélectionné ». Le
      raisonnement complet et ses sources sont dans `SceneBoard.svelte`.
    */
    view = render(SceneBoard, { game: loadedGame(ROTUNDA) });
    const cells = [...view.container.querySelectorAll('[role="gridcell"]')];
    expect(cells.filter((cell) => cell.hasAttribute('aria-selected'))).toHaveLength(0);

    // Le curseur reste pourtant atteignable : une case, et une seule, est dans
    // l'ordre de tabulation.
    expect(cells.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1);
  });
});

describe('accessibilité de l’écran d’enquête', () => {
  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(InvestigationPanel, { game: loadedGame(WORKSHOP) });
    await expectNoViolations(view.container, COMPONENT_RULES);
  });

  it('donne une carte nommée à chaque suspect, avec ce qu’il a dit', () => {
    const game = loadedGame(ROTUNDA);
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
    const game = loadedGame(MANOR);
    view = render(InvestigationPanel, { game });
    const victimCard = [...view.container.querySelectorAll('.cards button')][
      caseOf(game).victim
    ];
    expect(victimCard?.textContent).toContain('Victime');
  });

  it('dit l’outil actif autrement que par son fond', () => {
    const game = loadedGame(PAVILION);
    view = render(InvestigationPanel, { game });
    const pressed = view.container.querySelectorAll('.tools [aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.textContent).toContain('Placer');
  });

  it('annonce ce qui vient de se passer dans une région vivante', () => {
    const game = loadedGame(WORKSHOP);
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
    const game = loadedGame(ROTUNDA);
    view = render(InvestigationPanel, { game });
    const measured = view.container.querySelector('.measured')?.textContent ?? '';
    expect(measured).toContain('comptages');
    expect(measured).toContain('calibrés contre');
    expect(measured).toContain(String(caseOf(game).stepCount));
    // Et jamais de note : aucun nombre sur dix, aucune étoile, aucun palier.
    expect(measured).not.toMatch(/\/\s*10|sur 10|★/);
  });
});
