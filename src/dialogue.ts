// Cyberpunk Story Transmission and Dialogue Engine
export type DialogueSender = 'ECHO' | 'KIRA' | 'APEX';

export interface DialogueMessage {
  id: string;
  sender: DialogueSender;
  text: string;
  tag: string;
  color: string;
  duration: number;
}

export const STORY_SCRIPTS: Record<string, DialogueMessage[]> = {
  SECTOR1_START: [
    {
      id: 's1_intro_1',
      sender: 'ECHO',
      tag: 'ECHO // TACHYON RELAY',
      text: 'Pilot Kira Voss, do you read me? The temporal firewall has collapsed. We must breach Sector 1.',
      color: '#00f3ff',
      duration: 4.5
    },
    {
      id: 's1_intro_2',
      sender: 'KIRA',
      tag: 'VESPER-01 // KIRA',
      text: 'Copy Echo. Tachyon Core online. Chronoshift dilation ready on my mark.',
      color: '#00ff88',
      duration: 3.5
    }
  ],
  SECTOR2_FOUNDRY_START: [
    {
      id: 's2_intro_1',
      sender: 'ECHO',
      tag: 'ECHO // ADVISORY',
      text: 'Alert: You have entered Sector 2 — The Quantum Foundry. A.P.E.X. is forging dark matter weaponry here.',
      color: '#00f3ff',
      duration: 4.5
    },
    {
      id: 's2_intro_2',
      sender: 'ECHO',
      tag: 'ECHO // TACTICAL',
      text: 'Beware of gravitational vortexes! Inverse-square gravity will bend all ship and hazard trajectories.',
      color: '#ffaa00',
      duration: 4.5
    },
    {
      id: 's2_intro_3',
      sender: 'KIRA',
      tag: 'VESPER-01 // KIRA',
      text: 'Understood. We can use the vortex horizons to slingshot and accelerate our graze cascades.',
      color: '#00ff88',
      duration: 4.0
    }
  ],
  BOSS_SPAWN: [
    {
      id: 'boss_alert_1',
      sender: 'APEX',
      tag: 'A.P.E.X. // ENTRIC CORE',
      text: 'ORGANIC ANOMALY DETECTED. TEMPORAL DIVERGENCE WILL BE PURGED BY FORGE SENTINEL MK-II.',
      color: '#ff0055',
      duration: 5.0
    },
    {
      id: 'boss_alert_2',
      sender: 'ECHO',
      tag: 'ECHO // URGENT',
      text: 'Kira! The Sentinel is rotating twin tachyon cutters! Dilate time with Chrono-Shift and shatter its core with EMP!',
      color: '#ff00aa',
      duration: 5.0
    }
  ],
  BOSS_DEFEATED: [
    {
      id: 'boss_win_1',
      sender: 'KIRA',
      tag: 'VESPER-01 // KIRA',
      text: 'Sentinel down! The Foundry’s thermal manifold is destabilizing.',
      color: '#00ff88',
      duration: 4.0
    },
    {
      id: 'boss_win_2',
      sender: 'ECHO',
      tag: 'ECHO // NAVIGATION',
      text: 'Brilliant flying, Vanguard. Sector 2 cleared. Coordinates for Sector 3 — The Sub-Zero Null Zone — locked.',
      color: '#00f3ff',
      duration: 5.0
    }
  ],
  SECTOR3_NULL_START: [
    {
      id: 's3_intro_1',
      sender: 'ECHO',
      tag: 'ECHO // CRYOGENIC ALERT',
      text: 'Vanguard, temperatures dropping to 0 Kelvin. Welcome to Sector 3: The Sub-Zero Null Zone.',
      color: '#4deeea',
      duration: 4.5
    },
    {
      id: 's3_intro_2',
      sender: 'ECHO',
      tag: 'ECHO // TACTICAL',
      text: 'Chrono-Shift will flash-freeze incoming projectiles into crystal shards! Shatter them with EMP for explosive cascade combos!',
      color: '#74ebd5',
      duration: 5.0
    },
    {
      id: 's3_intro_3',
      sender: 'KIRA',
      tag: 'VESPER-01 // KIRA',
      text: 'Copy that. Keeping thrusters at high velocity to melt the frost. Let us break the ice.',
      color: '#00ff88',
      duration: 4.0
    }
  ],
  CRYO_BOSS_SPAWN: [
    {
      id: 'cryo_alert_1',
      sender: 'APEX',
      tag: 'A.P.E.X. // STASIS CORE',
      text: 'ENTROPIC EQUILIBRIUM MANDATES COMPLETE COLD. CRYO-ARCHON GLACIEX-09 DEPLOYED.',
      color: '#ffffff',
      duration: 5.0
    },
    {
      id: 'cryo_alert_2',
      sender: 'ECHO',
      tag: 'ECHO // PRIORITY',
      text: 'Kira! Glaciex is spinning refraction spires! Freeze its frost crystals and shatter them back into its armor!',
      color: '#4deeea',
      duration: 5.0
    }
  ],
  CRYO_BOSS_DEFEATED: [
    {
      id: 'cryo_win_1',
      sender: 'KIRA',
      tag: 'VESPER-01 // KIRA',
      text: 'Cryo-Archon shattered into dust! The Null Zone thermal locks are blowing wide open!',
      color: '#00ff88',
      duration: 4.5
    },
    {
      id: 'cryo_win_2',
      sender: 'ECHO',
      tag: 'ECHO // VICTORY',
      text: 'Sector 3 conquered! Sub-Zero stasis broken. The timeline pathway to Sector 4 is clear!',
      color: '#74ebd5',
      duration: 5.0
    }
  ]
};

