import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { openCase } from './case.js';
import { murdererOf, occupantsOf } from './clues/semantics.js';
import { composeCase } from './compose/generate.js';
import { deduce } from './deduce/deduce.js';
import { REGISTRY_VERSION } from './deduce/types.js';
import { isSatisfied, solveExact } from './exact/solver.js';
import { has, intersects } from './scene/cellset.js';
import type { CaseFile } from './types.js';

/**
 * Une affaire produite, vérifiée de bout en bout.
 *
 * ─── Aucun fixture inventé ──────────────────────────────────────────────────
 *
 * Il n'y a pas une seule affaire écrite à la main dans ce fichier, et ce n'est
 * pas un oubli : la règle du projet veut qu'une grille de référence ait été
 * produite **et vérifiée par le solveur** avant d'être figée. Toutes les
 * affaires éprouvées ici sortent du générateur.
 *
 * ─── Un corpus partagé, et pourquoi ce n'est pas un renoncement ─────────────
 *
 * Les propriétés ci-dessous sont vérifiées sur un corpus produit **une fois**,
 * et non regénéré à chaque assertion. La raison est mesurée : une affaire coûte
 * 82 ms à la médiane et jusqu'à 650 ms au pire, et la première rédaction de ce
 * fichier — qui regénérait à chaque propriété — mettait vingt secondes.
 *
 * Ce qui compte est préservé : les affaires restent **engendrées**, sous des
 * graines différentes, et chaque invariant est vérifié sur toutes. Ce qui est
 * perdu est le tirage d'une nouvelle graine à chaque exécution ; les propriétés
 * qui ne coûtent rien, elles, gardent `fast-check` et son tirage.
 */

const CORPUS_SIZE = 16;

const CORPUS: readonly CaseFile[] = Array.from({ length: CORPUS_SIZE }, (_, seed) => {
  const file = composeCase(`corpus-${String(seed)}`);
  if (file === null) throw new Error(`La graine corpus-${String(seed)} n'a produit aucune affaire.`);
  return file;
});

/** Vérifie une propriété sur toutes les affaires du corpus. */
const forEachCase = (check: (file: CaseFile) => void): void => {
  for (const file of CORPUS) check(file);
};

describe('composeCase', () => {
  it('rend une affaire pour toute graine tirée au hasard', () => {
    // Un `null` n'est pas un bug — l'appelant doit savoir le traiter — mais il
    // doit rester exceptionnel : une fabrique qui échoue souvent ferait
    // attendre le joueur sans rien lui dire.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20_000 }), (seed) => {
        expect(composeCase(`libre-${String(seed)}`)).not.toBeNull();
      }),
      { numRuns: 8 },
    );
  });

  it('rejoue exactement la même affaire pour la même graine', () => {
    // Sans cela, une affaire partagée par lien ne serait pas la même chez le
    // destinataire. C'est la promesse que le PRNG seedable existe pour tenir.
    for (const file of CORPUS.slice(0, 4)) {
      expect(composeCase(file.seed)).toEqual(file);
    }
  });

  it('n’énonce que des indices vrais de sa propre solution', () => {
    forEachCase((file) => {
      expect(isSatisfied(openCase(file), file.solution)).toBe(true);
    });
  });

  it('n’admet qu’une solution, et c’est celle qu’elle range', () => {
    forEachCase((file) => {
      const found = solveExact(openCase(file), 2);
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual([...file.solution]);
    });
  });

  it('désigne un coupable qui est bien le seul autre occupant de la pièce', () => {
    forEachCase((file) => {
      const puzzle = openCase(file);
      const room = puzzle.scene.zoneOf[file.solution[file.victim]];
      expect(occupantsOf(puzzle.scene, file.solution, room)).toHaveLength(2);
      expect(murdererOf(puzzle.scene, file.solution, file.victim)).toBe(file.murderer);
    });
  });

  it('fait parler chaque suspect, sans jamais faire un discours', () => {
    // La forme du genre : une carte par personne, deux au plus. Un suspect muet
    // n'existe pas, et trois lignes sous un portrait ne se lisent pas.
    forEachCase((file) => {
      const puzzle = openCase(file);
      for (const suspect of puzzle.suspects) {
        const cards = file.clues.filter((clue) => clue.who === suspect.index);
        expect(cards.length).toBeGreaterThanOrEqual(1);
        expect(cards.length).toBeLessThanOrEqual(2);
      }
      // La victime ne dit qu'une chose, et elle ne nomme personne.
      expect(file.clues.filter((clue) => clue.who === file.victim)).toEqual([
        { kind: 'victim', who: file.victim },
      ]);
    });
  });

  it('range la version du registre qui a mesuré son chemin', () => {
    forEachCase((file) => {
      expect(file.registryVersion).toBe(REGISTRY_VERSION);
      expect(file.stepCount).toBeGreaterThan(0);
    });
  });

  it('ne produit pas seize fois la même affaire', () => {
    // Sans cette borne, un générateur bloqué sur une disposition passerait
    // toutes les propriétés ci-dessus en étant complètement inutile.
    const distinct = new Set(CORPUS.map((file) => file.solution.join()));
    expect(distinct.size).toBe(CORPUS_SIZE);
  });
});

