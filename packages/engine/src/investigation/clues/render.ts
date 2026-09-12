import type { Suspect } from '../cast.js';
import { PROPS, type Scene, type Zone } from '../scene/types.js';
import type { Clue, Direction } from './types.js';

/**
 * Le français des indices.
 *
 * Ce fichier est un **rendu**, pas une source de vérité : le solveur ne le lit
 * jamais. C'est ce qui met le mode à l'abri du défaut observé chez la référence
 * du genre, où l'indice *est* la phrase — et où une traduction maladroite rend
 * l'affaire insoluble. Ici, une faute ci-dessous se voit et se corrige sans
 * qu'aucune affaire ne devienne fausse.
 *
 * L'accord en genre n'est pas une politesse : « Elle était seule » et « Il était
 * seul » ne s'écrivent pas pareil, et une phrase mal accordée fait buter le
 * joueur sur la langue au lieu de la déduction.
 */

const ORDINALS: readonly string[] = [
  'première',
  'deuxième',
  'troisième',
  'quatrième',
  'cinquième',
  'sixième',
  'septième',
  'huitième',
  'neuvième',
  'dixième',
  'onzième',
  'douzième',
  'treizième',
  'quatorzième',
  'quinzième',
  'seizième',
];

const NUMBERS: readonly string[] = [
  'zéro',
  'une',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
];

const COMPASS: Readonly<Record<Direction, string>> = {
  north: 'au nord',
  south: 'au sud',
  east: "à l'est",
  west: "à l'ouest",
};

/**
 * Élision devant une voyelle.
 *
 * Le « h » n'élide pas ici : la distribution ne contient qu'un prénom en h,
 * Hugo, dont l'usage veut « de Hugo ». Traiter tous les h comme muets écrirait
 * « d'Hugo », qui se lit mal.
 */
const VOWEL = /^[aeiouàâäéèêëîïôöùûü]/i;

const elide = (particle: string, word: string): string =>
  VOWEL.test(word) ? `${particle.slice(0, -1)}'${word}` : `${particle} ${word}`;

/** « de Bruno », « d'Adèle ». */
export const of_ = (name: string): string => elide('de', name);

/** « que Bruno », « qu'Élise ». */
export const than = (name: string): string => elide('que', name);

/** « dans le Salon », « dans la Bibliothèque », « dans l'Office ». */
export const inZone = (zone: Zone): string =>
  zone.article === "l'" ? `dans l'${zone.name}` : `dans ${zone.article} ${zone.name}`;

/** « Adèle (A) » — le nom, et la lettre qu'on pose sur le plateau. */
export const labelOf = (suspect: Suspect): string => `${suspect.name} (${suspect.letter})`;

/** L'accord d'un adjectif : « seul » / « seule ». */
const agreed = (suspect: Suspect, word: string): string =>
  suspect.gender === 'f' ? `${word}e` : word;

/** Le pronom sujet, avec le verbe : « Elle était » / « Il était ». */
const subject = (suspect: Suspect): string => (suspect.gender === 'f' ? 'Elle était' : 'Il était');

/** La forme négative : « Elle n'était pas ». */
const negated = (suspect: Suspect): string =>
  suspect.gender === 'f' ? "Elle n'était pas" : "Il n'était pas";

const opening = (suspect: Suspect, not: boolean): string =>
  not ? negated(suspect) : subject(suspect);

/** L'indice, en français, prêt à l'affichage. */
export function renderClue(clue: Clue, scene: Scene, suspects: readonly Suspect[]): string {
  const who = suspects[clue.who];

  switch (clue.kind) {
    case 'on-prop': {
      const kind = PROPS[clue.prop];
      const article = kind.gender === 'f' ? 'une' : 'un';
      // « assise sur une chaise » mais « sur un tapis » : la langue distingue,
      // et le meuble porte la distinction.
      const verb = kind.seated ? `${agreed(who, 'assis')} sur` : 'sur';
      return `${opening(who, clue.not)} ${verb} ${article} ${kind.noun}.`;
    }

    case 'next-to-prop': {
      const kind = PROPS[clue.prop];
      const article = kind.gender === 'f' ? "d'une" : "d'un";
      return `${opening(who, clue.not)} à côté ${article} ${kind.noun}.`;
    }

    case 'in-zone':
      return `${opening(who, clue.not)} ${inZone(scene.zones[clue.zone])}.`;

    case 'in-band': {
      const noun = clue.axis === 'row' ? 'rangée' : 'colonne';
      return `${subject(who)} dans la ${ORDINALS[clue.index]} ${noun}.`;
    }

    case 'direction':
      return `${subject(who)} ${COMPASS[clue.direction]} ${of_(suspects[clue.other].name)}.`;

    case 'offset': {
      const noun = clue.direction === 'north' || clue.direction === 'south' ? 'rangée' : 'colonne';
      const plural = clue.distance > 1 ? 's' : '';
      return (
        `${subject(who)} exactement ${NUMBERS[clue.distance]} ${noun}${plural} ` +
        `${COMPASS[clue.direction]} ${of_(suspects[clue.other].name)}.`
      );
    }

    case 'same-zone':
      return (
        `${opening(who, clue.not)} dans la même pièce ` +
        `${than(suspects[clue.other].name)}.`
      );

    case 'alone':
      return `${subject(who)} ${agreed(who, 'seul')}.`;

    case 'alone-with':
      return `${subject(who)} ${agreed(who, 'seul')} avec ${suspects[clue.other].name}.`;

    case 'victim':
      return `La victime. ${subject(who)} ${agreed(who, 'seul')} avec le meurtrier.`;
  }
}
