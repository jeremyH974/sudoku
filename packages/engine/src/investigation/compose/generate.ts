import { createRng, type Rng } from '../../rng/index.js';
import { castOf, type Suspect } from '../cast.js';
import { occupantsOf } from '../clues/semantics.js';
import type { Clue } from '../clues/types.js';
import { deduce } from '../deduce/deduce.js';
import { REGISTRY_VERSION } from '../deduce/types.js';
import { solveExact } from '../exact/solver.js';
import { buildScene } from '../scene/scene.js';
import { DECORS, loadDecor } from '../scene/decors.js';
import type { Decor, Scene } from '../scene/types.js';
import type { CaseFile, Puzzle } from '../types.js';
import { candidatesFor, crimeScenes, familyOf, FAMILY_WEIGHT } from './candidates.js';

/**
 * La fabrique d'affaires.
 *
 * ─── Pourquoi une recherche, et pas une construction ────────────────────────
 *
 * On ne sait pas écrire directement un jeu d'indices qui détermine une
 * disposition et une seule. Ce qu'on sait faire, et qui est l'état de l'art
 * pour ce type de puzzle : partir de la solution, **énumérer les indices qui y
 * sont vrais**, puis chercher dans cette réserve un jeu qui ne laisse qu'elle.
 *
 * Deux conséquences qui tiennent tout le mode :
 *
 *   - **aucun indice ne peut être faux.** Il vient d'une réserve construite en
 *     vérifiant chaque énoncé sur la solution. L'énoncé ne peut pas contredire
 *     le corrigé, et ce n'est pas une relecture qui le garantit ;
 *   - **aucune affaire ne sort si le registre ne sait pas la résoudre.** Le
 *     dernier filtre n'est pas l'unicité mais `deduce()` : une affaire qui
 *     demanderait d'essayer une case pour voir est jetée, pas étiquetée
 *     « expert ».
 *
 * La recherche est une montée de colline plutôt qu'un tirage : une carte
 * remplacée au hasard est conservée si elle ne dégrade pas le compte des
 * solutions. Les paliers se franchissent par les mouvements latéraux, d'où
 * l'acceptation des scores égaux.
 */

/**
 * Deux, et c'est le seuil exact de la question qu'on pose.
 *
 * Le seul appelant de `countSolutions` compare à **un** : « cette disposition
 * est-elle bien la seule ? ». Une seconde solution suffit à répondre non, et
 * tout ce que le solveur chercherait au-delà est jeté.
 *
 * Il n'en reste qu'un depuis l'incrément 19 : `carve` taille désormais contre la
 * déductibilité, et ce comptage ne sert plus qu'une fois, à la toute fin, pour
 * revérifier ce que le générateur affirme.
 *
 * Le plafond valait douze. Le commentaire justifiait qu'il y **ait** un
 * plafond, jamais qu'il vaille douze — et le `countSolutions` du sudoku, lui,
 * s'arrête à deux depuis toujours. Mesuré sur quatre cents graines, sortie
 * identique sur 400/400 : **−12,0 %** sur la somme, **−15,3 %** sur le pire
 * cas. C'est gratuit, parce qu'on ne renonce à aucune information.
 */
const SOLUTION_CAP = 2;

