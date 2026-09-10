/**
 * Ensembles de chiffres représentés par un masque de 9 bits.
 *
 * Le bit 0 porte le chiffre 1, ... le bit 8 porte le chiffre 9. Toute la
 * manipulation de candidats passe par ce type : c'est ce qui rend les
 * techniques logiques (paires nues, X-Wing...) exprimables en quelques
 * opérations entières au lieu de parcours de tableaux.
 */

/** Masque de 9 bits. Alias documentaire : TS n'a pas d'entier borné. */
export type DigitMask = number;

/** Chiffre de 1 à 9. */
export type Digit = number;

/** Les neuf chiffres présents : 0b1_1111_1111. */
export const ALL_DIGITS: DigitMask = 0x1ff;
export const NO_DIGITS: DigitMask = 0;

/** Masque du seul chiffre `digit`. */
export const maskOf = (digit: Digit): DigitMask => 1 << (digit - 1);

/** Masque de plusieurs chiffres. */
export const maskOfAll = (digits: Iterable<Digit>): DigitMask => {
  let mask = NO_DIGITS;
  for (const d of digits) mask |= maskOf(d);
  return mask;
};

export const hasDigit = (mask: DigitMask, digit: Digit): boolean => (mask & maskOf(digit)) !== 0;

export const withDigit = (mask: DigitMask, digit: Digit): DigitMask => mask | maskOf(digit);

export const withoutDigit = (mask: DigitMask, digit: Digit): DigitMask => mask & ~maskOf(digit);

/** Nombre de chiffres dans le masque (SWAR, sans boucle). */
export const countDigits = (mask: DigitMask): number => {
  let m = mask - ((mask >> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >> 2) & 0x33333333);
  return (((m + (m >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
};

export const isEmpty = (mask: DigitMask): boolean => mask === NO_DIGITS;

export const isSingle = (mask: DigitMask): boolean => mask !== 0 && (mask & (mask - 1)) === 0;

/**
 * Plus petit chiffre du masque, ou 0 si le masque est vide.
 * `mask & -mask` isole le bit de poids faible.
 */
export const lowestDigit = (mask: DigitMask): Digit =>
  mask === 0 ? 0 : 32 - Math.clz32(mask & -mask);

/**
 * Chiffre unique d'un masque singleton. Renvoie 0 si le masque n'en contient
 * pas exactement un — à l'appelant de vérifier via `isSingle` quand ca compte.
 */
export const singleDigit = (mask: DigitMask): Digit => (isSingle(mask) ? lowestDigit(mask) : 0);

/** Liste des chiffres du masque, par ordre croissant. */
export const digitsOf = (mask: DigitMask): Digit[] => {
  const digits: Digit[] = [];
  let m = mask;
  while (m !== 0) {
    const low = m & -m;
    digits.push(32 - Math.clz32(low));
    m ^= low;
  }
  return digits;
};

/** Parcourt les chiffres du masque sans allouer de tableau. */
export const forEachDigit = (mask: DigitMask, fn: (digit: Digit) => void): void => {
  let m = mask;
  while (m !== 0) {
    const low = m & -m;
    fn(32 - Math.clz32(low));
    m ^= low;
  }
};

/** Représentation lisible, pour les messages de debug et les indices. */
export const formatMask = (mask: DigitMask): string => digitsOf(mask).join('');
