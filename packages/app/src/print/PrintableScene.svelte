<script lang="ts">
  import { cellsOf, propsOfCell } from '@sudoku/engine/investigation';
  import type { Scene, Suspect } from '@sudoku/engine/investigation';
  import { FURNITURE, LAYER_ORDER } from '../lib/investigation/furniture.js';
  import type { Material } from '../lib/investigation/furniture.js';
  import { SILL, WALL, planPaths } from '../lib/investigation/plan.js';

  interface Props {
    scene: Scene;
    /** Côté du plan sur le papier, en millimètres. */
    millimetres: number;
    /** Qui est posé où, par case. Vide pour une grille à remplir. */
    placed?: Readonly<Record<number, Suspect | undefined>>;
  }

  const { scene, millimetres, placed = {} }: Props = $props();

  /*
    ─── Pourquoi le plan imprimé n'a aucune couleur ──────────────────────────

    Deux raisons, et la première est mécanique. Un navigateur **n'imprime pas
    les fonds** par défaut : les pièces, qui se distinguent à l'écran par leur
    teinte, sortiraient en carrés blancs. `print-color-adjust: exact` le force,
    au prix d'un aplat de couleur sur chaque page et d'un comportement qui
    diffère d'un navigateur à l'autre.

    La seconde est une règle du projet : la couleur n'est jamais seule porteuse
    d'information. À l'écran, la teinte d'une pièce **double** son nom ; sur le
    papier, le nom suffit, et les murs font le reste. Le plan imprimé se lit donc
    à l'identique sur une imprimante couleur et sur une laser noir et blanc — ce
    qui est le cas de la plupart des imprimantes d'école.

    ─── Les gris du mobilier ─────────────────────────────────────────────────

    Chaque meuble est modelé par trois tons — face éclairée, matière, face dans
    l'ombre — sous une source de lumière unique en haut à gauche. Aplatir en un
    seul gris effacerait ce volume et rendrait les silhouettes molles. On garde
    donc **trois** gris, et le modelé survient sans une goutte de couleur.
  */
  const PAPER_INK = '#222222';
  const GREY: Readonly<Record<'light' | 'mid' | 'dark', string>> = {
    light: '#d8d8d8',
    mid: '#b4b4b4',
    dark: '#8c8c8c',
  };

  /** La matière devient un ton, et l'on ne garde que ce qui se voit à l'encre. */
  function greyOf(material: Material): string {
    if (material === 'ink') return PAPER_INK;
    if (material.endsWith('-light')) return GREY.light;
    if (material.endsWith('-dark')) return GREY.dark;
    return GREY.mid;
  }

  const size = $derived(scene.size);
  const paths = $derived(planPaths(scene));

  /** Les meubles d'une case, dans l'ordre où ils se superposent. */
  function furnitureOf(cell: number): { prop: string; parts: readonly { d: string; fill: Material }[] }[] {
    const present = propsOfCell(scene, cell);
    return LAYER_ORDER.filter((prop) => present.includes(prop)).map((prop) => ({
      prop,
      parts: FURNITURE[prop],
    }));
  }

  /**
   * Où poser le nom d'une pièce : sa case la plus en haut à gauche.
   *
   * C'est la convention d'un plan d'architecte, et elle a l'avantage d'être
   * stable — un centroïde tomberait parfois sur un mur ou sur un meuble.
   */
  function labelAnchor(cells: readonly number[]): { x: number; y: number } {
    let best = cells[0];
    for (const cell of cells) {
      const row = Math.floor(cell / size);
      const bestRow = Math.floor(best / size);
      if (row < bestRow || (row === bestRow && cell % size < best % size)) best = cell;
    }
    return { x: (best % size) + 0.08, y: Math.floor(best / size) + 0.3 };
  }

  const rooms = $derived(
    scene.zones.map((zone) => ({ name: zone.name, at: labelAnchor(cellsOf(zone.cells)) })),
  );

  /** Le quadrillage des cases : c'est là-dessus que le joueur écrit. */
  const cellGrid = $derived(
    Array.from({ length: size - 1 }, (_, index) => index + 1)
      .flatMap((line) => [`M${String(line)} 0V${String(size)}`, `M0 ${String(line)}H${String(size)}`])
      .join(''),
  );
</script>

<svg
  class="plan"
  viewBox="0 0 {size} {size}"
  width="{millimetres}mm"
  height="{millimetres}mm"
  role="img"
  aria-label="Plan de la scène, {size} rangées sur {size} colonnes"
>
  <!-- Le quadrillage d'abord, pour que les murs le recouvrent. -->
  <path d={cellGrid} fill="none" stroke="#bdbdbd" stroke-width="0.012" />

  {#each { length: size * size } as _, cell (cell)}
    {#each furnitureOf(cell) as piece (piece.prop)}
      <g transform="translate({cell % size} {Math.floor(cell / size)}) scale({1 / 24})">
        {#each piece.parts as part, index (index)}
          <path d={part.d} fill={greyOf(part.fill)} />
        {/each}
      </g>
    {/each}
  {/each}

  <!--
    Les murs et les seuils, dans le rapport quatre pour un d'ISO 128-23 : le mur
    coupé porte le trait le plus fort, le symbole de porte le plus fin.
  -->
  <path
    d={paths.walls}
    fill="none"
    stroke={PAPER_INK}
    stroke-width={WALL}
    stroke-linecap="square"
  />
  <path d={paths.sills} fill="none" stroke={PAPER_INK} stroke-width={SILL} stroke-linecap="butt" />

  <!-- Le pourtour, tracé en dernier pour qu'aucun meuble ne le mange. -->
  <rect
    x={WALL / 2}
    y={WALL / 2}
    width={size - WALL}
    height={size - WALL}
    fill="none"
    stroke={PAPER_INK}
    stroke-width={WALL}
  />

  {#each rooms as room (room.name)}
    <text x={room.at.x} y={room.at.y} class="room" fill={PAPER_INK}>{room.name}</text>
  {/each}

  <!--
    Les initiales déjà posées : c'est ce qui distingue le corrigé de la feuille
    à remplir. Sur la feuille à remplir, `placed` est vide et rien ne s'écrit.
  -->
  {#each Object.entries(placed) as [cell, suspect] (cell)}
    {#if suspect !== undefined}
      <text
        x={(Number(cell) % size) + 0.5}
        y={Math.floor(Number(cell) / size) + 0.72}
        class="letter"
        fill={PAPER_INK}>{suspect.letter}</text
      >
    {/if}
  {/each}
</svg>

<style>
  /*
    ⚠ Ce fichier est dans la liste d'exemption de `appStyles.test.ts` : le papier
    vit en millimètres, n'a pas de thème, et son noir est un vrai noir. Un
    `var(--text)` y imprimerait du gris clair.
  */
  .plan {
    display: block;
  }

  .room {
    font-family: var(--font-paper);
    /*
      0,17 case de haut : sur un plan de 96 mm, cela fait 2,7 mm, soit environ
      7,7 points — au-dessus des 6 points en deçà desquels un texte imprimé
      cesse d'être confortable, et assez petit pour tenir dans une pièce étroite.
    */
    font-size: 0.17px;
    letter-spacing: 0.004px;
  }

  .letter {
    font-family: var(--font-paper);
    font-size: 0.46px;
    font-weight: 700;
    text-anchor: middle;
  }
</style>
