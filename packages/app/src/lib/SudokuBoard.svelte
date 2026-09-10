<script lang="ts">
  import { EMPTY, SIZE } from '@sudoku/engine';
  import type { Game } from './game.svelte.js';

  const { game }: { game: Game } = $props();

  let cellElements: (HTMLElement | null)[] = $state([]);
  let gridElement: HTMLElement | null = $state(null);

  /**
   * Un seul element de la grille est atteignable au clavier a la fois
   * (« roving tabindex ») : la tabulation entre puis sort de la grille, et la
   * navigation interne se fait aux fleches. C'est le comportement attendu d'une
   * grille, et cela evite d'imposer 81 tabulations pour la traverser.
   *
   * On ne redonne le focus que s'il est deja dans la grille, pour ne pas le
   * voler a quelqu'un qui serait ailleurs dans la page.
   */
  $effect(() => {
    const element = cellElements[game.selected];
    if (!element || !gridElement) return;
    if (gridElement.contains(document.activeElement) && document.activeElement !== element) {
      element.focus();
    }
  });

  const rowOf = (cell: number): number => Math.floor(cell / SIZE);
  const colOf = (cell: number): number => cell % SIZE;

  /** Cellule partageant une unite avec la selection : surlignage d'aide. */
  function isPeer(cell: number): boolean {
    const s = game.selected;
    if (cell === s) return false;
    return (
      rowOf(cell) === rowOf(s) ||
      colOf(cell) === colOf(s) ||
      (Math.floor(rowOf(cell) / 3) === Math.floor(rowOf(s) / 3) &&
        Math.floor(colOf(cell) / 3) === Math.floor(colOf(s) / 3))
    );
  }

  /** Meme chiffre que la selection : reperage visuel reclame par les joueurs. */
  function isSameValue(cell: number): boolean {
    const selectedValue = game.values[game.selected];
    return selectedValue !== EMPTY && game.values[cell] === selectedValue && cell !== game.selected;
  }

  /** Libelle lu par les lecteurs d'ecran. */
  function describe(cell: number): string {
    const value = game.values[cell];
    const parts = [`ligne ${String(rowOf(cell) + 1)}, colonne ${String(colOf(cell) + 1)}`];
    if (value === EMPTY) {
      const notes = game.notesOf(cell);
      parts.push(notes.length > 0 ? `notes ${notes.join(' ')}` : 'vide');
    } else {
      parts.push(String(value));
      if (game.isGiven(cell)) parts.push('indice de depart');
    }
    if (game.conflicts.has(cell)) parts.push('en conflit');
    return parts.join(', ');
  }

  const MOVES: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  function onKeyDown(event: KeyboardEvent): void {
    const key = event.key;

    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
      event.preventDefault();
      game.undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const move = MOVES[key];
    if (move) {
      event.preventDefault();
      game.moveSelection(move[0], move[1]);
      return;
    }

    if (key >= '1' && key <= '9') {
      event.preventDefault();
      game.enter(Number(key));
      return;
    }

    if (key === '0' || key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      game.clear();
      return;
    }

    if (key.toLowerCase() === 'n') {
      event.preventDefault();
      game.toggleNoteMode();
    }
  }
</script>

<div
  bind:this={gridElement}
  role="grid"
  aria-label="Grille de sudoku, 9 lignes sur 9 colonnes"
  aria-rowcount={SIZE}
  aria-colcount={SIZE}
  class="board"
  class:note-mode={game.noteMode}
  tabindex={-1}
>
  {#each { length: SIZE } as _, row (row)}
    <div role="row" aria-rowindex={row + 1} class="row">
      {#each { length: SIZE } as _, col (col)}
        {@const cell = row * SIZE + col}
        {@const value = game.values[cell]}
        <div
          bind:this={cellElements[cell]}
          role="gridcell"
          aria-colindex={col + 1}
          aria-label={describe(cell)}
          aria-selected={game.selected === cell}
          aria-readonly={game.isGiven(cell)}
          aria-invalid={game.conflicts.has(cell)}
          tabindex={game.selected === cell ? 0 : -1}
          class="cell"
          class:given={game.isGiven(cell)}
          class:selected={game.selected === cell}
          class:conflict={game.conflicts.has(cell)}
          class:peer={isPeer(cell)}
          class:same-value={isSameValue(cell)}
          onclick={() => game.select(cell)}
          onkeydown={onKeyDown}
        >
          {#if value !== EMPTY}
            <span class="value">{value}</span>
          {:else if game.notes[cell] !== 0}
            <span class="notes" aria-hidden="true">
              {#each { length: SIZE } as _, i (i)}
                <span class="note">{game.notesOf(cell).includes(i + 1) ? i + 1 : ''}</span>
              {/each}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .board {
    position: relative;
    display: grid;
    grid-template-rows: repeat(9, 1fr);
    width: min(92vw, 34rem);
    aspect-ratio: 1;
    border: 3px solid var(--grid-strong);
    border-radius: 5px;
    background: var(--grid-strong);
    gap: 1px;
    touch-action: manipulation;
  }

  /*
    Traits epais delimitant les blocs de 3x3. Portes par une bordure sur la
    derniere ligne et la derniere colonne de chaque bloc : avec
    `box-sizing: border-box`, la bordure est prise DANS la piste de grille, donc
    toutes les cases gardent exactement la meme taille. Un overlay peint en
    surimpression paraissait plus elegant, mais se revele fragile — les traits
    horizontaux tombaient dans les interstices et devenaient invisibles.
  */
  .row {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    gap: 1px;
  }

  .row:nth-child(3n):not(:last-child) {
    border-bottom: 2px solid var(--grid-strong);
  }

  .cell:nth-child(3n):not(:last-child) {
    border-right: 2px solid var(--grid-strong);
  }

  .cell {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    background: var(--cell-bg);
    cursor: pointer;
    user-select: none;
    font-variant-numeric: tabular-nums;
    font-size: clamp(1.1rem, 5.2vw, 1.9rem);
    color: var(--value-player);
    transition: background-color 90ms ease;
  }

  .cell.given {
    color: var(--value-given);
    font-weight: 650;
  }

  .cell.peer {
    background: var(--cell-peer);
  }

  .cell.same-value {
    background: var(--cell-same);
  }

  .cell.selected {
    background: var(--cell-selected);
  }

  /*
    Le conflit n'est jamais signale par la seule couleur : un trait epais double
    l'information, pour rester lisible en cas de daltonisme comme a l'impression
    en noir et blanc.
  */
  .cell.conflict {
    color: var(--value-conflict);
    background: var(--cell-conflict);
  }

  .cell.conflict::after {
    content: '';
    position: absolute;
    inset: auto 18% 8% 18%;
    height: 3px;
    border-radius: 2px;
    background: var(--value-conflict);
  }

  .cell:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
    z-index: 2;
  }

  .notes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    width: 100%;
    height: 100%;
    padding: 6%;
    font-size: 0.34em;
    line-height: 1;
    color: var(--value-note);
  }

  .note {
    display: grid;
    place-items: center;
  }

  /*
    Le mode notes se voit sur la grille elle-meme, pas seulement sur un bouton
    a l'ecart : la confusion entre note et valeur definitive est l'un des
    reproches les plus frequents faits aux applications existantes.
  */
  .board.note-mode {
    border-color: var(--note-accent);
    background: var(--note-accent);
  }
</style>
