import { defineConfig } from 'vitest/config';

/**
 * Configuration dediee aux mesures de performance (`pnpm measure`).
 * Volontairement separee de la suite de tests : ces mesures sont longues,
 * dependantes de la machine, et n'ont donc rien a faire dans la CI.
 */
export default defineConfig({
  test: {
    include: ['packages/*/scripts/**/*.perf.ts'],
    testTimeout: 300_000,
    // Sans ca, vitest avale les sorties et les mesures ne s'affichent pas.
    disableConsoleIntercept: true,
  },
});
