import type { LogicStateView, Step, TechniqueEntry } from './types.js';

/**
 * Fabrique une entrée de registre à partir de son énumérateur.
 *
 * Chaque technique n'écrit que `findAll` ; `find` en découle mécaniquement.
 * Comme `findAll` est un générateur, s'arrêter au premier motif ne calcule pas
 * les suivants : l'énumération complète ne coûte que lorsqu'on la demande
 * réellement, ce que seules les variantes « Direct » et le banc d'analyse font.
 */
export function defineTechnique(
  name: string,
  findAll: (state: LogicStateView) => Generator<Step>,
): TechniqueEntry {
  return {
    name,
    findAll,
    find(state: LogicStateView): Step | null {
      for (const step of findAll(state)) return step;
      return null;
    },
  };
}
