/**
 * Doublure de `virtual:pwa-register`.
 *
 * Ce module est fabriqué par `vite-plugin-pwa`, qui n'est pas chargé sous
 * Vitest : sans doublure, monter l'application entière échouerait sur un import
 * introuvable. Elle ne simule rien — un service worker n'a rien à faire dans un
 * test d'accessibilité, et prétendre le contraire donnerait une fausse
 * assurance.
 */
export function registerSW(): () => Promise<void> {
  return () => Promise.resolve();
}