export interface ComposeOptions {
  readonly decorId?: string;
  /**
   * Nombre de dispositions différentes essayées avant d'abandonner.
   *
   * ⚠ Une tentative ne coûte que lorsqu'elle sert : la boucle sort à la
   * première disposition qui donne une affaire. Un budget large est donc
   * gratuit pour les graines qui réussissent tout de suite, et c'est la seule
   * chose qui sauve les autres.
   *
   * Mesuré : à 40, **0,8 % des graines ne rendaient rien** — et toutes
   * réussissaient à 120. Le défaut n'était pas le hasard, c'était le budget.
   *
   * Le prix est dans la queue, et il est assumé : sur 400 graines, le pire cas
   * passe de 0,5 à 2,8 secondes, parce qu'une graine difficile insiste au lieu
   * d'abandonner. La médiane, elle, ne bouge pas (135 ms) — et une affaire se
   * compose dans un Worker, sous un libellé qui dit « Composition… ».
   * Faire attendre trois secondes vaut mieux que ne rien rendre.
   *
   * ⚠ Remesuré depuis, les quatre décors mêlés : p50 282 ms, p90 931 ms,
   * p99 3 051 ms, pire **4 352 ms**, toujours zéro graine stérile sur 400. Les
   * trois décors ajoutés sont plus lents que le manoir — le pavillon surtout,
   * dont les cinq pièces donnent des indices de force trop voisine pour que le
   * retrait glouton tranche vite. Le seuil du banc est passé à 6 000 ms en
   * conséquence, avec la mesure écrite à côté.
   */
  readonly attempts?: number;
  /**
   * Nombre maximal de répliques par suspect.
   *
   * Trois lignes sous un portrait se lisent mal, et le genre n'en donne jamais
   * plus de deux. Une affaire dont un suspect en exige davantage est écartée au
   * profit d'une autre disposition — ce qui est gratuit, puisque la disposition
   * suivante coûte une dizaine de millisecondes.
   */
  readonly maxCards?: number;
  /**
   * Un décor fourni directement, plutôt que cherché dans le registre.
   *
   * C'est la couture prévue pour le jour où les décors seront **engendrés** : un
   * générateur produit un objet, pas un identifiant, et n'a aucune raison de
   * l'inscrire dans un registre global avant de savoir s'il est bon. Prend le
   * pas sur `decorId` quand les deux sont donnés.
   *
   * Elle sert déjà : c'est ainsi qu'un décor volontairement dégénéré est soumis
   * au générateur dans les tests, sans être livré aux joueurs pour autant.
   */
  readonly decor?: Decor;
}

/**
 * Le décor d'une graine, quand l'appelant n'en impose pas.
 *
 * Trois décors ont été écrits, et aucun joueur ne les aurait vus : `composeCase`
 * gardait « manoir » en dur et rien, dans l'application, ne passait autre chose.
 * Un décor livré mais jamais choisi est du poids mort.
 *
 * Le tirage a **son propre générateur**, semé sur un dérivé de la graine, pour
 * ne pas consommer un tour de celui qui place les suspects : les deux décisions
 * restent indépendantes et lisibles. Il reste entièrement déterministe — même
 * graine, même décor —, ce que la promesse du lien partagé exige.
 */
function decorForSeed(seed: string): string {
  return DECORS[createRng(`${seed}:décor`).nextInt(DECORS.length)].id;
}

/**
 * Une affaire, ou `null` si la graine n'en a pas donné.
 *
 * Renvoyer `null` plutôt que de boucler est délibéré : l'appelant décide quoi
 * faire d'un échec — réessayer avec une autre graine, ou le dire. Une fabrique
 * qui ne rend jamais la main est une fabrique qui fige un onglet.
 */
export function composeCase(seed: string, options: ComposeOptions = {}): CaseFile | null {
  const attempts = options.attempts ?? 200;
  const maxCards = options.maxCards ?? 2;

  const rng = createRng(seed);
  const scene = buildScene(options.decor ?? loadDecor(options.decorId ?? decorForSeed(seed)));
  /*
    L'identifiant rangé dans l'affaire vient du décor **réellement employé**, pas
    de l'option reçue : c'est lui que `openCase` rechargera. Une affaire composée
    sur un décor non enregistré porte donc un identifiant introuvable, et c'est
    juste — elle n'est ni partageable ni rejouable, seulement mesurable.
  */
  const decorId = scene.id;
  const suspects = castOf(scene.size);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const at = randomPlacement(scene, suspects.length, rng);

    // Une affaire exige une pièce à deux personnes : sans elle, « seule avec le
    // meurtrier » n'a personne à désigner. Une disposition qui n'en offre pas
    // est écartée — c'est le cas le plus fréquent d'échec, et le moins cher.
    const rooms = crimeScenes(scene, at);
    if (rooms.length === 0) continue;

    const pair = occupantsOf(scene, at, rooms[rng.nextInt(rooms.length)]);
    const victim = pair[rng.nextInt(2)];
    const murderer = pair[0] === victim ? pair[1] : pair[0];

    const pool = suspects.map((suspect) => candidatesFor(scene, at, suspect.index, victim));
    if (pool.some((cards) => cards.length === 0)) continue;

    const cards = carve(scene, suspects, victim, pool, rng);
    if (cards === null) continue;
    if (cards.some((card) => card.length > maxCards)) continue;

    const clues = flatten(cards);
    const path = deduce({ scene, suspects, victim, clues });
    if (!path.solved || path.hardest === null) continue;

    /*
      Ceinture et bretelles, une fois par affaire produite et non une fois par
      retrait : on revérifie ce que le générateur affirme.

      La déductibilité **implique** l'unicité, parce qu'aucune technique du
      registre ne devine — `deduce.test.ts` le tient. Mais cette implication est
      désormais porteuse de correction, et une technique nouvelle qui se
      tromperait ne serait rattrapée par rien d'autre. Trois cents appels pour
      trois cents affaires : le coût est celui d'une signature au bas d'une page.
    */
    if (countSolutions(scene, suspects, victim, clues) !== 1) continue;

    return {
      decorId,
      seed,
      clues,
      victim,
      solution: at,
      murderer,
      registryVersion: REGISTRY_VERSION,
      hardest: path.hardest,
      stepCount: path.steps.length,
    };
  }

  return null;
}

