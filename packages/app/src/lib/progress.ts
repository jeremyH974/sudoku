import { nextDay, previousDay } from './day.js';
import type { DayKey } from './day.js';
import type { GameRecord } from './stats.js';
import { LEVELS } from '@sudoku/engine';
import type { Level, TechniqueId } from '@sudoku/engine';

/**
 * Ce que l'historique permet de dire — et surtout ce qu'il ne permet pas.
 *
 * Toutes les fonctions de ce module sont **pures** : elles prennent des parties
 * et rendent des nombres. Aucun accès au stockage, aucune date implicite, aucun
 * état. C'est ce qui les rend vérifiables par propriété plutôt que par exemple,
 * comme l'exige le projet pour ses invariants.
 *
 * ─── L'honnêteté statistique, qui est la même règle que pour la difficulté ──
 *
 * Le projet s'interdit d'afficher une difficulté qui n'est pas mesurée. Le
 * pendant statistique tient en une phrase : **un indicateur que l'échantillon ne
 * porte pas ne reçoit aucune valeur.**
 *
 * D'où la ligne de partage suivie ici :
 *
 *   - un **fait** se dit dès la première partie — « 1 partie terminée », « meilleur
 *     temps sur Difficile : 8 min 12 ». Un record sur un échantillon de un reste
 *     un record.
 *   - une **tendance** exige de la matière. La durée médiane n'est rendue qu'à
 *     partir de cinq parties du même niveau, et jamais tous niveaux confondus :
 *     agrégée, elle ne mesurerait pas l'habileté du joueur mais ce qu'il a choisi
 *     de jouer.
 *
 * Médiane et non moyenne, pour trois raisons dans l'ordre : la distribution des
 * durées est très asymétrique — un mode à quelques minutes et une longue queue ;
 * une seule partie interrompue déplacerait une moyenne de plusieurs minutes ;
 * et « la moitié de mes parties Expert passent sous douze minutes » décrit
 * quelque chose de vécu, là où une moyenne ne décrit rien.
 *
 * Aucun taux de réussite n'est calculé : il n'y a pas de bouton « abandonner »,
 * et fermer un onglet n'est pas un échec. Un indicateur dont le dénominateur
 * n'est pas définissable est exactement ce que la règle interdit.
 */

/** Nombre de parties en deçà duquel une médiane n'en est pas une. */
export const MIN_SAMPLE_FOR_MEDIAN = 5;

/**
 * Les parties de jeu, exercices de la campagne exclus.
 *
 * ─── Pourquoi cette exclusion n'est pas un détail ───────────────────────────
 *
 * Un exercice amorcé démarre à cinquante cases posées et se termine en quarante
 * secondes ; une grille Diabolique en prend quarante minutes. Les mêler dans une
 * même médiane produirait un chiffre qui a l'air mesuré et ne l'est pas — le
 * défaut exact que tout ce projet refuse. Un exercice n'a d'ailleurs **aucun
 * niveau** : une position n'en a pas.
 */
const playedGames = (records: readonly GameRecord[]): GameRecord[] =>
  records.filter((record) => record.lesson === null);

/** Les jours dont le défi quotidien a été résolu, quel que soit le niveau. */
export function completedDays(records: readonly GameRecord[]): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const record of records) {
    if (record.daily !== null) days.add(record.daily);
  }
  return days;
}

/**
 * La série en cours, en jours.
 *
 * Elle remonte depuis aujourd'hui, ou depuis hier si le défi du jour n'est pas
 * encore fait — sans quoi elle afficherait zéro chaque matin, ce qui serait à la
 * fois faux et décourageant.
 *
 * Un jour compte dès qu'**un** de ses défis est résolu, quel que soit le niveau,
 * et **peu importe quand il l'a été** : rattraper dimanche les cinq jours de la
 * semaine reconstitue la série. C'est un choix de fond, pas un réglage — la
 * série mesure l'assiduité au corpus, pas la ponctualité. Elle ne punit ni un
 * voyage, ni une semaine de grippe.
 *
 * Le libellé qui l'accompagne doit dire « jours **résolus** », jamais « jours de
 * suite » : c'est lui qui porte tout le sens.
 */
