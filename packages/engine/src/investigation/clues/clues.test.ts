import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng/index.js';
import { castOf, type Suspect } from '../cast.js';
import { candidatesFor, crimeScenes } from '../compose/candidates.js';
import { openDomains } from '../exact/solver.js';
import { has } from '../scene/cellset.js';
import { loadDecor } from '../scene/decors.js';
import { buildScene } from '../scene/scene.js';
import type { Scene } from '../scene/types.js';
import type { Puzzle } from '../types.js';
import { renderClue } from './render.js';
import { holds, murdererOf, occupantsOf, unaryCells } from './semantics.js';
import type { Clue } from './types.js';

/**
 * Les indices, vérifiés contre leur propre définition.
 *
 * `holds` **est** la définition : un indice est vrai d'une disposition, ou il
 * ne l'est pas. Tout le reste — les ensembles précalculés, les propagateurs, le
 * générateur — n'en est qu'une reformulation plus rapide. Les propriétés
 * ci-dessous vérifient que ces reformulations disent exactement la même chose,
 * ce qu'aucune relecture ne garantit.
 */

const scene: Scene = buildScene(loadDecor('manor'));
const suspects: readonly Suspect[] = castOf(scene.size);

/** Une disposition valide : une permutation des rangées, une des colonnes. */
function placementFrom(seed: number): number[] {
  const rng = createRng(seed);
  const rows = rng.shuffle([...Array(suspects.length).keys()]);
  const columns = rng.shuffle([...Array(suspects.length).keys()]);
  return rows.map((row, suspect) => row * scene.size + columns[suspect]);
}

/** La réserve d'indices vrais d'une disposition, tous suspects confondus. */
function poolFor(at: readonly number[], victim: number): Clue[] {
  return suspects.flatMap((suspect) => candidatesFor(scene, at, suspect.index, victim));
}

/** Une disposition qui admet une scène de crime, et sa victime. */
function scenarioFrom(seed: number): { at: number[]; victim: number } | null {
  const at = placementFrom(seed);
  const rooms = crimeScenes(scene, at);
  if (rooms.length === 0) return null;
  return { at, victim: occupantsOf(scene, at, rooms[0])[0] };
}

describe('holds', () => {
  it('n’accepte que des indices vrais dans la réserve du générateur', () => {
    // Le générateur ne puise que là : si un seul indice de la réserve était
    // faux, une affaire pourrait contredire son propre corrigé.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (seed) => {
        const scenario = scenarioFrom(seed);
        fc.pre(scenario !== null);
        for (const clue of poolFor(scenario.at, scenario.victim)) {
          expect(holds(clue, scene, scenario.at)).toBe(true);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('fait de la négation le contraire exact de l’affirmation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 5 }),
        (seed, who) => {
          const at = placementFrom(seed);
          for (const prop of scene.propsPresent) {
            const yes: Clue = { kind: 'next-to-prop', who, prop, not: false };
            const no: Clue = { kind: 'next-to-prop', who, prop, not: true };
            expect(holds(yes, scene, at)).toBe(!holds(no, scene, at));
          }
          for (let zone = 0; zone < scene.zones.length; zone++) {
            const yes: Clue = { kind: 'in-zone', who, zone, not: false };
            const no: Clue = { kind: 'in-zone', who, zone, not: true };
            expect(holds(yes, scene, at)).toBe(!holds(no, scene, at));
          }
        },
      ),
    );
  });
});

describe('unaryCells', () => {
  it('énumère exactement les cases où l’indice serait vrai', () => {
    // C'est le raccourci dont dépend toute la propagation des indices qui se
    // lisent seuls. S'il divergeait de `holds`, il écarterait des cases que la
    // solution occupe — et l'affaire n'aurait plus de solution du tout.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3000 }), (seed) => {
        const at = placementFrom(seed);
        const unary = poolFor(at, 0).filter((clue) => unaryCells(clue, scene) !== null);
        fc.pre(unary.length > 0);

        for (const clue of unary) {
          const allowed = unaryCells(clue, scene) as Uint32Array;
          for (let cell = 0; cell < scene.cellCount; cell++) {
            const moved = [...at];
            moved[clue.who] = cell;
            expect(has(allowed, cell)).toBe(holds(clue, scene, moved));
          }
        }
      }),
      { numRuns: 25 },
    );
  });
});

