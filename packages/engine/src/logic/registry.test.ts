import { describe, expect, it } from 'vitest';
import { MAX_KNOWN_DIFFICULTY, TECHNIQUE_CATALOGUE, techniqueInfo } from './registry.js';
import { rate } from './rate.js';
import { generateAtLevel, generatePuzzle } from '../generate/index.js';

/**
 * Le catalogue répète des valeurs qui vivent aussi dans les modules de
 * techniques. C'est ce test qui rend le doublon tenable : il fait tourner le
 * solveur sur un large échantillon et confronte chaque étape observée à ce que
 * le catalogue annonce. Une valeur modifiée d'un côté seulement casse ici.
 */
function observedSteps(): Map<string, { label: string; difficulty: number }> {
  const seen = new Map<string, { label: string; difficulty: number }>();
  const collect = (steps: readonly { technique: string; label: string; difficulty: number }[]): void => {
    for (const step of steps) seen.set(step.technique, { label: step.label, difficulty: step.difficulty });
  };

  // Deux densités : les grilles très fournies exhibent les techniques faciles
  // (« Dernière case » n'apparaît que si la grille est presque pleine), les
  // grilles creusées exhibent les autres.
  for (let i = 0; i < 120; i++) {
    collect(rate(generatePuzzle({ seed: `catalogue-${String(i)}`, minClues: i % 3 === 0 ? 60 : 26 }).puzzle).steps);
  }
  for (const level of ['expert', 'maitre', 'diabolique'] as const) {
    for (let i = 0; i < 2; i++) {
      const puzzle = generateAtLevel({ level, seed: `catalogue-${level}-${String(i)}`, timeBudgetMs: 6000 });
      if (puzzle !== null) collect(puzzle.rating.steps);
    }
  }
  return seen;
}

describe('catalogue des techniques', () => {
  it('couvre les vingt-quatre techniques, sans doublon', () => {
    // La longueur est le garde-fou : ajouter un identifiant à `TechniqueId` sans
    // écrire son entrée fait tomber ce test au lieu de passer inaperçu.
    expect(TECHNIQUE_CATALOGUE).toHaveLength(24);
    expect(new Set(TECHNIQUE_CATALOGUE.map((info) => info.id)).size).toBe(24);
  });

  it('est trié par difficulté croissante et tient sous le plafond annoncé', () => {
    for (let i = 1; i < TECHNIQUE_CATALOGUE.length; i++) {
      expect(TECHNIQUE_CATALOGUE[i]!.difficulty).toBeGreaterThanOrEqual(
        TECHNIQUE_CATALOGUE[i - 1]!.difficulty,
      );
    }
    const highest = TECHNIQUE_CATALOGUE.at(-1)!.difficulty;
    expect(highest).toBe(MAX_KNOWN_DIFFICULTY);
  });

  it('annonce exactement ce que les étapes portent', () => {
    const seen = observedSteps();
    // Un échantillon qui n'observerait presque rien rendrait ce test creux.
    expect(seen.size).toBeGreaterThanOrEqual(15);

    for (const [id, observed] of seen) {
      const declared = techniqueInfo(id as never);
      expect(declared, `technique absente du catalogue : ${id}`).toBeDefined();
      expect(declared.label, `libellé de ${id}`).toBe(observed.label);
      expect(declared.difficulty, `difficulté de ${id}`).toBe(observed.difficulty);
    }
    // Le budget : l'échantillon vaut mieux que la vitesse, mais pas au point de
    // bloquer la CI. Une trentaine de secondes sur une machine lente.
  }, 90_000);
});
