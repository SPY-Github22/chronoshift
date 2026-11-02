import { InputState } from './types';
import { GameStateManager } from './state';
import { PlayerController } from './player';
import { HazardDirector } from './hazards';
import { VFXManager } from './particles';
import { sound } from './audio';
import { DialogueManager } from './dialogue';
import { GravityFieldManager } from './gravity';
import { ForgeSentinelBoss } from './boss';
import { CryoManager } from './freeze';
import { CryoArchonBoss } from './cryoBoss';
import { SlipstreamManager } from './slipstream';
import { NemesisRivalBoss } from './nemesisBoss';
import { ApexPrimeBoss } from './apexPrimeBoss';

class ChronoshiftGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameStateManager;
  private playerCtrl: PlayerController;
  private hazardDirector: HazardDirector;
  private vfx: VFXManager;
  private dialogue: DialogueManager;
  private gravityField: GravityFieldManager;
  private boss: ForgeSentinelBoss;
  private cryo: CryoManager;
  private cryoBoss: CryoArchonBoss;
  private slipstream: SlipstreamManager;
  private nemesisBoss: NemesisRivalBoss;
  private apexPrime: ApexPrimeBoss;

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
  private currentTrackedWave = 1;
  private selectedSector: 1 | 2 | 3 | 4 | 5 = 1;
  private hasBossSpawnedThisRun = false;

  // DOM Elements
  private hudScore: HTMLElement;
  private hudHigh: HTMLElement;
  private hudWave: HTMLElement;
  private hudSector: HTMLElement;
  private hudMultiplier: HTMLElement;
  private hudComboBar: HTMLElement;
  private hudHealth: HTMLElement;
  private meterChrono: HTMLElement;
  private meterEmp: HTMLElement;
  private meterFrost: HTMLElement;
  private containerFrost: HTMLElement;
  private meterHyper: HTMLElement;
  private containerHyper: HTMLElement;
  private overlay: HTMLElement;
  private overlayTitle: HTMLElement;
  private overlaySubtitle: HTMLElement;
  private startBtn: HTMLButtonElement;
  private sector1Btn: HTMLButtonElement;
  private sector2Btn: HTMLButtonElement;
  private sector3Btn: HTMLButtonElement;
  private sector4Btn: HTMLButtonElement;
  private sector5Btn: HTMLButtonElement;

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
    this.dialogue = new DialogueManager();
    this.gravityField = new GravityFieldManager();
    this.boss = new ForgeSentinelBoss();
    this.cryo = new CryoManager();
    this.cryoBoss = new CryoArchonBoss();
    this.slipstream = new SlipstreamManager();
    this.nemesisBoss = new NemesisRivalBoss();
    this.apexPrime = new ApexPrimeBoss();

    // Bind DOM
    this.hudScore = document.getElementById('hud-score')!;
    this.hudHigh = document.getElementById('hud-high')!;
    this.hudWave = document.getElementById('hud-wave')!;
    this.hudSector = document.getElementById('hud-sector')!;
    this.hudMultiplier = document.getElementById('hud-multiplier')!;
    this.hudComboBar = document.getElementById('hud-combo-bar')!;
    this.hudHealth = document.getElementById('hud-health')!;
    this.meterChrono = document.getElementById('meter-chrono')!;
    this.meterEmp = document.getElementById('meter-emp')!;
    this.meterFrost = document.getElementById('meter-frost')!;
    this.containerFrost = document.getElementById('container-frost')!;
    this.meterHyper = document.getElementById('meter-hyper')!;
    this.containerHyper = document.getElementById('container-hyperdrive')!;
    this.overlay = document.getElementById('overlay')!;
    this.overlayTitle = document.getElementById('overlay-title')!;
    this.overlaySubtitle = document.getElementById('overlay-subtitle')!;
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.sector1Btn = document.getElementById('sector-1-btn') as HTMLButtonElement;
    this.sector2Btn = document.getElementById('sector-2-btn') as HTMLButtonElement;
    this.sector3Btn = document.getElementById('sector-3-btn') as HTMLButtonElement;
    this.sector4Btn = document.getElementById('sector-4-btn') as HTMLButtonElement;
    this.sector5Btn = document.getElementById('sector-5-btn') as HTMLButtonElement;

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
      if (code === 'KeyM') {
        const isMuted = sound.toggleMute();
        this.vfx.spawnFloatingText(
          isMuted ? 'AUDIO: MUTED' : 'AUDIO: ON',
          this.playerCtrl.player.pos,
          '#ffaa00',
          1.1
        );
      }
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

    // Pointer controls
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

    // Touch controls
    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.input.pointerPos.x = (touch.clientX - rect.left) * scaleX;
        this.input.pointerPos.y = (touch.clientY - rect.top) * scaleY;
        this.input.isPointerActive = true;

        if (e.touches.length >= 2) {
          this.input.chrono = true;
        } else {
          this.input.chrono = false;
        }
      }
    };

    this.canvas.addEventListener('touchstart', (e) => {
      handleTouch(e);
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      handleTouch(e);
      e.preventDefault();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        this.input.isPointerActive = false;
        this.input.chrono = false;
      }
    });

    // Touch buttons & HUD audio
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = sound.toggleMute();
        muteBtn.innerText = isMuted ? '🔇 MUTED' : '🔊 AUDIO [M]';
      });
    }

    const touchChronoBtn = document.getElementById('touch-chrono-btn');
    if (touchChronoBtn) {
      touchChronoBtn.addEventListener('touchstart', (e) => {
        this.input.chrono = true;
        e.preventDefault();
      });
      touchChronoBtn.addEventListener('touchend', (e) => {
        this.input.chrono = false;
        e.preventDefault();
      });
    }

    const touchEmpBtn = document.getElementById('touch-emp-btn');
    if (touchEmpBtn) {
      touchEmpBtn.addEventListener('touchstart', (e) => {
        this.input.triggerEmp = true;
        e.preventDefault();
      });
      touchEmpBtn.addEventListener('touchend', (e) => {
        this.input.triggerEmp = false;
        e.preventDefault();
      });
    }

    // Sector Selection Buttons
    const updateSectorButtons = () => {
      this.sector1Btn.classList.toggle('sector-btn-active', this.selectedSector === 1);
      this.sector2Btn.classList.toggle('sector-btn-active', this.selectedSector === 2);
      this.sector3Btn.classList.toggle('sector-btn-active', this.selectedSector === 3);
      this.sector4Btn.classList.toggle('sector-btn-active', this.selectedSector === 4);
      this.sector5Btn.classList.toggle('sector-btn-active', this.selectedSector === 5);
    };

    if (this.sector1Btn && this.sector2Btn && this.sector3Btn && this.sector4Btn && this.sector5Btn) {
      this.sector1Btn.addEventListener('click', () => {
        this.selectedSector = 1;
        updateSectorButtons();
      });

      this.sector2Btn.addEventListener('click', () => {
        this.selectedSector = 2;
        updateSectorButtons();
      });

      this.sector3Btn.addEventListener('click', () => {
        this.selectedSector = 3;
        updateSectorButtons();
      });

      this.sector4Btn.addEventListener('click', () => {
        this.selectedSector = 4;
        updateSectorButtons();
      });

      this.sector5Btn.addEventListener('click', () => {
        this.selectedSector = 5;
        updateSectorButtons();
      });
    }

    this.startBtn.addEventListener('click', () => {
      this.startGame();
    });
  }

  private startGame(): void {
    this.state.resetGame(this.selectedSector);
    this.currentTrackedWave = 1;
    this.hasBossSpawnedThisRun = false;
    this.playerCtrl.reset(this.canvas.width * 0.5, this.canvas.height * 0.5);
    this.hazardDirector.reset();
    this.dialogue.clear();
    this.gravityField.reset();
    this.cryo.reset();
    this.slipstream.reset();
    this.boss.active = false;
    this.cryoBoss.active = false;
    this.nemesisBoss.active = false;
    this.apexPrime.active = false;
    this.overlay.style.display = 'none';

    // Sector specifics
    if (this.selectedSector === 5) {
      this.containerFrost.style.display = 'flex';
      this.containerHyper.style.display = 'flex';
      this.dialogue.queueScript('SECTOR5_CORE_START');
      this.gravityField.spawnWell(480, 260, 200, 22, 240, 1.3);
      this.slipstream.spawnWormholePair(180, 240, 780, 360);
      this.apexPrime.spawn(480, 170);
      this.dialogue.queueScript('APEX_PRIME_SPAWN');
      this.hasBossSpawnedThisRun = true;
      sound.setWaveTempo(1, true);
    } else if (this.selectedSector === 4) {
      this.containerFrost.style.display = 'none';
      this.containerHyper.style.display = 'flex';
      this.dialogue.queueScript('SECTOR4_STREAM_START');
      this.slipstream.spawnWormholePair(220, 240, 740, 360);
      sound.setWaveTempo(1, true);
    } else if (this.selectedSector === 3) {
      this.containerFrost.style.display = 'flex';
      this.containerHyper.style.display = 'none';
      this.dialogue.queueScript('SECTOR3_NULL_START');
      sound.setWaveTempo(1, false);
    } else if (this.selectedSector === 2) {
      this.containerFrost.style.display = 'none';
      this.containerHyper.style.display = 'none';
      this.gravityField.spawnWell(480, 320, 260, 24, 280, 1.4);
      this.dialogue.queueScript('SECTOR2_FOUNDRY_START');
      sound.setWaveTempo(1, false);
    } else {
      this.containerFrost.style.display = 'none';
      this.containerHyper.style.display = 'none';
      this.dialogue.queueScript('SECTOR1_START');
      sound.setWaveTempo(1, false);
    }

    sound.startBGM();
  }

  private gameOver(): void {
    this.state.setMode('GAMEOVER');
    sound.stopBGM();

    const { score, wave, grazeCount, empUsedCount } = this.state.stats;
    let rank = 'C';
    if (score > 100000 || this.state.campaignCompleted) rank = 'CHRONO MASTER (SSS)';
    else if (score > 60000) rank = 'SSS';
    else if (score > 35000) rank = 'S';
    else if (score > 18000) rank = 'A';
    else if (score > 8000) rank = 'B';

    const sectorNames = {
      1: '01 // PERIMETER',
      2: '02 // FOUNDRY',
      3: '03 // NULL ZONE',
      4: '04 // SLIPSTREAM',
      5: '05 // SINGULARITY CORE'
    };

    const sectorColors = {
      1: '#00f3ff',
      2: '#ff6600',
      3: '#74ebd5',
      4: '#facc15',
      5: '#ff00aa'
    };

    if (this.state.campaignCompleted) {
      this.overlayTitle.innerText = 'CAMPAIGN CONQUERED';
      this.overlayTitle.style.color = '#00ff88';
      this.overlaySubtitle.innerHTML = `
        <div style="font-size: 28px; color: #facc15; margin-bottom: 8px;">RANK: ${rank}</div>
        THE WEFT STABILIZED | TIMELINE RESTORED<br/>
        FINAL SCORE: ${score.toLocaleString()} | GRAZES: ${grazeCount} | EMPS: ${empUsedCount}
      `;
      this.startBtn.innerText = 'PLAY AGAIN';
    } else {
      this.overlayTitle.innerText = 'MISSION FAILED';
      this.overlayTitle.style.color = '#00f3ff';
      this.overlaySubtitle.innerHTML = `
        <div style="font-size: 26px; color: ${sectorColors[this.selectedSector]}; margin-bottom: 8px;">RANK: ${rank}</div>
        SECTOR ${sectorNames[this.selectedSector]} | SCORE: ${score.toLocaleString()}<br/>
        WAVE: ${wave} | GRAZES: ${grazeCount} | EMPS: ${empUsedCount}
      `;
      this.startBtn.innerText = 'RESTART OPERATION';
    }

    this.overlay.style.display = 'flex';
  }

  private updateHUD(): void {
    const { stats, currentSector } = this.state;
    const { player } = this.playerCtrl;

    this.hudScore.innerText = stats.score.toLocaleString();
    this.hudHigh.innerText = stats.highScore.toLocaleString();
    this.hudWave.innerText = stats.wave.toString();

    if (currentSector === 5) {
      this.hudSector.innerText = '05 // CORE';
      this.hudSector.style.color = '#ff00aa';
    } else if (currentSector === 4) {
      this.hudSector.innerText = '04 // SLIPSTREAM';
      this.hudSector.style.color = '#facc15';
    } else if (currentSector === 3) {
      this.hudSector.innerText = '03 // NULL ZONE';
      this.hudSector.style.color = '#74ebd5';
    } else if (currentSector === 2) {
      this.hudSector.innerText = '02 // FOUNDRY';
      this.hudSector.style.color = '#ff6600';
    } else {
      this.hudSector.innerText = '01 // PERIMETER';
      this.hudSector.style.color = '#00f3ff';
    }

    this.hudMultiplier.innerText = `${stats.multiplier}x MULTIPLIER`;
    if (stats.comboCount > 0) {
      const pct = Math.round((stats.comboTimer / this.state.config.comboDuration) * 100);
      this.hudComboBar.innerText = `COMBO x${stats.comboCount} (${pct}%)`;
    } else {
      this.hudComboBar.innerText = 'GRAZE HAZARDS TO COMBO';
    }

    const hearts = '♥'.repeat(Math.max(0, player.health)) + '♡'.repeat(Math.max(0, player.maxHealth - player.health));
    this.hudHealth.innerText = hearts;

    const chronoPct = Math.round((player.chronoEnergy / player.maxChronoEnergy) * 100);
    this.meterChrono.style.width = `${chronoPct}%`;

    const empPct = Math.round((player.empEnergy / player.maxEmpEnergy) * 100);
    this.meterEmp.style.width = `${empPct}%`;
    if (player.empReady) {
      this.meterEmp.style.boxShadow = '0 0 10px #ff0055';
    } else {
      this.meterEmp.style.boxShadow = 'none';
    }

    if (currentSector === 3 || currentSector === 5) {
      this.meterFrost.style.width = `${Math.round(player.frostLevel)}%`;
      if (player.isFrozenStiff) {
        this.meterFrost.style.boxShadow = '0 0 12px #ffffff';
      } else {
        this.meterFrost.style.boxShadow = '0 0 8px #74ebd5';
      }
    }

    if (currentSector === 4 || currentSector === 5) {
      this.meterHyper.style.width = `${Math.round(this.slipstream.hyperDriveCharge)}%`;
      if (this.slipstream.isSuperluminal) {
        this.meterHyper.style.boxShadow = '0 0 16px #facc15';
      } else {
        this.meterHyper.style.boxShadow = '0 0 8px #a855f7';
      }
    }
  }

  private loop(timestamp: number): void {
    if (!this.lastTime) this.lastTime = timestamp;
    const rawDt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    if (this.state.mode === 'PLAYING') {
      const bounds = { width: this.canvas.width, height: this.canvas.height };

      // Apply Gravity pull in Sector 2 and Sector 5
      if (this.state.currentSector === 2 || this.state.currentSector === 5) {
        const { newVel, insideEventHorizon } = this.gravityField.applyToBody(
          this.playerCtrl.player.pos,
          this.playerCtrl.player.vel,
          rawDt,
          0.85
        );
        this.playerCtrl.player.vel = newVel;

        if (insideEventHorizon) {
          const isDead = this.playerCtrl.takeHit(this.vfx, sound);
          this.vfx.spawnFloatingText('SINGULARITY SHEARING!', this.playerCtrl.player.pos, '#ff5500', 1.4);
          if (isDead) {
            this.gameOver();
            return;
          }
        }
      }

      // Update Player & get Time Scale
      const isSubZero = this.state.currentSector === 3 || (this.state.currentSector === 5 && this.apexPrime.phase === 2);
      const isSector4Or5 = this.state.currentSector === 4 || this.state.currentSector === 5;
      const { timeScale, empTriggered } = this.playerCtrl.update(
        rawDt,
        this.input,
        bounds,
        this.vfx,
        sound,
        isSubZero
      );

      // Freeze Pulse Trigger when Chronoshift active
      if (isSubZero && this.playerCtrl.player.isChronoActive) {
        const targets = this.hazardDirector.hazards.map((h) => ({ pos: h.pos, radius: h.radius, id: h.id }));
        const frozenIds = this.cryo.triggerFreezePulse(this.playerCtrl.player.pos, 150, targets, this.vfx);
        if (frozenIds.length > 0) {
          const frozenSet = new Set(frozenIds);
          this.hazardDirector.hazards = this.hazardDirector.hazards.filter((h) => !frozenSet.has(h.id));
        }
      }

      // Slipstream & Wormhole Teleport in Sector 4 and Sector 5
      if (isSector4Or5) {
        const slipResult = this.slipstream.update(
          rawDt * timeScale,
          rawDt,
          this.playerCtrl.player.pos,
          this.playerCtrl.player.vel,
          this.playerCtrl.player.radius,
          this.vfx,
          sound
        );

        if (slipResult.teleported && slipResult.teleportExitPos && slipResult.teleportExitVel) {
          this.playerCtrl.player.pos = slipResult.teleportExitPos;
          this.playerCtrl.player.vel = slipResult.teleportExitVel;
          this.vfx.spawnFloatingText('BLACK HOLE ➔ WHITE HOLE!', this.playerCtrl.player.pos, '#facc15', 1.5);
        }

        if (slipResult.gatePassedCount > 0) {
          this.state.addScore(1500 * slipResult.gatePassedCount);
          sound.playWarpGate();
        }

        // If in Superluminal Warp, minor hazards are pulverized
        if (this.slipstream.isSuperluminal) {
          for (let i = this.hazardDirector.hazards.length - 1; i >= 0; i--) {
            const h = this.hazardDirector.hazards[i];
            const dist = Math.hypot(this.playerCtrl.player.pos.x - h.pos.x, this.playerCtrl.player.pos.y - h.pos.y);
            if (dist <= this.playerCtrl.player.radius + h.radius + 15) {
              this.hazardDirector.hazards.splice(i, 1);
              this.state.addScore(800);
              this.vfx.spawnShockwave(h.pos, 60, '#facc15', 4);
              this.vfx.spawnSparks(h.pos, 14, '#facc15', 200);
            }
          }
        }
      }

      if (empTriggered) {
        this.state.recordEmpActivation();
        const destroyed = this.hazardDirector.destroyAllHazards(this.vfx, sound);
        if (destroyed > 0) {
          const bonus = this.state.addScore(destroyed * 800);
          this.vfx.spawnFloatingText(`EMP PURGE +${bonus}!`, this.playerCtrl.player.pos, '#ff00aa', 1.4);
        }

        // Shatter frozen crystal shards
        if (isSubZero || this.state.currentSector === 5) {
          const { count, totalScore } = this.cryo.shatterAt(
            this.playerCtrl.player.pos,
            Math.max(bounds.width, bounds.height),
            this.vfx,
            sound
          );
          if (count > 0) {
            this.state.addScore(totalScore);
            this.vfx.spawnFloatingText(`SHATTER CASCADE x${count}! +${totalScore}`, this.playerCtrl.player.pos, '#74ebd5', 1.8);
            if (this.apexPrime.active) {
              this.apexPrime.damage(count * 80, this.playerCtrl.player.pos, this.vfx, sound, true);
            }
          }
        }

        // Damage Bosses with EMP
        if (this.boss.active) {
          const bossKilled = this.boss.damage(380, this.vfx, sound);
          if (bossKilled) {
            this.state.addScore(30000);
            this.dialogue.queueScript('BOSS_DEFEATED');
            this.vfx.spawnFloatingText('A.P.E.X. SENTINEL PURGED! +30,000', this.boss.pos, '#00f3ff', 2.0);
          }
        }

        if (this.cryoBoss.active) {
          const cryoKilled = this.cryoBoss.damage(420, this.vfx, sound);
          if (cryoKilled) {
            this.state.addScore(40000);
            this.dialogue.queueScript('CRYO_BOSS_DEFEATED');
            this.vfx.spawnFloatingText('CRYO-ARCHON SHATTERED! +40,000', this.cryoBoss.pos, '#74ebd5', 2.2);
          }
        }

        if (this.nemesisBoss.active) {
          const nemesisKilled = this.nemesisBoss.damage(450, this.vfx, sound);
          if (nemesisKilled) {
            this.state.addScore(50000);
            this.dialogue.queueScript('NEMESIS_DEFEATED');
            this.vfx.spawnFloatingText('NEMESIS-00 OBLITERATED! +50,000', this.nemesisBoss.pos, '#facc15', 2.4);
          }
        }

        if (this.apexPrime.active) {
          const apexKilled = this.apexPrime.damage(420, this.playerCtrl.player.pos, this.vfx, sound);
          if (apexKilled) {
            this.state.addScore(100000);
            this.state.campaignCompleted = true;
            this.dialogue.queueScript('APEX_PRIME_DEFEATED');
            this.vfx.spawnFloatingText('A.P.E.X. PRIME DESTROYED! +100,000', this.apexPrime.pos, '#ffffff', 2.5);
            setTimeout(() => this.gameOver(), 5000);
          }
        }
      }

      // Scaled dt for world
      const scaledDt = rawDt * timeScale;
      this.state.update(scaledDt);

      // Boss Spawning checks
      if (this.state.currentSector === 2 && this.state.stats.wave >= 2 && !this.hasBossSpawnedThisRun) {
        this.hasBossSpawnedThisRun = true;
        this.boss.spawn(480, 180);
        this.dialogue.queueScript('BOSS_SPAWN');
        this.vfx.triggerScreenShake(20, 0.7);
        this.vfx.spawnShockwave(this.boss.pos, 350, '#ff0055', 8);
      }

      if (this.state.currentSector === 3 && this.state.stats.wave >= 2 && !this.hasBossSpawnedThisRun) {
        this.hasBossSpawnedThisRun = true;
        this.cryoBoss.spawn(480, 190);
        this.dialogue.queueScript('CRYO_BOSS_SPAWN');
        this.vfx.triggerScreenShake(22, 0.75);
        this.vfx.spawnShockwave(this.cryoBoss.pos, 360, '#74ebd5', 9);
      }

      if (this.state.currentSector === 4 && this.state.stats.wave >= 2 && !this.hasBossSpawnedThisRun) {
        this.hasBossSpawnedThisRun = true;
        this.nemesisBoss.spawn(480, 140);
        this.dialogue.queueScript('NEMESIS_SPAWN');
        this.vfx.triggerScreenShake(24, 0.8);
        this.vfx.spawnShockwave(this.nemesisBoss.pos, 380, '#facc15', 10);
      }

      // Environmental physics updates
      if (this.state.currentSector === 2 || this.state.currentSector === 5) {
        this.gravityField.update(scaledDt);
      }

      if (this.state.currentSector === 3 || this.state.currentSector === 5) {
        this.cryo.update(scaledDt, this.vfx);
      }

      // Wave advancement check
      if (this.state.stats.wave > this.currentTrackedWave) {
        this.currentTrackedWave = this.state.stats.wave;
        sound.playWaveAdvance();
        sound.setWaveTempo(this.currentTrackedWave, isSector4Or5);
        const waveColor = this.state.currentSector === 5 ? '#ff00aa' : isSector4Or5 ? '#facc15' : this.state.currentSector === 3 ? '#74ebd5' : this.state.currentSector === 2 ? '#ff6600' : '#00f3ff';
        this.vfx.spawnFloatingText(
          `WAVE ${this.currentTrackedWave} - ENERGY CRITICAL`,
          { x: this.canvas.width * 0.5, y: this.canvas.height * 0.3 },
          waveColor,
          1.6
        );
        this.vfx.triggerScreenShake(9, 0.4);
      }

      // Update Active Bosses
      if (this.boss.active) {
        const bossResult = this.boss.update(scaledDt, rawDt, this.playerCtrl.player, this.vfx, sound, this.hazardDirector);
        for (let i = 0; i < bossResult.grazes; i++) {
          const { pointsEarned, newMultiplier } = this.state.registerGraze();
          this.playerCtrl.onGraze(
            this.state.config.grazeChronoBonus * 1.5,
            this.state.config.grazeEmpBonus * 1.5,
            this.vfx,
            sound
          );
          this.vfx.spawnFloatingText(`BLADE GRAZE +${pointsEarned}! (${newMultiplier}x)`, this.playerCtrl.player.pos, '#ffaa00', 1.1);
        }

        for (let i = 0; i < bossResult.hits; i++) {
          const isDead = this.playerCtrl.takeHit(this.vfx, sound);
          if (isDead) {
            this.gameOver();
            break;
          }
        }
      }

      if (this.cryoBoss.active) {
        const cryoResult = this.cryoBoss.update(scaledDt, rawDt, this.playerCtrl.player, this.vfx, sound, this.hazardDirector, this.cryo);
        for (let i = 0; i < cryoResult.grazes; i++) {
          const { pointsEarned, newMultiplier } = this.state.registerGraze();
          this.playerCtrl.onGraze(
            this.state.config.grazeChronoBonus * 1.5,
            this.state.config.grazeEmpBonus * 1.5,
            this.vfx,
            sound
          );
          this.vfx.spawnFloatingText(`SPIRE GRAZE +${pointsEarned}! (${newMultiplier}x)`, this.playerCtrl.player.pos, '#74ebd5', 1.1);
        }

        for (let i = 0; i < cryoResult.hits; i++) {
          const isDead = this.playerCtrl.takeHit(this.vfx, sound);
          if (isDead) {
            this.gameOver();
            break;
          }
        }
      }

      if (this.nemesisBoss.active) {
        const nemResult = this.nemesisBoss.update(
          scaledDt,
          rawDt,
          this.playerCtrl.player,
          this.playerCtrl.player.isChronoActive,
          this.slipstream.isSuperluminal,
          bounds,
          this.vfx,
          sound,
          this.hazardDirector
        );

        for (let i = 0; i < nemResult.grazes; i++) {
          const { pointsEarned, newMultiplier } = this.state.registerGraze();
          this.playerCtrl.onGraze(
            this.state.config.grazeChronoBonus * 1.8,
            this.state.config.grazeEmpBonus * 1.8,
            this.vfx,
            sound
          );
          this.vfx.spawnFloatingText(`NEMESIS GRAZE +${pointsEarned}! (${newMultiplier}x)`, this.playerCtrl.player.pos, '#facc15', 1.2);
        }

        for (let i = 0; i < nemResult.hits; i++) {
          const isDead = this.playerCtrl.takeHit(this.vfx, sound);
          if (isDead) {
            this.gameOver();
            break;
          }
        }
      }

      if (this.apexPrime.active) {
        const apexResult = this.apexPrime.update(
          scaledDt,
          rawDt,
          this.playerCtrl.player,
          this.slipstream.isSuperluminal,
          this.vfx,
          sound,
          this.hazardDirector,
          this.cryo
        );

        for (let i = 0; i < apexResult.grazes; i++) {
          const { pointsEarned, newMultiplier } = this.state.registerGraze();
          this.playerCtrl.onGraze(
            this.state.config.grazeChronoBonus * 2.0,
            this.state.config.grazeEmpBonus * 2.0,
            this.vfx,
            sound
          );
          this.vfx.spawnFloatingText(`CORE GRAZE +${pointsEarned}! (${newMultiplier}x)`, this.playerCtrl.player.pos, '#ff00aa', 1.2);
        }

        for (let i = 0; i < apexResult.hits; i++) {
          const isDead = this.playerCtrl.takeHit(this.vfx, sound);
          if (isDead) {
            this.gameOver();
            break;
          }
        }

        if (apexResult.bossKilled) {
          this.state.addScore(100000);
          this.state.campaignCompleted = true;
          this.dialogue.queueScript('APEX_PRIME_DEFEATED');
          this.vfx.spawnFloatingText('A.P.E.X. PRIME DESTROYED! +100,000', this.apexPrime.pos, '#ffffff', 2.5);
          setTimeout(() => this.gameOver(), 5000);
        }
      }

      // Update hazards & collisions
      const { hits, grazes, coresCollected, collectedPowerUps } = this.hazardDirector.update(
        scaledDt,
        rawDt,
        this.state.stats.wave,
        this.playerCtrl.player,
        bounds,
        this.vfx,
        sound
      );

      // Handle Powerups
      for (const p of collectedPowerUps) {
        if (p === 'SHIELD') {
          const healed = this.playerCtrl.heal(1);
          sound.playShieldRestored();
          this.vfx.spawnFloatingText(healed ? '+1 SHIELD RESTORED!' : 'SHIELD OVERCHARGED!', this.playerCtrl.player.pos, '#00ff88', 1.3);
        } else if (p === 'OVERDRIVE') {
          this.playerCtrl.activateOverdrive(6.0);
          this.vfx.spawnFloatingText('OVERDRIVE ACTIVE (6s)!', this.playerCtrl.player.pos, '#ff00bb', 1.5);
          this.vfx.triggerScreenShake(7, 0.3);
        } else if (p === 'NUKE') {
          this.state.recordEmpActivation();
          const destroyed = this.hazardDirector.destroyAllHazards(this.vfx, sound);
          this.state.addScore(destroyed * 1200);
          if (this.boss.active) this.boss.damage(300, this.vfx, sound);
          if (this.cryoBoss.active) this.cryoBoss.damage(350, this.vfx, sound);
          if (this.nemesisBoss.active) this.nemesisBoss.damage(400, this.vfx, sound);
          if (this.apexPrime.active) this.apexPrime.damage(450, this.playerCtrl.player.pos, this.vfx, sound);
          this.vfx.spawnFloatingText(`TACTICAL NUKE PURGE!`, this.playerCtrl.player.pos, '#ffaa00', 1.6);
        }
      }

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

    // Update Story Dialogue
    const { playBleep } = this.dialogue.update(rawDt);
    if (playBleep) {
      sound.playTransmissionBleep();
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

    // Clear background per Sector
    if (this.state.currentSector === 5) {
      this.ctx.fillStyle = '#08010c'; // Event Horizon Singularity Void
    } else if (this.state.currentSector === 4) {
      this.ctx.fillStyle = '#0a0214'; // Relativistic warp purple
    } else if (this.state.currentSector === 3) {
      this.ctx.fillStyle = '#020814'; // Glacial midnight
    } else if (this.state.currentSector === 2) {
      this.ctx.fillStyle = '#0d0402'; // Forge dark amber
    } else {
      this.ctx.fillStyle = '#03060a'; // Perimeter deep navy
    }
    this.ctx.fillRect(0, 0, width, height);

    // Grid backdrop
    this.renderGrid(width, height);

    // Render Sector Environmental Mechanics
    if (this.state.currentSector === 2 || this.state.currentSector === 5) {
      this.gravityField.render(this.ctx);
    }
    if (this.state.currentSector === 3 || this.state.currentSector === 5) {
      this.cryo.render(this.ctx);
    }
    if (this.state.currentSector === 4 || this.state.currentSector === 5) {
      this.slipstream.render(this.ctx);
    }

    // Render world entities
    this.hazardDirector.render(this.ctx);
    this.vfx.render(this.ctx);

    if (this.boss.active) {
      this.boss.render(this.ctx);
    }

    if (this.cryoBoss.active) {
      this.cryoBoss.render(this.ctx);
    }

    if (this.nemesisBoss.active) {
      this.nemesisBoss.render(this.ctx);
    }

    if (this.apexPrime.active) {
      this.apexPrime.render(this.ctx);
    }

    if (this.state.mode === 'PLAYING') {
      this.playerCtrl.render(this.ctx);
    }

    // Render Story Dialogue HUD
    this.dialogue.render(this.ctx, width, height);

    this.ctx.restore();
  }

  private renderGrid(width: number, height: number): void {
    this.ctx.save();
    const sector = this.state.currentSector;
    if (sector === 5) {
      this.ctx.strokeStyle = 'rgba(255, 0, 170, 0.09)';
    } else if (sector === 4) {
      this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
    } else if (sector === 3) {
      this.ctx.strokeStyle = 'rgba(77, 238, 234, 0.08)';
    } else if (sector === 2) {
      this.ctx.strokeStyle = 'rgba(255, 90, 0, 0.08)';
    } else {
      this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    }
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
