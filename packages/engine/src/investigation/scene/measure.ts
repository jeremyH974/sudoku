import { count } from './cellset.js';
import type { Scene } from './types.js';

/**
 * Ce qu'on mesure d'un décor, et pourquoi on le mesure avant d'en écrire.
 *
 * ─── La règle qui gouverne ce fichier ───────────────────────────────────────
 *
 * `buildScene()` vérifie ce qui rend un décor **lisible** : des lettres
 * déclarées, des rangées de la bonne longueur, des pièces d'un seul tenant. Il
 * ne vérifie rien de ce qui rend un décor **jouable** — un plan d'une seule
 * pièce de trente-six cases passerait sans un mot, et n'engendrerait que des
 * affaires molles, puisque « dans la même pièce » y serait vrai de tout le
 * monde.
 *
 * Ce module ne juge pas : il **compte**. Les seuils sont écrits ailleurs, et se
 * discutent ; les nombres, eux, se recalculent. C'est la même séparation que
 * `rate()` et le barème, ou que les comptages de l'onglet Progression et les
 * adjectifs qu'on refuse d'y mettre.
 *
 * ─── Pourquoi maintenant, alors que les décors sont écrits à la main ────────
 *
 * Parce que le jour où un générateur les produira, il **rejettera** un plan
 * hors bornes au lieu de le corriger — et pour rejeter, il faut savoir mesurer.
 * Un décor écrit à la main doit déjà passer les mêmes bornes : sinon ce ne sont
 * pas des bornes, ce sont des vœux.
 */
export interface SceneMetrics {
  /** Le nombre de pièces. */
  readonly zoneCount: number;
  /** La plus petite pièce, en cases. */
  readonly smallestZone: number;
  /** La plus grande pièce, en cases. */
  readonly largestZone: number;
  /**
   * Le rapport entre la plus grande pièce et la plus petite.
   *
   * C'est la mesure qui dit si le plan a du relief. À 1, toutes les pièces se
   * valent et le plan est un damier ; très haut, la petite pièce ne peut plus
   * accueillir personne et cesse de servir au raisonnement.
   */
  readonly zoneRatio: number;
  /**
   * Part du plateau occupée par la plus grande pièce, entre 0 et 1.
   *
   * Sépare le cas que `zoneRatio` ne voit pas : cinq petites pièces autour
   * d'une salle qui prend les trois quarts du plan. « Dans la même pièce » y
   * serait presque toujours vrai, donc presque jamais informatif.
   */
  readonly largestZoneShare: number;
  /** Cases portant au moins un meuble. */
  readonly furnishedCells: number;
  /** Part des cases meublées, entre 0 et 1. */
  readonly furnishedShare: number;
  /** Sortes de meubles effectivement posées, sur les six existantes. */
  readonly propKinds: number;
  /**
   * Sortes de meubles posées **une seule fois** sur tout le plan.
   *
   * Un meuble unique rend son indice décisif d'un coup — « elle était à côté de
   * la lampe » ne laisse qu'une poignée de cases. Utile en petite quantité,
   * ruineux en grande : le plan se résout alors par énumération plutôt que par
   * déduction.
   */
  readonly uniqueProps: number;
  /**
   * Paires de pièces qui se touchent orthogonalement.
   *
   * Le plan vu comme un graphe. Deux pièces qui ne se touchent pas ne peuvent
   * jamais être confondues par un indice de voisinage ; un plan où tout touche
   * tout donne des indices de position moins tranchants.
   */
  readonly touchingZonePairs: number;
}

/** Compte, pour un décor compilé. Aucune borne, aucun jugement. */
export function measureScene(scene: Scene): SceneMetrics {
  const sizes = scene.zones.map((zone) => zone.size);
  const smallestZone = Math.min(...sizes);
  const largestZone = Math.max(...sizes);

  let furnishedCells = 0;
  for (let cell = 0; cell < scene.cellCount; cell++) {
    if (scene.propsOf[cell] !== 0) furnishedCells++;
  }

  let uniqueProps = 0;
  for (const prop of scene.propsPresent) {
    const cells = scene.cellsWithProp.get(prop);
    if (cells !== undefined && count(cells) === 1) uniqueProps++;
  }

  return {
    zoneCount: scene.zones.length,
    smallestZone,
    largestZone,
    zoneRatio: largestZone / smallestZone,
    largestZoneShare: largestZone / scene.cellCount,
    furnishedCells,
    furnishedShare: furnishedCells / scene.cellCount,
    propKinds: scene.propsPresent.length,
    uniqueProps,
    touchingZonePairs: countTouchingZonePairs(scene),
  };
}

/**
 * Combien de paires de pièces partagent au moins une frontière.
 *
 * On ne balaie que le voisin de droite et celui du dessous : chaque frontière
 * est ainsi visitée une fois et une seule, et la paire est rangée dans un
 * ensemble pour ne compter qu'une fois deux pièces qui se touchent sur toute
 * une longueur.
 */
function countTouchingZonePairs(scene: Scene): number {
  const pairs = new Set<number>();
  const { size, zoneOf } = scene;
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const cell = row * size + column;
      const here = zoneOf[cell];
      if (column + 1 < size) record(pairs, here, zoneOf[cell + 1]);
      if (row + 1 < size) record(pairs, here, zoneOf[cell + size]);
    }
  }
  return pairs.size;
}

function record(pairs: Set<number>, left: number, right: number): void {
  if (left === right) return;
  const low = Math.min(left, right);
  const high = Math.max(left, right);
  // Une clef par paire non ordonnée. 16 zones au plus, donc 16 tient large.
  pairs.add(low * 16 + high);
}
