import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { forwardedFrom } from './entry.js';

/**
 * La règle qui sauve les cahiers déjà imprimés.
 *
 * Un QR code imprimé encode l'adresse d'où le studio a été ouvert, suivie du
 * code de la grille : `…/sudoku/#g=…`. Cette adresse est devenue celle de
 * **l'accueil**, qui ne sait pas jouer une grille. Sans le renvoi vérifié ici,
 * chaque cahier déjà sorti de l'imprimante s'ouvrirait sur une page qui ne
 * comprend pas ce qu'on lui demande — sans rien afficher qui l'explique.
 *
 * Le même renvoi couvrira le déménagement vers un nom de domaine : GitHub
 * redirige l'ancienne adresse en conservant le chemin, et le navigateur
 * rattache le fragment.
 */
describe('forwardedFrom', () => {
  const BASE = '/sudoku/';

  it('renvoie une grille encodée vers la section qui sait la jouer', () => {
    expect(forwardedFrom('#g=abc123', BASE)).toBe('/sudoku/sudoku/#g=abc123');
  });

  it('conserve le code tel quel, quel qu’il soit', () => {
    // Le code n'est pas interprété ici : c'est la section Sudoku qui le décode,
    // et elle seule. Le toucher au passage introduirait un second décodeur.
    fc.assert(
      fc.property(fc.string({ minLength: 1 }).filter((s) => !s.includes('\n')), (code) => {
        expect(forwardedFrom(`#g=${code}`, BASE)).toBe(`${BASE}sudoku/#g=${code}`);
      }),
    );
  });

  it('suit la base, pour survivre au déménagement vers un domaine', () => {
    expect(forwardedFrom('#g=x', '/')).toBe('/sudoku/#g=x');
    expect(forwardedFrom('#g=x', '/jeux/')).toBe('/jeux/sudoku/#g=x');
  });

  it('ne renvoie rien pour une adresse ordinaire', () => {
    for (const hash of ['', '#', '#g=', '#autre', '#g', 'g=abc']) {
      expect(forwardedFrom(hash, BASE), hash).toBeNull();
    }
  });

  it('ne devine jamais une destination pour un fragment inconnu', () => {
    // Un fragment qu'on ne reconnaît pas reste sur l'accueil. Le renvoyer « au
    // cas où » enverrait un visiteur ailleurs que là où il a cliqué.
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.startsWith('g=') || s.length < 3),
        (rest) => {
          expect(forwardedFrom(`#${rest}`, BASE)).toBeNull();
        },
      ),
    );
  });
});
