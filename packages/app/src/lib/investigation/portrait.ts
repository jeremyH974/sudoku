import type { Suspect } from '@sudoku/engine/investigation';

/**
 * Les portraits des suspects — un système, pas seize dessins.
 *
 * ─── Pourquoi un système ────────────────────────────────────────────────────
 *
 * Seize illustrations dessinées l'une après l'autre ne se ressemblent pas ;
 * seize combinaisons d'un même jeu de pièces, si. Et le dix-septième personnage
 * est alors gratuit.
 *
 * ─── Ce que la recherche a imposé ───────────────────────────────────────────
 *
 *   · **La silhouette se lit avant la couleur**, et le sourcil pèse plus que
 *     l'œil (Sinha et al., MIT). L'axe principal de distinction est donc la
 *     coiffure, jamais la teinte de peau ;
 *   · **40 px est sous le plancher de lisibilité** — le détail disparaît sous
 *     ~60 px, un style plat à formes franches tient jusqu'à ~48. Le portrait est
 *     donc affiché à 56 px, et il reste **décoratif** : c'est la lettre qui
 *     identifie un suspect, sur le plateau comme sur sa carte ;
 *   · **le trait effilé n'existe pas en SVG** — proposé en 2002, écarté de
 *     SVG2, toujours un brouillon non implémenté. La ligne d'encre est donc une
 *     **forme pleine** dessinée sous le personnage, jamais un contour ;
 *   · **aucune étude ne chiffre** le lien entre nombre de couches et
 *     distinctivité perçue. On ne le prétendra pas : la combinatoire trompe —
 *     les Mii de Nintendo atteignent dix milliards de combinaisons pour des
 *     visages qui se ressemblent. D'où une assignation **choisie à la main**.
 *
 * ─── Le piège nommé ─────────────────────────────────────────────────────────
 *
 * Faire varier **seulement** la teinte de peau produit « un seul visage,
 * plusieurs couleurs » — défaut documenté des systèmes d'avatars. Aucune
 * identité d'ici ne se distingue d'une autre par la seule couleur : le test
 * l'exige sur deux axes.
 */

/** Les huit silhouettes de coiffure — l'axe qui porte la distinction. */
export type HairShape =
  | 'court'
  | 'carre'
  | 'long'
  | 'queue'
  | 'boucle'
  | 'chignon'
  | 'mi-long'
  | 'couettes';

/** Une identité : quatre coordonnées, et rien d'autre. */
export interface Face {
  readonly hair: HairShape;
  /** 1 à 4, du plus clair au plus foncé. */
  readonly skin: 1 | 2 | 3 | 4;
  /** 1 à 4, échelonnées en valeur pour tenir en noir et blanc. */
  readonly hairTone: 1 | 2 | 3 | 4;
  /** Lunettes : lève une ambiguïté résiduelle, jamais seule porteuse. */
  readonly glasses: boolean;
}

/**
 * Les seize identités, **assignées à la main**.
 *
 * 8 × 4 × 4 × 2 donnent 256 combinaisons pour seize nécessaires : la marge sert
 * à les écarter, pas à tirer au sort. La règle tenue, et vérifiée par un test :
 * **deux suspects ne partagent jamais plus d'un axe**.
 *
 * L'ordre suit celui de `CAST` dans le moteur — Adèle, Bruno, Clara…
 *
 * ─── Comment elle a été trouvée ─────────────────────────────────────────────
 *
 * Pas à la main du premier coup : la première table écrite à l'œil avait deux
 * défauts que le test a attrapés — Damien et Karim ne différaient que par la
 * peau, et une même coiffure servait quatre fois. Une recherche a donc produit
 * une table qui satisfait toutes les bornes à la fois, **puis deux attributions
 * ont été corrigées à la main** parce qu'elles se lisaient mal.
 *
 * C'est l'ordre qui compte : le système propose ce qui est valide, le jugement
 * tranche ce qui est juste. L'inverse — corriger à la main puis espérer que
 * les bornes tiennent — est exactement ce qui avait produit les deux défauts.
 */
