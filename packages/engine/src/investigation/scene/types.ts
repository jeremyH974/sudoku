import type { CellSet } from './cellset.js';

/**
 * Le mobilier qu'une case peut porter.
 *
 * Ces identifiants sont sérialisés avec une affaire : ils ne changent pas sans
 * migration. Le français correspondant vit dans `PROPS`, plus bas — un indice
 * n'est jamais une phrase stockée, seulement une contrainte qu'on sait rendre.
 */
export type PropId = 'chair' | 'table' | 'rug' | 'plant' | 'shelf' | 'lamp';

/**
 * Ce qu'il faut savoir d'un meuble pour en parler correctement.
 *
 * Le genre n'est pas une coquetterie : sans lui, on écrirait « à côté d'un
 * étagère ». Et `seated` distingue les deux verbes que la langue impose —
 * on est « assis sur une chaise » mais « sur un tapis ».
 */
export interface PropKind {
  readonly id: PropId;
  /** Nom au singulier, sans article. */
  readonly noun: string;
  readonly gender: 'f' | 'm';
  /** Le meuble se dit-il « assis sur » plutôt que « sur » ? */
  readonly seated: boolean;
  /**
   * Peut-on dire de quelqu'un qu'il était **sur** ce meuble ?
   *
   * On est sur une chaise ou sur un tapis ; on n'est pas « sur une étagère ».
   * Sans ce drapeau, le générateur produit des phrases vraies et absurdes — il
   * en a produit, et c'est pour cela qu'il existe. La géométrie ne s'en trouve
   * pas changée : ces meubles restent des repères pour « à côté de », qui est
   * de toute façon l'indice le plus fréquent du genre.
   */
  readonly standable: boolean;
}

export const PROPS: Readonly<Record<PropId, PropKind>> = {
  chair: { id: 'chair', noun: 'chaise', gender: 'f', seated: true, standable: true },
  table: { id: 'table', noun: 'table', gender: 'f', seated: false, standable: false },
  rug: { id: 'rug', noun: 'tapis', gender: 'm', seated: false, standable: true },
  plant: { id: 'plant', noun: 'plante', gender: 'f', seated: false, standable: false },
  shelf: { id: 'shelf', noun: 'étagère', gender: 'f', seated: false, standable: false },
  lamp: { id: 'lamp', noun: 'lampe', gender: 'f', seated: false, standable: false },
};

/** Les meubles, dans un ordre stable — celui des bits de `Scene.propsOf`. */
export const PROP_ORDER: readonly PropId[] = ['chair', 'table', 'rug', 'plant', 'shelf', 'lamp'];

/**
 * L'article d'une pièce, porté par la donnée plutôt que deviné.
 *
 * On écrit « dans **le** Salon », « dans **la** Bibliothèque », « dans
 * **l'**Office ». Aucune règle ne le déduit du nom — une heuristique sur la
 * dernière lettre se tromperait dès « le Musée » —, et un indice qui se lit mal
 * est un indice sur lequel le joueur bute pour une raison qui n'est pas la
 * bonne. C'est la même raison qui fait porter son genre à chaque meuble.
 */
export type Article = 'le' | 'la' | "l'";

export interface DecorZone {
  readonly key: string;
  readonly name: string;
  readonly article: Article;
}

/**
 * Un décor, tel qu'il s'écrit dans un fichier de données.
 *
 * C'est une donnée pure, et c'est le point de couture : le jour où les décors
 * seront engendrés plutôt qu'écrits, ils prendront cette forme et rien d'autre
 * ne bougera. Le plan se lit à l'œil dans le fichier source, ce qui est le seul
 * moyen de relire une pièce sans l'exécuter.
 */
