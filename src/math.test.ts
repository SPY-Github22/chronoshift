import { describe, it, expect } from 'vitest';
import {
  vecCreate,
  vecAdd,
  vecSub,
  vecScale,
  vecLength,
  vecNormalize,
  vecDistance,
  circleCircleCollision,
  circleSegmentDistance,
  circleSegmentCollision,
  isNearMissGraze,
  clamp
} from './math';

describe('Vector & Collision Math Engine', () => {
  it('correctly executes basic vector arithmetic', () => {
    const a = vecCreate(3, 4);
    const b = vecCreate(1, 2);

    expect(vecAdd(a, b)).toEqual({ x: 4, y: 6 });
    expect(vecSub(a, b)).toEqual({ x: 2, y: 2 });
    expect(vecScale(a, 2)).toEqual({ x: 6, y: 8 });
    expect(vecLength(a)).toBeCloseTo(5);
    expect(vecDistance(a, b)).toBeCloseTo(Math.sqrt(4 + 4));
  });

  it('normalizes non-zero vectors accurately', () => {
    const v = vecCreate(0, 10);
    const normalized = vecNormalize(v);
    expect(normalized.x).toBeCloseTo(0);
    expect(normalized.y).toBeCloseTo(1);
    expect(vecLength(normalized)).toBeCloseTo(1);

    const zero = vecCreate(0, 0);
    expect(vecNormalize(zero)).toEqual({ x: 0, y: 0 });
  });

  it('detects circle-circle collision properly', () => {
    const p1 = vecCreate(10, 10);
    const p2 = vecCreate(16, 10);
    const p3 = vecCreate(30, 30);

    // Radii 4 and 3 sum to 7. Distance is 6 -> Collision!
    expect(circleCircleCollision(p1, 4, p2, 3)).toBe(true);

    // Radii 2 and 2 sum to 4. Distance is 6 -> No Collision!
    expect(circleCircleCollision(p1, 2, p2, 2)).toBe(false);

    // Far away
    expect(circleCircleCollision(p1, 5, p3, 5)).toBe(false);
  });

  it('calculates point-to-segment distance and laser beam collisions', () => {
    const segA = vecCreate(0, 100);
    const segB = vecCreate(200, 100);

    // Point right above the segment at (100, 110)
    const target = vecCreate(100, 110);
    expect(circleSegmentDistance(target, segA, segB)).toBeCloseTo(10);

    // Target has radius 12, beam thickness 0 -> collides (dist 10 <= 12)
    expect(circleSegmentCollision(target, 12, segA, segB, 0)).toBe(true);

    // Target has radius 5, beam thickness 4 -> dist 10 > 5 + 2 = 7 -> no collision
    expect(circleSegmentCollision(target, 5, segA, segB, 4)).toBe(false);
  });

  it('differentiates direct hits from near-miss grazes', () => {
    const playerPos = vecCreate(50, 50);
    const playerHitRadius = 8;
    const playerGrazeRadius = 24;
    const hazardRadius = 6;

    // Case 1: Direct hit (distance is 10 <= 8 + 6 = 14)
    const directHazard = vecCreate(58, 50);
    const hitResult = isNearMissGraze(playerPos, playerHitRadius, playerGrazeRadius, directHazard, hazardRadius);
    expect(hitResult.isHit).toBe(true);
    expect(hitResult.isGraze).toBe(false);

    // Case 2: Near-miss graze (distance is 20 > 14, but <= 24 + 6 = 30)
    const grazeHazard = vecCreate(70, 50);
    const grazeResult = isNearMissGraze(playerPos, playerHitRadius, playerGrazeRadius, grazeHazard, hazardRadius);
    expect(grazeResult.isHit).toBe(false);
    expect(grazeResult.isGraze).toBe(true);

    // Case 3: Completely clear (distance is 100 > 30)
    const farHazard = vecCreate(150, 50);
    const clearResult = isNearMissGraze(playerPos, playerHitRadius, playerGrazeRadius, farHazard, hazardRadius);
    expect(clearResult.isHit).toBe(false);
    expect(clearResult.isGraze).toBe(false);
  });

  it('clamps numbers reliably', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
