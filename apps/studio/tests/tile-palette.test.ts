import { describe, expect, it } from 'vitest';
import type { GridTilesetDefinition } from '@rpgcrafter/game-schema';
import { defaultTerrainSelection, gridTerrainSelection, paletteTerrains, terrainSelectionAt, terrainSelectionExists } from '../src/lib/tile-palette';

function gridTileset(columns: number, rows: number): GridTilesetDefinition {
  return {
    id: 'decor', name: 'Decor', category: 'Nature', kind: 'grid', image: 'tilesets/decor.png', tileSize: 48, columns, rows,
    terrains: Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => ({
      id: `tile-${row}-${column}`,
      name: `Tile ${row}-${column}`,
      origin: { column, row },
      collision: { kind: 'none' as const },
    }))).flat(),
  };
}

describe('tile palette layout', () => {
  it('places the left half of a 16-column grid before the right half', () => {
    const layout = paletteTerrains(gridTileset(16, 2));

    expect(layout.map(({ terrain }) => terrain.id)).toEqual([
      ...Array.from({ length: 2 }, (_, row) => Array.from({ length: 8 }, (_, column) => `tile-${row}-${column}`)).flat(),
      ...Array.from({ length: 2 }, (_, row) => Array.from({ length: 8 }, (_, column) => `tile-${row}-${column + 8}`)).flat(),
    ]);
    expect(layout.find(({ terrain }) => terrain.id === 'tile-0-8')).toMatchObject({ column: 1, row: 3 });
  });

  it('preserves empty columns when a band is narrower than eight tiles', () => {
    const layout = paletteTerrains(gridTileset(10, 2));

    expect(layout.find(({ terrain }) => terrain.id === 'tile-0-8')).toMatchObject({ column: 1, row: 3 });
    expect(layout.find(({ terrain }) => terrain.id === 'tile-1-9')).toMatchObject({ column: 2, row: 4 });
  });

  it('builds a rectangular multi-tile brush from two grid tiles', () => {
    const selection = gridTerrainSelection(gridTileset(16, 2), 'tile-0-2', 'tile-1-4');

    expect(selection).toEqual({
      tilesetId: 'decor',
      terrainId: 'tile-0-2',
      pattern: [
        { x: 0, y: 0, terrainId: 'tile-0-2' }, { x: 1, y: 0, terrainId: 'tile-0-3' }, { x: 2, y: 0, terrainId: 'tile-0-4' },
        { x: 0, y: 1, terrainId: 'tile-1-2' }, { x: 1, y: 1, terrainId: 'tile-1-3' }, { x: 2, y: 1, terrainId: 'tile-1-4' },
      ],
    });
  });

  it('selects and validates the first available palette tile', () => {
    const tileset = gridTileset(16, 2);
    const selection = defaultTerrainSelection({ decor: tileset });

    expect(selection).toEqual({ tilesetId: 'decor', terrainId: 'tile-0-0' });
    expect(terrainSelectionExists({ decor: tileset }, selection)).toBe(true);
    expect(terrainSelectionExists({ decor: tileset }, { tilesetId: 'decor', terrainId: 'missing' })).toBe(false);
  });

  it('picks a terrain only from the active layer', () => {
    const layers = [
      { id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors' as const, tiles: [{ x: 2, y: 3, tilesetId: 'ground', terrainId: 'grass' }] },
      { id: 'details', name: 'Details', planeId: 'p', renderPhase: 'aboveActors' as const, tiles: [{ x: 2, y: 3, tilesetId: 'decor', terrainId: 'flowers' }] },
    ];

    expect(terrainSelectionAt(layers, 'ground', { x: 2, y: 3 })).toEqual({ tilesetId: 'ground', terrainId: 'grass' });
    expect(terrainSelectionAt(layers, 'details', { x: 2, y: 3 })).toEqual({ tilesetId: 'decor', terrainId: 'flowers' });
    expect(terrainSelectionAt(layers, 'details', { x: 4, y: 3 })).toBeNull();
  });
});
