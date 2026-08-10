import { z } from 'zod';
import type {
  AutonomousMovement, Condition, ContentIssue, EnemyTemplate, EventCommand, EventOptions, GameMap, GameTypes, InitialState, Item, Manifest,
  MapEventPage, MapEventTrigger, MapEventSprite, Objective, PlayerDefinition, QuestDefinition,
  Skill, SourceGame, SourceGameFiles, SourceGameResult, TilesetDefinition, UiDefinition, MovementCommand,
  MovementTarget, MovementRoute,
  MoveSpeed, MoveFrequency, SwitchOperand, TeleportMapSource, TeleportNumberSource, VariableConditionOperand, VariableOperand,
} from './types.js';
import { CANONICAL_AUTOTILE_MASKS, canonicalizeAutotileMask } from './autotile.js';
import { migrateSourceGameFiles } from './migration.js';

export const ENGINE_VERSION = '0.12.0';

const Id = z.string().min(1);
const FiniteNumber = z.number().finite();
const PositiveNumber = FiniteNumber.positive();
const NonNegativeNumber = FiniteNumber.nonnegative();
const Vec2Schema = z.object({ x: FiniteNumber, y: FiniteNumber }).strict();
const GridBoundsSchema = z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().positive(), h: z.number().int().positive() }).strict();
const DirectionSchema = z.enum(['north', 'east', 'south', 'west']);
const PlanePositionSchema = Vec2Schema.extend({ planeId: Id }).strict();
const GridPositionSchema = z.object({ x: z.number().int(), y: z.number().int(), planeId: Id }).strict();
const GridRectSchema = GridPositionSchema.extend({ w: z.number().int().positive(), h: z.number().int().positive() }).strict();
const QuarterCoordinateSchema = z.tuple([z.number().int().min(0).max(3), z.number().int().min(0).max(5)]);
const TerrainCollisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('blockCell') }).strict(),
  z.object({ kind: z.literal('edges'), edges: z.array(DirectionSchema) }).strict(),
]).default({ kind: 'none' });
const TilesetBaseSchema = z.object({
  id: Id,
  name: Id,
  category: Id,
  image: z.string().min(1).refine(value => !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..') && value.toLowerCase().endsWith('.png'), 'Must be a relative PNG path without parent traversal'),
  tileSize: z.number().int().positive().refine(value => value % 2 === 0, 'Must be even'),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
});
const TilesetSchema = z.discriminatedUnion('kind', [
  TilesetBaseSchema.extend({
  kind: z.literal('a1'),
  quarterSize: z.number().int().positive(),
  terrains: z.array(z.object({
    id: Id, name: Id,
    origin: z.object({ column: z.number().int().nonnegative(), row: z.number().int().nonnegative() }).strict(),
    previewMask: z.number().int().min(0).max(255),
    animation: z.enum(['horizontal', 'vertical', 'none']),
    collision: TerrainCollisionSchema,
  }).strict()).min(1),
  variants: z.record(z.string(), z.object({
    quarters: z.tuple([QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema]),
  }).strict()),
  }).strict(),
  TilesetBaseSchema.extend({
  kind: z.literal('a2'),
  quarterSize: z.number().int().positive(),
  terrains: z.array(z.object({
    id: Id, name: Id,
    origin: z.object({ column: z.number().int().nonnegative(), row: z.number().int().nonnegative() }).strict(),
    previewMask: z.number().int().min(0).max(255),
    collision: TerrainCollisionSchema,
  }).strict()).min(1),
  variants: z.record(z.string(), z.object({
    quarters: z.tuple([QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema]),
  }).strict()),
  }).strict(),
  TilesetBaseSchema.extend({
  kind: z.literal('a3'),
  quarterSize: z.number().int().positive(),
  terrains: z.array(z.object({
    id: Id, name: Id,
    origin: z.object({ column: z.number().int().nonnegative(), row: z.number().int().nonnegative() }).strict(),
    previewMask: z.number().int().min(0).max(255),
    collision: TerrainCollisionSchema,
  }).strict()).min(1),
  variants: z.record(z.string(), z.object({
    quarters: z.tuple([QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema]),
  }).strict()),
  }).strict(),
  TilesetBaseSchema.extend({
  kind: z.literal('a4'),
  quarterSize: z.number().int().positive(),
  terrains: z.array(z.object({
    id: Id, name: Id,
    origin: z.object({ column: z.number().int().nonnegative(), row: z.number().int().nonnegative() }).strict(),
    previewMask: z.number().int().min(0).max(255),
    autotile: z.enum(['floor', 'wall']),
    collision: TerrainCollisionSchema,
  }).strict()).min(1),
  variants: z.record(z.string(), z.object({
    quarters: z.tuple([QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema, QuarterCoordinateSchema]),
  }).strict()),
  }).strict(),
  TilesetBaseSchema.extend({
    kind: z.literal('grid'),
    terrains: z.array(z.object({
      id: Id, name: Id,
      origin: z.object({ column: z.number().int().nonnegative(), row: z.number().int().nonnegative() }).strict(),
      collision: TerrainCollisionSchema,
    }).strict()).min(1),
  }).strict(),
  TilesetBaseSchema.extend({
    kind: z.literal('a5'),
    terrains: z.array(z.object({
      id: Id, name: Id,
      origin: z.object({ column: z.number().int().nonnegative(), row: z.number().int().nonnegative() }).strict(),
      collision: TerrainCollisionSchema,
    }).strict()).min(1),
  }).strict(),
]);
const TileLayerSchema = z.object({
  id: Id,
  name: Id,
  planeId: Id,
  renderPhase: z.enum(['belowActors', 'aboveActors']),
  tiles: z.array(z.object({
    x: z.number().int(), y: z.number().int(), tilesetId: Id, terrainId: Id,
  }).strict()),
}).strict();

const MovementCommandSchema: z.ZodType<MovementCommand> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), direction: z.enum(['north', 'east', 'south', 'west', 'forward', 'backward', 'random', 'towardPlayer', 'awayFromPlayer', 'left', 'right']) }).strict(),
  z.object({ type: z.literal('turn'), direction: z.enum(['north', 'east', 'south', 'west', 'left', 'right', 'around', 'random', 'towardPlayer', 'awayFromPlayer']) }).strict(),
  z.object({ type: z.literal('jump'), x: FiniteNumber, y: FiniteNumber }).strict(),
  z.object({ type: z.literal('wait'), duration: NonNegativeNumber }).strict(),
]);
const MovementTargetSchema: z.ZodType<MovementTarget> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('player') }).strict(),
  z.object({ kind: z.literal('thisEvent') }).strict(),
  z.object({ kind: z.literal('event'), eventId: Id }).strict(),
]);
const SwitchGameDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hasItem'), itemId: Id }).strict(),
  z.object({ kind: z.literal('itemEquipped'), itemId: Id }).strict(),
  z.object({ kind: z.literal('skillUnlocked'), skillId: Id }).strict(),
]);
const SwitchOperandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), value: z.boolean() }).strict(),
  z.object({ kind: z.literal('switch'), switchId: Id }).strict(),
  z.object({ kind: z.literal('gameData'), data: SwitchGameDataSchema }).strict(),
]);
const VariableGameDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('itemAmount'), itemId: Id }).strict(),
  z.object({ kind: z.literal('playerStat'), stat: z.enum(['hp', 'maxHp', 'level', 'xp']) }).strict(),
  z.object({ kind: z.literal('mapId') }).strict(),
  z.object({ kind: z.literal('characterCoordinate'), target: MovementTargetSchema, axis: z.enum(['x', 'y']) }).strict(),
]);
const VariableOperandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), value: FiniteNumber }).strict(),
  z.object({ kind: z.literal('variable'), variableId: Id }).strict(),
  z.object({ kind: z.literal('random'), min: FiniteNumber, max: FiniteNumber }).strict().refine(value => value.min <= value.max, { message: 'Minimum must not exceed maximum' }),
  z.object({ kind: z.literal('gameData'), data: VariableGameDataSchema }).strict(),
]);
const VariableConditionOperandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), value: FiniteNumber }).strict(),
  z.object({ kind: z.literal('variable'), variableId: Id }).strict(),
  z.object({ kind: z.literal('gameData'), data: VariableGameDataSchema }).strict(),
]) as z.ZodType<VariableConditionOperand>;
const ConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('switch'), id: Id, operand: SwitchOperandSchema }).strict(),
  z.object({ kind: z.literal('item'), id: Id, amount: FiniteNumber.optional() }).strict(),
  z.object({ kind: z.literal('variable'), id: Id, operator: z.enum(['equal', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual']), operand: VariableConditionOperandSchema }).strict(),
]) as z.ZodType<Condition>;
const MovementRouteSchema: z.ZodType<MovementRoute> = z.object({
  commands: z.array(MovementCommandSchema),
  repeat: z.boolean(),
  skippable: z.boolean(),
  wait: z.boolean(),
}).strict();
const TeleportMapSourceSchema: z.ZodType<TeleportMapSource> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), mapId: Id }).strict(),
  z.object({ kind: z.literal('variable'), variableId: Id }).strict(),
]);
const TeleportNumberSourceSchema: z.ZodType<TeleportNumberSource> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('constant'), value: FiniteNumber.int() }).strict(),
  z.object({ kind: z.literal('variable'), variableId: Id }).strict(),
]);
const MoveSpeedSchema: z.ZodType<MoveSpeed> = z.custom<MoveSpeed>(value => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6, 'Must be an integer from 1 to 6');
const MoveFrequencySchema: z.ZodType<MoveFrequency> = z.custom<MoveFrequency>(value => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5, 'Must be an integer from 1 to 5');
const AutonomousMovementSchema: z.ZodType<AutonomousMovement> = z.object({
  type: z.enum(['fixed', 'random', 'approach', 'custom']),
  speed: MoveSpeedSchema,
  frequency: MoveFrequencySchema,
  route: z.array(MovementCommandSchema),
}).strict();
const EventOptionsSchema: z.ZodType<EventOptions> = z.object({
  walkingAnimation: z.boolean(),
  steppingAnimation: z.boolean(),
  directionFix: z.boolean(),
  through: z.boolean(),
}).strict();

