import { generateAtLevel, generatePuzzle, rate } from '@sudoku/engine';
import type { GenerateAtLevelOptions, GenerateOptions } from '@sudoku/engine';
import { composeCase } from '@sudoku/engine/investigation';
import type { ComposeOptions } from '@sudoku/engine/investigation';

/**
 * Le moteur, déporté hors du fil principal.
 *
 * Ce n'est pas une précaution de principe : la mesure a tranché. Produire une
 * grille de niveau Expert demande environ une seconde et demie, une grille
 * Diabolique jusqu'à huit secondes, parce qu'atteindre les paliers élevés exige
 * une recherche dirigée et non un simple tirage. Bloquer l'interface aussi
 * longtemps serait inacceptable — la page ne répondrait plus, pas même au
 * défilement.
 *
 * Les grilles voyagent en `Uint8Array`, que le clonage structuré transmet sans
 * conversion.
 */

export type WorkerRequest =
  | { readonly id: number; readonly type: 'generate-at-level'; readonly options: GenerateAtLevelOptions }
  | { readonly id: number; readonly type: 'generate'; readonly options: GenerateOptions }
  | { readonly id: number; readonly type: 'rate'; readonly puzzle: Uint8Array }
  | {
      readonly id: number;
      readonly type: 'compose-case';
      readonly seed: string;
      readonly options: ComposeOptions;
    };

export type WorkerResponse =
  | { readonly id: number; readonly ok: true; readonly payload: unknown }
  | { readonly id: number; readonly ok: false; readonly error: string };

function handle(request: WorkerRequest): unknown {
  switch (request.type) {
    case 'generate-at-level':
      return generateAtLevel(request.options);
    case 'generate':
      return generatePuzzle(request.options);
    case 'rate':
      return rate(request.puzzle);
    // Une affaire coûte 122 ms à la médiane et jusqu'à 470 ms au pire : moins
    // qu'une grille Expert, mais bien plus qu'une image à trente par seconde.
    // Elle passe donc par ici comme le reste.
    case 'compose-case':
      return composeCase(request.seed, request.options);
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    const payload = handle(request);
    const response: WorkerResponse = { id: request.id, ok: true, payload };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
});
