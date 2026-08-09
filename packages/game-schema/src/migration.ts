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

function migrateCommands(commands: unknown): unknown {
  if (!Array.isArray(commands)) return commands;
  return commands.map(command => {
    if (!command || typeof command !== 'object') return command;
    const next = { ...(command as JsonObject) };
    if (next.type === 'dialogue' && Array.isArray(next.choices)) {
      next.choices = next.choices.map((choice: JsonObject) => {
        const migrated = migrateCommands(choice.commands ?? choice.actions);
        const result: JsonObject = { ...choice, commands: migrated };
        delete result.actions;
        return result;
      });
    }
    return next;
  });
}

function migrateEventVisuals(files: SourceGameFiles): SourceGameFiles {
  const maps = files.maps as Record<string, JsonObject> | null;
  if (!maps || !Object.values(maps).some(map => Array.isArray(map.events) && map.events.some((event: JsonObject) => event.visual))) return files;
  const next = structuredClone(files) as SourceGameFiles;
  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const event of Array.isArray(map.events) ? map.events : []) {
      const visual = event.visual as JsonObject | undefined;
      if (!event.sprite && visual?.type && visual.type !== 'exit') {
        const image = visual.type === 'chest'
          ? 'sprites/rpg-maker-mz/!Chest.png'
          : visual.type === 'door'
            ? 'sprites/rpg-maker-mz/!Door1.png'
            : 'sprites/rpg-maker-mz/Actor1.png';
        event.sprite = {
          image,
          characterIndex: visual.type === 'npc' && event.id === 'merchant' ? 1 : 0,
          characterColumns: 4,
          frameWidth: 48,
          frameHeight: 48,
          objectAligned: visual.type !== 'npc',
        };
      }
      delete event.visual;
    }
  }
  return next;
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

/** Inlines event pages into map events and adopts the V0.7 event-command model. */
function migrateV06(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.6') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.7';
  nextManifest.engineRange = '>=0.7 <0.8';
  const eventData = (next.events || {}) as JsonObject;
  const scripts = (eventData.events || {}) as Record<string, JsonObject>;
  const defaultMovement = { type: 'fixed', speed: 3, frequency: 3, route: [] };
  const defaultOptions = { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false };

  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const event of Array.isArray(map.events) ? map.events : []) {
      const script = scripts[event.scriptId] as JsonObject | undefined;
      const legacyPages = Array.isArray(script?.pages) && script.pages.length ? script.pages : [{ actions: [] }];
      const movement = event.movement && typeof event.movement === 'object' ? event.movement as JsonObject : {};
      event.pages = legacyPages.map((legacyPage: JsonObject) => {
        const conditions = [
          ...(Array.isArray(event.activeWhen) ? event.activeWhen : []),
          ...(Array.isArray(legacyPage.conditions) ? legacyPage.conditions : []),
        ];
        const trigger = event.trigger?.type === 'interact'
          ? { type: 'actionButton', radius: event.trigger.radius }
          : event.trigger?.type === 'playerEnter'
            ? { type: 'playerTouch', size: event.trigger.size }
            : event.trigger?.type === 'interval'
              ? { type: 'parallel' }
              : { type: 'autorun' };
        let contents = migrateCommands(legacyPage.actions) as unknown[];
        if (event.trigger?.type === 'interval') contents = [{ type: 'wait', duration: event.trigger.every }, ...contents];
        if (event.trigger?.type === 'mapEnter' && event.trigger.delay > 0) contents = [{ type: 'wait', duration: event.trigger.delay }, ...contents];
        return {
          ...(conditions.length ? { conditions } : {}),
          ...(event.sprite ? { sprite: event.sprite } : {}),
          movement: {
            type: movement.type ?? defaultMovement.type,
            speed: movement.speed ?? defaultMovement.speed,
            frequency: movement.frequency ?? defaultMovement.frequency,
            route: Array.isArray(movement.route) ? movement.route : defaultMovement.route,
          },
          options: {
            walkingAnimation: movement.walkingAnimation ?? defaultOptions.walkingAnimation,
            steppingAnimation: movement.steppingAnimation ?? defaultOptions.steppingAnimation,
            directionFix: movement.directionFix ?? defaultOptions.directionFix,
            through: movement.through ?? defaultOptions.through,
          },
          priority: event.trigger?.type === 'playerEnter' ? 'belowCharacters' : 'sameAsCharacters',
          trigger,
          contents,
        };
      });
      delete event.scriptId;
      delete event.trigger;
      delete event.execution;
      delete event.activeWhen;
      delete event.sprite;
      delete event.movement;
    }
  }
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) {
    if (enemy.onDefeated) enemy.onDefeated = migrateCommands(enemy.onDefeated);
  }
  delete eventData.events;
  return next;
}

