// Web Audio API procedural sound synthesizer and dynamic synthwave music engine
// 100% self-contained, zero external asset dependencies
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;

  // BGM Engine
  private isBgmRunning = false;
  private bgmMasterGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private currentStep = 0;
  private stepIntervalId: number | null = null;
  private tempoBpm = 124;

  // Pentatonic Cyberpunk Scale (Hz)
  private bassNotes = [110, 110, 130.81, 110, 146.83, 110, 164.81, 130.81];
  private leadNotes = [440, 523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25];

  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmMasterGain && this.ctx) {
      this.bgmMasterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public startBGM(): void {
    if (this.isBgmRunning) return;
    const ctx = this.initContext();
    if (!ctx) return;

    this.isBgmRunning = true;
    this.bgmMasterGain = ctx.createGain();
    this.bgmMasterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, ctx.currentTime);

    this.bgmFilter = ctx.createBiquadFilter();
    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.setValueAtTime(3200, ctx.currentTime);

    this.bgmFilter.connect(this.bgmMasterGain);
    this.bgmMasterGain.connect(ctx.destination);

    this.scheduleNextStep();
  }

  public stopBGM(): void {
    this.isBgmRunning = false;
    if (this.stepIntervalId !== null) {
      clearTimeout(this.stepIntervalId);
      this.stepIntervalId = null;
    }
  }

  public setDilationFilter(isSlowMo: boolean): void {
    if (!this.bgmFilter || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (isSlowMo) {
      this.bgmFilter.frequency.cancelScheduledValues(now);
      this.bgmFilter.frequency.exponentialRampToValueAtTime(320, now + 0.15);
    } else {
      this.bgmFilter.frequency.cancelScheduledValues(now);
      this.bgmFilter.frequency.exponentialRampToValueAtTime(3200, now + 0.2);
    }
  }

  public setWaveTempo(wave: number): void {
    this.tempoBpm = Math.min(150, 120 + wave * 3);
  }

  private scheduleNextStep(): void {
    if (!this.isBgmRunning || !this.ctx) return;

    const stepDurationMs = (60 / this.tempoBpm / 4) * 1000;
    this.playStep(this.currentStep);
    this.currentStep = (this.currentStep + 1) % 16;

    this.stepIntervalId = window.setTimeout(() => {
      this.scheduleNextStep();
    }, stepDurationMs);
  }

  private playStep(step: number): void {
    if (this.isMuted || !this.ctx || !this.bgmFilter) return;
    const now = this.ctx.currentTime;

    // 1. Kick on every beat (steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(140, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

      kickGain.gain.setValueAtTime(0.4, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      kickOsc.connect(kickGain);
      kickGain.connect(this.bgmFilter);
      kickOsc.start(now);
      kickOsc.stop(now + 0.15);
    }

    // 2. Hi-hat on offbeats (steps 2, 6, 10, 14)
    if (step % 4 === 2) {
      this.playSynthHiHat(now);
    }

    // 3. Synth Bassline
    const bassNote = this.bassNotes[step % this.bassNotes.length];
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassNote, now);

    bassGain.gain.setValueAtTime(0.2, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    bassOsc.connect(bassGain);
    bassGain.connect(this.bgmFilter);
    bassOsc.start(now);
    bassOsc.stop(now + 0.11);

    // 4. Synth Melody Arpeggio (every other step)
    if (step % 2 === 0) {
      const leadNote = this.leadNotes[(step / 2) % this.leadNotes.length];
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.setValueAtTime(leadNote, now);

      leadGain.gain.setValueAtTime(0.06, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      leadOsc.connect(leadGain);
      leadGain.connect(this.bgmFilter);
      leadOsc.start(now);
      leadOsc.stop(now + 0.13);
    }
  }

  private playSynthHiHat(time: number): void {
    if (!this.ctx || !this.bgmFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, time);
    gain.gain.setValueAtTime(0.04, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(gain);
    gain.connect(this.bgmFilter);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  public playChronoShift(active: boolean): void {
    this.setDilationFilter(active);
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    filter.type = 'lowpass';

    const now = ctx.currentTime;
    if (active) {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(250, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    } else {
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.2);
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playGraze(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playEmpBlast(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.5);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);

    this.playNoise(0.4, 0.2, 800);
  }

  public playExplosion(): void {
    if (this.isMuted) return;
    this.playNoise(0.35, 0.25, 450);
  }

  public playLaserTelegraph(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1400, now + 0.3);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playTransmissionBleep(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.setValueAtTime(1800, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHit(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playWaveAdvance(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.2);
    });
  }

  public playShieldRestored(): void {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.22);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  private playNoise(duration: number, volume: number, filterFreq: number): void {
    const ctx = this.initContext();
    if (!ctx) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }
}

export const sound = new SoundEngine();
