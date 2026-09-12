import type { Pruning } from './clues/propagate.js';
import {
  add,
  cellsOf,
  difference,
  emptySet,
  fullSet,
  type CellSet,
  intersects,
  intersection,
  isEmpty,
  isSubsetOf,
  union,
} from './scene/cellset.js';
import { columnOf, rowOf, type Scene } from './scene/types.js';

/**
 * La règle du plateau, indépendamment de toute affaire.
 *
 * Il y a autant de suspects que de rangées, et **un suspect par rangée et par
 * colonne**. Ce n'est pas un carré latin : la solution est une bijection entre
 * les personnes et les cases d'une matrice de permutation. La conséquence
 * pratique est qu'un raisonnement peut porter sur les rangées, sur les colonnes,
 * et sur rien d'autre — les pièces, elles, ne contraignent que par les indices.
 *
 * Toutes les déductions structurelles vivent ici, sous une forme unique : des
 * **sous-ensembles**. C'est la même unification que `locking` fait côté sudoku,
 * où une seule entrée du registre produit un Pointing ou un X-Wing selon son
 * degré, et elle tient pour la même raison — ce sont les mêmes deux théorèmes,
 * lus dans un sens ou dans l'autre.
 */

/** Au départ, chacun peut être n'importe où. Les indices font le reste. */
export function initialDomains(scene: Scene, count: number): CellSet[] {
  return Array.from({ length: count }, () => fullSet(scene.cellCount));
}

/** Un axe du plateau, et les tranches qui le découpent. */
export interface Axis {
  readonly axis: 'row' | 'column';
  readonly bands: readonly CellSet[];
}

export const axesOf = (scene: Scene): readonly Axis[] => [
  { axis: 'row', bands: scene.rows },
  { axis: 'column', bands: scene.columns },
];

/**
 * Ce qu'un sous-ensemble a conclu, avec de quoi l'expliquer.
 *
 * `degree` est le nombre de personnes (ou de tranches) en jeu : c'est lui qui
 * décide de la difficulté, comme le degré d'un Pointing ou d'un X-Wing.
 */
export interface Subset {
  readonly axis: 'row' | 'column';
  readonly hidden: boolean;
  readonly degree: number;
  /** Les suspects qui portent le raisonnement. */
  readonly suspects: readonly number[];
  /** Les tranches qui portent le raisonnement, par index. */
  readonly bands: readonly number[];
  readonly prunings: readonly Pruning[];
}

/**
 * Les sous-ensembles d'un degré donné, sur un axe donné.
 *
 * **Nu** (`hidden: false`) : `k` suspects dont les places possibles tiennent
 * dans `k` tranches. Ces tranches leur appartiennent, personne d'autre n'y va.
 *
 * **Caché** (`hidden: true`) : `k` tranches que seuls `k` suspects peuvent
 * occuper. Comme chaque tranche porte exactement une personne, ces `k` suspects
 * y sont confinés et ne peuvent aller nulle part ailleurs.
 *
 * Le degré 1 des deux formes est le pain quotidien du jeu : « quelqu'un est
 * placé, sa rangée et sa colonne se barrent » est un sous-ensemble nu de degré
 * 1, et « une seule personne peut encore occuper cette rangée » est le caché.
 */
export function* findSubsets(
  scene: Scene,
  domains: readonly CellSet[],
  degree: number,
  hidden: boolean,
): Generator<Subset> {
  const count = domains.length;

  for (const { axis, bands } of axesOf(scene)) {
    // Qui peut atteindre quelle tranche, en masques de bits : au plus seize
    // suspects et seize tranches, donc un entier suffit de chaque côté.
    const reach: number[] = domains.map((domain) =>
      bands.reduce(
        (mask, band, index) => (intersects(domain, band) ? mask | (1 << index) : mask),
        0,
      ),
    );
    const takers: number[] = bands.map((band) =>
      domains.reduce(
        (mask, domain, suspect) => (intersects(domain, band) ? mask | (1 << suspect) : mask),
        0,
      ),
    );

    const members = hidden ? takers : reach;
    const memberCount = hidden ? bands.length : count;

    for (const group of combinations(memberCount, degree)) {
      let together = 0;
      for (const member of group) together |= members[member];
      if (bitCount(together) !== degree) continue;

      const subset = hidden
        ? confineToBands(scene, domains, bands, axis, group, together)
        : reserveBands(scene, domains, bands, axis, group, together);
      if (subset !== null) yield subset;
    }
  }
}

/** Nu : les tranches couvertes appartiennent au groupe ; les autres s'en retirent. */
function reserveBands(
  scene: Scene,
  domains: readonly CellSet[],
  bands: readonly CellSet[],
  axis: 'row' | 'column',
  group: readonly number[],
  covered: number,
): Subset | null {
  const taken = bandUnion(scene, bands, covered);
  const prunings: Pruning[] = [];
  for (let suspect = 0; suspect < domains.length; suspect++) {
    if (group.includes(suspect)) continue;
    const remove = intersection(domains[suspect], taken);
    if (!isEmpty(remove)) prunings.push({ suspect, remove });
  }
  if (prunings.length === 0) return null;
  return {
    axis,
    hidden: false,
    degree: group.length,
    suspects: [...group],
    bands: bitsOf(covered),
    prunings,
  };
}

