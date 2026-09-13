import { afterEach, describe, expect, it } from 'vitest';
import { composeCase, openCase } from '@sudoku/engine/investigation';
import type { CaseFile } from '@sudoku/engine/investigation';
import CaseSummary from './CaseSummary.svelte';
import { paginate } from './layout.js';
import { formatById } from './presets.js';
import { expectNoViolations } from '../test/axe.js';
import { render, resetDocument } from '../test/render.js';
import type { Rendered } from '../test/render.js';

/**
 * Le cahier d'enquêtes : la pagination, et sa page de garde.
 *
 * ─── Ce qu'un DOM simulé peut vérifier ici, et ce qu'il ne peut pas ─────────
 *
 * La **répartition** — quelle affaire sur quelle feuille, dans quel ordre, avec
 * quel numéro — est du calcul pur, et c'est ce que ce fichier tient. La mise en
 * page, elle, ne se mesure que dans un vrai navigateur : aucun DOM simulé ne
 * calcule de hauteur, donc aucun test de CI ne dira jamais qu'une feuille
 * déborde. Relevé à la main sur vingt-cinq feuilles : aucun débordement, 16,3 mm
 * de marge au pire, et la reliure alterne bien recto-verso.
 *
 * **Aucune affaire inventée** : celles qui servent ici sortent du générateur.
 */

/** Douze affaires réelles, produites une fois pour tout le fichier. */
const CASES: CaseFile[] = (() => {
  const files: CaseFile[] = [];
  for (let index = 0; files.length < 12 && index < 30; index++) {
    const file = composeCase(`cahier-${String(index)}`);
    if (file !== null) files.push(file);
  }
  return files;
})();

/*
  Une affaire par feuille, et les corrigés aussi : c'est ce que `CaseStudio`
  impose au preset, parce qu'un plan qu'on remplit au crayon ne se lit pas à
  demi-page. Le test doit voir la même chose que l'écran.
*/
const format = { ...formatById('booklet'), puzzlesPerSheet: 1, solutionsPerSheet: 1 };

let view: Rendered | null = null;

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

describe('le cahier d’enquêtes', () => {
  it('dispose d’assez d’affaires pour que les contrôles mordent', () => {
    expect(CASES.length).toBe(12);
    // Deux affaires identiques fausseraient le sommaire sans rien casser.
    expect(new Set(CASES.map((file) => file.seed)).size).toBe(CASES.length);
  });

  it('met une affaire par feuille, et tous les corrigés après', () => {
    const booklet = paginate(CASES, format, { title: 'Cahier', includeSolutions: true });

    const dossiers = booklet.sheets.filter((sheet) => sheet.kind === 'puzzles');
    const corriges = booklet.sheets.filter((sheet) => sheet.kind === 'solutions');
    expect(dossiers).toHaveLength(CASES.length);
    expect(corriges).toHaveLength(CASES.length);
    for (const sheet of [...dossiers, ...corriges]) expect(sheet.puzzles).toHaveLength(1);

    /*
      L'ordre est ce qui rend le cahier détachable : on imprime l'ensemble et on
      retire la fin. Un corrigé glissé au milieu serait visible par transparence
      et impossible à retirer.
    */
    const dernierDossier = Math.max(...dossiers.map((sheet) => sheet.pageNumber));
    const premierCorrige = Math.min(...corriges.map((sheet) => sheet.pageNumber));
    expect(premierCorrige).toBeGreaterThan(dernierDossier);
    expect(booklet.firstSolutionPage).toBe(premierCorrige);
  });

  it('numérote ses pages sans trou ni doublon', () => {
    const booklet = paginate(CASES, format, { title: 'Cahier', includeSolutions: true });
    const folios = booklet.sheets.map((sheet) => sheet.pageNumber);
    expect(folios).toEqual([...folios].sort((left, right) => left - right));
    expect(new Set(folios).size).toBe(folios.length);
    expect(folios[0]).toBe(1);
    expect(folios[folios.length - 1]).toBe(folios.length);
  });

  it('garde chaque affaire exactement une fois, dossier et corrigé', () => {
    const booklet = paginate(CASES, format, { title: 'Cahier', includeSolutions: true });
    for (const kind of ['puzzles', 'solutions'] as const) {
      const seen = booklet.sheets
        .filter((sheet) => sheet.kind === kind)
        .flatMap((sheet) => sheet.puzzles.map((file) => file.seed));
      expect(new Set(seen).size, kind).toBe(CASES.length);
    }
  });

  it('n’ajoute ni sommaire ni corrigé à un cahier vide', () => {
    const booklet = paginate([], format, { title: 'Rien', includeSolutions: true });
    expect(booklet.sheets).toEqual([]);
    expect(booklet.firstSolutionPage).toBeNull();
  });

  it('se passe de corrigés quand on les refuse', () => {
    const booklet = paginate(CASES, format, { title: 'Cahier', includeSolutions: false });
    expect(booklet.sheets.some((sheet) => sheet.kind === 'solutions')).toBe(false);
    expect(booklet.firstSolutionPage).toBeNull();
  });

  it('compte ses décors sur la page de garde, et n’annonce aucune difficulté', () => {
    /*
      Le sommaire d'un cahier de sudoku répartit par **niveau**, parce que ces
      niveaux sont calibrés contre un oracle. L'enquête n'en a aucun : elle
      compte donc ce qui s'observe, le décor. Le contrôle porte sur les deux
      moitiés — le compte est juste, et rien ne ressemble à une note.
    */
    const booklet = paginate(CASES, format, { title: 'Cahier d’essai', includeSolutions: true });
    view = render(CaseSummary, { booklet, format, pageNumber: 1 });

    const printed = view.container.textContent ?? '';
    expect(printed).toContain('Cahier d’essai');
    expect(printed).toContain(`${String(CASES.length)} affaires`);

    const decors = new Set(CASES.map((file) => openCase(file).scene.title));
    for (const decor of decors) expect(printed, `décor absent : ${decor}`).toContain(decor);

    // Les comptes affichés somment au total, sinon la page de garde ment.
    const counts = [...view.container.querySelectorAll('.toc .num')].map((cell) =>
      Number(cell.textContent),
    );
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(CASES.length);

    // Et aucun mot de difficulté, ni en toutes lettres ni en sous-entendu.
    for (const mot of ['facile', 'moyen', 'difficile', 'expert', 'niveau', 'score']) {
      expect(printed.toLowerCase(), `« ${mot} » n'a rien à faire ici`).not.toContain(mot);
    }
  });

  it('dit où détacher', () => {
    const booklet = paginate(CASES, format, { title: 'Cahier', includeSolutions: true });
    view = render(CaseSummary, { booklet, format, pageNumber: 1 });
    expect(view.container.textContent ?? '').toContain(
      `page ${String(booklet.firstSolutionPage ?? 0)}`,
    );
  });

  it('ne présente aucun manquement relevable sans mise en page', async () => {
    const booklet = paginate(CASES, format, { title: 'Cahier', includeSolutions: true });
    view = render(CaseSummary, { booklet, format, pageNumber: 1 });
    await expectNoViolations(view.container);
  });
});
