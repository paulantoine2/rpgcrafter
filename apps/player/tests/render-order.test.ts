import { describe, expect, it } from 'vitest';
import { actorRenderZ, tileLayerRenderZ } from '../src/renderer.js';
import type { GameMap } from '../src/types.js';

describe('multi-plane render order', () => {
  it('places an actor below a later surface and its actor above that surface', () => {
    const map = {
      planes: [
        { id: 'path', name: 'Path', order: 0, surfaceLayerId: 'path-surface', surfaceCoverage: 'bounds' },
        { id: 'roof', name: 'Roof', order: 1, surfaceLayerId: 'roof-surface', surfaceCoverage: 'painted' },
      ],
      tileLayers: [
        { id: 'path-surface', name: 'Path surface', tileset: 't', planeId: 'path', renderPhase: 'belowActors', tiles: [] },
        { id: 'roof-surface', name: 'Roof surface', tileset: 't', planeId: 'roof', renderPhase: 'belowActors', tiles: [] },
      ],
    } as unknown as GameMap;
    const roof = map.tileLayers[1];
    expect(actorRenderZ(map, 'path', 100)).toBeLessThan(tileLayerRenderZ(map, roof, 1));
    expect(tileLayerRenderZ(map, roof, 1)).toBeLessThan(actorRenderZ(map, 'roof', 100));
  });
});
