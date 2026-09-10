import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RATING_VERSION,
  TECHNIQUE_CATALOGUE,
  encodeGrid,
  generateForTechnique,
  hasUniqueSolution,
  rate,
} from '@sudoku/engine';
import type { TechniqueId } from '@sudoku/engine';

/**
 * Générateur du corpus des leçons.
 *
 *   pnpm lessons [--technique ID] [--grids N] [--budget MS]
 *
 * ─── Un corpus figé, pour les mêmes raisons que le défi quotidien ───────────
 *
 * `generateForTechnique` dépend du barème **et** de la vitesse de la machine :
 * elle branche sur `rate()` et s'arrête sur un budget en millisecondes. Deux
 * joueurs n'obtiendraient donc pas la même grille, et un changement de barème
 * réécrirait toutes les leçons. Le corpus est produit une fois, vérifié, et
 * versionné — exactement comme `dailies.ts`, et pour le même raisonnement.
 *
 * Ce qu'il porte : **la grille encodée, rien d'autre**. Ni le score, ni la
 * position de l'exercice. L'application rejoue le chemin localement et s'arrête
 * à la première étape qui emploie la technique ; si le barème évolue au point
 * que la technique disparaît du chemin, elle le dit au lieu d'afficher une
 * amorce fausse. Un index d'étape figé, lui, pointerait en silence sur autre
 * chose.
 *
 * ─── Ce qu'on refuse de fabriquer ───────────────────────────────────────────
 *
 * On pourrait produire un exercice pour n'importe quelle technique en appelant
 * son `findAll` sur une position quelconque : le motif existe, il est sain, les
 * tests du moteur le prouvent. Mais si une technique moins chère s'applique au
 * même endroit, la leçon enseignerait « ici il faut un quadruplet nu » alors
 * qu'il n'en faut pas. C'est précisément le mensonge que ce projet existe pour
 * éviter. Une technique sans grille reçoit donc un tableau vide, et l'interface
 * l'explique.
 */

const repoRoot = resolve(import.meta.dirname, '../../..');
/** Livré avec l'application, et précaché par le service worker. */
const corpusPath = join(repoRoot, 'packages/app/public/learn/corpus.json');
/** Non livré : sert au seul test d'intégrité. */
const verificationPath = join(repoRoot, 'corpus/lessons-verification.json');

export const LESSON_CORPUS_VERSION = 1;

interface Corpus {
  version: number;
  /** Technique → grilles encodées. Un tableau vide est une réponse, pas un trou. */
  grids: Record<string, string[] | undefined>;
}

interface Verification {
  generatedAt: string;
  ratingVersion: number;
  grids: Record<string, { score: number; clues: number; stepIndex: number }[]>;
}

/**
 * Plancher d'indices pour le bas de l'échelle.
 *
 * Une grille dont la technique la plus dure est « Dernière case » est presque
 * pleine : le creusement par défaut n'en produit jamais. Mesuré — à 70 indices,
 * 52 sur 60 ; à 55, le single caché en boîte 60 fois sur 60.
 */
const CLUE_FLOOR: Partial<Record<TechniqueId, number>> = {
  'full-house': 70,
  'hidden-single-box': 55,
  'hidden-single-line': 45,
};

/**
 * Pas de symétrie pour les leçons, et c'est mesuré.
 *
 * La rotation de 180° est un choix esthétique, qui contraint fortement le
 * creusement. Libérée, la marche locale atteint des techniques qu'elle
 * n'atteignait pas : le triplet nu passe d'un échec en 45 s à une réussite en
 * 3,5 s. Une grille d'exercice se regarde moins qu'une grille imprimée.
 */
