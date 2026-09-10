import { CELL_COUNT, EMPTY, cloneGrid } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import { createRng } from '../rng/index.js';
import type { Rng } from '../rng/index.js';
import { hasUniqueSolution } from '../solver/index.js';
import { LEVELS, rate } from '../logic/index.js';
import type { Level, Rating } from '../logic/index.js';
import { digHoles, generateSolvedGrid, symmetryGroups } from './generate.js';
import type { Symmetry } from './generate.js';

/**
 * Génération d'une grille à niveau ciblé.
 *
 * ─── Pourquoi ce n'est pas une simple boucle de rejet ───────────────────────
 *
 * L'approche naïve — générer, noter, recommencer si le niveau ne convient pas —
 * a été mesurée avant d'être retenue, et elle ne tient pas. Le creusement
 * aléatoire produit une écrasante majorité de grilles faciles, même en retirant
 * un maximum d'indices : environ 1,4 tirage suffit pour une grille facile, il en
 * faut une soixantaine pour une difficile, et le niveau expert n'est jamais
 * apparu en quatre cents tirages.
 *
 * La raison tient au cœur du projet : la difficulté ne vient pas du nombre
 * d'indices mais de la **structure** de la grille. Retirer davantage de cases
 * n'engendre pas mécaniquement du raisonnement avancé.
 *
 * D'où la stratégie en deux temps :
 *   1. **rejet simple** tant qu'il est efficace (niveaux bas) ;
 *   2. **marche locale dirigée** au-delà : on part d'une grille valide et on
 *      échange des indices en ne conservant que les échanges qui font monter le
 *      score, jusqu'à atteindre le palier visé.
 *
 * C'est l'approche que documente Daniel Beer pour la génération de grilles
 * difficiles : sans recherche dirigée, on reste bloqué dans les minima locaux.
 * ───────────────────────────────────────────────────────────────────────────
 */

export interface GenerateAtLevelOptions {
  readonly level: Level;
  readonly seed?: string | number;
  readonly symmetry?: Symmetry;
  /** Nombre de grilles de départ tirées avant d'abandonner. */
  readonly maxAttempts?: number;
  /** Échanges tentés sur chaque grille de départ. */
  readonly maxSwaps?: number;
  /** Plafond de temps global, en millisecondes. */
  readonly timeBudgetMs?: number;
}

export interface LeveledPuzzle {
  readonly puzzle: Grid;
  readonly solution: Grid;
  readonly clues: number;
  readonly seed: string | number;
  readonly symmetry: Symmetry;
  readonly level: Level;
  readonly rating: Rating;
  /** `true` si le niveau demandé a été atteint exactement. */
  readonly exact: boolean;
}

const scoreCeilingOf = (level: Level): number =>
  LEVELS.find((candidate) => candidate.id === level)!.maxScore;

const scoreFloorOf = (level: Level): number => {
  const index = LEVELS.findIndex((candidate) => candidate.id === level);
  return index === 0 ? 0 : LEVELS[index - 1].maxScore;
};

const countClues = (grid: Grid): number => {
  let n = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== EMPTY) n++;
  }
  return n;
};

/**
 * Échange un groupe d'indices contre un autre, en préservant la symétrie.
 * Renvoie la grille modifiée, ou `null` si l'échange casse l'unicité.
 */
function trySwap(
  puzzle: Grid,
  solution: Grid,
  groups: readonly (readonly number[])[],
  rng: Rng,
): Grid | null {
  const empty = groups.filter((group) => group.every((cell) => puzzle[cell] === EMPTY));
  const filled = groups.filter((group) => group.every((cell) => puzzle[cell] !== EMPTY));
  if (empty.length === 0 || filled.length === 0) return null;

  const candidate = cloneGrid(puzzle);
  const toAdd = empty[rng.nextInt(empty.length)];
  const toRemove = filled[rng.nextInt(filled.length)];

  for (const cell of toAdd) candidate[cell] = solution[cell];
  for (const cell of toRemove) candidate[cell] = EMPTY;

  return hasUniqueSolution(candidate) ? candidate : null;
}

/**
 * Nombre d'échanges infructueux tolérés avant de laisser la marche vagabonder.
 * Au-delà, on accepte temporairement des échanges qui dégradent le score.
 */
const WANDER_AFTER = 18;
/** Longueur du vagabondage avant de revenir au meilleur point connu. */
const WANDER_LENGTH = 12;

