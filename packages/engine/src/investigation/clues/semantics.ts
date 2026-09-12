import { add, emptySet, has, type CellSet } from '../scene/cellset.js';
import { cellHasProp } from '../scene/scene.js';
import { columnOf, rowOf, type Scene } from '../scene/types.js';
import type { Clue, Direction } from './types.js';

/**
 * La vérité d'un indice sur une disposition **complète**.
 *
 * C'est la définition de référence : tout le reste — les propagateurs, les
 * techniques, le générateur — doit s'y conformer, et les tests par propriété
 * vérifient exactement cela. Un propagateur qui élimine une case que `holds`
 * aurait acceptée est un bug ; l'inverse n'est qu'une propagation incomplète,
 * qui coûte du temps sans rendre l'affaire fausse.
 */
export function holds(clue: Clue, scene: Scene, at: readonly number[]): boolean {
  switch (clue.kind) {
    case 'on-prop':
      return cellHasProp(scene, at[clue.who], clue.prop) !== clue.not;

    case 'next-to-prop': {
      const beside = scene.cellsNextToProp.get(clue.prop);
      return (beside !== undefined && has(beside, at[clue.who])) !== clue.not;
    }

    case 'in-zone':
      return (scene.zoneOf[at[clue.who]] === clue.zone) !== clue.not;

    case 'in-band':
      return bandOf(scene, at[clue.who], clue.axis) === clue.index;

    case 'direction':
      return inDirection(scene, at[clue.who], at[clue.other], clue.direction, null);

    case 'offset':
      return inDirection(scene, at[clue.who], at[clue.other], clue.direction, clue.distance);

    case 'same-zone':
      return (scene.zoneOf[at[clue.who]] === scene.zoneOf[at[clue.other]]) !== clue.not;

    case 'alone':
      return occupantsOf(scene, at, scene.zoneOf[at[clue.who]]).length === 1;

    case 'alone-with': {
      const inside = occupantsOf(scene, at, scene.zoneOf[at[clue.who]]);
      return inside.length === 2 && inside.includes(clue.other);
    }

    case 'victim':
      return occupantsOf(scene, at, scene.zoneOf[at[clue.who]]).length === 2;
  }
}

/** Les suspects présents dans une pièce, pour une disposition complète. */
export function occupantsOf(scene: Scene, at: readonly number[], zone: number): number[] {
  const inside: number[] = [];
  for (let suspect = 0; suspect < at.length; suspect++) {
    if (scene.zoneOf[at[suspect]] === zone) inside.push(suspect);
  }
  return inside;
}

/**
 * Le meurtrier : la seule autre personne présente dans la pièce de la victime.
 *
 * Renvoie -1 si la pièce n'en contient pas exactement deux — c'est-à-dire si la
 * disposition viole l'indice de la victime. Aucune affaire n'est distribuée dans
 * cet état ; la vérification est là pour que le jour où ça arriverait, ce soit
 * un -1 visible et non un coupable inventé.
 */
export function murdererOf(scene: Scene, at: readonly number[], victim: number): number {
  const inside = occupantsOf(scene, at, scene.zoneOf[at[victim]]);
  if (inside.length !== 2) return -1;
  return inside[0] === victim ? inside[1] : inside[0];
}

/** Rangée ou colonne d'une case, selon l'axe. */
export const bandOf = (scene: Scene, cell: number, axis: 'row' | 'column'): number =>
  axis === 'row' ? rowOf(scene, cell) : columnOf(scene, cell);

/**
 * `from` est-elle dans la direction donnée depuis `to` ?
 *
 * `distance` à `null` signifie « strictement au nord », sans plus : la colonne
 * est libre. Un nombre exige l'écart exact — c'est le « exactement une rangée au
 * nord » du genre, qui est une contrainte bien plus forte.
 */
export function inDirection(
  scene: Scene,
  from: number,
  to: number,
  direction: Direction,
  distance: number | null,
): boolean {
  const delta = along(scene, from, to, direction);
  return distance === null ? delta > 0 : delta === distance;
}

/**
 * De combien `from` devance `to` dans cette direction.
 *
 * Le nord est vers le haut, donc vers les petits numéros de rangée : « au nord
 * de » est donc une soustraction à l'envers, et c'est le seul endroit du moteur
 * où cette inversion est écrite.
 */
function along(scene: Scene, from: number, to: number, direction: Direction): number {
  switch (direction) {
    case 'north':
      return rowOf(scene, to) - rowOf(scene, from);
    case 'south':
      return rowOf(scene, from) - rowOf(scene, to);
    case 'west':
      return columnOf(scene, to) - columnOf(scene, from);
    case 'east':
      return columnOf(scene, from) - columnOf(scene, to);
  }
}

/**
 * Les cases qu'un indice **unaire** autorise, indépendamment des autres.
 *
 * Renvoie `null` pour les indices qui parlent de quelqu'un d'autre ou de
 * l'occupation d'une pièce : ceux-là ne se réduisent pas à un ensemble fixe, et
 * se propagent dans `propagate.ts`.
 */
export function unaryCells(clue: Clue, scene: Scene): CellSet | null {
  switch (clue.kind) {
    case 'on-prop': {
      const bearing = scene.cellsWithProp.get(clue.prop) ?? emptySet(scene.cellCount);
      return polarity(scene, bearing, clue.not);
    }
    case 'next-to-prop': {
      const beside = scene.cellsNextToProp.get(clue.prop) ?? emptySet(scene.cellCount);
      return polarity(scene, beside, clue.not);
    }
    case 'in-zone':
      return polarity(scene, scene.zones[clue.zone].cells, clue.not);
    case 'in-band':
      return clue.axis === 'row' ? scene.rows[clue.index] : scene.columns[clue.index];
    default:
      return null;
  }
}

/** L'ensemble, ou son complément si l'indice est une négation. */
function polarity(scene: Scene, cells: CellSet, not: boolean): CellSet {
  if (!not) return cells;
  const complement = emptySet(scene.cellCount);
  for (let cell = 0; cell < scene.cellCount; cell++) if (!has(cells, cell)) add(complement, cell);
  return complement;
}
