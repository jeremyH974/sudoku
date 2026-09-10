import {
  CELL_COUNT,
  EMPTY,
  SIZE,
  digitsOf,
  findConflicts,
  formatGrid,
  generatePuzzle,
  hasDigit,
  indexOf,
  withDigit,
  withoutDigit,
} from '@sudoku/engine';
import type { Symmetry } from '@sudoku/engine';

/** Un coup annule : on restaure la valeur ET les notes precedentes. */
interface Move {
  readonly cell: number;
  readonly previousValue: number;
  readonly previousNotes: number;
}

export interface NewPuzzleOptions {
  readonly seed?: string | number;
  readonly symmetry?: Symmetry;
  readonly minClues?: number;
}

/**
 * Etat d'une partie.
 *
 * Deux principes de conception, qui repondent directement a des reproches
 * recurrents faits aux applications existantes :
 *   - aucune limite d'erreurs. Les conflits sont signales, jamais sanctionnes.
 *     Une partie ne se "perd" pas ;
 *   - l'annulation est illimitee et restaure aussi les notes, pas seulement la
 *     valeur — sinon annuler une saisie detruit silencieusement le raisonnement
 *     qui la precedait.
 */
export class Game {
  /** Indices de depart. Ces cases ne sont pas modifiables. */
  puzzle = $state<number[]>(new Array<number>(CELL_COUNT).fill(EMPTY));
  solution = $state<number[]>(new Array<number>(CELL_COUNT).fill(EMPTY));
  /** Ce qu'affiche la grille : indices de depart + saisies du joueur. */
  values = $state<number[]>(new Array<number>(CELL_COUNT).fill(EMPTY));
  /** Notes du joueur, en masque de 9 bits par cellule. */
  notes = $state<number[]>(new Array<number>(CELL_COUNT).fill(0));

  selected = $state<number>(indexOf(4, 4));
  noteMode = $state<boolean>(false);
  seed = $state<string | number>(0);
  clues = $state<number>(0);

  history = $state<Move[]>([]);

  /** Cellules en conflit — les deux cotes, pas seulement la derniere saisie. */
  conflicts = $derived(new Set(findConflicts(Uint8Array.from(this.values))));

  filledCount = $derived(this.values.filter((v) => v !== EMPTY).length);

  isComplete = $derived(this.filledCount === CELL_COUNT && this.conflicts.size === 0);

  canUndo = $derived(this.history.length > 0);

  /** `true` si la case fait partie des indices de depart. */
  isGiven(cell: number): boolean {
    return this.puzzle[cell] !== EMPTY;
  }

  /**
   * Chiffres deja places dans une unite de la cellule selectionnee.
   * Sert a griser les touches devenues impossibles — un confort de saisie que
   * beaucoup d'applications n'offrent pas.
   */
  usedDigits = $derived.by(() => {
    const counts = new Map<number, number>();
    for (const value of this.values) {
      if (value !== EMPTY) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  });

  newPuzzle(options: NewPuzzleOptions = {}): void {
    const generated = generatePuzzle(options);
    this.puzzle = [...generated.puzzle];
    this.solution = [...generated.solution];
    this.values = [...generated.puzzle];
    this.notes = new Array<number>(CELL_COUNT).fill(0);
    this.history = [];
    this.seed = generated.seed;
    this.clues = generated.clues;
    this.selected = this.puzzle.findIndex((v) => v === EMPTY);
    if (this.selected < 0) this.selected = 0;
  }

  select(cell: number): void {
    if (cell >= 0 && cell < CELL_COUNT) this.selected = cell;
  }

  /** Deplacement au clavier, avec bouclage sur les bords. */
  moveSelection(deltaRow: number, deltaCol: number): void {
    const row = Math.floor(this.selected / SIZE);
    const col = this.selected % SIZE;
    const nextRow = (row + deltaRow + SIZE) % SIZE;
    const nextCol = (col + deltaCol + SIZE) % SIZE;
    this.selected = indexOf(nextRow, nextCol);
  }

  #record(cell: number): void {
    this.history.push({
      cell,
      previousValue: this.values[cell]!,
      previousNotes: this.notes[cell]!,
    });
  }

  /**
   * Saisit un chiffre dans la cellule selectionnee, ou l'ajoute/retire des
   * notes si le mode notes est actif. Rejouer le meme chiffre l'efface.
   */
  enter(digit: number): void {
    const cell = this.selected;
    if (this.isGiven(cell)) return;

    if (this.noteMode) {
      if (this.values[cell] !== EMPTY) return;
      this.#record(cell);
      this.notes[cell] = hasDigit(this.notes[cell]!, digit)
        ? withoutDigit(this.notes[cell]!, digit)
        : withDigit(this.notes[cell]!, digit);
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
   * Retire le chiffre pose des notes des cellules voisines. C'est ce que ferait
   * un joueur a la main sur papier ; l'omettre laisse des notes fausses a
   * l'ecran et fausse le raisonnement.
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
      if (sameUnit) this.notes[other] = withoutDigit(this.notes[other]!, digit);
    }
  }

  clear(): void {
    const cell = this.selected;
    if (this.isGiven(cell)) return;
    if (this.values[cell] === EMPTY && this.notes[cell] === 0) return;
    this.#record(cell);
    this.values[cell] = EMPTY;
    this.notes[cell] = 0;
  }

  undo(): void {
    const move = this.history.pop();
    if (move === undefined) return;
    this.values[move.cell] = move.previousValue;
    this.notes[move.cell] = move.previousNotes;
    this.selected = move.cell;
  }

  toggleNoteMode(): void {
    this.noteMode = !this.noteMode;
  }

  notesOf(cell: number): number[] {
    return digitsOf(this.notes[cell]!);
  }

  /** Forme canonique de la grille en cours, pour le partage et le debug. */
  toString(): string {
    return formatGrid(Uint8Array.from(this.values));
  }
}
