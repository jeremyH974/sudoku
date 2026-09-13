import type { TechniqueId } from '@sudoku/engine/investigation';
import type { DayKey } from '../day.js';
import { longestStreakOf, median, streakEndingAt } from '../progress.js';

/**
 * L'historique des enquêtes résolues.
 *
 * ─── Pourquoi ce n'est pas une branche de `stats.ts` ────────────────────────
 *
 * Le plan d'incrément 11 l'annonçait comme telle : « l'issue d'une partie a la
 * forme de celle du sudoku → une branche dans `stats.ts` ». Au niveau des types,
 * c'est faux, et il vaut mieux l'écrire que de forcer.
 *
 * `GameRecord` porte un `level` et une `lesson` qui viennent de `logic/` ;
 * l'enquête n'a **pas de niveau** — aucun oracle ne la calibre — et son
 * `TechniqueId` est un type distinct, de même nom et sans rapport. Son identité
 * canonique est un code d'affaire, que `encodeGrid` ne saurait pas produire. Les
 * unir demanderait d'élargir trois champs pour un seul cas d'usage, ce que
 * `plan.md` interdit explicitement.
 *
 * Ce qui est **repris**, en revanche, c'est tout ce qui ne parle que de jours et
 * de nombres : les séries et la médiane vivent dans `progress.ts` et sont
 * appelées d'ici. Recopier l'algorithme d'une série serait recopier une
 * subtilité qui dériverait.
 *
 * ─── Ce qui n'est jamais compté ─────────────────────────────────────────────
 *
 * **Aucun taux de réussite** : il n'y a pas de bouton « abandonner », donc pas
 * de dénominateur définissable. **Aucun compteur persisté** : la série et les
 * totaux se recalculent depuis l'historique, parce que deux sources de vérité
 * finissent toujours par se contredire. **Aucune difficulté** : une affaire n'a
 * ni score ni palier, et lui en inventer un serait mentir.
 */

const KEY = 'enquete.stats';

/** Version de la forme rangée. Un historique d'une autre version est mis de côté. */
export const CASE_STATS_VERSION = 1;

/**
 * Plafond de l'historique.
 *
 * Cinq cents parties tiennent largement sous le quota, et au-delà les plus
 * anciennes n'apprennent plus rien — sauf les affaires du jour, qu'on garde
 * toutes : ce sont elles qui portent le calendrier et la série.
 */
const MAX_RECORDS = 500;

export interface CaseRecord {
  /** Le code de l'affaire : identité canonique, et de quoi la rejouer. */
  readonly code: string;
  readonly finishedAt: number;
  /** Jour civil de **début** de partie. */
  readonly day: DayKey;
  /** Le jour dont c'était l'affaire, ou `null` pour une affaire libre. */
  readonly daily: DayKey | null;
  /** `null` quand la mesure n'était pas fiable — jamais une durée approchée. */
  readonly durationMs: number | null;
  readonly hintsShown: number;
  /** La technique la plus dure que le chemin exige. Un fait, pas une note. */
  readonly hardest: TechniqueId;
  /** Combien de déductions nommées le chemin compte. */
  readonly stepCount: number;
  /** Version du registre qui a mesuré les deux champs ci-dessus. */
  readonly registryVersion: number;
}

interface Stored {
  readonly version: number;
  readonly records: readonly CaseRecord[];
}

const isRecord = (value: unknown): value is CaseRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['code'] === 'string' &&
    typeof record['finishedAt'] === 'number' &&
    typeof record['day'] === 'string' &&
    (record['daily'] === null || typeof record['daily'] === 'string') &&
    (record['durationMs'] === null || typeof record['durationMs'] === 'number') &&
    typeof record['hardest'] === 'string' &&
    typeof record['stepCount'] === 'number'
  );
};

/**
 * Relit l'historique, entrée par entrée.
 *
 * Une entrée illisible est **écartée**, les autres sont gardées : perdre une
 * partie sur deux cents vaut mieux que perdre les deux cents. C'est la doctrine
 * de `stats.ts`, et elle diffère volontairement de celle de la sauvegarde de
 * partie, qui est un tout ou rien — un état de jeu à moitié relu donnerait un
 * plateau faux, là où un historique amputé reste juste sur ce qu'il porte.
 */
