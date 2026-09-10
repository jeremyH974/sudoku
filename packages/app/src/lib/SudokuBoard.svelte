<script lang="ts">
  import { EMPTY, SIZE, UNITS, digitsOf } from '@sudoku/engine';
  import type { Game } from './game.svelte.js';

  interface Props {
    game: Game;
    /**
     * Mode analyse : valeurs, candidats et zones fournis de l'extérieur.
     *
     * Le plateau devient alors une vue passive du chemin de résolution. Sans
     * cette bascule, il faudrait un second composant qui dupliquerait toute la
     * géométrie et, plus grave, tout le travail d'accessibilité.
     */
    interactive?: boolean;
    overrideValues?: readonly number[] | null;
    overrideCandidates?: readonly number[] | null;
    highlightUnits?: readonly number[];
    highlightCells?: ReadonlySet<number>;
    targetCells?: ReadonlySet<number>;
  }

  const {
    game,
    interactive = true,
    overrideValues = null,
    overrideCandidates = null,
    highlightUnits = [],
    highlightCells,
    targetCells,
  }: Props = $props();

  let cellElements: (HTMLElement | null)[] = $state([]);
  let gridElement: HTMLElement | null = $state(null);

  const values = $derived(overrideValues ?? game.values);
  const marked = $derived(highlightCells ?? game.hintCells);
  const targets = $derived(targetCells ?? game.hintTargets);

  /** Cases des unités mises en avant par l'étape ou l'indice affiché. */
  const zoneCells = $derived(
    new Set(highlightUnits.flatMap((unitIndex) => [...UNITS[unitIndex]!.cells])),
  );

  /**
   * Un seul élément de la grille est atteignable au clavier à la fois
   * (« roving tabindex ») : la tabulation entre puis sort de la grille, et la
   * navigation interne se fait aux flèches. C'est le comportement attendu d'une
   * grille, et cela évite d'imposer 81 tabulations pour la traverser.
   *
   * On ne redonne le focus que s'il est déjà dans la grille, pour ne pas le
   * voler à quelqu'un qui serait ailleurs dans la page.
   */
  $effect(() => {
    if (!interactive) return;
    const element = cellElements[game.selected];
    if (!element || !gridElement) return;
    if (gridElement.contains(document.activeElement) && document.activeElement !== element) {
      element.focus();
    }
  });

  const rowOf = (cell: number): number => Math.floor(cell / SIZE);
  const colOf = (cell: number): number => cell % SIZE;

  /** Case partageant une unité avec la sélection : surlignage d'aide. */
  function isPeer(cell: number): boolean {
    if (!interactive) return false;
    const s = game.selected;
    if (cell === s) return false;
    return (
      rowOf(cell) === rowOf(s) ||
      colOf(cell) === colOf(s) ||
      (Math.floor(rowOf(cell) / 3) === Math.floor(rowOf(s) / 3) &&
        Math.floor(colOf(cell) / 3) === Math.floor(colOf(s) / 3))
    );
  }

  /** Même chiffre que la sélection : repérage visuel réclamé par les joueurs. */
  function isSameValue(cell: number): boolean {
    if (!interactive) return false;
    const selectedValue = values[game.selected];
    return selectedValue !== EMPTY && values[cell] === selectedValue && cell !== game.selected;
  }

  /** Notes du joueur, ou candidats calculés en mode analyse. */
  function notesOf(cell: number): number[] {
    if (overrideCandidates !== null) return digitsOf(overrideCandidates[cell] ?? 0);
    return game.notesOf(cell);
  }

  /** Libellé lu par les lecteurs d'écran. */
  function describe(cell: number): string {
    const value = values[cell];
    const parts = [`ligne ${String(rowOf(cell) + 1)}, colonne ${String(colOf(cell) + 1)}`];
    if (value === EMPTY) {
      const notes = notesOf(cell);
      parts.push(notes.length > 0 ? `notes ${notes.join(' ')}` : 'vide');
    } else {
      parts.push(String(value));
      if (game.isGiven(cell)) parts.push('indice de départ');
    }
    if (game.conflicts.has(cell)) parts.push('en conflit');
    if (marked.has(cell)) parts.push('mise en évidence');
    return parts.join(', ');
  }

  const MOVES: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  function onKeyDown(event: KeyboardEvent): void {
    if (!interactive) return;
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
  aria-label={interactive
    ? 'Grille de sudoku, 9 lignes sur 9 colonnes'
    : 'Grille analysée, en lecture seule'}
  aria-rowcount={SIZE}
  aria-colcount={SIZE}
  aria-readonly={!interactive}
  class="board"
  class:note-mode={interactive && game.noteMode}
  class:passive={!interactive}
  tabindex={-1}
>
  {#each { length: SIZE } as _, row (row)}
    <div role="row" aria-rowindex={row + 1} class="row">
      {#each { length: SIZE } as _, col (col)}
        {@const cell = row * SIZE + col}
        {@const value = values[cell]}
        <div
          bind:this={cellElements[cell]}
          role="gridcell"
          aria-colindex={col + 1}
          aria-label={describe(cell)}
          aria-selected={interactive && game.selected === cell}
          aria-readonly={!interactive || game.isGiven(cell)}
          aria-invalid={game.conflicts.has(cell)}
          tabindex={interactive && game.selected === cell ? 0 : -1}
          class="cell"
          class:given={game.isGiven(cell)}
          class:selected={interactive && game.selected === cell}
          class:conflict={game.conflicts.has(cell)}
          class:peer={isPeer(cell)}
          class:same-value={isSameValue(cell)}
          class:zone={zoneCells.has(cell)}
          class:marked={marked.has(cell)}
          class:target={targets.has(cell)}
          onclick={() => {
            if (interactive) game.select(cell);
          }}
          onkeydown={onKeyDown}
        >
          {#if value !== EMPTY}
            <span class="value">{value}</span>
          {:else if notesOf(cell).length > 0}
            <span class="notes" aria-hidden="true">
              {#each { length: SIZE } as _, i (i)}
                <span class="note">{notesOf(cell).includes(i + 1) ? i + 1 : ''}</span>
              {/each}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  /*
    La grille se mesure contre **son conteneur**, jamais contre la fenêtre.

    `min(92vw, 34rem)` semblait équivalent. Il ne l'était pas : `main` porte un
    remplissage latéral de 1 rem et le modèle de boîte est en `border-box`, donc
    la largeur utile vaut `100vw − 2rem`. À 375 px, la grille mesurait 345 px
    dans 343 px — deux pixels de débordement horizontal, et un rebond élastique
    sur exactement les téléphones que ce lot vise.

    `container-type: inline-size` fait de la grille son propre référentiel : les
    chiffres se dimensionnent en `cqi`, une fraction de la grille, et non plus en
    `vw`. Conséquence directe et recherchée : sur un écran large, `max-width` est
    en `rem`, donc le réglage « gros caractères » agrandit la grille — et les
    chiffres avec elle. C'est ce que l'ancrage promettait sans le tenir.
  */
  .board {
    position: relative;
    display: grid;
    grid-template-rows: repeat(9, 1fr);
    width: 100%;
    max-width: 34rem;
    margin-inline: auto;
    container-type: inline-size;
    aspect-ratio: 1;
    border: 3px solid var(--grid-strong);
    border-radius: 5px;
    background: var(--grid-strong);
    gap: 1px;
    touch-action: manipulation;
  }

  .board.passive {
    max-width: 27rem;
  }

  /*
    Traits épais délimitant les blocs de 3×3. Portés par une bordure sur la
    dernière ligne et la dernière colonne de chaque bloc : avec
    `box-sizing: border-box`, la bordure est prise DANS la piste de grille, donc
    toutes les cases gardent exactement la même taille. Un overlay peint en
    surimpression paraissait plus élégant, mais s'est révélé fragile — les traits
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
    /*
      Une fraction de la grille, multipliée par le réglage de taille. Le plafond
      en `rem` évite qu'un chiffre déborde de sa case sur un très grand écran.

      Deux boutons, un seul réglage : `html { font-size }` fait grandir la grille
      elle-même là où l'écran le permet ; `--text-scale` fait grandir les
      chiffres à l'intérieur d'une grille dont la largeur est déjà bornée par le
      téléphone. Le premier seul ne pouvait rien pour un écran de 375 px, et
      c'est précisément là que le public visé en a le plus besoin.
    */
    font-size: min(calc(6.2cqi * var(--text-scale, 1)), 2.4rem);
    color: var(--value-player);
    transition: background-color 90ms ease;
  }

  .board.passive .cell {
    cursor: default;
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

  /* Zone désignée au premier palier d'indice : « regarde par ici ». */
  .cell.zone {
    background: var(--zone-bg);
  }

  /* Le motif qui porte le raisonnement, révélé au deuxième palier. */
  .cell.marked {
    background: var(--hint-bg);
    box-shadow: inset 0 0 0 2px var(--hint-border);
    z-index: 1;
  }

  /* La conclusion, révélée au dernier palier seulement. */
  .cell.target {
    background: var(--hint-target-bg);
    box-shadow: inset 0 0 0 3px var(--hint-target-border);
    z-index: 1;
  }

  /*
    Le conflit n'est jamais signalé par la seule couleur : un trait épais double
    l'information, pour rester lisible en cas de daltonisme comme à l'impression
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

  /*
    Un candidat à 0,34 em d'un chiffre de 21 px fait **sept pixels** sur un
    téléphone. C'est le vrai point douloureux du réglage « gros caractères », et
    l'audit l'avait manqué. Le ratio monte, et la case sélectionnée — celle qu'on
    est en train de travailler — les montre nettement plus grands encore.
  */
  .notes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    width: 100%;
    height: 100%;
    padding: 6%;
    font-size: 0.4em;
    line-height: 1;
    color: var(--value-note);
  }

  .cell.selected .notes {
    font-size: 0.52em;
  }

  .note {
    display: grid;
    place-items: center;
  }

  /*
    Le mode notes se voit sur la grille elle-même, pas seulement sur un bouton à
    l'écart : la confusion entre note et valeur définitive est l'un des reproches
    les plus fréquents faits aux applications existantes.
  */
  .board.note-mode {
    border-color: var(--note-accent);
    background: var(--note-accent);
  }
</style>
