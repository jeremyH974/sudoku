import { doorwaysOf } from '@sudoku/engine/investigation';
import type { Doorway, Scene } from '@sudoku/engine/investigation';

/**
 * Les tracés d'un plan : les murs, et le seuil de chaque porte.
 *
 * ─── Pourquoi un module, et non deux fonctions dans chaque vue ──────────────
 *
 * Parce que le plan se dessine désormais à **deux** endroits — à l'écran et sur
 * le papier — et qu'une géométrie recopiée est une géométrie qui dérive. Le jour
 * où l'épaisseur d'un mur change, le dossier imprimé et le plateau doivent
 * changer ensemble, sans que personne ait à y penser.
 *
 * Ce module ne connaît ni le DOM ni le thème : il rend des chaînes de tracé. Ce
 * qui les colore, les dimensionne et les pose appartient à la vue — et c'est ce
 * qui permet au papier d'en faire un usage entièrement différent de l'écran.
 *
 * ─── Le rapport quatre pour un, qui vient d'une norme ───────────────────────
 *
 * ISO 128-23 : dans un plan de bâtiment, le mur coupé porte le trait le plus
 * fort, le symbole de porte le plus fin, dans un rapport de quatre pour un.
 * `WALL` et `SILL` sont exprimés en **fraction de case**, donc indépendants de
 * la taille à laquelle le plan est rendu.
 */

/** L'épaisseur d'un mur, en fraction de case. */
export const WALL = 0.12;

/** Le seuil d'une porte : le quart du mur, exactement, et c'est la norme. */
export const SILL = WALL / 4;

const segment = (axis: 'vertical' | 'horizontal', line: number, from: number, to: number): string =>
  axis === 'vertical'
    ? `M${String(line)} ${String(from)}V${String(to)}`
    : `M${String(from)} ${String(line)}H${String(to)}`;

/**
 * Les murs du plan, en tracés d'un seul tenant.
 *
 * ─── Pourquoi un seul chemin, et pas un segment par case ────────────────────
 *
 * Parce qu'à cette échelle un pixel change le sens du dessin. Les moteurs
 * anticrénèlent **chaque forme séparément contre le canevas** au lieu de faire
 * un anticrénelage de scène : deux segments exactement jointifs laissent
 * apparaître une couture claire, qui va et vient selon le zoom et la densité
 * d'écran. Des pans d'un seul tenant n'ont pas de jonction à trahir.
 *
 * ─── Les coins ──────────────────────────────────────────────────────────────
 *
 * Les bouts sont carrés (`stroke-linecap: square`), donc chaque pan déborde d'un
 * demi-mur : c'est ce qui remplit les angles en L et en T sans un seul tracé de
 * plus. En contrepartie, l'ouverture d'une porte est **élargie d'un demi-mur de
 * chaque côté** avant d'être retranchée, pour que le vide visible mesure
 * exactement ce que le moteur a calculé.
 */
export function wallRuns(plan: Scene, doors: readonly Doorway[]): string {
  const size = plan.size;
  const parts: string[] = [];

  for (const axis of ['vertical', 'horizontal'] as const) {
    // Seules les lignes intérieures : le pourtour est la bordure du plateau,
    // qui est aussi ce qui le fait lire comme un objet posé.
    for (let line = 1; line < size; line++) {
      const openings = doors
        .filter((door) => door.axis === axis && door.line === line)
        .map((door) => ({ from: door.from - WALL / 2, to: door.to + WALL / 2 }))
        .sort((left, right) => left.from - right.from);

      let start = -1;
      for (let step = 0; step <= size; step++) {
        const solid =
          step < size &&
          (axis === 'vertical'
            ? plan.zoneOf[step * size + line - 1] !== plan.zoneOf[step * size + line]
            : plan.zoneOf[(line - 1) * size + step] !== plan.zoneOf[line * size + step]);

        if (solid && start === -1) start = step;
        if (!solid && start !== -1) {
          // Le pan court de `start` à `step` ; on en retire les ouvertures.
          let cursor = start;
          for (const hole of openings) {
            if (hole.to <= cursor || hole.from >= step) continue;
            if (hole.from > cursor) parts.push(segment(axis, line, cursor, hole.from));
            cursor = Math.max(cursor, hole.to);
          }
          if (cursor < step) parts.push(segment(axis, line, cursor, step));
          start = -1;
        }
      }
    }
  }
  return parts.join('');
}

/** Le seuil de chaque porte : le trait fin qui dit qu'on passe là. */
export function sills(doors: readonly Doorway[]): string {
  return doors.map((door) => segment(door.axis, door.line, door.from, door.to)).join('');
}

/** Les deux tracés d'une scène, calculés ensemble parce qu'ils se répondent. */
export function planPaths(scene: Scene): { doors: Doorway[]; walls: string; sills: string } {
  const doors = doorwaysOf(scene);
  return { doors, walls: wallRuns(scene, doors), sills: sills(doors) };
}
