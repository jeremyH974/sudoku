/**
 * Taille du texte : normale, grande, très grande.
 *
 * ─── Pourquoi trois paliers nommés et non un curseur ────────────────────────
 *
 * Un curseur produit un espace de valeurs continu que personne ne teste, exige
 * une validation de nombre à la relecture, et rend continue la hauteur qu'il
 * faut réserver sous la barre de saisie. Trois paliers s'énumèrent, se testent
 * et se disent. Le public visé est en grande partie senior : trois boutons
 * portant « Normal », « Grand », « Très grand » se comprennent sans mode
 * d'emploi, là où un curseur sans libellé est le contrôle le moins découvrable
 * qui soit.
 *
 * ─── Pourquoi deux leviers pour un seul réglage ─────────────────────────────
 *
 * `html { font-size }` agrandit tout ce qui est en `rem` — y compris la largeur
 * maximale de la grille, donc la grille elle-même sur un écran large.
 *
 * `--text-scale` agrandit les chiffres **à l'intérieur** d'une grille dont la
 * largeur est déjà bornée par l'écran. C'est la seule chose qui puisse aider sur
 * un téléphone, où la grille occupe déjà toute la place disponible — et c'est
 * précisément là que ce réglage sert le plus.
 *
 * Le modèle est celui de `theme.svelte.ts` : trois états dont le neutre
 * **retire** l'attribut plutôt que d'écrire une valeur, et tout accès au
 * stockage sous `try`, car en navigation privée le seul fait de le consulter
 * lève.
 */
export type TextSize = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'sudoku.text-size';

const isTextSize = (value: unknown): value is TextSize =>
  value === 'normal' || value === 'large' || value === 'xlarge';

function readStored(): TextSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTextSize(stored)) return stored;
  } catch {
    // Stockage indisponible : la taille normale reste le bon défaut.
  }
  return 'normal';
}

function persist(size: TextSize): void {
  try {
    if (size === 'normal') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Le choix ne survivra pas au rechargement ; la session reste correcte.
  }
}

function apply(size: TextSize): void {
  const root = document.documentElement;
  if (size === 'normal') root.removeAttribute('data-text-size');
  else root.setAttribute('data-text-size', size);
}

class TextSizeStore {
  size = $state<TextSize>('normal');

  constructor() {
    // Le script d'amorçage de `index.html` a déjà posé l'attribut : sans lui la
    // page peindrait à 100 % puis sauterait, exactement le scintillement que le
    // script du thème existe pour éviter.
    this.size = readStored();
  }

  set(size: TextSize): void {
    this.size = size;
    apply(size);
    persist(size);
  }
}

export const textSize = new TextSizeStore();

export const TEXT_SIZE_OPTIONS: { id: TextSize; label: string; short: string }[] = [
  { id: 'normal', label: 'Normal', short: 'A' },
  { id: 'large', label: 'Grand', short: 'A' },
  { id: 'xlarge', label: 'Très grand', short: 'A' },
];
