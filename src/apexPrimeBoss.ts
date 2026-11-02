import { Player, Vector2D } from './types';
import { circleSegmentCollision, isNearMissGraze, vecAdd, vecCreate, vecFromAngle } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';
import { HazardDirector } from './hazards';
import { CryoManager } from './freeze';

export type ApexPhase = 1 | 2 | 3 | 4;

export class ApexPrimeBoss {
  public pos: Vector2D = vecCreate(480, 180);
  public vel: Vector2D = vecCreate(0, 0);
  public radius = 48;
  public health = 3000;
  public maxHealth = 3000;
  public phase: ApexPhase = 1;
  public active = false;

  public hasFrontalShield = false;
  private angle = 0;
  private rotationSpeed = 0.5;
  private attackTimer = 0;
  private pulsePhase = 0;
  private invulnerableTimer = 0;
  private beamLength = 320;

  public spawn(startX = 480, startY = 170): void {
    this.pos = vecCreate(startX, startY);
    this.vel = vecCreate(0, 0);
    this.health = this.maxHealth;
    this.phase = 1;
    this.active = true;
    this.angle = 0;
    this.attackTimer = 0;
    this.pulsePhase = 0;
    this.invulnerableTimer = 2.0;
    this.hasFrontalShield = false;
  }

  public damage(
    amount: number,
    attackerPos: Vector2D,
    vfx: VFXManager,
    audio: SoundEngine,
    ignoreShield = false
  ): boolean {
    if (!this.active || this.invulnerableTimer > 0) return false;

    // Phase 3 Frontal Shield check: Damage must come from behind the boss (y < boss.pos.y + 10)
    if (this.hasFrontalShield && !ignoreShield) {
      if (attackerPos.y > this.pos.y) {
        // Deflected by frontal barrier!
        vfx.spawnShockwave(vecAdd(this.pos, { x: 0, y: 35 }), 90, '#a855f7', 4);
        vfx.spawnFloatingText('DEFLECTED BY SHIELD!', this.pos, '#a855f7', 1.4);
        audio.playHit();
        return false;
      }
    }

    this.health = Math.max(0, this.health - amount);
    vfx.spawnSparks(this.pos, 16, '#facc15', 240);
    vfx.triggerScreenShake(7, 0.22);
    audio.playHit();

    // Check Phase Transitions
    const healthRatio = this.health / this.maxHealth;
    if (healthRatio <= 0.25 && this.phase < 4) {
      this.phase = 4;
      this.hasFrontalShield = false;
      this.rotationSpeed = 1.6;
      vfx.spawnShockwave(this.pos, 420, '#ff0055', 10);
      vfx.triggerScreenShake(24, 0.8);
      vfx.spawnFloatingText('PHASE 4: TIMELINE SUPERNOVA!', this.pos, '#ff0055', 2.2);
      audio.playExplosion();
    } else if (healthRatio <= 0.5 && this.phase < 3) {
      this.phase = 3;
      this.hasFrontalShield = true;
      this.rotationSpeed = 0.9;
      vfx.spawnShockwave(this.pos, 340, '#a855f7', 8);
      vfx.triggerScreenShake(16, 0.55);
      vfx.spawnFloatingText('PHASE 3: DIMENSIONAL BARRIER!', this.pos, '#a855f7', 1.8);
      audio.playExplosion();
    } else if (healthRatio <= 0.75 && this.phase < 2) {
      this.phase = 2;
      this.hasFrontalShield = false;
      this.rotationSpeed = 0.7;
      vfx.spawnShockwave(this.pos, 280, '#4deeea', 7);
      vfx.triggerScreenShake(14, 0.45);
      vfx.spawnFloatingText('PHASE 2: CRYO STASIS CONVERGENCE!', this.pos, '#4deeea', 1.6);
      audio.playExplosion();
    }

    if (this.health <= 0) {
      this.active = false;
      vfx.spawnShockwave(this.pos, 600, '#ffffff', 14);
      vfx.triggerScreenShake(32, 1.2);
      audio.playExplosion();
      return true;
    }

    return false;
  }

