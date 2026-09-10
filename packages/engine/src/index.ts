/**
 * @sudoku/engine — moteur de génération, résolution et (a venir) notation.
 *
 * Aucune dépendance, aucun accès au DOM ni au stockage. C'est ce qui permet de
 * le faire tourner indifféremment dans un navigateur, un Web Worker, Node, ou
 * un futur outil en ligne de commande.
 */
export * from './rng/index.js';
export * from './grid/index.js';
export * from './solver/index.js';
export * from './generate/index.js';
export * from './logic/index.js';
export * from './io/index.js';
