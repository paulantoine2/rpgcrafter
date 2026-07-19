import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../src/lib/source-game';
import { createMapEventAt } from '../src/lib/editor-events';

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
