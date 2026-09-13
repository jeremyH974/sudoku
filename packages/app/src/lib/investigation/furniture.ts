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
  | 'leaf-dark'
  | 'metal'
  | 'metal-light'
  | 'metal-dark'
  | 'stone'
  | 'stone-light'
  | 'stone-dark';

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
  'leaf-dark': 'var(--mat-leaf-dark)',
  metal: 'var(--mat-metal)',
  'metal-light': 'var(--mat-metal-light)',
  'metal-dark': 'var(--mat-metal-dark)',
  stone: 'var(--mat-stone)',
  'stone-light': 'var(--mat-stone-light)',
  'stone-dark': 'var(--mat-stone-dark)',
};

export interface FurniturePart {
  readonly d: string;
  readonly fill: Material;
}

/**
 * Chaque meuble, vu de dessus, sur la grille de 24 des icônes.
 *
 * ─── Une silhouette qui ne ressemble à aucune autre ─────────────────────────
 *
 * Fauteuil à accoudoirs, ovale (table), grand rectangle bordé (tapis), bande à
 * casiers (étagère), trèfle (plante), disque à pied (lampe). C'est la **forme**
 * qui distingue, pas la teinte — le plan reste lisible en noir et blanc.
 *
 * ─── Le volume est dessiné, jamais projeté ──────────────────────────────────
 *
 * Chaque objet porte **une seule source de lumière, en haut à gauche**, et la
 * même que tout le reste du site : l'ombre de la frange sur le front d'un
 * portrait, celle du buste sur son flanc droit, le reflet dans l'œil. Un objet
 * éclairé d'ailleurs se remarque sans qu'on sache le nommer.
 *
 * D'où trois tons par objet plutôt que deux : la face éclairée en `-light` vers
 * le haut à gauche, la matière au milieu, la face dans l'ombre en `-dark` vers
 * le bas à droite. Ce sont les tons de la **matière**, pas une couleur d'objet :
 * un meuble nouveau se dessine dans la palette existante.
 *
 * ─── Pourquoi pas une ombre portée ──────────────────────────────────────────
 *
 * Parce qu'elle ne survivrait pas au thème sombre. Une ombre se dessine en
 * sombre sur un sol clair ; les teintes de pièce s'inversent la nuit, et la
 * même forme y deviendrait une **auréole**. Les tons de matière, eux, ne suivent
 * pas le thème — le volume tient donc dans les deux. C'est exactement la leçon
 * que les portraits ont coûtée : l'encre du contour suit le thème, celle du
 * dessin non.
 */
