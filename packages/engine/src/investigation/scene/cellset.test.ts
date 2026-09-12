import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  add,
  cellsOf,
  cloneSet,
  count,
  difference,
  emptySet,
  first,
  fullSet,
  has,
  intersection,
  intersects,
  isEmpty,
  isSingle,
  isSubsetOf,
  remove,
  setOf,
  subtract,
  union,
  wordsFor,
} from './cellset.js';

/**
 * Les ensembles de cases se testent par propriété, contre `Set<number>`.
 *
 * C'est le seul genre de test qui vaille ici : une implémentation en bits a des
 * modes de défaillance qui ne se voient pas à l'œil — un mot de bord mal masqué,
 * un décalage qui déborde au trente-deuxième bit. Un exemple choisi à la main
 * passerait à côté ; une comparaison à la structure de référence, non.
 */

/** Des plateaux plausibles : de 4×4 à 16×16, plus les tailles de bord de mot. */
const cellCounts = fc.constantFrom(16, 31, 32, 33, 36, 64, 100, 144, 255, 256);

const subsetOf = (cellCount: number): fc.Arbitrary<number[]> =>
  fc.uniqueArray(fc.integer({ min: 0, max: cellCount - 1 }), { maxLength: cellCount });

describe('CellSet', () => {
  it('compte ses mots au plus juste', () => {
    fc.assert(
      fc.property(cellCounts, (cellCount) => {
        expect(wordsFor(cellCount) * 32).toBeGreaterThanOrEqual(cellCount);
        expect((wordsFor(cellCount) - 1) * 32).toBeLessThan(cellCount);
      }),
    );
  });

  it('fait l’aller-retour avec une liste de cases', () => {
    fc.assert(
      fc.property(
        cellCounts.chain((cellCount) => fc.tuple(fc.constant(cellCount), subsetOf(cellCount))),
        ([cellCount, cells]) => {
          const set = setOf(cellCount, cells);
          expect(cellsOf(set)).toEqual([...cells].sort((a, b) => a - b));
          expect(count(set)).toBe(cells.length);
        },
      ),
    );
  });

  it('n’invente aucune case au-delà du plateau', () => {
    // Le piège classique d'un ensemble en bits : le dernier mot porte des bits
    // qui ne correspondent à aucune case. Non masqués, ils se comptent.
    fc.assert(
      fc.property(cellCounts, (cellCount) => {
        expect(count(fullSet(cellCount))).toBe(cellCount);
        expect(cellsOf(fullSet(cellCount)).at(-1)).toBe(cellCount - 1);
        expect(count(emptySet(cellCount))).toBe(0);
      }),
    );
  });

  it('accorde ses opérations ensemblistes avec Set', () => {
    fc.assert(
      fc.property(
        cellCounts.chain((cellCount) =>
          fc.tuple(fc.constant(cellCount), subsetOf(cellCount), subsetOf(cellCount)),
        ),
        ([cellCount, left, right]) => {
          const a = setOf(cellCount, left);
          const b = setOf(cellCount, right);
          const setA = new Set(left);
          const setB = new Set(right);

          expect(cellsOf(union(a, b))).toEqual([...new Set([...left, ...right])].sort((x, y) => x - y));
          expect(cellsOf(intersection(a, b))).toEqual(left.filter((c) => setB.has(c)).sort((x, y) => x - y));
          expect(cellsOf(difference(a, b))).toEqual(left.filter((c) => !setB.has(c)).sort((x, y) => x - y));
          expect(intersects(a, b)).toBe(left.some((c) => setB.has(c)));
          expect(isSubsetOf(a, b)).toBe(left.every((c) => setB.has(c)));
          expect(isEmpty(a)).toBe(setA.size === 0);
          expect(isSingle(a)).toBe(setA.size === 1);
          expect(first(a)).toBe(left.length === 0 ? -1 : Math.min(...left));
        },
      ),
    );
  });

  it('ajoute, retire et interroge sans se contredire', () => {
    fc.assert(
      fc.property(
        cellCounts.chain((cellCount) =>
          fc.tuple(fc.constant(cellCount), fc.integer({ min: 0, max: cellCount - 1 })),
        ),
        ([cellCount, cell]) => {
          const set = emptySet(cellCount);
          expect(has(set, cell)).toBe(false);
          add(set, cell);
          expect(has(set, cell)).toBe(true);
          expect(count(set)).toBe(1);
          remove(set, cell);
          expect(has(set, cell)).toBe(false);
          expect(isEmpty(set)).toBe(true);
        },
      ),
    );
  });

  it('signale honnêtement si une soustraction a changé quelque chose', () => {
    // La boucle de propagation s'arrête sur ce booléen : s'il ment dans un sens
    // elle boucle, dans l'autre elle s'arrête trop tôt et laisse l'affaire
    // incomplète. Les deux défauts sont silencieux.
    fc.assert(
      fc.property(
        cellCounts.chain((cellCount) =>
          fc.tuple(fc.constant(cellCount), subsetOf(cellCount), subsetOf(cellCount)),
        ),
        ([cellCount, left, right]) => {
          const target = setOf(cellCount, left);
          const before = cloneSet(target);
          const changed = subtract(target, setOf(cellCount, right));
          expect(changed).toBe(count(before) !== count(target));
        },
      ),
    );
  });
});
