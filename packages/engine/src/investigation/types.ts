import type { Suspect } from './cast.js';
import type { Clue } from './clues/types.js';
import type { TechniqueId } from './deduce/types.js';
import type { Scene } from './scene/types.js';

/**
 * Une affaire, prête à être résolue.
 *
 * La scène y est **compilée** — c'est ce qui distingue `Puzzle` de `CaseFile`,
 * qui n'en porte que l'identifiant. Cette séparation n'est pas décorative :
 * `CaseFile` est ce qui se sérialise, se partage par lien, s'imprime et
 * traverse un Web Worker ; `Puzzle` est ce qui se calcule, et contient des
 * `Uint32Array` qu'on ne met pas dans une adresse.
 */
export interface Puzzle {
  readonly scene: Scene;
  readonly suspects: readonly Suspect[];
  /** Le suspect qui est la victime. Son indice est celui du genre. */
  readonly victim: number;
  readonly clues: readonly Clue[];
}

/**
 * Une affaire, telle qu'elle se range.
 *
 * Tout y est reconstructible : la scène depuis `decorId`, la distribution
 * depuis sa taille, les indices tels quels. Le `hardest` et le `stepCount` sont
 * des **mesures**, pas des étiquettes — voir `docs/plan-increment-11.md` sur
 * pourquoi ce mode n'affiche aucun score.
 */
export interface CaseFile {
  readonly decorId: string;
  readonly seed: string;
  readonly clues: readonly Clue[];
  readonly victim: number;
  /** La case de chaque suspect, par index de suspect. */
  readonly solution: readonly number[];
  /** Le coupable — conséquence de la solution, jamais une donnée de départ. */
  readonly murderer: number;
  /** Version du registre de déduction qui a produit les mesures ci-dessous. */
  readonly registryVersion: number;
  /** La technique la plus difficile que le chemin exige. */
  readonly hardest: TechniqueId;
  /** Combien de déductions nommées le chemin compte. */
  readonly stepCount: number;
}
