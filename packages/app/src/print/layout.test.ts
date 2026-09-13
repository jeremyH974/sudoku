import { describe, expect, it } from 'vitest';
import { decodeGrid, encodeGrid, formatGrid, generatePuzzle, gridLabel, rate } from '@sudoku/engine';
import { paginate, summarise } from './layout.js';
import type { PrintablePuzzle } from './layout.js';
import { PRINT_FORMATS, effectiveMargins, formatById, paperById } from './presets.js';

/** Fabrique un cahier de test à partir de vraies grilles générées. */
function makePuzzles(count: number): PrintablePuzzle[] {
  return Array.from({ length: count }, (_, i) => {
    const { puzzle, solution } = generatePuzzle({ seed: `cahier-${String(i)}`, minClues: 34 });
    const rating = rate(puzzle);
    return {
      index: i + 1,
      puzzle: [...puzzle],
      solution: [...solution],
      level: rating.level ?? 'facile',
      levelLabel: rating.level === 'moyen' ? 'Moyen' : 'Facile',
      score: rating.score,
      label: gridLabel(puzzle),
      code: encodeGrid(puzzle),
    };
  });
}

const standard = formatById('standard');
const booklet = formatById('booklet');

describe('paginate', () => {
  it('place une grille par page au format standard', () => {
    const sheets = paginate(makePuzzles(5), standard, {
      title: 'Test',
      includeSolutions: false,
    }).sheets;
    expect(sheets).toHaveLength(5);
    expect(sheets.every((s) => s.kind === 'puzzles')).toBe(true);
    expect(sheets.map((s) => s.pageNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('met tous les corrigés APRÈS toutes les grilles', () => {
    // C'est ce qui rend le cahier séparable : intercaler les corrigés les
    // rendrait visibles par transparence et impossibles à détacher.
    const { sheets } = paginate(makePuzzles(8), standard, {
      title: 'Test',
      includeSolutions: true,
    });
    const lastPuzzleSheet = sheets.findLastIndex((s) => s.kind === 'puzzles');
    const firstSolutionSheet = sheets.findIndex((s) => s.kind === 'solutions');
    expect(firstSolutionSheet).toBeGreaterThan(lastPuzzleSheet);
  });

  it('groupe les corrigés, plus petits, à plusieurs par page', () => {
    const { sheets } = paginate(makePuzzles(12), standard, {
      title: 'Test',
      includeSolutions: true,
    });
    const solutionSheets = sheets.filter((s) => s.kind === 'solutions');
    expect(solutionSheets).toHaveLength(2); // 12 corrigés à 6 par page
    expect(solutionSheets[0]!.puzzles).toHaveLength(6);
  });

  it('indique où détacher', () => {
    const withSolutions = paginate(makePuzzles(4), standard, {
      title: 'Test',
      includeSolutions: true,
    });
    expect(withSolutions.firstSolutionPage).toBe(5);

    const without = paginate(makePuzzles(4), standard, {
      title: 'Test',
      includeSolutions: false,
    });
    expect(without.firstSolutionPage).toBeNull();
  });

  it('numérote les pages sans trou ni doublon', () => {
    const { sheets } = paginate(makePuzzles(9), booklet, {
      title: 'Test',
      includeSolutions: true,
    });
    const numbers = sheets.map((s) => s.pageNumber);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
  });

  it('ajoute un sommaire en cahier relié, pas en standard', () => {
    const bookletSheets = paginate(makePuzzles(3), booklet, {
      title: 'Test',
      includeSolutions: false,
    }).sheets;
    expect(bookletSheets[0]!.kind).toBe('summary');

    const standardSheets = paginate(makePuzzles(3), standard, {
      title: 'Test',
      includeSolutions: false,
    }).sheets;
    expect(standardSheets[0]!.kind).toBe('puzzles');
  });

  it('ne produit ni sommaire ni corrigés pour un cahier vide', () => {
    const empty = paginate([], booklet, { title: 'Vide', includeSolutions: true });
    expect(empty.sheets).toHaveLength(0);
    expect(empty.firstSolutionPage).toBeNull();
  });

  it('conserve chaque grille exactement une fois', () => {
    const puzzles = makePuzzles(7);
    const { sheets } = paginate(puzzles, standard, { title: 'Test', includeSolutions: true });
    const onPuzzleSheets = sheets.filter((s) => s.kind === 'puzzles').flatMap((s) => s.puzzles);
    const onSolutionSheets = sheets.filter((s) => s.kind === 'solutions').flatMap((s) => s.puzzles);
    expect(onPuzzleSheets.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(onSolutionSheets.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('marge de reliure', () => {
  it('alterne le côté selon la parité de la page', () => {
    // Sans alternance, une page sur deux verrait son contenu disparaître dans
    // la pliure une fois le cahier assemblé.
    const recto = effectiveMargins(booklet, 1);
    const verso = effectiveMargins(booklet, 2);
    expect(recto.left).toBeGreaterThan(recto.right);
    expect(verso.right).toBeGreaterThan(verso.left);
    expect(recto.left).toBe(verso.right);
  });

  it('ne décale rien quand aucune reliure n’est prévue', () => {
    expect(effectiveMargins(standard, 1)).toEqual(standard.margins);
    expect(effectiveMargins(standard, 2)).toEqual(standard.margins);
  });
});

describe('presets', () => {
  it('expose deux formats, avec un repli sûr', () => {
    expect(PRINT_FORMATS).toHaveLength(2);
    expect(formatById('standard').id).toBe('standard');
    expect(paperById('letter').css).toBe('letter');
  });

  it('décrit chaque format par son usage', () => {
    for (const format of PRINT_FORMATS) {
      expect(format.description.length).toBeGreaterThan(40);
      expect(format.puzzlesPerSheet).toBeGreaterThan(0);
      expect(format.solutionsPerSheet).toBeGreaterThan(0);
    }
  });
});

describe('summarise', () => {
  it('compte les grilles par niveau', () => {
    const rows = summarise(makePuzzles(6), (puzzle) => puzzle.levelLabel);
    expect(rows.reduce((total, row) => total + row.count, 0)).toBe(6);
  });
});

describe('le pont papier vers écran', () => {
  it('le code imprimé redonne exactement la grille imprimée', () => {
    // Le moat n°2 réduit à une assertion : ce qui est sur le papier et ce qui
    // s'ouvre à l'écran doivent être la même grille, avec la même difficulté.
    for (const printable of makePuzzles(10)) {
      const decoded = decodeGrid(printable.code);
      expect(formatGrid(decoded)).toBe(formatGrid(Uint8Array.from(printable.puzzle)));
      expect(rate(decoded).score).toBe(printable.score);
    }
  });

  it('donne à chaque grille du cahier une étiquette distincte', () => {
    const labels = makePuzzles(30).map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
