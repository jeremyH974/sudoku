import { describe, expect, it } from 'vitest';
import { DECORS } from './decors.js';
import { buildScene } from './scene.js';
import { doorFaults, doorwaysOf } from './doors.js';
import type { Doorway } from './doors.js';
import type { Scene } from './types.js';

/**
 * Les portes, vérifiées là où l'œil ne suffit pas.
 *
 * Une porte mal posée ne se voit pas : elle ressemble à une porte. Ce qui se
 * vérifie, en revanche, c'est qu'on puisse **traverser le bâtiment**, que
 * l'ouverture laisse du mur de chaque côté, et que le plan ne change pas d'une
 * ouverture à l'autre.
 */

const scenes: { title: string; scene: Scene }[] = DECORS.map((decor) => ({
  title: decor.title,
  scene: buildScene(decor),
}));

/** Les deux bornes d'une porte le long de son mur, et le mur qu'elle perce. */
const span = (door: Doorway): number => door.to - door.from;

describe('les portes du plan', () => {
  it('trouve bien des décors à inspecter', () => {
    // Le garde-fou du garde-fou : une liste vide ferait passer tout le reste.
    expect(scenes.length).toBeGreaterThanOrEqual(4);
    for (const { scene } of scenes) expect(scene.zones.length).toBeGreaterThan(1);
  });

  it('en perce exactement une de moins qu’il n’y a de pièces', () => {
    /*
      C'est la signature d'un arbre couvrant, et elle porte les deux moitiés de
      ce qu'on veut : `pièces − 1` est le minimum pour que tout communique, et
      c'est aussi le maximum sans qu'un cycle apparaisse — donc sans qu'un mur
      soit percé pour rien.
    */
    for (const { title, scene } of scenes) {
      expect(doorwaysOf(scene), title).toHaveLength(scene.zones.length - 1);
    }
  });

  it('laisse traverser tout le bâtiment', () => {
    // La propriété qui justifie que ce calcul vive dans le moteur : un plan dont
    // une pièce ne communique avec rien est faux, pas discutable.
    for (const { title, scene } of scenes) {
      expect(doorFaults(scene), title).toEqual([]);
    }
  });

  it('rend le même plan à chaque appel', () => {
    /*
      Une affaire se rejoue depuis son code imprimé. Un plan dont les portes
      bougeraient d'une ouverture à l'autre ferait douter le joueur de ce qu'il
      a vu — c'est la même exigence que les valeurs figées du PRNG, pour la
      même raison.

      L'ordre compte autant que le contenu : `doorwaysOf` parcourt une `Map`, et
      un départage incomplet laisserait l'ordre d'insertion décider.
    */
    for (const { title, scene } of scenes) {
      const first = doorwaysOf(scene);
      const second = doorwaysOf(scene);
      expect(second, title).toEqual(first);
      expect(doorwaysOf(buildScene(DECORS.find((d) => d.title === title)!)), title).toEqual(first);
    }
  });

  it('garde du mur de chaque côté de l’ouverture', () => {
    /*
      Une porte qui court d'un angle à l'autre ne se lit plus comme une porte
      mais comme un mur manquant : rien ne dit alors qu'il y avait là une
      séparation. L'ouverture doit donc rester **strictement à l'intérieur** du
      pan qu'elle perce.

      La borne est arithmétique et non esthétique : le pan le plus étroit qu'on
      puisse percer fait une case, et l'ouverture en fait 0,6 — il reste 0,2 de
      chaque côté, ce qui n'est pas beaucoup mais n'est jamais zéro.
    */
    for (const { title, scene } of scenes) {
      for (const door of doorwaysOf(scene)) {
        expect(span(door), `${title} : ${JSON.stringify(door.zones)}`).toBeLessThan(1);
        expect(span(door), title).toBeGreaterThan(0);

        // Le mur percé existe bien : les cases de part et d'autre, au milieu de
        // l'ouverture, appartiennent aux deux pièces annoncées.
        const middle = Math.floor((door.from + door.to) / 2);
        const [before, after] =
          door.axis === 'vertical'
            ? [middle * scene.size + door.line - 1, middle * scene.size + door.line]
            : [(door.line - 1) * scene.size + middle, door.line * scene.size + middle];
        const found = [scene.zoneOf[before], scene.zoneOf[after]].sort((a, b) => a - b);
        expect(found, `${title} : la porte doit longer le mur qu'elle annonce`).toEqual([
          door.zones[0],
          door.zones[1],
        ]);
      }
    }
  });

  it('ne perce jamais le mur extérieur', () => {
    // Le plan se lit comme un intérieur : aucune donnée d'un décor ne dit où est
    // la façade, et poser une porte d'entrée au hasard serait inventer une
    // information — la règle vaut pour le dessin comme pour la difficulté.
    for (const { title, scene } of scenes) {
      for (const door of doorwaysOf(scene)) {
        expect(door.line, `${title} : porte sur un bord`).toBeGreaterThan(0);
        expect(door.line, `${title} : porte sur un bord`).toBeLessThan(scene.size);
      }
    }
  });

  it('ne relie jamais une pièce à elle-même', () => {
    for (const { title, scene } of scenes) {
      for (const door of doorwaysOf(scene)) {
        expect(door.zones[0], title).toBeLessThan(door.zones[1]);
      }
    }
  });

  it('dit ce qui manque quand une pièce est enfermée', () => {
    /*
      Le test qui vérifie que le contrôle **peut** échouer. Sans lui,
      `doorFaults` pourrait rendre la liste vide par accident et personne ne le
      saurait — c'est exactement ce qui rend un garde-fou silencieusement
      inopérant.

      On fabrique le cas dégénéré : une scène dont on retire toutes les portes.
    */
    const scene = scenes[0].scene;
    const isolated: Scene = {
      ...scene,
      // Une pièce de plus, que rien ne touche : aucun arbre couvrant ne
      // l'atteint, et la connexité doit le dire.
      zones: [...scene.zones, { ...scene.zones[0], index: scene.zones.length, key: 'Z', name: 'Oubliette' }],
    };
    const faults = doorFaults(isolated);
    expect(faults.length).toBeGreaterThan(0);
    expect(faults.join(' ')).toContain('Oubliette');
  });
});
