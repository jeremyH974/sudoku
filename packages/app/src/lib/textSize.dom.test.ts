import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Le module tient un état de session : on le recharge à chaque cas pour lire
  vraiment ce que le stockage contient au démarrage, et non ce qu'un cas
  précédent y a laissé.
*/
async function freshStore(): Promise<typeof import('./textSize.svelte.js')> {
  vi.resetModules();
  return await import('./textSize.svelte.js');
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-text-size');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-text-size');
});

describe('taille du texte', () => {
  it('démarre sur la taille normale', async () => {
    const { textSize } = await freshStore();
    expect(textSize.size).toBe('normal');
  });

  it('pose un attribut pour les tailles agrandies', async () => {
    const { textSize } = await freshStore();
    textSize.set('large');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
    textSize.set('xlarge');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('xlarge');
  });

  it('retire l’attribut pour la taille normale, au lieu d’y écrire une valeur', async () => {
    // Même règle que « système » pour le thème : l'état neutre est une absence.
    // Écrire `data-text-size="normal"` obligerait la feuille de style à le
    // neutraliser explicitement, et une valeur oubliée y resterait coincée.
    const { textSize } = await freshStore();
    textSize.set('xlarge');
    textSize.set('normal');
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
    expect(localStorage.getItem('sudoku.text-size')).toBeNull();
  });

  it('retrouve le choix au chargement suivant', async () => {
    const first = await freshStore();
    first.textSize.set('large');

    const second = await freshStore();
    expect(second.textSize.size).toBe('large');
  });

  it('ignore une valeur de stockage qu’il ne reconnaît pas', async () => {
    localStorage.setItem('sudoku.text-size', 'énorme');
    const { textSize } = await freshStore();
    expect(textSize.size).toBe('normal');
  });
});