  public update(
    scaledDt: number,
    realDt: number,
    player: Player,
    isPlayerSuperluminal: boolean,
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

    // Majestic floating pendulum motion
    this.pos.x = 480 + Math.sin(this.pulsePhase * 0.45) * 160;
    this.pos.y = 170 + Math.cos(this.pulsePhase * 0.9) * 35;

    this.angle += this.rotationSpeed * scaledDt;

    // Attack Routine Dispatcher
    this.attackTimer += scaledDt;
    if (this.phase === 1 && this.attackTimer >= 2.0) {
      this.attackTimer = 0;
      this.fireCrucibleQuad(hazards, audio);
    } else if (this.phase === 2 && this.attackTimer >= 1.6) {
      this.attackTimer = 0;
      this.fireCryoConvergence(hazards, cryo, audio);
    } else if (this.phase === 3 && this.attackTimer >= 1.4) {
      this.attackTimer = 0;
      this.fireWormholeSeekers(hazards, audio);
    } else if (this.phase === 4 && this.attackTimer >= 0.85) {
      this.attackTimer = 0;
      this.fireSupernovaBarrage(hazards, audio);
    }

    // 1. Direct Core Collision / Ramming
    const coreHit = isNearMissGraze(player.pos, player.radius, player.grazeRadius, this.pos, this.radius);
    if (coreHit.isHit) {
      if (isPlayerSuperluminal) {
        // Superluminal ramming tears through A.P.E.X. Prime!
        this.damage(600, player.pos, vfx, audio, true);
        vfx.spawnShockwave(this.pos, 350, '#ffffff', 10);
        vfx.spawnFloatingText('SUPERLUMINAL RAM! -600 HP', this.pos, '#facc15', 2.0);
      } else {
        hits++;
      }
    } else if (coreHit.isGraze) {
      grazes++;
      this.damage(12, player.pos, vfx, audio);
    }

    // 2. Rotating Tachyon Cross Beams
    const beamCount = this.phase === 4 ? 6 : 4;
    for (let i = 0; i < beamCount; i++) {
      const bAngle = this.angle + (i * Math.PI * 2) / beamCount;
      const beamEnd = vecAdd(this.pos, vecFromAngle(bAngle, this.beamLength));

      if (circleSegmentCollision(player.pos, player.radius, this.pos, beamEnd, 8)) {
        hits++;
      } else if (circleSegmentCollision(player.pos, player.grazeRadius, this.pos, beamEnd, 8)) {
        grazes++;
      }
    }

    return { hits, grazes, bossKilled: this.health <= 0 };
  }

  private fireCrucibleQuad(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    for (let i = 0; i < 4; i++) {
      const a = this.angle + (i * Math.PI) / 2;
      hazards.hazards.push({
        id: Math.floor(Math.random() * 999999),
        type: 'ORB',
        pos: vecAdd(this.pos, vecFromAngle(a, this.radius + 15)),
        vel: vecFromAngle(a, 190),
        radius: 9,
        color: '#ffaa00',
        hasGrazed: false,
        markedForRemoval: false,
        bounceCount: 0,
        maxBounces: 2
      });
    }
  }

  private fireCryoConvergence(hazards: HazardDirector, cryo: CryoManager, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const spawnPos = vecAdd(this.pos, vecFromAngle(Math.random() * Math.PI * 2, 70));
    cryo.freezePosition(spawnPos, 14, 800);

    for (let i = -1; i <= 1; i += 2) {
      const a = Math.PI * 0.5 + i * 0.4;
      hazards.hazards.push({
        id: Math.floor(Math.random() * 999999),
        type: 'ORB',
        pos: vecAdd(this.pos, vecFromAngle(a, this.radius + 15)),
        vel: vecFromAngle(a, 200),
        radius: 8,
        color: '#4deeea',
        hasGrazed: false,
        markedForRemoval: false,
        bounceCount: 0,
        maxBounces: 2
      });
    }
  }

