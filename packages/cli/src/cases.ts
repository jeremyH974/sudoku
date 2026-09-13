import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { composeCase, encodeCase, tryDecodeCase } from '@sudoku/engine/investigation';

/**
 * Générateur du corpus d'affaires quotidiennes.
 *
 *   pnpm cases [--days N] [--from AAAA-MM-JJ]
 *
 * ─── Pourquoi un corpus figé, exactement comme pour le sudoku ───────────────
 *
 * `composeCase('2026-03-14')` serait tentant, et serait faux. La fabrique boucle
 * sur des tentatives et branche sur `deduce` : un changement du registre de
 * déduction change l'affaire qu'une graine produit. Le calendrier d'un joueur
 * continuerait d'afficher ses jours résolus, mais pour d'autres affaires que
 * celles qu'il a résolues.
 *
 * Le corpus porte donc **le code de l'affaire**, jamais sa graine. C'est la
 * règle que `CLAUDE.md` énonce pour les grilles imprimées, et elle vaut mot pour
 * mot ici.
 *
 * ─── Ce que ce corpus ne promet pas ─────────────────────────────────────────
 *
 * Rien sur la difficulté. Le mode Enquête n'affiche aucun score et aucun niveau
 * — il n'y a pas d'oracle pour les calibrer —, donc il n'y a rien à figer à
 * côté d'une affaire. Le corpus quotidien du sudoku, lui, range les scores
 * attendus parce qu'un palier est **annoncé au joueur**.
 *
 * Conséquence heureuse : il n'y a pas de fichier d'attentes à rafraîchir, donc
 * pas de corpus qui se périme à chaque évolution du registre. Ce que le test
 * vérifie est intemporel : chaque code se relit, désigne exactement une
 * solution, et se déduit sans deviner.
 *
 * ─── Incrémental ────────────────────────────────────────────────────────────
 *
 * On relit l'existant et on ne compose que ce qui manque. Un fichier qui change
 * à chaque version se retéléchargerait à chaque mise à jour de l'application.
 */

const repoRoot = resolve(import.meta.dirname, '../../..');
/** Livré avec l'application, et précaché par le service worker. */
const corpusPath = join(repoRoot, 'packages/app/public/daily/cases.json');

/** Format du corpus livré. */
export const CASE_CORPUS_VERSION = 1;

interface Corpus {
  version: number;
  /**
   * Jour civil → le code de l'affaire.
   *
   * `| undefined` est explicite : indexer par une clef absente rend `undefined`
   * à l'exécution, et c'est le cas nominal ici — on cherche ce qui manque.
   */
  days: Record<string, string | undefined>;
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');
const dayKey = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Midi : la seule heure qui ne tombe jamais dans un changement d'heure. */
const atNoon = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

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

function parseArgs(argv: readonly string[]): { days: number; from: string } {
  const get = (name: string, fallback: string): string => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
  };
  return {
    days: Number.parseInt(get('days', '366'), 10),
    from: get('from', dayKey(new Date())),
  };
}

/**
 * Compose l'affaire d'un jour, ou renonce.
 *
 * On réessaie sous plusieurs graines : une graine qui ne donne rien est le cas
 * ordinaire de cette fabrique, qui cherche au lieu de tricher. Le code produit
 * est **relu** avant d'être gardé — ceinture et bretelles, parce qu'un jour
 * illisible ne se verrait qu'au moment où quelqu'un l'ouvrirait.
 */
function composeForDay(day: string, attempts = 8): string | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const file = composeCase(`affaire-du-jour-${day}-${String(attempt)}`);
    if (file === null) continue;
    const code = encodeCase(file);
    if (tryDecodeCase(code) === null) continue;
    return code;
  }
  return null;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const corpus = readJson<Corpus>(corpusPath, { version: CASE_CORPUS_VERSION, days: {} });
  corpus.version = CASE_CORPUS_VERSION;

  const wanted: string[] = [];
  const start = atNoon(options.from);
  for (let index = 0; index < options.days; index++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12);
    wanted.push(dayKey(date));
  }

  /*
    Un jour est à refaire s'il est absent **ou** si le code qu'il porte ne se
    relit plus. Le second cas est celui d'un décor retouché : le codec resterait
    valide, l'affaire ne le serait plus. On préfère le voir ici que chez un
    joueur.
  */
  const missing = wanted.filter((day) => {
    const code = corpus.days[day];
    return code === undefined || tryDecodeCase(code) === null;
  });

  console.log(
    `Affaires quotidiennes : ${String(Object.keys(corpus.days).length)} jour(s) déjà présents, ` +
      `${String(missing.length)} à composer.`,
  );

  const startedAt = Date.now();
  let failed = 0;
  missing.forEach((day, index) => {
    const code = composeForDay(day);
    if (code === null) {
      failed++;
      // On laisse le trou plutôt que de livrer une affaire qu'on n'a pas
      // vérifiée. L'application dira qu'il n'y a pas d'affaire ce jour-là.
      console.log(`  ${day} : aucune affaire composée, créneau laissé vide.`);
    } else {
      corpus.days[day] = code;
    }

    if ((index + 1) % 25 === 0 || index === missing.length - 1) {
      const elapsed = (Date.now() - startedAt) / 1000;
      console.log(
        `  ${String(index + 1)}/${String(missing.length)} jours · ${elapsed.toFixed(0)} s écoulées`,
      );
      writeJson(corpusPath, corpus);
    }
  });

  writeJson(corpusPath, corpus);
  const kept = Object.keys(corpus.days).length;
  console.log(
    `\n${String(kept)} jours au corpus${failed > 0 ? `, ${String(failed)} créneau(x) vide(s)` : ''}.`,
  );
  console.log(`Corpus livré : ${corpusPath}`);
}

// `.at()` plutôt que `[1]` : Node lancé sans script n'a pas d'`argv[1]`.
const entryPoint = process.argv.at(1);
if (entryPoint !== undefined && entryPoint.endsWith('cases.ts')) main();
