import { describe, expect, it } from 'vitest';
import { MapEventRuntime, teleportDisposition } from '../src/event-runtime.js';
import type { GameMap, MapEvent } from '../src/types.js';

function mapWith(events: MapEvent[]): GameMap {
  return { id: 'map', name: 'Map', ground: '#000', accent: '#000', tileSize: 48, bounds: { x: 0, y: 0, w: 500, h: 500 }, planes: [{ id: 'p', name: 'P', order: 0, surfaceLayerId: 'surface', surfaceCoverage: 'bounds' }], tileLayers: [{ id: 'surface', name: 'Surface', planeId: 'p', renderPhase: 'belowActors', tiles: [] }], planeConnections: [], navigationOverrides: [], blockedRegions: [], events, enemySpawns: [] };
}

function placed(id: string, trigger: MapEvent['trigger'], mode: MapEvent['execution']['mode'] = 'repeat'): MapEvent {
  return { id, position: { x: 100, y: 100, planeId: 'p' }, scriptId: `script.${id}`, trigger, execution: { mode } };
}

function callbacks(executed: string[], inactive = new Set<string>()) {
  return { isActive: (event: MapEvent) => !inactive.has(event.id), canExecute: () => true, execute: (event: MapEvent) => { executed.push(event.id); } };
}

describe('MapEventRuntime', () => {
  it('déclenche playerEnter à chaque nouvelle entrée seulement', () => {
    const map = mapWith([placed('zone', { type: 'playerEnter', size: { w: 20, h: 20 } })]);
    const executed: string[] = [];
    const runtime = new MapEventRuntime(new Set());
    runtime.beginVisit(map);
    runtime.update(map, { x: 50, y: 50 }, 0.1, callbacks(executed));
    runtime.update(map, { x: 100, y: 100 }, 0.1, callbacks(executed));
    runtime.update(map, { x: 102, y: 102 }, 0.1, callbacks(executed));
    runtime.update(map, { x: 50, y: 50 }, 0.1, callbacks(executed));
    runtime.update(map, { x: 100, y: 100 }, 0.1, callbacks(executed));
    expect(executed).toEqual(['zone', 'zone']);
  });

  it('sélectionne l’interaction active la plus proche et conserve l’ordre en cas d’égalité', () => {
    const first = placed('first', { type: 'interact', radius: 100 });
    const nearest = { ...placed('nearest', { type: 'interact', radius: 100 }), position: { x: 110, y: 100, planeId: 'p' } };
    const inactive = { ...placed('inactive', { type: 'interact', radius: 100 }), position: { x: 105, y: 100, planeId: 'p' } };
    const map = mapWith([first, nearest, inactive]);
    const executed: string[] = [];
    const runtime = new MapEventRuntime(new Set());
    runtime.beginVisit(map);
    runtime.interact(map, { x: 109, y: 100 }, callbacks(executed, new Set(['inactive'])));
    expect(executed).toEqual(['nearest']);
  });

  it('ignore les événements placés sur un autre plan', () => {
    const event = placed('other-plane', { type: 'interact', radius: 100 });
    event.position.planeId = 'other';
    const map = mapWith([event]), executed: string[] = [];
    const runtime = new MapEventRuntime(new Set()); runtime.beginVisit(map);
    expect(runtime.interact(map, { x: 100, y: 100, planeId: 'p' }, callbacks(executed))).toBe(false);
    expect(executed).toEqual([]);
  });

  it('applique le cooldown aux exécutions répétables', () => {
    const event = placed('cooldown', { type: 'interact', radius: 50 });
    event.execution.cooldown = 2;
    const map = mapWith([event]);
    const executed: string[] = [];
    const runtime = new MapEventRuntime(new Set());
    runtime.beginVisit(map);
    runtime.interact(map, { x: 100, y: 100 }, callbacks(executed));
    runtime.interact(map, { x: 100, y: 100 }, callbacks(executed));
    runtime.update(map, { x: 100, y: 100 }, 2, callbacks(executed));
    runtime.interact(map, { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual(['cooldown', 'cooldown']);
  });

  it('respecte les délais sans rattraper plusieurs intervalles en une frame', () => {
    const interval = placed('interval', { type: 'interval', every: 3, initialDelay: 2 });
    const arrival = placed('arrival', { type: 'mapEnter', delay: 1 }, 'oncePerVisit');
    const map = mapWith([interval, arrival]);
    const executed: string[] = [];
    const runtime = new MapEventRuntime(new Set());
    runtime.beginVisit(map);
    runtime.update(map, { x: 0, y: 0 }, 1, callbacks(executed));
    expect(executed).toEqual(['arrival']);
    runtime.update(map, { x: 0, y: 0 }, 1, callbacks(executed));
    expect(executed).toEqual(['arrival', 'interval']);
    runtime.update(map, { x: 0, y: 0 }, 20, callbacks(executed));
    expect(executed).toEqual(['arrival', 'interval', 'interval']);
  });

  it('ne fait pas avancer les timers lorsque la boucle de gameplay est suspendue', () => {
    const map = mapWith([placed('arrival', { type: 'mapEnter', delay: 2 }, 'oncePerVisit')]);
    const executed: string[] = [];
    const runtime = new MapEventRuntime(new Set());
    runtime.beginVisit(map);
    runtime.update(map, { x: 0, y: 0 }, 1, callbacks(executed));
    // Le moteur ne passe aucun temps au scheduler pendant un dialogue, une pause ou un onglet masqué.
    expect(executed).toEqual([]);
    runtime.update(map, { x: 0, y: 0 }, 1, callbacks(executed));
    expect(executed).toEqual(['arrival']);
  });

  it('réinitialise oncePerVisit mais conserve oncePerGame entre les visites', () => {
    const visit = placed('visit', { type: 'interact', radius: 50 }, 'oncePerVisit');
    const game = placed('game', { type: 'interact', radius: 50 }, 'oncePerGame');
    const map = mapWith([visit, game]);
    const completed = new Set<string>();
    const executed: string[] = [];
    const runtime = new MapEventRuntime(completed);
    runtime.beginVisit(map);
    runtime.interact(map, { x: 100, y: 100 }, callbacks(executed));
    runtime.interact(map, { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual(['visit', 'game']);
    runtime.beginVisit(map);
    runtime.interact(map, { x: 100, y: 100 }, callbacks(executed));
    expect(executed).toEqual(['visit', 'game', 'visit']);
    expect([...completed]).toEqual(['map:game']);
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
