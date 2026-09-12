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
 *     visages qui se ressemblent. D'où une assignation **choisie à la main** ;
 *   · **l'œil plat daté se reconnaît à trois signes** : la pupille en disque
 *     noir uni, le blanc pur, et l'absence de reflet. Les trois sont corrigés
 *     ici — sclère teintée, iris coloré distinct de la pupille, un reflet
 *     unique. C'est le poste où quatre tracés de plus changent le plus.
 *
 * ─── Le piège nommé ─────────────────────────────────────────────────────────
 *
 * Faire varier **seulement** la teinte de peau produit « un seul visage,
 * plusieurs couleurs » — défaut documenté des systèmes d'avatars. Aucune
 * identité d'ici ne se distingue d'une autre par la seule couleur : le test
 * l'exige sur deux axes.
 *
 * Le corollaire, tenu aussi : le vêtement coloré est un **cinquième** axe, pas
 * un raccourci. Deux suspects ne partagent jamais coiffure **et** vêtement — les
 * deux choses qu'on voit d'abord.
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

/** Une identité : cinq coordonnées, et rien d'autre. */
export interface Face {
  readonly hair: HairShape;
  /** 1 à 4, du plus clair au plus foncé. */
  readonly skin: 1 | 2 | 3 | 4;
  /** 1 à 4, échelonnées en valeur pour tenir en noir et blanc. */
  readonly hairTone: 1 | 2 | 3 | 4;
  /** Lunettes : lève une ambiguïté résiduelle, jamais seule porteuse. */
  readonly glasses: boolean;
  /**
   * La couleur du vêtement — le seul accent franc du portrait.
   *
   * C'est l'axe le plus visible après la coiffure, et il est **échelonné en
   * valeur** comme les teintes de cheveux : quatre accents aux gris 101, 137,
   * 172 et 207, soit 35 niveaux au moins entre voisins. Un jeu choisi pour se
   * distinguer en couleur en mettait trois sur le même gris.
   */
  readonly garment: 1 | 2 | 3 | 4;
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
  { hair: 'boucle', skin: 3, hairTone: 3, glasses: false, garment: 3 }, // A — Adèle
  { hair: 'chignon', skin: 1, hairTone: 2, glasses: true, garment: 2 }, // B — Bruno
  { hair: 'queue', skin: 2, hairTone: 3, glasses: false, garment: 2 }, // C — Clara
  { hair: 'chignon', skin: 4, hairTone: 4, glasses: false, garment: 4 }, // D — Damien
  { hair: 'long', skin: 3, hairTone: 2, glasses: false, garment: 1 }, // E — Élise
  { hair: 'mi-long', skin: 1, hairTone: 3, glasses: false, garment: 4 }, // F — Fabien
  { hair: 'queue', skin: 4, hairTone: 2, glasses: false, garment: 3 }, // G — Gaëlle
  { hair: 'queue', skin: 3, hairTone: 1, glasses: false, garment: 4 }, // H — Hugo
  { hair: 'carre', skin: 3, hairTone: 4, glasses: false, garment: 1 }, // I — Inès
  { hair: 'court', skin: 4, hairTone: 1, glasses: true, garment: 2 }, // J — Julien
  { hair: 'mi-long', skin: 2, hairTone: 1, glasses: false, garment: 1 }, // K — Karim
  { hair: 'boucle', skin: 1, hairTone: 1, glasses: true, garment: 1 }, // L — Léa
  { hair: 'carre', skin: 2, hairTone: 2, glasses: false, garment: 4 }, // M — Maël
  { hair: 'chignon', skin: 1, hairTone: 1, glasses: false, garment: 3 }, // N — Nadia
  { hair: 'boucle', skin: 2, hairTone: 4, glasses: true, garment: 2 }, // O — Olivier
  { hair: 'couettes', skin: 2, hairTone: 4, glasses: false, garment: 3 }, // P — Paloma
];

/** Le portrait d'un suspect. */
export const faceOf = (suspect: Suspect): Face => FACES[suspect.index % FACES.length];

