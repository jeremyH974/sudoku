import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { localDayKey, nextDay } from './day.js';
import {
  MIN_SAMPLE_FOR_MEDIAN,
  completedDays,
  currentStreak,
  longestStreak,
  median,
  summarise,
  totals,
} from './progress.js';
import type { GameRecord } from './stats.js';
import type { Level } from '@sudoku/engine';

function record(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'x',
    finishedAt: 1_700_000_000_000,
    day: '2026-09-10',
    daily: null,
    level: 'moyen',
    score: 2.3,
    ratingVersion: 4,
    durationMs: 300_000,
    hintsShown: 0,
    hintsApplied: 0,
    mistakes: 0,
    ...overrides,
  };
}

/** Une suite de quotidiens résolus, à partir d'un jour donné. */
function dailies(from: string, count: number): GameRecord[] {
  const out: GameRecord[] = [];
  let day = from;
  for (let i = 0; i < count; i++) {
    out.push(record({ id: `d-${day}`, day, daily: day }));
    day = nextDay(day);
  }
  return out;
}

describe('série en cours', () => {
  it('vaut zéro sans aucun quotidien', () => {
    expect(currentStreak([], '2026-09-10')).toBe(0);
    expect(currentStreak([record()], '2026-09-10')).toBe(0);
  });

  it('compte les jours consécutifs jusqu’à aujourd’hui', () => {
    const history = dailies('2026-09-08', 3);
    expect(currentStreak(history, '2026-09-10')).toBe(3);
  });

  it('ne tombe pas à zéro parce que le défi du jour n’est pas encore fait', () => {
    // Sinon la série afficherait zéro chaque matin : faux, et décourageant.
    const history = dailies('2026-09-07', 3);
    expect(currentStreak(history, '2026-09-10')).toBe(3);
  });

  it('s’interrompt sur un jour manqué', () => {
    const history = [...dailies('2026-09-01', 3), ...dailies('2026-09-08', 2)];
    expect(currentStreak(history, '2026-09-09')).toBe(2);
  });

  it('se reconstitue quand les jours manqués sont rattrapés plus tard', () => {
    // Le filet : la série mesure l'assiduité au corpus, pas la ponctualité.
    // Rattraper dimanche les jours de la semaine reforme la série.
    const rattrapage = dailies('2026-09-07', 4).map((r) => ({
      ...r,
      // Toutes ces parties ont été jouées le même jour, bien après coup.
      day: '2026-09-13',
      finishedAt: 1_800_000_000_000,
    }));
    expect(currentStreak(rattrapage, '2026-09-10')).toBe(4);
  });

  it('traverse un changement de mois et un passage à l’heure d’été', () => {
    expect(currentStreak(dailies('2026-02-26', 4), '2026-03-01')).toBe(4);
    expect(currentStreak(dailies('2026-03-27', 4), '2026-03-30')).toBe(4);
    expect(currentStreak(dailies('2026-10-23', 4), '2026-10-26')).toBe(4);
  });

  it('ne compte qu’une fois un jour résolu à plusieurs niveaux', () => {
    const history = [
      record({ id: 'a', daily: '2026-09-10', level: 'facile' }),
      record({ id: 'b', daily: '2026-09-10', level: 'expert' }),
    ];
    expect(currentStreak(history, '2026-09-10')).toBe(1);
    expect(completedDays(history).size).toBe(1);
  });
});

describe('plus longue série', () => {
  it('trouve la plus longue, pas la dernière', () => {
    const history = [...dailies('2026-01-01', 7), ...dailies('2026-03-01', 3)];
    expect(longestStreak(history)).toBe(7);
  });

  it('vaut zéro sans quotidien', () => {
    expect(longestStreak([])).toBe(0);
  });
});