describe('deduce', () => {
  it('termine toute affaire distribuée, sans jamais rien essayer', () => {
    /*
      La promesse la plus forte du mode, et celle que la référence du genre ne
      tient pas : des joueurs y rapportent, passé un certain palier, des affaires
      « ni très logiques ni cohérentes ».

      Ici le filtre n'est pas l'unicité mais le registre lui-même : une affaire
      qu'il ne termine pas n'est pas étiquetée « experte », elle n'est pas
      produite du tout.
    */
    forEachCase((file) => {
      const path = deduce(openCase(file));
      expect(path.solved).toBe(true);
      expect(path.hardest).toBe(file.hardest);
      expect(path.steps).toHaveLength(file.stepCount);
    });
  });

  it('ne pose jamais quelqu’un ailleurs que là où il est', () => {
    forEachCase((file) => {
      for (const step of deduce(openCase(file)).steps) {
        for (const { suspect, cell } of step.placements) {
          expect(cell).toBe(file.solution[suspect]);
        }
      }
    });
  });

  it('n’écarte jamais une case que la solution occupe', () => {
    // La même sûreté que pour la propagation, mais au niveau de l'étape : une
    // technique qui éliminerait la vérité produirait un chemin qui « résout »
    // l'affaire en la falsifiant, et la mesure serait un mensonge.
    forEachCase((file) => {
      for (const step of deduce(openCase(file)).steps) {
        for (const { suspect, cells } of step.eliminations) {
          expect(has(cells, file.solution[suspect])).toBe(false);
        }
      }
    });
  });

  it('explique chaque étape en français, en nommant sa technique', () => {
    // L'indice proposé au joueur sort d'ici, et de nulle part ailleurs : c'est
    // ce qui rend impossible qu'il se désynchronise de l'affaire, défaut
    // structurel d'un jeu dont les aides sont rédigées une par une.
    forEachCase((file) => {
      for (const step of deduce(openCase(file)).steps) {
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.explanation.endsWith('.')).toBe(true);
        expect(step.explanation).not.toMatch(/undefined|NaN|\[object/);
        expect(step.placements.length + step.eliminations.length).toBeGreaterThan(0);
      }
    });
  });

  it('met en avant ce qui reste, jamais ce qu’il vient d’écarter', () => {
    /*
      Le premier palier d'indice dit « regardez par ici ». Il s'appuie sur
      `highlights`, qui montrait d'abord le domaine **d'avant** l'élimination :
      au tout premier indice d'une affaire, c'était le plateau entier. Désigner
      trente-six cases sur trente-six ne désigne rien.

      La propriété qui l'empêche de revenir : ce qu'une étape met en avant et ce
      qu'elle écarte sont disjoints.
    */
    forEachCase((file) => {
      for (const step of deduce(openCase(file)).steps) {
        for (const shown of step.highlights) {
          const dropped = step.eliminations.filter((e) => e.suspect === shown.suspect);
          for (const cut of dropped) {
            expect(intersects(shown.cells, cut.cells)).toBe(false);
          }
        }
      }
    });
  });

  it('reprend le raisonnement là où le joueur en est', () => {
    /*
      C'est ce qui rend l'aide utilisable. Sans point de départ, le chemin repart
      du plateau vide : bon pour **mesurer** une affaire, inutile pour aider
      quelqu'un qui a déjà posé trois personnes.

      La propriété : en partant de placements **justes**, le registre termine
      toujours, et sans jamais réannoncer ce qui est déjà posé.
    */
    forEachCase((file) => {
      const puzzle = openCase(file);
      const half = file.solution.map((cell, suspect) => (suspect % 2 === 0 ? cell : -1));
      const path = deduce(puzzle, half);

      expect(path.contradicted).toBe(false);
      expect(path.solved).toBe(true);
      const announced = path.steps.flatMap((step) => step.placements.map((p) => p.suspect));
      for (let suspect = 0; suspect < half.length; suspect += 2) {
        expect(announced).not.toContain(suspect);
      }
    });
  });

  it('dit qu’il est bloqué quand les placements du joueur sont impossibles', () => {
    // L'alternative serait de proposer une déduction dans un monde qui n'existe
    // pas. Une aide qui raisonne juste sur des prémisses fausses est pire qu'une
    // aide muette.
    forEachCase((file) => {
      const puzzle = openCase(file);
      // Deux personnes sur la même rangée : la règle du plateau l'interdit.
      const impossible = file.solution.map(() => -1);
      impossible[0] = 0;
      impossible[1] = 1;
      const path = deduce(puzzle, impossible);
      expect(path.solved).toBe(false);
      expect(path.contradicted).toBe(true);
    });
  });

  it('finit toujours par poser tout le monde', () => {
    forEachCase((file) => {
      const placed = deduce(openCase(file)).steps.flatMap((step) => step.placements);
      expect(new Set(placed.map((placement) => placement.suspect)).size).toBe(
        file.solution.length,
      );
    });
  });
});
