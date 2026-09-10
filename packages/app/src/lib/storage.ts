import { decodeGrid, encodeGrid } from '@sudoku/engine';
import type { Level, Rating } from '@sudoku/engine';

/**
 * Persistance de la partie en cours.
 *
 * ─── Pourquoi `localStorage` et non IndexedDB ───────────────────────────────
 *
 * Une partie tient dans quelques kilo-octets : deux grilles encodées, 81 masques
 * de notes, un historique d'annulation. `localStorage` en accepte cinq à dix
 * méga-octets et il est **synchrone**, ce qui compte plus qu'il n'y paraît :
 * l'état est disponible avant le premier rendu, sans course ni scintillement.
 * IndexedDB imposerait un schéma, des migrations et de l'asynchrone pour un
 * besoin qui tient en une ligne.
 *
 * Il se justifiera le jour où l'on stockera une bibliothèque de grilles ou des
 * statistiques. Pas avant.
 *
 * ─── Deux règles tenues partout dans ce module ──────────────────────────────
 *
 * 1. **Tout accès est protégé.** En navigation privée, ou avec les données de
 *    site bloquées, la simple lecture de `localStorage` lève. Une préférence
 *    d'affichage ne doit jamais empêcher l'application de démarrer.
 * 2. **Le format est versionné.** Une sauvegarde écrite par une version
 *    antérieure est ignorée, jamais devinée. Rien n'est plus déroutant qu'une
 *    partie à demi restaurée.
 */

const KEY = 'sudoku.game';

/**
 * Version du format sauvegardé. Tout changement **incompatible** l'incrémente.
 *
 * Encore faut-il dire lequel l'est, sans quoi on finit par bumper au moindre
 * ajout — et un bump efface la partie en cours de chaque joueur à la mise à
 * jour. La règle tenue ici :
 *
 *   - **ajouter un champ optionnel, lu avec un défaut, n'est pas incompatible.**
 *     Une sauvegarde antérieure reste parfaitement exploitable, il lui manque
 *     seulement une information qu'on sait remplacer ;
 *   - changer le sens, le type ou l'encodage d'un champ existant l'est, et
 *     impose le bump.
 *
 * ─── La règle a tenu une fois de plus, sous pression ────────────────────────
 *
 * L'incrément 9 a fait porter à un coup annulable **toutes** les cases qu'un
 * geste touche — jusqu'à vingt et une — là où il n'en portait qu'une. Le README
 * annonçait que ce changement « imposerait vraiment une montée de version ».
 * C'était faux, et la raison mérite d'être écrite parce que c'est elle qu'on
 * relira la prochaine fois : la case sur laquelle le joueur a agi **reste la
 * tête du coup**, avec exactement le sens qu'elle avait, et les autres arrivent
 * dans un champ ajouté. On ajoute, on ne réinterprète pas.
 *
 * Si la forme était devenue `{ cells: [...] }`, l'ancien validateur aurait
 * rejeté chaque entrée et vidé l'historique en silence. Garder la tête intacte
 * est donc la décision porteuse, pas un détail de style.
 */
export const SAVE_VERSION = 1;

/**
 * Au-delà, les gestes les plus anciens sont oubliés.
 *
 * L'historique n'avait aucune borne et il est sérialisé à chaque sauvegarde :
 * une partie longue faisait grossir l'écriture indéfiniment. Deux cents gestes
 * représentent une quarantaine de kilo-octets — largement au-delà de ce qu'un
 * joueur remonte, et borné.
 */
export const MAX_HISTORY = 200;

/** L'état d'une case avant le geste : valeur, notes, marques. */
export interface SavedCellState {
  readonly cell: number;
  readonly previousValue: number;
  readonly previousNotes: number;
  /**
   * Marques des candidats avant le coup. Optionnel à la relecture : un coup
   * enregistré avant l'incrément 8 n'en a pas, et le refuser jetterait tout
   * l'historique d'annulation d'une partie parfaitement valide.
   */
  readonly previousNoteColors?: number;
}

/**
 * Un **geste** du joueur : la case sur laquelle il a agi, en tête, et les autres.
 *
 * Poser un chiffre efface des notes chez jusqu'à vingt voisines. Les vingt et
 * une cases voyagent donc ensemble : sinon l'annulation rend la valeur et laisse
 * le raisonnement détruit — ce qu'elle faisait jusqu'à l'incrément 9.
 *
 * `others` est absent quand le geste n'a touché qu'une case, ce qui est le cas
 * courant pour un joueur qui n'écrit pas de notes.
 */
