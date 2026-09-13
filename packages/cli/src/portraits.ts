import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CAST } from '@sudoku/engine/investigation';
import { FACES, type Face } from '../../app/src/lib/investigation/portrait.js';

/**
 * La fabrique des seize portraits.
 *
 * ─── Pourquoi cette fabrique existe, et pourquoi elle est dans le dépôt ─────
 *
 * Un portrait engendré est un actif qu'on ne sait plus refaire si la recette
 * n'est pas écrite. Ce fichier **est** la recette : la charte de série, les
 * seize spécifications, les réglages d'encodage. Relancer le tout coûte quelques
 * minutes et quelques dizaines de centimes ; le refaire de mémoire coûterait une
 * journée et ne rendrait pas la même chose.
 *
 * ─── Pourquoi l'API d'OpenAI en direct, et pas un revendeur ────────────────
 *
 * La première bibliothèque est passée par un agrégateur, et la lecture de ses
 * conditions a tranché contre lui — sur trois points, tous écrits :
 *
 *   · ses conditions générales définissent la « sortie » comme **de l'audio ou
 *     du texte**. L'image n'entre pas dans la définition, donc la clause qui
 *     laisse ses droits à l'utilisateur porte sur un terme qui l'exclut ; et les
 *     conditions dédiées à l'image ne contiennent **aucune** clause de
 *     propriété ;
 *   · elles **excluent expressément** toute indemnisation en propriété
 *     intellectuelle pour ce service ;
 *   · et l'indemnisation du fournisseur du modèle ne se transmet pas : son
 *     contrat-cadre ferme la porte — « no intended third-party beneficiaries ».
 *
 * L'accès direct donne les trois : cession écrite de la sortie, usage commercial
 * sans palier, indemnisation, et pas d'entraînement par défaut.
 *
 * ─── Ce que la génération ne décide pas ────────────────────────────────────
 *
 * Les cinq axes viennent de `FACES`, les noms de `CAST`, les couleurs des jetons
 * d'`app.css`. Rien n'est retapé ici : une teinte recopiée de travers donnerait
 * un portrait qui contredit la table sans que rien ne le signale, et c'est le
 * seul endroit du pipeline où une faute serait invisible.
 *
 * ─── Usage ─────────────────────────────────────────────────────────────────
 *
 * Sous PowerShell — il n'y a **pas** de préfixe de variable en ligne, la forme
 * `VAR=valeur commande` est du bash et n'existe pas ici :
 *
 *     $env:OPENAI_API_KEY = "…"
 *     pnpm portraits                 # les seize
 *     pnpm portraits L M             # seulement Léa et Maël
 *
 * Sous bash ou zsh :
 *
 *     OPENAI_API_KEY=… pnpm portraits
 *
 * La clef est lue dans l'environnement et n'est jamais écrite nulle part.
 */

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '../../..');
const PUBLIC = join(RACINE, 'packages/app/public/portraits');
const MASTERS = join(RACINE, 'packages/app/public/portraits/masters');

/**
 * Le côté du fichier livré, et c'est un calcul, pas un arrondi.
 *
 * La carte fait 3,5 rem, soit 56 px à la racine par défaut. Le réglage
 * « très grand » porte cette racine à 125 %, donc 70 px. À densité 3, il faut
 * 210 px. 224 les couvre et garde un peu de marge.
 */
const COTE = 224;


