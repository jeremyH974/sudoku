import { describe, expect, it } from 'vitest';
import { CELL_COUNT, SIZE, countDigits, parseGrid } from '../../grid/index.js';
import { createRng } from '../../rng/index.js';
import { generatePuzzle } from '../../generate/index.js';
import { findSolution } from '../../solver/index.js';
import { LogicState } from '../state.js';
import { replayPath, solveLogically } from '../solve.js';
import { rate } from '../rate.js';
import { checkStepSoundness } from '../testing.js';
import { nakedPair, nakedQuad, nakedTriple } from './nakedSet.js';

/**
 * Les sous-ensembles nus, vérifiés par **complétude** et non par exemples.
 *
 * ─── Ce que ce fichier garde, et pourquoi il a fallu l'écrire ───────────────
 *
 * Jusqu'à l'incrément 18, la recherche abandonnait une unité dès que les cases
 * **candidates à être membres** — celles qui portent de 2 à N candidats —
 * n'étaient pas plus nombreuses que le motif cherché. Le raccourci semble sain
 * et il est faux : les cases qu'un sous-ensemble nu élimine sont précisément
 * celles qui ont **plus** de N candidats, donc celles que ce filtre vient
 * d'écarter. Une colonne à quatre cases vides dont deux tenaient en « 2 ou 8 »
 * était abandonnée, alors que la paire nue y éliminait bel et bien.
 *
 * Aucun test ne pouvait le voir : la grille finissait résolue, par une technique
 * plus chère. Le seul symptôme était une note trop haute, et il a fallu la
 * confronter à l'oracle pour l'apercevoir. D'où la forme de ce fichier — on ne
 * vérifie pas que la recherche trouve *quelque chose*, mais qu'elle trouve
 * **tout**.
 *
 * ─── Pourquoi l'implémentation de référence redessine la géométrie ──────────
 *
 * Les 27 maisons sont reconstruites ici depuis l'arithmétique, au lieu
 * d'importer `UNITS`. Une table partagée ferait qu'une erreur commune aux deux
 * implémentations resterait invisible — ce qui est exactement le défaut qu'on
 * vient de corriger, transposé au contrôle.
 */

/** Les 27 maisons, redérivées : 9 rangées, 9 colonnes, 9 boîtes. */
const HOUSES: number[][] = [];
for (let row = 0; row < SIZE; row++) {
  HOUSES.push(Array.from({ length: SIZE }, (_, column) => row * SIZE + column));
}
for (let column = 0; column < SIZE; column++) {
  HOUSES.push(Array.from({ length: SIZE }, (_, row) => row * SIZE + column));
}
for (let box = 0; box < SIZE; box++) {
  const top = Math.floor(box / 3) * 3;
  const left = (box % 3) * 3;
  const cells: number[] = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) cells.push((top + dr) * SIZE + left + dc);
  }
  HOUSES.push(cells);
}

/** Les combinaisons de `size` éléments, écrites sans partager le code du moteur. */
function* choose<T>(items: readonly T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let index = 0; index <= items.length - size; index++) {
    for (const rest of choose(items.slice(index + 1), size - 1)) yield [items[index], ...rest];
  }
}

/** La clef d'un motif : la maison, ses membres triés, les chiffres réservés. */
const motifKey = (house: number, members: readonly number[], union: number): string =>
  `${String(house)}|${[...members].sort((a, b) => a - b).join(',')}|${String(union)}`;

/**
 * Tous les sous-ensembles nus **qui éliminent**, énumérés sans aucune coupe.
 *
 * C'est la définition écrite telle quelle : N cases d'une maison dont la réunion
 * des candidats compte exactement N chiffres, et au moins une autre case vide de
 * la maison qui porte l'un d'eux.
 */
function referenceMotifs(state: LogicState, size: number): Set<string> {
  const found = new Set<string>();
  for (let house = 0; house < HOUSES.length; house++) {
    const cells = HOUSES[house];
    const members = cells.filter((cell) => {
      const count = countDigits(state.candidatesAt(cell));
      return count >= 2 && count <= size;
    });
    for (const combo of choose(members, size)) {
      let union = 0;
      for (const cell of combo) union |= state.candidatesAt(cell);
      if (countDigits(union) !== size) continue;
      const eliminates = cells.some(
        (cell) =>
          !combo.includes(cell) && state.isEmpty(cell) && (state.candidatesAt(cell) & union) !== 0,
      );
      if (eliminates) found.add(motifKey(house, combo, union));
    }
  }
  return found;
}

const VARIANTS = [
  { size: 2, entry: nakedPair },
  { size: 3, entry: nakedTriple },
  { size: 4, entry: nakedQuad },
] as const;