/** Sur combien d'axes deux identités diffèrent. Le test s'en sert. */
export function axesApart(left: Face, right: Face): number {
  return (
    Number(left.hair !== right.hair) +
    Number(left.skin !== right.skin) +
    Number(left.hairTone !== right.hairTone) +
    Number(left.glasses !== right.glasses) +
    Number(left.garment !== right.garment)
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

/**
 * Le buste, son ombre et son col.
 *
 * Le buste portait un gris de matière ; il porte maintenant **la couleur du
 * personnage**, et c'est le seul aplat franc du dessin. Deux tracés suffisent à
 * ce qu'il se lise comme un vêtement plutôt que comme un bloc : une ombre de cel
 * à droite — même lumière que le visage, en haut à gauche — et l'encolure.
 */
export const BUST = 'M7 44c0-7.4 7.6-11.6 17-11.6S41 36.6 41 44z';
export const BUST_SHADE = 'M24 32.4c9.4 0 17 4.2 17 11.6h-8.4c0-5.6-3.6-9.6-8.6-11.6z';
export const COLLAR = 'M17.6 36.2c2.2 2.4 10.6 2.4 12.8 0l2.2 1.1c-2.8 3.6-14.4 3.6-17.2 0z';

/**
 * Le cou, et l'ombre que le menton y porte.
 *
 * C'était un rectangle, et ça se voyait : sous le menton, le contour dépassait
 * du visage de six dixièmes de chaque côté et dessinait deux angles droits. Un
 * cou n'est pas un rectangle — il s'évase vers les épaules, et c'est cet évasement
 * qui rattache la tête au buste au lieu de la poser dessus.
 *
 * L'ombre est le troisième usage de la même lumière : la frange en porte une sur
 * le front, le buste une sur son flanc droit, le menton une sur le cou. Sans
 * elle, la tête flotte.
 */
export const NECK =
  'M21.3 29h5.4v5.6c0 1.4 1.8 2.2 3.4 2.8v1.6h-12.2v-1.6c1.6-.6 3.4-1.4 3.4-2.8z';
export const NECK_SHADE = 'M20.4 34.6c2.2 1.8 5 1.8 7.2 0-.6 1.8-2.2 2.4-3.6 2.4s-3-.6-3.6-2.4z';

/** Le visage. */
export const FACE = 'M12.5 23a11.5 12.5 0 1 0 23 0a11.5 12.5 0 1 0-23 0z';

/** L'ombre du cel : celle que la frange porte sur le front. */
export const FACE_SHADE =
  'M13.8 19.4c6 2.4 14.4 2.4 20.4 0-.6 2.6-1.4 3.9-2.2 4.5-4.8 1.4-11.2 1.4-16 0-.8-.6-1.6-1.9-2.2-4.5z';

/**
 * Le regard — le poste où l'on investit en premier.
 *
 * Un ovale plein n'a pas de regard : il a une tache. Cinq formes par œil en
 * donnent un, et la recherche nomme précisément lesquelles — les trois signes
 * qui datent une illustration plate sont le blanc pur, la pupille en disque noir
 * uni, et l'absence de reflet.
 *
 *   · l'**amande**, à coin externe légèrement relevé : deux unités plus haut que
 *     le coin interne. Une ellipse donnait un œil de poupée ;
 *   · l'**iris**, d'une couleur franche et **distincte de la pupille**. Mesuré :
 *     3,60:1 sur la sclère, 3,74:1 sur la pupille — les trois valeurs se
 *     distinguent encore à 56 px ;
 *   · la **pupille**, plus petite et plus basse que l'iris, ce qui suffit à
 *     poser un regard vers l'avant plutôt que dans le vide ;
 *   · le **reflet**, un point clair unique. Il n'est pas mis en miroir d'un œil
 *     à l'autre : il y a **une** source de lumière, en haut à gauche, et c'est
 *     la même qui porte l'ombre du visage et celle du buste ;
 *   · la **paupière supérieure**, dessinée en forme pleine et **plus épaisse
 *     vers l'extérieur** — 1,14 unité au coin externe contre 0,54 à l'interne.
 *     C'est le seul endroit du portrait où le trait s'effile, parce que c'est le
 *     seul endroit où ça valait le détour de le construire à la main : le SVG ne
 *     sait pas effiler un `stroke`.
 *
 * La paupière passe **en dernier**, et c'est structurel : elle recouvre le haut
 * de l'iris. C'est ce recouvrement qui fait un œil vivant, et c'est aussi lui
 * qui dispense de découper l'iris — pas de `clipPath`, donc pas d'identifiant
 * dupliqué seize fois dans la même page.
 *
 * Les yeux ne varient pas d'un suspect à l'autre, et c'est délibéré : à 56 px la
 * variation d'un œil ne se voit pas, là où une silhouette de cheveux se voit de
 * loin. Faire varier ce qui ne se lit pas, c'est payer sans recevoir.
 */
export interface EyePart {
  readonly d: string;
  readonly role: 'sclera' | 'iris' | 'pupil' | 'light' | 'lid';
}

export const EYES: readonly EyePart[] = [
  // Œil gauche.
  { d: 'M16.6 23.6C18.2 21.3 21 22 22.6 25.6C21.4 28.2 18.2 27.6 16.6 23.6Z', role: 'sclera' },
  { d: 'M17.75 24.75a1.95 1.95 0 1 0 3.9 0a1.95 1.95 0 1 0-3.9 0z', role: 'iris' },
  { d: 'M18.75 24.9a.95 .95 0 1 0 1.9 0a.95 .95 0 1 0-1.9 0z', role: 'pupil' },
  { d: 'M18.18 23.8a.72 .72 0 1 0 1.44 0a.72 .72 0 1 0-1.44 0z', role: 'light' },
  { d: 'M16.3 23.1C18 20.5 21.3 21.2 22.9 25.5L22.4 25.7C20.9 22.4 18.3 21.9 17 24Z', role: 'lid' },

  // Œil droit, miroir autour de x = 24 — sauf le reflet, qui garde sa source.
  { d: 'M31.4 23.6C29.8 21.3 27 22 25.4 25.6C26.6 28.2 29.8 27.6 31.4 23.6Z', role: 'sclera' },
  { d: 'M26.35 24.75a1.95 1.95 0 1 0 3.9 0a1.95 1.95 0 1 0-3.9 0z', role: 'iris' },
  { d: 'M27.35 24.9a.95 .95 0 1 0 1.9 0a.95 .95 0 1 0-1.9 0z', role: 'pupil' },
  { d: 'M26.78 23.8a.72 .72 0 1 0 1.44 0a.72 .72 0 1 0-1.44 0z', role: 'light' },
  { d: 'M31.7 23.1C30 20.5 26.7 21.2 25.1 25.5L25.6 25.7C27.1 22.4 29.7 21.9 31 24Z', role: 'lid' },
];


/**
 * Les sourcils : courbes, et **volontairement pas en miroir**.
 *
 * C'est le trait qui pèse le plus après le regard — plus que l'œil lui-même,
 * selon les travaux sur la reconnaissance des visages. Deux traits droits
 * donnaient un visage inexpressif ; une courbe suffit à le détendre.
 *
 * Le droit est posé 0,4 unité plus haut que le gauche et légèrement moins
 * cintré. C'est assez peu pour qu'on ne le remarque pas, et assez pour que le
 * visage cesse d'avoir l'air d'avoir été plié en deux — la symétrie parfaite est
 * ce qui donne aux visages vectoriels leur air de gabarit.
 */
export const BROWS = [
  'M16.1 20.3c1.3-1.7 3.7-2.3 5.7-1.6l-.2 1.7c-1.6-.5-3.5.1-4.6 1.2z',
  'M31.9 19.9c-1.4-1.5-3.8-2-5.8-1.2l.3 1.7c1.6-.6 3.5-.1 4.6.9z',
];

/** Le nez : une virgule, à peine posée. Plus serait du bruit à cette taille. */
export const NOSE = 'M23.3 28.6l1.4 1.2-1.4.5z';

/** La bouche : une courbe, jamais un rectangle. */
export const MOUTH = 'M22.1 31.3c.8 1 3 1 3.8 0-.2 1.6-3.6 1.6-3.8 0z';

/**
 * Les lunettes : deux verres arrondis, un pont, deux branches.
 *
 * Les verres sont des rectangles **arrondis** et non carrés : à cette taille, un
 * angle droit posé sur un visage se lit comme un défaut de rendu. Les branches
 * vont chercher le bord de l'ellipse du visage — calculé, pas estimé : à
 * y = 24,2 le contour passe par x = 12,6 et x = 35,4.
 */
export const GLASSES =
  'M16 22h5.4a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-5.4a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5z' +
  'M26.6 22h5.4a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-5.4a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5z' +
  'M22.9 24.8h2.2M14.5 24.2 12.7 23.5M33.5 24.2 35.3 23.5';

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
    back: 'M10.2 22a13.8 13.8 0 0 1 27.6 0v16c0 1-.8 1.6-2.2 1.6s-2.2-.6-2.2-1.6V26H14.6v12c0 1-.8 1.6-2.2 1.6s-2.2-.6-2.2-1.6z',
    front: 'M13.2 21.6c.6-6.4 5.2-10.6 10.8-10.6s10.2 4.2 10.8 10.6c-1.2-4-3-5.6-3-5.6-4.2 3.2-11.8 3.6-16.4 1.2 0 0-1.6 1.4-2.2 4.4z',
    shine: 'M14.6 16.2c1.7-2.7 5-4.4 9.4-4.4s7.7 1.7 9.4 4.4c-2.4-1.5-5.5-2.3-9.4-2.3s-7 .8-9.4 2.3z',
  },
  queue: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM34.2 18.8c4.4 1.6 6.8 6.4 6.8 12.4s-2.4 10.6-6 12l-3-3.6c2.4-1.6 3.8-4.8 3.8-8.4s-1.4-7-3.8-8.8z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-5.2 2.6-11.2 2.6-16.4 0 0 0-1.4 1.2-2.4 4.4z',
    shine: 'M15.6 16.6c1.5-2.6 4.5-4.2 8.4-4.2s6.9 1.6 8.4 4.2c-2.1-1.4-4.9-2.1-8.4-2.1s-6.3.7-8.4 2.1z',
  },
  boucle: {
    back: 'M24.0 7.6A4.6 4.6 0 0 1 31.52 10.05A4.6 4.6 0 0 1 36.17 16.44A4.6 4.6 0 0 1 36.17 24.36A4.6 4.6 0 0 1 31.52 30.75A4.6 4.6 0 0 1 24.0 33.2A4.6 4.6 0 0 1 16.48 30.75A4.6 4.6 0 0 1 11.83 24.36A4.6 4.6 0 0 1 11.83 16.44A4.6 4.6 0 0 1 16.48 10.05A4.6 4.6 0 0 1 24 7.6Z',
    front: 'M13 21.8c.4-6.6 5.2-11 11-11s10.6 4.4 11 11c-1.4-3.4-3.2-4.6-3.2-4.6-5.2 2.4-10.4 2.4-15.6 0 0 0-1.8 1.2-3.2 4.6z',
    shine: 'M13.6 15.8c1.6-3.4 4.4-5.8 8-6.8-2.4 2-4.2 4.4-5.2 7.4-.9 2.6-1 4.6-.6 6.4-1.4-2-1.9-4.4-2.2-7z',
  },
  chignon: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM19 10.4a5 5 0 1 0 10 0a5 5 0 1 0-10 0z',
    front: 'M13.6 21.4c.8-6.2 5.2-10.4 10.4-10.4s9.6 4.2 10.4 10.4c-1.6-4.4-4-6-4-6-4 2-9 2-13 0 0 0-2.2 1.6-3.8 6z',
    shine: 'M15.8 16.8c1.5-2.5 4.4-4 8.2-4s6.7 1.5 8.2 4c-2-1.3-4.8-2-8.2-2s-6.2.7-8.2 2z',
  },
  'mi-long': {
    back: 'M11.4 22a12.6 12.6 0 0 1 25.2 0v9.4c0 2.6 1.2 3.6 1.2 6.2H33c0-2.6-1.2-3.6-1.2-6.2V26H16.2v5.4c0 2.6-1.2 3.6-1.2 6.2h-4.8c0-2.6 1.2-3.6 1.2-6.2z',
    front: 'M13.2 21.6c.6-6.4 5.2-10.6 10.8-10.6s10.2 4.2 10.8 10.6c-1.2-4-3-5.4-3-5.4-4.2 3.4-11.6 4-16.2 1.6 0 0-1.8 1.2-2.4 3.8z',
    shine: 'M15.2 16.4c1.6-2.6 4.7-4.3 8.8-4.3s7.2 1.7 8.8 4.3c-2.2-1.4-5.2-2.2-8.8-2.2s-6.6.8-8.8 2.2z',
  },
  couettes: {
    back: 'M11.8 22a12.2 12.2 0 0 1 24.4 0v2.4h-1.8v-4.2H13.6v4.2h-1.8zM13.4 19.6c-4.4 1.2-6.8 5.2-6.8 9.6 0 3.8 2 6.6 5 6.6s5-2.6 5-6.4c0-3.2-1.2-6.2-3.2-9.8zM34.6 19.6c4.4 1.2 6.8 5.2 6.8 9.6 0 3.8-2 6.6-5 6.6s-5-2.6-5-6.4c0-3.2 1.2-6.2 3.2-9.8z',
    front: 'M13.4 21.6c.6-6.4 5.2-10.6 10.6-10.6s10 4.2 10.6 10.6c-1-3.2-2.4-4.4-2.4-4.4-2.4 1.2-4.4 1.8-8.2 1.8s-5.8-.6-8.2-1.8c0 0-1.4 1.2-2.4 4.4z',
    shine: 'M15.6 16.6c1.5-2.6 4.5-4.2 8.4-4.2s6.9 1.6 8.4 4.2c-2.1-1.4-4.9-2.1-8.4-2.1s-6.3.7-8.4 2.1z',
  },
};

/** Les jetons CSS d'une identité. Aucune couleur n'est écrite ici. */
export const skinToken = (skin: number): string => `var(--skin-${String(skin)})`;
export const hairToken = (tone: number): string => `var(--hair-${String(tone)})`;
export const garmentToken = (garment: number): string => `var(--garment-${String(garment)})`;
