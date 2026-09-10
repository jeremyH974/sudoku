import { CELL_COUNT, EMPTY, cloneGrid } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import { createRng } from '../rng/index.js';
import type { Rng } from '../rng/index.js';
import { hasUniqueSolution } from '../solver/index.js';
import { LEVELS, rate, techniqueInfo } from '../logic/index.js';
import type { Level, Rating, TechniqueId } from '../logic/index.js';
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
 *
 * ─── Pourquoi la marche connaît aussi son plafond ───────────────────────────
 *
 * Monter sans regarder au-dessus de soi paraît inoffensif : on s'arrête dès que
 * le plancher est franchi. Ce n'est vrai que si les paliers sont espacés. Dès
 * que l'échelle se resserre — l'ajout des liens forts et des wings a rempli la
 * bande 4,0 à 4,4 — un seul échange peut faire passer de 2,3 à 4,4, très
 * au-dessus du niveau demandé. La tentative entière est alors perdue.
 *
 * Mesuré : à « Difficile » et « Expert », les échecs ne manquaient jamais le
 * palier par en dessous, ils le **dépassaient**, toujours en atterrissant à 4,4.
 * Une grille au-dessus du plafond est donc traitée ici comme un cul-de-sac, au
 * même titre qu'une grille que le registre ne sait pas résoudre.
 * ───────────────────────────────────────────────────────────────────────────
 */
