import { createRng, type Rng } from '../../rng/index.js';
import { castOf, type Suspect } from '../cast.js';
import { occupantsOf } from '../clues/semantics.js';
import type { Clue } from '../clues/types.js';
import { deduce } from '../deduce/deduce.js';
import { REGISTRY_VERSION } from '../deduce/types.js';
import { solveExact } from '../exact/solver.js';
import { buildScene } from '../scene/scene.js';
import { loadDecor } from '../scene/decors.js';
import type { Scene } from '../scene/types.js';
import type { CaseFile, Puzzle } from '../types.js';
import { candidatesFor, crimeScenes, familyOf, FAMILY_WEIGHT } from './candidates.js';

/**
 * La fabrique d'affaires.
 *
 * ─── Pourquoi une recherche, et pas une construction ────────────────────────
 *
 * On ne sait pas écrire directement un jeu d'indices qui détermine une
 * disposition et une seule. Ce qu'on sait faire, et qui est l'état de l'art
 * pour ce type de puzzle : partir de la solution, **énumérer les indices qui y
 * sont vrais**, puis chercher dans cette réserve un jeu qui ne laisse qu'elle.
 *
 * Deux conséquences qui tiennent tout le mode :
 *
 *   - **aucun indice ne peut être faux.** Il vient d'une réserve construite en
 *     vérifiant chaque énoncé sur la solution. L'énoncé ne peut pas contredire
 *     le corrigé, et ce n'est pas une relecture qui le garantit ;
 *   - **aucune affaire ne sort si le registre ne sait pas la résoudre.** Le
 *     dernier filtre n'est pas l'unicité mais `deduce()` : une affaire qui
 *     demanderait d'essayer une case pour voir est jetée, pas étiquetée
 *     « expert ».
 *
 * La recherche est une montée de colline plutôt qu'un tirage : une carte
 * remplacée au hasard est conservée si elle ne dégrade pas le compte des
 * solutions. Les paliers se franchissent par les mouvements latéraux, d'où
 * l'acceptation des scores égaux.
 */

/** Au-delà, compter les solutions ne renseigne plus : on sait déjà que c'est trop. */
const SOLUTION_CAP = 12;

export interface ComposeOptions {
  readonly decorId?: string;
  /** Nombre de dispositions différentes essayées avant d'abandonner. */
  readonly attempts?: number;
  /**
   * Nombre maximal de répliques par suspect.
   *
   * Trois lignes sous un portrait se lisent mal, et le genre n'en donne jamais
   * plus de deux. Une affaire dont un suspect en exige davantage est écartée au
   * profit d'une autre disposition — ce qui est gratuit, puisque la disposition
   * suivante coûte une dizaine de millisecondes.
   */
  readonly maxCards?: number;
}

/**
 * Une affaire, ou `null` si la graine n'en a pas donné.
 *
 * Renvoyer `null` plutôt que de boucler est délibéré : l'appelant décide quoi
 * faire d'un échec — réessayer avec une autre graine, ou le dire. Une fabrique
 * qui ne rend jamais la main est une fabrique qui fige un onglet.
 */
export function composeCase(seed: string, options: ComposeOptions = {}): CaseFile | null {
  const decorId = options.decorId ?? 'manor';
  const attempts = options.attempts ?? 40;
  const maxCards = options.maxCards ?? 2;

  const rng = createRng(seed);
  const scene = buildScene(loadDecor(decorId));
  const suspects = castOf(scene.size);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const at = randomPlacement(scene, suspects.length, rng);

    // Une affaire exige une pièce à deux personnes : sans elle, « seule avec le
    // meurtrier » n'a personne à désigner. Une disposition qui n'en offre pas
    // est écartée — c'est le cas le plus fréquent d'échec, et le moins cher.
    const rooms = crimeScenes(scene, at);
    if (rooms.length === 0) continue;

    const pair = occupantsOf(scene, at, rooms[rng.nextInt(rooms.length)]);
    const victim = pair[rng.nextInt(2)];
    const murderer = pair[0] === victim ? pair[1] : pair[0];

    const pool = suspects.map((suspect) => candidatesFor(scene, at, suspect.index, victim));
    if (pool.some((cards) => cards.length === 0)) continue;

    const cards = carve(scene, suspects, victim, pool, rng);
    if (cards === null) continue;
    if (cards.some((card) => card.length > maxCards)) continue;

    const clues = flatten(cards);
    const path = deduce({ scene, suspects, victim, clues });
    if (!path.solved || path.hardest === null) continue;

    return {
      decorId,
      seed,
      clues,
      victim,
      solution: at,
      murderer,
      registryVersion: REGISTRY_VERSION,
      hardest: path.hardest,
      stepCount: path.steps.length,
    };
  }

  return null;
}

