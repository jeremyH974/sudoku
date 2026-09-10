import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Service worker et enregistreur produits par le plugin PWA.
      '**/dev-dist/**',
      // Les composants Svelte sont verifies par svelte-check, qui comprend
      // leur syntaxe ; typescript-eslint ne sait pas les parser sans plugin.
      '**/*.svelte',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Le moteur manipule des TypedArrays et des bitmasks : les non-null
      // assertions sur des index bornes par construction sont volontaires.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.bench.ts', '*.config.ts', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
