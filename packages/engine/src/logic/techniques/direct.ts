import { UNITS, maskOf } from '../../grid/index.js';
import type { Digit, DigitMask } from '../../grid/index.js';
import { defineTechnique } from '../technique.js';
import type {
  Elimination,
  LogicStateView,
  Step,
  TechniqueEntry,
  TechniqueId,
} from '../types.js';
import { hiddenSingle } from './hiddenSingle.js';
import { nakedSingle } from './nakedSingle.js';

/**
 * Variantes « Direct » du barème Sudoku Explainer.
 *
 * Une paire pointante ou une paire cachée ne fait normalement qu'écarter des
 * candidats. Mais lorsque ces éliminations débloquent **immédiatement** une
 * case, Sudoku Explainer la reclasse en variante « Direct » et la note nettement
 * moins cher : le joueur n'a pas eu à retenir une élimination abstraite pour
 * plus tard, il a vu le coup dans la foulée.
 *
 *   Paire pointante   2,6  →  Direct  1,7
 *   Paire revendiquée 2,8  →  Direct  1,9
 *   Paire cachée      3,4  →  Direct  2,0
 *   Triplet caché     4,0  →  Direct  2,5
 *
 * D'où l'importance d'énumérer tous les motifs d'une technique : ce n'est pas
 * forcément le premier qui débloque quelque chose, et se contenter de celui-ci
 * ferait manquer la variante bon marché — donc surévaluerait la grille.
 */

/**
 * Vue de l'état à laquelle on a retiré des candidats, sans rien modifier.
 *
 * Permet de répondre à « et si j'appliquais ces éliminations ? » sans cloner
 * l'état ni le muter, ce qui compte : cette question est posée pour chaque
 * motif de chaque technique enveloppée.
 */
class ViewWithout implements LogicStateView {
  private readonly base: LogicStateView;
  private readonly removed: ReadonlyMap<number, DigitMask>;

  constructor(base: LogicStateView, eliminations: readonly Elimination[]) {
    this.base = base;
    const removed = new Map<number, DigitMask>();
    for (const { cell, digit } of eliminations) {
      removed.set(cell, (removed.get(cell) ?? 0) | maskOf(digit));
    }
    this.removed = removed;
  }

  valueAt(cell: number): number {
    return this.base.valueAt(cell);
  }

  candidatesAt(cell: number): DigitMask {
    return this.base.candidatesAt(cell) & ~(this.removed.get(cell) ?? 0);
  }

  isEmpty(cell: number): boolean {
    return this.base.isEmpty(cell);
  }

  placesFor(unitIndex: number, digit: Digit): number[] {
    const mask = maskOf(digit);
    return UNITS[unitIndex].cells.filter((cell) => (this.candidatesAt(cell) & mask) !== 0);
  }

  emptyCellsOf(unitIndex: number): number[] {
    return this.base.emptyCellsOf(unitIndex);
  }
}

/** Cellules et chiffres réellement touchés par les éliminations. */
function touched(eliminations: readonly Elimination[]): {
  cells: ReadonlySet<number>;
  pairs: ReadonlySet<string>;
} {
  const cells = new Set<number>();
  const pairs = new Set<string>();
  for (const { cell, digit } of eliminations) {
    cells.add(cell);
    pairs.add(`${String(cell)}:${String(digit)}`);
  }
  return { cells, pairs };
}

/**
 * Le single trouvé découle-t-il vraiment des éliminations, ou existait-il déjà ?
 *
 * La question n'est pas théorique : dans l'ordre de Sudoku Explainer, les
 * variantes « Direct » sont essayées **avant** le single nu. Un single nu déjà
 * présent serait donc reclassé à tort en Direct, et noté trop bas.
 */
function isNewlyUnlocked(single: Step, eliminations: readonly Elimination[]): boolean {
  // On teste la longueur plutôt que `=== undefined` : avec l'indexation non
  // stricte du moteur, TypeScript croit l'accès toujours défini, alors que le
  // tableau peut parfaitement être vide.
  if (single.placements.length === 0) return false;
  const placement = single.placements[0];
  const { cells, pairs } = touched(eliminations);

  if (single.technique === 'naked-single') {
    // Nouveau seulement si la case elle-même a perdu des candidats.
    return cells.has(placement.cell);
  }

  // Single caché : il faut qu'une place de ce chiffre ait disparu de l'unité.
  if (single.units.length === 0) return false;
  const unitIndex = single.units[0];
  return UNITS[unitIndex].cells.some((cell) => pairs.has(`${String(cell)}:${String(placement.digit)}`));
}

interface DirectMapping {
  readonly from: TechniqueId;
  readonly to: TechniqueId;
  readonly label: string;
  readonly difficulty: number;
}

/**
 * Enveloppe une technique : pour chaque motif dont les éliminations débloquent
 * une case, produit la variante « Direct » correspondante.
 */
function asDirect(name: string, base: TechniqueEntry, mappings: readonly DirectMapping[]) {
  const byTechnique = new Map(mappings.map((m) => [m.from, m]));

  return defineTechnique(name, function* (state) {
    for (const step of base.findAll(state)) {
      const mapping = byTechnique.get(step.technique);
      if (mapping === undefined || step.eliminations.length === 0) continue;

      const view = new ViewWithout(state, step.eliminations);
      /*
        On s'arrête au PREMIER single trouvé, sans énumérer les suivants.

        C'est contre-intuitif : énumérer tous les singles pour retenir le premier
        qui découle vraiment des éliminations paraît plus rigoureux, puisqu'un
        single préexistant peut se présenter en tête et faire rejeter un motif
        pourtant valable. Cette variante a été implémentée et mesurée — elle
        éloigne de la référence (89,9 % d'accord contre 90,9 %). L'oracle semble
        donc s'arrêter lui aussi au premier candidat. La mesure tranche, pas
        l'intuition.
      */
      const single = hiddenSingle.find(view) ?? nakedSingle.find(view);
      if (single === null || !isNewlyUnlocked(single, step.eliminations)) continue;

      const placement = single.placements[0];
      yield {
        ...step,
        technique: mapping.to,
        label: mapping.label,
        difficulty: mapping.difficulty,
        placements: [placement],
        explanation:
          `${step.explanation} Cela suffit à débloquer ${single.label.toLowerCase()} : ` +
          `${single.explanation.charAt(0).toLowerCase()}${single.explanation.slice(1)}`,
      };
    }
  });
}

/** Construit les variantes Direct à partir des techniques de base. */
export function directLocking(locking: TechniqueEntry): TechniqueEntry {
  return asDirect('direct-locking', locking, [
    { from: 'pointing', to: 'direct-pointing', label: 'Paire pointante directe', difficulty: 1.7 },
    {
      from: 'claiming',
      to: 'direct-claiming',
      label: 'Paire revendiquée directe',
      difficulty: 1.9,
    },
  ]);
}

export function directHiddenPair(hiddenPair: TechniqueEntry): TechniqueEntry {
  return asDirect('direct-hidden-pair', hiddenPair, [
    { from: 'hidden-pair', to: 'direct-hidden-pair', label: 'Paire cachée directe', difficulty: 2.0 },
  ]);
}

export function directHiddenTriple(hiddenTriple: TechniqueEntry): TechniqueEntry {
  return asDirect('direct-hidden-triple', hiddenTriple, [
    {
      from: 'hidden-triple',
      to: 'direct-hidden-triple',
      label: 'Triplet caché direct',
      difficulty: 2.5,
    },
  ]);
}
