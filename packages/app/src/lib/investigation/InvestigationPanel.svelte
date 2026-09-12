<script lang="ts">
  import { cellsOf } from '@sudoku/engine/investigation';
  import type { Step } from '@sudoku/engine/investigation';
  import { CaseGame } from './caseGame.svelte.js';
  import SceneBoard from './SceneBoard.svelte';

  interface Props {
    /**
     * L'affaire en cours. Fournie de l'extérieur par les tests, qui n'ont pas
     * de Web Worker sous un DOM simulé — et qui doivent pouvoir éprouver
     * l'écran sur une affaire **engendrée**, jamais sur une affaire inventée.
     */
    game?: CaseGame;
  }

  const { game = new CaseGame() }: Props = $props();

  /** Le nom français de chaque technique, pour dire ce que l'aide a employé. */
  const TECHNIQUE_NAMES: Readonly<Record<string, string>> = {
    placement: 'Dernière case',
    clue: 'Lecture d’indice',
    exclusion: 'Place réservée',
    'only-taker': 'Seule personne possible',
    crossing: 'Recoupement',
    company: 'Qui était dans la pièce',
    subset: 'Groupe fermé',
  };

  const TOOLS = [
    { id: 'place', label: 'Placer', hint: 'poser la personne choisie' },
    { id: 'note', label: 'Crayon', hint: 'noter une hypothèse' },
    { id: 'cross', label: 'Barrer', hint: 'marquer une case impossible' },
  ] as const;

  function newCase(): void {
    // Une graine lisible : elle se retrouve dans un rapport de bug, là où un
    // entier de trente-deux bits ne se recopie pas à la main.
    const seed = `affaire-${String(Date.now())}`;
    void game.compose(seed);
  }

  $effect(() => {
    if (game.file === null && !game.composing && !game.failed) newCase();
  });

  // L'aide ne se calcule que quand elle est demandée : le registre déroule tout
  // le chemin, ce qui n'a pas à tourner à chaque frappe.
  const hint = $derived(game.hintTier > 0 ? game.hint : null);

  /** Les cases mises en avant par l'indice, selon le palier atteint. */
  const highlighted = $derived(shownCells(hint, game.hintTier >= 1));
  const designated = $derived(game.hintTier >= 3 ? concluded(hint) : new Set<number>());

  function shownCells(step: Step | null, show: boolean): Set<number> {
    if (step === null || !show) return new Set<number>();
    return new Set(step.highlights.flatMap((entry) => cellsOf(entry.cells)));
  }

  function concluded(step: Step | null): Set<number> {
    if (step === null) return new Set<number>();
    return new Set([
      ...step.placements.map((placement) => placement.cell),
      ...step.eliminations.flatMap((entry) => cellsOf(entry.cells)),
    ]);
  }

  /** Les indices que la validation a trouvés contredits. */
  const contradicted = $derived(
    game.verdict?.kind === 'contradicted' ? new Set(game.verdict.clues) : new Set<number>(),
  );
</script>

