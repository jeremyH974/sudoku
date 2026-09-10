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

/** Version du format sauvegardé. Tout changement incompatible l'incrémente. */
export const SAVE_VERSION = 1;

export interface SavedMove {
  readonly cell: number;
  readonly previousValue: number;
  readonly previousNotes: number;
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
}

interface StoredGame extends GameSnapshot {
  readonly version: number;
  readonly savedAt: string;
}

/** Construit un instantané sérialisable à partir des tableaux de la partie. */
export function toSnapshot(input: {
  puzzle: readonly number[];
  solution: readonly number[];
  values: readonly number[];
  notes: readonly number[];
  history: readonly SavedMove[];
  selected: number;
  rating: Rating | null;
  seed: string | number;
  clues: number;
}): GameSnapshot {
  return {
    puzzle: encodeGrid(Uint8Array.from(input.puzzle)),
    solution: encodeGrid(Uint8Array.from(input.solution)),
    values: encodeGrid(Uint8Array.from(input.values)),
    notes: [...input.notes],
    history: input.history.map((move) => ({ ...move })),
    selected: input.selected,
    level: input.rating?.level ?? null,
    score: input.rating?.score ?? 0,
    hardestLabel: input.rating?.hardestLabel ?? null,
    seed: input.seed,
    clues: input.clues,
  };
}

export interface RestoredGame {
  readonly puzzle: Uint8Array;
  readonly solution: Uint8Array;
  readonly values: Uint8Array;
  readonly notes: number[];
  readonly history: SavedMove[];
  readonly selected: number;
  readonly level: Level | null;
  readonly seed: string | number;
  readonly clues: number;
}

const isMove = (value: unknown): value is SavedMove => {
  if (typeof value !== 'object' || value === null) return false;
  const move = value as Record<string, unknown>;
  return (
    typeof move['cell'] === 'number' &&
    typeof move['previousValue'] === 'number' &&
    typeof move['previousNotes'] === 'number'
  );
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

    return {
      puzzle: decodeGrid(parsed.puzzle),
      solution: decodeGrid(parsed.solution),
      values: decodeGrid(parsed.values),
      notes,
      history: parsed.history.filter(isMove),
      selected: typeof parsed.selected === 'number' ? parsed.selected : 0,
      level: parsed.level ?? null,
      seed: parsed.seed ?? 0,
      clues: typeof parsed.clues === 'number' ? parsed.clues : 0,
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
