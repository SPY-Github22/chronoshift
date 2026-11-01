import { GameConfig, GameMode, GameStats } from './types';

const STORAGE_KEY = 'chronoshift_highscore_v1';

export const DEFAULT_CONFIG: GameConfig = {
  canvasWidth: 960,
  canvasHeight: 640,
  chronoTimeDilation: 0.22,
  chronoDrainRate: 28.0,
  chronoRechargeRate: 14.0,
  grazeChronoBonus: 8.0,
  grazeEmpBonus: 12.0,
  grazeScoreBase: 150,
  comboDuration: 3.5
};

export class GameStateManager {
  public mode: GameMode = 'MENU';
  public stats: GameStats;
  public config: GameConfig;

  constructor(customConfig?: Partial<GameConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    this.stats = {
      score: 0,
      highScore: this.loadHighScore(),
      multiplier: 1,
      comboCount: 0,
      comboTimer: 0,
      maxComboTimer: this.config.comboDuration,
      grazeCount: 0,
      empUsedCount: 0,
      survivalTime: 0,
      wave: 1
    };
  }

  public loadHighScore(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? 0 : Math.max(0, parsed);
      }
    } catch {
      // LocalStorage access might be restricted in some iframe/security contexts
    }
    return 0;
  }

  public saveHighScore(): void {
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
      try {
        localStorage.setItem(STORAGE_KEY, this.stats.highScore.toString());
      } catch {
        // Silently tolerate storage exceptions
      }
    }
  }

  public resetGame(): void {
    this.stats.score = 0;
    this.stats.multiplier = 1;
    this.stats.comboCount = 0;
    this.stats.comboTimer = 0;
    this.stats.grazeCount = 0;
    this.stats.empUsedCount = 0;
    this.stats.survivalTime = 0;
    this.stats.wave = 1;
    this.mode = 'PLAYING';
  }

  public setMode(newMode: GameMode): void {
    this.mode = newMode;
    if (newMode === 'GAMEOVER') {
      this.saveHighScore();
    }
  }

  public addScore(basePoints: number): number {
    const earned = Math.round(basePoints * this.stats.multiplier);
    this.stats.score += earned;
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }
    return earned;
  }

  public registerGraze(): { pointsEarned: number; newMultiplier: number } {
    this.stats.grazeCount++;
    this.stats.comboCount++;
    this.stats.comboTimer = this.config.comboDuration;

    // Multiplier steps: 1x -> 2x at 3 combos, 3x at 7, 4x at 12, up to 16x
    const calculatedMultiplier = Math.min(16, 1 + Math.floor(this.stats.comboCount / 4));
    this.stats.multiplier = calculatedMultiplier;

    const points = this.addScore(this.config.grazeScoreBase);
    return { pointsEarned: points, newMultiplier: this.stats.multiplier };
  }

  public recordEmpActivation(): void {
    this.stats.empUsedCount++;
  }

  public update(dt: number): void {
    if (this.mode !== 'PLAYING') return;

    this.stats.survivalTime += dt;

    // Wave advances every 20 seconds
    const targetWave = 1 + Math.floor(this.stats.survivalTime / 20);
    if (targetWave > this.stats.wave) {
      this.stats.wave = targetWave;
    }

    // Passive score for surviving
    this.stats.score += Math.round(15 * dt * this.stats.multiplier);
    if (this.stats.score > this.stats.highScore) {
      this.stats.highScore = this.stats.score;
    }

    // Combo timer decay
    if (this.stats.comboTimer > 0) {
      this.stats.comboTimer -= dt;
      if (this.stats.comboTimer <= 0) {
        this.stats.comboTimer = 0;
        this.stats.comboCount = 0;
        this.stats.multiplier = 1;
      }
    }
  }
}
