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

/**
 * Le regard — le poste où l'on investit en premier.
 *
 * Un ovale plein n'a pas de regard : il a une tache. Quatre formes par œil en
 * donnent un, et c'est le meilleur rapport entre le nombre de tracés et ce que
 * le visage gagne :
 *
 *   · le **blanc** de l'œil, qui creuse l'orbite ;
 *   · la **ligne de paupière**, épaissie vers l'extérieur — c'est elle qui
 *     signe le trait japonais, et elle seule fait plus que l'iris ;
 *   · l'**iris**, sombre, qui porte la direction du regard ;
 *   · le **reflet**, un point clair en haut à gauche. Sans lui l'œil est mort,
 *     et il ne coûte qu'un cercle.
 *
 * Les yeux ne varient pas d'un suspect à l'autre, et c'est délibéré : à 56 px
 * la variation d'un œil ne se voit pas, là où une silhouette de cheveux se voit
 * de loin. Faire varier ce qui ne se lit pas, c'est payer sans recevoir.
 */
export interface EyePart {
  readonly d: string;
  readonly role: 'sclera' | 'lid' | 'iris' | 'light';
}

export const EYES: readonly EyePart[] = [
  // Œil gauche.
  { d: 'M16.9 24.7a2.8 3.2 0 1 0 5.6 0a2.8 3.2 0 1 0-5.6 0z', role: 'sclera' },
  {
    d: 'M16.7 24.4c0-2.4 1.4-3.9 3-3.9s3 1.5 3 3.9c-.5-1.7-1.6-2.5-3-2.5-1.1 0-2 .5-2.6 1.4l-1.5-1.1z',
    role: 'lid',
  },
  { d: 'M18.1 24.9a1.6 1.85 0 1 0 3.2 0a1.6 1.85 0 1 0-3.2 0z', role: 'iris' },
  { d: 'M18.4 23.5a.8 .8 0 1 0 1.6 0a.8 .8 0 1 0-1.6 0z', role: 'light' },

  // Œil droit, miroir autour de x = 24.
  { d: 'M25.5 24.7a2.8 3.2 0 1 0 5.6 0a2.8 3.2 0 1 0-5.6 0z', role: 'sclera' },
  {
    d: 'M31.3 24.4c0-2.4-1.4-3.9-3-3.9s-3 1.5-3 3.9c.5-1.7 1.6-2.5 3-2.5 1.1 0 2 .5 2.6 1.4l1.5-1.1z',
    role: 'lid',
  },
  { d: 'M26.7 24.9a1.6 1.85 0 1 0 3.2 0a1.6 1.85 0 1 0-3.2 0z', role: 'iris' },
  { d: 'M27 23.5a.8 .8 0 1 0 1.6 0a.8 .8 0 1 0-1.6 0z', role: 'light' },
];

/**
 * Les sourcils : légèrement courbes et décalés vers l'extérieur.
 *
 * C'est le trait qui pèse le plus après le regard — plus que l'œil lui-même,
 * selon les travaux sur la reconnaissance des visages. Deux traits droits
 * donnaient un visage inexpressif ; une courbe suffit à le détendre.
 */
export const BROWS = [
  'M16.3 20.6c1.2-1.5 3.6-2.1 5.6-1.5l-.2 1.7c-1.6-.5-3.5 0-4.6 1.1z',
  'M31.7 20.6c-1.2-1.5-3.6-2.1-5.6-1.5l.2 1.7c1.6-.5 3.5 0 4.6 1.1z',
];

/** Le nez : une virgule, à peine posée. Plus serait du bruit à cette taille. */
export const NOSE = 'M23.4 27.1l1.3 1.1-1.3.5z';

/** La bouche : une courbe, jamais un rectangle. */
export const MOUTH = 'M22.1 30c.8 1 3 1 3.8 0-.2 1.6-3.6 1.6-3.8 0z';

/** Les lunettes : deux verres et un pont. */
export const GLASSES =
  'M14.6 22.6h8.2v5.2h-8.2zM25.2 22.6h8.2v5.2h-8.2zM22.8 24.4h2.4v1.2h-2.4z';

/**
 * Les huit coiffures, en deux parties.
 *
 * `back` passe **sous** le visage et donne la silhouette — c'est elle qu'on lit
 * de loin. `front` passe **par-dessus** et donne la frange, qui distingue de
 * près sans jamais être seule à le faire.
 *
 * `shine` est le reflet de la chevelure, en croissant clair. C'est la
 * convention du dessin japonais, et elle fait beaucoup pour un seul tracé : sans
 * elle une masse de cheveux est une silhouette, avec elle c'est une matière.
 */