/** Le crème du fond, lu dans le jeton plutôt que recopié. */
function cremeDuFond(): [number, number, number] {
  const hex = jeton('portrait-plate');
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * La charte de série : ce qui est identique pour les seize, mot pour mot.
 *
 * Les cinq couleurs qu'elle nomme sont **lues dans les jetons**, comme les axes.
 * Elles y étaient d'abord recopiées en dur, ce qui a produit exactement le
 * défaut que le projet corrige ailleurs : `--portrait-light`, `--portrait-shade`
 * et `--eye-sclera` se sont retrouvés déclarés et référencés nulle part le jour
 * où le dessin SVG a disparu, tandis que leurs valeurs continuaient de vivre,
 * retapées, dans ce texte. Deux sources de vérité, et la mauvaise gagnait.
 */
function charte(): string {
  return `Flat vector illustration, NOT painted, NOT airbrushed. A single bust portrait of one person, centred, on a plain flat background (${jeton('portrait-plate')}) filling the whole square. No border, no frame, no panel, no vignette, no text.

RENDERING, more important than anything else:
Every surface is one uniform fill of one solid colour. Shadows are SEPARATE SOLID SHAPES with hard crisp edges — never blurred, never blended, never faded. Exactly two values per surface: the base colour, and one shadow colour. No gradient anywhere. No soft shading. No texture. No glow. At most 10 distinct flat colours in the whole image.

SHADOWS — all three, as hard-edged solid shapes: one under the jaw falling onto the neck; one down the right side of the face and neck; one on the right side of the garment. One light source, upper left, so every shadow sits on the lower-right of its form.

Ink outline in warm dark charcoal (${jeton('portrait-shade')}), clean and even, noticeably heavier on the outer silhouette than on interior detail.

FRAMING, exact: head and shoulders, facing the viewer straight on, cropped at mid-chest by the bottom edge. The head fills about half the square's height. The eyes sit on a horizontal line at 45% of the square's height from the top. Generous background margin on the left and right of the shoulders.

Eyes: almond shaped, raised outer corner, thickened upper lid line. A faintly warm off-white sclera (${jeton('eye-sclera')}) — never pure white. A teal-grey iris (${jeton('eye-iris')}) clearly distinct from a much darker pupil, and one small solid highlight (${jeton('portrait-light')}) at the upper left of each iris.

Calm neutral expression, mouth closed.

The person:
`;
}

/** La coiffure, dite comme un illustrateur la demanderait. */
const COIFFURES: Record<Face['hair'], string> = {
  court: 'short cropped hair',
  carre: 'a BLUNT chin-length bob — straight hair cut in one level line at the jaw, with a straight fringe, not layered and never reaching the shoulders',
  long: 'long straight hair falling well past the shoulders',
  queue: 'a long ponytail falling over one shoulder',
  boucle: 'voluminous curly hair',
  chignon: 'hair gathered in a bun',
  'mi-long': 'shoulder-length hair',
  couettes: 'two low bunches falling from the temples',
};

const PEAUX = ['very light skin', 'light tan skin', 'warm mid-brown skin', 'deep dark brown skin'];
const CHEVEUX = ['near-black hair', 'dark brown hair', 'golden blonde hair', 'silver grey hair'];
const HAUTS = ['a deep teal top', 'a slate blue top', 'a clay-rose top', 'a warm sand top'];

/** Les couleurs viennent des jetons, jamais d'une valeur recopiée ici. */
const CSS = readFileSync(join(RACINE, 'packages/app/src/app.css'), 'utf8');
function jeton(nom: string): string {
  const trouve = new RegExp(`^\\s*--${nom}:\\s*(#[0-9a-f]{6});`, 'm').exec(CSS);
  if (trouve === null) throw new Error(`Jeton introuvable dans app.css : --${nom}`);
  return trouve[1];
}

function specification(face: Face, index: number): string {
  const personne = CAST[index];
  const qui = personne.gender === 'f' ? 'Woman' : 'Man';
  return [
    `${qui}, ${COIFFURES[face.hair]}`,
    `${PEAUX[face.skin - 1]} (${jeton(`skin-${String(face.skin)}`)})`,
    `${CHEVEUX[face.hairTone - 1]} (${jeton(`hair-${String(face.hairTone)}`)})`,
    face.glasses ? 'round dark-rimmed glasses' : 'no glasses',
    `${HAUTS[face.garment - 1]} (${jeton(`garment-${String(face.garment)}`)})`,
  ].join(', ');
}

async function engendre(prompt: string, clef: string): Promise<Buffer> {
  const reponse = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clef}` },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
    }),
  });
  if (!reponse.ok) {
    throw new Error(`L'API a répondu ${String(reponse.status)} : ${await reponse.text()}`);
  }
  const corps = (await reponse.json()) as { data: { b64_json?: string }[] };
  const b64 = corps.data[0]?.b64_json;
  if (b64 === undefined) throw new Error("L'API n'a rendu aucune image.");
  return Buffer.from(b64, 'base64');
}

