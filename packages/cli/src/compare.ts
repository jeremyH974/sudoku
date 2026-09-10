import { MAX_KNOWN_DIFFICULTY } from '@sudoku/engine';
import type { CorpusEntry } from './corpus.js';
import type { OracleRating } from './oracle/serate.js';

/**
 * Comparaison de notre notation avec celle de l'oracle.
 *
 * ─── Le critère n'est pas une corrélation ───────────────────────────────────
 *
 * Sudoku Explainer possède bien plus de techniques que nous, mais il les essaie
 * dans un ordre où les nôtres viennent en premier. Pour une grille que notre
 * registre sait résoudre, il devrait donc emprunter le même chemin et rendre
 * **exactement le même nombre**. On ne cherche pas un coefficient de
 * corrélation : on cherche une **égalité**, et tout écart désigne un défaut
 * localisable — un ordre erroné, ou une détection incomplète.
 *
 * Une seule zone échappe à cette règle. Entre 4,0 et 5,4, l'oracle dispose de
 * techniques qui nous manquent (XY-Wing, XYZ-Wing, Skyscraper, Unique
 * Rectangle) et peut conclure moins cher là où nous sommes contraints à un
 * quadruplet. Les écarts y sont attendus, et leur mesure dira s'il faut ajouter
 * ces techniques ou resserrer notre échelle publique.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Tolérance de comparaison : les notes sont au dixième, jamais en dessous. */
const EPSILON = 0.001;

export interface Comparison {
  readonly entry: CorpusEntry;
  readonly oracle: OracleRating;
  /** Notre note moins la sienne. Zéro quand tout va bien. */
  readonly delta: number;
  readonly agrees: boolean;
}

export interface TechniquePair {
  readonly ours: string;
  readonly theirs: string;
  readonly count: number;
  readonly agreeing: number;
}

export interface Report {
  readonly total: number;
  readonly solvedByUs: number;
  readonly agreed: number;
  readonly agreementRate: number;
  /** Accord restreint à la zone où il est exigible, sous le seuil des techniques manquantes. */
  readonly agreedBelowThreshold: number;
  readonly totalBelowThreshold: number;
  readonly divergences: readonly Comparison[];
  /** Correspondances observées entre nos noms de techniques et les siens. */
  readonly techniquePairs: readonly TechniquePair[];
  /** Grilles que nous refusons d'étiqueter, et ce que l'oracle en dit. */
  readonly refused: readonly { readonly puzzle: string; readonly oracleEr: number }[];
  /** Refus injustifiés : l'oracle les note dans notre domaine. Cas grave. */
  readonly wronglyRefused: readonly { readonly puzzle: string; readonly oracleEr: number }[];
  readonly ratingVersion: number;
}

/**
 * Seuil au-delà duquel un écart s'explique par nos techniques manquantes.
 * En deçà, tout écart est un défaut.
 */
export const EXACTNESS_THRESHOLD = 4.0;

