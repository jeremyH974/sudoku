import {
  CELL_COUNT,
  EMPTY,
  RATING_VERSION,
  SIZE,
  digitsOf,
  encodeGrid,
  findConflicts,
  findNextStep,
  analysePath,
  findNextStepFrom,
  findSolution,
  formatGrid,
  gridLabel,
  hasDigit,
  indexOf,
  rate,
  tryDecodeGrid,
  withDigit,
  withoutDigit,
} from '@sudoku/engine';
import type {
  Level,
  LeveledPuzzle,
  Position,
  Rating,
  Step,
  Symmetry,
  TechniqueId,
} from '@sudoku/engine';
import { engine } from './engineClient.js';
import { localDayKey } from './day.js';
import type { DayKey } from './day.js';
import { Stopwatch } from './stopwatch.svelte.js';
import { MAX_HISTORY, toSnapshot } from './storage.js';
import type { GameSnapshot, RestoredGame } from './storage.js';
import type { GameRecord } from './stats.js';
import type { Exercise } from './learn.js';
import { restrictToNotes, toggleMark } from './marks.js';
import type { Mark } from './marks.js';

/** L'état d'une case avant le geste : valeur, notes, marques. */
interface CellState {
  readonly cell: number;
  readonly previousValue: number;
  readonly previousNotes: number;
  readonly previousNoteColors: number;
}

/**
 * Un **geste** du joueur, et non une écriture de case.
 *
 * C'est l'unité d'annulation, et ce n'était pas le cas jusqu'à l'incrément 9 :
 * poser un chiffre efface des notes chez jusqu'à vingt voisines, et seule la
 * case jouée était enregistrée. Ctrl+Z rendait donc la valeur en laissant le
 * raisonnement détruit — les marques A/B/C comprises, perdues deux fois puisque
 * le candidat partait avec.
 *
 * La case sur laquelle le joueur a agi est **en tête** : c'est elle que
 * l'annulation resélectionne, et c'est elle que la sauvegarde garde en clair
 * pour rester relisible par une version antérieure.
 */
interface Move {
  readonly cells: readonly CellState[];
}

/**
 * Paliers de révélation d'un indice.
 *
 * Le reproche le plus constant fait aux applications existantes est que leur
 * indice donne la réponse sans rien enseigner. Ici, la révélation est graduée :
 * on montre d'abord *où* regarder, puis *quel raisonnement* s'applique et
 * pourquoi, et seulement en dernier recours *le coup*. Un joueur qui progresse
 * s'arrête au premier ou au deuxième palier.
 */
export type HintTier = 0 | 1 | 2 | 3;

export class Game {
  puzzle = $state<number[]>(new Array<number>(CELL_COUNT).fill(EMPTY));
  solution = $state<number[]>(new Array<number>(CELL_COUNT).fill(EMPTY));
  values = $state<number[]>(new Array<number>(CELL_COUNT).fill(EMPTY));
  notes = $state<number[]>(new Array<number>(CELL_COUNT).fill(0));
  /**
   * Marques portées par les candidats : deux bits par chiffre, une case par
   * entrée. Voir `marks.ts` pour la raison d'un second tableau plutôt que d'un
   * empilement dans `notes`.
   */
  noteColors = $state<number[]>(new Array<number>(CELL_COUNT).fill(0));

  selected = $state<number>(indexOf(4, 4));
  noteMode = $state<boolean>(false);
  /**
   * Marque appliquée par la saisie, ou 0 pour poser une note ordinaire.
   *
   * C'est un sous-mode du mode notes : marquer un candidat suppose d'écrire des
   * candidats. Choisir une marque active donc le mode notes, ce qui évite
   * l'état absurde « je marque des candidats mais je pose des valeurs ».
   */
  markMode = $state<Mark>(0);
  seed = $state<string | number>(0);
  clues = $state<number>(0);

