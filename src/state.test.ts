import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager } from './state';

describe('GameStateManager & Scoring Engine', () => {
  let state: GameStateManager;

  beforeEach(() => {
    state = new GameStateManager();
    state.resetGame(1, false);
  });

  it('initializes with clean default values in Sector 1', () => {
    expect(state.currentSector).toBe(1);
    expect(state.stats.score).toBe(0);
    expect(state.stats.multiplier).toBe(1);
    expect(state.stats.comboCount).toBe(0);
    expect(state.stats.wave).toBe(1);
    expect(state.mode).toBe('PLAYING');
  });

  it('supports READY staging mode and engages warp on player readiness', () => {
    state.resetGame(2, true);
    expect(state.mode).toBe('READY');
    expect(state.currentSector).toBe(2);

    // Updates should not advance survival time while READY
    state.update(2.0);
    expect(state.stats.survivalTime).toBe(0);

    // Engaging warp transitions cleanly to PLAYING
    state.engageWarp();
    expect(state.mode).toBe('PLAYING');

    state.update(1.0);
    expect(state.stats.survivalTime).toBe(1.0);
  });

  it('toggles pause state cleanly and halts time progression while paused', () => {
    expect(state.mode).toBe('PLAYING');
    const isPaused = state.togglePause();
    expect(isPaused).toBe(true);
    expect(state.mode).toBe('PAUSED');

    // Time should not advance while PAUSED
    state.update(5.0);
    expect(state.stats.survivalTime).toBe(0);

    const isResumed = state.togglePause();
    expect(isResumed).toBe(false);
    expect(state.mode).toBe('PLAYING');

    state.update(2.0);
    expect(state.stats.survivalTime).toBe(2.0);
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
