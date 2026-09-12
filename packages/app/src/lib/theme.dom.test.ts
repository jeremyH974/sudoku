import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Le module applique le thème au document dès sa construction : on le recharge à
  chaque cas, comme pour la taille du texte, et on repose devant lui les deux
  balises qu'`index.html` déclare et que le document de test n'a pas.
*/
async function freshStore(): Promise<typeof import('./theme.svelte.js')> {
  vi.resetModules();
  return await import('./theme.svelte.js');
}

const HEAD = `
  <meta name="theme-color" content="#1f4e8c" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#16171a" media="(prefers-color-scheme: dark)" />
`;

const declared = (): HTMLMetaElement[] => [
  ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
];

/**
 * La couleur que le navigateur retiendrait sous un système donné : la première
 * balise qui s'applique. C'est la règle du standard, et c'est elle qu'on
 * exploite — une balise sans `media` s'applique toujours.
 */
function effective(scheme: 'light' | 'dark'): string | undefined {
  // L'attribut, pas la propriété : jsdom n'implémente pas `HTMLMetaElement.media`.
  return declared().find((meta) => {
    const media = meta.getAttribute('media') ?? '';
    return media === '' || media.includes(scheme);
  })?.content;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = HEAD;
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '';
});

describe('couleur de la barre d’adresse', () => {
  it('laisse les deux balises au système tant qu’aucun thème n’est choisi', async () => {
    const { theme } = await freshStore();
    theme.set('system');
    expect(declared()).toHaveLength(2);
    expect(effective('light')).toBe('#1f4e8c');
    expect(effective('dark')).toBe('#16171a');
  });

  it('fait gagner le choix explicite, dans les deux sens', async () => {
    // Le défaut que ce code corrige : un thème sombre choisi à la main sur une
    // machine en clair laissait la barre d'adresse bleue au-dessus d'une page
    // noire — et l'inverse est tout aussi vrai.
    const { theme } = await freshStore();
    theme.set('dark');
    expect(effective('light')).toBe('#16171a');
    expect(effective('dark')).toBe('#16171a');

    theme.set('light');
    expect(effective('light')).toBe('#1f4e8c');
    expect(effective('dark')).toBe('#1f4e8c');
  });

  it('rend la main au système quand on revient à « système »', async () => {
    const { theme } = await freshStore();
    theme.set('dark');
    theme.set('system');
    expect(declared()).toHaveLength(2);
    expect(effective('light')).toBe('#1f4e8c');
    expect(effective('dark')).toBe('#16171a');
  });

  it('n’empile pas les balises à chaque changement', async () => {
    const { theme } = await freshStore();
    theme.set('dark');
    theme.set('light');
    theme.set('dark');
    // Les deux d'`index.html`, plus une seule balise de choix.
    expect(declared()).toHaveLength(3);
  });

  it('accorde la barre au choix retrouvé dès le chargement', async () => {
    const first = await freshStore();
    first.theme.set('dark');

    // Une page fraîche : les deux balises d'`index.html`, et rien d'autre.
    document.head.innerHTML = HEAD;
    const second = await freshStore();
    expect(second.theme.preference).toBe('dark');
    expect(effective('light')).toBe('#16171a');
  });
});
