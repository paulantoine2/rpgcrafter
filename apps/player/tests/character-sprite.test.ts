import { describe, expect, it } from 'vitest';
import { characterDirection, characterFrame, walkFrame } from '../src/character-sprite.js';

describe('RPG Maker character sprites', () => {
  it('locates frames for every character group in the 576 × 384 sheet', () => {
    expect(characterFrame(0, 'down', 0)).toEqual({ x: 0, y: 0, width: 48, height: 48 });
    expect(characterFrame(7, 'up', 2)).toEqual({ x: 528, y: 336, width: 48, height: 48 });
  });

  it('chooses the matching direction, with vertical priority on diagonals', () => {
    expect(characterDirection({ x: -1, y: 0 })).toBe('left');
    expect(characterDirection({ x: 1, y: 0 })).toBe('right');
    expect(characterDirection({ x: 0, y: -1 })).toBe('up');
    expect(characterDirection({ x: 1, y: 1 })).toBe('down');
  });

  it('keeps the center pose at rest and cycles through both walking steps', () => {
    expect(walkFrame(4, false)).toBe(1);
    expect([0, 1, 2, 1, 0].map((_, index) => walkFrame(index * 0.12, true))).toEqual([0, 1, 2, 1, 0]);
  });
});
