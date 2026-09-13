import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAtLevel } from '@sudoku/engine';
import type { GenerateAtLevelOptions, LeveledPuzzle } from '@sudoku/engine';

/**
 * Le studio du cahier de sudoku : arrêt, échec, et ce qu'il dit de lui-même.
 *
 * ─── Pourquoi ce fichier n'existait pas avant l'incrément 20 ────────────────
 *
 * Pour une raison mécanique, et non par négligence : ce composant appelle le
 * moteur, le moteur vit dans un Web Worker, et jsdom n'en a pas. Monter le studio
 * sans doublure marchait — le worker naît au premier **appel**, pas au montage,
 * et c'est ce qui permet à `App.a11y.test.ts` d'ouvrir l'onglet « Imprimer » —
 * mais rien de ce qui compte ici n'était atteignable.
 *
 * La doublure ne simule pas le moteur : elle le **retient**. Chaque requête reste
 * en suspens jusqu'à ce que le test la règle, ce qui rend observables l'instant
 * où le bouton devient « Arrêter », le contenu du bandeau, et le fait qu'un
 * arrêt tue bien le travailleur.
 *
 * ⚠ **Aucune grille inventée** : celles qui servent ici sortent du générateur.
 * Une grille écrite de mémoire serait fausse, et le studio calcule sur elle
 * (niveau atteint ou non, étiquette, code imprimé).
 */

interface Held {
  resolve: (value: LeveledPuzzle | null) => void;
  reject: (reason: Error) => void;
}

/** Les requêtes retenues, dans l'ordre où le studio les a passées. */
const held: Held[] = [];
const stop = vi.fn(() => {
  /*
    Le vrai `stop()` tue le worker, ce qui **rejette** ce qui est en vol. La
    doublure doit faire de même, sinon le test vérifierait un arrêt plus propre
    que celui du produit — la requête en cours resterait sagement en attente au
    lieu de casser.
  */
  for (const request of held.splice(0)) request.reject(new Error('Production interrompue.'));
});

/**
 * Ce qui a été **demandé** au moteur, et pas seulement ce qu'il a répondu.
 *
 * Une doublure qui ignore ses arguments laisse passer une classe entière de
 * défauts : retirer `symmetry: 'rotational180'` de `makeOne` ferait sortir tous
 * les cahiers en grilles asymétriques sans qu'un seul test bronche.
 */
const asks: GenerateAtLevelOptions[] = [];

vi.mock('../lib/engineClient.js', () => ({
  engine: {
    generateAtLevel: (options: GenerateAtLevelOptions): Promise<LeveledPuzzle | null> => {
      asks.push(options);
      return new Promise<LeveledPuzzle | null>((resolve, reject) => {
        held.push({ resolve, reject });
      });
    },
    stop,
  },
}));

const { render, resetDocument } = await import('../test/render.js');
const { expectNoViolations } = await import('../test/axe.js');
type Rendered = import('../test/render.js').Rendered;
const PrintStudio = (await import('./PrintStudio.svelte')).default;

/**
 * Trois grilles réelles de niveau facile, produites une fois pour le fichier.
 *
 * La boucle est **bornée**, et son échec est explicite : sans borne, un
 * générateur qui rendrait `null` ferait pendre le fichier à l'import plutôt
 * qu'échouer. Et le niveau obtenu est vérifié, parce que plusieurs assertions
 * portent sur le texte exact « … de niveau Facile » : `generateAtLevel` peut
 * rendre une approximation quand son budget s'épuise, et le relever ici donne un
 * message clair au lieu d'une comparaison de chaînes incompréhensible.
 */
const REAL: LeveledPuzzle[] = (() => {
  const out: LeveledPuzzle[] = [];
  for (let index = 0; out.length < 3 && index < 40; index++) {
    const made = generateAtLevel({ level: 'facile', seed: `studio-${String(index)}` });
    if (made !== null && made.rating.level === 'facile') out.push(made);
  }
  if (out.length < 3) throw new Error(`Seulement ${String(out.length)} grilles faciles en 40 essais.`);
  return out;
})();