/**
 * Une disposition au hasard : une permutation des rangées, une des colonnes.
 *
 * C'est toute la règle du plateau. Deux permutations indépendantes donnent
 * exactement les dispositions valides, sans rejet — il n'y a donc rien à
 * vérifier ensuite.
 */
function randomPlacement(scene: Scene, count: number, rng: Rng): number[] {
  const rows = rng.shuffle([...Array(count).keys()]);
  const columns = rng.shuffle([...Array(count).keys()]);
  return rows.map((row, suspect) => row * scene.size + columns[suspect]);
}

/**
 * Taille le jeu de cartes : partir de **tout** ce qui est vrai, puis retirer.
 *
 * ─── Deux algorithmes essayés, et pourquoi celui-ci ─────────────────────────
 *
 * Les deux premières versions cherchaient un jeu de cartes en **ajoutant** : une
 * carte au hasard par personne, puis des remplacements — d'abord au hasard
 * (760 ms par affaire), puis dirigés en gardant le meilleur de quelques tirages
 * (1 800 ms, et une affaire sur vingt perdue). La version dirigée était la plus
 * lente des deux, ce qui est contre-intuitif et instructif : le compte de
 * solutions **plafonné** est un mauvais guide, parce que presque tout jeu de
 * cartes passe déjà sous le plafond. Le gradient était plat ; c'étaient les
 * mouvements latéraux de la marche au hasard qui faisaient le travail.
 *
 * Celui-ci fait l'inverse, et c'est la méthode que la littérature retient pour
 * ce type de puzzle : on part de **tous** les indices vrais et on retire tant
 * que le jeu reste jouable. Un seul parcours, une vérification par carte, aucun
 * retour en arrière.
 *
 * ─── Ce que « jouable » veut dire, et pourquoi cela a changé ────────────────
 *
 * Jusqu'à l'incrément 19, le critère de retrait était **l'unicité** : on comptait
 * les solutions. C'était plus faible que ce qu'on distribue, et la différence se
 * payait cher. Une affaire à solution unique n'est pas forcément **déductible** :
 * le solveur exact a le droit d'essayer, le registre non. `composeCase` taillait
 * donc contre un critère, puis jetait le résultat contre un autre — et 38 % des
 * tailles terminées mouraient là, après avoir payé la centaine de comptages que
 * coûte un parcours complet.
 *
 * Le critère est maintenant **la déductibilité**, et l'unicité vient avec. Le
 * raisonnement est celui de Seta (*The Complexities of Puzzles, Cross Sum and
 * their Another Solution Problems*, Université de Tokyo, 2002, chapitre 4) :
 * si l'on taille contre un solveur volontairement faible qui ne devine jamais,
 * une dérivation complète ne peut désigner qu'une disposition. L'unicité cesse
 * d'être une chose à vérifier pour devenir une conséquence.
 *
 * Cela **repose entièrement** sur la solidité du registre, et `deduce.test.ts`
 * la tient désormais comme une propriété : aucune étape ne contredit jamais la
 * solution, y compris sur les jeux d'indices amaigris que ce parcours traverse.
 * Une technique nouvelle qui devinerait casserait ce test avant de casser une
 * affaire.
 *
 * ─── Mesuré, sur 400 graines ────────────────────────────────────────────────
 *
 * |                        | avant     | après   |
 * |------------------------|-----------|---------|
 * | total                  | 40,5 s    | 11,3 s  |
 * | médiane                | 63 ms     | 19 ms   |
 * | p99                    | 570 ms    | 103 ms  |
 * | pire cas               | 609 ms    | 129 ms  |
 * | tailles pour 400 cas   | 4 089     | 1 287   |
 * | appels au solveur exact| 580 024   | **400** |
 *
 * Les affaires produites **changent** — c'est un changement de conception, pas
 * une optimisation, et il a été autorisé comme tel. Ce qui ne change pas : la
 * longueur moyenne d'une affaire (8,7 → 8,9 indices), la répartition des décors
 * (identique), et celle des techniques de pic. Le seul déplacement visible est
 * une raréfaction des affaires triviales, dont la déduction la plus dure n'était
 * qu'une lecture d'indice : dix sur quatre cents, contre quatre.
 *
 * Rien de ce qui est déjà distribué n'en souffre : un code d'affaire porte
 * l'affaire elle-même, jamais la graine qui l'a produite.
 *
 * L'ordre de retrait est le seul hasard, et il porte le goût de l'affaire : les
 * familles de faible poids sont examinées en premier, donc retirées en premier,
 * donc c'est le mobilier qui survit. Deux graines donnent deux affaires
 * différentes sur la même disposition.
 */
