import { Vector2D } from './types';
import { vecAdd, vecDistance, vecLength, vecNormalize, vecScale, vecSub } from './math';

export interface GravityWell {
  id: number;
  pos: Vector2D;
  mass: number;
  eventHorizonRadius: number;
  influenceRadius: number;
  swirlAngularVelocity: number;
  pulsePhase: number;
  active: boolean;
}

export function calculateGravitationalForce(
  well: GravityWell,
  targetPos: Vector2D
): Vector2D {
  const toWell = vecSub(well.pos, targetPos);
  const dist = vecLength(toWell);

  if (dist > well.influenceRadius || dist < 0.001) {
    return { x: 0, y: 0 };
  }

  // Clamped inverse-square force: F = G * mass / max(dist^2, minRadius^2)
  const effectiveDist = Math.max(well.eventHorizonRadius * 0.8, dist);
  const forceMagnitude = (well.mass * 8000) / (effectiveDist * effectiveDist);
  const pullDir = vecNormalize(toWell);
  const radialForce = vecScale(pullDir, forceMagnitude);

  // Perpendicular tangential swirl force (creates rotating accretion vortex)
  const tangentDir = { x: -pullDir.y, y: pullDir.x };
  const swirlForce = vecScale(tangentDir, well.swirlAngularVelocity * (1 - dist / well.influenceRadius) * 120);

  return vecAdd(radialForce, swirlForce);
}

export function isInsideEventHorizon(
  well: GravityWell,
  targetPos: Vector2D,
  targetRadius: number
): boolean {
  const dist = vecDistance(well.pos, targetPos);
  return dist <= well.eventHorizonRadius + targetRadius;
}

export class GravityFieldManager {
  public wells: GravityWell[] = [];
  private nextId = 1;

  public reset(): void {
    this.wells = [];
  }

  public spawnWell(
    x: number,
    y: number,
    mass = 220,
    eventHorizonRadius = 24,
    influenceRadius = 260,
    swirlAngularVelocity = 1.2
  ): GravityWell {
    const well: GravityWell = {
      id: this.nextId++,
      pos: { x, y },
      mass,
      eventHorizonRadius,
      influenceRadius,
      swirlAngularVelocity,
      pulsePhase: 0,
      active: true
    };
    this.wells.push(well);
    return well;
  }

  public removeWell(id: number): void {
    this.wells = this.wells.filter((w) => w.id !== id);
  }

  public applyToBody(
    pos: Vector2D,
    vel: Vector2D,
    dt: number,
    massFactor = 1.0
  ): { newVel: Vector2D; insideEventHorizon: boolean } {
    let combinedForce: Vector2D = { x: 0, y: 0 };
    let insideHorizon = false;

    for (const well of this.wells) {
      if (!well.active) continue;

      if (isInsideEventHorizon(well, pos, 6)) {
        insideHorizon = true;
      }

      const force = calculateGravitationalForce(well, pos);
      combinedForce = vecAdd(combinedForce, force);
    }

    const accel = vecScale(combinedForce, dt * massFactor);
    const newVel = vecAdd(vel, accel);

    return { newVel, insideEventHorizon: insideHorizon };
  }

  public update(dt: number): void {
    for (const w of this.wells) {
      w.pulsePhase += dt * 3.0;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const w of this.wells) {
      if (!w.active) continue;

      const pulse = Math.sin(w.pulsePhase) * 3;

      // 1. Influence boundary (faint cyan/amber ring)
      ctx.beginPath();
      ctx.arc(w.pos.x, w.pos.y, w.influenceRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Accretion vortex spirals
      const arms = 3;
      ctx.strokeStyle = 'rgba(255, 140, 20, 0.35)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ff6600';

      for (let i = 0; i < arms; i++) {
        const baseAngle = (i * (Math.PI * 2)) / arms + w.pulsePhase * 0.5;
        ctx.beginPath();
        for (let r = w.eventHorizonRadius; r <= w.influenceRadius * 0.8; r += 8) {
          const theta = baseAngle + (r / 35);
          const x = w.pos.x + Math.cos(theta) * r;
          const y = w.pos.y + Math.sin(theta) * r;
          if (r === w.eventHorizonRadius) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // 3. Black Hole Event Horizon
      ctx.beginPath();
      ctx.arc(w.pos.x, w.pos.y, w.eventHorizonRadius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#030509';
      ctx.fill();

      // Glowing singularity rim
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff5500';
      ctx.stroke();

      // Deep dark core
      ctx.beginPath();
      ctx.arc(w.pos.x, w.pos.y, w.eventHorizonRadius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.shadowBlur = 0;
      ctx.fill();
    }

    ctx.restore();
  }
}
