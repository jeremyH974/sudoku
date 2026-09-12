import {
  findSubsets,
  initialDomains,
  isComplete,
  placedExclusion,
  singleton,
  type Subset,
} from '../board.js';
import { pruneClue, type Pruning } from '../clues/propagate.js';
import { labelOf, of_, renderClue } from '../clues/render.js';
import type { Clue } from '../clues/types.js';
import {
  cloneSet,
  count,
  difference,
  emptySet,
  first,
  intersection,
  isEmpty,
  subtract,
  union,
  type CellSet,
} from '../scene/cellset.js';
import { cellLabel } from '../scene/scene.js';
import type { Puzzle } from '../types.js';
import type { Deduction, Step, SuspectCells, TechniqueId } from './types.js';

/**
 * Le solveur **humain** : celui qui explique.
 *
 * Il n'essaie jamais une case pour voir. À chaque tour il applique la technique
 * la plus simple qui s'applique, et note ce qu'elle a conclu. Une affaire qu'il
 * ne sait pas terminer n'est pas distribuée — c'est la règle du projet, qui
 * refuse les grilles où il faut deviner, appliquée ici telle quelle.
 *
 * Le chemin qu'il produit sert trois choses à la fois, et c'est délibéré : la
 * mesure de l'affaire, l'indice proposé au joueur, et le banc d'analyse. Ils ne
 * peuvent pas diverger, puisqu'ils ne sont qu'une seule liste d'étapes.
 */

interface Technique {
  readonly id: TechniqueId;
  readonly label: string;
  readonly rank: number;
  readonly find: (puzzle: Puzzle, domains: readonly CellSet[]) => Step | null;
}

/** Les indices qui se lisent seuls, sans rien recouper. */
const isUnary = (clue: Clue): boolean =>
  clue.kind === 'on-prop' ||
  clue.kind === 'next-to-prop' ||
  clue.kind === 'in-zone' ||
  clue.kind === 'in-band';

/** Les indices qui relient deux personnes. */
const isCrossing = (clue: Clue): boolean =>
  clue.kind === 'direction' || clue.kind === 'offset' || clue.kind === 'same-zone';

/** Les indices qui parlent de l'occupation d'une pièce. */
const isCompany = (clue: Clue): boolean =>
  clue.kind === 'alone' || clue.kind === 'alone-with' || clue.kind === 'victim';

/**
 * Le registre, **trié par difficulté croissante**.
 *
 * L'ordre compte : il décide de ce que le chemin traverse, donc de la technique
 * la plus difficile qu'on lui attribue. Le changer change la mesure de toutes
 * les affaires déjà produites, d'où `REGISTRY_VERSION`.
 *
 * Les rangs ne sont **pas** des notes, et ne s'affichent pas : voir `Step.rank`.
 */
const REGISTRY: readonly Technique[] = [
  {
    id: 'clue',
    label: 'Lecture d’indice',
    rank: 1.1,
    find: (puzzle, domains) => fromClues(puzzle, domains, isUnary, 'clue', 'Lecture d’indice', 1.1),
  },
  {
    id: 'exclusion',
    label: 'Place réservée',
    rank: 1.3,
    find: (puzzle, domains) => fromSubsets(puzzle, domains, 1, false),
  },
  {
    id: 'only-taker',
    label: 'Seule personne possible',
    rank: 1.7,
    find: (puzzle, domains) => fromSubsets(puzzle, domains, 1, true),
  },
  {
    id: 'crossing',
    label: 'Recoupement',
    rank: 2.2,
    find: (puzzle, domains) =>
      fromClues(puzzle, domains, isCrossing, 'crossing', 'Recoupement', 2.2),
  },
  {
    id: 'company',
    label: 'Qui était dans la pièce',
    rank: 2.8,
    find: (puzzle, domains) =>
      fromClues(puzzle, domains, isCompany, 'company', 'Qui était dans la pièce', 2.8),
  },
  {
    id: 'subset',
    label: 'Groupe fermé',
    rank: 3.2,
    find: (puzzle, domains) =>
      fromSubsets(puzzle, domains, 2, false) ??
      fromSubsets(puzzle, domains, 2, true) ??
      fromSubsets(puzzle, domains, 3, false) ??
      fromSubsets(puzzle, domains, 3, true),
  },
];

