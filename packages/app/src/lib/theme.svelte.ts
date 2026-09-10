/**
 * Préférence de thème : clair, sombre, ou celui du système.
 *
 * Trois états et non deux : « système » n'est pas un réglage par défaut qu'on
 * remplacerait au premier clic, c'est un choix à part entière — celui de suivre
 * le rythme de la machine, qui bascule souvent au coucher du soleil. Beaucoup
 * d'applications l'oublient et forcent l'utilisateur à trancher une fois pour
 * toutes.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sudoku.theme';

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

/**
 * Lit la préférence enregistrée.
 *
 * Toute lecture est protégée : en navigation privée ou avec les données de site
 * bloquées, le seul accès à `localStorage` lève une exception. Une préférence
 * d'affichage ne doit jamais empêcher l'application de démarrer.
 */
function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    // Stockage indisponible : on suit le système, ce qui est le bon défaut.
  }
  return 'system';
}

function persist(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Le choix ne survivra pas au rechargement, mais la session reste correcte.
  }
}

/**
 * Applique la préférence au document.
 *
 * « système » retire l'attribut au lieu d'y écrire une valeur : c'est ce qui
 * laisse `prefers-color-scheme` reprendre la main dans la feuille de style, et
 * suivre un basculement du système sans rechargement ni écouteur.
 */
function apply(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

class ThemeStore {
  preference = $state<ThemePreference>('system');

  constructor() {
    // Le script d'amorçage de `index.html` a déjà posé l'attribut pour éviter
    // le flash ; on se contente ici de reprendre la même valeur.
    this.preference = readStored();
  }

  set(preference: ThemePreference): void {
    this.preference = preference;
    apply(preference);
    persist(preference);
  }
}

export const theme = new ThemeStore();

export const THEME_OPTIONS: { id: ThemePreference; label: string; icon: string }[] = [
  { id: 'light', label: 'Clair', icon: '☀' },
  { id: 'dark', label: 'Sombre', icon: '☾' },
  { id: 'system', label: 'Système', icon: '◐' },
];
