import {
  CELL_COUNT,
  EMPTY,
  SIZE,
  digitsOf,
  findConflicts,
  findNextStep,
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
import type { Level, LeveledPuzzle, Rating, Step, Symmetry } from '@sudoku/engine';
import { engine } from './engineClient.js';

/** Un coup annulé : on restaure la valeur ET les notes précédentes. */
interface Move {
  readonly cell: number;
  readonly previousValue: number;
  readonly previousNotes: number;
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

  selected = $state<number>(indexOf(4, 4));
  noteMode = $state<boolean>(false);
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

  hint = $state<Step | null>(null);
  hintTier = $state<HintTier>(0);
  /** Message affiché quand aucun indice n'est possible, et pourquoi. */
  hintNotice = $state<string | null>(null);

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
  loadPuzzle(result: LeveledPuzzle): void {
    this.puzzle = [...result.puzzle];
    this.solution = [...result.solution];
    this.values = [...result.puzzle];
    this.notes = new Array<number>(CELL_COUNT).fill(0);
    this.history = [];
    this.clearHint();
    this.seed = result.seed;
    this.clues = result.clues;
    this.rating = result.rating;
    this.level = result.rating.level ?? result.level;
    this.levelIsExact = result.exact;

    const firstEmpty = this.puzzle.findIndex((v) => v === EMPTY);
    this.selected = firstEmpty < 0 ? 0 : firstEmpty;
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
  loadFromCode(code: string): boolean {
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
    });
    return true;
  }

  select(cell: number): void {
    if (cell >= 0 && cell < CELL_COUNT) this.selected = cell;
  }

  moveSelection(deltaRow: number, deltaCol: number): void {
    const row = Math.floor(this.selected / SIZE);
    const col = this.selected % SIZE;
    this.selected = indexOf((row + deltaRow + SIZE) % SIZE, (col + deltaCol + SIZE) % SIZE);
  }

  #record(cell: number): void {
    this.history.push({
      cell,
      previousValue: this.values[cell],
      previousNotes: this.notes[cell],
    });
  }

  enter(digit: number): void {
    const cell = this.selected;
    if (this.isGiven(cell)) return;
    this.clearHint();

    if (this.noteMode) {
      if (this.values[cell] !== EMPTY) return;
      this.#record(cell);
      this.notes[cell] = hasDigit(this.notes[cell], digit)
        ? withoutDigit(this.notes[cell], digit)
        : withDigit(this.notes[cell], digit);
      return;
    }

    this.#record(cell);
    const alreadyThere = this.values[cell] === digit;
    this.values[cell] = alreadyThere ? EMPTY : digit;
    if (!alreadyThere) {
      this.notes[cell] = 0;
      this.#clearNotesOfPeers(cell, digit);
    }
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
      if (sameUnit) this.notes[other] = withoutDigit(this.notes[other], digit);
    }
  }

  clear(): void {
    const cell = this.selected;
    if (this.isGiven(cell)) return;
    if (this.values[cell] === EMPTY && this.notes[cell] === 0) return;
    this.clearHint();
    this.#record(cell);
    this.values[cell] = EMPTY;
    this.notes[cell] = 0;
  }

  undo(): void {
    const move = this.history.pop();
    if (move === undefined) return;
    this.clearHint();
    this.values[move.cell] = move.previousValue;
    this.notes[move.cell] = move.previousNotes;
    this.selected = move.cell;
  }

  toggleNoteMode(): void {
    this.noteMode = !this.noteMode;
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

    const step = findNextStep(Uint8Array.from(this.values));
    if (step === null) {
      this.hintNotice = this.isComplete
        ? 'La grille est terminée.'
        : 'Aucune des techniques connues ne s’applique ici. Cette grille exige un ' +
          'raisonnement par chaînes, qui n’est pas encore implémenté.';
      return;
    }

    this.hint = step;
    this.hintTier = 1;
  }

  clearHint(): void {
    this.hint = null;
    this.hintTier = 0;
    this.hintNotice = null;
  }

  /** Applique la conclusion de l'indice affiché. */
  applyHint(): void {
    const step = this.hint;
    if (step === null) return;

    for (const placement of step.placements) {
      if (this.values[placement.cell] !== EMPTY) continue;
      this.#record(placement.cell);
      this.values[placement.cell] = placement.digit;
      this.notes[placement.cell] = 0;
      this.#clearNotesOfPeers(placement.cell, placement.digit);
      this.selected = placement.cell;
    }
    for (const elimination of step.eliminations) {
      if (this.notes[elimination.cell] === 0) continue;
      this.#record(elimination.cell);
      this.notes[elimination.cell] = withoutDigit(this.notes[elimination.cell], elimination.digit);
    }
    this.clearHint();
  }

  toString(): string {
    return formatGrid(Uint8Array.from(this.values));
  }
}
