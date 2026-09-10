<script lang="ts">
  import { SIZE } from '@sudoku/engine';
  import type { Symmetry } from '@sudoku/engine';
  import { Game } from './lib/game.svelte.js';
  import SudokuBoard from './lib/SudokuBoard.svelte';

  const game = new Game();

  /**
   * Reglages de creusement — volontairement nommes par la QUANTITE d'indices,
   * pas par une difficulte.
   *
   * Le nombre d'indices est un tres mauvais predicteur de la difficulte reelle
   * (correlation d'environ 0,27 avec la difficulte percue par des joueurs
   * humains). Annoncer « Facile / Moyen / Difficile » a partir de ce seul
   * critere, comme le fait l'essentiel du marche, revient a mentir au joueur.
   * Les vrais niveaux arriveront avec le solveur logique, qui mesure les
   * techniques reellement necessaires.
   */
  const DENSITIES = [
    { id: 'dense', label: 'Beaucoup d indices', minClues: 45 },
    { id: 'moyenne', label: 'Densite moyenne', minClues: 34 },
    { id: 'creusee', label: 'Peu d indices', minClues: 26 },
    { id: 'maximale', label: 'Creusement maximal', minClues: 17 },
  ] as const;

  const SYMMETRIES: { id: Symmetry; label: string }[] = [
    { id: 'rotational180', label: 'Rotation 180 degres' },
    { id: 'diagonal', label: 'Diagonale' },
    { id: 'none', label: 'Aucune' },
  ];

  let densityId = $state<(typeof DENSITIES)[number]['id']>('moyenne');
  let symmetry = $state<Symmetry>('rotational180');
  let generating = $state(false);
  let announcement = $state('');

  const density = $derived(DENSITIES.find((d) => d.id === densityId) ?? DENSITIES[1]);

  /** Nombre de fois qu'un chiffre est encore a placer. */
  function remaining(digit: number): number {
    return SIZE - (game.usedDigits.get(digit) ?? 0);
  }

  function newPuzzle(): void {
    generating = true;
    // La generation prend une quinzaine de millisecondes : on laisse le
    // navigateur peindre l'etat « en cours » avant de bloquer le fil principal.
    // Quand le solveur logique entrera dans la boucle, ce travail partira dans
    // un Web Worker — l'interface n'aura pas a changer.
    requestAnimationFrame(() => {
      game.newPuzzle({ symmetry, minClues: density.minClues });
      generating = false;
      announcement = `Nouvelle grille, ${String(game.clues)} indices.`;
    });
  }

  $effect(() => {
    if (game.isComplete) announcement = 'Grille terminee, aucune erreur.';
  });

  newPuzzle();
</script>