  /** Niveau annoncé, mesuré sur la grille initiale. */
  level = $state<Level | null>(null);
  /** Notation complète de la grille initiale : chemin, techniques, score. */
  rating = $state<Rating | null>(null);
  /** `false` quand le niveau demandé n'a pas pu être atteint — dit tel quel. */
  levelIsExact = $state<boolean>(true);
  generating = $state<boolean>(false);

  history = $state<Move[]>([]);

  /** Chronomètre de la partie. Voir `stopwatch.svelte.ts` pour ses garde-fous. */
  readonly clock = new Stopwatch();
  /** Jour civil local du **début** de la partie, figé une fois pour toutes. */
  startedOn = $state<DayKey>(localDayKey());
  /** Date du défi quotidien joué, ou `null` pour une partie libre. */
  daily = $state<DayKey | null>(null);
  /** Technique enseignée quand la partie est un exercice, `null` sinon. */
  lesson = $state<TechniqueId | null>(null);
  /**
   * Position de départ d'un exercice : valeurs **et** candidats.
   *
   * Les candidats sont indispensables — voir `findNextStepFrom`. Sans eux,
   * l'indice repartirait des valeurs seules, retrouverait les éliminations déjà
   * acquises et proposerait une technique plus simple que celle enseignée : la
   * leçon serait contredite sur l'écran même qui prétend l'enseigner.
   */
  #origin: Position | null = null;
  /** Indices consultés, tous paliers confondus. */
  hintsShown = $state<number>(0);
  /** Indices dont le coup a été appliqué. */
  hintsApplied = $state<number>(0);
  /**
   * Valeurs fausses saisies, comptées **à la saisie**.
   *
   * Informatif, jamais punitif : il n'y a aucune limite d'erreurs dans ce jeu,
   * et il n'y en aura pas. Le compteur ne se décrémente pas quand la case est
   * corrigée — ce serait réécrire ce qui s'est passé.
   */
  mistakes = $state<number>(0);

  /**
   * Verrou d'enregistrement.
   *
   * `isComplete` est un dérivé : annuler le dernier coup le fait retomber à
   * `false`, et le rejouer le fait remonter. Un enregistrement branché dessus
   * écrirait trois parties là où il y en a une. Le verrou fixe **le moment de
   * l'écriture**, une fois par grille chargée.
   */
  #recorded = false;

  /** Appelé une seule fois, à l'instant précis où la grille devient juste. */
  onSolved: ((record: GameRecord) => void) | null = null;

  hint = $state<Step | null>(null);
  hintTier = $state<HintTier>(0);
  /** Message affiché quand aucun indice n'est possible, et pourquoi. */
  hintNotice = $state<string | null>(null);

  /**
   * Mesure du chemin : effort et tension. `null` tant qu'aucune grille n'est
   * notée, ou pour un exercice — une position n'a pas de chemin à elle.
   *
   * Calculée à la demande, sur une grille chargée, jamais dans `rate()` : celle-
   * ci est la boucle chaude du générateur. Coût ~1,4 ms, une fois par grille.
   */
  analysis = $derived.by(() => {
    const rating = this.rating;
    if (rating === null) return null;
    return analysePath(Uint8Array.from(this.puzzle), rating);
  });

  conflicts = $derived(new Set(findConflicts(Uint8Array.from(this.values))));
  filledCount = $derived(this.values.filter((v) => v !== EMPTY).length);
  isComplete = $derived(this.filledCount === CELL_COUNT && this.conflicts.size === 0);
  canUndo = $derived(this.history.length > 0);

  /** Cases mises en évidence par l'indice courant, selon le palier atteint. */
  hintCells = $derived.by(() => {
    const step = this.hint;
    if (step === null || this.hintTier < 2) return new Set<number>();
    return new Set(step.highlights.map((h) => h.cell));
  });

  /** Cases visées par la conclusion de l'indice, révélées au dernier palier. */
  hintTargets = $derived.by(() => {
    const step = this.hint;
    if (step === null || this.hintTier < 3) return new Set<number>();
    return new Set([
      ...step.placements.map((p) => p.cell),
      ...step.eliminations.map((e) => e.cell),
    ]);
  });

