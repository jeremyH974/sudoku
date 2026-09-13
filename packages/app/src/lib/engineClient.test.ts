import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineStopped, engine } from './engineClient.js';

/**
 * L'arrêt du moteur, vérifié sans démarrer de vrai Web Worker.
 *
 * ─── Pourquoi une doublure, et ce qu'elle ne prétend pas ────────────────────
 *
 * Ce qui se vérifie ici est la **tenue des promesses** : qu'un arrêt rejette
 * tout ce qui est en vol, qu'il le fasse avec une erreur qu'on peut reconnaître,
 * et qu'un worker ressuscite au coup suivant. Aucun de ces trois points ne
 * demande un vrai travailleur, et les vérifier sur un vrai serait les vérifier à
 * travers huit secondes de calcul.
 *
 * Ce que la doublure **ne dit pas** : que `terminate()` interrompe réellement un
 * calcul synchrone. Cela relève du navigateur, c'est mesuré à la main, et le
 * résultat — ainsi que ce qui reste non mesuré — est écrit dans `engineClient.ts`.
 */

/** Un travailleur de mensonge : il retient les messages et se laisse tuer. */
class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly sent: unknown[] = [];
  terminated = false;
  readonly #listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const bucket = this.#listeners.get(type) ?? [];
    bucket.push(listener);
    this.#listeners.set(type, bucket);
  }

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Fait remonter une réponse, comme le ferait le vrai worker. */
  answer(payload: unknown): void {
    const id = (this.sent.at(-1) as { id: number }).id;
    for (const listener of this.#listeners.get('message') ?? []) {
      listener({ data: { id, ok: true, payload } });
    }
  }

  /** Fait remonter une réponse pour un identifiant précis. */
  answerId(id: number, payload: unknown): void {
    for (const listener of this.#listeners.get('message') ?? []) {
      listener({ data: { id, ok: true, payload } });
    }
  }

  /** Une panne au niveau du travailleur lui-même : module illisible, jet au sommet. */
  breakDown(message: string): void {
    for (const listener of this.#listeners.get('error') ?? []) listener({ message });
  }

  fail(error: string): void {
    const id = (this.sent.at(-1) as { id: number }).id;
    for (const listener of this.#listeners.get('message') ?? []) {
      listener({ data: { id, ok: false, error } });
    }
  }
}

/**
 * Lance une requête dont on n'attendra pas la réponse.
 *
 * Le `catch` vide n'est pas une négligence : l'arrêt de fin de test rejette tout
 * ce qui reste en vol, et un rejet sans destinataire fait échouer la suite. C'est
 * exactement le piège que `game.svelte.ts` avait — sauf que là, il était réel.
 */
const fire = (promise: Promise<unknown>): void => {
  promise.catch(() => undefined);
};

const live = (): FakeWorker => {
  const last = FakeWorker.instances.at(-1);
  if (last === undefined) throw new Error('Aucun travailleur créé.');
  return last;
};

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  // Remet le client à zéro : `stop()` relâche le worker, donc le suivant naîtra.
  engine.stop();
  vi.unstubAllGlobals();
});

