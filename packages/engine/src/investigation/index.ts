/**
 * Enquête — le second type de puzzle du projet.
 *
 * Module frère de `logic/`, et non une variante de sudoku : un plateau où l'on
 * place des personnes, une par rangée et une par colonne, sous des indices qui
 * parlent du plan. `docs/plan-increment-11.md` dit pourquoi cela ne passe pas
 * par une abstraction commune.
 *
 * Comme le reste du moteur : aucune dépendance, aucun accès au DOM.
 */
export * from './cast.js';
export * from './types.js';
export * from './case.js';
export * from './board.js';
export * from './scene/index.js';
export * from './clues/index.js';
export * from './deduce/index.js';
export * from './exact/index.js';
export * from './compose/index.js';
