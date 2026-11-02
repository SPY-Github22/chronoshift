import { Vector2D } from './types';
import { circleCircleCollision, vecAdd, vecCreate, vecDistance, vecNormalize, vecScale, vecSub } from './math';
import { VFXManager } from './particles';
import { SoundEngine } from './audio';

export interface SpeedGate {
  id: number;
  pos: Vector2D;
  width: number;
  height: number;
  speed: number;
  passed: boolean;
  active: boolean;
}

export interface WormholePair {
  id: number;
  blackHole: {
    pos: Vector2D;
    radius: number;
    pullRadius: number;
    swirlAngle: number;
  };
  whiteHole: {
    pos: Vector2D;
    radius: number;
    blastRadius: number;
    pulsePhase: number;
  };
  cooldownTimer: number;
  active: boolean;
}

export interface WarpStreak {
  x: number;
  y: number;
  length: number;
  speed: number;
  color: string;
  alpha: number;
}

export function checkGatePassThrough(
  gate: SpeedGate,
  playerPos: Vector2D,
  playerRadius: number
): boolean {
  if (gate.passed || !gate.active) return false;

  const halfW = gate.width * 0.5;
  const halfH = gate.height * 0.5;

  const inX = playerPos.x >= gate.pos.x - halfW - playerRadius && playerPos.x <= gate.pos.x + halfW + playerRadius;
  const inY = Math.abs(playerPos.y - gate.pos.y) <= halfH + playerRadius;

  return inX && inY;
}

export function checkBlackHoleEntry(
  wormhole: WormholePair,
  playerPos: Vector2D,
  playerRadius: number
): boolean {
  if (!wormhole.active || wormhole.cooldownTimer > 0) return false;
  return circleCircleCollision(wormhole.blackHole.pos, wormhole.blackHole.radius, playerPos, playerRadius);
}

export function calculateTeleportExit(
  wormhole: WormholePair,
  currentVel: Vector2D,
  exitSpeedBoost = 320
): { exitPos: Vector2D; exitVel: Vector2D } {
  // Teleport to white hole position
  const exitPos: Vector2D = {
    x: wormhole.whiteHole.pos.x,
    y: wormhole.whiteHole.pos.y
  };

  // Expelled outward with boosted velocity
  let forwardDir = vecNormalize(currentVel);
  if (vecDistance(forwardDir, { x: 0, y: 0 }) < 0.01) {
    forwardDir = { x: 0, y: -1 }; // Default upward
  }

  const exitVel = vecScale(forwardDir, Math.max(450, exitSpeedBoost));

  return { exitPos, exitVel };
}

export class SlipstreamManager {
  public gates: SpeedGate[] = [];
  public wormholes: WormholePair[] = [];
  public streaks: WarpStreak[] = [];

  public hyperDriveCharge = 0;
  public isSuperluminal = false;
  public superluminalTimer = 0;

  private nextGateId = 1;
  private nextWormholeId = 1;
  private gateSpawnTimer = 0;
  private wormholeSpawnTimer = 0;

  constructor(maxStreaks = 80) {
    for (let i = 0; i < maxStreaks; i++) {
      this.streaks.push({
        x: Math.random() * 960,
        y: Math.random() * 640,
        length: 20 + Math.random() * 60,
        speed: 600 + Math.random() * 700,
        color: Math.random() < 0.6 ? '#a855f7' : '#facc15',
        alpha: 0.2 + Math.random() * 0.5
      });
    }
  }

  public reset(): void {
    this.gates = [];
    this.wormholes = [];
    this.hyperDriveCharge = 0;
    this.isSuperluminal = false;
    this.superluminalTimer = 0;
    this.gateSpawnTimer = 0;
    this.wormholeSpawnTimer = 0;
  }

  public spawnWormholePair(
    bX: number,
    bY: number,
    wX: number,
    wY: number
  ): WormholePair {
    const pair: WormholePair = {
      id: this.nextWormholeId++,
      blackHole: {
        pos: { x: bX, y: bY },
        radius: 26,
        pullRadius: 160,
        swirlAngle: 0
      },
      whiteHole: {
        pos: { x: wX, y: wY },
        radius: 28,
        blastRadius: 180,
        pulsePhase: 0
      },
      cooldownTimer: 0,
      active: true
    };
    this.wormholes.push(pair);
    return pair;
  }

