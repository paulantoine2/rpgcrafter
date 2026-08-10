import { buildNavigationGraph } from '@rpgcrafter/game-schema';
import type { EventCommand, GameMap, LoadedGame, SourceGame, Vec2 } from './types.js';

function toPixels<T extends Vec2>(position: T, tileSize: number): T {
  return { ...position, x: position.x * tileSize, y: position.y * tileSize };
}

function rectToPixels(rect: { x: number; y: number; w: number; h: number }, tileSize: number) {
  return { x: rect.x * tileSize, y: rect.y * tileSize, w: rect.w * tileSize, h: rect.h * tileSize };
}

function normalizeMaps(sourceMaps: SourceGame['maps']): Record<string, GameMap> {
  return Object.fromEntries(Object.entries(sourceMaps).map(([mapId, map]) => {
    const destinationTileSize = (destinationId: string) => sourceMaps[destinationId].tileSize;
    return [mapId, {
      ...map,
      bounds: rectToPixels(map.bounds, map.tileSize),
      tileLayers: map.tileLayers.map(layer => ({
        ...layer,
        tiles: layer.tiles.map(tile => ({ ...tile, ...toPixels(tile, map.tileSize) })),
      })),
      blockedRegions: map.blockedRegions.map(region => ({ ...region, ...rectToPixels(region, map.tileSize) })),
      events: map.events.map(event => ({
        ...event,
        position: toPixels(event.position, map.tileSize),
        pages: event.pages.map(page => ({
          ...page,
          trigger: page.trigger.type === 'playerTouch' || page.trigger.type === 'eventTouch'
            ? { ...page.trigger, size: { w: page.trigger.size.w * map.tileSize, h: page.trigger.size.h * map.tileSize } }
            : page.trigger.type === 'actionButton'
              ? { ...page.trigger, radius: page.trigger.radius * map.tileSize }
              : page.trigger,
          contents: normalizeCommands(page.contents, sourceMaps),
        })),
      })),
      enemySpawns: map.enemySpawns.map(spawn => ({ ...spawn, ...toPixels(spawn, map.tileSize) })),
      deathDestination: map.deathDestination && {
        ...map.deathDestination,
        spawn: toPixels(map.deathDestination.spawn, destinationTileSize(map.deathDestination.mapId)),
      },
    } satisfies GameMap];
  }));
}

function normalizeCommands(commands: EventCommand[], sourceMaps: SourceGame['maps']): EventCommand[] {
  return commands.map(command => {
    if (command.type === 'dialogue') return {
      ...command,
      choices: command.choices?.map(choice => ({ ...choice, commands: normalizeCommands(choice.commands, sourceMaps) })),
    };
    if (command.type === 'conditional') return {
      ...command,
      thenCommands: normalizeCommands(command.thenCommands, sourceMaps),
      ...(command.elseCommands ? { elseCommands: normalizeCommands(command.elseCommands, sourceMaps) } : {}),
    };
    return command;
  });
}

export function sourceGameToLoadedGame(source: SourceGame): LoadedGame {
  const navigation = Object.fromEntries(Object.entries(source.maps).map(([mapId, map]) => [mapId, buildNavigationGraph(map, source.tilesets)]));
  const maps = normalizeMaps(source.maps);
  const entryTileSize = source.maps[source.manifest.entryPoint.mapId].tileSize;
  const player = { ...source.actors.player, start: toPixels(source.actors.player.start, entryTileSize) };
  const enemies = Object.fromEntries(Object.entries(source.enemies).map(([id, enemy]) => [id, {
    ...enemy,
    onDefeated: enemy.onDefeated && normalizeCommands(enemy.onDefeated, source.maps),
  }]));
  return {
    manifest: source.manifest,
    tilesets: source.tilesets,
    assetUrls: {},
    maps,
    enemies,
    skills: source.skills,
    items: source.items,
    quests: source.quests,
    types: source.types,
    ui: source.ui,
    player,
    objectives: source.events.objectives,
    commonEvents: Object.fromEntries(Object.entries(source.events.commonEvents).map(([id, commonEvent]) => [id, {
      ...commonEvent,
      contents: normalizeCommands(commonEvent.contents, source.maps),
    }])),
    initialState: source.initialState,
    navigation,
  };
}
