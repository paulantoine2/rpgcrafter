import type { Action, GameEvent, MapEvent, PlanePosition, SourceGame } from '@rpgcrafter/game-schema';

export function createMapEventAt(game: SourceGame, mapId: string, position: PlanePosition): { event: MapEvent; script: GameEvent } {
  const map = game.maps[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  const eventIds = new Set(map.events.map(event => event.id));
  const scriptIds = new Set(Object.keys(game.events.events));
  let number = 1;
  let id = `event-${number}`;
  let scriptId = `event.${mapId}.${id}`;
  while (eventIds.has(id) || scriptIds.has(scriptId)) {
    number += 1;
    id = `event-${number}`;
    scriptId = `event.${mapId}.${id}`;
  }
  return {
    event: {
      id,
      position,
      scriptId,
      trigger: { type: 'interact', radius: 1 },
      execution: { mode: 'repeat' },
      movement: {
        type: 'fixed', speed: 3, frequency: 3, route: [],
        walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false,
      },
    },
    script: { id: scriptId, pages: [{ actions: [] }] },
  };
}

function renameEventTargets(actions: Action[], previousId: string, nextId: string): { actions: Action[]; changed: boolean } {
  let changed = false;
  const renamed = actions.map(action => {
    if (action.type === 'movementRoute' && action.target.kind === 'event' && action.target.eventId === previousId) {
      changed = true;
      return { ...action, target: { ...action.target, eventId: nextId } };
    }
    if (action.type === 'dialogue' && action.choices) {
      const choices = action.choices.map(choice => {
        const result = renameEventTargets(choice.actions, previousId, nextId);
        if (result.changed) changed = true;
        return result.changed ? { ...choice, actions: result.actions } : choice;
      });
      return choices.some((choice, index) => choice !== action.choices![index]) ? { ...action, choices } : action;
    }
    return action;
  });
  return { actions: renamed, changed };
}

export function renameMapEvent(game: SourceGame, mapId: string, previousId: string, requestedId: string): {
  game: SourceGame;
  scriptsChanged: boolean;
  enemiesChanged: boolean;
} | null {
  const nextId = requestedId.trim();
  const map = game.maps[mapId];
  if (!map || !nextId || nextId === previousId || map.events.some(event => event.id === nextId)) return null;
  const eventIndex = map.events.findIndex(event => event.id === previousId);
  if (eventIndex < 0) return null;

  const next = structuredClone(game);
  const nextMap = next.maps[mapId];
  nextMap.events[eventIndex].id = nextId;

  let scriptsChanged = false;
  const scriptIds = new Set(nextMap.events.map(event => event.scriptId));
  for (const scriptId of scriptIds) {
    const script = next.events.events[scriptId];
    if (!script) continue;
    script.pages = script.pages.map(page => {
      const result = renameEventTargets(page.actions, previousId, nextId);
      if (result.changed) scriptsChanged = true;
      return result.changed ? { ...page, actions: result.actions } : page;
    });
  }

  let enemiesChanged = false;
  const enemyIds = new Set(nextMap.enemySpawns.map(spawn => spawn.enemyId));
  for (const enemyId of enemyIds) {
    const enemy = next.enemies[enemyId];
    if (!enemy?.onDefeated) continue;
    const result = renameEventTargets(enemy.onDefeated, previousId, nextId);
    if (!result.changed) continue;
    enemy.onDefeated = result.actions;
    enemiesChanged = true;
  }

  return { game: next, scriptsChanged, enemiesChanged };
}
