import type { Decor } from './types.js';

/**
 * Les décors, écrits à la main comme données.
 *
 * Un plan se relit à l'œil : une lettre par case, une chaîne par rangée. C'est
 * délibéré, et c'est ce qui distingue un décor d'un tableau de coordonnées —
 * une pièce mal découpée se voit ici sans exécuter quoi que ce soit.
 *
 * Le mobilier vit en **calques** superposés. Un seul calque ne saurait pas dire
 * qu'une chaise est posée sur un tapis, et c'est justement ce genre de case qui
 * rend un indice intéressant : « la seule personne assise sur une chaise » et
 * « sur un tapis » peuvent alors désigner la même case, ou non.
 *
 * Le décor est une **donnée pure** : rien, en aval, ne sait s'il a été écrit ou
 * engendré. C'est le point de couture prévu par `docs/plan-increment-11.md`.
 */

/**
 * Le manoir — 6×6, cinq pièces.
 *
 * Réglé pour que les indices aient prise sans être triviaux : chaque meuble
 * apparaît deux à cinq fois. Un meuble unique ferait de son indice un
 * placement immédiat ; un meuble sur un tiers du plateau n'éliminerait rien.
 */
const MANOR: Decor = {
  id: 'manor',
  title: 'Le manoir',
  size: 6,
  zones: [
    { key: 'S', name: 'Salon', article: 'le' },
    { key: 'B', name: 'Bibliothèque', article: 'la' },
    { key: 'C', name: 'Couloir', article: 'le' },
    { key: 'K', name: 'Cuisine', article: 'la' },
    { key: 'J', name: "Jardin d'hiver", article: 'le' },
  ],
  plan: [
    'SSSSBB', //
    'SSSSBB',
    'SSCCBB',
    'KKCCBB',
    'KKKJJJ',
    'KKKJJJ',
  ],
  legend: { c: 'chair', t: 'table', r: 'rug', p: 'plant', e: 'shelf', l: 'lamp' },
  furniture: [
    [
      'l..cee', //
      '.rr..c',
      '.r.pee',
      't.p..l',
      'ct.pc.',
      '....p.',
    ],
    // La chaise du salon est posée sur le tapis. Un seul calque ne le dirait pas.
    [
      '......', //
      '.c....',
      '......',
      '......',
      '......',
      '......',
    ],
  ],
};

export const DECORS: readonly Decor[] = [MANOR];

/**
 * Le décor d'identifiant donné.
 *
 * Tout passe par ici, et c'est la couture : le jour où un décor sera engendré
 * plutôt qu'écrit, seule cette fonction changera.
 */
export function loadDecor(id: string): Decor {
  const decor = DECORS.find((candidate) => candidate.id === id);
  if (decor === undefined) throw new Error(`Décor inconnu : « ${id} ».`);
  return decor;
}
