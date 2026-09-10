<script lang="ts">
  import { LEVELS, SIZE } from '@sudoku/engine';
  import type { Level, Symmetry } from '@sudoku/engine';
  import { Game } from './lib/game.svelte.js';
  import SudokuBoard from './lib/SudokuBoard.svelte';
  import AnalysisPanel from './lib/AnalysisPanel.svelte';
  import { THEME_OPTIONS, theme } from './lib/theme.svelte.js';

  const game = new Game();

  const SYMMETRIES: { id: Symmetry; label: string }[] = [
    { id: 'rotational180', label: 'Rotation 180 degrés' },
    { id: 'diagonal', label: 'Diagonale' },
    { id: 'none', label: 'Aucune' },
  ];

  let level = $state<Level>('moyen');
  let symmetry = $state<Symmetry>('rotational180');
  let tab = $state<'jeu' | 'analyse'>('jeu');
  let announcement = $state('');

  const chosenLevel = $derived(LEVELS.find((l) => l.id === level) ?? LEVELS[1]!);

  const HINT_TIER_LABELS = ['Indice', 'Montrer la technique', 'Montrer le coup', 'Appliquer'];

  function remaining(digit: number): number {
    return SIZE - (game.usedDigits.get(digit) ?? 0);
  }

  async function newPuzzle(): Promise<void> {
    announcement = `Génération d’une grille de niveau ${chosenLevel.label}…`;
    await game.newPuzzle(level, symmetry);
    announcement = game.levelIsExact
      ? `Grille de niveau ${chosenLevel.label}, ${String(game.clues)} indices.`
      : `Niveau ${chosenLevel.label} non atteint dans le temps imparti.`;
  }

  function onHint(): void {
    if (game.hintTier === 3) {
      game.applyHint();
      announcement = 'Coup appliqué.';
      return;
    }
    game.requestHint();
    if (game.hintNotice !== null) announcement = game.hintNotice;
    else if (game.hint !== null) announcement = `Indice, palier ${String(game.hintTier)} sur 3.`;
  }

  $effect(() => {
    if (game.isComplete) announcement = 'Grille terminée, aucune erreur.';
  });

  void newPuzzle();
</script>

