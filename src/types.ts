export interface Vector2D {
  x: number;
  y: number;
}

export type GameMode = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface Player {
  pos: Vector2D;
  vel: Vector2D;
  speed: number;
  radius: number;
  grazeRadius: number;
  health: number;
  maxHealth: number;
  chronoEnergy: number;
  maxChronoEnergy: number;
  isChronoActive: boolean;
  empEnergy: number;
  maxEmpEnergy: number;
  empReady: boolean;
  invulnerableTimer: number;
  thrustTrailTimer: number;
  overdriveTimer: number;
  frostLevel: number;
  isFrozenStiff: boolean;
}

export type HazardType = 'ORB' | 'LASER' | 'SEEKER' | 'PULSAR';

export interface BaseHazard {
  id: number;
  type: HazardType;
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  color: string;
  hasGrazed: boolean;
  markedForRemoval: boolean;
}

export interface OrbHazard extends BaseHazard {
  type: 'ORB';
  bounceCount: number;
  maxBounces: number;
}

export interface LaserHazard extends BaseHazard {
  type: 'LASER';
  p1: Vector2D;
  p2: Vector2D;
  width: number;
  warmUpTimer: number;
  totalWarmUp: number;
  activeTimer: number;
  totalActive: number;
  angle: number;
  rotationSpeed: number;
}

export interface SeekerHazard extends BaseHazard {
  type: 'SEEKER';
  turnRate: number;
  currentSpeed: number;
  maxSpeed: number;
  lifetime: number;
}

export interface PulsarHazard extends BaseHazard {
  type: 'PULSAR';
  currentRadius: number;
  maxRadius: number;
  growthRate: number;
  thickness: number;
}

export type Hazard = OrbHazard | LaserHazard | SeekerHazard | PulsarHazard;

export interface EnergyCore {
  id: number;
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  pulsePhase: number;
  value: number;
  markedForRemoval: boolean;
}

export type PowerUpType = 'SHIELD' | 'OVERDRIVE' | 'NUKE';

export interface PowerUpItem {
  id: number;
  type: PowerUpType;
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  pulsePhase: number;
  duration: number;
  markedForRemoval: boolean;
}

export interface Particle {
  pos: Vector2D;
  vel: Vector2D;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  glow: boolean;
  active: boolean;
}

export interface Shockwave {
  pos: Vector2D;
  radius: number;
  maxRadius: number;
  expansionRate: number;
  color: string;
  alpha: number;
  thickness: number;
  active: boolean;
}

export interface FloatingText {
  id: number;
  text: string;
  pos: Vector2D;
  vel: Vector2D;
  color: string;
  alpha: number;
  scale: number;
  lifetime: number;
  maxLifetime: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  multiplier: number;
  comboCount: number;
  comboTimer: number;
  maxComboTimer: number;
  grazeCount: number;
  empUsedCount: number;
  survivalTime: number;
  wave: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  chrono: boolean;
  triggerEmp: boolean;
  pointerPos: Vector2D;
  isPointerActive: boolean;
}

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  chronoTimeDilation: number;
  chronoDrainRate: number;
  chronoRechargeRate: number;
  grazeChronoBonus: number;
  grazeEmpBonus: number;
  grazeScoreBase: number;
  comboDuration: number;
}
