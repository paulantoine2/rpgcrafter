import type { A2TilesetDefinition, AutotileVariant, TerrainPlacement } from './types.js';

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

export function autotileVariant(tileset: A2TilesetDefinition, mask: number): AutotileVariant {
  const canonical = canonicalizeAutotileMask(mask);
  const variant = tileset.variants[String(canonical)];
  if (!variant) throw new Error(`Tileset ${tileset.id} is missing autotile mask ${canonical}.`);
  return variant;
}
