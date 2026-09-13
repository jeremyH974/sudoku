/**
 * Le protocole de `docs/lecteur-decran.md`, exécuté contre un vrai NVDA.
 *
 * ─── Ce que ce script vérifie, et que rien d'autre ne peut vérifier ─────────
 *
 * Les tests `*.a11y.test.ts` voient l'arbre d'accessibilité : les rôles, les
 * noms, l'ordre des titres. Ils ne disent **rien** de ce qu'un lecteur d'écran
 * prononce. C'est l'écart que ce script mesure, et c'est là que les défauts se
 * cachent — l'incrément 21 a trouvé que NVDA annonce le plateau « table » et
 * jamais « grid », ce qu'aucun test de CI classique ne pouvait voir.
 *
 * ─── Comment il est piloté ──────────────────────────────────────────────────
 *
 *   BASE=http://localhost:4181/sudoku/  node scripts/lecteur-decran.mjs
 *
 * `BASE` désigne la racine du site (défaut : le site publié). `SANS_CLIC=1`
 * interdit de demander un clic humain : c'est ce qu'il faut sur une machine
 * d'intégration, où personne ne lirait la demande.
 *
 * ⚠ NVDA ré-injecte les frappes dans la fenêtre qui a le focus, et Windows
 * interdit à un processus d'arrière-plan de faire passer une fenêtre devant :
 * `AppActivate` rend `True` et ne change rien. La parade n'est pas de ruser avec
 * l'OS mais de **cycler les fenêtres depuis NVDA** — voir `amenerDevant`.
 *
 * ─── Trois pièges de méthode, payés comptant à l'incrément 21 ───────────────
 *
 * 1. Les frappes vont à la fenêtre au premier plan : la première exécution en a
 *    envoyé trois dans une autre application. D'où le contrôle de focus, qui
 *    **refuse de mesurer** plutôt que de produire un relevé faux.
 * 2. Sonder cette fenêtre depuis PowerShell ouvre une console qui passe
 *    elle-même devant : l'instrument mesurait son interférence. C'est NVDA qui
 *    donne le titre, par `NVDA+T`, et lui ne déplace rien.
 * 3. Le nombre de tabulations avant un plateau n'est pas stable — le curseur
 *    virtuel démarre là où l'on a cliqué. On recharge (`F5`) pour repartir du
 *    début, et l'on **détecte** le plateau au lieu de compter à l'aveugle.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nvda } from '@guidepup/guidepup';

const BASE = (process.env.BASE ?? 'https://jeremyh974.github.io/sudoku/').replace(/\/$/, '');
const SANS_CLIC = process.env.SANS_CLIC === '1';

/**
 * Les deux plateaux, et ce qui les distingue pour l'oreille.
 *
 * Tout le reste du protocole leur est commun : c'est le même motif — un
 * `role="grid"`, un `tabindex` glissant, des flèches — et il doit donner la même
 * expérience des deux côtés. Les différences tiennent en quatre motifs.
 *
 * ⚠ Les grilles et les affaires sont **figées par leur code d'URL**. Un relevé
 * doit être comparable d'une semaine sur l'autre ; une grille tirée au hasard
 * rendrait chaque exécution incomparable à la précédente.
 */
const PLATEAUX = [
  {
    nom: 'sudoku',
    chemin: '/sudoku/#g=AdIU2wEX0AG3UZYAdDYhRUiTEUVyYjQnWGOXhzE',
    /** Le titre de la fenêtre, pour s'y rendre par cyclage. */
    fenetre: /sudoku/i,
    /** Une case focalisée se reconnaît à ce que NVDA prononce notre nom. */
    case: /ligne (\d+),? colonne (\d+)/i,
    /** Ce qui suit immédiatement le plateau : l'entendre, c'est l'avoir dépassé. */
    apres: /Placer le 1\b|Saisie des chiffres/i,
    /** Ce que le conteneur doit annoncer quand on y revient. */
    conteneur: /9 lignes sur 9 colonnes/i,
  },
  {
    nom: 'enquête',
    chemin: '/enquete/#a=AUd9_LXz0b-CpECUFCAUUUyEgAkE2FElQA',
    fenetre: /enqu[êe]te/i,
    // « rangée » et non « ligne » : le plan d'une scène n'est pas une grille de
    // chiffres, et son vocabulaire le dit.
    case: /rang[ée]e (\d+),? colonne (\d+)/i,
    apres: /poser la personne|Placer poser/i,
    conteneur: /6 rang[ée]es sur 6 colonnes/i,
  },
];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const releve = [];
const echecs = [];
let courant = '';

async function dire(etape, geste, action, delai = 420) {
  await nvda.clearSpokenPhraseLog();
  await action();
  await attendre(delai);
  const entendu = await nvda.spokenPhraseLog();
  releve.push({ plateau: courant, etape, geste, entendu });
  console.log(`[${etape}] ${geste}`);
  for (const p of entendu) console.log(`      « ${p} »`);
  if (entendu.length === 0) console.log('      (rien)');
  return entendu;
}

