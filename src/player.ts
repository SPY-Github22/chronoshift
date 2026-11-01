import { InputState, Player, Vector2D } from './types';
import { clamp, vecAdd, vecCreate, vecLength, vecNormalize, vecScale } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';

export class PlayerController {
  public player: Player;
  private readonly maxSpeed = 380;
  private readonly acceleration = 1800;
  private readonly drag = 0.88;

  constructor(startX: number, startY: number) {
    this.player = {
      pos: vecCreate(startX, startY),
      vel: vecCreate(0, 0),
      speed: 0,
      radius: 9,
      grazeRadius: 28,
      health: 3,
      maxHealth: 3,
      chronoEnergy: 100,
      maxChronoEnergy: 100,
      isChronoActive: false,
      empEnergy: 0,
      maxEmpEnergy: 100,
      empReady: false,
      invulnerableTimer: 0,
      thrustTrailTimer: 0,
      overdriveTimer: 0,
      frostLevel: 0,
      isFrozenStiff: false
    };
  }

  public reset(startX: number, startY: number): void {
    this.player.pos = vecCreate(startX, startY);
    this.player.vel = vecCreate(0, 0);
    this.player.speed = 0;
    this.player.health = this.player.maxHealth;
    this.player.chronoEnergy = this.player.maxChronoEnergy;
    this.player.isChronoActive = false;
    this.player.empEnergy = 0;
    this.player.empReady = false;
    this.player.invulnerableTimer = 0;
    this.player.thrustTrailTimer = 0;
    this.player.overdriveTimer = 0;
    this.player.frostLevel = 0;
    this.player.isFrozenStiff = false;
  }

  public update(
    rawDt: number,
    input: InputState,
    bounds: { width: number; height: number },
    vfx: VFXManager,
    audio: SoundEngine,
    isSubZero = false
  ): { timeScale: number; empTriggered: boolean } {
    // Thermal & Frost accumulation in Sub-Zero environments
    if (isSubZero) {
      this.player.frostLevel = Math.min(100, this.player.frostLevel + 8.5 * rawDt);
      if (this.player.isChronoActive) {
        this.player.frostLevel = Math.max(0, this.player.frostLevel - 35 * rawDt);
      }
      this.player.isFrozenStiff = this.player.frostLevel >= 95;
    } else {
      this.player.frostLevel = 0;
      this.player.isFrozenStiff = false;
    }

    // Overdrive decay and bonus
    const isOverdrive = this.player.overdriveTimer > 0;
    if (isOverdrive) {
      this.player.overdriveTimer -= rawDt;
      this.player.chronoEnergy = this.player.maxChronoEnergy;
    }

    // Determine Chronoshift activation
    const wantsChrono = (input.chrono || input.isPointerActive || isOverdrive) && (this.player.chronoEnergy > 5 || isOverdrive);
    const previouslyActive = this.player.isChronoActive;

    if (wantsChrono) {
      this.player.isChronoActive = true;
      if (!isOverdrive) {
        this.player.chronoEnergy = Math.max(0, this.player.chronoEnergy - 28 * rawDt);
      }
      if (this.player.chronoEnergy <= 0) {
        this.player.isChronoActive = false;
      }
    } else {
      this.player.isChronoActive = false;
      // Passive recharge
      this.player.chronoEnergy = Math.min(
        this.player.maxChronoEnergy,
        this.player.chronoEnergy + 12 * rawDt
      );
    }

    if (this.player.isChronoActive !== previouslyActive) {
      audio.playChronoShift(this.player.isChronoActive);
    }

    const timeScale = this.player.isChronoActive ? 0.22 : 1.0;

    // Movement calculation (always in unscaled real-time for player responsiveness)
    let moveDir: Vector2D = vecCreate(0, 0);
    if (input.up) moveDir.y -= 1;
    if (input.down) moveDir.y += 1;
    if (input.left) moveDir.x -= 1;
    if (input.right) moveDir.x += 1;

    // Pointer-directed movement if active
    if (input.isPointerActive) {
      const toPointer = {
        x: input.pointerPos.x - this.player.pos.x,
        y: input.pointerPos.y - this.player.pos.y
      };
      const dist = vecLength(toPointer);
      if (dist > 10) {
        moveDir = vecNormalize(toPointer);
      }
    } else {
      moveDir = vecNormalize(moveDir);
    }

    if (vecLength(moveDir) > 0) {
      const accel = vecScale(moveDir, (this.player.isFrozenStiff ? this.acceleration * 0.55 : this.acceleration) * rawDt);
      this.player.vel = vecAdd(this.player.vel, accel);

      // Clamp max speed (sluggish if frozen stiff)
      const allowedMaxSpeed = this.player.isFrozenStiff ? this.maxSpeed * 0.58 : this.maxSpeed;
      const curSpeed = vecLength(this.player.vel);
      if (curSpeed > allowedMaxSpeed) {
        this.player.vel = vecScale(vecNormalize(this.player.vel), allowedMaxSpeed);
      }

      // High-speed kinetic friction dissipates frost
      if (isSubZero && curSpeed > 160) {
        this.player.frostLevel = Math.max(0, this.player.frostLevel - 14 * rawDt);
      }

      // Thruster trail particles
      this.player.thrustTrailTimer += rawDt;
      if (this.player.thrustTrailTimer >= 0.04) {
        this.player.thrustTrailTimer = 0;
        const trailPos = vecAdd(this.player.pos, vecScale(vecNormalize(this.player.vel), -12));
        vfx.spawnSparks(trailPos, 2, this.player.isFrozenStiff ? '#74ebd5' : '#00f3ff', 50);
      }
    } else {
      // Natural inertia drag
      this.player.vel = vecScale(this.player.vel, Math.pow(this.drag, rawDt * 60));
    }

    // Apply velocity
    this.player.pos = vecAdd(this.player.pos, vecScale(this.player.vel, rawDt));

    // Clamp inside viewport
    this.player.pos.x = clamp(this.player.pos.x, this.player.radius + 6, bounds.width - this.player.radius - 6);
    this.player.pos.y = clamp(this.player.pos.y, this.player.radius + 6, bounds.height - this.player.radius - 6);

    // Invulnerability timer decay
    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer -= rawDt;
    }

