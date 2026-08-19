import { describe, expect, it } from 'vitest';
import { battleBackgroundImage, enemyDamage, playerDamage } from '../src/combat.js';

describe('combat damage', () => {
  it('layers the transparent battlebacks2 backdrop over the battlebacks1 ground', () => {
    expect(battleBackgroundImage(
      { lowerImage: 'battlebacks1/Grassland.png', upperImage: 'battlebacks2/Grassland.png' },
      { 'battlebacks1/Grassland.png': '/ground.png', 'battlebacks2/Grassland.png': '/backdrop.png' },
    )).toBe('url("/backdrop.png"), url("/ground.png")');
  });

  it('adds base attack, equipment, and skill damage before enemy defense', () => {
    expect(playerDamage(8, 4, 10, 6)).toBe(16);
  });

  it('applies player and equipment defense to enemy attacks', () => {
    expect(enemyDamage(14, 3, 4)).toBe(7);
  });

  it('always deals at least one damage', () => {
    expect(playerDamage(1, 0, 0, 99)).toBe(1);
    expect(enemyDamage(1, 99, 99)).toBe(1);
  });
});
