import { CELL_COUNT } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import { REGISTRY, RATING_VERSION } from './registry.js';
import { LogicState } from './state.js';
import type { Step, TechniqueEntry } from './types.js';

/**
 * Comment s'est terminée la résolution logique.
 *
 * - `solved` — la grille est résolue par le seul raisonnement, sans jamais
 *   deviner. C'est la garantie « zéro devinette » promise au joueur.
 * - `stuck` — plus aucune technique du registre ne s'applique. La grille exige
 *   des techniques hors périmètre ; elle sera **rejetée à la génération**, pas
 *   étiquetée au hasard.
 * - `contradiction` — une case vide s'est retrouvée sans candidat. Sur une
 *   grille valide, cela signale un bug dans une technique, jamais autre chose.
 * - `invalid` — les indices de départ se contredisent.
 */
export type SolveOutcome = 'solved' | 'stuck' | 'contradiction' | 'invalid';

export interface SolvePath {
  readonly outcome: SolveOutcome;
  /** Les étapes, dans l'ordre où elles ont été appliquées. */
  readonly steps: readonly Step[];
  /** Grille finale : résolue si `outcome` vaut `solved`, partielle sinon. */
  readonly grid: Grid;
  readonly ratingVersion: number;
}

/**
 * Garde-fou. Une résolution demande au plus 81 placements, plus les étapes
 * purement éliminatoires. Dépasser cette borne signale une boucle, donc un bug.
 */
const MAX_STEPS = 600;

/** Applique une étape à l'état. Renvoie `false` si elle n'a rien changé. */
function apply(state: LogicState, step: Step): boolean {
  let changed = false;

  for (const elimination of step.eliminations) {
    if (state.eliminate(elimination.cell, elimination.digit)) changed = true;
  }
  for (const placement of step.placements) {
    if (state.isEmpty(placement.cell)) {
      state.place(placement.cell, placement.digit);
      changed = true;
    }
  }
  return changed;
}

/** Première technique du registre qui trouve quelque chose. */
function findStep(state: LogicState, registry: readonly TechniqueEntry[]): Step | null {
  for (const entry of registry) {
    const step = entry.find(state);
    if (step !== null) return step;
  }
  return null;
}

export interface SolveLogicallyOptions {
  /** Registre de remplacement. Sert aux tests d'une technique isolée. */
  readonly registry?: readonly TechniqueEntry[];
}

/**
 * Résout une grille par le seul raisonnement, en journalisant chaque étape.
 *
 * Aucun appel au solveur brut : si le registre ne suffit pas, la résolution
 * s'arrête sur `stuck` plutôt que de deviner. C'est ce qui permet d'affirmer
 * qu'une grille publiée est résoluble à la main.
 */
export function solveLogically(grid: Grid, options: SolveLogicallyOptions = {}): SolvePath {
  const registry = options.registry ?? REGISTRY;
  const state = LogicState.fromGrid(grid);

  if (state === null) {
    return { outcome: 'invalid', steps: [], grid: new Uint8Array(grid), ratingVersion: RATING_VERSION };
  }

  const steps: Step[] = [];

  while (!state.isSolved()) {
    const step = findStep(state, registry);
    if (step === null) {
      return { outcome: 'stuck', steps, grid: state.toGrid(), ratingVersion: RATING_VERSION };
    }

    if (!apply(state, step)) {
      // Une technique qui ne change rien ferait boucler indéfiniment. Mieux vaut
      // échouer bruyamment que rendre une note fausse.
      throw new Error(
        `La technique « ${step.technique} » n'a produit aucun effet : ` +
          `${String(step.placements.length)} placement(s), ` +
          `${String(step.eliminations.length)} élimination(s) déjà appliquées.`,
      );
    }

    steps.push(step);

    if (state.hasContradiction()) {
      return { outcome: 'contradiction', steps, grid: state.toGrid(), ratingVersion: RATING_VERSION };
    }
    /* c8 ignore next 5 -- garde-fou : inatteignable tant qu'aucune technique ne boucle */
    if (steps.length > MAX_STEPS) {
      throw new Error(
        `Plus de ${String(MAX_STEPS)} étapes pour ${String(CELL_COUNT)} cases : ` +
          `une technique boucle sans progresser.`,
      );
    }
  }

  return { outcome: 'solved', steps, grid: state.toGrid(), ratingVersion: RATING_VERSION };
}

/**
 * Prochaine étape applicable, sans rien résoudre au-delà.
 *
 * C'est la source des indices : on part de l'état réel du joueur, pas de la
 * grille initiale, pour que le conseil porte sur la partie telle qu'elle est.
 * Renvoie `null` si la grille est incohérente ou si aucune technique connue ne
 * s'applique.
 */
export function findNextStep(grid: Grid, options: SolveLogicallyOptions = {}): Step | null {
  const state = LogicState.fromGrid(grid);
  if (state === null) return null;
  return findStep(state, options.registry ?? REGISTRY);
}

/**
 * Une image du chemin de résolution : l'état de la grille juste AVANT que
 * l'étape ne soit appliquée.
 */
export interface PathFrame {
  readonly values: Grid;
  /** Candidats restants, en masques de 9 bits. */
  readonly candidates: Uint16Array;
  /** Étape sur le point d'être jouée. `null` sur l'image finale. */
  readonly step: Step | null;
}

/**
 * Rejoue un chemin de résolution et rend l'état avant chaque étape.
 *
 * C'est ce qui permet au banc d'analyse de montrer le raisonnement tel qu'il
 * s'est déroulé — candidats compris — au lieu d'une simple liste de coups. On
 * rejoue plutôt que de conserver les états au fil de la résolution : garder
 * quatre-vingts instantanés par grille notée coûterait cher en mémoire pour un
 * usage qui reste exceptionnel.
 */
export function replayPath(grid: Grid, steps: readonly Step[]): PathFrame[] {
  const state = LogicState.fromGrid(grid);
  if (state === null) return [];

  const frames: PathFrame[] = [];
  for (const step of steps) {
    frames.push({ values: state.toGrid(), candidates: state.candidatesSnapshot(), step });
    for (const elimination of step.eliminations) state.eliminate(elimination.cell, elimination.digit);
    for (const placement of step.placements) {
      if (state.isEmpty(placement.cell)) state.place(placement.cell, placement.digit);
    }
  }
  frames.push({ values: state.toGrid(), candidates: state.candidatesSnapshot(), step: null });
  return frames;
}
