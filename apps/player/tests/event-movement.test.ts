import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_EVENT_MOVEMENT, EventMovementRuntime, type ActiveMovementEvent } from '../src/event-movement.js';
import type { GameMap, MovementRoute } from '../src/types.js';

function placed(id: number, movement: Partial<typeof DEFAULT_EVENT_MOVEMENT> = {}): ActiveMovementEvent {
  return {
    id,
    position: { x: 48, y: 48, planeId: 'p' },
    movement: { ...DEFAULT_EVENT_MOVEMENT, ...movement },
    priority: 'sameAsCharacters',
    pageIndex: 0,
  };
}

function mapWith(_events: ActiveMovementEvent[]): GameMap {
  return {
    id: 1, name: 'Map', ground: '#000', accent: '#000', tileSize: 48,
    bounds: { x: 0, y: 0, w: 480, h: 480 },
    planes: [{ id: 'p', name: 'P', order: 0, surfaceLayerId: 'surface', surfaceCoverage: 'bounds' }],
    tileLayers: [{ id: 'surface', name: 'Surface', planeId: 'p', renderPhase: 'belowActors', tiles: [] }],
    planeConnections: [], navigationOverrides: [], blockedRegions: [], events: [], nextEventId: 1, enemySpawns: [],
  };
}

const player = { x: 240, y: 48, planeId: 'p' };
const pass = () => true;

describe('EventMovementRuntime', () => {
  it('loops a custom autonomous route using RPG Maker tile speed', () => {
    const event = placed(1, { type: 'custom', speed: 4, frequency: 5, route: [{ type: 'move', direction: 'east' }] });
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([event]), player, [event]);
    runtime.update(0.01, player, pass);
    expect(runtime.actor(1)?.moving).toBe(true);
    runtime.update(0.3, player, pass);
    expect(runtime.actor(1)?.position.x).toBe(96);
    runtime.update(0.01, player, pass);
    runtime.update(0.3, player, pass);
    expect(runtime.actor(1)?.position.x).toBe(144);
  });

  it('always approaches and faces the player without falling back to random movement', () => {
    const runtime = new EventMovementRuntime();
    const chaser = placed(2, { type: 'approach', frequency: 5 });
    runtime.beginVisit(mapWith([chaser]), player, [chaser]);
    runtime.update(0.01, player, pass, () => 0);
    expect(runtime.actor(2)?.direction).toBe('east');
    expect(runtime.actor(2)?.moving).toBe(true);
  });

  it('never lets random autonomous movement leave the map, including with Through enabled', () => {
    const event = placed(3, { type: 'random', frequency: 5, through: true });
    event.position.x = 432;
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([event]), player, [event]);
    const rolls = [0, 0.49];
    runtime.update(0.01, player, pass, () => rolls.shift() ?? 0);
    expect(runtime.actor(3)?.position.x).toBe(432);
    expect(runtime.actor(3)?.moving).toBe(false);
  });

  it('honors direction fix while allowing sideways movement', () => {
    const runtime = new EventMovementRuntime();
    const block = placed(4, { type: 'custom', frequency: 5, directionFix: true, route: [{ type: 'move', direction: 'east' }] });
    runtime.beginVisit(mapWith([block]), player, [block]);
    runtime.update(0.01, player, pass);
    expect(runtime.actor(4)?.direction).toBe('south');
    expect(runtime.actor(4)?.moving).toBe(true);
  });

  it('skips a blocked forced step and resolves only after the whole route', async () => {
    const runtime = new EventMovementRuntime();
    const npc = placed(5);
    runtime.beginVisit(mapWith([npc]), player, [npc]);
    const route: MovementRoute = {
      commands: [{ type: 'move', direction: 'east' }, { type: 'turn', direction: 'north' }, { type: 'wait', duration: 0.2 }],
      repeat: false, skippable: true, wait: true,
    };
    const completed = vi.fn();
    void runtime.forceRoute({ kind: 'event', eventId: 5 }, route).then(completed);
    runtime.update(0.01, player, () => false);
    runtime.update(0.01, player, pass);
    expect(runtime.actor(5)?.direction).toBe('north');
    runtime.update(0.01, player, pass);
    expect(completed).not.toHaveBeenCalled();
    runtime.update(0.2, player, pass);
    await Promise.resolve();
    expect(completed).toHaveBeenCalledOnce();
  });

  it('retries a blocked non-skippable command and Through bypasses the collision callback', () => {
    const runtime = new EventMovementRuntime();
    const npc = placed(5);
    runtime.beginVisit(mapWith([npc]), player, [npc]);
    void runtime.forceRoute({ kind: 'event', eventId: 5 }, {
      commands: [{ type: 'move', direction: 'east' }], repeat: false, skippable: false, wait: true,
    });
    runtime.update(0.1, player, () => false);
    expect(runtime.actor(5)?.position.x).toBe(48);
    expect(runtime.isRouteRunning(5)).toBe(true);

    const throughRuntime = new EventMovementRuntime();
    const ghost = placed(6, { through: true });
    throughRuntime.beginVisit(mapWith([ghost]), player, [ghost]);
    void throughRuntime.forceRoute({ kind: 'event', eventId: 6 }, {
      commands: [{ type: 'move', direction: 'east' }], repeat: false, skippable: false, wait: false,
    });
    throughRuntime.update(0.01, player, () => false);
    expect(throughRuntime.actor(6)?.moving).toBe(true);
  });

  it('runs a forced player jump and exposes its completion promise', async () => {
    const runtime = new EventMovementRuntime();
    runtime.beginVisit(mapWith([]), player, []);
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
