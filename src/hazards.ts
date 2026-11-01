import { EnergyCore, Hazard, LaserHazard, OrbHazard, Player, PulsarHazard, SeekerHazard, Vector2D } from './types';
import { circleCircleCollision, circleSegmentCollision, clamp, isNearMissGraze, randomRange, vecAdd, vecCreate, vecDistance, vecFromAngle, vecNormalize, vecScale, vecSub } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';

export class HazardDirector {
  public hazards: Hazard[] = [];
  public cores: EnergyCore[] = [];
  private nextId = 1;
  private spawnTimer = 0;
  private laserTimer = 0;
  private coreTimer = 0;

  public reset(): void {
    this.hazards = [];
    this.cores = [];
    this.spawnTimer = 0;
    this.laserTimer = 0;
    this.coreTimer = 0;
  }

  public update(
    scaledDt: number,
    realDt: number,
    wave: number,
    player: Player,
    bounds: { width: number; height: number },
    vfx: VFXManager,
    audio: SoundEngine
  ): { hits: number; grazes: number; coresCollected: number } {
    let hits = 0;
    let grazes = 0;
    let coresCollected = 0;

    // 1. Spawning Director based on wave
    this.spawnTimer += scaledDt;
    const baseSpawnInterval = Math.max(0.35, 1.4 - wave * 0.12);
    if (this.spawnTimer >= baseSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnOrbHazard(bounds, wave);

      if (wave >= 2 && Math.random() < 0.35) {
        this.spawnSeekerHazard(bounds, player.pos);
      }
      if (wave >= 3 && Math.random() < 0.25) {
        this.spawnPulsarHazard(bounds);
      }
    }

    // Laser telegraph spawning
    this.laserTimer += scaledDt;
    const laserInterval = Math.max(3.0, 7.0 - wave * 0.4);
    if (this.laserTimer >= laserInterval && wave >= 2) {
      this.laserTimer = 0;
      this.spawnLaserHazard(bounds, audio);
    }

    // Energy core spawning
    this.coreTimer += scaledDt;
    if (this.coreTimer >= 4.0 && this.cores.length < 5) {
      this.coreTimer = 0;
      this.spawnCore(bounds);
    }

    // 2. Update Hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];

      if (h.type === 'ORB') {
        const orb = h as OrbHazard;
        orb.pos.x += orb.vel.x * scaledDt;
        orb.pos.y += orb.vel.y * scaledDt;

        // Bounce on boundaries
        if (orb.pos.x - orb.radius <= 0 || orb.pos.x + orb.radius >= bounds.width) {
          orb.vel.x = -orb.vel.x;
          orb.bounceCount++;
        }
        if (orb.pos.y - orb.radius <= 0 || orb.pos.y + orb.radius >= bounds.height) {
          orb.vel.y = -orb.vel.y;
          orb.bounceCount++;
        }

        if (orb.bounceCount > orb.maxBounces) {
          orb.markedForRemoval = true;
          vfx.spawnSparks(orb.pos, 4, orb.color, 40);
        }
      } else if (h.type === 'SEEKER') {
        const seeker = h as SeekerHazard;
        seeker.lifetime += scaledDt;

        // Curve towards player
        const toPlayer = vecSub(player.pos, seeker.pos);
        const desiredAngle = Math.atan2(toPlayer.y, toPlayer.x);
        const currentAngle = Math.atan2(seeker.vel.y, seeker.vel.x);

        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const newAngle = currentAngle + clamp(angleDiff, -seeker.turnRate * scaledDt, seeker.turnRate * scaledDt);
        const speed = seeker.maxSpeed;
        seeker.vel = vecFromAngle(newAngle, speed);

        seeker.pos.x += seeker.vel.x * scaledDt;
        seeker.pos.y += seeker.vel.y * scaledDt;

        if (seeker.lifetime > 8.0) {
          seeker.markedForRemoval = true;
        }
      } else if (h.type === 'LASER') {
        const laser = h as LaserHazard;
        if (laser.warmUpTimer > 0) {
          laser.warmUpTimer -= scaledDt;
          // Rotate slightly
          laser.angle += laser.rotationSpeed * scaledDt;
          this.recalculateLaserPoints(laser, bounds);
        } else if (laser.activeTimer > 0) {
          laser.activeTimer -= scaledDt;
          laser.angle += laser.rotationSpeed * scaledDt;
          this.recalculateLaserPoints(laser, bounds);
          if (laser.activeTimer <= 0) {
            laser.markedForRemoval = true;
          }
        }
      } else if (h.type === 'PULSAR') {
        const pulsar = h as PulsarHazard;
        pulsar.currentRadius += pulsar.growthRate * scaledDt;
        if (pulsar.currentRadius >= pulsar.maxRadius) {
          pulsar.markedForRemoval = true;
        }
      }

      // 3. Collision and Grazing with Player
      if (!h.markedForRemoval) {
        if (h.type === 'LASER') {
          const laser = h as LaserHazard;
          if (laser.activeTimer > 0) {
            // Lethal beam active
            const collides = circleSegmentCollision(player.pos, player.radius, laser.p1, laser.p2, laser.width);
            if (collides) {
              hits++;
            } else if (!h.hasGrazed) {
              const grazesLaser = circleSegmentCollision(player.pos, player.grazeRadius, laser.p1, laser.p2, laser.width);
              if (grazesLaser) {
                h.hasGrazed = true;
                grazes++;
              }
            }
          }
        } else if (h.type === 'PULSAR') {
          const pulsar = h as PulsarHazard;
          const dist = vecDistance(player.pos, pulsar.pos);
          const ringDist = Math.abs(dist - pulsar.currentRadius);
          if (ringDist <= player.radius + pulsar.thickness * 0.5) {
            hits++;
          } else if (!h.hasGrazed && ringDist <= player.grazeRadius + pulsar.thickness * 0.5) {
            h.hasGrazed = true;
            grazes++;
          }
        } else {
          // Circular hazards (ORB, SEEKER)
          const result = isNearMissGraze(player.pos, player.radius, player.grazeRadius, h.pos, h.radius);
          if (result.isHit) {
            hits++;
            h.markedForRemoval = true;
          } else if (result.isGraze && !h.hasGrazed) {
            h.hasGrazed = true;
            grazes++;
          }
        }
      }

      if (h.markedForRemoval) {
        this.hazards.splice(i, 1);
      }
    }

