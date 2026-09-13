<script lang="ts">
  import { encodeCase } from '@sudoku/engine/investigation';
  import type { CaseFile } from '@sudoku/engine/investigation';
  import CaseSheet from './CaseSheet.svelte';
  import CaseSummary from './CaseSummary.svelte';
  import { paginate } from './layout.js';
  import { PAPER_SIZES, PRINT_FORMATS, formatById, paperById } from './presets.js';
  import type { PaperSizeId, PrintFormatId } from './presets.js';
  import { engine } from '../lib/engineClient.js';
  /*
    ⚠ Les règles d'impression, **importées ici et pas ailleurs**.

    L'application est construite en trois paquets indépendants, exprès : un
    joueur de sudoku ne télécharge jamais le moteur d'Enquête. La contrepartie est
    qu'une feuille de style globale importée d'un seul côté n'existe pas de
    l'autre — et `print.css` ne l'était que par `PrintStudio.svelte`, donc
    seulement dans le paquet du sudoku. Le dossier d'enquête sortait de
    l'imprimante avec l'en-tête, les boutons, le plateau et les statistiques
    autour, et sans aucun saut de page.

    Rien ne le montrait à l'écran : l'aperçu était juste. `appStyles.test.ts`
    tient désormais la règle — qui pose une `.sheets` importe les règles qui la
    détachent.
  */
  import './print.css';

  interface Props {
    /** L'affaire en cours : ce que le cahier contient tant qu'on n'en compose pas. */
    current: CaseFile;
    onClose: () => void;
  }

  const { current, onClose }: Props = $props();

  /**
   * Le cahier d'enquêtes.
   *
   * ─── Une affaire par feuille, et ce n'est pas un réglage ────────────────────
   *
   * Le cahier de sudoku propose une ou plusieurs grilles par page. Un dossier
   * d'enquête n'a pas ce degré de liberté : le plan doit rester assez grand pour
   * qu'on écrive dedans — 18 mm par case, mesuré — et les témoignages doivent
   * tenir au-dessus. Une affaire par feuille est la seule mise en page qui
   * marche, donc `puzzlesPerSheet` est forcé à un plutôt qu'exposé.
   *
   * Les corrigés aussi, et c'est une dépense assumée : deux par feuille
   * économiseraient du papier, mais chacun porte un plan complet, qu'on lit mal
   * à moitié. À rouvrir le jour où quelqu'un imprimera vraiment quarante
   * affaires.
   *
   * ─── Ce que ce studio fait et que celui du sudoku ne fait pas ───────────────
   *
   * Il **s'annule** et il **dit quand il échoue**. Le studio du sudoku n'a ni
   * l'un ni l'autre : une génération lancée va jusqu'au bout, et si le moteur
   * rejette, l'exception remonte sans message — l'aperçu garde silencieusement
   * son contenu précédent. Les deux manques sont repris ici parce qu'ils sont
   * bon marché, pas parce que l'enquête serait plus fragile.
   *
   * L'annulation est un **drapeau coopératif** relu entre deux affaires, et non
   * un signal transféré au travailleur : `postMessage` d'un `AbortSignal` reste
   * une proposition ouverte du WHATWG, sans implémenteur. Composer une affaire
   * tient en 19 ms au médian, donc l'attente entre le clic et l'arrêt est celle
   * d'une seule affaire.
   */
  const MAX_CASES = 40;

  let title = $state('Cahier d’enquêtes');
  let count = $state(8);
  let formatId = $state<PrintFormatId>('standard');
  let paperId = $state<PaperSizeId>('a4');
  let includeSolutions = $state(true);

  /*
    Rien n'est composé tant qu'on ne le demande pas : le cahier montre l'affaire
    en cours, qui est déjà là et ne coûte rien. Dérivé plutôt que copié, sinon il
    resterait figé sur la première affaire ouverte.
  */
  let composed = $state<CaseFile[]>([]);
  let generating = $state(false);
  let produced = $state(0);
  let notice = $state('');
  let cancelling = false;

  const paper = $derived(paperById(paperId));
  /*
    Le format tel que l'utilisateur le choisit, mais avec une affaire par feuille
    — voir plus haut. Le reste (marges, reliure, sommaire, pagination) lui vient
    intact du preset.
  */
  const format = $derived({ ...formatById(formatId), puzzlesPerSheet: 1, solutionsPerSheet: 1 });
  const cases = $derived(composed.length > 0 ? composed : [current]);
  const booklet = $derived(paginate(cases, format, { title, includeSolutions }));
  const baseUrl = $derived(`${window.location.origin}${window.location.pathname}`);

  const codeOf = (file: CaseFile): string => encodeCase(file);

  /** Compose un cahier, une affaire à la fois, et rend la main si on l'arrête. */
  async function generate(): Promise<void> {
    generating = true;
    cancelling = false;
    produced = 0;
    notice = '';
    const collected: CaseFile[] = [];
    const stamp = Date.now();

    try {
      for (let index = 0; index < count; index++) {
        if (cancelling) break;
        /*
          Une graine lisible et distincte par affaire : elle se retrouve dans un
          rapport de bug, là où un entier de trente-deux bits ne se recopie pas.
          Elle ne sert qu'à cela — ce qui identifie une affaire est son code.
        */
        const file = await engine.composeCase(`cahier-${String(stamp)}-${String(index)}`);
        produced = index + 1;
        if (file !== null) collected.push(file);
      }

      if (collected.length > 0) composed = collected;
      const asked = cancelling ? produced : count;
      const missed = asked - collected.length;
      notice =
        (cancelling ? `Arrêté après ${String(produced)} affaire(s). ` : '') +
        `${String(collected.length)} affaire(s) au cahier` +
        (missed > 0 ? `, ${String(missed)} que la fabrique n’a pas rendue(s).` : '.');
    } catch (error) {
      // Le studio du sudoku n'a pas ce `catch`, et laisse l'aperçu mentir en
      // gardant son contenu précédent sans un mot. On le dit.
      notice = `Le moteur a échoué : ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      generating = false;
      cancelling = false;
    }
  }

  /*
    La police est chargée **avant** d'ouvrir la boîte d'impression, et non dans
    `beforeprint`, qui se déclenche trop tard pour bloquer quoi que ce soit. Si
    elle échoue, on imprime quand même : un repli sur la pile système vaut mieux
    qu'un bouton mort.
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
    écrite en dur, donc réécrite quand le papier change.
  -->
  {@html `<style>@page { size: ${paper.css}; margin: 0; }</style>`}
</svelte:head>

<section class="studio" aria-label="Cahier à imprimer">
  <div class="bar">
    <h3>Cahier à imprimer</h3>
    <button type="button" class="action primary" onclick={() => void print()} disabled={generating}>
      Imprimer
    </button>
    <button type="button" class="action" onclick={onClose}>Fermer</button>
  </div>

  <div class="settings">
    <label>
      Titre
      <input type="text" bind:value={title} maxlength="60" />
    </label>
    <label>
      Affaires
      <input type="number" bind:value={count} min="1" max={MAX_CASES} />
    </label>
    <label>
      Mise en page
      <select bind:value={formatId}>
        {#each PRINT_FORMATS as entry (entry.id)}
          <option value={entry.id}>{entry.label}</option>
        {/each}
      </select>
    </label>
    <label>
      Papier
      <select bind:value={paperId}>
        {#each PAPER_SIZES as size (size.id)}
          <option value={size.id}>{size.label}</option>
        {/each}
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={includeSolutions} />
      Joindre les corrigés
    </label>

    {#if generating}
      <button type="button" class="action" onclick={() => (cancelling = true)}>
        Arrêter ({produced} / {count})
      </button>
    {:else}
      <button type="button" class="action" onclick={() => void generate()}>Composer</button>
    {/if}
  </div>

  {#if generating}
    <!--
      La progression est déjà dans le libellé du bouton, qui est du texte. Cette
      barre n'ajoute rien pour un lecteur d'écran, seulement pour l'œil — d'où
      `aria-hidden`. C'est le choix que le studio du sudoku a déjà tranché.
    -->
    <div class="progress" aria-hidden="true">
      <span style={`width: ${String(Math.min(100, (produced / Math.max(count, 1)) * 100))}%;`}></span>
    </div>
  {/if}

  <p class="note" role="status">
    {#if notice !== ''}{notice}{:else}
      {cases.length} affaire{cases.length > 1 ? 's' : ''} au cahier{includeSolutions
        ? ', corrigés joints à la fin'
        : ''}. Dans la boîte d’impression, gardez l’échelle à <strong>100 %</strong> : « ajuster à
      la page » rétrécirait les plans, qui sont cotés pour qu’on écrive dedans.
    {/if}
  </p>

  <div
    class="sheets"
    style={`--sheet-width: ${String(paper.widthMm)}mm; --sheet-height: ${String(paper.heightMm)}mm;`}
  >
    {#each booklet.sheets as sheet (sheet.pageNumber)}
      {#if sheet.kind === 'summary'}
        <CaseSummary {booklet} {format} pageNumber={sheet.pageNumber} />
      {:else}
        {#each sheet.puzzles as file (codeOf(file))}
          <CaseSheet
            {file}
            code={codeOf(file)}
            kind={sheet.kind === 'solutions' ? 'solution' : 'dossier'}
            {format}
            pageNumber={sheet.pageNumber}
            {baseUrl}
          />
        {/each}
      {/if}
    {/each}
  </div>
</section>

<style>
  /*
    Ce fichier n'est **pas** une feuille de papier : c'est l'aperçu à l'écran qui
    l'entoure. Il est donc tenu aux jetons comme n'importe quelle vue, et seuls
    `CaseSheet.svelte`, `CaseSummary.svelte` et `PrintableScene.svelte` sont
    exemptés.
  */
  .studio {
    margin-top: var(--space-5);
    border-top: 2px solid var(--ink);
    padding-top: var(--space-4);
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    margin-bottom: var(--space-3);
  }

  h3 {
    margin: 0;
    margin-right: auto;
    font-size: var(--text-lg);
  }

  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-4);
    align-items: flex-end;
    margin-bottom: var(--space-3);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  label.check {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
  }

  input,
  select {
    min-height: var(--tap);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-2);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
  }

  input[type='checkbox'] {
    min-height: auto;
    width: var(--space-4);
    height: var(--space-4);
  }

  .action {
    min-height: var(--tap);
    padding: var(--space-2) var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    box-shadow: var(--shadow-hard);
  }

  .action.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  @media (hover: hover) {
    .action:hover:not(:disabled) {
      background: var(--surface-hover);
    }

    .action.primary:hover:not(:disabled) {
      background: var(--accent-hover);
    }
  }

  /*
    Chaque sélecteur survolé a son pendant pressé, `.primary` compris : au doigt,
    `:active` est le seul état qui existe.
  */
  .action:active:not(:disabled),
  .action.primary:active:not(:disabled) {
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .progress {
    height: var(--space-2);
    margin-bottom: var(--space-3);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    overflow: hidden;
  }

  .progress span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .note {
    margin: 0 0 var(--space-4);
    max-width: var(--measure);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
    color: var(--text-muted);
  }

  /*
    L'aperçu : les feuilles posées sur un fond, à l'échelle. `print.css` les
    détache de ce fond au moment d'imprimer.
  */
  .sheets {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--surface-sunken);
    overflow-x: auto;
  }
</style>
