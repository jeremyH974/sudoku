import {
  assignmentOf,
  basicExclusion,
  findSubsets,
  initialDomains,
  isComplete,
  singleton,
} from '../board.js';
import { pruneClue, type Pruning } from '../clues/propagate.js';
import { holds } from '../clues/semantics.js';
import { cellsOf, cloneSet, isEmpty, subtract, type CellSet } from '../scene/cellset.js';
import { columnOf, rowOf } from '../scene/types.js';
import type { Puzzle } from '../types.js';

/**
 * Le solveur exact : celui qui n'explique rien et ne se trompe jamais.
 *
 * Son seul rôle est l'unicité. `solver/solver.ts` joue exactement ce rôle pour
 * le sudoku, et la division du travail est la même qu'ici : ce module dit
 * **combien** de solutions une affaire admet, `deduce/` dit **comment** un
 * humain y arrive. Confondre les deux produirait soit une notation fausse, soit
 * un générateur qui accepte des affaires impossibles à raisonner.
 *
 * Il s'arrête à la deuxième solution trouvée : compter toutes les solutions
 * d'une affaire mal contrainte est un gaspillage classique, et sans intérêt —
 * deux suffisent à la rejeter.
 */
export function solveExact(puzzle: Puzzle, limit = 2): number[][] {
  const found: number[][] = [];
  search(puzzle, initialDomains(puzzle.scene, puzzle.suspects.length), found, limit);
  return found;
}

/** L'affaire a-t-elle exactement une solution ? */
export const hasUniqueSolution = (puzzle: Puzzle): boolean => solveExact(puzzle, 2).length === 1;

function search(puzzle: Puzzle, domains: CellSet[], found: number[][], limit: number): void {
  if (found.length >= limit) return;
  if (!reduce(puzzle, domains)) return;

  if (isComplete(domains)) {
    const at = assignmentOf(domains);
    // La propagation est volontairement incomplète : elle ne prouve pas qu'une
    // disposition satisfait tous les indices, seulement qu'aucun ne l'interdit
    // par les raisonnements qu'elle sait tenir. La vérification finale est donc
    // obligatoire, et c'est elle qui définit la vérité.
    if (isSatisfied(puzzle, at)) found.push(at);
    return;
  }

  const pick = mostConstrained(domains);
  for (const cell of cellsOf(domains[pick])) {
    if (found.length >= limit) return;
    const branch = domains.map(cloneSet);
    branch[pick] = singleton(puzzle.scene, cell);
    search(puzzle, branch, found, limit);
  }
}

/**
 * Les places encore possibles de chacun, sans jamais rien essayer.
 *
 * C'est la propagation seule — aucune recherche, aucune hypothèse. Trois
 * usages, et c'est pourquoi elle est publique : le solveur exact s'en sert à
 * chaque nœud, les tests par propriété vérifient dessus que rien de vrai n'est
 * jamais écarté, et l'interface en tire les places qu'elle peut proposer au
 * joueur sans lui souffler la réponse.
 *
 * Renvoie `null` si l'affaire est contradictoire.
 */
export function openDomains(puzzle: Puzzle): CellSet[] | null {
  const domains = initialDomains(puzzle.scene, puzzle.suspects.length);
  return reduce(puzzle, domains) ? domains : null;
}

/**
 * Réduit les domaines jusqu'au point fixe. Renvoie `false` si l'affaire est
 * contradictoire dans cet état.
 *
 * Trois sources de réduction, dans l'ordre de leur coût : les indices, la
 * règle du plateau à degré 1, et les tranches que plus personne ne peut occuper
 * sauf une personne. Au-delà, la recherche tranche plus vite que la
 * propagation — c'est le compromis habituel, et il se mesurera si un jour un
 * plateau 16×16 le remet en cause.
 */
function reduce(puzzle: Puzzle, domains: CellSet[]): boolean {
  for (;;) {
    let progressed = false;

    const rounds: Pruning[][] = [
      ...puzzle.clues.map((clue) => pruneClue(clue, puzzle.scene, domains)),
      basicExclusion(puzzle.scene, domains),
      ...[...findSubsets(puzzle.scene, domains, 1, true)].map((subset) => [...subset.prunings]),
    ];
    for (const prunings of rounds) {
      const outcome = apply(prunings, domains);
      if (outcome === 'contradiction') return false;
      if (outcome === 'changed') progressed = true;
    }

    if (!progressed) return true;
  }
}

/** Ce qu'un tour de propagation a produit. */
type Outcome = 'contradiction' | 'changed' | 'stable';

/** Applique des éliminations, et dit si l'affaire y survit. */
function apply(prunings: readonly Pruning[], domains: CellSet[]): Outcome {
  let moved = false;
  for (const { suspect, remove } of prunings) {
    if (subtract(domains[suspect], remove)) moved = true;
    if (isEmpty(domains[suspect])) return 'contradiction';
  }
  return moved ? 'changed' : 'stable';
}

/** Le suspect au plus petit domaine encore ouvert. */
function mostConstrained(domains: readonly CellSet[]): number {
  let best = -1;
  let bestSize = Number.POSITIVE_INFINITY;
  for (let suspect = 0; suspect < domains.length; suspect++) {
    const size = cellsOf(domains[suspect]).length;
    if (size > 1 && size < bestSize) {
      best = suspect;
      bestSize = size;
    }
  }
  return best;
}

/**
 * La disposition respecte-t-elle la règle du plateau **et** tous les indices ?
 *
 * C'est la définition de « résolue », et le seul endroit où elle est écrite.
 * Le générateur s'en sert pour énumérer les indices vrais, les tests par
 * propriété pour vérifier que les propagateurs ne mentent pas.
 */
export function isSatisfied(puzzle: Puzzle, at: readonly number[]): boolean {
  const { scene } = puzzle;
  const rows = new Set<number>();
  const columns = new Set<number>();
  for (const cell of at) {
    rows.add(rowOf(scene, cell));
    columns.add(columnOf(scene, cell));
  }
  if (rows.size !== at.length || columns.size !== at.length) return false;

  return puzzle.clues.every((clue) => holds(clue, scene, at));
}
