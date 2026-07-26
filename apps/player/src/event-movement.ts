import type {
  Direction, EventMovement, GameMap, MapEvent, MapEventPriority, MovementCommand, MovementRoute, MovementTarget, PlanePosition,
} from './types.js';

const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west'];
const OFFSETS: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
};
const OPPOSITE: Record<Direction, Direction> = { north: 'south', east: 'west', south: 'north', west: 'east' };
const LEFT: Record<Direction, Direction> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const RIGHT: Record<Direction, Direction> = { north: 'east', east: 'south', south: 'west', west: 'north' };

export const DEFAULT_EVENT_MOVEMENT: EventMovement = {
  type: 'fixed',
  speed: 3,
  frequency: 3,
  route: [],
  walkingAnimation: true,
  steppingAnimation: false,
  directionFix: false,
  through: false,
};

type Motion = { from: PlanePosition; to: PlanePosition; elapsed: number; duration: number; jump: boolean };
type ForcedRoute = { route: MovementRoute; index: number; resolve: () => void };
export type MovementActor = {
  id: string;
  position: PlanePosition;
  direction: Direction;
  moving: boolean;
  animationTime: number;
  jumpHeight: number;
  settings: EventMovement;
  priority: MapEventPriority;
  pageIndex: number;
};
export type ActiveMovementEvent = Pick<MapEvent, 'id' | 'position'> & { movement: EventMovement; priority: MapEventPriority; pageIndex: number };
type InternalActor = MovementActor & {
  event?: ActiveMovementEvent;
  motion?: Motion;
  waitRemaining: number;
  stopRemaining: number;
  customIndex: number;
  forced?: ForcedRoute;
};

export type MovementCollision = (actorId: string, from: PlanePosition, to: PlanePosition, through: boolean) => boolean;

/**
 * RPG Maker-style tile movement shared by ambient event behavior and forced routes.
 * It intentionally accepts structured commands only; no command can evaluate text as code.
 */
export class EventMovementRuntime {
  private map: GameMap | null = null;
  private actors = new Map<string, InternalActor>();

  beginVisit(map: GameMap, player: PlanePosition, events: ActiveMovementEvent[]) {
    for (const actor of this.actors.values()) actor.forced?.resolve();
    this.map = map;
    this.actors = new Map(events.map(event => [event.id, this.makeEventActor(event)]));
    this.actors.set('player', this.makePlayerActor(player));
  }

  syncEvents(events: ActiveMovementEvent[]) {
    const activeIds = new Set(events.map(event => event.id));
    for (const [id, actor] of this.actors) {
      if (id === 'player' || activeIds.has(id)) continue;
      actor.forced?.resolve();
      this.actors.delete(id);
    }
    for (const event of events) {
      const actor = this.actors.get(event.id);
      if (!actor) {
        this.actors.set(event.id, this.makeEventActor(event));
        continue;
      }
      if (actor.pageIndex !== event.pageIndex) {
        actor.pageIndex = event.pageIndex;
        actor.customIndex = 0;
        actor.stopRemaining = 0;
      }
      actor.event = event;
      actor.priority = event.priority;
      actor.settings = { ...event.movement, route: [...event.movement.route] };
    }
  }

  syncPlayer(player: PlanePosition) {
    const actor = this.actors.get('player');
    if (!actor || actor.forced) return;
    actor.position = { x: player.x, y: player.y, planeId: player.planeId };
  }

  actor(id: string) { return this.actors.get(id); }
  eventActors() { return [...this.actors.values()].filter(actor => actor.id !== 'player'); }
  isPlayerForced() { return Boolean(this.actors.get('player')?.forced); }
  isRouteRunning(id: string) { return Boolean(this.actors.get(id)?.forced); }
  faceToward(id: string, target: PlanePosition) {
    const actor = this.actors.get(id);
    if (actor && !actor.settings.directionFix && actor.position.planeId === target.planeId) actor.direction = this.toward(actor.position, target);
  }

  forceRoute(target: MovementTarget, route: MovementRoute, currentEventId?: string) {
    const id = target.kind === 'player' ? 'player' : target.kind === 'thisEvent' ? currentEventId : target.eventId;
    const actor = id ? this.actors.get(id) : undefined;
    if (!actor) return Promise.resolve();
    actor.forced?.resolve();
    return new Promise<void>(resolve => {
      if (!route.commands.length) return resolve();
      actor.forced = { route: structuredClone(route), index: 0, resolve };
      actor.waitRemaining = 0;
      actor.stopRemaining = 0;
    });
  }

