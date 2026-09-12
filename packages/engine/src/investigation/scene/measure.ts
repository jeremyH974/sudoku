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
   * Paires de pièces qui partagent une frontière.
   *
   * Purement descriptif, et il faut le dire : **l'adjacence entre pièces n'a
   * aucun effet sur la logique du jeu.** « À côté » exige la même pièce, et il
   * n'existe pas de porte dans le modèle. Ce nombre décrit la forme du plan,
   * pas sa richesse déductive — le ranger sans cet avertissement ferait croire
   * le contraire.
   */
  readonly touchingZonePairs: number;
  /**
   * Part des paires de cases d'une même pièce qui sont orthogonalement
   * adjacentes, entre 0 et 1. **C'est la mesure qui compte.**
   *
   * Le jeu tient sur deux contraintes voisines : « ils étaient dans la même
   * pièce » et « ils étaient à côté ». Dans une pièce compacte de quatre cases,
   * quatre paires sur six sont adjacentes : les deux indices disent presque la
   * même chose, et le second n'apprend presque rien de plus que le premier.
   * Dans un couloir de six cases en ligne, cinq paires sur quinze le sont : les
   * deux indices se séparent franchement.
   *
   * C'est le seul lien entre la **forme** d'une pièce et la richesse des
   * déductions qu'on puisse écrire sans l'inventer. La recherche n'a trouvé
   * aucune source qui le chiffre — elle n'a rien trouvé non plus qui relie
   * empiriquement une forme de pièce à une difficulté mesurée, dans ce genre de
   * jeu ni dans un autre.
   */
  readonly sameRoomAdjacency: number;
  /**
   * La même mesure, pièce par pièce, réduite à ses deux extrêmes.
   *
   * L'agrégat s'est révélé **trompeur à la première mesure** : quatre décors de
   * géométries visiblement différentes tiennent tous entre 29 % et 37 %, parce
   * qu'un carré de 3×3 et un couloir de 6×1 donnent exactement la même
   * proportion — 12 paires adjacentes sur 36, 5 sur 15, soit 33,3 % dans les
   * deux cas. La moyenne noie ce qui distingue.
   *
   * Ce qui distingue est **l'écart** entre les pièces d'un même plan. Un décor
   * dont toutes les pièces tournent à 33 % donne partout des indices de même
   * force ; un décor qui mélange un carré de 2×2 (4 paires sur 6, soit 67 %) et
   * une salle de 12 cases (16 sur 66, soit 24 %) donne des indices tantôt
   * décisifs, tantôt vagues — et c'est ce mélange qui fait un raisonnement.
   */
  readonly tightestZone: number;
  readonly loosestZone: number;
  /**
   * Le nombre maximal de suspects qu'une pièce de ce plan peut contenir.
   *
   * ─── La seule borne de ce fichier qui se démontre ───────────────────────────
   *
   * Le plateau impose **un suspect par rangée et un par colonne**. Une pièce ne
   * peut donc pas héberger deux personnes si ses cases n'offrent pas deux
   * rangées et deux colonnes distinctes à apparier. Et le coupable est, par
   * définition, le seul autre occupant de la pièce de la victime : si aucune
   * pièce du plan ne peut contenir deux personnes, **aucune affaire n'existe**.
   *
   * Ce n'est pas une intuition. Un décor en six bandes verticales — chaque pièce
   * étant exactement une colonne — a rendu 0 affaire sur 120 graines, en une
   * milliseconde : le générateur ne trouve rien parce qu'il n'y a rien.
   *
   * Le nombre se calcule exactement, par couplage maximal entre les rangées et
   * les colonnes qu'occupe la pièce — pas par `min(rangées, colonnes)`, qui
   * surestime dès qu'une pièce est creuse ou coudée.
   */
  readonly richestZoneOccupancy: number;
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
    sameRoomAdjacency: measureSameRoomAdjacency(scene),
    ...zoneExtremes(scene),
    richestZoneOccupancy: Math.max(...scene.zones.map((zone) => maxOccupancy(scene, zone.index))),
  };
}

/**
 * Quelle fraction des paires « même pièce » est aussi « à côté ».
 *
 * `scene.neighbours` porte déjà le voisinage orthogonal **restreint à la
 * pièce** : la somme de ses tailles compte chaque paire adjacente deux fois.
 * Le dénominateur est le nombre de paires possibles à l'intérieur des pièces,
 * pièce par pièce — jamais sur le plateau entier, qui mélangerait des cases
 * qu'aucun indice ne peut rapprocher.
 */
function measureSameRoomAdjacency(scene: Scene): number {
  let adjacent = 0;
  for (const neighbours of scene.neighbours) adjacent += count(neighbours);
  adjacent /= 2;

  let possible = 0;
  for (const zone of scene.zones) possible += (zone.size * (zone.size - 1)) / 2;

  return possible === 0 ? 0 : adjacent / possible;
}

/**
 * Combien de suspects tiennent au plus dans une pièce.
 *
 * Couplage biparti maximal : à gauche les rangées qu'occupe la pièce, à droite
 * ses colonnes, une arête par case. Chemins augmentants — seize rangées au plus,
 * le coût ne se discute pas.
 */
