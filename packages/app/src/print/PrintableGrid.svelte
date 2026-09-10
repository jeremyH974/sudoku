<script lang="ts">
  import { EMPTY, SIZE } from '@sudoku/engine';

  interface Props {
    values: readonly number[];
    /** `full` pour une grille à jouer, `compact` pour un corrigé. */
    scale?: 'full' | 'compact';
  }

  const { values, scale = 'full' }: Props = $props();
</script>

<!--
  Grille destinée au papier, délibérément distincte de celle de l'écran.

  `SudokuBoard.svelte` porte la sélection, le focus, les conflits, le survol des
  pairs — tout ce qui n'a aucun sens une fois imprimé, et dont les aplats de
  couleur coûteraient de l'encre sans rien apporter. Ici : des filets nets, des
  chiffres lisibles, rien d'autre.
-->
<table class="grid" class:compact={scale === 'compact'}>
  <tbody>
    {#each { length: SIZE } as _, row (row)}
      <tr class:band={row % 3 === 2 && row !== SIZE - 1}>
        {#each { length: SIZE } as _, col (col)}
          {@const value = values[row * SIZE + col]}
          <td class:stack={col % 3 === 2 && col !== SIZE - 1}>
            {value === EMPTY ? '' : value}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .grid {
    /*
      Une table, et non une grille CSS : c'est la structure que les moteurs
      d'impression paginent le plus fidèlement, et elle ne se disloque pas quand
      le navigateur ajuste l'échelle à la page.
    */
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    aspect-ratio: 1;
    color: #000;
    font-variant-numeric: tabular-nums;
  }

  td {
    width: calc(100% / 9);
    height: calc(100% / 9);
    padding: 0;
    border: 0.4pt solid #000;
    font-size: 5.2mm;
    font-weight: 500;
    text-align: center;
    vertical-align: middle;
  }

  /*
    Filets de bloc : trois fois plus épais que les filets de case. Sans ce
    contraste, l'œil ne découpe plus les blocs de 3×3 et la grille devient
    fatigante à lire — le défaut le plus courant des grilles imprimées trouvées
    en ligne.
  */
  tr.band td {
    border-bottom-width: 1.2pt;
  }

  td.stack {
    border-right-width: 1.2pt;
  }

  .grid tr:first-child td {
    border-top-width: 1.2pt;
  }

  .grid tr:last-child td {
    border-bottom-width: 1.2pt;
  }

  .grid td:first-child {
    border-left-width: 1.2pt;
  }

  .grid td:last-child {
    border-right-width: 1.2pt;
  }

  .grid.compact td {
    border-width: 0.3pt;
    font-size: 2.6mm;
  }

  .grid.compact tr.band td {
    border-bottom-width: 0.8pt;
  }

  .grid.compact td.stack {
    border-right-width: 0.8pt;
  }
</style>
