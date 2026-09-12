import { describe, expect, it } from 'vitest';
import { CAST, castOf } from '@sudoku/engine/investigation';
import { FACES, HAIR, axesApart, faceOf } from './portrait.js';

/**
 * Le système de portraits, vérifié là où l'œil ne suffit pas.
 *
 * Un jeu d'avatars échoue toujours de la même façon : la combinatoire promet
 * des milliers d'identités, et l'écran en montre seize qui se ressemblent. Les
 * Mii de Nintendo atteignent dix milliards de combinaisons pour des visages que
 * personne ne distingue. Ce n'est donc pas le nombre de combinaisons qu'il faut
 * vérifier, mais **l'écart entre celles qu'on a choisies**.
 */
describe('les seize identités', () => {
  it('couvrent toute la distribution', () => {
    expect(FACES).toHaveLength(CAST.length);
    for (const suspect of castOf(CAST.length)) expect(faceOf(suspect)).toBeDefined();
  });

  it('ne se distinguent jamais par la seule couleur', () => {
    /*
      Le défaut nommé des systèmes d'avatars : faire varier la teinte de peau et
      rien d'autre produit « un seul visage, plusieurs couleurs ». La règle est
      donc que **deux identités diffèrent sur au moins deux axes** — et comme la
      silhouette se lit avant la couleur, jamais sur la seule teinte.
    */
    const faults: string[] = [];
    for (let left = 0; left < FACES.length; left++) {
      for (let right = left + 1; right < FACES.length; right++) {
        const apart = axesApart(FACES[left], FACES[right]);
        if (apart < 2) {
          faults.push(`${CAST[left].name} / ${CAST[right].name} : ${String(apart)} axe`);
        }
      }
    }
    expect(faults).toEqual([]);
  });

  it('n’emploient que des coiffures qui existent', () => {
    for (const face of FACES) expect(HAIR[face.hair]).toBeDefined();
  });

  it('emploient réellement toutes les silhouettes disponibles', () => {
    // Une silhouette dessinée et jamais assignée est du poids mort ; une
    // silhouette sur-employée rapproche les identités qui la partagent.
    const used = new Map<string, number>();
    for (const face of FACES) used.set(face.hair, (used.get(face.hair) ?? 0) + 1);
    expect([...used.keys()].sort()).toEqual(Object.keys(HAIR).sort());
    // Trois fois la même coiffure sur seize, c'est le plafond qu'on se donne.
    for (const [shape, count] of used) expect(count, shape).toBeLessThanOrEqual(3);
  });

  it('répartissent les teintes plutôt que de les concentrer', () => {
    // Quatre peaux pour seize personnes : une teinte employée une seule fois,
    // ou huit fois, trahirait un défaut par défaut plutôt qu'un choix.
    for (const axis of ['skin', 'hairTone'] as const) {
      const counts = new Map<number, number>();
      for (const face of FACES) counts.set(face[axis], (counts.get(face[axis]) ?? 0) + 1);
      expect(counts.size, axis).toBe(4);
      for (const [tone, count] of counts) {
        expect(count, `${axis} ${String(tone)}`).toBeGreaterThanOrEqual(2);
        expect(count, `${axis} ${String(tone)}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('habillent les seize sans jamais répéter un couple coiffure–vêtement', () => {
    /*
      Le vêtement est le seul accent franc du portrait, et le deuxième axe qu'on
      voit après la silhouette. Deux suspects qui partageraient **les deux** se
      liraient comme le même personnage, quoi que disent la peau ou les lunettes.

      Cette borne n'est pas gratuite : elle a été trouvée par recherche, et la
      borne voisine — jamais le même ton de cheveux **et** le même vêtement — est
      au contraire **impossible** ici, et c'est arithmétique. Cinq suspects
      partagent le ton 1 pour quatre vêtements disponibles. On ne l'exige donc
      pas, on l'a seulement minimisée : il reste une collision, entre deux
      identités par ailleurs distantes de trois axes.
    */
    const seen = new Set<string>();
    for (const face of FACES) {
      const couple = `${face.hair}/${String(face.garment)}`;
      expect(seen.has(couple), couple).toBe(false);
      seen.add(couple);
    }
  });

  it('répartissent les quatre accents à parts égales', () => {
    // Quatre vêtements pour seize personnes : exactement quatre chacun. Un
    // accent employé une fois ne distingue personne, et le reste devient du
    // décor.
    const counts = new Map<number, number>();
    for (const face of FACES) counts.set(face.garment, (counts.get(face.garment) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4]);
    for (const [garment, count] of counts) expect(count, String(garment)).toBe(4);
  });

  it('gardent l’accessoire minoritaire', () => {
    // Les lunettes lèvent une ambiguïté ; si la moitié de la distribution en
    // porte, elles cessent de distinguer quoi que ce soit.
    const withGlasses = FACES.filter((face) => face.glasses).length;
    expect(withGlasses).toBeGreaterThan(0);
    expect(withGlasses).toBeLessThanOrEqual(FACES.length / 3);
  });
});