/**
 * La dérive de couleur, corrigée d'un seul décalage.
 *
 * Le modèle ne rend pas la couleur qu'on lui donne. Mesuré sur les seize : le
 * crème demandé était `#faf6f0`, l'obtenu allait de `#ecdec9` à `#fff3da`, et
 * **toujours plus jaune** — le canal bleu manquait de vingt à quarante points.
 * Un seul portrait, on ne le voit pas ; seize côte à côte dans une liste, si.
 *
 * ─── Pourquoi un décalage global, et pas un remplissage du fond ─────────────
 *
 * Parce que la propagation a été essayée et qu'elle a **détruit deux portraits**.
 * Partie des bords, tolérance comparée au voisin pour suivre le dégradé, elle
 * s'est faufilée par l'anticrénelage entre le crème et une peau très claire —
 * `--skin-1` n'est qu'à quatre-vingts points du fond, et la rampe qui va de l'un
 * à l'autre avance par pas d'une vingtaine. Une fois entrée dans le visage, plus
 * rien ne l'arrêtait : Léa et Nadia sont ressorties en silhouettes blanches.
 *
 * Une tolérance globale ne s'en sort pas non plus : le dégradé du fond couvre
 * cent points, la peau claire est à quatre-vingts. Aucun seuil ne sépare les deux.
 *
 * Le décalage global, lui, ne peut pas fuir — il n'a pas de frontière à franchir.
 * Et c'est le bon modèle : **toute l'image** a dérivé vers le chaud, pas
 * seulement son fond. La corriger d'un bloc ramène aussi les peaux et les
 * vêtements vers leurs jetons.
 *
 * La couleur dominante sert de repère parce que le fond occupe plus de surface
 * que tout le reste. Rien à deviner, rien à seuiller.
 */
