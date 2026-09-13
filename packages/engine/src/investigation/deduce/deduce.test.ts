import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng/index.js';
import { composeCase } from '../compose/generate.js';
import { openCase } from '../case.js';
import { cellsOf } from '../scene/cellset.js';
import { solveExact } from '../exact/solver.js';
import { deduce } from './deduce.js';
import type { CaseFile, Puzzle } from '../types.js';

/**
 * La **solidité** du raisonnement, et non sa complétude.
 *
 * ─── Pourquoi ce fichier existe ─────────────────────────────────────────────
 *
 * `deduce.ts` affirme en tête qu'il « n'essaie jamais une case pour voir ».
 * C'était une affirmation, pas une propriété : rien ne la vérifiait. Le sudoku,
 * lui, tient la sienne depuis l'incrément 1 (`logic/testing.ts`), et son
 * commentaire dit pourquoi — vérifier qu'une grille finit résolue ne dit **rien**
 * de la justesse du chemin emprunté. Une technique qui écarterait une case pour
 * une mauvaise raison se rattraperait par les suivantes, et l'indice affiché au
 * joueur raconterait une explication fausse.
 *
 * ─── Et pourquoi elle est devenue porteuse de correction ────────────────────
 *
 * Tant que `carve` taillait contre un **comptage de solutions**, la solidité de
 * `deduce` n'engageait que la qualité des explications : le comptage restait la
 * ceinture. L'incrément 19 fait de `deduce` lui-même le témoin d'unicité —
 * une dérivation saine et complète ne peut désigner qu'une disposition. La
 * ceinture disparaît, et cette propriété-ci la remplace.
 *
 * ─── Le critère, et pourquoi il vaut aussi à mi-parcours ────────────────────
 *
 * Sur une affaire à solution unique **S** :
 *   - un placement doit coïncider avec `S` ;
 *   - une élimination ne doit jamais porter sur la case que `S` donne.
 *
 * Ce critère tient pour **tout sous-ensemble** des indices, et c'est ce qui le
 * rend utile ici : retirer des indices ne peut qu'agrandir l'ensemble des
 * dispositions compatibles, donc `S` reste une solution. Or c'est exactement le
 * régime que `carve` traverse — des jeux d'indices intermédiaires, de plus en
 * plus maigres. La propriété est donc éprouvée là où elle servira.
 */

/** Des affaires réelles : aucune affaire inventée, jamais. */
const CASES: CaseFile[] = (() => {
  const files: CaseFile[] = [];
  for (let index = 0; files.length < 12 && index < 40; index++) {
    const file = composeCase(`solidite-${String(index)}`);
    if (file !== null) files.push(file);
  }
  return files;
})();

/** Vérifie qu'aucune étape ne contredit la disposition `solution`. */
function checkSoundness(puzzle: Puzzle, solution: readonly number[], label: string): number {
  const path = deduce(puzzle);
  let steps = 0;
  for (const step of path.steps) {
    steps++;
    for (const placement of step.placements) {
      expect(
        placement.cell,
        `${label} · ${step.label} pose ${String(placement.suspect)} hors de la solution`,
      ).toBe(solution[placement.suspect]);
    }
    for (const elimination of step.eliminations) {
      const truth = solution[elimination.suspect];
      expect(
        cellsOf(elimination.cells).includes(truth),
        `${label} · ${step.label} écarte la vraie case de ${String(elimination.suspect)}`,
      ).toBe(false);
    }
  }
  return steps;
}

describe('la solidité du raisonnement', () => {
  it('dispose d’assez d’affaires pour que le contrôle morde', () => {
    // Le garde-fou du garde-fou : une liste vide ferait passer tout le reste.
    expect(CASES.length).toBeGreaterThanOrEqual(12);
  });

  it('ne pose jamais quelqu’un ailleurs que dans la solution', () => {
    let steps = 0;
    for (const file of CASES) {
      steps += checkSoundness(openCase(file), file.solution, file.seed);
    }
    expect(steps, 'aucune étape parcourue : le contrôle ne prouverait rien').toBeGreaterThan(100);
  });

  it('tient aussi sur des jeux d’indices incomplets', () => {
    /*
      Le régime de `carve` : des affaires volontairement sous-contraintes, qui
      ont souvent plusieurs dispositions compatibles. `S` en reste une, donc le
      critère garde son sens — et c'est précisément là qu'une technique trop
      hardie se trahirait, puisque rien ne l'oblige plus à conclure.
    */
    const rng = createRng('solidite-partielle');
    let tested = 0;
    for (const file of CASES) {
      const puzzle = openCase(file);
      for (let pass = 0; pass < 6; pass++) {
        const kept = file.clues.filter(() => rng.nextFloat() > 0.35);
        if (kept.length === 0) continue;
        tested++;
        checkSoundness({ ...puzzle, clues: kept }, file.solution, `${file.seed} · partiel`);
      }
    }
    expect(tested, 'aucun jeu partiel éprouvé').toBeGreaterThan(40);
  });

  it('ne conclut jamais sur une affaire qui a plusieurs dispositions', () => {
    /*
      La propriété sur laquelle repose la refonte de `carve` : **si une
      dérivation saine termine, la disposition est unique**. On l'éprouve dans
      le sens observable — chaque fois que `deduce` dit « résolu » sur un jeu
      d'indices amaigri, le solveur exact doit confirmer qu'il n'y avait
      effectivement qu'une seule disposition.
    */
    const rng = createRng('solidite-unicite');
    let confirmed = 0;
    for (const file of CASES) {
      const puzzle = openCase(file);
      for (let pass = 0; pass < 8; pass++) {
        const kept = file.clues.filter(() => rng.nextFloat() > 0.2);
        const path = deduce({ ...puzzle, clues: kept });
        if (!path.solved) continue;
        confirmed++;
        expect(
          solveExact({ ...puzzle, clues: kept }, 2).length,
          `${file.seed} : déduit mais pas unique`,
        ).toBe(1);
      }
    }
    expect(confirmed, 'aucune déduction complète observée').toBeGreaterThan(10);
  });
});
