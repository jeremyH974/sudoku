import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ALL_DIGITS,
  NO_DIGITS,
  countDigits,
  digitsOf,
  forEachDigit,
  formatMask,
  hasDigit,
  isEmpty,
  isSingle,
  lowestDigit,
  maskOf,
  maskOfAll,
  singleDigit,
  withDigit,
  withoutDigit,
} from './bitset.js';

const arbMask = fc.integer({ min: 0, max: ALL_DIGITS });
const arbDigit = fc.integer({ min: 1, max: 9 });

describe('masques de chiffres', () => {
  it('fait un aller-retour sans perte entre ensemble de chiffres et masque', () => {
    fc.assert(
      fc.property(fc.uniqueArray(arbDigit), (digits) => {
        expect(digitsOf(maskOfAll(digits))).toEqual([...digits].sort((a, b) => a - b));
      }),
    );
  });

  it('compte autant de chiffres que digitsOf en enumere', () => {
    fc.assert(
      fc.property(arbMask, (mask) => {
        expect(countDigits(mask)).toBe(digitsOf(mask).length);
      }),
    );
  });

  it('parcourt exactement les memes chiffres avec forEachDigit', () => {
    fc.assert(
      fc.property(arbMask, (mask) => {
        const collected: number[] = [];
        forEachDigit(mask, (d) => collected.push(d));
        expect(collected).toEqual(digitsOf(mask));
      }),
    );
  });

  it('ajoute et retire un chiffre de facon reversible', () => {
    fc.assert(
      fc.property(arbMask, arbDigit, (mask, digit) => {
        expect(hasDigit(withDigit(mask, digit), digit)).toBe(true);
        expect(hasDigit(withoutDigit(mask, digit), digit)).toBe(false);
        expect(withoutDigit(withDigit(mask, digit), digit)).toBe(withoutDigit(mask, digit));
      }),
    );
  });

  it('identifie les singletons', () => {
    fc.assert(
      fc.property(arbDigit, (digit) => {
        const mask = maskOf(digit);
        expect(isSingle(mask)).toBe(true);
        expect(singleDigit(mask)).toBe(digit);
        expect(lowestDigit(mask)).toBe(digit);
      }),
    );
    expect(isSingle(NO_DIGITS)).toBe(false);
    expect(isSingle(ALL_DIGITS)).toBe(false);
    expect(singleDigit(ALL_DIGITS)).toBe(0);
  });

  it('renvoie le plus petit chiffre present, 0 si le masque est vide', () => {
    fc.assert(
      fc.property(arbMask, (mask) => {
        expect(lowestDigit(mask)).toBe(isEmpty(mask) ? 0 : digitsOf(mask)[0]);
      }),
    );
  });

  it('caracterise les masques vide et plein', () => {
    expect(isEmpty(NO_DIGITS)).toBe(true);
    expect(countDigits(ALL_DIGITS)).toBe(9);
    expect(digitsOf(ALL_DIGITS)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(formatMask(maskOfAll([3, 1, 7]))).toBe('137');
    expect(formatMask(NO_DIGITS)).toBe('');
  });
});
