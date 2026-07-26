import { describe, expect, it } from 'vitest';
import { resolveEventPage, type MapEvent } from '../src/index.js';

const page = (conditions?: MapEvent['pages'][number]['conditions']): MapEvent['pages'][number] => ({
  ...(conditions ? { conditions } : {}),
  movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
  options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
  priority: 'sameAsCharacters',
  trigger: { type: 'actionButton', radius: 1 },
  contents: [],
});

describe('resolveEventPage', () => {
  it('gives page 1 priority over later matching pages', () => {
    const event: MapEvent = {
      id: 'event',
      position: { x: 0, y: 0, planeId: 'plane' },
      pages: [page([{ kind: 'flag', id: 'first' }]), page([{ kind: 'flag', id: 'second' }]), page()],
    };
    const active = new Set(['first', 'second']);
    const resolved = resolveEventPage(event, conditions => conditions.every(condition => condition.kind === 'flag' && active.has(condition.id)));
    expect(resolved?.index).toBe(0);
  });

  it('falls through in order and returns nothing when no page matches', () => {
    const event: MapEvent = {
      id: 'event',
      position: { x: 0, y: 0, planeId: 'plane' },
      pages: [page([{ kind: 'flag', id: 'first' }]), page([{ kind: 'flag', id: 'second' }])],
    };
    const second = resolveEventPage(event, conditions => conditions.every(condition => condition.kind === 'flag' && condition.id === 'second'));
    expect(second?.index).toBe(1);
    expect(resolveEventPage(event, () => false)).toBeUndefined();
  });
});
