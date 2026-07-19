import { navigationCellKey, navigationEdgeKey } from '@rpgcrafter/game-schema';
import type { Direction, NavigationOverride, Rect, TerrainPlacement, TileLayer, Vec2 } from '@rpgcrafter/game-schema';
import type { SelectedTerrain } from '@/lib/tile-palette';

const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];

export function snapAndClampEventPosition(position: Vec2, bounds: Rect, step = 0.5): Vec2 {
  const snap = (value: number) => Math.round(value / step) * step;
  return {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.w, snap(position.x))),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.h, snap(position.y))),
  };
}

export function tileAtWorldPosition(position: Vec2, bounds: Rect): Vec2 | null {
  const tile = { x: Math.floor(position.x), y: Math.floor(position.y) };
  if (tile.x < bounds.x || tile.x >= bounds.x + bounds.w || tile.y < bounds.y || tile.y >= bounds.y + bounds.h) return null;
  return tile;
}

export function navigationTargetAtWorldPosition(position: Vec2, bounds: Rect, mode: 'cell' | 'edge'): (Vec2 & { edge?: Direction }) | null {
  const tile = tileAtWorldPosition(position, bounds);
  if (!tile || mode === 'cell') return tile;
  const horizontal = position.x - tile.x;
  const vertical = position.y - tile.y;
  const distances: Array<[Direction, number]> = [
    ['north', vertical],
    ['east', 1 - horizontal],
    ['south', 1 - vertical],
    ['west', horizontal],
  ];
  const edge = distances.reduce((closest, candidate) => candidate[1] < closest[1] ? candidate : closest)[0];
  return { ...tile, edge };
}

export function paintTerrain(tiles: TerrainPlacement[], placement: TerrainPlacement): TerrainPlacement[] {
  const index = tiles.findIndex(tile => tile.x === placement.x && tile.y === placement.y);
  if (index >= 0 && tiles[index].tilesetId === placement.tilesetId && tiles[index].terrainId === placement.terrainId) return tiles;
  const next = index >= 0 ? tiles.map((tile, tileIndex) => tileIndex === index ? placement : tile) : [...tiles, placement];
  return next.sort((left, right) => left.y - right.y || left.x - right.x);
}

export function paintTerrainLayer(layers: TileLayer[], layerId: string, placement: TerrainPlacement): TileLayer[] {
  return editTerrainLayer(layers, layerId, [placement], { tilesetId: placement.tilesetId, terrainId: placement.terrainId });
}

function inBounds(cell: Vec2, bounds: Rect) {
  return cell.x >= bounds.x && cell.x < bounds.x + bounds.w && cell.y >= bounds.y && cell.y < bounds.y + bounds.h;
}

export function rectangleCells(start: Vec2, end: Vec2, bounds: Rect): Vec2[] {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  const cells: Vec2[] = [];
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) if (inBounds({ x, y }, bounds)) cells.push({ x, y });
  return cells;
}

export function ellipseCells(start: Vec2, end: Vec2, bounds: Rect): Vec2[] {
  const rectangle = rectangleCells(start, end, bounds);
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  const width = right - left + 1, height = bottom - top + 1;
  if (width <= 2 || height <= 2) return rectangle;
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
  const radiusX = (width - 1) / 2, radiusY = (height - 1) / 2;
  return rectangle.filter(cell => ((cell.x - centerX) / radiusX) ** 2 + ((cell.y - centerY) / radiusY) ** 2 <= 1);
}

