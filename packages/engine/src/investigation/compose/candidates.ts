import { PROPS, type Scene } from '../scene/types.js';
import { count, type CellSet } from '../scene/cellset.js';
import { holds, occupantsOf, unaryCells } from '../clues/semantics.js';
import type { Clue, Direction } from '../clues/types.js';

/**
 * Tous les indices **vrais** pour une disposition donnée.
 *
 * C'est la réserve dans laquelle le générateur puise. Aucun indice n'y entre
 * s'il ne se vérifie pas sur la solution : la classe de bug « l'énoncé contredit
 * le corrigé » est donc impossible par construction, et non par relecture.
 *
 * Le tri final se fait par personne, parce que c'est ainsi que le joueur les
 * lit — une carte par suspect.
 */

/**
 * Un indice unaire qui laisse plus de la moitié du plateau ne dit presque rien.
 *
 * Il reste vrai, et il alourdirait la carte sans rapprocher de la solution.
 * « Il n'était pas sur un tapis » quand le plateau porte trois tapis en est
 * l'exemple type : techniquement un indice, en pratique du bruit. Le seuil est
 * un réglage, pas une vérité — d'où sa présence ici, nommé, plutôt que dilué
 * dans une condition.
 */
const USEFUL_SHARE = 0.55;

/** La réserve d'indices d'un suspect, tous vrais pour `at`. */
export function candidatesFor(
  scene: Scene,
  at: readonly number[],
  who: number,
  victim: number,
): Clue[] {
  // La victime ne dit qu'une chose, et c'est ce qui fait l'affaire.
  if (who === victim) return [{ kind: 'victim', who }];

  const proposed: Clue[] = [];
  const cell = at[who];

  for (const prop of scene.propsPresent) {
    // « sur une étagère » est vrai et absurde : seuls les meubles qui
    // accueillent quelqu'un donnent un indice d'occupation.
    if (PROPS[prop].standable) {
      proposed.push({ kind: 'on-prop', who, prop, not: false });
      proposed.push({ kind: 'on-prop', who, prop, not: true });
    }
    proposed.push({ kind: 'next-to-prop', who, prop, not: false });
    proposed.push({ kind: 'next-to-prop', who, prop, not: true });
  }

  for (let zone = 0; zone < scene.zones.length; zone++) {
    proposed.push({ kind: 'in-zone', who, zone, not: false });
    proposed.push({ kind: 'in-zone', who, zone, not: true });
  }

  proposed.push({ kind: 'in-band', who, axis: 'row', index: Math.floor(cell / scene.size) });
  proposed.push({ kind: 'in-band', who, axis: 'column', index: cell % scene.size });

  const directions: readonly Direction[] = ['north', 'south', 'east', 'west'];
  for (let other = 0; other < at.length; other++) {
    if (other === who) continue;
    for (const direction of directions) {
      proposed.push({ kind: 'direction', who, other, direction });
      // Au-delà de trois, « exactement cinq colonnes à l'ouest » se compte au
      // doigt plutôt qu'il ne se déduit. La borne est une décision de lisibilité.
      for (let distance = 1; distance <= Math.min(3, scene.size - 1); distance++) {
        proposed.push({ kind: 'offset', who, other, direction, distance });
      }
    }
    proposed.push({ kind: 'same-zone', who, other, not: false });
    proposed.push({ kind: 'same-zone', who, other, not: true });
    proposed.push({ kind: 'alone-with', who, other });
  }

  proposed.push({ kind: 'alone', who });

  return proposed.filter((clue) => holds(clue, scene, at) && isUseful(clue, scene, victim));
}

/**
 * L'indice mérite-t-il une carte ?
 *
 * Deux refus, et une raison chaque fois :
 *
 *   - un indice unaire qui laisse plus de la moitié du plateau ne fait pas
 *     avancer ; il fait lire ;
 *   - « seul avec X » quand X est la victime dirait le coupable en toutes
 *     lettres. L'affaire se résoudrait en lisant une carte, ce qui n'est pas
 *     une déduction mais une annonce.
 */
function isUseful(clue: Clue, scene: Scene, victim: number): boolean {
  if (clue.kind === 'alone-with' && clue.other === victim) return false;

  const fixed: CellSet | null = unaryCells(clue, scene);
  if (fixed === null) return true;
  return count(fixed) <= scene.cellCount * USEFUL_SHARE;
}

/** Les pièces qui contiennent exactement deux personnes — les scènes de crime possibles. */
export function crimeScenes(scene: Scene, at: readonly number[]): number[] {
  const found: number[] = [];
  for (let zone = 0; zone < scene.zones.length; zone++) {
    if (occupantsOf(scene, at, zone).length === 2) found.push(zone);
  }
  return found;
}

/**
 * Les familles d'indices, et leur poids dans le tirage.
 *
 * ─── Pourquoi un tirage pondéré, et non uniforme ────────────────────────────
 *
 * La réserve d'un suspect est très déséquilibrée : les indices relatifs y sont
 * des dizaines — quatre directions, trois écarts, cinq autres personnes — là où
 * le mobilier n'en fournit qu'une poignée. Un tirage uniforme donne donc, en
 * pratique, une affaire de géométrie pure.
 *
 * Ce n'est pas une hypothèse : la première mesure sur vingt affaires n'a produit
 * **aucun** indice de mobilier. Le plan et ses meubles devenaient un décor, et
 * l'affaire se serait aussi bien jouée sur une grille vide — ce qui aurait vidé
 * de son sens la décision de dessiner la scène.
 *
 * Les poids ci-dessous sont un réglage, ouvertement. Ils ne prétendent pas être
 * optimaux ; ils disent quelle sorte d'affaire on veut lire.
 */
export type ClueFamily = 'furniture' | 'room' | 'together' | 'relative' | 'band' | 'victim';

export const FAMILY_WEIGHT: Readonly<Record<ClueFamily, number>> = {
  furniture: 6,
  room: 3,
  together: 3,
  relative: 2,
  band: 1,
  victim: 1,
};

export function familyOf(clue: Clue): ClueFamily {
  switch (clue.kind) {
    case 'on-prop':
    case 'next-to-prop':
      return 'furniture';
    case 'in-zone':
      return 'room';
    case 'in-band':
      return 'band';
    case 'direction':
    case 'offset':
      return 'relative';
    case 'same-zone':
    case 'alone':
    case 'alone-with':
      return 'together';
    case 'victim':
      return 'victim';
  }
}