  usedDigits = $derived.by(() => {
    const counts = new Map<number, number>();
    for (const value of this.values) {
      if (value !== EMPTY) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  });

  isGiven(cell: number): boolean {
    return this.puzzle[cell] !== EMPTY;
  }

  /**
   * Remet à zéro tout ce qui décrit **la partie**, et non la grille.
   *
   * Appelée en tête des trois chargeurs. C'est ce qui garantit qu'aucun champ
   * n'est oublié par l'un d'eux — et l'exercice qui redevenait une partie
   * ordinaire après un rechargement venait précisément de cet oubli, dans le
   * seul des trois qui ne remettait ni `lesson`, ni `#origin`, ni `markMode`.
   */
  #resetSession(): void {
    this.history = [];
    this.clearHint();
    this.daily = null;
    this.lesson = null;
    this.#origin = null;
    this.markMode = 0;
    this.startedOn = localDayKey();
    this.hintsShown = 0;
    this.hintsApplied = 0;
    this.mistakes = 0;
    this.#recorded = false;
  }

  /**
   * Demande une grille du niveau voulu au moteur.
   *
   * L'opération passe par un Web Worker et peut durer plusieurs secondes aux
   * niveaux élevés : atteindre un palier difficile demande une recherche
   * dirigée, pas un simple tirage.
   */
  async newPuzzle(level: Level, symmetry: Symmetry = 'rotational180'): Promise<void> {
    this.generating = true;
    this.clearHint();
    try {
      const result = await engine.generateAtLevel({ level, symmetry });
      if (result !== null) this.loadPuzzle(result);
    } finally {
      this.generating = false;
    }
  }

  /**
   * Installe une grille déjà produite.
   *
   * Séparé de `newPuzzle` à dessein : le chargement est purement synchrone et
   * n'a aucune raison de dépendre d'un Web Worker — ce qui rend la logique de
   * partie testable sans en démarrer un.
   */
  loadPuzzle(result: LeveledPuzzle, daily: DayKey | null = null): void {
    this.#resetSession();
    this.puzzle = [...result.puzzle];
    this.solution = [...result.solution];
    this.values = [...result.puzzle];
    this.notes = new Array<number>(CELL_COUNT).fill(0);
    this.noteColors = new Array<number>(CELL_COUNT).fill(0);
    this.seed = result.seed;
    this.clues = result.clues;
    this.rating = result.rating;
    this.level = result.rating.level ?? result.level;
    this.levelIsExact = result.exact;

    const firstEmpty = this.puzzle.findIndex((v) => v === EMPTY);
    this.selected = firstEmpty < 0 ? 0 : firstEmpty;

    this.daily = daily;
    this.clock.reset();
    this.clock.start();
  }

  /**
   * Installe un exercice amorcé : la grille est reprise à l'instant précis où la
   * technique enseignée devient nécessaire.
   *
   * ─── Trois décisions qui se justifient ──────────────────────────────────────
   *
   * **Les cases déjà posées deviennent des indices de départ.** Elles sont le
   * travail du solveur, pas celui du joueur ; le laisser les défaire ferait
   * dériver l'exercice loin de sa leçon.
   *
   * **Les candidats sont écrits comme notes.** Ce n'est pas un confort : une
   * technique d'élimination ne produit rien sur une grille sans notes —
   * `applyHint` passe son chemin quand la case n'en porte aucune. Sans cette
   * ligne, les deux tiers de la campagne seraient silencieusement inertes.
   *
   * **Aucune notation n'est affichée.** Une position n'a pas de niveau : celui
   * de la grille d'origine ne la décrit pas, et lui en attribuer un violerait la
   * règle qui fonde ce projet. `rating` reste donc `null`, et l'onglet Analyse
   * l'annonce comme tel.
   */
  loadExercise(exercise: Exercise): void {
    this.#resetSession();
    const values = [...exercise.position.values];
    this.puzzle = values;
    this.values = [...values];
    this.solution = [...exercise.solution];
    this.notes = [...exercise.position.candidates];
    this.noteColors = new Array<number>(CELL_COUNT).fill(0);

    this.#origin = exercise.position;
    this.lesson = exercise.technique;
    this.seed = 0;
    this.clues = values.filter((value) => value !== EMPTY).length;
    this.rating = null;
    this.level = null;
    this.levelIsExact = true;

    const firstEmpty = values.findIndex((value) => value === EMPTY);
    this.selected = firstEmpty < 0 ? 0 : firstEmpty;

    this.clock.reset();
    this.clock.start();
  }