describe('le client du moteur', () => {
  it('ne crée un travailleur qu’au premier appel', () => {
    expect(FakeWorker.instances).toHaveLength(0);
    fire(engine.generateAtLevel({ level: 'facile' }));
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('réutilise le même travailleur pour les appels suivants', () => {
    fire(engine.generateAtLevel({ level: 'facile' }));
    fire(engine.generateAtLevel({ level: 'moyen' }));
    expect(FakeWorker.instances).toHaveLength(1);
    expect(live().sent).toHaveLength(2);
  });

  it('rejette ce qui est en vol avec une erreur reconnaissable', async () => {
    const pending = engine.generateAtLevel({ level: 'diabolique' });
    engine.stop();
    await expect(pending).rejects.toBeInstanceOf(EngineStopped);
    /*
      Le message compte : il se retrouve dans le bandeau du studio si quelqu'un
      le laisse passer pour une panne. Qu'il soit lisible n'est pas décoratif.
    */
    await expect(pending).rejects.toThrow('Production interrompue.');
  });

  it('tue le travailleur, et rejette **tout** ce qui attend', async () => {
    const first = engine.generateAtLevel({ level: 'expert' });
    const second = engine.generateAtLevel({ level: 'maitre' });
    const third = engine.rate(new Uint8Array(81));
    const worker = live();

    engine.stop();

    expect(worker.terminated).toBe(true);
    // Un seul worker sert toute l'application : l'arrêt emporte la partie en
    // cours autant que le cahier. C'est assumé, et documenté comme tel.
    await expect(first).rejects.toBeInstanceOf(EngineStopped);
    await expect(second).rejects.toBeInstanceOf(EngineStopped);
    await expect(third).rejects.toBeInstanceOf(EngineStopped);
  });

  it('ressuscite un travailleur neuf au coup suivant', async () => {
    fire(engine.generateAtLevel({ level: 'facile' }));
    const killed = live();
    engine.stop();

    const revived = engine.generateAtLevel({ level: 'facile' });
    expect(FakeWorker.instances).toHaveLength(2);
    expect(live()).not.toBe(killed);
    expect(live().terminated).toBe(false);

    live().answer(null);
    await expect(revived).resolves.toBeNull();
  });

  it('ne s’émeut pas d’un arrêt sans rien en vol', () => {
    expect(() => {
      engine.stop();
      engine.stop();
    }).not.toThrow();
    // Rien à tuer, donc rien à faire naître.
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('ne réattribue jamais un identifiant abandonné', async () => {
    /*
      C'est la protection réelle contre un traînard. `terminate()` vide la file du
      port, donc en pratique la réponse d'un worker tué n'arrive pas — mais s'y
      fier serait se fier au navigateur. Ce qui rend l'accident impossible ici est
      que le compteur **ne repart pas de zéro** à la résurrection : une réponse
      égarée ne peut pas retrouver l'entrée de quelqu'un d'autre.
    */
    const abandoned = engine.generateAtLevel({ level: 'expert' });
    const killed = live();
    const abandonedId = (killed.sent[0] as { id: number }).id;
    engine.stop();
    await expect(abandoned).rejects.toBeInstanceOf(EngineStopped);

    const fresh = engine.generateAtLevel({ level: 'facile' });
    const revivedId = (live().sent[0] as { id: number }).id;
    expect(revivedId).toBeGreaterThan(abandonedId);

    // Et la réponse de feu le premier worker ne trouble ni la promesse déjà
    // rejetée, ni celle qui vient de naître.
    killed.answerId(abandonedId, { puzzle: [] });
    live().answer(null);
    await expect(fresh).resolves.toBeNull();
  });

  it('relâche le travailleur quand il tombe en panne', async () => {
    /*
      Défaut antérieur, devenu visible avec `stop()` : l'écouteur d'erreur
      rejetait les promesses **sans** lâcher le worker. `#ensureWorker` rendait
      donc éternellement un worker mort, les `postMessage` partaient dans le vide,
      et une partie restait bloquée sur « Génération… » jusqu'au rechargement.
      L'écran promet désormais que « la grille en cours est conservée » — donc
      qu'un nouvel essai est possible. Il doit l'être.
    */
    const doomed = engine.generateAtLevel({ level: 'expert' });
    const dead = live();
    dead.breakDown('module illisible');
    await expect(doomed).rejects.toThrow('module illisible');

    const retry = engine.generateAtLevel({ level: 'facile' });
    expect(FakeWorker.instances).toHaveLength(2);
    expect(live()).not.toBe(dead);
    live().answer(null);
    await expect(retry).resolves.toBeNull();
  });

  it('ignore la panne d’un travailleur déjà abandonné', async () => {
    /*
      Tant qu'il n'y avait qu'un worker pour la vie de la page, la question ne se
      posait pas. Depuis qu'on en tue et qu'on en refait, une erreur émise par un
      worker abandonné rejetterait les requêtes de son **successeur** : un message
      de panne pour un incident qui ne concerne plus personne.
    */
    fire(engine.generateAtLevel({ level: 'expert' }));
    const abandoned = live();
    engine.stop();

    const fresh = engine.composeCase('graine');
    abandoned.breakDown('râle du mourant');

    live().answer(null);
    await expect(fresh).resolves.toBeNull();
  });

  it('laisse une vraie panne se distinguer d’un arrêt', async () => {
    const pending = engine.composeCase('graine');
    live().fail('le décor n’existe pas');
    await expect(pending).rejects.toThrow('le décor n’existe pas');
    await expect(pending).rejects.not.toBeInstanceOf(EngineStopped);
  });
});
