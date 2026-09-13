import { UNITS, countDigits, digitsOf, forEachDigit } from '../../grid/index.js';
import type { DigitMask } from '../../grid/index.js';
import { combinations } from '../combinations.js';
import { cellsPhrase, digitList, unitName } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { CellDigits, Elimination, LogicStateView, Step, TechniqueId } from '../types.js';

/**
 * Sous-ensemble nu : dans une unité, N cases ne contiennent à elles seules que
 * N chiffres différents.
 *
 * Ces N chiffres leur sont alors réservés — peu importe comment ils s'y
 * répartiront — et disparaissent des autres cases de l'unité.
 *
 * Barème Sudoku Explainer : paire 3,0 · triplet 3,6 · quadruplet 5,0.
 *
 * Subtilité d'implémentation : une case du motif peut avoir *moins* de N
 * candidats. Un triplet nu vaut aussi bien pour trois cases à {1,2,3} que pour
 * {1,2} + {2,3} + {1,3}. Ne retenir que les cases ayant exactement N candidats
 * ferait manquer la majorité des triplets et quadruplets réels.
 */

interface Variant {
  readonly size: number;
  readonly id: TechniqueId;
  readonly label: string;
  readonly difficulty: number;
}

const VARIANTS: Record<number, Variant> = {
  2: { size: 2, id: 'naked-pair', label: 'Paire nue', difficulty: 3.0 },
  3: { size: 3, id: 'naked-triple', label: 'Triplet nu', difficulty: 3.6 },
  4: { size: 4, id: 'naked-quad', label: 'Quadruplet nu', difficulty: 5.0 },
};

function* nakedSetsOfSize(state: LogicStateView, size: number): Generator<Step> {
  const variant = VARIANTS[size];

  for (const unit of UNITS) {
    // Une case avec un seul candidat est un single nu, traité bien avant et
    // moins cher : l'inclure ici produirait un doublon plus mal noté.
    const cells = unit.cells.filter((cell) => {
      const count = countDigits(state.candidatesAt(cell));
      return count >= 2 && count <= size;
    });
    if (cells.length < size) continue;

    /*
      Les victimes d'un sous-ensemble nu sont les **autres** cases de l'unité, et
      celles-là portent forcément plus de `size` candidats : le filtre ci-dessus
      vient donc de les écarter. Compter les cases retenues reviendrait à exiger
      qu'une victime soit elle-même un membre possible — ce qu'elle n'est jamais.

      Ce test portait sur `cells` jusqu'à l'incrément 18, et c'était un défaut :
      une colonne à quatre cases vides dont deux seulement tenaient en deux
      candidats était abandonnée, alors que la paire nue y éliminait bel et bien.
      La condition d'existence porte sur les cases **vides de l'unité**.
    */
    let unsolved = 0;
    for (const cell of unit.cells) if (state.isEmpty(cell)) unsolved++;
    if (unsolved <= size) continue;

    for (const combo of combinations(cells, size)) {
      let union: DigitMask = 0;
      for (const cell of combo) union |= state.candidatesAt(cell);
      if (countDigits(union) !== size) continue;

      const members = new Set(combo);
      const eliminations: Elimination[] = [];
      for (const cell of unit.cells) {
        if (members.has(cell)) continue;
        const shared = state.candidatesAt(cell) & union;
        forEachDigit(shared, (digit) => eliminations.push({ cell, digit }));
      }
      // Le motif existe mais n'apprend rien de neuf : inutile de le compter.
      if (eliminations.length === 0) continue;

      const group = [...combo];
      const highlights: CellDigits[] = group.map((cell) => ({
        cell,
        digits: state.candidatesAt(cell),
      }));

      yield {
        technique: variant.id,
        label: variant.label,
        difficulty: variant.difficulty,
        units: [unit.index],
        highlights,
        placements: [],
        eliminations,
        explanation:
          `Dans ${unitName(unit.index)}, ${cellsPhrase(group)} ne peuvent contenir que ` +
          `${digitList(digitsOf(union))}. Ces ${String(size)} chiffres leur sont donc ` +
          `réservés et disparaissent des autres cases de ${unitName(unit.index).replace(/^la /, '')}.`,
      };
    }
  }
}

export const nakedPair = defineTechnique('naked-pair', (state) => nakedSetsOfSize(state, 2));
export const nakedTriple = defineTechnique('naked-triple', (state) => nakedSetsOfSize(state, 3));
export const nakedQuad = defineTechnique('naked-quad', (state) => nakedSetsOfSize(state, 4));
