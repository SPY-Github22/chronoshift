import { Player, Vector2D } from './types';
import { circleSegmentCollision, clamp, isNearMissGraze, vecAdd, vecCreate, vecFromAngle, vecLength, vecNormalize, vecScale, vecSub } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';
import { HazardDirector } from './hazards';

export interface JetTrailPoint {
  pos: Vector2D;
  lifetime: number;
  maxLifetime: number;
}

export class NemesisRivalBoss {
  public pos: Vector2D = vecCreate(480, 160);
  public vel: Vector2D = vecCreate(0, 0);
  public radius = 22;
  public health = 2200;
  public maxHealth = 2200;
  public phase: 1 | 2 | 3 = 1;
  public active = false;

  private headingAngle = Math.PI * 0.5; // Facing downward toward player
  private jetTrail: JetTrailPoint[] = [];
  private patternTimer = 0;
  private isRamming = false;
  private ramTarget: Vector2D = vecCreate(0, 0);
  private invulnerableTimer = 0;
  private decoyOffsets: Vector2D[] = [];

  public spawn(startX = 480, startY = 140): void {
    this.pos = vecCreate(startX, startY);
    this.vel = vecCreate(0, 0);
    this.health = this.maxHealth;
    this.phase = 1;
    this.active = true;
    this.jetTrail = [];
    this.patternTimer = 0;
    this.isRamming = false;
    this.invulnerableTimer = 2.0;
    this.decoyOffsets = [
      { x: -90, y: -20 },
      { x: 90, y: -20 }
    ];
  }

  public damage(amount: number, vfx: VFXManager, audio: SoundEngine): boolean {
    if (!this.active || this.invulnerableTimer > 0) return false;

    this.health = Math.max(0, this.health - amount);
    vfx.spawnSparks(this.pos, 16, '#facc15', 240);
    vfx.triggerScreenShake(8, 0.22);
    audio.playHit();

    const healthRatio = this.health / this.maxHealth;
    if (healthRatio <= 0.33 && this.phase < 3) {
      this.phase = 3;
      vfx.spawnShockwave(this.pos, 320, '#facc15', 8);
      vfx.triggerScreenShake(18, 0.6);
      vfx.spawnFloatingText('PHASE 3: SUPERLUMINAL DECOYS!', this.pos, '#facc15', 1.8);
      audio.playExplosion();
    } else if (healthRatio <= 0.66 && this.phase < 2) {
      this.phase = 2;
      vfx.spawnShockwave(this.pos, 260, '#a855f7', 6);
      vfx.triggerScreenShake(14, 0.45);
      vfx.spawnFloatingText('PHASE 2: COUNTER-CHRONO STASIS!', this.pos, '#a855f7', 1.6);
      audio.playExplosion();
    }

    if (this.health <= 0) {
      this.active = false;
      vfx.spawnShockwave(this.pos, 540, '#facc15', 12);
      vfx.triggerScreenShake(30, 0.9);
      audio.playExplosion();
      return true;
    }

    return false;
  }

  public update(
    scaledDt: number,
    realDt: number,
    player: Player,
    isPlayerChrono: boolean,
    isPlayerSuperluminal: boolean,
    bounds: { width: number; height: number },
    vfx: VFXManager,
    audio: SoundEngine,
    hazards: HazardDirector
  ): { hits: number; grazes: number; bossKilled: boolean } {
    if (!this.active) {
      return { hits: 0, grazes: 0, bossKilled: false };
    }

    let hits = 0;
    let grazes = 0;

    // Counter-Chrono: If player is in Chrono-Shift, Nemesis dilates with player in real-time!
    const effectiveDt = (this.phase >= 2 && isPlayerChrono) ? realDt : scaledDt;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= realDt;
    }

    // 1. Flight Dynamics & Pursuit Steering
    if (this.isRamming) {
      // High-speed supersonic ram pass
      const toTarget = vecSub(this.ramTarget, this.pos);
      const dist = vecLength(toTarget);
      if (dist < 30 || this.pos.y > bounds.height + 60) {
        this.isRamming = false;
        this.pos.y = -40; // Reset above screen
        this.pos.x = clamp(player.pos.x + (Math.random() * 200 - 100), 80, bounds.width - 80);
      } else {
        const ramDir = vecNormalize(toTarget);
        this.vel = vecScale(ramDir, 620);
        this.headingAngle = Math.atan2(this.vel.y, this.vel.x);
      }
    } else {
      // Tactical sweeping pursuit
      const targetPos = {
        x: player.pos.x + Math.sin(Date.now() * 0.003) * 160,
        y: clamp(player.pos.y - 180, 80, 240)
      };

      const desiredDir = vecNormalize(vecSub(targetPos, this.pos));
      const targetVel = vecScale(desiredDir, 280);
      this.vel = vecAdd(this.vel, vecScale(vecSub(targetVel, this.vel), 4.0 * effectiveDt));

      if (vecLength(this.vel) > 10) {
        this.headingAngle = Math.atan2(this.vel.y, this.vel.x);
      }
    }

    this.pos = vecAdd(this.pos, vecScale(this.vel, effectiveDt));
    this.pos.x = clamp(this.pos.x, 40, bounds.width - 40);

    // 2. Jet-Wash Exhaust Trail
    if (Math.random() < 0.8) {
      const exhaustOffset = vecFromAngle(this.headingAngle + Math.PI, 20);
      this.jetTrail.push({
        pos: vecAdd(this.pos, exhaustOffset),
        lifetime: 0,
        maxLifetime: 0.9
      });
    }

    for (let i = this.jetTrail.length - 1; i >= 0; i--) {
      const pt = this.jetTrail[i];
      pt.lifetime += effectiveDt;
      if (pt.lifetime >= pt.maxLifetime) {
        this.jetTrail.splice(i, 1);
      }
    }

