import { rate, replayPath, tryDecodeGrid } from '@sudoku/engine';
import type { Grid, Position, Rating, Step, TechniqueId } from '@sudoku/engine';

/**
 * Le corpus des leçons, et la fabrication d'un exercice.
 *
 * ─── Ce que le corpus porte, et ce qu'il ne porte pas ───────────────────────
 *
 * Uniquement des grilles encodées, rangées par technique. Ni le score, ni le
 * niveau, ni la position de départ de l'exercice. Tout cela se recalcule
 * localement en quelques millisecondes, et le corpus reste ainsi insensible aux
 * évolutions du moteur — même raisonnement que pour le défi quotidien et pour le
 * code imprimé sous chaque grille.
 *
 * Le point le plus important est l'absence d'**index d'étape**. Figer « la
 * technique est à l'étape 41 » paraît économique ; c'est un piège. Si le barème
 * évolue, le chemin change et l'index désigne silencieusement autre chose. En
 * cherchant la première étape qui emploie la technique, on obtient soit une
 * vraie occurrence, soit rien du tout — et « rien du tout » se dit.
 *
 * ─── Pourquoi une position, et non une grille ───────────────────────────────
 *
 * Voir `buildExercise`. C'est la mesure qui a décidé de la forme.
 */

export interface LessonCorpus {
  readonly version: number;
  /*
    `| undefined` est explicite, comme pour le corpus quotidien : indexer par une
    clé absente rend `undefined` à l'exécution, et le linter réclamerait sinon le
    retrait des gardes qui protègent de ce cas.
  */
  readonly grids: Readonly<Record<string, readonly string[] | undefined>>;
}

const CORPUS_URL = `${import.meta.env.BASE_URL}learn/corpus.json`;

let cached: LessonCorpus | null = null;
let pending: Promise<LessonCorpus | null> | null = null;

const isCorpus = (value: unknown): value is LessonCorpus => {
  if (typeof value !== 'object' || value === null) return false;
  const corpus = value as Record<string, unknown>;
  return (
    typeof corpus['version'] === 'number' &&
    typeof corpus['grids'] === 'object' &&
    corpus['grids'] !== null
  );
};

/**
 * Charge le corpus, une seule fois par session.
 *
 * Rend `null` plutôt que de lever : l'absence de corpus doit dégrader l'onglet
 * des leçons, jamais empêcher de jouer.
 */
export async function loadLessonCorpus(): Promise<LessonCorpus | null> {
  if (cached !== null) return cached;
  pending ??= (async (): Promise<LessonCorpus | null> => {
    try {
      const response = await fetch(CORPUS_URL);
      if (!response.ok) return null;
      const parsed: unknown = await response.json();
      if (!isCorpus(parsed)) return null;
      cached = parsed;
      return parsed;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return await pending;
}

/** Remet le cache à zéro. Réservé aux tests. */
export function resetLessonCache(): void {
  cached = null;
  pending = null;
}

/** Grilles disponibles pour une technique. Vide quand il n'y en a aucune. */
export function gridsFor(corpus: LessonCorpus, technique: TechniqueId): readonly string[] {
  return corpus.grids[technique] ?? [];
}

export interface Exercise {
  readonly technique: TechniqueId;
  /** La grille d'origine, telle qu'encodée dans le corpus. */
  readonly origin: Grid;
  readonly solution: Grid;
  /** Valeurs **et** candidats à l'instant où la technique devient nécessaire. */
  readonly position: Position;
  /** Ce que le joueur doit trouver. */
  readonly step: Step;
  /** Notation de la grille entière, pour situer l'exercice. */
  readonly rating: Rating;
  /** Rang de l'étape dans le chemin, à titre indicatif. */
  readonly stepIndex: number;
}

/**
 * Fabrique un exercice amorcé à partir d'une grille du corpus.
 *
 * ─── Pourquoi la position porte ses candidats ───────────────────────────────
 *
 * L'idée est de rejouer le chemin de résolution jusqu'à l'instant où la
 * technique devient nécessaire, et de donner cette position au joueur : il
 * rencontre le X-Wing tout de suite, au lieu de poser quarante singles d'abord.
 *
 * Le mécanisme naïf fige les **valeurs** de cette position en une nouvelle
 * grille. Mesuré sur treize techniques, il ne tient que quatre fois. La raison
 * est instructive : une position en cours de résolution porte des candidats déjà
 * écartés par les étapes précédentes, et ce sont précisément ces éliminations
 * qui rendent la technique nécessaire. Les redériver depuis les valeurs les fait
 * réapparaître, et une technique plus simple redevient applicable — l'amorce
 * « X-Wing » s'ouvre alors sur une paire pointante.
 *
 * D'où une `Position` : valeurs et candidats, transmis ensemble.
 *
 * Rend `null` à la moindre anomalie — code illisible, grille que le registre ne
 * sait plus résoudre, technique absente du chemin. L'appelant le dit au joueur
 * au lieu d'afficher un exercice qui ne porterait pas sur la leçon.
 */
export function buildExercise(code: string, technique: TechniqueId): Exercise | null {
  const origin = tryDecodeGrid(code);
  if (origin === null) return null;

  const rating = rate(origin);
  if (rating.outcome !== 'solved') return null;

  const stepIndex = rating.steps.findIndex((step) => step.technique === technique);
  if (stepIndex < 0) return null;

  const frames = replayPath(origin, rating.steps);
  /*
    `.at()` plutôt que `[…]` : `noUncheckedIndexedAccess` est désactivé dans ce
    projet, donc l'indexation promet un élément que l'exécution ne garantit pas,
    et le linter réclamerait le retrait de la garde. `.at()` dit la vérité — et
    la garde protège du seul cas qui compte : un corpus désynchronisé du barème.
  */
  const frame = frames.at(stepIndex);
  const step = rating.steps.at(stepIndex);
  if (frame === undefined || step === undefined) return null;

  return {
    technique,
    origin,
    // La solution vient du chemin lui-même : sa dernière image est la grille
    // résolue, et la recalculer serait redondant.
    solution: frames.at(-1)?.values ?? origin,
    position: { values: frame.values, candidates: frame.candidates },
    step,
    rating,
    stepIndex,
  };
}
