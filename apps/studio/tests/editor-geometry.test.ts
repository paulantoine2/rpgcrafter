import { describe, expect, it } from 'vitest';
import { clearNavigationOverridesForCells, editTerrainLayer, editTerrainPlacementsLayer, ellipseCells, floodFillCells, navigationTargetAtWorldPosition, paintTerrain, paintTerrainLayer, rectangleCells, snapAndClampEventPosition, terrainBrushPlacements, tileAtWorldPosition } from '../src/lib/editor-geometry';

describe('event geometry', () => {
  const bounds = { x: 0, y: 0, w: 27, h: 15 };

  it('snaps event movement to half tiles', () => {
    expect(snapAndClampEventPosition({ x: 4.26, y: 9.74 }, bounds)).toEqual({ x: 4.5, y: 9.5 });
  });

  it('clamps event movement to map bounds', () => {
    expect(snapAndClampEventPosition({ x: -2, y: 18 }, bounds)).toEqual({ x: 0, y: 15 });
  });
});

describe('drawing geometry', () => {
  const bounds = { x: 2, y: 3, w: 4, h: 3 };

  it('resolves world positions to in-bounds cells', () => {
    expect(tileAtWorldPosition({ x: 3.9, y: 4.1 }, bounds)).toEqual({ x: 3, y: 4 });
    expect(tileAtWorldPosition({ x: 6, y: 4 }, bounds)).toBeNull();
  });

  it('resolves the nearest cell edge for navigation painting', () => {
    expect(navigationTargetAtWorldPosition({ x: 3.5, y: 4.08 }, bounds, 'edge')).toEqual({ x: 3, y: 4, edge: 'north' });
    expect(navigationTargetAtWorldPosition({ x: 3.94, y: 4.5 }, bounds, 'edge')).toEqual({ x: 3, y: 4, edge: 'east' });
    expect(navigationTargetAtWorldPosition({ x: 3.5, y: 4.92 }, bounds, 'edge')).toEqual({ x: 3, y: 4, edge: 'south' });
    expect(navigationTargetAtWorldPosition({ x: 3.06, y: 4.5 }, bounds, 'edge')).toEqual({ x: 3, y: 4, edge: 'west' });
    expect(navigationTargetAtWorldPosition({ x: 6, y: 4 }, bounds, 'edge')).toBeNull();
  });

  it('adds and replaces one tile per cell while preserving no-op identity', () => {
    const first = paintTerrain([], { x: 3, y: 4, tilesetId: 'outside-a2', terrainId: 'grass' });
    expect(first).toEqual([{ x: 3, y: 4, tilesetId: 'outside-a2', terrainId: 'grass' }]);
    expect(paintTerrain(first, { x: 3, y: 4, tilesetId: 'outside-a2', terrainId: 'grass' })).toBe(first);
    expect(paintTerrain(first, { x: 3, y: 4, tilesetId: 'inside', terrainId: 'dirt' })).toEqual([{ x: 3, y: 4, tilesetId: 'inside', terrainId: 'dirt' }]);
  });

  it('paints only the selected compatible layer', () => {
    const layers = [
      { id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors' as const, tiles: [] },
      { id: 'details', name: 'Details', planeId: 'p', renderPhase: 'aboveActors' as const, tiles: [] },
    ];
    const painted = paintTerrainLayer(layers, 'details', { x: 3, y: 4, tilesetId: 'outside-a2', terrainId: 'grass' });
    expect(painted[0].tiles).toEqual([]);
    expect(painted[1].tiles).toEqual([{ x: 3, y: 4, tilesetId: 'outside-a2', terrainId: 'grass' }]);
    expect(paintTerrainLayer(layers, 'missing', { x: 3, y: 4, tilesetId: 'outside-a2', terrainId: 'grass' })).toBe(layers);
  });

  it('builds inclusive rectangles and tile-aligned ellipses', () => {
    expect(rectangleCells({ x: 2, y: 3 }, { x: 4, y: 5 }, bounds)).toHaveLength(9);
    expect(ellipseCells({ x: 2, y: 3 }, { x: 4, y: 5 }, bounds)).toEqual([
      { x: 3, y: 3 },
      { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
      { x: 3, y: 5 },
    ]);
  });

  it('paints and erases several cells in one layer edit', () => {
    const layers = [{
      id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors' as const,
      tiles: [{ x: 2, y: 3, tilesetId: 'outside-a2', terrainId: 'grass' }],
    }];
    const painted = editTerrainLayer(layers, 'ground', [{ x: 3, y: 3 }, { x: 4, y: 3 }], { tilesetId: 'outside-a2', terrainId: 'dirt' });
    expect(painted[0].tiles).toHaveLength(3);
    expect(editTerrainLayer(painted, 'ground', [{ x: 2, y: 3 }, { x: 4, y: 3 }], null)[0].tiles).toEqual([
      { x: 3, y: 3, tilesetId: 'outside-a2', terrainId: 'dirt' },
    ]);
  });

  it('stamps a multi-tile grid brush while clipping it to map bounds', () => {
    const brush = {
      tilesetId: 'decor', terrainId: 'trunk-left',
      pattern: [
        { x: 0, y: 0, terrainId: 'trunk-left' }, { x: 1, y: 0, terrainId: 'trunk-right' },
        { x: 0, y: 1, terrainId: 'roots-left' }, { x: 1, y: 1, terrainId: 'roots-right' },
      ],
    };
    expect(terrainBrushPlacements([{ x: 4, y: 4 }], brush, bounds, 'stamp')).toEqual([
      { x: 4, y: 4, tilesetId: 'decor', terrainId: 'trunk-left' },
      { x: 5, y: 4, tilesetId: 'decor', terrainId: 'trunk-right' },
      { x: 4, y: 5, tilesetId: 'decor', terrainId: 'roots-left' },
      { x: 5, y: 5, tilesetId: 'decor', terrainId: 'roots-right' },
    ]);
    expect(terrainBrushPlacements([{ x: 5, y: 5 }], brush, bounds, 'stamp')).toEqual([
      { x: 5, y: 5, tilesetId: 'decor', terrainId: 'trunk-left' },
    ]);
  });

  it('repeats a multi-tile brush across a filled area', () => {
    const brush = {
      tilesetId: 'decor', terrainId: 'left',
      pattern: [{ x: 0, y: 0, terrainId: 'left' }, { x: 1, y: 0, terrainId: 'right' }],
    };
    const cells = rectangleCells({ x: 2, y: 3 }, { x: 5, y: 3 }, bounds);
    expect(terrainBrushPlacements(cells, brush, bounds, 'fill').map(tile => tile.terrainId)).toEqual(['left', 'right', 'left', 'right']);
  });

  it('applies heterogeneous terrain placements in one layer edit', () => {
    const layers = [{ id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors' as const, tiles: [] }];
    const placements = [
      { x: 2, y: 3, tilesetId: 'decor', terrainId: 'left' },
      { x: 3, y: 3, tilesetId: 'decor', terrainId: 'right' },
    ];
    expect(editTerrainPlacementsLayer(layers, 'ground', placements)[0].tiles).toEqual(placements);
  });

  it('flood-fills only the contiguous area of matching tiles', () => {
    const fillBounds = { x: 0, y: 0, w: 5, h: 3 };
    const barrier = [0, 1, 2].map(y => ({ x: 2, y, tilesetId: 'outside-a2', terrainId: 'wall' }));
    expect(floodFillCells(barrier, { x: 0, y: 1 }, fillBounds)).toHaveLength(6);
    expect(floodFillCells(barrier, { x: 4, y: 1 }, fillBounds)).toHaveLength(6);
    const wallFill = floodFillCells(barrier, { x: 2, y: 1 }, fillBounds);
    expect(wallFill).toHaveLength(3);
    expect(wallFill).toEqual(expect.arrayContaining(barrier.map(({ x, y }) => ({ x, y }))));
  });

  it('clears cell and shared-edge overrides for redrawn cells without touching neighbors', () => {
    const overrides = [
      { planeId: 'p', x: 3, y: 4, cell: 'open' as const, edges: { north: 'blocked' as const } },
      { planeId: 'p', x: 4, y: 4, edges: { west: 'open' as const, east: 'blocked' as const } },
      { planeId: 'p', x: 0, y: 0, cell: 'blocked' as const },
      { planeId: 'other', x: 3, y: 4, cell: 'blocked' as const },
    ];
    expect(clearNavigationOverridesForCells(overrides, 'p', [{ x: 3, y: 4 }])).toEqual([
      { planeId: 'p', x: 4, y: 4, edges: { east: 'blocked' } },
      { planeId: 'p', x: 0, y: 0, cell: 'blocked' },
      { planeId: 'other', x: 3, y: 4, cell: 'blocked' },
    ]);
  });

  it('clears overrides even when repainting leaves the visual layer unchanged', () => {
    const layers = [{ id: 'ground', name: 'Ground', planeId: 'p', renderPhase: 'belowActors' as const, tiles: [{ x: 3, y: 4, tilesetId: 'test', terrainId: 'moss' }] }];
    expect(editTerrainLayer(layers, 'ground', [{ x: 3, y: 4 }], { tilesetId: 'test', terrainId: 'moss' })).toBe(layers);
    expect(clearNavigationOverridesForCells([{ planeId: 'p', x: 3, y: 4, cell: 'blocked' }], 'p', [{ x: 3, y: 4 }])).toEqual([]);
  });
});