/**
 * Une disposition au hasard : une permutation des rangées, une des colonnes.
 *
 * C'est toute la règle du plateau. Deux permutations indépendantes donnent
 * exactement les dispositions valides, sans rejet — il n'y a donc rien à
 * vérifier ensuite.
 */
function randomPlacement(scene: Scene, count: number, rng: Rng): number[] {
  const rows = rng.shuffle([...Array(count).keys()]);
  const columns = rng.shuffle([...Array(count).keys()]);
  return rows.map((row, suspect) => row * scene.size + columns[suspect]);
}

/**
 * Taille le jeu de cartes : partir de **tout** ce qui est vrai, puis retirer.
 *
 * ─── Deux algorithmes essayés, et pourquoi celui-ci ─────────────────────────
 *
 * Les deux premières versions cherchaient un jeu de cartes en **ajoutant** : une
 * carte au hasard par personne, puis des remplacements — d'abord au hasard
 * (760 ms par affaire), puis dirigés en gardant le meilleur de quelques tirages
 * (1 800 ms, et une affaire sur vingt perdue). La version dirigée était la plus
 * lente des deux, ce qui est contre-intuitif et instructif : le compte de
 * solutions **plafonné** est un mauvais guide, parce que presque tout jeu de
 * cartes passe déjà sous le plafond. Le gradient était plat ; c'étaient les
 * mouvements latéraux de la marche au hasard qui faisaient le travail.
 *
 * Celui-ci fait l'inverse, et c'est la méthode que la littérature retient pour
 * ce type de puzzle : on part de **tous** les indices vrais — jeu dont l'unicité
 * est acquise, puisqu'il contient la rangée et la colonne de chacun — et on
 * retire tant que l'unicité tient. Un seul parcours, une vérification par
 * carte, aucun retour en arrière.
 *
 * L'ordre de retrait est le seul hasard, et il porte le goût de l'affaire : les
 * familles de faible poids sont examinées en premier, donc retirées en premier,
 * donc c'est le mobilier qui survit. Deux graines donnent deux affaires
 * différentes sur la même disposition.
 */
function carve(
  scene: Scene,
  suspects: readonly Suspect[],
  victim: number,
  pool: readonly (readonly Clue[])[],
  rng: Rng,
): Clue[][] | null {
  const cards: Clue[][] = pool.map((cluesOfSuspect) => [...cluesOfSuspect]);
  // Le jeu complet contient la rangée et la colonne de chacun : il désigne donc
  // exactement une disposition. La vérification reste, parce qu'un filtre
  // d'utilité mal réglé pourrait un jour retirer ces cartes de la réserve.
  if (countSolutions(scene, suspects, victim, flatten(cards)) !== 1) return null;

  for (const { who, card } of removalOrder(cards, victim, rng)) {
    if (cards[who].length <= 1) continue;
    const kept = cards[who];
    const without = kept.filter((held) => held !== card);
    cards[who] = without;
    if (countSolutions(scene, suspects, victim, flatten(cards)) !== 1) cards[who] = kept;
  }

  return cards;
}

/**
 * L'ordre dans lequel on tente les retraits.
 *
 * Une carte examinée tôt est retirée plus souvent — le jeu est encore large,
 * donc son absence se compense. On examine donc en premier ce qu'on veut voir
 * disparaître : les colonnes et rangées nues, puis les relations, et en dernier
 * le mobilier et les pièces, qui sont ce qui fait une scène de crime plutôt
 * qu'un exercice de coordonnées.
 */
function removalOrder(
  cards: readonly (readonly Clue[])[],
  victim: number,
  rng: Rng,
): { who: number; card: Clue }[] {
  const entries: { who: number; card: Clue; key: number }[] = [];
  for (let who = 0; who < cards.length; who++) {
    if (who === victim) continue;
    for (const card of cards[who]) {
      entries.push({ who, card, key: rng.nextFloat() * FAMILY_WEIGHT[familyOf(card)] });
    }
  }
  entries.sort((left, right) => left.key - right.key);
  return entries.map(({ who, card }) => ({ who, card }));
}

/** Les cartes, mises à plat dans l'ordre où le joueur les lit. */
function flatten(cards: readonly (readonly Clue[])[]): Clue[] {
  return cards.flatMap((card) => card);
}

function countSolutions(
  scene: Scene,
  suspects: readonly Suspect[],
  victim: number,
  clues: readonly Clue[],
): number {
  const puzzle: Puzzle = { scene, suspects, victim, clues };
  return solveExact(puzzle, SOLUTION_CAP).length;
}

