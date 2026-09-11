<script lang="ts">
  import { techniqueInfo } from '@sudoku/engine';
  import type { TechniqueId } from '@sudoku/engine';
  import { CHAPTERS, LESSONS } from './lessons.js';
  import { gridsFor } from './learn.js';
  import type { LessonCorpus } from './learn.js';
  import { techniqueProgress } from './progress.js';
  import type { GameRecord } from './stats.js';

  interface Props {
    records: readonly GameRecord[];
    corpus: LessonCorpus | null;
    /** Ouvre l'exercice amorcé d'une technique. */
    onPractise: (technique: TechniqueId, code: string) => void;
    /** Ouvre la grille entière dont l'exercice est extrait. */
    onPlayFull: (technique: TechniqueId, code: string) => void;
  }

  const { records, corpus, onPractise, onPlayFull }: Props = $props();

  let open = $state<TechniqueId | null>(null);

  const progress = $derived(new Map(techniqueProgress(records).map((entry) => [entry.technique, entry])));

  /**
   * La grille d'exercice d'une technique — **déterministe**, et qui tourne.
   *
   * Le tirage était aléatoire, et appelé depuis le `{#each}` : déplier une leçon
   * relançait le rendu de sa ligne, donc le tirage, et les deux boutons
   * pouvaient viser deux grilles différentes.
   *
   * La n-ième pratique ouvre la n-ième grille du corpus. Plus de hasard, et une
   * deuxième tentative donne une grille différente — ce que le hasard ne
   * garantissait même pas.
   */
  function pick(technique: TechniqueId): string | null {
    if (corpus === null) return null;
    const codes = gridsFor(corpus, technique);
    if (codes.length === 0) return null;
    const done = progress.get(technique)?.done ?? 0;
    return codes[done % codes.length] ?? null;
  }

  function stateOf(technique: TechniqueId): string {
    const entry = progress.get(technique);
    if (entry === undefined) return 'Jamais pratiquée';
    const done = `${String(entry.done)} exercice${entry.done > 1 ? 's' : ''}`;
    return entry.unaided > 0
      ? `${done}, dont ${String(entry.unaided)} sans indice`
      : `${done}, avec indice`;
  }
</script>

<div class="learn">
  <p class="intro">
    Chaque technique se lit, puis se pratique sur une grille qui l’exige vraiment — reprise à
    l’instant précis où elle devient nécessaire, plutôt qu’au premier coup.
  </p>

  {#if corpus === null}
    <p class="notice" role="status">
      Les grilles d’exercice n’ont pas pu être chargées. Les leçons restent lisibles.
    </p>
  {/if}

  {#each CHAPTERS as chapter (chapter.id)}
    <section class="chapter">
      <h2>{chapter.title}</h2>
      <p class="chapter-intro">{chapter.intro}</p>

      <ul class="techniques">
        {#each chapter.techniques as id (id)}
          {@const info = techniqueInfo(id)}
          {@const lesson = LESSONS[id]}
          {@const code = pick(id)}
          {@const entry = progress.get(id)}
          <li class="technique" class:done={entry !== undefined}>
            <div class="head">
              <span class="badge" title="Difficulté sur l’échelle Sudoku Explainer">
                {info.difficulty.toFixed(1)}
              </span>
              <span class="name">{info.label}</span>
              <!--
                L'état se dit en toutes lettres, jamais par une pastille de
                couleur seule ; et il compte ce qui est observable — des
                exercices faits — sans inventer de pourcentage de maîtrise dont
                le dénominateur n'existe pas.
              -->
              <span class="state">{stateOf(id)}</span>
            </div>

            <p class="summary">{lesson.summary}</p>

            <div class="row">
              <button
                type="button"
                class="ghost"
                aria-expanded={open === id}
                onclick={() => (open = open === id ? null : id)}
              >
                {open === id ? 'Replier la leçon' : 'Lire la leçon'}
              </button>

              {#if code !== null}
                <button type="button" class="primary" onclick={() => onPractise(id, code)}>
                  S’exercer
                </button>
                <button type="button" class="ghost" onclick={() => onPlayFull(id, code)}>
                  Grille entière
                </button>
              {/if}
            </div>

            {#if open === id}
              <div class="body">
                {#each lesson.body as paragraph (paragraph)}
                  <p>{paragraph}</p>
                {/each}
                <p class="aside"><strong>Où la repérer.</strong> {lesson.howToSpot}</p>
                {#if lesson.pitfall !== undefined}
                  <p class="aside"><strong>Le piège.</strong> {lesson.pitfall}</p>
                {/if}
                {#if code === null && corpus !== null}
                  <!--
                    Le cas honnête : aucune grille n'a pu être produite où cette
                    technique soit vraiment la plus difficile. On le dit, avec la
                    raison, plutôt que de fabriquer un exercice qui porterait sur
                    autre chose.
                  -->
                  <p class="aside warn">
                    <strong>Sans exercice.</strong> Aucune grille n’a pu être produite où cette
                    technique soit réellement la plus difficile : dans l’ordre de difficulté
                    croissante, un raisonnement moins coûteux s’applique toujours avant elle. Nous
                    préférons le dire plutôt que proposer un exercice où elle ne serait pas
                    nécessaire.
                  </p>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  /*
    La colonne entière à la mesure de lecture : 46 rem faisaient 106 caractères
    par ligne sur l'onglet le plus riche en prose — mesuré avec la police
    système —, bien au-delà des 45 à 75 qu'on lit sans fatigue. La mesure en
    donne 69 : voir `--measure` dans `app.css`.
  */
  .learn {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: var(--measure);
  }

  .intro,
  .chapter-intro {
    margin: 0;
    color: var(--text-muted);
    line-height: var(--leading-prose);
  }

  .notice {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
    color: var(--text-muted);
  }

  .chapter {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
  }

  .techniques {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .technique {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  /*
    Une technique déjà pratiquée se distingue par un liseré à gauche **et** par
    le texte de son état. La couleur n'est jamais seule à le dire.
  */
  .technique.done {
    border-left: 3px solid var(--success);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: baseline;
  }

  .badge {
    padding: 0.1rem 0.45rem;
    border-radius: var(--radius-pill);
    background: var(--surface-sunken);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .name {
    font-weight: 600;
  }

  .state {
    margin-left: auto;
    color: var(--text-faint);
    font-size: var(--text-sm);
  }

  .summary {
    margin: 0;
    color: var(--text-muted);
    line-height: var(--leading-prose);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .row button {
    min-height: var(--tap);
    padding: 0.4rem 0.9rem;
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-base);
    cursor: pointer;
    transition:
      background-color var(--dur-quick) var(--ease),
      border-color var(--dur-quick) var(--ease);
  }

  .primary {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .ghost {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }

  .primary:active {
    border-color: var(--accent-active);
    background: var(--accent-active);
    transition-duration: 0s;
  }

  .ghost:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  /*
    Le survol n'existe qu'avec un pointeur qui survole : sans cette garde, un
    navigateur mobile l'émule au toucher et le laisse collé.
  */
  @media (hover: hover) and (pointer: fine) {
    .primary:hover {
      border-color: var(--accent-hover);
      background: var(--accent-hover);
    }

    .ghost:hover {
      background: var(--surface-hover);
    }
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
    line-height: var(--leading-prose);
  }

  .body p {
    margin: 0;
  }

  .aside {
    color: var(--text-muted);
    font-size: var(--text-base);
  }

  .aside.warn {
    padding: 0.6rem var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
  }
</style>
