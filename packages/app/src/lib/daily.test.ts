import { describe, expect, it } from 'vitest';
import { corpusRange, dailyCode, daysRemaining, hasDaily } from './daily.js';
import type { DailyCorpus } from './daily.js';

const LEVELS = ['facile', 'moyen', 'difficile', 'expert', 'maitre', 'diabolique'] as const;

/** Un corpus de papier : les codes n'ont pas à être décodables ici. */
function corpusOf(days: Record<string, string[]>): DailyCorpus {
  return { version: 1, levels: [...LEVELS], days };
}

const trois = corpusOf({
  '2026-09-09': LEVELS.map((l) => `code-09-${l}`),
  '2026-09-10': LEVELS.map((l) => `code-10-${l}`),
  '2026-09-11': LEVELS.map((l) => `code-11-${l}`),
});

describe('lecture du corpus quotidien', () => {
  it('trouve la grille d’un jour et d’un niveau', () => {
    expect(dailyCode(trois, '2026-09-10', 'expert')).toBe('code-10-expert');
    expect(dailyCode(trois, '2026-09-10', 'facile')).toBe('code-10-facile');
  });

  it('rend null pour un jour absent, sans lever', () => {
    // Le cas nominal quand le corpus s'épuise : il doit dégrader, pas casser.
    expect(dailyCode(trois, '2027-01-01', 'moyen')).toBeNull();
    expect(hasDaily(trois, '2027-01-01')).toBe(false);
  });

  it('rend null pour un niveau que le corpus ne connaît pas', () => {
    const partiel = corpusOf({ '2026-09-10': ['a', 'b'] });
    expect(dailyCode({ ...partiel, levels: ['facile', 'moyen'] }, '2026-09-10', 'expert')).toBeNull();
  });

  it('donne ses bornes', () => {
    expect(corpusRange(trois)).toEqual({ first: '2026-09-09', last: '2026-09-11' });
    expect(corpusRange(corpusOf({}))).toBeNull();
  });

  it('ignore une clé qui n’est pas un jour réel dans ses bornes', () => {
    const abime = corpusOf({
      '2026-09-10': [...LEVELS],
      'hier': [...LEVELS],
      '2026-02-31': [...LEVELS],
    });
    expect(corpusRange(abime)).toEqual({ first: '2026-09-10', last: '2026-09-10' });
  });
});

describe('jours restants', () => {
  it('compte à partir d’aujourd’hui, bornes comprises', () => {
    expect(daysRemaining(trois, '2026-09-09')).toBe(3);
    expect(daysRemaining(trois, '2026-09-11')).toBe(1);
  });

  it('vaut zéro quand le corpus est épuisé', () => {
    // L'échéance doit être connue d'avance, pas découverte le jour venu.
    expect(daysRemaining(trois, '2026-09-12')).toBe(0);
    expect(daysRemaining(corpusOf({}), '2026-09-10')).toBe(0);
  });

  it('compte tout le corpus quand il commence dans le futur', () => {
    expect(daysRemaining(trois, '2026-01-01')).toBe(3);
  });
});