const EventCommandSchema = z.lazy(() => z.union([
  z.object({ type: z.literal('dialogue'), speaker: Id, text: Id, choices: z.array(z.object({ label: Id, commands: z.array(EventCommandSchema) }).strict()).optional() }).strict(),
  z.object({ type: z.literal('conditional'), condition: ConditionSchema, thenCommands: z.array(EventCommandSchema), elseCommands: z.array(EventCommandSchema).optional() }).strict(),
  z.object({ type: z.literal('setSwitch'), id: Id, operation: z.literal('set'), operand: SwitchOperandSchema }).strict(),
  z.object({ type: z.literal('setSwitch'), id: Id, operation: z.literal('toggle') }).strict(),
  z.object({ type: z.literal('setVariable'), id: Id, operation: z.enum(['set', 'add', 'subtract', 'multiply', 'divide', 'modulo']), operand: VariableOperandSchema }).strict(),
  z.object({ type: z.literal('giveItem'), id: Id, amount: FiniteNumber.optional() }).strict(),
  z.object({ type: z.literal('removeItem'), id: Id, amount: FiniteNumber.optional() }).strict(),
  z.object({ type: z.literal('unlockSkill'), id: Id }).strict(),
  z.object({ type: z.literal('healPlayer'), amount: FiniteNumber }).strict(),
  z.object({ type: z.literal('toast'), text: Id }).strict(),
  z.object({
    type: z.literal('teleport'),
    destination: z.object({ map: TeleportMapSourceSchema, x: TeleportNumberSourceSchema, y: TeleportNumberSourceSchema }).strict(),
    direction: z.enum(['retain', 'north', 'east', 'south', 'west']),
    transition: z.enum(['instant', 'fadeBlack', 'fadeWhite']),
  }).strict(),
  z.object({ type: z.literal('movementRoute'), target: MovementTargetSchema, route: MovementRouteSchema }).strict(),
  z.object({ type: z.literal('wait'), duration: NonNegativeNumber }).strict(),
  z.object({ type: z.literal('save') }).strict(),
])) as z.ZodType<EventCommand>;

