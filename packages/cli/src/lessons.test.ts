import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RATING_VERSION,
  TECHNIQUE_CATALOGUE,
  hasUniqueSolution,
  rate,
  replayPath,
  tryDecodeGrid,
} from '@sudoku/engine';
import { LESSON_CORPUS_VERSION } from './lessons.js';

/**
 * Intégrité du corpus des leçons, rejouée **sans Java** et sans rien générer.
 *
 * Chaque grille livrée est redécodée et renotée : solution unique, résolue par le
 * seul raisonnement, et technique la plus difficile conforme à la leçon qu'elle
 * illustre. Un changement de barème ou de registre fait tomber ce test — c'est
 * **voulu**. On rafraîchit alors le fichier de vérification, jamais les grilles :
 * un exercice figé doit rester le même exercice.
 */

const repoRoot = resolve(import.meta.dirname, '../../..');
const corpusPath = join(repoRoot, 'packages/app/public/learn/corpus.json');
const verificationPath = join(repoRoot, 'corpus/lessons-verification.json');

interface Corpus {
  version: number;
  grids: Record<string, string[] | undefined>;
}
interface Verification {
  ratingVersion: number;
  grids: Record<string, { score: number; clues: number; stepIndex: number }[] | undefined>;
}

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as Corpus;
const verification = JSON.parse(readFileSync(verificationPath, 'utf8')) as Verification;

describe('corpus des leçons', () => {
  it('porte la version attendue', () => {
    expect(corpus.version).toBe(LESSON_CORPUS_VERSION);
    expect(verification.ratingVersion).toBe(RATING_VERSION);
  });

  it('déclare une entrée pour chaque technique du catalogue', () => {
    // Une entrée vide est une réponse — « aucune grille n'a pu être produite » —
    // et l'interface l'explique. Une clé absente serait un trou.
    for (const info of TECHNIQUE_CATALOGUE) {
      expect(corpus.grids[info.id], info.id).toBeDefined();
    }
    expect(Object.keys(corpus.grids)).toHaveLength(TECHNIQUE_CATALOGUE.length);
  });

  it('n’a qu’une seule technique sans exercice, et l’oracle est d’accord', () => {
    /*
      Cette liste est une **mesure**, pas une intention.

      À l'incrément 8, les vingt-quatre avaient un exercice — après que deux
      sondes préparatoires eurent conclu à tort que le quadruplet nu était hors
      d'atteinte. L'incrément 9 a resserré les variantes « Direct » et la paire
      revendiquée directe est devenue introuvable : 4 000 tentatives, les deux
      symétries, trois minutes chacune, rien.

      Ce n'est pas une perte, c'est un **accord**. Sur les 335 grilles du corpus
      d'oracle, Sudoku Explainer ne rapporte lui non plus **aucune** « Direct
      Claiming » — là où il rapporte quatre « Direct Pointing » et trente
      « Direct Hidden Pair ». Ne pas savoir en fabriquer, c'est se comporter
      comme la référence.

      Si une évolution du registre en rendait une autre inatteignable, ce test le
      dirait au lieu de laisser l'interface perdre une leçon en silence.

      Le quadruplet caché (5,4) a rejoint cette liste à l'incrément 18, et pour la
      même raison retournée : en corrigeant la détection des sous-ensembles nus,
      le registre est devenu **plus complet**, donc les techniques les plus
      chères sont moins souvent *nécessaires*. Deux campagnes — 109 s puis
      114 s — n'en ont produit aucune où il soit le pic. L'accord vaut là aussi :
      sur les 441 grilles de la référence, l'oracle ne rapporte **aucun** « Hidden
      Quad » non plus.
    */
    const empty = TECHNIQUE_CATALOGUE.filter((info) => (corpus.grids[info.id] ?? []).length === 0);
    expect(empty.map((info) => info.id)).toEqual(['direct-claiming', 'hidden-quad']);
  });

  it('livre des grilles décodables, à solution unique, résolues sans deviner', () => {
    for (const info of TECHNIQUE_CATALOGUE) {
      for (const code of corpus.grids[info.id] ?? []) {
        const grid = tryDecodeGrid(code);
        expect(grid, `${info.id} · ${code}`).not.toBeNull();
        expect(hasUniqueSolution(grid!), `${info.id} · ${code}`).toBe(true);
        expect(rate(grid!).outcome, `${info.id} · ${code}`).toBe('solved');
      }
    }
  }, 60_000);

  it('exige bien la technique qu’elle illustre, et pas une autre', () => {
    for (const info of TECHNIQUE_CATALOGUE) {
      for (const code of corpus.grids[info.id] ?? []) {
        const rating = rate(tryDecodeGrid(code)!);
        expect(rating.hardestTechnique, `${info.id} · ${code}`).toBe(info.id);
        expect(rating.score, `${info.id} · ${code}`).toBe(info.difficulty);
      }
    }
  }, 60_000);

  it('permet de fabriquer une amorce pour chaque grille', () => {
    /*
      La condition d'existence de l'exercice : le chemin doit contenir la
      technique, et l'image qui la précède doit être une position cohérente. Sans
      elle, la leçon s'ouvrirait sur la grille entière — utile, mais ce n'est plus
      l'exercice amorcé.
    */
    for (const info of TECHNIQUE_CATALOGUE) {
      for (const code of corpus.grids[info.id] ?? []) {
        const grid = tryDecodeGrid(code)!;
        const rating = rate(grid);
        const index = rating.steps.findIndex((step) => step.technique === info.id);
        expect(index, `${info.id} · ${code}`).toBeGreaterThanOrEqual(0);

        const frame = replayPath(grid, rating.steps)[index];
        expect(frame, `${info.id} · ${code}`).toBeDefined();
        // Une amorce doit laisser du travail : une position déjà complète n'est
        // pas un exercice.
        expect([...frame!.values].filter((value) => value === 0).length).toBeGreaterThan(0);
      }
    }
  }, 60_000);

  it('correspond au fichier de vérification', () => {
    for (const info of TECHNIQUE_CATALOGUE) {
      const codes = corpus.grids[info.id] ?? [];
      const checks = verification.grids[info.id] ?? [];
      expect(checks, info.id).toHaveLength(codes.length);

      codes.forEach((code, i) => {
        const rating = rate(tryDecodeGrid(code)!);
        expect(rating.score, `${info.id} · ${String(i)}`).toBe(checks[i]!.score);
        const index = rating.steps.findIndex((step) => step.technique === info.id);
        expect(index, `${info.id} · ${String(i)}`).toBe(checks[i]!.stepIndex);
      });
    }
  }, 60_000);

  it('reste léger : il voyage avec l’application', () => {
    const bytes = readFileSync(corpusPath).byteLength;
    // Mesuré à 3,2 Ko bruts pour 72 grilles, soit 2,1 Ko compressés — face aux
    // 43 Ko du corpus quotidien, c'est du bruit. La borne laisse de la place à
    // une quatrième grille par technique sans devenir permissive.
    expect(bytes).toBeLessThan(8_000);
  });
});
