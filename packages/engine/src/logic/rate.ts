import type { Grid } from '../grid/index.js';
import { solveLogically } from './solve.js';
import type { SolveLogicallyOptions, SolveOutcome } from './solve.js';
import type { Step, TechniqueId } from './types.js';

/**
 * Niveaux publics.
 *
 * Six paliers, comme chez la plupart des acteurs grand public, et compatibles
 * avec les quatre à cinq niveaux qu'emploient la presse et les sites
 * d'impression. Chacun est défini par **la technique la plus difficile que la
 * grille exige**, jamais par le nombre d'indices.
 *
 * Repère utile : les sudokus de presse plafonnent presque tous autour de 3,0 sur
 * l'échelle de Sudoku Explainer. Notre palier « Difficile » atteint déjà ce
 * plafond, et l'échelle continue au-delà.
 */
export type Level = 'facile' | 'moyen' | 'difficile' | 'expert' | 'maitre' | 'diabolique';

export interface LevelInfo {
  readonly id: Level;
  readonly label: string;
  /** Score maximal admis pour ce niveau. */
  readonly maxScore: number;
  /** Ce que le joueur devra savoir faire, en une phrase. */
  readonly description: string;
}

export const LEVELS: readonly LevelInfo[] = [
  {
    id: 'facile',
    label: 'Facile',
    maxScore: 1.5,
    description: 'Se résout à l’œil : il suffit de repérer, zone par zone, le seul endroit possible d’un chiffre.',
  },
  {
    id: 'moyen',
    label: 'Moyen',
    maxScore: 2.3,
    description: 'Demande de suivre les candidats d’une case, et parfois de croiser deux zones.',
  },
  {
    id: 'difficile',
    label: 'Difficile',
    maxScore: 2.8,
    description: 'Exige de raisonner sur des candidats verrouillés dans une zone. C’est le niveau des grilles de presse.',
  },
  {
    id: 'expert',
    label: 'Expert',
    maxScore: 3.4,
    description: 'Demande des paires réservées et des motifs croisés comme le X-Wing.',
  },
  {
    id: 'maitre',
    label: 'Maître',
    maxScore: 4.0,
    description: 'Triplets et Swordfish : il faut tenir plusieurs déductions de front.',
  },
  {
    id: 'diabolique',
    label: 'Diabolique',
    maxScore: 5.4,
    description: 'Quadruplets et Jellyfish, aux limites de ce qui se résout sans chaînes.',
  },
];

const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));

export const levelInfo = (id: Level): LevelInfo => LEVEL_BY_ID.get(id)!;

/** Niveau correspondant à un score, ou `null` s'il dépasse l'échelle connue. */
export function levelForScore(score: number): Level | null {
  for (const level of LEVELS) {
    if (score <= level.maxScore) return level.id;
  }
  return null;
}

export interface Rating {
  readonly outcome: SolveOutcome;
  /**
   * Score pic : le **maximum** des difficultés rencontrées, comme Sudoku
   * Explainer — et non leur somme.
   *
   * Les deux mesures répondent à des questions différentes : le maximum dit
   * « saurai-je la résoudre ? », la somme dirait « combien de temps cela me
   * prendra ? ». La seconde viendra plus tard ; commencer par en calibrer une
   * seule évite d’empiler des métriques dont aucune n’est encore validée.
   */
  readonly score: number;
  readonly hardestTechnique: TechniqueId | null;
  readonly hardestLabel: string | null;
  /** `null` si la grille dépasse le registre : elle sera rejetée, pas étiquetée. */
  readonly level: Level | null;
  readonly stepCount: number;
  readonly techniqueCounts: ReadonlyMap<TechniqueId, number>;
  readonly steps: readonly Step[];
  readonly ratingVersion: number;
}

/**
 * Note une grille par les techniques qu’elle exige réellement.
 *
 * Une grille que le registre ne sait pas résoudre reçoit `level: null` et un
 * `outcome` autre que `solved`. C’est volontaire : mieux vaut refuser de
 * conclure que d’apposer une étiquette au jugé — c’est précisément le reproche
 * le plus constant fait aux applications existantes.
 */
export function rate(grid: Grid, options: SolveLogicallyOptions = {}): Rating {
  const path = solveLogically(grid, options);

  let score = 0;
  let hardest: Step | null = null;
  const counts = new Map<TechniqueId, number>();

  for (const step of path.steps) {
    counts.set(step.technique, (counts.get(step.technique) ?? 0) + 1);
    if (step.difficulty > score) {
      score = step.difficulty;
      hardest = step;
    }
  }

  const solved = path.outcome === 'solved';
  return {
    outcome: path.outcome,
    score,
    hardestTechnique: hardest?.technique ?? null,
    hardestLabel: hardest?.label ?? null,
    level: solved ? levelForScore(score) : null,
    stepCount: path.steps.length,
    techniqueCounts: counts,
    steps: path.steps,
    ratingVersion: path.ratingVersion,
  };
}
