import { Player, Vector2D } from './types';
import { circleSegmentCollision, isNearMissGraze, vecAdd, vecCreate, vecFromAngle } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';
import { HazardDirector } from './hazards';

export type BossPhase = 1 | 2 | 3;

export class ForgeSentinelBoss {
  public pos: Vector2D = vecCreate(480, 200);
  public vel: Vector2D = vecCreate(0, 0);
  public radius = 38;
  public health = 1500;
  public maxHealth = 1500;
  public phase: BossPhase = 1;
  public active = false;

  private angle = 0;
  private rotationSpeed = 0.6;
  private patternTimer = 0;
  private laserLength = 340;
  private pulsePhase = 0;
  private invulnerableTimer = 0;

  public spawn(startX = 480, startY = 180): void {
    this.pos = vecCreate(startX, startY);
    this.vel = vecCreate(0, 0);
    this.health = this.maxHealth;
    this.phase = 1;
    this.active = true;
    this.angle = 0;
    this.patternTimer = 0;
    this.pulsePhase = 0;
    this.invulnerableTimer = 2.0; // Initial entrance shield
  }

  public damage(amount: number, vfx: VFXManager, audio: SoundEngine): boolean {
    if (!this.active || this.invulnerableTimer > 0) return false;

    this.health = Math.max(0, this.health - amount);
    vfx.spawnSparks(this.pos, 14, '#ff0055', 200);
    vfx.triggerScreenShake(8, 0.25);
    audio.playHit();

    // Check phase transitions
    const healthRatio = this.health / this.maxHealth;
    if (healthRatio <= 0.33 && this.phase < 3) {
      this.phase = 3;
      this.rotationSpeed = 1.4;
      vfx.spawnShockwave(this.pos, 280, '#ff0033', 8);
      vfx.triggerScreenShake(16, 0.6);
      vfx.spawnFloatingText('PHASE 3: ENTROPIC OVERDRIVE!', this.pos, '#ff0033', 1.8);
      audio.playExplosion();
    } else if (healthRatio <= 0.66 && this.phase < 2) {
      this.phase = 2;
      this.rotationSpeed = 0.95;
      vfx.spawnShockwave(this.pos, 220, '#ff7700', 6);
      vfx.triggerScreenShake(12, 0.45);
      vfx.spawnFloatingText('PHASE 2: GRAVITON COLLAPSE!', this.pos, '#ff7700', 1.6);
      audio.playExplosion();
    }

    if (this.health <= 0) {
      this.active = false;
      vfx.spawnShockwave(this.pos, 500, '#00f3ff', 10);
      vfx.triggerScreenShake(26, 0.8);
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
    hazards: HazardDirector
  ): { hits: number; grazes: number; bossKilled: boolean } {
    if (!this.active) {
      return { hits: 0, grazes: 0, bossKilled: false };
    }

    let hits = 0;
    let grazes = 0;

    this.pulsePhase += realDt * 4.0;
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= realDt;
    }

    // Hover float motion
    this.pos.x = 480 + Math.sin(this.pulsePhase * 0.4) * 140;
    this.pos.y = 180 + Math.cos(this.pulsePhase * 0.6) * 40;

    // Rotate boss tachyon cutters
    this.angle += this.rotationSpeed * scaledDt;

    // Attack cycle patterns
    this.patternTimer += scaledDt;
    if (this.phase === 1 && this.patternTimer >= 2.2) {
      this.patternTimer = 0;
      this.firePhase1Ring(audio);
    } else if (this.phase === 2 && this.patternTimer >= 1.6) {
      this.patternTimer = 0;
      this.firePhase2Spiral(audio);
    } else if (this.phase === 3 && this.patternTimer >= 0.9) {
      this.patternTimer = 0;
      this.firePhase3Frenzy(hazards, audio);
    }

    // 1. Collision with boss core
    const coreResult = isNearMissGraze(player.pos, player.radius, player.grazeRadius, this.pos, this.radius);
    if (coreResult.isHit) {
      hits++;
    } else if (coreResult.isGraze) {
      grazes++;
      // Grazing boss core damages boss directly!
      this.damage(6, vfx, audio);
    }

    // 2. Collision with rotating tachyon cutter blades
    const bladeCount = this.phase >= 2 ? 4 : 2;
    for (let i = 0; i < bladeCount; i++) {
      const bladeAngle = this.angle + (i * Math.PI * 2) / bladeCount;
      const bladeEnd = vecAdd(this.pos, vecFromAngle(bladeAngle, this.laserLength));

      if (circleSegmentCollision(player.pos, player.radius, this.pos, bladeEnd, 10)) {
        hits++;
      } else if (circleSegmentCollision(player.pos, player.grazeRadius, this.pos, bladeEnd, 10)) {
        grazes++;
      }
    }

    return { hits, grazes, bossKilled: this.health <= 0 };
  }

