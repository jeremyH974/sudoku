<script lang="ts">
  import { byHardest, dailyStreak, fastest, longestDailyStreak } from './records.js';
  import type { CaseRecord } from './records.js';
  import { MIN_SAMPLE_FOR_MEDIAN } from '../progress.js';
  import { localDayKey } from '../day.js';

  interface Props {
    records: readonly CaseRecord[];
  }

  const { records }: Props = $props();

  /**
   * Ce que l'enquête sait dire de vos parties — et ce qu'elle refuse de dire.
   *
   * ─── Aucune difficulté, parce qu'aucun oracle ──────────────────────────────
   *
   * Le sudoku affiche des médianes **par niveau** parce que ses niveaux sont
   * calibrés contre Sudoku Explainer, grille par grille. L'enquête n'a pas
   * d'oracle : lui inventer un palier serait exactement le mensonge que ce
   * projet refuse partout ailleurs.
   *
   * Elle a en revanche un fait mesuré et observable : **la technique la plus
   * dure que le chemin exige**. C'est le seul axe de comparaison qui existe
   * ici, et il se présente comme un **comptage** — « quatre affaires dont la
   * plus dure déduction était un recoupement » se vérifie ; « tension 78 » ne se
   * vérifie pas.
   *
   * ─── Le reste des refus, hérités et tenus ──────────────────────────────────
   *
   * Aucun taux de réussite : sans bouton « abandonner », il n'y a pas de
   * dénominateur. Aucun compteur rangé : tout se recalcule depuis l'historique.
   * Aucune durée approchée : le chronomètre rend `null` dès qu'il doute, et ce
   * `null` se dit au lieu de se combler.
   */
  const NAMES: Readonly<Record<string, string>> = {
    placement: 'Dernière case',
    clue: 'Lecture d’indice',
    exclusion: 'Exclusion',
    'only-taker': 'Seul preneur',
    crossing: 'Recoupement',
    company: 'Qui était dans la pièce',
    subset: 'Groupe fermé',
  };

  const today = localDayKey();
  const tallies = $derived(byHardest(records));
  const best = $derived(fastest(records));
  const dailies = $derived(records.filter((record) => record.daily !== null).length);
  const streak = $derived(dailyStreak(records, today));
  const longest = $derived(longestDailyStreak(records));

  /** Une durée, en minutes et secondes. Jamais arrondie vers le bas en silence. */
  function duration(ms: number): string {
    const total = Math.round(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes === 0
      ? `${String(seconds)} s`
      : `${String(minutes)} min ${String(seconds).padStart(2, '0')}`;
  }
</script>

<section class="progress" aria-label="Vos enquêtes">
  <h3>Vos enquêtes</h3>

  {#if records.length === 0}
    <p class="empty">
      Aucune affaire résolue pour l’instant. Ce panneau ne comptera que ce qu’il observe : des
      affaires résolues, des jours, et la déduction la plus dure que chacune exigeait.
    </p>
  {:else}
    <dl class="totals">
      <div>
        <dt>Affaires résolues</dt>
        <dd>{records.length}</dd>
      </div>
      <div>
        <dt>Affaires du jour</dt>
        <dd>{dailies}</dd>
      </div>
      <div>
        <dt>Série en cours</dt>
        <dd>{streak} jour{streak > 1 ? 's' : ''} résolu{streak > 1 ? 's' : ''}</dd>
      </div>
      <div>
        <dt>Plus longue série</dt>
        <dd>{longest} jour{longest > 1 ? 's' : ''} résolu{longest > 1 ? 's' : ''}</dd>
      </div>
      {#if best !== null && best.durationMs !== null}
        <div>
          <!-- Un record se dit dès la première partie : c'est un fait observé,
               pas une tendance. Le seuil des cinq parties ne vaut que pour une
               médiane. -->
          <dt>La plus rapide</dt>
          <dd>{duration(best.durationMs)}</dd>
        </div>
      {/if}
    </dl>

    <h4>Par déduction la plus dure</h4>
    <p class="caveat">
      Un <strong>comptage</strong>, pas une note. L’enquête n’affiche aucun niveau et aucun score :
      rien ne les calibrerait. La médiane demande {MIN_SAMPLE_FOR_MEDIAN} parties d’une même
      déduction, et dit sur combien elle porte.
    </p>
    <table class="tallies">
      <thead>
        <tr>
          <th scope="col">Déduction</th>
          <th scope="col" class="num">Affaires</th>
          <th scope="col" class="num">Durée médiane</th>
        </tr>
      </thead>
      <tbody>
        {#each tallies as tally (tally.technique)}
          <tr>
            <th scope="row">{NAMES[tally.technique] ?? tally.technique}</th>
            <td class="num">{tally.count}</td>
            <td class="num">
              {#if tally.medianMs === null}
                <!-- On dit ce qui manque, plutôt qu'un à-peu-près : c'est la
                     règle du volet statistique, mot pour mot. -->
                <span class="missing"
                  >{tally.timed} chronométrée{tally.timed > 1 ? 's' : ''}, il en faut {MIN_SAMPLE_FOR_MEDIAN}</span
                >
              {:else}
                {duration(tally.medianMs)}
                <span class="sample">sur {tally.timed}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .progress {
    margin-top: var(--space-5);
    border-top: 2px solid var(--ink);
    padding-top: var(--space-4);
  }

  h3 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
  }

  h4 {
    margin: var(--space-5) 0 var(--space-2);
    font-size: var(--text-base);
  }

  .empty,
  .caveat {
    margin: 0 0 var(--space-3);
    max-width: var(--measure);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
    color: var(--text-muted);
  }

  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-6);
    margin: 0;
  }

  dt {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .tallies {
    border-collapse: collapse;
    width: 100%;
    max-width: var(--measure);
    font-size: var(--text-sm);
  }

  .tallies th,
  .tallies td {
    border-bottom: 1px solid var(--border);
    padding: var(--space-2);
    text-align: left;
  }

  .tallies thead th {
    border-bottom: 2px solid var(--ink);
    font-weight: 600;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .missing,
  .sample {
    color: var(--text-muted);
  }
</style>
