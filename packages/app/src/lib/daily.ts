import type { Level } from '@sudoku/engine';
import { isDayKey, localDayKey, nextDay } from './day.js';
import type { DayKey } from './day.js';

/**
 * Le défi quotidien.
 *
 * ─── Un corpus figé, jamais une grille recalculée ───────────────────────────
 *
 * Le défi du jour est lu dans un fichier produit une fois pour toutes par
 * `pnpm dailies`, versionné dans le dépôt et précaché par le service worker. Il
 * n'est **pas** dérivé de la date par le générateur, et ce n'est pas un détail
 * d'implémentation : la génération dépend du barème de notation *et* du temps
 * réel écoulé sur la machine. Deux joueurs, même date, obtiendraient deux
 * grilles différentes ; et un changement de barème réécrirait tout l'historique.
 *
 * Conséquence heureuse : le défi du jour fonctionne **hors ligne**, ce que
 * presque aucun concurrent ne sait faire, puisque chez eux il vient d'un
 * serveur.
 *
 * ─── Ce que le corpus ne porte pas ──────────────────────────────────────────
 *
 * Ni la solution, ni le niveau, ni le score : uniquement la grille encodée. Tout
 * le reste se recalcule localement en une milliseconde, et le corpus reste ainsi
 * insensible aux évolutions du moteur. C'est le même raisonnement que pour le
 * code imprimé sous chaque grille — un cahier imprimé aujourd'hui doit s'ouvrir
 * dans dix ans.
 *
 * Le niveau affiché est donc **mesuré**, pas annoncé. Si une évolution du barème
 * déplaçait un mardi de Moyen à Difficile, l'application dirait Difficile : la
 * règle « ne jamais afficher une difficulté qui n'est pas mesurée » prime sur la
 * régularité de la grille de programmation.
 */

export interface DailyCorpus {
  readonly version: number;
  /** Ordre des niveaux dans chaque entrée de `days`. */
  readonly levels: readonly Level[];
  /*
    `| undefined` est explicite, et il n'est pas décoratif : indexer un `Record`
    par une clé absente rend `undefined` à l'exécution, ce que le type tait
    quand `noUncheckedIndexedAccess` est désactivé. Sans cette mention, le
    linter réclamerait le retrait des gardes qui protègent précisément de ce
    cas — et un jour sans défi ferait planter la page.
  */
  readonly days: Readonly<Record<DayKey, readonly string[] | undefined>>;
}

const CORPUS_URL = `${import.meta.env.BASE_URL}daily/corpus.json`;

let cached: DailyCorpus | null = null;
let pending: Promise<DailyCorpus | null> | null = null;

const isCorpus = (value: unknown): value is DailyCorpus => {
  if (typeof value !== 'object' || value === null) return false;
  const corpus = value as Record<string, unknown>;
  return (
    typeof corpus['version'] === 'number' &&
    Array.isArray(corpus['levels']) &&
    typeof corpus['days'] === 'object' &&
    corpus['days'] !== null
  );
};

/**
 * Charge le corpus, une seule fois par session.
 *
 * Rend `null` plutôt que de lever : l'absence de corpus doit dégrader l'onglet
 * du défi, jamais empêcher de jouer. La promesse en cours est mémorisée pour que
 * deux composants qui le demandent en même temps ne déclenchent pas deux
 * requêtes.
 */
export async function loadDailyCorpus(): Promise<DailyCorpus | null> {
  if (cached !== null) return cached;
  pending ??= (async (): Promise<DailyCorpus | null> => {
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

/** La grille encodée d'un jour et d'un niveau, ou `null` si le corpus ne l'a pas. */
export function dailyCode(corpus: DailyCorpus, day: DayKey, level: Level): string | null {
  const index = corpus.levels.indexOf(level);
  if (index < 0) return null;
  return corpus.days[day]?.[index] ?? null;
}

/** `true` si le jour figure au corpus, tous niveaux confondus. */
export const hasDaily = (corpus: DailyCorpus, day: DayKey): boolean => day in corpus.days;

export interface CorpusRange {
  readonly first: DayKey;
  readonly last: DayKey;
}

/** Bornes du corpus, ou `null` s'il est vide. */
export function corpusRange(corpus: DailyCorpus): CorpusRange | null {
  const days = Object.keys(corpus.days).filter(isDayKey).sort();
  if (days.length === 0) return null;
  return { first: days[0], last: days[days.length - 1] };
}

/**
 * Jours de défi restants à partir d'aujourd'hui, bornes comprises.
 *
 * Sert à deux choses : prévenir le joueur quand le corpus s'épuise, et faire
 * échouer un test avant la panne plutôt qu'après. Un corpus qui se termine est
 * une échéance connue d'avance ; il n'y a aucune raison de la découvrir le jour
 * où l'application affiche un écran vide.
 */
export function daysRemaining(corpus: DailyCorpus, from: DayKey = today()): number {
  const range = corpusRange(corpus);
  if (range === null || range.last < from) return 0;
  let count = 0;
  let cursor = from < range.first ? range.first : from;
  while (cursor <= range.last) {
    if (cursor in corpus.days) count++;
    cursor = nextDay(cursor);
  }
  return count;
}

/** Réinitialise le cache. Réservé aux tests. */
export function resetDailyCache(): void {
  cached = null;
  pending = null;
}
