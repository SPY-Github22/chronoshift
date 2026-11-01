import { InputState } from './types';
import { GameStateManager } from './state';
import { PlayerController } from './player';
import { HazardDirector } from './hazards';
import { VFXManager } from './particles';
import { sound } from './audio';

class ChronoshiftGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameStateManager;
  private playerCtrl: PlayerController;
  private hazardDirector: HazardDirector;
  private vfx: VFXManager;

  private input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    chrono: false,
    triggerEmp: false,
    pointerPos: { x: 480, y: 320 },
    isPointerActive: false
  };

  private lastTime = 0;

  // DOM Elements
  private hudScore: HTMLElement;
  private hudHigh: HTMLElement;
  private hudWave: HTMLElement;
  private hudMultiplier: HTMLElement;
  private hudComboBar: HTMLElement;
  private hudHealth: HTMLElement;
  private meterChrono: HTMLElement;
  private meterEmp: HTMLElement;
  private overlay: HTMLElement;
  private overlayTitle: HTMLElement;
  private overlaySubtitle: HTMLElement;
  private startBtn: HTMLButtonElement;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not obtain 2D rendering context');
    }
    this.ctx = context;

    this.state = new GameStateManager();
    this.playerCtrl = new PlayerController(this.canvas.width * 0.5, this.canvas.height * 0.5);
    this.hazardDirector = new HazardDirector();
    this.vfx = new VFXManager();

    // Bind DOM
    this.hudScore = document.getElementById('hud-score')!;
    this.hudHigh = document.getElementById('hud-high')!;
    this.hudWave = document.getElementById('hud-wave')!;
    this.hudMultiplier = document.getElementById('hud-multiplier')!;
    this.hudComboBar = document.getElementById('hud-combo-bar')!;
    this.hudHealth = document.getElementById('hud-health')!;
    this.meterChrono = document.getElementById('meter-chrono')!;
    this.meterEmp = document.getElementById('meter-emp')!;
    this.overlay = document.getElementById('overlay')!;
    this.overlayTitle = document.getElementById('overlay-title')!;
    this.overlaySubtitle = document.getElementById('overlay-subtitle')!;
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;

    this.setupListeners();
    this.updateHUD();

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.up = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.down = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
      if (code === 'Space') {
        this.input.chrono = true;
        e.preventDefault();
      }
      if (code === 'KeyE') this.input.triggerEmp = true;
      if (code === 'KeyM') sound.toggleMute();
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
      if (code === 'Space') this.input.chrono = false;
      if (code === 'KeyE') this.input.triggerEmp = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.input.pointerPos.x = (e.clientX - rect.left) * scaleX;
      this.input.pointerPos.y = (e.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.input.triggerEmp = true;
      } else if (e.button === 2) {
        this.input.chrono = true;
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.triggerEmp = false;
      } else if (e.button === 2) {
        this.input.chrono = false;
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.startBtn.addEventListener('click', () => {
      this.startGame();
    });
  }

  private startGame(): void {
    this.state.resetGame();
    this.playerCtrl.reset(this.canvas.width * 0.5, this.canvas.height * 0.5);
    this.hazardDirector.reset();
    this.overlay.style.display = 'none';
  }

  private gameOver(): void {
    this.state.setMode('GAMEOVER');
    this.overlayTitle.innerText = 'MISSION FAILED';
    this.overlaySubtitle.innerText = `FINAL SCORE: ${this.state.stats.score.toLocaleString()} | WAVE: ${this.state.stats.wave}`;
    this.startBtn.innerText = 'RESTART SYSTEM';
    this.overlay.style.display = 'flex';
  }

  private updateHUD(): void {
    const { stats } = this.state;
    const { player } = this.playerCtrl;

    this.hudScore.innerText = stats.score.toLocaleString();
    this.hudHigh.innerText = stats.highScore.toLocaleString();
    this.hudWave.innerText = stats.wave.toString();

    this.hudMultiplier.innerText = `${stats.multiplier}x MULTIPLIER`;
    if (stats.comboCount > 0) {
      const pct = Math.round((stats.comboTimer / this.state.config.comboDuration) * 100);
      this.hudComboBar.innerText = `COMBO x${stats.comboCount} (${pct}%)`;
    } else {
      this.hudComboBar.innerText = 'GRAZE HAZARDS TO COMBO';
    }

    // Health hearts
    const hearts = '♥'.repeat(Math.max(0, player.health)) + '♡'.repeat(Math.max(0, player.maxHealth - player.health));
    this.hudHealth.innerText = hearts;

    // Meter bars
    const chronoPct = Math.round((player.chronoEnergy / player.maxChronoEnergy) * 100);
    this.meterChrono.style.width = `${chronoPct}%`;

    const empPct = Math.round((player.empEnergy / player.maxEmpEnergy) * 100);
    this.meterEmp.style.width = `${empPct}%`;
    if (player.empReady) {
      this.meterEmp.style.boxShadow = '0 0 10px #ff0055';
    } else {
      this.meterEmp.style.boxShadow = 'none';
    }
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp;
    const rawDt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (this.state.mode === 'PLAYING') {
      const bounds = { width: this.canvas.width, height: this.canvas.height };

      // Update Player & get Time Scale
      const { timeScale, empTriggered } = this.playerCtrl.update(
        rawDt,
        this.input,
        bounds,
        this.vfx,
        sound
      );

      if (empTriggered) {
        this.state.recordEmpActivation();
        const destroyed = this.hazardDirector.destroyAllHazards(this.vfx, sound);
        if (destroyed > 0) {
          const bonus = this.state.addScore(destroyed * 800);
          this.vfx.spawnFloatingText(`EMP PURGE +${bonus}!`, this.playerCtrl.player.pos, '#ff00aa', 1.4);
        }
      }

      // Scaled dt for world hazards
      const scaledDt = rawDt * timeScale;
      this.state.update(scaledDt);

      // Update hazards & collisions
      const { hits, grazes, coresCollected } = this.hazardDirector.update(
        scaledDt,
        rawDt,
        this.state.stats.wave,
        this.playerCtrl.player,
        bounds,
        this.vfx,
        sound
      );

      // Handle Grazes
      for (let i = 0; i < grazes; i++) {
        const { pointsEarned, newMultiplier } = this.state.registerGraze();
        this.playerCtrl.onGraze(
          this.state.config.grazeChronoBonus,
          this.state.config.grazeEmpBonus,
          this.vfx,
          sound
        );
        this.vfx.spawnFloatingText(`GRAZE +${pointsEarned} (${newMultiplier}x)`, this.playerCtrl.player.pos, '#00f3ff', 1.0);
      }

      // Handle Core Collections
      for (let i = 0; i < coresCollected; i++) {
        const bonus = this.state.addScore(1000);
        this.playerCtrl.player.empEnergy = Math.min(
          this.playerCtrl.player.maxEmpEnergy,
          this.playerCtrl.player.empEnergy + 30
        );
        this.vfx.spawnFloatingText(`+${bonus}`, this.playerCtrl.player.pos, '#00ff88', 1.1);
      }

      // Handle Direct Hits
      for (let i = 0; i < hits; i++) {
        const isDead = this.playerCtrl.takeHit(this.vfx, sound);
        if (isDead) {
          this.gameOver();
          break;
        }
      }

      this.updateHUD();
    }

    // VFX update
    this.vfx.update(rawDt);

    // Render Frame
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private render(): void {
    const { width, height } = this.canvas;
    const shake = this.vfx.getShakeOffset();

    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);

    // Clear background
    this.ctx.fillStyle = '#03060a';
    this.ctx.fillRect(0, 0, width, height);

    // Cyber grid backdrop
    this.renderGrid(width, height);

    // Render world entities
    this.hazardDirector.render(this.ctx);
    this.vfx.render(this.ctx);

    if (this.state.mode === 'PLAYING') {
      this.playerCtrl.render(this.ctx);
    }

    this.ctx.restore();
  }

  private renderGrid(width: number, height: number): void {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    this.ctx.lineWidth = 1;

    const gridSize = 40;
    this.ctx.beginPath();
    for (let x = 0; x <= width; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }
}

// Start game instance once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new ChronoshiftGame();
});
