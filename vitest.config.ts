import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Le plugin Svelte sert a compiler les fichiers `*.svelte.ts` : la logique de
  // partie vit dans une classe a runes, et elle merite d'etre testee au meme
  // titre que le moteur.
  plugins: [svelte({ configFile: false })],
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
