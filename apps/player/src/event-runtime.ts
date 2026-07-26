import type { EventCommand, MapEvent, MapEventTrigger, PlanePosition, Vec2 } from './types.js';

type EventState = {
  pageIndex: number;
  inside: boolean;
};

export type RuntimeEvent = Pick<MapEvent, 'id' | 'position'> & {
  pageIndex: number;
  trigger: MapEventTrigger;
};

export type EventRuntimeCallbacks = {
  canExecute(event: RuntimeEvent): boolean;
  execute(event: RuntimeEvent): { stop?: boolean } | void;
};

export function teleportDisposition(currentMapId: string, command: Extract<EventCommand, { type: 'teleport' }>) {
  if (!command.resetMap && command.mapId !== currentMapId) return 'invalid' as const;
  return command.resetMap ? 'reset' as const : 'local' as const;
}

/** Page-aware scheduler for map-event triggers. */
export class MapEventRuntime {
  private mapId = '';
  private states = new Map<string, EventState>();

  beginVisit(mapId: string, events: RuntimeEvent[]) {
    this.mapId = mapId;
    this.states = new Map(events.map(event => [event.id, { pageIndex: event.pageIndex, inside: false }]));
  }

  update(mapId: string, events: RuntimeEvent[], player: PlanePosition | Vec2, callbacks: EventRuntimeCallbacks, playerRadius = 0) {
    this.sync(mapId, events);
    for (const event of events) {
      const state = this.states.get(event.id)!;
      if (event.trigger.type === 'playerTouch' || event.trigger.type === 'eventTouch') {
        const inside = this.playerInside(event, player, playerRadius);
        const entered = inside && !state.inside;
        state.inside = inside;
        if (entered && this.fire(event, callbacks)) return true;
        continue;
      }
      if ((event.trigger.type === 'autorun' || event.trigger.type === 'parallel') && this.fire(event, callbacks)) return true;
    }
    return false;
  }

  interact(mapId: string, events: RuntimeEvent[], player: PlanePosition | Vec2, callbacks: EventRuntimeCallbacks) {
    this.sync(mapId, events);
    let selected: RuntimeEvent | undefined;
    let selectedDistance = Infinity;
    for (const event of events) {
      if (!this.samePlane(event, player) || event.trigger.type !== 'actionButton' || !callbacks.canExecute(event)) continue;
      const eventDistance = Math.hypot(player.x - event.position.x, player.y - event.position.y);
      if (eventDistance <= event.trigger.radius && eventDistance < selectedDistance) {
        selected = event;
        selectedDistance = eventDistance;
      }
    }
    return selected ? this.fire(selected, callbacks) : false;
  }

  private sync(mapId: string, events: RuntimeEvent[]) {
    if (mapId !== this.mapId) return this.beginVisit(mapId, events);
    const activeIds = new Set(events.map(event => event.id));
    for (const id of this.states.keys()) if (!activeIds.has(id)) this.states.delete(id);
    for (const event of events) {
      const state = this.states.get(event.id);
      if (!state) this.states.set(event.id, { pageIndex: event.pageIndex, inside: false });
      else if (state.pageIndex !== event.pageIndex) {
        state.pageIndex = event.pageIndex;
        state.inside = false;
      }
    }
  }

  private samePlane(event: RuntimeEvent, player: PlanePosition | Vec2) {
    return !('planeId' in player) || event.position.planeId === player.planeId;
  }

  private playerInside(event: RuntimeEvent, player: PlanePosition | Vec2, playerRadius: number) {
    if (event.trigger.type !== 'playerTouch' && event.trigger.type !== 'eventTouch') return false;
    return this.samePlane(event, player)
      && Math.abs(player.x - event.position.x) <= event.trigger.size.w / 2 + playerRadius
      && Math.abs(player.y - event.position.y) <= event.trigger.size.h / 2 + playerRadius;
  }

  private fire(event: RuntimeEvent, callbacks: EventRuntimeCallbacks) {
    if (!callbacks.canExecute(event)) return false;
    const result = callbacks.execute(event);
    return Boolean(result && result.stop === true);
  }
}
