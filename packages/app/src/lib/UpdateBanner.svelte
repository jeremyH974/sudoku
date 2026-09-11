<script lang="ts">
  import { registerSW } from 'virtual:pwa-register';

  let needRefresh = $state(false);
  let offlineReady = $state(false);
  let reload: (() => Promise<void>) | null = null;

  /*
    L'enregistrement se fait au montage, une seule fois.

    On garde `updateSW` de côté plutôt que de recharger d'emblée : c'est
    l'utilisateur qui décide quand interrompre sa partie. Le service worker
    attend sagement dans l'état « waiting » entre-temps.
  */
  reload = registerSW({
    onNeedRefresh() {
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
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-sunken);
    font-size: 0.88rem;
  }

  .banner.update {
    border-color: var(--accent);
  }

  p {
    margin: 0;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
  }

  button {
    min-height: var(--tap);
    padding: 0.35rem 0.8rem;
    border-radius: 7px;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
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
</style>
