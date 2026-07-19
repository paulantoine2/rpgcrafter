import type { TilesetDefinition } from '@rpgcrafter/game-schema';

export const PALETTE_COLUMNS = 8;

export type SelectedTerrain = {
  tilesetId: string;
  terrainId: string;
  pattern?: Array<{ x: number; y: number; terrainId: string }>;
};

export function paletteTerrains(tileset: TilesetDefinition) {
  const terrainWidth = tileset.kind === 'a2' ? 2 : 1;
  const terrainHeight = tileset.kind === 'a2' ? 3 : 1;
  const sourceRows = Math.ceil(tileset.rows / terrainHeight);

  return tileset.terrains.map(terrain => {
    const sourceColumn = Math.floor(terrain.origin.column / terrainWidth);
    const sourceRow = Math.floor(terrain.origin.row / terrainHeight);
    const band = Math.floor(sourceColumn / PALETTE_COLUMNS);
    return {
      terrain,
      column: sourceColumn % PALETTE_COLUMNS + 1,
      row: band * sourceRows + sourceRow + 1,
    };
  }).sort((left, right) => left.row - right.row || left.column - right.column);
}

export function defaultTerrainSelection(tilesets: Record<string, TilesetDefinition>): SelectedTerrain | null {
  const values = Object.values(tilesets);
  const categories = [...new Set(values.map(tileset => tileset.category))].sort((a, b) => a.localeCompare(b));
  for (const category of categories) {
    for (const tileset of values) {
      if (tileset.category !== category) continue;
      const terrain = paletteTerrains(tileset)[0]?.terrain;
      if (terrain) return { tilesetId: tileset.id, terrainId: terrain.id };
    }
  }
  return null;
}

export function terrainSelectionExists(tilesets: Record<string, TilesetDefinition>, selection: SelectedTerrain | null) {
  if (!selection) return false;
  const tileset = tilesets[selection.tilesetId];
  if (!tileset) return false;
  const terrainIds = new Set(tileset.terrains.map(terrain => terrain.id));
  return terrainIds.has(selection.terrainId) && (!selection.pattern || selection.pattern.every(item => terrainIds.has(item.terrainId)));
}

export function gridTerrainSelection(tileset: TilesetDefinition, startTerrainId: string, endTerrainId: string): SelectedTerrain {
  const start = tileset.terrains.find(terrain => terrain.id === startTerrainId);
  const end = tileset.terrains.find(terrain => terrain.id === endTerrainId);
  if (tileset.kind !== 'grid' || !start || !end) return { tilesetId: tileset.id, terrainId: endTerrainId };
  const left = Math.min(start.origin.column, end.origin.column);
  const right = Math.max(start.origin.column, end.origin.column);
  const top = Math.min(start.origin.row, end.origin.row);
  const bottom = Math.max(start.origin.row, end.origin.row);
  const pattern = tileset.terrains
    .filter(terrain => terrain.origin.column >= left && terrain.origin.column <= right && terrain.origin.row >= top && terrain.origin.row <= bottom)
    .map(terrain => ({ x: terrain.origin.column - left, y: terrain.origin.row - top, terrainId: terrain.id }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { tilesetId: tileset.id, terrainId: pattern[0]?.terrainId || endTerrainId, ...(pattern.length > 1 ? { pattern } : {}) };
}
