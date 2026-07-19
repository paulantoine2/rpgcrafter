import { buildNavigationGraph } from '@rpgcrafter/game-schema';
import type { Action, GameMap, LoadedGame, SourceGame, Vec2 } from './types.js';

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
        trigger: event.trigger.type === 'playerEnter'
          ? { ...event.trigger, size: { w: event.trigger.size.w * map.tileSize, h: event.trigger.size.h * map.tileSize } }
          : event.trigger.type === 'interact'
            ? { ...event.trigger, radius: event.trigger.radius * map.tileSize }
            : event.trigger,
      })),
      enemySpawns: map.enemySpawns.map(spawn => ({ ...spawn, ...toPixels(spawn, map.tileSize) })),
      deathDestination: map.deathDestination && {
        ...map.deathDestination,
        spawn: toPixels(map.deathDestination.spawn, destinationTileSize(map.deathDestination.mapId)),
      },
    } satisfies GameMap];
  }));
}

function normalizeActions(actions: Action[], sourceMaps: SourceGame['maps']): Action[] {
  return actions.map(action => {
    if (action.type === 'teleport') return { ...action, position: toPixels(action.position, sourceMaps[action.mapId].tileSize) };
    if (action.type === 'dialogue') return {
      ...action,
      choices: action.choices?.map(choice => ({ ...choice, actions: normalizeActions(choice.actions, sourceMaps) })),
    };
    return action;
  });
}

export function sourceGameToLoadedGame(source: SourceGame): LoadedGame {
  const navigation = Object.fromEntries(Object.entries(source.maps).map(([mapId, map]) => [mapId, buildNavigationGraph(map, source.tilesets)]));
  const maps = normalizeMaps(source.maps);
  const entryTileSize = source.maps[source.manifest.entryPoint.mapId].tileSize;
  const player = { ...source.actors.player, start: toPixels(source.actors.player.start, entryTileSize) };
  const events = Object.fromEntries(Object.entries(source.events.events).map(([id, event]) => [id, {
    ...event,
    pages: event.pages.map(page => ({ ...page, actions: normalizeActions(page.actions, source.maps) })),
  }]));
  const enemies = Object.fromEntries(Object.entries(source.enemies).map(([id, enemy]) => [id, {
    ...enemy,
    onDefeated: enemy.onDefeated && normalizeActions(enemy.onDefeated, source.maps),
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
    ui: source.ui,
    player,
    events,
    objectives: source.events.objectives,
    initialState: source.initialState,
    navigation,
  };
}
