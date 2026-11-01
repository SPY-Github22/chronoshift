import { Player, Vector2D } from './types';
import { circleSegmentCollision, isNearMissGraze, vecAdd, vecCreate, vecFromAngle } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';
import { HazardDirector } from './hazards';
import { CryoManager } from './freeze';

export class CryoArchonBoss {
  public pos: Vector2D = vecCreate(480, 200);
  public vel: Vector2D = vecCreate(0, 0);
  public radius = 42;
  public health = 1800;
  public maxHealth = 1800;
  public phase: 1 | 2 | 3 = 1;
  public active = false;

  private angle = 0;
  private rotationSpeed = 0.5;
  private attackTimer = 0;
  private pulsePhase = 0;
  private invulnerableTimer = 0;

  public spawn(startX = 480, startY = 190): void {
    this.pos = vecCreate(startX, startY);
    this.vel = vecCreate(0, 0);
    this.health = this.maxHealth;
    this.phase = 1;
    this.active = true;
    this.angle = 0;
    this.attackTimer = 0;
    this.pulsePhase = 0;
    this.invulnerableTimer = 2.0;
  }

  public damage(amount: number, vfx: VFXManager, audio: SoundEngine): boolean {
    if (!this.active || this.invulnerableTimer > 0) return false;

    this.health = Math.max(0, this.health - amount);
    vfx.spawnSparks(this.pos, 16, '#4deeea', 220);
    vfx.triggerScreenShake(7, 0.2);
    audio.playHit();

    const healthRatio = this.health / this.maxHealth;
    if (healthRatio <= 0.33 && this.phase < 3) {
      this.phase = 3;
      this.rotationSpeed = 1.3;
      vfx.spawnShockwave(this.pos, 290, '#74ebd5', 8);
      vfx.triggerScreenShake(18, 0.6);
      vfx.spawnFloatingText('PHASE 3: SUPERNOVA STASIS!', this.pos, '#74ebd5', 1.8);
      audio.playExplosion();
    } else if (healthRatio <= 0.66 && this.phase < 2) {
      this.phase = 2;
      this.rotationSpeed = 0.85;
      vfx.spawnShockwave(this.pos, 230, '#4deeea', 6);
      vfx.triggerScreenShake(13, 0.45);
      vfx.spawnFloatingText('PHASE 2: BLIZZARD BARRIER!', this.pos, '#4deeea', 1.6);
      audio.playExplosion();
    }

    if (this.health <= 0) {
      this.active = false;
      vfx.spawnShockwave(this.pos, 520, '#74ebd5', 12);
      vfx.triggerScreenShake(28, 0.9);
      audio.playExplosion();
      return true;
    }

    return false;
  }

  public update(
    scaledDt: number,
    realDt: number,
    player: Player,
    vfx: VFXManager,
    audio: SoundEngine,
    hazards: HazardDirector,
    cryo: CryoManager
  ): { hits: number; grazes: number; bossKilled: boolean } {
    if (!this.active) {
      return { hits: 0, grazes: 0, bossKilled: false };
    }

    let hits = 0;
    let grazes = 0;

    this.pulsePhase += realDt * 3.5;
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= realDt;
    }

    // Oscillating figure-8 flight path
    this.pos.x = 480 + Math.sin(this.pulsePhase * 0.5) * 160;
    this.pos.y = 190 + Math.cos(this.pulsePhase * 1.0) * 35;

    this.angle += this.rotationSpeed * scaledDt;

    // Attack timer routines
    this.attackTimer += scaledDt;
    if (this.phase === 1 && this.attackTimer >= 2.4) {
      this.attackTimer = 0;
      this.castFrostRing(hazards, audio);
    } else if (this.phase === 2 && this.attackTimer >= 1.8) {
      this.attackTimer = 0;
      this.castBlizzardSurge(hazards, cryo, audio);
    } else if (this.phase === 3 && this.attackTimer >= 1.0) {
      this.attackTimer = 0;
      this.castSupernovaBarrage(hazards, audio);
    }

    // 1. Direct core collisions & grazes
    const coreResult = isNearMissGraze(player.pos, player.radius, player.grazeRadius, this.pos, this.radius);
    if (coreResult.isHit) {
      hits++;
    } else if (coreResult.isGraze) {
      grazes++;
      this.damage(8, vfx, audio);
    }

