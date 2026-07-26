import type { A1AnimationLayout, AutotileTilesetDefinition, AutotileVariant, TerrainPlacement, TilesetDefinition, TilesetTerrain } from './types.js';

export const A1_ANIMATION_FRAME_COUNT = 3;
export const A1_ANIMATION_FRAME_DURATION_MS = 500;
export const A1_ANIMATION_FRAME_STRIDE = 2;
export const A1_HORIZONTAL_ANIMATION_SEQUENCE = [0, 1, 2, 1] as const;

const WALL_AUTOTILE_VARIANTS: AutotileVariant[] = [
  { quarters: [[2, 2], [1, 2], [2, 1], [1, 1]] }, { quarters: [[0, 2], [1, 2], [0, 1], [1, 1]] },
  { quarters: [[2, 0], [1, 0], [2, 1], [1, 1]] }, { quarters: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { quarters: [[2, 2], [3, 2], [2, 1], [3, 1]] }, { quarters: [[0, 2], [3, 2], [0, 1], [3, 1]] },
  { quarters: [[2, 0], [3, 0], [2, 1], [3, 1]] }, { quarters: [[0, 0], [3, 0], [0, 1], [3, 1]] },
  { quarters: [[2, 2], [1, 2], [2, 3], [1, 3]] }, { quarters: [[0, 2], [1, 2], [0, 3], [1, 3]] },
  { quarters: [[2, 0], [1, 0], [2, 3], [1, 3]] }, { quarters: [[0, 0], [1, 0], [0, 3], [1, 3]] },
  { quarters: [[2, 2], [3, 2], [2, 3], [3, 3]] }, { quarters: [[0, 2], [3, 2], [0, 3], [3, 3]] },
  { quarters: [[2, 0], [3, 0], [2, 3], [3, 3]] }, { quarters: [[0, 0], [3, 0], [0, 3], [3, 3]] },
];

export const AUTOTILE_BITS = {
  north: 1,
  east: 2,
  south: 4,
  west: 8,
  northEast: 16,
  southEast: 32,
  southWest: 64,
  northWest: 128,
} as const;

export function canonicalizeAutotileMask(mask: number) {
  let canonical = mask & 0xff;
  if ((canonical & (AUTOTILE_BITS.north | AUTOTILE_BITS.east)) !== (AUTOTILE_BITS.north | AUTOTILE_BITS.east)) canonical &= ~AUTOTILE_BITS.northEast;
  if ((canonical & (AUTOTILE_BITS.east | AUTOTILE_BITS.south)) !== (AUTOTILE_BITS.east | AUTOTILE_BITS.south)) canonical &= ~AUTOTILE_BITS.southEast;
  if ((canonical & (AUTOTILE_BITS.south | AUTOTILE_BITS.west)) !== (AUTOTILE_BITS.south | AUTOTILE_BITS.west)) canonical &= ~AUTOTILE_BITS.southWest;
  if ((canonical & (AUTOTILE_BITS.west | AUTOTILE_BITS.north)) !== (AUTOTILE_BITS.west | AUTOTILE_BITS.north)) canonical &= ~AUTOTILE_BITS.northWest;
  return canonical;
}

export const CANONICAL_AUTOTILE_MASKS = Object.freeze(
  Array.from({ length: 256 }, (_, mask) => mask).filter(mask => canonicalizeAutotileMask(mask) === mask),
);

export type ResolvedTerrainPlacement = TerrainPlacement & { mask: number };

/** Resolve topology without mutating persisted placements. `coordinateScale` is 1 for authoring and tileSize for runtime pixels. */
export function resolveTerrainPlacements(tiles: readonly TerrainPlacement[], coordinateScale = 1): ResolvedTerrainPlacement[] {
  const cells = new Map<string, string>();
  const coordinate = (value: number) => value / coordinateScale;
  for (const tile of tiles) cells.set(`${coordinate(tile.x)}:${coordinate(tile.y)}`, `${tile.tilesetId}:${tile.terrainId}`);
  const matches = (x: number, y: number, terrainKey: string) => cells.get(`${x}:${y}`) === terrainKey;

  return tiles.map(tile => {
    const x = coordinate(tile.x), y = coordinate(tile.y), terrainKey = `${tile.tilesetId}:${tile.terrainId}`;
    const north = matches(x, y - 1, terrainKey);
    const east = matches(x + 1, y, terrainKey);
    const south = matches(x, y + 1, terrainKey);
    const west = matches(x - 1, y, terrainKey);
    let mask = 0;
    if (north) mask |= AUTOTILE_BITS.north;
    if (east) mask |= AUTOTILE_BITS.east;
    if (south) mask |= AUTOTILE_BITS.south;
    if (west) mask |= AUTOTILE_BITS.west;
    if (north && east && matches(x + 1, y - 1, terrainKey)) mask |= AUTOTILE_BITS.northEast;
    if (east && south && matches(x + 1, y + 1, terrainKey)) mask |= AUTOTILE_BITS.southEast;
    if (south && west && matches(x - 1, y + 1, terrainKey)) mask |= AUTOTILE_BITS.southWest;
    if (west && north && matches(x - 1, y - 1, terrainKey)) mask |= AUTOTILE_BITS.northWest;
    return { ...tile, mask };
  });
}

export type AutotileRecipe = 'floor' | 'waterfall' | 'wall';

export function isAutotileTileset(tileset: TilesetDefinition): tileset is AutotileTilesetDefinition {
  return tileset.kind === 'a1' || tileset.kind === 'a2' || tileset.kind === 'a3' || tileset.kind === 'a4';
}

export function autotileRecipe(tileset: AutotileTilesetDefinition, terrain: TilesetTerrain): AutotileRecipe {
  if (tileset.kind === 'a1' && 'animation' in terrain && terrain.animation === 'vertical') return 'waterfall';
  if (tileset.kind === 'a3' || tileset.kind === 'a4' && 'autotile' in terrain && terrain.autotile === 'wall') return 'wall';
  return 'floor';
}

export function autotileVariant(tileset: AutotileTilesetDefinition, mask: number, recipe: AutotileRecipe = 'floor'): AutotileVariant {
  if (recipe === 'waterfall') {
    const west = Boolean(mask & AUTOTILE_BITS.west), east = Boolean(mask & AUTOTILE_BITS.east);
    return { quarters: west
      ? east ? [[2, 0], [1, 0], [2, 1], [1, 1]] : [[2, 0], [3, 0], [2, 1], [3, 1]]
      : east ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0], [3, 0], [0, 1], [3, 1]] };
  }
  if (recipe === 'wall') {
    const missingEdges = (mask & AUTOTILE_BITS.west ? 0 : 1)
      | (mask & AUTOTILE_BITS.north ? 0 : 2)
      | (mask & AUTOTILE_BITS.east ? 0 : 4)
      | (mask & AUTOTILE_BITS.south ? 0 : 8);
    return WALL_AUTOTILE_VARIANTS[missingEdges];
  }
  const canonical = canonicalizeAutotileMask(mask);
  const variant = tileset.variants[String(canonical)];
  if (!variant) throw new Error(`Tileset ${tileset.id} is missing autotile mask ${canonical}.`);
  return variant;
}

export function autotileAnimationFrame(elapsedMs: number, layout: A1AnimationLayout = 'horizontal') {
  const tick = Math.floor(Math.max(0, elapsedMs) / A1_ANIMATION_FRAME_DURATION_MS);
  if (layout === 'none') return 0;
  if (layout === 'vertical') return tick % A1_ANIMATION_FRAME_COUNT;
  return A1_HORIZONTAL_ANIMATION_SEQUENCE[tick % A1_HORIZONTAL_ANIMATION_SEQUENCE.length];
}