  private fireWormholeSeekers(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const spawnAngle = Math.random() * Math.PI * 2;
    hazards.hazards.push({
      id: Math.floor(Math.random() * 999999),
      type: 'SEEKER',
      pos: vecAdd(this.pos, vecFromAngle(spawnAngle, this.radius + 20)),
      vel: vecFromAngle(spawnAngle, 190),
      radius: 8,
      color: '#a855f7',
      hasGrazed: false,
      markedForRemoval: false,
      turnRate: 2.6,
      currentSpeed: 190,
      maxSpeed: 260,
      lifetime: 0
    });
  }

  private fireSupernovaBarrage(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const a = Math.random() * Math.PI * 2;
    hazards.hazards.push({
      id: Math.floor(Math.random() * 999999),
      type: 'ORB',
      pos: vecAdd(this.pos, vecFromAngle(a, this.radius + 20)),
      vel: vecFromAngle(a, 240),
      radius: 9,
      color: '#facc15',
      hasGrazed: false,
      markedForRemoval: false,
      bounceCount: 0,
      maxBounces: 2
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    const pulse = Math.sin(this.pulsePhase) * 5;

    // 1. Rotating Dimensional Beams
    const beamCount = this.phase === 4 ? 6 : 4;
    for (let i = 0; i < beamCount; i++) {
      const bAngle = this.angle + (i * Math.PI * 2) / beamCount;
      const beamEnd = vecAdd(this.pos, vecFromAngle(bAngle, this.beamLength));

      const beamColor = this.phase === 4 ? '#ffffff' : this.phase === 3 ? '#a855f7' : this.phase === 2 ? '#4deeea' : '#ffaa00';

      ctx.strokeStyle = beamColor;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 18;
      ctx.shadowColor = beamColor;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(beamEnd.x, beamEnd.y);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(beamEnd.x, beamEnd.y);
      ctx.stroke();
    }

    // 2. Frontal Dimensional Shield in Phase 3
    if (this.hasFrontalShield) {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 28, 0, Math.PI, false); // Frontal arc facing downward
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#d8b4fe';
      ctx.stroke();

      ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.fill();
      ctx.restore();
    }

    // 3. Multi-Faceted Monolith Hull
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(-this.angle * 0.4);

    ctx.beginPath();
    const sides = 12;
    for (let i = 0; i < sides; i++) {
      const th = (i * Math.PI * 2) / sides;
      const r = this.radius + pulse + (i % 2 === 0 ? 12 : 0);
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = '#090514';
    ctx.fill();

    const hullColor = this.phase === 4 ? '#ffffff' : this.phase === 3 ? '#a855f7' : this.phase === 2 ? '#4deeea' : '#facc15';
    ctx.strokeStyle = hullColor;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 22;
    ctx.shadowColor = hullColor;
    ctx.stroke();

    // Central Singularity Hyper-Core
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffffff';
    ctx.fill();

    ctx.restore();

    // 4. Multi-tiered Health Bar
    this.renderHealthBar(ctx);
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const barWidth = 480;
    const barHeight = 14;
    const x = (960 - barWidth) * 0.5;
    const y = 34;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, barWidth, barHeight);

    const themeColor = this.phase === 4 ? '#ff0055' : this.phase === 3 ? '#a855f7' : this.phase === 2 ? '#4deeea' : '#facc15';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(x, y, barWidth, barHeight);

    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = themeColor;
    ctx.shadowBlur = 12;
    ctx.shadowColor = themeColor;
    ctx.fillRect(x + 1, y + 1, (barWidth - 2) * pct, barHeight - 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`A.P.E.X. PRIME // ENTROPIC ARCHITECT [PHASE ${this.phase}/4]`, 480, y - 6);

    ctx.restore();
  }
}
