/**
 * Tables precalculees de la geometrie d'une grille 9x9.
 *
 * Tout le moteur passe par ces tables plutot que de recalculer ligne/colonne/
 * boite a la volee : c'est le chemin chaud du solveur, appele des millions de
 * fois par grille generee.
 *
 * Note d'extensibilite (variantes) : les hypotheses "9x9 classique" sont
 * concentrees ICI et dans `UNITS`. Une variante a geometrie differente
 * (Jigsaw, 6x6, 16x16) se ramene a fournir un autre jeu d'unites — le reste du
 * moteur ne connait que `UNITS`, `PEERS` et `UNITS_OF_CELL`.
 */

export const SIZE = 9;
export const CELL_COUNT = 81;
/** 9 lignes + 9 colonnes + 9 boites. */
export const UNIT_COUNT = 27;
/** Chaque cellule voit 8 cellules de sa ligne, 8 de sa colonne, 4 du reste de sa boite. */
export const PEER_COUNT = 20;

export const ROW_OF: Uint8Array = new Uint8Array(CELL_COUNT);
export const COL_OF: Uint8Array = new Uint8Array(CELL_COUNT);
export const BOX_OF: Uint8Array = new Uint8Array(CELL_COUNT);

for (let cell = 0; cell < CELL_COUNT; cell++) {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  ROW_OF[cell] = row;
  COL_OF[cell] = col;
  BOX_OF[cell] = Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

export const indexOf = (row: number, col: number): number => row * SIZE + col;

/** Nature d'une unite, utile pour nommer une technique dans un indice. */
export type UnitKind = 'row' | 'column' | 'box';

export interface UnitInfo {
  readonly index: number;
  readonly kind: UnitKind;
  /** Numero de la ligne / colonne / boite, de 0 a 8. */
  readonly position: number;
  readonly cells: readonly number[];
}

const buildUnits = (): readonly UnitInfo[] => {
  const units: UnitInfo[] = [];
  for (let r = 0; r < SIZE; r++) {
    units.push({
      index: units.length,
      kind: 'row',
      position: r,
      cells: Array.from({ length: SIZE }, (_, c) => indexOf(r, c)),
    });
  }
  for (let c = 0; c < SIZE; c++) {
    units.push({
      index: units.length,
      kind: 'column',
      position: c,
      cells: Array.from({ length: SIZE }, (_, r) => indexOf(r, c)),
    });
  }
  for (let b = 0; b < SIZE; b++) {
    const baseRow = Math.floor(b / 3) * 3;
    const baseCol = (b % 3) * 3;
    const cells: number[] = [];
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) cells.push(indexOf(baseRow + dr, baseCol + dc));
    }
    units.push({ index: units.length, kind: 'box', position: b, cells });
  }
  return units;
};

/** Les 27 unites, dans l'ordre : lignes 0-8, colonnes 9-17, boites 18-26. */
export const UNITS: readonly UnitInfo[] = buildUnits();

/** Pour chaque cellule, les index des 3 unites auxquelles elle appartient. */
export const UNITS_OF_CELL: readonly (readonly number[])[] = (() => {
  const table: number[][] = Array.from({ length: CELL_COUNT }, () => []);
  for (const unit of UNITS) {
    for (const cell of unit.cells) table[cell].push(unit.index);
  }
  return table;
})();

/**
 * Pour chaque cellule, les 20 cellules avec lesquelles elle ne peut pas
 * partager de valeur.
 */
export const PEERS: readonly (readonly number[])[] = (() => {
  const table: number[][] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const peers = new Set<number>();
    for (const unitIndex of UNITS_OF_CELL[cell]) {
      for (const other of UNITS[unitIndex].cells) {
        if (other !== cell) peers.add(other);
      }
    }
    table.push([...peers].sort((a, b) => a - b));
  }
  return table;
})();

/** Version plate des pairs, pour le chemin chaud : PEERS_FLAT[cell * 20 + i]. */
export const PEERS_FLAT: Uint8Array = (() => {
  const flat = new Uint8Array(CELL_COUNT * PEER_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const peers = PEERS[cell];
    for (let i = 0; i < PEER_COUNT; i++) flat[cell * PEER_COUNT + i] = peers[i];
  }
  return flat;
})();

/** `true` si les deux cellules partagent au moins une unite. */
export const arePeers = (a: number, b: number): boolean =>
  a !== b && (ROW_OF[a] === ROW_OF[b] || COL_OF[a] === COL_OF[b] || BOX_OF[a] === BOX_OF[b]);
