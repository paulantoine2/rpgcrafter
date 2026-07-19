import type { Action, GameMap, MapEvent, PlanePosition, Vec2 } from './types.js';

type EventState = {
  cooldown: number;
  elapsed: number;
  inside: boolean;
  timerConsumed: boolean;
  visitExecuted: boolean;
};

export type EventRuntimeCallbacks = {
  isActive(event: MapEvent): boolean;
  canExecute(event: MapEvent): boolean;
  execute(event: MapEvent): { stop?: boolean } | void;
};

export function mapEventKey(mapId: string, eventId: string) { return `${mapId}:${eventId}`; }
export function teleportDisposition(currentMapId: string, action: Extract<Action, { type: 'teleport' }>) {
  if (!action.resetMap && action.mapId !== currentMapId) return 'invalid' as const;
  return action.resetMap ? 'reset' as const : 'local' as const;
}

/** Visit-scoped scheduler for every trigger attached to one map. */
export class MapEventRuntime {
  private mapId = '';
  private states = new Map<string, EventState>();

  constructor(private readonly oncePerGame: Set<string>) {}

  beginVisit(map: GameMap) {
    this.mapId = map.id;
    this.states = new Map(map.events.map(event => [event.id, {
      cooldown: 0,
      elapsed: event.trigger.type === 'interval' ? (event.trigger.initialDelay ?? event.trigger.every) : event.trigger.type === 'mapEnter' ? event.trigger.delay : 0,
      inside: false,
      timerConsumed: false,
      visitExecuted: false,
    }]));
  }

  update(map: GameMap, player: PlanePosition | Vec2, dt: number, callbacks: EventRuntimeCallbacks) {
    if (map.id !== this.mapId) this.beginVisit(map);
    for (const event of map.events) {
      const state = this.states.get(event.id)!;
      state.cooldown = Math.max(0, state.cooldown - dt);
      const active = this.samePlane(event, player) && callbacks.isActive(event);

      if (event.trigger.type === 'playerEnter') {
        const inside = active && this.playerInside(event, player);
        const entered = inside && !state.inside;
        state.inside = inside;
        if (entered && this.fire(map, event, state, callbacks)) return true;
        continue;
      }

      if (!active || event.trigger.type === 'interact' || state.timerConsumed) continue;
      state.elapsed -= dt;
      if (state.elapsed > 0) continue;

      if (event.trigger.type === 'interval') state.elapsed = event.trigger.every;
      else state.timerConsumed = true;
      if (this.fire(map, event, state, callbacks)) return true;
    }
    return false;
  }

  interact(map: GameMap, player: PlanePosition | Vec2, callbacks: EventRuntimeCallbacks) {
    if (map.id !== this.mapId) this.beginVisit(map);
    let selected: MapEvent | undefined;
    let selectedDistance = Infinity;
    for (const event of map.events) {
      if (!this.samePlane(event, player) || event.trigger.type !== 'interact' || !callbacks.isActive(event) || !callbacks.canExecute(event)) continue;
      const state = this.states.get(event.id)!;
      if (!this.canFire(map, event, state)) continue;
      const eventDistance = Math.hypot(player.x - event.position.x, player.y - event.position.y);
      if (eventDistance <= event.trigger.radius && eventDistance < selectedDistance) {
        selected = event;
        selectedDistance = eventDistance;
      }
    }
    if (!selected) return false;
    return this.fire(map, selected, this.states.get(selected.id)!, callbacks);
  }

  private samePlane(event: MapEvent, player: PlanePosition | Vec2) { return !('planeId' in player) || event.position.planeId === player.planeId; }

  private playerInside(event: MapEvent, player: PlanePosition | Vec2) {
    if (event.trigger.type !== 'playerEnter') return false;
    return this.samePlane(event, player)
      && Math.abs(player.x - event.position.x) <= event.trigger.size.w / 2
      && Math.abs(player.y - event.position.y) <= event.trigger.size.h / 2;
  }

  private canFire(map: GameMap, event: MapEvent, state: EventState) {
    if (state.cooldown > 0 || (event.execution.mode === 'oncePerVisit' && state.visitExecuted)) return false;
    return event.execution.mode !== 'oncePerGame' || !this.oncePerGame.has(mapEventKey(map.id, event.id));
  }

  private fire(map: GameMap, event: MapEvent, state: EventState, callbacks: EventRuntimeCallbacks) {
    if (!this.canFire(map, event, state) || !callbacks.canExecute(event)) return false;
    state.cooldown = event.execution.cooldown ?? 0;
    if (event.execution.mode === 'oncePerVisit') state.visitExecuted = true;
    if (event.execution.mode === 'oncePerGame') this.oncePerGame.add(mapEventKey(map.id, event.id));
    const result = callbacks.execute(event);
    return Boolean(result && result.stop === true);
  }
}
