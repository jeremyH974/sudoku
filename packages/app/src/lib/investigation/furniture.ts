import type { PropId } from '@sudoku/engine/investigation';

/**
 * Le mobilier de la scène, dessiné.
 *
 * ─── Pourquoi ce n'est pas dans `icons.ts` ──────────────────────────────────
 *
 * `icons.ts` dit « huit icônes, aucune de plus », et la règle est bonne : une
 * icône d'interface remplace un glyphe qui existait, elle ne s'ajoute pas à un
 * bouton qui a déjà son libellé. Le mobilier n'est pas de l'interface — c'est le
 * **contenu** de la scène, le sujet même des indices. Il a donc son propre
 * vocabulaire, ici, et son propre budget.
 *
 * ─── La grammaire, et d'où elle vient ───────────────────────────────────────
 *
 * Relevée sur la référence du genre, et reprise pour elle-même : **aplats sans
 * dégradé ni contour, deux ou trois tons par objet, vus de dessus**. Ce qui
 * n'est pas repris : leurs tracés. Ceux d'ici sont les nôtres — le style n'est
 * pas protégeable, l'expression l'est, et c'est la frontière que le projet tient
 * déjà entre algorithme publié et code copié.
 *
 * Le relief ne vient pas d'une ombre CSS mais du dessin : une **plaque d'encre**
 * un peu plus grande que l'objet, posée dessous. C'est un contour sans en être
 * un — une forme pleine —, et c'est ce qui rend l'objet lisible sur n'importe
 * quel sol. La mesure l'imposait : les tons de matière plafonnent à 3:1 contre
 * les teintes de pièce, là où l'encre douce tient 4,4:1 en clair et 4,5:1 en
 * sombre. Le dessin de profil précédent s'en sortait avec un trait ; des aplats
 * n'ont pas de trait, donc il fallait le dessiner.
 *
 * ─── Le dessin ne porte jamais seul ─────────────────────────────────────────
 *
 * Ces tracés sont **masqués aux lecteurs d'écran**. Ce que la case contient est
 * dit en toutes lettres dans son nom accessible — « Salon, chaise, tapis » — et
 * le dessin n'en est qu'un rappel visuel.
 */

/**
 * Les remplissages permis : cinq matières en trois tons, plus l'encre.
 *
 * Une matière, jamais une couleur propre à un objet. C'est ce qui distingue un
 * système d'une bibliothèque d'images : un meuble nouveau se dessine dans la
 * palette existante, suit le thème sans retouche, et se convertira en gris pour
 * le papier.
 */
export type Material =
  | 'ink'
  | 'wood'
  | 'wood-light'
  | 'wood-dark'
  | 'fabric'
  | 'fabric-light'
  | 'fabric-dark'
  | 'leaf'
  | 'leaf-light'
  | 'metal'
  | 'metal-light'
  | 'stone'
  | 'stone-light';

/** Le jeton CSS de chaque matière. Aucune couleur n'est écrite ici. */
export const FILL: Readonly<Record<Material, string>> = {
  ink: 'var(--ink-soft)',
  wood: 'var(--mat-wood)',
  'wood-light': 'var(--mat-wood-light)',
  'wood-dark': 'var(--mat-wood-dark)',
  fabric: 'var(--mat-fabric)',
  'fabric-light': 'var(--mat-fabric-light)',
  'fabric-dark': 'var(--mat-fabric-dark)',
  leaf: 'var(--mat-leaf)',
  'leaf-light': 'var(--mat-leaf-light)',
  metal: 'var(--mat-metal)',
  'metal-light': 'var(--mat-metal-light)',
  stone: 'var(--mat-stone)',
  'stone-light': 'var(--mat-stone-light)',
};

export interface FurniturePart {
  readonly d: string;
  readonly fill: Material;
}

/**
 * Chaque meuble, vu de dessus, sur la grille de 24 des icônes.
 *
 * Une silhouette qui ne ressemble à aucune autre : carré à barre (chaise),
 * ovale (table), grand rectangle bordé (tapis), bande à casiers (étagère),
 * trèfle (plante), disque à rayons (lampe). C'est la **forme** qui distingue,
 * pas la teinte — le plan reste lisible en noir et blanc.
 */