  update(dt: number, player: PlanePosition, canMove: MovementCollision, random = Math.random) {
    if (!this.map) return;
    this.syncPlayer(player);
    for (const actor of this.actors.values()) {
      this.updateAnimation(actor, dt);
      if (actor.motion) {
        this.updateMotion(actor, dt);
        continue;
      }
      if (actor.waitRemaining > 0) {
        actor.waitRemaining = Math.max(0, actor.waitRemaining - dt);
        if (actor.waitRemaining === 0 && actor.forced) this.advanceForced(actor);
        continue;
      }
      if (actor.forced) this.updateForced(actor, canMove, player, random);
      else if (actor.event) this.updateAutonomous(actor, dt, canMove, player, random);
    }
  }

  private makeEventActor(event: ActiveMovementEvent): InternalActor {
    return {
      id: event.id,
      event,
      position: { ...event.position },
      direction: 'south',
      moving: false,
      animationTime: 0,
      jumpHeight: 0,
      settings: { ...event.movement, route: [...event.movement.route] },
      priority: event.priority,
      pageIndex: event.pageIndex,
      waitRemaining: 0,
      stopRemaining: 0,
      customIndex: 0,
    };
  }

  private makePlayerActor(player: PlanePosition): InternalActor {
    return {
      id: 'player',
      position: { ...player },
      direction: 'south',
      moving: false,
      animationTime: 0,
      jumpHeight: 0,
      settings: { ...DEFAULT_EVENT_MOVEMENT, speed: 4 },
      priority: 'sameAsCharacters',
      pageIndex: 0,
      waitRemaining: 0,
      stopRemaining: 0,
      customIndex: 0,
    };
  }

  private updateAnimation(actor: InternalActor, dt: number) {
    const animate = actor.settings.steppingAnimation || (actor.settings.walkingAnimation && actor.moving);
    actor.animationTime = animate ? actor.animationTime + dt : 0;
  }

  private updateMotion(actor: InternalActor, dt: number) {
    const motion = actor.motion!;
    motion.elapsed = Math.min(motion.duration, motion.elapsed + dt);
    const progress = motion.duration ? motion.elapsed / motion.duration : 1;
    actor.position.x = motion.from.x + (motion.to.x - motion.from.x) * progress;
    actor.position.y = motion.from.y + (motion.to.y - motion.from.y) * progress;
    actor.position.planeId = progress === 1 ? motion.to.planeId : motion.from.planeId;
    actor.jumpHeight = motion.jump ? Math.sin(progress * Math.PI) * this.map!.tileSize * 0.5 : 0;
    actor.moving = progress < 1;
    if (progress < 1) return;
    actor.motion = undefined;
    actor.jumpHeight = 0;
    actor.moving = false;
    if (actor.forced) this.advanceForced(actor);
    else actor.stopRemaining = this.frequencyPause(actor.settings.frequency);
  }

  private updateForced(actor: InternalActor, canMove: MovementCollision, player: PlanePosition, random: () => number) {
    const forced = actor.forced!;
    const command = forced.route.commands[forced.index];
    const completed = this.executeCommand(actor, command, canMove, player, random);
    if (completed === 'instant') this.advanceForced(actor);
    if (completed === 'blocked' && forced.route.skippable) this.advanceForced(actor);
  }

  private advanceForced(actor: InternalActor) {
    const forced = actor.forced;
    if (!forced) return;
    forced.index += 1;
    if (forced.index < forced.route.commands.length) return;
    if (forced.route.repeat) {
      forced.index = 0;
      return;
    }
    actor.forced = undefined;
    forced.resolve();
  }

  private updateAutonomous(actor: InternalActor, dt: number, canMove: MovementCollision, player: PlanePosition, random: () => number) {
    if (actor.settings.type === 'fixed') return;
    actor.stopRemaining -= dt;
    if (actor.stopRemaining > 0) return;
    let command: MovementCommand | undefined;
    if (actor.settings.type === 'custom') {
      if (!actor.settings.route.length) return;
      command = actor.settings.route[actor.customIndex];
      actor.customIndex = (actor.customIndex + 1) % actor.settings.route.length;
    } else if (actor.settings.type === 'random') {
      const roll = Math.floor(random() * 6);
      command = roll <= 1 ? { type: 'move', direction: 'random' } : roll === 2 ? { type: 'move', direction: 'forward' } : undefined;
    } else command = { type: 'move', direction: 'towardPlayer' };
    if (command) this.executeCommand(actor, command, canMove, player, random);
    if (!actor.motion) actor.stopRemaining = this.frequencyPause(actor.settings.frequency);
  }

