import { add, cellsOf, emptySet, type CellSet, has, setOf } from './cellset.js';
import { PROPS, PROP_ORDER, type Decor, type PropId, type Scene, type Zone } from './types.js';

/**
 * Compile un décor écrit à la main en une scène prête à contraindre.
 *
 * Les vérifications ci-dessous ne sont pas de la défiance envers l'auteur du
 * décor : ce sont les hypothèses dont dépendent toutes les contraintes. Une
 * zone non connexe, par exemple, ne casserait rien mécaniquement — mais « à
 * côté de » signifiant « voisin **dans la même pièce** », elle ferait dire à un
 * indice quelque chose que le plan ne montre pas. Mieux vaut refuser le décor
 * que produire une affaire dont l'énoncé ment.
 */
export function buildScene(decor: Decor): Scene {
  const { size } = decor;
  if (!Number.isInteger(size) || size < 4 || size > 16) {
    throw new RangeError(`Décor « ${decor.id} » : côté ${String(size)} hors de [4, 16].`);
  }
  const cellCount = size * size;

  const zoneIndexByKey = new Map(decor.zones.map((zone, index) => [zone.key, index]));
  if (zoneIndexByKey.size !== decor.zones.length) {
    throw new Error(`Décor « ${decor.id} » : deux zones portent la même lettre.`);
  }

  const zoneOf = readLayer(decor, decor.plan, 'plan', (letter, cell) => {
    const index = zoneIndexByKey.get(letter);
    if (index === undefined) {
      throw new Error(
        `Décor « ${decor.id} » : la case ${cellLabel(size, cell)} porte la lettre de zone ` +
          `« ${letter} », qui n'est déclarée nulle part.`,
      );
    }
    return index;
  });

  const zones: Zone[] = decor.zones.map((zone, index) => {
    const cells = emptySet(cellCount);
    for (let cell = 0; cell < cellCount; cell++) if (zoneOf[cell] === index) add(cells, cell);
    return {
      index,
      key: zone.key,
      name: zone.name,
      article: zone.article,
      cells,
      size: cellsOf(cells).length,
    };
  });

  for (const zone of zones) {
    if (zone.size === 0) {
      throw new Error(`Décor « ${decor.id} » : la zone « ${zone.name} » n'a aucune case.`);
    }
    if (!isConnected(zone.cells, zoneOf, zone.index, size, cellCount)) {
      throw new Error(
        `Décor « ${decor.id} » : la zone « ${zone.name} » est en deux morceaux. ` +
          `« À côté de » veut dire « voisin dans la même pièce » : une pièce coupée en deux ` +
          `ferait dire à un indice le contraire de ce que le plan montre.`,
      );
    }
  }

  // Un `Record<string, …>` promet une valeur pour n'importe quelle clé, ce qui
  // est faux d'une légende : elle n'en a que pour les lettres qu'elle déclare.
  // Une `Map` le dit dans son type, et rend la vérification ci-dessous réelle.
  const propByLetter = new Map<string, PropId>(Object.entries(decor.legend));

  const propsOf = new Uint32Array(cellCount);
  for (const layer of decor.furniture) {
    readLayer(decor, layer, 'mobilier', (letter, cell) => {
      if (letter === '.') return 0;
      const prop = propByLetter.get(letter);
      if (prop === undefined) {
        throw new Error(
          `Décor « ${decor.id} » : la case ${cellLabel(size, cell)} porte le meuble ` +
            `« ${letter} », absent de la légende.`,
        );
      }
      propsOf[cell] |= 1 << PROP_ORDER.indexOf(prop);
      return 0;
    });
  }

  const neighbours: CellSet[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const set = emptySet(cellCount);
    for (const neighbour of orthogonalNeighbours(cell, size)) {
      // La règle qui fait du plan un sujet plutôt qu'un décor : les murs
      // bloquent. Deux cases côte à côte mais de pièces différentes ne sont pas
      // « à côté » l'une de l'autre.
      if (zoneOf[neighbour] === zoneOf[cell]) add(set, neighbour);
    }
    neighbours.push(set);
  }

  const cellsWithProp = new Map<PropId, CellSet>();
  const cellsNextToProp = new Map<PropId, CellSet>();
  const propsPresent: PropId[] = [];
  for (const prop of PROP_ORDER) {
    const bit = 1 << PROP_ORDER.indexOf(prop);
    const bearing = emptySet(cellCount);
    for (let cell = 0; cell < cellCount; cell++) if ((propsOf[cell] & bit) !== 0) add(bearing, cell);
    if (cellsOf(bearing).length === 0) continue;

    const beside = emptySet(cellCount);
    for (let cell = 0; cell < cellCount; cell++) {
      for (const neighbour of cellsOf(neighbours[cell])) {
        if (has(bearing, neighbour)) {
          add(beside, cell);
          break;
        }
      }
    }
    cellsWithProp.set(prop, bearing);
    cellsNextToProp.set(prop, beside);
    propsPresent.push(prop);
  }

  const rows: CellSet[] = [];
  const columns: CellSet[] = [];
  for (let index = 0; index < size; index++) {
    const row: number[] = [];
    const column: number[] = [];
    for (let k = 0; k < size; k++) {
      row.push(index * size + k);
      column.push(k * size + index);
    }
    rows.push(setOf(cellCount, row));
    columns.push(setOf(cellCount, column));
  }

  return {
    id: decor.id,
    title: decor.title,
    size,
    cellCount,
    zones,
    zoneOf,
    propsOf,
    cellsWithProp,
    cellsNextToProp,
    neighbours,
    rows,
    columns,
    propsPresent,
  };
}

