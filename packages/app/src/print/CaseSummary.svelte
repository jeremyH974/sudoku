<script lang="ts">
  import { openCase } from '@sudoku/engine/investigation';
  import type { CaseFile } from '@sudoku/engine/investigation';
  import { summarise } from './layout.js';
  import type { Booklet } from './layout.js';
  import { effectiveMargins } from './presets.js';
  import type { PrintFormat } from './presets.js';

  interface Props {
    booklet: Booklet<CaseFile>;
    format: PrintFormat;
    pageNumber: number;
  }

  const { booklet, format, pageNumber }: Props = $props();

  const margins = $derived(effectiveMargins(format, pageNumber));
  const padding = $derived(
    `${String(margins.top)}mm ${String(margins.right)}mm ${String(margins.bottom)}mm ${String(margins.left)}mm`,
  );

  /**
   * Le sommaire d'un cahier d'enquêtes.
   *
   * ─── Ce qu'il compte, et ce qu'il se refuse à annoncer ──────────────────────
   *
   * Le sommaire d'un cahier de sudoku répartit les grilles **par niveau**, parce
   * que ces niveaux sont calibrés contre un oracle. L'enquête n'en a aucun, et
   * lui en inventer un serait le mensonge que ce projet refuse partout ailleurs.
   *
   * Il répartit donc par **décor** — un fait observable, qui se vérifie d'un coup
   * d'œil au plan, et qui dit quelque chose de vrai sur la variété du cahier.
   * Aucune difficulté n'est annoncée, ni en toutes lettres ni en sous-entendu.
   */
  const all = $derived(booklet.sheets.filter((sheet) => sheet.kind === 'puzzles').flatMap((sheet) => sheet.puzzles));
  const byDecor = $derived(summarise(all, (file) => openCase(file).scene.title));
</script>

<section class="sheet" style={`padding: ${padding};`}>
  <h2>{booklet.title}</h2>
  <p class="count">{booklet.puzzleCount} affaire{booklet.puzzleCount > 1 ? 's' : ''}</p>

  <table class="toc">
    <tbody>
      {#each byDecor as row (row.levelLabel)}
        <tr>
          <th scope="row">{row.levelLabel}</th>
          <td class="num">{row.count}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if booklet.firstSolutionPage !== null}
    <p class="detach">
      Les corrigés commencent page {booklet.firstSolutionPage} : détachez-les avant de distribuer.
    </p>
  {/if}

  <p class="rules">
    Dans chaque affaire, une personne par rangée et une par colonne. « À côté de » veut dire voisin
    direct <em>et dans la même pièce</em> : les murs arrêtent le regard. La victime était seule avec
    le meurtrier.
  </p>

  <p class="promise">Rien à installer. Aucune publicité, aucun compte, aucun suivi.</p>

  {#if format.showPageNumbers}
    <p class="folio">{pageNumber}</p>
  {/if}
</section>

<style>
  /*
    ⚠ Fichier de papier : exempté des règles de jetons dans `appStyles.test.ts`.
    Tout y est en millimètres, sans thème, et le noir y est un vrai noir.
  */
  .sheet {
    position: relative;
    box-sizing: border-box;
    width: var(--sheet-width);
    height: var(--sheet-height);
    overflow: hidden;
    background: #ffffff;
    color: #1a1a1a;
    font-family: var(--font-paper);
  }

  h2 {
    margin: 0 0 2mm;
    font-size: 9mm;
    font-weight: 700;
  }

  .count {
    margin: 0 0 8mm;
    font-size: 4.5mm;
    color: #444444;
  }

  .toc {
    border-collapse: collapse;
    min-width: 90mm;
    margin-bottom: 8mm;
  }

  .toc th,
  .toc td {
    border-bottom: 0.3mm solid #999999;
    padding: 2mm 4mm 2mm 0;
    text-align: left;
    font-size: 4mm;
    font-weight: 400;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .detach {
    margin: 0 0 8mm;
    padding: 3mm 4mm;
    border: 0.4mm solid #1a1a1a;
    font-size: 3.8mm;
  }

  .rules {
    margin: 0 0 6mm;
    max-width: 150mm;
    font-size: 3.9mm;
    line-height: 1.45;
  }

  .promise {
    margin: 0;
    font-size: 3.4mm;
    color: #555555;
  }

  .folio {
    position: absolute;
    right: 12mm;
    bottom: 8mm;
    margin: 0;
    font-size: 3mm;
    color: #666666;
  }
</style>
