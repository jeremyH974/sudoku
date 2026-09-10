import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Localise l'outillage de calibration : une machine virtuelle Java et le binaire
 * de Sudoku Explainer.
 *
 * Les deux sont des dépendances de **développement uniquement**. Rien de tout
 * cela n'est embarqué dans l'application, ni exécuté chez un joueur : l'oracle
 * sert à vérifier notre notation, pas à la produire.
 *
 * Rappel du cadre : Sudoku Explainer est sous licence LGPL et n'est utilisé
 * qu'en **boîte noire** — on lance le binaire et on lit sa sortie. Son code
 * n'est ni lu, ni copié, ni lié.
 */

/** Taille exacte du JAR de la release v1.18.1, vérifiée au téléchargement. */
export const EXPECTED_JAR_SIZE = 636_042;

export const JAR_URL =
  'https://github.com/SudokuMonster/SukakuExplainer/releases/download/v1.18.1/SukakuExplainer.jar';

export interface OracleTools {
  readonly java: string;
  readonly jar: string;
}

export class OracleMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OracleMissingError';
  }
}

const repoRoot = (): string => resolve(import.meta.dirname, '../../../..');

/**
 * Cherche un exécutable Java.
 *
 * On ne se contente pas du `PATH` : sous Windows, une installation fraîche n'y
 * apparaît qu'après ouverture d'un nouveau terminal. Chercher aussi dans les
 * emplacements standards évite d'imposer un redémarrage de session pour une
 * dépendance qui vient d'être posée.
 */
export function findJava(): string | null {
  const fromEnv = process.env['JAVA_HOME'];
  const candidates: string[] = [];

  if (fromEnv !== undefined && fromEnv !== '') {
    candidates.push(join(fromEnv, 'bin', 'java.exe'), join(fromEnv, 'bin', 'java'));
  }

  for (const base of [
    'C:/Program Files/Eclipse Adoptium',
    'C:/Program Files/Java',
    'C:/Program Files/Microsoft',
  ]) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      candidates.push(join(base, entry, 'bin', 'java.exe'));
    }
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // En dernier ressort, le PATH : `java` tout court fonctionne s'il y est.
  try {
    execFileSync('java', ['-version'], { stdio: 'ignore' });
    return 'java';
  } catch {
    return null;
  }
}

/** Chemin attendu du JAR, jamais versionné (voir `.gitignore`). */
export function jarPath(): string {
  return join(repoRoot(), 'tools', 'sudoku-explainer', 'SukakuExplainer.jar');
}

/**
 * Vérifie que les deux outils sont en place, avec un message qui dit quoi faire
 * plutôt qu'un simple échec.
 */
export function requireOracle(): OracleTools {
  const java = findJava();
  if (java === null) {
    throw new OracleMissingError(
      'Java est introuvable. Installez-le avec :\n' +
        '  winget install --id EclipseAdoptium.Temurin.17.JRE\n' +
        "C'est une dépendance de développement : elle ne part jamais en production.",
    );
  }

  const jar = jarPath();
  if (!existsSync(jar)) {
    throw new OracleMissingError(
      `Le binaire de l'oracle est absent de ${jar}.\n` +
        `Téléchargez-le depuis :\n  ${JAR_URL}\n` +
        `Taille attendue : ${String(EXPECTED_JAR_SIZE)} octets.`,
    );
  }

  const size = statSync(jar).size;
  if (size !== EXPECTED_JAR_SIZE) {
    throw new OracleMissingError(
      `Le binaire de l'oracle fait ${String(size)} octets au lieu de ` +
        `${String(EXPECTED_JAR_SIZE)}. Retéléchargez-le depuis :\n  ${JAR_URL}`,
    );
  }

  return { java, jar };
}
