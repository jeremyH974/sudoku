import { describe, expect, it } from 'vitest';
import { TECHNIQUE_CATALOGUE } from '@sudoku/engine';
import { CHAPTERS, LESSONS } from './lessons.js';

describe('contenu des leçons', () => {
  it('couvre chaque technique du catalogue, et rien de plus', () => {
    // Le typage garantit déjà qu'aucune leçon ne manque. Ce test garantit
    // l'autre sens : aucune leçon orpheline, c'est-à-dire écrite mais absente
    // de tout chapitre, donc inaccessible depuis l'interface.
    const placed = CHAPTERS.flatMap((chapter) => chapter.techniques);
    expect(new Set(placed).size).toBe(placed.length);
    expect(new Set(placed)).toEqual(new Set(TECHNIQUE_CATALOGUE.map((info) => info.id)));
  });

  it('dit quelque chose de chaque technique', () => {
    for (const info of TECHNIQUE_CATALOGUE) {
      const lesson = LESSONS[info.id];
      expect(lesson.summary.length, info.id).toBeGreaterThan(20);
      expect(lesson.body.length, info.id).toBeGreaterThan(0);
      expect(lesson.howToSpot.length, info.id).toBeGreaterThan(20);
    }
  });

  it('donne à chaque chapitre un titre et une entrée en matière', () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(5);
      expect(chapter.intro.length).toBeGreaterThan(40);
      expect(chapter.techniques.length).toBeGreaterThan(0);
    }
  });
});
