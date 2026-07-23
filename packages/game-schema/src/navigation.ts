import type { Direction, GameMap, TilesetDefinition } from './types.js';

export const DIRECTION_OFFSETS: Record<Direction, { x: number; y: number; opposite: Direction }> = {
  north: { x: 0, y: -1, opposite: 'south' },
  east: { x: 1, y: 0, opposite: 'west' },
  south: { x: 0, y: 1, opposite: 'north' },
  west: { x: -1, y: 0, opposite: 'east' },
};

export type NavigationTarget = { planeId: string; x: number; y: number };
export type NavigationGraph = {
  cells: Set<string>;
  blockedCells: Set<string>;
  blockedEdges: Set<string>;
  connections: Map<string, NavigationTarget>;
};

export const navigationCellKey = (planeId: string, x: number, y: number) => `${planeId}:${x}:${y}`;
export const navigationEndpointKey = (planeId: string, x: number, y: number, edge: Direction) => `${navigationCellKey(planeId, x, y)}:${edge}`;

export function navigationEdgeKey(planeId: string, x: number, y: number, edge: Direction) {
  const offset = DIRECTION_OFFSETS[edge];
  const otherX = x + offset.x, otherY = y + offset.y;
  return edge === 'east' || edge === 'south'
    ? `${planeId}:${x}:${y}:${otherX}:${otherY}`
    : `${planeId}:${otherX}:${otherY}:${x}:${y}`;
}

export function buildNavigationGraph(map: GameMap, tilesets: Record<string, TilesetDefinition>): NavigationGraph {
  const graph: NavigationGraph = { cells: new Set(), blockedCells: new Set(), blockedEdges: new Set(), connections: new Map() };
  for (const plane of map.planes) {
    const surface = map.tileLayers.find(layer => layer.id === plane.surfaceLayerId);
    if (plane.surfaceCoverage === 'bounds') {
      for (let y = map.bounds.y; y < map.bounds.y + map.bounds.h; y += 1) for (let x = map.bounds.x; x < map.bounds.x + map.bounds.w; x += 1) graph.cells.add(navigationCellKey(plane.id, x, y));
    } else if (surface) {
      for (const tile of surface.tiles) graph.cells.add(navigationCellKey(plane.id, tile.x, tile.y));
    }
  }

  for (const layer of map.tileLayers) {
    const terrainByCell = new Map(layer.tiles.map(tile => [`${tile.x}:${tile.y}`, `${tile.tilesetId}:${tile.terrainId}`]));
    for (const tile of layer.tiles) {
      const tileset = tilesets[tile.tilesetId];
      const collision = tileset?.terrains.find(terrain => terrain.id === tile.terrainId)?.collision;
      if (collision?.kind === 'blockCell') graph.blockedCells.add(navigationCellKey(layer.planeId, tile.x, tile.y));
      if (collision?.kind === 'edges' && collision.edges.length) {
        if (tileset.kind === 'a1' || tileset.kind === 'a2' || tileset.kind === 'a3' || tileset.kind === 'a4') {
          const terrainKey = `${tile.tilesetId}:${tile.terrainId}`;
          for (const [edge, offset] of Object.entries(DIRECTION_OFFSETS) as Array<[Direction, (typeof DIRECTION_OFFSETS)[Direction]]>) {
            if (terrainByCell.get(`${tile.x + offset.x}:${tile.y + offset.y}`) !== terrainKey) graph.blockedEdges.add(navigationEdgeKey(layer.planeId, tile.x, tile.y, edge));
          }
        } else {
          for (const edge of collision.edges) graph.blockedEdges.add(navigationEdgeKey(layer.planeId, tile.x, tile.y, edge));
        }
      }
    }
  }

  for (const region of map.blockedRegions) for (let y = region.y; y < region.y + region.h; y += 1) for (let x = region.x; x < region.x + region.w; x += 1) graph.blockedCells.add(navigationCellKey(region.planeId, x, y));

  for (const override of map.navigationOverrides) {
    const cellKey = navigationCellKey(override.planeId, override.x, override.y);
    if (override.cell === 'open') { graph.cells.add(cellKey); graph.blockedCells.delete(cellKey); }
    if (override.cell === 'blocked') graph.blockedCells.add(cellKey);
    for (const [edge, state] of Object.entries(override.edges || {}) as Array<[Direction, 'open' | 'blocked']>) {
      const key = navigationEdgeKey(override.planeId, override.x, override.y, edge);
      if (state === 'open') graph.blockedEdges.delete(key); else graph.blockedEdges.add(key);
    }
  }

  for (const connection of map.planeConnections) {
    const fromKey = navigationEndpointKey(connection.from.planeId, connection.from.x, connection.from.y, connection.from.edge);
    graph.connections.set(fromKey, { planeId: connection.to.planeId, x: connection.to.x, y: connection.to.y });
    if (connection.bidirectional) {
      const toKey = navigationEndpointKey(connection.to.planeId, connection.to.x, connection.to.y, connection.to.edge);
      graph.connections.set(toKey, { planeId: connection.from.planeId, x: connection.from.x, y: connection.from.y });
    }
  }
  return graph;
}

export function navigationHasCell(graph: NavigationGraph, planeId: string, x: number, y: number) {
  const key = navigationCellKey(planeId, x, y);
  return graph.cells.has(key) && !graph.blockedCells.has(key);
}

export function navigationTarget(graph: NavigationGraph, planeId: string, x: number, y: number, edge: Direction): NavigationTarget | null {
  if (!navigationHasCell(graph, planeId, x, y) || graph.blockedEdges.has(navigationEdgeKey(planeId, x, y, edge))) return null;
  const offset = DIRECTION_OFFSETS[edge];
  const target = { planeId, x: x + offset.x, y: y + offset.y };
  if (navigationHasCell(graph, target.planeId, target.x, target.y)) return target;
  const connection = graph.connections.get(navigationEndpointKey(planeId, x, y, edge));
  return connection && navigationHasCell(graph, connection.planeId, connection.x, connection.y) ? connection : null;
}