export const FACES: readonly Face[] = [
  { hair: 'boucle', skin: 3, hairTone: 3, glasses: false }, // A — Adèle
  { hair: 'chignon', skin: 1, hairTone: 2, glasses: true }, // B — Bruno
  { hair: 'queue', skin: 2, hairTone: 3, glasses: false }, // C — Clara
  { hair: 'chignon', skin: 4, hairTone: 4, glasses: false }, // D — Damien
  { hair: 'long', skin: 3, hairTone: 2, glasses: false }, // E — Élise
  { hair: 'mi-long', skin: 1, hairTone: 3, glasses: false }, // F — Fabien
  { hair: 'queue', skin: 4, hairTone: 2, glasses: false }, // G — Gaëlle
  { hair: 'queue', skin: 3, hairTone: 1, glasses: false }, // H — Hugo
  { hair: 'carre', skin: 3, hairTone: 4, glasses: false }, // I — Inès
  { hair: 'court', skin: 4, hairTone: 1, glasses: true }, // J — Julien
  { hair: 'mi-long', skin: 2, hairTone: 1, glasses: false }, // K — Karim
  { hair: 'boucle', skin: 1, hairTone: 1, glasses: true }, // L — Léa
  { hair: 'carre', skin: 2, hairTone: 2, glasses: false }, // M — Maël
  { hair: 'chignon', skin: 1, hairTone: 1, glasses: false }, // N — Nadia
  { hair: 'boucle', skin: 2, hairTone: 4, glasses: true }, // O — Olivier
  { hair: 'couettes', skin: 2, hairTone: 4, glasses: false }, // P — Paloma
];

/** Le portrait d'un suspect. */
export const faceOf = (suspect: Suspect): Face => FACES[suspect.index % FACES.length];

/** Sur combien d'axes deux identités diffèrent. Le test s'en sert. */
export function axesApart(left: Face, right: Face): number {
  return (
    Number(left.hair !== right.hair) +
    Number(left.skin !== right.skin) +
    Number(left.hairTone !== right.hairTone) +
    Number(left.glasses !== right.glasses)
  );
}

/*
  ─── Les tracés ─────────────────────────────────────────────────────────────

  Grille de 48, buste cadré. L'ordre de dessin est celui d'un cel peint :
  l'encre d'abord, les aplats ensuite, la frange par-dessus le visage.

  Les formes sont franches et géométriques, et c'est un choix de lisibilité :
  à 56 px, une courbe subtile ne se voit pas — seule la silhouette parle.
*/

/** La plaque : le fond que le portrait maîtrise, indépendant de la carte. */
export const PLATE = 'M4 8a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z';

/** Le buste, et le cou. */
export const BUST = 'M7 44c0-7.4 7.6-11.6 17-11.6S41 36.6 41 44z';
export const NECK = 'M20.6 30h6.8v7h-6.8z';

/** Le visage. */
export const FACE = 'M12.5 23a11.5 12.5 0 1 0 23 0a11.5 12.5 0 1 0-23 0z';

/** L'ombre du cel : celle que la frange porte sur le front. */
export const FACE_SHADE =
  'M13.8 19.4c6 2.4 14.4 2.4 20.4 0-.6 2.6-1.4 3.9-2.2 4.5-4.8 1.4-11.2 1.4-16 0-.8-.6-1.6-1.9-2.2-4.5z';

/** Les yeux, les sourcils, la bouche — figés : à cette taille ils ne varient pas utilement. */
export const EYES = [
  'M17.6 24.6a2.1 2.7 0 1 0 4.2 0a2.1 2.7 0 1 0-4.2 0z',
  'M26.2 24.6a2.1 2.7 0 1 0 4.2 0a2.1 2.7 0 1 0-4.2 0z',
];
export const BROWS = [
  'M16.6 21l5.2-1.5.5 1.7-5.2 1.5z',
  'M31.4 21l-5.2-1.5-.5 1.7 5.2 1.5z',
];
export const MOUTH = 'M22.2 29.6h3.6v1.3h-3.6z';