/** Une assertion nommée : elle dit ce qu'elle attendait et ce qu'elle a eu. */
function exiger(nom, condition, detail) {
  console.log(`  ${condition ? '✓' : '✗'} ${nom}`);
  if (!condition) echecs.push(`[${courant}] ${nom} — ${detail}`);
  releve.push({
    plateau: courant,
    etape: 'assertion',
    geste: nom,
    entendu: [condition ? 'tenu' : `MANQUÉ : ${detail}`],
  });
}

/** Le titre de la fenêtre au premier plan, demandé à NVDA lui-même. */
async function titreCourant() {
  await nvda.clearSpokenPhraseLog();
  await nvda.press('Insert+t');
  await attendre(700);
  return (await nvda.spokenPhraseLog()).join(' / ');
}

/**
 * Amener une fenêtre au premier plan — **sans le demander à Windows**.
 *
 * C'est là que l'incrément 21 s'est cassé les dents. `AppActivate` et
 * `SetForegroundWindow` rendent `True` et ne font rien : Windows interdit à un
 * processus d'arrière-plan de voler le premier plan. Il a fallu cinq clics
 * humains pour obtenir une seule mesure valable.
 *
 * La solution est celle de la fixture Playwright de guidepup : on ne demande
 * rien à l'OS, on **cycle les fenêtres** avec `Alt+Échap` — une frappe injectée
 * par NVDA, qui lui en a le droit — et l'on **vérifie par la parole** que l'on
 * est arrivé. Douze tentatives à une demi-seconde.
 *
 * C'est aussi ce qui permet de passer d'un plateau à l'autre : les deux vivent
 * dans deux fenêtres ouvertes en même temps, et l'on va à celle dont le titre
 * répond.
 */
async function amenerDevant(reconnaitre, tentatives = 12) {
  for (let i = 1; i <= tentatives; i++) {
    const titre = await titreCourant();
    if (reconnaitre.test(titre)) {
      console.log(`  → « ${titre} » (après ${String(i - 1)} bascule(s))`);
      return true;
    }
    console.log(`  [${String(i)}] « ${titre} » — on cycle`);
    await nvda.press('Alt+Escape');
    await attendre(500);
  }
  return false;
}

/** Le protocole, sur un plateau. */
async function mesurer(spec) {
  courant = spec.nom;
  console.log(`\n══════ ${spec.nom} ══════`);

  let auPoint = await amenerDevant(spec.fenetre);
  /*
    Le clic humain n'est qu'un dernier recours : le cyclage y arrive seul dans le
    cas normal. On ne le propose que sur un poste de travail, et jamais sur une
    machine d'intégration où personne ne lit la sortie.
  */
  if (!auPoint && !SANS_CLIC) {
    console.log('');
    console.log(`  Le cyclage n’a pas suffi. CLIQUE SUR LA FENÊTRE « ${spec.nom} ».`);
    console.log('');
    for (let i = 0; i < 60 && !auPoint; i++) {
      auPoint = spec.fenetre.test(await titreCourant());
      if (!auPoint) await attendre(1200);
    }
  }
  if (!auPoint) {
    echecs.push(`[${spec.nom}] la fenêtre n’a jamais eu le focus`);
    return;
  }

  // Point de départ déterministe : après un rechargement, le clavier repart du
  // début du document, quel que soit l'endroit où le clic est tombé.
  await nvda.press('F5');
  await attendre(5000);
  if (!(await amenerDevant(spec.fenetre, 4))) {
    echecs.push(`[${spec.nom}] focus perdu au rechargement`);
    return;
  }

  /* ── 1. Atteindre le plateau, et compter ce qu'il coûte ─────────────────── */
  console.log('── Tabulation jusqu’au plateau ──');
  let avant = 0;
  let atteint = false;
  for (let i = 1; i <= 24 && !atteint; i++) {
    const dit = await dire(`tab.${i}`, `Tab n°${i}`, () => nvda.press('Tab'), 300);
    if (dit.some((p) => spec.apres.test(p))) {
      atteint = true;
      const retour = await dire('retour', 'Maj+Tab (revenir sur le plateau)', () =>
        nvda.press('Shift+Tab'),
      );
      exiger(
        'le conteneur s’annonce avec ses dimensions',
        retour.some((p) => spec.conteneur.test(p)),
        `entendu : « ${retour.join(' / ')} »`,
      );
      break;
    }
    avant = i;
  }
  console.log(`  (plateau atteint après ${String(avant)} arrêt(s) avant lui)`);
  exiger(
    'le plateau ne consomme qu’un arrêt de tabulation',
    atteint,
    'ce qui suit le plateau n’a jamais été atteint',
  );
  if (!atteint) return;

  /* ── 2. Ce que le lecteur dit de la case focalisée ──────────────────────── */
  /*
    `NVDA+Tab` demande « où suis-je ? ». La réponse doit être **une case**, nommée
    par notre `aria-label`.

    ⚠ Ne pas y chercher les dimensions du plateau : elles sont annoncées quand on
    **entre** dans le conteneur, pas quand on rapporte une case. La première
    version de ce script les exigeait ici et échouait sur une bonne réponse.
  */
  const ici = await dire('ou', 'NVDA+Tab : où suis-je ?', () => nvda.press('Insert+Tab'));
  const depart = spec.case.exec(ici.join(' '));
  exiger(
    'la case focalisée prononce son nom accessible',
    depart !== null,
    `entendu : « ${ici.join(' / ')} »`,
  );
  if (depart === null) return;

  /* ── 3. Le parcours aux flèches, depuis cette case ──────────────────────── */
  /*
    Les assertions qui comptent. Le déplacement lui-même est vérifié côté
    application par les tests de plateau ; ce qui se vérifie ici est que le
    lecteur d'écran le **dit**.
  */
  const droite = await dire('droite', '→ flèche droite', () => nvda.press('ArrowRight'));
  const versDroite = spec.case.exec(droite.join(' '));
  exiger(
    'une flèche fait annoncer la case voisine',
    versDroite !== null && versDroite[2] !== depart[2] && versDroite[1] === depart[1],
    versDroite === null
      ? `aucune case annoncée — entendu : « ${droite.join(' / ')} »`
      : `partie de ${depart[0]}, arrivée à ${versDroite[0]}`,
  );

  const bas = await dire('bas', '↓ flèche bas', () => nvda.press('ArrowDown'));
  const versBas = spec.case.exec(bas.join(' '));
  exiger(
    'une flèche vers le bas change de rangée',
    versBas !== null && versBas[1] !== depart[1],
    versBas === null
      ? `aucune case annoncée — entendu : « ${bas.join(' / ')} »`
      : `toujours rangée ${versBas[1]}`,
  );
}

