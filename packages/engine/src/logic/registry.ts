import { directHiddenPair, directHiddenTriple, directLocking } from './techniques/direct.js';
import { jellyfish, swordfish, xWing } from './techniques/fish.js';
import { hiddenPair, hiddenQuad, hiddenTriple } from './techniques/hiddenSet.js';
import { hiddenSingle } from './techniques/hiddenSingle.js';
import { locking } from './techniques/locking.js';
import { nakedPair, nakedQuad, nakedTriple } from './techniques/nakedSet.js';
import { nakedSingle } from './techniques/nakedSingle.js';
import type { TechniqueEntry } from './types.js';

/**
 * Version du barème et de l'ordre d'essai.
 *
 * Toute grille notée est estampillée avec cette version. **Modifier l'ordre
 * ci-dessous ou une valeur de difficulté impose de l'incrémenter** : sans cela,
 * deux grilles notées par deux versions différentes deviendraient incomparables
 * sans qu'on puisse le détecter.
 */
export const RATING_VERSION = 1;

/**
 * Ordre d'essai des techniques.
 *
 * ─── Pourquoi cet ordre n'est pas trié par difficulté ──────────────────────
 *
 * Le réflexe serait de trier par valeur croissante. Sudoku Explainer, la
 * référence à laquelle nous nous comparons, ne le fait pas : il déclare deux
 * familles — d'abord celles qui aboutissent directement à un placement, ensuite
 * les éliminatoires — et retient le **premier** résultat trouvé, sans tri
 * global. D'où les inversions visibles ci-dessous : la paire cachée (3,4) passe
 * avant la paire nue (3,0), le triplet caché (4,0) avant le Swordfish (3,8).
 *
 * Conséquence : dès qu'une position admet plusieurs techniques, l'ordre décide
 * de celle qui est créditée, donc de la note. Un tri « logique » par score nous
 * ferait diverger de la référence précisément là où plusieurs coups coexistent
 * — c'est-à-dire souvent.
 *
 * Cet ordre est donc figé volontairement, et sa fidélité sera **mesurée** contre
 * l'oracle à l'incrément suivant plutôt que supposée.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const REGISTRY: readonly TechniqueEntry[] = [
  // ── Techniques aboutissant directement à un placement ──
  hiddenSingle, //             1,0 · 1,2 · 1,5
  directLocking(locking), //   1,7 · 1,9
  directHiddenPair(hiddenPair), //   2,0
  nakedSingle, //              2,3
  directHiddenTriple(hiddenTriple), // 2,5

  // ── Techniques purement éliminatoires ──
  locking, //     2,6 · 2,8
  hiddenPair, //  3,4   (avant la paire nue : c'est l'ordre de la référence)
  nakedPair, //   3,0
  xWing, //       3,2
  hiddenTriple, // 4,0  (avant le Swordfish, même raison)
  nakedTriple, //  3,6
  swordfish, //    3,8
  hiddenQuad, //   5,4
  nakedQuad, //    5,0
  jellyfish, //    5,2
];

/** Difficulté la plus élevée que ce registre sait attribuer. */
export const MAX_KNOWN_DIFFICULTY = 5.4;
