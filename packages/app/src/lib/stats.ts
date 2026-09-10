import { isDayKey } from './day.js';
import type { DayKey } from './day.js';
import type { Level, TechniqueId } from '@sudoku/engine';

/**
 * L'historique des parties terminées.
 *
 * ─── Une doctrine différente de celle de `storage.ts`, et c'est délibéré ────
 *
 * La partie en cours suit la règle « ignorer, jamais deviner » : une sauvegarde
 * d'une autre version est jetée. C'est le bon arbitrage là-bas — perdre une
 * partie coûte dix minutes, et une partie à demi restaurée est pire que pas de
 * partie du tout.
 *
 * Ici l'arbitrage s'inverse. Perdre six mois d'historique coûte une chose
 * irremplaçable, et c'est précisément la donnée qui fait revenir quelqu'un.
 * Quatre règles en découlent, à ne pas « harmoniser » avec le module voisin :
 *
 * 1. **On migre par ajout.** Tout nouveau champ est optionnel à la lecture, avec
 *    un défaut explicite. Tant qu'on n'ajoute que des champs, la version ne
 *    bouge pas.
 * 2. **On valide entrée par entrée, pas fichier par fichier.** Une partie
 *    corrompue est écartée, les autres restent. `storage.ts` fait déjà cela pour
 *    l'historique d'annulation ; c'est la bonne moitié de sa doctrine.
 * 3. **On met en quarantaine, on ne supprime jamais.** Un contenu illisible ou
 *    écrit par une version plus récente est déplacé tel quel sous une clé de
 *    secours. On peut le récupérer, ou au moins le diagnostiquer.
 * 4. **On relit avant d'écrire.** Deux onglets ouverts écriraient sinon chacun
 *    sa vision du monde, et le dernier gagnerait. Relire coûte un `JSON.parse`
 *    une fois par partie terminée — négligeable, contrairement à la sauvegarde
 *    de partie qui, elle, est fréquente.
 *
 * ─── Ce qui n'est pas stocké, et pourquoi ───────────────────────────────────
 *
 * Ni la série en cours, ni le nombre de quotidiens faits, ni aucun compteur.
 * Tout se **recalcule** depuis les parties (voir `progress.ts`). Un compteur
 * persisté diverge au premier défaut et n'est plus jamais réparable ; un calcul
 * se corrige en une version. Deux sources de vérité finissent toujours par se
 * contredire, et le jour où la série affiche 5 pendant que l'historique en
 * montre 3, plus personne ne saura laquelle croire.
 */

const KEY = 'sudoku.stats';
/** Où atterrit un contenu qu'on ne sait pas lire. Jamais écrasé en silence. */
const QUARANTINE_KEY = 'sudoku.stats.bak';

/** Version du format. N'augmente que sur un vrai changement de forme. */
export const STATS_VERSION = 1;

/**
 * Au-delà, les parties les plus anciennes sont taillées — **sauf** les défis
 * quotidiens, dont dépend le calcul de la plus longue série. Les tailler
 * réécrirait le passé du joueur.
 */
const MAX_RECORDS = 500;

/** Une partie terminée. */
export interface GameRecord {
  /** Grille encodée : identité canonique, et de quoi la rejouer telle quelle. */
  readonly id: string;
  /** Instant de fin, en millisecondes depuis l'époque. */
  readonly finishedAt: number;
  /** Jour civil local où la partie a **commencé**. */
  readonly day: DayKey;
  /** Date du défi quotidien, ou `null` pour une partie libre. */
  readonly daily: DayKey | null;
  readonly level: Level | null;
  readonly score: number;
  /**
   * Version du barème au moment de la mesure.
   *
   * Le champ qu'on oublie et qui coûte cher : le barème a déjà changé quatre
   * fois. Sans lui, une médiane de score mélangerait deux échelles et mentirait.
   */
  readonly ratingVersion: number;
  /** `null` quand la mesure n'était pas fiable. Voir `stopwatch.svelte.ts`. */
  readonly durationMs: number | null;
  /** Indices consultés, tous paliers confondus. */
  readonly hintsShown: number;
  /** Indices dont le coup a été appliqué — le seul qui juge une complétion. */
  readonly hintsApplied: number;
  /** Valeurs fausses saisies, comptées à la saisie. Informatif, jamais punitif. */
  readonly mistakes: number;
  /**
   * Technique enseignée si cette partie était un exercice de la campagne.
   *
   * Champ ajouté à l'incrément 8, sous la règle 1 ci-dessus : optionnel à la
   * lecture, avec un défaut explicite, donc sans montée de `STATS_VERSION`.
   */
  readonly lesson: TechniqueId | null;
}

