import { describe, it, expect } from 'vitest';
import {
  createFrozenShard,
  checkShatterCollision,
  findCascadeShards,
  CryoManager
} from './freeze';

describe('Temporal Cryo-Freeze & Shatter Engine', () => {
  it('creates frozen shards with accurate default properties', () => {
    const shard = createFrozenShard(1, { x: 100, y: 150 }, 10, 6.0, 500);

    expect(shard.id).toBe(1);
    expect(shard.pos).toEqual({ x: 100, y: 150 });
    expect(shard.radius).toBe(12); // 10 * 1.2
    expect(shard.freezeTimer).toBe(6.0);
    expect(shard.active).toBe(true);
    expect(shard.shatterValue).toBe(500);
  });

  it('detects direct shatter impacts on shards correctly', () => {
    const shard = createFrozenShard(1, { x: 200, y: 200 }, 10);

    // Impact overlapping shard: dist = 15 <= 12 + 10 = 22 -> Collision!
    expect(checkShatterCollision(shard, { x: 215, y: 200 }, 10)).toBe(true);

    // Impact distant from shard: dist = 100 > 22 -> No Collision!
    expect(checkShatterCollision(shard, { x: 300, y: 200 }, 10)).toBe(false);
  });

  it('identifies neighboring shards for explosive cascade chain reactions', () => {
    const epicenter = createFrozenShard(1, { x: 100, y: 100 }, 10);
    const neighborClose = createFrozenShard(2, { x: 140, y: 100 }, 10); // dist = 40 <= 90
    const neighborFar = createFrozenShard(3, { x: 300, y: 100 }, 10); // dist = 200 > 90

    const cascades = findCascadeShards(epicenter, [epicenter, neighborClose, neighborFar], 90);

    expect(cascades).toHaveLength(1);
    expect(cascades[0].id).toBe(2);
  });

  it('freezes positions and manages shard population lifecycle', () => {
    const cryo = new CryoManager();
    const shard = cryo.freezePosition({ x: 50, y: 50 }, 15, 800);

    expect(cryo.shards).toHaveLength(1);
    expect(shard.shatterValue).toBe(800);

    cryo.reset();
    expect(cryo.shards).toHaveLength(0);
  });
});
