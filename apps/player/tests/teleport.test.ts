import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventCommand, GameMap } from '../src/types.js';
import { resolveTeleport, runTeleportFade, teleportFacing } from '../src/teleport.js';

const map = (id: string, numericId: number, tileSize = 48): GameMap => ({
  id, numericId, name: id, ground: '#000', accent: '#fff', tileSize,
  bounds: { x: 0, y: 0, w: 10 * tileSize, h: 8 * tileSize },
  planes: [
    { id: 'upper', name: 'Upper', order: 2, surfaceLayerId: 'upper-surface', surfaceCoverage: 'bounds' },
    { id: 'default', name: 'Default', order: 0, surfaceLayerId: 'default-surface', surfaceCoverage: 'bounds' },
  ],
  tileLayers: [
    { id: 'upper-surface', name: 'Upper', planeId: 'upper', renderPhase: 'belowActors', tiles: [] },
    { id: 'default-surface', name: 'Default', planeId: 'default', renderPhase: 'belowActors', tiles: [] },
  ],
  planeConnections: [], navigationOverrides: [], blockedRegions: [], events: [], enemySpawns: [],
});

const command = (overrides: Partial<Extract<EventCommand, { type: 'teleport' }>> = {}): Extract<EventCommand, { type: 'teleport' }> => ({
  type: 'teleport',
  destination: { map: { kind: 'constant', mapId: 'village' }, x: { kind: 'constant', value: 2 }, y: { kind: 'constant', value: 3 } },
  direction: 'retain',
  transition: 'instant',
  ...overrides,
});

describe('teleport resolution', () => {
  const maps = { village: map('village', 1), path: map('path', 7, 32) };

  it('resolves map, X, and Y independently and uses the first ordered plane', () => {
    const resolved = resolveTeleport(command({
      destination: { map: { kind: 'variable', variableId: 'map' }, x: { kind: 'constant', value: 2 }, y: { kind: 'variable', variableId: 'y' } },
      direction: 'west', transition: 'fadeWhite',
    }), maps, { map: 7, y: 4 });

    expect(resolved).toEqual({ mapId: 'path', position: { x: 80, y: 144, planeId: 'default' }, direction: 'west', transition: 'fadeWhite' });
  });

  it('rejects unknown or non-integer map ids and invalid coordinates', () => {
    const variableDestination = { map: { kind: 'variable' as const, variableId: 'map' }, x: { kind: 'variable' as const, variableId: 'x' }, y: { kind: 'constant' as const, value: 1 } };
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { map: 7.5, x: 2 })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { map: 99, x: 2 })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { map: 7, x: Number.NaN })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { map: 7, x: 2.5 })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { map: 7, x: 10 })).toBeNull();
  });

  it('keeps or applies the requested facing', () => {
    expect(teleportFacing('retain', { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(teleportFacing('north', { x: 1, y: 0 })).toEqual({ x: 0, y: -1 });
  });
});

describe('teleport fade', () => {
  afterEach(() => vi.useRealTimers());

  it('teleports at 300 ms and removes the overlay at 600 ms', async () => {
    vi.useFakeTimers();
    const overlay = { className: '' } as HTMLElement;
    const midpoint = vi.fn();
    const result = runTeleportFade(overlay, 'black', midpoint);
    expect(overlay.className).toContain('teleport-transition-black');
    expect(overlay.className).toContain('teleport-transition-active');

    await vi.advanceTimersByTimeAsync(299);
    expect(midpoint).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(midpoint).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(300);
    await result;
    expect(overlay.className).toBe('teleport-transition hidden');
  });
});
