import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager } from './state';

describe('GameStateManager & Scoring Engine', () => {
  let state: GameStateManager;

  beforeEach(() => {
    state = new GameStateManager();
    state.resetGame(1);
  });

  it('initializes with clean default values in Sector 1', () => {
    expect(state.currentSector).toBe(1);
    expect(state.stats.score).toBe(0);
    expect(state.stats.multiplier).toBe(1);
    expect(state.stats.comboCount).toBe(0);
    expect(state.stats.wave).toBe(1);
    expect(state.mode).toBe('PLAYING');
  });

  it('scales score multipliers dynamically with consecutive grazes up to 16x', () => {
    // 0 grazes -> 1x
    expect(state.stats.multiplier).toBe(1);

    // 4 grazes -> 2x (1 + floor(4/4))
    for (let i = 0; i < 4; i++) {
      state.registerGraze();
    }
    expect(state.stats.multiplier).toBe(2);

    // 12 grazes -> 4x (1 + floor(12/4))
    for (let i = 0; i < 8; i++) {
      state.registerGraze();
    }
    expect(state.stats.multiplier).toBe(4);

    // 64 grazes -> clamped at 16x
    for (let i = 0; i < 60; i++) {
      state.registerGraze();
    }
    expect(state.stats.multiplier).toBe(16);
  });

  it('decays combo timer and resets multiplier when time expires', () => {
    state.registerGraze();
    state.registerGraze();
    expect(state.stats.comboCount).toBe(2);
    expect(state.stats.comboTimer).toBeGreaterThan(0);

    // Simulate time passing beyond combo duration (3.5s)
    state.update(4.0);

    expect(state.stats.comboTimer).toBe(0);
    expect(state.stats.comboCount).toBe(0);
    expect(state.stats.multiplier).toBe(1);
  });

  it('updates high score when current score exceeds prior record', () => {
    state.stats.highScore = 5000;
    state.addScore(8000);

    expect(state.stats.score).toBe(8000);
    expect(state.stats.highScore).toBe(8000);
  });

  it('progresses waves accurately based on survival time', () => {
    // Wave 1 at t=0
    expect(state.stats.wave).toBe(1);

    // 20s survived -> Wave 2
    state.update(21);
    expect(state.stats.wave).toBe(2);

    // 40s survived -> Wave 3
    state.update(21);
    expect(state.stats.wave).toBe(3);
  });
});
