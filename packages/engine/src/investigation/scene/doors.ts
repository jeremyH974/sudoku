import type { Scene } from './types.js';

/**
 * Les portes d'un plan, déduites de sa géométrie et jamais écrites à la main.
 *
 * ─── Pourquoi le moteur, pour quelque chose qu'on ne fait que dessiner ──────
 *
 * Aucun indice ne parle de porte, et le solveur n'en saura jamais rien : une
 * porte ne change pas une déduction. Elle vit pourtant ici, et pour deux
 * raisons qui tiennent.
 *
 * La première est qu'un plan dont les pièces sont scellées n'est pas un
 * bâtiment. C'était le cas jusqu'ici — un mur partout où deux pièces se
 * touchent, aucune ouverture nulle part, cinq boîtes hermétiques. Personne ne
 * le remarque consciemment et tout le monde le voit.
 *
 * La seconde est qu'**il y a là une propriété à prouver**. Un décor dont les
 * pièces ne communiquent pas toutes est un décor faux, au même titre qu'une
 * pièce en deux morceaux — et `scene.ts` refuse déjà celle-là. Le refus se
 * mesure, donc il appartient au moteur, à côté de `measure.ts`.
 *
 * ─── La règle : un arbre couvrant, pas une porte par mitoyenneté ────────────
 *
 * Le choix a été tranché en comptant, pas en imaginant. Sur les quatre décors,
 * « une porte entre chaque paire de pièces voisines » donne **six à huit**
 * ouvertures pour cinq pièces sur trente-six cases, et deux paires ne
 * partagent qu'**une seule arête** — la porte y mangerait tout le mur, et il ne
 * resterait rien à percer.
 *
 * L'arbre couvrant en donne exactement `pièces − 1`, soit quatre partout. Une
 * maison de cinq pièces avec quatre portes se lit ; avec huit, le plan devient
 * une dentelle et les murs cessent de raconter quoi que ce soit.
 *
 * Et l'arbre est **de poids maximal** : entre deux mitoyennetés, on perce la
 * plus large. C'est là que les portes se mettent dans un vrai bâtiment, et cela
 * garantit accessoirement qu'un mur subsiste de chaque côté de l'ouverture.
 *
 * ─── Ce qui n'est pas ici ───────────────────────────────────────────────────
 *
 * **La porte d'entrée.** Une ouverture sur l'extérieur demanderait de savoir où
 * est la façade, et rien dans un décor ne le dit. L'inventer serait inventer
 * une information — la règle du projet vaut pour le dessin comme pour la
 * difficulté. Le plan se lit donc comme un intérieur.
 *
 * **Le sens d'ouverture.** Un plan d'architecte porte le vantail et son arc de
 * débattement, qui cotent le dégagement au sol. Nous n'avons aucune donnée
 * là-dessus, et le dessiner au hasard donnerait une information fausse sur un
 * plan par ailleurs exact. L'ouverture reste donc nue, ce qu'ISO 7519 traite
 * comme un objet distinct de la porte : une baie.
 */

/** L'axe d'un mur. Une porte est toujours percée dans un mur, donc orientée. */
export type WallAxis = 'vertical' | 'horizontal';

/**
 * Une ouverture dans un mur, en unités de case.
 *
 * Les coordonnées sont **continues**, pas des index de case : une porte n'a
 * aucune raison de faire exactement une case de large, et les vraies n'en font
 * pas. `line` est la ligne de grille que le mur suit ; `from` et `to` bornent
 * le vide le long de cette ligne.
 */
export interface Doorway {
  /** Les deux pièces que la porte relie, par index croissant. */
  readonly zones: readonly [number, number];
  readonly axis: WallAxis;
  /** La ligne de grille du mur : `x` si vertical, `y` si horizontal. */
  readonly line: number;
  /** Début du vide le long du mur. */
  readonly from: number;
  /** Fin du vide le long du mur. */
  readonly to: number;
}

