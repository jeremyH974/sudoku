import { describe, expect, it } from 'vitest';
import {
  BOX_OF,
  CELL_COUNT,
  COL_OF,
  PEERS,
  PEERS_FLAT,
  PEER_COUNT,
  ROW_OF,
  UNITS,
  UNITS_OF_CELL,
  UNIT_COUNT,
  arePeers,
  indexOf,
} from './constants.js';

const allCells = Array.from({ length: CELL_COUNT }, (_, i) => i);

describe('geometrie de la grille', () => {
  it('compte 27 unites de 9 cellules distinctes', () => {
    expect(UNITS).toHaveLength(UNIT_COUNT);
    for (const unit of UNITS) {
      expect(unit.cells).toHaveLength(9);
      expect(new Set(unit.cells).size).toBe(9);
      for (const cell of unit.cells) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(CELL_COUNT);
      }
    }
  });

  it('couvre chaque cellule par exactement une ligne, une colonne et une boite', () => {
    for (const cell of allCells) {
      const units = UNITS_OF_CELL[cell].map((i) => UNITS[i]);
      expect(units).toHaveLength(3);
      expect(units.map((u) => u.kind).sort()).toEqual(['box', 'column', 'row']);
    }
  });

  it('fait correspondre ROW_OF / COL_OF / BOX_OF a la position des unites', () => {
    for (const cell of allCells) {
      const units = UNITS_OF_CELL[cell].map((i) => UNITS[i]);
      expect(units.find((u) => u.kind === 'row')!.position).toBe(ROW_OF[cell]);
      expect(units.find((u) => u.kind === 'column')!.position).toBe(COL_OF[cell]);
      expect(units.find((u) => u.kind === 'box')!.position).toBe(BOX_OF[cell]);
    }
  });

  it('donne exactement 20 pairs par cellule, sans elle-meme', () => {
    for (const cell of allCells) {
      expect(PEERS[cell]).toHaveLength(PEER_COUNT);
      expect(PEERS[cell]).not.toContain(cell);
      expect(new Set(PEERS[cell]).size).toBe(PEER_COUNT);
    }
  });

  it('a une relation de pair symetrique', () => {
    for (const cell of allCells) {
      for (const peer of PEERS[cell]) {
        expect(PEERS[peer]).toContain(cell);
      }
    }
  });

  it('fait coincider arePeers avec la table PEERS', () => {
    for (const a of allCells) {
      for (const b of allCells) {
        expect(arePeers(a, b)).toBe(PEERS[a].includes(b));
      }
    }
  });

  it('garde PEERS_FLAT synchronise avec PEERS', () => {
    for (const cell of allCells) {
      for (let i = 0; i < PEER_COUNT; i++) {
        expect(PEERS_FLAT[cell * PEER_COUNT + i]).toBe(PEERS[cell][i]);
      }
    }
  });

  it('indexe les cellules ligne par ligne', () => {
    expect(indexOf(0, 0)).toBe(0);
    expect(indexOf(0, 8)).toBe(8);
    expect(indexOf(8, 8)).toBe(80);
    expect(BOX_OF[indexOf(4, 4)]).toBe(4);
    expect(BOX_OF[indexOf(0, 8)]).toBe(2);
    expect(BOX_OF[indexOf(8, 0)]).toBe(6);
  });
});