let view: Rendered | null = null;

beforeEach(() => {
  held.length = 0;
  asks.length = 0;
  stop.mockClear();
});

afterEach(() => {
  view?.destroy();
  view = null;
  resetDocument();
});

const button = (label: string): HTMLButtonElement => {
  const found = [...(view?.container.querySelectorAll('button') ?? [])].find((element) =>
    (element.textContent ?? '').includes(label),
  );
  if (found === undefined) throw new Error(`Bouton introuvable : ${label}`);
  return found as HTMLButtonElement;
};

const notice = (): string => view?.container.querySelector('.notice')?.textContent?.trim() ?? '';
const sheets = (): number => view?.container.querySelectorAll('.sheet').length ?? 0;

/**
 * Laisse les promesses réglées se propager, puis pousse les effets Svelte.
 *
 * Une frontière de **macrotâche** et non deux tours de microtâche : entre la
 * résolution d'une requête et l'affectation finale du bandeau, il y a la boucle
 * de `runBatch`, son `await`, le retour de `generate`, puis l'effet Svelte. Les
 * compter à la main est aussi fragile que faux — `setTimeout(0)` vide la file
 * entière et ne demande rien à savoir.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  view?.flush();
}

/** Règle la prochaine requête retenue, et attend que l'écran suive. */
async function answer(value: LeveledPuzzle | null): Promise<void> {
  const request = held.shift();
  if (request === undefined) throw new Error('Aucune requête en attente.');
  request.resolve(value);
  await settle();
}

/**
 * Change un réglage du studio comme le ferait un doigt.
 *
 * Le premier `select` du panneau est celui du niveau. Les tests qui attendent
 * « de niveau Facile » le posent explicitement : le défaut du studio est *Moyen*,
 * et de vraies grilles faciles y seraient comptées hors palier — à juste titre.
 */
function set(selector: string, value: string, event: 'input' | 'change'): void {
  const field = view?.container.querySelector(selector);
  if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
    throw new Error(`Réglage introuvable : ${selector}`);
  }
  field.value = value;
  field.dispatchEvent(new Event(event, { bubbles: true }));
  view?.flush();
}

