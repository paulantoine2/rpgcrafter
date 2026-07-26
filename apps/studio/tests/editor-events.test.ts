import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../src/lib/source-game';
import { createMapEventAt, renameMapEvent } from '../src/lib/editor-events';

describe('event creation', () => {
  it('creates a placement and its editable script with unique ids', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 'map-1', { x: 4.5, y: 6.5, planeId: 'plane-1' });
    game.maps['map-1'].events.push(first.event);
    game.events.events[first.script.id] = first.script;
    const second = createMapEventAt(game, 'map-1', { x: 5.5, y: 6.5, planeId: 'plane-1' });

    expect(first.event).toMatchObject({ id: 'event-1', scriptId: 'event.map-1.event-1', position: { x: 4.5, y: 6.5, planeId: 'plane-1' }, trigger: { type: 'interact' } });
    expect(first.script).toEqual({ id: 'event.map-1.event-1', pages: [{ actions: [] }] });
    expect(second.event.id).toBe('event-2');
    expect(second.script.id).toBe('event.map-1.event-2');
  });
});

describe('event renaming', () => {
  it('renames the placement and movement-route references on the same map', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' });
    game.maps['map-1'].events.push(first.event);
    game.events.events[first.script.id] = first.script;
    const second = createMapEventAt(game, 'map-1', { x: 2, y: 1, planeId: 'plane-1' });
    second.script.pages[0].actions = [{
      type: 'movementRoute',
      target: { kind: 'event', eventId: first.event.id },
      route: { commands: [], repeat: false, skippable: false, wait: true },
    }];
    game.maps['map-1'].events.push(second.event);
    game.events.events[second.script.id] = second.script;

    const result = renameMapEvent(game, 'map-1', 'event-1', 'greeter');

    expect(result?.game.maps['map-1'].events[0].id).toBe('greeter');
    expect(result?.game.events.events[second.script.id].pages[0].actions[0]).toMatchObject({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 'greeter' },
    });
    expect(result?.scriptsChanged).toBe(true);
    expect(game.maps['map-1'].events[0].id).toBe('event-1');
  });

  it('rejects duplicate event ids', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' });
    game.maps['map-1'].events.push(first.event);
    game.events.events[first.script.id] = first.script;
    const second = createMapEventAt(game, 'map-1', { x: 2, y: 1, planeId: 'plane-1' });
    game.maps['map-1'].events.push(second.event);
    game.events.events[second.script.id] = second.script;

    expect(renameMapEvent(game, 'map-1', 'event-1', 'event-2')).toBeNull();
  });
});