/** Le rang du placement — le geste le plus simple du jeu. */
const PLACEMENT_RANK = 1;

/**
 * Déroule l'affaire jusqu'à la solution, ou jusqu'à la panne.
 *
 * Poser quelqu'un passe avant tout le reste : c'est le geste que le joueur fait
 * dès qu'il le peut, et le chemin doit lui ressembler.
 *
 * ─── `placed`, et pourquoi l'aide en dépend ─────────────────────────────────
 *
 * Sans point de départ, le chemin part du plateau vide : c'est ce qu'il faut
 * pour **mesurer** une affaire. Mais c'est inutilisable comme aide — un joueur
 * qui a déjà posé trois personnes ne veut pas qu'on lui rejoue le début.
 *
 * En partant de ses placements, la première étape du chemin **est** la
 * prochaine déduction qu'il peut faire. La première rédaction de l'aide
 * cherchait à la place la première étape « qui pose quelqu'un de non encore
 * posé » : elle sautait donc tout le raisonnement pour ne montrer que des
 * conclusions, ce qui est exactement le défaut reproché aux aides du marché.
 */
export function deduce(puzzle: Puzzle, placed?: readonly number[]): Deduction {
  const domains = initialDomains(puzzle.scene, puzzle.suspects.length);
  const steps: Step[] = [];
  const announced = new Set<number>();

  if (placed !== undefined) {
    for (let suspect = 0; suspect < placed.length; suspect++) {
      if (placed[suspect] < 0) continue;
      domains[suspect] = singleton(puzzle.scene, placed[suspect]);
      // Déjà posé par le joueur : le lui annoncer serait lui apprendre ce
      // qu'il vient de faire.
      announced.add(suspect);
    }
    applyAll(placedExclusion(puzzle.scene, domains), domains);
  }
  // Chaque étape retire au moins une case à quelqu'un, ou pose quelqu'un : la
  // borne est donc atteignable seulement si un propagateur devient idempotent à
  // tort. Elle est là pour que ce défaut se voie au lieu de figer un onglet.
  const ceiling = puzzle.suspects.length * (puzzle.scene.cellCount + 1);

  while (steps.length < ceiling && !exhausted(domains)) {
    const placement = placeable(puzzle, domains, announced);
    if (placement !== null) {
      steps.push(placement);
      announced.add(placement.placements[0].suspect);
      applyAll(placedExclusion(puzzle.scene, domains), domains);
      continue;
    }

    if (isComplete(domains)) break;

    const step = REGISTRY.reduce<Step | null>(
      (found, technique) => found ?? technique.find(puzzle, domains),
      null,
    );
    if (step === null) break;

    applyAll(step.eliminations.map(asPruning), domains);
    steps.push(step);
    if (exhausted(domains)) break;
  }

  const contradicted = exhausted(domains);
  const solved = !contradicted && isComplete(domains) && announced.size === puzzle.suspects.length;
  return { solved, contradicted, steps, hardest: hardestOf(steps), domains };
}

/** Quelqu'un n'a plus aucune place : l'état de départ ne tient pas. */
const exhausted = (domains: readonly CellSet[]): boolean => domains.some(isEmpty);

/** La technique la plus difficile du chemin. */
function hardestOf(steps: readonly Step[]): TechniqueId | null {
  let best: Step | null = null;
  for (const step of steps) if (best === null || step.rank > best.rank) best = step;
  return best === null ? null : best.technique;
}

/** Un suspect réduit à une seule case, et qu'on n'a pas encore annoncé. */
function placeable(
  puzzle: Puzzle,
  domains: readonly CellSet[],
  announced: ReadonlySet<number>,
): Step | null {
  for (let suspect = 0; suspect < domains.length; suspect++) {
    if (announced.has(suspect) || count(domains[suspect]) !== 1) continue;
    const cell = first(domains[suspect]);
    const who = puzzle.suspects[suspect];
    return {
      technique: 'placement',
      label: 'Dernière case',
      rank: PLACEMENT_RANK,
      clues: [],
      suspects: [suspect],
      highlights: [{ suspect, cells: cloneSet(domains[suspect]) }],
      placements: [{ suspect, cell }],
      eliminations: [],
      explanation:
        `${labelOf(who)} n'a plus qu'une place possible : ${cellLabel(puzzle.scene.size, cell)}, ` +
        `${inRoom(puzzle, cell)}.`,
    };
  }
  return null;
}

