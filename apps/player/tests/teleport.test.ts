import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventCommand, GameMap } from '../src/types.js';
import { resolveTeleport, runTeleportFade, teleportFacing } from '../src/teleport.js';

const map = (id: number, tileSize = 48): GameMap => ({
  id, name: `Map ${id}`, ground: '#000', accent: '#fff', tileSize,
  bounds: { x: 0, y: 0, w: 10 * tileSize, h: 8 * tileSize },
  planes: [
    { id: 'upper', name: 'Upper', order: 2, surfaceLayerId: 'upper-surface', surfaceCoverage: 'bounds' },
    { id: 'default', name: 'Default', order: 0, surfaceLayerId: 'default-surface', surfaceCoverage: 'bounds' },
  ],
  tileLayers: [
    { id: 'upper-surface', name: 'Upper', planeId: 'upper', renderPhase: 'belowActors', tiles: [] },
    { id: 'default-surface', name: 'Default', planeId: 'default', renderPhase: 'belowActors', tiles: [] },
  ],
  planeConnections: [], navigationOverrides: [], blockedRegions: [], events: [], nextEventId: 1, enemySpawns: [],
});

const command = (overrides: Partial<Extract<EventCommand, { type: 'teleport' }>> = {}): Extract<EventCommand, { type: 'teleport' }> => ({
  type: 'teleport',
  destination: { map: { kind: 'constant', mapId: 1 }, x: { kind: 'constant', value: 2 }, y: { kind: 'constant', value: 3 } },
  direction: 'retain',
  transition: 'instant',
  ...overrides,
});

describe('teleport resolution', () => {
  const maps = { 1: map(1), 7: map(7, 32) };

  it('resolves map, X, and Y independently and uses the first ordered plane', () => {
    const resolved = resolveTeleport(command({
      destination: { map: { kind: 'variable', variableId: 1 }, x: { kind: 'constant', value: 2 }, y: { kind: 'variable', variableId: 3 } },
      direction: 'west', transition: 'fadeWhite',
    }), maps, { 1: 7, 3: 4 });

    expect(resolved).toEqual({ mapId: 7, position: { x: 80, y: 144, planeId: 'default' }, direction: 'west', transition: 'fadeWhite' });
  });

  it('rejects unknown or non-integer map ids and invalid coordinates', () => {
    const variableDestination = { map: { kind: 'variable' as const, variableId: 1 }, x: { kind: 'variable' as const, variableId: 2 }, y: { kind: 'constant' as const, value: 1 } };
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { 1: 7.5, 2: 2 })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { 1: 99, 2: 2 })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { 1: 7, 2: Number.NaN })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { 1: 7, 2: 2.5 })).toBeNull();
    expect(resolveTeleport(command({ destination: variableDestination }), maps, { 1: 7, 2: 10 })).toBeNull();
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
