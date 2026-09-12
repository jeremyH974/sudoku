<script lang="ts">
  import { registerSW } from 'virtual:pwa-register';
  import { createUpdatePolicy } from './updatePolicy.js';

  let needRefresh = $state(false);
  let offlineReady = $state(false);
  let reload: (() => Promise<void>) | null = null;

  /*
    L'enregistrement se fait au montage, une seule fois.

    Une nouvelle version en attente est appliquée d'office tant que la page
    vient de s'ouvrir et que personne n'y a touché — `updatePolicy.ts` dit
    pourquoi la bannière seule ne suffisait pas. Dès le premier geste, c'est de
    nouveau l'utilisateur qui décide quand interrompre sa partie, et le service
    worker attend sagement dans l'état « waiting ».
  */
  const policy = createUpdatePolicy();

  reload = registerSW({
    onNeedRefresh() {
      if (policy.decide() === 'apply' && reload !== null) {
        void reload();
        return;
      }
      needRefresh = true;
    },
    onOfflineReady() {
      offlineReady = true;
      // L'information est utile une fois, pas en permanence.
      setTimeout(() => (offlineReady = false), 6000);
    },
  });

  async function refresh(): Promise<void> {
    // `updateSW()` active le service worker en attente et recharge la page.
    if (reload !== null) await reload();
  }
</script>

{#if needRefresh}
  <div class="banner update" role="status">
    <p>Une nouvelle version est disponible.</p>
    <div class="actions">
      <button type="button" class="primary" onclick={refresh}>Actualiser</button>
      <button type="button" class="ghost" onclick={() => (needRefresh = false)}>Plus tard</button>
    </div>
  </div>
{:else if offlineReady}
  <div class="banner offline" role="status">
    <p>Prêt à fonctionner hors ligne.</p>
  </div>
{/if}

<style>
  /*
    Une surface au sens de l'enquête (investigation/InvestigationPanel.svelte) :
    trait d'encre à 2px et ombre décalée sans flou, au lieu du simple filet.
  */
  .banner {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-hard);
  }

  /*
    La variante « mise à jour » ajoute un liseré d'accent sans remplacer
    l'ombre — même motif que .tool.active dans l'enquête. Un aplat aurait
    rendu cette bannière plus plate que celle qu'elle doit distinguer.
  */
  .banner.update {
    border-color: var(--accent);
    box-shadow:
      inset 0 0 0 2px var(--accent),
      var(--shadow-hard);
  }

  p {
    margin: 0;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  /*
    Même grammaire que les boutons de l'enquête : trait d'encre à 2px et
    ombre dure, qui se rétracte à l'appui (button:active, plus bas). Les deux
    boutons de cette bannière la partagent, il n'y a pas de case du calendrier
    ici pour s'en trouver affectée par ricochet.
  */
  button {
    min-height: var(--tap);
    padding: 0.35rem 0.8rem;
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    box-shadow: var(--shadow-hard);
    transition: background-color var(--dur-quick) var(--ease);
  }

  .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .ghost {
    background: none;
    color: var(--text-muted);
  }

  /* À l'appui, le bouton s'enfonce pour de bon : il se déplace de la valeur de son ombre et la perd. */
  button:active {
    transform: translate(3px, 3px);
    box-shadow: none;
  }

  .primary:active {
    background: var(--accent-active);
    transition-duration: 0s;
  }

  .ghost:active {
    background: var(--surface-pressed);
    transition-duration: 0s;
  }

  /*
    Le survol n'existe qu'avec un pointeur qui survole : sans cette garde, un
    navigateur mobile l'émule au toucher et le laisse collé.
  */
  @media (hover: hover) and (pointer: fine) {
    .primary:hover {
      background: var(--accent-hover);
    }

    .ghost:hover {
      background: var(--surface-hover);
    }
  }
</style>
