import { FloatingText, Particle, Shockwave, Vector2D } from './types';
import { randomRange, vecCreate } from './math';

export class VFXManager {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextTextId = 1;

  public shakeIntensity = 0;
  public shakeDuration = 0;

  constructor(maxParticles = 500) {
    // Pre-allocate pool
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        pos: vecCreate(0, 0),
        vel: vecCreate(0, 0),
        color: '#00f3ff',
        size: 3,
        alpha: 1,
        decay: 1.5,
        glow: true,
        active: false
      });
    }
  }

  public triggerScreenShake(intensity: number, duration = 0.25): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  public getShakeOffset(): Vector2D {
    if (this.shakeDuration <= 0 || this.shakeIntensity <= 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: (Math.random() * 2 - 1) * this.shakeIntensity,
      y: (Math.random() * 2 - 1) * this.shakeIntensity
    };
  }

  public spawnSparks(pos: Vector2D, count = 12, color = '#00f3ff', speed = 180): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        const angle = Math.random() * Math.PI * 2;
        const spd = randomRange(speed * 0.4, speed);
        p.pos.x = pos.x;
        p.pos.y = pos.y;
        p.vel.x = Math.cos(angle) * spd;
        p.vel.y = Math.sin(angle) * spd;
        p.color = color;
        p.size = randomRange(2, 4.5);
        p.alpha = 1;
        p.decay = randomRange(1.8, 3.2);
        p.glow = true;
        p.active = true;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public spawnShockwave(pos: Vector2D, maxRadius = 140, color = '#00f3ff', thickness = 4): void {
    this.shockwaves.push({
      pos: { x: pos.x, y: pos.y },
      radius: 4,
      maxRadius,
      expansionRate: maxRadius / 0.35,
      color,
      alpha: 1,
      thickness,
      active: true
    });
  }

  public spawnFloatingText(text: string, pos: Vector2D, color = '#ff0077', scale = 1.0): void {
    this.floatingTexts.push({
      id: this.nextTextId++,
      text,
      pos: { x: pos.x, y: pos.y - 10 },
      vel: { x: randomRange(-15, 15), y: -45 },
      color,
      alpha: 1,
      scale,
      lifetime: 0,
      maxLifetime: 0.8
    });
  }

  public update(dt: number): void {
    // Screen shake decay
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }

    // Particles update
    for (const p of this.particles) {
      if (p.active) {
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.vel.x *= 0.94;
        p.vel.y *= 0.94;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          p.active = false;
        }
      }
    }

    // Shockwaves update
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.expansionRate * dt;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Floating text update
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.pos.x += ft.vel.x * dt;
      ft.pos.y += ft.vel.y * dt;
      ft.lifetime += dt;
      ft.alpha = Math.max(0, 1 - ft.lifetime / ft.maxLifetime);
      if (ft.lifetime >= ft.maxLifetime) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Render Shockwaves
    for (const sw of this.shockwaves) {
      ctx.beginPath();
      ctx.arc(sw.pos.x, sw.pos.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.thickness;
      ctx.globalAlpha = sw.alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = sw.color;
      ctx.stroke();
    }

    // Render Particles
    for (const p of this.particles) {
      if (p.active) {
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render Floating Texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = ft.color;
      ctx.font = `bold ${Math.round(14 * ft.scale)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.pos.x, ft.pos.y);
      ctx.restore();
    }

    ctx.restore();
  }
}