function switchName(id: string) {
  const words = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

function migrateSwitchConditions(conditions: unknown) {
  if (!Array.isArray(conditions)) return conditions;
  return conditions.map(condition => condition && typeof condition === 'object' && (condition as JsonObject).kind === 'flag'
    ? { ...(condition as JsonObject), kind: 'switch' }
    : condition);
}

function migrateSwitchCommands(commands: unknown): unknown {
  if (!Array.isArray(commands)) return commands;
  return commands.map(command => {
    if (!command || typeof command !== 'object') return command;
    const next = { ...(command as JsonObject) };
    if (next.type === 'setFlag') next.type = 'setSwitch';
    if (next.type === 'dialogue' && Array.isArray(next.choices)) {
      next.choices = next.choices.map((choice: JsonObject) => ({ ...choice, commands: migrateSwitchCommands(choice.commands) }));
    }
    return next;
  });
}

/** Renames flags to named switches and upgrades the V0.7 authoring format to V0.8. */
function migrateV07(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.7') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.8';
  nextManifest.engineRange = '>=0.8 <0.9';

  const initialState = (next.initialState || {}) as JsonObject;
  if (!('switches' in initialState)) {
    initialState.switches = Object.fromEntries(Object.entries((initialState.flags || {}) as Record<string, unknown>).map(([id, value]) => [
      id,
      { name: switchName(id), initialValue: Boolean(value) },
    ]));
  }
  delete initialState.flags;

  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const event of Array.isArray(map.events) ? map.events : []) {
      for (const page of Array.isArray(event.pages) ? event.pages : []) {
        page.conditions = migrateSwitchConditions(page.conditions);
        page.contents = migrateSwitchCommands(page.contents);
      }
    }
  }
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) {
    if (enemy.onDefeated) enemy.onDefeated = migrateSwitchCommands(enemy.onDefeated);
  }
  const events = (next.events || {}) as JsonObject;
  if (Array.isArray(events.objectives)) {
    events.objectives = events.objectives.map((objective: JsonObject) => ({ ...objective, conditions: migrateSwitchConditions(objective.conditions) }));
  }
  return next;
}

function migrateTeleportCommands(commands: unknown): unknown {
  if (!Array.isArray(commands)) return commands;
  return commands.map(command => {
    if (!command || typeof command !== 'object') return command;
    const next = { ...(command as JsonObject) };
    if (next.type === 'teleport' && typeof next.mapId === 'string' && next.position && typeof next.position === 'object') {
      const position = next.position as JsonObject;
      return {
        type: 'teleport',
        destination: {
          map: { kind: 'constant', mapId: next.mapId },
          x: { kind: 'constant', value: position.x },
          y: { kind: 'constant', value: position.y },
        },
        direction: 'retain',
        transition: 'instant',
      };
    }
    if (next.type === 'dialogue' && Array.isArray(next.choices)) {
      next.choices = next.choices.map((choice: JsonObject) => ({ ...choice, commands: migrateTeleportCommands(choice.commands) }));
    }
    if (next.type === 'conditional') {
      next.thenCommands = migrateTeleportCommands(next.thenCommands);
      if (Array.isArray(next.elseCommands)) next.elseCommands = migrateTeleportCommands(next.elseCommands);
    }
    return next;
  });
}

/** Adds stable numeric map ids and upgrades teleport commands to the V0.9 source model. */
function migrateV08(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.8') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.9';
  nextManifest.engineRange = '>=0.9 <0.10';

  let numericId = 1;
  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    map.numericId = numericId++;
    for (const event of Array.isArray(map.events) ? map.events : []) {
      for (const page of Array.isArray(event.pages) ? event.pages : []) page.contents = migrateTeleportCommands(page.contents);
    }
  }
  nextManifest.nextMapNumericId = numericId;
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) {
    if (enemy.onDefeated) enemy.onDefeated = migrateTeleportCommands(enemy.onDefeated);
  }
  return next;
}

function migrateValueCommands(commands: unknown): unknown {
  if (!Array.isArray(commands)) return commands;
  return commands.map(command => {
    if (!command || typeof command !== 'object') return command;
    const next = { ...(command as JsonObject) };
    if (next.type === 'setSwitch' && typeof next.value === 'boolean') {
      next.operation = 'set';
      next.operand = { kind: 'constant', value: next.value };
      delete next.value;
    }
    if (next.type === 'setVariable' && typeof next.value === 'number') {
      next.operation = 'set';
      next.operand = { kind: 'constant', value: next.value };
      delete next.value;
    }
    if (next.type === 'dialogue' && Array.isArray(next.choices)) {
      next.choices = next.choices.map((choice: JsonObject) => ({ ...choice, commands: migrateValueCommands(choice.commands) }));
    }
    if (next.type === 'conditional') {
      next.thenCommands = migrateValueCommands(next.thenCommands);
      if (Array.isArray(next.elseCommands)) next.elseCommands = migrateValueCommands(next.elseCommands);
    }
    return next;
  });
}

