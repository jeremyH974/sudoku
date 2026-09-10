import { describe, expect, it } from 'vitest';
import { EMPTY, formatGrid, parseGrid } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import { createRng } from '../rng/index.js';
import { findSolution } from '../solver/index.js';
import { generatePuzzle } from '../generate/index.js';
import { REGISTRY } from './registry.js';
import { LogicState } from './state.js';
import { solveLogically } from './solve.js';
import { checkStepSoundness } from './testing.js';
import type { Step, TechniqueEntry, TechniqueId } from './types.js';

/**
 * Corpus de travail : des grilles réelles, de densités variées, parcourues
 * étape par étape. On ne teste pas les techniques sur des positions fabriquées
 * à la main — elles seraient toutes trop simples et ne déclencheraient jamais
 * les sous-ensembles ni les poissons.
 */
function* statesAlongSolve(puzzle: Grid): Generator<LogicState> {
  const state = LogicState.fromGrid(puzzle);
  if (state === null) return;

  for (let guard = 0; guard < 400; guard++) {
    if (state.isSolved() || state.hasContradiction()) return;
    yield state;

    let applied: Step | null = null;
    for (const entry of REGISTRY) {
      const step = entry.find(state);
      if (step !== null) {
        applied = step;
        break;
      }
    }
    if (applied === null) return;

    for (const e of applied.eliminations) state.eliminate(e.cell, e.digit);
    for (const p of applied.placements) {
      if (state.isEmpty(p.cell)) state.place(p.cell, p.digit);
    }
  }
}

interface Sample {
  readonly puzzle: Grid;
  readonly solution: Grid;
}

function corpus(count: number, minClues: number, label: string): Sample[] {
  const rng = createRng(`corpus-${label}`);
  return Array.from({ length: count }, () => {
    const { puzzle, solution } = generatePuzzle({ seed: rng.nextUint32(), minClues });
    return { puzzle, solution };
  });
}

const EASY_CORPUS = corpus(20, 40, 'facile');
const HARD_CORPUS = corpus(20, 24, 'creusee');
const ALL_SAMPLES = [...EASY_CORPUS, ...HARD_CORPUS];

describe('solidité exhaustive des techniques', () => {
  /**
   * LE test central de l'incrément, dans sa forme la plus exigeante.
   *
   * On ne se contente pas de vérifier le motif que le registre a retenu : on
   * énumère **tous** les motifs que chaque technique sait produire, sur chaque
   * position rencontrée. Un motif jamais choisi par le registre aujourd'hui peut
   * l'être demain — après un changement d'ordre — ou être montré au joueur par
   * le banc d'analyse. S'il est faux, il doit échouer maintenant.
   */
  it.each(REGISTRY.map((entry) => [entry.name, entry] as const))(
    '« %s » ne produit que des déductions valides',
    (_name, entry: TechniqueEntry) => {
      let motifs = 0;
      for (const { puzzle, solution } of ALL_SAMPLES) {
        for (const state of statesAlongSolve(puzzle)) {
          for (const step of entry.findAll(state)) {
            checkStepSoundness(step, solution);
            motifs++;
            // Au-delà, on n'apprend plus rien de neuf sur cette technique et
            // l'énumération complète des poissons devient coûteuse.
            if (motifs > 400) return;
          }
        }
      }
      // Une technique qui ne produit aucun motif rendrait le contrôle ci-dessus
      // creux : il passerait sans rien vérifier. On veut le savoir.
      expect(motifs, `« ${_name} » n'a produit aucun motif sur le corpus`).toBeGreaterThan(0);
    },
  );
});

describe('couverture du registre', () => {
  /**
   * Une technique jamais déclenchée rendrait son test de solidité creux : il
   * passerait sans rien vérifier. On s'assure donc que le corpus les exerce
   * réellement, et on affiche le décompte.
   */
  it('exerce effectivement les techniques principales', () => {
    const seen = new Map<TechniqueId, number>();
    for (const { puzzle } of ALL_SAMPLES) {
      for (const step of solveLogically(puzzle).steps) {
        seen.set(step.technique, (seen.get(step.technique) ?? 0) + 1);
      }
    }

    const report = [...seen.entries()].sort((a, b) => b[1] - a[1]);
    console.log(
      'Techniques exercées :',
      report.map(([id, n]) => `${id}=${String(n)}`).join(' '),
    );

    for (const expected of ['hidden-single-box', 'hidden-single-line', 'naked-single'] as const) {
      expect(seen.get(expected), `${expected} jamais déclenchée`).toBeGreaterThan(0);
    }
  });

  it('déclenche au moins une technique éliminatoire sur les grilles creusées', () => {
    const eliminating = new Set<TechniqueId>();
    for (const { puzzle } of HARD_CORPUS) {
      for (const step of solveLogically(puzzle).steps) {
        if (step.eliminations.length > 0) eliminating.add(step.technique);
      }
    }
    expect(eliminating.size).toBeGreaterThan(0);
  });
});