    // 4. Update Energy Cores
    for (let i = this.cores.length - 1; i >= 0; i--) {
      const core = this.cores[i];
      core.pulsePhase += realDt * 4.0;
      core.pos.x += core.vel.x * realDt;
      core.pos.y += core.vel.y * realDt;

      // Magnetic pull towards player if close
      const dist = vecDistance(player.pos, core.pos);
      if (dist < 120) {
        const pullDir = vecNormalize(vecSub(player.pos, core.pos));
        core.vel = vecAdd(core.vel, vecScale(pullDir, 400 * realDt));
      }

      // Check collection
      if (circleCircleCollision(player.pos, player.radius, core.pos, core.radius)) {
        coresCollected++;
        vfx.spawnSparks(core.pos, 15, '#00ff88', 140);
        vfx.spawnFloatingText('+CORE!', core.pos, '#00ff88', 1.2);
        this.cores.splice(i, 1);
      }
    }

    return { hits, grazes, coresCollected };
  }

  public destroyAllHazards(vfx: VFXManager, audio: SoundEngine): number {
    const destroyedCount = this.hazards.length;
    for (const h of this.hazards) {
      vfx.spawnSparks(h.pos, 16, '#ff00aa', 220);
      vfx.spawnShockwave(h.pos, 60, '#ff00aa', 3);
    }
    this.hazards = [];
    audio.playExplosion();
    return destroyedCount;
  }

  private spawnOrbHazard(bounds: { width: number; height: number }, wave: number): void {
    const radius = randomRange(7, 13);
    // Spawn along border
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = randomRange(0, bounds.width); y = -radius; }
    else if (edge === 1) { x = bounds.width + radius; y = randomRange(0, bounds.height); }
    else if (edge === 2) { x = randomRange(0, bounds.width); y = bounds.height + radius; }
    else { x = -radius; y = randomRange(0, bounds.height); }

    const speed = randomRange(120, 180 + wave * 15);
    const target = vecCreate(randomRange(bounds.width * 0.2, bounds.width * 0.8), randomRange(bounds.height * 0.2, bounds.height * 0.8));
    const vel = vecScale(vecNormalize(vecSub(target, vecCreate(x, y))), speed);

    const colors = ['#ff0055', '#ff4400', '#ff00bb', '#ffaa00'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.hazards.push({
      id: this.nextId++,
      type: 'ORB',
      pos: vecCreate(x, y),
      vel,
      radius,
      color,
      hasGrazed: false,
      markedForRemoval: false,
      bounceCount: 0,
      maxBounces: 3 + Math.min(4, Math.floor(wave / 2))
    });
  }

  private spawnSeekerHazard(bounds: { width: number; height: number }, playerPos: Vector2D): void {
    const radius = 6;
    const x = Math.random() < 0.5 ? -10 : bounds.width + 10;
    const y = randomRange(0, bounds.height);
    const pos = vecCreate(x, y);
    const dir = vecNormalize(vecSub(playerPos, pos));

    this.hazards.push({
      id: this.nextId++,
      type: 'SEEKER',
      pos,
      vel: vecScale(dir, 140),
      radius,
      color: '#00ffff',
      hasGrazed: false,
      markedForRemoval: false,
      turnRate: 1.8,
      currentSpeed: 140,
      maxSpeed: 210,
      lifetime: 0
    });
  }

  private spawnLaserHazard(bounds: { width: number; height: number }, audio: SoundEngine): void {
    const angle = randomRange(0, Math.PI);
    const laser: LaserHazard = {
      id: this.nextId++,
      type: 'LASER',
      pos: vecCreate(bounds.width * 0.5, bounds.height * 0.5),
      vel: vecCreate(0, 0),
      radius: 0,
      color: '#ff2277',
      hasGrazed: false,
      markedForRemoval: false,
      p1: vecCreate(0, 0),
      p2: vecCreate(0, 0),
      width: 14,
      warmUpTimer: 1.2,
      totalWarmUp: 1.2,
      activeTimer: 1.0,
      totalActive: 1.0,
      angle,
      rotationSpeed: randomRange(-0.4, 0.4)
    };
    this.recalculateLaserPoints(laser, bounds);
    this.hazards.push(laser);
    audio.playLaserTelegraph();
  }

  private recalculateLaserPoints(laser: LaserHazard, bounds: { width: number; height: number }): void {
    const center = vecCreate(bounds.width * 0.5, bounds.height * 0.5);
    const diag = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
    const dir = vecFromAngle(laser.angle, diag);
    laser.p1 = vecSub(center, dir);
    laser.p2 = vecAdd(center, dir);
  }

  private spawnPulsarHazard(bounds: { width: number; height: number }): void {
    const pos = vecCreate(
      randomRange(bounds.width * 0.25, bounds.width * 0.75),
      randomRange(bounds.height * 0.25, bounds.height * 0.75)
    );
    this.hazards.push({
      id: this.nextId++,
      type: 'PULSAR',
      pos,
      vel: vecCreate(0, 0),
      radius: 2,
      color: '#bf00ff',
      hasGrazed: false,
      markedForRemoval: false,
      currentRadius: 2,
      maxRadius: randomRange(140, 220),
      growthRate: 110,
      thickness: 8
    });
  }

  private spawnCore(bounds: { width: number; height: number }): void {
    this.cores.push({
      id: this.nextId++,
      pos: vecCreate(randomRange(50, bounds.width - 50), randomRange(50, bounds.height - 50)),
      vel: vecCreate(randomRange(-15, 15), randomRange(-15, 15)),
      radius: 7,
      pulsePhase: 0,
      value: 500,
      markedForRemoval: false
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Render Laser Hazards
    for (const h of this.hazards) {
      if (h.type === 'LASER') {
        const laser = h as LaserHazard;
        ctx.save();
        if (laser.warmUpTimer > 0) {
          // Telegraph line
          const progress = 1 - laser.warmUpTimer / laser.totalWarmUp;
          ctx.strokeStyle = 'rgba(255, 34, 119, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(laser.p1.x, laser.p1.y);
          ctx.lineTo(laser.p2.x, laser.p2.y);
          ctx.stroke();

          // Reticle center
          ctx.beginPath();
          ctx.arc(laser.pos.x, laser.pos.y, progress * 24, 0, Math.PI * 2);
          ctx.strokeStyle = '#ff2277';
          ctx.stroke();
        } else if (laser.activeTimer > 0) {
          // Lethal beam
          const alpha = laser.activeTimer / laser.totalActive;
          ctx.strokeStyle = `rgba(255, 50, 120, ${alpha})`;
          ctx.lineWidth = laser.width;
          ctx.shadowBlur = 18;
          ctx.shadowColor = '#ff2277';
          ctx.beginPath();
          ctx.moveTo(laser.p1.x, laser.p1.y);
          ctx.lineTo(laser.p2.x, laser.p2.y);
          ctx.stroke();

          // Core beam white hot
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = laser.width * 0.35;
          ctx.beginPath();
          ctx.moveTo(laser.p1.x, laser.p1.y);
          ctx.lineTo(laser.p2.x, laser.p2.y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (h.type === 'PULSAR') {
        const pulsar = h as PulsarHazard;
        const alpha = Math.max(0, 1 - pulsar.currentRadius / pulsar.maxRadius);
        ctx.beginPath();
        ctx.arc(pulsar.pos.x, pulsar.pos.y, pulsar.currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = pulsar.color;
        ctx.lineWidth = pulsar.thickness;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 12;
        ctx.shadowColor = pulsar.color;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      } else {
        // Spherical hazard
        ctx.beginPath();
        ctx.arc(h.pos.x, h.pos.y, h.radius, 0, Math.PI * 2);
        ctx.fillStyle = h.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = h.color;
        ctx.fill();

        // White core
        ctx.beginPath();
        ctx.arc(h.pos.x, h.pos.y, h.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    // 2. Render Energy Cores
    for (const core of this.cores) {
      const pulse = Math.sin(core.pulsePhase) * 2;
      ctx.beginPath();
      ctx.arc(core.pos.x, core.pos.y, core.radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#00ff88';
      ctx.fill();

      // Diamond core
      ctx.save();
      ctx.translate(core.pos.x, core.pos.y);
      ctx.rotate(core.pulsePhase);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-core.radius * 0.4, -core.radius * 0.4, core.radius * 0.8, core.radius * 0.8);
      ctx.restore();
    }

    ctx.restore();
  }
}