async function main() {
  /*
    Une fenêtre par plateau, ouvertes d'avance et laissées ouvertes : on passe de
    l'une à l'autre par le même cyclage qui sert à les atteindre. Un profil neuf,
    parce qu'un profil réutilisé rouvre l'onglet et les réglages de la session
    précédente — l'incrément 21 a mesuré une page avec son panneau de réglages
    ouvert sans s'en apercevoir.
  */
  const profil = mkdtempSync(join(tmpdir(), 'chrome-lecteur-'));
  for (const spec of PLATEAUX) {
    const url = `${BASE}${spec.chemin}`;
    console.log(`Ouverture : ${url}`);
    spawn(
      'cmd',
      ['/c', 'start', 'chrome', `--user-data-dir=${profil}`, '--no-first-run',
        '--no-default-browser-check', '--new-window', url],
      { detached: true, stdio: 'ignore' },
    ).unref();
    await attendre(6000);
  }

  console.log('\nDémarrage de NVDA (muet)…');
  await nvda.start({
    settings: {
      // Muet, et cela n'empêche pas la capture : elle se branche sur
      // `pre_speechQueued`, en amont du synthétiseur.
      speech: { synth: 'silence' },
      // Ne rien peindre sur l'écran de quelqu'un.
      vision: {
        NVDAHighlighter: {
          enabled: false,
          highlightFocus: false,
          highlightNavigator: false,
          highlightBrowseMode: false,
        },
      },
      general: { playStartAndExitSounds: false },
      speechViewer: { showSpeechViewerAtStartup: false },
    },
  });
  await attendre(3000);

  try {
    for (const spec of PLATEAUX) await mesurer(spec);
  } catch (error) {
    const message = String(error?.message ?? error);
    console.error(`\nINTERROMPU : ${message}`);
    echecs.push(`exécution interrompue — ${message}`);
    releve.push({ plateau: courant, etape: 'erreur', geste: 'interruption', entendu: [message] });
  } finally {
    console.log('\nArrêt de NVDA…');
    try {
      await nvda.stop();
    } catch {
      /* déjà arrêté */
    }
    writeFileSync(
      new URL('../releve-lecteur-decran.json', import.meta.url),
      JSON.stringify({ base: BASE, quand: new Date().toISOString(), echecs, releve }, null, 2),
      'utf8',
    );
  }

  console.log('\n════════════════════════════════════');
  if (echecs.length === 0) {
    console.log('  Les deux plateaux sont tenus.');
  } else {
    console.log(`  ${String(echecs.length)} manquement(s) :`);
    for (const e of echecs) console.log(`   • ${e}`);
    process.exitCode = 1;
  }
}

await main();
