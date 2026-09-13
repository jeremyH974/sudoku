<script lang="ts">
  import { onDestroy } from 'svelte';
  import { LEVELS, encodeGrid, gridLabel, levelInfo } from '@sudoku/engine';
  import type { Level } from '@sudoku/engine';
  import { engine } from '../lib/engineClient.js';
  import PrintSheet from './PrintSheet.svelte';
  import { runBatch } from './batch.js';
  import type { BatchResult } from './batch.js';
  import { paginate } from './layout.js';
  import type { PrintablePuzzle } from './layout.js';
  import { PAPER_SIZES, PRINT_FORMATS, formatById, paperById } from './presets.js';
  import type { PaperSizeId, PrintFormatId } from './presets.js';
  import './print.css';

  /*
    Les valeurs de départ sont nommées parce qu'elles servent **deux fois** : aux
    réglages eux-mêmes, et à la copie figée plus bas. Lire `level` au moment de
    déclarer cette copie reviendrait au même, mais Svelte avertit à juste titre
    qu'on n'en capture que la valeur initiale — ici c'est voulu, et le dire par la
    structure vaut mieux que le dire dans un commentaire.
  */
  const FIRST_LEVEL: Level = 'moyen';
  const FIRST_COUNT = 6;

  let title = $state('Cahier de sudoku');
  let level = $state<Level>(FIRST_LEVEL);
  let count = $state(FIRST_COUNT);
  let formatId = $state<PrintFormatId>('standard');
  let paperId = $state<PaperSizeId>('a4');
  let includeSolutions = $state(true);

  let puzzles = $state<PrintablePuzzle[]>([]);
  let generating = $state(false);
  let produced = $state(0);
  let notice = $state('');
  /*
    Hors des runes à dessein : ce drapeau est relu par `runBatch`, dans une
    fonction ordinaire qui n'a pas besoin d'être réactive. Un `$state` ici
    n'apporterait rien et suggérerait à tort que l'affichage en dépend.
  */
  let stopping = false;

  const format = $derived(formatById(formatId));
  const paper = $derived(paperById(paperId));
  const booklet = $derived(paginate(puzzles, format, { title, includeSolutions }));

  /** Base des liens de reprise : l'adresse de l'application, sans fragment. */
  const baseUrl = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  });

  /**
   * Les réglages **figés au lancement**, et non relus en cours de route.
   *
   * Les champs restent utilisables pendant la production — on n'ôte pas un
   * réglage à quelqu'un qui attend. Mais un cahier doit être celui qu'on a
   * commandé : sans cette copie, changer le niveau à mi-parcours mélangeait deux
   * paliers dans le même cahier **et** faisait compter les grilles déjà faites
   * comme « n'ayant pas atteint le niveau », alors qu'elles avaient atteint celui
   * qu'on demandait à l'époque. Le compteur du bouton avait la même maladie :
   * baisser le nombre affichait « 6 / 5 ».
   */
  let asked = $state<{ level: Level; count: number }>({
    level: FIRST_LEVEL,
    count: FIRST_COUNT,
  });

  /** Une grille du niveau demandé, mise en forme pour le papier. */
  async function makeOne(): Promise<PrintablePuzzle | null> {
    const result = await engine.generateAtLevel({
      level: asked.level,
      symmetry: 'rotational180',
    });
    if (result === null) return null;

    const grid = Uint8Array.from(result.puzzle);
    return {
      // Renuméroté après coup : ici on ne sait pas encore combien de tentatives
      // auront abouti, ni si l'on s'arrêtera en route.
      index: 0,
      puzzle: [...result.puzzle],
      solution: [...result.solution],
      level: result.rating.level ?? asked.level,
      levelLabel: levelInfo(result.rating.level ?? asked.level).label,
      score: result.rating.score,
      label: gridLabel(grid),
      code: encodeGrid(grid),
    };
  }

  /**
   * Produit le cahier, une grille après l'autre.
   *
   * Les requêtes sont enchaînées plutôt que lancées en parallèle : le moteur
   * tourne dans un unique Web Worker qui les traiterait de toute façon à la
   * suite, et cet enchaînement donne une progression réelle — non une barre qui
   * saute de zéro à cent. À plusieurs secondes par grille aux niveaux élevés,
   * sans ce retour l'utilisateur conclurait à un blocage.
   *
   * La boucle elle-même vit dans `batch.ts`, où elle se teste sans worker : ce
   * composant ne garde que ce qui lui est propre — fabriquer une grille, et dire
   * ce qui s'est passé.
   */
  async function generate(): Promise<void> {
    generating = true;
    stopping = false;
    produced = 0;
    notice = '';
    /*
      `bind:value` sur un champ numérique vide rend `null`, et `min="1"` ne borne
      que la validation du formulaire, jamais la valeur liée. Sans ce garde-fou,
      un champ effacé figeait `null` pour toute la production : zéro tour de
      boucle, et un bouton annonçant « Arrêter · 0 / ».
    */
    asked = { level, count: Math.max(1, Math.trunc(count || 1)) };

    try {
      const result = await runBatch<PrintablePuzzle>({
        count: asked.count,
        make: makeOne,
        stopped: () => stopping,
        onAttempt: (attempted) => (produced = attempted),
      });

      /*
        L'aperçu suit le message, même quand il n'y a plus rien à montrer : garder
        les grilles précédentes en annonçant un échec était le défaut, on affichait
        un cahier dont on ne parlait pas — et c'est celui-là qui serait sorti de
        l'imprimante.

        **Sauf si rien n'a été tenté.** Une boucle qui n'a pas fait un tour n'a
        rien à dire du cahier en place : elle le laisse. C'est ce qui rend un
        double-clic inoffensif, et c'est aussi la bonne réponse en soi — « je n'ai
        rien produit » ne justifie pas de jeter ce qui était là.
      */
      if (result.attempted > 0) {
        puzzles = result.items.map((puzzle, rank) => ({ ...puzzle, index: rank + 1 }));
      }
      notice = noticeOf(result);
    } finally {
      /*
        Dans un `finally` : aucun jet n'est atteignable entre les deux — `runBatch`
        attrape tout ce que la fabrique lève — mais un studio bloqué sur « Arrêter »
        sans moyen d'en sortir est une panne qu'on ne veut pas devoir diagnostiquer.
      */
      generating = false;
      stopping = false;
    }
  }

  /**
   * Ce que le cahier dit de lui-même.
   *
   * Quatre situations, et aucune ne se tait : le compte demandé atteint, un
   * niveau manqué dans le temps imparti, un arrêt volontaire, une panne du
   * moteur. Le cas où la fabrique ne rend rien du tout est compté à part : il
   * « ne devrait pas arriver », ce qui est précisément la raison de le dire s'il
   * arrive.
   */
  function noticeOf(result: BatchResult<PrintablePuzzle>): string {
    const wanted = LEVELS.find((l) => l.id === asked.level)?.label ?? asked.level;
    const kept = result.items.length;
    const parts: string[] = [];

    if (result.stopped) parts.push(`Arrêté après ${String(result.attempted)} tentative(s).`);
    if (result.failure !== null) parts.push(`Le moteur a échoué : ${result.failure}`);

    /*
      Rien de tenté, donc rien à dire du cahier : il n'a pas bougé, et l'annoncer
      vaut mieux que de compter jusqu'à zéro devant un aperçu inchangé — ce serait
      le bandeau qui contredit l'écran, exactement ce qu'on corrige ici.
    */
    if (result.attempted === 0) {
      parts.push(
        puzzles.length > 0 ? 'Le cahier précédent est conservé.' : 'Aucune grille produite.',
      );
      return parts.join(' ');
    }

    const offLevel = result.items.filter((puzzle) => puzzle.level !== asked.level).length;
    const empty = result.attempted - kept;
    parts.push(
      offLevel === 0
        ? `${String(kept)} grille(s) de niveau ${wanted}.`
        : `${String(kept)} grille(s), dont ${String(offLevel)} n’ont pas atteint le niveau ${wanted} dans le temps imparti.`,
    );
    if (empty > 0) parts.push(`${String(empty)} tentative(s) n’ont rien donné.`);

    return parts.join(' ');
  }

  /*
    Quitter l'onglet arrête la production.

    Sans cela, changer d'onglet en pleine génération laissait la boucle tourner
    contre un composant détruit : le seul bouton capable de l'arrêter n'existait
    plus, `stopping` restait faux, et soixante grilles Diaboliques pouvaient
    occuper le moteur plusieurs minutes — pendant lesquelles le « Générer » de la
    partie, désactivé tant que le moteur ne répond pas, attendait son tour. Le
    résultat, lui, était écrit dans une instance morte.
  */
  onDestroy(() => {
    if (generating) stop();
  });

  /**
   * Arrête la production, et **tout de suite**.
   *
   * Le drapeau seul ne suffirait pas : il est relu entre deux grilles, et une
   * grille peut demander jusqu'aux huit secondes du budget du générateur. Tuer
   * le worker est le seul moyen d'interrompre un calcul synchrone — le pourquoi,
   * le coût mesuré et ce qui reste non mesuré sont dans `engineClient.ts`.
   *
   * C'est là que ce studio diffère de celui de l'enquête, qui se contente du
   * drapeau : une affaire se compose en 19 ms à la médiane, donc l'attente y est
   * déjà imperceptible. Le mécanisme suit le coût de l'unité produite, il n'est
   * pas une question de goût.
   */
  function stop(): void {
    stopping = true;
    engine.stop();
  }

  /*
    On attend la police **avant** d'ouvrir la boîte d'impression.

    Une `@font-face` n'est téléchargée que lorsque le navigateur juge la police
    employée par ce qu'il rend. La manuscrite ne sert qu'au cahier : sur un cache
    froid, le premier « Imprimer » partait donc en police de repli — un défaut
    invisible en développement, où le cache est toujours chaud.

    `font-display` ne répare pas ça : aucune de ses valeurs ne promet que la
    police custom soit ce qui part sur le papier si l'impression tombe pendant
    le chargement. Le seul mécanisme fiable est ce verrou, et ce n'est pas une
    préférence — c'est le correctif que Puppeteer a dû s'appliquer à lui-même
    (commit 59bffce, « fix: wait for fonts before pdf printing »).

    Il vit dans le gestionnaire du bouton et **pas** dans `beforeprint`, qui se
    déclenche trop tard pour bloquer quoi que ce soit. Et s'il échoue, on
    imprime quand même : un repli sur le titre vaut mieux qu'un bouton mort.
  */
  const print = async (): Promise<void> => {
    try {
      await document.fonts.load("400 1em 'Patrick Hand'");
    } catch {
      // Police indisponible : le cahier sort dans la pile de repli.
    }
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

    <!--
      **Un seul bouton**, dont le libellé et l'action changent — et non deux sous
      un `{#if}`, qui paraissait plus clair et ne l'était pas.

      Deux boutons échangés au même endroit sont détruits et recréés : le focus
      clavier retombe sur `<body>`, deux fois par cahier. Quelqu'un qui navigue
      au clavier perdrait sa place au moment précis où il vient d'agir, et devrait
      retraverser la page pour atteindre « Arrêter ». Le même élément qui change
      de texte garde son identité, donc le focus.

      Il porte aussi la progression, qui est donc du texte — c'est ce qui permet à
      la barre en dessous de se dire décorative.

      ⚠ Un double-clic active donc l'arrêt juste après le lancement. C'est sans
      conséquence **par construction** : un arrêt qui n'a rien tenté ne touche pas
      à l'aperçu (voir `generate`). Sans cette garantie, un doigt trop rapide
      effacerait un cahier de quarante grilles.
    -->
    <button
      type="button"
      class="primary"
      onclick={() => (generating ? stop() : void generate())}
    >
      {#if generating}Arrêter · {produced} / {asked.count}{:else}Générer le cahier{/if}
    </button>

    {#if generating}
      <!--
        La barre est l'image d'une information déjà dite — le bouton annonce
        « Génération… 3 / 6 » —, elle est donc masquée aux lecteurs d'écran. Et
        dessinée plutôt que native : le `<progress>` natif ignorait la palette,
        thème sombre compris.
      -->
      <div class="progress" aria-hidden="true">
        <div
          class="progress-value"
          style={`width: ${String(Math.min(100, (produced / Math.max(asked.count, 1)) * 100))}%`}
        ></div>
      </div>
      <p class="hint">
        Les niveaux élevés demandent une recherche dirigée : quelques secondes par grille sont
        normales.
      </p>
    {/if}

    <!--
      La région vivante est **permanente**, et c'était un défaut de ne pas l'être.
      Un `role="status"` créé en même temps que son texte n'est pas annoncé : le
      lecteur d'écran doit avoir vu la région vide pour remarquer qu'elle change.
      Le message d'échec que ce studio vient de gagner serait resté muet pour
      exactement les personnes qui ne voient pas l'aperçu. L'annonceur global de
      `App.svelte` suit ce motif depuis toujours ; ce coin-ci l'avait manqué.
    -->
    <p class="notice" role="status" aria-live="polite" class:silent={notice === ''}>{notice}</p>

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
    gap: var(--space-6);
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
    gap: var(--space-3);
    max-width: 20rem;
  }

  h2 {
    margin: 0;
    font-size: var(--text-md);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  label.checkbox {
    flex-direction: row;
    gap: var(--space-2);
    align-items: center;
    min-height: var(--tap);
  }

  input[type='text'],
  input[type='number'],
  select {
    min-height: var(--tap);
    padding: 0.35rem var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }

  .hint {
    margin: -0.2rem 0 0.2rem;
    color: var(--text-faint);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
    font-size: var(--text-sm);
  }

  /*
    Vide, elle reste dans le document — sans quoi elle ne serait pas annoncée —
    mais ne doit pas peindre une pastille grise sous les réglages. `display: none`
    la retirerait de l'arbre d'accessibilité, ce qui ramènerait le défaut ;
    `padding: 0` et pas de fond suffisent, et sa boîte est alors de hauteur nulle.
    Elle consomme encore un `gap` de la colonne, ce qui se voit comme un peu d'air
    de plus sous le bouton — le prix d'une région qui reste annonçable.

    `silent` et non `empty` : `.empty` est déjà le texte d'accueil de l'aperçu,
    et un sélecteur non scopé aurait attrapé les deux.
  */
  .notice.silent {
    padding: 0;
    background: none;
  }

  .primary,
  .secondary {
    min-height: var(--tap);
    border: none;
    border-radius: var(--radius-md);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
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

  /*
    Plus aucun bouton grisé ici : pendant la génération, celui-ci devient
    « Arrêter » et reste bien vivant. Le curseur d'attente qui l'accompagnait —
    et la règle `:disabled` qui le posait — sont partis avec lui. Les gardes
    `:not(:disabled)` restent : elles ne coûtent rien et redeviendraient utiles
    si un état désactivé revenait un jour.
  */
  .primary:active:not(:disabled) {
    background: var(--accent-active);
    transition-duration: 0s;
  }

  .secondary:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  @media (hover: hover) and (pointer: fine) {
    .primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }

    .secondary:hover {
      background: var(--surface-hover);
    }
  }

  /*
    Sans transition : elle avance d'une grille à la fois, et un fondu la ferait
    paraître en retard sur le compteur du bouton.
  */
  .progress {
    height: 0.5rem;
    overflow: hidden;
    border-radius: var(--radius-pill);
    background: var(--surface-sunken);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .progress-value {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .preview {
    flex: 1 1 22rem;
    min-width: 0;
  }

  .empty {
    max-width: var(--measure);
    color: var(--text-muted);
    line-height: var(--leading-prose);
  }

  /*
    L'aperçu montre les feuilles telles qu'elles sortiront : fond sombre autour,
    papier blanc, ombre portée. Voir la page flotter évite la mauvaise surprise
    au moment d'imprimer.
  */
  .sheets {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    align-items: center;
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    overflow-x: auto;
  }

  .sheets :global(.sheet) {
    flex: none;
    box-shadow: var(--shadow-floating);
  }
</style>