  public update(
    scaledDt: number,
    realDt: number,
    playerPos: Vector2D,
    playerVel: Vector2D,
    playerRadius: number,
    vfx: VFXManager,
    audio: SoundEngine
  ): {
    gatePassedCount: number;
    teleported: boolean;
    teleportExitPos?: Vector2D;
    teleportExitVel?: Vector2D;
  } {
    let gatePassedCount = 0;
    let teleported = false;
    let teleportExitPos: Vector2D | undefined;
    let teleportExitVel: Vector2D | undefined;

    // 1. Superluminal Overdrive Update
    if (this.isSuperluminal) {
      this.superluminalTimer -= realDt;
      if (this.superluminalTimer <= 0) {
        this.isSuperluminal = false;
        this.hyperDriveCharge = 0;
      }
    }

    // 2. Parallax Warp Streaks
    const warpMultiplier = this.isSuperluminal ? 2.8 : 1.0;
    for (const streak of this.streaks) {
      streak.y += streak.speed * warpMultiplier * realDt;
      if (streak.y > 640) {
        streak.y = -streak.length;
        streak.x = Math.random() * 960;
      }
    }

    // 3. Speed Gates Spawning & Moving
    this.gateSpawnTimer += scaledDt;
    if (this.gateSpawnTimer >= 3.2 && this.gates.length < 3) {
      this.gateSpawnTimer = 0;
      this.gates.push({
        id: this.nextGateId++,
        pos: vecCreate(120 + Math.random() * 720, -40),
        width: 140,
        height: 22,
        speed: 210,
        passed: false,
        active: true
      });
    }

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gate = this.gates[i];
      gate.pos.y += gate.speed * scaledDt;

      // Check Pass Through
      if (!gate.passed && checkGatePassThrough(gate, playerPos, playerRadius)) {
        gate.passed = true;
        gatePassedCount++;
        this.hyperDriveCharge = Math.min(100, this.hyperDriveCharge + 25);

        vfx.spawnShockwave(gate.pos, 160, '#facc15', 5);
        vfx.spawnSparks(gate.pos, 22, '#a855f7', 220);
        vfx.spawnFloatingText('+SPEED GATE! (HYPER +25%)', gate.pos, '#facc15', 1.3);
        audio.playShieldRestored();

        // Trigger Superluminal Mode at 100%
        if (this.hyperDriveCharge >= 100 && !this.isSuperluminal) {
          this.isSuperluminal = true;
          this.superluminalTimer = 4.0;
          vfx.spawnShockwave(playerPos, 500, '#facc15', 10);
          vfx.triggerScreenShake(20, 0.6);
          vfx.spawnFloatingText('SUPERLUMINAL WARP ACTIVE!', playerPos, '#facc15', 2.0);
          audio.playEmpBlast();
        }
      }

      if (gate.pos.y > 680) {
        this.gates.splice(i, 1);
      }
    }

    // 4. Wormhole Spawning & Mechanics
    this.wormholeSpawnTimer += scaledDt;
    if (this.wormholeSpawnTimer >= 12.0 && this.wormholes.length === 0) {
      this.wormholeSpawnTimer = 0;
      // Spawn paired portals across arena
      const bX = 180 + Math.random() * 220;
      const bY = 220 + Math.random() * 200;
      const wX = 560 + Math.random() * 220;
      const wY = 220 + Math.random() * 200;
      this.spawnWormholePair(bX, bY, wX, wY);
    }

