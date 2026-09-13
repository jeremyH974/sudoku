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
      /*
        Le harnais du lecteur d'ecran. Il vit hors des `tsconfig` a dessein :
        il depend de `@guidepup/guidepup`, qui n'est **pas** une dependance du
        depot — cent six megaoctets de NVDA portable pour une validation qu'on
        execute a la main quelques fois par an. Les regles typees ne peuvent pas
        s'y appliquer sans ce projet, et l'y rattacher ferait entrer la
        dependance. Voir `docs/lecteur-decran.md`, section « Rejouer ».
      */
      'scripts/**',
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
