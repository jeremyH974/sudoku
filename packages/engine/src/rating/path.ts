import { CELL_COUNT, EMPTY } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import { replayPath } from '../logic/solve.js';
import type { SolveLogicallyOptions } from '../logic/solve.js';
import type { Rating } from '../logic/rate.js';
import { waysForward } from './tension.js';

/**
 * La deuxième dimension de la notation : ce que le chemin coûte, et à quel point
 * il est étroit.
 *
 * ─── Pourquoi ce n'est pas un score, et ne le sera pas ──────────────────────
 *
 * Le plan annonçait un « score travail » à la HoDoKu — une somme pondérée sur
 * une échelle de 450 à 2000. Le calcul serait gratuit. Mais **il n'existe aucun
 * oracle pour le vérifier** : `serate` ne rend que le pic, et notre registre de
 * vingt-quatre techniques n'est pas celui de HoDoKu. Publier « travail : 1 250 »
 * serait annoncer un nombre que personne au monde ne peut contredire —
 * exactement le défaut que ce projet existe pour corriger.
 *
 * Ce qui suit n'est donc pas une note : ce sont des **comptages**, et chacun
 * décrit une chose observable sur le chemin que notre solveur emprunte. Toute
 * interface qui les affiche doit le dire.
 */

/** Seuil au-delà duquel une étape sort de ce qu'une grille de presse demande. */
export const DEMANDING_FROM = 2.6;

/** Un instant du chemin, mesuré. */
export interface Moment {
  /** Rang de l'étape dans `rating.steps`, à partir de 0. */
  readonly stepIndex: number;
  /**
   * Coups différents jouables à cet instant, celui qui a été joué compris.
   *
   * Des **conclusions** distinctes, jamais des motifs : voir `tension.ts`.
   */
  readonly waysForward: number;
  /**
   * Cases encore vides. Le dénominateur, sans lequel le compte ne dit rien :
   * deux issues en fin de grille et deux issues au milieu ne se valent pas.
   */
  readonly emptyCells: number;
}

export interface PathAnalysis {
  /** Le barème sous lequel ces comptages ont un sens. */
  readonly ratingVersion: number;
  /** Déductions sur le chemin de référence. Ne sépare rien : ~50 à 63 partout. */
  readonly stepCount: number;
  /**
   * Étapes où **rien** en dessous de 2,6 ne s'appliquait.
   *
   * Ce n'est pas une pondération déguisée. Le registre est essayé par difficulté
   * croissante, donc une étape à 2,6 ou plus est littéralement un moment où
   * aucun raisonnement « à l'œil » n'était disponible — il fallait les candidats
   * écrits. C'est un fait sur la position, et c'est ce qui sépare les paliers là
   * où le nombre total d'étapes n'y arrive pas.
   */
  readonly demandingSteps: number;
  /** Étapes employant la technique la plus difficile du chemin. */
  readonly peakSteps: number;
  /** Le plus étroit des instants au sommet. */
  readonly narrowest: Moment;
}

/**
 * Mesure un chemin **déjà noté**.
 *
 * Prend la grille *et* sa notation : les deux doivent provenir du même appel à
 * `rate(grid)`. La signature ne peut pas l'imposer, mais la propriété qui vérifie
 * que les issues d'une image contiennent toujours le coup joué tombe bruyamment
 * si l'on se trompe de couple.
 *
 * Ne vit surtout pas dans `rate()` : celle-ci est appelée jusqu'à quatre cents
 * fois par marche locale du générateur, et tout ce qu'on y ajoute est multiplié
 * d'autant. Coût mesuré ici : ~1,4 ms, contre ~1,35 ms pour la notation.
 *
 * Rend `null` si la grille n'a pas été résolue : un chemin partiel porterait des
 * comptages qui auraient l'air mesurés sans l'être.
 */
export function analysePath(
  grid: Grid,
  rating: Rating,
  options: SolveLogicallyOptions = {},
): PathAnalysis | null {
  if (rating.outcome !== 'solved' || rating.steps.length === 0) return null;

  const frames = replayPath(grid, rating.steps);
  let peakSteps = 0;
  let narrowest: Moment | null = null;

  for (let index = 0; index < rating.steps.length; index++) {
    const step = rating.steps.at(index);
    if (step === undefined || step.difficulty !== rating.score) continue;
    peakSteps++;

    const frame = frames.at(index);
    if (frame === undefined) continue;
    const ways = waysForward({ values: frame.values, candidates: frame.candidates }, options);
    if (ways === null) continue;

    /*
      Le minimum sur les ex æquo, et non la médiane. Si la technique la plus
      difficile est exigée cinq fois et qu'une seule de ces fois n'offrait
      qu'une issue, la grille contient une aiguille — et c'est cela qu'un joueur
      rencontre. `peakSteps` dit sur combien d'instants le minimum a été pris.
    */
    if (narrowest === null || ways.length < narrowest.waysForward) {
      let empty = 0;
      for (let cell = 0; cell < CELL_COUNT; cell++) {
        if (frame.values[cell] === EMPTY) empty++;
      }
      narrowest = { stepIndex: index, waysForward: ways.length, emptyCells: empty };
    }
  }

  if (narrowest === null) return null;

  return {
    ratingVersion: rating.ratingVersion,
    stepCount: rating.stepCount,
    demandingSteps: rating.steps.filter((step) => step.difficulty >= DEMANDING_FROM).length,
    peakSteps,
    narrowest,
  };
}