export function compare(
  entries: readonly CorpusEntry[],
  oracleRatings: readonly OracleRating[],
  ratingVersion: number,
): Report {
  // L'oracle numérote ses réponses à partir de 1, dans l'ordre du fichier.
  const byIndex = new Map(oracleRatings.map((rating) => [rating.index, rating]));

  const comparisons: Comparison[] = [];
  const refused: { puzzle: string; oracleEr: number }[] = [];
  const wronglyRefused: { puzzle: string; oracleEr: number }[] = [];
  const pairs = new Map<string, { ours: string; theirs: string; count: number; agreeing: number }>();

  entries.forEach((entry, position) => {
    const oracle = byIndex.get(position + 1);
    if (oracle === undefined) return;

    if (entry.ours.outcome !== 'solved') {
      refused.push({ puzzle: entry.puzzle, oracleEr: oracle.er });
      // Refuser une grille que l'oracle note dans notre domaine serait un aveu
      // grave : nous prétendrions ne pas savoir résoudre ce que nos propres
      // techniques couvrent.
      if (oracle.er <= MAX_KNOWN_DIFFICULTY) {
        wronglyRefused.push({ puzzle: entry.puzzle, oracleEr: oracle.er });
      }
      return;
    }

    const delta = entry.ours.score - oracle.er;
    const agrees = Math.abs(delta) < EPSILON;
    comparisons.push({ entry, oracle, delta, agrees });

    const key = `${entry.ours.label ?? '?'}|${oracle.technique}`;
    const existing = pairs.get(key);
    if (existing) {
      existing.count++;
      if (agrees) existing.agreeing++;
    } else {
      pairs.set(key, {
        ours: entry.ours.label ?? '?',
        theirs: oracle.technique,
        count: 1,
        agreeing: agrees ? 1 : 0,
      });
    }
  });

  const below = comparisons.filter((c) => c.entry.ours.score <= EXACTNESS_THRESHOLD);
  const agreed = comparisons.filter((c) => c.agrees).length;

  return {
    total: entries.length,
    solvedByUs: comparisons.length,
    agreed,
    agreementRate: comparisons.length === 0 ? 0 : agreed / comparisons.length,
    agreedBelowThreshold: below.filter((c) => c.agrees).length,
    totalBelowThreshold: below.length,
    divergences: comparisons
      .filter((c) => !c.agrees)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    techniquePairs: [...pairs.values()].sort((a, b) => b.count - a.count),
    refused,
    wronglyRefused,
    ratingVersion,
  };
}

/** Rapport lisible en console. */
export function formatReport(report: Report): string {
  const pct = (n: number, d: number): string =>
    d === 0 ? '—' : `${((n / d) * 100).toFixed(1)} %`;

  const lines: string[] = [
    '',
    '═══ CALIBRATION CONTRE SUDOKU EXPLAINER ═══',
    '',
    `Grilles du corpus            ${String(report.total)}`,
    `  résolues par notre moteur  ${String(report.solvedByUs)}`,
    `  refusées (hors échelle)    ${String(report.refused.length)}`,
    '',
    `Accord exact (toutes)        ${String(report.agreed)}/${String(report.solvedByUs)}  ${pct(report.agreed, report.solvedByUs)}`,
    `Accord exact (score ≤ ${EXACTNESS_THRESHOLD.toFixed(1)})   ${String(report.agreedBelowThreshold)}/${String(report.totalBelowThreshold)}  ${pct(report.agreedBelowThreshold, report.totalBelowThreshold)}   ← le critère qui compte`,
    '',
  ];

  if (report.wronglyRefused.length > 0) {
    lines.push(
      `⚠ ${String(report.wronglyRefused.length)} grille(s) refusée(s) alors que l'oracle les note`,
      `  dans notre domaine (≤ ${String(MAX_KNOWN_DIFFICULTY)}). C'est un défaut de couverture :`,
      '',
    );
    for (const item of report.wronglyRefused.slice(0, 5)) {
      lines.push(`  ER=${item.oracleEr.toFixed(1)}  ${item.puzzle}`);
    }
    lines.push('');
  }

  if (report.divergences.length > 0) {
    lines.push('── Divergences, de la plus forte à la plus faible ──', '');
    for (const d of report.divergences.slice(0, 15)) {
      const sign = d.delta > 0 ? '+' : '';
      lines.push(
        `  nous ${d.entry.ours.score.toFixed(1)} [${d.entry.ours.label ?? '?'}]  ` +
          `oracle ${d.oracle.er.toFixed(1)} [${d.oracle.technique}]  ` +
          `écart ${sign}${d.delta.toFixed(1)}`,
      );
      lines.push(`    ${d.entry.puzzle}`);
    }
    if (report.divergences.length > 15) {
      lines.push(`  … et ${String(report.divergences.length - 15)} autres.`);
    }
    lines.push('');
  }

  lines.push('── Correspondance des noms de techniques ──', '');
  for (const pair of report.techniquePairs) {
    const status = pair.agreeing === pair.count ? '✓' : `${String(pair.agreeing)}/${String(pair.count)}`;
    lines.push(
      `  ${status.padEnd(8)} ${pair.ours.padEnd(28)} ↔ ${pair.theirs.padEnd(34)} (${String(pair.count)}×)`,
    );
  }

  lines.push('', `Version du barème : ${String(report.ratingVersion)}`, '');
  return lines.join('\n');
}