  /**
   * Charge une grille depuis un code imprimé : celui d'un QR ou celui saisi à la
   * main sous la grille.
   *
   * C'est le retour du papier vers l'écran. La solution et la notation sont
   * recalculées localement — quelques millisecondes — plutôt que transportées
   * dans le code : un cahier imprimé n'a ainsi qu'une chose à porter, la grille
   * elle-même, et reste lisible même si le moteur évolue.
   *
   * Renvoie `false` si le code est invalide ou la grille insoluble, sans rien
   * modifier de la partie en cours.
   */
  loadFromCode(code: string, daily: DayKey | null = null): boolean {
    const puzzle = tryDecodeGrid(code);
    if (puzzle === null) return false;

    const solution = findSolution(puzzle);
    if (solution === null) return false;

    const rating = rate(puzzle);
    this.loadPuzzle({
      puzzle,
      solution,
      clues: puzzle.reduce((total, value) => total + (value === EMPTY ? 0 : 1), 0),
      seed: gridLabel(puzzle),
      symmetry: 'none',
      level: rating.level ?? 'facile',
      rating,
      exact: rating.level !== null,
    }, daily);
    return true;
  }

  /** Instantané sérialisable de la partie, pour la sauvegarde. */
  snapshot(): GameSnapshot {
    return toSnapshot({
      puzzle: this.puzzle,
      solution: this.solution,
      values: this.values,
      notes: this.notes,
      history: this.history,
      selected: this.selected,
      rating: this.rating,
      seed: this.seed,
      clues: this.clues,
      elapsedMs: this.clock.currentMs(),
      startedOn: this.startedOn,
      daily: this.daily,
      hintsShown: this.hintsShown,
      hintsApplied: this.hintsApplied,
      mistakes: this.mistakes,
      noteMode: this.noteMode,
      noteColors: this.noteColors,
      lesson: this.lesson,
      originCandidates: this.#origin === null ? null : [...this.#origin.candidates],
    });
  }