describe('la propagation', () => {
  it('n’écarte jamais la case que la solution occupe', () => {
    /*
      La propriété de sûreté du mode, et la seule qui ne se négocie pas.

      Un propagateur a le droit d'être incomplet — il coûte alors du temps. Il
      n'a pas le droit d'être faux : une case écartée à tort rend l'affaire
      insoluble, et le joueur en fait les frais sans pouvoir le savoir.

      On la vérifie sur la propagation seule, et non sur l'énumération des
      solutions : avec un ou deux indices, une affaire en admet des centaines de
      milliers, et toute borne d'énumération tronquerait la vérification au lieu
      de la faire. La première rédaction de ce test s'y est trompée.
    */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 1, max: 40 }),
        (seed, take) => {
          const scenario = scenarioFrom(seed);
          fc.pre(scenario !== null);
          const rng = createRng(seed ^ 0x5eed);
          const clues = rng.shuffle(poolFor(scenario.at, scenario.victim)).slice(0, take);
          clues.push({ kind: 'victim', who: scenario.victim });

          const puzzle: Puzzle = { scene, suspects, victim: scenario.victim, clues };
          const domains = openDomains(puzzle);
          expect(domains).not.toBeNull();
          for (const suspect of suspects) {
            expect(has((domains as Uint32Array[])[suspect.index], scenario.at[suspect.index])).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('murdererOf', () => {
  it('désigne l’autre occupant de la pièce de la victime', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), (seed) => {
        const scenario = scenarioFrom(seed);
        fc.pre(scenario !== null);
        const guilty = murdererOf(scene, scenario.at, scenario.victim);
        expect(guilty).not.toBe(-1);
        expect(guilty).not.toBe(scenario.victim);
        expect(scene.zoneOf[scenario.at[guilty]]).toBe(scene.zoneOf[scenario.at[scenario.victim]]);
      }),
      { numRuns: 40 },
    );
  });

  it('refuse de nommer un coupable quand la pièce n’en contient pas deux', () => {
    // Aucune affaire n'est distribuée dans cet état. La valeur -1 est là pour
    // que le jour où ça arriverait, ce soit visible et non un coupable inventé.
    const at = placementFrom(1);
    const crowded = scene.zones.findIndex(
      (zone) => occupantsOf(scene, at, zone.index).length !== 2 && zone.size > 0,
    );
    const lonely = occupantsOf(scene, at, crowded)[0];
    fc.pre(lonely !== undefined);
    expect(murdererOf(scene, at, lonely)).toBe(-1);
  });
});

describe('le rendu français', () => {
  const render = (clue: Clue): string => renderClue(clue, scene, suspects);

  it('fait une phrase de chaque indice', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3000 }), (seed) => {
        const at = placementFrom(seed);
        for (const clue of poolFor(at, 0)) {
          const sentence = render(clue);
          expect(sentence.endsWith('.')).toBe(true);
          expect(sentence[0]).toBe(sentence[0].toUpperCase());
          expect(sentence).not.toMatch(/undefined|NaN|\[object/);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('élide devant une voyelle, et seulement là', () => {
    // « de Adèle » et « que Élise » sont les fautes que le générateur produit
    // spontanément : les prénoms sont des données, pas des littéraux relus.
    expect(render({ kind: 'direction', who: 1, other: 0, direction: 'south' })).toBe(
      "Il était au sud d'Adèle.",
    );
    expect(render({ kind: 'direction', who: 0, other: 1, direction: 'south' })).toBe(
      'Elle était au sud de Bruno.',
    );
    expect(render({ kind: 'same-zone', who: 1, other: 4, not: false })).toBe(
      "Il était dans la même pièce qu'Élise.",
    );
    expect(render({ kind: 'same-zone', who: 0, other: 1, not: true })).toBe(
      "Elle n'était pas dans la même pièce que Bruno.",
    );
  });

  it('accorde en genre, verbe et adjectif compris', () => {
    expect(render({ kind: 'on-prop', who: 0, prop: 'chair', not: false })).toBe(
      'Elle était assise sur une chaise.',
    );
    expect(render({ kind: 'on-prop', who: 1, prop: 'chair', not: false })).toBe(
      'Il était assis sur une chaise.',
    );
    expect(render({ kind: 'alone', who: 0 })).toBe('Elle était seule.');
    expect(render({ kind: 'alone', who: 1 })).toBe('Il était seul.');
  });

  it('donne son article à chaque pièce et son genre à chaque meuble', () => {
    expect(render({ kind: 'in-zone', who: 1, zone: 0, not: false })).toBe(
      'Il était dans le Salon.',
    );
    expect(render({ kind: 'in-zone', who: 1, zone: 1, not: false })).toBe(
      'Il était dans la Bibliothèque.',
    );
    expect(render({ kind: 'next-to-prop', who: 1, prop: 'shelf', not: true })).toBe(
      "Il n'était pas à côté d'une étagère.",
    );
    expect(render({ kind: 'on-prop', who: 1, prop: 'rug', not: false })).toBe(
      'Il était sur un tapis.',
    );
  });

  it('compte en lettres, et accorde le nombre', () => {
    expect(render({ kind: 'offset', who: 0, other: 1, direction: 'north', distance: 1 })).toBe(
      'Elle était exactement une rangée au nord de Bruno.',
    );
    expect(render({ kind: 'offset', who: 0, other: 1, direction: 'east', distance: 3 })).toBe(
      "Elle était exactement trois colonnes à l'est de Bruno.",
    );
    expect(render({ kind: 'in-band', who: 1, axis: 'column', index: 0 })).toBe(
      'Il était dans la première colonne.',
    );
  });

  it('dit la victime sans nommer le coupable', () => {
    const said = render({ kind: 'victim', who: 0 });
    expect(said).toBe('La victime. Elle était seule avec le meurtrier.');
    for (const suspect of suspects) expect(said).not.toContain(suspect.name);
  });
});