const MapEventTriggerSchema: z.ZodType<MapEventTrigger> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('actionButton'), radius: PositiveNumber }).strict(),
  z.object({ type: z.literal('playerTouch'), size: z.object({ w: PositiveNumber, h: PositiveNumber }).strict() }).strict(),
  z.object({ type: z.literal('eventTouch'), size: z.object({ w: PositiveNumber, h: PositiveNumber }).strict() }).strict(),
  z.object({ type: z.literal('autorun') }).strict(),
  z.object({ type: z.literal('parallel') }).strict(),
]);
const MapEventSpriteSchema: z.ZodType<MapEventSprite> = z.object({
  image: Id,
  characterIndex: z.number().int().nonnegative(),
  characterColumns: z.number().int().positive(),
  frameWidth: PositiveNumber,
  frameHeight: PositiveNumber,
  objectAligned: z.boolean(),
}).strict();
const MapEventPageSchema: z.ZodType<MapEventPage> = z.object({
  conditions: z.array(ConditionSchema).optional(),
  sprite: MapEventSpriteSchema.optional(),
  movement: AutonomousMovementSchema,
  options: EventOptionsSchema,
  priority: z.enum(['belowCharacters', 'sameAsCharacters', 'aboveCharacters']),
  trigger: MapEventTriggerSchema,
  contents: z.array(EventCommandSchema),
}).strict();