export function loadRecords(): CaseRecord[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let parsed: Stored;
  try {
    parsed = JSON.parse(raw) as Stored;
  } catch {
    return [];
  }
  if (parsed.version !== CASE_STATS_VERSION) return [];
  if (!Array.isArray(parsed.records)) return [];
  return parsed.records.filter(isRecord);
}

/**
 * Ajoute une partie, sans jamais la compter deux fois.
 *
 * La déduplication porte sur le couple (affaire, jour) : rejouer la même affaire
 * un autre jour compte, la rouvrir le même jour non. Rend `false` si rien n'a
 * été ajouté, pour que l'appelant puisse le dire plutôt que d'afficher un
 * chiffre qui n'a pas bougé.
 */
export function appendRecord(record: CaseRecord): boolean {
  const records = loadRecords();
  if (records.some((kept) => kept.code === record.code && kept.day === record.day)) return false;

  records.push(record);
  records.sort((left, right) => left.finishedAt - right.finishedAt);

  // On taille dans les affaires libres seulement : les quotidiennes portent le
  // calendrier, et en perdre une trouerait la série pour toujours.
  while (records.length > MAX_RECORDS) {
    const index = records.findIndex((kept) => kept.daily === null);
    if (index < 0) break;
    records.splice(index, 1);
  }

  try {
    localStorage.setItem(KEY, JSON.stringify({ version: CASE_STATS_VERSION, records }));
  } catch {
    // Quota dépassé ou stockage refusé : la partie est jouée, pas comptée.
    return false;
  }
  return true;
}

export function clearRecords(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sans conséquence.
  }
}

/** Les jours dont l'affaire a été résolue. Recalculé, jamais stocké. */
export function solvedDays(records: readonly CaseRecord[]): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const record of records) if (record.daily !== null) days.add(record.daily);
  return days;
}

export const dailyStreak = (records: readonly CaseRecord[], today: DayKey): number =>
  streakEndingAt(solvedDays(records), today);

export const longestDailyStreak = (records: readonly CaseRecord[]): number =>
  longestStreakOf(solvedDays(records));

export interface TechniqueTally {
  readonly technique: TechniqueId;
  readonly count: number;
  /** Médiane des durées mesurables, ou `null` si l'échantillon ne la porte pas. */
  readonly medianMs: number | null;
  /** Sur combien de parties la médiane porte réellement. */
  readonly timed: number;
}

/**
 * Le décompte par technique la plus dure.
 *
 * ─── Pourquoi grouper par là, et pas du tout ────────────────────────────────
 *
 * Parce qu'une médiane doit porter sur des parties comparables. Le sudoku groupe
 * par niveau, et `progress.ts` refuse explicitement d'agréger : « agrégée, une
 * médiane ne mesurerait pas l'habileté du joueur mais ce qu'il a choisi de
 * jouer ». L'enquête n'a pas de niveau — mais elle a un fait mesuré et
 * observable, la technique la plus dure que le chemin exige. C'est le seul axe
 * de comparaison qui existe ici, et il est **compté**, pas noté : « quatre
 * affaires dont la plus dure déduction était un recoupement » se vérifie ; « 78
 * de tension » ne se vérifie pas.
 *
 * Le seuil de cinq parties est celui du sudoku, et pour la même raison : en
 * deçà, on dit ce qui manque plutôt qu'un à-peu-près.
 */
export function byHardest(records: readonly CaseRecord[]): TechniqueTally[] {
  const groups = new Map<TechniqueId, CaseRecord[]>();
  for (const record of records) {
    const kept = groups.get(record.hardest);
    if (kept === undefined) groups.set(record.hardest, [record]);
    else kept.push(record);
  }

  return [...groups.entries()]
    .map(([technique, group]) => {
      const durations = group
        .map((record) => record.durationMs)
        .filter((value): value is number => value !== null);
      return {
        technique,
        count: group.length,
        medianMs: median(durations),
        timed: durations.length,
      };
    })
    .sort((left, right) => right.count - left.count);
}

/**
 * La partie la plus rapide, ou `null`.
 *
 * Un record se dit **dès la première partie** — c'est un fait observé, pas une
 * tendance. La règle des cinq parties ne vaut que pour les médianes.
 */
export function fastest(records: readonly CaseRecord[]): CaseRecord | null {
  let best: CaseRecord | null = null;
  for (const record of records) {
    if (record.durationMs === null) continue;
    if (best === null || record.durationMs < (best.durationMs ?? Infinity)) best = record;
  }
  return best;
}
