import { COL_OF, ROW_OF, SIZE, indexOf, maskOf } from '../../grid/index.js';
import type { Digit } from '../../grid/index.js';
import { combinations } from '../combinations.js';
import { enumerate } from '../explain.js';
import { defineTechnique } from '../technique.js';
import type { CellDigits, Elimination, LogicStateView, Step, TechniqueId } from '../types.js';

/**
 * Poissons : X-Wing, Swordfish, Jellyfish.
 *
 * Même raisonnement à trois tailles. Pour un chiffre donné, si N lignes le
 * confinent toutes aux mêmes N colonnes, alors ces N colonnes le placeront
 * forcément sur ces N lignes — il disparaît donc partout ailleurs dans ces
 * colonnes. Et réciproquement en échangeant lignes et colonnes.
 *
 * Barème Sudoku Explainer : X-Wing 3,2 · Swordfish 3,8 · Jellyfish 5,2.
 *
 * Note d'architecture : Sudoku Explainer traite les paires verrouillées et les
 * poissons dans une **même classe**, paramétrée par un degré — degré 1 donne
 * une paire pointante, degré 2 un X-Wing, et ainsi de suite. Nous les avons
 * séparés parce que les deux algorithmes ne se ressemblent pas une fois écrits,
 * et que la lisibilité prime ici ; les valeurs produites sont identiques.
 */

interface Variant {
  readonly id: TechniqueId;
  readonly label: string;
  readonly difficulty: number;
}

const VARIANTS: Record<number, Variant> = {
  2: { id: 'x-wing', label: 'X-Wing', difficulty: 3.2 },
  3: { id: 'swordfish', label: 'Swordfish', difficulty: 3.8 },
  4: { id: 'jellyfish', label: 'Jellyfish', difficulty: 5.2 },
};

type Orientation = 'rows' | 'columns';

const LINE_LABEL: Record<Orientation, [string, string]> = {
  rows: ['lignes', 'colonnes'],
  columns: ['colonnes', 'lignes'],
};

/** Index de l'unité correspondant à la n-ième ligne ou colonne. */
const unitOf = (orientation: Orientation, position: number): number =>
  orientation === 'rows' ? position : SIZE + position;

/** Cellule à l'intersection d'une base et d'une couverture. */
const cellOf = (orientation: Orientation, base: number, cover: number): number =>
  orientation === 'rows' ? indexOf(base, cover) : indexOf(cover, base);

/** Position transverse d'une cellule : sa colonne si les bases sont des lignes. */
const coverOf = (orientation: Orientation, cell: number): number =>
  orientation === 'rows' ? COL_OF[cell] : ROW_OF[cell];

function* fishOfSize(
  state: LogicStateView,
  size: number,
  orientation: Orientation,
): Generator<Step> {
  const variant = VARIANTS[size];
  const [baseWord, coverWord] = LINE_LABEL[orientation];

  for (let digit = 1 as Digit; digit <= SIZE; digit++) {
    // Lignes de base retenues : celles où le chiffre garde entre 2 et N places.
    // Une seule place serait un single caché, plus simple et déjà traité.
    const bases: { position: number; covers: number[] }[] = [];
    for (let position = 0; position < SIZE; position++) {
      const places = state.placesFor(unitOf(orientation, position), digit);
      if (places.length >= 2 && places.length <= size) {
        bases.push({ position, covers: places.map((cell) => coverOf(orientation, cell)) });
      }
    }
    if (bases.length < size) continue;

    for (const combo of combinations(bases, size)) {
      const covers = new Set<number>();
      for (const base of combo) {
        for (const cover of base.covers) covers.add(cover);
      }
      if (covers.size !== size) continue;

      const basePositions = combo.map((base) => base.position);
      const baseSet = new Set(basePositions);

      const eliminations: Elimination[] = [];
      const highlights: CellDigits[] = [];
      for (const cover of covers) {
        for (let position = 0; position < SIZE; position++) {
          const cell = cellOf(orientation, position, cover);
          if ((state.candidatesAt(cell) & maskOf(digit)) === 0) continue;
          if (baseSet.has(position)) {
            highlights.push({ cell, digits: maskOf(digit) });
          } else {
            eliminations.push({ cell, digit });
          }
        }
      }
      if (eliminations.length === 0) continue;

      const baseNames = basePositions.map((p) => String(p + 1));
      const coverNames = [...covers].sort((a, b) => a - b).map((c) => String(c + 1));

      yield {
        technique: variant.id,
        label: variant.label,
        difficulty: variant.difficulty,
        units: basePositions.map((p) => unitOf(orientation, p)),
        highlights,
        placements: [],
        eliminations,
        explanation:
          `Sur les ${baseWord} ${enumerate(baseNames)}, le chiffre ${String(digit)} ne peut ` +
          `se placer que dans les ${coverWord} ${enumerate(coverNames)}. Ces ${String(size)} ` +
          `${coverWord} lui sont donc réservées sur ces ${baseWord} : il disparaît de leurs ` +
          `autres cases.`,
      };
    }
  }
}

const define = (size: number) =>
  defineTechnique(VARIANTS[size].id, function* (state) {
    yield* fishOfSize(state, size, 'rows');
    yield* fishOfSize(state, size, 'columns');
  });

export const xWing = define(2);
export const swordfish = define(3);
export const jellyfish = define(4);
