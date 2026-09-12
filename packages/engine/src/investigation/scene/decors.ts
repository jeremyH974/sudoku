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

/**
 * Le pavillon — 6×6, cinq pièces, et un couloir qui traverse.
 *
 * Ce que ce décor fait varier n'est pas le nom des pièces, c'est la **régularité
 * du plan** — et ce n'est pas ce que j'avais prédit.
 *
 * L'hypothèse était qu'un couloir de six cases en ligne rendrait « à côté »
 * beaucoup plus rare que « dans la même pièce ». La mesure l'a démentie : un
 * couloir de 6×1 donne 5 paires adjacentes sur 15, soit exactement la même
 * proportion qu'un carré de 3×3 (12 sur 36). Les deux valent 33 %.
 *
 * Ce que le pavillon fait réellement, et qu'aucun autre décor livré ne fait,
 * c'est **uniformiser** : ses cinq pièces tiennent entre 33 % et 47 %, là où le
 * manoir s'étale de 29 % à 67 %. Partout des indices de force comparable, contre
 * un mélange de pièces décisives et de pièces vagues ailleurs.
 */
const PAVILION: Decor = {
  id: 'pavilion',
  title: 'Le pavillon',
  size: 6,
  zones: [
    { key: 'H', name: 'Couloir', article: 'le' },
    { key: 'A', name: 'Salon', article: 'le' },
    { key: 'B', name: 'Bureau', article: 'le' },
    { key: 'C', name: 'Cuisine', article: 'la' },
    { key: 'D', name: 'Véranda', article: 'la' },
  ],
  plan: [
    'AAAHBB', //
    'AAAHBB',
    'AAAHBB',
    'CCCHDD',
    'CCCHDD',
    'CCCHDD',
  ],
  legend: { c: 'chair', t: 'table', r: 'rug', p: 'plant', e: 'shelf', l: 'lamp' },
  furniture: [
    [
      'e..l.t', //
      '.rr..c',
      'c.p..e',
      '.t.lpp',
      'rr.c.t',
      '.pe..c',
    ],
    // Une chaise sur le tapis du salon, une autre sur celui de la cuisine :
    // deux cases où « assis sur une chaise » et « sur un tapis » coïncident.
    [
      '......', //
      '.c....',
      '......',
      '......',
      'c.....',
      '......',
    ],
  ],
};

/**
 * L'atelier — 6×6, cinq pièces, dont une grande en escalier.
 *
 * Ici c'est le **rapport d'aire** qui change, et le coude. L'atelier fait douze
 * cases contre quatre au cagibi, et sa forme en escalier éloigne deux de ses
 * coins au point qu'aucun indice de voisinage ne peut les relier.
 *
 * Aucune source ne chiffre le rapport d'aire acceptable pour ce genre de jeu —
 * la recherche l'a cherché et ne l'a pas trouvé. Trois est donc un choix, pas
 * une valeur reprise, et c'est le générateur qui l'a validé, pas un article.
 */
const WORKSHOP: Decor = {
  id: 'workshop',
  title: "L'atelier",
  size: 6,
  zones: [
    { key: 'S', name: 'Atelier', article: "l'" },
    { key: 'U', name: 'Réserve', article: 'la' },
    { key: 'T', name: 'Cagibi', article: 'le' },
    { key: 'V', name: 'Escalier', article: "l'" },
    { key: 'W', name: 'Galerie', article: 'la' },
  ],
  plan: [
    'SSSSSS', //
    'SSSSUU',
    'SSTTUU',
    'VVTTUU',
    'VVWWWW',
    'VVWWWW',
  ],
  legend: { c: 'chair', t: 'table', r: 'rug', p: 'plant', e: 'shelf', l: 'lamp' },
  furniture: [
    [
      '.ee.lp', //
      'rr.c.t',
      'rr.ec.',
      'l.tp..',
      'c.rr.e',
      't.rrp.',
    ],
    // Une chaise sur le tapis de l'atelier, une autre sur celui de la galerie.
    [
      '......', //
      'c.....',
      '......',
      '......',
      '...c..',
      '......',
    ],
  ],
};

/**
 * La rotonde — 6×6, cinq pièces autour d'un pivot compact.
 *
 * L'opposé du pavillon, et c'est le propos : le pivot fait quatre cases en
 * carré, où quatre paires sur six sont adjacentes. « Il était dans le hall » y
 * est un indice fort — quatre cases seulement — mais « il était à côté d'elle »
 * n'y ajoute presque rien. Les deux grandes pièces font l'inverse.
 *
 * Comparé au pavillon à rapport d'aire voisin, ce décor isole l'effet de la
 * **forme** du pivot, élancé contre compact.
 */
const ROTUNDA: Decor = {
  id: 'rotunda',
  title: 'La rotonde',
  size: 6,
  zones: [
    { key: 'N', name: 'Terrasse', article: 'la' },
    { key: 'W', name: 'Office', article: "l'" },
    { key: 'H', name: 'Hall', article: 'le' },
    { key: 'E', name: 'Fumoir', article: 'le' },
    { key: 'S', name: 'Salle à manger', article: 'la' },
  ],
  plan: [
    'NNNNNN', //
    'NNNNNN',
    'WWHHEE',
    'WWHHEE',
    'SSSSSS',
    'SSSSSS',
  ],
  legend: { c: 'chair', t: 'table', r: 'rug', p: 'plant', e: 'shelf', l: 'lamp' },
  furniture: [
    [
      'p.ee.l', //
      '.rr..c',
      'c.rr.t',
      'e.rr.p',
      'l.ttc.',
      '.p..e.',
    ],
    // Une chaise sur le tapis de la terrasse, une autre sur celui du hall.
    [
      '......', //
      '.c....',
      '...c..',
      '......',
      '......',
      '......',
    ],
  ],
};

/**
 * Les décors livrés.
 *
 * Ils se distinguent par leur **géométrie**, jamais par le nom de leurs pièces :
 * un couloir qui traverse, une grande salle en escalier, un pivot compact. Le
 * nom d'une pièce ne change rien au raisonnement ; sa forme, si.
 */
export const DECORS: readonly Decor[] = [MANOR, PAVILION, WORKSHOP, ROTUNDA];

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

/**
 * Les identifiants en double, s'il y en a.
 *
 * `loadDecor` fait un `.find()` : un identifiant répété masquerait le second
 * décor en silence, sans erreur et sans qu'aucun test existant ne le voie. Le
 * genre de défaut qui ne se manifeste que le jour où l'on se demande pourquoi
 * un décor livré ne sort jamais.
 */
export function duplicateDecorIds(): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const decor of DECORS) {
    if (seen.has(decor.id)) duplicates.add(decor.id);
    seen.add(decor.id);
  }
  return [...duplicates];
}
