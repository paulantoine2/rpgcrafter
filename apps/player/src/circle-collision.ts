import type { Vec2 } from './types.js';

const DIAGONALS = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
] as const;

/** Tests the rounded part of a circle against blocked cells touching its current cell by a corner. */
export function circleIntersectsBlockedDiagonal(position: Vec2, radius: number, tileSize: number, cellBlocked: (x: number, y: number) => boolean) {
  const cellX = Math.floor(position.x / tileSize);
  const cellY = Math.floor(position.y / tileSize);
  const radiusSquared = radius * radius;
  return DIAGONALS.some(offset => {
    const cornerX = (cellX + (offset.x > 0 ? 1 : 0)) * tileSize;
    const cornerY = (cellY + (offset.y > 0 ? 1 : 0)) * tileSize;
    const dx = position.x - cornerX;
    const dy = position.y - cornerY;
    return dx * dx + dy * dy < radiusSquared && cellBlocked(cellX + offset.x, cellY + offset.y);
  });
}
