import { describe, it, expect } from 'vitest';
import {
  checkGatePassThrough,
  checkBlackHoleEntry,
  calculateTeleportExit,
  SlipstreamManager,
  SpeedGate,
  WormholePair
} from './slipstream';
import { vecLength } from './math';

describe('Slipstream & Wormhole Engine', () => {
  const sampleGate: SpeedGate = {
    id: 1,
    pos: { x: 400, y: 300 },
    width: 120,
    height: 20,
    speed: 200,
    passed: false,
    active: true
  };

  const sampleWormhole: WormholePair = {
    id: 1,
    blackHole: {
      pos: { x: 200, y: 200 },
      radius: 25,
      pullRadius: 150,
      swirlAngle: 0
    },
    whiteHole: {
      pos: { x: 700, y: 400 },
      radius: 25,
      blastRadius: 160,
      pulsePhase: 0
    },
    cooldownTimer: 0,
    active: true
  };

  it('detects player passing through a speed gate archway', () => {
    const insidePos = { x: 410, y: 305 };
    expect(checkGatePassThrough(sampleGate, insidePos, 8)).toBe(true);

    const outsidePos = { x: 600, y: 300 };
    expect(checkGatePassThrough(sampleGate, outsidePos, 8)).toBe(false);
  });

  it('detects black hole entry when inside the event horizon', () => {
    // Black hole is at (200, 200), radius 25. Player at (210, 200) -> dist = 10 <= 25 + 8
    const enterPos = { x: 210, y: 200 };
    expect(checkBlackHoleEntry(sampleWormhole, enterPos, 8)).toBe(true);

    // Player far away
    const farPos = { x: 400, y: 200 };
    expect(checkBlackHoleEntry(sampleWormhole, farPos, 8)).toBe(false);
  });

  it('teleports the player to the white hole with outward velocity boost', () => {
    const incomingVel = { x: 0, y: -200 }; // Heading up
    const { exitPos, exitVel } = calculateTeleportExit(sampleWormhole, incomingVel, 450);

    expect(exitPos).toEqual({ x: 700, y: 400 });
    expect(exitVel.y).toBeLessThan(0); // Preserved direction
    expect(vecLength(exitVel)).toBeGreaterThanOrEqual(450);
  });

  it('initializes streaks and manages gate states in SlipstreamManager', () => {
    const manager = new SlipstreamManager();
    expect(manager.streaks.length).toBeGreaterThan(0);
    expect(manager.isSuperluminal).toBe(false);

    manager.reset();
    expect(manager.gates).toHaveLength(0);
    expect(manager.wormholes).toHaveLength(0);
  });
});
