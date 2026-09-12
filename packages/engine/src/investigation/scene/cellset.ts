/**
 * Ensembles de cases, en bits.
 *
 * `grid/bitset.ts` fait la même chose pour les chiffres d'un sudoku, et tient
 * dans un `number` : neuf bits, largeur connue à la compilation. Ici la largeur
 * dépend du plateau — 36 bits en 6×6, 256 en 16×16 —, donc un mot de 32 bits ne
 * suffit plus et le type porte ses mots dans un `Uint32Array`.
 *
 * Le tableau porte sa propre taille : toutes les fonctions ci-dessous lisent
 * `.length` plutôt que de recevoir un `cellCount` qu'un appelant pourrait faire
 * mentir. Deux ensembles d'un même plateau ont donc toujours la même longueur,
 * et les opérations binaires n'ont rien à vérifier.
 */

/** Un ensemble de cases. Le bit `i` porte la case `i`. */
export type CellSet = Uint32Array;

/** Nombre de mots de 32 bits nécessaires pour `cellCount` cases. */
export const wordsFor = (cellCount: number): number => (cellCount + 31) >> 5;

export const emptySet = (cellCount: number): CellSet => new Uint32Array(wordsFor(cellCount));

/**
 * L'ensemble de toutes les cases.
 *
 * Le dernier mot est masqué : sans cela, les bits au-delà de `cellCount`
 * resteraient à 1 et `count()` renverrait jusqu'à 31 cases qui n'existent pas.
 */
export function fullSet(cellCount: number): CellSet {
  const set = emptySet(cellCount);
  set.fill(0xffffffff);
  const spare = cellCount & 31;
  if (spare !== 0) set[set.length - 1] = (1 << spare) - 1;
  return set;
}

export const cloneSet = (set: CellSet): CellSet => new Uint32Array(set);

export const has = (set: CellSet, cell: number): boolean =>
  (set[cell >> 5] & (1 << (cell & 31))) !== 0;

export function add(set: CellSet, cell: number): void {
  set[cell >> 5] |= 1 << (cell & 31);
}

export function remove(set: CellSet, cell: number): void {
  set[cell >> 5] &= ~(1 << (cell & 31));
}

/**
 * `target ← target \ other`. Renvoie `true` si au moins un bit est tombé.
 *
 * ⚠ La comparaison se fait **après** l'écriture, et ce n'est pas un style.
 *
 * Les opérateurs bit-à-bit de JavaScript rendent un entier **signé** : sur un
 * mot dont le bit 31 est posé, `target[w] & ~other[w]` vaut -2147483648 là où
 * le tableau, lui, contient 2147483648. Comparer les deux avant l'écriture
 * annonçait donc un changement à chaque passage sur la case 31, 63, 95… —
 * c'est-à-dire sur tout plateau d'au moins 32 cases, donc sur tous.
 *
 * La boucle de propagation s'arrête sur ce booléen : le défaut ne cassait rien
 * de visible, il faisait seulement tourner la propagation jusqu'à sa borne. Il
 * a été trouvé par la propriété qui compare cette valeur au compte réel.
 */
export function subtract(target: CellSet, other: CellSet): boolean {
  let changed = false;
  for (let w = 0; w < target.length; w++) {
    const before = target[w];
    target[w] &= ~other[w];
    if (target[w] !== before) changed = true;
  }
  return changed;
}

export function union(a: CellSet, b: CellSet): CellSet {
  const result = new Uint32Array(a.length);
  for (let w = 0; w < a.length; w++) result[w] = a[w] | b[w];
  return result;
}

export function intersection(a: CellSet, b: CellSet): CellSet {
  const result = new Uint32Array(a.length);
  for (let w = 0; w < a.length; w++) result[w] = a[w] & b[w];
  return result;
}

export function difference(a: CellSet, b: CellSet): CellSet {
  const result = new Uint32Array(a.length);
  for (let w = 0; w < a.length; w++) result[w] = a[w] & ~b[w];
  return result;
}

export function isEmpty(set: CellSet): boolean {
  for (let w = 0; w < set.length; w++) if (set[w] !== 0) return false;
  return true;
}

export function intersects(a: CellSet, b: CellSet): boolean {
  for (let w = 0; w < a.length; w++) if ((a[w] & b[w]) !== 0) return true;
  return false;
}

export function equals(a: CellSet, b: CellSet): boolean {
  for (let w = 0; w < a.length; w++) if (a[w] !== b[w]) return false;
  return true;
}

/** `a ⊆ b` ? */
export function isSubsetOf(a: CellSet, b: CellSet): boolean {
  for (let w = 0; w < a.length; w++) if ((a[w] & ~b[w]) !== 0) return false;
  return true;
}

/** Nombre de cases. Même compte SWAR que `countDigits`, mot par mot. */
export function count(set: CellSet): number {
  let total = 0;
  for (let w = 0; w < set.length; w++) {
    let m = set[w] - ((set[w] >>> 1) & 0x55555555);
    m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
    total += (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return total;
}

/** L'ensemble contient-il exactement une case ? */
export function isSingle(set: CellSet): boolean {
  let seen = false;
  for (let w = 0; w < set.length; w++) {
    const word = set[w];
    if (word === 0) continue;
    if (seen || (word & (word - 1)) !== 0) return false;
    seen = true;
  }
  return seen;
}

/** Plus petite case de l'ensemble, ou -1 s'il est vide. */
export function first(set: CellSet): number {
  for (let w = 0; w < set.length; w++) {
    const word = set[w];
    if (word !== 0) return (w << 5) + 31 - Math.clz32(word & -word);
  }
  return -1;
}

/** Les cases de l'ensemble, par ordre croissant. */
export function cellsOf(set: CellSet): number[] {
  const cells: number[] = [];
  for (let w = 0; w < set.length; w++) {
    let word = set[w];
    while (word !== 0) {
      const low = word & -word;
      cells.push((w << 5) + 31 - Math.clz32(low));
      word ^= low;
    }
  }
  return cells;
}

/** Parcourt les cases sans allouer de tableau. */
export function forEachCell(set: CellSet, visit: (cell: number) => void): void {
  for (let w = 0; w < set.length; w++) {
    let word = set[w];
    while (word !== 0) {
      const low = word & -word;
      visit((w << 5) + 31 - Math.clz32(low));
      word ^= low;
    }
  }
}

/** Construit un ensemble à partir de cases données. */
export function setOf(cellCount: number, cells: Iterable<number>): CellSet {
  const set = emptySet(cellCount);
  for (const cell of cells) add(set, cell);
  return set;
}
