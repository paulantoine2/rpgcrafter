import { describe, expect, it } from 'vitest';
import { buildNavigationGraph, navigationTarget, type GameMap, type TilesetDefinition } from '../src/index.js';

const tilesets: Record<string, TilesetDefinition> = {
  test: {
    id: 'test', name: 'Test', category: 'Test', kind: 'a2', image: 'tilesets/test.png', tileSize: 48, quarterSize: 24, columns: 2, rows: 3, variants: {},
    terrains: [
      { id: 'floor', name: 'Floor', origin: { column: 0, row: 0 }, previewMask: 0, collision: { kind: 'none' } },
      { id: 'wall', name: 'Wall', origin: { column: 0, row: 0 }, previewMask: 0, collision: { kind: 'blockCell' } },
      { id: 'fence', name: 'Fence', origin: { column: 0, row: 0 }, previewMask: 0, collision: { kind: 'edges', edges: ['east'] } },
    ],
  },
  grid: {
    id: 'grid', name: 'Grid', category: 'Test', kind: 'grid', image: 'tilesets/grid.png', tileSize: 48, columns: 1, rows: 1,
    terrains: [{ id: 'gate', name: 'Gate', origin: { column: 0, row: 0 }, collision: { kind: 'edges', edges: ['west'] } }],
  },
};

function map(): GameMap {
  return {
    id: 'map', numericId: 1, name: 'Map', ground: '#000', accent: '#fff', tileSize: 48, bounds: { x: 0, y: 0, w: 3, h: 2 },
    planes: [
      { id: 'a', name: 'A', order: 0, surfaceLayerId: 'a-surface', surfaceCoverage: 'bounds' },
      { id: 'b', name: 'B', order: 1, surfaceLayerId: 'b-surface', surfaceCoverage: 'painted' },
    ],
    tileLayers: [
      { id: 'a-surface', name: 'A surface', planeId: 'a', renderPhase: 'belowActors', tiles: [] },
      { id: 'a-collision', name: 'A collision', planeId: 'a', renderPhase: 'belowActors', tiles: [{ x: 0, y: 0, tilesetId: 'test', terrainId: 'fence' }] },
      { id: 'b-surface', name: 'B surface', planeId: 'b', renderPhase: 'belowActors', tiles: [{ x: 1, y: 0, tilesetId: 'test', terrainId: 'floor' }, { x: 2, y: 0, tilesetId: 'test', terrainId: 'floor' }] },
    ],
    planeConnections: [], navigationOverrides: [], blockedRegions: [], events: [], enemySpawns: [],
  };
}

