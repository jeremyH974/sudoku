<script lang="ts">
  import { EMPTY, SIZE, UNITS, digitsOf, hasDigit } from '@sudoku/engine';
  import type { Game } from './game.svelte.js';
  import { MARKS, markOf, markedDigits } from './marks.js';
  import { assists } from './assists.svelte.js';

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
    if (!interactive || !assists.peers) return false;
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
    if (!interactive || !assists.sameValue) return false;
    const selectedValue = values[game.selected];
    return selectedValue !== EMPTY && values[cell] === selectedValue && cell !== game.selected;
  }

  /**
   * Conflits — de la partie en cours **seulement**.
   *
   * Le plateau passif affiche une position du solveur, qui n'a par construction
   * aucun conflit. Lire `game.conflicts` y peignait en rouge les cases fausses
   * d'une **autre** grille, celle que le joueur a sous les doigts, et le lecteur
   * d'écran l'annonçait. `isPeer` et `isSameValue` s'arrêtaient déjà sur
   * `!interactive` ; ceux-ci avaient été oubliés.
   */
  /*
    L'aide éteinte retire aussi l'annonce « en conflit » : l'écran et le lecteur
    d'écran doivent dire la même chose. La partie, elle, garde ses conflits —
    c'est ce qui décide qu'une grille est terminée.
  */
  const conflicts = $derived(
    interactive && assists.conflicts ? game.conflicts : new Set<number>(),
  );

  /** Notes du joueur, ou candidats calculés en mode analyse. */
  function notesOf(cell: number): number[] {
    if (overrideCandidates !== null) return digitsOf(overrideCandidates[cell] ?? 0);
    return game.notesOf(cell);
  }

  /** Masque des notes, sans allouer. Voir le commentaire du rendu ci-dessous. */
  function noteMaskOf(cell: number): number {
    if (overrideCandidates !== null) return overrideCandidates[cell] ?? 0;
    return game.notes[cell] ?? 0;
  }

  /** Marques des candidats. La vue d'analyse n'en a pas : elle n'est pas jouée. */
  function marksOf(cell: number): number {
    return overrideCandidates !== null ? 0 : game.marksOf(cell);
  }

  /** Libellé lu par les lecteurs d'écran. */
  function describe(cell: number): string {
    const value = values[cell];
    const parts = [`ligne ${String(rowOf(cell) + 1)}, colonne ${String(colOf(cell) + 1)}`];
    if (value === EMPTY) {
      const notes = notesOf(cell);
      parts.push(notes.length > 0 ? `notes ${notes.join(' ')}` : 'vide');
      /*
        Les marques sont **nommées**, pas seulement colorées. C'est le porteur
        d'information qui ne se dégrade jamais : ni à huit pixels, ni en noir et
        blanc, ni pour un daltonien, ni au lecteur d'écran. La couleur n'en est
        qu'un rappel visuel.
      */
      for (const { digit, label } of markedDigits(marksOf(cell))) {
        parts.push(`${String(digit)} marqué ${label}`);
      }
    } else {
      parts.push(String(value));
      if (game.isGiven(cell)) parts.push('indice de départ');
    }
    if (conflicts.has(cell)) parts.push('en conflit');
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
      return;
    }

    // A, B, C : la même bascule que « N », pour chacune des trois marques.
    const mark = MARKS.find((entry) => entry.label.toLowerCase() === key.toLowerCase());
    if (mark !== undefined) {
      event.preventDefault();
      game.setMarkMode(mark.id);
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
          aria-invalid={conflicts.has(cell)}
          tabindex={interactive && game.selected === cell ? 0 : -1}
          class="cell"
          class:given={game.isGiven(cell)}
          class:selected={interactive && game.selected === cell}
          class:conflict={conflicts.has(cell)}
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
          {:else if noteMaskOf(cell) !== 0}
            <!--
              Le masque et les marques sont calculés **une fois** par case.
              L'écriture précédente appelait `notesOf(cell)` dix fois par case
              vide, et chaque appel allouait un tableau : environ six cents
              tableaux jetés à chaque rendu de grille, pour une information tenue
              dans un entier.
            -->
            {@const mask = noteMaskOf(cell)}
            {@const colors = marksOf(cell)}
            <span class="notes" aria-hidden="true">
              {#each { length: SIZE } as _, i (i)}
                {@const digit = i + 1}
                <span class="note" data-mark={markOf(colors, digit) || null}>
                  {hasDigit(mask, digit) ? digit : ''}
                </span>
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
    max-width: var(--board-max);
    margin-inline: auto;
    container-type: inline-size;
    aspect-ratio: 1;
    /*
      ─── Ce que la direction artistique illustrée prend ici, et ce qu'elle ne
          prend pas ─────────────────────────────────────────────────────────

      Le **cadre** seulement : trait d'encre et ombre décalée, comme toute
      surface qu'on regarde. À l'intérieur, rien ne change, et ce n'est pas une
      timidité — trois décisions mesurées l'interdisent :

        · le quadrillage garde `--grid-strong`, qui est un jeton distinct de
          `--ink`. Ce sont les traits de la grille, pas le bord d'un objet ;
        · le tramage des blocs de 3×3 dépend de `border-box` pour que toutes
          les cases gardent exactement la même taille (voir plus bas) ; une
          bordure par case romprait cette égalité ;
        · les liserés `inset` des cases — chiffre identique, zone d'indice,
          motif, conclusion — **portent de l'information**. Un liseré d'encre
          autour de chaque case entrerait en concurrence avec eux, et le
          cerclage du chiffre identique cesserait de se distinguer de la case
          qu'on vient de jouer, ce qu'il avait justement fallu corriger.

      La règle générale, écrite une fois pour tout le site : le langage
      s'applique à ce qu'on regarde et qu'on presse délibérément, jamais à une
      grille dense d'information.
    */
    border: 3px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--grid-strong);
    box-shadow: var(--shadow-hard);
    gap: 1px;
    touch-action: manipulation;
  }

  /*
    Le plateau d'analyse garde le cadre et perd l'ombre : il vit **dans** un
    panneau qui en porte déjà une, et deux reliefs emboîtés se lisent comme une
    erreur de mise en page plutôt que comme une hiérarchie.
  */
  .board.passive {
    max-width: 27rem;
    box-shadow: none;
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
    transition:
      background-color var(--dur-instant) var(--ease),
      box-shadow var(--dur-instant) var(--ease);
  }

  .board.passive .cell {
    cursor: default;
  }

  /*
    700 et non 650 : mesuré au pixel, 650 rendait exactement comme 700 faute
    d'une police variable. On écrit ce qui s'affiche.
  */
  .cell.given {
    color: var(--value-given);
    font-weight: 700;
  }

  .cell.peer {
    background: var(--cell-peer);
  }

  /*
    Les chiffres identiques sont cerclés, pas remplis. Remplie, une case
    surlignée ressemblait trait pour trait à la case qu'on venait de jouer : le
    premier regard extérieur a cru, deux fois, que l'application posait le
    chiffre ailleurs. Un liseré dit « ce chiffre est déjà ici » ; un fond disait
    « on vient d'agir ici ». Les liserés des indices, déclarés plus bas, passent
    devant.
  */
  .cell.same-value {
    box-shadow: inset 0 0 0 2px var(--cell-same);
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

  /*
    Un chiffre imprimé garde son encre, même en conflit. Passé à l'orange du
    joueur, il semblait écrit par l'application : c'est exactement ce qu'a cru
    le premier regard extérieur, à la mise en ligne. Le conflit reste porté par
    le fond, la barre et le libellé lu à voix haute.
  */
  .cell.given.conflict {
    color: var(--value-given);
  }

  .cell.conflict::after {
    content: '';
    position: absolute;
    inset: auto 18% 8% 18%;
    height: 3px;
    border-radius: var(--radius-pill);
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
    Les trois marques. Chacune porte **deux** signes en plus de sa couleur : la
    graisse, et un tracé qui lui est propre — soulignement plein, cadre,
    soulignement pointillé. C'est ce qui la rend lisible en noir et blanc, à
    l'impression, et pour un daltonien. Sa lettre, elle, vit dans le libellé lu à
    voix haute et dans la légende ; à sept pixels, aucune lettre ne tiendrait
    dans la case.
  */
  .note[data-mark] {
    font-weight: 700;
  }

  .note[data-mark='1'] {
    color: var(--mark-a);
    box-shadow: inset 0 -0.14em 0 -0.05em var(--mark-a);
  }

  .note[data-mark='2'] {
    color: var(--mark-b);
    outline: 0.09em solid var(--mark-b);
    outline-offset: -0.05em;
    /*
      En `em`, comme le reste du tracé : c'est le seul rayon de l'application
      dont le conteneur grandit avec le réglage « gros caractères ».
    */
    border-radius: 0.06em;
  }

  .note[data-mark='3'] {
    color: var(--mark-c);
    background-image: linear-gradient(
      to right,
      var(--mark-c) 0 40%,
      transparent 40% 60%,
      var(--mark-c) 60% 100%
    );
    background-size: 100% 0.12em;
    background-position: bottom;
    background-repeat: no-repeat;
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
