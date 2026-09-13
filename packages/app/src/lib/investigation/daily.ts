import { localDayKey } from '../day.js';
import type { DayKey } from '../day.js';

/**
 * L'affaire du jour.
 *
 * ─── Pourquoi un fichier, et non un calcul depuis la date ───────────────────
 *
 * Même raison que pour le sudoku, et elle est écrite dans `cases.ts` : la
 * fabrique branche sur le registre de déduction, donc une graine ne reproduit
 * pas la même affaire d'une version à l'autre. Le corpus porte donc **le code de
 * l'affaire**, jamais sa graine.
 *
 * Bénéfice qui n'était pas recherché, et qui compte : l'affaire du jour
 * fonctionne **hors ligne**, puisqu'elle est précachée avec l'application.
 *
 * ─── Ce que ce module ne fait pas ───────────────────────────────────────────
 *
 * Il ne dit pas si l'affaire du jour a été résolue, et ne compte rien. L'enquête
 * n'a pas encore d'historique de parties, et en fabriquer un ici donnerait deux
 * sources de vérité — ce que `stats.ts` interdit depuis l'incrément 7.
 */

export interface CaseCorpus {
  readonly version: number;
  /*
    `| undefined` est explicite, et il n'est pas décoratif : indexer un `Record`
    par une clef absente rend `undefined` à l'exécution, ce que le type tait
    quand `noUncheckedIndexedAccess` est désactivé. Sans cette mention, le
    linter réclamerait le retrait de la garde qui protège exactement de ce cas,
    et un jour sans affaire ferait planter la page.
  */
  readonly days: Readonly<Record<DayKey, string | undefined>>;
}

const CORPUS_URL = `${import.meta.env.BASE_URL}daily/cases.json`;

let cached: CaseCorpus | null = null;
let pending: Promise<CaseCorpus | null> | null = null;

const isCorpus = (value: unknown): value is CaseCorpus => {
  if (typeof value !== 'object' || value === null) return false;
  const corpus = value as Record<string, unknown>;
  return (
    typeof corpus['version'] === 'number' &&
    typeof corpus['days'] === 'object' &&
    corpus['days'] !== null
  );
};

/**
 * Charge le corpus, une seule fois par session.
 *
 * Rend `null` plutôt que de lever : l'absence de corpus doit priver de l'affaire
 * du jour, jamais empêcher de jouer. La promesse en cours est mémorisée pour que
 * deux appels simultanés ne déclenchent pas deux requêtes.
 */
export async function loadCaseCorpus(): Promise<CaseCorpus | null> {
  if (cached !== null) return cached;
  pending ??= (async (): Promise<CaseCorpus | null> => {
    try {
      const response = await fetch(CORPUS_URL);
      if (!response.ok) return null;
      const parsed: unknown = await response.json();
      if (!isCorpus(parsed)) return null;
      cached = parsed;
      return cached;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Le jour civil local d'aujourd'hui. */
export const today = (): DayKey => localDayKey();

/** Le code de l'affaire d'un jour, ou `null` si le corpus ne l'a pas. */
export function caseCodeFor(corpus: CaseCorpus, day: DayKey): string | null {
  const code = corpus.days[day];
  return code === undefined || code === '' ? null : code;
}
