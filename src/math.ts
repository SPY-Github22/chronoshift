import { Vector2D } from './types';

export function vecCreate(x = 0, y = 0): Vector2D {
  return { x, y };
}

export function vecAdd(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecSub(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(v: Vector2D, s: number): Vector2D {
  return { x: v.x * s, y: v.y * s };
}

export function vecLengthSq(v: Vector2D): number {
  return v.x * v.x + v.y * v.y;
}

export function vecLength(v: Vector2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecNormalize(v: Vector2D): Vector2D {
  const len = vecLength(v);
  if (len < 0.00001) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

export function vecDistanceSq(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function vecDistance(a: Vector2D, b: Vector2D): number {
  return Math.sqrt(vecDistanceSq(a, b));
}

export function vecDot(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

export function vecLerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

export function vecFromAngle(angle: number, length = 1): Vector2D {
  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length
  };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function circleCircleCollision(
  posA: Vector2D,
  radiusA: number,
  posB: Vector2D,
  radiusB: number
): boolean {
  const rSum = radiusA + radiusB;
  return vecDistanceSq(posA, posB) <= rSum * rSum;
}

export function circleSegmentDistance(
  circleCenter: Vector2D,
  segA: Vector2D,
  segB: Vector2D
): number {
  const ab = vecSub(segB, segA);
  const abLenSq = vecLengthSq(ab);

  if (abLenSq < 0.000001) {
    return vecDistance(circleCenter, segA);
  }

  const ac = vecSub(circleCenter, segA);
  const t = clamp(vecDot(ac, ab) / abLenSq, 0, 1);
  const projection = vecAdd(segA, vecScale(ab, t));

  return vecDistance(circleCenter, projection);
}

export function circleSegmentCollision(
  circleCenter: Vector2D,
  radius: number,
  segA: Vector2D,
  segB: Vector2D,
  thickness = 0
): boolean {
  const dist = circleSegmentDistance(circleCenter, segA, segB);
  return dist <= radius + thickness * 0.5;
}

export function isNearMissGraze(
  playerPos: Vector2D,
  playerHitRadius: number,
  playerGrazeRadius: number,
  hazardPos: Vector2D,
  hazardRadius: number
): { isGraze: boolean; isHit: boolean } {
  const distSq = vecDistanceSq(playerPos, hazardPos);
  const hitDist = playerHitRadius + hazardRadius;
  const isHit = distSq <= hitDist * hitDist;

  if (isHit) {
    return { isGraze: false, isHit: true };
  }

  const grazeDist = playerGrazeRadius + hazardRadius;
  const isGraze = distSq <= grazeDist * grazeDist;

  return { isGraze, isHit: false };
}