const ManifestSchema: z.ZodType<Manifest> = z.object({
  schemaVersion: Id, engineRange: Id, gameId: Id, version: Id,
  nextMapNumericId: z.number().int().positive(), entryPoint: z.object({ mapId: Id, spawnId: Id }).strict(), title: Id, contentRating: Id,
}).strict();
const MapSchema: z.ZodType<GameMap> = z.object({
  id: Id, numericId: z.number().int().positive(), name: Id, parentMapId: Id.optional(), ground: Id, accent: Id, tileSize: z.number().int().positive(), bounds: GridBoundsSchema,
  planes: z.array(z.object({
    id: Id, name: Id, order: z.number().int(), surfaceLayerId: Id, surfaceCoverage: z.enum(['bounds', 'painted']),
  }).strict()).min(1),
  tileLayers: z.array(TileLayerSchema),
  planeConnections: z.array(z.object({
    id: Id,
    from: GridPositionSchema.extend({ edge: DirectionSchema }).strict(),
    to: GridPositionSchema.extend({ edge: DirectionSchema }).strict(),
    bidirectional: z.boolean(),
  }).strict()),
  navigationOverrides: z.array(GridPositionSchema.extend({
    cell: z.enum(['open', 'blocked']).optional(),
    edges: z.object({ north: z.enum(['open', 'blocked']).optional(), east: z.enum(['open', 'blocked']).optional(), south: z.enum(['open', 'blocked']).optional(), west: z.enum(['open', 'blocked']).optional() }).strict().optional(),
  }).strict()),
  blockedRegions: z.array(GridRectSchema),
  events: z.array(z.object({ id: Id, position: PlanePositionSchema, pages: z.array(MapEventPageSchema).min(1) }).strict()),
  enemySpawns: z.array(PlanePositionSchema.extend({ enemyId: Id }).strict()),
  deathDestination: z.object({ mapId: Id, spawn: PlanePositionSchema }).strict().optional(),
}).strict();
const EnemySchema: z.ZodType<EnemyTemplate> = z.object({
  name: Id, color: Id, hp: FiniteNumber, speed: FiniteNumber, damage: FiniteNumber, radius: FiniteNumber, xp: FiniteNumber,
  behavior: z.enum(['chase', 'charge', 'ranged', 'boss']),
  phases: z.array(z.object({ atHpRatio: FiniteNumber, speedMultiplier: FiniteNumber.optional(), projectile: z.object({ cooldown: FiniteNumber, speed: FiniteNumber, damage: FiniteNumber, color: Id }).strict().optional() }).strict()).optional(),
  onDefeated: z.array(EventCommandSchema).optional(),
}).strict();
const PlayerSchema: z.ZodType<PlayerDefinition> = z.object({
  id: Id, name: Id, start: PlanePositionSchema, stats: z.object({ maxHp: FiniteNumber, level: FiniteNumber, xp: FiniteNumber }).strict(),
  primaryAttack: Id, skillSlots: z.record(Id, Id), unlockedSkills: z.array(Id),
}).strict();
const SkillSchema: z.ZodType<Skill> = z.object({ name: Id, type: z.enum(['melee', 'projectile', 'area']), damage: FiniteNumber, cooldown: FiniteNumber, range: FiniteNumber.optional(), projectileSpeed: FiniteNumber.optional(), color: Id.optional() }).strict();
const ItemSchema: z.ZodType<Item> = z.object({ name: Id, type: z.enum(['quest', 'consumable', 'equipment']), healing: FiniteNumber.optional(), equipmentTypeId: z.number().int().positive().optional(), stats: z.record(Id, FiniteNumber).optional() }).strict();
const QuestSchema: z.ZodType<QuestDefinition> = z.object({ name: Id, states: z.array(Id).min(1), reward: z.object({ story: Id }).strict().optional() }).strict();
const TypeCatalogSchema = z.object({
  nextId: z.number().int().positive(),
  entries: z.array(z.object({ id: z.number().int().positive(), name: Id }).strict()),
}).strict();
const GameTypesSchema: z.ZodType<GameTypes> = z.object({
  elements: TypeCatalogSchema,
  skills: TypeCatalogSchema,
  weapons: TypeCatalogSchema,
  armors: TypeCatalogSchema,
  equipment: TypeCatalogSchema,
}).strict();
const UiSchema: z.ZodType<UiDefinition> = z.object({
  theme: z.object({ fontFamily: Id, pageBackground: Id, panel: Id, panelBorder: Id, text: Id, accent: Id, health: Id }).strict(),
  hud: z.object({ slots: z.array(Id) }).strict(),
  pauseMenu: z.object({ title: Id, tabs: z.array(z.object({ id: Id, label: Id }).strict()).min(1) }).strict(),
}).strict();
const ObjectiveSchema: z.ZodType<Objective> = z.object({ conditions: z.array(ConditionSchema).optional(), text: Id }).strict();
const InitialStateSchema: z.ZodType<InitialState> = z.object({
  switches: z.record(Id, z.object({ name: Id, initialValue: z.boolean() }).strict()),
  variables: z.record(Id, z.object({ name: Id, initialValue: FiniteNumber }).strict()),
  quests: z.record(Id, Id),
  inventory: z.record(Id, FiniteNumber).optional(),
  equipment: z.record(Id, Id.nullable()).optional(),
}).strict();
const ActorsSchema = z.object({ player: PlayerSchema }).strict();
const EventsSchema = z.object({ objectives: z.array(ObjectiveSchema) }).strict();

function compareVersions(left: string, right: string) {
  const parse = (value: string) => value.split('.').map(part => Number(part || 0));
  const a = parse(left), b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}

function engineSupports(range: string) {
  const clauses = range.trim().split(/\s+/);
  return Boolean(clauses.length) && clauses.every(clause => {
    const match = /^(>=|<=|>|<|=)?(\d+(?:\.\d+){0,2})$/.exec(clause);
    if (!match) return false;
    const comparison = compareVersions(ENGINE_VERSION, match[2]);
    return match[1] === '>=' ? comparison >= 0 : match[1] === '<=' ? comparison <= 0 : match[1] === '>' ? comparison > 0 : match[1] === '<' ? comparison < 0 : comparison === 0;
  });
}