describe('le studio du cahier de sudoku', () => {
  it('n’a rien à montrer avant qu’on lui demande', () => {
    view = render(PrintStudio, {});
    expect(sheets()).toBe(0);
    expect(view.container.textContent).toContain('Réglez le cahier puis lancez la génération');
  });

  it('tient une région vivante **vide** dès le départ', () => {
    /*
      C'est un défaut corrigé, et la raison d'en faire un test : un `role="status"`
      créé en même temps que son texte n'est pas annoncé — le lecteur d'écran doit
      avoir vu la région vide pour remarquer qu'elle change. Le message d'échec
      que ce studio vient de gagner serait resté muet pour exactement les
      personnes qui ne voient pas l'aperçu.
    */
    view = render(PrintStudio, {});
    const region = view.container.querySelector('.notice');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.textContent?.trim()).toBe('');
  });

  it('produit le cahier demandé, et dit de quel niveau il est', async () => {
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '3', 'input');
    button('Générer le cahier').click();
    await settle();

    for (const puzzle of REAL) await answer(puzzle);

    expect(notice()).toBe('3 grille(s) de niveau Facile.');
    // Trois dossiers, trois corrigés, et le sommaire du format par défaut.
    expect(sheets()).toBeGreaterThanOrEqual(3);
  });

  it('devient « Arrêter » pendant la production, et compte', async () => {
    view = render(PrintStudio, {});
    set('input[type="number"]', '3', 'input');
    button('Générer le cahier').click();
    await settle();

    // Rien n'est encore revenu : le compteur est à zéro, et le bouton a changé
    // de rôle plutôt que de se griser.
    expect(button('Arrêter').textContent).toContain('0 / 3');
    await answer(REAL[0] ?? null);
    expect(button('Arrêter').textContent).toContain('1 / 3');
  });

  it('s’arrête tout de suite, en tuant le moteur', async () => {
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '20', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);
    await answer(REAL[1] ?? null);

    button('Arrêter').click();
    await settle();

    /*
      Tuer, et pas seulement lever un drapeau : une grille peut demander les huit
      secondes du budget du générateur, et un drapeau relu entre deux grilles
      laisserait le bouton muet tout ce temps.
    */
    expect(stop).toHaveBeenCalledTimes(1);
    expect(notice()).toContain('Arrêté après 2 tentative(s).');
    // Ce qui était fait est gardé, et l'arrêt n'est pas présenté comme une panne.
    expect(notice()).toContain('2 grille(s) de niveau Facile.');
    expect(notice()).not.toContain('échoué');
    // Et l'on peut repartir : le bouton a retrouvé son rôle.
    expect(button('Générer le cahier')).toBeInstanceOf(HTMLButtonElement);
  });

  it('remplace l’aperçu par ce qui a vraiment été produit quand le moteur casse', async () => {
    /*
      Le défaut d'origine : l'exception remontait sans un mot et l'aperçu gardait
      son contenu précédent. On montrait alors un cahier dont on ne parlait pas —
      et c'est celui-là qui serait sorti de l'imprimante.
    */
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '2', 'input');

    // Un premier cahier de deux grilles, bien produit.
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);
    await answer(REAL[1] ?? null);
    const deux = sheets();
    expect(deux).toBeGreaterThan(0);

    // Un second qui casse après une seule grille.
    set('input[type="number"]', '3', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[2] ?? null);
    held.shift()?.reject(new Error('le travailleur est mort'));
    await settle();

    expect(notice()).toContain('Le moteur a échoué : le travailleur est mort');
    expect(notice()).toContain('1 grille(s) de niveau Facile.');
    // Une seule grille au cahier, donc strictement moins de feuilles qu'avant.
    expect(sheets()).toBeGreaterThan(0);
    expect(sheets()).toBeLessThan(deux);
  });

  it('ne jette rien quand la boucle n’a pas fait un tour', async () => {
    /*
      Un échec — ou un arrêt — avant la première tentative n'a **rien** à dire du
      cahier en place. L'effacer serait doublement mauvais : on perdrait un cahier
      produit, et c'est la porte par laquelle un double-clic sur « Générer »
      passerait, puisque le second clic tombe sur « Arrêter ».
    */
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '2', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);
    await answer(REAL[1] ?? null);
    const avant = sheets();

    button('Générer le cahier').click();
    await settle();
    held.shift()?.reject(new Error('mort-né'));
    await settle();

    expect(sheets()).toBe(avant);
    expect(notice()).toContain('Le moteur a échoué : mort-né');
    expect(notice()).toContain('Le cahier précédent est conservé.');
  });

  it('survit à un double-clic sur « Générer », qui tombe sur « Arrêter »', async () => {
    /*
      Les deux libellés occupent le **même** bouton : le second clic d'un
      double-clic active donc l'arrêt. Il doit être sans conséquence — sinon un
      doigt trop rapide effacerait un cahier de quarante grilles.
    */
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '2', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);
    await answer(REAL[1] ?? null);
    const avant = sheets();
    expect(avant).toBeGreaterThan(0);

    set('input[type="number"]', '40', 'input');
    button('Générer le cahier').click();
    await settle();
    button('Arrêter').click();
    await settle();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(sheets()).toBe(avant);
    expect(notice()).toContain('Le cahier précédent est conservé.');
    expect(notice()).not.toContain('échoué');
  });

  it('demande bien au moteur ce que le cahier promet', async () => {
    view = render(PrintStudio, {});
    set('select', 'expert', 'change');
    set('input[type="number"]', '2', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);

    /*
      La symétrie n'apparaît nulle part à l'écran : seul ce contrôle la tient. Le
      niveau aussi passe par ici — le test des réglages figés prouve que le
      **bandeau** lit la copie, celui-ci que la **fabrique** la lit aussi.
    */
    expect(asks).toHaveLength(2);
    for (const ask of asks) {
      expect(ask.symmetry).toBe('rotational180');
      expect(ask.level).toBe('expert');
    }
  });

  it('garde le focus clavier en passant de « Générer » à « Arrêter »', async () => {
    /*
      Deux boutons échangés sous un `{#if}` sont détruits et recréés : le focus
      retombe sur `<body>`, et quelqu'un qui navigue au clavier devrait
      retraverser la page pour atteindre l'arrêt qu'il vient de rendre possible.
      Un seul bouton qui change de texte garde son identité.
    */
    view = render(PrintStudio, {});
    set('input[type="number"]', '3', 'input');
    const lancer = button('Générer le cahier');
    lancer.focus();
    expect(document.activeElement).toBe(lancer);

    lancer.click();
    await settle();

    expect(button('Arrêter')).toBe(lancer);
    expect(document.activeElement).toBe(lancer);
  });

  it('compte les grilles qui n’ont pas atteint le niveau demandé', async () => {
    view = render(PrintStudio, {});
    set('select', 'expert', 'change');
    set('input[type="number"]', '2', 'input');
    button('Générer le cahier').click();
    await settle();

    // De vraies grilles, mais de niveau Facile : le studio doit le remarquer au
    // lieu de les étiqueter Expert.
    await answer(REAL[0] ?? null);
    await answer(REAL[1] ?? null);

    expect(notice()).toBe(
      '2 grille(s), dont 2 n’ont pas atteint le niveau Expert dans le temps imparti.',
    );
  });

  it('compte les tentatives qui n’ont rien donné', async () => {
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '2', 'input');
    button('Générer le cahier').click();
    await settle();

    await answer(REAL[0] ?? null);
    await answer(null);

    expect(notice()).toContain('1 grille(s) de niveau Facile.');
    expect(notice()).toContain('1 tentative(s) n’ont rien donné.');
  });

  it('renumérote les grilles retenues, sans trou', async () => {
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '3', 'input');
    button('Générer le cahier').click();
    await settle();

    /*
      La première tentative ne donne rien : sans renumérotation après coup, le
      cahier commencerait à « 2 » — le numéro venait du rang de la tentative.
    */
    await answer(null);
    await answer(REAL[0] ?? null);
    await answer(REAL[1] ?? null);

    const printed = view.container.textContent ?? '';
    expect(printed).toContain('Grille 1');
    expect(printed).toContain('Grille 2');
    expect(printed).not.toContain('Grille 3');
  });

  it('fige les réglages au lancement, quoi qu’on touche ensuite', async () => {
    /*
      Les champs restent utilisables pendant la production — on n'ôte pas un
      réglage à quelqu'un qui attend. Mais le cahier doit rester celui qu'on a
      commandé. Sans cette copie, changer le niveau à mi-parcours mélangeait deux
      paliers **et** faisait compter comme « hors palier » des grilles qui avaient
      atteint celui demandé à l'époque ; baisser le nombre affichait « 2 / 1 ».
    */
    view = render(PrintStudio, {});
    set('select', 'facile', 'change');
    set('input[type="number"]', '2', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);

    // Un doigt distrait, en pleine production.
    set('select', 'diabolique', 'change');
    set('input[type="number"]', '1', 'input');
    expect(button('Arrêter').textContent).toContain('1 / 2');

    await answer(REAL[1] ?? null);

    // Deux grilles, comme commandé, et jugées contre le niveau commandé.
    expect(notice()).toBe('2 grille(s) de niveau Facile.');
  });

  it('ne présente aucun manquement relevable sans mise en page', async () => {
    view = render(PrintStudio, {});
    set('input[type="number"]', '1', 'input');
    button('Générer le cahier').click();
    await settle();
    await answer(REAL[0] ?? null);

    await expectNoViolations(view.container);
  });
});