export interface SavedMove extends SavedCellState {
  readonly others?: readonly SavedCellState[];
}

export interface GameSnapshot {
  /** Grille de départ, encodée. */
  readonly puzzle: string;
  readonly solution: string;
  /** Valeurs saisies, encodées comme une grille. */
  readonly values: string;
  readonly notes: readonly number[];
  readonly history: readonly SavedMove[];
  readonly selected: number;
  readonly level: Level | null;
  readonly score: number;
  readonly hardestLabel: string | null;
  readonly seed: string | number;
  readonly clues: number;
  /*
    Champs ajoutés à l'incrément 7. Tous optionnels : une sauvegarde écrite
    avant eux se relit sans perte, avec les défauts ci-dessous.
  */
  /** Temps de jeu accumulé. Jamais un instant de départ — voir `stopwatch`. */
  readonly elapsedMs?: number;
  /** Jour civil local où la partie a commencé. */
  readonly startedOn?: string;
  /** Date du défi quotidien joué, ou `null` pour une partie libre. */
  readonly daily?: string | null;
  readonly hintsShown?: number;
  readonly hintsApplied?: number;
  readonly mistakes?: number;
  /** Le mode notes fait partie de la position du joueur, pas de son réglage. */
  readonly noteMode?: boolean;
  /*
    Champ ajouté à l'incrément 8, sous la même règle : optionnel, avec un défaut
    explicite. Deux bits par chiffre, une entrée par case — voir `marks.ts`.
    `SAVE_VERSION` ne bouge donc pas, et personne ne perd sa partie en cours à la
    mise à jour.
  */
  readonly noteColors?: readonly number[];
}

interface StoredGame extends GameSnapshot {
  readonly version: number;
  readonly savedAt: string;
}

/** Ce que `Game` tient en mémoire : un geste est une liste d'états de cases. */
export interface MoveLike {
  readonly cells: readonly SavedCellState[];
}

/**
 * Sépare la tête du reste.
 *
 * `exactOptionalPropertyTypes` interdit d'écrire `others: undefined` : il faut
 * construire les deux formes séparément, et c'est tant mieux — une sauvegarde
 * de joueur sans notes ne porte alors aucun champ superflu.
 */
const toSavedMove = (move: MoveLike): SavedMove => {
  const [head, ...others] = move.cells;
  return others.length === 0 ? { ...head } : { ...head, others };
};

/** Construit un instantané sérialisable à partir des tableaux de la partie. */
export function toSnapshot(input: {
  puzzle: readonly number[];
  solution: readonly number[];
  values: readonly number[];
  notes: readonly number[];
  history: readonly MoveLike[];
  selected: number;
  rating: Rating | null;
  seed: string | number;
  clues: number;
  elapsedMs: number;
  startedOn: string;
  daily: string | null;
  hintsShown: number;
  hintsApplied: number;
  mistakes: number;
  noteMode: boolean;
  noteColors: readonly number[];
}): GameSnapshot {
  return {
    puzzle: encodeGrid(Uint8Array.from(input.puzzle)),
    solution: encodeGrid(Uint8Array.from(input.solution)),
    values: encodeGrid(Uint8Array.from(input.values)),
    notes: [...input.notes],
    history: input.history.map(toSavedMove),
    selected: input.selected,
    level: input.rating?.level ?? null,
    score: input.rating?.score ?? 0,
    hardestLabel: input.rating?.hardestLabel ?? null,
    seed: input.seed,
    clues: input.clues,
    elapsedMs: input.elapsedMs,
    startedOn: input.startedOn,
    daily: input.daily,
    hintsShown: input.hintsShown,
    hintsApplied: input.hintsApplied,
    mistakes: input.mistakes,
    noteMode: input.noteMode,
    noteColors: [...input.noteColors],
  };
}

export interface RestoredGame {
  readonly puzzle: Uint8Array;
  readonly solution: Uint8Array;
  readonly values: Uint8Array;
  readonly notes: number[];
  readonly noteColors: number[];
  readonly history: SavedMove[];
  readonly selected: number;
  readonly level: Level | null;
  readonly seed: string | number;
  readonly clues: number;
  readonly elapsedMs: number;
  readonly startedOn: string | null;
  readonly daily: string | null;
  readonly hintsShown: number;
  readonly hintsApplied: number;
  readonly mistakes: number;
  readonly noteMode: boolean;
}