export function currentStreak(records: readonly GameRecord[], today: DayKey): number {
  const days = completedDays(records);
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

/** La plus longue série jamais tenue. */
export function longestStreak(records: readonly GameRecord[]): number {
  const days = completedDays(records);
  let best = 0;
  for (const day of days) {
    // On ne compte une série que depuis son premier jour, sinon on la
    // recompterait autant de fois qu'elle a de jours.
    if (days.has(previousDay(day))) continue;
    let length = 0;
    let cursor = day;
    while (days.has(cursor)) {
      length++;
      cursor = nextDay(cursor);
    }
    if (length > best) best = length;
  }
  return best;
}

/** Médiane arrondie à la milliseconde, ou `null` si l'échantillon ne la porte pas. */
export function median(values: readonly number[]): number | null {
  if (values.length < MIN_SAMPLE_FOR_MEDIAN) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export interface LevelSummary {
  readonly level: Level;
  readonly label: string;
  /** Parties terminées à ce niveau. */
  readonly played: number;
  /** Parties dont la durée était mesurable — le dénominateur des temps. */
  readonly timed: number;
  /** Meilleur temps, en millisecondes. Un fait, dès la première partie. */
  readonly bestMs: number | null;
  /** Durée médiane, ou `null` tant que l'échantillon ne la porte pas. */
  readonly medianMs: number | null;
  /** Parties terminées sans appliquer un seul indice. */
  readonly unaided: number;
}

/**
 * Résumé par niveau.
 *
 * Tous les niveaux sont rendus, y compris ceux jamais joués : une grille de
 * progression avec des cases vides dit quelque chose — ce qu'il reste à faire —
 * là où une liste tronquée ne dit rien.
 */
export function summarise(records: readonly GameRecord[]): LevelSummary[] {
  const games = playedGames(records);
  return LEVELS.map((info) => {
    const played = games.filter((record) => record.level === info.id);
    const durations = played
      .map((record) => record.durationMs)
      .filter((value): value is number => value !== null);

    return {
      level: info.id,
      label: info.label,
      played: played.length,
      timed: durations.length,
      bestMs: durations.length > 0 ? Math.min(...durations) : null,
      medianMs: median(durations),
      unaided: played.filter((record) => record.hintsApplied === 0).length,
    };
  });
}

export interface Totals {
  readonly played: number;
  readonly dailies: number;
  readonly unaided: number;
  /** Niveau le plus élevé jamais terminé. Un fait, pas une moyenne. */
  readonly highestLevel: Level | null;
}

export function totals(records: readonly GameRecord[]): Totals {
  const games = playedGames(records);
  let highest: Level | null = null;
  let highestRank = -1;
  for (const record of games) {
    if (record.level === null) continue;
    const rank = LEVELS.findIndex((info) => info.id === record.level);
    if (rank > highestRank) {
      highestRank = rank;
      highest = record.level;
    }
  }

  return {
    played: games.length,
    dailies: completedDays(records).size,
    unaided: games.filter((record) => record.hintsApplied === 0).length,
    highestLevel: highest,
  };
}

/** Ce qu'on sait d'une technique, et rien de plus. */
export interface TechniqueProgress {
  readonly technique: TechniqueId;
  /** Exercices terminés. Un fait, dès le premier. */
  readonly done: number;
  /** Terminés sans appliquer un seul indice. */
  readonly unaided: number;
  /** Instant du premier exercice terminé, ou `null`. */
  readonly firstAt: number | null;
}

/**
 * Avancement par technique.
 *
 * ─── Ce que cette fonction refuse délibérément de calculer ──────────────────
 *
 * **Aucun pourcentage de maîtrise.** Il faudrait un dénominateur — le nombre
 * d'exercices tentés — que rien n'observe : il n'y a pas de bouton « j'abandonne ».
 * C'est la même raison qui a fait écarter le taux de réussite à l'incrément 7.
 *
 * **Aucune médiane de temps par technique.** Deux raisons, et la seconde ne
 * saute pas aux yeux : cinq échantillons d'une tâche de trente secondes ne
 * portent rien ; surtout, les exercices d'une même technique **partent de
 * positions différentes**, avec un nombre de cases restantes différent. Leurs
 * durées ne sont donc pas comparables entre elles, même en principe. Le seuil de
 * cinq parties ne sauverait rien ici — il produirait un nombre qui aurait l'air
 * mesuré.
 *
 * **Aucune barre « 21 sur 24 ».** Elle compterait comme des échecs les
 * techniques dont le corpus n'a pas de grille, que le joueur ne peut pas faire.
 */
export function techniqueProgress(records: readonly GameRecord[]): TechniqueProgress[] {
  const byTechnique = new Map<TechniqueId, GameRecord[]>();
  for (const record of records) {
    if (record.lesson === null) continue;
    const bucket = byTechnique.get(record.lesson);
    if (bucket === undefined) byTechnique.set(record.lesson, [record]);
    else bucket.push(record);
  }

  return [...byTechnique.entries()].map(([technique, done]) => ({
    technique,
    done: done.length,
    unaided: done.filter((record) => record.hintsApplied === 0).length,
    firstAt: Math.min(...done.map((record) => record.finishedAt)),
  }));
}
