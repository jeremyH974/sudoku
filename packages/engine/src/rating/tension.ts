import { REGISTRY } from '../logic/registry.js';
import { LogicState } from '../logic/state.js';
import type { Position, SolveLogicallyOptions } from '../logic/solve.js';
import type { Step } from '../logic/types.js';

/**
 * Les issues d'une position : combien de coups différents peut-on jouer ici.
 *
 * ─── Pourquoi cette mesure, et pas celle que le plan annonçait ──────────────
 *
 * Le plan stratégique définissait la « tension » comme le nombre d'étapes où une
 * seule technique débloque la suite. Mesuré sur 1 928 étapes : en moyenne 8,8
 * entrées du registre s'appliquent à chaque étape, et **0,3 %** n'en ont qu'une.
 * Cette définition rendrait zéro pour presque toute grille.
 *
 * La raison est structurelle : poser un chiffre le retire des candidats de vingt
 * voisines, si bien qu'un single caché réapparaît presque toujours quelque part.
 * Ce n'est donc pas le jeu qui est tendu en général — c'est **l'instant où la
 * grille exige sa technique la plus difficile** qui l'est, ou ne l'est pas.
 *
 * ─── L'unité comptée : la conclusion, jamais le motif ───────────────────────
 *
 * Un même coup se justifie souvent deux fois. Un single caché se voit à la fois
 * dans sa boîte et dans sa ligne ; une paire nue et la paire cachée
 * complémentaire écartent exactement les mêmes candidats. Compter les motifs
 * ferait dépendre la mesure du **découpage de notre registre** : ajouter demain
 * une technique qui redémontre une élimination connue ferait monter le compte
 * sans qu'aucune grille n'ait changé.
 *
 * On compte donc ce qui change sur le plateau. Un cas reste compté deux fois,
 * sciemment : une paire pointante et sa variante « Direct » concluent la même
 * élimination **plus** un placement — ce sont deux coups différents pour le
 * joueur, et le second est plus facile à voir.
 */
export interface WayForward {
  /** Le premier pas trouvé qui aboutit à cette conclusion, donc le moins cher. */
  readonly step: Step;
  /** Motifs distincts menant à la même conclusion. Toujours ≥ 1. */
  readonly patterns: number;
}

/** Ce que le coup change sur le plateau, sous une forme comparable. */
function conclusionOf(step: Step): string {
  const placements = step.placements
    .map((p) => `${String(p.cell)}=${String(p.digit)}`)
    .sort()
    .join(',');
  const eliminations = step.eliminations
    .map((e) => `${String(e.cell)}-${String(e.digit)}`)
    .sort()
    .join(',');
  return `${placements}|${eliminations}`;
}

/**
 * Toutes les issues d'une position, par difficulté croissante.
 *
 * Rend `null` si la position est incohérente : il n'y a alors rien à compter, et
 * un zéro se confondrait avec « bloquée ». Un tableau vide, lui, est une
 * réponse — le registre ne tire plus rien de cette position.
 *
 * Coût mesuré : ~1,4 ms, contre ~1,35 ms pour noter la grille entière. À
 * n'appeler qu'à la demande, **jamais** depuis `rate()` ni depuis la marche
 * locale du générateur, qui appelle `rate()` jusqu'à quatre cents fois par
 * grille produite.
 */
export function waysForward(
  position: Position,
  options: SolveLogicallyOptions = {},
): WayForward[] | null {
  const state = LogicState.fromSnapshot(position.values, position.candidates);
  if (state === null) return null;

  const registry = options.registry ?? REGISTRY;
  const byConclusion = new Map<string, { step: Step; patterns: number }>();

  for (const entry of registry) {
    for (const step of entry.findAll(state)) {
      const key = conclusionOf(step);
      const seen = byConclusion.get(key);
      // Le registre est trié par difficulté croissante : le premier pas trouvé
      // pour une conclusion est le moins cher, donc celui qu'on garde.
      if (seen === undefined) byConclusion.set(key, { step, patterns: 1 });
      else seen.patterns++;
    }
  }

  return [...byConclusion.values()].sort((a, b) => a.step.difficulty - b.step.difficulty);
}
