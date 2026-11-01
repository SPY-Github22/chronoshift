import { describe, it, expect } from 'vitest';
import {
  GravityFieldManager,
  calculateGravitationalForce,
  isInsideEventHorizon,
  GravityWell
} from './gravity';
import { vecLength } from './math';

describe('Gravitational Singularity Engine', () => {
  const sampleWell: GravityWell = {
    id: 1,
    pos: { x: 500, y: 500 },
    mass: 200,
    eventHorizonRadius: 20,
    influenceRadius: 250,
    swirlAngularVelocity: 1.0,
    pulsePhase: 0,
    active: true
  };

  it('pulls objects toward the singularity center when within influence radius', () => {
    // Position to the left of singularity at (400, 500), dist = 100
    const targetPos = { x: 400, y: 500 };
    const force = calculateGravitationalForce(sampleWell, targetPos);

    // Force should pull rightwards toward +x (500)
    expect(force.x).toBeGreaterThan(0);
    expect(vecLength(force)).toBeGreaterThan(0);
  });

  it('exerts zero force when target is beyond influence radius', () => {
    // Position 400px away (well beyond influence radius of 250)
    const farTarget = { x: 100, y: 500 };
    const force = calculateGravitationalForce(sampleWell, farTarget);

    expect(force).toEqual({ x: 0, y: 0 });
  });

  it('accurately identifies event horizon containment', () => {
    const insideTarget = { x: 512, y: 500 }; // dist = 12 <= 20 + 6
    expect(isInsideEventHorizon(sampleWell, insideTarget, 6)).toBe(true);

    const outsideTarget = { x: 550, y: 500 }; // dist = 50 > 26
    expect(isInsideEventHorizon(sampleWell, outsideTarget, 6)).toBe(false);
  });

  it('updates body velocity over time with gravity field acceleration', () => {
    const field = new GravityFieldManager();
    field.spawnWell(200, 200, 150, 15, 200, 1.0);

    const initialPos = { x: 250, y: 200 };
    const initialVel = { x: 0, y: 0 };
    const dt = 0.05;

    const { newVel, insideEventHorizon } = field.applyToBody(initialPos, initialVel, dt);

    expect(insideEventHorizon).toBe(false);
    // Well is at x=200, body is at x=250 -> acceleration pulls towards -x
    expect(newVel.x).toBeLessThan(0);
  });
});