  /**
   * Reprend une partie sauvegardée.
   *
   * La notation est **recalculée** plutôt que restaurée : elle contient tout le
   * chemin de résolution, bien trop volumineux pour être écrit à chaque coup,
   * alors qu'il se recalcule en une milliseconde. Même raisonnement que pour une
   * grille ouverte depuis un code imprimé.
   */
  restoreFrom(saved: RestoredGame): void {
    this.#resetSession();
    this.puzzle = [...saved.puzzle];
    this.solution = [...saved.solution];
    this.values = [...saved.values];
    this.notes = [...saved.notes];
    /*
      Défensif, et pas décoratif : une sauvegarde d'avant l'incrément 8 n'a pas
      de marques, et une sauvegarde bricolée pourrait en porter sur des chiffres
      qui ne sont plus candidats. On rétablit l'invariant plutôt que de le
      supposer.
    */
    this.noteColors = saved.noteColors.map((colors, cell) =>
      restrictToNotes(colors, saved.notes[cell] ?? 0),
    );
    /*
      Le défaut n'est pas décoratif : un coup enregistré avant l'incrément 8 ne
      porte pas de marques, et `Move` les exige. Zéro est le bon défaut — avant
      l'incrément 8, aucun candidat n'en portait.
    */
    this.history = saved.history.map((move) => ({
      cells: [move, ...(move.others ?? [])].map((state) => ({
        ...state,
        previousNoteColors: state.previousNoteColors ?? 0,
      })),
    }));
    this.selected = saved.selected;
    this.seed = saved.seed;
    this.clues = saved.clues;
    this.noteMode = saved.noteMode;

    this.lesson = saved.lesson;
    /*
      Un exercice fige sa position de départ comme grille de départ : ses valeurs
      **sont** `puzzle`, et seuls ses candidats manquaient à la sauvegarde.
    */
    this.#origin =
      saved.lesson === null || saved.originCandidates === null
        ? null
        : {
            values: Uint8Array.from(saved.puzzle),
            candidates: Uint16Array.from(saved.originCandidates),
          };

    if (this.lesson !== null) {
      /*
        Une position n'a pas de niveau, et la noter reviendrait à afficher une
        difficulté mesurée sur un fragment — ce que `loadExercise` refuse par
        principe, et que la restauration faisait pourtant.
      */
      this.rating = null;
      this.level = null;
      this.levelIsExact = true;
    } else {
      const rating = rate(Uint8Array.from(saved.puzzle));
      this.rating = rating;
      this.level = rating.level ?? saved.level;
      this.levelIsExact = rating.level !== null;
    }

    this.daily = saved.daily;
    this.startedOn = saved.startedOn ?? localDayKey();
    this.hintsShown = saved.hintsShown;
    this.hintsApplied = saved.hintsApplied;
    this.mistakes = saved.mistakes;
    /*
      Le chronomètre repart du total accumulé, jamais d'un instant de départ :
      c'est ce qui fait qu'une partie reprise le lendemain ne compte pas la nuit.
    */
    this.clock.reset(saved.elapsedMs);

    /*
      Une grille déjà terminée a été enregistrée quand elle s'est terminée. La
      rouvrir ne doit pas l'enregistrer une seconde fois.
    */
    this.#recorded = this.isComplete;
    if (!this.#recorded) this.clock.start();
  }

  /**
   * Constate qu'une grille vient d'être terminée, et le fait savoir — une fois.
   *
   * Appelé après chaque geste susceptible de compléter la grille, y compris
   * `undo` : annuler un effacement peut parfaitement la reformer.
   */
  #settle(): void {
    if (this.#recorded || !this.isComplete) return;
    this.#recorded = true;
    this.clock.pause();
    this.onSolved?.(this.toRecord());
  }

  /** La partie terminée, sous la forme que l'historique conserve. */
  toRecord(): GameRecord {
    return {
      id: encodeGrid(Uint8Array.from(this.puzzle)),
      finishedAt: Date.now(),
      day: this.startedOn,
      daily: this.daily,
      level: this.level,
      score: this.rating?.score ?? 0,
      ratingVersion: this.rating?.ratingVersion ?? RATING_VERSION,
      durationMs: this.clock.recordableMs(),
      hintsShown: this.hintsShown,
      hintsApplied: this.hintsApplied,
      mistakes: this.mistakes,
      lesson: this.lesson,
    };
  }

  select(cell: number): void {
    if (cell >= 0 && cell < CELL_COUNT) this.selected = cell;
  }

  moveSelection(deltaRow: number, deltaCol: number): void {
    const row = Math.floor(this.selected / SIZE);
    const col = this.selected % SIZE;
    this.selected = indexOf((row + deltaRow + SIZE) % SIZE, (col + deltaCol + SIZE) % SIZE);
  }

  /** Cases déjà capturées par le geste en cours, `null` hors geste. */
  #pending: Map<number, CellState> | null = null;

  /**
   * Exécute un geste comme **une seule** entrée d'annulation.
   *
   * Rend `true` si au moins une case a été touchée : un geste qui n'écrit rien
   * ne laisse aucune trace dans l'historique, et l'appelant l'apprend par le
   * retour — ce dont `applyHint` a besoin pour ne pas compter un indice qui n'a
   * rien appliqué.
   *
   * La `Map` fait deux choses, toutes deux porteuses. Elle rend `#touch`
   * **idempotent** : un indice peut toucher la même case par un placement, par
   * le nettoyage d'une voisine et par une élimination, et seul l'état d'avant
   * le geste entier doit être conservé. Et elle garde l'**ordre d'insertion**,
   * ce qui place la case jouée en tête sans avoir à la désigner.
   */
  #asOneMove(body: () => void): boolean {
    const pending = new Map<number, CellState>();
    this.#pending = pending;
    try {
      body();
    } finally {
      this.#pending = null;
    }

    const cells = [...pending.values()];
    if (cells.length === 0) return false;
    this.history.push({ cells });
    if (this.history.length > MAX_HISTORY) this.history.shift();
    return true;
  }

