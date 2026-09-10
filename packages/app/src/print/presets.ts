/**
 * Formats d'impression.
 *
 * Deux seulement, et c'est délibéré : chaque format doit être vérifié sur du
 * papier réel, ce qui ne s'automatise pas. Mieux vaut deux formats contrôlés que
 * six approximatifs.
 *
 * Les autres presets envisagés — gros caractères, feuille d'exercices à plusieurs
 * grilles — sont de simples entrées à ajouter dans ce tableau le jour venu, pas
 * un chantier : c'est tout l'intérêt de traiter les formats comme des données.
 */

export type PrintFormatId = 'standard' | 'booklet';

export interface Margins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PrintFormat {
  readonly id: PrintFormatId;
  readonly label: string;
  readonly description: string;
  /** Grilles par feuille. */
  readonly puzzlesPerSheet: number;
  /** Corrigés par feuille : ils sont petits, on en groupe plusieurs. */
  readonly solutionsPerSheet: number;
  /** Marges en millimètres. */
  readonly margins: Margins;
  /**
   * Marge de reliure, en millimètres, ajoutée côté pliure et **alternée** selon
   * la parité de la page. Sans alternance, une page sur deux verrait son contenu
   * disparaître dans la reliure.
   */
  readonly bindingMargin: number;
  readonly showSummary: boolean;
  readonly showPageNumbers: boolean;
}

export const PRINT_FORMATS: readonly PrintFormat[] = [
  {
    id: 'standard',
    label: 'Standard',
    description:
      'Une grille par page, grande et bien aérée. Le format à choisir pour jouer au stylo, ou pour distribuer une grille à la fois.',
    puzzlesPerSheet: 1,
    solutionsPerSheet: 6,
    margins: { top: 18, right: 18, bottom: 18, left: 18 },
    bindingMargin: 0,
    showSummary: false,
    showPageNumbers: true,
  },
  {
    id: 'booklet',
    label: 'Cahier relié',
    description:
      'Une grille par page, avec sommaire, pagination et marge de reliure alternée. Pour produire un vrai livret de plusieurs dizaines de grilles.',
    puzzlesPerSheet: 1,
    solutionsPerSheet: 6,
    margins: { top: 16, right: 14, bottom: 16, left: 14 },
    bindingMargin: 10,
    showSummary: true,
    showPageNumbers: true,
  },
];

export const formatById = (id: PrintFormatId): PrintFormat =>
  PRINT_FORMATS.find((format) => format.id === id) ?? PRINT_FORMATS[0];

/** Formats de papier proposés. A4 par défaut, Letter pour l'Amérique du Nord. */
export const PAPER_SIZES = [
  { id: 'a4', label: 'A4', css: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'letter', label: 'US Letter', css: 'letter', widthMm: 216, heightMm: 279 },
] as const;

export type PaperSizeId = (typeof PAPER_SIZES)[number]['id'];

export const paperById = (id: PaperSizeId): (typeof PAPER_SIZES)[number] =>
  PAPER_SIZES.find((paper) => paper.id === id) ?? PAPER_SIZES[0];

/**
 * Marges effectives d'une page, reliure comprise.
 *
 * La marge de reliure passe à gauche sur les pages impaires (recto) et à droite
 * sur les paires (verso) : c'est ce qui la place toujours du côté de la pliure
 * une fois le cahier assemblé.
 */
export function effectiveMargins(format: PrintFormat, pageNumber: number): Margins {
  if (format.bindingMargin === 0) return format.margins;
  const onRight = pageNumber % 2 === 0;
  return {
    ...format.margins,
    left: format.margins.left + (onRight ? 0 : format.bindingMargin),
    right: format.margins.right + (onRight ? format.bindingMargin : 0),
  };
}