<section class="investigation">
  <header class="top">
    <div class="titling">
      <h2>{game.puzzle?.scene.title ?? 'Enquête'}</h2>
      {#if game.file !== null}
        <p class="brief">
          {game.suspects.length} personnes, une par rangée et une par colonne. La victime était
          seule avec le meurtrier.
        </p>
      {/if}
    </div>
    <button type="button" class="action" onclick={newCase} disabled={game.composing}>
      {game.composing ? 'Composition…' : 'Nouvelle affaire'}
    </button>
  </header>

  <p class="announce" role="status" aria-live="polite">{game.announcement}</p>

  {#if game.failed}
    <p class="warning">
      Aucune affaire n'a pu être composée avec cette graine. Réessayez : la fabrique cherche, elle
      ne triche pas.
    </p>
  {:else if game.composing && game.file === null}
    <p class="waiting">Composition de l'affaire…</p>
  {/if}

  {#if game.file !== null}
    <SceneBoard {game} highlight={highlighted} target={designated} />

    <div class="tools" role="group" aria-label="Outils">
      {#each TOOLS as tool (tool.id)}
        <button
          type="button"
          class="tool"
          class:active={game.tool === tool.id}
          aria-pressed={game.tool === tool.id}
          onclick={() => {
            game.tool = tool.id;
          }}
        >
          <span class="tool-name">{tool.label}</span>
          <span class="tool-hint">{tool.hint}</span>
        </button>
      {/each}
    </div>

    <div class="actions">
      <button type="button" class="action" onclick={() => game.undo()} disabled={!game.canUndo}>
        Annuler
      </button>
      <button type="button" class="action" onclick={() => game.revealMore()}>
        {game.hintTier === 0 ? 'Indice' : 'En dire plus'}
      </button>
      {#if game.hintTier > 0}
        <button type="button" class="action" onclick={() => game.hideHint()}>Masquer</button>
      {/if}
      <button type="button" class="action primary" onclick={() => game.check()}>Valider</button>
    </div>

    {#if game.hintTier > 0 && game.stuck}
      <div class="hint">
        <p class="hint-tier">
          Les personnes déjà posées rendent l'affaire impossible : plus aucune déduction ne mène
          quelque part. Reprenez un placement, ou validez pour savoir quel indice est contredit.
        </p>
      </div>
    {:else if hint !== null && game.hintTier > 0}
      <div class="hint">
        <p class="hint-tier">
          {#if game.hintTier === 1}
            Regardez les places encore possibles mises en avant sur le plan.
          {:else}
            <strong>{TECHNIQUE_NAMES[hint.technique] ?? hint.label}</strong> — {hint.explanation}
          {/if}
        </p>
        {#if game.hintTier === 1 && hint.clues.length > 0}
          <p class="hint-cards">
            Relisez :
            {#each hint.clues as clue, position (clue)}{position > 0 ? ' · ' : ''}«&nbsp;{game.clueText(
                clue,
              )}&nbsp;»{/each}
          </p>
        {/if}
      </div>
    {/if}

    {#if game.verdict !== null}
      <div class="verdict" class:solved={game.verdict.kind === 'solved'}>
        {#if game.verdict.kind === 'incomplete'}
          <p>
            Il reste {game.verdict.missing} personne{game.verdict.missing > 1 ? 's' : ''} à placer.
          </p>
        {:else if game.verdict.kind === 'contradicted'}
          <p>
            La disposition contredit {game.verdict.clues.length} indice{game.verdict.clues.length >
            1
              ? 's'
              : ''}, marqué{game.verdict.clues.length > 1 ? 's' : ''} ci-dessous. Rien d'autre n'est
            révélé : la carte contredite suffit à reprendre.
          </p>
        {:else}
          <p>
            <strong>Affaire résolue.</strong> Le meurtrier est
            {game.suspects[game.verdict.murderer].name} ({game.suspects[game.verdict.murderer]
              .letter}) — la seule autre personne présente dans la pièce de la victime.
          </p>
        {/if}
      </div>
    {/if}

    <h3 class="cards-title">Suspects</h3>
    <p class="cards-help">
      Choisissez une personne, puis une case du plan. Au clavier : sa lettre la choisit, les flèches
      déplacent, Entrée pose.
    </p>

    <ul class="cards">
      {#each game.suspects as person (person.index)}
        {@const cards = game.cluesOf(person.index)}
        {@const isVictim = person.index === game.file.victim}
        {@const broken = cards.some((clue) => contradicted.has(clue))}
        <li>
          <button
            type="button"
            class="card"
            class:chosen={game.suspect === person.index}
            class:victim={isVictim}
            class:broken
            aria-pressed={game.suspect === person.index}
            onclick={() => {
              game.suspect = person.index;
            }}
          >
            <span class="who">
              <span class="letter" aria-hidden="true">{person.letter}</span>
              <span class="name">{person.name}</span>
              {#if isVictim}<span class="tag">Victime</span>{/if}
              {#if broken}<span class="tag">Indice contredit</span>{/if}
              {#if game.cellOf(person.index) !== -1}<span class="tag placed">Placée</span>{/if}
            </span>
            <span class="said">
              {#each cards as clue (clue)}
                <span class="line">{game.clueText(clue)}</span>
              {/each}
            </span>
          </button>
        </li>
      {/each}
    </ul>

    <!--
      L'engagement d'honnêteté du plan, tenu à l'écran et non dans un fichier.

      Ce mode n'a **aucun oracle** : rien, dans le monde, ne sait dire qu'une
      affaire vaut 4,2. Ce qui est affiché ici est donc un **comptage** de
      choses observables — le nombre de déductions, et le nom de la plus
      difficile — et le texte dit lui-même que cet ordre est le nôtre.
    -->
    <section class="measured" aria-labelledby="mesure">
      <h3 id="mesure">Ce qui est mesuré</h3>
      <dl>
        <div>
          <dt>Déductions sur le chemin</dt>
          <dd>{game.file.stepCount}</dd>
        </div>
        <div>
          <dt>Technique la plus difficile exigée</dt>
          <dd>{TECHNIQUE_NAMES[game.file.hardest] ?? game.file.hardest}</dd>
        </div>
      </dl>
      <p class="caveat">
        Ces deux nombres sont des comptages, pas des notes. Contrairement à la difficulté du
        sudoku, ils ne sont calibrés contre <em>rien</em> : aucun outil de référence ne sait noter
        ce type d'affaire. L'ordre des techniques est celui de notre registre, version
        {game.file.registryVersion}. Ce qui est garanti, en revanche : l'affaire n'admet qu'une
        solution, et le registre sait la trouver sans jamais essayer une case au hasard.
      </p>
    </section>
  {/if}
</section>

<style>
  .investigation {
    display: grid;
    gap: var(--space-4);
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2 {
    margin: 0;
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
  }

  .brief {
    max-width: var(--measure);
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .announce {
    margin: 0;
    min-height: 1.4em;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .warning,
  .waiting {
    max-width: var(--measure);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .tools,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  /*
    La grammaire du genre, appliquée à tout ce qui se presse : trait d'encre,
    et **ombre décalée sans flou**. À l'appui, le bouton se déplace de la valeur
    de son ombre et la perd — il s'enfonce pour de bon. C'est un retour tactile
    réel, pas une décoration : sur tactile, `:active` est le seul état qui
    existe.
  */
  .tool,
  .action {
    min-height: var(--tap);
    padding: var(--space-2) var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    box-shadow: var(--shadow-hard);
  }

  .tool {
    display: grid;
    gap: 0;
    text-align: left;
  }

  .tool-name {
    font-weight: 600;
  }

  .tool-hint {
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  /*
    L'outil actif se dit par un liseré épais **et** par `aria-pressed`, jamais
    par la seule couleur — même règle que le mode notes du sudoku.
  */
  /*
    L'état choisi **ajoute** un liseré, il ne remplace pas l'ombre.

    Écrit d'abord comme un seul `box-shadow`, il effaçait le relief : la carte
    sélectionnée était la seule à plat, c'est-à-dire l'inverse de ce qu'elle
    devait dire.
  */
  .tool.active {
    border-color: var(--accent);
    box-shadow:
      inset 0 0 0 2px var(--accent),
      var(--shadow-hard);
  }

  .action.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  @media (hover: hover) {
    .tool:hover,
    .action:hover:not(:disabled) {
      background: var(--surface-hover);
    }

    .action.primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }
  }

  .tool:active,
  .action:active:not(:disabled) {
    background: var(--surface-pressed);
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .action.primary:active:not(:disabled) {
    background: var(--accent-active);
  }

  .action:disabled {
    box-shadow: none;
  }

  .hint,
  .verdict {
    max-width: var(--measure);
    padding: var(--space-3);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--hint-bg);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
    box-shadow: var(--shadow-hard);
  }

  .verdict.solved {
    background: var(--hint-target-bg);
  }

  .hint p,
  .verdict p {
    margin: 0;
  }

  .hint-cards {
    margin-top: var(--space-2);
    color: var(--text-muted);
  }

  .cards-title,
  .measured h3 {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--leading-tight);
  }

  .cards-help {
    max-width: var(--measure);
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Une carte de suspect : une fiche cartonnée, cerclée et posée en relief. */
  .card {
    display: grid;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--tap);
    padding: var(--space-3);
    border: 2px solid var(--ink);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-shadow: var(--shadow-hard);
  }

  .card.chosen {
    border-color: var(--accent);
    box-shadow:
      inset 0 0 0 2px var(--accent),
      var(--shadow-hard);
  }

  /* La victime et la carte contredite portent une étiquette, pas une teinte. */
  .card.victim {
    background: var(--surface-sunken);
  }

  .card.broken {
    border-color: var(--hint-border);
    box-shadow:
      inset 0 0 0 2px var(--hint-border),
      var(--shadow-hard);
  }

  @media (hover: hover) {
    .card:hover {
      background: var(--surface-hover);
    }
  }

  .card:active {
    background: var(--surface-pressed);
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  /* La même pastille que sur le plan : c'est ce qui relie une carte à un jeton. */
  .letter {
    display: grid;
    place-items: center;
    width: var(--space-6);
    height: var(--space-6);
    border: 2px solid var(--ink);
    border-radius: var(--radius-pill);
    background: var(--scene-token);
    color: var(--scene-token-ink);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  /*
    Le nom, **écrit à la main**. C'est ce qui fait qu'une carte ressemble à une
    fiche de dossier plutôt qu'à une ligne de formulaire — et c'est la seule
    raison pour laquelle ce produit embarque une fonte.
  */
  .name {
    font-family: var(--font-hand);
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
  }

  .tag {
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    color: var(--text-muted);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .tag.placed {
    border-color: var(--accent);
    color: var(--accent);
  }

  .said {
    display: grid;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .measured {
    max-width: var(--measure);
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    box-shadow: var(--shadow-hard);
  }

  .measured dl {
    display: grid;
    gap: var(--space-2);
    margin: 0;
  }

  .measured dl div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .measured dt {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .measured dd {
    margin: 0;
    font-weight: 600;
  }

  .caveat {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-xs);
    line-height: var(--leading-prose);
  }
</style>
