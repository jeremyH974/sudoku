/**
 * Les icônes de l'application, dessinées plutôt que tapées.
 *
 * ─── Pourquoi ───────────────────────────────────────────────────────────────
 *
 * Jusqu'à l'incrément 10, chaque icône était un caractère Unicode — ☀ ☾ ◐ ◀ ▶
 * ⏮ ⏭ ✓ —, rendu par la police que le système voulait bien fournir : leur
 * couverture et leur poids optique varient fortement d'un appareil à l'autre,
 * et `☾` comme `◐` sont précisément les plus mal servis. Or plusieurs de ces
 * glyphes portent une information : la coche dit « défi résolu » sans la
 * couleur.
 *
 * ─── Comment ────────────────────────────────────────────────────────────────
 *
 * Des tracés sur une grille de 24, au trait de 2 à bouts ronds — ceux de
 * l'icône de l'application —, rendus par `Icon.svelte` en `currentColor` et en
 * `em` : une icône suit le thème et le réglage de taille du texte sans rien
 * demander. Huit icônes, aucune de plus : chacune remplace un glyphe qui
 * existait, aucune ne s'ajoute à un bouton qui a déjà son libellé.
 *
 * S'y ajoute un neuvième tracé, qui n'est pas une icône : la marque. C'est le
 * damier de `public/icon.svg` — déjà le favicon et l'icône installée — redessiné
 * sur la même grille de 24, pour que l'en-tête cesse d'être le mot « Sudoku »
 * dans la police du système. Elle ne prétend pas être un logotype : un dessin
 * plus ambitieux ne saurait pas suivre le réglage de taille du texte.
 *
 * Une icône ne porte **jamais** le nom accessible : elle est masquée aux
 * lecteurs d'écran, et c'est le libellé du bouton — visible ou `aria-label` —
 * qui parle.
 */

export type IconName =
  | 'brand'
  | 'sun'
  | 'moon'
  | 'system'
  | 'previous'
  | 'next'
  | 'first'
  | 'last'
  | 'check';

export interface IconPart {
  readonly d: string;
  /**
   * Le rendu, quand le trait plein par défaut ne convient pas : `fill` une
   * surface pleine, `soft` une surface atténuée, `thin` un trait plus léger.
   * Les deux derniers viennent du damier de la marque, dont les séparateurs
   * sont plus fins que le cadre — comme dans `public/icon.svg`.
   */
  readonly paint?: 'fill' | 'soft' | 'thin';
}

export const ICONS: Readonly<Record<IconName, readonly IconPart[]>> = {
  /*
    Trois cases pleines en diagonale — une grille en cours de remplissage —, des
    séparateurs légers, un cadre. Les tiers de 16 tombent sur 5,33 : les valeurs
    ne sont pas rondes parce que la grille, elle, l'est.
  */
  brand: [
    { d: 'M4 4h5.33v5.33H4zM9.33 9.33h5.34v5.34H9.33zM14.67 14.67H20V20h-5.33z', paint: 'soft' },
    { d: 'M9.33 4v16M14.67 4v16M4 9.33h16M4 14.67h16', paint: 'thin' },
    { d: 'M4 4h16v16H4z' },
  ],
  sun: [
    { d: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z' },
    {
      d: 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    },
  ],
  moon: [{ d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z' }],
  system: [
    { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
    { d: 'M12 3a9 9 0 0 1 0 18z', paint: 'fill' },
  ],
  previous: [{ d: 'M15 18l-6-6 6-6' }],
  next: [{ d: 'M9 18l6-6-6-6' }],
  first: [{ d: 'M6 6v12' }, { d: 'M18 6l-8 6 8 6z', paint: 'fill' }],
  last: [{ d: 'M18 6v12' }, { d: 'M6 6l8 6-8 6z', paint: 'fill' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7' }],
};
