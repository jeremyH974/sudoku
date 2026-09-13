import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  LEVELS,
  RATING_VERSION,
  encodeGrid,
  generateAtLevel,
  hasUniqueSolution,
  rate,
  tryDecodeGrid,
} from '@sudoku/engine';
import type { Level } from '@sudoku/engine';

/**
 * Générateur du corpus de défis quotidiens.
 *
 *   pnpm dailies [--days N] [--from AAAA-MM-JJ]
 *
 * ─── Pourquoi un corpus figé, et non une grille calculée depuis la date ─────
 *
 * La tentation est forte : `generateAtLevel({ level, seed: '2026-03-14' })`. La
 * signature l'accepte, le Worker la transmet, et cela ne coûterait pas un octet.
 * C'est pourtant faux deux fois.
 *
 * **1. La génération dépend de la notation.** `climb()` appelle `rate()` à
 * chaque échange et branche sur le score. Changer le barème change la grille.
 * Ce n'est pas théorique : `RATING_VERSION` est passé de 2 à 4 en deux
 * incréments. Le calendrier d'un joueur aurait continué d'afficher ses jours
 * résolus, mais pour d'autres grilles que celles qu'il avait résolues.
 *
 * **2. La génération dépend du temps réel.** `generateAtLevel` s'arrête sur un
 * budget en millisecondes. Le nombre d'échanges effectués dépend donc de la
 * vitesse de la machine. Deux joueurs, même date, même version : deux grilles
 * différentes. Un vieux téléphone n'aurait jamais le même défi qu'un portable
 * récent — et le mot « défi commun » perdrait tout son sens.
 *
 * Le corpus est donc produit **une fois**, vérifié, et versionné dans le dépôt.
 * Bénéfice qui n'était pas recherché : le défi du jour fonctionne **hors
 * ligne**, ce que presque aucun concurrent ne sait faire, puisque chez eux il
 * vient d'un serveur.
 *
 * ─── Incrémental, et par construction ───────────────────────────────────────
 *
 * La commande relit le corpus existant, ne génère que ce qui manque, et écrit
 * après chaque jour. Une interruption ne coûte rien, et étendre l'horizon d'un
 * an ne regénère pas l'année précédente — ce qui compte : un fichier qui change
 * à chaque version se retéléchargerait à chaque mise à jour de l'application.
 */

const repoRoot = resolve(import.meta.dirname, '../../..');
/** Livré avec l'application, et précaché par le service worker. */
const corpusPath = join(repoRoot, 'packages/app/public/daily/corpus.json');
/** Non livré : sert au seul test d'intégrité. */
const verificationPath = join(repoRoot, 'corpus/dailies-verification.json');

/** Format du corpus livré. */
export const DAILY_CORPUS_VERSION = 1;

interface Corpus {
  version: number;
  /** Ordre des niveaux dans chaque entrée de `days`. */
  levels: Level[];
  /**
   * Jour civil → une grille encodée par niveau, dans l'ordre de `levels`.
   *
   * `| undefined` est explicite : indexer par une clé absente rend `undefined`
   * à l'exécution, et c'est exactement le cas nominal ici — on cherche ce qui
   * manque encore.
   */
  days: Record<string, string[] | undefined>;
}

interface Verification {
  generatedAt: string;
  ratingVersion: number;
  /**
   * Jour civil → score attendu par niveau.
   *
   * `| undefined` comme pour `Corpus.days`, et pour la même raison : indexer par
   * une clé absente rend `undefined` à l'exécution, et sans cette mention le
   * linter réclamerait le retrait de la garde qui protège de ce cas.
   */
  scores: Record<string, number[] | undefined>;
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
 * Produit une grille du niveau demandé, ou renonce.
 *
 * Un corpus quotidien n'a pas le droit d'être approximatif : une grille dont le
 * niveau n'est pas exactement celui annoncé serait une difficulté non mesurée
 * présentée comme mesurée. On réessaie donc, et on laisse le trou plutôt que de
 * livrer un à-peu-près.
 */
function generateExact(level: Level, seed: string, attempts = 4): { code: string; score: number } | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = generateAtLevel({
      level,
      seed: `${seed}-${String(attempt)}`,
      timeBudgetMs: 15_000,
    });
    if (result === null || !result.exact) continue;

    // Ceinture et bretelles : on revérifie ce que le générateur affirme.
    if (!hasUniqueSolution(result.puzzle)) continue;
    const rating = rate(result.puzzle);
    if (rating.outcome !== 'solved' || rating.level !== level) continue;

