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

    /*
      Filets de bloc : quatre fois et demie plus épais que les filets de case —
      2,25 pt contre 0,5 pt, soit environ 0,8 mm contre 0,18 mm, l'écart que
      pratiquent les grilles de presse. Sans ce contraste, l'œil ne découpe plus
      les blocs de 3×3 et la grille devient fatigante à lire.

      Le rapport était de trois, 1,2 pt contre 0,4 pt : sur le premier cahier
      imprimé par un regard extérieur, à la mise en ligne, les blocs ne se
      distinguaient pas — la réduction à la page amincit encore les filets. Les
      deux épaisseurs restent noires, et c'est délibéré : un filet gris
      disparaît à la photocopie, sort ordinaire d'une feuille d'exercices.
    */
    --rule-thin: 0.5pt;
    --rule-thick: 2.25pt;
  }

  /* Le corrigé, plus petit, garde le même rapport à une échelle réduite. */
  .grid.compact {
    --rule-thin: 0.3pt;
    --rule-thick: 1.35pt;
  }

  td {
    width: calc(100% / 9);
    height: calc(100% / 9);
    padding: 0;
    border: var(--rule-thin) solid #000;
    font-size: 5.2mm;
    font-weight: 500;
    text-align: center;
    vertical-align: middle;
  }

  tr.band td {
    border-bottom-width: var(--rule-thick);
  }

  td.stack {
    border-right-width: var(--rule-thick);
  }

  .grid tr:first-child td {
    border-top-width: var(--rule-thick);
  }

  .grid tr:last-child td {
    border-bottom-width: var(--rule-thick);
  }

  .grid td:first-child {
    border-left-width: var(--rule-thick);
  }

  .grid td:last-child {
    border-right-width: var(--rule-thick);
  }

  .grid.compact td {
    font-size: 2.6mm;
  }
</style>
