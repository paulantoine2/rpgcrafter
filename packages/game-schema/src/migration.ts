import type { SourceGameFiles } from './types.js';

type JsonObject = Record<string, any>;

function withPlane(position: unknown, planeId: string) {
  return position && typeof position === 'object' ? { ...(position as JsonObject), planeId } : position;
}

function migrateActions(actions: unknown, planeId: string): unknown {
  if (!Array.isArray(actions)) return actions;
  return actions.map(action => {
    if (!action || typeof action !== 'object') return action;
    const next = { ...(action as JsonObject) };
    if (next.type === 'teleport') next.position = withPlane(next.position, planeId);
    if (next.type === 'dialogue' && Array.isArray(next.choices)) next.choices = next.choices.map((choice: JsonObject) => ({ ...choice, actions: migrateActions(choice.actions, planeId) }));
    return next;
  });
}

/** Converts the complete V0.4 authoring shape to V0.5 before strict validation. */
function migrateV04(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.4') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.5';
  nextManifest.engineRange = '>=0.5 <0.6';
  const planeId = 'plane-1';
  const defaultTileset = Object.keys((next.tilesets || {}) as JsonObject)[0] || '';

  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    const layers = Array.isArray(map.tileLayers) ? map.tileLayers : [];
    if (!layers.length) layers.push({ id: 'surface', name: 'Surface', tileset: defaultTileset, tiles: [] });
    for (const layer of layers) {
      layer.planeId = planeId;
      layer.renderPhase = 'belowActors';
    }
    map.tileLayers = layers;
    map.planes = [{ id: planeId, name: 'Plan 1', order: 0, surfaceLayerId: layers[0].id, surfaceCoverage: 'bounds' }];
    map.planeConnections = [];
    map.navigationOverrides = [];
    map.blockedRegions = (Array.isArray(map.obstacles) ? map.obstacles : []).map((region: JsonObject) => ({ ...region, planeId }));
    delete map.obstacles;
    map.events = (Array.isArray(map.events) ? map.events : []).map((event: JsonObject) => ({ ...event, position: withPlane(event.position, planeId) }));
    map.enemySpawns = (Array.isArray(map.enemySpawns) ? map.enemySpawns : []).map((spawn: JsonObject) => withPlane(spawn, planeId));
    if (map.deathDestination) map.deathDestination.spawn = withPlane(map.deathDestination.spawn, planeId);
  }

  const actors = next.actors as JsonObject;
  if (actors?.player) actors.player.start = withPlane(actors.player.start, planeId);
  const events = next.events as JsonObject;
  for (const event of Object.values((events?.events || {}) as Record<string, JsonObject>)) {
    event.pages = (Array.isArray(event.pages) ? event.pages : []).map((page: JsonObject) => ({ ...page, actions: migrateActions(page.actions, planeId) }));
  }
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) if (enemy.onDefeated) enemy.onDefeated = migrateActions(enemy.onDefeated, planeId);
  return next;
}

/** Converts tileset-bound layers into V0.6 mixed-tileset layers. */
function migrateV05(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.5') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.6';
  nextManifest.engineRange = '>=0.6 <0.7';

  for (const [tilesetId, tileset] of Object.entries((next.tilesets || {}) as Record<string, JsonObject>)) {
    tileset.kind = 'a2';
    tileset.name = tileset.name || (tilesetId === 'outside-a2' ? 'Outside A2' : tilesetId);
    tileset.category = tileset.category || (tilesetId === 'outside-a2' ? 'Sol' : 'Terrains');
  }
  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const layer of Array.isArray(map.tileLayers) ? map.tileLayers : []) {
      const tilesetId = layer.tileset;
      layer.tiles = (Array.isArray(layer.tiles) ? layer.tiles : []).map((tile: JsonObject) => ({ ...tile, tilesetId: tile.tilesetId || tilesetId }));
      delete layer.tileset;
    }
  }
  return next;
}

/** Migrates every supported legacy authoring shape to the current schema. */
export function migrateSourceGameFiles(files: SourceGameFiles): SourceGameFiles {
  return migrateV05(migrateV04(files));
}
