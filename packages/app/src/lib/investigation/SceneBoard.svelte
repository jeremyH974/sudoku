<script lang="ts">
  import { propsOfCell } from '@sudoku/engine/investigation';
  import type { CaseGame } from './caseGame.svelte.js';
  import { FURNITURE, FURNITURE_LABEL } from './furniture.js';

  interface Props {
    game: CaseGame;
    /** Cases que l'indice met en avant : « regarde par ici ». */
    highlight?: ReadonlySet<number>;
    /** Cases que l'indice désigne : la conclusion. */
    target?: ReadonlySet<number>;
  }

  const { game, highlight, target }: Props = $props();

  let cellElements: (HTMLElement | null)[] = $state([]);
  let gridElement: HTMLElement | null = $state(null);

  const scene = $derived(game.puzzle?.scene ?? null);
  const size = $derived(scene?.size ?? 0);
  const marked = $derived(highlight ?? new Set<number>());
  const targets = $derived(target ?? new Set<number>());

  /*
    Un seul élément atteignable au clavier à la fois — « roving tabindex ». La
    tabulation entre puis sort du plan ; les flèches s'y déplacent. C'est ce que
    fait déjà le plateau de sudoku, et la même réserve vaut : `role="grid"`
    reste à valider avec un vrai lecteur d'écran, ce qu'`axe` ne sait pas faire.

    À comparer avec la référence du genre, dont le plan est un `<canvas>` sans
    rôle ni nom : zéro élément focalisable, zéro région annoncée. Le jeu y est
    littéralement inaccessible au clavier.
  */
  $effect(() => {
    const element = cellElements[game.cursor];
    if (!element || !gridElement) return;
    if (gridElement.contains(document.activeElement) && document.activeElement !== element) {
      element.focus();
    }
  });

  const rowOf = (cell: number): number => Math.floor(cell / size);
  const columnOf = (cell: number): number => cell % size;

  /** Un mur là où la case voisine est d'une autre pièce — ou n'existe pas. */
  function wall(cell: number, side: 'top' | 'right' | 'bottom' | 'left'): boolean {
    if (scene === null) return false;
    const row = rowOf(cell);
    const column = columnOf(cell);
    if (side === 'top') return row === 0 || scene.zoneOf[cell - size] !== scene.zoneOf[cell];
    if (side === 'bottom')
      return row === size - 1 || scene.zoneOf[cell + size] !== scene.zoneOf[cell];
    if (side === 'left') return column === 0 || scene.zoneOf[cell - 1] !== scene.zoneOf[cell];
    return column === size - 1 || scene.zoneOf[cell + 1] !== scene.zoneOf[cell];
  }

  /** Les suspects notés au crayon dans une case. */
  function pencilled(cell: number): string[] {
    const mask = game.pencil[cell] ?? 0;
    return game.suspects.filter((suspect) => (mask & (1 << suspect.index)) !== 0).map((s) => s.letter);
  }

  /**
   * Le nom accessible d'une case — et le seul porteur d'information du plan.
   *
   * Tout ce que le dessin montre est dit ici en toutes lettres : la pièce, le
   * mobilier, qui est posé, ce qui est barré. Le dessin peut disparaître sans
   * que l'affaire devienne injouable, ce qui est exactement l'engagement pris
   * en choisissant une scène dessinée.
   */
  function describeCell(cell: number): string {
    if (scene === null) return '';
    const parts = [
      `rangée ${String(rowOf(cell) + 1)}, colonne ${String(columnOf(cell) + 1)}`,
      scene.zones[scene.zoneOf[cell]].name,
    ];

    const furniture = propsOfCell(scene, cell).map((prop) => FURNITURE_LABEL[prop]);
    if (furniture.length > 0) parts.push(furniture.join(', '));

    const who = game.occupant[cell];
    if (who !== undefined && who !== -1) {
      const person = game.suspects[who];
      parts.push(`${person.name} (${person.letter}) placé ici`);
    } else {
      const notes = pencilled(cell);
      if (notes.length > 0) parts.push(`au crayon : ${notes.join(' ')}`);
      if (game.crossed[cell]) parts.push('barrée');
      else if (game.blocked(cell)) parts.push('impossible, rangée ou colonne déjà prise');
      if (notes.length === 0 && !game.crossed[cell] && !game.blocked(cell)) parts.push('libre');
    }

    if (targets.has(cell)) parts.push("désignée par l'indice");
    else if (marked.has(cell)) parts.push("mise en avant par l'indice");
    return parts.join(', ');
  }

  /**
   * Les noms de pièce, posés sur le plan.
   *
   * Ancrés en bas à gauche de chaque pièce, comme sur un plan d'architecte.
   * Ils sont masqués aux lecteurs d'écran : chaque case dit déjà sa pièce, et
   * les répéter ferait lire le plan deux fois.
   */
  const roomLabels = $derived(
    scene === null
      ? []
      : scene.zones.map((zone) => {
          // La case la plus basse de la pièce, et la plus à gauche de cette
          // rangée : l'ancrage d'un plan d'architecte.
          let anchor = -1;
          for (let cell = 0; cell < scene.cellCount; cell++) {
            if (scene.zoneOf[cell] !== zone.index) continue;
            if (anchor === -1 || rowOf(cell) > rowOf(anchor)) anchor = cell;
          }
          for (let cell = 0; cell < scene.cellCount; cell++) {
            if (scene.zoneOf[cell] === zone.index && rowOf(cell) === rowOf(anchor)) {
              anchor = Math.min(anchor, cell);
            }
          }
          return {
            name: zone.name,
            x: (columnOf(anchor) / size) * 100,
            y: ((size - 1 - rowOf(anchor)) / size) * 100,
          };
        }),
  );

  const MOVES: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  function onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      game.undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const move = MOVES[event.key];
    if (move) {
      event.preventDefault();
      game.move(move[0], move[1]);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      game.apply(game.cursor);
      return;
    }

    // La lettre d'un suspect le choisit : c'est le raccourci qui rend le mode
    // jouable sans quitter le plan, et il reprend l'alphabet affiché sur les
    // cartes plutôt qu'un ordre inventé.
    const person = game.suspects.find((suspect) => suspect.letter === event.key.toUpperCase());
    if (person !== undefined) {
      event.preventDefault();
      game.suspect = person.index;
    }
  }