/** Les lunettes : deux verres et un pont. */
export const GLASSES =
  'M14.6 22.6h8.2v5.2h-8.2zM25.2 22.6h8.2v5.2h-8.2zM22.8 24.4h2.4v1.2h-2.4z';

/**
 * Les huit coiffures, en deux parties.
 *
 * `back` passe **sous** le visage et donne la silhouette — c'est elle qu'on lit
 * de loin. `front` passe **par-dessus** et donne la frange, qui distingue de
 * près sans jamais être seule à le faire.
 */
export const HAIR: Readonly<Record<HairShape, { back: string; front: string }>> = {
  court: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-5.2 2.6-11.2 2.6-16.4 0 0 0-1.4 1.2-2.4 4.4z',
  },
  carre: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v13.6c0 1.4-1 2.2-2.6 2.2s-2.6-.8-2.6-2.2V26H17v9.6c0 1.4-1 2.2-2.6 2.2s-2.6-.8-2.6-2.2z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.6-2.6-5-2.6-5-5.2 2.8-11.4 2.8-16.4.2 0 0-1.6 1.2-2.2 4.8z',
  },
  long: {
    back: 'M10.2 22a13.8 13.8 0 0 1 27.6 0v24c0 1-.8 1.6-2.2 1.6s-2.2-.6-2.2-1.6V26H14.6v20c0 1-.8 1.6-2.2 1.6s-2.2-.6-2.2-1.6z',
    front: 'M13.2 21.6c.6-6.4 5.2-10.6 10.8-10.6s10.2 4.2 10.8 10.6c-1.2-4-3-5.6-3-5.6-4.2 3.2-11.8 3.6-16.4 1.2 0 0-1.6 1.4-2.2 4.4z',
  },
  queue: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM34.2 18.8c4.4 1.6 6.8 6.4 6.8 12.4s-2.4 10.6-6 12l-3-3.6c2.4-1.6 3.8-4.8 3.8-8.4s-1.4-7-3.8-8.8z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-5.2 2.6-11.2 2.6-16.4 0 0 0-1.4 1.2-2.4 4.4z',
  },
  boucle: {
    back: 'M10.4 20.4a13.6 13.6 0 1 0 27.2 0a13.6 13.6 0 1 0-27.2 0zM7.4 25.6a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0-10.8 0zM29.8 25.6a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0-10.8 0z',
    front: 'M13 21.8c.4-6.6 5.2-11 11-11s10.6 4.4 11 11c-1.4-3.4-3.2-4.6-3.2-4.6-5.2 2.4-10.4 2.4-15.6 0 0 0-1.8 1.2-3.2 4.6z',
  },
  chignon: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM18.4 8a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0-11.2 0z',
    front: 'M13.6 21.4c.8-6.2 5.2-10.4 10.4-10.4s9.6 4.2 10.4 10.4c-1.6-4.4-4-6-4-6-4 2-9 2-13 0 0 0-2.2 1.6-3.8 6z',
  },
  'mi-long': {
    back: 'M11.4 22a12.6 12.6 0 0 1 25.2 0v9.4c0 2.6 1.2 3.6 1.2 6.2H33c0-2.6-1.2-3.6-1.2-6.2V26H16.2v5.4c0 2.6-1.2 3.6-1.2 6.2h-4.8c0-2.6 1.2-3.6 1.2-6.2z',
    front: 'M13.2 21.6c.6-6.4 5.2-10.6 10.8-10.6s10.2 4.2 10.8 10.6c-1.2-4-3-5.4-3-5.4-4.2 3.4-11.6 4-16.2 1.6 0 0-1.8 1.2-2.4 3.8z',
  },
  couettes: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM5.6 28.4a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM30.4 28.4a6 6 0 1 0 12 0a6 6 0 1 0-12 0z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-2.4 1.2-4.4 1.8-8.2 1.8s-5.8-.6-8.2-1.8c0 0-1.4 1.2-2.4 4.4z',
  },
};

/** Le jeton CSS d'un ton de peau, et de son ombre de cel. */
export const skinToken = (skin: number): string => `var(--skin-${String(skin)})`;
export const hairToken = (tone: number): string => `var(--hair-${String(tone)})`;
