<script lang="ts">
  import { doorwaysOf, propsOfCell } from '@sudoku/engine/investigation';
  import type { Doorway, PropId, Scene } from '@sudoku/engine/investigation';
  import type { CaseGame } from './caseGame.svelte.js';
  import { FILL, FURNITURE, FURNITURE_LABEL, LAYER_ORDER } from './furniture.js';

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

  /**
   * L'épaisseur d'un mur, en fraction de case.
   *
   * Les murs étaient des **bordures de case** : deux pixels de chaque côté,
   * donc quatre entre deux pièces, et aucun moyen d'y ménager une ouverture —
   * une bordure CSS est pleine ou n'est pas. C'est cela qui a fait passer le
   * plan au tracé.
   *
   * La valeur suit la hiérarchie d'ISO 128-23 : sur un plan de bâtiment, le mur
   * coupé porte le trait le plus fort et le symbole de porte le plus fin, dans
   * un rapport de **quatre pour un**. C'est le seuil du seuil ci-dessous.
   */
  const WALL = 0.12;

  /** Le seuil d'une porte : le quart du mur, exactement, et c'est la norme. */
  const SILL = WALL / 4;

  /**
   * Les murs du plan, en tracés d'un seul tenant.
   *
   * ─── Pourquoi un seul chemin, et pas un segment par case ────────────────
   *
   * Parce qu'à cette échelle un pixel change le sens du dessin. Les moteurs
   * anticrénèlent **chaque forme séparément contre le canevas** au lieu de
   * faire un anticrénelage de scène : deux segments exactement jointifs
   * laissent apparaître une couture claire, qui va et vient selon le zoom et la
   * densité d'écran. Des pans d'un seul tenant n'ont pas de jonction à trahir.
   *
   * ─── Les coins ──────────────────────────────────────────────────────────
   *
   * Les bouts sont carrés (`stroke-linecap: square`), donc chaque pan déborde
   * d'un demi-mur : c'est ce qui remplit les angles en L et en T sans un seul
   * tracé de plus. En contrepartie, l'ouverture d'une porte est **élargie d'un
   * demi-mur de chaque côté** avant d'être retranchée, pour que le vide visible
   * mesure exactement ce que le moteur a calculé.
   */
  function wallRuns(plan: Scene, doors: readonly Doorway[]): string {
    const n = plan.size;
    const parts: string[] = [];

    for (const axis of ['vertical', 'horizontal'] as const) {
      // Seules les lignes intérieures : le pourtour est la bordure d'encre du
      // plateau, qui est aussi ce qui le fait lire comme un objet posé.
      for (let line = 1; line < n; line++) {
        const openings = doors
          .filter((door) => door.axis === axis && door.line === line)
          .map((door) => ({ from: door.from - WALL / 2, to: door.to + WALL / 2 }))
          .sort((left, right) => left.from - right.from);

        let start = -1;
        for (let step = 0; step <= n; step++) {
          const solid =
            step < n &&
            (axis === 'vertical'
              ? plan.zoneOf[step * n + line - 1] !== plan.zoneOf[step * n + line]
              : plan.zoneOf[(line - 1) * n + step] !== plan.zoneOf[line * n + step]);

          if (solid && start === -1) start = step;
          if (!solid && start !== -1) {
            // Le pan court de `start` à `step` ; on en retire les ouvertures.
            let cursor = start;
            for (const hole of openings) {
              if (hole.to <= cursor || hole.from >= step) continue;
              if (hole.from > cursor) parts.push(segment(axis, line, cursor, hole.from));
              cursor = Math.max(cursor, hole.to);
            }
            if (cursor < step) parts.push(segment(axis, line, cursor, step));
            start = -1;
          }
        }
      }
    }
    return parts.join('');
  }

  /** Un pan de mur, le long de sa ligne de grille. */
  const segment = (axis: 'vertical' | 'horizontal', line: number, from: number, to: number): string =>
    axis === 'vertical'
      ? `M${String(line)} ${String(from)}V${String(to)}`
      : `M${String(from)} ${String(line)}H${String(to)}`;

  /**
   * Les seuils, tracés dans le vide des portes.
   *
   * Une ouverture nue n'est couverte par aucun des deux objets qu'ISO 7519
   * distingue — ni la porte, ni la baie marquée : un vide sans marque se lit
   * aussi bien comme « une fin de mur ». Le seuil lève l'ambiguïté avec un seul
   * trait, quatre fois plus fin que le mur.
   *
   * Le vantail et son arc de débattement ont été écartés, et pas par paresse :
   * ils codent un **sens d'ouverture** dont aucune donnée de décor ne dispose.
   * Les dessiner au hasard mettrait une information fausse sur un plan par
   * ailleurs exact — la même règle que « ne jamais afficher une difficulté
   * qu'on n'a pas mesurée ».
   *
   * À la plus petite taille de plan, le seuil descend sous le pixel et
   * s'estompe. C'est voulu : l'information est portée par **le vide**, que
   * l'élément le plus épais du dessin encadre ; le seuil n'est qu'une précision
   * qui s'efface proprement.
   */
  function sills(doors: readonly Doorway[]): string {
    return doors.map((door) => segment(door.axis, door.line, door.from, door.to)).join('');
  }

  /*
    Les portes, calculées **une fois** par plan.

    Les murs et les seuils les demandaient chacun de leur côté, et chaque
    demande rejouait tout l'arbre couvrant : le relevé des mitoyennetés, le
    regroupement par contiguïté, le tri, l'union-find. Deux fois le même
    résultat à chaque rendu, pour un calcul qui ne dépend que du décor.
  */
  const doorways = $derived(scene === null ? [] : doorwaysOf(scene));
  const wallPath = $derived(scene === null ? '' : wallRuns(scene, doorways));
  const sillPath = $derived(sills(doorways));

  /**
   * Les meubles d'une case, dans l'ordre où on les dessine.
   *
   * Un tapis se pose au sol, ce qu'on met dessus se pose dessus — et se dessine
   * plus petit, sinon les deux silhouettes se recouvrent et aucune ne se lit.
   */
  function furnitureOf(cell: number): { prop: PropId; onRug: boolean }[] {
    if (scene === null) return [];
    const here = new Set(propsOfCell(scene, cell));
    const hasRug = here.has('rug');
    return LAYER_ORDER.filter((prop) => here.has(prop)).map((prop) => ({
      prop,
      onRug: hasRug && prop !== 'rug',
    }));
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
          /*
            Décalé d'un demi-mur, et c'est une correction.

            L'étiquette s'ancre au coin bas-gauche de la pièce — donc pile sur
            les deux murs qui s'y croisent. Avec des bordures de deux pixels,
            elle les effleurait ; avec un mur épais, elle est posée dessus et
            devient illisible. Le décalage la fait entrer **dans** la pièce,
            qui est de toute façon là qu'un plan d'architecte l'écrit.

            La valeur vient de `WALL`, jamais recopiée : une épaisseur de mur
            rapportée à la largeur du plateau, en pourcentage. Un mur entier et
            non un demi : le demi suffit à ne pas chevaucher, et laisse le nom
            collé au trait. Celui-ci lui donne un demi-mur d'air.
          */
          const inset = (WALL / size) * 100;
          return {
            name: zone.name,
            // La teinte de la pièce, pour que l'étiquette repose sur son propre
            // sol. Même modulo que les cases : un décor de plus de six pièces
            // reste lisible, deux pièces partageront une teinte jamais un nom.
            tint: zone.index % 6,
            x: (columnOf(anchor) / size) * 100 + inset,
            y: ((size - 1 - rowOf(anchor)) / size) * 100 + inset,
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
            <!--
              Pas d'`aria-selected`, et c'est une décision mesurée.

              Ce plateau n'a pas de **sélection** au sens d'ARIA — un ensemble
              de cases retenues pour une opération, comme dans un tableur. Il a
              un **curseur**, que le focus porte déjà : `tabindex` roving amène
              le focus sur la case courante, et un lecteur d'écran annonce
              toujours ce qui reçoit le focus.

              L'attribut n'ajoutait donc rien, et coûtait. Relevé dans le
              navigateur : 35 cases sur 36 portaient `aria-selected="false"`,
              que NVDA énonce « non sélectionné » — un mot de bruit sur
              presque chaque case. Le support est par ailleurs documenté comme
              inconstant : NVDA ne l'annonce pas du tout sous Chrome et le
              rapporte sur toutes les cellules sous Firefox (nvaccess/nvda
              #15198, juillet 2023), et l'état sélectionné n'est pas annoncé
              dans le calendrier-grille de l'APG lui-même, qui est le cas
              officiel le plus proche du nôtre (#16454, avril 2024, clos en
              « needs external fix »). Sarah Higley classe `aria-selected` sur
              `gridcell` parmi les attributs « à n'employer qu'en sachant
              exactement ce qu'on fait ».

              « No ARIA is better than bad ARIA » est la première règle de
              l'APG, et c'est celle-ci qui s'applique.

              ⚠ Ce qui reste **non vérifié** : rien de ce qui précède n'a été
              entendu dans un lecteur d'écran ici. Ce sont des rapports de
              bogues datés et le texte normatif, pas une mesure à l'oreille.
            -->
            <div
              bind:this={cellElements[cell]}
              role="gridcell"
              aria-colindex={column + 1}
              aria-label={describeCell(cell)}
              tabindex={game.cursor === cell ? 0 : -1}
              class="cell"
              data-zone={scene.zoneOf[cell] % 6}
              class:cursor={game.cursor === cell}
              class:marked={marked.has(cell)}
              class:target={targets.has(cell)}
              onclick={() => {
                game.apply(cell);
              }}
              onkeydown={onKeyDown}
            >
              <svg class="decor" viewBox="0 0 24 24" aria-hidden="true">
                {#each furnitureOf(cell) as piece (piece.prop)}
                  <g transform={piece.onRug ? 'translate(3.6 3.6) scale(0.7)' : undefined}>
                    <!--
                      Clé par position, et non par tracé : un meuble dessine
                      parfois deux fois la même forme, une fois en encre et une
                      fois en matière. Le tracé n'est donc pas une identité.
                    -->
                    {#each FURNITURE[piece.prop] as part, part_index (part_index)}
                      <path d={part.d} fill={FILL[part.fill]} />
                    {/each}
                  </g>
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

      <!--
        Les murs, par-dessus les cases et sous tout le reste.

        `aria-hidden` le retire de l'arbre d'accessibilité, donc la grille ne
        voit que ses rangées : un `role="grid"` n'accepte pas d'autre enfant.
        Et il ne coûte rien au lecteur d'écran, puisque chaque case dit déjà sa
        pièce — un mur n'ajoute aucune information qu'un nom de case ne porte.
      -->
      <svg class="walls" viewBox="0 0 {size} {size}" aria-hidden="true">
        <path class="wall" d={wallPath} stroke-width={WALL} />
        <path class="sill" d={sillPath} stroke-width={SILL} />
      </svg>
    </div>

    <div class="rooms" aria-hidden="true">
      <!-- Clé par position : rien ne garantit qu'un décor ne nomme pas deux
           pièces pareillement, et le corpus de la référence du genre en compte. -->
      {#each roomLabels as label, label_index (label_index)}
        <span
          class="room"
          data-zone={label.tint}
          style={`left: ${String(label.x)}%; bottom: ${String(label.y)}%`}
        >
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

  /*
    Le plan est cerclé d'encre et posé en relief — l'ombre **décalée sans flou**
    du genre, pas une ombre douce. C'est elle qui fait qu'un plateau ressemble à
    un objet posé plutôt qu'à une zone de la page.
  */
  .board {
    position: relative;
    display: grid;
    aspect-ratio: 1;
    border: 3px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--scene-wall);
    box-shadow: var(--shadow-hard);
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
      Aucune bordure : les teintes de pièce se touchent, et les murs passent
      **par-dessus** en SVG.

      Les cases portaient un liseré transparent de deux pixels, coloré sur les
      côtés qui faisaient mur. Cela tenait tant qu'un mur était plein ; une
      bordure CSS ne sait pas s'interrompre au milieu, donc une porte y était
      impossible. La largeur constante que ce liseré garantissait est désormais
      obtenue gratuitement : le calque ne touche pas la piste de grille.
    */
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

  /*
    Les murs : c'est eux qui font qu'« à côté de » veut dire quelque chose.

    Le calque couvre exactement la piste de grille — le plateau est carré
    (`aspect-ratio: 1`) et la vue SVG compte une unité par case, donc le tracé
    tombe sur les lignes de grille sans aucun calcul de position.

    Il ne reçoit jamais le pointeur : ce sont les cases qu'on clique, et un mur
    posé par-dessus ne doit pas avaler un clic près d'un bord.
  */
  .walls {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /*
    L'épaisseur n'est **pas** écrite ici : elle vient de `WALL`, porté par
    l'attribut du tracé. La recopier en CSS en ferait une seconde source de
    vérité, et la géométrie du script calcule déjà avec — l'ouverture d'une
    porte est élargie d'un demi-mur avant d'être retranchée.
  */
  .wall {
    fill: none;
    stroke: var(--scene-wall);
    stroke-linecap: square;
  }

  /* Le seuil d'une porte, quatre fois plus fin que le mur — ISO 128-23. */
  .sill {
    fill: none;
    stroke: var(--scene-wall);
    stroke-linecap: butt;
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

  /*
    Le mobilier occupe la case ; le jeton d'un suspect se pose par-dessus.

    Aucun contour : la silhouette est une **forme pleine** d'encre, dessinée sous
    l'objet. C'est la grammaire du genre, et c'est aussi ce que la mesure
    imposait — les tons de matière plafonnent à 3:1 contre les teintes de pièce.
  */
  .decor {
    position: absolute;
    inset: 8%;
    width: 84%;
    height: 84%;
  }

  /*
    Le jeton d'un suspect : une pastille cerclée d'encre, posée en relief, et
    **sa lettre**. La lettre n'est pas une décoration de la pastille, c'est
    l'information — elle survit au noir et blanc, au daltonisme et à
    l'impression, ce qu'une couleur ne fait pas.
  */
  .token {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 74%;
    height: 74%;
    border: 2px solid var(--ink);
    border-radius: var(--radius-pill);
    background: var(--scene-token);
    color: var(--scene-token-ink);
    font-weight: 700;
    line-height: var(--leading-tight);
    box-shadow: var(--shadow-hard);
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

  /*
    Les noms de pièce, **écrits à la main** sur le plan.

    C'est le seul endroit du plateau où la manuscrite sert : une pièce annotée
    à la main sur un plan, ce qui est exactement ce qu'est ce plateau. Les
    capitales sont retirées avec elle — une écriture manuscrite en capitales ne
    ressemble plus à une écriture.
  */
  .room {
    position: absolute;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    color: var(--ink-soft);
    font-family: var(--font-hand);
    font-weight: 400;
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  /*
    Le nom repose sur un morceau du sol de sa propre pièce.

    Il flottait au-dessus de ce qui s'y trouvait, et tombait régulièrement sur un
    meuble — « Salon » posé sur un fauteuil, « Hall » sur une table. C'était déjà
    vrai avant, et l'épaississement des murs l'a rendu voyant.

    La teinte est celle de la pièce, jamais une couleur neutre : le nom donne
    ainsi l'impression que le mobilier a été **écarté** pour le laisser passer,
    ce qui est exactement ce que fait un plan d'architecte. Une plaque blanche,
    elle, se lirait comme un objet posé sur le plan.
  */
  .room[data-zone='0'] {
    background: var(--scene-zone-1);
  }
  .room[data-zone='1'] {
    background: var(--scene-zone-2);
  }
  .room[data-zone='2'] {
    background: var(--scene-zone-3);
  }
  .room[data-zone='3'] {
    background: var(--scene-zone-4);
  }
  .room[data-zone='4'] {
    background: var(--scene-zone-5);
  }
  .room[data-zone='5'] {
    background: var(--scene-zone-6);
  }
</style>