function validateReferences(game: SourceGame): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });
  const { maps, tilesets, enemies, skills, items, quests, types, events, initialState, actors, manifest } = game;
  const player = actors.player;
  const directions = {
    north: { x: 0, y: -1, opposite: 'south' }, east: { x: 1, y: 0, opposite: 'west' },
    south: { x: 0, y: 1, opposite: 'north' }, west: { x: -1, y: 0, opposite: 'east' },
  } as const;
  for (const [tilesetId, tileset] of Object.entries(tilesets)) {
    const path = `tilesets.${tilesetId}`;
    if (tileset.id !== tilesetId) issue(`${path}.id`, 'Must match its object key');
    if (tileset.tileSize !== 48) issue(`${path}.tileSize`, 'Asset Manager tilesets must use 48px tiles');
    const isAutotile = tileset.kind === 'a1' || tileset.kind === 'a2' || tileset.kind === 'a3' || tileset.kind === 'a4';
    if (isAutotile && tileset.quarterSize * 2 !== tileset.tileSize) issue(`${path}.quarterSize`, 'Must be exactly half tileSize');
    if (tileset.kind === 'a5' && (tileset.columns !== 8 || tileset.rows !== 16)) issue(path, 'A5 tilesets must use an 8×16 tile grid');
    const terrainIds = new Set<string>();
    const terrainOrigins = new Set<string>();
    tileset.terrains.forEach((terrain, index) => {
      const terrainPath = `${path}.terrains[${index}]`;
      if (terrainIds.has(terrain.id)) issue(`${terrainPath}.id`, `Duplicate terrain id: ${terrain.id}`);
      terrainIds.add(terrain.id);
      const origin = `${terrain.origin.column}:${terrain.origin.row}`;
      if (terrainOrigins.has(origin)) issue(`${terrainPath}.origin`, `Duplicate terrain origin: ${origin}`);
      terrainOrigins.add(origin);
      if (isAutotile) {
        let blockColumns = 2, blockRows = 3, aligned = terrain.origin.column % 2 === 0;
        if (tileset.kind === 'a1') {
          blockColumns = 'animation' in terrain && terrain.animation === 'horizontal' ? 6 : 2;
          aligned &&= terrain.origin.row % 3 === 0;
        } else if (tileset.kind === 'a2') aligned &&= terrain.origin.row % 3 === 0;
        else if (tileset.kind === 'a3') {
          blockRows = 2;
          aligned &&= terrain.origin.row % 2 === 0;
        }
        else {
          const wall = 'autotile' in terrain && terrain.autotile === 'wall';
          blockRows = wall ? 2 : 3;
          aligned &&= terrain.origin.row % 5 === (wall ? 3 : 0);
        }
        if (!aligned) issue(`${terrainPath}.origin`, `${tileset.kind.toUpperCase()} origin is not aligned to its autotile block`);
        if (terrain.origin.column + blockColumns > tileset.columns || terrain.origin.row + blockRows > tileset.rows) issue(`${terrainPath}.origin`, `${tileset.kind.toUpperCase()} terrain block exceeds atlas bounds`);
        const previewMask = 'previewMask' in terrain ? Number(terrain.previewMask) : -1;
        if (canonicalizeAutotileMask(previewMask) !== previewMask) issue(`${terrainPath}.previewMask`, 'Must be a canonical autotile mask');
      } else if (terrain.origin.column >= tileset.columns || terrain.origin.row >= tileset.rows) issue(`${terrainPath}.origin`, 'Grid tile origin exceeds atlas bounds');
      if (terrain.collision.kind === 'edges' && new Set(terrain.collision.edges).size !== terrain.collision.edges.length) issue(`${terrainPath}.collision.edges`, 'Duplicate collision edge');
    });
    if (isAutotile) {
      const variantMasks = new Set<number>();
      for (const key of Object.keys(tileset.variants)) {
        const mask = Number(key);
        if (!Number.isInteger(mask) || String(mask) !== key || canonicalizeAutotileMask(mask) !== mask) issue(`${path}.variants.${key}`, 'Key must be a canonical decimal autotile mask');
        else variantMasks.add(mask);
      }
      for (const mask of CANONICAL_AUTOTILE_MASKS) if (!variantMasks.has(mask)) issue(`${path}.variants`, `Missing canonical autotile mask: ${mask}`);
    }
  }
  if (!maps[manifest.entryPoint.mapId]) issue('manifest.entryPoint.mapId', 'Unknown map');
  else if (!maps[manifest.entryPoint.mapId].planes.some(plane => plane.id === player.start.planeId)) issue('actors.player.start.planeId', 'Unknown plane on entry map');
  if (!skills[player.primaryAttack]) issue('actors.player.primaryAttack', 'Unknown skill');
  for (const skillId of [...Object.values(player.skillSlots), ...player.unlockedSkills]) if (!skills[skillId]) issue('actors.player', `Unknown skill: ${skillId}`);
  for (const [questId, state] of Object.entries(initialState.quests)) if (!quests[questId]?.states.includes(state)) issue('initialState.quests', `Unknown quest or state: ${questId}`);
  for (const [itemId, amount] of Object.entries(initialState.inventory || {})) if (!items[itemId] || amount < 0) issue('initialState.inventory', `Invalid item: ${itemId}`);
  const equipmentTypeIds = new Set(types.equipment.entries.map(entry => entry.id));
  for (const [typeId, itemId] of Object.entries(initialState.equipment || {})) {
    const numericTypeId = Number(typeId);
    if (!Number.isInteger(numericTypeId) || !equipmentTypeIds.has(numericTypeId)) issue(`initialState.equipment.${typeId}`, `Unknown equipment type: ${typeId}`);
    else if (itemId && (!items[itemId] || items[itemId].equipmentTypeId !== numericTypeId)) issue(`initialState.equipment.${typeId}`, `Invalid equipment: ${typeId}`);
  }
  for (const [itemId, item] of Object.entries(items)) if (item.equipmentTypeId !== undefined && !equipmentTypeIds.has(item.equipmentTypeId)) issue(`items.${itemId}.equipmentTypeId`, `Unknown equipment type: ${item.equipmentTypeId}`);

  const validateSwitchOperand = (operand: SwitchOperand, target: string) => {
    if (operand.kind === 'switch' && !(operand.switchId in initialState.switches)) issue(`${target}.switchId`, `Unknown switch: ${operand.switchId}`);
    if (operand.kind === 'gameData' && (operand.data.kind === 'hasItem' || operand.data.kind === 'itemEquipped') && !items[operand.data.itemId]) issue(`${target}.data.itemId`, `Unknown item: ${operand.data.itemId}`);
    if (operand.kind === 'gameData' && operand.data.kind === 'itemEquipped' && items[operand.data.itemId]?.type !== 'equipment') issue(`${target}.data.itemId`, `Item is not equipment: ${operand.data.itemId}`);
    if (operand.kind === 'gameData' && operand.data.kind === 'skillUnlocked' && !skills[operand.data.skillId]) issue(`${target}.data.skillId`, `Unknown skill: ${operand.data.skillId}`);
  };
  const validateVariableOperand = (operand: VariableOperand, target: string, sourceMapId?: string) => {
    if (operand.kind === 'variable' && !(operand.variableId in initialState.variables)) issue(`${target}.variableId`, `Unknown variable: ${operand.variableId}`);
    if (operand.kind === 'gameData' && operand.data.kind === 'itemAmount' && !items[operand.data.itemId]) issue(`${target}.data.itemId`, `Unknown item: ${operand.data.itemId}`);
    if (operand.kind === 'gameData' && operand.data.kind === 'characterCoordinate' && sourceMapId && operand.data.target.kind === 'event') {
      const eventId = operand.data.target.eventId;
      if (!maps[sourceMapId]?.events.some(event => event.id === eventId)) issue(`${target}.data.target.eventId`, `Unknown event on the current map: ${eventId}`);
    }
  };
  const validateCondition = (condition: Condition, target: string, sourceMapId?: string) => {
    if (condition.kind === 'switch') {
      if (!(condition.id in initialState.switches)) issue(target, `Unknown switch: ${condition.id}`);
      validateSwitchOperand(condition.operand, `${target}.operand`);
    }
    if (condition.kind === 'item' && !items[condition.id]) issue(target, `Unknown item: ${condition.id}`);
    if (condition.kind === 'variable') {
      if (!(condition.id in initialState.variables)) issue(target, `Unknown variable: ${condition.id}`);
      validateVariableOperand(condition.operand, `${target}.operand`, sourceMapId);
    }
  };
  const validateConditions = (values: Condition[], path: string, sourceMapId?: string) => values.forEach((condition, index) => validateCondition(condition, `${path}[${index}]`, sourceMapId));
  const validateCommands = (values: EventCommand[], path: string, sourceMapId?: string, conditionalDepth = 0) => values.forEach((command, index) => {
    const target = `${path}[${index}]`;
    if ((command.type === 'giveItem' || command.type === 'removeItem') && !items[command.id]) issue(target, `Unknown item: ${command.id}`);
    if (command.type === 'unlockSkill' && !skills[command.id]) issue(target, `Unknown skill: ${command.id}`);
    if (command.type === 'setSwitch') {
      if (!(command.id in initialState.switches)) issue(target, `Unknown switch: ${command.id}`);
      if (command.operation === 'set') validateSwitchOperand(command.operand, `${target}.operand`);
    }
    if (command.type === 'setVariable') {
      if (!(command.id in initialState.variables)) issue(target, `Unknown variable: ${command.id}`);
      validateVariableOperand(command.operand, `${target}.operand`, sourceMapId);
    }
    if (command.type === 'teleport') {
      const sources = [command.destination.map, command.destination.x, command.destination.y];
      for (const source of sources) if (source.kind === 'variable' && !(source.variableId in initialState.variables)) issue(target, `Unknown variable: ${source.variableId}`);
      if (command.destination.map.kind === 'constant') {
        const destinationMap = maps[command.destination.map.mapId];
        if (!destinationMap) issue(target, `Unknown map: ${command.destination.map.mapId}`);
        else if (command.destination.x.kind === 'constant' && command.destination.y.kind === 'constant') {
          const { x, y } = { x: command.destination.x.value, y: command.destination.y.value };
          if (x < destinationMap.bounds.x || x >= destinationMap.bounds.x + destinationMap.bounds.w || y < destinationMap.bounds.y || y >= destinationMap.bounds.y + destinationMap.bounds.h) issue(target, 'Teleport destination must be inside map bounds');
        }
      }
    }
    if (command.type === 'movementRoute') {
      if (sourceMapId && command.target.kind === 'event') {
        const targetEventId = command.target.eventId;
        if (!maps[sourceMapId]?.events.some(event => event.id === targetEventId)) issue(`${target}.target.eventId`, 'Unknown event on the current map');
      }
      if (command.route.repeat && command.route.wait) issue(`${target}.route`, 'A repeating movement route cannot wait for completion');
    }
    if (command.type === 'dialogue') command.choices?.forEach((choice, choiceIndex) => validateCommands(choice.commands, `${target}.choices[${choiceIndex}].commands`, sourceMapId, conditionalDepth));
    if (command.type === 'conditional') {
      const nextDepth = conditionalDepth + 1;
      validateCondition(command.condition, `${target}.condition`, sourceMapId);
      if (nextDepth > 3) issue(target, 'Conditional branches cannot exceed 3 levels');
      validateCommands(command.thenCommands, `${target}.thenCommands`, sourceMapId, nextDepth);
      if (command.elseCommands) validateCommands(command.elseCommands, `${target}.elseCommands`, sourceMapId, nextDepth);
    }
  });

  const mapNumericIds = new Set<number>();
  for (const [mapId, map] of Object.entries(maps)) {
    if (map.id !== mapId) issue(`maps.${mapId}.id`, 'Must match its object key');
    if (mapNumericIds.has(map.numericId)) issue(`maps.${mapId}.numericId`, `Duplicate numeric map id: ${map.numericId}`);
    mapNumericIds.add(map.numericId);
    if (map.parentMapId && !maps[map.parentMapId]) issue(`maps.${mapId}.parentMapId`, `Unknown parent map: ${map.parentMapId}`);
    if (map.parentMapId === mapId) issue(`maps.${mapId}.parentMapId`, 'A map cannot be its own parent');
    if (map.parentMapId && maps[map.parentMapId]) {
      const ancestors = new Set([mapId]);
      let parentId: string | undefined = map.parentMapId;
      while (parentId && maps[parentId]) {
        if (ancestors.has(parentId)) {
          issue(`maps.${mapId}.parentMapId`, 'Map hierarchy must not contain a cycle');
          break;
        }
        ancestors.add(parentId);
        parentId = maps[parentId].parentMapId;
      }
    }
    const insideCell = (x: number, y: number) => x >= map.bounds.x && x < map.bounds.x + map.bounds.w && y >= map.bounds.y && y < map.bounds.y + map.bounds.h;
    const planeIds = new Set<string>();
    const planeOrders = new Set<number>();
    map.planes.forEach((plane, planeIndex) => {
      const path = `maps.${mapId}.planes[${planeIndex}]`;
      if (planeIds.has(plane.id)) issue(`${path}.id`, `Duplicate plane id: ${plane.id}`);
      if (planeOrders.has(plane.order)) issue(`${path}.order`, `Duplicate plane order: ${plane.order}`);
      planeIds.add(plane.id);
      planeOrders.add(plane.order);
    });
    const layerIds = new Set<string>();
    map.tileLayers.forEach((layer, layerIndex) => {
      const layerPath = `maps.${mapId}.tileLayers[${layerIndex}]`;
      if (layerIds.has(layer.id)) issue(`${layerPath}.id`, `Duplicate layer id: ${layer.id}`);
      layerIds.add(layer.id);
      if (!planeIds.has(layer.planeId)) issue(`${layerPath}.planeId`, `Unknown plane: ${layer.planeId}`);
      const tilePositions = new Set<string>();
      layer.tiles.forEach((tile, index) => {
        const path = `${layerPath}.tiles[${index}]`;
        if (tile.x < map.bounds.x || tile.x >= map.bounds.x + map.bounds.w || tile.y < map.bounds.y || tile.y >= map.bounds.y + map.bounds.h) issue(path, 'Tile must be inside map bounds');
        const position = `${tile.x}:${tile.y}`;
        if (tilePositions.has(position)) issue(path, `Duplicate tile position: ${position}`);
        tilePositions.add(position);
        const mapTileset = tilesets[tile.tilesetId];
        if (!mapTileset) issue(`${path}.tilesetId`, `Unknown tileset: ${tile.tilesetId}`);
        else if (!mapTileset.terrains.some(terrain => terrain.id === tile.terrainId)) issue(`${path}.terrainId`, `Unknown terrain: ${tile.tilesetId}.${tile.terrainId}`);
      });
    });
    map.planes.forEach((plane, planeIndex) => {
      const surface = map.tileLayers.find(layer => layer.id === plane.surfaceLayerId);
      const path = `maps.${mapId}.planes[${planeIndex}].surfaceLayerId`;
      if (!surface) issue(path, `Unknown surface layer: ${plane.surfaceLayerId}`);
      else if (surface.planeId !== plane.id) issue(path, 'Surface layer must belong to its plane');
    });
    const connectionIds = new Set<string>();
    const surfaceExists = (planeId: string, x: number, y: number) => {
      const plane = map.planes.find(item => item.id === planeId);
      if (!plane) return false;
      if (plane.surfaceCoverage === 'bounds') return insideCell(x, y);
      return map.tileLayers.find(layer => layer.id === plane.surfaceLayerId)?.tiles.some(tile => tile.x === x && tile.y === y) ?? false;
    };
    map.planeConnections.forEach((connection, index) => {
      const path = `maps.${mapId}.planeConnections[${index}]`;
      if (connectionIds.has(connection.id)) issue(`${path}.id`, `Duplicate connection id: ${connection.id}`);
      connectionIds.add(connection.id);
      for (const [side, endpoint] of [['from', connection.from], ['to', connection.to]] as const) {
        if (!planeIds.has(endpoint.planeId)) issue(`${path}.${side}.planeId`, `Unknown plane: ${endpoint.planeId}`);
        if (!insideCell(endpoint.x, endpoint.y)) issue(`${path}.${side}`, 'Connection endpoint must be inside map bounds');
      }
      const direction = directions[connection.from.edge];
      if (connection.to.x !== connection.from.x + direction.x || connection.to.y !== connection.from.y + direction.y || connection.to.edge !== direction.opposite) issue(path, 'Connection endpoints must describe opposite sides of adjacent cells');
      if (!surfaceExists(connection.to.planeId, connection.to.x, connection.to.y)) issue(`${path}.to`, 'Connection target must contain a surface');
    });
    const overridePositions = new Set<string>();
    map.navigationOverrides.forEach((override, index) => {
      const path = `maps.${mapId}.navigationOverrides[${index}]`;
      if (!planeIds.has(override.planeId)) issue(`${path}.planeId`, `Unknown plane: ${override.planeId}`);
      if (!insideCell(override.x, override.y)) issue(path, 'Navigation override must be inside map bounds');
      const position = `${override.planeId}:${override.x}:${override.y}`;
      if (overridePositions.has(position)) issue(path, `Duplicate navigation override: ${position}`);
      overridePositions.add(position);
      if (!override.cell && !override.edges) issue(path, 'Navigation override must change a cell or edge');
    });
    map.blockedRegions.forEach((region, index) => {
      const path = `maps.${mapId}.blockedRegions[${index}]`;
      if (!planeIds.has(region.planeId)) issue(`${path}.planeId`, `Unknown plane: ${region.planeId}`);
      if (!insideCell(region.x, region.y) || !insideCell(region.x + region.w - 1, region.y + region.h - 1)) issue(path, 'Blocked region must be inside map bounds');
    });
    const eventIds = new Set<string>();
    map.events.forEach((event, index) => {
      const path = `maps.${mapId}.events[${index}]`;
      if (eventIds.has(event.id)) issue(`${path}.id`, `Duplicate event id: ${event.id}`);
      eventIds.add(event.id);
      if (!planeIds.has(event.position.planeId)) issue(`${path}.position.planeId`, `Unknown plane: ${event.position.planeId}`);
      event.pages.forEach((page, pageIndex) => {
        validateConditions(page.conditions || [], `${path}.pages[${pageIndex}].conditions`, mapId);
        validateCommands(page.contents, `${path}.pages[${pageIndex}].contents`, mapId);
      });
    });
    map.enemySpawns.forEach((spawn, index) => {
      if (!enemies[spawn.enemyId]) issue(`maps.${mapId}.enemySpawns[${index}].enemyId`, 'Unknown enemy');
      if (!planeIds.has(spawn.planeId)) issue(`maps.${mapId}.enemySpawns[${index}].planeId`, `Unknown plane: ${spawn.planeId}`);
      if (enemies[spawn.enemyId]?.onDefeated) validateCommands(enemies[spawn.enemyId].onDefeated!, `enemies.${spawn.enemyId}.onDefeated`, mapId);
    });
    if (map.deathDestination && !maps[map.deathDestination.mapId]) issue(`maps.${mapId}.deathDestination.mapId`, 'Unknown map');
    else if (map.deathDestination && !maps[map.deathDestination.mapId].planes.some(plane => plane.id === map.deathDestination!.spawn.planeId)) issue(`maps.${mapId}.deathDestination.spawn.planeId`, 'Unknown destination plane');
  }
  const highestMapNumericId = Math.max(0, ...mapNumericIds);
  if (manifest.nextMapNumericId <= highestMapNumericId) issue('manifest.nextMapNumericId', 'Must be greater than every numeric map id');
  events.objectives.forEach((objective, index) => validateConditions(objective.conditions || [], `events.objectives[${index}].conditions`));
  for (const [category, catalog] of Object.entries(types)) {
    const ids = new Set<number>();
    for (const entry of catalog.entries) {
      if (ids.has(entry.id)) issue(`types.${category}.entries`, `Duplicate type id: ${entry.id}`);
      ids.add(entry.id);
    }
    const highestId = Math.max(0, ...ids);
    if (catalog.nextId <= highestId) issue(`types.${category}.nextId`, 'Must be greater than every type id');
  }
  return issues;
}