<main>
  <header>
    <div class="title">
      <h1>Sudoku</h1>
      <p class="tagline">Rien à installer. Aucune publicité, aucun compte, aucun suivi.</p>
    </div>

    <div class="theme" role="group" aria-label="Thème de l’interface">
      {#each THEME_OPTIONS as option (option.id)}
        <button
          type="button"
          class="theme-option"
          class:active={theme.preference === option.id}
          aria-pressed={theme.preference === option.id}
          title={option.label}
          onclick={() => theme.set(option.id)}
        >
          <span aria-hidden="true">{option.icon}</span>
          <span class="theme-label">{option.label}</span>
        </button>
      {/each}
    </div>
  </header>

  <nav class="tabs" role="tablist" aria-label="Sections">
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'jeu'}
      class:active={tab === 'jeu'}
      onclick={() => (tab = 'jeu')}
    >
      Jouer
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'analyse'}
      class:active={tab === 'analyse'}
      onclick={() => (tab = 'analyse')}
    >
      Analyse
    </button>
  </nav>

  {#if tab === 'jeu'}
    <div class="layout">
      <div class="board-column">
        <SudokuBoard {game} />

        <p class="status" class:done={game.isComplete}>
          {#if game.isComplete}
            Grille terminée, aucune erreur.
          {:else}
            {game.filledCount} / 81 cases remplies{game.conflicts.size > 0
              ? ` — ${String(game.conflicts.size)} en conflit`
              : ''}
          {/if}
        </p>

        {#if game.hint !== null || game.hintNotice !== null}
          <div class="hint" role="status">
            {#if game.hintNotice !== null}
              <p>{game.hintNotice}</p>
            {:else if game.hintTier === 1}
              <p>
                Cherchez du côté de la zone mise en évidence. Un raisonnement s’y applique.
              </p>
            {:else}
              <p class="hint-title">{game.hint!.label}</p>
              <p>{game.hint!.explanation}</p>
              {#if game.hintTier < 3}
                <p class="muted">
                  Les cases encadrées portent le raisonnement. À vous de conclure — ou demandez
                  le coup.
                </p>
              {/if}
            {/if}
          </div>
        {/if}
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
              <span>{digit}</span>
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
          <button type="button" class="action" disabled={!game.canUndo} onclick={() => game.undo()}>
            Annuler<kbd>Ctrl+Z</kbd>
          </button>
        </div>

        <button type="button" class="hint-button" onclick={onHint} disabled={game.isComplete}>
          {HINT_TIER_LABELS[game.hintTier]}
          {#if game.hint !== null}
            <span class="tier">{game.hintTier} / 3</span>
          {/if}
        </button>

        <fieldset class="settings">
          <legend>Nouvelle grille</legend>

          <label>
            Niveau
            <select bind:value={level}>
              {#each LEVELS as option (option.id)}
                <option value={option.id}>{option.label}</option>
              {/each}
            </select>
          </label>
          <p class="level-description">{chosenLevel.description}</p>

          <label>
            Symétrie
            <select bind:value={symmetry}>
              {#each SYMMETRIES as option (option.id)}
                <option value={option.id}>{option.label}</option>
              {/each}
            </select>
          </label>

          <button type="button" class="primary" onclick={newPuzzle} disabled={game.generating}>
            {game.generating ? 'Génération…' : 'Générer'}
          </button>
          {#if game.generating}
            <p class="muted small">
              Les niveaux élevés demandent une recherche dirigée : quelques secondes sont
              normales.
            </p>
          {/if}
        </fieldset>

        {#if game.rating !== null}
          <div class="verdict">
            <p>
              <strong>{game.level ? (LEVELS.find((l) => l.id === game.level)?.label ?? '—') : '—'}</strong>
              — exige au plus : {game.rating.hardestLabel ?? '—'}
              <span class="score">{game.rating.score.toFixed(1)}</span>
            </p>
            {#if !game.levelIsExact}
              <p class="warn">
                Le niveau demandé n’a pas été atteint dans le temps imparti. Voici la grille la
                plus proche obtenue — nous préférons le dire plutôt que de mal l’étiqueter.
              </p>
            {/if}
            <p class="muted small">
              Grille <code>{game.seed}</code> — {game.clues} indices, solution unique garantie,
              résoluble sans jamais deviner.
            </p>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <AnalysisPanel {game} />
  {/if}

  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
</main>

<style>
  main {
    max-width: 68rem;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2.5rem) 1rem 4rem;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
  }

  .theme {
    display: flex;
    gap: 0.15rem;
    padding: 0.2rem;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface-sunken);
  }

  .theme-option {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    /* Cible tactile confortable, y compris quand le libellé disparaît. */
    min-height: 2.25rem;
    padding: 0.3rem 0.6rem;
    border: none;
    border-radius: 7px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .theme-option:hover {
    color: var(--text);
  }

  /*
    L'état actif ne repose pas sur la seule couleur : le bouton reçoit un fond
    plein et un texte plus gras, lisibles même sans perception des teintes.
  */
  .theme-option.active {
    background: var(--surface);
    color: var(--text);
    font-weight: 620;
    box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
  }

  @media (max-width: 30rem) {
    .theme-label {
      position: absolute;
      overflow: hidden;
      clip-path: inset(50%);
      width: 1px;
      height: 1px;
      white-space: nowrap;
    }
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

  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .tabs button {
    padding: 0.6rem 1rem;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .tabs button.active {
    border-bottom-color: var(--accent);
    color: var(--text);
    font-weight: 600;
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
    max-width: 34rem;
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

  .hint {
    padding: 0.8rem 1rem;
    border: 1px solid var(--hint-border);
    border-radius: 10px;
    background: var(--hint-bg);
    color: var(--text);
    line-height: 1.5;
  }

  .hint p {
    margin: 0 0 0.5rem;
  }

  .hint p:last-child {
    margin-bottom: 0;
  }

  .hint-title {
    font-weight: 650;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .small {
    font-size: 0.8rem;
  }

  .controls {
    display: flex;
    flex: 1 1 17rem;
    flex-direction: column;
    gap: 1.1rem;
    min-width: 15rem;
    max-width: 22rem;
  }

  .pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .pad-key {
    position: relative;
    /* 44 px est le minimum recommandé pour une cible tactile. Beaucoup
       d'applications descendent à 30 px : on ne le fait pas. */
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

  .hint-button {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
    min-height: 2.9rem;
    border: 1px solid var(--hint-border);
    border-radius: 8px;
    background: var(--hint-bg);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .hint-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .tier {
    color: var(--text-muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
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

  .level-description {
    margin: -0.2rem 0 0.2rem;
    color: var(--text-faint);
    font-size: 0.8rem;
    line-height: 1.45;
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

  .verdict {
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-sunken);
    font-size: 0.87rem;
    line-height: 1.5;
  }

  .verdict p {
    margin: 0 0 0.45rem;
  }

  .verdict p:last-child {
    margin-bottom: 0;
  }

  .verdict .score {
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }

  .warn {
    color: var(--value-conflict);
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
  :global(input:focus-visible),
  :global(summary:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
</style>