    return { code: encodeGrid(result.puzzle), score: rating.score };
  }
  return null;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const levels = LEVELS.map((info) => info.id);

  const corpus = readJson<Corpus>(corpusPath, {
    version: DAILY_CORPUS_VERSION,
    levels,
    days: {},
  });
  const verification = readJson<Verification>(verificationPath, {
    generatedAt: '',
    ratingVersion: 0,
    scores: {},
  });

  corpus.version = DAILY_CORPUS_VERSION;
  corpus.levels = levels;

  const wanted: string[] = [];
  const start = atNoon(options.from);
  for (let i = 0; i < options.days; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
    wanted.push(dayKey(date));
  }

  /*
    Un créneau est « à refaire » s'il est absent **ou** si la grille qu'il porte
    n'a plus le niveau qu'il annonce.

    Ce second cas n'est pas théorique : un changement de barème déplace des
    grilles d'un palier. L'incrément 9 en a bougé une sur vingt-deux. Vérifier
    plutôt que se fier à la présence permet de ne refaire que ces créneaux-là et
    de laisser les autres intacts — un corpus qui se réécrirait en entier à
    chaque version se retéléchargerait en entier à chaque mise à jour.
  */
  const slotsToRedo = new Map<string, { wrong: number[]; measured: number[] }>();
  let refreshed = 0;
  for (const day of wanted) {
    const codes = corpus.days[day] ?? [];
    const wrong: number[] = [];
    const scores: number[] = [];
    levels.forEach((level, index) => {
      const code = codes.at(index);
      const grid = code === undefined || code === '' ? null : tryDecodeGrid(code);
      if (grid === null) {
        wrong.push(index);
        scores.push(0);
        return;
      }
      const rating = rate(grid);
      if (rating.outcome !== 'solved' || rating.level !== level) wrong.push(index);
      scores.push(rating.score);
    });

    /*
      Les étiquettes se rafraîchissent, les grilles ne bougent pas.

      Un changement de barème déplace des scores sans forcément changer de
      palier : la grille reste au bon créneau, seul le nombre attendu par le
      fichier de vérification est périmé. Le recalculer ici évite de régénérer
      une grille parfaitement valide — et c'est très exactement la règle que ce
      corpus s'est donnée.
    */
    if (wrong.length === 0 && codes.length === levels.length) {
      const previous = verification.scores[day];
      if (previous === undefined || previous.some((value, i) => value !== scores.at(i))) {
        verification.scores[day] = scores;
        refreshed++;
      }
    } else {
      /*
        Les scores **mesurés à l'instant** voyagent avec la liste des créneaux à
        refaire, et ce n'est pas une commodité.

        Jusqu'à l'incrément 18, la boucle de régénération repartait des scores
        du fichier et n'écrasait que ceux des créneaux régénérés. Un jour qui
        avait à la fois un créneau à refaire **et** un autre dont le score avait
        bougé sans changer de palier gardait donc une étiquette périmée — et il
        fallait une seconde exécution pour la rattraper. Deux jours sur 369
        étaient dans ce cas au passage de la version 5 à la 6.
      */
      slotsToRedo.set(day, { wrong, measured: scores });
    }
  }
  const missing = [...slotsToRedo.keys()];
  const slotCount = [...slotsToRedo.values()].reduce((n, entry) => n + entry.wrong.length, 0);
  console.log(
    `Corpus quotidien : ${String(Object.keys(corpus.days).length)} jours déjà présents, ` +
      `${String(missing.length)} jour(s) à retoucher, ${String(slotCount)} créneau(x) à produire, ` +
      `${String(refreshed)} jour(s) dont les scores attendus ont changé.`,
  );
  if (missing.length === 0) {
    if (refreshed > 0) {
      verification.generatedAt = new Date().toISOString();
      verification.ratingVersion = RATING_VERSION;
      writeJson(verificationPath, { ...verification, scores: sortRecord(verification.scores) });
      console.log(`Étiquettes rafraîchies : ${verificationPath}`);
    } else {
      console.log('Rien à faire.');
    }
    return;
  }

  const started = Date.now();
  let done = 0;
  let failures = 0;

  for (const day of missing) {
    const codes = [...(corpus.days[day] ?? [])];
    // Les scores fraîchement mesurés, jamais ceux du fichier : voir ci-dessus.
    const scores = [...(slotsToRedo.get(day)?.measured ?? [])];
    while (codes.length < levels.length) codes.push('');
    while (scores.length < levels.length) scores.push(0);

    for (const index of slotsToRedo.get(day)?.wrong ?? []) {
      const level = levels.at(index);
      if (level === undefined) continue;
      // La graine porte le rang de la retouche : sans cela, régénérer un créneau
      // redonnerait la grille qui vient d'être écartée.
      const produced = generateExact(level, `daily-${day}-${level}-v${String(RATING_VERSION)}`);
      if (produced === null) {
        failures++;
        console.log(`  ⚠ ${day} · ${level} : niveau non atteint, créneau laissé en l'état.`);
        continue;
      }
      codes[index] = produced.code;
      scores[index] = produced.score;
    }

    if (codes.every((code) => code !== '')) {
      corpus.days[day] = codes;
      verification.scores[day] = scores;
    }

    // Écriture après chaque jour : une interruption ne perd rien.
    done++;
    verification.generatedAt = new Date().toISOString();
    verification.ratingVersion = RATING_VERSION;
    writeJson(corpusPath, sortDays(corpus));
    writeJson(verificationPath, { ...verification, scores: sortRecord(verification.scores) });

    if (done % 10 === 0 || done === missing.length) {
      const elapsed = (Date.now() - started) / 1000;
      const rate_ = elapsed / done;
      const left = (missing.length - done) * rate_;
      console.log(
        `  ${String(done)}/${String(missing.length)} jours · ${elapsed.toFixed(0)} s écoulées · ` +
          `~${left.toFixed(0)} s restantes`,
      );
    }
  }

  const total = Object.keys(corpus.days).length;
  const last = Object.keys(corpus.days).sort().at(-1) ?? '—';
  console.log(
    `\n${String(total)} jours au corpus, jusqu'au ${last}.` +
      (failures > 0 ? ` ${String(failures)} niveau(x) non atteint(s).` : ''),
  );
  console.log(`Corpus livré     : ${corpusPath}`);
  console.log(`Vérification     : ${verificationPath}`);
}

/** Trié par jour : un diff lisible vaut mieux qu'un fichier dans l'ordre d'écriture. */
function sortDays(corpus: Corpus): Corpus {
  return { ...corpus, days: sortRecord(corpus.days) };
}

function sortRecord<T>(value: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(value).sort()) out[key] = value[key];
  return out;
}

main();