const isCellState = (value: unknown): value is SavedCellState => {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state['cell'] === 'number' &&
    typeof state['previousValue'] === 'number' &&
    typeof state['previousNotes'] === 'number' &&
    // Volontairement absent des conditions : voir `SavedCellState.previousNoteColors`.
    (state['previousNoteColors'] === undefined || typeof state['previousNoteColors'] === 'number')
  );
};

const isMove = (value: unknown): value is SavedMove => {
  if (!isCellState(value)) return false;
  const others = (value as unknown as Record<string, unknown>)['others'];
  // Absent d'une sauvegarde d'avant l'incrément 9 : un geste à une seule case.
  return others === undefined || (Array.isArray(others) && others.every(isCellState));
};

/**
 * Relit la partie sauvegardée.
 *
 * Renvoie `null` à la moindre anomalie — absente, illisible, écrite par une
 * autre version, tronquée, ou dont les grilles ne se décodent plus. Une partie
 * neuve vaut mieux qu'une partie incohérente : c'est exactement le cas qui casse
 * une application entre les mains de quelqu'un.
 */
export function loadGame(): RestoredGame | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredGame>;
    if (parsed.version !== SAVE_VERSION) return null;
    if (
      typeof parsed.puzzle !== 'string' ||
      typeof parsed.solution !== 'string' ||
      typeof parsed.values !== 'string' ||
      !Array.isArray(parsed.notes) ||
      !Array.isArray(parsed.history)
    ) {
      return null;
    }

    const notes = parsed.notes.filter((n): n is number => typeof n === 'number');
    if (notes.length !== 81) return null;

    /*
      Les marques dégradent, elles ne bloquent pas : une sauvegarde d'avant
      l'incrément 8 n'en a pas, et un tableau de mauvaise longueur vaut mieux
      perdu que de faire échouer la reprise d'une partie par ailleurs saine.
    */
    const storedColors = Array.isArray(parsed.noteColors)
      ? parsed.noteColors.filter((n): n is number => typeof n === 'number')
      : [];
    const noteColors = storedColors.length === 81 ? storedColors : new Array<number>(81).fill(0);

    return {
      puzzle: decodeGrid(parsed.puzzle),
      solution: decodeGrid(parsed.solution),
      values: decodeGrid(parsed.values),
      notes,
      noteColors,
      /*
        Bornée aussi à la relecture : la borne est appliquée à l'écriture, mais
        un fichier bricolé à la main n'a pas à pouvoir la contourner.
      */
      history: parsed.history.filter(isMove).slice(-MAX_HISTORY),
      selected: typeof parsed.selected === 'number' ? parsed.selected : 0,
      level: parsed.level ?? null,
      seed: parsed.seed ?? 0,
      clues: typeof parsed.clues === 'number' ? parsed.clues : 0,
      elapsedMs: typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0,
      startedOn: typeof parsed.startedOn === 'string' ? parsed.startedOn : null,
      daily: typeof parsed.daily === 'string' ? parsed.daily : null,
      hintsShown: typeof parsed.hintsShown === 'number' ? parsed.hintsShown : 0,
      hintsApplied: typeof parsed.hintsApplied === 'number' ? parsed.hintsApplied : 0,
      mistakes: typeof parsed.mistakes === 'number' ? parsed.mistakes : 0,
      noteMode: parsed.noteMode === true,
    };
  } catch {
    // JSON invalide, code de grille corrompu : on repart proprement.
    return null;
  }
}

/** Écrit la partie. Silencieux en cas d'échec — le jeu continue sans filet. */
export function saveGame(snapshot: GameSnapshot): void {
  const stored: StoredGame = {
    ...snapshot,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Quota dépassé ou stockage refusé : rien à faire de plus ici.
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sans conséquence.
  }
}

/**
 * Demande au navigateur de ne pas évincer nos données.
 *
 * Safari efface le stockage après **sept jours sans visite**. Une application de
 * sudoku n'est pas ouverte tous les jours : sans cette demande, une partie mise
 * de côté une semaine disparaîtrait sans que personne comprenne pourquoi.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') {
      return false;
    }
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