export interface Decor {
  readonly id: string;
  /** Le titre affiché de l'affaire — « Le cercle de lecture ». */
  readonly title: string;
  readonly size: number;
  /** Les zones, dans l'ordre ; la clé est la lettre utilisée dans `plan`. */
  readonly zones: readonly DecorZone[];
  /** Une lettre de zone par case, une chaîne par rangée. */
  readonly plan: readonly string[];
  /** Quel meuble porte quelle lettre de `furniture`. */
  readonly legend: Readonly<Record<string, PropId>>;
  /**
   * Le mobilier, en calques : une lettre par case, « . » pour rien.
   *
   * Plusieurs calques parce qu'une case peut porter deux meubles — une chaise
   * posée sur un tapis. Un seul calque de lettres ne saurait pas le dire.
   */
  readonly furniture: readonly (readonly string[])[];
}

/** Une pièce du plan, avec ses cases. */
export interface Zone {
  readonly index: number;
  readonly key: string;
  readonly name: string;
  readonly article: Article;
  readonly cells: CellSet;
  readonly size: number;
}

/**
 * Un décor compilé : tout ce que les contraintes ont besoin de consulter, déjà
 * calculé.
 *
 * `cellsNextToProp` est la raison d'être de cette compilation. « À côté d'une
 * plante » est l'indice le plus fréquent du jeu, et sa géométrie — voisinage
 * orthogonal **restreint à la zone** — ne dépend que du décor. La calculer une
 * fois évite de la refaire à chaque nœud du solveur.
 */
export interface Scene {
  readonly id: string;
  readonly title: string;
  /** Côté du plateau. Le plateau est carré : autant de rangées que de suspects. */
  readonly size: number;
  readonly cellCount: number;
  readonly zones: readonly Zone[];
  /** Index de zone de chaque case. */
  readonly zoneOf: Int8Array;
  /** Masque des meubles de chaque case, sur les bits de `PROP_ORDER`. */
  readonly propsOf: Uint32Array;
  /** Les cases qui portent tel meuble. */
  readonly cellsWithProp: ReadonlyMap<PropId, CellSet>;
  /** Les cases voisines d'un tel meuble — orthogonales **et de la même zone**. */
  readonly cellsNextToProp: ReadonlyMap<PropId, CellSet>;
  /** Voisines orthogonales de chaque case, dans sa zone. */
  readonly neighbours: readonly CellSet[];
  readonly rows: readonly CellSet[];
  readonly columns: readonly CellSet[];
  /** Les meubles effectivement présents, dans l'ordre de `PROP_ORDER`. */
  readonly propsPresent: readonly PropId[];
  /**
   * Les ensembles de cases que la propagation redemande sans cesse.
   *
   * ─── Pourquoi une table mutable dans une structure par ailleurs figée ──────
   *
   * Parce que ce n'est pas un état : c'est un **souvenir de calcul**. Rien de
   * ce qu'elle contient n'est observable — retirer la table ne change aucune
   * affaire produite, seulement le temps qu'il faut pour la produire.
   *
   * ─── Ce qu'elle évite ──────────────────────────────────────────────────────
   *
   * Le solveur passe 69 % de son temps dans `pruneClue`, et l'essentiel de ce
   * temps à reconstruire deux ensembles qui ne dépendent que du décor et d'un
   * masque de six bits : les cases d'un groupe de tranches, et les cases des
   * pièces qu'un suspect peut encore atteindre. Chaque reconstruction alloue un
   * `Uint32Array` par tranche — mesuré à plus d'un milliard d'allocations sur
   * quatre cents affaires, pour au plus 128 résultats distincts par décor.
   *
   * C'est la même raison qui fait exister `cellsNextToProp` juste au-dessus, et
   * elle est poussée d'un cran : là c'était une géométrie, ici c'est une
   * géométrie **indexée par une question**.
   *
   * ⚠ Les ensembles rendus sont **partagés**. Un appelant qui en muterait un
   * corromprait toutes les déductions suivantes. Aucune opération de `cellset`
   * ne mute son entrée — elles allouent toutes leur sortie — et c'est cet
   * invariant, et lui seul, qui autorise le partage.
   */
  readonly memo: Map<number, CellSet>;
}

export const rowOf = (scene: Scene, cell: number): number => Math.floor(cell / scene.size);
export const columnOf = (scene: Scene, cell: number): number => cell % scene.size;