/** Ce que le moteur trouve, ramené à la même clef. */
function engineMotifs(state: LogicState, size: number): Set<string> {
  const variant = VARIANTS.find((candidate) => candidate.size === size);
  if (variant === undefined) throw new Error(`taille inconnue : ${String(size)}`);

  const found = new Set<string>();
  for (const step of variant.entry.findAll(state)) {
    let union = 0;
    for (const highlight of step.highlights) union |= highlight.digits;
    found.add(
      motifKey(
        step.units[0],
        step.highlights.map((highlight) => highlight.cell),
        union,
      ),
    );
  }
  return found;
}

/** Des positions réelles : chaque état traversé en résolvant des grilles vraies. */
function positions(count: number): { state: LogicState; label: string }[] {
  const rng = createRng('sous-ensembles-nus');
  const states: { state: LogicState; label: string }[] = [];
  for (let index = 0; index < count; index++) {
    const { puzzle } = generatePuzzle({ seed: rng.nextUint32(), minClues: 24 });
    const path = solveLogically(puzzle);
    for (const frame of replayPath(puzzle, path.steps)) {
      const state = LogicState.fromSnapshot(frame.values, frame.candidates);
      if (state !== null) states.push({ state, label: `grille ${String(index)}` });
    }
  }
  return states;
}

describe('les sous-ensembles nus', () => {
  const sample = positions(12);

  it('traverse assez de positions pour que le contrôle ait un sens', () => {
    // Le garde-fou du garde-fou : un échantillon vide ferait passer tout le reste.
    expect(sample.length).toBeGreaterThan(300);
  });

  for (const { size } of VARIANTS) {
    it(`en trouve exactement autant qu'une énumération sans coupe, à ${String(size)} cases`, () => {
      let motifs = 0;
      for (const { state, label } of sample) {
        const expected = referenceMotifs(state, size);
        const actual = engineMotifs(state, size);
        motifs += expected.size;
        /*
          L'égalité dans les deux sens, et non une inclusion : manquer un motif
          surnote la grille, en inventer un produirait une élimination fausse.
        */
        expect([...actual].sort(), label).toEqual([...expected].sort());
      }
      expect(motifs, 'aucun motif rencontré : le contrôle ne prouverait rien').toBeGreaterThan(0);
    });
  }

  it('n’écarte jamais un candidat de la solution', () => {
    // La complétude ne suffit pas : trouver plus de motifs ne vaut que si chacun
    // conclut juste. C'est le critère que `checkStepSoundness` applique au chemin
    // entier, restreint ici aux motifs que ce fichier fait apparaître.
    const rng = createRng('sous-ensembles-nus-solidite');
    for (let index = 0; index < 8; index++) {
      const { puzzle } = generatePuzzle({ seed: rng.nextUint32(), minClues: 24 });
      const solution = findSolution(puzzle);
      expect(solution).not.toBeNull();
      if (solution === null) continue;

      const path = solveLogically(puzzle);
      for (const frame of replayPath(puzzle, path.steps)) {
        const state = LogicState.fromSnapshot(frame.values, frame.candidates);
        if (state === null) continue;
        for (const { entry } of VARIANTS) {
          for (const step of entry.findAll(state)) checkStepSoundness(step, solution);
        }
      }
    }
  });

  it('note à 3,0 deux grilles qui exigeaient 3,4 faute de voir la paire', () => {
    /*
      Deux témoins, et non un exemple inventé : ce sont des grilles du corpus de
      calibration, sur lesquelles l'oracle conclut « Naked Pair 3.0 ». Nous
      annoncions 3,4 — une paire cachée — parce que la paire nue de la colonne
      restait invisible. Elles valent donc le nom de la technique autant que le
      nombre : un score juste par un chemin faux serait une coïncidence.
    */
    const witnesses = [
      '......2.94.9.523...3..1456..4.1..9..9.......4..6..9.1..6349..7...472.6.57.5......',
      '.7.......4.158.9..8..2....33....4..1..96.37..6..8....91....2..4..3.496.7.......1.',
    ];
    for (const witness of witnesses) {
      const rating = rate(parseGrid(witness));
      expect(rating.outcome, witness).toBe('solved');
      expect(rating.score, witness).toBe(3.0);
      expect(rating.hardestLabel, witness).toBe('Paire nue');
    }
  });

  it('couvre bien les 81 cases par ses 27 maisons', () => {
    // La géométrie redessinée ici doit être la bonne, sans quoi le contrôle
    // vérifierait consciencieusement autre chose.
    expect(HOUSES).toHaveLength(27);
    const seen = new Map<number, number>();
    for (const house of HOUSES) {
      expect(house).toHaveLength(SIZE);
      for (const cell of house) seen.set(cell, (seen.get(cell) ?? 0) + 1);
    }
    expect(seen.size).toBe(CELL_COUNT);
    for (const [, times] of seen) expect(times).toBe(3);
  });
});
