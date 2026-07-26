import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../src/lib/source-game';
import { createMapEventAt, renameMapEvent } from '../src/lib/editor-events';

describe('event creation', () => {
  it('creates an event with one inline page and a unique id', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 'map-1', { x: 4.5, y: 6.5, planeId: 'plane-1' });
    game.maps['map-1'].events.push(first);
    const second = createMapEventAt(game, 'map-1', { x: 5.5, y: 6.5, planeId: 'plane-1' });

    expect(first).toMatchObject({
      id: 'event-1',
      position: { x: 4.5, y: 6.5, planeId: 'plane-1' },
      pages: [{ trigger: { type: 'actionButton' }, contents: [] }],
    });
    expect(second.id).toBe('event-2');
  });
});

describe('event renaming', () => {
  it('renames the event and movement-route references on the same map', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' });
    game.maps['map-1'].events.push(first);
    const second = createMapEventAt(game, 'map-1', { x: 2, y: 1, planeId: 'plane-1' });
    second.pages[0].contents = [{
      type: 'movementRoute',
      target: { kind: 'event', eventId: first.id },
      route: { commands: [], repeat: false, skippable: false, wait: true },
    }];
    game.maps['map-1'].events.push(second);

    const result = renameMapEvent(game, 'map-1', 'event-1', 'greeter');

    expect(result?.game.maps['map-1'].events[0].id).toBe('greeter');
    expect(result?.game.maps['map-1'].events[1].pages[0].contents[0]).toMatchObject({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 'greeter' },
    });
    expect(game.maps['map-1'].events[0].id).toBe('event-1');
  });

  it('rejects duplicate event ids', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' });
    game.maps['map-1'].events.push(first);
    const second = createMapEventAt(game, 'map-1', { x: 2, y: 1, planeId: 'plane-1' });
    game.maps['map-1'].events.push(second);

    expect(renameMapEvent(game, 'map-1', 'event-1', 'event-2')).toBeNull();
  });
});
