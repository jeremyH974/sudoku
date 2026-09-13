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
 * Rejet d'une requête que l'on a volontairement abandonnée.
 *
 * Une classe à part, et non un message parmi d'autres : un arrêt demandé n'est
 * pas une panne, et l'écran ne doit pas l'afficher comme telle. C'est la seule
 * façon pour un appelant de distinguer les deux sans comparer des chaînes.
 */
export class EngineStopped extends Error {
  constructor() {
    super('Production interrompue.');
    this.name = 'EngineStopped';
  }
}

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

  /**
   * Abandonne **tout** le travail en cours, et rend la main tout de suite.
   *
   * ─── Pourquoi tuer, et non prévenir ────────────────────────────────────────
   *
   * Le gestionnaire du worker est **synchrone** : tant qu'une grille n'est pas
   * finie, il ne dépile aucun message. Un drapeau envoyé par `postMessage` ne
   * serait donc lu qu'*après* le calcul qu'il cherche à interrompre — l'arrêt
   * arriverait quand il n'a plus d'objet. Et `postMessage` d'un `AbortSignal`
   * n'existe pas : la proposition (`whatwg/dom#948`) est ouverte depuis février
   * 2021, sans activité depuis juillet 2023 et étiquetée « needs implementer
   * interest ».
   *
   * Il ne reste que la manière forte, et c'est l'idiome attesté : `workerpool`
   * annonce « the worker executing the task is enforced to terminate
   * immediately », demande poliment, puis tue au bout d'une seconde ; Comlink
   * renvoie explicitement à `terminate()` faute de mieux.
   *
   * Ce que cela coûte, **mesuré sur le paquet de production** : ressusciter le
   * worker et obtenir sa première réponse prend 36 ms à la médiane, 45 ms au pire
   * (12 requêtes) — dont 24 ms d'amorçage net. C'est sous le seuil de 100 ms où
   * une action se perçoit comme instantanée, donc inutile de garder un worker de
   * rechange au chaud comme le fait `workerpool`. Le module est bien redemandé à
   * chaque naissance, mais il fait partie du précache du service worker : il sort
   * du cache, pas du réseau.
   *
   * ⚠ Ce que cela ne garantit pas. `terminate()` rend la main en moins de
   * 0,01 ms et **plus aucune réponse n'arrive** — cela, c'est mesuré. Mais le
   * calcul lui-même n'est pas forcément arrêté : Chromium s'accorde un délai de
   * grâce (`kForcibleTerminationDelay = 2 s` dans `worker_thread.cc`) avant de
   * forcer l'arrêt du moteur JavaScript, et le « stopped at once » de MDN est
   * inexact pour Chrome — l'écart entre la spécification et les implémentations
   * est une issue ouverte (`whatwg/html#6210`). Deux sondes ont échoué à voir
   * cette queue de calcul depuis la page : avec soixante travailleurs en boucle
   * infinie, le débit du fil principal était indiscernable du repos. **Elle
   * reste donc non mesurée, et l'affirmer autrement serait mentir.** Firefox,
   * lui, interrompt tout de suite (`JS_RequestInterruptCallback`).
   *
   * ⚠ Et cela emporte **tout** ce qui est en vol, pas seulement l'appelant : un
   * seul worker sert toute l'application. C'est assumé plutôt que contourné —
   * comme il traite les requêtes à la file, une grille de partie coincée derrière
   * quarante grilles de cahier attendait de toute façon des minutes. Les deux
   * appelants concernés le disent à l'écran.
   */
  stop(): void {
    const worker = this.#worker;
    this.#worker = null;

    /*
      Rejeter à la main : `terminate()` ne touche pas aux promesses en attente,
      et Comlink #428 le dit noir sur blanc. Sans cette boucle, un appelant
      attendrait une réponse qui ne viendra jamais.

      Vidé **avant** de tuer, pour qu'aucun message en transit ne retrouve son
      entrée.
    */
    const abandoned = [...this.#pending.values()];
    this.#pending.clear();
    worker?.terminate();
    for (const pending of abandoned) pending.reject(new EngineStopped());
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
