<script lang="ts">
  import { LEVELS, encodeGrid, gridLabel, levelInfo } from '@sudoku/engine';
  import type { Level } from '@sudoku/engine';
  import { engine } from '../lib/engineClient.js';
  import PrintSheet from './PrintSheet.svelte';
  import { paginate } from './layout.js';
  import type { PrintablePuzzle } from './layout.js';
  import { PAPER_SIZES, PRINT_FORMATS, formatById, paperById } from './presets.js';
  import type { PaperSizeId, PrintFormatId } from './presets.js';
  import './print.css';

  let title = $state('Cahier de sudoku');
  let level = $state<Level>('moyen');
  let count = $state(6);
  let formatId = $state<PrintFormatId>('standard');
  let paperId = $state<PaperSizeId>('a4');
  let includeSolutions = $state(true);

  let puzzles = $state<PrintablePuzzle[]>([]);
  let generating = $state(false);
  let produced = $state(0);
  let notice = $state('');

  const format = $derived(formatById(formatId));
  const paper = $derived(paperById(paperId));
  const booklet = $derived(paginate(puzzles, format, { title, includeSolutions }));

  /** Base des liens de reprise : l'adresse de l'application, sans fragment. */
  const baseUrl = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  });

  /**
   * Produit le cahier, une grille après l'autre.
   *
   * Les requêtes sont enchaînées plutôt que lancées en parallèle : le moteur
   * tourne dans un unique Web Worker qui les traiterait de toute façon à la
   * suite, et cet enchaînement donne une progression réelle — non une barre qui
   * saute de zéro à cent. À plusieurs secondes par grille aux niveaux élevés,
   * sans ce retour l'utilisateur conclurait à un blocage.
   */
  async function generate(): Promise<void> {
    generating = true;
    produced = 0;
    notice = '';
    const collected: PrintablePuzzle[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const result = await engine.generateAtLevel({ level, symmetry: 'rotational180' });
        produced = i + 1;
        if (result === null) continue;

        const grid = Uint8Array.from(result.puzzle);
        collected.push({
          index: collected.length + 1,
          puzzle: [...result.puzzle],
          solution: [...result.solution],
          level: result.rating.level ?? level,
          levelLabel: levelInfo(result.rating.level ?? level).label,
          score: result.rating.score,
          label: gridLabel(grid),
          code: encodeGrid(grid),
        });
      }

      puzzles = collected;
      const asked = LEVELS.find((l) => l.id === level)?.label ?? level;
      const offLevel = collected.filter((p) => p.level !== level).length;
      notice =
        offLevel === 0
          ? `${String(collected.length)} grilles de niveau ${asked}.`
          : `${String(collected.length)} grilles, dont ${String(offLevel)} n’ont pas atteint le niveau ${asked} dans le temps imparti.`;
    } finally {
      generating = false;
    }
  }

  const print = (): void => {
    window.print();
  };
</script>

<svelte:head>
  <!--
    `@page` n'accepte pas de variable CSS pour sa taille : la règle doit être
    écrite en dur, donc réécrite quand le format de papier change.
  -->
  {@html `<style>@page { size: ${paper.css}; margin: 0; }</style>`}
</svelte:head>

<div class="studio">
  <aside class="settings">
    <h2>Cahier à imprimer</h2>

    <label>
      Titre
      <input type="text" bind:value={title} maxlength="60" />
    </label>

    <label>
      Niveau
      <select bind:value={level}>
        {#each LEVELS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label>
      Nombre de grilles
      <input type="number" bind:value={count} min="1" max="60" />
    </label>

    <label>
      Format
      <select bind:value={formatId}>
        {#each PRINT_FORMATS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>
    <p class="hint">{format.description}</p>

    <label>
      Papier
      <select bind:value={paperId}>
        {#each PAPER_SIZES as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label class="checkbox">
      <input type="checkbox" bind:checked={includeSolutions} />
      Joindre les corrigés
    </label>
    <p class="hint">
      Placés à la fin, sur des pages séparées : le cahier s’imprime d’un bloc et les corrigés se
      détachent avant distribution.
    </p>

    <button type="button" class="primary" onclick={generate} disabled={generating}>
      {generating ? `Génération… ${String(produced)} / ${String(count)}` : 'Générer le cahier'}
    </button>

    {#if generating}
      <progress max={count} value={produced}></progress>
      <p class="hint">
        Les niveaux élevés demandent une recherche dirigée : quelques secondes par grille sont
        normales.
      </p>
    {/if}

    {#if notice !== ''}
      <p class="notice" role="status">{notice}</p>
    {/if}

    {#if puzzles.length > 0}
      <button type="button" class="secondary" onclick={print}>
        Imprimer · {booklet.sheets.length} pages
      </button>
      <p class="hint">
        Choisissez « Enregistrer en PDF » dans la boîte de dialogue pour obtenir un fichier.
        Vérifiez que les marges sont réglées sur « aucune » — la mise en page les gère déjà.
      </p>
    {/if}
  </aside>

  <div class="preview">
    {#if puzzles.length === 0}
      <p class="empty">
        Réglez le cahier puis lancez la génération : l’aperçu des pages s’affichera ici, tel qu’il
        sortira de l’imprimante.
      </p>
    {:else}
      <div
        class="sheets"
        style={`--sheet-width: ${String(paper.widthMm)}mm; --sheet-height: ${String(paper.heightMm)}mm;`}
      >
        {#each booklet.sheets as sheet (sheet.pageNumber)}
          <PrintSheet {sheet} {format} {booklet} {baseUrl} />
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .studio {
    display: grid;
    grid-template-columns: 18rem minmax(0, 1fr);
    gap: 2rem;
    align-items: start;
  }

  @media (max-width: 48rem) {
    .studio {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
    }
  }

  .settings {
    display: flex;
    flex: 0 0 18rem;
    flex-direction: column;
    gap: 0.7rem;
    max-width: 20rem;
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  label.checkbox {
    flex-direction: row;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
  }

  input[type='text'],
  input[type='number'],
  select {
    min-height: 2.75rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  .hint {
    margin: -0.2rem 0 0.2rem;
    color: var(--text-faint);
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .notice {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 7px;
    background: var(--surface-sunken);
    font-size: 0.82rem;
  }

  .primary,
  .secondary {
    min-height: 2.75rem;
    border: none;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    background: var(--accent);
    color: var(--accent-text);
  }

  .secondary {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }

  .primary:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  progress {
    width: 100%;
    height: 0.5rem;
  }

  .preview {
    flex: 1 1 22rem;
    min-width: 0;
  }

  .empty {
    max-width: 30rem;
    color: var(--text-muted);
    line-height: 1.55;
  }

  /*
    L'aperçu montre les feuilles telles qu'elles sortiront : fond sombre autour,
    papier blanc, ombre portée. Voir la page flotter évite la mauvaise surprise
    au moment d'imprimer.
  */
  .sheets {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
    padding: 1.5rem;
    border-radius: 10px;
    background: var(--surface-sunken);
    overflow-x: auto;
  }

  .sheets :global(.sheet) {
    flex: none;
    box-shadow: 0 2px 12px rgb(0 0 0 / 22%);
  }
</style>