    // 3. Attack Routines
    this.patternTimer += effectiveDt;
    if (this.phase === 1 && this.patternTimer >= 2.0) {
      this.patternTimer = 0;
      this.fireTachyonVolley(hazards, audio);
    } else if (this.phase === 2 && this.patternTimer >= 1.5) {
      this.patternTimer = 0;
      this.fireCounterChronoRays(hazards, audio);
    } else if (this.phase === 3 && this.patternTimer >= 2.6) {
      this.patternTimer = 0;
      // Initiate Supersonic Ram
      this.isRamming = true;
      this.ramTarget = { x: player.pos.x, y: bounds.height + 100 };
      vfx.spawnShockwave(this.pos, 220, '#facc15', 6);
      vfx.spawnFloatingText('SUPERSONIC DIVE!', this.pos, '#facc15', 1.6);
      audio.playLaserTelegraph();
    }

    // 4. Collision with Player
    const directHit = isNearMissGraze(player.pos, player.radius, player.grazeRadius, this.pos, this.radius);
    if (directHit.isHit) {
      if (isPlayerSuperluminal) {
        // Player in Superluminal Warp rams into Nemesis for massive damage!
        this.damage(500, vfx, audio);
        vfx.spawnShockwave(this.pos, 300, '#facc15', 10);
        vfx.spawnFloatingText('WARP IMPACT! -500 HP', this.pos, '#facc15', 2.0);
      } else {
        hits++;
      }
    } else if (directHit.isGraze) {
      grazes++;
      this.damage(10, vfx, audio);
    }

    // 5. Collision with Jet-Wash Trail
    for (const trail of this.jetTrail) {
      if (circleSegmentCollision(player.pos, player.radius, trail.pos, trail.pos, 10)) {
        hits++;
        break;
      }
    }

    return { hits, grazes, bossKilled: this.health <= 0 };
  }

  private fireTachyonVolley(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const angles = [-0.25, 0, 0.25];
    for (const a of angles) {
      const bulletAngle = this.headingAngle + a;
      hazards.hazards.push({
        id: Math.floor(Math.random() * 999999),
        type: 'ORB',
        pos: vecAdd(this.pos, vecFromAngle(bulletAngle, 24)),
        vel: vecFromAngle(bulletAngle, 220),
        radius: 8,
        color: '#facc15',
        hasGrazed: false,
        markedForRemoval: false,
        bounceCount: 0,
        maxBounces: 2
      });
    }
  }

  private fireCounterChronoRays(hazards: HazardDirector, audio: SoundEngine): void {
    audio.playLaserTelegraph();
    const spawnAngle = this.headingAngle + (Math.random() * 0.6 - 0.3);
    hazards.hazards.push({
      id: Math.floor(Math.random() * 999999),
      type: 'SEEKER',
      pos: vecAdd(this.pos, vecFromAngle(spawnAngle, 26)),
      vel: vecFromAngle(spawnAngle, 210),
      radius: 7,
      color: '#a855f7',
      hasGrazed: false,
      markedForRemoval: false,
      turnRate: 2.8,
      currentSpeed: 210,
      maxSpeed: 280,
      lifetime: 0
    });
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();

    // 1. Render Jet-Wash Exhaust Trails
    for (const pt of this.jetTrail) {
      const alpha = 1 - pt.lifetime / pt.maxLifetime;
      ctx.beginPath();
      ctx.arc(pt.pos.x, pt.pos.y, 8 * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.6})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#facc15';
      ctx.fill();
    }

    // 2. Render Holographic Quantum Decoys in Phase 3
    if (this.phase === 3) {
      for (const offset of this.decoyOffsets) {
        ctx.save();
        ctx.translate(this.pos.x + offset.x, this.pos.y + offset.y);
        ctx.rotate(this.headingAngle);
        ctx.globalAlpha = 0.45;
        this.renderShipModel(ctx, '#a855f7', '#d8b4fe');
        ctx.restore();
      }
    }

    // 3. Render Main Nemesis-00 Vessel
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.headingAngle);
    this.renderShipModel(ctx, '#facc15', '#a855f7');
    ctx.restore();

    // 4. Render Health Bar
    this.renderHealthBar(ctx);
  }

  private renderShipModel(ctx: CanvasRenderingContext2D, strokeColor: string, glowColor: string): void {
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.6, 0);
    ctx.lineTo(-this.radius * 1.1, this.radius * 1.1);
    ctx.lineTo(-this.radius * 0.4, 0);
    ctx.lineTo(-this.radius * 1.1, -this.radius * 1.1);
    ctx.closePath();

    ctx.fillStyle = '#10051e';
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 18;
    ctx.shadowColor = glowColor;
    ctx.stroke();

    // Twin Afterburner Thruster Flames
    ctx.beginPath();
    ctx.moveTo(-this.radius * 0.8, this.radius * 0.5);
    ctx.lineTo(-this.radius * 1.6, 0);
    ctx.lineTo(-this.radius * 0.8, -this.radius * 0.5);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const barWidth = 460;
    const barHeight = 12;
    const x = (960 - barWidth) * 0.5;
    const y = 36;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, barWidth, barHeight);

    const themeColor = this.phase === 3 ? '#facc15' : this.phase === 2 ? '#a855f7' : '#c084fc';
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barWidth, barHeight);

    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = themeColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = themeColor;
    ctx.fillRect(x + 1, y + 1, (barWidth - 2) * pct, barHeight - 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`NEMESIS-00 'CHRONOS-OMEGA' [PHASE ${this.phase}/3]`, 480, y - 6);

    ctx.restore();
  }
}
