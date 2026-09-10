import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATS_VERSION, appendRecord, clearRecords, loadRecords } from './stats.js';
import type { GameRecord } from './stats.js';

/**
 * Même `localStorage` de papier que `storage.test.ts`, pour les mêmes raisons :
 * il n'existe pas sous Node, et c'est le seul moyen de reproduire les cas qui
 * cassent une application en production — quota, navigation privée, corruption.
 */
class MemoryStorage {
  #data = new Map<string, string>();
  throwOnWrite = false;
  throwOnAccess = false;

  getItem(key: string): string | null {
    if (this.throwOnAccess) throw new Error('accès refusé');
    return this.#data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnAccess || this.throwOnWrite) throw new Error('quota dépassé');
    this.#data.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOnAccess) throw new Error('accès refusé');
    this.#data.delete(key);
  }

  poke(key: string, value: string): void {
    this.#data.set(key, value);
  }

  peek(key: string): string | null {
    return this.#data.get(key) ?? null;
  }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('localStorage', store);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

let counter = 0;
function makeRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  counter++;
  return {
    id: `grille-${String(counter)}`,
    finishedAt: 1_700_000_000_000 + counter * 1000,
    day: '2026-09-10',
    daily: null,
    level: 'moyen',
    score: 2.3,
    ratingVersion: 4,
    durationMs: 300_000,
    hintsShown: 0,
    hintsApplied: 0,
    mistakes: 0,
    lesson: null,
    ...overrides,
  };
}

describe('historique des parties', () => {
  it('rend un historique vide quand rien n’a jamais été joué', () => {
    expect(loadRecords()).toEqual([]);
  });

  it('conserve une partie enregistrée', () => {
    const record = makeRecord({ level: 'expert', durationMs: 900_000 });
    expect(appendRecord(record)).toBe(true);

    const back = loadRecords();
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ level: 'expert', durationMs: 900_000, ratingVersion: 4 });
  });

  it('n’enregistre pas deux fois la même grille le même jour', () => {
    // Deux onglets ouverts sur le même défi, ou une reprise après
    // rechargement : le compteur ne doit pas gonfler.
    const record = makeRecord({ id: 'meme-grille', daily: '2026-09-10' });
    appendRecord(record);
    appendRecord({ ...record, finishedAt: record.finishedAt + 60_000, durationMs: 1 });

    const back = loadRecords();
    expect(back).toHaveLength(1);
    // La première complétion gagne : c'est celle qui a vraiment eu lieu.
    expect(back[0].durationMs).toBe(300_000);
  });

  it('accepte la même grille rejouée un autre jour', () => {
    const record = makeRecord({ id: 'meme-grille' });
    appendRecord(record);
    appendRecord({ ...record, day: '2026-09-11' });
    expect(loadRecords()).toHaveLength(2);
  });

  it('relit le stockage avant d’écrire, plutôt que d’écraser sa propre vision', () => {
    appendRecord(makeRecord());
    // Un autre onglet écrit pendant ce temps.
    const other = loadRecords();
    store.poke(
      'sudoku.stats',
      JSON.stringify({
        version: STATS_VERSION,
        records: [...other, makeRecord({ id: 'venue-d-ailleurs' })],
        savedAt: '2026-09-10T10:00:00.000Z',
      }),
    );

    appendRecord(makeRecord({ id: 'la-notre' }));
    const ids = loadRecords().map((r) => r.id);
    expect(ids).toContain('venue-d-ailleurs');
    expect(ids).toContain('la-notre');
  });

  it('écarte les parties malformées sans perdre les autres', () => {
    appendRecord(makeRecord({ id: 'bonne' }));
    const file = JSON.parse(store.peek('sudoku.stats')!) as { records: unknown[] };
    file.records.push({ id: 42, finishedAt: 'hier' });
    file.records.push(makeRecord({ id: 'bonne-aussi' }));
    store.poke('sudoku.stats', JSON.stringify(file));

    const back = loadRecords();
    expect(back.map((r) => r.id)).toEqual(['bonne', 'bonne-aussi']);
  });

  it('refuse une partie dont le jour n’est pas un jour réel', () => {
    const file = {
      version: STATS_VERSION,
      records: [makeRecord({ day: '2026-02-31' }), makeRecord({ id: 'valide' })],
      savedAt: '2026-09-10T10:00:00.000Z',
    };
    store.poke('sudoku.stats', JSON.stringify(file));
    expect(loadRecords().map((r) => r.id)).toEqual(['valide']);
  });

  it('met en quarantaine un contenu illisible au lieu de l’écraser', () => {
    store.poke('sudoku.stats', '{ ceci n’est pas du JSON');
    expect(loadRecords()).toEqual([]);
    // Le contenu original doit rester récupérable.
    expect(store.peek('sudoku.stats.bak')).toBe('{ ceci n’est pas du JSON');
  });

  it('met en quarantaine un historique écrit par une version plus récente', () => {
    const future = JSON.stringify({
      version: STATS_VERSION + 1,
      records: [makeRecord()],
      savedAt: '2027-01-01T00:00:00.000Z',
    });
    store.poke('sudoku.stats', future);

    expect(loadRecords()).toEqual([]);
    expect(store.peek('sudoku.stats.bak')).toBe(future);
  });

  it('complète les champs absents plutôt que de rejeter la partie', () => {
    // Une partie écrite avant l'ajout des compteurs d'indices : elle reste
    // parfaitement exploitable, avec des zéros.
    const partial = { ...makeRecord() } as unknown as Record<string, unknown>;
    delete partial['hintsShown'];
    delete partial['hintsApplied'];
    delete partial['mistakes'];
    store.poke(
      'sudoku.stats',
      JSON.stringify({ version: STATS_VERSION, records: [partial], savedAt: '' }),
    );

    const back = loadRecords();
    expect(back).toHaveLength(1);
    expect(back[0].hintsShown).toBe(0);
    expect(back[0].hintsApplied).toBe(0);
  });

  it('ne taille jamais les défis quotidiens', () => {
    // Un quotidien effacé raccourcirait rétroactivement la plus longue série.
    const days = Array.from({ length: 40 }, (_, i) => {
      const date = new Date(2026, 0, 1 + i, 12);
      return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    });
    for (const [i, day] of days.entries()) {
      appendRecord(makeRecord({ id: `quotidien-${String(i)}`, daily: day, day }));
    }
    for (let i = 0; i < 600; i++) {
      appendRecord(makeRecord({ id: `libre-${String(i)}` }));
    }

    const back = loadRecords();
    const dailies = back.filter((r) => r.daily !== null);
    expect(dailies).toHaveLength(40);
    // Et l'historique ne grossit pas indéfiniment pour autant.
    expect(back.length).toBeLessThan(600);
  });

  it('signale un échec d’écriture au lieu de le taire', () => {
    // Contrairement à la sauvegarde de partie, silencieuse à dessein : ici le
    // joueur croirait son historique conservé.
    store.throwOnWrite = true;
    expect(appendRecord(makeRecord())).toBe(false);
  });

  it('survit à un stockage entièrement indisponible', () => {
    store.throwOnAccess = true;
    expect(() => loadRecords()).not.toThrow();
    expect(loadRecords()).toEqual([]);
    expect(appendRecord(makeRecord())).toBe(false);
    expect(() => clearRecords()).not.toThrow();
  });

  it('efface l’historique sur demande explicite', () => {
    appendRecord(makeRecord());
    clearRecords();
    expect(loadRecords()).toEqual([]);
  });
});
