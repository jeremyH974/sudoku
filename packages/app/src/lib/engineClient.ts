import type { GenerateAtLevelOptions, LeveledPuzzle, Rating } from '@sudoku/engine';
import type { CaseFile, ComposeOptions } from '@sudoku/engine/investigation';
import type { WorkerRequest, WorkerResponse } from './engine.worker.js';

/**
 * `Omit` appliqué à une union la réduit à ses propriétés communes. Cette
 * variante conditionnelle se distribue sur chaque membre et préserve donc la
 * discrimination par `type`.
 */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/**
 * Façade au-dessus du Web Worker qui héberge le moteur.
 *
 * Une seule instance suffit : les requêtes sont numérotées et résolues par
 * promesse, le worker les traite l'une après l'autre. Créer un worker par appel
 * coûterait bien plus cher que la file d'attente.
 */
class EngineClient {
  #worker: Worker | null = null;
  #nextId = 1;
  readonly #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();

  /**
   * Le worker n'est créé qu'au premier appel : une page qui ne génère rien ne
   * paie pas son démarrage.
   */
  #ensureWorker(): Worker {
    if (this.#worker !== null) return this.#worker;

    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.#pending.get(response.id);
      if (pending === undefined) return;
      this.#pending.delete(response.id);
      if (response.ok) pending.resolve(response.payload);
      else pending.reject(new Error(response.error));
    });

    worker.addEventListener('error', (event) => {
      const failure = new Error(`Le moteur a échoué : ${event.message}`);
      for (const pending of this.#pending.values()) pending.reject(failure);
      this.#pending.clear();
    });

    this.#worker = worker;
    return worker;
  }

  #send<T>(request: WithoutId<WorkerRequest>): Promise<T> {
    const worker = this.#ensureWorker();
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ ...request, id });
    });
  }

  generateAtLevel(options: GenerateAtLevelOptions): Promise<LeveledPuzzle | null> {
    return this.#send<LeveledPuzzle | null>({ type: 'generate-at-level', options });
  }

  rate(puzzle: Uint8Array): Promise<Rating> {
    return this.#send<Rating>({ type: 'rate', puzzle });
  }

  /**
   * Une affaire du mode Enquête, ou `null` si la graine n'en a pas donné.
   *
   * Le `null` remonte tel quel jusqu'à l'écran, qui doit savoir le dire. Le
   * masquer derrière une nouvelle tentative silencieuse ferait attendre le
   * joueur sans rien lui montrer — c'est le défaut que l'application se refuse
   * déjà pour la génération de grilles.
   */
  composeCase(seed: string, options: ComposeOptions = {}): Promise<CaseFile | null> {
    return this.#send<CaseFile | null>({ type: 'compose-case', seed, options });
  }
}

export const engine = new EngineClient();
