<script lang="ts">
  import { LEVELS, SIZE } from '@sudoku/engine';
  import { flushSync } from 'svelte';
  import type { Level, Symmetry } from '@sudoku/engine';
  import { Game } from './lib/game.svelte.js';
  import SudokuBoard from './lib/SudokuBoard.svelte';
  import Icon from './lib/Icon.svelte';
  import AnalysisPanel from './lib/AnalysisPanel.svelte';
  import PrintStudio from './print/PrintStudio.svelte';
  import { THEME_OPTIONS, theme } from './lib/theme.svelte.js';
  import { TEXT_SIZE_OPTIONS, textSize } from './lib/textSize.svelte.js';
  import { ASSIST_OPTIONS, assists } from './lib/assists.svelte.js';
  import { MARKS } from './lib/marks.js';
  import LearnPanel from './lib/LearnPanel.svelte';
  import { buildExercise, loadLessonCorpus } from './lib/learn.js';
  import type { LessonCorpus } from './lib/learn.js';
  import { LESSONS } from './lib/lessons.js';
  import type { TechniqueId } from '@sudoku/engine';
  import { techniqueInfo } from '@sudoku/engine';
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
    { id: 'apprendre', label: 'Apprendre' },
    { id: 'progression', label: 'Progression' },
    { id: 'analyse', label: 'Analyse' },
    { id: 'imprimer', label: 'Imprimer' },
  ] as const;
  type TabId = (typeof TABS)[number]['id'];
  let tab = $state<TabId>('jeu');

  /*
    Le panneau des réglages — taille du texte, thème, aides. Replié par défaut ;
    il s'ouvre depuis l'en-tête, ou depuis la ligne « Aides » de l'onglet Jouer,
    qui y mène directement.
  */
  const SETTINGS_ID = 'reglages';
  let settingsOpen = $state(false);

  function openAssists(): void {
    settingsOpen = true;
    // Le panneau doit être ouvert dans le DOM avant d'y recevoir le focus : un
    // champ masqué ne le prend pas. `flushSync` applique l'ouverture sur-le-champ,
    // sans dépendre de l'ordre des tâches en attente.
    flushSync();
    document.querySelector<HTMLInputElement>(`#${SETTINGS_ID} .assist input`)?.focus();
  }

  let records = $state<GameRecord[]>(loadRecords());
  let corpus = $state<DailyCorpus | null>(null);
  let lessonCorpus = $state<LessonCorpus | null>(null);
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
      /*
        Un indice purement éliminatoire n'écrit rien sur une grille sans notes.
        Le dire vaut mieux que d'annoncer « coup appliqué » quand rien n'a bougé
        — et c'est pour cela que `applyHint` rend un booléen.
      */
      announcement = game.applyHint()
        ? 'Coup appliqué.'
        : 'Rien à appliquer : ce coup écarte des candidats que la grille ne porte pas encore.';
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

  void loadLessonCorpus().then((loaded) => {
    lessonCorpus = loaded;
  });

  /**
   * Ouvre l'exercice amorcé d'une technique.
   *
   * L'amorce est fabriquée localement à partir de la seule grille : on rejoue le
   * chemin et on s'arrête à la première étape qui emploie la technique. Si le
   * barème a changé au point qu'elle n'y figure plus, on le **dit** plutôt que
   * d'ouvrir un exercice qui ne porterait pas sur la leçon.
   */
  function practise(technique: TechniqueId, code: string): void {
    const exercise = buildExercise(code, technique);
    if (exercise === null) {
      announcement =
        `Cette grille n’exige plus de ${techniqueInfo(technique).label} sous le barème ` +
        `en vigueur. L’exercice n’est pas proposé.`;
      return;
    }
    game.loadExercise(exercise);
    tab = 'jeu';
    announcement = `Exercice : ${techniqueInfo(technique).label}. ${LESSONS[technique].summary}`;
  }

  /** Ouvre la grille entière dont l'exercice est extrait. */
  function playFull(technique: TechniqueId, code: string): void {
    void technique;
    if (game.loadFromCode(code)) {
      tab = 'jeu';
      announcement = `Grille complète, niveau ${game.level ?? 'non mesuré'}.`;
    }
  }

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
   * par minute, pour un résultat identique. Un report court suffit.
   *
   * ─── Ce qu'il ne doit surtout pas lire ──────────────────────────────────────
   *
   * L'instantané se construit **dans** le report, jamais dans le corps de
   * l'effet. `snapshot()` lit le total du chronomètre, et celui-ci était un
   * `$state` réassigné chaque seconde par le battement : l'effet se
   * redéclenchait donc une fois par seconde, indéfiniment, et l'antirebond n'a
   * jamais eu l'occasion de regrouper quoi que ce soit. `currentMs()` rend
   * désormais le même total sans dépendance, et les lectures d'ici ne portent
   * plus que sur de vrais gestes du joueur.
   *
   * Les trois mêmes événements que le chronomètre, et pour la même raison : sur
   * iOS, `visibilitychange` n'est fiable ni au verrouillage de l'écran ni au
   * balayage vers l'accueil.
   */
  $effect(() => {
    if (game.generating) return;
    // Dépendances explicites : l'état du plateau, et rien qui batte.
    void game.values;
    void game.notes;
    void game.noteColors;
    void game.history.length;
    void game.selected;
    void game.noteMode;
    void game.markMode;
    void game.hintsShown;
    void game.hintsApplied;
    void game.mistakes;
    void game.lesson;
    void game.daily;

    const write = (): void => {
      saveGame(game.snapshot());
    };
    const timer = setTimeout(write, 400);
    const flush = (): void => {
      if (document.visibilityState === 'hidden') write();
    };

    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', write);
    window.addEventListener('freeze', write);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', write);
      window.removeEventListener('freeze', write);
    };
  });

  void requestPersistence();
  start();
