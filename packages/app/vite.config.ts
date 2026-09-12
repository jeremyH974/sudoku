import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/** Un chemin d'entrée, résolu contre ce fichier plutôt que contre le répertoire courant. */
const entry = (file: string): string => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  /*
    La base : le nom du dépôt, écrit en dur et sans condition.

    L'application est publiée sur GitHub Pages, à l'adresse annoncée dans le
    README, donc servie sous `/sudoku/`. Deux formulations ont été écartées, pour
    la même raison :

      · `base: './'` — Vite ramène `'./'` à `'/'` en mode `serve`. Le serveur de
        développement et `vite preview` serviraient donc à la racine pendant que
        la construction produirait des chemins relatifs : on ne vérifierait
        jamais localement la configuration réellement déployée ;
      · un branchement sur l'environnement — le même défaut, en plus explicite.

    Une base absolue et inconditionnelle fait l'inverse : `pnpm dev` sert sous
    `/sudoku/` (la racine y redirige), `vite preview` aussi, et un chemin absolu
    oublié casse ici avant de casser en ligne. C'est le raisonnement de
    `devOptions: { enabled: false }` plus bas : on refuse la commodité qui
    fabrique une réalité de développement différente de la vraie.

    Déménager l'application coûte cette ligne et l'adresse du README ;
    `packages/cli/src/appBase.test.ts` vérifie que les deux ne divergent pas.
  */
  base: '/sudoku/',
  /*
    Trois entrées, et non une application à routeur.

    Le site a une page d'accueil et deux sections. Les construire séparément
    donne exactement ce qu'on cherche, et qu'un routeur ne donnerait pas :
    **un joueur de sudoku ne télécharge jamais le moteur d'Enquête**, et
    l'accueil ne télécharge ni l'un ni l'autre. Chaque section est aussi libre de
    son habillage, ce qui est la raison d'être de la séparation.

    Un hébergeur statique sert cela nativement : `…/enquete/` trouve
    `enquete/index.html` sans aucune réécriture d'URL. C'est la même exigence
    « zéro backend » que le reste du projet.
  */
  build: {
    rollupOptions: {
      input: {
        accueil: entry('index.html'),
        sudoku: entry('sudoku/index.html'),
        enquete: entry('enquete/index.html'),
      },
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      /*
        « prompt » et non « autoUpdate ».

        Recharger la page sous les doigts de quelqu'un en train de résoudre une
        grille est brutal, même sans perte de données — et une partie est en
        cours la plupart du temps. Une bannière discrète laisse la main.

        « prompt » ne veut pas dire attendre indéfiniment : `UpdateBanner.svelte`
        applique d'office une version en attente à l'ouverture, avant le premier
        geste. À la mise en ligne, une bannière passée inaperçue avait laissé
        l'auteur lui-même sur une version corrigée depuis.
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
        /*
          `json` fait partie de la liste pour une raison précise : le corpus des
          défis quotidiens. Sans lui, le défi du jour serait la seule chose de
          l'application à exiger le réseau — exactement la promesse qu'on tient
          face aux concurrents, dont le quotidien vient d'un serveur.
        */
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        /*
          Une exception, et une seule : l'image d'aperçu des liens partagés. Elle
          pèse quarante-sept kilo-octets, ne s'affiche jamais dans
          l'application — seuls les robots des réseaux sociaux l'ouvrent — et
          `png` la ferait entrer dans le cache de chaque visiteur.
        */
        globIgnores: ['**/og-image.png'],
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
