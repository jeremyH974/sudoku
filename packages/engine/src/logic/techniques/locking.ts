import { BOX_OF, COL_OF, ROW_OF, SIZE, UNITS, indexOf } from '../../grid/index.js';
import type { Digit } from '../../grid/index.js';
import { cellsPhrase, unitName } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { Elimination, LogicStateView, Step, TechniqueId } from '../types.js';

/**
 * Candidats verrouillés : dans une unité, un chiffre est confiné à
 * l'intersection avec une autre unité. Il disparaît alors du reste de celle-ci.
 *
 * Deux sens de lecture, notés différemment par Sudoku Explainer :
 *
 *   - **Paire pointante** (2,6) — le chiffre est confiné, dans une boîte, à une
 *     seule ligne ou colonne. Il quitte le reste de cette ligne ou colonne.
 *   - **Paire revendiquée** (2,8) — le chiffre est confiné, dans une ligne ou
 *     colonne, à une seule boîte. Il quitte le reste de cette boîte.
 *
 * C'est la première technique qui n'apprend rien à elle seule : elle ne pose
 * aucune valeur, elle écarte des candidats. C'est le passage du sudoku « à
 * l'œil » au sudoku « aux notes ».
 */

const BOX_UNITS = UNITS.filter((u) => u.kind === 'box');
const LINE_UNITS = UNITS.filter((u) => u.kind !== 'box');

function buildStep(
  technique: TechniqueId,
  label: string,
  difficulty: number,
  digit: Digit,
  fromUnit: number,
  toUnit: number,
  places: readonly number[],
  eliminations: readonly Elimination[],
): Step {
  return {
    technique,
    label,
    difficulty,
    units: [fromUnit, toUnit],
    highlights: places.map((cell) => ({ cell, digits: 1 << (digit - 1) })),
    placements: [],
    eliminations,
    explanation:
      `Dans ${unitName(fromUnit)}, le chiffre ${String(digit)} ne peut aller que dans ` +
      `${cellsPhrase(places)}, qui appartiennent toutes à ${unitName(toUnit)}. ` +
      `Le ${String(digit)} y est donc verrouillé et disparaît des autres cases ` +
      `de ${unitName(toUnit).replace(/^la /, '')}.`,
  };
}

function collect(
  state: LogicStateView,
  targetUnit: number,
  digit: Digit,
  exclude: ReadonlySet<number>,
): Elimination[] {
  const eliminations: Elimination[] = [];
  for (const cell of state.placesFor(targetUnit, digit)) {
    if (!exclude.has(cell)) eliminations.push({ cell, digit });
  }
  return eliminations;
}

/** Chiffre confiné, dans une boîte, à une seule ligne ou colonne. */
function* pointing(state: LogicStateView): Generator<Step> {
  for (const box of BOX_UNITS) {
    for (let digit = 1 as Digit; digit <= SIZE; digit++) {
      const places = state.placesFor(box.index, digit);
      if (places.length < 2) continue; // une seule place : c'est un single caché

      const rows = new Set(places.map((cell) => ROW_OF[cell]));
      const cols = new Set(places.map((cell) => COL_OF[cell]));
      const excluded = new Set(places);

      if (rows.size === 1) {
        const lineUnit = [...rows][0]; // les lignes occupent les index 0 à 8
        const eliminations = collect(state, lineUnit, digit, excluded);
        if (eliminations.length > 0) {
          yield buildStep(
            'pointing',
            'Paire pointante',
            2.6,
            digit,
            box.index,
            lineUnit,
            places,
            eliminations,
          );
        }
      }

      if (cols.size === 1) {
        const lineUnit = SIZE + [...cols][0]; // les colonnes occupent 9 à 17
        const eliminations = collect(state, lineUnit, digit, excluded);
        if (eliminations.length > 0) {
          yield buildStep(
            'pointing',
            'Paire pointante',
            2.6,
            digit,
            box.index,
            lineUnit,
            places,
            eliminations,
          );
        }
      }
    }
  }
}

/** Chiffre confiné, dans une ligne ou colonne, à une seule boîte. */
function* claiming(state: LogicStateView): Generator<Step> {
  for (const line of LINE_UNITS) {
    for (let digit = 1 as Digit; digit <= SIZE; digit++) {
      const places = state.placesFor(line.index, digit);
      if (places.length < 2) continue;

      const boxes = new Set(places.map((cell) => BOX_OF[cell]));
      if (boxes.size !== 1) continue;

      const boxUnit = 2 * SIZE + [...boxes][0]; // les boîtes occupent 18 à 26
      const eliminations = collect(state, boxUnit, digit, new Set(places));
      if (eliminations.length === 0) continue;

      yield buildStep(
        'claiming',
        'Paire revendiquée',
        2.8,
        digit,
        line.index,
        boxUnit,
        places,
        eliminations,
      );
    }
  }
}

export const locking = defineTechnique('locking', function* (state) {
  yield* pointing(state);
  yield* claiming(state);
});

/** Exporté pour les tests : vérifie la correspondance index d'unité / géométrie. */
export const unitIndexOfCell = {
  row: (cell: number): number => ROW_OF[cell],
  column: (cell: number): number => SIZE + COL_OF[cell],
  box: (cell: number): number => 2 * SIZE + BOX_OF[cell],
  cellAt: indexOf,
};
