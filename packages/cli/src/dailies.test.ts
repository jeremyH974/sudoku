import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVELS, RATING_VERSION, decodeGrid, hasUniqueSolution, rate } from '@sudoku/engine';
import type { Level } from '@sudoku/engine';

/**
 * Intégrité du corpus des défis quotidiens.
 *
 * ─── Pourquoi ce test compte plus qu'il n'y paraît ──────────────────────────
 *
 * Le corpus est figé dans le dépôt et ne sera plus jamais regénéré pour les
 * jours déjà couverts — c'est tout l'intérêt : un défi d'il y a six mois doit
 * s'ouvrir aujourd'hui. Mais le **barème**, lui, évolue : `RATING_VERSION` est
 * déjà passé de 1 à 4.
 *
 * Le jour où il changera encore, le niveau annoncé de certains jours pourrait ne
 * plus correspondre à ce que le moteur mesure. L'application afficherait alors
 * une difficulté qui n'est pas celle qu'elle a mesurée — la faute la plus grave
 * possible dans ce projet. Ce test échouera d'abord.
 *
 * La réparation, le cas échéant, est de rafraîchir le **fichier de
 * vérification**, jamais les grilles.
 */

const repoRoot = join(import.meta.dirname, '../../..');
const corpusPath = join(repoRoot, 'packages/app/public/daily/corpus.json');
const verificationPath = join(repoRoot, 'corpus/dailies-verification.json');

interface Corpus {
  readonly version: number;
  readonly levels: readonly Level[];
  readonly days: Readonly<Record<string, readonly string[]>>;
}

interface Verification {
  readonly ratingVersion: number;
  readonly scores: Readonly<Record<string, readonly number[]>>;
}

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as Corpus;
const verification = JSON.parse(readFileSync(verificationPath, 'utf8')) as Verification;
const days = Object.keys(corpus.days).sort();

/**
 * Combien de jours doivent rester devant nous avant qu'on s'en inquiète.
 *
 * Un corpus qui s'épuise est une échéance connue d'avance ; il n'y a aucune
 * raison de la découvrir le jour où l'application n'a plus de défi à proposer.
 * Ce seuil laisse deux mois pour lancer `pnpm dailies`, ce qui prend trois
 * minutes.
 */
const MINIMUM_RUNWAY_DAYS = 60;

describe('corpus des défis quotidiens', () => {
  it('couvre une période continue, sans trou', () => {
    expect(days.length).toBeGreaterThan(100);
    for (let i = 1; i < days.length; i++) {
      const previous = new Date(`${days[i - 1]}T12:00:00`);
      const expected = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1, 12);
      const key = `${String(expected.getFullYear())}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
      expect(days[i], `trou après ${days[i - 1]}`).toBe(key);
    }
  });

  it('propose les six niveaux chaque jour', () => {
    expect(corpus.levels).toEqual(LEVELS.map((info) => info.id));
    for (const day of days) {
      expect(corpus.days[day], day).toHaveLength(LEVELS.length);
    }
  });

  it(
    'ne contient que des grilles résolubles au niveau annoncé',
    () => {
      /*
        Chaque grille est décodée puis **renotée**. Deux propriétés en découlent
        d'un coup : la grille se décode sans perte, et le niveau que
        l'application affichera est bien celui que le corpus promettait.

        Qu'une grille soit résolue par le seul raisonnement prouve aussi
        l'unicité de sa solution : chaque étape est forcée, donc aucun autre
        remplissage n'est possible.
      */
      const problems: string[] = [];
      for (const day of days) {
        const codes = corpus.days[day];
        const expected = verification.scores[day];
        corpus.levels.forEach((level, index) => {
          const rating = rate(decodeGrid(codes[index]));
          if (rating.outcome !== 'solved') {
            problems.push(`${day} · ${level} : ${rating.outcome}`);
            return;
          }
          if (rating.level !== level) {
            problems.push(`${day} · ${level} : mesuré ${String(rating.level)}`);
          }
          if (expected !== undefined && Math.abs(rating.score - expected[index]) > 0.001) {
            problems.push(
              `${day} · ${level} : score ${String(rating.score)} au lieu de ${String(expected[index])}`,
            );
          }
        });
      }
      expect(problems, problems.slice(0, 5).join('\n')).toHaveLength(0);
    },
    60_000,
  );

  it('a été vérifié sous le barème en vigueur', () => {
    // Si ce test tombe, ce sont les étiquettes qu'il faut rafraîchir — jamais
    // les grilles, sous peine de réécrire le passé des joueurs.
    expect(verification.ratingVersion).toBe(RATING_VERSION);
  });

  it('tient l’unicité de la solution sur un échantillon, ceinture et bretelles', () => {
    // Une par semaine environ : la propriété est déjà impliquée par le test
    // ci-dessus, ce contrôle-ci ne fait que la vérifier par un autre chemin.
    for (let i = 0; i < days.length; i += 7) {
      const codes = corpus.days[days[i]];
      for (const code of codes) {
        expect(hasUniqueSolution(decodeGrid(code)), days[i]).toBe(true);
      }
    }
  }, 60_000);

  it('garde assez de jours devant lui', () => {
    const last = days[days.length - 1];
    const today = new Date();
    const remaining = Math.round(
      (new Date(`${last}T12:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime()) /
        86_400_000,
    );
    expect(
      remaining,
      `Le corpus s'arrête le ${last}, dans ${String(remaining)} jours. ` +
        `Relancez « pnpm dailies » pour l'étendre.`,
    ).toBeGreaterThan(MINIMUM_RUNWAY_DAYS);
  });
});