async function corrigeLaDerive(png: Buffer, cible: [number, number, number]): Promise<Buffer> {
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // La couleur dominante **est** le fond : il occupe plus de place que tout le
  // reste. Pas besoin de deviner où il commence.
  const comptes = new Map<number, number>();
  for (let i = 0; i < data.length; i += channels) {
    const clef = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    comptes.set(clef, (comptes.get(clef) ?? 0) + 1);
  }
  let fond = 0;
  let record = 0;
  for (const [clef, n] of comptes) {
    if (n > record) {
      record = n;
      fond = clef;
    }
  }
  const decalage = [
    cible[0] - ((fond >> 16) & 0xff),
    cible[1] - ((fond >> 8) & 0xff),
    cible[2] - (fond & 0xff),
  ];

  for (let i = 0; i < data.length; i += channels) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.min(255, Math.max(0, data[i + c] + decalage[c]));
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * L'encodage, et les trois mesures qui l'ont fixé.
 *
 * Pesé sur les seize vrais fichiers, pas estimé : AVIF q75 en 4:4:4 donne
 * 83,2 ko, WebP q80 en donne 71,5, soit 154,8 ko pour les trente-deux.
 *
 *   · le **4:4:4** ne coûte que 4,5 % de plus que le 4:2:0 par défaut, et il
 *     évite que la chrominance bave sur les contours d'encre. C'est là qu'un
 *     aplat se distingue nettement d'une photo ;
 *   · le **sans perte a été essayé et écarté** — 658 ko, huit fois le compte.
 *     « Un aplat compresse bien sans perte » est faux ici : l'anticrénelage des
 *     contours le ruine ;
 *   · le master de 1024 est **gardé**, pour pouvoir réencoder sans repayer une
 *     génération.
 */
async function encode(png: Buffer, lettre: string, garderMaster: boolean): Promise<void> {
  const bas = lettre.toLowerCase();
  /*
    Le master en AVIF de haute qualité plutôt qu'en PNG, et c'est mesuré : les
    seize pesaient **24,2 Mo** en PNG contre **3,58 Mo** à q94 en 4:4:4, pour un
    écart maximal de 23 sur un seul canal d'un seul pixel — au bord d'un trait
    d'encre, là où l'anticrénelage travaille. Le master finit de toute façon
    réduit à 224 px, ce qui moyenne cet écart bien en dessous du visible.

    Sept fois plus léger dans un dépôt qui les gardera pour toujours, contre une
    perte qu'aucune mesure ne retrouve en aval : l'arbitrage n'est pas serré.
  */
  if (garderMaster) {
    await sharp(png).avif({ quality: 94, chromaSubsampling: '4:4:4' }).toFile(join(MASTERS, `${bas}.avif`));
  }
  const propre = await corrigeLaDerive(png, cremeDuFond());
  const carre = sharp(propre).resize(COTE, COTE, { kernel: 'lanczos3' });
  await carre.clone().avif({ quality: 75, chromaSubsampling: '4:4:4' }).toFile(join(PUBLIC, `${bas}.avif`));
  await carre.clone().webp({ quality: 80, effort: 6 }).toFile(join(PUBLIC, `${bas}.webp`));
}

async function main(): Promise<void> {
  const clef = process.env.OPENAI_API_KEY ?? '';
  if (clef === '' && !process.argv.includes('--reencode')) {
    /*
      Le message dit la syntaxe de **la** machine, pas celle d'une autre.

      Il ne donnait que la forme bash `VAR=valeur commande`, qui n'existe pas
      sous PowerShell : l'utilisateur a reçu « le terme OPENAI_API_KEY= n'est
      pas reconnu » et a pu croire à un défaut du script. Un message d'aide qui
      se trompe de plateforme est pire que pas de message.
    */
    const windows = process.platform === 'win32';
    console.error(
      [
        'OPENAI_API_KEY manque.',
        'La clef est lue dans l’environnement, jamais écrite ni conservée.',
        '',
        ...(windows
          ? ['PowerShell :', '  $env:OPENAI_API_KEY = "…"', '  pnpm portraits']
          : ['bash / zsh :', '  OPENAI_API_KEY=… pnpm portraits']),
      ].join('\n'),
    );
    process.exit(1);
  }

  /*
    Deux modes, et le second est la raison d'être des masters.

    `--reencode` repart des PNG de 1024 déjà sur le disque : changer un réglage
    d'encodage, ou corriger le fond comme il a fallu le faire, ne coûte alors ni
    un appel ni un centime. Un actif qu'on ne peut retoucher qu'en le repayant
    n'est pas vraiment à soi.
  */
  const reencode = process.argv.includes('--reencode');
  const demandes = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'))
    .map((a) => a.toUpperCase());
  const cibles = CAST.slice(0, FACES.length)
    .map((personne, index) => ({ personne, face: FACES[index], index }))
    .filter(({ personne }) => demandes.length === 0 || demandes.includes(personne.letter));

  if (cibles.length === 0) {
    console.error(`Aucune lettre reconnue parmi : ${demandes.join(', ')}`);
    process.exit(1);
  }

  mkdirSync(PUBLIC, { recursive: true });
  mkdirSync(MASTERS, { recursive: true });

  for (const { personne, face, index } of cibles) {
    process.stdout.write(`${personne.letter} — ${personne.name.padEnd(9)} `);
    const debut = Date.now();
    const png = reencode
      ? readFileSync(join(MASTERS, `${personne.letter.toLowerCase()}.avif`))
      : await engendre(charte() + specification(face, index), clef);
    await encode(png, personne.letter, !reencode);
    console.log(`${((Date.now() - debut) / 1000).toFixed(1)} s`);
  }

  console.log(
    `\n${String(cibles.length)} portraits écrits dans packages/app/public/portraits.\n` +
      'À relire axe par axe contre la table avant de livrer : la fidélité mesurée\n' +
      'sur la première bibliothèque était de 67 sur 68, pas de 68 sur 68.',
  );
}

await main();