</script>

<!--
  L'en-tête et la navigation sont des frères de `<main>`, pas ses enfants.

  Tant qu'ils vivaient dedans, un lien d'évitement n'aurait rien évité : il
  aurait sauté vers un repère qui contient précisément ce qu'on veut sauter. Ce
  seul déplacement d'indentation règle le lien, donne un abri au `<nav>` et
  satisfait les règles de repères d'axe, qui exigent que tout contenu appartienne
  à un repère nommé.
-->
<div class="page" class:with-marks={tab === 'jeu' && game.noteMode}>
  <a class="skip-link" href="#contenu">Aller au contenu</a>

  <header>
    <div class="title">
      <!--
        La marque de l'application : le damier du favicon et de l'icône
        installée. En `currentColor` et dimensionnée en `em`, elle suit le thème
        et le réglage de taille du texte — ce qu'un logotype dessiné ne saurait
        pas faire.
      -->
      <h1><span class="brand" aria-hidden="true"><Icon name="brand" /></span>Sudoku</h1>
      <p class="tagline">Rien à installer. Aucune publicité, aucun compte, aucun suivi.</p>
    </div>

    <!--
      Le retour à l'accueil : un vrai lien, parce que c'est une adresse du site.
      Un bouton piloté au JavaScript perdrait l'ouverture dans un nouvel onglet
      et la copie de l'adresse, que tout visiteur attend d'un lien.
    -->
    <a class="settings-toggle" href={import.meta.env.BASE_URL}>Accueil</a>

    <button
      type="button"
      class="settings-toggle"
      aria-expanded={settingsOpen}
      aria-controls={SETTINGS_ID}
      onclick={() => (settingsOpen = !settingsOpen)}
    >
      Réglages
    </button>

    <!--
      Les réglages vivent dans l'en-tête, repliés : ils occupaient la place de la
      navigation, au-dessus des onglets, sur chacun des cinq écrans. L'en-tête
      est un repère de page, ce qui range le panneau dans un repère sans rien
      ajouter.
    -->
    <div id={SETTINGS_ID} class="settings-panel" hidden={!settingsOpen}>
      <div class="preference">
        <span class="preference-label" id="reglage-taille">Taille du texte</span>
        <!--
          Trois « A » de tailles croissantes : le libellé dit le réglage, la
          taille du glyphe le montre. Aucune information n'est portée par la seule
          couleur, et le bouton actif se distingue aussi par sa graisse et son
          fond, pas seulement par sa teinte.
        -->
        <div class="text-size" role="group" aria-labelledby="reglage-taille">
          {#each TEXT_SIZE_OPTIONS as option, i (option.id)}
            <button
              type="button"
              class="size-option"
              class:active={textSize.size === option.id}
              aria-pressed={textSize.size === option.id}
              title={option.label}
              onclick={() => textSize.set(option.id)}
            >
              <span aria-hidden="true" style={`font-size: ${String(0.8 + i * 0.25)}rem`}>
                {option.short}
              </span>
              <span class="sr-only">{option.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="preference">
        <span class="preference-label" id="reglage-theme">Thème</span>
        <div class="theme" role="group" aria-labelledby="reglage-theme">
          {#each THEME_OPTIONS as option (option.id)}
            <button
              type="button"
              class="theme-option"
              class:active={theme.preference === option.id}
              aria-pressed={theme.preference === option.id}
              title={option.label}
              onclick={() => theme.set(option.id)}
            >
              <Icon name={option.icon} />
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!--
        Les aides visuelles, éteignables une à une : voir `assists.svelte.ts`. La
        cible tactile est la ligne entière, libellé compris — la case à cocher
        seule serait trop petite pour un doigt.
      -->
      <fieldset class="assists">
        <legend>Aides pendant la partie</legend>
        {#each ASSIST_OPTIONS as option (option.id)}
          <label class="assist">
            <input
              type="checkbox"
              checked={assists[option.id]}
              onchange={(event) => {
                assists.set(option.id, event.currentTarget.checked);
              }}
            />
            {option.label}
          </label>
        {/each}
      </fieldset>
    </div>
  </header>

  <UpdateBanner />

  <nav class="tabs" aria-label="Sections">
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

  <!--
    `tabindex="-1"` rend la cible du lien d'évitement focalisable : sans lui, le
    focus resterait sur le lien et la tabulation suivante repartirait de la
    navigation, ce qui annulerait tout l'intérêt du raccourci.
  -->
  <main id="contenu" tabindex="-1">
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
            {game.filledCount} / 81 cases remplies{assists.conflicts && game.conflicts.size > 0
              ? ` — ${String(game.conflicts.size)} en conflit`
              : ''}
          {/if}
          {#if game.daily !== null}
            <span class="badge">Défi du {game.daily}</span>
          {/if}
          {#if game.lesson !== null}
            <span class="badge">Exercice — {techniqueInfo(game.lesson).label}</span>
          {/if}
          {#if game.noteMode}
            <!--
              Le mode se lit **en toutes lettres**, pas seulement à la couleur de
              la bordure du plateau : une bordure teintée n'est pas un porteur
              d'information, et le mode marque décide de ce que fera la prochaine
              touche.
            -->
            <span class="badge mode">
              Mode note{game.markMode !== 0
                ? ` — marque ${MARKS[game.markMode - 1]!.label}`
                : ''}
            </span>
          {/if}
          {#if assists.mistakes && game.mistakes > 0}
            <!--
              Constaté, jamais reproché : il n'y a aucune limite d'erreurs dans
              ce jeu, et ce compteur n'en est pas le début. C'est aussi une aide —
              il révèle une erreur même sans conflit visible —, donc on peut
              l'éteindre ; la partie continue de compter pour les statistiques.
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
        <!--
          Pavé et actions réunis sous un même parent, sans rien déplacer dans
          l'ordre du document : c'est ce groupe qui, sur un écran court, quitte
          le flux pour se poser sous le pouce.

          Le calcul qui l'impose : sur 375×667, l'en-tête, les onglets, la grille
          et la ligne d'état consomment 543 px pour 553 px visibles. Aucune
          disposition ne fait tenir en plus un pavé de saisie, et rétrécir la
          grille donnerait des cases de 17 px.

          Il vit à l'intérieur de l'onglet « Jouer » : une barre fixe ne peut donc
          jamais venir couvrir un champ du studio d'impression, clavier logiciel
          ouvert.
        -->
        <div class="thumb-bar">
        <div class="pad" role="group" aria-label="Saisie des chiffres">
          {#each { length: SIZE } as _, i (i)}
            {@const digit = i + 1}
            <button
              type="button"
              class="pad-key"
              class:exhausted={remaining(digit) === 0}
              onclick={() => game.enter(digit)}
              aria-label={`${game.noteMode ? 'Noter' : 'Placer'} le ${String(digit)}, ${String(
                remaining(digit),
              )} restants`}
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

        <!--
          Les marques n'apparaissent qu'en mode notes, et ce n'est pas une
          économie de place : marquer un candidat suppose d'écrire des candidats.
          Le lien se voit ainsi au lieu de s'expliquer, et le bandeau ne coûte
          rien à qui ne s'en sert pas — ce qui compte, puisqu'il vit dans la
          barre du pouce sur téléphone.
        -->
        {#if game.noteMode}
          <div class="marks" role="group" aria-label="Marquer un candidat">
            {#each MARKS as mark (mark.id)}
              <button
                type="button"
                class="mark-key"
                class:active={game.markMode === mark.id}
                data-mark={mark.id}
                aria-pressed={game.markMode === mark.id}
                onclick={() => game.setMarkMode(mark.id)}
              >
                <span class="mark-letter">{mark.label}</span>
                <kbd>{mark.label}</kbd>
              </button>
            {/each}
          </div>
        {/if}
        </div>

        <button type="button" class="hint-button" onclick={onHint} disabled={game.isComplete}>
          {HINT_TIER_LABELS[game.hintTier]}
          {#if game.hint !== null}
            <span class="tier">{game.hintTier} / 3</span>
          {/if}
        </button>

        <!--
          Les aides vivent dans les réglages, mais c'est en jouant qu'on les
          cherche : le premier regard extérieur n'avait pas reconnu un bloc
          replié pour une option. Cette ligne dit leur état et mène au panneau.
        -->
        <button type="button" class="assists-link" onclick={openAssists}>
          Aides pendant la partie
          <span class="assists-count"
            >{assists.enabledCount} sur {ASSIST_OPTIONS.length} · Modifier</span
          >
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

        {#if game.lesson !== null}
          <!--
            Un exercice ne reçoit **aucun niveau**, et ce n'est pas un oubli : une
            position en cours de résolution n'en a pas. Lui attribuer celui de la
            grille dont elle est extraite serait afficher une difficulté qui n'a
            pas été mesurée sur ce qu'on montre — précisément ce que ce projet
            refuse. On dit donc ce qu'on sait : la technique qui s'y applique.
          -->
          <div class="verdict">
            <p>
              <strong>{techniqueInfo(game.lesson).label}</strong>
              — l’exercice commence à l’instant où cette technique devient nécessaire.
            </p>
            <p class="muted small">
              {game.clues} cases déjà posées, candidats à jour. Une position n’a pas de niveau :
              celui de la grille d’origine ne la décrirait pas.
            </p>
          </div>
        {:else if game.rating !== null}
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
            {#if game.analysis !== null}
              <!--
                La deuxième dimension. Deux comptages, jamais des notes : le
                `<details>` ci-dessous dit lequel des trois nombres est calibré
                et lesquels ne le sont pas. C'est la ligne de partage, et elle
                est à l'écran plutôt que dans un fichier.
              -->
              <p class="second-dimension">
                {#if game.analysis.demandingSteps === 0}
                  Aucune des {game.analysis.stepCount} déductions ne demande les candidats écrits :
                  cette grille se résout à l’œil.
                {:else}
                  <strong>{game.analysis.demandingSteps}</strong>
                  {game.analysis.demandingSteps > 1 ? 'déductions demandent' : 'déduction demande'}
                  les candidats écrits, sur {game.analysis.stepCount}.
                {/if}
              </p>
              <p class="second-dimension">
                Au moment le plus dur,
                <strong>{game.analysis.narrowest.waysForward}</strong>
                {game.analysis.narrowest.waysForward > 1
                  ? 'coups différents étaient jouables'
                  : 'seul coup était jouable'} —
                {game.analysis.narrowest.emptyCells} cases restaient vides.
              </p>
              <details class="provenance">
                <summary>D’où viennent ces trois nombres</summary>
                <p>
                  Le score {game.rating.score.toFixed(1)} est calibré contre Sudoku Explainer :
                  sur notre corpus, 97,8 % des grilles sous 4,0 reçoivent exactement sa note.
                </p>
                <p>
                  Les deux autres sont des <strong>comptages</strong>, pas des notes. Ils
                  décrivent le chemin que notre solveur emprunte — le vôtre sera différent.
                  Personne ne publie d’équivalent, donc rien ne permet de les confronter : nous
                  les affichons pour ce qu’ils sont, sans échelle inventée.
                </p>
              </details>
            {/if}
            <p class="muted small">
              Grille <code>{game.seed}</code> — {game.clues} indices, solution unique garantie,
              résoluble sans jamais deviner.
            </p>
          </div>
        {/if}
      </div>
    </div>
  {:else if tab === 'apprendre'}
    <LearnPanel
      {records}
      corpus={lessonCorpus}
      onPractise={practise}
      onPlayFull={playFull}
    />
  {:else if tab === 'progression'}
    <ProgressPanel {records} {corpus} {today} onPlayDaily={playDaily} />
  {:else if tab === 'analyse'}
    <AnalysisPanel {game} />
  {:else}
    <PrintStudio />
  {/if}

  <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
  </main>
</div>

<style>
  /*
    `viewport-fit=cover` est demandé depuis l'incrément 6 sans que rien n'en
    tienne compte : sur un téléphone à encoche, en paysage, le contenu passait
    sous les coins arrondis. `max()` rend la règle inoffensive partout ailleurs,
    puisque `env()` vaut zéro là où il n'existe pas.
  */
  .page {
    /*
      Hauteur à réserver sous la barre du pouce. Deux valeurs, parce que le
      bandeau des marques apparaît avec le mode notes : mesuré 174 px sans lui,
      226 px avec. Une réserve fixe cacherait le bas de la page dans l'un des
      deux cas.
    */
    --thumb-bar-reserve: 10.9rem;
    max-width: 68rem;
    margin: 0 auto;
    padding: 2rem max(1rem, env(safe-area-inset-right)) 4rem
      max(1rem, env(safe-area-inset-left));
  }

  /*
    Premier élément focalisable de la page, invisible tant qu'il n'a pas le
    focus. Sa hauteur respecte la règle des 44 px : un lien qu'on ne peut pas
    viser au doigt ne sert personne.
  */
  .page.with-marks {
    --thumb-bar-reserve: 14.2rem;
  }

  .skip-link {
    position: absolute;
    left: -9999px;
    z-index: 20;
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border-radius: var(--radius-md);
    background: var(--accent);
    color: var(--accent-text);
    text-decoration: none;
  }

  .skip-link:focus {
    left: 1rem;
    top: 1rem;
  }

  /*
    Une grille plutôt qu'une ligne qui se replie : le bouton des réglages reste
    sur la rangée du titre à toutes les largeurs, et c'est la signature qui se
    replie sous le titre. Mesuré sur un téléphone de 390 px, le bouton tombait
    sinon à 142 px du haut, seul sur sa rangée. Ouvert, le panneau occupe toute
    la seconde rangée.
  */
  header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-4);
    align-items: start;
    margin-bottom: 1.25rem;
  }

  /*
    Un seul bouton sur la ligne du titre. Les réglages occupaient la place de la
    navigation — au-dessus des onglets, sur les cinq écrans — ; ils sont repliés
    dans un panneau qui prend toute la largeur de l'en-tête quand on l'ouvre.
  */
  .settings-toggle {
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color var(--dur-quick) var(--ease),
      border-color var(--dur-quick) var(--ease);
  }

  /* Ouvert, le bouton le dit aussi par sa bordure, pas seulement par le panneau. */
  .settings-toggle[aria-expanded='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .settings-toggle:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .settings-toggle:hover {
      background: var(--surface-hover);
    }
  }

  .settings-panel {
    display: grid;
    grid-column: 1 / -1;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  /* `display: grid` l'emporterait sinon sur l'attribut `hidden`. */
  .settings-panel[hidden] {
    display: none;
  }

  .preference {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: space-between;
    align-items: center;
  }

  .preference-label {
    font-weight: 600;
  }

  /*
    Enveloppe et pastilles concentriques : 12 px de rayon autour, 8 px dedans,
    4 px d'écart — 12 = 8 + 4. Les deux valeurs d'avant, 9 et 7, étaient
    devinées.
  */
  .text-size {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
  }

  .size-option {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--tap);
    min-height: var(--tap);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--text-muted);
    font: inherit;
    cursor: pointer;
    transition:
      background-color var(--dur-quick) var(--ease),
      color var(--dur-quick) var(--ease);
  }

  /*
    L'élévation passe par un jeton : en thème sombre, l'ombre portée était
    invisible et la pastille active ne se détachait du fond qu'à 1,06:1. Le
    liseré qui la remplace y monte à 1,53:1, et la graisse porte l'état sans la
    couleur.
  */
  .size-option.active {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: var(--shadow-raised);
  }

  .size-option:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .size-option:hover {
      color: var(--text);
    }
  }

  .theme {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
  }

  .theme-option {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    /*
      44 px sur les deux dimensions : sans le `min-width`, il restait un bouton
      de 32 px de large, et l'audit de l'incrément 8 l'a mesuré.
    */
    min-height: var(--tap);
    min-width: var(--tap);
    justify-content: center;
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius-md);
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    transition:
      background-color var(--dur-quick) var(--ease),
      color var(--dur-quick) var(--ease);
  }

  /*
    L'état actif ne repose pas sur la seule couleur : le bouton reçoit un fond
    plein et un texte plus gras, lisibles même sans perception des teintes. Le
    libellé reste toujours affiché : il était masqué sous 30 rem, et le glyphe —
    celui dont la couverture varie le plus d'un système à l'autre — devenait
    alors le seul porteur visuel de l'option. Le panneau des réglages a la place.
  */
  .theme-option.active {
    background: var(--surface);
    color: var(--text);
    font-weight: 600;
    box-shadow: var(--shadow-raised);
  }

  .theme-option:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .theme-option:hover {
      color: var(--text);
    }
  }

  /*
    Taille fixe, en `rem`. Un titre fluide en `vw` cessait de suivre le réglage
    de taille du texte entre 640 et 880 px, pour un bénéfice esthétique nul.
  */
  h1 {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    margin: 0;
    font-size: var(--text-xl);
    letter-spacing: -0.02em;
  }

  .brand {
    display: inline-flex;
    color: var(--accent);
    font-size: 0.8em;
  }

  .tagline {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: var(--text-base);
  }

  .tabs {
    display: flex;
    /*
      Sans `wrap`, quatre onglets tenaient déjà tout juste sur un téléphone et
      le cinquième débordait franchement. Deux rangées valent mieux qu'une barre
      qui sort de l'écran.
    */
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-bottom: var(--space-5);
    border-bottom: 1px solid var(--border);
  }

  .tabs button {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    padding: 0.6rem var(--space-4);
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-base);
    cursor: pointer;
    transition:
      background-color var(--dur-quick) var(--ease),
      color var(--dur-quick) var(--ease);
  }

  .tabs button.active {
    border-bottom-color: var(--accent);
    color: var(--text);
    font-weight: 600;
  }

  .tabs button:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .tabs button:hover {
      color: var(--text);
    }
  }

  /*
    Deux colonnes énoncées, et non trouvées par hasard.

    `flex-wrap` décidait de passer à une colonne à la largeur où le contenu
    cessait de tenir : un point de rupture réel, mais implicite, donc impossible
    à raisonner et impossible à tester. La grille CSS le nomme — 34 rem de
    plateau, 2 rem d'écart, 15 rem de commandes, 2 rem de marges, soit 53,5 rem —
    et `minmax(0, …)` donne aux pistes le droit de rétrécir sous la largeur
    minimale de leur contenu, ce que `min-width: 0` faisait pour un élément
    flexible et qui manquait ici.
  */
  .layout {
    display: grid;
    grid-template-columns: minmax(0, var(--board-max)) minmax(15rem, 22rem);
    gap: var(--space-6);
    align-items: start;
  }

  @media (max-width: 53.5rem) {
    .layout {
      grid-template-columns: minmax(0, var(--board-max));
      justify-content: center;
      gap: 1.25rem;
    }
  }

  .board-column {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    max-width: var(--board-max);
  }

  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-base);
    font-variant-numeric: tabular-nums;
  }

  .clock {
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
    color: var(--text);
    font-weight: 600;
    /* Largeur fixe : sans cela le compteur tressaute à chaque seconde. */
    font-variant-numeric: tabular-nums;
  }

  .muted-inline {
    font-size: var(--text-sm);
    color: var(--text-faint);
  }

  .badge {
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    color: var(--text);
    font-size: var(--text-sm);
  }

  .status.done {
    color: var(--success);
    font-weight: 600;
  }

  .hint {
    padding: var(--space-4);
    border: 1px solid var(--hint-border);
    border-radius: var(--radius-lg);
    background: var(--hint-bg);
    color: var(--text);
    line-height: var(--leading-prose);
  }

  .hint p {
    margin: 0 0 var(--space-2);
  }

  .hint p:last-child {
    margin-bottom: 0;
  }

  .hint-title {
    font-weight: 700;
  }

  .muted {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .small {
    font-size: var(--text-sm);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    min-width: 0;
  }

  /*
    Pavé et actions. Dans le flux sur un écran large, sous le pouce sur un écran
    court : voir le point de rupture plus bas.
  */
  .thumb-bar {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .pad-key {
    position: relative;
    /*
      44 px est le minimum recommandé pour une cible tactile, et cette touche-ci
      l'a toujours respecté. Ce commentaire affirmait autrefois que toute
      l'interface le respectait : c'était faux — le sélecteur de thème, les
      onglets, les listes déroulantes et le curseur d'analyse étaient entre 20 et
      40 px. L'audit de l'incrément 8 les a mesurés et corrigés ; la règle vaut
      désormais partout, et le dire ici n'est plus un vœu.
    */
    min-height: 3.25rem;
    padding: 0.4rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-lg);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  .pad-key.exhausted {
    color: var(--text-faint);
    background: var(--surface-sunken);
  }

  /*
    Au doigt, l'appui est le seul état qui existe : sans lui, rien ne répondait
    avant que la grille ne se redessine. Couleur seule, sans déplacement — sous
    le doigt, un décalage est caché par la pulpe, c'est la teinte qu'on voit.
    L'appui est instantané ; le relâchement revient en fondu, par la transition
    de la règle de base.
  */
  .pad-key:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  /*
    Le survol n'existe qu'avec un pointeur qui survole. Sans cette garde, un
    navigateur mobile émule le survol au toucher et le laisse collé : la touche
    restait éclairée après qu'on avait posé le chiffre.
  */
  @media (hover: hover) and (pointer: fine) {
    .pad-key:hover {
      background: var(--surface-hover);
    }
  }

  .pad-count {
    position: absolute;
    top: 0.25rem;
    right: 0.4rem;
    color: var(--text-faint);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }

  .marks {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .mark-key {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    min-height: var(--tap);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text-muted);
    font: inherit;
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  /*
    Chaque touche porte sa lettre **et** sa couleur, et la touche active gagne un
    liseré épais. Trois signes pour une information, parce que la couleur seule
    n'en est pas un.
  */
  .mark-key[data-mark='1'] .mark-letter {
    color: var(--mark-a);
  }

  .mark-key[data-mark='2'] .mark-letter {
    color: var(--mark-b);
  }

  .mark-key[data-mark='3'] .mark-letter {
    color: var(--mark-c);
  }

  .mark-letter {
    font-size: var(--text-md);
    font-weight: 700;
  }

  .mark-key.active {
    border-color: var(--note-accent);
    border-width: 2px;
    background: var(--note-accent-soft);
    color: var(--text);
  }

  .mark-key:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .mark-key:hover {
      background: var(--surface-hover);
    }
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  .action {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    align-items: center;
    min-height: var(--tap-lg);
    padding: var(--space-2) 0.3rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  /*
    Désactivé : la teinte baisse, le curseur reste ordinaire. `not-allowed` est
    un curseur hostile, et il n'existe pas au doigt.
  */
  .action:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .action:active:not(:disabled) {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .action:hover:not(:disabled) {
      background: var(--surface-hover);
    }
  }

  .action.active {
    border-color: var(--note-accent);
    background: var(--note-accent-soft);
  }

  kbd {
    color: var(--text-faint);
    font-family: inherit;
    font-size: var(--text-xs);
  }

  .hint-button {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    align-items: center;
    min-height: var(--tap-lg);
    border: 1px solid var(--hint-border);
    border-radius: var(--radius-md);
    background: var(--hint-bg);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: box-shadow var(--dur-quick) var(--ease);
  }

  .hint-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* Le fond ambré porte déjà un sens : l'appui se dit par un liseré intérieur. */
  .hint-button:active:not(:disabled) {
    box-shadow: inset 0 0 0 2px var(--hint-border);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .hint-button:hover:not(:disabled) {
      box-shadow: inset 0 0 0 1px var(--hint-border);
    }
  }

  .tier {
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0;
    padding: var(--space-4) var(--space-4) var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .assists {
    display: grid;
    margin: 0;
    padding: var(--space-2) var(--space-4) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .assists-link {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: space-between;
    align-items: center;
    min-height: var(--tap);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  .assists-link:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .assists-link:hover {
      background: var(--surface-hover);
    }
  }

  .assists-count {
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }

  .assist {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap);
    color: var(--text);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .assist input {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: var(--accent);
  }

  legend {
    padding: 0 0.35rem;
    font-size: var(--text-sm);
    font-weight: 600;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  select {
    min-height: var(--tap);
    padding: 0.35rem var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  .level-description {
    margin: -0.2rem 0 0.2rem;
    color: var(--text-faint);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .primary {
    min-height: var(--tap);
    margin-top: 0.2rem;
    border: none;
    border-radius: var(--radius-md);
    background: var(--accent);
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  .secondary {
    min-height: var(--tap);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  .secondary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* Le curseur d'attente est informatif ici : la génération est en cours. */
  .primary:disabled {
    opacity: 0.5;
    cursor: progress;
  }

  .primary:active:not(:disabled) {
    background: var(--accent-active);
    transition-duration: 0s;
  }

  .secondary:active:not(:disabled) {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .secondary:hover:not(:disabled) {
      background: var(--surface-hover);
    }
  }

  .verdict {
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .verdict p {
    margin: 0 0 0.45rem;
  }

  .verdict p:last-child {
    margin-bottom: 0;
  }

  .second-dimension {
    margin: 0.35rem 0 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .provenance {
    margin-top: var(--space-2);
    color: var(--text-faint);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .provenance summary {
    min-height: var(--tap);
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .provenance p {
    margin: 0 0 var(--space-2);
  }

  .verdict .score {
    padding: 0.05rem 0.4rem;
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--text-muted);
    font-size: var(--text-sm);
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


  /*
    ─── La barre du pouce ──────────────────────────────────────────────────────

    Le critère est **la hauteur**, et c'est délibéré. Une tablette de 768×1024 a
    de la place : elle garde la disposition empilée. Un téléphone en paysage,
    844×390, n'en a pas : il reçoit la barre. Un critère de largeur seule se
    tromperait sur les deux.

    Le pavé passe en cinq colonnes plutôt que trois : sur 375 px, une touche
    mesure alors 63 px de large sur 48 de haut, les deux au-dessus de 44 px,
    contre trois rangées de 52 px qui occuperaient 44 % de l'écran. La dixième
    case libre de la seconde rangée attend la touche de marque.

    La hauteur réservée sous la page est déclarée plutôt que devinée : deux
    rangées de touches, un écart, la rangée d'actions, les remplissages. Le
    `1rem` supplémentaire absorbe l'imprécision au lieu de prétendre à une
    mesure qu'on n'a pas.
  */
  @media (max-width: 53.5rem) and (max-height: 50rem) {
    .page {
      padding-bottom: calc(var(--thumb-bar-reserve) + 1rem);
    }

    .thumb-bar {
      position: fixed;
      inset: auto 0 0;
      z-index: 10;
      gap: 0.4rem;
      /* Les encoches et la barre d'accueil : `env()` vaut 0 là où il n'existe pas. */
      padding: 0.5rem max(1rem, env(safe-area-inset-right))
        max(0.5rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
      border-top: 1px solid var(--border);
      background: var(--surface);
    }

    .thumb-bar > * {
      width: 100%;
      max-width: var(--board-max);
      margin-inline: auto;
    }

    .pad {
      grid-template-columns: repeat(5, 1fr);
      gap: 0.4rem;
    }

    .pad-key {
      min-height: var(--tap-lg);
      font-size: var(--text-md);
    }

    /*
      L'en-tête rend à la grille les pixels qu'il prenait.

      Mesuré avant/après sur 375×667 : en-tête et onglets occupaient 238 px, la
      grille commençait à 314 px et il n'en restait que 179 px de visible
      au-dessus de la barre. Après compression, elle commence à ~158 px et tient
      presque entièrement à l'écran — il reste une dizaine de pixels à faire
      défiler, ce qui est le prix honnête d'une grille carrée de 343 px sur un
      écran de 667.

      La signature disparaît ici, et seulement ici : « rien à installer, aucune
      publicité » s'adresse à quelqu'un qui découvre le site, pas à quelqu'un qui
      joue sur un écran de six pouces.
    */
    .page {
      padding-top: var(--space-3);
    }

    header {
      margin-bottom: var(--space-3);
    }

    h1 {
      font-size: var(--text-lg);
    }

    .tagline {
      display: none;
    }

    .tabs {
      gap: 0.15rem;
      margin-bottom: var(--space-3);
    }

    .tabs button {
      padding: 0.6rem var(--space-2);
      font-size: var(--text-sm);
    }

  }
</style>
