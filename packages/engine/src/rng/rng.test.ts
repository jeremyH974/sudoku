import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createRng } from './rng.js';

const take = (seed: string | number, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.nextUint32());
};

describe('createRng', () => {
  it('est deterministe : un meme seed rejoue exactement la meme sequence', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer()), (seed) => {
        expect(take(seed, 50)).toEqual(take(seed, 50));
      }),
    );
  });

  it('produit des sequences distinctes pour des seeds distincts', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (x, y) => {
        fc.pre(x !== y);
        expect(take(x, 8)).not.toEqual(take(y, 8));
      }),
    );
  });

  it('accepte indifferemment une chaine ou un nombre comme seed', () => {
    expect(() => createRng('grille-du-jour-2026-09-10')).not.toThrow();
    expect(take('a', 4)).not.toEqual(take('b', 4));
  });

  describe('nextUint32', () => {
    it('reste dans les bornes 32 bits non signees', () => {
      const rng = createRng(1);
      for (let i = 0; i < 10_000; i++) {
        const v = rng.nextUint32();
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(0xffff_ffff);
      }
    });
  });

  describe('nextFloat', () => {
    it('reste dans [0, 1)', () => {
      const rng = createRng('floats');
      for (let i = 0; i < 10_000; i++) {
        const v = rng.nextFloat();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('nextInt', () => {
    it('reste dans [0, maxExclusive)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer(), (max, seed) => {
          const rng = createRng(seed);
          for (let i = 0; i < 20; i++) {
            const v = rng.nextInt(max);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(max);
          }
        }),
      );
    });

    it('rejette les bornes invalides plutot que de renvoyer NaN', () => {
      const rng = createRng(0);
      expect(() => rng.nextInt(0)).toThrow(RangeError);
      expect(() => rng.nextInt(-1)).toThrow(RangeError);
      expect(() => rng.nextInt(1.5)).toThrow(RangeError);
    });

    it('ne favorise aucune valeur (repartition sur 9 chiffres)', () => {
      const rng = createRng('uniformite');
      const counts = new Array<number>(9).fill(0);
      const draws = 90_000;
      for (let i = 0; i < draws; i++) counts[rng.nextInt(9)]++;
      const expected = draws / 9;
      // Tolerance large : on cherche un biais systemique, pas une preuve
      // statistique fine. Un modulo naif dans nextInt ferait exploser ce seuil.
      for (const c of counts) expect(Math.abs(c - expected) / expected).toBeLessThan(0.05);
    });
  });

  describe('shuffle', () => {
    it('produit toujours une permutation des elements d origine', () => {
      fc.assert(
        fc.property(fc.array(fc.integer(), { maxLength: 60 }), fc.integer(), (items, seed) => {
          const shuffled = createRng(seed).shuffle([...items]);
          expect([...shuffled].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
        }),
      );
    });

    it('melange reellement (ne renvoie pas l ordre initial sur un grand tableau)', () => {
      const source = Array.from({ length: 81 }, (_, i) => i);
      expect(createRng('melange').shuffle([...source])).not.toEqual(source);
    });
  });

  describe('snapshot', () => {
    it('permet de reprendre exactement la ou on s est arrete', () => {
      const rng = createRng('reprise');
      for (let i = 0; i < 17; i++) rng.nextUint32();

      const state = rng.snapshot();
      const suite = Array.from({ length: 10 }, () => rng.nextUint32());

      const reprise = createRng(state);
      const repris = Array.from({ length: 10 }, () => reprise.nextUint32());

      // Rejouer depuis l'etat capture doit redonner la suite a l'identique.
      expect(repris).toEqual(suite);
    });
  });

  describe('fork', () => {
    it('derive un generateur qui ne rejoue pas la sequence du parent', () => {
      const parent = createRng('parent');
      const enfant = parent.fork();
      const suiteParent = Array.from({ length: 10 }, () => parent.nextUint32());
      const suiteEnfant = Array.from({ length: 10 }, () => enfant.nextUint32());
      expect(suiteEnfant).not.toEqual(suiteParent);
    });
  });

  // Verrou de reproductibilite. Ces valeurs ne doivent JAMAIS changer sans une
  // decision explicite : elles garantissent qu'une grille regeneree depuis une
  // URL courte ou une date reste identique d'une version a l'autre du moteur.
  describe('stabilite inter-versions', () => {
    it('produit les valeurs de reference attendues pour un seed numerique', () => {
      expect(take(42, 5)).toMatchInlineSnapshot(`
        [
          2419595845,
          1241081768,
          25410213,
          4161568316,
          93774937,
        ]
      `);
    });

    it('produit les valeurs de reference attendues pour un seed textuel', () => {
      expect(take('sudoku', 5)).toMatchInlineSnapshot(`
        [
          3741837901,
          2827432411,
          417046518,
          4080710898,
          2332595058,
        ]
      `);
    });
  });
});
