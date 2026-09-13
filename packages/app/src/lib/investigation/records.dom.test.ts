import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendRecord,
  byHardest,
  clearRecords,
  dailyStreak,
  fastest,
  loadRecords,
  longestDailyStreak,
} from './records.js';
import type { CaseRecord } from './records.js';
import { MIN_SAMPLE_FOR_MEDIAN } from '../progress.js';

/**
 * L'historique des enquêtes, vérifié sur ses **refus** autant que sur ses
 * comptes.
 *
 * Ce que ce panneau affiche engage la même promesse que le reste du projet :
 * rien qui ait l'air mesuré sans l'être. Les contrôles ci-dessous portent donc
 * d'abord sur ce qu'il ne dit pas — pas de médiane sous cinq parties, pas de
 * durée quand le chronomètre a douté, pas de compteur rangé.
 */

const record = (over: Partial<CaseRecord> = {}): CaseRecord => ({
  code: 'AAAA',
  finishedAt: 1,
  day: '2026-09-13',
  daily: null,
  durationMs: 60_000,
  hintsShown: 0,
  hardest: 'crossing',
  stepCount: 20,
  registryVersion: 1,
  ...over,
});

beforeEach(() => {
  clearRecords();
});

describe('l’historique des enquêtes', () => {
  it('garde une partie, et refuse de la compter deux fois', () => {
    expect(appendRecord(record({ code: 'A1' }))).toBe(true);
    // Rouvrir le même dossier le même jour ne fait pas une seconde enquête.
    expect(appendRecord(record({ code: 'A1' }))).toBe(false);
    expect(loadRecords()).toHaveLength(1);

    // La même affaire un autre jour, en revanche, compte.
    expect(appendRecord(record({ code: 'A1', day: '2026-09-14' }))).toBe(true);
    expect(loadRecords()).toHaveLength(2);
  });

  it('écarte une entrée illisible sans perdre les autres', () => {
    /*
      Doctrine reprise de `stats.ts`, et volontairement différente de celle de la
      sauvegarde de partie : perdre une partie sur deux cents vaut mieux que
      perdre les deux cents. Un état de jeu à moitié relu donnerait un plateau
      faux ; un historique amputé reste juste sur ce qu'il porte.
    */
    appendRecord(record({ code: 'A1' }));
    appendRecord(record({ code: 'A2', day: '2026-09-14' }));

    const raw = JSON.parse(localStorage.getItem('enquete.stats') ?? '{}') as {
      version: number;
      records: unknown[];
    };
    raw.records.push({ code: 42, pas: 'une partie' });
    localStorage.setItem('enquete.stats', JSON.stringify(raw));

    expect(loadRecords()).toHaveLength(2);
  });

  it('jette un historique d’une autre version', () => {
    appendRecord(record());
    const raw = JSON.parse(localStorage.getItem('enquete.stats') ?? '{}') as Record<string, unknown>;
    localStorage.setItem('enquete.stats', JSON.stringify({ ...raw, version: 999 }));
    expect(loadRecords()).toEqual([]);
  });

  it('ne compte la série que sur les affaires du jour, et la recalcule', () => {
    // Une affaire libre ne fait pas un jour de série : c'est l'assiduité au
    // corpus qui est mesurée, pas le fait d'avoir joué.
    const days = ['2026-09-11', '2026-09-12', '2026-09-13'];
    days.forEach((day, index) =>
      appendRecord(record({ code: `D${String(index)}`, day, daily: day })),
    );
    appendRecord(record({ code: 'libre', day: '2026-09-10', daily: null }));

    const records = loadRecords();
    expect(dailyStreak(records, '2026-09-13')).toBe(3);
    expect(longestDailyStreak(records)).toBe(3);
    // Le jour libre n'allonge pas la série, alors qu'il la précède directement.
    expect(dailyStreak(records, '2026-09-10')).toBe(0);
  });

  it('tient la série quand le jour n’est pas encore fait', () => {
    // Sans quoi elle afficherait zéro chaque matin, ce qui serait à la fois faux
    // et décourageant. C'est la règle du sudoku, et le code est le sien.
    appendRecord(record({ code: 'D', day: '2026-09-12', daily: '2026-09-12' }));
    expect(dailyStreak(loadRecords(), '2026-09-13')).toBe(1);
  });

  it('ne donne une médiane qu’à partir de cinq parties comparables', () => {
    /*
      Le seuil est celui du sudoku, et le groupement est la seule chose qui
      change : faute de niveau calibré, on groupe par la **technique la plus
      dure**, qui est un fait mesuré. Agréger toutes les affaires donnerait un
      nombre qui a l'air mesuré sans l'être.
    */
    for (let index = 0; index < MIN_SAMPLE_FOR_MEDIAN - 1; index++) {
      appendRecord(record({ code: `C${String(index)}`, hardest: 'crossing', durationMs: 60_000 }));
    }
    let tallies = byHardest(loadRecords());
    expect(tallies).toHaveLength(1);
    expect(tallies[0].count).toBe(MIN_SAMPLE_FOR_MEDIAN - 1);
    expect(tallies[0].medianMs, 'une médiane sous le seuil').toBeNull();

    appendRecord(record({ code: 'C-dernier', hardest: 'crossing', durationMs: 120_000 }));
    tallies = byHardest(loadRecords());
    expect(tallies[0].medianMs).not.toBeNull();
    expect(tallies[0].timed).toBe(MIN_SAMPLE_FOR_MEDIAN);
  });

  it('ne compte dans une médiane que les parties réellement chronométrées', () => {
    // Une durée non mesurable est `null`, jamais approximée : le chronomètre
    // rend `null` dès qu'il doute, et ce `null` ne doit pas peser zéro dans une
    // moyenne — il ne doit pas peser du tout.
    for (let index = 0; index < 6; index++) {
      appendRecord(
        record({ code: `S${String(index)}`, hardest: 'subset', durationMs: index < 2 ? null : 60_000 }),
      );
    }
    const [tally] = byHardest(loadRecords());
    expect(tally.count).toBe(6);
    expect(tally.timed).toBe(4);
    expect(tally.medianMs, 'quatre durées ne portent pas une médiane').toBeNull();
  });

  it('dit un record dès la première partie', () => {
    // Un record est un fait observé, pas une tendance : le seuil des cinq
    // parties ne le concerne pas.
    expect(fastest([])).toBeNull();
    appendRecord(record({ code: 'R1', durationMs: 90_000 }));
    appendRecord(record({ code: 'R2', day: '2026-09-14', durationMs: 45_000 }));
    appendRecord(record({ code: 'R3', day: '2026-09-15', durationMs: null }));
    expect(fastest(loadRecords())?.durationMs).toBe(45_000);
  });

  it('classe les déductions de la plus fréquente à la plus rare', () => {
    appendRecord(record({ code: 'X1', hardest: 'crossing' }));
    appendRecord(record({ code: 'X2', day: '2026-09-14', hardest: 'crossing' }));
    appendRecord(record({ code: 'X3', day: '2026-09-15', hardest: 'subset' }));
    const tallies = byHardest(loadRecords());
    expect(tallies.map((tally) => tally.technique)).toEqual(['crossing', 'subset']);
  });
});