export const FURNITURE: Readonly<Record<PropId, readonly FurniturePart[]>> = {
  /* Chaise : le dossier en barre, l'assise, et son coussin. */
  chair: [
    { d: 'M4.5 3h15v18h-15z', fill: 'ink' },
    { d: 'M5.5 4h13v3.5h-13z', fill: 'wood-dark' },
    { d: 'M5.5 7.5h13v12.5h-13z', fill: 'fabric' },
    { d: 'M8 10h8v6H8z', fill: 'fabric-light' },
  ],
  /* Table ronde : la seule silhouette ovale du plan. */
  table: [
    { d: 'M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0z', fill: 'ink' },
    { d: 'M4 12a8 5 0 1 0 16 0a8 5 0 1 0-16 0z', fill: 'wood' },
    { d: 'M7 10.6a5 2.4 0 1 0 10 0a5 2.4 0 1 0-10 0z', fill: 'wood-light' },
  ],
  /*
    Tapis : le champ, sa bordure tissée, et le motif central.

    En tissu bleu comme l'assise des chaises, il se lisait à la taille d'une case
    comme une chaise sans dossier. Il prend donc la pierre — un neutre chaud —,
    et le bleu reste le tissu de ce sur quoi on s'assoit. La silhouette ne
    suffisait pas à les séparer ; la matière, oui.
  */
  rug: [
    { d: 'M1.5 4.5h21v15h-21z', fill: 'ink' },
    { d: 'M2.5 5.5h19v13h-19z', fill: 'stone' },
    { d: 'M5 8h14v8H5z', fill: 'stone-light' },
    { d: 'M10 11h4v2h-4z', fill: 'wood-dark' },
  ],
  /* Étagère : une bande adossée au mur, et ses livres. */
  shelf: [
    { d: 'M2 2.5h20v9H2z', fill: 'ink' },
    { d: 'M3 3.5h18v7H3z', fill: 'wood-dark' },
    { d: 'M4.3 4.6h3.6v4.8H4.3z', fill: 'fabric' },
    { d: 'M8.6 4.6h3.4v4.8H8.6z', fill: 'leaf' },
    { d: 'M12.7 4.6h2.8v4.8h-2.8z', fill: 'stone' },
    { d: 'M16.2 4.6h3.5v4.8h-3.5z', fill: 'wood-light' },
  ],
  /*
    Plante : un trèfle de feuillage, et le pot au centre.

    Trois lobes plutôt qu'un disque, et c'est une correction : dessinée en
    cercle, elle ne se distinguait plus de la lampe, qui en est un aussi.
  */
  plant: [
    { d: 'M2.8 9a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0z', fill: 'ink' },
    { d: 'M10.8 9a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0z', fill: 'ink' },
    { d: 'M6.8 15.5a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0z', fill: 'ink' },
    { d: 'M3.7 9a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0-8.6 0z', fill: 'leaf' },
    { d: 'M11.7 9a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0-8.6 0z', fill: 'leaf' },
    { d: 'M7.7 15.5a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0-8.6 0z', fill: 'leaf' },
    { d: 'M6 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', fill: 'leaf-light' },
    { d: 'M14 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', fill: 'leaf-light' },
    { d: 'M10 15.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', fill: 'leaf-light' },
    { d: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', fill: 'ink' },
    { d: 'M9.8 12a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0z', fill: 'stone' },
  ],
  /*
    Lampe : l'abat-jour vu d'aplomb, et le pied qui dépasse dessous.

    Dessinée en disque à rayons, elle se lisait comme une mire de visée. Le pied
    lui donne une silhouette orientée — un objet posé, pas un symbole.
  */
  lamp: [
    { d: 'M4.8 11a7.2 7.2 0 1 0 14.4 0a7.2 7.2 0 1 0-14.4 0zM9.4 16.5h5.2v5.3H9.4z', fill: 'ink' },
    { d: 'M5.8 11a6.2 6.2 0 1 0 12.4 0a6.2 6.2 0 1 0-12.4 0zM10.4 16.5h3.2v4.2h-3.2z', fill: 'metal' },
    { d: 'M9 11a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', fill: 'metal-light' },
  ],
};

/**
 * L'ordre de superposition : ce qui est au sol d'abord.
 *
 * `PROP_ORDER` du moteur est l'ordre des **bits**, pas celui du dessin — et
 * suivre l'un pour l'autre faisait passer le tapis par-dessus la chaise posée
 * dessus. Deux ordres pour deux usages, et celui-ci ne concerne que l'écran.
 */
export const LAYER_ORDER: readonly PropId[] = [
  'rug',
  'table',
  'shelf',
  'chair',
  'plant',
  'lamp',
];

/**
 * Le nom français d'un meuble, au singulier.
 *
 * Il est **redit** ici bien que le moteur le connaisse, et c'est délibéré :
 * `PROPS` du moteur porte de quoi construire une phrase — genre, article,
 * « assis sur » — là où l'interface n'a besoin que d'une étiquette dans un nom
 * accessible. Importer la phrase pour n'en garder qu'un mot ferait dépendre
 * l'écran de détails de grammaire qui ne le concernent pas.
 */
export const FURNITURE_LABEL: Readonly<Record<PropId, string>> = {
  chair: 'chaise',
  table: 'table',
  rug: 'tapis',
  plant: 'plante',
  shelf: 'étagère',
  lamp: 'lampe',
};
