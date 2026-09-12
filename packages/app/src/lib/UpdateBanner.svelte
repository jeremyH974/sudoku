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
  .banner {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-sunken);
    font-size: var(--text-sm);
  }

  .banner.update {
    border-color: var(--accent);
  }

  p {
    margin: 0;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  button {
    min-height: var(--tap);
    padding: 0.35rem 0.8rem;
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background-color var(--dur-quick) var(--ease);
  }

  .primary {
    border: none;
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 600;
  }

  .ghost {
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
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