/** Caché : les suspects concernés n'ont plus rien à faire hors de ces tranches. */
function confineToBands(
  scene: Scene,
  domains: readonly CellSet[],
  bands: readonly CellSet[],
  axis: 'row' | 'column',
  group: readonly number[],
  holders: number,
): Subset | null {
  const inside = bandUnion(
    scene,
    bands,
    group.reduce((mask, band) => mask | (1 << band), 0),
  );
  const prunings: Pruning[] = [];
  for (const suspect of bitsOf(holders)) {
    const remove = difference(domains[suspect], inside);
    if (!isEmpty(remove)) prunings.push({ suspect, remove });
  }
  if (prunings.length === 0) return null;
  return {
    axis,
    hidden: true,
    degree: group.length,
    suspects: bitsOf(holders),
    bands: [...group],
    prunings,
  };
}

/**
 * Ce qui suit un placement, et que personne n'appelle une déduction.
 *
 * Quand quelqu'un est posé, sa rangée et sa colonne se barrent — c'est le geste
 * automatique du jeu, celui que la référence du genre dessine en croix sans rien
 * annoncer. Le distinguer de `basicExclusion` n'est pas un détail : un suspect
 * **confiné** à une rangée sans y être posé, lui, est un vrai raisonnement, et
 * il doit rester une étape nommée du chemin plutôt que disparaître dans la
 * mécanique.
 */
export function placedExclusion(scene: Scene, domains: readonly CellSet[]): Pruning[] {
  const prunings: Pruning[] = [];
  for (let suspect = 0; suspect < domains.length; suspect++) {
    const cells = cellsOf(domains[suspect]);
    if (cells.length !== 1) continue;
    const taken = union(scene.rows[rowOf(scene, cells[0])], scene.columns[columnOf(scene, cells[0])]);
    for (let other = 0; other < domains.length; other++) {
      if (other === suspect) continue;
      const remove = intersection(domains[other], taken);
      if (!isEmpty(remove)) prunings.push({ suspect: other, remove });
    }
  }
  return prunings;
}

/**
 * La propagation de base : ce que le jeu fait tout seul, sans l'appeler une
 * déduction.
 *
 * C'est exactement le sous-ensemble nu de degré 1 — quelqu'un dont les places
 * possibles tiennent dans une seule rangée en chasse tout le monde. Il a sa
 * fonction à part parce que le solveur exact l'appelle à chaque nœud et n'a que
 * faire d'une explication.
 */
export function basicExclusion(scene: Scene, domains: readonly CellSet[]): Pruning[] {
  const prunings: Pruning[] = [];
  for (const { bands } of axesOf(scene)) {
    for (let suspect = 0; suspect < domains.length; suspect++) {
      const band = bands.find((candidate) => isSubsetOf(domains[suspect], candidate));
      if (band === undefined) continue;
      for (let other = 0; other < domains.length; other++) {
        if (other === suspect) continue;
        const remove = intersection(domains[other], band);
        if (!isEmpty(remove)) prunings.push({ suspect: other, remove });
      }
    }
  }
  return prunings;
}

/** Tous les suspects sont-ils réduits à une seule case ? */
export function isComplete(domains: readonly CellSet[]): boolean {
  return domains.every((domain) => cellsOf(domain).length === 1);
}

/** La disposition portée par des domaines tous singletons. */
export function assignmentOf(domains: readonly CellSet[]): number[] {
  return domains.map((domain) => cellsOf(domain)[0]);
}

function bandUnion(scene: Scene, bands: readonly CellSet[], mask: number): CellSet {
  let total = emptySet(scene.cellCount);
  for (const index of bitsOf(mask)) total = union(total, bands[index]);
  return total;
}

/** Les indices des bits à 1, par ordre croissant. */
function bitsOf(mask: number): number[] {
  const bits: number[] = [];
  let rest = mask;
  while (rest !== 0) {
    const low = rest & -rest;
    bits.push(31 - Math.clz32(low));
    rest ^= low;
  }
  return bits;
}

function bitCount(mask: number): number {
  let m = mask - ((mask >>> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
  return (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Les parties à `degree` éléments de `{0, …, size-1}`, par ordre lexicographique. */
function* combinations(size: number, degree: number): Generator<number[]> {
  if (degree > size) return;
  const chosen = Array.from({ length: degree }, (_, index) => index);
  for (;;) {
    yield [...chosen];
    let cursor = degree - 1;
    while (cursor >= 0 && chosen[cursor] === size - degree + cursor) cursor--;
    if (cursor < 0) return;
    chosen[cursor]++;
    for (let next = cursor + 1; next < degree; next++) chosen[next] = chosen[next - 1] + 1;
  }
}

/** Ajoute une case à un ensemble neuf. Utilitaire local, pour la lisibilité. */
export function singleton(scene: Scene, cell: number): CellSet {
  const set = emptySet(scene.cellCount);
  add(set, cell);
  return set;
}