/**
 * La largeur d'une porte, en fraction de case.
 *
 * Ce n'est pas un réglage esthétique mais un rapport repris du bâti. Une porte
 * intérieure fait 73 à 83 cm de largeur nominale (arrêté du 24 décembre 2015 :
 * 0,80 m nominal, 0,77 m de passage utile) ; une case de ce plan vaut une
 * portion de pièce de l'ordre du mètre cinquante. Le rapport tombe autour de
 * trois cinquièmes.
 *
 * La borne haute compte autant que la valeur : en restant **sous** une case,
 * l'ouverture laisse toujours du mur de chaque côté, même sur la mitoyenneté
 * la plus étroite. Un vide qui court d'un angle à l'autre ne se lit plus comme
 * une porte mais comme un mur manquant.
 */
const DOOR_WIDTH = 0.6;

/** Une arête entre deux pièces, repérée par la ligne de grille qu'elle occupe. */
interface Edge {
  readonly axis: WallAxis;
  readonly line: number;
  /** Le début de l'arête le long du mur ; elle en occupe toujours une case. */
  readonly at: number;
}

/** La clef d'une paire de pièces, dans l'ordre croissant. */
const pairKey = (a: number, b: number): string =>
  `${String(Math.min(a, b))}|${String(Math.max(a, b))}`;

/**
 * Les arêtes mitoyennes, groupées par paire de pièces.
 *
 * On ne balaie que deux côtés par case — la droite et le bas. Chaque arête a
 * ainsi **une seule** représentation, ce qui évite de compter deux fois un mur
 * et rend l'ordre du résultat indépendant du sens de parcours.
 */
function edgesByPair(scene: Scene): Map<string, Edge[]> {
  const size = scene.size;
  const pairs = new Map<string, Edge[]>();

  const add = (a: number, b: number, edge: Edge): void => {
    const key = pairKey(a, b);
    const list = pairs.get(key);
    if (list === undefined) pairs.set(key, [edge]);
    else list.push(edge);
  };

  for (let cell = 0; cell < scene.cellCount; cell++) {
    const row = Math.floor(cell / size);
    const column = cell % size;
    const here = scene.zoneOf[cell];

    if (column + 1 < size) {
      const right = scene.zoneOf[cell + 1];
      if (right !== here) add(here, right, { axis: 'vertical', line: column + 1, at: row });
    }
    if (row + 1 < size) {
      const below = scene.zoneOf[cell + size];
      if (below !== here) add(here, below, { axis: 'horizontal', line: row + 1, at: column });
    }
  }
  return pairs;
}

/**
 * Le plus long pan de mur d'un seul tenant, parmi les arêtes d'une paire.
 *
 * Deux pièces ne se touchent pas forcément en un seul endroit : sur les quatre
 * décors, quatre paires se rencontrent en **deux** pans séparés — un salon qui
 * borde un couloir en haut puis à nouveau plus bas. Centrer la porte sur
 * « toutes les arêtes » la poserait alors dans le mur qui les sépare, c'est-à-
 * dire nulle part. On regroupe donc par contiguïté, et on perce le plus long.
 *
 * À égalité, le pan le plus proche de l'origine gagne : il faut une règle, et
 * celle-ci ne dépend que de la géométrie.
 */
function longestRun(edges: readonly Edge[]): { axis: WallAxis; line: number; from: number; to: number } {
  const runs: Edge[][] = [];
  const sorted = [...edges].sort(
    (left, right) =>
      left.axis.localeCompare(right.axis) || left.line - right.line || left.at - right.at,
  );

  let current: Edge[] = [];
  for (const edge of sorted) {
    const tail = current.length === 0 ? null : current[current.length - 1];
    if (tail !== null && tail.axis === edge.axis && tail.line === edge.line && tail.at + 1 === edge.at) {
      current.push(edge);
    } else {
      current = [edge];
      runs.push(current);
    }
  }

  let best = runs[0];
  for (const run of runs) if (run.length > best.length) best = run;

  const head = best[0];
  return { axis: head.axis, line: head.line, from: head.at, to: head.at + best.length };
}

