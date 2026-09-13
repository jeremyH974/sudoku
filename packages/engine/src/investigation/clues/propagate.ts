import {
  add,
  cellsOf,
  difference,
  emptySet,
  type CellSet,
  intersects,
  isEmpty,
  isSubsetOf,
  union,
} from '../scene/cellset.js';
import type { Scene } from '../scene/types.js';
import { unaryCells } from './semantics.js';
import type { Clue, Direction } from './types.js';

/**
 * Ce qu'un indice permet d'éliminer, **sans l'appliquer**.
 *
 * Séparer la conclusion de son application est ce qui rend le mode
 * explicable : la même fonction sert le solveur exact, qui applique et
 * continue, et le registre de déduction, qui applique **et raconte**. Sans
 * cela, l'indice affiché au joueur et le chemin qui note l'affaire seraient
 * deux calculs différents, donc deux calculs qui finissent par diverger.
 */
export interface Pruning {
  readonly suspect: number;
  /** Les cases à retirer du domaine. Jamais vide. */
  readonly remove: CellSet;
}

/**
 * Tout ce que cet indice élimine, dans l'état courant des domaines.
 *
 * ─── Sur la complétude, et pourquoi elle n'est pas visée ────────────────────
 *
 * Un propagateur n'a qu'une obligation : **ne jamais éliminer une case qu'une
 * solution valide occuperait**. Il n'a pas à trouver tout ce qui est
 * éliminable. Un propagateur incomplet coûte du temps ; un propagateur faux
 * produit une affaire sans solution, et le joueur en fait les frais.
 *
 * ─── Sur la forme, et pourquoi elle a changé ────────────────────────────────
 *
 * La première version comparait chaque case de l'un à chaque case de l'autre,
 * en s'appuyant sur le **même prédicat que `holds`** : correct par
 * construction, et jusqu'à |D|² comparaisons par indice. La mesure a tranché :
 * le générateur part d'une réserve de cent soixante-dix indices, et ce coût
 * quadratique y devenait des secondes entières sur certaines graines.
 *
 * Chaque relation est donc résolue par ses **bornes** — une direction ne parle
 * que de rangées, un écart exact décale un masque de rangées, une pièce
 * commune réunit des pièces. Le travail passe de |D|² à la taille du plateau.
 * La propriété qui vérifie qu'aucune case vraie n'est écartée, elle, n'a pas
 * changé : c'est elle qui rend cette réécriture sûre.
 */
export function pruneClue(clue: Clue, scene: Scene, domains: readonly CellSet[]): Pruning[] {
  const fixed = unaryCells(clue, scene);
  if (fixed !== null) return [restrict(domains, clue.who, fixed)].filter(isReal);

  switch (clue.kind) {
    case 'direction':
    case 'offset':
    case 'same-zone':
    case 'alone-with': {
      const allowed = binaryAllowed(clue, scene, domains);
      return [
        restrict(domains, clue.who, allowed.who),
        restrict(domains, clue.other, allowed.other),
        ...pruneOccupancy(clue, scene, domains),
      ].filter(isReal);
    }
    default:
      return pruneOccupancy(clue, scene, domains);
  }
}

/** Les indices qui relient deux personnes. */
type BinaryClue = Extract<Clue, { kind: 'direction' | 'offset' | 'same-zone' | 'alone-with' }>;

const isReal = (pruning: Pruning): boolean => !isEmpty(pruning.remove);

const restrict = (domains: readonly CellSet[], suspect: number, allowed: CellSet): Pruning => ({
  suspect,
  remove: difference(domains[suspect], allowed),
});

/**
 * Les cases que chaque côté d'une relation peut encore occuper.
 *
 * Tout tient dans une observation : ces relations ne parlent que de **tranches**
 * ou de **pièces**, jamais de cases individuelles. Il suffit donc de savoir
 * quelles tranches, ou quelles pièces, l'autre peut encore atteindre.
 */
function binaryAllowed(
  clue: BinaryClue,
  scene: Scene,
  domains: readonly CellSet[],
): { who: CellSet; other: CellSet } {
  if (clue.kind === 'same-zone' || clue.kind === 'alone-with') {
    const together = clue.kind === 'alone-with' || !clue.not;
    return {
      who: zoneReach(scene, domains[clue.other], together),
      other: zoneReach(scene, domains[clue.who], together),
    };
  }

  const axis = clue.direction === 'north' || clue.direction === 'south' ? 'row' : 'column';
  const distance = clue.kind === 'offset' ? clue.distance : null;
  // Le nord et l'ouest vont vers les petits index ; le sud et l'est vers les
  // grands. Une seule variable porte cette orientation, et le reste s'écrit une
  // fois pour les quatre directions.
  const forward = towardsLowIndices(clue.direction) ? -1 : 1;

  return {
    who: bandsToCells(
      scene,
      axis,
      shift(bandsOf(scene, domains[clue.other], axis), forward, distance, scene.size),
    ),
    other: bandsToCells(
      scene,
      axis,
      shift(bandsOf(scene, domains[clue.who], axis), -forward, distance, scene.size),
    ),
  };
}

const towardsLowIndices = (direction: Direction): boolean =>
  direction === 'north' || direction === 'west';

/**
 * Décale un masque de tranches.
 *
 * `distance` à `null` veut dire « strictement plus loin, sans plus » : le masque
 * s'étale alors dans la direction voulue au lieu de se décaler d'un cran. C'est
 * toute la différence entre « au sud de » et « exactement deux rangées au sud
 * de », et elle tient en une ligne.
 */