export class DialogueManager {
  private queue: DialogueMessage[] = [];
  public currentMessage: DialogueMessage | null = null;
  private messageTimer = 0;
  private displayedCharCount = 0;
  private charTickTimer = 0;
  private isTransmissionBleepPending = false;

  public queueScript(scriptKey: string): void {
    const script = STORY_SCRIPTS[scriptKey];
    if (script) {
      for (const msg of script) {
        this.queue.push({ ...msg });
      }
    }
  }

  public queueSingle(msg: DialogueMessage): void {
    this.queue.push({ ...msg });
  }

  public clear(): void {
    this.queue = [];
    this.currentMessage = null;
    this.messageTimer = 0;
    this.displayedCharCount = 0;
  }

  public update(dt: number): { playBleep: boolean } {
    let playBleep = false;

    if (!this.currentMessage && this.queue.length > 0) {
      this.currentMessage = this.queue.shift()!;
      this.messageTimer = this.currentMessage.duration;
      this.displayedCharCount = 0;
      this.charTickTimer = 0;
      this.isTransmissionBleepPending = true;
      playBleep = true;
    }

    if (this.currentMessage) {
      // Typewriter character progression
      this.charTickTimer += dt;
      if (this.charTickTimer >= 0.025) {
        this.charTickTimer = 0;
        if (this.displayedCharCount < this.currentMessage.text.length) {
          this.displayedCharCount++;
        }
      }

      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.currentMessage = null;
        this.displayedCharCount = 0;
      }
    }

    if (this.isTransmissionBleepPending) {
      this.isTransmissionBleepPending = false;
      playBleep = true;
    }

    return { playBleep };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.currentMessage) return;

    ctx.save();

    const boxWidth = Math.min(width - 60, 680);
    const boxHeight = 72;
    const boxX = (width - boxWidth) * 0.5;
    const boxY = height - boxHeight - 20;

    // Cyberpunk holographic panel backing
    ctx.fillStyle = 'rgba(3, 10, 18, 0.88)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Border glow
    ctx.strokeStyle = this.currentMessage.color;
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.currentMessage.color;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Speaker tag & transmission line
    ctx.fillStyle = this.currentMessage.color;
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.shadowBlur = 4;
    ctx.fillText(`▶ ${this.currentMessage.tag}`, boxX + 16, boxY + 22);

    // Typewriter message body
    const visibleText = this.currentMessage.text.substring(0, this.displayedCharCount);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px "Courier New", monospace';
    ctx.shadowBlur = 0;

    // Wrap text into two lines if needed
    if (visibleText.length > 68) {
      const splitIdx = visibleText.lastIndexOf(' ', 68);
      const line1 = visibleText.substring(0, splitIdx > 0 ? splitIdx : 68);
      const line2 = visibleText.substring(splitIdx > 0 ? splitIdx + 1 : 68);
      ctx.fillText(line1, boxX + 16, boxY + 42);
      ctx.fillText(line2, boxX + 16, boxY + 58);
    } else {
      ctx.fillText(visibleText, boxX + 16, boxY + 46);
    }

    // Audio frequency waveform indicator icon in corner
    const waveX = boxX + boxWidth - 36;
    const waveY = boxY + 16;
    ctx.strokeStyle = this.currentMessage.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const h = Math.sin(Date.now() * 0.01 + i) * 6 + 6;
      ctx.moveTo(waveX + i * 5, waveY + 8 - h * 0.5);
      ctx.lineTo(waveX + i * 5, waveY + 8 + h * 0.5);
    }
    ctx.stroke();

    ctx.restore();
  }
}
