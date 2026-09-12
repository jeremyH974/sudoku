<script lang="ts">
  import Icon from '../lib/Icon.svelte';
  import UpdateBanner from '../lib/UpdateBanner.svelte';
  import { forwardedFrom } from './entry.js';

  /*
    L'accueil du site : deux jeux, et rien d'autre.

    Il ne charge ni moteur ni plateau — c'est tout l'intérêt d'une construction
    multi-pages. Quelqu'un qui vient jouer au sudoku ne télécharge jamais le
    moteur d'Enquête, et quelqu'un qui arrive ici ne télécharge ni l'un ni
    l'autre.
  */
  const base = import.meta.env.BASE_URL;

  /*
    Le renvoi des QR codes imprimés.

    `location.replace` plutôt que `href` : l'accueil n'a pas à rester dans
    l'historique, sans quoi le bouton « retour » y ramènerait aussitôt.

    Deux déclenchements, et le second n'est pas du zèle : un `#g=` peut arriver
    **sans rechargement**, quand l'accueil est déjà ouvert et qu'on suit un lien
    qui ne change que le fragment. Sans l'écouteur, ce cas-là ne renvoie nulle
    part — et c'est exactement ainsi que le défaut s'est montré, en essayant de
    le vérifier.
  */
  function followHash(): void {
    const forwarded = forwardedFrom(window.location.hash, base);
    if (forwarded !== null) window.location.replace(forwarded);
  }

  followHash();

  $effect(() => {
    window.addEventListener('hashchange', followHash);
    return () => {
      window.removeEventListener('hashchange', followHash);
    };
  });

  const GAMES = [
    {
      href: `${base}sudoku/`,
      name: 'Sudoku',
      line: 'Une difficulté mesurée, pas devinée.',
      body:
        'Le niveau vient d’un solveur qui raisonne comme un humain : il annonce la technique la ' +
        'plus difficile réellement nécessaire. Indices qui expliquent au lieu de donner la ' +
        'réponse, campagne d’apprentissage, cahiers imprimables.',
    },
    {
      href: `${base}enquete/`,
      name: 'Enquête',
      line: 'Six suspects, et ce qu’ils disent d’eux-mêmes.',
      body:
        'Un plan découpé en pièces, une personne par rangée et par colonne, et des déclarations ' +
        'à recouper. La victime était seule avec le meurtrier. Chaque affaire est engendrée, et ' +
        'aucune ne demande de deviner.',
    },
  ];
</script>

<UpdateBanner />

<div class="page">
  <header class="masthead">
    <h1>
      <span class="mark" aria-hidden="true"><Icon name="brand" /></span>
      Deux jeux de logique
    </h1>
    <p class="promise">Rien à installer. Aucune publicité, aucun compte, aucun suivi.</p>
  </header>

  <main id="contenu">
    <h2 class="sr-only">Choisir un jeu</h2>
    <ul class="games">
      {#each GAMES as game (game.name)}
        <li>
          <a class="game" href={game.href}>
            <span class="name">{game.name}</span>
            <span class="line">{game.line}</span>
            <span class="body">{game.body}</span>
          </a>
        </li>
      {/each}
    </ul>
  </main>

  <footer class="foot">
    <p>
      Tout tourne dans le navigateur : aucune requête réseau une fois la page chargée, et les deux
      jeux fonctionnent hors ligne une fois visités.
    </p>
  </footer>
</div>

<style>
  .page {
    display: grid;
    gap: var(--space-6);
    max-width: var(--board-max);
    margin-inline: auto;
    padding: var(--space-6) var(--space-4) var(--space-7);
  }

  .masthead {
    display: grid;
    gap: var(--space-2);
  }

  h1 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0;
    font-size: var(--text-xl);
    line-height: var(--leading-tight);
  }

  .mark {
    display: inline-flex;
    color: var(--accent);
  }

  .promise {
    margin: 0;
    max-width: var(--measure);
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  .games {
    display: grid;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /*
    Un lien, et non un bouton : ce sont deux **adresses** du site. Un bouton
    piloté au JavaScript perdrait l'ouverture dans un nouvel onglet, la copie de
    l'adresse et le menu contextuel — tout ce qu'un visiteur attend d'un lien.
  */
  .game {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    box-shadow: var(--shadow-raised);
  }

  .name {
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: var(--leading-tight);
  }

  .line {
    color: var(--accent);
    font-size: var(--text-base);
    font-weight: 600;
  }

  .body {
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-prose);
  }

  @media (hover: hover) {
    .game:hover {
      background: var(--surface-hover);
    }
  }

  .game:active {
    background: var(--surface-pressed);
  }

  .foot {
    max-width: var(--measure);
    color: var(--text-faint);
    font-size: var(--text-xs);
    line-height: var(--leading-prose);
  }

  .foot p {
    margin: 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
