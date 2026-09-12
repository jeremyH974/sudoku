/**
 * La distribution.
 *
 * Une lettre par personne, et **des initiales toutes différentes** : c'est la
 * lettre qui est posée sur le plateau, pas le portrait. Deux raisons, et aucune
 * n'est esthétique.
 *
 *   - La couleur ne porte jamais seule dans ce projet. Un jeton qui ne serait
 *     qu'une pastille colorée serait illisible pour une partie des joueurs, et
 *     ne survivrait pas à une impression en noir et blanc.
 *   - Une lettre est lisible à la taille d'une case, se lit à voix haute sans
 *     ambiguïté, et se note au crayon sur un plan imprimé.
 *
 * Le genre n'est pas décoratif non plus : il porte l'accord des indices — « Elle
 * était assise », « Il était seul » — et ouvrira plus tard les indices qui s'y
 * réfèrent (« elle était avec un homme »).
 */
export interface Person {
  /** L'initiale, posée sur le plateau. Unique dans toute la distribution. */
  readonly letter: string;
  readonly name: string;
  readonly gender: 'f' | 'm';
}

/**
 * Seize personnes, initiales A à P.
 *
 * Seize parce que c'est le plus grand plateau que le modèle vise (16×16, le
 * palier le plus dur du genre) : la distribution n'aura pas à être retouchée
 * pour y arriver. Une affaire de six suspects en prend les six premières.
 */
export const CAST: readonly Person[] = [
  { letter: 'A', name: 'Adèle', gender: 'f' },
  { letter: 'B', name: 'Bruno', gender: 'm' },
  { letter: 'C', name: 'Clara', gender: 'f' },
  { letter: 'D', name: 'Damien', gender: 'm' },
  { letter: 'E', name: 'Élise', gender: 'f' },
  { letter: 'F', name: 'Fabien', gender: 'm' },
  { letter: 'G', name: 'Gaëlle', gender: 'f' },
  { letter: 'H', name: 'Hugo', gender: 'm' },
  { letter: 'I', name: 'Inès', gender: 'f' },
  { letter: 'J', name: 'Julien', gender: 'm' },
  { letter: 'K', name: 'Karim', gender: 'm' },
  { letter: 'L', name: 'Léa', gender: 'f' },
  { letter: 'M', name: 'Maël', gender: 'm' },
  { letter: 'N', name: 'Nadia', gender: 'f' },
  { letter: 'O', name: 'Olivier', gender: 'm' },
  { letter: 'P', name: 'Paloma', gender: 'f' },
];

/** Un suspect d'une affaire : une personne, plus sa place dans la distribution. */
export interface Suspect extends Person {
  readonly index: number;
}

/** Les `count` premiers rôles. */
export function castOf(count: number): Suspect[] {
  if (count < 2 || count > CAST.length) {
    throw new RangeError(`Distribution de ${String(count)} personnes hors de [2, 16].`);
  }
  return CAST.slice(0, count).map((person, index) => ({ ...person, index }));
}
