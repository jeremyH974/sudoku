import { describe, expect, it } from 'vitest';
import { Stopwatch } from './stopwatch.svelte.js';

/**
 * Horloge pilotée à la main.
 *
 * Tout l'intérêt d'injecter le temps : les cas limites — une nuit entre deux
 * segments, une horloge qui recule, une absence d'une heure — se déclenchent par
 * un appel de fonction plutôt qu'en déplaçant l'heure du système sous les pieds
 * du lanceur de tests.
 */
function fakeClock(): { now: () => number; advance: (ms: number) => void; set: (ms: number) => void } {
  let value = 0;
  return {
    now: () => value,
    advance: (ms) => (value += ms),
    set: (ms) => (value = ms),
  };
}

const MINUTE = 60_000;

describe('Stopwatch', () => {
  it('ne compte rien tant qu’il n’a pas démarré', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    clock.advance(5 * MINUTE);
    watch.sample();
    expect(watch.elapsedMs).toBe(0);
    expect(watch.running).toBe(false);
  });

  it('compte le temps du segment ouvert', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    watch.start();
    clock.advance(90_000);
    watch.sample();
    expect(watch.elapsedMs).toBe(90_000);
  });

  it('additionne les segments et ignore les pauses', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);

    watch.start();
    clock.advance(2 * MINUTE);
    watch.pause();

    // Trois minutes onglet caché : elles ne doivent pas compter.
    clock.advance(3 * MINUTE);
    watch.sample();
    expect(watch.elapsedMs).toBe(2 * MINUTE);

    watch.start();
    clock.advance(MINUTE);
    watch.pause();
    expect(watch.elapsedMs).toBe(3 * MINUTE);
  });

  it('reste insensible à un double démarrage', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    watch.start();
    clock.advance(MINUTE);
    // Un second `start` ne doit pas rouvrir un segment par-dessus l'autre.
    watch.start();
    clock.advance(MINUTE);
    watch.pause();
    expect(watch.elapsedMs).toBe(2 * MINUTE);
  });

  it('reprend une partie sauvegardée sans compter la nuit', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);

    watch.start();
    clock.advance(7 * MINUTE);
    watch.pause();
    const saved = watch.elapsedMs;

    // Le lendemain : nouveau document, horloge monotone repartie de zéro, et
    // seize heures de vraie vie entre les deux. C'est le cas que la forme
    // « instant de départ persisté » rend impossible à traiter.
    const nextDay = fakeClock();
    const resumed = new Stopwatch(nextDay.now);
    resumed.reset(saved);
    expect(resumed.elapsedMs).toBe(7 * MINUTE);

    resumed.start();
    nextDay.advance(3 * MINUTE);
    resumed.pause();
    expect(resumed.elapsedMs).toBe(10 * MINUTE);
    expect(resumed.trustworthy).toBe(true);
  });

  it('ne recule jamais quand l’horloge recule', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    watch.start();
    clock.advance(4 * MINUTE);
    watch.sample();

    clock.set(0);
    watch.sample();
    expect(watch.elapsedMs).toBeGreaterThanOrEqual(0);

    watch.pause();
    expect(watch.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('cesse de se croire fiable après une longue absence, onglet visible', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    watch.start();
    // Le déjeuner : l'onglet est resté au premier plan, aucun événement du
    // navigateur ne l'a signalé.
    clock.advance(75 * MINUTE);
    watch.sample();

    expect(watch.trustworthy).toBe(false);
    expect(watch.recordableMs()).toBeNull();
    // La durée reste affichée : le joueur voit ce qui a été compté.
    expect(watch.elapsedMs).toBeGreaterThan(0);
  });

  it('cesse de se croire fiable au-delà de deux heures cumulées', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    for (let i = 0; i < 6; i++) {
      watch.start();
      clock.advance(25 * MINUTE);
      watch.pause();
      clock.advance(MINUTE);
    }
    expect(watch.elapsedMs).toBe(150 * MINUTE);
    expect(watch.trustworthy).toBe(false);
    expect(watch.recordableMs()).toBeNull();
  });

  it('rend une durée enregistrable tant que la mesure tient', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    watch.start();
    clock.advance(12 * MINUTE);
    watch.pause();
    expect(watch.recordableMs()).toBe(12 * MINUTE);
  });

  it('repart proprement à la grille suivante', () => {
    const clock = fakeClock();
    const watch = new Stopwatch(clock.now);
    watch.start();
    clock.advance(80 * MINUTE);
    watch.sample();
    expect(watch.trustworthy).toBe(false);

    watch.reset();
    expect(watch.elapsedMs).toBe(0);
    expect(watch.running).toBe(false);
    // La défiance ne se transmet pas d'une partie à l'autre.
    expect(watch.trustworthy).toBe(true);
  });
});
