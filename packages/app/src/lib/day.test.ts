import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  daysInMonth,
  isDayKey,
  localDayKey,
  nextDay,
  previousDay,
  startOfMonth,
  weekdayOf,
} from './day.js';

describe('localDayKey', () => {
  it('rend le jour local, jamais le jour UTC', () => {
    // 23 h 30 le 10 septembre, heure locale. En UTC, selon le fuseau de la
    // machine, il peut être encore le 10 ou déjà le 11 — mais le joueur, lui,
    // voit le 10 sur son téléphone.
    expect(localDayKey(new Date(2026, 8, 10, 23, 30))).toBe('2026-09-10');
    expect(localDayKey(new Date(2026, 8, 11, 0, 1))).toBe('2026-09-11');
  });

  it('complète les mois et les jours à un chiffre', () => {
    // Le zéro oublié casse l'ordre alphabétique en silence : « 2026-9-1 »
    // se trierait après « 2026-10-01 ». Tout le module repose là-dessus.
    expect(localDayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    expect(localDayKey(new Date(2026, 8, 1, 12))).toBe('2026-09-01');
  });
});

describe('previousDay et nextDay', () => {
  it('traversent un changement de mois et d’année', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2024-02-28')).toBe('2024-02-29');
  });

  it('traversent le passage à l’heure d’été sans perdre un jour', () => {
    // Le 29 mars 2026 en Europe/Paris dure 23 heures. Un calcul en
    // millisecondes retomberait sur le 29 au lieu du 30.
    expect(previousDay('2026-03-30')).toBe('2026-03-29');
    expect(nextDay('2026-03-29')).toBe('2026-03-30');
    expect(previousDay('2026-03-29')).toBe('2026-03-28');
  });

  it('traversent le passage à l’heure d’hiver sans compter un jour deux fois', () => {
    // Le 25 octobre 2026 dure 25 heures.
    expect(previousDay('2026-10-26')).toBe('2026-10-25');
    expect(nextDay('2026-10-25')).toBe('2026-10-26');
    expect(nextDay('2026-10-24')).toBe('2026-10-25');
  });

  /*
    `noInvalidDate` n'est pas décoratif : sans lui, `fc.date` produit aussi des
    dates invalides, et la propriété tombe — non pas à cause d'un défaut de
    calcul, mais parce qu'elle n'a pas de sens pour un instant qui n'existe pas.
    Le contrôle de forme incombe à `isDayKey`, testé plus bas ; ces propriétés-ci
    portent sur des jours réels. Vérifié par ailleurs : les 48 000 jours
    consécutifs de 1970 à 2100 satisfont la réciprocité sans exception.
  */
  it('sont réciproques, quel que soit le jour', () => {
    fc.assert(
      fc.property(fc.date({ min: new Date(1970, 0, 2), max: new Date(2100, 0, 1), noInvalidDate: true }), (date) => {
        const key = localDayKey(date);
        expect(nextDay(previousDay(key))).toBe(key);
        expect(previousDay(nextDay(key))).toBe(key);
      }),
    );
  });

  it('produisent toujours un jour valide, et strictement ordonné', () => {
    fc.assert(
      fc.property(fc.date({ min: new Date(1970, 0, 2), max: new Date(2100, 0, 1), noInvalidDate: true }), (date) => {
        const key = localDayKey(date);
        expect(isDayKey(nextDay(key))).toBe(true);
        // L'ordre alphabétique doit coïncider avec l'ordre chronologique : c'est
        // l'hypothèse sur laquelle repose tout le calcul des séries.
        expect(previousDay(key) < key).toBe(true);
        expect(key < nextDay(key)).toBe(true);
      }),
    );
  });
});

describe('isDayKey', () => {
  it('accepte un jour réel', () => {
    expect(isDayKey('2026-09-10')).toBe(true);
    expect(isDayKey('2024-02-29')).toBe(true);
  });

  it('refuse ce qui a la forme d’un jour sans en être un', () => {
    expect(isDayKey('2026-02-31')).toBe(false);
    expect(isDayKey('2025-02-29')).toBe(false);
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-00-10')).toBe(false);
    expect(isDayKey('2026-9-1')).toBe(false);
    expect(isDayKey('hier')).toBe(false);
    expect(isDayKey(20260910)).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });
});

describe('repères de calendrier', () => {
  it('numérote les jours de la semaine à partir de lundi', () => {
    // Le 10 septembre 2026 est un jeudi.
    expect(weekdayOf('2026-09-10')).toBe(3);
    expect(weekdayOf('2026-09-14')).toBe(0);
    expect(weekdayOf('2026-09-13')).toBe(6);
  });

  it('compte les jours du mois, années bissextiles comprises', () => {
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(daysInMonth('2024-02-10')).toBe(29);
    expect(daysInMonth('2026-09-10')).toBe(30);
    expect(daysInMonth('2026-12-01')).toBe(31);
  });

  it('trouve le premier du mois', () => {
    expect(startOfMonth('2026-09-10')).toBe('2026-09-01');
    expect(startOfMonth('2026-01-31')).toBe('2026-01-01');
  });
});
