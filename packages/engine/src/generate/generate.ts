import { CELL_COUNT, EMPTY, SIZE, cloneGrid, createEmptyGrid, indexOf } from '../grid/index.js';
import type { Grid } from '../grid/index.js';
import { countSolutions, findSolution } from '../solver/index.js';
import { createRng } from '../rng/index.js';
import type { Rng } from '../rng/index.js';

/**
 * Generation de grilles.
 *
 * Deux etapes, dans cet ordre :
 *   1. produire une solution complete valide, tiree au hasard ;
 *   2. y creuser des trous tant que la solution reste unique.
 *
 * Point important, souvent mal compris : la diversite des grilles vient de
 * l'etape 2, pas de l'etape 1. On lit parfois qu'il suffirait de partir d'une
 * seule grille "germe" et de lui appliquer les transformations qui preservent
 * la validite (permuter bandes, piles, chiffres, transposer) pour obtenir des
 * milliers de milliards de grilles. C'est vrai en nombre absolu, mais trompeur :
 * toutes ces grilles sont isomorphes entre elles — une seule classe
 * d'equivalence parmi les 5 472 730 538 existantes (Russell & Jarvis, 2005).
 * On tire donc une solution complete par backtracking randomise a chaque fois ;
 * cela coute quelques millisecondes, ce qui est negligeable devant l'etape 2.
 *
 * A ce stade, la difficulte n'est PAS calibree : `clues` decrit la quantite
 * d'indices, pas l'effort de resolution. Les deux sont tres faiblement lies
 * (correlation ~0,27 avec la difficulte percue). La notation viendra du
 * solveur logique.
 */

/**
 * Disposition des cases vides. Purement esthetique : la symetrie n'a aucun
 * effet sur la difficulte logique. Elle rend seulement les grilles plus
 * agreables a l'oeil, en particulier a l'impression.
 */
export type Symmetry = 'none' | 'rotational180' | 'diagonal';

export interface GenerateOptions {
  /** Rejouer le meme seed redonne exactement la meme grille. */
  readonly seed?: string | number;
  /** Defaut : `rotational180`, la disposition la plus courante en presse. */
  readonly symmetry?: Symmetry;
  /**
   * Plancher d'indices. Le generateur creuse au maximum sans jamais casser
   * l'unicite, mais s'arrete des qu'il atteint ce plancher. Sert a produire
   * des grilles volontairement plus fournies.
   */
  readonly minClues?: number;
}

export interface GeneratedPuzzle {
  readonly puzzle: Grid;
  readonly solution: Grid;
  /** Nombre de cases remplies au depart. N'est PAS une mesure de difficulte. */
  readonly clues: number;
  readonly seed: string | number;
  readonly symmetry: Symmetry;
}

/** Une solution complete valide, tiree uniformement au hasard. */
export function generateSolvedGrid(rng: Rng): Grid {
  const solution = findSolution(createEmptyGrid(), { rng });
  /* c8 ignore next 3 -- une grille vide admet toujours une solution ; garde-fou defensif */
  if (solution === null) {
    throw new Error('Aucune solution pour une grille vide : le solveur est en cause.');
  }
  return solution;
}

/**
 * Cellules a vider ensemble pour respecter la symetrie demandee.
 * Les groupes sont deduplique : sur l'axe de symetrie, une cellule est seule.
 */
export function symmetryGroups(symmetry: Symmetry): number[][] {
  const partnerOf = (cell: number): number => {
    switch (symmetry) {
      case 'none':
        return cell;
      case 'rotational180':
        return CELL_COUNT - 1 - cell;
      case 'diagonal': {
        const row = Math.floor(cell / SIZE);
        const col = cell % SIZE;
        return indexOf(col, row);
      }
    }
  };

  const groups: number[][] = [];
  const claimed = new Uint8Array(CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (claimed[cell] === 1) continue;
    const partner = partnerOf(cell);
    claimed[cell] = 1;
    claimed[partner] = 1;
    groups.push(partner === cell ? [cell] : [cell, partner]);
  }
  return groups;
}

/**
 * Creuse une solution complete en preservant l'unicite.
 *
 * On tente les groupes dans un ordre aleatoire et on remet en place tout
 * retrait qui rendrait la grille ambigue. Le resultat n'est pas minimal au sens
 * strict — le rendre minimal demanderait de reexaminer les groupes rejetes —
 * mais il est garanti unique, ce qui est la seule propriete qui compte ici.
 */
export function digHoles(
  solution: Grid,
  rng: Rng,
  options: { readonly symmetry?: Symmetry; readonly minClues?: number } = {},
): Grid {
  const symmetry = options.symmetry ?? 'rotational180';
  const minClues = options.minClues ?? 17;

  const puzzle = cloneGrid(solution);
  let clues = CELL_COUNT;

  for (const group of rng.shuffle(symmetryGroups(symmetry))) {
    if (clues - group.length < minClues) continue;

    const removed = group.map((cell) => puzzle[cell]);
    for (const cell of group) puzzle[cell] = EMPTY;

    if (countSolutions(puzzle, 2) === 1) {
      clues -= group.length;
    } else {
      group.forEach((cell, i) => {
        puzzle[cell] = removed[i];
      });
    }
  }

  return puzzle;
}

/**
 * Genere une grille jouable a solution unique.
 *
 * Sans `seed`, un seed aleatoire est tire et renvoye dans le resultat : une
 * grille est donc toujours reproductible a posteriori, ce dont dependent le
 * partage par URL courte et le defi quotidien.
 */
export function generatePuzzle(options: GenerateOptions = {}): GeneratedPuzzle {
  const seed = options.seed ?? Math.floor(Math.random() * 0xffff_ffff);
  const symmetry = options.symmetry ?? 'rotational180';
  const rng = createRng(seed);

  const solution = generateSolvedGrid(rng);
  const digOptions =
    options.minClues === undefined ? { symmetry } : { symmetry, minClues: options.minClues };
  const puzzle = digHoles(solution, rng, digOptions);

  let clues = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (puzzle[i] !== EMPTY) clues++;
  }

  return { puzzle, solution, clues, seed, symmetry };
}