  private firePhase1Ring(audio: SoundEngine): void {
    audio.playLaserTelegraph();
  }

  private firePhase2Spiral(audio: SoundEngine): void {
    audio.playLaserTelegraph();
  }

  private firePhase3Frenzy(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    // Spawns homing seeker hazard targeted at player
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnPos = vecAdd(this.pos, vecFromAngle(spawnAngle, this.radius + 15));
    hazards.hazards.push({
      id: Math.floor(Math.random() * 999999),
      type: 'SEEKER',
      pos: spawnPos,
      vel: vecFromAngle(spawnAngle, 160),
      radius: 6,
      color: '#ff0033',
      hasGrazed: false,
      markedForRemoval: false,
      turnRate: 2.2,
      currentSpeed: 160,
      maxSpeed: 240,
      lifetime: 0
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    const pulse = Math.sin(this.pulsePhase) * 4;

    // 1. Rotating Tachyon Cutter Beams
    const bladeCount = this.phase >= 2 ? 4 : 2;
    for (let i = 0; i < bladeCount; i++) {
      const bladeAngle = this.angle + (i * Math.PI * 2) / bladeCount;
      const bladeEnd = vecAdd(this.pos, vecFromAngle(bladeAngle, this.laserLength));

      const bladeColor = this.phase === 3 ? '#ff0033' : this.phase === 2 ? '#ff7700' : '#ff00aa';

      // Outer glow
      ctx.strokeStyle = bladeColor;
      ctx.lineWidth = 8;
      ctx.shadowBlur = 18;
      ctx.shadowColor = bladeColor;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(bladeEnd.x, bladeEnd.y);
      ctx.stroke();

      // Core white laser beam
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(bladeEnd.x, bladeEnd.y);
      ctx.stroke();
    }

    // 2. Boss Armor Plates
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(-this.angle * 0.7);

    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++) {
      const th = (i * Math.PI * 2) / sides;
      const r = this.radius + pulse + (i % 2 === 0 ? 8 : 0);
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = '#060a12';
    ctx.fill();

    const armorColor = this.phase === 3 ? '#ff0033' : this.phase === 2 ? '#ff7700' : '#ff00aa';
    ctx.strokeStyle = armorColor;
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 16;
    ctx.shadowColor = armorColor;
    ctx.stroke();

    // Inner Glowing Power Core
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#00f3ff';
    ctx.fill();

    ctx.restore();

    // 3. Boss Health Bar (Top of arena)
    this.renderHealthBar(ctx);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const barWidth = 460;
    const barHeight = 12;
    const x = (960 - barWidth) * 0.5;
    const y = 36;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Border
    const themeColor = this.phase === 3 ? '#ff0033' : this.phase === 2 ? '#ff7700' : '#ff00aa';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barWidth, barHeight);

    // Fill
    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = themeColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = themeColor;
    ctx.fillRect(x + 1, y + 1, (barWidth - 2) * pct, barHeight - 2);

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`A.P.E.X. FORGE SENTINEL MK-II [PHASE ${this.phase}/3]`, 480, y - 6);

    ctx.restore();
  }
}
