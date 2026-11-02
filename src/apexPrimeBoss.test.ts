import { describe, it, expect, beforeEach } from 'vitest';
import { ApexPrimeBoss } from './apexPrimeBoss';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';

describe('A.P.E.X. Prime Final Boss Engine', () => {
  let boss: ApexPrimeBoss;
  let vfx: VFXManager;
  let audio: SoundEngine;

  beforeEach(() => {
    boss = new ApexPrimeBoss();
    boss.spawn(480, 180);
    // Clear initial invulnerability for test damage testing
    // @ts-expect-error accessing private for unit testing
    boss.invulnerableTimer = 0;
    vfx = new VFXManager();
    audio = new SoundEngine();
  });

  it('initializes in Phase 1 with 3000 health', () => {
    expect(boss.active).toBe(true);
    expect(boss.health).toBe(3000);
    expect(boss.phase).toBe(1);
    expect(boss.hasFrontalShield).toBe(false);
  });

  it('transitions through Phase 1 to Phase 2 at 75% HP', () => {
    // 3000 * 0.75 = 2250 HP
    boss.damage(800, { x: 480, y: 300 }, vfx, audio);
    expect(boss.health).toBe(2200);
    expect(boss.phase).toBe(2);
  });

  it('activates Frontal Dimensional Shield in Phase 3 at 50% HP', () => {
    // 3000 * 0.5 = 1500 HP
    boss.damage(1600, { x: 480, y: 300 }, vfx, audio);
    expect(boss.health).toBe(1400);
    expect(boss.phase).toBe(3);
    expect(boss.hasFrontalShield).toBe(true);

    // Frontal attack (attacker below boss, y = 300 > boss.y = 180) is deflected!
    const damagedFront = boss.damage(100, { x: 480, y: 300 }, vfx, audio);
    expect(damagedFront).toBe(false);
    expect(boss.health).toBe(1400);

    // Flank attack from behind (attacker above boss, y = 100 < boss.y = 180) penetrates!
    const damagedBehind = boss.damage(100, { x: 480, y: 100 }, vfx, audio);
    expect(damagedBehind).toBe(false); // health decreases to 1300, not dead
    expect(boss.health).toBe(1300);
  });

  it('transitions to Phase 4 (Supernova) and accepts Superluminal Ramming', () => {
    // Drop to Phase 4 (< 750 HP)
    boss.damage(2300, { x: 480, y: 100 }, vfx, audio, true);
    expect(boss.health).toBe(700);
    expect(boss.phase).toBe(4);
    expect(boss.hasFrontalShield).toBe(false);

    // Superluminal ram damage of 700 fatal
    const killed = boss.damage(700, { x: 480, y: 300 }, vfx, audio, true);
    expect(killed).toBe(true);
    expect(boss.active).toBe(false);
    expect(boss.health).toBe(0);
  });
});
