<script lang="ts">
  import { LEVELS, SIZE } from '@sudoku/engine';
  import type { Level, Symmetry } from '@sudoku/engine';
  import { Game } from './lib/game.svelte.js';
  import SudokuBoard from './lib/SudokuBoard.svelte';
  import AnalysisPanel from './lib/AnalysisPanel.svelte';
  import PrintStudio from './print/PrintStudio.svelte';
  import { THEME_OPTIONS, theme } from './lib/theme.svelte.js';
  import { loadGame, requestPersistence, saveGame } from './lib/storage.js';
  import UpdateBanner from './lib/UpdateBanner.svelte';
  import ProgressPanel from './lib/ProgressPanel.svelte';
  import { appendRecord, loadRecords } from './lib/stats.js';
  import type { GameRecord } from './lib/stats.js';
  import { dailyCode, hasDaily, loadDailyCorpus, today as todayKey } from './lib/daily.js';
  import type { DailyCorpus } from './lib/daily.js';
  import type { DayKey } from './lib/day.js';

  const game = new Game();

  const SYMMETRIES: { id: Symmetry; label: string }[] = [
    { id: 'rotational180', label: 'Rotation 180 degrés' },
    { id: 'diagonal', label: 'Diagonale' },
    { id: 'none', label: 'Aucune' },
  ];

  let level = $state<Level>('moyen');
  let symmetry = $state<Symmetry>('rotational180');
  let announcement = $state('');

  /*
    Les onglets comme données, et non comme quatre branches recopiées.

    Le patron ARIA « tablist » a été retiré : il exigeait des identifiants, des
    `aria-controls`, des panneaux `role="tabpanel"` et une navigation aux
    flèches, dont rien n'était en place. Un rôle revendiqué mais non tenu dessert
    davantage un lecteur d'écran qu'une navigation ordinaire — c'est la même
    prudence que le projet s'impose déjà à propos de `role="grid"`.
  */
  const TABS = [
    { id: 'jeu', label: 'Jouer' },
    { id: 'progression', label: 'Progression' },
    { id: 'analyse', label: 'Analyse' },
    { id: 'imprimer', label: 'Imprimer' },
  ] as const;
  type TabId = (typeof TABS)[number]['id'];
  let tab = $state<TabId>('jeu');

  let records = $state<GameRecord[]>(loadRecords());
  let corpus = $state<DailyCorpus | null>(null);
  /*
    « Aujourd'hui » se relit au retour au premier plan, jamais figé au
    chargement : un onglet laissé ouvert toute la nuit proposerait sinon encore
    le défi de la veille.
  */
  let today = $state<DayKey>(todayKey());

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

  /*
    L'enregistrement passe par le rappel de `Game`, pas par un effet qui
    observerait `isComplete`.

    `isComplete` est un dérivé : annuler la dernière case le fait retomber à
    `false`, la reposer le fait remonter. Un effet écrirait trois parties là où
    il y en a une. `onSolved` est appelé une seule fois par grille chargée.
  */
  game.onSolved = (record) => {
    if (!appendRecord(record)) {
      announcement = 'Grille terminée. L’historique n’a pas pu être enregistré.';
      return;
    }
    records = loadRecords();
    const what = record.daily === null ? 'Grille terminée' : `Défi du ${record.daily} résolu`;
    announcement = `${what} en ${formatClock(game.clock.elapsedMs)}${
      record.mistakes === 0 ? ', sans une seule erreur' : ''
    }.`;
  };

  void loadDailyCorpus().then((loaded) => {
    corpus = loaded;
  });

  /** Ouvre le défi d'un jour au niveau demandé. */
  function playDaily(day: DayKey, wanted: Level): void {
    if (corpus === null) return;
    const code = dailyCode(corpus, day, wanted);
    if (code === null) {
      announcement = 'Aucun défi pour ce jour à ce niveau.';
      return;
    }
    if (game.loadFromCode(code, day)) {
      tab = 'jeu';
      announcement = `Défi du ${day}, niveau ${wanted}.`;
    }
  }

  const dailyAvailable = $derived(corpus !== null && hasDaily(corpus, today));

  /**
   * Le chronomètre : mis en pause dès que l'onglet cesse d'être regardé.
   *
   * Trois événements, pas un seul. `visibilitychange` suffit sur ordinateur,
   * mais sur iOS il n'est pas fiable au verrouillage de l'écran ni au balayage
   * vers l'accueil ; `pagehide` et `freeze`, eux, le sont. Sans eux la pause
   * fuirait précisément sur la plateforme où l'on joue le plus.
   */
  $effect(() => {
    /*
      Le battement se contente d'appeler `sample()` : `elapsedMs` est un `$state`
      du chronomètre, donc l'affichage suit tout seul. Une variable locale
      recopiée ici resterait en retard d'une seconde après un changement de
      grille — le compteur repartirait de zéro visuellement une seconde trop
      tard.
    */
    const tick = setInterval(() => {
      game.clock.sample();
    }, 1000);

    const suspend = (): void => {
      game.clock.pause();
    };
    const resume = (): void => {
      // Le jour civil se relit ici : c'est le seul moment où il peut avoir
      // changé sans que personne ne regarde.
      today = todayKey();
      if (!game.isComplete && !game.generating) game.clock.start();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') suspend();
      else resume();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('freeze', suspend);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('freeze', suspend);
    };
  });

  /** « 8:12 », « 1:04:37 ». Compact, à chiffres de largeur fixe. */
  function formatClock(ms: number): string {
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
    return `${hours > 0 ? `${String(hours)}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Grille venue du papier ?
   *
   * Une adresse en `#g=…` provient d'un QR code ou d'un lien imprimé. Elle prime
   * sur la génération d'une nouvelle grille : quelqu'un qui scanne veut jouer
   * *cette* grille-là, pas une autre. C'est le retour du papier vers l'écran, et
   * la moitié qui manquait au pont.
   */
  function openFromUrl(): boolean {
    if (typeof window === 'undefined') return false;
    const match = /^#g=(.+)$/.exec(window.location.hash);
    if (match === null) return false;

    if (game.loadFromCode(decodeURIComponent(match[1]))) {
      // Basculer sur le jeu : quelqu'un qui scanne veut jouer, pas rester sur
      // l'onglet où il se trouvait.
      tab = 'jeu';
      announcement = 'Grille ouverte depuis un code imprimé.';
      return true;
    }
    announcement = 'Ce code de grille est illisible ou incomplet.';
    return false;
  }

  /**
   * Suivre aussi les changements d'adresse en cours de route.
   *
   * Sans cela, seul un chargement complet ouvrirait une grille : scanner un QR
   * alors que l'application est déjà ouverte ne ferait rien du tout, puisque
   * modifier le fragment ne remonte aucun composant. C'est précisément le cas le
   * plus fréquent — l'onglet reste ouvert d'une grille à l'autre.
   */
  $effect(() => {
    const onHashChange = (): void => {
      openFromUrl();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  });

  /**
   * Au démarrage, dans l'ordre : un code d'URL, puis une partie sauvegardée,
   * puis seulement une grille neuve.
   *
   * Cet ordre n'est pas arbitraire. Quelqu'un qui scanne un QR veut cette
   * grille-là ; quelqu'un qui revient veut retrouver la sienne ; personne ne
   * veut voir sa partie remplacée par une autre au simple fait d'avoir rouvert
   * l'onglet — c'est le reproche récurrent fait aux applications existantes.
   */
  function start(): void {
    if (openFromUrl()) return;

    const saved = loadGame();
    if (saved !== null) {
      game.restoreFrom(saved);
      announcement = 'Partie précédente restaurée.';
      return;
    }
    void newPuzzle();
  }

  /**
   * Sauvegarde différée.
   *
   * L'effet se réexécute à chaque changement de la partie et annule le report
   * précédent : écrire à chaque frappe sérialiserait l'état des dizaines de fois
   * par minute, pour un résultat identique. Un report court suffit, et
   * `visibilitychange` garantit une écriture au moment où l'onglet passe en
   * arrière-plan — le seul instant où l'on est sûr de ne pas être interrompu.
   */
  $effect(() => {
    const snapshot = game.snapshot();
    if (game.generating) return;

    const timer = setTimeout(() => {
      saveGame(snapshot);
    }, 400);

    const flush = (): void => {
      if (document.visibilityState === 'hidden') saveGame(snapshot);
    };
    document.addEventListener('visibilitychange', flush);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', flush);
    };
  });

  void requestPersistence();
  start();
</script>

<main>
  <header class="no-print">
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

  <div class="no-print"><UpdateBanner /></div>

  <nav class="tabs no-print" aria-label="Sections">
    {#each TABS as entry (entry.id)}
      <button
        type="button"
        class:active={tab === entry.id}
        aria-current={tab === entry.id ? 'page' : undefined}
        onclick={() => (tab = entry.id)}
      >
        {entry.label}
      </button>
    {/each}
  </nav>

  {#if tab === 'jeu'}
    <div class="layout">
      <div class="board-column">
        <SudokuBoard {game} />

        <p class="status" class:done={game.isComplete}>
          <span class="clock" aria-label={`Temps de jeu : ${formatClock(game.clock.elapsedMs)}`}>
            {formatClock(game.clock.elapsedMs)}
          </span>
          {#if game.isComplete}
            <!--
              « sans une seule erreur » ne se dit que si c'est vrai du parcours,
              pas seulement de l'état final : une grille complète est forcément
              juste, ce qui rendrait la mention creuse.
            -->
            Grille terminée{game.mistakes === 0 ? ' sans une seule erreur' : ''}.
          {:else}
            {game.filledCount} / 81 cases remplies{game.conflicts.size > 0
              ? ` — ${String(game.conflicts.size)} en conflit`
              : ''}
          {/if}
          {#if game.daily !== null}
            <span class="badge">Défi du {game.daily}</span>
          {/if}
          {#if game.mistakes > 0}
            <!--
              Constaté, jamais reproché : il n'y a aucune limite d'erreurs dans
              ce jeu, et ce compteur n'en est pas le début.
            -->
            <span class="muted-inline"
              >{game.mistakes} valeur{game.mistakes > 1 ? 's' : ''} fausse{game.mistakes > 1
                ? 's'
                : ''} saisie{game.mistakes > 1 ? 's' : ''}</span
            >
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
          <button
            type="button"
            class="secondary"
            disabled={!dailyAvailable || game.generating}
            onclick={() => playDaily(today, level)}
          >
            Défi du jour
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
  {:else if tab === 'progression'}
    <ProgressPanel {records} {corpus} {today} onPlayDaily={playDaily} />
  {:else if tab === 'analyse'}
    <AnalysisPanel {game} />
  {:else}
    <PrintStudio />
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    color: var(--text-muted);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .clock {
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-sunken);
    color: var(--text);
    font-weight: 600;
    /* Largeur fixe : sans cela le compteur tressaute à chaque seconde. */
    font-variant-numeric: tabular-nums;
  }

  .muted-inline {
    font-size: 0.82rem;
    color: var(--text-faint);
  }

  .badge {
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--accent);
    border-radius: 6px;
    background: var(--accent-soft);
    color: var(--text);
    font-size: 0.8rem;
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

  .secondary {
    min-height: 2.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  .secondary:disabled {
    opacity: 0.5;
    cursor: default;
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
