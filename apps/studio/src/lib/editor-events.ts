import type { EventCommand, MapEvent, PlanePosition, SourceGame } from '@rpgcrafter/game-schema';

export function createMapEventAt(game: SourceGame, mapId: string, position: PlanePosition): MapEvent {
  const map = game.maps[mapId];
  if (!map) throw new Error(`Unknown map: ${mapId}`);
  const eventIds = new Set(map.events.map(event => event.id));
  let number = 1;
  let id = `event-${number}`;
  while (eventIds.has(id)) {
    number += 1;
    id = `event-${number}`;
  }
  return {
    id,
    position,
    pages: [{
      movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
      options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
      priority: 'sameAsCharacters',
      trigger: { type: 'actionButton', radius: 1 },
      contents: [],
    }],
  };
}

function renameEventTargets(commands: EventCommand[], previousId: string, nextId: string): { commands: EventCommand[]; changed: boolean } {
  let changed = false;
  const renamed = commands.map(command => {
    if (command.type === 'movementRoute' && command.target.kind === 'event' && command.target.eventId === previousId) {
      changed = true;
      return { ...command, target: { ...command.target, eventId: nextId } };
    }
    if (command.type === 'dialogue' && command.choices) {
      const choices = command.choices.map(choice => {
        const result = renameEventTargets(choice.commands, previousId, nextId);
        if (result.changed) changed = true;
        return result.changed ? { ...choice, commands: result.commands } : choice;
      });
      return choices.some((choice, index) => choice !== command.choices![index]) ? { ...command, choices } : command;
    }
    return command;
  });
  return { commands: renamed, changed };
}

export function renameMapEvent(game: SourceGame, mapId: string, previousId: string, requestedId: string): {
  game: SourceGame;
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
  for (const event of nextMap.events) {
    event.pages = event.pages.map(page => {
      const result = renameEventTargets(page.contents, previousId, nextId);
      return result.changed ? { ...page, contents: result.commands } : page;
    });
  }

  let enemiesChanged = false;
  const enemyIds = new Set(nextMap.enemySpawns.map(spawn => spawn.enemyId));
  for (const enemyId of enemyIds) {
    const enemy = next.enemies[enemyId];
    if (!enemy?.onDefeated) continue;
    const result = renameEventTargets(enemy.onDefeated, previousId, nextId);
    if (!result.changed) continue;
    enemy.onDefeated = result.commands;
    enemiesChanged = true;
  }

  return { game: next, enemiesChanged };
}