  private executeCommand(actor: InternalActor, command: MovementCommand, canMove: MovementCollision, player: PlanePosition, random: () => number): 'started' | 'instant' | 'blocked' {
    if (command.type === 'wait') {
      actor.waitRemaining = command.duration;
      return command.duration > 0 ? 'started' : 'instant';
    }
    if (command.type === 'turn') {
      if (!actor.settings.directionFix) actor.direction = this.resolveTurn(actor, command.direction, player, random);
      return 'instant';
    }
    if (command.type === 'jump') {
      const to = { ...actor.position, x: actor.position.x + command.x * this.map!.tileSize, y: actor.position.y + command.y * this.map!.tileSize };
      const distance = Math.hypot(command.x, command.y);
      this.startMotion(actor, to, Math.max(0.2, distance * 0.16), true);
      return 'started';
    }
    let direction = this.resolveMoveDirection(actor, command.direction, player, random);
    if (!direction) return 'blocked';
    if (!actor.settings.directionFix && command.direction !== 'backward') actor.direction = direction;
    let to = this.destination(actor, direction);
    if (!this.insideMap(to) || (!actor.settings.through && !canMove(actor.id, actor.position, to, false))) {
      const fallback = this.approachFallback(actor.position, player, command.direction, direction);
      if (!fallback) return 'blocked';
      direction = fallback;
      if (!actor.settings.directionFix) actor.direction = direction;
      to = this.destination(actor, direction);
      if (!this.insideMap(to) || (!actor.settings.through && !canMove(actor.id, actor.position, to, false))) return 'blocked';
    }
    const pixelsPerSecond = this.map!.tileSize * (2 ** actor.settings.speed) * 60 / 256;
    this.startMotion(actor, to, this.map!.tileSize / pixelsPerSecond, false);
    return 'started';
  }

  private startMotion(actor: InternalActor, to: PlanePosition, duration: number, jump: boolean) {
    actor.motion = { from: { ...actor.position }, to, elapsed: 0, duration, jump };
    actor.moving = true;
  }

  private destination(actor: InternalActor, direction: Direction): PlanePosition {
    const offset = OFFSETS[direction];
    return {
      x: actor.position.x + offset.x * this.map!.tileSize,
      y: actor.position.y + offset.y * this.map!.tileSize,
      planeId: actor.position.planeId,
    };
  }

  private insideMap(position: PlanePosition) {
    const bounds = this.map!.bounds;
    return position.x >= bounds.x
      && position.y >= bounds.y
      && position.x < bounds.x + bounds.w
      && position.y < bounds.y + bounds.h;
  }

  private approachFallback(from: PlanePosition, player: PlanePosition, command: Extract<MovementCommand, { type: 'move' }>['direction'], primary: Direction): Direction | undefined {
    if (command !== 'towardPlayer' && command !== 'awayFromPlayer' || from.planeId !== player.planeId) return undefined;
    const dx = player.x - from.x, dy = player.y - from.y;
    const horizontal: Direction | undefined = dx === 0 ? undefined : dx > 0 ? 'east' : 'west';
    const vertical: Direction | undefined = dy === 0 ? undefined : dy > 0 ? 'south' : 'north';
    const secondary = primary === horizontal ? vertical : horizontal;
    if (!secondary) return undefined;
    return command === 'awayFromPlayer' ? OPPOSITE[secondary] : secondary;
  }

  private resolveMoveDirection(actor: InternalActor, value: Extract<MovementCommand, { type: 'move' }>['direction'], player: PlanePosition, random: () => number): Direction | undefined {
    if (DIRECTIONS.includes(value as Direction)) return value as Direction;
    if (value === 'forward') return actor.direction;
    if (value === 'backward') return OPPOSITE[actor.direction];
    if (value === 'left') return LEFT[actor.direction];
    if (value === 'right') return RIGHT[actor.direction];
    if (value === 'random') return DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
    if (actor.position.planeId !== player.planeId) return undefined;
    const toward = this.toward(actor.position, player);
    return value === 'awayFromPlayer' ? OPPOSITE[toward] : toward;
  }

  private resolveTurn(actor: InternalActor, value: Extract<MovementCommand, { type: 'turn' }>['direction'], player: PlanePosition, random: () => number): Direction {
    if (DIRECTIONS.includes(value as Direction)) return value as Direction;
    if (value === 'left') return LEFT[actor.direction];
    if (value === 'right') return RIGHT[actor.direction];
    if (value === 'around') return OPPOSITE[actor.direction];
    if (value === 'random') return DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
    const toward = actor.position.planeId === player.planeId ? this.toward(actor.position, player) : actor.direction;
    return value === 'awayFromPlayer' ? OPPOSITE[toward] : toward;
  }

  private toward(from: PlanePosition, to: PlanePosition): Direction {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
    if (dy !== 0) return dy > 0 ? 'south' : 'north';
    return dx > 0 ? 'east' : 'west';
  }

  private frequencyPause(frequency: number) { return Math.max(0, (5 - frequency) * 0.5); }
}
