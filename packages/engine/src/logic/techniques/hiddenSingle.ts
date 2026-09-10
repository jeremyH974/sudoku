import { SIZE, UNITS, formatCell, lowestDigit, maskOf } from '../../grid/index.js';
import type { Digit } from '../../grid/index.js';
import { unitName } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { LogicStateView, Step, TechniqueId } from '../types.js';

/**
 * Single caché : dans une unité, un chiffre n'a plus qu'une case possible.
 *
 * Sudoku Explainer en distingue trois cas, notés différemment, et c'est cette
 * distinction qui structure la recherche :
 *
 *   - **Dernière case** (1,0) — la case est la seule vide de son unité. Le plus
 *     évident des coups : il ne reste qu'un chiffre et qu'une place.
 *   - **Single caché en boîte** (1,2) — l'œil repère un bloc plus vite qu'une ligne.
 *   - **Single caché en ligne ou colonne** (1,5).
 *
 * L'énumération suit ces valeurs : un même coup trouvable à la fois en boîte et
 * en ligne doit être crédité 1,2 et non 1,5, sans quoi la note serait surévaluée.
 */

const BOX_UNITS: readonly number[] = UNITS.filter((u) => u.kind === 'box').map((u) => u.index);
const LINE_UNITS: readonly number[] = UNITS.filter((u) => u.kind !== 'box').map((u) => u.index);

function buildStep(
  technique: TechniqueId,
  label: string,
  difficulty: number,
  unitIndex: number,
  cell: number,
  digit: Digit,
  explanation: string,
): Step {
  return {
    technique,
    label,
    difficulty,
    units: [unitIndex],
    highlights: [{ cell, digits: maskOf(digit) }],
    placements: [{ cell, digit }],
    eliminations: [],
    explanation,
  };
}

/** Unités qui n'ont plus qu'une case vide. */
function* fullHouses(state: LogicStateView): Generator<Step> {
  for (const unit of UNITS) {
    const empties = state.emptyCellsOf(unit.index);
    if (empties.length !== 1) continue;

    const cell = empties[0];
    const mask = state.candidatesAt(cell);
    if (mask === 0) continue;
    // Une seule case vide : le chiffre manquant est forcément son seul candidat.
    const digit = lowestDigit(mask);

    yield buildStep(
      'full-house',
      'Dernière case',
      1.0,
      unit.index,
      cell,
      digit,
      `${formatCell(cell)} est la dernière case vide de ${unitName(unit.index)} : ` +
        `il ne reste que le ${String(digit)} à y placer.`,
    );
  }
}

function* singlesIn(
  state: LogicStateView,
  unitIndexes: readonly number[],
  technique: TechniqueId,
  label: string,
  difficulty: number,
): Generator<Step> {
  for (const unitIndex of unitIndexes) {
    for (let digit = 1 as Digit; digit <= SIZE; digit++) {
      const places = state.placesFor(unitIndex, digit);
      if (places.length !== 1) continue;

      const cell = places[0];
      yield buildStep(
        technique,
        label,
        difficulty,
        unitIndex,
        cell,
        digit,
        `Dans ${unitName(unitIndex)}, le chiffre ${String(digit)} n'a plus qu'une case ` +
          `possible : ${formatCell(cell)}.`,
      );
    }
  }
}

export const hiddenSingle = defineTechnique('hidden-single', function* (state) {
  yield* fullHouses(state);
  yield* singlesIn(state, BOX_UNITS, 'hidden-single-box', 'Single caché en boîte', 1.2);
  yield* singlesIn(state, LINE_UNITS, 'hidden-single-line', 'Single caché en ligne', 1.5);
});
