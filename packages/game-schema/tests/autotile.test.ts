import { describe, expect, it } from 'vitest';
import { AUTOTILE_BITS, CANONICAL_AUTOTILE_MASKS, autotileAnimationFrame, autotileRecipe, autotileVariant, canonicalizeAutotileMask, isAutotileTileset, resolveTerrainPlacements, type AutotileTilesetDefinition, type TerrainPlacement } from '../src/index.js';

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

describe('A1 autotile animation', () => {
  it('uses the RPG Maker 500ms horizontal and vertical sequences', () => {
    expect([0, 499, 500, 999, 1000, 1499, 1500, 1999, 2000].map(value => autotileAnimationFrame(value, 'horizontal'))).toEqual([0, 0, 1, 1, 2, 2, 1, 1, 0]);
    expect([0, 500, 1000, 1500].map(value => autotileAnimationFrame(value, 'vertical'))).toEqual([0, 1, 2, 0]);
    expect(autotileAnimationFrame(1000, 'none')).toBe(0);
  });

  it('uses the four waterfall joins based only on horizontal neighbors', () => {
    const tileset = { id: 'waterfall' } as AutotileTilesetDefinition;
    expect(autotileVariant(tileset, AUTOTILE_BITS.west | AUTOTILE_BITS.east, 'waterfall').quarters).toEqual([[2, 0], [1, 0], [2, 1], [1, 1]]);
    expect(autotileVariant(tileset, AUTOTILE_BITS.east, 'waterfall').quarters).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);
    expect(autotileVariant(tileset, AUTOTILE_BITS.west, 'waterfall').quarters).toEqual([[2, 0], [3, 0], [2, 1], [3, 1]]);
    expect(autotileVariant(tileset, AUTOTILE_BITS.north, 'waterfall').quarters).toEqual([[0, 0], [3, 0], [0, 1], [3, 1]]);
  });

  it('maps cardinal A4 wall neighbors to the 16 wall shapes', () => {
    const tileset = { id: 'wall' } as AutotileTilesetDefinition;
    expect(autotileVariant(tileset, 0, 'wall').quarters).toEqual([[0, 0], [3, 0], [0, 3], [3, 3]]);
    expect(autotileVariant(tileset, AUTOTILE_BITS.north | AUTOTILE_BITS.east | AUTOTILE_BITS.south | AUTOTILE_BITS.west, 'wall').quarters).toEqual([[2, 2], [1, 2], [2, 1], [1, 1]]);
    expect(autotileVariant(tileset, 255, 'wall')).toEqual(autotileVariant(tileset, 15, 'wall'));
  });
});

describe('autotile tileset classification', () => {
  it('renders A3 roof and wall terrains with the wall recipe', () => {
    const tileset = {
      id: 'outside-a3',
      name: 'Outside A3',
      category: 'Outside',
      image: 'Outside_A3.png',
      tileSize: 48,
      columns: 16,
      rows: 8,
      kind: 'a3',
      quarterSize: 24,
      variants: {},
      terrains: [{
        id: 'roof',
        name: 'Roof',
        origin: { column: 0, row: 0 },
        collision: { kind: 'none' },
        previewMask: 0,
      }],
    } satisfies AutotileTilesetDefinition;

    expect(isAutotileTileset(tileset)).toBe(true);
    expect(autotileRecipe(tileset, tileset.terrains[0])).toBe('wall');
    expect(autotileVariant(tileset, AUTOTILE_BITS.east, autotileRecipe(tileset, tileset.terrains[0])).quarters)
      .toEqual([[0, 0], [1, 0], [0, 3], [1, 3]]);
  });
});