export function parseSourceGame(files: SourceGameFiles): SourceGameResult {
  files = migrateSourceGameFiles(files);
  const entries = [
    ['manifest', ManifestSchema, files.manifest], ['tilesets', z.record(Id, TilesetSchema), files.tilesets], ['maps', z.record(Id, MapSchema), files.maps],
    ['actors', ActorsSchema, files.actors], ['enemies', z.record(Id, EnemySchema), files.enemies],
    ['skills', z.record(Id, SkillSchema), files.skills], ['items', z.record(Id, ItemSchema), files.items],
    ['quests', z.record(Id, QuestSchema), files.quests], ['types', GameTypesSchema, files.types], ['ui', UiSchema, files.ui],
    ['events', EventsSchema, files.events], ['initialState', InitialStateSchema, files.initialState],
  ] as const;
  const parsed: Record<string, unknown> = {};
  const issues: ContentIssue[] = [];
  for (const [name, schema, value] of entries) {
    const result = schema.safeParse(value);
    if (result.success) parsed[name] = result.data;
    else result.error.issues.forEach(item => issues.push({ path: `${name}${item.path.length ? `.${item.path.join('.')}` : ''}`, message: item.message }));
  }
  if (issues.length) return { success: false, issues };
  const game = parsed as SourceGame;
  if (game.manifest.schemaVersion !== '0.12') issues.push({ path: 'manifest.schemaVersion', message: `Unsupported schema version: ${game.manifest.schemaVersion}` });
  if (!engineSupports(game.manifest.engineRange)) issues.push({ path: 'manifest.engineRange', message: `Player ${ENGINE_VERSION} is incompatible with ${game.manifest.engineRange}` });
  issues.push(...validateReferences(game));
  return issues.length ? { success: false, issues } : { success: true, data: game, issues: [] };
}

export function assertSourceGame(files: SourceGameFiles): SourceGame {
  const result = parseSourceGame(files);
  if (result.success) return result.data;
  const first = result.issues[0];
  throw new Error(`Invalid game package (${first.path}): ${first.message}`);
}
