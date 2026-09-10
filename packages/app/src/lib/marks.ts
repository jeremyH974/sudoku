/**
 * Les marques de candidats : colorier un chiffre parmi les neuf d'une case.
 *
 * ─── Le besoin ─────────────────────────────────────────────────────────────
 *
 * Pouvoir colorier **un candidat** — et non la case entière — est réclamé depuis
 * des années et absent de presque toutes les applications du marché. C'est ce
 * qui permet de suivre une chaîne à la main : « si ce 4 est vrai, alors celui-ci
 * est faux ». Sans lui, il faut tout tenir de tête.
 *
 * ─── Le modèle, et pourquoi ce n'est pas celui auquel on pense ──────────────
 *
 * La tentation est d'empiler les marques dans le tableau `notes` existant, qui
 * ne consomme que neuf bits sur trente-deux. C'est faux, et pas de peu :
 * `notes[case]` **est** le masque de candidats, transmis tel quel aux fonctions
 * du moteur (`hasDigit`, `withoutDigit`, `digitsOf`). Trois bits par chiffre
 * porteraient le total à trente-six, au-delà de l'entier 32 bits ; et même plus
 * étroit, `digitsOf` énumérerait des chiffres fantômes au-dessus de 9.
 *
 * D'où un **second tableau**, de la même forme : 81 nombres, deux bits par
 * chiffre, soit dix-huit bits utilisés. `notes` reste un masque propre, aucune
 * fonction du moteur ne change, et `storage.ts` sait déjà valider un tableau de
 * 81 nombres — la sauvegarde reste donc additive, sans montée de version qui
 * effacerait la partie en cours de chaque joueur.
 *
 * ─── Pourquoi trois marques, et pas huit ────────────────────────────────────
 *
 * Deux bits donnent quatre états : aucune marque, plus trois. Ce n'est pas un
 * compromis de place, c'est le plafond qu'impose la règle du projet : la couleur
 * n'est **jamais** le seul porteur d'information. Chaque marque doit donc porter
 * aussi un tracé distinct, lisible à huit pixels et en noir et blanc — et il n'y
 * a guère plus de trois tracés vraiment distinguables à cette taille. Les
 * marques s'appellent d'ailleurs « A », « B » et « C », jamais par leur couleur :
 * la lettre est l'identité, la couleur n'en est qu'un rappel.
 */

/** 0 : aucune marque. 1, 2, 3 : les marques A, B et C. */
export type Mark = 0 | 1 | 2 | 3;

export const MARKS: readonly { id: Exclude<Mark, 0>; label: string }[] = [
  { id: 1, label: 'A' },
  { id: 2, label: 'B' },
  { id: 3, label: 'C' },
];

const BITS = 2;
const MASK = 0b11;

/** Marque portée par un chiffre dans une case. */
export function markOf(colors: number, digit: number): Mark {
  return ((colors >> ((digit - 1) * BITS)) & MASK) as Mark;
}

/** Même valeur, la marque d'un chiffre remplacée. */
export function withMark(colors: number, digit: number, mark: Mark): number {
  const shift = (digit - 1) * BITS;
  return (colors & ~(MASK << shift)) | (mark << shift);
}

/** Bascule : reposer la même marque l'enlève. */
export function toggleMark(colors: number, digit: number, mark: Exclude<Mark, 0>): number {
  return withMark(colors, digit, markOf(colors, digit) === mark ? 0 : mark);
}

/**
 * Efface les marques des chiffres qui ne sont plus candidats.
 *
 * L'invariant que tout le reste suppose : **un chiffre absent de `notes` ne
 * porte aucune marque.** Sans cela, effacer une note puis la réécrire ferait
 * réapparaître une couleur que le joueur croyait partie — un fantôme d'autant
 * plus déroutant qu'il n'est visible nulle part entre-temps.
 */
export function restrictToNotes(colors: number, noteMask: number): number {
  let kept = 0;
  for (let digit = 1; digit <= 9; digit++) {
    if ((noteMask & (1 << (digit - 1))) === 0) continue;
    kept = withMark(kept, digit, markOf(colors, digit));
  }
  return kept;
}

/** Les chiffres marqués d'une case, dans l'ordre, pour l'énoncer à voix haute. */
export function markedDigits(colors: number): { digit: number; label: string }[] {
  const found: { digit: number; label: string }[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    const mark = markOf(colors, digit);
    if (mark === 0) continue;
    found.push({ digit, label: MARKS[mark - 1].label });
  }
  return found;
}
