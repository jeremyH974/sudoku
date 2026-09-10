<script lang="ts">
  import PrintableGrid from './PrintableGrid.svelte';
  import QrCode from './QrCode.svelte';
  import { summarise } from './layout.js';
  import type { Booklet, Sheet } from './layout.js';
  import { effectiveMargins } from './presets.js';
  import type { PrintFormat } from './presets.js';

  interface Props {
    sheet: Sheet;
    format: PrintFormat;
    booklet: Booklet;
    /** Base des liens de reprise, jusqu'au « # » exclu. */
    baseUrl: string;
  }

  const { sheet, format, booklet, baseUrl }: Props = $props();

  const margins = $derived(effectiveMargins(format, sheet.pageNumber));
  const padding = $derived(
    `${String(margins.top)}mm ${String(margins.right)}mm ${String(margins.bottom)}mm ${String(margins.left)}mm`,
  );

  const linkFor = (code: string): string => `${baseUrl}#g=${code}`;

  /** Le code en groupes de cinq : illisible d'un bloc, saisissable ainsi. */
  const grouped = (code: string): string => code.replace(/(.{5})/g, '$1 ').trim();
</script>

<section class="sheet" style={`padding: ${padding};`}>
  {#if sheet.kind === 'summary'}
    <div class="summary">
      <!--
        `h2` et non `h1` : la feuille de garde vit dans la même page que
        l'application, dont le titre est déjà le `h1`. Deux `h1` dans un document
        privent un lecteur d'écran de son repère principal. À l'impression, la
        distinction ne se voit pas — la taille est fixée en millimètres.
      -->
      <h2>{booklet.title}</h2>
      <p class="count">{booklet.puzzleCount} grilles</p>

      <table class="toc">
        <tbody>
          {#each summarise(sheet.puzzles) as row (row.levelLabel)}
            <tr>
              <td>{row.levelLabel}</td>
              <td class="num">{row.count}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      {#if booklet.firstSolutionPage !== null}
        <p class="detach">
          Corrigés à partir de la page {booklet.firstSolutionPage} — détachez-les avant de
          distribuer le cahier.
        </p>
      {/if}

      <p class="promise">
        Chaque grille admet une solution unique et se résout par le seul raisonnement, sans
        jamais avoir à deviner.
      </p>
    </div>
  {:else if sheet.kind === 'puzzles'}
    {#each sheet.puzzles as item (item.index)}
      <article class="puzzle">
        <header>
          <span class="index">Grille {item.index}</span>
          <span class="level">{item.levelLabel}</span>
          <span class="label">{item.label}</span>
        </header>

        <div class="board">
          <PrintableGrid values={item.puzzle} />
        </div>

        <footer>
          <QrCode value={linkFor(item.code)} label={`Ouvrir la grille ${item.label}`} />
          <div class="reprise">
            <p class="hint">Scannez pour jouer cette grille à l’écran, ou saisissez :</p>
            <p class="code">{grouped(item.code)}</p>
          </div>
        </footer>
      </article>
    {/each}
  {:else}
    <h2 class="solutions-title">Corrigés</h2>
    <div class="solutions">
      {#each sheet.puzzles as item (item.index)}
        <figure>
          <figcaption>Grille {item.index} · {item.label}</figcaption>
          <PrintableGrid values={item.solution} scale="compact" />
        </figure>
      {/each}
    </div>
  {/if}

  {#if format.showPageNumbers}
    <div class="page-number">{sheet.pageNumber}</div>
  {/if}
</section>

<style>
  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: var(--sheet-width);
    height: var(--sheet-height);
    background: #fff;
    color: #000;
    /* Rien ne doit déborder d'une feuille sur la suivante. */
    overflow: hidden;
    font-family: Georgia, 'Times New Roman', serif;
  }

  .summary {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }

  .summary h2 {
    margin: 0 0 0.4rem;
    font-size: 9mm;
    letter-spacing: -0.01em;
  }

  .count {
    margin: 0 0 12mm;
    font-size: 4mm;
  }

  .toc {
    margin: 0 auto 12mm;
    border-collapse: collapse;
    min-width: 60mm;
    font-size: 4mm;
  }

  .toc td {
    padding: 1.5mm 4mm;
    border-bottom: 0.3pt solid #999;
    text-align: left;
  }

  .toc .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .detach {
    margin: 0 auto 6mm;
    max-width: 110mm;
    font-size: 3.4mm;
    font-style: italic;
  }

  .promise {
    margin: 0 auto;
    max-width: 110mm;
    font-size: 3.2mm;
    color: #333;
  }

  .puzzle {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .puzzle header {
    display: flex;
    gap: 4mm;
    align-items: baseline;
    margin-bottom: 4mm;
    padding-bottom: 2mm;
    border-bottom: 0.5pt solid #000;
  }

  .index {
    font-size: 5mm;
    font-weight: 700;
  }

  .level {
    flex: 1;
    font-size: 4mm;
  }

  .label {
    color: #555;
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 3.2mm;
    letter-spacing: 0.08em;
  }

  .board {
    /* La grille occupe la largeur disponible et reste carrée. */
    width: 100%;
    max-width: 100%;
  }

  .puzzle footer {
    display: flex;
    gap: 5mm;
    align-items: center;
    margin-top: auto;
    padding-top: 5mm;
  }

  .reprise {
    flex: 1;
  }

  .hint {
    margin: 0 0 1mm;
    font-size: 3mm;
    color: #444;
  }

  .code {
    margin: 0;
    font-family: ui-monospace, 'Courier New', monospace;
    font-size: 3mm;
    letter-spacing: 0.04em;
    word-break: break-all;
  }

  .solutions-title {
    margin: 0 0 6mm;
    font-size: 6mm;
  }

  .solutions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8mm 10mm;
  }

  figure {
    margin: 0;
  }

  figcaption {
    margin-bottom: 1.5mm;
    font-size: 3.2mm;
    font-weight: 600;
  }

  .page-number {
    position: absolute;
    right: 0;
    bottom: 6mm;
    left: 0;
    font-size: 3mm;
    text-align: center;
  }
</style>
