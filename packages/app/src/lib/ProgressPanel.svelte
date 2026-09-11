<script lang="ts">
  import { LEVELS } from '@sudoku/engine';
  import type { Level } from '@sudoku/engine';
  import { daysInMonth, localDayKey, nextDay, previousDay, startOfMonth, weekdayOf } from './day.js';
  import type { DayKey } from './day.js';
  import { completedDays, currentStreak, longestStreak, summarise, totals } from './progress.js';
  import type { GameRecord } from './stats.js';
  import type { DailyCorpus } from './daily.js';
  import { corpusRange, hasDaily } from './daily.js';

  interface Props {
    records: readonly GameRecord[];
    corpus: DailyCorpus | null;
    today: DayKey;
    onPlayDaily: (day: DayKey, level: Level) => void;
  }

  const { records, corpus, today, onPlayDaily }: Props = $props();

  let month = $state<DayKey>(startOfMonth(localDayKey()));
  let dailyLevel = $state<Level>('moyen');

  const done = $derived(completedDays(records));
  const streak = $derived(currentStreak(records, today));
  const best = $derived(longestStreak(records));
  const overall = $derived(totals(records));
  const byLevel = $derived(summarise(records));
  const range = $derived(corpus === null ? null : corpusRange(corpus));

  /** Les cases du calendrier : des vides pour aligner le 1ᵉʳ sur son jour. */
  const grid = $derived.by(() => {
    const first = startOfMonth(month);
    const cells: (DayKey | null)[] = Array.from({ length: weekdayOf(first) }, () => null);
    let cursor = first;
    for (let i = 0; i < daysInMonth(first); i++) {
      cells.push(cursor);
      cursor = nextDay(cursor);
    }
    return cells;
  });

  const monthLabel = $derived(
    new Date(`${month}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  );

  function shiftMonth(delta: number): void {
    const first = startOfMonth(month);
    month = startOfMonth(delta < 0 ? previousDay(first) : nextDay(`${first.slice(0, 8)}${String(daysInMonth(first))}`));
  }

  /** « 8 min 12 s », « 1 h 04 min ». Jamais un nombre brut de millisecondes. */
  function formatDuration(ms: number): string {
    const total = Math.round(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) return `${String(hours)} h ${String(minutes).padStart(2, '0')} min`;
    if (minutes > 0) return `${String(minutes)} min ${String(seconds).padStart(2, '0')} s`;
    return `${String(seconds)} s`;
  }

  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const fullDayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

  function describe(day: DayKey): string {
    const number = Number(day.slice(8));
    const name = fullDayNames[weekdayOf(day)];
    if (done.has(day)) return `${name} ${String(number)}, défi résolu`;
    if (corpus !== null && hasDaily(corpus, day)) return `${name} ${String(number)}, défi à faire`;
    return `${name} ${String(number)}, aucun défi`;
  }

  function playable(day: DayKey): boolean {
    return corpus !== null && hasDaily(corpus, day) && day <= today;
  }
</script>

<section class="progress">
  {#if overall.played === 0}
    <!--
      Aucune partie : pas de tableau de bord de zéros. Ces compteurs sont
      honnêtes — un chiffre qu'on n'a pas ne s'invente pas —, mais présentés
      comme un tableau rempli de vide, trois « 0 » et un tiret étaient la première
      chose que voyait quelqu'un qui arrivait par le lien. On dit plutôt ce qui
      les remplira.
    -->
    <p class="intro">
      Vos statistiques apparaîtront ici dès votre première grille terminée : les jours
      résolus d’affilée, les parties, celles menées sans indice, et le niveau le plus haut
      atteint. Le défi du jour, juste en dessous, est un bon premier pas.
    </p>
  {:else}
    <div class="cards">
      <div class="card">
        <span class="value">{streak}</span>
        <!-- « résolus », jamais « de suite » : c'est le mot qui porte le sens. -->
        <span class="caption">{streak === 1 ? 'jour résolu' : 'jours résolus'} d’affilée</span>
        {#if best > streak}
          <span class="note">record : {best}</span>
        {/if}
      </div>
      <div class="card">
        <span class="value">{overall.played}</span>
        <span class="caption">{overall.played === 1 ? 'partie terminée' : 'parties terminées'}</span>
        {#if overall.dailies > 0}
          <span class="note">dont {overall.dailies} défi{overall.dailies > 1 ? 's' : ''}</span>
        {/if}
      </div>
      <div class="card">
        <span class="value">{overall.unaided}</span>
        <span class="caption">sans indice appliqué</span>
      </div>
      <div class="card">
        <span class="value strong">
          {overall.highestLevel === null
            ? '—'
            : (LEVELS.find((l) => l.id === overall.highestLevel)?.label ?? '—')}
        </span>
        <span class="caption">niveau le plus haut terminé</span>
      </div>
    </div>
  {/if}

  <h2>Le défi du jour</h2>
  {#if corpus === null}
    <p class="empty">
      Le corpus des défis n’a pas pu être chargé. Le reste de l’application fonctionne
      normalement.
    </p>
  {:else if !hasDaily(corpus, today)}
    <p class="empty">
      Aucun défi n’est prévu pour aujourd’hui{#if range !== null}&nbsp;: le corpus s’arrête au
        {range.last}{/if}. Les défis passés restent jouables.
    </p>
  {:else}
    <div class="pick">
      <label for="daily-level">Niveau</label>
      <select id="daily-level" bind:value={dailyLevel}>
        {#each LEVELS as info (info.id)}
          <option value={info.id}>{info.label}</option>
        {/each}
      </select>
      <button type="button" class="primary" onclick={() => onPlayDaily(today, dailyLevel)}>
        {done.has(today) ? 'Rejouer le défi du jour' : 'Jouer le défi du jour'}
      </button>
    </div>
    <p class="hint">
      Six grilles chaque jour, une par niveau. Un jour compte comme résolu dès qu’une seule
      d’entre elles l’est — et les jours passés restent jouables, indéfiniment.
    </p>
  {/if}

  <div class="calendar-head">
    <h2>Calendrier</h2>
    <div class="nav">
      <button type="button" class="ghost" onclick={() => shiftMonth(-1)} aria-label="Mois précédent"
        >◀</button
      >
      <span class="month">{monthLabel}</span>
      <button type="button" class="ghost" onclick={() => shiftMonth(1)} aria-label="Mois suivant"
        >▶</button
      >
    </div>
  </div>

  <div class="calendar">
    {#each dayNames as name, index (index)}
      <span class="dow" aria-hidden="true">{name}</span>
    {/each}
    {#each grid as day, index (index)}
      {#if day === null}
        <span class="blank"></span>
      {:else}
        <button
          type="button"
          class="day"
          class:done={done.has(day)}
          class:today={day === today}
          disabled={!playable(day)}
          aria-label={describe(day)}
          onclick={() => onPlayDaily(day, dailyLevel)}
        >
          <span class="number">{Number(day.slice(8))}</span>
          <!--
            La coche, et pas seulement la couleur : à l'impression en noir et
            blanc comme pour un daltonien, le fond vert ne dit rien.
          -->
          <span class="mark" aria-hidden="true">{done.has(day) ? '✓' : ''}</span>
        </button>
      {/if}
    {/each}
  </div>

  {#if overall.played > 0}
    <h2>Par niveau</h2>
    <!--
      Un cadre qui défile plutôt qu'un tableau qui déborde : cinq colonnes ne
      tiennent pas toujours sur un téléphone en « gros caractères », et la page
      ne doit jamais défiler de côté. Un bloc qui défile doit se laisser
      atteindre au clavier, d'où la tabulation et le nom — c'est le motif
      recommandé pour une région défilante, que l'avertissement générique ignore.
    -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-wrap" role="region" aria-label="Statistiques par niveau" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Niveau</th>
            <th scope="col">Terminées</th>
            <th scope="col">Meilleur temps</th>
            <th scope="col">Temps médian</th>
            <th scope="col">Sans indice</th>
          </tr>
        </thead>
        <tbody>
          {#each byLevel as row (row.level)}
            <tr class:idle={row.played === 0}>
              <th scope="row">{row.label}</th>
              <td>{row.played}</td>
              <td>{row.bestMs === null ? '—' : formatDuration(row.bestMs)}</td>
              <td>
                {#if row.medianMs !== null}
                  {formatDuration(row.medianMs)}
                  <span class="sample">sur {row.timed}</span>
                {:else if row.timed > 0}
                  <!--
                    Ni chiffre approximatif, ni case vide sans explication : on dit
                    ce qui manque. Même règle que pour une difficulté non mesurée.
                  -->
                  <span class="sample"
                    >encore {5 - row.timed} partie{5 - row.timed > 1 ? 's' : ''}</span
                  >
                {:else}
                  —
                {/if}
              </td>
              <td>{row.played === 0 ? '—' : row.unaided}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .progress {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
  }

  .intro {
    max-width: var(--measure);
    margin: 0;
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    color: var(--text-muted);
    line-height: var(--leading-prose);
  }

  /*
    Deux colonnes, ou quatre : jamais trois plus une. En colonnes automatiques,
    la quatrième carte passait seule à la ligne, à demi-largeur, dès que la
    place manquait pour quatre.
  */
  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  @media (min-width: 44rem) {
    .cards {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
  }

  .value {
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: var(--leading-tight);
    font-variant-numeric: tabular-nums;
  }

  .value.strong {
    font-size: var(--text-lg);
    padding-block: 0.35rem;
  }

  .caption {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .note {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  .pick {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .pick label {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  select {
    min-height: var(--tap);
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  button {
    min-height: var(--tap);
    padding: 0.4rem 0.9rem;
    border-radius: var(--radius-md);
    font: inherit;
    cursor: pointer;
    transition:
      background-color var(--dur-quick) var(--ease),
      border-color var(--dur-quick) var(--ease);
  }

  .primary {
    border: none;
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .ghost {
    min-width: var(--tap);
    border: 1px solid var(--border);
    background: none;
    color: var(--text);
  }

  .primary:active {
    background: var(--accent-active);
    transition-duration: 0s;
  }

  .ghost:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  .hint,
  .empty {
    max-width: var(--measure);
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
    color: var(--text-muted);
  }

  .calendar-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    justify-content: space-between;
    max-width: 28rem;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .month {
    min-width: 9rem;
    text-align: center;
    font-size: var(--text-base);
  }

  /*
    Le calendrier a sa propre largeur, et ses jours se partagent la place au
    lieu de l'imposer. Deux défauts mesurés à l'incrément 10 : sur un grand
    écran, sept colonnes pleine largeur faisaient des jours de 150 px ; sur un
    téléphone de 375 px en « très gros caractères », le minimum de 2,75 rem par
    jour — 55 px — faisait déborder la page de 60 px. La cible reste d'au moins
    44 px, mais par la largeur de la grille : (375 − 40 − 12) / 7 ≈ 46 px.
  */
  .calendar {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
    max-width: 28rem;
  }

  .dow {
    padding-bottom: 0.2rem;
    text-align: center;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .blank {
    aspect-ratio: 1;
  }

  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    aspect-ratio: 1;
    /*
      Le minimum générique des boutons de ce panneau ne vaut pas ici : avec le
      rapport 1, il se reportait sur la largeur, et un jour de 55 px empiétait
      sur sa colonne de 46 en « très gros caractères ». La cible de 44 px est
      tenue par la largeur de la grille, mesurée.
    */
    min-height: 0;
    padding: 0;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .day:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .day.done {
    border-color: var(--accent);
    background: var(--accent-soft, var(--surface-sunken));
    font-weight: 600;
  }

  .day.today {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .day:active:not(:disabled) {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  .mark {
    height: 0.9em;
    font-size: var(--text-xs);
    line-height: 1;
    color: var(--accent);
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  th,
  td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }

  /*
    Les nombres s'alignent à droite : c'est ainsi qu'on compare deux durées d'un
    coup d'œil. Ils ne se coupent pas non plus en deux lignes — le cadre défile.
  */
  thead th:not(:first-child),
  td {
    text-align: right;
  }

  td {
    white-space: nowrap;
  }

  thead th {
    border-bottom-width: 2px;
    background: var(--surface-sunken);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
  }

  tbody tr:last-child > * {
    border-bottom: none;
  }

  tbody th {
    font-weight: 600;
  }

  tr.idle {
    color: var(--text-muted);
  }

  .sample {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  /*
    Le survol n'existe qu'avec un pointeur qui survole : sans cette garde, un
    navigateur mobile l'émule au toucher et le laisse collé.
  */
  @media (hover: hover) and (pointer: fine) {
    .primary:hover {
      background: var(--accent-hover);
    }

    .ghost:hover {
      background: var(--surface-hover);
    }

    .day:hover:not(:disabled) {
      border-color: var(--text-muted);
    }
  }
</style>