    // 2. Rotating crystalline spire blades
    const spireCount = this.phase >= 2 ? 6 : 4;
    const spireLength = 280;
    for (let i = 0; i < spireCount; i++) {
      const spireAngle = this.angle + (i * Math.PI * 2) / spireCount;
      const spireEnd = vecAdd(this.pos, vecFromAngle(spireAngle, spireLength));

      if (circleSegmentCollision(player.pos, player.radius, this.pos, spireEnd, 8)) {
        hits++;
      } else if (circleSegmentCollision(player.pos, player.grazeRadius, this.pos, spireEnd, 8)) {
        grazes++;
      }
    }

    return { hits, grazes, bossKilled: this.health <= 0 };
  }

  private castFrostRing(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const count = 6;
    for (let i = 0; i < count; i++) {
      const th = this.angle + (i * Math.PI * 2) / count;
      hazards.hazards.push({
        id: Math.floor(Math.random() * 999999),
        type: 'ORB',
        pos: vecAdd(this.pos, vecFromAngle(th, this.radius + 15)),
        vel: vecFromAngle(th, 160),
        radius: 8,
        color: '#74ebd5',
        hasGrazed: false,
        markedForRemoval: false,
        bounceCount: 0,
        maxBounces: 2
      });
    }
  }

  private castBlizzardSurge(hazards: HazardDirector, cryo: CryoManager, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    // Spawn frozen crystal obstacles that player can shatter!
    const offset = vecFromAngle(Math.random() * Math.PI * 2, 80);
    cryo.freezePosition(vecAdd(this.pos, offset), 12, 750);

    // Also cast a frost orb hazard
    hazards.hazards.push({
      id: Math.floor(Math.random() * 999999),
      type: 'ORB',
      pos: vecAdd(this.pos, offset),
      vel: vecFromAngle(Math.random() * Math.PI * 2, 130),
      radius: 9,
      color: '#4deeea',
      hasGrazed: false,
      markedForRemoval: false,
      bounceCount: 0,
      maxBounces: 2
    });
  }

  private castSupernovaBarrage(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const spawnAngle = Math.random() * Math.PI * 2;
    hazards.hazards.push({
      id: Math.floor(Math.random() * 999999),
      type: 'SEEKER',
      pos: vecAdd(this.pos, vecFromAngle(spawnAngle, this.radius + 15)),
      vel: vecFromAngle(spawnAngle, 180),
      radius: 7,
      color: '#4deeea',
      hasGrazed: false,
      markedForRemoval: false,
      turnRate: 2.6,
      currentSpeed: 180,
      maxSpeed: 250,
      lifetime: 0
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    const pulse = Math.sin(this.pulsePhase) * 4;

    // 1. Rotating Crystalline Spires
    const spireCount = this.phase >= 2 ? 6 : 4;
    const spireLength = 280;
    for (let i = 0; i < spireCount; i++) {
      const spireAngle = this.angle + (i * Math.PI * 2) / spireCount;
      const spireEnd = vecAdd(this.pos, vecFromAngle(spireAngle, spireLength));

      ctx.strokeStyle = '#4deeea';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#74ebd5';
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(spireEnd.x, spireEnd.y);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(spireEnd.x, spireEnd.y);
      ctx.stroke();
    }

    // 2. Crystalline Diamond Armor Body
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle * 0.5);

    ctx.beginPath();
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const th = (i * Math.PI * 2) / sides;
      const r = this.radius + pulse + (i % 2 === 0 ? 10 : 0);
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(7, 24, 42, 0.9)';
    ctx.fill();

    ctx.strokeStyle = '#74ebd5';
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#4deeea';
    ctx.stroke();

    // Inner Frost Crystal Heart
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#74ebd5';
    ctx.fill();

    ctx.restore();

    // 3. Health Bar
    this.renderHealthBar(ctx);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const barWidth = 460;
    const barHeight = 12;
    const x = (960 - barWidth) * 0.5;
    const y = 36;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, barWidth, barHeight);

    const themeColor = this.phase === 3 ? '#ffffff' : this.phase === 2 ? '#4deeea' : '#74ebd5';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barWidth, barHeight);

    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = themeColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = themeColor;
    ctx.fillRect(x + 1, y + 1, (barWidth - 2) * pct, barHeight - 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CRYO-ARCHON GLACIEX-09 [PHASE ${this.phase}/3]`, 480, y - 6);

    ctx.restore();
  }
}
