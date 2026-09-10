import { EMPTY, formatCell, hasDigit } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import type { Step } from './types.js';

/**
 * Vérification de **solidité** d'un raisonnement.
 *
 * C'est le garde-fou le plus important du solveur logique, et il répond à un
 * angle mort facile à laisser passer : vérifier qu'une grille finit résolue ne
 * dit rien de la justesse du chemin emprunté. Une technique boguée peut écarter
 * un candidat pour une mauvaise raison, et la grille se résoudre quand même par
 * les techniques suivantes — le test de complétude passerait, et l'indice
 * affiché au joueur raconterait pourtant une explication fausse.
 *
 * Sur une grille à solution unique, le critère est net :
 *   - un placement doit coïncider avec la solution ;
 *   - une élimination ne doit jamais porter sur le chiffre de la solution.
 *
 * Ce module n'est pas exporté par l'API publique du moteur : il sert aux tests
 * et au débogage.
 */

export class UnsoundStepError extends Error {
  readonly step: Step;

  constructor(message: string, step: Step) {
    super(message);
    this.name = 'UnsoundStepError';
    this.step = step;
  }
}

/**
 * Contrôle qu'une étape est logiquement valide au regard de la solution.
 * Lève `UnsoundStepError` au premier problème, avec de quoi le diagnostiquer.
 */
export function checkStepSoundness(step: Step, solution: Grid): void {
  for (const placement of step.placements) {
    const expected = solution[placement.cell];
    if (expected !== placement.digit) {
      throw new UnsoundStepError(
        `« ${step.label} » place ${String(placement.digit)} en ${formatCell(placement.cell)}, ` +
          `mais la solution y attend ${String(expected)}. Raisonnement : ${step.explanation}`,
        step,
      );
    }
  }

  for (const elimination of step.eliminations) {
    if (solution[elimination.cell] === elimination.digit) {
      throw new UnsoundStepError(
        `« ${step.label} » écarte le ${String(elimination.digit)} de ` +
          `${formatCell(elimination.cell)}, alors que c'est sa valeur dans la solution. ` +
          `Raisonnement : ${step.explanation}`,
        step,
      );
    }
  }

  if (step.placements.length === 0 && step.eliminations.length === 0) {
    throw new UnsoundStepError(`« ${step.label} » ne conclut rien.`, step);
  }
}

/** Applique le contrôle à tout un chemin de résolution. */
export function checkPathSoundness(steps: readonly Step[], solution: Grid): void {
  for (const step of steps) checkStepSoundness(step, solution);
}

/**
 * Contrôle qu'une grille partielle est compatible avec la solution attendue —
 * utile pour vérifier qu'une résolution interrompue n'a rien abîmé.
 */
export function isConsistentWith(grid: Grid, solution: Grid): boolean {
  for (let cell = 0; cell < grid.length; cell++) {
    if (grid[cell] !== EMPTY && grid[cell] !== solution[cell]) return false;
  }
  return true;
}

/** `true` si le masque de candidats contient encore la valeur de la solution. */
export function keepsSolution(mask: number, cell: number, solution: Grid): boolean {
  return hasDigit(mask, solution[cell]);
}
