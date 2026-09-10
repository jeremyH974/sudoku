/**
 * PRNG seedable et reproductible.
 *
 * Tout ce qui est aleatoire dans le moteur passe par ici. C'est la condition
 * de plusieurs promesses du produit :
 *   - les golden tests (un meme seed rejoue exactement le meme solve path) ;
 *   - le defi quotidien, derive de la date sans aucun backend ;
 *   - les URL courtes, qui regenerent une grille au lieu de la transporter.
 *
 * Algorithme : sfc32 (Small Fast Counter, Chris Doty-Humphrey / PractRand).
 * Etat de 128 bits, periode largement suffisante, et surtout : uniquement des
 * operations entieres 32 bits, donc un resultat identique sur toute plateforme
 * JS. C'est ce dernier point qui compte ici — un PRNG basé sur des flottants
 * ne garantirait pas la reproductibilite bit a bit.
 */

export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export interface Rng {
  /** Entier non signe sur 32 bits. */
  nextUint32(): number;
  /** Flottant dans [0, 1). */
  nextFloat(): number;
  /** Entier uniforme dans [0, maxExclusive). Sans biais modulo. */
  nextInt(maxExclusive: number): number;
  /** Melange le tableau en place (Fisher-Yates) et le retourne. */
  shuffle<T>(items: T[]): T[];
  /**
   * Derive un generateur independant. Utile pour paralleliser sans que deux
   * sous-taches ne consomment la meme sequence.
   */
  fork(): Rng;
  /** Copie de l'etat courant, pour reprendre exactement au meme point. */
  snapshot(): RngState;
}

/**
 * cyrb128 : transforme une chaine en 4 mots de 32 bits bien disperses.
 * Une seule passe, aucune dependance.
 */
function hashString(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  return {
    a: (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    b: (h2 ^ h1) >>> 0,
    c: (h3 ^ h1) >>> 0,
    d: (h4 ^ h1) >>> 0,
  };
}

/** splitmix32 : etale un seed numerique unique sur les 128 bits d'etat. */
function hashNumber(seed: number): RngState {
  let x = seed >>> 0;
  const next = (): number => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
  return { a: next(), b: next(), c: next(), d: next() };
}

export function seedToState(seed: string | number): RngState {
  return typeof seed === 'string' ? hashString(seed) : hashNumber(seed);
}

/**
 * Cree un generateur a partir d'un seed (chaine ou nombre) ou d'un etat
 * precedemment capture par `snapshot()`.
 */
export function createRng(seed: string | number | RngState): Rng {
  const initial = typeof seed === 'object' ? seed : seedToState(seed);
  let a = initial.a >>> 0;
  let b = initial.b >>> 0;
  let c = initial.c >>> 0;
  let d = initial.d >>> 0;

  const nextUint32 = (): number => {
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const result = (t + d) | 0;
    c = (c + result) | 0;
    return result >>> 0;
  };

  // sfc32 demande une phase de chauffe : sans elle, les premieres sorties
  // portent encore la structure du seed au lieu d'etre bien melangees.
  // On ne l'applique qu'au seeding initial : restaurer un `snapshot()` doit
  // reprendre exactement ou l'on s'etait arrete, sans avancer l'etat.
  if (typeof seed !== 'object') {
    for (let i = 0; i < 12; i++) nextUint32();
  }

  const rng: Rng = {
    nextUint32,

    nextFloat: () => nextUint32() / 0x1_0000_0000,

    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`nextInt attend un entier > 0, recu ${String(maxExclusive)}`);
      }
      // Rejet des valeurs qui tomberaient dans le reste incomplet du dernier
      // bloc : sans ca, les petites valeurs seraient legerement sur-representees.
      const limit = 0x1_0000_0000 - (0x1_0000_0000 % maxExclusive);
      let value = nextUint32();
      while (value >= limit) value = nextUint32();
      return value % maxExclusive;
    },

    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = rng.nextInt(i + 1);
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
      }
      return items;
    },

    fork: () => createRng({ a: nextUint32(), b: nextUint32(), c: nextUint32(), d: nextUint32() }),

    snapshot: () => ({ a, b, c, d }),
  };

  return rng;
}
