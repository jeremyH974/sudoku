<script lang="ts">
  import Icon from './Icon.svelte';
  import { conclusionKey, waysForward } from '@sudoku/engine';
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

  /**
   * Les autres coups jouables à cette étape.
   *
   * Deux commentaires du moteur affirmaient depuis l'incrément 2 que « le banc
   * d'analyse s'en sert pour montrer les alternatives ». Ce n'était pas vrai :
   * `findAll` n'était appelé que par les variantes « Direct ». Ça l'est
   * maintenant.
   *
   * Calculé pour la **seule image affichée** — une trentaine de millisecondes
   * pour tout le chemin, contre une pour une étape.
   */
  const alternatives = $derived.by(() => {
    if (current === undefined || current.step === null) return [];
    return waysForward({ values: current.values, candidates: current.candidates }) ?? [];
  });

  /**
   * L'issue qui a été jouée, reconnue à **ce qu'elle change**.
   *
   * La même identité que celle qui sert à dédupliquer, et pas une approximation :
   * une clé fondée sur la technique et le nombre de conclusions marquait quatre
   * singles cachés comme joués là où un seul l'avait été.
   */
  const playedKey = $derived(step === null ? '' : conclusionKey(step));

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
        <!--
          Des boutons à icône, donc nommés : le glyphe qu'ils affichaient leur
          tenait lieu de nom, et une icône masquée les laisserait muets.
        -->
        <button
          type="button"
          onclick={() => (index = 0)}
          disabled={index === 0}
          aria-label="Première étape"><Icon name="first" /></button
        >
        <button type="button" onclick={() => go(-1)} disabled={index === 0}>Précédent</button>
        <!--
          Pas de `aria-live` ici. Balayer soixante étapes au curseur déclencherait
          soixante annonces, qui se bousculeraient sans qu'aucune soit lue en
          entier — une région bavarde dessert davantage qu'un compteur muet. Le
          détail de l'étape, lui, est annoncé une fois, plus bas.
        -->
        <span class="counter">
          Étape {Math.min(index + 1, frames.length)} sur {frames.length}
        </span>
        <button type="button" onclick={() => go(1)} disabled={index >= frames.length - 1}>
          Suivant
        </button>
        <button
          type="button"
          onclick={() => (index = frames.length - 1)}
          disabled={index >= frames.length - 1}
          aria-label="Dernière étape"><Icon name="last" /></button
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
        <h2>Grille résolue</h2>
        <p>
          Le raisonnement a suffi du début à la fin : aucune supposition n’a été nécessaire.
        </p>
      {:else}
        <h2>
          {step.label}
          <span class="score" title="Difficulté sur l’échelle Sudoku Explainer">
            {step.difficulty.toFixed(1)}
          </span>
        </h2>
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

      {#if step !== null}
        <div class="alternatives">
          <h3>
            {alternatives.length > 1
              ? `${alternatives.length} coups différents étaient jouables ici`
              : 'C’était le seul coup jouable ici'}
          </h3>
          <ul>
            {#each alternatives as way (way.step.technique + way.step.explanation)}
              {@const played = conclusionKey(way.step) === playedKey}
              <li class:played>
                <span class="badge">{way.step.difficulty.toFixed(1)}</span>
                {way.step.label}
                <!-- « jouée » en toutes lettres : la mise en gras seule ne dirait rien. -->
                {#if played}<span class="tag">jouée</span>{/if}
              </li>
            {/each}
          </ul>
          <p class="muted">
            Ce chemin est celui du solveur, qui joue toujours la déduction la moins chère. Le
            vôtre sera différent, et ce n’est pas un défaut.
          </p>
        </div>
      {/if}

      <div class="legend" aria-hidden="true">
        <span><i class="swatch zone"></i> zone concernée</span>
        <span><i class="swatch marked"></i> motif du raisonnement</span>
        <span><i class="swatch target"></i> conclusion</span>
      </div>

      <h3>Techniques employées</h3>
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
    max-width: var(--measure);
    color: var(--text-muted);
    line-height: var(--leading-prose);
  }

  .empty .muted {
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .analysis {
    display: grid;
    grid-template-columns: minmax(0, 27rem) minmax(17rem, 1fr);
    gap: var(--space-6);
    align-items: start;
  }

  @media (max-width: 48rem) {
    .analysis {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
    }
  }

  .viewer {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--space-3);
  }

  .transport {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .transport button {
    min-height: var(--tap);
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  /* Désactivé : la teinte baisse ; `not-allowed` est hostile, et n'existe pas au doigt. */
  .transport button:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .transport button:active:not(:disabled) {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  /*
    Le survol n'existe qu'avec un pointeur qui survole : sans cette garde, un
    navigateur mobile l'émule au toucher et le laisse collé.
  */
  @media (hover: hover) and (pointer: fine) {
    .transport button:hover:not(:disabled) {
      background: var(--surface-hover);
    }
  }

  .counter {
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  /*
    Un curseur natif fait une vingtaine de pixels de haut : impossible à saisir
    au doigt. La hauteur est portée à 44 px sur la zone sensible ; la barre, elle,
    reste fine — c'est le curseur qu'on vise, pas le trait.
  */
  input[type='range'] {
    width: 100%;
    min-height: var(--tap);
    accent-color: var(--accent);
  }

  .details {
    flex: 1 1 20rem;
    min-width: 17rem;
  }

  h2 {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin: 0 0 var(--space-2);
    font-size: var(--text-md);
  }

  .score {
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-pill);
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .explanation {
    margin: 0 0 0.9rem;
    line-height: var(--leading-prose);
  }

  .conclusion {
    margin: 0 0 1.2rem;
    padding: 0;
    list-style: none;
  }

  .conclusion li {
    padding: 0.35rem 0.6rem;
    border-left: 3px solid var(--border);
    font-size: var(--text-sm);
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
    font-size: var(--text-sm);
  }

  .swatch {
    display: inline-block;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: var(--radius-sm);
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

  /*
    Un sous-titre à 0,9 rem au-dessus d'une explication à 1 rem : le titre
    était plus petit que son propre texte. Il prend la taille courante, et se
    distingue par sa graisse.
  */
  h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-base);
  }

  .alternatives {
    margin: var(--space-4) 0;
  }

  .alternatives ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0.4rem 0 0.6rem;
    padding: 0;
    list-style: none;
    font-size: var(--text-sm);
  }

  .alternatives li.played {
    font-weight: 600;
  }

  .tag {
    padding: 0.05rem 0.4rem;
    border-radius: var(--radius-pill);
    background: var(--accent-soft);
    color: var(--text);
    font-size: var(--text-xs);
  }

  .breakdown {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .breakdown li {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--border);
    font-size: var(--text-sm);
  }

  .badge {
    min-width: 2.2rem;
    padding: 0.08rem 0.35rem;
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .count {
    margin-left: auto;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>
