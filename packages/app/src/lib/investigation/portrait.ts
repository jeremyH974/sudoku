import type { Suspect } from '@sudoku/engine/investigation';

/**
 * L'identité des seize suspects — cinq coordonnées chacun, et rien d'autre.
 *
 * ─── Ce que ce fichier est devenu ───────────────────────────────────────────
 *
 * Il portait aussi le **dessin** : vingt-six tracés SVG écrits à la main, qui
 * ont servi jusqu'à ce que la mesure dise où ce style s'arrêtait — vingt-six
 * tracés, c'est le compte d'avataaars, plafond du genre « avatar plat ». Les
 * portraits sont désormais des images, et `Portrait.svelte` dit pourquoi.
 *
 * Ce qui reste ici est ce qui **engendre** ces images : la table des axes que
 * `pnpm portraits` lit pour écrire ses seize spécifications. Le dessin a changé
 * de médium, le système d'identités n'a pas bougé d'une ligne.
 *
 * ─── Pourquoi un système ────────────────────────────────────────────────────
 *
 * Seize illustrations demandées l'une après l'autre ne se ressemblent pas ;
 * seize combinaisons d'un même jeu de coordonnées, si. Et le dix-septième
 * personnage est alors gratuit.
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

/**
 * Les huit silhouettes, énumérées pour que les tests puissent les compter.
 *
 * Elles étaient déduites des clefs de la table des tracés, qui n'existe plus :
 * le portrait n'est plus dessiné ici. Cette liste est donc ce qui reste de
 * vérifiable — qu'aucune identité ne demande une coiffure inconnue, et
 * qu'aucune coiffure ne soit déclarée sans servir.
 */
export const HAIR_SHAPES: readonly HairShape[] = [
  'court',
  'carre',
  'long',
  'queue',
  'boucle',
  'chignon',
  'mi-long',
  'couettes',
];