/** Adds structured state-command operands and upgrades the V0.9 source model to V0.10. */
function migrateV09(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.9') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.10';
  nextManifest.engineRange = '>=0.10 <0.11';
  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const event of Array.isArray(map.events) ? map.events : []) {
      for (const page of Array.isArray(event.pages) ? event.pages : []) page.contents = migrateValueCommands(page.contents);
    }
  }
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) {
    if (enemy.onDefeated) enemy.onDefeated = migrateValueCommands(enemy.onDefeated);
  }
  return next;
}

function migrateConditionOperand(condition: unknown): unknown {
  if (!condition || typeof condition !== 'object') return condition;
  const next = { ...(condition as JsonObject) };
  if (next.kind === 'switch' && !next.operand) {
    next.operand = { kind: 'constant', value: typeof next.equals === 'boolean' ? next.equals : true };
    delete next.equals;
  }
  if (next.kind === 'variable' && !next.operand && typeof next.value === 'number') {
    next.operand = { kind: 'constant', value: next.value };
    delete next.value;
  }
  return next;
}

function migrateConditionCommands(commands: unknown): unknown {
  if (!Array.isArray(commands)) return commands;
  return commands.map(command => {
    if (!command || typeof command !== 'object') return command;
    const next = { ...(command as JsonObject) };
    if (next.type === 'conditional') {
      next.condition = migrateConditionOperand(next.condition);
      next.thenCommands = migrateConditionCommands(next.thenCommands);
      if (Array.isArray(next.elseCommands)) next.elseCommands = migrateConditionCommands(next.elseCommands);
    }
    if (next.type === 'dialogue' && Array.isArray(next.choices)) {
      next.choices = next.choices.map((choice: JsonObject) => ({ ...choice, commands: migrateConditionCommands(choice.commands) }));
    }
    return next;
  });
}

/** Adds structured condition operands and upgrades the V0.10 source model to V0.11. */
function migrateV10(files: SourceGameFiles): SourceGameFiles {
  const manifest = files.manifest as JsonObject | null;
  if (!manifest || manifest.schemaVersion !== '0.10') return files;
  const next = structuredClone(files) as SourceGameFiles;
  const nextManifest = next.manifest as JsonObject;
  nextManifest.schemaVersion = '0.11';
  nextManifest.engineRange = '>=0.11 <0.12';
  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const event of Array.isArray(map.events) ? map.events : []) {
      for (const page of Array.isArray(event.pages) ? event.pages : []) {
        page.conditions = Array.isArray(page.conditions) ? page.conditions.map(migrateConditionOperand) : page.conditions;
        page.contents = migrateConditionCommands(page.contents);
      }
    }
  }
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) {
    if (enemy.onDefeated) enemy.onDefeated = migrateConditionCommands(enemy.onDefeated);
  }
  const events = (next.events || {}) as JsonObject;
  if (Array.isArray(events.objectives)) events.objectives = events.objectives.map((objective: JsonObject) => ({ ...objective, conditions: Array.isArray(objective.conditions) ? objective.conditions.map(migrateConditionOperand) : objective.conditions }));
  return next;
}

function ensureVariables(files: SourceGameFiles): SourceGameFiles {
  const initialState = files.initialState as JsonObject | null;
  if (!initialState || 'variables' in initialState) return files;
  const next = structuredClone(files) as SourceGameFiles;
  (next.initialState as JsonObject).variables = {};
  return next;
}

function withoutQuestStateCommands(commands: unknown): unknown {
  if (!Array.isArray(commands)) return commands;
  return commands
    .filter(command => !command || typeof command !== 'object' || (command as JsonObject).type !== 'setQuestState')
    .map(command => {
      if (!command || typeof command !== 'object') return command;
      const next = { ...(command as JsonObject) };
      if (next.type === 'dialogue' && Array.isArray(next.choices)) {
        next.choices = next.choices.map((choice: JsonObject) => ({ ...choice, commands: withoutQuestStateCommands(choice.commands) }));
      }
      return next;
    });
}

/** Removes the obsolete quest-state command, including commands nested in dialogue choices. */
function removeQuestStateCommands(files: SourceGameFiles): SourceGameFiles {
  const next = structuredClone(files) as SourceGameFiles;
  for (const map of Object.values((next.maps || {}) as Record<string, JsonObject>)) {
    for (const event of Array.isArray(map.events) ? map.events : []) {
      for (const page of Array.isArray(event.pages) ? event.pages : []) page.contents = withoutQuestStateCommands(page.contents);
    }
  }
  for (const enemy of Object.values((next.enemies || {}) as Record<string, JsonObject>)) {
    if (enemy.onDefeated) enemy.onDefeated = withoutQuestStateCommands(enemy.onDefeated);
  }
  return next;
}

/** Migrates every supported legacy authoring shape to the current schema. */
export function migrateSourceGameFiles(files: SourceGameFiles): SourceGameFiles {
  return removeQuestStateCommands(ensureVariables(migrateV10(migrateV09(migrateV08(migrateV07(migrateV06(migrateEventVisuals(migrateV05(migrateV04(files))))))))));
}