/** La case porte-t-elle ce meuble ? */
export const cellHasProp = (scene: Scene, cell: number, prop: PropId): boolean =>
  (scene.propsOf[cell] & (1 << PROP_ORDER.indexOf(prop))) !== 0;

/** Les meubles d'une case, dans l'ordre stable. */
export function propsOfCell(scene: Scene, cell: number): PropId[] {
  return PROP_ORDER.filter((prop) => cellHasProp(scene, cell, prop));
}

/** Nom de la pièce d'une case. */
export const zoneNameOf = (scene: Scene, cell: number): string =>
  scene.zones[scene.zoneOf[cell]].name;

/** Repère lisible d'une case — « R3C4 », comme sur le plan imprimé. */
export const cellLabel = (size: number, cell: number): string =>
  `R${String(Math.floor(cell / size) + 1)}C${String((cell % size) + 1)}`;

/** Le nom français d'un meuble, avec son article indéfini. */
export function propWithArticle(prop: PropId): string {
  const kind = PROPS[prop];
  return `${kind.gender === 'f' ? 'une' : 'un'} ${kind.noun}`;
}

function orthogonalNeighbours(cell: number, size: number): number[] {
  const row = Math.floor(cell / size);
  const column = cell % size;
  const found: number[] = [];
  if (row > 0) found.push(cell - size);
  if (row < size - 1) found.push(cell + size);
  if (column > 0) found.push(cell - 1);
  if (column < size - 1) found.push(cell + 1);
  return found;
}

/**
 * Lit un calque de lettres et le vérifie.
 *
 * Le retour n'est utilisé que par le plan des zones ; le mobilier écrit dans
 * son propre tableau et renvoie 0. Factoriser la lecture plutôt que la copier
 * garantit que les deux calques subissent exactement les mêmes vérifications de
 * forme — c'est là que les décors écrits à la main se trompent.
 */
function readLayer(
  decor: Decor,
  layer: readonly string[],
  what: string,
  interpret: (letter: string, cell: number) => number,
): Int8Array {
  const { size } = decor;
  if (layer.length !== size) {
    throw new Error(
      `Décor « ${decor.id} » : le calque ${what} a ${String(layer.length)} rangées ` +
        `pour un plateau de ${String(size)}.`,
    );
  }
  const values = new Int8Array(size * size);
  for (let row = 0; row < size; row++) {
    const line = layer[row];
    if (line.length !== size) {
      throw new Error(
        `Décor « ${decor.id} » : la rangée ${String(row + 1)} du calque ${what} a ` +
          `${String(line.length)} cases pour un plateau de ${String(size)}.`,
      );
    }
    for (let column = 0; column < size; column++) {
      values[row * size + column] = interpret(line[column], row * size + column);
    }
  }
  return values;
}

/** Une pièce est-elle d'un seul tenant ? Parcours en largeur depuis sa première case. */
function isConnected(
  cells: CellSet,
  zoneOf: Int8Array,
  zoneIndex: number,
  size: number,
  cellCount: number,
): boolean {
  const all = cellsOf(cells);
  const seen = new Set<number>([all[0]]);
  const queue = [all[0]];
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    for (const neighbour of orthogonalNeighbours(cell, size)) {
      if (neighbour < cellCount && zoneOf[neighbour] === zoneIndex && !seen.has(neighbour)) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return seen.size === all.length;
}