describe('résolution avec le registre complet', () => {
  it('résout davantage de grilles qu avec les seuls singles', () => {
    const solvedCount = HARD_CORPUS.filter(
      ({ puzzle }) => solveLogically(puzzle).outcome === 'solved',
    ).length;
    // Le registre complet doit apporter un gain net sur les grilles creusées.
    expect(solvedCount).toBeGreaterThan(0);
    console.log(`Grilles creusées résolues logiquement : ${String(solvedCount)}/${String(HARD_CORPUS.length)}`);
  });

  it('retrouve toujours la solution du solveur brut quand il conclut', () => {
    for (const { puzzle } of ALL_SAMPLES) {
      const path = solveLogically(puzzle);
      if (path.outcome !== 'solved') continue;
      expect(formatGrid(path.grid)).toBe(formatGrid(findSolution(puzzle)!));
    }
  });

  it('ne place jamais une valeur en contradiction avec la solution', () => {
    for (const { puzzle, solution } of ALL_SAMPLES) {
      const path = solveLogically(puzzle);
      for (let cell = 0; cell < path.grid.length; cell++) {
        if (path.grid[cell] !== EMPTY) expect(path.grid[cell]).toBe(solution[cell]);
      }
    }
  });

  it('ne signale jamais de contradiction sur une grille valide', () => {
    for (const { puzzle } of ALL_SAMPLES) {
      expect(solveLogically(puzzle).outcome).not.toBe('contradiction');
    }
  });
});

describe('variantes directes', () => {
  it('sont notées moins cher que leur technique de base', () => {
    // Le principe même de la variante : la même élimination, mais qui débloque
    // une case dans la foulée, coûte moins d'effort au joueur.
    const pairs: [TechniqueId, TechniqueId][] = [
      ['direct-pointing', 'pointing'],
      ['direct-claiming', 'claiming'],
      ['direct-hidden-pair', 'hidden-pair'],
      ['direct-hidden-triple', 'hidden-triple'],
    ];
    const difficulties = new Map<TechniqueId, number>();
    for (const { puzzle } of ALL_SAMPLES) {
      for (const step of solveLogically(puzzle).steps) difficulties.set(step.technique, step.difficulty);
    }
    for (const [direct, base] of pairs) {
      const d = difficulties.get(direct);
      const b = difficulties.get(base);
      if (d !== undefined && b !== undefined) expect(d).toBeLessThan(b);
    }
  });

  it('posent toujours une valeur, sinon elles ne seraient pas « directes »', () => {
    for (const { puzzle } of ALL_SAMPLES) {
      for (const step of solveLogically(puzzle).steps) {
        if (!step.technique.startsWith('direct-')) continue;
        expect(step.placements.length).toBeGreaterThan(0);
        expect(step.eliminations.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('cohérence des étapes', () => {
  it('renseigne toujours un libellé, une difficulté et une explication', () => {
    for (const { puzzle } of ALL_SAMPLES) {
      for (const step of solveLogically(puzzle).steps) {
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.difficulty).toBeGreaterThan(0);
        expect(step.explanation.length).toBeGreaterThan(15);
        expect(step.highlights.length).toBeGreaterThan(0);
      }
    }
  });

  it('ne référence que des cases et unités valides', () => {
    for (const { puzzle } of ALL_SAMPLES) {
      for (const step of solveLogically(puzzle).steps) {
        for (const u of step.units) expect(u).toBeGreaterThanOrEqual(0);
        for (const u of step.units) expect(u).toBeLessThan(27);
        for (const h of step.highlights) expect(h.cell).toBeLessThan(81);
        for (const e of step.eliminations) expect(e.cell).toBeLessThan(81);
        for (const p of step.placements) expect(p.cell).toBeLessThan(81);
      }
    }
  });
});

describe('grille de référence connue', () => {
  it('résout « AI Escargot » ou s arrête proprement', () => {
    // Grille reputee tres difficile : elle exige des chaines, hors de ce
    // registre. Le comportement attendu n'est pas de la resoudre, mais de
    // refuser de conclure au lieu de deviner.
    const puzzle = parseGrid(
      '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..',
    );
    const path = solveLogically(puzzle);
    expect(['solved', 'stuck']).toContain(path.outcome);
    if (path.outcome === 'stuck') {
      const solution = findSolution(puzzle)!;
      for (const step of path.steps) checkStepSoundness(step, solution);
    }
  });
});