function shift(bands: number, forward: number, distance: number | null, size: number): number {
  let allowed = 0;
  for (let band = 0; band < size; band++) {
    if ((bands & (1 << band)) === 0) continue;
    if (distance !== null) {
      const target = band + forward * distance;
      if (target >= 0 && target < size) allowed |= 1 << target;
    } else {
      for (let step = band + forward; step >= 0 && step < size; step += forward) {
        allowed |= 1 << step;
      }
    }
  }
  return allowed;
}

/** Les tranches qu'un domaine atteint encore, en masque de bits. */
function bandsOf(scene: Scene, domain: CellSet, axis: 'row' | 'column'): number {
  const bands = axis === 'row' ? scene.rows : scene.columns;
  let mask = 0;
  for (let band = 0; band < bands.length; band++) {
    if (intersects(domain, bands[band])) mask |= 1 << band;
  }
  return mask;
}

/**
 * Les clefs de `scene.memo`, séparées par famille.
 *
 * Trois questions vivent dans la même table, donc trois espaces disjoints.
 *
 * Vingt-quatre bits de charge utile, et c'est une borne et non un confort. Un
 * masque de tranches porte `scene.size` bits ; un masque de pièces en porte
 * autant qu'il y a de pièces, **plus un** pour le sens de la relation. Les deux
 * sont déjà bornés à trente et un par ailleurs — `1 << index` en JavaScript
 * travaille sur trente-deux bits signés, donc un décor à trente-deux pièces
 * casserait la propagation bien avant cette table. Vingt-quatre laisse la
 * marge sans jamais faire se recouvrir deux espaces.
 */
const KEY_ROWS = 0;
const KEY_COLUMNS = 1 << 24;
const KEY_ZONES = 2 << 24;

function bandsToCells(scene: Scene, axis: 'row' | 'column', mask: number): CellSet {
  const key = (axis === 'row' ? KEY_ROWS : KEY_COLUMNS) | mask;
  const known = scene.memo.get(key);
  if (known !== undefined) return known;

  const bands = axis === 'row' ? scene.rows : scene.columns;
  let cells = emptySet(scene.cellCount);
  for (let band = 0; band < bands.length; band++) {
    if ((mask & (1 << band)) !== 0) cells = union(cells, bands[band]);
  }
  scene.memo.set(key, cells);
  return cells;
}

/**
 * Les cases compatibles avec les pièces que l'autre peut encore atteindre.
 *
 * Pour « même pièce », ce sont les pièces atteignables. Pour « pièce
 * différente », presque tout reste permis : seule l'unique pièce où l'autre est
 * enfermé devient interdite. Une contrainte négative n'élimine que lorsque
 * l'autre n'a plus le choix, et c'est normal — elle dit peu.
 */
function zoneReach(scene: Scene, domain: CellSet, together: boolean): CellSet {
  /*
    Le domaine ne compte que par les pièces qu'il touche.

    C'est ce qui rend la mémoïsation possible : le domaine est un ensemble de
    cases qui change à chaque nœud du solveur, mais tout ce qu'on en tire est un
    masque de pièces — au plus 2^pièces valeurs, fois deux pour le sens. Le
    calcul du masque reste, seule la construction de la réponse est retenue.
  */
  let reachable = 0;
  for (const zone of scene.zones) if (intersects(domain, zone.cells)) reachable |= 1 << zone.index;

  const key = KEY_ZONES | (reachable << 1) | (together ? 1 : 0);
  const known = scene.memo.get(key);
  if (known !== undefined) return known;

  let cells = emptySet(scene.cellCount);
  for (const zone of scene.zones) {
    const inside = (reachable & (1 << zone.index)) !== 0;
    const onlyPlace = inside && (reachable & (reachable - 1)) === 0;
    if (together ? inside : !onlyPlace) cells = union(cells, zone.cells);
  }
  scene.memo.set(key, cells);
  return cells;
}

/**
 * Les indices qui parlent de **qui d'autre** est dans la pièce.
 *
 * Ils ne se ramènent ni à un ensemble fixe ni à une relation entre deux
 * personnes : ils comptent les occupants. Le raisonnement tenu ici est le plus
 * simple qui soit correct — un suspect dont **tout** le domaine tient dans une
 * pièce y sera forcément, et un suspect dont **rien** ne l'atteint n'y sera
 * jamais. Les cas plus fins relèvent des techniques nommées.
 */
function pruneOccupancy(clue: Clue, scene: Scene, domains: readonly CellSet[]): Pruning[] {
  if (clue.kind !== 'alone' && clue.kind !== 'alone-with' && clue.kind !== 'victim') return [];

  const companion = clue.kind === 'alone-with' ? clue.other : -1;
  const remove = emptySet(scene.cellCount);
  let any = false;

  for (const cell of cellsOf(domains[clue.who])) {
    const zone = scene.zones[scene.zoneOf[cell]].cells;

    let forcedInside = 0;
    let ableInside = 0;
    for (let suspect = 0; suspect < domains.length; suspect++) {
      if (suspect === clue.who || suspect === companion) continue;
      if (isSubsetOf(domains[suspect], zone)) forcedInside++;
      if (intersects(domains[suspect], zone)) ableInside++;
    }

    // Combien de personnes, en plus de qui parle, la pièce doit contenir.
    const wanted = clue.kind === 'victim' ? 1 : 0;
    if (forcedInside > wanted || ableInside < wanted) {
      add(remove, cell);
      any = true;
    }
  }

  return any ? [{ suspect: clue.who, remove }] : [];
}
