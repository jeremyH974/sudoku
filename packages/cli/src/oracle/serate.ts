import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { requireOracle } from './setup.js';

/**
 * Invocation de `serate`, le mode lot de Sudoku Explainer.
 *
 * Syntaxe reprise de la documentation du projet :
 *
 *   java -Xrs -Xmx500m -cp SukakuExplainer.jar diuf.sudoku.test.serate \
 *        --format=... --input=grilles.txt --output=notes.txt
 *
 * L'entrée est une grille par ligne, en 81 caractères avec un point pour les
 * cases vides — exactement ce que produit `formatGrid`. Aucune conversion.
 */

export interface OracleRating {
  /** Numéro d'ordre rendu par l'oracle, à partir de 1. */
  readonly index: number;
  /** Note globale : plus haute difficulté du chemin de résolution complet. */
  readonly er: number;
  /** Note « perle » : jusqu'au premier placement. */
  readonly pearl: number;
  /** Note « diamant » : jusqu'à la première élimination. */
  readonly diamond: number;
  /** Nom de la technique la plus difficile, tel que l'écrit l'oracle. */
  readonly technique: string;
}

/**
 * Séparateur de champs : la tabulation.
 *
 * Indispensable, et non cosmétique : les noms de techniques contiennent des
 * espaces et des parenthèses (« Dynamic Contradiction Forcing Chains
 * (+ Forcing Chains) »). Découper sur l'espace mutilerait le champ le plus utile
 * au diagnostic.
 */
const FORMAT = '%n%t%r%t%p%t%d%t%R';

export interface RateOptions {
  /** Plafond de temps global. Les grilles extrêmes coûtent des minutes pièce. */
  readonly timeoutMs?: number;
  /** Fichiers de travail conservés pour inspection. */
  readonly inputPath: string;
  readonly outputPath: string;
}

/** Analyse une ligne de sortie. `null` si la ligne n'est pas exploitable. */
export function parseLine(line: string): OracleRating | null {
  const parts = line.split('\t');
  if (parts.length < 5) return null;

  const index = Number.parseInt(parts[0], 10);
  const er = Number.parseFloat(parts[1]);
  const pearl = Number.parseFloat(parts[2]);
  const diamond = Number.parseFloat(parts[3]);
  const technique = parts.slice(4).join('\t').trim();

  if (!Number.isFinite(index) || !Number.isFinite(er)) return null;
  return { index, er, pearl, diamond, technique };
}

/**
 * Note un lot de grilles.
 *
 * L'appel est synchrone et bloquant : c'est un outil de calibration lancé à la
 * main, jamais une opération d'interface. Un lot unique amortit le démarrage de
 * la machine virtuelle Java sur l'ensemble des grilles.
 */
export function rateWithOracle(puzzles: readonly string[], options: RateOptions): OracleRating[] {
  const { java, jar } = requireOracle();

  mkdirSync(dirname(options.inputPath), { recursive: true });
  writeFileSync(options.inputPath, puzzles.join('\n') + '\n', 'utf8');

  execFileSync(
    java,
    [
      '-Xrs',
      '-Xmx500m',
      '-cp',
      jar,
      'diuf.sudoku.test.serate',
      // Barème classique, passé explicitement : un défaut n'est pas une garantie,
      // et le mode « revised » donne d'autres valeurs (single nu à 1,6 au lieu
      // de 2,3, paire cachée à 2,9 au lieu de 3,4...).
      '--revisedRating=0',
      `--format=${FORMAT}`,
      `--input=${options.inputPath}`,
      `--output=${options.outputPath}`,
    ],
    { timeout: options.timeoutMs ?? 30 * 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  return readFileSync(options.outputPath, 'utf8')
    .split(/\r?\n/)
    .map(parseLine)
    .filter((rating): rating is OracleRating => rating !== null);
}
