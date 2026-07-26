import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_EVENT_MOVEMENT, EventMovementRuntime } from '../src/event-movement.js';
import type { GameMap, MapEvent, MovementRoute } from '../src/types.js';

function placed(id: string, movement: Partial<typeof DEFAULT_EVENT_MOVEMENT> = {}): MapEvent {
  return {
    id,
    position: { x: 48, y: 48, planeId: 'p' },
    scriptId: `script.${id}`,
    trigger: { type: 'interact', radius: 48 },
    execution: { mode: 'repeat' },
    movement: { ...DEFAULT_EVENT_MOVEMENT, ...movement },
  };
}

function mapWith(events: MapEvent[]): GameMap {
  return {
    id: 'map', name: 'Map', ground: '#000', accent: '#000', tileSize: 48,
    bounds: { x: 0, y: 0, w: 480, h: 480 },
    planes: [{ id: 'p', name: 'P', order: 0, surfaceLayerId: 'surface', surfaceCoverage: 'bounds' }],
    tileLayers: [{ id: 'surface', name: 'Surface', planeId: 'p', renderPhase: 'belowActors', tiles: [] }],
    planeConnections: [], navigationOverrides: [], blockedRegions: [], events, enemySpawns: [],
  };
}

const player = { x: 240, y: 48, planeId: 'p' };
const pass = () => true;

describe('EventMovementRuntime', () => {
  it('loops a custom autonomous route using RPG Maker tile speed', () => {
    const event = placed('walker', { type: 'custom', speed: 4, frequency: 5, route: [{ type: 'move', direction: 'east' }] });
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([event]), player);
    runtime.update(0.01, player, pass);
    expect(runtime.actor('walker')?.moving).toBe(true);
    runtime.update(0.3, player, pass);
    expect(runtime.actor('walker')?.position.x).toBe(96);
    runtime.update(0.01, player, pass);
    runtime.update(0.3, player, pass);
    expect(runtime.actor('walker')?.position.x).toBe(144);
  });

  it('always approaches and faces the player without falling back to random movement', () => {
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([placed('chaser', { type: 'approach', frequency: 5 })]), player);
    runtime.update(0.01, player, pass, () => 0);
    expect(runtime.actor('chaser')?.direction).toBe('east');
    expect(runtime.actor('chaser')?.moving).toBe(true);
  });

  it('never lets random autonomous movement leave the map, including with Through enabled', () => {
    const event = placed('edge-walker', { type: 'random', frequency: 5, through: true });
    event.position.x = 432;
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([event]), player);
    const rolls = [0, 0.49];
    runtime.update(0.01, player, pass, () => rolls.shift() ?? 0);
    expect(runtime.actor('edge-walker')?.position.x).toBe(432);
    expect(runtime.actor('edge-walker')?.moving).toBe(false);
  });

  it('honors direction fix while allowing sideways movement', () => {
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([placed('block', { type: 'custom', frequency: 5, directionFix: true, route: [{ type: 'move', direction: 'east' }] })]), player);
    runtime.update(0.01, player, pass);
    expect(runtime.actor('block')?.direction).toBe('south');
    expect(runtime.actor('block')?.moving).toBe(true);
  });

  it('skips a blocked forced step and resolves only after the whole route', async () => {
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([placed('npc')]), player);
    const route: MovementRoute = {
      commands: [{ type: 'move', direction: 'east' }, { type: 'turn', direction: 'north' }, { type: 'wait', duration: 0.2 }],
      repeat: false, skippable: true, wait: true,
    };
    const completed = vi.fn();
    void runtime.forceRoute({ kind: 'event', eventId: 'npc' }, route).then(completed);
    runtime.update(0.01, player, () => false);
    runtime.update(0.01, player, pass);
    expect(runtime.actor('npc')?.direction).toBe('north');
    runtime.update(0.01, player, pass);
    expect(completed).not.toHaveBeenCalled();
    runtime.update(0.2, player, pass);
    await Promise.resolve();
    expect(completed).toHaveBeenCalledOnce();
  });

  it('retries a blocked non-skippable command and Through bypasses the collision callback', () => {
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([placed('npc')]), player);
    void runtime.forceRoute({ kind: 'event', eventId: 'npc' }, {
      commands: [{ type: 'move', direction: 'east' }], repeat: false, skippable: false, wait: true,
    });
    runtime.update(0.1, player, () => false);
    expect(runtime.actor('npc')?.position.x).toBe(48);
    expect(runtime.isRouteRunning('npc')).toBe(true);

    const throughRuntime = new EventMovementRuntime();
    throughRuntime.beginVisit(mapWith([placed('ghost', { through: true })]), player);
    void throughRuntime.forceRoute({ kind: 'event', eventId: 'ghost' }, {
      commands: [{ type: 'move', direction: 'east' }], repeat: false, skippable: false, wait: false,
    });
    throughRuntime.update(0.01, player, () => false);
    expect(throughRuntime.actor('ghost')?.moving).toBe(true);
  });

  it('runs a forced player jump and exposes its completion promise', async () => {
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([]), player);
    const completion = runtime.forceRoute({ kind: 'player' }, {
      commands: [{ type: 'jump', x: 1, y: -1 }], repeat: false, skippable: false, wait: true,
    });
    runtime.update(0.01, player, pass);
    runtime.update(0.3, player, pass);
    await completion;
    expect(runtime.actor('player')?.position).toMatchObject({ x: 288, y: 0 });
    expect(runtime.isPlayerForced()).toBe(false);
  });
});