export const HAIR: Readonly<Record<HairShape, { back: string; front: string; shine: string }>> = {
  court: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-5.2 2.6-11.2 2.6-16.4 0 0 0-1.4 1.2-2.4 4.4z',
    shine: 'M15.6 16.6c1.5-2.6 4.5-4.2 8.4-4.2s6.9 1.6 8.4 4.2c-2.1-1.4-4.9-2.1-8.4-2.1s-6.3.7-8.4 2.1z',
  },
  carre: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v13.6c0 1.4-1 2.2-2.6 2.2s-2.6-.8-2.6-2.2V26H17v9.6c0 1.4-1 2.2-2.6 2.2s-2.6-.8-2.6-2.2z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.6-2.6-5-2.6-5-5.2 2.8-11.4 2.8-16.4.2 0 0-1.6 1.2-2.2 4.8z',
    shine: 'M15.6 16.6c1.5-2.6 4.5-4.2 8.4-4.2s6.9 1.6 8.4 4.2c-2.1-1.4-4.9-2.1-8.4-2.1s-6.3.7-8.4 2.1z',
  },
  long: {
    back: 'M10.2 22a13.8 13.8 0 0 1 27.6 0v24c0 1-.8 1.6-2.2 1.6s-2.2-.6-2.2-1.6V26H14.6v20c0 1-.8 1.6-2.2 1.6s-2.2-.6-2.2-1.6z',
    front: 'M13.2 21.6c.6-6.4 5.2-10.6 10.8-10.6s10.2 4.2 10.8 10.6c-1.2-4-3-5.6-3-5.6-4.2 3.2-11.8 3.6-16.4 1.2 0 0-1.6 1.4-2.2 4.4z',
    shine: 'M14.6 16.2c1.7-2.7 5-4.4 9.4-4.4s7.7 1.7 9.4 4.4c-2.4-1.5-5.5-2.3-9.4-2.3s-7 .8-9.4 2.3z',
  },
  queue: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM34.2 18.8c4.4 1.6 6.8 6.4 6.8 12.4s-2.4 10.6-6 12l-3-3.6c2.4-1.6 3.8-4.8 3.8-8.4s-1.4-7-3.8-8.8z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-5.2 2.6-11.2 2.6-16.4 0 0 0-1.4 1.2-2.4 4.4z',
    shine: 'M15.6 16.6c1.5-2.6 4.5-4.2 8.4-4.2s6.9 1.6 8.4 4.2c-2.1-1.4-4.9-2.1-8.4-2.1s-6.3.7-8.4 2.1z',
  },
  boucle: {
    back: 'M10.4 20.4a13.6 13.6 0 1 0 27.2 0a13.6 13.6 0 1 0-27.2 0zM7.4 25.6a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0-10.8 0zM29.8 25.6a5.4 5.4 0 1 0 10.8 0a5.4 5.4 0 1 0-10.8 0z',
    front: 'M13 21.8c.4-6.6 5.2-11 11-11s10.6 4.4 11 11c-1.4-3.4-3.2-4.6-3.2-4.6-5.2 2.4-10.4 2.4-15.6 0 0 0-1.8 1.2-3.2 4.6z',
    shine: 'M14 14.4c1.8-3 5.4-4.9 10-4.9s8.2 1.9 10 4.9c-2.6-1.7-6-2.6-10-2.6s-7.4.9-10 2.6z',
  },
  chignon: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM18.4 8a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0-11.2 0z',
    front: 'M13.6 21.4c.8-6.2 5.2-10.4 10.4-10.4s9.6 4.2 10.4 10.4c-1.6-4.4-4-6-4-6-4 2-9 2-13 0 0 0-2.2 1.6-3.8 6z',
    shine: 'M15.8 16.8c1.5-2.5 4.4-4 8.2-4s6.7 1.5 8.2 4c-2-1.3-4.8-2-8.2-2s-6.2.7-8.2 2z',
  },
  'mi-long': {
    back: 'M11.4 22a12.6 12.6 0 0 1 25.2 0v9.4c0 2.6 1.2 3.6 1.2 6.2H33c0-2.6-1.2-3.6-1.2-6.2V26H16.2v5.4c0 2.6-1.2 3.6-1.2 6.2h-4.8c0-2.6 1.2-3.6 1.2-6.2z',
    front: 'M13.2 21.6c.6-6.4 5.2-10.6 10.8-10.6s10.2 4.2 10.8 10.6c-1.2-4-3-5.4-3-5.4-4.2 3.4-11.6 4-16.2 1.6 0 0-1.8 1.2-2.4 3.8z',
    shine: 'M15.2 16.4c1.6-2.6 4.7-4.3 8.8-4.3s7.2 1.7 8.8 4.3c-2.2-1.4-5.2-2.2-8.8-2.2s-6.6.8-8.8 2.2z',
  },
  couettes: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM5.6 28.4a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM30.4 28.4a6 6 0 1 0 12 0a6 6 0 1 0-12 0z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-2.4 1.2-4.4 1.8-8.2 1.8s-5.8-.6-8.2-1.8c0 0-1.4 1.2-2.4 4.4z',
    shine: 'M15.6 16.6c1.5-2.6 4.5-4.2 8.4-4.2s6.9 1.6 8.4 4.2c-2.1-1.4-4.9-2.1-8.4-2.1s-6.3.7-8.4 2.1z',
  },
};

/** Le jeton CSS d'un ton de peau, et de son ombre de cel. */
export const skinToken = (skin: number): string => `var(--skin-${String(skin)})`;
export const hairToken = (tone: number): string => `var(--hair-${String(tone)})`;