    for (let i = this.wormholes.length - 1; i >= 0; i--) {
      const wh = this.wormholes[i];
      wh.blackHole.swirlAngle += realDt * 3.5;
      wh.whiteHole.pulsePhase += realDt * 4.0;

      if (wh.cooldownTimer > 0) {
        wh.cooldownTimer -= realDt;
      }

      // Check Black Hole Gravitational Pull on Player
      const distToBlackHole = vecDistance(playerPos, wh.blackHole.pos);
      if (distToBlackHole < wh.blackHole.pullRadius && wh.cooldownTimer <= 0) {
        // Gravitational vortex pull into black hole
        const pullDir = vecNormalize(vecSub(wh.blackHole.pos, playerPos));
        const pullForce = (1 - distToBlackHole / wh.blackHole.pullRadius) * 260;
        playerVel = vecAdd(playerVel, vecScale(pullDir, pullForce * realDt));
      }

      // Check Black Hole Ingress Entry
      if (checkBlackHoleEntry(wh, playerPos, playerRadius)) {
        teleported = true;
        wh.cooldownTimer = 2.5;

        const exit = calculateTeleportExit(wh, playerVel, 480);
        teleportExitPos = exit.exitPos;
        teleportExitVel = exit.exitVel;

        // Visual juice at ingress
        vfx.spawnShockwave(wh.blackHole.pos, 160, '#a855f7', 6);
        vfx.spawnSparks(wh.blackHole.pos, 30, '#a855f7', 260);

        // Visual juice at egress
        vfx.spawnShockwave(wh.whiteHole.pos, 220, '#facc15', 8);
        vfx.spawnSparks(wh.whiteHole.pos, 35, '#ffffff', 280);
        vfx.triggerScreenShake(14, 0.4);
        vfx.spawnFloatingText('WORMHOLE TELEPORT!', wh.whiteHole.pos, '#facc15', 1.6);
        audio.playEmpBlast();
      }
    }

    return {
      gatePassedCount,
      teleported,
      teleportExitPos,
      teleportExitVel
    };
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Render Relativistic Parallax Warp Streaks
    for (const s of this.streaks) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + s.length);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 2. Render Speed Gates
    for (const g of this.gates) {
      if (!g.active) continue;
      const halfW = g.width * 0.5;
      const gateColor = g.passed ? 'rgba(168, 85, 247, 0.3)' : '#facc15';

      ctx.save();
      ctx.strokeStyle = gateColor;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = g.passed ? 0 : 16;
      ctx.shadowColor = gateColor;

      // Gate Archway
      ctx.beginPath();
      ctx.arc(g.pos.x, g.pos.y, halfW, Math.PI, 0, false);
      ctx.stroke();

      // Horizontal Accelerator Line
      ctx.beginPath();
      ctx.moveTo(g.pos.x - halfW, g.pos.y);
      ctx.lineTo(g.pos.x + halfW, g.pos.y);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();

      // Gate Pylons
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(g.pos.x - halfW - 4, g.pos.y - 6, 8, 12);
      ctx.fillRect(g.pos.x + halfW - 4, g.pos.y - 6, 8, 12);

      ctx.restore();
    }

    // 3. Render Wormhole Pairs (Black Hole & White Hole)
    for (const wh of this.wormholes) {
      if (!wh.active) continue;

      // A. Black Hole Ingress (Dark Matter Violet Vortex)
      ctx.save();
      ctx.translate(wh.blackHole.pos.x, wh.blackHole.pos.y);
      ctx.rotate(wh.blackHole.swirlAngle);

      // Event horizon outer ring
      ctx.beginPath();
      ctx.arc(0, 0, wh.blackHole.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#a855f7';
      ctx.stroke();

      // Accretion spiral arms
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const th = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, wh.blackHole.radius * 0.7, th, th + 1.2);
        ctx.stroke();
      }

      // Singularity Pitch Black Core
      ctx.beginPath();
      ctx.arc(0, 0, wh.blackHole.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.shadowBlur = 0;
      ctx.fill();

      // Ingress Label
      ctx.fillStyle = '#d8b4fe';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BLACK HOLE', 0, wh.blackHole.radius + 20);

      ctx.restore();

      // B. White Hole Egress (Radiant Solar Gold Fountain)
      ctx.save();
      const pulse = Math.sin(wh.whiteHole.pulsePhase) * 4;
      ctx.translate(wh.whiteHole.pos.x, wh.whiteHole.pos.y);

      // Repulsion blast field ring
      ctx.beginPath();
      ctx.arc(0, 0, wh.whiteHole.radius + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#facc15';
      ctx.stroke();

      // Radiant white core emission
      ctx.beginPath();
      ctx.arc(0, 0, wh.whiteHole.radius * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ffffff';
      ctx.fill();

      // Egress Label
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('WHITE HOLE', 0, wh.whiteHole.radius + 20);

      ctx.restore();
    }

    ctx.restore();
  }
}