  /**
   * Capture l'état d'une case **avant** de l'écrire. Sans effet si déjà capturée.
   *
   * Hors geste, cet appel ne fait rien — silencieusement. Une écriture qui
   * oublierait `#asOneMove` perdrait donc son annulation sans que rien ne le
   * signale. Aucun type ne l'empêche ; ce qui l'empêche est le test de
   * propriété « un geste refusé ne change rien, un geste accepté est
   * exactement annulable », qui tombe au premier oubli.
   */
  #touch(cell: number): void {
    const pending = this.#pending;
    if (pending === null || pending.has(cell)) return;
    pending.set(cell, {
      cell,
      previousValue: this.values[cell],
      previousNotes: this.notes[cell],
      previousNoteColors: this.noteColors[cell],
    });
  }

  enter(digit: number): void {
    const cell = this.selected;
    if (this.isGiven(cell)) return;
    this.clearHint();

    this.#asOneMove(() => {
      if (this.markMode !== 0) {
        if (this.values[cell] !== EMPTY) return;
        this.#touch(cell);
        /*
          Marquer un candidat qu'on n'avait pas écrit l'écrit : c'est un geste qui
          a un sens — « celui-là, je le surveille » — et le refuser mènerait à une
          impasse silencieuse où le bouton ne fait rien.
        */
        this.notes[cell] = withDigit(this.notes[cell], digit);
        this.noteColors[cell] = toggleMark(this.noteColors[cell], digit, this.markMode);
        return;
      }

      if (this.noteMode) {
        if (this.values[cell] !== EMPTY) return;
        this.#touch(cell);
        const removing = hasDigit(this.notes[cell], digit);
        this.notes[cell] = removing
          ? withoutDigit(this.notes[cell], digit)
          : withDigit(this.notes[cell], digit);
        // L'invariant : un chiffre qui n'est plus candidat ne garde pas sa marque.
        if (removing) {
          this.noteColors[cell] = restrictToNotes(this.noteColors[cell], this.notes[cell]);
        }
        return;
      }

      this.#touch(cell);
      const alreadyThere = this.values[cell] === digit;
      this.values[cell] = alreadyThere ? EMPTY : digit;
      if (!alreadyThere) {
        this.notes[cell] = 0;
        this.noteColors[cell] = 0;
        this.#clearNotesOfPeers(cell, digit);
        // Comptée à la saisie, une seule fois. Corriger la case ensuite n'efface
        // pas le fait qu'elle a été posée.
        if (digit !== this.solution[cell]) this.mistakes++;
      }
    });

    this.#settle();
  }

  /**
   * Retire le chiffre posé des notes voisines. C'est ce que ferait un joueur à
   * la main ; l'omettre laisserait des notes fausses à l'écran.
   */
  #clearNotesOfPeers(cell: number, digit: number): void {
    const row = Math.floor(cell / SIZE);
    const col = cell % SIZE;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let other = 0; other < CELL_COUNT; other++) {
      if (other === cell) continue;
      const otherRow = Math.floor(other / SIZE);
      const otherCol = other % SIZE;
      const sameUnit =
        otherRow === row ||
        otherCol === col ||
        (Math.floor(otherRow / 3) * 3 === boxRow && Math.floor(otherCol / 3) * 3 === boxCol);
      if (!sameUnit) continue;
      /*
        Ne toucher que ce qui change vraiment. Sans cette garde, poser un chiffre
        capturait les vingt voisines dans le geste — même celles qui n'avaient
        pas ce candidat — et gonflait chaque coup sauvegardé à vingt et une
        cases. Un joueur qui n'écrit pas de notes produit ainsi des gestes à une
        seule case, comme avant.
      */
      if (!hasDigit(this.notes[other], digit)) continue;
      this.#touch(other);
      this.notes[other] = withoutDigit(this.notes[other], digit);
      this.noteColors[other] = restrictToNotes(this.noteColors[other], this.notes[other]);
    }
  }

  clear(): void {
    const cell = this.selected;
    if (this.isGiven(cell)) return;
    if (this.values[cell] === EMPTY && this.notes[cell] === 0) return;
    this.clearHint();
    this.#asOneMove(() => {
      this.#touch(cell);
      this.values[cell] = EMPTY;
      this.notes[cell] = 0;
      this.noteColors[cell] = 0;
    });
  }

  /*
    `undo` peut reformer une grille complète : annuler l'effacement de la
    dernière case la termine. D'où l'appel à `#settle` ici aussi — le verrou
    garantit qu'une partie déjà enregistrée ne l'est pas deux fois.
  */

  undo(): void {
    const move = this.history.pop();
    if (move === undefined) return;
    this.clearHint();
    for (const state of move.cells) {
      this.values[state.cell] = state.previousValue;
      this.notes[state.cell] = state.previousNotes;
      this.noteColors[state.cell] = state.previousNoteColors;
    }
    // La tête est la case sur laquelle le joueur avait agi : c'est là qu'il
    // s'attend à retrouver le curseur.
    this.selected = move.cells[0].cell;
    this.#settle();
  }

  toggleNoteMode(): void {
    this.noteMode = !this.noteMode;
    if (!this.noteMode) this.markMode = 0;
  }

  /**
   * Choisit la marque à poser, ou revient aux notes ordinaires.
   *
   * Reposer la marque déjà active la désactive : c'est le même geste que le
   * bouton « Notes », et cela évite d'avoir à chercher comment en sortir.
   */
  setMarkMode(mark: Mark): void {
    this.markMode = this.markMode === mark ? 0 : mark;
    // Marquer, c'est écrire des candidats : le mode notes suit.
    if (this.markMode !== 0) this.noteMode = true;
  }

  /** Marques portées par les candidats d'une case. */
  marksOf(cell: number): number {
    return this.noteColors[cell];
  }

  notesOf(cell: number): number[] {
    return digitsOf(this.notes[cell]);
  }

  /** Valeurs posées par le joueur qui contredisent la solution. */
  wrongCells(): number[] {
    const wrong: number[] = [];
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (this.values[cell] !== EMPTY && this.values[cell] !== this.solution[cell]) wrong.push(cell);
    }
    return wrong;
  }

  /**
   * Demande un indice, ou passe au palier suivant si un indice est déjà affiché.
   *
   * L'indice part de **l'état réel de la partie**, pas de la grille de départ :
   * un conseil qui ignorerait ce que le joueur a déjà posé serait au mieux
   * inutile, au pire trompeur.
   */
  requestHint(): void {
    if (this.hint !== null) {
      if (this.hintTier < 3) this.hintTier = (this.hintTier + 1) as HintTier;
      return;
    }

    this.hintNotice = null;

    if (this.conflicts.size > 0) {
      this.hintNotice =
        'Deux cases se contredisent dans une même ligne, colonne ou boîte. ' +
        'Corrige-les avant de chercher la suite.';
      return;
    }

    const wrong = this.wrongCells();
    if (wrong.length > 0) {
      this.hintNotice =
        wrong.length === 1
          ? 'Une valeur posée est incorrecte, même si elle ne crée aucun conflit visible. ' +
            'Le raisonnement ne peut pas se poursuivre à partir de là.'
          : `${String(wrong.length)} valeurs posées sont incorrectes, même sans conflit visible. ` +
            'Le raisonnement ne peut pas se poursuivre à partir de là.';
      return;
    }

    /*
      Un exercice repart de sa position d'origine, candidats compris. Redériver
      les candidats depuis les seules valeurs ferait réapparaître les
      éliminations déjà acquises, et l'indice proposerait une technique plus
      simple que celle enseignée — sur l'écran même qui prétend l'enseigner.
    */
    const origin = this.#origin;
    const step =
      origin === null
        ? findNextStep(Uint8Array.from(this.values))
        : findNextStepFrom(origin, Uint8Array.from(this.values));
    if (step === null) {
      this.hintNotice = this.isComplete
        ? 'La grille est terminée.'
        : 'Aucune des techniques connues ne s’applique ici. Cette grille exige un ' +
          'raisonnement par chaînes, qui n’est pas encore implémenté.';
      return;
    }

    this.hint = step;
    this.hintTier = 1;
    /*
      Compté ici, et pas à l'entrée de la méthode : un indice refusé — conflit
      sur la grille, valeur fausse, aucune technique connue — n'a rien montré.
      Compté trop tôt, « Indice » devenait un compteur de clics, et une grille en
      conflit enregistrait dix indices consultés pour dix appuis inutiles.

      Toujours une fois par indice et non par palier : le garde en tête de
      méthode ressort quand un indice est déjà affiché.
    */
    this.hintsShown++;
  }

  clearHint(): void {
    this.hint = null;
    this.hintTier = 0;
    this.hintNotice = null;
  }

  /** Applique la conclusion de l'indice affiché. */
  /**
   * Applique le coup de l'indice affiché. Rend `true` s'il a écrit quelque chose.
   *
   * Le retour n'est pas une commodité : sur une grille sans notes, un indice
   * purement éliminatoire ne touche rien, et `hintsApplied` montait quand même.
   * Or c'est, selon `stats.ts`, « le seul qui juge une complétion » — il décide
   * de « terminée sans indice » dans deux agrégats. Il ne peut compter que ce
   * qui a réellement eu lieu.
   */
  applyHint(): boolean {
    const step = this.hint;
    if (step === null) return false;

    // Un seul geste pour un seul clic : un indice qui élimine dans trois cases
    // réclamait trois Ctrl+Z pour être défait.
    const applied = this.#asOneMove(() => {
      for (const placement of step.placements) {
        if (this.values[placement.cell] !== EMPTY) continue;
        this.#touch(placement.cell);
        this.values[placement.cell] = placement.digit;
        this.notes[placement.cell] = 0;
        this.noteColors[placement.cell] = 0;
        this.#clearNotesOfPeers(placement.cell, placement.digit);
        this.selected = placement.cell;
      }
      for (const elimination of step.eliminations) {
        // Le chiffre, pas la vacuité de la case : tester `notes === 0` laissait
        // passer une case dont les notes ne portaient pas ce candidat, et
        // poussait un geste vide dans l'historique.
        if (!hasDigit(this.notes[elimination.cell], elimination.digit)) continue;
        this.#touch(elimination.cell);
        this.notes[elimination.cell] = withoutDigit(
          this.notes[elimination.cell],
          elimination.digit,
        );
        this.noteColors[elimination.cell] = restrictToNotes(
          this.noteColors[elimination.cell],
          this.notes[elimination.cell],
        );
      }
    });

    if (applied) this.hintsApplied++;
    this.clearHint();
    this.#settle();
    return applied;
  }

  toString(): string {
    return formatGrid(Uint8Array.from(this.values));
  }
}
