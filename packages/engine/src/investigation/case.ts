import { castOf } from './cast.js';
import { loadDecor } from './scene/decors.js';
import { buildScene } from './scene/scene.js';
import type { CaseFile, Puzzle } from './types.js';

/**
 * Ouvre un dossier rangé : la scène se recompile, la distribution se rappelle.
 *
 * Rien de ce qui est calculé n'est stocké. Un `CaseFile` ne porte que ce qui ne
 * se redéduit pas — le décor, les indices, la solution — et cette fonction
 * reconstruit le reste. C'est ce qui rend une affaire transportable dans une
 * adresse, dans un Worker ou sur une feuille imprimée sans emporter de
 * `Uint32Array`.
 */
export function openCase(file: CaseFile): Puzzle {
  const scene = buildScene(loadDecor(file.decorId));
  const suspects = castOf(scene.size);
  return { scene, suspects, victim: file.victim, clues: file.clues };
}