/** La première élimination qu'un indice de la famille donnée permet. */
function fromClues(
  puzzle: Puzzle,
  domains: readonly CellSet[],
  family: (clue: Clue) => boolean,
  technique: TechniqueId,
  label: string,
  rank: number,
): Step | null {
  for (let index = 0; index < puzzle.clues.length; index++) {
    const clue = puzzle.clues[index];
    if (!family(clue)) continue;
    const prunings = pruneClue(clue, puzzle.scene, domains).filter(
      (pruning) => !isEmpty(pruning.remove),
    );
    if (prunings.length === 0) continue;

    const touched = [...new Set(prunings.map((pruning) => pruning.suspect))];
    return {
      technique,
      label,
      rank,
      clues: [index],
      suspects: [...new Set([clue.who, ...touched])],
      /*
        Ce qui **reste** possible, et non ce qui l'était avant.

        La première rédaction montrait le domaine d'avant l'élimination : au
        premier indice d'une affaire, c'était le plateau entier. « Regardez par
        ici » désignait alors les trente-six cases, ce qui ne désigne rien.
      */
      highlights: touched.map((suspect) => ({
        suspect,
        cells: difference(domains[suspect], removedFrom(prunings, suspect, domains)),
      })),
      placements: [],
      eliminations: prunings.map((pruning) => ({ suspect: pruning.suspect, cells: pruning.remove })),
      explanation: explainClue(puzzle, domains, clue, prunings, technique),
    };
  }
  return null;
}

function explainClue(
  puzzle: Puzzle,
  domains: readonly CellSet[],
  clue: Clue,
  prunings: readonly Pruning[],
  technique: TechniqueId,
): string {
  const quoted = `« ${renderClue(clue, puzzle.scene, puzzle.suspects)} »`;
  const speaker = of_(labelOf(puzzle.suspects[clue.who]));
  const dropped = prunings.reduce((total, pruning) => total + count(pruning.remove), 0);
  const places = `${String(dropped)} place${dropped > 1 ? 's' : ''}`;
  const fall = dropped > 1 ? 'tombent' : 'tombe';

  if (technique === 'clue') {
    const left = count(domains[prunings[0].suspect]) - count(prunings[0].remove);
    return (
      `L'indice ${speaker} se lit seul : ${quoted} Il écarte ${places}, ` +
      `il en reste ${String(left)}.`
    );
  }

  if (technique === 'crossing') {
    const target = labelOf(puzzle.suspects[prunings[0].suspect]);
    const partner = labelOf(
      puzzle.suspects[prunings[0].suspect === clue.who ? otherOf(clue) : clue.who],
    );
    return (
      `L'indice ${speaker} — ${quoted} — recoupé avec ce qui reste possible pour ` +
      `${partner} : ${places} ${fall} pour ${target}.`
    );
  }

  return (
    `L'indice ${speaker} — ${quoted} — porte sur qui d'autre est dans sa pièce, ` +
    `et cela écarte ${places}.`
  );
}

/** Tout ce que les éliminations retirent à un suspect donné. */
function removedFrom(
  prunings: readonly Pruning[],
  suspect: number,
  domains: readonly CellSet[],
): CellSet {
  let removed = emptySet(domains[suspect].length * 32);
  for (const pruning of prunings) {
    if (pruning.suspect === suspect) removed = union(removed, pruning.remove);
  }
  return removed;
}

/** L'autre personne citée par un indice qui en cite une. */
function otherOf(clue: Clue): number {
  switch (clue.kind) {
    case 'direction':
    case 'offset':
    case 'same-zone':
    case 'alone-with':
      return clue.other;
    default:
      return clue.who;
  }
}

/** Le premier sous-ensemble du degré et de la forme demandés. */
function fromSubsets(
  puzzle: Puzzle,
  domains: readonly CellSet[],
  degree: number,
  hidden: boolean,
): Step | null {
  for (const subset of findSubsets(puzzle.scene, domains, degree, hidden)) {
    return asStep(puzzle, domains, subset);
  }
  return null;
}