function maxOccupancy(scene: Scene, zoneIndex: number): number {
  const { size, zoneOf } = scene;
  const columnOfRow: number[][] = Array.from({ length: size }, () => []);
  for (let cell = 0; cell < scene.cellCount; cell++) {
    if (zoneOf[cell] === zoneIndex) columnOfRow[Math.floor(cell / size)].push(cell % size);
  }

  const takenBy = new Array<number>(size).fill(-1);
  let matched = 0;
  for (let row = 0; row < size; row++) {
    const seen = new Array<boolean>(size).fill(false);
    if (augment(row, columnOfRow, takenBy, seen)) matched++;
  }
  return matched;
}

function augment(
  row: number,
  columnOfRow: readonly number[][],
  takenBy: number[],
  seen: boolean[],
): boolean {
  for (const column of columnOfRow[row]) {
    if (seen[column]) continue;
    seen[column] = true;
    if (takenBy[column] === -1 || augment(takenBy[column], columnOfRow, takenBy, seen)) {
      takenBy[column] = row;
      return true;
    }
  }
  return false;
}

/** La pièce la plus serrée et la plus lâche, sur la même échelle. */
function zoneExtremes(scene: Scene): { tightestZone: number; loosestZone: number } {
  const shares: number[] = [];
  for (const zone of scene.zones) {
    const possible = (zone.size * (zone.size - 1)) / 2;
    if (possible === 0) continue;
    let adjacent = 0;
    for (let cell = 0; cell < scene.cellCount; cell++) {
      if (scene.zoneOf[cell] === zone.index) adjacent += count(scene.neighbours[cell]);
    }
    shares.push(adjacent / 2 / possible);
  }
  // Une pièce d'une seule case n'a aucune paire : elle ne dit rien de la forme.
  if (shares.length === 0) return { tightestZone: 1, loosestZone: 1 };
  return { tightestZone: Math.min(...shares), loosestZone: Math.max(...shares) };
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

/**
 * Les bornes qu'un décor doit passer, et le statut honnête de chacune.
 *
 * ─── Une seule se démontre ──────────────────────────────────────────────────
 *
 * `richestZoneOccupancy >= 2` se déduit des règles : le coupable est le seul
 * autre occupant de la pièce de la victime, donc il faut qu'une pièce puisse
 * en contenir deux. Vérifiée en plus par la mesure — le décor qui la viole rend
 * 0 affaire sur 120 graines.
 *
 * ─── Les autres sont des choix d'ingénierie, et le disent ───────────────────
 *
 * La recherche a balayé la littérature PCG, la conception de puzzles, la Space
 * Syntax et les papiers 2024-2026 sur l'entropie de puzzle : **aucune source ne
 * chiffre** un rapport d'aire acceptable, une densité de mobilier, ni un
 * diamètre transposable à un plan de cinq à huit pièces. Tout ce que la Space
 * Syntax fournit se lit relativement à un corpus de bâtiments comparables.
 *
 * Les seuils ci-dessous sont donc calibrés contre **les décors livrés**, dont la
 * plage mesurée est écrite à côté de chacun. Ils sont larges à dessein : une
 * borne serrée sur quatre exemples serait du surapprentissage, exactement ce
 * que l'incrément 9 a appris à éviter en validant hors échantillon.
 *
 * Le générateur, le jour où il viendra, **rejettera** sur cette liste au lieu
 * de corriger. C'est le contrat.
 */
export function decorFaults(metrics: SceneMetrics, size: number): string[] {
  const faults: string[] = [];
  const pct = (value: number): string => `${(100 * value).toFixed(0)} %`;

  // DÉMONTRÉE. Sans elle, aucune affaire n'existe.
  if (metrics.richestZoneOccupancy < 2) {
    faults.push(
      `aucune pièce ne peut contenir deux personnes (au mieux ${String(metrics.richestZoneOccupancy)}) : ` +
        `il ne peut donc y avoir ni victime ni coupable`,
    );
  }

  // Choix. Mesuré sur les décors livrés : 5 pièces partout.
  if (metrics.zoneCount < 3) faults.push(`${String(metrics.zoneCount)} pièces : moins de trois`);
  if (metrics.zoneCount > size) {
    faults.push(
      `${String(metrics.zoneCount)} pièces pour ${String(size)} suspects : « dans la même pièce » ` +
        `serait presque toujours faux`,
    );
  }

  // Choix. Mesuré : 1,50 à 3,00.
  if (metrics.zoneRatio > 6) {
    faults.push(`rapport d'aire ${metrics.zoneRatio.toFixed(2)} : au-delà de 6`);
  }

  // Choix, mais argumenté : au-delà de la moitié du plan, « même pièce » est
  // vrai plus souvent qu'à son tour. Mesuré : 25 % à 33 %.
  if (metrics.largestZoneShare > 0.5) {
    faults.push(`la plus grande pièce couvre ${pct(metrics.largestZoneShare)} du plan : plus de la moitié`);
  }

  // Choix. Mesuré : 53 % à 64 %.
  if (metrics.furnishedShare < 0.25) {
    faults.push(`${pct(metrics.furnishedShare)} de cases meublées : moins de 25 %`);
  }
  if (metrics.furnishedShare > 0.8) {
    faults.push(`${pct(metrics.furnishedShare)} de cases meublées : plus de 80 %`);
  }

  // Choix. Mesuré : aucun meuble unique dans les décors livrés.
  if (metrics.uniqueProps > 1) {
    faults.push(
      `${String(metrics.uniqueProps)} meubles posés une seule fois : leur indice place d'un coup`,
    );
  }

  return faults;
}