function climb(
  start: Grid,
  solution: Grid,
  groups: readonly (readonly number[])[],
  rng: Rng,
  targetFloor: number,
  targetCeiling: number,
  maxSwaps: number,
  deadline: number,
  /**
   * Appelé sur chaque candidat noté et résolu. Renvoyer `true` arrête la marche
   * sur ce candidat, qui devient le résultat.
   *
   * Sans ce crochet, une grille qui satisfait déjà ce que l'appelant cherche
   * serait traversée puis jetée : la marche ne juge que sur le score, et deux
   * techniques peuvent partager le même. C'est ce qui séparait, à la mesure, une
   * recherche qui aboutit en quelques secondes d'une qui échoue en quarante-cinq.
   */
  onRated?: (grid: Grid, rating: Rating) => boolean,
): { grid: Grid; rating: Rating } {
  let current = start;
  let currentRating = rate(current);
  /*
    ─── Le point de départ ne devient « le meilleur » que s'il est utilisable ──

    `rate()` calcule le score comme le maximum des étapes parcourues, **quel que
    soit le verdict**. Une grille creusée qui se bloque porte donc quand même un
    score — celui de l'étape la plus dure atteinte avant le blocage, souvent
    élevé. Mesuré : 13 % des grilles creusées ressortent `stuck`.

    En faire le point de référence condamnait la marche. La promotion exige un
    score **strictement** supérieur : une grille résolue à 3,2 ne pouvait alors
    jamais déloger un départ bloqué à 4,0, `current` n'avançait pas davantage,
    et tous les trente échecs la marche revenait s'asseoir sur ce point mort.
    Elle brûlait ses quatre cents échanges **et** le budget de temps partagé,
    donc aussi les tentatives suivantes. `generateAtLevel` jetait ensuite la
    grille bloquée sans même la retenir comme approximation.

    D'où un meilleur qui commence à « rien » plutôt qu'à « inutilisable ».
  */
  const usable = currentRating.outcome === 'solved' && currentRating.score <= targetCeiling;
  let best: Grid | null = usable ? current : null;
  let bestRating: Rating | null = usable ? currentRating : null;
  let sinceImprovement = 0;

  for (let i = 0; i < maxSwaps; i++) {
    if (bestRating !== null && bestRating.score > targetFloor) break;
    if (Date.now() > deadline) break;

    const candidate = trySwap(current, solution, groups, rng);
    if (candidate === null) continue;

    const candidateRating = rate(candidate);
    // Une grille que le registre ne sait pas résoudre est un cul-de-sac : on ne
    // pourrait pas l'étiqueter honnêtement.
    if (candidateRating.outcome !== 'solved') continue;
    // Au-dessus du palier demandé, c'en est un autre : la marche s'y engagerait
    // sans pouvoir redescendre, et l'échange serait perdu.
    if (candidateRating.score > targetCeiling) continue;

    if (onRated?.(candidate, candidateRating) === true) {
      return { grid: candidate, rating: candidateRating };
    }

    /*
      Un départ bloqué porte un score élevé mais ne vaut rien : on ne le prend
      pas pour référence de comparaison non plus, sans quoi la marche resterait
      figée exactement comme avant.
    */
    const currentScore = currentRating.outcome === 'solved' ? currentRating.score : -1;
    const wandering = sinceImprovement >= WANDER_AFTER;
    if (candidateRating.score >= currentScore || wandering) {
      current = candidate;
      currentRating = candidateRating;
    }

    if (bestRating === null || candidateRating.score > bestRating.score) {
      best = candidate;
      bestRating = candidateRating;
      sinceImprovement = 0;
    } else {
      sinceImprovement++;
      if (sinceImprovement > WANDER_AFTER + WANDER_LENGTH) {
        current = best!;
        currentRating = bestRating;
        sinceImprovement = 0;
      }
    }
  }

  // Aucun candidat utilisable : on rend le départ tel quel, et l'appelant le
  // rejettera comme il rejetait déjà toute grille non résolue.
  return best === null || bestRating === null
    ? { grid: start, rating: rate(start) }
    : { grid: best, rating: bestRating };
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
      const climbed = climb(grid, solution, groups, rng, floor, ceiling, maxSwaps, deadline);
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
      // On garde la tentative la plus proche du palier visé, par en dessous —
      // ce que le commentaire annonçait déjà, mais que le code ne faisait pas :
      // sans la borne, une grille très au-dessus du plafond devenait la
      // « meilleure » et interdisait à toutes les suivantes de la remplacer.
      if (rating.score <= ceiling && (best === null || rating.score > best.rating.score)) {
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

/* ─── Génération visant une technique précise ─────────────────────────────── */

export interface GenerateForTechniqueOptions {
  /** Technique que la grille doit exiger, et qui doit y être la plus difficile. */
  readonly technique: TechniqueId;
  readonly seed?: string | number;
  readonly symmetry?: Symmetry;
  /**
   * Plancher d'indices.
   *
   * Indispensable au bas de l'échelle, et seulement là : une grille dont la
   * technique la plus dure est « Dernière case » est presque pleine. Mesuré —
   * à 70 indices, 52 grilles sur 60 ; à 26, aucune.
   */
  readonly minClues?: number;
  readonly maxAttempts?: number;
  readonly maxSwaps?: number;
  readonly timeBudgetMs?: number;
}

export interface TechniquePuzzle {
  readonly puzzle: Grid;
  readonly solution: Grid;
  readonly clues: number;
  readonly seed: string | number;
  readonly symmetry: Symmetry;
  readonly technique: TechniqueId;
  readonly rating: Rating;
}

/**
 * Produit une grille dont la technique **la plus difficile** est celle demandée.
 *
 * ─── Pourquoi le palier ne suffit pas ───────────────────────────────────────
 *
 * Un palier est une bande de scores, et les bandes contiennent plusieurs
 * techniques : « Expert » couvre la paire nue, le X-Wing et la paire cachée.
 * Mesuré sur vingt-quatre tirages ciblés par palier : le X-Wing sort dix fois
 * sur vingt-quatre en Expert, et le Swordfish, le triplet caché, le XYZ-Wing et
 * le Jellyfish **jamais**. Enseigner une technique suppose de la demander, pas
 * de l'espérer.
 *
 * ─── Pourquoi un plafond serré, alors qu'il paraît handicaper la marche ─────
 *
 * L'intuition dit d'ouvrir le plafond pour laisser la marche circuler, et de ne
 * trancher qu'à l'arrivée sur le nom de la technique. C'est le contraire qui est
 * vrai, et cela a été mesuré : à plafond ouvert (5,4), le triplet nu, le
 * Swordfish et le Jellyfish échouent tous les trois en quarante-cinq secondes ;
 * à plafond serré ils sortent en 3,7 s, 6,9 s et 39 s. Le plafond n'est pas
 * qu'un filtre de sortie — il **retient** la marche dans la région utile au lieu
 * de la laisser fuir vers 4,2, où les wings abondent.
 *
 * ─── Ce que cette fonction ne promet pas ────────────────────────────────────
 *
 * Elle renvoie `null` plutôt qu'une approximation. Une grille « presque » de la
 * bonne technique n'a aucun sens pédagogique : l'exercice porterait sur autre
 * chose que la leçon. Mesuré : le quadruplet nu (5,0) n'apparaît dans aucun
 * chemin sur ~22 000 échanges — sa géométrie l'interdit presque toujours, le
 * complément d'un quadruplet nu étant un motif moins cher, donc trouvé avant.
 * Une leçon sans grille se dit ; elle ne se fabrique pas.
 */
export function generateForTechnique(
  options: GenerateForTechniqueOptions,
): TechniquePuzzle | null {
  const seed = options.seed ?? Math.floor(Math.random() * 0xffff_ffff);
  const symmetry = options.symmetry ?? 'rotational180';
  const maxAttempts = options.maxAttempts ?? 60;
  const maxSwaps = options.maxSwaps ?? 400;
  const deadline = Date.now() + (options.timeBudgetMs ?? 30_000);

  const rng = createRng(seed);
  const groups = symmetryGroups(symmetry);
  const ceiling = techniqueInfo(options.technique).difficulty;
  /*
    Le plancher est juste sous le plafond : `climb` s'arrête dès qu'elle le
    dépasse, donc exactement quand le score atteint la difficulté visée. Le nom
    de la technique reste à vérifier — deux paires d'ex æquo subsistent à 4,0 et
    à 4,2.
  */
  const floor = ceiling - 0.001;

  const accept = (grid: Grid, solution: Grid, rating: Rating): TechniquePuzzle => ({
    puzzle: grid,
    solution,
    clues: countClues(grid),
    seed,
    symmetry,
    technique: options.technique,
    rating,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolvedGrid(rng);
    const dug = digHoles(solution, rng, {
      symmetry,
      ...(options.minClues === undefined ? {} : { minClues: options.minClues }),
    });

    let grid = dug;
    let rating = rate(grid);
    if (rating.outcome === 'solved' && rating.hardestTechnique === options.technique) {
      return accept(grid, solution, rating);
    }

    if (rating.outcome !== 'solved' || rating.score <= floor) {
      const climbed = climb(
        grid,
        solution,
        groups,
        rng,
        floor,
        ceiling,
        maxSwaps,
        deadline,
        (_, candidate) => candidate.hardestTechnique === options.technique,
      );
      grid = climbed.grid;
      rating = climbed.rating;
      if (rating.outcome === 'solved' && rating.hardestTechnique === options.technique) {
        return accept(grid, solution, rating);
      }
    }

    if (Date.now() > deadline) break;
  }

  return null;
}
