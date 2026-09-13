import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deduce, openCase, solveExact, tryDecodeCase } from '@sudoku/engine/investigation';
import { CASE_CORPUS_VERSION } from './cases.js';

/**
 * Le corpus des affaires quotidiennes, vérifié entièrement.
 *
 * ─── Ce qu'il n'y a pas ici, et pourquoi ────────────────────────────────────
 *
 * Pas de fichier d'attentes, contrairement au corpus du sudoku. Celui-là range
 * les scores attendus parce qu'un **palier est annoncé au joueur** : si le
 * barème bouge, l'étiquette doit être rafraîchie ou elle ment. Le mode Enquête
 * n'annonce ni niveau ni score — il n'a pas d'oracle pour les calibrer —, donc
 * il n'y a rien à figer, rien à rafraîchir, et rien qui puisse se périmer.
 *
 * Ce qui reste est intemporel, et c'est tout ce qu'une affaire doit être : elle
 * se relit, elle a **exactement une** solution, et elle se déduit sans deviner.
 */

const corpusPath = join(import.meta.dirname, '../../app/public/daily/cases.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  version: number;
  days: Record<string, string | undefined>;
};

const days = Object.keys(corpus.days).sort();

describe('corpus des affaires quotidiennes', () => {
  it('couvre au moins une année, à partir d’aujourd’hui', () => {
    expect(corpus.version).toBe(CASE_CORPUS_VERSION);
    expect(days.length).toBeGreaterThanOrEqual(365);
    // Les clefs sont des jours civils, et le calendrier est continu : un trou
    // dans la suite serait un jour sans affaire, que personne ne remarquerait
    // avant d'y arriver.
    for (const day of days) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const first = new Date(`${days[0]}T12:00:00`);
    for (const [index, day] of days.entries()) {
      const expected = new Date(first.getFullYear(), first.getMonth(), first.getDate() + index, 12);
      const key = `${String(expected.getFullYear()).padStart(4, '0')}-${String(
        expected.getMonth() + 1,
      ).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
      expect(day, `trou dans le calendrier avant ${day}`).toBe(key);
    }
  });

  it(
    'ne livre que des affaires lisibles, uniques et déductibles',
    () => {
      /*
        La vérification complète, et non un échantillon : un jour faux ne se
        verrait qu'au moment où quelqu'un l'ouvrirait, c'est-à-dire ce jour-là,
        et sans recours. C'est exactement la situation d'un cahier imprimé.
      */
      const faults: string[] = [];
      for (const day of days) {
        const code = corpus.days[day];
        if (code === undefined || code === '') {
          faults.push(`${day} : créneau vide`);
          continue;
        }
        const file = tryDecodeCase(code);
        if (file === null) {
          faults.push(`${day} : code illisible`);
          continue;
        }
        const puzzle = openCase(file);
        const solutions = solveExact(puzzle, 2);
        if (solutions.length !== 1) {
          faults.push(`${day} : ${String(solutions.length)} solution(s)`);
          continue;
        }
        const path = deduce(puzzle);
        if (!path.solved) faults.push(`${day} : le registre ne sait pas la déduire`);
      }
      expect(faults, faults.slice(0, 5).join('\n')).toEqual([]);
    },
    120_000,
  );

  it('ne répète pas deux fois la même affaire', () => {
    // Deux jours identiques passeraient tous les contrôles ci-dessus et
    // décevraient le seul joueur qui reviendrait le lendemain.
    const codes = days.map((day) => corpus.days[day]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('fait tourner les décors, au lieu de rejouer le même plan', () => {
    /*
      Le décor n'est pas choisi ici : `composeCase` le dérive de la graine, et la
      graine porte la date. Ce contrôle ne réclame donc pas un tour de rôle — il
      vérifie que la dérivation ne s'est pas effondrée sur un seul décor, ce qui
      ne casserait rien et rendrait le jeu monotone sans que rien ne le dise.
    */
    const decors = new Map<string, number>();
    for (const day of days.slice(0, 120)) {
      const file = tryDecodeCase(corpus.days[day] ?? '');
      if (file === null) continue;
      decors.set(file.decorId, (decors.get(file.decorId) ?? 0) + 1);
    }
    expect(decors.size, [...decors.keys()].join(', ')).toBeGreaterThanOrEqual(3);
    // Aucun décor ne doit non plus accaparer le calendrier.
    for (const [decor, count] of decors) expect(count, decor).toBeLessThan(90);
  });
});
