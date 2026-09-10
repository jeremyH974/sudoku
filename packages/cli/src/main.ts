import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RATING_VERSION } from '@sudoku/engine';
import { buildCorpus } from './corpus.js';
import { compare, formatReport } from './compare.js';
import { rateWithOracle } from './oracle/serate.js';
import { OracleMissingError } from './oracle/setup.js';

/**
 * Outil de calibration.
 *
 *   pnpm calibrate [--random N] [--per-level N] [--seed S]
 *
 * Génère un corpus, le fait noter par l'oracle Sudoku Explainer, compare les
 * deux notations et écrit un rapport. Tout est reproductible depuis la graine.
 */

const repoRoot = resolve(import.meta.dirname, '../../..');
const corpusDir = join(repoRoot, 'corpus');
const generatedDir = join(corpusDir, 'generated');

interface Options {
  readonly randomCount: number;
  readonly perLevel: number;
  readonly seed: string;
}

function parseArgs(argv: readonly string[]): Options {
  const get = (name: string, fallback: string): string => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
  };
  return {
    randomCount: Number.parseInt(get('random', '400'), 10),
    perLevel: Number.parseInt(get('per-level', '12'), 10),
    seed: get('seed', 'calibration-1'),
  };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  console.log(
    `Corpus : ${String(options.randomCount)} grilles au hasard + ` +
      `${String(options.perLevel)} par niveau, graine « ${options.seed} ».`,
  );

  let lastLabel = '';
  const entries = buildCorpus({
    ...options,
    onProgress: (done, total, label) => {
      if (label !== lastLabel) {
        lastLabel = label;
        console.log(`  ${label}… (${String(done)}/${String(total)})`);
      }
    },
  });

  const solvable = entries.filter((e) => e.ours.outcome === 'solved');
  const refused = entries.length - solvable.length;
  console.log(
    `\n${String(entries.length)} grilles produites, dont ${String(refused)} que nous ne savons pas résoudre.`,
  );

  /*
    Deux lots séparés, et non un seul.

    Les grilles hors de notre portée coûtent des minutes pièce à l'oracle : deux
    minutes pour une seule grille extrême lors du premier essai. Or `serate`
    traite son fichier séquentiellement — une poignée de ces grilles au milieu du
    lot bloquerait tout le rapport derrière elles.

    On note donc d'abord les grilles que nous résolvons, qui portent le critère
    d'accord exact, puis un simple échantillon des refusées avec un budget de
    temps borné. De ces dernières on n'a besoin que d'une chose : vérifier que
    l'oracle les note bien au-dessus de notre plafond.
  */
  mkdirSync(generatedDir, { recursive: true });

  console.log(`Notation par l'oracle de ${String(solvable.length)} grilles résolues…`);
  let started = Date.now();
  const solvableRatings = rateWithOracle(
    solvable.map((entry) => entry.puzzle),
    {
      inputPath: join(generatedDir, 'corpus.txt'),
      outputPath: join(generatedDir, 'corpus.rated.txt'),
    },
  );
  let elapsed = (Date.now() - started) / 1000;
  console.log(
    `  ${String(solvableRatings.length)} notes en ${elapsed.toFixed(1)} s ` +
      `(${(elapsed / Math.max(1, solvableRatings.length)).toFixed(2)} s/grille).`,
  );

  const refusedSample = entries.filter((e) => e.ours.outcome !== 'solved').slice(0, 5);
  let refusedRatings: ReturnType<typeof rateWithOracle> = [];
  if (refusedSample.length > 0) {
    console.log(`Notation d'un échantillon de ${String(refusedSample.length)} grilles refusées…`);
    started = Date.now();
    try {
      refusedRatings = rateWithOracle(
        refusedSample.map((entry) => entry.puzzle),
        {
          inputPath: join(generatedDir, 'refusees.txt'),
          outputPath: join(generatedDir, 'refusees.rated.txt'),
          timeoutMs: 10 * 60_000,
        },
      );
      elapsed = (Date.now() - started) / 1000;
      console.log(`  ${String(refusedRatings.length)} notes en ${elapsed.toFixed(1)} s.`);
    } catch {
      console.log("  Budget dépassé : l'échantillon des refusées est ignoré.");
    }
  }

  // Les index rendus par l'oracle repartent de 1 à chaque lot : on décale ceux
  // du second pour que l'appariement par position reste valable.
  const submitted = [...solvable, ...refusedSample];
  const oracleRatings = [
    ...solvableRatings,
    ...refusedRatings.map((r) => ({ ...r, index: r.index + solvable.length })),
  ];

  const report = compare(submitted, oracleRatings, RATING_VERSION);
  console.log(formatReport(report));

  const reportPath = join(corpusDir, 'calibration.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ratingVersion: report.ratingVersion,
        options,
        summary: {
          total: report.total,
          solvedByUs: report.solvedByUs,
          agreed: report.agreed,
          agreementRate: report.agreementRate,
          agreedBelowThreshold: report.agreedBelowThreshold,
          totalBelowThreshold: report.totalBelowThreshold,
          refused: report.refused.length,
          wronglyRefused: report.wronglyRefused.length,
        },
        techniquePairs: report.techniquePairs,
        divergences: report.divergences.map((d) => ({
          puzzle: d.entry.puzzle,
          seed: d.entry.seed,
          source: d.entry.source,
          ours: d.entry.ours,
          oracle: d.oracle,
          delta: d.delta,
        })),
        wronglyRefused: report.wronglyRefused,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`Rapport écrit dans ${reportPath}\n`);

  /*
    Le fichier de référence : ce qui transforme la calibration en invariant.

    Le rapport ci-dessus est daté ; il dit ce qui était vrai le jour où l'oracle
    a tourné. Ce second fichier fige ses verdicts grille par grille, ce qui
    permet à la CI de rejouer la comparaison **sans Java** et de casser au
    premier écart. La conformité cesse d'être une opération manuelle pour
    devenir une propriété tenue par les tests.
  */
  const reference = {
    oracle: 'SukakuExplainer v1.18.1, mode serate, --revisedRating=0',
    ratingVersion: report.ratingVersion,
    generatedAt: new Date().toISOString(),
    grids: submitted
      .map((entry, position) => {
        const oracle = oracleRatings.find((r) => r.index === position + 1);
        if (oracle === undefined) return null;
        return {
          puzzle: entry.puzzle,
          oracleEr: oracle.er,
          oracleTechnique: oracle.technique,
          ourScore: entry.ours.outcome === 'solved' ? entry.ours.score : null,
          ourOutcome: entry.ours.outcome,
        };
      })
      .filter((row) => row !== null),
  };
  const referencePath = join(corpusDir, 'oracle-reference.json');
  writeFileSync(referencePath, JSON.stringify(reference, null, 2) + '\n', 'utf8');
  console.log(`Référence écrite dans ${referencePath}\n`);
}

try {
  main();
} catch (error) {
  if (error instanceof OracleMissingError) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
