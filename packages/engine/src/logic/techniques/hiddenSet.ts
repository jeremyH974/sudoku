import { SIZE, UNITS, forEachDigit, maskOfAll } from '../../grid/index.js';
import type { Digit } from '../../grid/index.js';
import { combinations } from '../combinations.js';
import { cellsPhrase, digitList, unitName } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { CellDigits, Elimination, LogicStateView, Step, TechniqueId } from '../types.js';

/**
 * Sous-ensemble caché : dans une unité, N chiffres ne se placent que dans N
 * cases.
 *
 * Ces N cases leur sont alors réservées, et **tous leurs autres candidats
 * disparaissent**. C'est le miroir exact du sous-ensemble nu — on raisonne sur
 * les chiffres au lieu des cases — mais il est nettement plus dur à repérer à
 * l'œil, d'où une note plus élevée à taille égale.
 *
 * Barème Sudoku Explainer : paire 3,4 · triplet 4,0 · quadruplet 5,4.
 * (À comparer aux 3,0 / 3,6 / 5,0 des sous-ensembles nus.)
 */

interface Variant {
  readonly id: TechniqueId;
  readonly label: string;
  readonly difficulty: number;
}

const VARIANTS: Record<number, Variant> = {
  2: { id: 'hidden-pair', label: 'Paire cachée', difficulty: 3.4 },
  3: { id: 'hidden-triple', label: 'Triplet caché', difficulty: 4.0 },
  4: { id: 'hidden-quad', label: 'Quadruplet caché', difficulty: 5.4 },
};

export function* hiddenSetsOfSize(state: LogicStateView, size: number): Generator<Step> {
  const variant = VARIANTS[size];

  for (const unit of UNITS) {
    // Un chiffre qui n'a qu'une place est un single caché : moins cher, et déjà
    // traité en amont du registre.
    const digits: Digit[] = [];
    const placesOf = new Map<Digit, number[]>();
    for (let digit = 1 as Digit; digit <= SIZE; digit++) {
      const places = state.placesFor(unit.index, digit);
      if (places.length >= 2 && places.length <= size) {
        digits.push(digit);
        placesOf.set(digit, places);
      }
    }
    if (digits.length < size) continue;

    for (const combo of combinations(digits, size)) {
      const cells = new Set<number>();
      for (const digit of combo) {
        for (const cell of placesOf.get(digit)!) cells.add(cell);
      }
      if (cells.size !== size) continue;

      const mask = maskOfAll(combo);
      const eliminations: Elimination[] = [];
      for (const cell of cells) {
        const extra = state.candidatesAt(cell) & ~mask;
        forEachDigit(extra, (digit) => eliminations.push({ cell, digit }));
      }
      // Les cases ne portaient déjà rien d'autre : le motif n'apprend rien.
      if (eliminations.length === 0) continue;

      const group = [...cells].sort((a, b) => a - b);
      const highlights: CellDigits[] = group.map((cell) => ({ cell, digits: mask }));

      yield {
        technique: variant.id,
        label: variant.label,
        difficulty: variant.difficulty,
        units: [unit.index],
        highlights,
        placements: [],
        eliminations,
        explanation:
          `Dans ${unitName(unit.index)}, ${digitList([...combo])} ne peuvent se placer que ` +
          `dans ${cellsPhrase(group)}. Ces ${String(size)} cases leur sont donc réservées : ` +
          `leurs autres candidats peuvent être écartés.`,
      };
    }
  }
}

export const hiddenPair = defineTechnique('hidden-pair', (state) => hiddenSetsOfSize(state, 2));
export const hiddenTriple = defineTechnique('hidden-triple', (state) => hiddenSetsOfSize(state, 3));
export const hiddenQuad = defineTechnique('hidden-quad', (state) => hiddenSetsOfSize(state, 4));