    // EMP logic
    this.player.empReady = this.player.empEnergy >= this.player.maxEmpEnergy;
    let empTriggered = false;
    if (input.triggerEmp && this.player.empReady) {
      empTriggered = true;
      this.player.empEnergy = 0;
      this.player.empReady = false;
      this.player.frostLevel = 0;
      this.player.isFrozenStiff = false;
      vfx.spawnShockwave(this.player.pos, Math.max(bounds.width, bounds.height), '#ff0055', 8);
      vfx.triggerScreenShake(14, 0.45);
      audio.playEmpBlast();
    }

    return { timeScale, empTriggered };
  }

  public onGraze(bonusChrono: number, bonusEmp: number, vfx: VFXManager, audio: SoundEngine): void {
    this.player.chronoEnergy = Math.min(this.player.maxChronoEnergy, this.player.chronoEnergy + bonusChrono);
    this.player.empEnergy = Math.min(this.player.maxEmpEnergy, this.player.empEnergy + bonusEmp);
    // Kinetic heat from graze melts frost
    this.player.frostLevel = Math.max(0, this.player.frostLevel - 25);
    this.player.isFrozenStiff = this.player.frostLevel >= 95;
    vfx.spawnSparks(this.player.pos, 5, '#ffff00', 120);
    audio.playGraze();
  }

  public heal(amount = 1): boolean {
    if (this.player.health < this.player.maxHealth) {
      this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
      return true;
    }
    return false;
  }

  public activateOverdrive(duration = 5.0): void {
    this.player.overdriveTimer = duration;
  }

  public takeHit(vfx: VFXManager, audio: SoundEngine): boolean {
    if (this.player.invulnerableTimer > 0) {
      return false;
    }
    this.player.health--;
    this.player.invulnerableTimer = 1.8;
    vfx.triggerScreenShake(18, 0.4);
    vfx.spawnSparks(this.player.pos, 35, '#ff2255', 280);
    vfx.spawnShockwave(this.player.pos, 90, '#ff2255', 5);
    audio.playHit();
    return this.player.health <= 0;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const { pos, radius, grazeRadius, invulnerableTimer, isChronoActive } = this.player;

    ctx.save();

    // If invulnerable, flicker
    if (invulnerableTimer > 0 && Math.floor(invulnerableTimer * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Graze shield ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, grazeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isChronoActive ? '#ff00aa' : 'rgba(0, 243, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ship heading angle based on velocity or default upward
    const heading = vecLength(this.player.vel) > 10 ? Math.atan2(this.player.vel.y, this.player.vel.x) : -Math.PI / 2;

    ctx.translate(pos.x, pos.y);
    ctx.rotate(heading);

    // Neon Cyber Ship
    ctx.beginPath();
    ctx.moveTo(radius * 1.5, 0);
    ctx.lineTo(-radius, radius * 0.9);
    ctx.lineTo(-radius * 0.5, 0);
    ctx.lineTo(-radius, -radius * 0.9);
    ctx.closePath();

    ctx.fillStyle = isChronoActive ? '#ff0055' : '#051b2a';
    ctx.fill();

    ctx.strokeStyle = isChronoActive ? '#ff00aa' : '#00f3ff';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = isChronoActive ? '#ff00aa' : '#00f3ff';
    ctx.stroke();

    // Frost Glaze Overlay
    if (this.player.frostLevel > 0) {
      const frostAlpha = Math.min(0.85, (this.player.frostLevel / 100) * 0.9);
      ctx.fillStyle = `rgba(116, 235, 213, ${frostAlpha})`;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#4deeea';
      ctx.fill();

      if (this.player.isFrozenStiff) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