</script>

{#if scene !== null}
  <div class="stage">
    <div
      bind:this={gridElement}
      role="grid"
      aria-label={`Plan de la scène, ${String(size)} rangées sur ${String(size)} colonnes`}
      aria-rowcount={size}
      aria-colcount={size}
      class="board"
      tabindex={-1}
    >
      {#each { length: size } as _, row (row)}
        <div role="row" aria-rowindex={row + 1} class="row" style={`--columns: ${String(size)}`}>
          {#each { length: size } as _, column (column)}
            {@const cell = row * size + column}
            {@const who = game.occupant[cell] ?? -1}
            <div
              bind:this={cellElements[cell]}
              role="gridcell"
              aria-colindex={column + 1}
              aria-label={describeCell(cell)}
              aria-selected={game.cursor === cell}
              tabindex={game.cursor === cell ? 0 : -1}
              class="cell"
              data-zone={scene.zoneOf[cell] % 6}
              class:wall-top={wall(cell, 'top')}
              class:wall-right={wall(cell, 'right')}
              class:wall-bottom={wall(cell, 'bottom')}
              class:wall-left={wall(cell, 'left')}
              class:cursor={game.cursor === cell}
              class:marked={marked.has(cell)}
              class:target={targets.has(cell)}
              onclick={() => {
                game.apply(cell);
              }}
              onkeydown={onKeyDown}
            >
              <svg class="decor" viewBox="0 0 24 24" aria-hidden="true">
                {#each propsOfCell(scene, cell) as prop (prop)}
                  <!--
                    Clé par position, et non par tracé : un meuble dessine
                    souvent la même forme deux fois — une fois teintée, une fois
                    cerclée. Le tracé n'est donc pas une identité.
                  -->
                  {#each FURNITURE[prop] as part, part_index (part_index)}
                    <path
                      d={part.d}
                      class:soft={part.paint === 'soft'}
                      class:thin={part.paint === 'thin'}
                    />
                  {/each}
                {/each}
              </svg>

              {#if who !== -1}
                <span class="token">{game.suspects[who].letter}</span>
              {:else if game.crossed[cell]}
                <svg class="cross firm" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              {:else if game.blocked(cell)}
                <svg class="cross faint" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 8l8 8M16 8l-8 8" />
                </svg>
              {:else if pencilled(cell).length > 0}
                <span class="pencil" aria-hidden="true">{pencilled(cell).join('')}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <div class="rooms" aria-hidden="true">
      <!-- Clé par position : rien ne garantit qu'un décor ne nomme pas deux
           pièces pareillement, et le corpus de la référence du genre en compte. -->
      {#each roomLabels as label, label_index (label_index)}
        <span class="room" style={`left: ${String(label.x)}%; bottom: ${String(label.y)}%`}>
          {label.name}
        </span>
      {/each}
    </div>
  </div>
{/if}

<style>
  /*
    Le plan se mesure contre **son conteneur**, jamais contre la fenêtre : même
    règle, et même raison, que le plateau de sudoku. `container-type` fait du
    plan son propre référentiel, et les lettres s'y dimensionnent en `cqi`, donc
    obéissent au réglage « gros caractères » sur un téléphone aussi.
  */
  .stage {
    position: relative;
    width: 100%;
    max-width: var(--board-max);
    margin-inline: auto;
    container-type: inline-size;
  }

  .board {
    display: grid;
    aspect-ratio: 1;
    border: 3px solid var(--scene-wall);
    border-radius: var(--radius-sm);
    background: var(--scene-wall);
    touch-action: manipulation;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(var(--columns), 1fr);
  }

  .cell {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    cursor: pointer;
    user-select: none;
    /*
      Un liseré transparent sur les quatre côtés, dont seuls ceux qui portent un
      mur reçoivent une couleur. La **largeur** est la même partout : la piste de
      grille garde donc exactement la même taille qu'il y ait un mur ou non. Un
      `gap`, ou une largeur variable, aurait décalé les cases d'un demi-pixel
      selon la parité — et c'est visible sur un plan.
    */
    border: 2px solid transparent;
    font-size: min(calc(7cqi * var(--text-scale, 1)), 2.2rem);
    transition: background-color var(--dur-instant) var(--ease);
  }

  /*
    Six teintes, et la pièce se dit d'abord par son nom et ses murs. Le modulo
    du gabarit garantit qu'un décor de plus de six pièces reste lisible : deux
    pièces partageront une teinte, mais jamais un nom ni un mur.
  */
  .cell[data-zone='0'] {
    background: var(--scene-zone-1);
  }
  .cell[data-zone='1'] {
    background: var(--scene-zone-2);
  }
  .cell[data-zone='2'] {
    background: var(--scene-zone-3);
  }
  .cell[data-zone='3'] {
    background: var(--scene-zone-4);
  }
  .cell[data-zone='4'] {
    background: var(--scene-zone-5);
  }
  .cell[data-zone='5'] {
    background: var(--scene-zone-6);
  }

  /* Les murs : c'est eux qui font qu'« à côté de » veut dire quelque chose. */
  .cell.wall-top {
    border-top-color: var(--scene-wall);
  }
  .cell.wall-right {
    border-right-color: var(--scene-wall);
  }
  .cell.wall-bottom {
    border-bottom-color: var(--scene-wall);
  }
  .cell.wall-left {
    border-left-color: var(--scene-wall);
  }

  /*
    Les états de **pointeur** viennent avant les états d'**information**.

    À égalité de spécificité, c'est la dernière règle qui gagne : déclaré après,
    le survol effaçait la mise en avant d'un indice dès qu'on passait la souris
    dessus — le joueur voyait le motif disparaître sous son propre curseur.
  */
  @media (hover: hover) {
    .cell:hover {
      background: var(--surface-hover);
    }
  }

  .cell:active {
    background: var(--surface-pressed);
  }

  .cell.cursor {
    outline: 3px solid var(--focus);
    outline-offset: -3px;
    z-index: 2;
  }

  /* Le motif qui porte le raisonnement, au deuxième palier d'indice. */
  .cell.marked {
    background: var(--hint-bg);
    box-shadow: inset 0 0 0 2px var(--hint-border);
    z-index: 1;
  }

  /* La conclusion, au dernier palier seulement. */
  .cell.target {
    background: var(--hint-target-bg);
    box-shadow: inset 0 0 0 3px var(--hint-target-border);
    z-index: 1;
  }

  /* Le mobilier occupe la case ; le jeton d'un suspect se pose par-dessus. */
  .decor {
    position: absolute;
    inset: 12%;
    width: 76%;
    height: 76%;
    fill: none;
    stroke: var(--scene-ink);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .decor .soft {
    fill: var(--scene-ink);
    fill-opacity: 0.14;
    stroke: none;
  }

  .decor .thin {
    stroke-width: 1;
  }

  /*
    Le jeton d'un suspect : un disque et **sa lettre**. La lettre n'est pas une
    décoration du disque, c'est l'information — elle survit au noir et blanc, au
    daltonisme et à l'impression, ce qu'une pastille de couleur ne fait pas.
  */
  .token {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 76%;
    height: 76%;
    border-radius: var(--radius-pill);
    background: var(--scene-token);
    color: var(--scene-token-ink);
    font-weight: 700;
    line-height: var(--leading-tight);
  }

  /*
    Deux croix, deux intensités : celle que le joueur a tracée est pleine, celle
    que le plateau déduit d'un placement est légère. La différence est de
    **trait**, pas de couleur.
  */
  .cross {
    width: 60%;
    height: 60%;
    fill: none;
    stroke: var(--scene-cross);
    stroke-linecap: round;
  }

  .cross.firm {
    stroke-width: 2.4;
  }

  .cross.faint {
    stroke-width: 1.2;
    opacity: 0.55;
  }

  .pencil {
    color: var(--scene-label);
    font-size: min(calc(3.4cqi * var(--text-scale, 1)), 1rem);
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  /*
    Les noms de pièce, posés sur le plan comme sur un plan d'architecte : ancrés
    en bas à gauche de la pièce, et laissés déborder. Un nom tronqué à la case
    ne se lirait pas, et c'est le nom qui distingue deux pièces de teinte
    voisine.
  */
  .rooms {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .room {
    position: absolute;
    padding: 0 var(--space-1);
    color: var(--scene-label);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }
</style>
