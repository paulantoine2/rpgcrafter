import { describe, expect, it } from 'vitest';
import { MapEventRuntime, teleportDisposition, type RuntimeEvent } from '../src/event-runtime.js';

function placed(id: string, trigger: RuntimeEvent['trigger'], pageIndex = 0): RuntimeEvent {
  return { id, position: { x: 100, y: 100, planeId: 'p' }, pageIndex, trigger };
}

function callbacks(executed: string[], busy = new Set<string>()) {
  return {
    canExecute: (event: RuntimeEvent) => !busy.has(event.id),
    execute: (event: RuntimeEvent) => { executed.push(event.id); },
  };
}

describe('MapEventRuntime', () => {
  it('déclenche Player Touch une fois par nouveau contact', () => {
    const event = placed('zone', { type: 'playerTouch', size: { w: 20, h: 20 } });
    const executed: string[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit('map', [event]);
    runtime.update('map', [event], { x: 50, y: 50 }, callbacks(executed));
    runtime.update('map', [event], { x: 100, y: 100 }, callbacks(executed));
    runtime.update('map', [event], { x: 102, y: 102 }, callbacks(executed));
    runtime.update('map', [event], { x: 50, y: 50 }, callbacks(executed));
    runtime.update('map', [event], { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual(['zone', 'zone']);
  });

  it('sélectionne l’Action Button actif le plus proche', () => {
    const first = placed('first', { type: 'actionButton', radius: 100 });
    const nearest = { ...placed('nearest', { type: 'actionButton', radius: 100 }), position: { x: 110, y: 100, planeId: 'p' } };
    const busy = { ...placed('busy', { type: 'actionButton', radius: 100 }), position: { x: 105, y: 100, planeId: 'p' } };
    const events = [first, nearest, busy];
    const executed: string[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit('map', events);
    runtime.interact('map', events, { x: 109, y: 100 }, callbacks(executed, new Set(['busy'])));
    expect(executed).toEqual(['nearest']);
  });

  it('ignore les événements placés sur un autre plan', () => {
    const event = placed('other-plane', { type: 'actionButton', radius: 100 });
    event.position.planeId = 'other';
    const executed: string[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit('map', [event]);
    expect(runtime.interact('map', [event], { x: 100, y: 100, planeId: 'p' }, callbacks(executed))).toBe(false);
    expect(executed).toEqual([]);
  });

  it('relance Autorun et Parallel à chaque tick lorsque leur interpréteur est disponible', () => {
    const autorun = placed('autorun', { type: 'autorun' });
    const parallel = placed('parallel', { type: 'parallel' });
    const events = [autorun, parallel];
    const executed: string[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit('map', events);
    runtime.update('map', events, { x: 0, y: 0 }, callbacks(executed));
    runtime.update('map', events, { x: 0, y: 0 }, callbacks(executed));
    expect(executed).toEqual(['autorun', 'parallel', 'autorun', 'parallel']);
  });

  it('réinitialise le contact lorsque la page active change', () => {
    const first = placed('event', { type: 'playerTouch', size: { w: 20, h: 20 } }, 0);
    const second = placed('event', { type: 'playerTouch', size: { w: 20, h: 20 } }, 1);
    const executed: string[] = [];
    const runtime = new MapEventRuntime();
    runtime.beginVisit('map', [first]);
    runtime.update('map', [first], { x: 100, y: 100 }, callbacks(executed));
    runtime.update('map', [second], { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual(['event', 'event']);
  });
});

describe('teleportDisposition', () => {
  const position = { x: 1, y: 2, planeId: 'p' };

  it('distingue déplacement local, reset local, transition et destination invalide', () => {
    expect(teleportDisposition('village', { type: 'teleport', mapId: 'village', position, resetMap: false })).toBe('local');
    expect(teleportDisposition('village', { type: 'teleport', mapId: 'village', position, resetMap: true })).toBe('reset');
    expect(teleportDisposition('village', { type: 'teleport', mapId: 'path', position, resetMap: true })).toBe('reset');
    expect(teleportDisposition('village', { type: 'teleport', mapId: 'path', position, resetMap: false })).toBe('invalid');
  });
});
