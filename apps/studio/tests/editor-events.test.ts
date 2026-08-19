import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../src/lib/source-game';
import { createMapEventAt, renameMapEvent } from '../src/lib/editor-events';

describe('event creation', () => {
  it('creates an event with one inline page and a unique id', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 1, { x: 4.5, y: 6.5, planeId: 'plane-1' });
    game.maps[1].events.push(first);
    game.maps[1].nextEventId += 1;
    const second = createMapEventAt(game, 1, { x: 5.5, y: 6.5, planeId: 'plane-1' });

    expect(first).toMatchObject({
      id: 1,
      name: 'Event 1',
      position: { x: 4.5, y: 6.5, planeId: 'plane-1' },
      pages: [{ trigger: { type: 'actionButton' }, contents: [] }],
    });
    expect(second.id).toBe(2);
  });
});

describe('event renaming', () => {
  it('renames the event without changing its numeric references', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 1, { x: 1, y: 1, planeId: 'plane-1' });
    game.maps[1].events.push(first);
    game.maps[1].nextEventId += 1;
    const second = createMapEventAt(game, 1, { x: 2, y: 1, planeId: 'plane-1' });
    second.pages[0].contents = [{
      type: 'movementRoute',
      target: { kind: 'event', eventId: first.id },
      route: { commands: [], repeat: false, skippable: false, wait: true },
    }];
    game.maps[1].events.push(second);

    const result = renameMapEvent(game, 1, 1, 'greeter');

    expect(result?.maps[1].events[0]).toMatchObject({ id: 1, name: 'greeter' });
    expect(result?.maps[1].events[1].pages[0].contents[0]).toMatchObject({
      type: 'movementRoute',
      target: { kind: 'event', eventId: 1 },
    });
    expect(game.maps[1].events[0].name).toBe('Event 1');
  });

  it('rejects empty event names', () => {
    const game = createEmptyProject('Events').game;
    const first = createMapEventAt(game, 1, { x: 1, y: 1, planeId: 'plane-1' });
    game.maps[1].events.push(first);
    expect(renameMapEvent(game, 1, 1, '   ')).toBeNull();
  });
});
