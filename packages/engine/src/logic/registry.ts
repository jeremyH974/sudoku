import { directHiddenPair, directHiddenTriple, directLocking } from './techniques/direct.js';
import { jellyfish, swordfish, xWing } from './techniques/fish.js';
import { hiddenPair, hiddenQuad, hiddenTriple } from './techniques/hiddenSet.js';
import { hiddenSingle } from './techniques/hiddenSingle.js';
import { locking } from './techniques/locking.js';
import { nakedPair, nakedQuad, nakedTriple } from './techniques/nakedSet.js';
import { nakedSingle } from './techniques/nakedSingle.js';
import { skyscraper, turbotFish, twoStringKite } from './techniques/strongLinks.js';
import { xyWing, xyzWing } from './techniques/wings.js';
import type { TechniqueEntry, TechniqueId } from './types.js';

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
 * Version 5 : ce single doit en outre être trouvé dans une boîte, ou dans l'une
 * des maisons que nomme le motif de base — trouvé ailleurs, l'oracle ne crédite
 * pas de coup direct.
 * Version 6 : correction d'une détection, non d'un barème. Les sous-ensembles
 * nus abandonnaient une unité dès que les cases **candidates à être membres**
 * n'étaient pas plus nombreuses que le motif — alors que les victimes, elles,
 * sont par définition en dehors de ce compte. Aucune valeur ni aucun rang n'a
 * bougé ; des motifs simplement invisibles sont devenus visibles, et le pic de
 * certaines grilles baisse en conséquence.
 */
export const RATING_VERSION = 6;

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

/** Une technique, telle qu'on peut la nommer et la viser de l'extérieur. */
export interface TechniqueInfo {
  readonly id: TechniqueId;
  /** Nom affichable, identique à celui que porte l'étape produite. */
  readonly label: string;
  readonly difficulty: number;
}

/**
 * Catalogue des vingt-quatre techniques, par difficulté croissante.
 *
 * ─── Pourquoi il existe ─────────────────────────────────────────────────────
 *
 * Jusqu'ici, la difficulté d'une technique n'était connue qu'en la voyant
 * s'appliquer : elle vit dans des tables locales aux neuf modules, et n'apparaît
 * dans une `Step` qu'une fois le motif trouvé. Cela suffit pour noter une grille,
 * pas pour en **demander** une : viser un X-Wing suppose de savoir, avant de
 * chercher, que le X-Wing vaut 3,2.
 *
 * ─── La duplication, et comment elle est tenue ──────────────────────────────
 *
 * Ces valeurs sont écrites ici **et** dans les modules de techniques. Le doublon
 * est réel, et il est verrouillé plutôt que toléré : `registry.test.ts` fait
 * tourner le solveur sur un large échantillon et vérifie que toute étape
 * observée porte exactement le libellé et la difficulté annoncés ci-dessous. Un
 * écart casse la suite.
 *
 * L'ordre d'essai reste celui de `REGISTRY` ; ce catalogue le décrit, il ne le
 * commande pas.
 */
export const TECHNIQUE_CATALOGUE: readonly TechniqueInfo[] = [
  { id: 'full-house', label: 'Dernière case', difficulty: 1.0 },
  { id: 'hidden-single-box', label: 'Single caché en boîte', difficulty: 1.2 },
  { id: 'hidden-single-line', label: 'Single caché en ligne', difficulty: 1.5 },
  { id: 'direct-pointing', label: 'Paire pointante directe', difficulty: 1.7 },
  { id: 'direct-claiming', label: 'Paire revendiquée directe', difficulty: 1.9 },
  { id: 'direct-hidden-pair', label: 'Paire cachée directe', difficulty: 2.0 },
  { id: 'naked-single', label: 'Single nu', difficulty: 2.3 },
  { id: 'direct-hidden-triple', label: 'Triplet caché direct', difficulty: 2.5 },
  { id: 'pointing', label: 'Paire pointante', difficulty: 2.6 },
  { id: 'claiming', label: 'Paire revendiquée', difficulty: 2.8 },
  { id: 'naked-pair', label: 'Paire nue', difficulty: 3.0 },
  { id: 'x-wing', label: 'X-Wing', difficulty: 3.2 },
  { id: 'hidden-pair', label: 'Paire cachée', difficulty: 3.4 },
  { id: 'naked-triple', label: 'Triplet nu', difficulty: 3.6 },
  { id: 'swordfish', label: 'Swordfish', difficulty: 3.8 },
  { id: 'hidden-triple', label: 'Triplet caché', difficulty: 4.0 },
  { id: 'skyscraper', label: 'Skyscraper', difficulty: 4.0 },
  { id: 'two-string-kite', label: 'Cerf-volant', difficulty: 4.1 },
  { id: 'turbot-fish', label: 'Turbot Fish', difficulty: 4.2 },
  { id: 'xy-wing', label: 'XY-Wing', difficulty: 4.2 },
  { id: 'xyz-wing', label: 'XYZ-Wing', difficulty: 4.4 },
  { id: 'naked-quad', label: 'Quadruplet nu', difficulty: 5.0 },
  { id: 'jellyfish', label: 'Jellyfish', difficulty: 5.2 },
  { id: 'hidden-quad', label: 'Quadruplet caché', difficulty: 5.4 },
];

const CATALOGUE_BY_ID = new Map(TECHNIQUE_CATALOGUE.map((info) => [info.id, info]));

/** Décrit une technique par son identifiant. */
export const techniqueInfo = (id: TechniqueId): TechniqueInfo => CATALOGUE_BY_ID.get(id)!;
