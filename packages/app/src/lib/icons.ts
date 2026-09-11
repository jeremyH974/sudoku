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
 * Une icône ne porte **jamais** le nom accessible : elle est masquée aux
 * lecteurs d'écran, et c'est le libellé du bouton — visible ou `aria-label` —
 * qui parle.
 */

export type IconName =
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
  /** Une surface pleine plutôt qu'un trait. */
  readonly fill?: boolean;
}

export const ICONS: Readonly<Record<IconName, readonly IconPart[]>> = {
  sun: [
    { d: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z' },
    {
      d: 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    },
  ],
  moon: [{ d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z' }],
  system: [{ d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' }, { d: 'M12 3a9 9 0 0 1 0 18z', fill: true }],
  previous: [{ d: 'M15 18l-6-6 6-6' }],
  next: [{ d: 'M9 18l6-6-6-6' }],
  first: [{ d: 'M6 6v12' }, { d: 'M18 6l-8 6 8 6z', fill: true }],
  last: [{ d: 'M18 6v12' }, { d: 'M6 6l8 6-8 6z', fill: true }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7' }],
};