describe('invariants des séries', () => {
  /**
   * Un tirage de jours quelconques : c'est là que se cachent les défauts qu'un
   * exemple choisi ne rencontre jamais — doublons, désordre, trous.
   */
  const historyArb = fc
    .array(fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1), noInvalidDate: true }), { maxLength: 60 })
    .map((dates) => dates.map((date) => record({ daily: localDayKey(date), id: localDayKey(date) })));

  it('la série en cours ne dépasse jamais la plus longue', () => {
    fc.assert(
      fc.property(historyArb, fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1), noInvalidDate: true }), (history, today) => {
        expect(currentStreak(history, localDayKey(today))).toBeLessThanOrEqual(longestStreak(history));
      }),
    );
  });

  it('ajouter un quotidien ne raccourcit jamais la plus longue série', () => {
    fc.assert(
      fc.property(historyArb, fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1), noInvalidDate: true }), (history, extra) => {
        const before = longestStreak(history);
        const after = longestStreak([...history, record({ daily: localDayKey(extra) })]);
        expect(after).toBeGreaterThanOrEqual(before);
      }),
    );
  });

  it('l’ordre des parties ne change rien', () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        const shuffled = [...history].reverse();
        expect(longestStreak(shuffled)).toBe(longestStreak(history));
      }),
    );
  });

  it('rejouer le même jour ne change rien', () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        expect(longestStreak([...history, ...history])).toBe(longestStreak(history));
      }),
    );
  });
});

describe('médiane', () => {
  it('reste muette tant que l’échantillon ne la porte pas', () => {
    for (let n = 0; n < MIN_SAMPLE_FOR_MEDIAN; n++) {
      expect(median(Array.from({ length: n }, (_, i) => i))).toBeNull();
    }
  });

  it('rend la valeur centrale sur un échantillon impair', () => {
    expect(median([10, 2, 8, 4, 6])).toBe(6);
  });

  it('moyenne les deux valeurs centrales sur un échantillon pair', () => {
    expect(median([2, 4, 6, 8, 10, 12])).toBe(7);
  });

  it('résiste à une partie aberrante, contrairement à une moyenne', () => {
    const normales = [300_000, 320_000, 280_000, 310_000, 290_000];
    const avecOubli = [...normales, 7_200_000];
    // La moyenne bondirait de cinq minutes à près de vingt ; la médiane bouge
    // de dix secondes.
    expect(Math.abs(median(avecOubli)! - median(normales)!)).toBeLessThan(15_000);
  });
});

describe('résumé par niveau', () => {
  it('rend tous les niveaux, y compris ceux jamais joués', () => {
    const summary = summarise([]);
    expect(summary).toHaveLength(6);
    expect(summary.every((s) => s.played === 0 && s.bestMs === null)).toBe(true);
  });

  it('donne un meilleur temps dès la première partie', () => {
    const summary = summarise([record({ level: 'expert', durationMs: 500_000 })]);
    const expert = summary.find((s) => s.level === 'expert')!;
    expect(expert.played).toBe(1);
    expect(expert.bestMs).toBe(500_000);
    // Mais pas de médiane : un échantillon de un n'en porte pas.
    expect(expert.medianMs).toBeNull();
  });

  it('ignore les durées non mesurables sans perdre la partie', () => {
    const history = [
      record({ level: 'moyen', durationMs: 200_000 }),
      record({ level: 'moyen', durationMs: null }),
    ];
    const moyen = summarise(history).find((s) => s.level === 'moyen')!;
    expect(moyen.played).toBe(2);
    // Le dénominateur des temps est affiché à part, et il vaut 1.
    expect(moyen.timed).toBe(1);
    expect(moyen.bestMs).toBe(200_000);
  });

  it('compte les parties terminées sans indice appliqué', () => {
    const history = [
      record({ level: 'difficile', hintsApplied: 0, hintsShown: 3 }),
      record({ level: 'difficile', hintsApplied: 2 }),
    ];
    const difficile = summarise(history).find((s) => s.level === 'difficile')!;
    // Consulter un indice sans appliquer le coup ne retire pas le mérite.
    expect(difficile.unaided).toBe(1);
  });
});

describe('totaux', () => {
  it('retient le niveau le plus élevé terminé, jamais une moyenne', () => {
    const history = [
      record({ level: 'facile' }),
      record({ level: 'maitre' }),
      record({ level: 'moyen' }),
    ];
    expect(totals(history).highestLevel).toBe<Level>('maitre');
  });

  it('compte les jours de défi distincts, pas les parties', () => {
    const history = [
      record({ id: 'a', daily: '2026-09-10' }),
      record({ id: 'b', daily: '2026-09-10' }),
      record({ id: 'c', daily: '2026-09-11' }),
      record({ id: 'd', daily: null }),
    ];
    const result = totals(history);
    expect(result.played).toBe(4);
    expect(result.dailies).toBe(2);
  });

  it('ne prétend rien sur un historique vide', () => {
    expect(totals([])).toEqual({ played: 0, dailies: 0, unaided: 0, highestLevel: null });
  });
});
