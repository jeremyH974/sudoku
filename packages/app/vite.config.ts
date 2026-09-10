import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      /*
        « prompt » et non « autoUpdate ».

        Recharger la page sous les doigts de quelqu'un en train de résoudre une
        grille est brutal, même sans perte de données — et une partie est en
        cours la plupart du temps. Une bannière discrète laisse la main.
      */
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sudoku — générateur et jeu',
        short_name: 'Sudoku',
        description:
          'Générateur et jeu de Sudoku : difficulté mesurée, indices qui expliquent, cahiers imprimables. Sans publicité ni compte.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1f4e8c',
        background_color: '#f7f7f5',
        categories: ['games', 'puzzle', 'education'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          /*
            Une entrée « maskable » distincte : les lanceurs Android rognent
            l'icône en cercle. Le même fichier convient parce que le dessin tient
            dans la zone sûre — 18 % de marge — mais il faut le déclarer, sinon
            le système suppose que l'image ne peut pas être rognée et l'entoure
            d'un cadre blanc disgracieux.
          */
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        /*
          Précaching complet : l'application pèse une cinquantaine de
          kilo-octets compressés, moteur compris. Il n'y a rien à arbitrer entre
          ce qu'on met en cache et ce qu'on laisse au réseau — d'autant qu'il
          n'y a aucun réseau à solliciter une fois la page chargée.
        */
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        /*
          Runtime Workbox intégré au service worker plutôt que chargé à part.

          Par défaut le plugin émet un `sw.js` minuscule qui va chercher son
          runtime dans un second fichier, via un shim AMD et `importScripts`.
          Deux fichiers, deux requêtes et un chargeur de modules là où un seul
          fichier de seize kilo-octets — mis en cache une fois pour toutes —
          suffit. Moins de pièces mobiles au démarrage du service worker, donc
          moins de choses à diagnostiquer le jour où il refuse de s'enregistrer.
        */
        inlineWorkboxRuntime: true,
      },
      /*
        Service worker désactivé en développement, volontairement.

        L'activer paraît pratique — vérifier le hors-ligne sans construire — mais
        le piège est sévère : le service worker de développement reste enregistré
        sur `localhost` après l'arrêt du serveur, intercepte les requêtes et sert
        un cache périmé. On se retrouve alors devant une page blanche, ou pire,
        devant une version d'il y a deux heures, sans que rien ne l'indique. Le
        symptôme a été rencontré pendant cet incrément et coûte un long moment à
        diagnostiquer.

        Le hors-ligne se vérifie sur un vrai build : `pnpm build`, puis
        `vite preview`.
      */
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
});