export const FURNITURE: Readonly<Record<PropId, readonly FurniturePart[]>> = {
  /*
    Fauteuil : dossier, deux accoudoirs, assise qui avance entre eux.

    C'était un rectangle barré d'une planche — vu de dessus, ça ne disait pas
    « chaise ». Le premier essai n'a pas marché non plus, et la raison était
    nette : des accoudoirs pleine hauteur **entourent** le coussin sur trois
    côtés, et du bois qui encadre un aplat bleu se lit comme un **cadre**, pas
    comme un siège.

    Ce qui le dit, c'est l'ordre de dessin : le coussin d'abord, large, puis deux
    accoudoirs **courts posés dessus** vers l'arrière. Le coussin reste donc
    pleine largeur devant — et c'est ce dégagement qui fait un fauteuil.

    L'accoudoir de droite est dans l'ombre, celui de gauche à la lumière : c'est
    la même bande de bois, et le ton suffit à en faire deux bras.
  */
  chair: [
    { d: 'M4 3h16v18H4z', fill: 'ink' },
    { d: 'M5 4h14v3.6H5z', fill: 'wood-dark' },
    { d: 'M5.6 7.6h12.8v12.4H5.6z', fill: 'fabric' },
    { d: 'M6.8 8.8h5.2v5H6.8z', fill: 'fabric-light' },
    { d: 'M6.8 17.6h10.4v1.6H6.8zM15.6 9h1.6v10.2h-1.6z', fill: 'fabric-dark' },
    { d: 'M5 7.6h2.6v7H5z', fill: 'wood' },
    { d: 'M16.4 7.6h2.6v7h-2.6z', fill: 'wood-dark' },
  ],
  /*
    Table ronde : trois ellipses emboîtées, chacune décalée vers le haut à
    gauche. La tranche reste visible en bas à droite, le plateau la recouvre, le
    reflet se pose dessus — un dôme, obtenu sans un seul dégradé.
  */
  table: [
    { d: 'M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0z', fill: 'ink' },
    { d: 'M4 12a8 5 0 1 0 16 0a8 5 0 1 0-16 0z', fill: 'wood-dark' },
    { d: 'M4.4 11.4a7.4 4.5 0 1 0 14.8 0a7.4 4.5 0 1 0-14.8 0z', fill: 'wood' },
    { d: 'M6.4 10.4a4.6 2.3 0 1 0 9.2 0a4.6 2.3 0 1 0-9.2 0z', fill: 'wood-light' },
  ],
  /*
    Tapis : le champ, sa bordure tissée, et le motif central.

    Le seul objet qui n'a **pas** de volume, et c'est juste : un tapis est posé à
    plat. Lui inventer une tranche éclairée le ferait flotter au-dessus du sol,
    alors que tout le jeu repose sur ce qu'on pose dessus.

    En tissu bleu comme l'assise des fauteuils, il se lisait à la taille d'une
    case comme une chaise sans dossier. Il prend donc la pierre — un neutre
    chaud —, et le bleu reste le tissu de ce sur quoi on s'assoit.
  */
  rug: [
    { d: 'M1.5 4.5h21v15h-21z', fill: 'ink' },
    { d: 'M2.5 5.5h19v13h-19z', fill: 'stone' },
    { d: 'M5 8h14v8H5z', fill: 'stone-light' },
    { d: 'M10 11h4v2h-4z', fill: 'wood-dark' },
  ],
  /*
    Étagère : une planche adossée au mur, ses livres, et sa tranche.

    La tranche sombre au bord inférieur est ce qui la fait tenir debout : sans
    elle, les livres semblaient posés sur le sol plutôt que rangés dans un
    meuble.
  */
  shelf: [
    { d: 'M2 2.5h20v9H2z', fill: 'ink' },
    { d: 'M3 3.5h18v7H3z', fill: 'wood' },
    { d: 'M4.3 4.6h3.6v4.4H4.3z', fill: 'fabric' },
    { d: 'M8.6 4.6h3.4v4.4H8.6z', fill: 'leaf' },
    { d: 'M12.7 4.6h2.8v4.4h-2.8z', fill: 'stone' },
    { d: 'M16.2 4.6h3.5v4.4h-3.5z', fill: 'wood-light' },
    { d: 'M3 9.2h18v1.3H3z', fill: 'wood-dark' },
  ],
  /*
    Plante : un trèfle de feuillage, et le pot au centre.

    Trois lobes plutôt qu'un disque, et c'est une correction : dessinée en
    cercle, elle ne se distinguait plus de la lampe, qui en est un aussi.

    Le volume ne coûte **aucun tracé de plus** — les trois taches claires sont
    simplement décalées vers le haut à gauche à l'intérieur de leur lobe, et la
    même lumière les traverse toutes les trois. Le pot suit : son aplat glissé
    d'un tiers de point laisse voir plus d'encre en bas à droite.
  */
  plant: [
    { d: 'M2.8 9a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0z', fill: 'ink' },
    { d: 'M10.8 9a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0z', fill: 'ink' },
    { d: 'M6.8 15.5a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0z', fill: 'ink' },
    { d: 'M3.7 9a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0-8.6 0z', fill: 'leaf-dark' },
    { d: 'M11.7 9a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0-8.6 0z', fill: 'leaf-dark' },
    { d: 'M7.7 15.5a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0-8.6 0z', fill: 'leaf-dark' },
    { d: 'M3.4 8.6a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0-7.8 0z', fill: 'leaf' },
    { d: 'M11.4 8.6a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0-7.8 0z', fill: 'leaf' },
    { d: 'M7.4 15.1a3.9 3.9 0 1 0 7.8 0a3.9 3.9 0 1 0-7.8 0z', fill: 'leaf' },
    { d: 'M5.2 8.2a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', fill: 'leaf-light' },
    { d: 'M13.2 8.2a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', fill: 'leaf-light' },
    { d: 'M9.2 14.7a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', fill: 'leaf-light' },
    { d: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', fill: 'ink' },
    { d: 'M9.5 11.7a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0z', fill: 'stone' },
    { d: 'M10.2 11.2a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0z', fill: 'stone-light' },
  ],
  /*
    Lampe : l'abat-jour vu d'aplomb, et le pied qui dépasse dessous.

    Dessinée en disque à rayons, elle se lisait comme une mire de visée. Le pied
    lui donne une silhouette orientée — un objet posé, pas un symbole.

    L'abat-jour est un cône vu de dessus : le bord reste sombre tout autour, le
    tissu vient dessus décalé, et le halo se pose en haut à gauche. C'est la
    seule façon de rendre une lampe allumée sans le moindre dégradé.
  */
  lamp: [
    { d: 'M4.8 11a7.2 7.2 0 1 0 14.4 0a7.2 7.2 0 1 0-14.4 0zM9.4 16.5h5.2v5.3H9.4z', fill: 'ink' },
    { d: 'M5.8 11a6.2 6.2 0 1 0 12.4 0a6.2 6.2 0 1 0-12.4 0zM10.4 16.5h3.2v4.2h-3.2z', fill: 'metal-dark' },
    { d: 'M6.2 10.6a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0-11.2 0zM10.4 16.5h2.2v4.2h-2.2z', fill: 'metal' },
    { d: 'M8.2 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', fill: 'metal-light' },
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
