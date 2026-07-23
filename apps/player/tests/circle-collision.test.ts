import { describe, expect, it } from 'vitest';
import { circleIntersectsBlockedDiagonal } from '../src/circle-collision.js';

describe('circle corner collisions', () => {
  const blockedNorthEast = (x: number, y: number) => x === 1 && y === 0;

  it('detects the same blocked corner from different approach angles', () => {
    expect(circleIntersectsBlockedDiagonal({ x: 29, y: 54 }, 20, 48, blockedNorthEast)).toBe(true);
    expect(circleIntersectsBlockedDiagonal({ x: 42, y: 67 }, 20, 48, blockedNorthEast)).toBe(true);
  });

  it('allows the circle to pass when it does not geometrically reach the corner', () => {
    expect(circleIntersectsBlockedDiagonal({ x: 29, y: 55 }, 20, 48, blockedNorthEast)).toBe(false);
  });

  it('does not turn a walkable diagonal cell into an obstacle', () => {
    expect(circleIntersectsBlockedDiagonal({ x: 42, y: 54 }, 20, 48, () => false)).toBe(false);
  });
});
