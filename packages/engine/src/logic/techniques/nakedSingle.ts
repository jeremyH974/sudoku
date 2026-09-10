import { CELL_COUNT, formatCell, isSingle, lowestDigit } from '../../grid/index.js';
import { defineTechnique } from '../technique.js';

/**
 * Single nu : une case n'a plus qu'un seul candidat.
 *
 * Noté 2,3 par Sudoku Explainer, donc **au-dessus** des singles cachés (1,0 à
 * 1,5). Cela surprend souvent, le single nu paraissant plus simple à énoncer ;
 * mais le repérer suppose d'avoir tenu à jour les candidats de la case, là où un
 * single caché se voit à l'œil dans une unité. Le barème mesure l'effort réel,
 * pas la simplicité de l'énoncé.
 */
export const nakedSingle = defineTechnique('naked-single', function* (state) {
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const mask = state.candidatesAt(cell);
    if (!isSingle(mask)) continue;

    const digit = lowestDigit(mask);
    yield {
      technique: 'naked-single',
      label: 'Single nu',
      difficulty: 2.3,
      units: [],
      highlights: [{ cell, digits: mask }],
      placements: [{ cell, digit }],
      eliminations: [],
      explanation:
        `Tous les autres chiffres sont déjà présents sur la ligne, la colonne ou la boîte ` +
        `de ${formatCell(cell)} : il ne lui reste que le ${String(digit)}.`,
    };
  }
});
