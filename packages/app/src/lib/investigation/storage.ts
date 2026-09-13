import { tryDecodeCase } from '@sudoku/engine/investigation';
import type { CaseFile } from '@sudoku/engine/investigation';
import type { HintTier, Tool } from './caseGame.svelte.js';

/**
 * La partie d'enquête en cours, gardée d'une visite à l'autre.
 *
 * ─── Pourquoi un module à part, et non une branche de `storage.ts` ──────────
 *
 * Parce que rien n'y serait commun. Le sudoku range 81 valeurs, des notes en
 * masques de chiffres et un historique de coups ; une enquête range un plateau
 * d'occupants, des hypothèses au crayon et des cases barrées. Les deux formes
 * n'ont ni les mêmes champs, ni la même clef, ni la même version. Partager le
 * module reviendrait à faire une union de deux choses qui ne se rencontrent
 * jamais — ce que `plan.md` interdit explicitement sur un seul cas d'usage.
 *
 * Ce qui est **repris**, en revanche, c'est la doctrine, parce qu'elle a été
 * payée : tout accès enveloppé (en navigation privée, Safari refuse toujours
 * d'écrire et lève au premier `setItem`) ; une sauvegarde d'une autre version
 * jetée en entier plutôt que devinée ; et un schéma pensé pour rester additif,
 * de sorte qu'un champ de plus n'oblige jamais à jeter les parties en cours.
 *
 * ─── Ce qui n'est pas rangé, et pourquoi ────────────────────────────────────
 *
 * **L'historique d'annulation.** Celui de l'enquête n'est pas une liste de
 * coups mais une pile de **photographies** du plateau entier, jusqu'à deux
 * cents. L'écrire multiplierait la sauvegarde par deux ordres de grandeur pour
 * une commodité que personne n'attend au retour : reprendre une partie rend le
 * plateau tel qu'on l'a laissé, pas le droit de défaire ce qu'on avait fait
 * avant de fermer l'onglet.
 *
 * **La durée.** L'enquête n'a pas de chronomètre branché. Ranger un champ que
 * rien n'alimente donnerait un nombre qui a l'air mesuré — exactement ce que
 * l'onglet Progression refuse de faire.
 */

const KEY = 'enquete.game';

/**
 * Version de la forme rangée.
 *
 * Ajouter un champ optionnel, lu avec un défaut, n'est pas incompatible et ne
 * l'incrémente pas. Changer le sens, le type ou l'encodage d'un champ existant
 * l'est, et l'impose — au prix des parties en cours, jetées plutôt que mal
 * relues.
 */
export const CASE_SAVE_VERSION = 1;

export interface CaseSnapshot {
  /** L'affaire, sous sa forme transportable. Jamais la graine — voir `io/`. */
  readonly code: string;
  /** Qui occupe chaque case, ou -1. */
  readonly occupant: readonly number[];
  /** Hypothèses au crayon : un masque de suspects par case. */
  readonly pencil: readonly number[];
  readonly crossed: readonly boolean[];
  readonly suspect: number;
  readonly cursor: number;
  readonly tool: Tool;
  readonly hintTier: HintTier;
}

interface StoredCase extends CaseSnapshot {
  readonly version: number;
  readonly savedAt: string;
}

/** Une partie relue : l'affaire recomposée, et le plateau tel qu'il était. */
export interface RestoredCase {
  readonly file: CaseFile;
  readonly snapshot: CaseSnapshot;
}

const TOOLS: readonly Tool[] = ['place', 'note', 'cross'];

const isNumberArray = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number');

/**
 * Relit la partie rangée, ou rend `null`.
 *
 * Toute la validation est ici, et elle va jusqu'au bout : le code doit se
 * décoder en une affaire à solution unique, et les trois tableaux doivent avoir
 * exactement la taille du plateau de cette affaire. Un plateau d'une autre
 * taille que son décor est la faute que rien d'autre n'attraperait — elle ne
 * casse pas à la lecture mais à la première case touchée.
 */
export function loadCase(): RestoredCase | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Navigation privée, ou stockage refusé : il n'y a pas de partie à reprendre.
    return null;
  }
  if (raw === null) return null;

  let parsed: StoredCase;
  try {
    parsed = JSON.parse(raw) as StoredCase;
  } catch {
    return null;
  }
  if (parsed.version !== CASE_SAVE_VERSION) return null;
  if (typeof parsed.code !== 'string') return null;

  const file = tryDecodeCase(parsed.code);
  if (file === null) return null;

  const cells = file.solution.length * file.solution.length;
  if (!isNumberArray(parsed.occupant, cells)) return null;
  if (!isNumberArray(parsed.pencil, cells)) return null;
  if (
    !Array.isArray(parsed.crossed) ||
    parsed.crossed.length !== cells ||
    !parsed.crossed.every((item) => typeof item === 'boolean')
  ) {
    return null;
  }

  const tool = TOOLS.includes(parsed.tool) ? parsed.tool : 'place';
  const tier = [0, 1, 2, 3].includes(parsed.hintTier) ? parsed.hintTier : 0;

  return {
    file,
    snapshot: {
      code: parsed.code,
      occupant: parsed.occupant,
      pencil: parsed.pencil,
      crossed: parsed.crossed,
      suspect: Math.min(Math.max(0, parsed.suspect), file.solution.length - 1),
      cursor: Math.min(Math.max(0, parsed.cursor), cells - 1),
      tool,
      hintTier: tier,
    },
  };
}

/** Range la partie. Silencieux en cas d'échec — le jeu continue sans filet. */
export function saveCase(snapshot: CaseSnapshot): void {
  const stored: StoredCase = {
    ...snapshot,
    version: CASE_SAVE_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Quota dépassé ou stockage refusé : rien à faire de plus ici.
  }
}

export function clearCase(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sans conséquence.
  }
}
