<script lang="ts">
  import qrcode from 'qrcode-generator';

  interface Props {
    /** Contenu encodé, en pratique l'URL de reprise de la grille. */
    value: string;
    /** Côté du carré, en millimètres — l'unité de l'impression. */
    sizeMm?: number;
    label?: string;
  }

  const { value, sizeMm = 22, label = 'Code de reprise de la grille' }: Props = $props();

  /**
   * Correction d'erreur au niveau M (~15 %).
   *
   * Choisi pour l'usage réel : une feuille photocopiée, pliée, posée sur un coin
   * de table. Le niveau L serait plus compact mais fragile au moindre défaut
   * d'impression ; Q et H gonfleraient le motif sans bénéfice à cette taille.
   */
  const matrix = $derived.by(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    return qr;
  });

  const moduleCount = $derived(matrix.getModuleCount());

  /**
   * Un seul tracé pour tout le motif, plutôt qu'un millier de rectangles.
   *
   * À 33 modules de côté, cela fait plus de mille éléments SVG si on les dessine
   * séparément — et autant de nœuds à imprimer pour chaque grille du cahier. Un
   * `path` unique reste léger quel que soit le nombre de grilles.
   */
  const path = $derived.by(() => {
    let d = '';
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (matrix.isDark(row, col)) d += `M${String(col)} ${String(row)}h1v1h-1z`;
      }
    }
    return d;
  });

  /** Marge blanche obligatoire autour du motif, sans quoi les lecteurs échouent. */
  const QUIET_ZONE = 2;
  const viewBox = $derived(
    `${String(-QUIET_ZONE)} ${String(-QUIET_ZONE)} ${String(moduleCount + QUIET_ZONE * 2)} ${String(moduleCount + QUIET_ZONE * 2)}`,
  );
</script>

<svg
  class="qr"
  style={`width: ${String(sizeMm)}mm; height: ${String(sizeMm)}mm;`}
  {viewBox}
  role="img"
  aria-label={label}
  xmlns="http://www.w3.org/2000/svg"
>
  <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width="100%" height="100%" fill="#fff" />
  <path d={path} fill="#000" />
</svg>

<style>
  .qr {
    display: block;
    /*
      Le motif doit rester noir sur blanc même si la page est imprimée en mode
      « économie d'encre » : sans cela le contraste tombe et les lecteurs
      décrochent.
    */
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
    shape-rendering: crispEdges;
  }
</style>
