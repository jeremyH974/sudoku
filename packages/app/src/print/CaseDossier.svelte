<script lang="ts">
  import type { CaseFile } from '@sudoku/engine/investigation';
  import CaseSheet from './CaseSheet.svelte';
  import { PAPER_SIZES, formatById, paperById } from './presets.js';
  /*
    ⚠ Les règles d'impression, **importées ici et pas ailleurs**.

    L'application est construite en trois paquets indépendants, exprès : un
    joueur de sudoku ne télécharge jamais le moteur d'Enquête. La contrepartie
    est qu'une feuille de style globale importée d'un seul côté n'existe pas de
    l'autre — et `print.css` ne l'était que par `PrintStudio.svelte`, donc
    seulement dans le paquet du sudoku. Le dossier d'enquête sortait de
    l'imprimante avec l'en-tête, les boutons, le plateau et les statistiques
    autour, et sans aucun saut de page.

    Rien ne le montrait à l'écran : l'aperçu était juste. `appStyles.test.ts`
    tient désormais la règle — qui pose une `.sheets` importe les règles qui la
    détachent.
  */
  import './print.css';
  import type { PaperSizeId } from './presets.js';

  interface Props {
    file: CaseFile;
    /** Le code de l'affaire, déjà calculé par l'appelant. */
    code: string;
    onClose: () => void;
  }

  const { file, code, onClose }: Props = $props();

  /**
   * Le dossier imprimé d'une affaire.
   *
   * ─── Deux feuilles, et pas une de plus ──────────────────────────────────────
   *
   * Le dossier, puis le corrigé — **dans cet ordre et séparés**, exactement
   * comme un cahier de sudoku : on imprime l'ensemble et on détache la
   * dernière. Intercaler le corrigé le rendrait visible par transparence et
   * impossible à retirer.
   *
   * ─── Pourquoi le format standard, sans choix de mise en page ────────────────
   *
   * Le cahier de sudoku propose deux presets parce qu'il met une, deux ou quatre
   * grilles par page. Un dossier d'enquête n'a pas ce degré de liberté : le plan
   * doit rester assez grand pour qu'on écrive dedans, et les témoignages doivent
   * tenir à côté. Une affaire par feuille est la seule mise en page qui marche,
   * donc il n'y a rien à régler.
   *
   * Le **papier**, lui, se choisit : A4 et US Letter n'ont ni la même largeur ni
   * la même hauteur, et une école américaine n'a pas d'A4.
   */
  const format = formatById('standard');

  let paperId = $state<PaperSizeId>('a4');
  const paper = $derived(paperById(paperId));

  /*
    La police est **chargée avant** d'ouvrir la boîte d'impression, et non dans
    `beforeprint`, qui se déclenche trop tard pour bloquer quoi que ce soit. Si
    elle échoue, on imprime quand même : un repli sur la pile système vaut mieux
    qu'un bouton mort.
  */
  const print = async (): Promise<void> => {
    try {
      await document.fonts.load("400 1em 'Patrick Hand'");
    } catch {
      // Police indisponible : le dossier sort dans la pile de repli.
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

<section class="dossier" aria-label="Dossier à imprimer">
  <div class="bar">
    <h3>Dossier à imprimer</h3>
    <label class="paper">
      Papier
      <select bind:value={paperId}>
        {#each PAPER_SIZES as size (size.id)}
          <option value={size.id}>{size.label}</option>
        {/each}
      </select>
    </label>
    <button type="button" class="action primary" onclick={() => void print()}>Imprimer</button>
    <button type="button" class="action" onclick={onClose}>Fermer</button>
  </div>

  <p class="note">
    Deux feuilles : le dossier, puis le corrigé. Détachez la seconde avant de donner la première.
    <!--
      L'avertissement d'échelle n'est pas de la coquetterie : le plan est coté en
      millimètres, et « Ajuster à la page » le rétrécit silencieusement. Chrome
      ne mémorise pas ce réglage d'une impression à l'autre, Firefox mémorise le
      dernier — donc parfois le mauvais.
    -->
    Dans la boîte d’impression, gardez l’échelle à <strong>100 %</strong> : « ajuster à la page »
    rétrécirait le plan, qui est coté pour qu’on écrive dedans.
  </p>

  <div
    class="sheets"
    style={`--sheet-width: ${String(paper.widthMm)}mm; --sheet-height: ${String(paper.heightMm)}mm;`}
  >
    <CaseSheet {file} {code} kind="dossier" {format} pageNumber={1} baseUrl={window.location.origin + window.location.pathname} />
    <CaseSheet {file} {code} kind="solution" {format} pageNumber={2} baseUrl={window.location.origin + window.location.pathname} />
  </div>
</section>

<style>
  /*
    Ce fichier n'est **pas** une feuille de papier : c'est l'aperçu à l'écran qui
    l'entoure. Il est donc tenu aux jetons comme n'importe quelle vue, et seuls
    `CaseSheet.svelte` et `PrintableScene.svelte` sont exemptés.
  */
  .dossier {
    margin-top: var(--space-5);
    border-top: 2px solid var(--ink);
    padding-top: var(--space-4);
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
    margin-bottom: var(--space-2);
  }

  h3 {
    margin: 0;
    margin-right: auto;
    font-size: var(--text-lg);
  }

  .paper {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--text-sm);
  }

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
    `:active` est le seul état qui existe, et un bouton qui réagit au survol mais
    pas à l'appui est muet sur la cible visée en premier.
  */
  .action:active:not(:disabled),
  .action.primary:active:not(:disabled) {
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .note {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
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
