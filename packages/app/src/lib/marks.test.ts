import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MARKS, markOf, markedDigits, restrictToNotes, toggleMark, withMark } from './marks.js';
import type { Mark } from './marks.js';

const digits = fc.integer({ min: 1, max: 9 });
const marks = fc.constantFrom<Mark>(0, 1, 2, 3);
/** Un masque de notes quelconque, sur neuf bits. */
const noteMasks = fc.integer({ min: 0, max: 0b1_1111_1111 });

describe('marques de candidats', () => {
  it('rend zéro sur une case vierge', () => {
    for (let digit = 1; digit <= 9; digit++) expect(markOf(0, digit)).toBe(0);
  });

  it('relit ce qu’elle a écrit, pour n’importe quel chiffre', () => {
    fc.assert(
      fc.property(digits, marks, (digit, mark) => {
        expect(markOf(withMark(0, digit, mark), digit)).toBe(mark);
      }),
    );
  });

  it('n’altère jamais les huit autres chiffres', () => {
    // Le défaut classique d'un champ de bits : un décalage d'un cran écraserait
    // le voisin sans que rien ne le signale.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0b11_1111_1111_1111_1111 }), digits, marks, (colors, digit, mark) => {
        const after = withMark(colors, digit, mark);
        for (let other = 1; other <= 9; other++) {
          if (other === digit) continue;
          expect(markOf(after, other)).toBe(markOf(colors, other));
        }
      }),
    );
  });

  it('tient dans dix-huit bits, quoi qu’on y mette', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(digits, marks), { maxLength: 30 }), (writes) => {
        let colors = 0;
        for (const [digit, mark] of writes) colors = withMark(colors, digit, mark);
        expect(colors).toBeGreaterThanOrEqual(0);
        expect(colors).toBeLessThan(1 << 18);
      }),
    );
  });

  it('bascule : reposer la même marque l’enlève', () => {
    fc.assert(
      fc.property(digits, fc.constantFrom<Exclude<Mark, 0>>(1, 2, 3), (digit, mark) => {
        const once = toggleMark(0, digit, mark);
        expect(markOf(once, digit)).toBe(mark);
        expect(markOf(toggleMark(once, digit, mark), digit)).toBe(0);
      }),
    );
  });

  it('remplace au lieu d’accumuler quand la marque change', () => {
    const colors = toggleMark(toggleMark(0, 5, 1), 5, 2);
    expect(markOf(colors, 5)).toBe(2);
  });
});

describe('invariant notes / marques', () => {
  it('n’en laisse aucune sur un chiffre qui n’est plus candidat', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(digits, marks), { maxLength: 20 }),
        noteMasks,
        (writes, noteMask) => {
          let colors = 0;
          for (const [digit, mark] of writes) colors = withMark(colors, digit, mark);

          const kept = restrictToNotes(colors, noteMask);
          for (let digit = 1; digit <= 9; digit++) {
            const isCandidate = (noteMask & (1 << (digit - 1))) !== 0;
            if (isCandidate) expect(markOf(kept, digit)).toBe(markOf(colors, digit));
            else expect(markOf(kept, digit)).toBe(0);
          }
        },
      ),
    );
  });

  it('est idempotent : restreindre deux fois ne change rien', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: (1 << 18) - 1 }), noteMasks, (colors, noteMask) => {
        const once = restrictToNotes(colors, noteMask);
        expect(restrictToNotes(once, noteMask)).toBe(once);
      }),
    );
  });

  it('vide tout quand la case n’a plus aucune note', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: (1 << 18) - 1 }), (colors) => {
        expect(restrictToNotes(colors, 0)).toBe(0);
      }),
    );
  });
});

describe('énoncé des marques', () => {
  it('nomme chaque marque par sa lettre, jamais par sa couleur', () => {
    // C'est ce nom-là qu'un lecteur d'écran prononcera : le seul porteur qui ne
    // se dégrade ni à huit pixels, ni en noir et blanc, ni pour un daltonien.
    const colors = withMark(withMark(0, 3, 1), 7, 3);
    expect(markedDigits(colors)).toEqual([
      { digit: 3, label: 'A' },
      { digit: 7, label: 'C' },
    ]);
  });

  it('ne dit rien quand il n’y a rien à dire', () => {
    expect(markedDigits(0)).toEqual([]);
  });

  it('expose exactement trois marques', () => {
    // Deux bits par chiffre : trois marques et l'absence. Ce plafond vient de la
    // règle « jamais la couleur seule », pas d'une contrainte de place.
    expect(MARKS).toHaveLength(3);
    expect(MARKS.map((m) => m.label)).toEqual(['A', 'B', 'C']);
  });
});
