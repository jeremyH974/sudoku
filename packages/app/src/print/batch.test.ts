import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runBatch } from './batch.js';

/**
 * La boucle de production d'un cahier.
 *
 * Elle est vérifiée ici **sans moteur, sans worker et sans DOM** : c'est tout
 * l'intérêt de l'avoir sortie des deux studios. Une fabrique de mensonge rend
 * observables les trois situations qu'aucun test ne pouvait atteindre tant que
 * la boucle vivait dans un composant — l'arrêt, l'échec, et l'échec partiel.
 */

/** Une fabrique qui rend l'indice demandé, et note ce qu'on lui a demandé. */
function counter(): { make: (index: number) => Promise<number | null>; asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    make: (index) => {
      asked.push(index);
      return Promise.resolve(index);
    },
  };
}

const never = (): boolean => false;
const nothing = (): void => undefined;

describe('la production d’un cahier', () => {
  it('demande exactement ce qu’on lui a commandé, dans l’ordre', async () => {
    const fabrique = counter();
    const result = await runBatch({
      count: 5,
      make: fabrique.make,
      stopped: never,
      onAttempt: nothing,
    });

    expect(fabrique.asked).toEqual([0, 1, 2, 3, 4]);
    expect(result.items).toEqual([0, 1, 2, 3, 4]);
    expect(result.attempted).toBe(5);
    expect(result.stopped).toBe(false);
    expect(result.failure).toBeNull();
  });

  it('ne demande rien pour un cahier vide', async () => {
    const fabrique = counter();
    const result = await runBatch({
      count: 0,
      make: fabrique.make,
      stopped: never,
      onAttempt: nothing,
    });

    expect(fabrique.asked).toEqual([]);
    expect(result).toEqual({ items: [], attempted: 0, stopped: false, failure: null });
  });

  it('compte les tentatives, et non les réussites', async () => {
    /*
      Le moteur rend `null` quand il n'a rien produit — une grille qui n'atteint
      pas son palier, une graine qui ne donne pas d'affaire. La progression doit
      suivre les **tentatives**, sinon la barre s'arrêterait sur un moteur qui
      travaille.
    */
    const progression: number[] = [];
    const result = await runBatch<number>({
      count: 6,
      make: (index) => Promise.resolve(index % 2 === 0 ? index : null),
      stopped: never,
      onAttempt: (attempted) => progression.push(attempted),
    });

    expect(result.items).toEqual([0, 2, 4]);
    expect(result.attempted).toBe(6);
    expect(progression).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('s’arrête entre deux pièces, et garde ce qui est fait', async () => {
    let produced = 0;
    const result = await runBatch<number>({
      count: 40,
      make: (index) => {
        produced++;
        return Promise.resolve(index);
      },
      stopped: () => produced >= 3,
      onAttempt: nothing,
    });

    expect(result.items).toEqual([0, 1, 2]);
    expect(result.attempted).toBe(3);
    expect(result.stopped).toBe(true);
    // Un arrêt volontaire n'est pas un échec : rien à signaler comme tel.
    expect(result.failure).toBeNull();
  });

  it('rend ce qui précède un échec, et le dit', async () => {
    /*
      C'est le comportement que ni l'un ni l'autre des studios n'avait : le
      studio du sudoku laissait l'exception remonter sans un mot, celui de
      l'enquête l'attrapait mais gardait l'aperçu précédent. Trois grilles faites
      et une quatrième qui casse, cela se montre **et** se dit.
    */
    const result = await runBatch<number>({
      count: 6,
      make: (index) => {
        if (index === 3) return Promise.reject(new Error('le moteur a rompu'));
        return Promise.resolve(index);
      },
      stopped: never,
      onAttempt: nothing,
    });

    expect(result.items).toEqual([0, 1, 2]);
    expect(result.attempted).toBe(3);
    expect(result.stopped).toBe(false);
    expect(result.failure).toBe('le moteur a rompu');
  });

  it('lit un rejet comme un arrêt quand l’arrêt est demandé', async () => {
    /*
      Tuer le travailleur est le seul moyen d'interrompre un calcul synchrone :
      la requête en vol **rejette** donc, et ce rejet n'est pas une panne. Sans
      cette distinction, chaque clic sur « Arrêter » afficherait un message
      d'erreur.
    */
    let asked = false;
    const result = await runBatch<number>({
      count: 6,
      make: (index) => {
        if (index === 2) {
          asked = true;
          return Promise.reject(new Error('Production interrompue.'));
        }
        return Promise.resolve(index);
      },
      stopped: () => asked,
      onAttempt: nothing,
    });

    expect(result.items).toEqual([0, 1]);
    expect(result.stopped).toBe(true);
    expect(result.failure).toBeNull();
  });

  it('rapporte une valeur qui n’est pas une Error', async () => {
    const result = await runBatch<number>({
      count: 2,
      // Un rejet qui n'est pas une `Error` : cela arrive, et le message doit
      // rester lisible plutôt que de devenir « [object Object] ».
      make: () => Promise.reject('déraillé'),
      stopped: never,
      onAttempt: nothing,
    });

    expect(result.failure).toBe('déraillé');
  });

  it('tient ses invariants sur n’importe quelle commande', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 20 }),
        // Quelles tentatives rendent `null`, et à partir de combien on arrête.
        fc.array(fc.boolean(), { maxLength: 20 }),
        fc.option(fc.nat({ max: 20 }), { nil: undefined }),
        async (count, yields, stopAfter) => {
          const progression: number[] = [];
          let done = 0;
          const result = await runBatch<number>({
            count,
            make: (index) => {
              done++;
              return Promise.resolve(yields[index] === false ? null : index);
            },
            stopped: () => stopAfter !== undefined && done >= stopAfter,
            onAttempt: (attempted) => progression.push(attempted),
          });

          // Jamais plus de pièces que de tentatives, jamais plus de tentatives
          // que de commandes.
          expect(result.items.length).toBeLessThanOrEqual(result.attempted);
          expect(result.attempted).toBeLessThanOrEqual(count);
          // La progression est une suite sans trou, qui finit sur le compte.
          expect(progression).toEqual(progression.map((_, rank) => rank + 1));
          expect(progression.at(-1) ?? 0).toBe(result.attempted);
          // Les pièces arrivent dans l'ordre demandé, sans doublon.
          expect([...result.items]).toEqual([...result.items].sort((a, b) => a - b));
          expect(new Set(result.items).size).toBe(result.items.length);
          // Rien ne casse : aucun échec ne doit être inventé.
          expect(result.failure).toBeNull();
          /*
            L'arrêt est **exactement** prévisible, et l'affirmer dans les deux
            sens est ce qui fait mordre cette propriété : une boucle qui
            ignorerait le drapeau passerait une implication à sens unique sans
            rien signaler. Le prédicat devient vrai au tour d'indice `stopAfter`,
            donc on écourte si et seulement si ce tour existe.
          */
          expect(result.stopped).toBe(stopAfter !== undefined && stopAfter < count);
          if (result.stopped) expect(result.attempted).toBe(stopAfter);
        },
      ),
      { numRuns: 200 },
    );
  });
});