/**
 * Fait monter le score d'une grille par échanges successifs.
 *
 * ─── Pourquoi une simple montée ne suffit pas ───────────────────────────────
 *
 * N'accepter que les échanges qui améliorent le score fait converger la marche
 * vers un plateau dont elle ne ressort plus. Mesuré ici : elle se bloque
 * systématiquement sur la paire cachée (3,4), qui est fréquente, sans jamais
 * atteindre les techniques plus rares au-dessus. Pour dépasser ce plateau il
 * faut d'abord accepter de descendre — supprimer la paire cachée qui masque un
 * raisonnement plus difficile.
 *
 * D'où le vagabondage décrit par Daniel Beer : après une série d'échecs, on
 * accepte quelques échanges dégradants, puis on repart du meilleur point connu.
 * Le meilleur est conservé à part, jamais perdu.
 * ───────────────────────────────────────────────────────────────────────────
 */
function climb(
  start: Grid,
  solution: Grid,
  groups: readonly (readonly number[])[],
  rng: Rng,
  targetFloor: number,
  maxSwaps: number,
  deadline: number,
): { grid: Grid; rating: Rating } {
  let current = start;
  let currentRating = rate(current);
  let best = current;
  let bestRating = currentRating;
  let sinceImprovement = 0;

  for (let i = 0; i < maxSwaps; i++) {
    if (bestRating.outcome === 'solved' && bestRating.score > targetFloor) break;
    if (Date.now() > deadline) break;

    const candidate = trySwap(current, solution, groups, rng);
    if (candidate === null) continue;

    const candidateRating = rate(candidate);
    // Une grille que le registre ne sait pas résoudre est un cul-de-sac : on ne
    // pourrait pas l'étiqueter honnêtement.
    if (candidateRating.outcome !== 'solved') continue;

    const wandering = sinceImprovement >= WANDER_AFTER;
    if (candidateRating.score >= currentRating.score || wandering) {
      current = candidate;
      currentRating = candidateRating;
    }

    if (candidateRating.score > bestRating.score) {
      best = candidate;
      bestRating = candidateRating;
      sinceImprovement = 0;
    } else {
      sinceImprovement++;
      if (sinceImprovement > WANDER_AFTER + WANDER_LENGTH) {
        current = best;
        currentRating = bestRating;
        sinceImprovement = 0;
      }
    }
  }

  return { grid: best, rating: bestRating };
}

/**
 * Produit une grille du niveau demandé.
 *
 * Renvoie la meilleure approximation trouvée si le budget est épuisé, avec
 * `exact: false` — à l'appelant de décider s'il l'accepte. Renvoie `null`
 * uniquement si aucune grille notable n'a pu être produite, ce qui ne devrait
 * pas arriver.
 */
export function generateAtLevel(options: GenerateAtLevelOptions): LeveledPuzzle | null {
  const seed = options.seed ?? Math.floor(Math.random() * 0xffff_ffff);
  const symmetry = options.symmetry ?? 'rotational180';
  const maxAttempts = options.maxAttempts ?? 40;
  // Les niveaux élevés exigent nettement plus d'exploration : les techniques
  // rares n'apparaissent qu'après avoir démonté les motifs plus simples qui les
  // masquaient.
  const maxSwaps = options.maxSwaps ?? 400;
  // `Date.now` et non `performance.now` : le moteur ne doit dépendre d'aucun
  // global d'environnement, et la résolution à la milliseconde suffit largement
  // pour un budget qui se compte en secondes.
  const deadline = Date.now() + (options.timeBudgetMs ?? 8000);

  const rng = createRng(seed);
  const groups = symmetryGroups(symmetry);
  const floor = scoreFloorOf(options.level);
  const ceiling = scoreCeilingOf(options.level);

  let best: { grid: Grid; solution: Grid; rating: Rating } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolvedGrid(rng);
    const puzzle = digHoles(solution, rng, { symmetry });
    let rating = rate(puzzle);
    let grid = puzzle;

    // Trop facile : on tente de faire monter le score par échanges plutôt que
    // de repartir de zéro, beaucoup plus coûteux à niveau élevé.
    if (rating.outcome !== 'solved' || rating.score <= floor) {
      const climbed = climb(grid, solution, groups, rng, floor, maxSwaps, deadline);
      grid = climbed.grid;
      rating = climbed.rating;
    }

    if (rating.outcome === 'solved') {
      if (rating.score > floor && rating.score <= ceiling) {
        return {
          puzzle: grid,
          solution,
          clues: countClues(grid),
          seed,
          symmetry,
          level: options.level,
          rating,
          exact: true,
        };
      }
      // On garde la tentative la plus proche du palier visé, par en dessous.
      if (best === null || rating.score > best.rating.score) {
        best = { grid, solution, rating };
      }
    }

    if (Date.now() > deadline) break;
  }

  if (best === null) return null;
  return {
    puzzle: best.grid,
    solution: best.solution,
    clues: countClues(best.grid),
    seed,
    symmetry,
    level: best.rating.level ?? options.level,
    rating: best.rating,
    exact: false,
  };
}
