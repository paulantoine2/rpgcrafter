import { describe, expect, it } from 'vitest';
import { AUTOTILE_BITS, CANONICAL_AUTOTILE_MASKS, canonicalizeAutotileMask, resolveTerrainPlacements, type TerrainPlacement } from '../src/index.js';

const neighbors = [
  [AUTOTILE_BITS.north, 0, -1], [AUTOTILE_BITS.east, 1, 0],
  [AUTOTILE_BITS.south, 0, 1], [AUTOTILE_BITS.west, -1, 0],
  [AUTOTILE_BITS.northEast, 1, -1], [AUTOTILE_BITS.southEast, 1, 1],
  [AUTOTILE_BITS.southWest, -1, 1], [AUTOTILE_BITS.northWest, -1, -1],
] as const;

function placements(mask: number, scale = 1): TerrainPlacement[] {
  return [
    { x: 4 * scale, y: 4 * scale, tilesetId: 'outside', terrainId: 'dirt' },
    ...neighbors.filter(([bit]) => mask & bit).map(([, x, y]) => ({ x: (4 + x) * scale, y: (4 + y) * scale, tilesetId: 'outside', terrainId: 'dirt' })),
  ];
}

describe('A2 autotile topology', () => {
  it('enumerates and resolves every canonical 47-tile mask', () => {
    expect(CANONICAL_AUTOTILE_MASKS).toHaveLength(47);
    for (const mask of CANONICAL_AUTOTILE_MASKS) expect(resolveTerrainPlacements(placements(mask))[0].mask).toBe(mask);
  });

  it('ignores diagonals without both adjacent cardinal neighbors', () => {
    expect(canonicalizeAutotileMask(AUTOTILE_BITS.northEast)).toBe(0);
    expect(canonicalizeAutotileMask(AUTOTILE_BITS.north | AUTOTILE_BITS.northEast)).toBe(AUTOTILE_BITS.north);
    const tiles = placements(0);
    tiles.push({ x: 5, y: 3, tilesetId: 'outside', terrainId: 'dirt' });
    expect(resolveTerrainPlacements(tiles)[0].mask).toBe(0);
  });

  it('does not connect identical terrain ids from different tilesets', () => {
    const tiles = placements(AUTOTILE_BITS.east);
    tiles[1].tilesetId = 'inside';
    expect(resolveTerrainPlacements(tiles)[0].mask).toBe(0);
  });

  it('does not connect different terrain ids and supports pixel-normalized runtime coordinates', () => {
    const tiles = placements(AUTOTILE_BITS.east, 48);
    tiles[1].terrainId = 'grass';
    expect(resolveTerrainPlacements(tiles, 48)[0].mask).toBe(0);
    tiles[1].terrainId = 'dirt';
    expect(resolveTerrainPlacements(tiles, 48)[0].mask).toBe(AUTOTILE_BITS.east);
  });
});
