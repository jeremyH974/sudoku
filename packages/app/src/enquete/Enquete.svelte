<script lang="ts">
  import DisplaySettings from '../lib/DisplaySettings.svelte';
  import Icon from '../lib/Icon.svelte';
  import InvestigationPanel from '../lib/investigation/InvestigationPanel.svelte';
  import UpdateBanner from '../lib/UpdateBanner.svelte';

  /*
    La coquille de la section Enquête.

    Elle ne partage avec le Sudoku que ce qui sert les deux : le thème, la
    taille du texte, le service worker. Ni sa navigation ni — dès l'incrément
    13 — son habillage. C'est précisément ce que la séparation en sections
    devait rendre possible : donner à ce jeu sa propre allure sans retoucher un
    écran de sudoku qui fonctionne.
  */
  const base = import.meta.env.BASE_URL;

  let settingsOpen = $state(false);
  const SETTINGS_ID = 'reglages-enquete';
</script>

<UpdateBanner />

<div class="page">
  <!--
    Le lien d'évitement, avant tout le reste : sans lui, atteindre le plan au
    clavier demande de traverser l'en-tête à chaque chargement.
  -->
  <a class="skip" href="#contenu">Aller au contenu</a>

  <header class="masthead">
    <a class="home" href={base}>
      <span class="mark" aria-hidden="true"><Icon name="brand" /></span>
      <span>Accueil</span>
    </a>

    <div class="titling">
      <h1>Enquête</h1>
      <p class="promise">Rien à installer. Aucune publicité, aucun compte, aucun suivi.</p>
    </div>

    <button
      type="button"
      class="settings-toggle"
      aria-expanded={settingsOpen}
      aria-controls={SETTINGS_ID}
      onclick={() => (settingsOpen = !settingsOpen)}
    >
      Réglages
    </button>
  </header>

  {#if settingsOpen}
    <section id={SETTINGS_ID} class="settings-panel" aria-label="Réglages d’affichage">
      <DisplaySettings />
    </section>
  {/if}

  <!-- `tabindex="-1"` rend la cible du lien d'évitement focalisable. -->
  <main id="contenu" tabindex="-1">
    <InvestigationPanel />
  </main>
</div>

<style>
  .page {
    display: grid;
    gap: var(--space-4);
    max-width: 60rem;
    margin-inline: auto;
    padding: var(--space-4) var(--space-4) var(--space-7);
  }

  .skip {
    position: absolute;
    left: -9999px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--accent);
    color: var(--accent-text);
  }

  .skip:focus {
    position: static;
    justify-self: start;
  }

  .masthead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  .titling {
    flex: 1 1 12rem;
  }

  /* Le titre de la section, de la même main que les noms sur les cartes. */
  h1 {
    margin: 0;
    font-family: var(--font-hand);
    font-size: var(--text-xl);
    line-height: var(--leading-tight);
  }

  .promise {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  .home {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-3);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font-size: var(--text-sm);
    text-decoration: none;
    box-shadow: var(--shadow-hard);
  }

  .mark {
    display: inline-flex;
    color: var(--accent);
  }

  .settings-toggle {
    min-height: var(--tap);
    padding: 0 var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    box-shadow: var(--shadow-hard);
  }

  @media (hover: hover) {
    .home:hover,
    .settings-toggle:hover {
      background: var(--surface-hover);
    }
  }

  .home:active,
  .settings-toggle:active {
    background: var(--surface-pressed);
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .settings-panel {
    padding: var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    box-shadow: var(--shadow-hard);
  }
</style>
