import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cellsOf, count, has } from './cellset.js';
import { DECORS, loadDecor } from './decors.js';
import { buildScene, cellHasProp, cellLabel } from './scene.js';
import { columnOf, rowOf, type Decor, type Scene } from './types.js';

/**
 * Le décor compilé, vérifié contre sa propre définition.
 *
 * La géométrie de « à côté de » est le cœur du mode : orthogonal **et dans la
 * même pièce**. Elle est précalculée pour la vitesse, ce qui veut dire qu'elle
 * est écrite deux fois — une fois dans la compilation, une fois dans la règle.
 * Les deux doivent coïncider partout, et c'est exactement ce qu'on vérifie ici
 * plutôt que sur trois cases choisies à la main.
 */

const scenes = (): Scene[] => DECORS.map((decor) => buildScene(decor));

/** La règle, écrite naïvement. C'est elle qui fait foi. */
function neighboursByRule(scene: Scene, cell: number): number[] {
  const found: number[] = [];
  for (let other = 0; other < scene.cellCount; other++) {
    const sameZone = scene.zoneOf[other] === scene.zoneOf[cell];
    const rowGap = Math.abs(rowOf(scene, other) - rowOf(scene, cell));
    const columnGap = Math.abs(columnOf(scene, other) - columnOf(scene, cell));
    if (sameZone && rowGap + columnGap === 1) found.push(other);
  }
  return found;
}

describe('buildScene', () => {
  it('compile tous les décors livrés', () => {
    expect(DECORS.length).toBeGreaterThan(0);
    for (const decor of DECORS) expect(() => buildScene(decor)).not.toThrow();
  });

  it('partitionne le plateau : chaque case appartient à une pièce et une seule', () => {
    for (const scene of scenes()) {
      const total = scene.zones.reduce((sum, zone) => sum + zone.size, 0);
      expect(total).toBe(scene.cellCount);
      for (let cell = 0; cell < scene.cellCount; cell++) {
        const owners = scene.zones.filter((zone) => has(zone.cells, cell));
        expect(owners).toHaveLength(1);
        expect(owners[0].index).toBe(scene.zoneOf[cell]);
      }
    }
  });

  it('n’ouvre jamais un voisinage à travers un mur', () => {
    for (const scene of scenes()) {
      for (let cell = 0; cell < scene.cellCount; cell++) {
        expect(cellsOf(scene.neighbours[cell])).toEqual(neighboursByRule(scene, cell));
      }
    }
  });

  it('garde le voisinage symétrique', () => {
    for (const scene of scenes()) {
      for (let cell = 0; cell < scene.cellCount; cell++) {
        for (const neighbour of cellsOf(scene.neighbours[cell])) {
          expect(has(scene.neighbours[neighbour], cell)).toBe(true);
        }
      }
    }
  });

  it('précalcule « à côté d’un meuble » exactement comme la règle le dit', () => {
    for (const scene of scenes()) {
      for (const prop of scene.propsPresent) {
        const beside = scene.cellsNextToProp.get(prop);
        expect(beside).toBeDefined();
        for (let cell = 0; cell < scene.cellCount; cell++) {
          const byRule = neighboursByRule(scene, cell).some((neighbour) =>
            cellHasProp(scene, neighbour, prop),
          );
          expect(has(beside as Uint32Array, cell)).toBe(byRule);
        }
      }
    }
  });

  it('porte chaque meuble déclaré, et aucun autre', () => {
    const scene = buildScene(loadDecor('manor'));
    for (const prop of scene.propsPresent) {
      const bearing = scene.cellsWithProp.get(prop);
      expect(count(bearing as Uint32Array)).toBeGreaterThan(0);
    }
    // Deux meubles sur une même case : c'est ce que les calques permettent, et
    // la seule raison pour laquelle ils existent.
    const stacked = [...Array(scene.cellCount).keys()].filter(
      (cell) => cellHasProp(scene, cell, 'chair') && cellHasProp(scene, cell, 'rug'),
    );
    expect(stacked.length).toBeGreaterThan(0);
  });

  it('nomme les cases comme le plan imprimé', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 35 }), (cell) => {
        expect(cellLabel(6, cell)).toBe(`R${String(Math.floor(cell / 6) + 1)}C${String((cell % 6) + 1)}`);
      }),
    );
  });
});

describe('buildScene refuse un décor qui ment', () => {
  const base: Decor = {
    id: 'essai',
    title: 'Essai',
    size: 4,
    zones: [
      { key: 'A', name: 'Aile', article: "l'" },
      { key: 'B', name: 'Bureau', article: 'le' },
    ],
    plan: ['AABB', 'AABB', 'AABB', 'AABB'],
    legend: { c: 'chair' },
    furniture: [['c...', '....', '....', '....']],
  };

  it('accepte le témoin', () => {
    expect(() => buildScene(base)).not.toThrow();
  });

  it('refuse une pièce en deux morceaux', () => {
    // Sans cette règle, « à côté de » dirait quelque chose que le plan ne montre
    // pas : deux cases de la même pièce, séparées par une autre pièce.
    expect(() =>
      buildScene({ ...base, plan: ['ABBA', 'ABBA', 'ABBA', 'ABBA'] }),
    ).toThrow(/deux morceaux/);
  });

  it('refuse une pièce vide', () => {
    expect(() => buildScene({ ...base, plan: ['AAAA', 'AAAA', 'AAAA', 'AAAA'] })).toThrow(
      /aucune case/,
    );
  });

  it('refuse un plan de la mauvaise taille', () => {
    expect(() => buildScene({ ...base, plan: ['AABB', 'AABB'] })).toThrow(/rangées/);
    expect(() => buildScene({ ...base, plan: ['AAB', 'AABB', 'AABB', 'AABB'] })).toThrow(/cases/);
  });

  it('refuse une lettre inconnue', () => {
    expect(() => buildScene({ ...base, plan: ['AAZZ', 'AABB', 'AABB', 'AABB'] })).toThrow(
      /déclarée nulle part/,
    );
    expect(() =>
      buildScene({ ...base, furniture: [['z...', '....', '....', '....']] }),
    ).toThrow(/absent de la légende/);
  });

  it('refuse deux pièces sur la même lettre', () => {
    expect(() =>
      buildScene({
        ...base,
        zones: [
          { key: 'A', name: 'Aile', article: "l'" },
          { key: 'A', name: 'Autre', article: "l'" },
        ],
      }),
    ).toThrow(/la même lettre/);
  });
});
