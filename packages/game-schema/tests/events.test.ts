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
  it('gives the highest-numbered matching page priority', () => {
    const event: MapEvent = {
      id: 'event',
      position: { x: 0, y: 0, planeId: 'plane' },
      pages: [page(), page([{ kind: 'switch', id: 'first', operand: { kind: 'constant', value: true } }]), page([{ kind: 'switch', id: 'second', operand: { kind: 'constant', value: true } }])],
    };
    const active = new Set(['first', 'second']);
    const resolved = resolveEventPage(event, conditions => conditions.every(condition => condition.kind === 'switch' && active.has(condition.id)));
    expect(resolved?.index).toBe(2);
  });

  it('falls back toward page 1 and returns nothing when no page matches', () => {
    const event: MapEvent = {
      id: 'event',
      position: { x: 0, y: 0, planeId: 'plane' },
      pages: [page(), page([{ kind: 'switch', id: 'first', operand: { kind: 'constant', value: true } }]), page([{ kind: 'switch', id: 'second', operand: { kind: 'constant', value: true } }])],
    };
    const firstSwitch = resolveEventPage(event, conditions => conditions.every(condition => condition.kind === 'switch' && condition.id === 'first'));
    expect(firstSwitch?.index).toBe(1);
    expect(resolveEventPage(event, conditions => conditions.length === 0)?.index).toBe(0);

    const conditionalOnly = { ...event, pages: event.pages.slice(1) };
    expect(resolveEventPage(conditionalOnly, () => false)).toBeUndefined();
  });
});