function carve(
  scene: Scene,
  suspects: readonly Suspect[],
  victim: number,
  pool: readonly (readonly Clue[])[],
  rng: Rng,
): Clue[][] | null {
  const cards: Clue[][] = pool.map((cluesOfSuspect) => [...cluesOfSuspect]);
  // Le jeu complet contient la rangée et la colonne de chacun : le registre le
  // déduit sans effort. La vérification reste, parce qu'un filtre d'utilité mal
  // réglé pourrait un jour retirer ces cartes de la réserve.
  if (!deducible(scene, suspects, victim, cards)) return null;

  for (const { who, card } of removalOrder(cards, victim, rng)) {
    if (cards[who].length <= 1) continue;
    const kept = cards[who];
    const without = kept.filter((held) => held !== card);
    cards[who] = without;
    if (!deducible(scene, suspects, victim, cards)) cards[who] = kept;
  }

  return cards;
}

/**
 * Le jeu de cartes se déduit-il **sans deviner** ?
 *
 * C'est le critère de taille depuis l'incrément 19, et il a remplacé le comptage
 * de solutions. Le raisonnement est celui de Seta (*The Complexities of Puzzles*,
 * 2002, chapitre 4) : une dérivation **saine** et complète ne peut désigner
 * qu'une disposition, donc l'unicité vient gratuitement avec la déductibilité.
 * `deduce.test.ts` tient la prémisse — aucune étape ne contredit jamais la
 * solution, y compris sur des jeux d'indices amaigris comme ceux-ci.
 */
function deducible(
  scene: Scene,
  suspects: readonly Suspect[],
  victim: number,
  cards: readonly (readonly Clue[])[],
): boolean {
  return deduce({ scene, suspects, victim, clues: flatten(cards) }).solved;
}

/**
 * L'ordre dans lequel on tente les retraits.
 *
 * Une carte examinée tôt est retirée plus souvent — le jeu est encore large,
 * donc son absence se compense. On examine donc en premier ce qu'on veut voir
 * disparaître : les colonnes et rangées nues, puis les relations, et en dernier
 * le mobilier et les pièces, qui sont ce qui fait une scène de crime plutôt
 * qu'un exercice de coordonnées.
 */
function removalOrder(
  cards: readonly (readonly Clue[])[],
  victim: number,
  rng: Rng,
): { who: number; card: Clue }[] {
  const entries: { who: number; card: Clue; key: number }[] = [];
  for (let who = 0; who < cards.length; who++) {
    if (who === victim) continue;
    for (const card of cards[who]) {
      entries.push({ who, card, key: rng.nextFloat() * FAMILY_WEIGHT[familyOf(card)] });
    }
  }
  entries.sort((left, right) => left.key - right.key);
  return entries.map(({ who, card }) => ({ who, card }));
}

/** Les cartes, mises à plat dans l'ordre où le joueur les lit. */
function flatten(cards: readonly (readonly Clue[])[]): Clue[] {
  return cards.flatMap((card) => card);
}

function countSolutions(
  scene: Scene,
  suspects: readonly Suspect[],
  victim: number,
  clues: readonly Clue[],
): number {
  const puzzle: Puzzle = { scene, suspects, victim, clues };
  return solveExact(puzzle, SOLUTION_CAP).length;
}

