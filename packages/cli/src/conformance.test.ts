import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_KNOWN_DIFFICULTY, RATING_VERSION, parseGrid, rate } from '@sudoku/engine';

/**
 * Conformité de notre notation à celle de Sudoku Explainer.
 *
 * ─── Pourquoi ce test existe ────────────────────────────────────────────────
 *
 * La calibration est une opération manuelle : elle demande Java, le binaire de
 * l'oracle, et plusieurs minutes. Un rapport daté ne protège de rien — il dit ce
 * qui était vrai le jour où on l'a produit.
 *
 * Ce test rejoue les verdicts de l'oracle, figés grille par grille dans
 * `corpus/oracle-reference.json`, **sans Java ni binaire tiers**. Toute
 * modification du registre, d'une valeur de difficulté ou d'une détection fait
 * bouger le taux d'accord et casse la suite. La conformité devient ainsi une
 * propriété tenue en continu, et non une campagne à refaire.
 *
 * Régénérer la référence : `pnpm calibrate` (voir `packages/cli`).
 * ───────────────────────────────────────────────────────────────────────────
 */

interface ReferenceGrid {
  readonly puzzle: string;
  readonly oracleEr: number;
  readonly oracleTechnique: string;
  readonly ourScore: number | null;
  readonly ourOutcome: string;
}

interface Reference {
  readonly oracle: string;
  readonly ratingVersion: number;
  readonly grids: readonly ReferenceGrid[];
}

const referencePath = join(import.meta.dirname, '../../../corpus/oracle-reference.json');
const reference = JSON.parse(readFileSync(referencePath, 'utf8')) as Reference;

/**
 * Seuil au-delà duquel un écart s'explique par des techniques que nous n'avons
 * pas encore : Unique Rectangle et les variantes groupées, entre 4,3 et 5,4. En
 * deçà, un écart est un défaut de notre côté.
 *
 * XY-Wing, XYZ-Wing, Skyscraper et Cerf-volant figuraient dans cette liste
 * jusqu'à l'incrément 6, qui les a implémentés.
 */
const EXACTNESS_THRESHOLD = 4.0;

/**
 * Plancher d'accord mesuré à la calibration de référence : 296 grilles sur 313
 * sous le seuil, soit 94,6 %.
 *
 * Progression : 91,4 % (incrément 3) → 93,3 % (liens forts et wings) → 94,6 %
 * (variantes « Direct » restreintes au single caché).
 *
 * Volontairement placé un point en dessous du résultat constaté. Trop serré, il
 * casserait au moindre remaniement légitime ; trop lâche, il laisserait passer
 * une régression. L'intention est d'attraper un changement d'ordre ou de
 * détection, pas de figer un centième.
 */
const MINIMUM_AGREEMENT = 0.93;

describe('conformité à l’oracle', () => {
  it('dispose d’une référence cohérente avec la version du barème en vigueur', () => {
    expect(reference.grids.length).toBeGreaterThan(100);
    // Une référence produite sous une autre version du barème ne prouverait
    // rien : les scores ne seraient pas comparables.
    expect(reference.ratingVersion).toBe(RATING_VERSION);
  });

  it('garde un accord exact d’au moins 93 % sur le domaine où il est exigible', () => {
    let comparable = 0;
    let agreeing = 0;

    for (const grid of reference.grids) {
      const rating = rate(parseGrid(grid.puzzle));
      if (rating.outcome !== 'solved') continue;
      if (rating.score > EXACTNESS_THRESHOLD) continue;

      comparable++;
      if (Math.abs(rating.score - grid.oracleEr) < 0.001) agreeing++;
    }

    const rate_ = agreeing / comparable;
    expect(comparable).toBeGreaterThan(100);
    expect(
      rate_,
      `Accord tombé à ${(rate_ * 100).toFixed(1)} % (${String(agreeing)}/${String(comparable)}). ` +
        `Un changement d'ordre ou de détection a fait diverger la notation. ` +
        `Relancez « pnpm calibrate » pour diagnostiquer.`,
    ).toBeGreaterThanOrEqual(MINIMUM_AGREEMENT);
  });

  it('ne note jamais une grille que l’oracle place hors de notre portée', () => {
    // Le sens inverse d'un refus injustifié : prétendre savoir résoudre une
    // grille qui exige des techniques absentes de notre registre.
    const overreach: string[] = [];
    for (const grid of reference.grids) {
      const rating = rate(parseGrid(grid.puzzle));
      if (rating.outcome === 'solved' && grid.oracleEr > MAX_KNOWN_DIFFICULTY + 0.001) {
        overreach.push(`${grid.puzzle} — oracle ${String(grid.oracleEr)}, nous ${String(rating.score)}`);
      }
    }
    expect(overreach, overreach.slice(0, 3).join('\n')).toHaveLength(0);
  });

  it('reste reproductible : deux notations de la même grille coïncident', () => {
    for (const grid of reference.grids.slice(0, 40)) {
      const first = rate(parseGrid(grid.puzzle));
      const second = rate(parseGrid(grid.puzzle));
      expect(second.score).toBe(first.score);
      expect(second.hardestTechnique).toBe(first.hardestTechnique);
    }
  });
});
