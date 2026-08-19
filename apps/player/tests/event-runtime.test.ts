import { describe, expect, it } from 'vitest';
import { MapEventRuntime, teleportDisposition, type RuntimeEvent } from '../src/event-runtime.js';

function placed(id: number, trigger: RuntimeEvent['trigger'], pageIndex = 0): RuntimeEvent {
  return { id, position: { x: 100, y: 100, planeId: 'p' }, pageIndex, trigger };
}

function callbacks(executed: number[], busy = new Set<number>()) {
  return {
    canExecute: (event: RuntimeEvent) => !busy.has(event.id),
    execute: (event: RuntimeEvent) => { executed.push(event.id); },
  };
}

describe('MapEventRuntime', () => {
  it('déclenche Player Touch une fois par nouveau contact', () => {
    const event = placed(1, { type: 'playerTouch', size: { w: 20, h: 20 } });
    const executed: number[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit(1, [event]);
    runtime.update(1, [event], { x: 50, y: 50 }, callbacks(executed));
    runtime.update(1, [event], { x: 100, y: 100 }, callbacks(executed));
    runtime.update(1, [event], { x: 102, y: 102 }, callbacks(executed));
    runtime.update(1, [event], { x: 50, y: 50 }, callbacks(executed));
    runtime.update(1, [event], { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual([1, 1]);
  });

  it('sélectionne l’Action Button actif le plus proche', () => {
    const first = placed(1, { type: 'actionButton', radius: 100 });
    const nearest = { ...placed(2, { type: 'actionButton', radius: 100 }), position: { x: 110, y: 100, planeId: 'p' } };
    const busy = { ...placed(3, { type: 'actionButton', radius: 100 }), position: { x: 105, y: 100, planeId: 'p' } };
    const events = [first, nearest, busy];
    const executed: number[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit(1, events);
    runtime.interact(1, events, { x: 109, y: 100 }, callbacks(executed, new Set([3])));
    expect(executed).toEqual([2]);
  });

  it('ignore les événements placés sur un autre plan', () => {
    const event = placed(1, { type: 'actionButton', radius: 100 });
    event.position.planeId = 'other';
    const executed: number[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit(1, [event]);
    expect(runtime.interact(1, [event], { x: 100, y: 100, planeId: 'p' }, callbacks(executed))).toBe(false);
    expect(executed).toEqual([]);
  });

  it('relance Autorun et Parallel à chaque tick lorsque leur interpréteur est disponible', () => {
    const autorun = placed(1, { type: 'autorun' });
    const parallel = placed(2, { type: 'parallel' });
    const events = [autorun, parallel];
    const executed: number[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit(1, events);
    runtime.update(1, events, { x: 0, y: 0 }, callbacks(executed));
    runtime.update(1, events, { x: 0, y: 0 }, callbacks(executed));
    expect(executed).toEqual([1, 2, 1, 2]);
  });

  it('réinitialise le contact lorsque la page active change', () => {
    const first = placed(1, { type: 'playerTouch', size: { w: 20, h: 20 } }, 0);
    const second = placed(1, { type: 'playerTouch', size: { w: 20, h: 20 } }, 1);
    const executed: number[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit(1, [first]);
    runtime.update(1, [first], { x: 100, y: 100 }, callbacks(executed));
    runtime.update(1, [second], { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual([1, 1]);
  });
});

describe('teleportDisposition', () => {
  it('distinguishes a local relocation from a new map visit', () => {
    expect(teleportDisposition(1, 1)).toBe('local');
    expect(teleportDisposition(1, 2)).toBe('visit');
  });
});
