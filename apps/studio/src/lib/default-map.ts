import type { GameMap, TileLayer } from '@rpgcrafter/game-schema';

export const DEFAULT_PLANE_ID = 'plane-1';

export function createDefaultLayers(planeId = DEFAULT_PLANE_ID): TileLayer[] {
  return [
    { id: 'layer-1', name: 'Layer 1', planeId, renderPhase: 'belowActors', tiles: [] },
    { id: 'layer-2', name: 'Layer 2', planeId, renderPhase: 'belowActors', tiles: [] },
    { id: 'layer-3', name: 'Layer 3', planeId, renderPhase: 'aboveActors', tiles: [] },
    { id: 'layer-4', name: 'Layer 4', planeId, renderPhase: 'aboveActors', tiles: [] },
  ];
}

export function createDefaultMap(id: string, name: string, width: number, height: number, parentMapId?: string): GameMap {
  return {
    id,
    name,
    ...(parentMapId ? { parentMapId } : {}),
    ground: '#172033',
    accent: '#6ee7b7',
    tileSize: 48,
    bounds: { x: 0, y: 0, w: width, h: height },
    planes: [{ id: DEFAULT_PLANE_ID, name: 'Plan 1', order: 0, surfaceLayerId: 'layer-1', surfaceCoverage: 'bounds' }],
    tileLayers: createDefaultLayers(),
    planeConnections: [],
    navigationOverrides: [],
    blockedRegions: [],
    events: [],
    enemySpawns: [],
  };
}