describe('navigation graph', () => {
  it('keeps overlapping surfaces independent and never infers another plane', () => {
    const graph = buildNavigationGraph(map(), tilesets);
    expect(navigationTarget(graph, 'a', 1, 0, 'east')).toEqual({ planeId: 'a', x: 2, y: 0 });
    expect(navigationTarget(graph, 'b', 1, 0, 'west')).toBeNull();
  });

  it('blocks a terrain edge in both directions and lets a map override open it', () => {
    const source = map();
    let graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 0, 'east')).toBeNull();
    expect(navigationTarget(graph, 'a', 1, 0, 'west')).toBeNull();
    source.navigationOverrides.push({ planeId: 'a', x: 0, y: 0, edges: { east: 'open' } });
    graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 0, 'east')).toEqual({ planeId: 'a', x: 1, y: 0 });
  });

  it('blocks only the exterior perimeter of a connected A2 terrain', () => {
    const source = map();
    source.tileLayers.find(layer => layer.id === 'a-collision')!.tiles.push({ x: 1, y: 0, tilesetId: 'test', terrainId: 'fence' });
    const graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 0, 'east')).toEqual({ planeId: 'a', x: 1, y: 0 });
    expect(navigationTarget(graph, 'a', 1, 0, 'west')).toEqual({ planeId: 'a', x: 0, y: 0 });
    expect(navigationTarget(graph, 'a', 1, 0, 'east')).toBeNull();
    expect(navigationTarget(graph, 'a', 0, 0, 'south')).toBeNull();
  });

  it('keeps directional edge collisions for grid tilesets', () => {
    const source = map();
    source.tileLayers.push({ id: 'a-grid', name: 'Grid', planeId: 'a', renderPhase: 'aboveActors', tiles: [{ x: 2, y: 1, tilesetId: 'grid', terrainId: 'gate' }] });
    const graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 2, 1, 'west')).toBeNull();
    expect(navigationTarget(graph, 'a', 2, 1, 'north')).toEqual({ planeId: 'a', x: 2, y: 0 });
  });

  it('uses explicit bidirectional connections between adjacent planes', () => {
    const source = map();
    source.planes[0].surfaceCoverage = 'painted';
    source.tileLayers[0].tiles.push({ x: 0, y: 0, tilesetId: 'test', terrainId: 'floor' });
    source.planeConnections.push({ id: 'stairs', from: { planeId: 'a', x: 0, y: 0, edge: 'east' }, to: { planeId: 'b', x: 1, y: 0, edge: 'west' }, bidirectional: true });
    source.navigationOverrides.push({ planeId: 'a', x: 0, y: 0, edges: { east: 'open' } });
    const graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 0, 'east')).toEqual({ planeId: 'b', x: 1, y: 0 });
    expect(navigationTarget(graph, 'b', 1, 0, 'west')).toEqual({ planeId: 'a', x: 0, y: 0 });
  });

  it('keeps a neighboring surface on the current plane before using a connection', () => {
    const source = map();
    source.planes[0].surfaceCoverage = 'painted';
    source.tileLayers[0].tiles.push({ x: 0, y: 0, tilesetId: 'test', terrainId: 'floor' }, { x: 1, y: 0, tilesetId: 'test', terrainId: 'floor' });
    source.planeConnections.push({ id: 'stairs', from: { planeId: 'a', x: 0, y: 0, edge: 'east' }, to: { planeId: 'b', x: 1, y: 0, edge: 'west' }, bidirectional: false });
    source.navigationOverrides.push({ planeId: 'a', x: 0, y: 0, edges: { east: 'open' } });
    const graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 0, 'east')).toEqual({ planeId: 'a', x: 1, y: 0 });
  });

  it('combines blocked cells from terrain, regions and overrides per plane', () => {
    const source = map();
    source.tileLayers[0].tiles.push({ x: 2, y: 0, tilesetId: 'test', terrainId: 'wall' });
    source.blockedRegions.push({ planeId: 'a', x: 1, y: 1, w: 1, h: 1 });
    let graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 1, 0, 'east')).toBeNull();
    expect(navigationTarget(graph, 'a', 0, 1, 'east')).toBeNull();
    source.navigationOverrides.push({ planeId: 'a', x: 2, y: 0, cell: 'open' });
    graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 1, 0, 'east')).toEqual({ planeId: 'a', x: 2, y: 0 });
  });

  it('unions collisions across layers on one plane without making decorative tiles blocking', () => {
    const source = map();
    source.tileLayers.push(
      { id: 'a-trunks', name: 'Trunks', planeId: 'a', renderPhase: 'belowActors', tiles: [{ x: 1, y: 1, tilesetId: 'test', terrainId: 'wall' }] },
      { id: 'a-moss', name: 'Moss', planeId: 'a', renderPhase: 'aboveActors', tiles: [{ x: 1, y: 1, tilesetId: 'test', terrainId: 'floor' }, { x: 2, y: 1, tilesetId: 'test', terrainId: 'floor' }] },
    );
    let graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 1, 'east')).toBeNull();
    expect(navigationTarget(graph, 'a', 1, 1, 'east')).toBeNull();
    source.tileLayers.find(layer => layer.id === 'a-trunks')!.tiles = [];
    graph = buildNavigationGraph(source, tilesets);
    expect(navigationTarget(graph, 'a', 0, 1, 'east')).toEqual({ planeId: 'a', x: 1, y: 1 });
    expect(navigationTarget(graph, 'a', 1, 1, 'east')).toEqual({ planeId: 'a', x: 2, y: 1 });
  });
});
