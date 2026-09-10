<script lang="ts">
  import { replayPath } from '@sudoku/engine';
  import type { Game } from './game.svelte.js';
  import SudokuBoard from './SudokuBoard.svelte';

  const { game }: { game: Game } = $props();

  let index = $state(0);

  /**
   * Le chemin est rejoué à la demande plutôt que conservé : quatre-vingts
   * instantanés par grille coûteraient cher en mémoire pour un panneau qu'on
   * n'ouvre pas à chaque partie.
   */
  const frames = $derived.by(() => {
    const rating = game.rating;
    if (rating === null || rating.steps.length === 0) return [];
    return replayPath(Uint8Array.from(game.puzzle), rating.steps);
  });

  const current = $derived(frames[Math.min(index, Math.max(0, frames.length - 1))]);
  const step = $derived(current?.step ?? null);

  const markedCells = $derived(new Set(step?.highlights.map((h) => h.cell) ?? []));
  const targetCells = $derived(
    new Set([
      ...(step?.placements.map((p) => p.cell) ?? []),
      ...(step?.eliminations.map((e) => e.cell) ?? []),
    ]),
  );

  /** Décompte par technique, du plus fréquent au plus rare. */
  const breakdown = $derived.by(() => {
    const rating = game.rating;
    if (rating === null) return [];
    const labels = new Map<string, { label: string; difficulty: number; count: number }>();
    for (const s of rating.steps) {
      const existing = labels.get(s.technique);
      if (existing) existing.count++;
      else labels.set(s.technique, { label: s.label, difficulty: s.difficulty, count: 1 });
    }
    return [...labels.values()].sort((a, b) => b.difficulty - a.difficulty);
  });

  $effect(() => {
    // Repartir du début quand la grille change.
    void game.seed;
    index = 0;
  });

  const go = (delta: number): void => {
    index = Math.max(0, Math.min(frames.length - 1, index + delta));
  };
</script>

{#if game.rating === null}
  <p class="empty">Générez une grille pour voir son analyse.</p>
{:else if frames.length === 0}
  <div class="empty">
    <p>
      Cette grille n’a pas pu être résolue par le raisonnement seul : elle exige des techniques
      qui ne sont pas encore implémentées, comme les chaînes.
    </p>
    <p class="muted">
      C’est pourquoi elle ne reçoit aucun niveau. Annoncer une difficulté qu’on n’a pas mesurée
      serait précisément le défaut que ce projet cherche à corriger.
    </p>
  </div>
{:else}
  <div class="analysis">
    <div class="viewer">
      <SudokuBoard
        {game}
        interactive={false}
        overrideValues={current ? [...current.values] : null}
        overrideCandidates={current ? [...current.candidates] : null}
        highlightUnits={step?.units ?? []}
        highlightCells={markedCells}
        targetCells={targetCells}
      />

      <div class="transport" role="group" aria-label="Navigation dans le chemin de résolution">
        <button type="button" onclick={() => (index = 0)} disabled={index === 0}>⏮</button>
        <button type="button" onclick={() => go(-1)} disabled={index === 0}>Précédent</button>
        <span class="counter" aria-live="polite">
          Étape {Math.min(index + 1, frames.length)} sur {frames.length}
        </span>
        <button type="button" onclick={() => go(1)} disabled={index >= frames.length - 1}>
          Suivant
        </button>
        <button
          type="button"
          onclick={() => (index = frames.length - 1)}
          disabled={index >= frames.length - 1}>⏭</button
        >
      </div>

      <input
        type="range"
        min="0"
        max={Math.max(0, frames.length - 1)}
        bind:value={index}
        aria-label="Position dans le chemin de résolution"
      />
    </div>

    <div class="details">
      {#if step === null}
        <h3>Grille résolue</h3>
        <p>
          Le raisonnement a suffi du début à la fin : aucune supposition n’a été nécessaire.
        </p>
      {:else}
        <h3>
          {step.label}
          <span class="score" title="Difficulté sur l’échelle Sudoku Explainer">
            {step.difficulty.toFixed(1)}
          </span>
        </h3>
        <p class="explanation">{step.explanation}</p>

        <ul class="conclusion">
          {#each step.placements as placement (placement.cell)}
            <li class="place">
              Pose le <strong>{placement.digit}</strong> en r{Math.floor(placement.cell / 9) + 1}c{(placement.cell %
                9) +
                1}
            </li>
          {/each}
          {#if step.eliminations.length > 0}
            <li class="eliminate">
              Écarte {step.eliminations.length}
              {step.eliminations.length === 1 ? 'candidat' : 'candidats'}
            </li>
          {/if}
        </ul>
      {/if}

      <div class="legend" aria-hidden="true">
        <span><i class="swatch zone"></i> zone concernée</span>
        <span><i class="swatch marked"></i> motif du raisonnement</span>
        <span><i class="swatch target"></i> conclusion</span>
      </div>

      <h4>Techniques employées</h4>
      <ul class="breakdown">
        {#each breakdown as entry (entry.label)}
          <li>
            <span class="badge">{entry.difficulty.toFixed(1)}</span>
            {entry.label}
            <span class="count">×{entry.count}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .empty {
    max-width: 42rem;
    color: var(--text-muted);
    line-height: 1.55;
  }

  .empty .muted {
    color: var(--text-faint);
    font-size: 0.9rem;
  }

  .analysis {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(1.25rem, 4vw, 2.5rem);
    align-items: flex-start;
  }

  .viewer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .transport {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .transport button {
    min-height: 2.5rem;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .transport button:hover:not(:disabled) {
    background: var(--surface-hover);
  }

  .transport button:disabled {
    color: var(--text-faint);
    cursor: not-allowed;
  }

  .counter {
    color: var(--text-muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }

  .details {
    flex: 1 1 20rem;
    min-width: 17rem;
  }

  h3 {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
  }

  .score {
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .explanation {
    margin: 0 0 0.9rem;
    line-height: 1.55;
  }

  .conclusion {
    margin: 0 0 1.2rem;
    padding: 0;
    list-style: none;
  }

  .conclusion li {
    padding: 0.35rem 0.6rem;
    border-left: 3px solid var(--border);
    font-size: 0.9rem;
  }

  .conclusion .place {
    border-left-color: var(--hint-target-border);
  }

  .conclusion .eliminate {
    border-left-color: var(--hint-border);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    margin-bottom: 1.2rem;
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .swatch {
    display: inline-block;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 3px;
    vertical-align: -1px;
  }

  .swatch.zone {
    background: var(--zone-bg);
    border: 1px solid var(--border);
  }

  .swatch.marked {
    background: var(--hint-bg);
    border: 2px solid var(--hint-border);
  }

  .swatch.target {
    background: var(--hint-target-bg);
    border: 2px solid var(--hint-target-border);
  }

  h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
  }

  .breakdown {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .breakdown li {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.88rem;
  }

  .badge {
    min-width: 2.2rem;
    padding: 0.08rem 0.35rem;
    border-radius: 4px;
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .count {
    margin-left: auto;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>