export function floodFillCells(tiles: TerrainPlacement[], start: Vec2, bounds: Rect): Vec2[] {
  if (!inBounds(start, bounds)) return [];
  const tileByCell = new Map(tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
  const startTile = tileByCell.get(`${start.x}:${start.y}`);
  const target = startTile ? `${startTile.tilesetId}:${startTile.terrainId}` : null;
  const matchesTarget = (cell: Vec2) => {
    const tile = tileByCell.get(`${cell.x}:${cell.y}`);
    return target === null ? !tile : Boolean(tile && `${tile.tilesetId}:${tile.terrainId}` === target);
  };
  const cells: Vec2[] = [];
  const queued = new Set([`${start.x}:${start.y}`]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    if (!matchesTarget(cell)) continue;
    cells.push(cell);
    for (const neighbor of [{ x: cell.x, y: cell.y - 1 }, { x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }, { x: cell.x - 1, y: cell.y }]) {
      const key = `${neighbor.x}:${neighbor.y}`;
      if (!inBounds(neighbor, bounds) || queued.has(key)) continue;
      queued.add(key);
      queue.push(neighbor);
    }
  }
  return cells;
}

export function editTerrainLayer(layers: TileLayer[], layerId: string, cells: Vec2[], terrain: { tilesetId: string; terrainId: string } | null): TileLayer[] {
  const index = layers.findIndex(layer => layer.id === layerId);
  if (index < 0 || !cells.length) return layers;
  const tileByCell = new Map(layers[index].tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
  let changed = false;
  for (const cell of cells) {
    const key = `${cell.x}:${cell.y}`;
    const existing = tileByCell.get(key);
    if (!terrain) {
      if (existing) { tileByCell.delete(key); changed = true; }
      continue;
    }
    if (existing?.tilesetId === terrain.tilesetId && existing.terrainId === terrain.terrainId) continue;
    tileByCell.set(key, { ...cell, ...terrain });
    changed = true;
  }
  if (!changed) return layers;
  const tiles = [...tileByCell.values()].sort((left, right) => left.y - right.y || left.x - right.x);
  return layers.map((layer, layerIndex) => layerIndex === index ? { ...layer, tiles } : layer);
}

export function terrainBrushPlacements(cells: Vec2[], brush: SelectedTerrain, bounds: Rect, mode: 'stamp' | 'fill', origin?: Vec2): TerrainPlacement[] {
  const pattern = brush.pattern?.length ? brush.pattern : [{ x: 0, y: 0, terrainId: brush.terrainId }];
  if (mode === 'stamp') return cells.flatMap(cell => pattern.map(tile => ({
    x: cell.x + tile.x, y: cell.y + tile.y, tilesetId: brush.tilesetId, terrainId: tile.terrainId,
  }))).filter(placement => inBounds(placement, bounds));

  const width = Math.max(...pattern.map(tile => tile.x)) + 1;
  const height = Math.max(...pattern.map(tile => tile.y)) + 1;
  const patternByCell = new Map(pattern.map(tile => [`${tile.x}:${tile.y}`, tile]));
  const anchor = origin || { x: Math.min(...cells.map(cell => cell.x)), y: Math.min(...cells.map(cell => cell.y)) };
  return cells.flatMap(cell => {
    const patternX = ((cell.x - anchor.x) % width + width) % width;
    const patternY = ((cell.y - anchor.y) % height + height) % height;
    const tile = patternByCell.get(`${patternX}:${patternY}`);
    return tile ? [{ ...cell, tilesetId: brush.tilesetId, terrainId: tile.terrainId }] : [];
  });
}

export function editTerrainPlacementsLayer(layers: TileLayer[], layerId: string, placements: TerrainPlacement[]): TileLayer[] {
  const index = layers.findIndex(layer => layer.id === layerId);
  if (index < 0 || !placements.length) return layers;
  const tileByCell = new Map(layers[index].tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
  let changed = false;
  for (const placement of placements) {
    const key = `${placement.x}:${placement.y}`;
    const existing = tileByCell.get(key);
    if (existing?.tilesetId === placement.tilesetId && existing.terrainId === placement.terrainId) continue;
    tileByCell.set(key, placement);
    changed = true;
  }
  if (!changed) return layers;
  const tiles = [...tileByCell.values()].sort((left, right) => left.y - right.y || left.x - right.x);
  return layers.map((layer, layerIndex) => layerIndex === index ? { ...layer, tiles } : layer);
}

export function clearNavigationOverridesForCells(overrides: NavigationOverride[], planeId: string, cells: Vec2[]): NavigationOverride[] {
  if (!cells.length) return overrides;
  const cellKeys = new Set(cells.map(cell => navigationCellKey(planeId, cell.x, cell.y)));
  const edgeKeys = new Set(cells.flatMap(cell => DIRECTIONS.map(edge => navigationEdgeKey(planeId, cell.x, cell.y, edge))));
  let changed = false;
  const next = overrides.flatMap(override => {
    const cellKey = navigationCellKey(override.planeId, override.x, override.y);
    let cell = override.cell;
    let edges = override.edges;
    if (cell && cellKeys.has(cellKey)) { cell = undefined; changed = true; }
    if (edges) {
      const kept = Object.fromEntries((Object.entries(edges) as Array<[Direction, 'open' | 'blocked']>).filter(([edge]) => !edgeKeys.has(navigationEdgeKey(override.planeId, override.x, override.y, edge))));
      if (Object.keys(kept).length !== Object.keys(edges).length) { edges = Object.keys(kept).length ? kept : undefined; changed = true; }
    }
    return cell || edges ? [{ ...override, cell, edges }] : [];
  });
  return changed ? next : overrides;
}