interface StatsFile {
  readonly version: number;
  readonly records: readonly GameRecord[];
  readonly savedAt: string;
}

const isRecord = (value: unknown): value is GameRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['finishedAt'] === 'number' &&
    isDayKey(r['day']) &&
    (r['daily'] === null || isDayKey(r['daily'])) &&
    typeof r['score'] === 'number' &&
    typeof r['ratingVersion'] === 'number' &&
    (r['durationMs'] === null || typeof r['durationMs'] === 'number')
  );
};

/** Complète les champs ajoutés après coup, sans exiger de montée de version. */
const normalise = (value: GameRecord): GameRecord => ({
  ...value,
  level: value.level ?? null,
  hintsShown: typeof value.hintsShown === 'number' ? value.hintsShown : 0,
  hintsApplied: typeof value.hintsApplied === 'number' ? value.hintsApplied : 0,
  mistakes: typeof value.mistakes === 'number' ? value.mistakes : 0,
  lesson: value.lesson ?? null,
});

function quarantine(raw: string): void {
  try {
    localStorage.setItem(QUARANTINE_KEY, raw);
  } catch {
    // Si même la mise de côté échoue, il n'y a plus rien à tenter.
  }
}

/**
 * Relit l'historique.
 *
 * Rend toujours un tableau — jamais `null`. L'absence d'historique et un
 * historique illisible mènent au même endroit du point de vue de l'appelant :
 * on repart de zéro. La différence est que le second a été mis de côté.
 */
export function loadRecords(): GameRecord[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<StatsFile>;
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.records)) {
      quarantine(raw);
      return [];
    }
    if (parsed.version > STATS_VERSION) {
      // Écrit par une version plus récente de l'application : on n'y touche
      // pas. Le joueur a peut-être simplement deux navigateurs.
      quarantine(raw);
      return [];
    }
    return parsed.records.filter(isRecord).map(normalise);
  } catch {
    quarantine(raw);
    return [];
  }
}

/**
 * Taille l'historique en préservant ce dont un affichage dépend.
 *
 * Le critère n'est pas « les 500 plus récentes » mais « les 500 plus récentes,
 * **plus tous les défis quotidiens** ». Un quotidien effacé raccourcirait
 * rétroactivement la plus longue série, ce que le joueur vivrait comme une
 * perte, à raison.
 */
function trim(records: readonly GameRecord[]): GameRecord[] {
  if (records.length <= MAX_RECORDS) return [...records];
  const sorted = [...records].sort((a, b) => b.finishedAt - a.finishedAt);
  const kept = new Set(sorted.slice(0, MAX_RECORDS));
  for (const record of sorted) {
    if (record.daily !== null) kept.add(record);
  }
  return sorted.filter((record) => kept.has(record));
}

/**
 * Ajoute une partie terminée, en relisant d'abord ce qui est déjà écrit.
 *
 * Renvoie `false` si l'écriture a échoué — contrairement à `saveGame`, qui reste
 * silencieux. Ici le joueur croirait son historique enregistré, et l'appelant
 * doit pouvoir le détromper.
 *
 * La partie est **idempotente** : deux enregistrements de la même grille le même
 * jour n'en font qu'un. Deux onglets ouverts sur le même défi, ou une reprise
 * après rechargement, ne gonflent donc aucun compteur. La première complétion
 * gagne : c'est celle qui a vraiment eu lieu.
 */
export function appendRecord(record: GameRecord): boolean {
  const existing = loadRecords();
  const already = existing.some((r) => r.id === record.id && r.day === record.day);
  const records = already ? existing : trim([...existing, record]);
  return writeRecords(records);
}

function writeRecords(records: readonly GameRecord[]): boolean {
  const file: StatsFile = {
    version: STATS_VERSION,
    records,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
    return true;
  } catch {
    // Quota dépassé : on tente une fois avec un historique réduit de moitié
    // plutôt que d'abandonner tout ce que le joueur a accumulé.
    try {
      const half = [...records]
        .sort((a, b) => b.finishedAt - a.finishedAt)
        .slice(0, Math.floor(MAX_RECORDS / 2));
      localStorage.setItem(KEY, JSON.stringify({ ...file, records: half }));
      return true;
    } catch {
      return false;
    }
  }
}

/** Efface l'historique. Réservé à une action explicite du joueur. */
export function clearRecords(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sans conséquence.
  }
}