<main>
  <header>
    <h1>Sudoku</h1>
    <p class="tagline">Rien a installer. Aucune publicite, aucun compte, aucun suivi.</p>
  </header>

  <div class="layout">
    <div class="board-column">
      <SudokuBoard {game} />

      <p class="status" class:done={game.isComplete}>
        {#if game.isComplete}
          Grille terminee, aucune erreur.
        {:else}
          {game.filledCount} / 81 cases remplies{game.conflicts.size > 0
            ? ` — ${String(game.conflicts.size)} en conflit`
            : ''}
        {/if}
      </p>
    </div>

    <div class="controls">
      <div class="pad" role="group" aria-label="Saisie des chiffres">
        {#each { length: SIZE } as _, i (i)}
          {@const digit = i + 1}
          <button
            type="button"
            class="pad-key"
            class:exhausted={remaining(digit) === 0}
            onclick={() => game.enter(digit)}
            aria-label={`Placer le ${String(digit)}, ${String(remaining(digit))} restants`}
          >
            <span class="pad-digit">{digit}</span>
            <span class="pad-count" aria-hidden="true">{remaining(digit)}</span>
          </button>
        {/each}
      </div>

      <div class="actions" role="group" aria-label="Actions">
        <button
          type="button"
          class="action"
          class:active={game.noteMode}
          aria-pressed={game.noteMode}
          onclick={() => game.toggleNoteMode()}
        >
          Notes<kbd>N</kbd>
        </button>
        <button type="button" class="action" onclick={() => game.clear()}>
          Effacer<kbd>Suppr</kbd>
        </button>
        <button
          type="button"
          class="action"
          disabled={!game.canUndo}
          onclick={() => game.undo()}
        >
          Annuler<kbd>Ctrl+Z</kbd>
        </button>
      </div>

      <fieldset class="settings">
        <legend>Nouvelle grille</legend>

        <label>
          Quantite d indices
          <select bind:value={densityId}>
            {#each DENSITIES as option (option.id)}
              <option value={option.id}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label>
          Symetrie
          <select bind:value={symmetry}>
            {#each SYMMETRIES as option (option.id)}
              <option value={option.id}>{option.label}</option>
            {/each}
          </select>
        </label>

        <button type="button" class="primary" onclick={newPuzzle} disabled={generating}>
          {generating ? 'Generation...' : 'Generer'}
        </button>
      </fieldset>

      <details class="honesty">
        <summary>Pourquoi aucun niveau « facile / difficile » ici ?</summary>
        <p>
          Parce qu'il serait faux. Presque toutes les applications deduisent la difficulte du
          nombre de cases remplies au depart, alors que ce nombre ne predit quasiment pas
          l'effort reel : la correlation mesuree avec la difficulte ressentie par des joueurs
          humains est d'environ 0,27. Une grille a 17 indices peut etre facile, une grille bien
          remplie peut etre redoutable.
        </p>
        <p>
          Les niveaux annonces ici seront calcules a partir des techniques de raisonnement
          reellement necessaires pour resoudre la grille — et calibres contre la reference du
          domaine. En attendant, ce reglage dit seulement ce qu'il fait : combien de cases sont
          laissees vides.
        </p>
      </details>

      <p class="meta">
        Grille <code>{game.seed}</code> — {game.clues} indices, solution unique garantie.
      </p>
    </div>
  </div>

  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</main>

<style>
  main {
    max-width: 62rem;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2.5rem) 1rem 4rem;
  }

  header {
    margin-bottom: 1.75rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    letter-spacing: -0.02em;
  }

  .tagline {
    margin: 0.35rem 0 0;
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(1.25rem, 4vw, 2.5rem);
    align-items: flex-start;
  }

  .board-column {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .status {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .status.done {
    color: var(--success);
    font-weight: 600;
  }

  .controls {
    display: flex;
    flex: 1 1 17rem;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 15rem;
  }

  .pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .pad-key {
    position: relative;
    /* 44 px est le minimum recommande pour une cible tactile. Beaucoup
       d'applications descendent a 30 px : on ne le fait pas. */
    min-height: 3.25rem;
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .pad-key:hover {
    background: var(--surface-hover);
  }

  .pad-key.exhausted {
    color: var(--text-faint);
    background: var(--surface-sunken);
  }

  .pad-count {
    position: absolute;
    top: 0.25rem;
    right: 0.4rem;
    color: var(--text-faint);
    font-size: 0.7rem;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .action {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    align-items: center;
    min-height: 3rem;
    padding: 0.5rem 0.3rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .action:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .action:disabled {
    color: var(--text-faint);
    cursor: not-allowed;
  }

  .action.active {
    border-color: var(--note-accent);
    background: var(--note-accent-soft);
  }

  kbd {
    color: var(--text-faint);
    font-family: inherit;
    font-size: 0.68rem;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    margin: 0;
    padding: 0.9rem 1rem 1.1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  legend {
    padding: 0 0.35rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  select {
    min-height: 2.5rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  .primary {
    min-height: 2.75rem;
    margin-top: 0.2rem;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .honesty {
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-sunken);
    font-size: 0.85rem;
  }

  .honesty summary {
    cursor: pointer;
    font-weight: 600;
  }

  .honesty p {
    margin: 0.7rem 0 0;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .meta {
    margin: 0;
    color: var(--text-faint);
    font-size: 0.8rem;
  }

  code {
    font-size: 0.95em;
  }

  .sr-only {
    position: absolute;
    overflow: hidden;
    clip-path: inset(50%);
    width: 1px;
    height: 1px;
    white-space: nowrap;
  }

  :global(button:focus-visible),
  :global(select:focus-visible),
  :global(summary:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
