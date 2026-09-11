import { describe, expect, it } from 'vitest';
import { LOOP_GUARD_MS, createUpdatePolicy } from './updatePolicy.js';

/*
  La politique décide seule, sans service worker : ce qu'elle doit garantir se
  vérifie donc sans navigateur. Le bout en bout — une vraie version qui paraît,
  un vrai rechargement — a été éprouvé à part, dans un Chrome sans interface.
*/

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Un stockage de session en mémoire, partagé entre deux « chargements ». */
function memoryStore(): SessionStore {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const T0 = 1_000_000;

describe('mise à jour à l’ouverture', () => {
  it('applique une nouvelle version tant que personne n’a touché à la page', () => {
    const policy = createUpdatePolicy({ target: new EventTarget(), storage: memoryStore(), now: () => T0 });
    expect(policy.decide()).toBe('apply');
  });

  it.each(['pointerdown', 'keydown', 'wheel'])('se contente de la proposer après un « %s »', (type) => {
    // Le premier geste fait d'une page ouverte une page en usage : on ne
    // recharge plus sous les doigts, la bannière reprend la main.
    const target = new EventTarget();
    const policy = createUpdatePolicy({ target, storage: memoryStore(), now: () => T0 });
    target.dispatchEvent(new Event(type));
    expect(policy.decide()).toBe('offer');
  });

  it('ne rebascule pas dans la minute : une boucle serait pire que la bannière', () => {
    const storage = memoryStore();
    let clock = T0;
    const now = (): number => clock;
    expect(createUpdatePolicy({ target: new EventTarget(), storage, now }).decide()).toBe('apply');

    // La page rechargée, dans le même onglet, annoncerait encore une version.
    clock += LOOP_GUARD_MS - 1;
    expect(createUpdatePolicy({ target: new EventTarget(), storage, now }).decide()).toBe('offer');

    // Passé le délai, c'est une nouvelle version, pas une boucle.
    clock += 2;
    expect(createUpdatePolicy({ target: new EventTarget(), storage, now }).decide()).toBe('apply');
  });

  it('revient à la bannière sans stockage de session', () => {
    const policy = createUpdatePolicy({ target: new EventTarget(), storage: null, now: () => T0 });
    expect(policy.decide()).toBe('offer');
  });

  it('revient à la bannière si le stockage refuse l’écriture', () => {
    const refusing: SessionStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const policy = createUpdatePolicy({ target: new EventTarget(), storage: refusing, now: () => T0 });
    expect(policy.decide()).toBe('offer');
  });
});