const LESSON_SYMMETRY = 'none' as const;

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`, 'utf8');
}

function parseArgs(argv: readonly string[]): {
  technique: string | null;
  grids: number;
  budgetMs: number;
} {
  const get = (name: string, fallback: string): string => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
  };
  return {
    technique: argv.includes('--technique') ? get('technique', '') : null,
    grids: Number.parseInt(get('grids', '3'), 10),
    budgetMs: Number.parseInt(get('budget', '120000'), 10),
  };
}

interface Produced {
  code: string;
  score: number;
  clues: number;
  stepIndex: number;
}

/**
 * Produit une grille pour une technique, ou renonce.
 *
 * Chaque tentative repart d'une graine différente : la variance est forte sur
 * les techniques rares — le Swordfish sort en 26 s avec une graine et échoue en
 * 45 s avec la suivante. Un générateur qu'on lance une fois peut se permettre
 * d'insister ; l'application, non, et c'est pourquoi elle lit un corpus.
 */
function produce(technique: TechniqueId, seed: string, budgetMs: number): Produced | null {
  const floor = CLUE_FLOOR[technique];
  const result = generateForTechnique({
    technique,
    seed,
    symmetry: LESSON_SYMMETRY,
    maxAttempts: 400,
    maxSwaps: 900,
    timeBudgetMs: budgetMs,
    ...(floor === undefined ? {} : { minClues: floor }),
  });
  if (result === null) return null;

  // Ceinture et bretelles : on revérifie ce que le générateur affirme.
  if (!hasUniqueSolution(result.puzzle)) return null;
  const rating = rate(result.puzzle);
  if (rating.outcome !== 'solved' || rating.hardestTechnique !== technique) return null;

  // L'exercice amorcé démarre là. On ne l'écrit pas dans le corpus livré : il se
  // retrouve localement, ce qui le rend insensible à une évolution du barème.
  const stepIndex = rating.steps.findIndex((step) => step.technique === technique);
  if (stepIndex < 0) return null;

  return { code: encodeGrid(result.puzzle), score: rating.score, clues: result.clues, stepIndex };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const wanted = TECHNIQUE_CATALOGUE.filter(
    (info) => options.technique === null || info.id === options.technique,
  );
  if (wanted.length === 0) {
    console.log(`Technique inconnue : ${String(options.technique)}`);
    process.exitCode = 1;
    return;
  }

  const corpus = readJson<Corpus>(corpusPath, { version: LESSON_CORPUS_VERSION, grids: {} });
  const verification = readJson<Verification>(verificationPath, {
    generatedAt: '',
    ratingVersion: 0,
    grids: {},
  });
  corpus.version = LESSON_CORPUS_VERSION;

  console.log(
    `Corpus des leçons : ${String(wanted.length)} technique(s), ` +
      `${String(options.grids)} grille(s) chacune, ${String(options.budgetMs / 1000)} s par grille.`,
  );

  const started = Date.now();
  for (const info of wanted) {
    const existing = corpus.grids[info.id] ?? [];
    if (existing.length >= options.grids) {
      console.log(`  ${info.id.padEnd(21)} déjà complet (${String(existing.length)}).`);
      continue;
    }

    const codes = [...existing];
    const checks = [...(verification.grids[info.id] ?? [])];
    const at = Date.now();

    for (let n = codes.length; n < options.grids; n++) {
      const produced = produce(info.id, `lesson-${info.id}-${String(n)}`, options.budgetMs);
      if (produced === null) break;
      codes.push(produced.code);
      checks.push({
        score: produced.score,
        clues: produced.clues,
        stepIndex: produced.stepIndex,
      });
    }

    corpus.grids[info.id] = codes;
    verification.grids[info.id] = checks;
    verification.generatedAt = new Date().toISOString();
    verification.ratingVersion = RATING_VERSION;

    // Écriture après chaque technique : une interruption ne perd rien.
    writeJson(corpusPath, { ...corpus, grids: sortRecord(corpus.grids) });
    writeJson(verificationPath, { ...verification, grids: sortRecord(verification.grids) });

    const mark = codes.length >= options.grids ? '✓' : codes.length > 0 ? '~' : '✗';
    console.log(
      `  ${mark} ${info.id.padEnd(21)} ${info.difficulty.toFixed(1)}  ` +
        `${String(codes.length)}/${String(options.grids)}  ${((Date.now() - at) / 1000).toFixed(0)} s`,
    );
  }

  const empty = TECHNIQUE_CATALOGUE.filter((info) => (corpus.grids[info.id] ?? []).length === 0);
  console.log(
    `\nTerminé en ${((Date.now() - started) / 60_000).toFixed(1)} min.` +
      (empty.length > 0
        ? ` Sans exercice : ${empty.map((info) => info.id).join(', ')}.`
        : ' Toutes les techniques ont un exercice.'),
  );
  console.log(`Corpus livré : ${corpusPath}`);
  console.log(`Vérification : ${verificationPath}`);
}

function sortRecord<T>(value: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(value).sort()) out[key] = value[key];
  return out;
}

/*
  Ne s'exécute que lancé en ligne de commande.

  Le test d'intégrité importe `LESSON_CORPUS_VERSION` d'ici : sans cette garde,
  un simple `pnpm test` déclencherait la génération du corpus — plusieurs minutes,
  et une écriture dans le dépôt. La version doit rester importable pour que le
  test la compare vraiment, plutôt que d'en recopier la valeur.
*/
// `.at()` plutôt que `[1]` : Node lancé sans script n'a pas d'`argv[1]`, ce que
// l'indexation ne dit pas ici (`noUncheckedIndexedAccess` désactivé).
const entryPoint = process.argv.at(1);
if (entryPoint !== undefined && resolve(entryPoint) === fileURLToPath(import.meta.url)) main();
