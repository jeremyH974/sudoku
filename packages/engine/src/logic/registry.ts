import { directHiddenPair, directHiddenTriple, directLocking } from './techniques/direct.js';
import { jellyfish, swordfish, xWing } from './techniques/fish.js';
import { hiddenPair, hiddenQuad, hiddenTriple } from './techniques/hiddenSet.js';
import { hiddenSingle } from './techniques/hiddenSingle.js';
import { locking } from './techniques/locking.js';
import { nakedPair, nakedQuad, nakedTriple } from './techniques/nakedSet.js';
import { nakedSingle } from './techniques/nakedSingle.js';
import { skyscraper, turbotFish, twoStringKite } from './techniques/strongLinks.js';
import { xyWing, xyzWing } from './techniques/wings.js';
import type { TechniqueEntry } from './types.js';

/**
 * Version du barème et de l'ordre d'essai.
 *
 * Toute grille notée est estampillée avec cette version. **Modifier l'ordre
 * ci-dessous ou une valeur de difficulté impose de l'incrémenter** : sans cela,
 * deux grilles notées par deux versions différentes deviendraient incomparables
 * sans qu'on puisse le détecter.
 *
 * Version 2 : ordre corrigé après calibration contre l'oracle (voir ci-dessous).
 * Version 3 : ajout des liens forts (4,0 à 4,2) et des wings (4,2 et 4,4), qui
 * s'intercalent entre le triplet caché et le quadruplet nu.
 * Version 4 : les variantes « Direct » ne reconnaissent plus qu'un single
 * caché, jamais un single nu (voir `techniques/direct.ts`).
 */
export const RATING_VERSION = 4;

/**
 * Ordre d'essai des techniques : **par difficulté croissante**.
 *
 * ─── Ce que la calibration a corrigé ───────────────────────────────────────
 *
 * La documentation communautaire de Sudoku Explainer décrit un ordre par
 * familles de producteurs, dans lequel la paire cachée (3,4) serait essayée
 * avant la paire nue (3,0), et le triplet caché (4,0) avant le Swordfish (3,8).
 * Nous avions reproduit cet ordre à la lettre.
 *
 * La mesure l'a dementi. Confronté à l'oracle sur un corpus de grilles réelles,
 * ce classement produisait des notes trop élevées chaque fois que plusieurs
 * techniques s'appliquaient : nous annoncions une paire cachée là où l'oracle
 * concluait par une paire nue ou un X-Wing, moins chers. Trier par difficulté
 * croissante a fait passer l'accord exact de 92,7 % à 97,6 % sur le domaine où
 * il est exigible.
 *
 * L'ordre ci-dessous est donc celui que la mesure valide, non celui que la
 * documentation annonçait. C'est précisément ce que la calibration devait
 * trancher : une hypothèse plausible et bien sourcée peut être fausse, et seul
 * l'oracle pouvait le dire.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Les variantes « Direct » restent groupées en tête malgré leur valeur : elles
 * aboutissent immédiatement à un placement, et leurs scores (1,7 à 2,5)
 * s'intercalent naturellement dans l'ordre croissant.
 *
 * Deux **ex æquo** subsistent, à 4,0 et à 4,2. À valeur égale l'ordre ne change
 * aucune note, seulement le nom affiché quand les deux techniques s'appliquent
 * au même moment. Faute d'avoir pu déterminer l'ordre interne de l'oracle sans
 * lire ses sources — ce que nous nous interdisons —, les techniques ajoutées
 * passent après celles déjà calibrées : à égalité, on ne déplace pas ce qui est
 * déjà mesuré conforme.
 */
export const REGISTRY: readonly TechniqueEntry[] = [
  hiddenSingle, //             1,0 · 1,2 · 1,5
  directLocking(locking), //   1,7 · 1,9
  directHiddenPair(hiddenPair), //   2,0
  nakedSingle, //              2,3
  directHiddenTriple(hiddenTriple), // 2,5
  locking, //     2,6 · 2,8
  nakedPair, //   3,0
  xWing, //       3,2
  hiddenPair, //  3,4
  nakedTriple, // 3,6
  swordfish, //   3,8
  hiddenTriple, //   4,0
  skyscraper, //     4,0
  twoStringKite, //  4,1
  turbotFish, //     4,2
  xyWing, //         4,2
  xyzWing, //        4,4
  nakedQuad, //   5,0
  jellyfish, //   5,2
  hiddenQuad, //  5,4
];

/** Difficulté la plus élevée que ce registre sait attribuer. */
export const MAX_KNOWN_DIFFICULTY = 5.4;
