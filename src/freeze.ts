import { Vector2D } from './types';
import { circleCircleCollision, vecDistance } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';

export interface FrozenShard {
  id: number;
  pos: Vector2D;
  radius: number;
  durability: number;
  shatterValue: number;
  crystalAngle: number;
  freezeTimer: number;
  maxFreezeTimer: number;
  active: boolean;
}

export function createFrozenShard(
  id: number,
  pos: Vector2D,
  radius: number,
  duration = 8.0,
  shatterValue = 600
): FrozenShard {
  return {
    id,
    pos: { x: pos.x, y: pos.y },
    radius: Math.max(8, radius * 1.2),
    durability: 1,
    shatterValue,
    crystalAngle: Math.random() * Math.PI,
    freezeTimer: duration,
    maxFreezeTimer: duration,
    active: true
  };
}

export function checkShatterCollision(
  shard: FrozenShard,
  impactPos: Vector2D,
  impactRadius: number
): boolean {
  if (!shard.active) return false;
  return circleCircleCollision(shard.pos, shard.radius, impactPos, impactRadius);
}

export function findCascadeShards(
  epicenter: FrozenShard,
  shards: FrozenShard[],
  blastRadius = 90
): FrozenShard[] {
  const cascades: FrozenShard[] = [];
  for (const s of shards) {
    if (s.active && s.id !== epicenter.id) {
      const dist = vecDistance(epicenter.pos, s.pos);
      if (dist <= blastRadius + s.radius) {
        cascades.push(s);
      }
    }
  }
  return cascades;
}

export class CryoManager {
  public shards: FrozenShard[] = [];
  private nextId = 1;

  public reset(): void {
    this.shards = [];
  }

  public freezePosition(pos: Vector2D, radius: number, scoreValue = 600): FrozenShard {
    const shard = createFrozenShard(this.nextId++, pos, radius, 8.0, scoreValue);
    this.shards.push(shard);
    return shard;
  }

  public triggerFreezePulse(
    center: Vector2D,
    freezeRadius: number,
    targetPositions: { pos: Vector2D; radius: number; id: number }[],
    vfx: VFXManager
  ): number[] {
    const frozenTargetIds: number[] = [];

    for (const target of targetPositions) {
      const dist = vecDistance(center, target.pos);
      if (dist <= freezeRadius) {
        this.freezePosition(target.pos, target.radius);
        frozenTargetIds.push(target.id);
        vfx.spawnSparks(target.pos, 10, '#4deeea', 130);
      }
    }

    return frozenTargetIds;
  }

  public shatterAt(
    pos: Vector2D,
    radius: number,
    vfx: VFXManager,
    audio: SoundEngine
  ): { count: number; totalScore: number } {
    let count = 0;
    let totalScore = 0;

    const toShatter: FrozenShard[] = [];

    // Find direct impact shards
    for (const s of this.shards) {
      if (s.active && checkShatterCollision(s, pos, radius)) {
        toShatter.push(s);
      }
    }

    // Cascade chain reaction
    const visited = new Set<number>();
    for (const direct of toShatter) {
      visited.add(direct.id);
      const cascades = findCascadeShards(direct, this.shards, 95);
      for (const casc of cascades) {
        if (!visited.has(casc.id)) {
          visited.add(casc.id);
          toShatter.push(casc);
        }
      }
    }

    // Process shatter detonations
    for (const s of toShatter) {
      s.active = false;
      count++;
      totalScore += s.shatterValue;

      // Shatter sparks and shockwaves
      vfx.spawnSparks(s.pos, 18, '#74ebd5', 240);
      vfx.spawnShockwave(s.pos, 70, '#4deeea', 3);
      vfx.spawnFloatingText(`SHATTER +${s.shatterValue}!`, s.pos, '#74ebd5', 1.1);
    }

    if (count > 0) {
      vfx.triggerScreenShake(Math.min(18, 5 + count * 2), 0.35);
      audio.playExplosion();
    }

    // Clean up inactive shards
    this.shards = this.shards.filter((s) => s.active);

    return { count, totalScore };
  }

  public update(dt: number, vfx: VFXManager): void {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.freezeTimer -= dt;

      // Subtle ice gleam rotation
      s.crystalAngle += dt * 0.3;

      if (s.freezeTimer <= 0) {
        // Thaw out
        s.active = false;
        vfx.spawnSparks(s.pos, 6, '#00f3ff', 60);
        this.shards.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const s of this.shards) {
      if (!s.active) continue;

      const alpha = Math.min(1.0, s.freezeTimer / 1.5);
      ctx.globalAlpha = alpha;

      ctx.save();
      ctx.translate(s.pos.x, s.pos.y);
      ctx.rotate(s.crystalAngle);

      // Crystalline Hexagonal Ice Shard
      ctx.beginPath();
      const facets = 6;
      for (let j = 0; j < facets; j++) {
        const th = (j * Math.PI * 2) / facets;
        const r = s.radius * (j % 2 === 0 ? 1.15 : 0.85);
        const x = Math.cos(th) * r;
        const y = Math.sin(th) * r;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Translucent frost glass fill
      ctx.fillStyle = 'rgba(77, 238, 234, 0.35)';
      ctx.fill();

      // Razor crystal borders
      ctx.strokeStyle = '#4deeea';
      ctx.lineWidth = 2.0;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#74ebd5';
      ctx.stroke();

      // Inner crystal facets
      ctx.beginPath();
      ctx.moveTo(-s.radius * 0.5, 0);
      ctx.lineTo(s.radius * 0.5, 0);
      ctx.moveTo(0, -s.radius * 0.5);
      ctx.lineTo(0, s.radius * 0.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }
}