/** Le père d'un ensemble disjoint, avec compression de chemin. */
function findRoot(parent: number[], node: number): number {
  let root = node;
  while (parent[root] !== root) root = parent[root];
  for (let step = node; parent[step] !== root; ) {
    const next = parent[step];
    parent[step] = root;
    step = next;
  }
  return root;
}

/**
 * Les portes d'une scène.
 *
 * Déterministe et sans hasard : le même plan rend les mêmes portes, toujours et
 * partout. C'est indispensable — une affaire se rejoue depuis son code imprimé,
 * et un plan qui changerait de portes d'une ouverture à l'autre ferait douter
 * le joueur de ce qu'il a vu.
 */
export function doorwaysOf(scene: Scene): Doorway[] {
  const pairs = edgesByPair(scene);

  /*
    Les candidates, triées pour un Kruskal de poids **maximal** : le pan le plus
    large d'abord. Les départages sont géométriques et complets — longueur, puis
    paire, puis position — pour qu'aucun ordre d'itération de `Map` ne puisse
    changer le résultat.
  */
  const candidates = [...pairs.entries()]
    .map(([key, edges]) => {
      const [first, second] = key.split('|').map(Number);
      const run = longestRun(edges);
      return { zones: [first, second] as const, span: run.to - run.from, run };
    })
    .sort(
      (left, right) =>
        right.span - left.span ||
        left.zones[0] - right.zones[0] ||
        left.zones[1] - right.zones[1] ||
        left.run.line - right.run.line ||
        left.run.from - right.run.from,
    );

  const parent = scene.zones.map((_, index) => index);
  const doors: Doorway[] = [];

  for (const candidate of candidates) {
    const left = findRoot(parent, candidate.zones[0]);
    const right = findRoot(parent, candidate.zones[1]);
    if (left === right) continue;
    parent[left] = right;

    const middle = (candidate.run.from + candidate.run.to) / 2;
    doors.push({
      zones: candidate.zones,
      axis: candidate.run.axis,
      line: candidate.run.line,
      from: middle - DOOR_WIDTH / 2,
      to: middle + DOOR_WIDTH / 2,
    });
  }

  return doors;
}

/**
 * Ce qui rend un plan impraticable, dit en toutes lettres.
 *
 * Le pendant de `decorFaults` pour la circulation. Un décor qui échoue ici est
 * un bâtiment où l'on ne peut pas aller d'une pièce à une autre — et ce n'est
 * pas une question de goût, c'est faux.
 */
export function doorFaults(scene: Scene): string[] {
  const doors = doorwaysOf(scene);
  const faults: string[] = [];

  const expected = scene.zones.length - 1;
  if (doors.length !== expected) {
    faults.push(
      `${String(doors.length)} porte(s) pour ${String(scene.zones.length)} pièces : ` +
        `il en faut exactement ${String(expected)}, sinon une pièce est isolée ou un mur est percé pour rien.`,
    );
  }

  /*
    La connexité, vérifiée en marchant plutôt qu'en faisant confiance au
    Kruskal. Un arbre couvrant la garantit par construction — mais c'est
    précisément la construction qu'on veut pouvoir casser sans s'en apercevoir.
  */
  const reached = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const zone = stack.pop() as number;
    for (const door of doors) {
      const other =
        door.zones[0] === zone ? door.zones[1] : door.zones[1] === zone ? door.zones[0] : -1;
      if (other !== -1 && !reached.has(other)) {
        reached.add(other);
        stack.push(other);
      }
    }
  }
  if (reached.size !== scene.zones.length) {
    const isolated = scene.zones.filter((zone) => !reached.has(zone.index)).map((zone) => zone.name);
    faults.push(`pièces qu'aucune porte n'atteint : ${isolated.join(', ')}`);
  }

  return faults;
}