function asStep(puzzle: Puzzle, domains: readonly CellSet[], subset: Subset): Step {
  const technique: TechniqueId =
    subset.degree > 1 ? 'subset' : subset.hidden ? 'only-taker' : 'exclusion';
  const label =
    technique === 'subset'
      ? 'Groupe fermé'
      : technique === 'only-taker'
        ? 'Seule personne possible'
        : 'Place réservée';
  const rank = technique === 'subset' ? 3.2 + 0.3 * (subset.degree - 2) : subset.hidden ? 1.7 : 1.3;

  return {
    technique,
    label,
    rank,
    clues: [],
    suspects: [...subset.suspects],
    // Les places du groupe **dans les tranches qu'il se partage** : c'est là
    // que le raisonnement se voit, pas dans le reste de leurs domaines.
    highlights: subset.suspects.map((suspect) => ({
      suspect,
      cells: intersection(domains[suspect], bandCells(puzzle, subset)),
    })),
    placements: [],
    eliminations: subset.prunings.map((pruning) => ({
      suspect: pruning.suspect,
      cells: pruning.remove,
    })),
    explanation: explainSubset(puzzle, subset),
  };
}

/** Les cases des tranches en jeu dans un sous-ensemble. */
function bandCells(puzzle: Puzzle, subset: Subset): CellSet {
  const bands = subset.axis === 'row' ? puzzle.scene.rows : puzzle.scene.columns;
  let cells = emptySet(puzzle.scene.cellCount);
  for (const band of subset.bands) cells = union(cells, bands[band]);
  return cells;
}

function explainSubset(puzzle: Puzzle, subset: Subset): string {
  const people = listOf(subset.suspects.map((suspect) => labelOf(puzzle.suspects[suspect])));
  const bands = bandList(subset.axis, subset.bands);
  const they = pronoun(puzzle, subset.suspects);

  if (subset.hidden) {
    return subset.degree === 1
      ? `Dans ${bands}, ${people} est la seule personne qui puisse encore se trouver : ` +
          `${they} y est, et nulle part ailleurs.`
      : `${bands} ne peuvent être occupées que par ${people} : ${they} y sont, ` +
          `et nulle part ailleurs.`;
  }
  return subset.degree === 1
    ? `${people} ne peut être que dans ${bands}. Personne d'autre ne peut donc s'y trouver.`
    : `${people} se partagent ${bands}. Personne d'autre ne peut donc s'y trouver.`;
}

/**
 * Le pronom d'un groupe.
 *
 * La règle française du masculin qui l'emporte au pluriel : un seul homme dans
 * le groupe et c'est « ils ». Écrire « elles » pour un groupe qui contient
 * Damien ferait douter le joueur de sa lecture du plateau, pas de la phrase.
 */
function pronoun(puzzle: Puzzle, suspects: readonly number[]): string {
  const feminine = suspects.every((suspect) => puzzle.suspects[suspect].gender === 'f');
  if (suspects.length === 1) return feminine ? 'elle' : 'il';
  return feminine ? 'elles' : 'ils';
}

/** « la rangée 4 », « les colonnes 1 et 5 ». */
function bandList(axis: 'row' | 'column', indices: readonly number[]): string {
  const many = indices.length > 1;
  const noun =
    axis === 'row' ? (many ? 'les rangées' : 'la rangée') : many ? 'les colonnes' : 'la colonne';
  return `${noun} ${listOf(indices.map((index) => String(index + 1)))}`;
}

/** « A », « A et B », « A, B et C ». */
function listOf(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/** « dans le Salon » — le complément de lieu d'une case. */
function inRoom(puzzle: Puzzle, cell: number): string {
  const zone = puzzle.scene.zones[puzzle.scene.zoneOf[cell]];
  return zone.article === "l'" ? `dans l'${zone.name}` : `dans ${zone.article} ${zone.name}`;
}

const asPruning = (elimination: SuspectCells): Pruning => ({
  suspect: elimination.suspect,
  remove: elimination.cells,
});

function applyAll(prunings: readonly Pruning[], domains: CellSet[]): void {
  for (const { suspect, remove } of prunings) subtract(domains[suspect], remove);
}
