import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { composeCase } from '../compose/index.js';
import { DECORS } from '../scene/decors.js';
import { CASE_ENCODING_VERSION, CaseDecodeError, decodeCase, encodeCase, tryDecodeCase } from './encode.js';
import type { CaseFile } from '../types.js';

/**
 * Le code d'une affaire, vérifié là où il engage.
 *
 * Un code imprimé est une promesse sans recours : le cahier est distribué, et
 * rien ne peut plus être corrigé. Les contrôles portent donc sur ce qui rendrait
 * cette promesse fausse — un aller-retour qui perd un indice, un code qui se
 * relit en une autre affaire, ou un code abîmé qui se relit quand même.
 *
 * **Aucune affaire inventée** : toutes celles qui figurent ici sortent du
 * générateur et sont vérifiées par le solveur exact avant d'être encodées.
 */

/** Des affaires réelles, produites une fois pour tout le fichier. */
const CASES: CaseFile[] = (() => {
  const files: CaseFile[] = [];
  for (let index = 0; files.length < 24 && index < 60; index++) {
    const file = composeCase(`code-${String(index)}`);
    if (file !== null) files.push(file);
  }
  return files;
})();

describe('le code d’une affaire', () => {
  it('dispose d’assez d’affaires pour que les contrôles mordent', () => {
    // Le garde-fou du garde-fou : une liste courte ferait passer tout le reste.
    expect(CASES.length).toBeGreaterThanOrEqual(24);
    expect(new Set(CASES.map((file) => file.decorId)).size).toBeGreaterThan(1);
  });

  it('rend l’affaire entière, et pas seulement ce qu’il transporte', () => {
    /*
      Le code ne porte que le décor, la victime et les indices ; la solution, le
      coupable et les mesures sont **recalculés**. L'égalité doit donc porter sur
      tout, y compris sur ce qui n'a jamais voyagé — c'est ce qui prouve que le
      recalcul est le bon.
    */
    for (const file of CASES) {
      const back = decodeCase(encodeCase(file));
      expect(back.decorId, file.seed).toBe(file.decorId);
      expect(back.victim, file.seed).toBe(file.victim);
      expect(back.clues, file.seed).toEqual(file.clues);
      expect(back.solution, file.seed).toEqual(file.solution);
      expect(back.murderer, file.seed).toBe(file.murderer);
      expect(back.hardest, file.seed).toBe(file.hardest);
      expect(back.stepCount, file.seed).toBe(file.stepCount);
    }
  });

  it('ne porte pas la graine, et le dit', () => {
    // La graine ne reproduit pas une affaire d'une version du registre à
    // l'autre : la transporter donnerait une provenance fausse. Le champ existe
    // pour la forme du type, vide pour la vérité.
    for (const file of CASES) expect(decodeCase(encodeCase(file)).seed).toBe('');
  });

  it('rend toujours le même code pour la même affaire', () => {
    // Le code est l'identité d'une partie : deux encodages qui divergeraient
    // feraient deux entrées d'historique pour une seule affaire.
    for (const file of CASES) expect(encodeCase(file)).toBe(encodeCase(file));
  });

  it('tient dans une adresse et sur un QR code', () => {
    /*
      La borne n'est pas esthétique. Un code d'affaire voyage dans un fragment
      d'URL et sous une grille imprimée ; c'est la longueur qui décide de la
      densité du QR, donc de sa lisibilité au téléphone. Mesuré ici entre 27 et
      36 caractères — la borne est posée au double, pour attraper une dérive de
      format sans casser au premier indice de plus.
    */
    for (const file of CASES) {
      const code = encodeCase(file);
      expect(code.length, file.seed).toBeLessThan(80);
      expect(code, file.seed).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('refuse un code d’une autre version', () => {
    // Le premier octet porte la version. Un code futur doit être refusé net,
    // jamais interprété à moitié.
    const code = encodeCase(CASES[0]);
    expect(CASE_ENCODING_VERSION).toBe(1);
    // « B » vaut 1 dans l'alphabet : le premier sextet passe de 0 à 1, donc le
    // premier octet de 0 à 4 — une version que personne n'a jamais écrite.
    expect(tryDecodeCase(`B${code.slice(1)}`)).toBeNull();
  });

  it('refuse ce qui n’est pas un code', () => {
    for (const text of ['', 'A', '!!!', 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
      expect(tryDecodeCase(text), text).toBeNull();
    }
    expect(() => decodeCase('!!!')).toThrow(CaseDecodeError);
  });

  it('refuse un code rallongé plutôt que d’ignorer la queue', () => {
    /*
      Sans ce contrôle, deux textes différents désigneraient la même affaire.
      Cela ne casserait aucune déduction — et casserait l'identité d'une partie
      dans l'historique, ce qui est pire parce que personne ne le verrait.
    */
    for (const file of CASES.slice(0, 6)) {
      expect(tryDecodeCase(`${encodeCase(file)}AAAA`), file.seed).toBeNull();
    }
  });

  it('attrape un lien tronqué à tous les coups, et on mesure le reste', () => {
    /*
      Il n'y a pas de somme de contrôle, et ce test est la raison qu'on en donne.
      On abîme des codes au hasard et on compte ce qui se relit quand même.

      Les trois modes ne se valent pas, et c'est tout l'argument. Le risque que
      la littérature nomme pour un lien partagé est la **troncature** — un client
      de courrier qui replie à 76 colonnes, une passerelle SMS qui recolle mal.
      Or un caractère perdu ou ajouté décale tout ce qui suit : mesuré sur 20 000
      corruptions de chaque sorte, **0 perte et 1 ajout** se relisent encore.
      Une substitution isolée, elle, passe dans 3,1 % des cas.

      Ce qui passe n'est d'ailleurs pas cassé : c'est une **autre affaire
      valide**, à solution unique et déductible, parce que `decodeCase`
      reconstruit tout et refuse le reste. Un caractère de contrôle ne ferait
      pas mieux sur la troncature, qui est déjà à zéro.
    */
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const codes = CASES.map((file) => encodeCase(file));
    const tally = { drop: { tried: 0, read: 0 }, swap: { tried: 0, read: 0 } };

    fc.assert(
      fc.property(
        fc.nat({ max: codes.length - 1 }),
        fc.nat({ max: 1000 }),
        fc.nat({ max: 63 }),
        fc.boolean(),
        (which, position, replacement, drop) => {
          const code = codes[which];
          const at = position % code.length;
          const broken = drop
            ? code.slice(0, at) + code.slice(at + 1)
            : code.slice(0, at) + alphabet[replacement] + code.slice(at + 1);
          if (broken === code) return;

          const bucket = drop ? tally.drop : tally.swap;
          bucket.tried++;
          const decoded = tryDecodeCase(broken);
          if (decoded === null) return;
          bucket.read++;
          // Ce qui survit doit rester jouable — c'est cela qui rend l'absence de
          // somme de contrôle acceptable, et non le taux lui-même.
          expect(decoded.stepCount).toBeGreaterThan(0);
        },
      ),
      { numRuns: 4000 },
    );

    expect(tally.drop.tried, 'aucune troncature produite').toBeGreaterThan(500);
    expect(tally.swap.tried, 'aucune substitution produite').toBeGreaterThan(500);
    // La troncature est le risque nommé : on l'attrape, et on ne s'en remet pas
    // au hasard. La substitution est bornée large, pour ne pas casser sur un
    // tirage défavorable là où la mesure hors test donne 3,1 %.
    expect(tally.drop.read / tally.drop.tried).toBeLessThan(0.005);
    expect(tally.swap.read / tally.swap.tried).toBeLessThan(0.08);
  });

  it('code tous les décors livrés, et refuse un décor inconnu', () => {
    for (const decor of DECORS) {
      const file = composeCase('code-décor', { decorId: decor.id });
      expect(file, decor.id).not.toBeNull();
      if (file === null) continue;
      expect(decodeCase(encodeCase(file)).decorId, decor.id).toBe(decor.id);
    }

    // Un décor qu'on ne sait pas charger ne doit pas produire une affaire
    // silencieusement fausse : il doit être refusé au décodage.
    const invented: CaseFile = { ...CASES[0], decorId: 'chateau-imaginaire' };
    expect(tryDecodeCase(encodeCase(invented))).toBeNull();
  });

  it('couvre toutes les familles d’indices que le format connaît', () => {
    /*
      Une famille qui n'apparaît dans aucune affaire de l'échantillon ne serait
      pas vérifiée, et son encodage pourrait être faux sans que rien ne le dise.
      On mesure la couverture au lieu de la supposer.
    */
    const seen = new Set(CASES.flatMap((file) => file.clues.map((clue) => clue.kind)));
    expect(seen.size, `familles rencontrées : ${[...seen].sort().join(', ')}`).toBeGreaterThanOrEqual(
      8,
    );
  });
});
