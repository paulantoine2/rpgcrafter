export type Vec2 = { x: number; y: number };
export type Rect = Vec2 & { w: number; h: number };
export type Direction = 'north' | 'east' | 'south' | 'west';
export type PlanePosition = Vec2 & { planeId: string };
export type VariableComparison = 'equal' | 'notEqual' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual';
export type TeleportMapSource = { kind: 'constant'; mapId: string } | { kind: 'variable'; variableId: string };
export type TeleportNumberSource = { kind: 'constant'; value: number } | { kind: 'variable'; variableId: string };
export type TeleportDirection = 'retain' | Direction;
export type TeleportTransition = 'instant' | 'fadeBlack' | 'fadeWhite';

export type Condition =
  | { kind: 'switch'; id: string; equals?: boolean }
  | { kind: 'item'; id: string; amount?: number }
  | { kind: 'variable'; id: string; operator: VariableComparison; value: number };

export type EventCommand =
  | { type: 'dialogue'; speaker: string; text: string; choices?: Array<{ label: string; commands: EventCommand[] }> }
  | { type: 'conditional'; condition: Condition; thenCommands: EventCommand[]; elseCommands?: EventCommand[] }
  | { type: 'setSwitch'; id: string; value: boolean }
  | { type: 'setVariable'; id: string; value: number }
  | { type: 'giveItem' | 'removeItem'; id: string; amount?: number }
  | { type: 'unlockSkill'; id: string }
  | { type: 'healPlayer'; amount: number }
  | { type: 'toast'; text: string }
  | { type: 'teleport'; destination: { map: TeleportMapSource; x: TeleportNumberSource; y: TeleportNumberSource }; direction: TeleportDirection; transition: TeleportTransition }
  | { type: 'movementRoute'; target: MovementTarget; route: MovementRoute }
  | { type: 'wait'; duration: number }
  | { type: 'save' };

export type MapEventTrigger =
  | { type: 'actionButton'; radius: number }
  | { type: 'playerTouch'; size: { w: number; h: number } }
  | { type: 'eventTouch'; size: { w: number; h: number } }
  | { type: 'autorun' }
  | { type: 'parallel' };

export type MoveSpeed = 1 | 2 | 3 | 4 | 5 | 6;
export type MoveFrequency = 1 | 2 | 3 | 4 | 5;
export type MovementCommand =
  | { type: 'move'; direction: Direction | 'forward' | 'backward' | 'random' | 'towardPlayer' | 'awayFromPlayer' | 'left' | 'right' }
  | { type: 'turn'; direction: Direction | 'left' | 'right' | 'around' | 'random' | 'towardPlayer' | 'awayFromPlayer' }
  | { type: 'jump'; x: number; y: number }
  | { type: 'wait'; duration: number };
export type MovementRoute = {
  commands: MovementCommand[];
  repeat: boolean;
  skippable: boolean;
  wait: boolean;
};
export type AutonomousMovement = {
  type: 'fixed' | 'random' | 'approach' | 'custom';
  speed: MoveSpeed;
  frequency: MoveFrequency;
  route: MovementCommand[];
};
export type EventOptions = {
  walkingAnimation: boolean;
  steppingAnimation: boolean;
  directionFix: boolean;
  through: boolean;
};
export type EventMovement = AutonomousMovement & EventOptions;
export type MapEventPriority = 'belowCharacters' | 'sameAsCharacters' | 'aboveCharacters';
export type MovementTarget = { kind: 'player' } | { kind: 'thisEvent' } | { kind: 'event'; eventId: string };
export type MapEventSprite = {
  image: string;
  characterIndex: number;
  characterColumns: number;
  frameWidth: number;
  frameHeight: number;
  objectAligned: boolean;
};

export type MapEvent = {
  id: string;
  position: PlanePosition;
  pages: MapEventPage[];
};

export type MapEventPage = {
  conditions?: Condition[];
  sprite?: MapEventSprite;
  movement: AutonomousMovement;
  options: EventOptions;
  priority: MapEventPriority;
  trigger: MapEventTrigger;
  contents: EventCommand[];
};

export type EnemySpawn = PlanePosition & { enemyId: string };
export type QuarterCoordinate = [number, number];
export type AutotileVariant = { quarters: [QuarterCoordinate, QuarterCoordinate, QuarterCoordinate, QuarterCoordinate] };
export type AutotileTerrain = {
  id: string;
  name: string;
  origin: { column: number; row: number };
  previewMask: number;
  collision: TerrainCollision;
};
export type A1AnimationLayout = 'horizontal' | 'vertical' | 'none';
export type A1AutotileTerrain = AutotileTerrain & { animation: A1AnimationLayout };
export type A4AutotileTerrain = AutotileTerrain & { autotile: 'floor' | 'wall' };
export type GridTerrain = {
  id: string;
  name: string;
  origin: { column: number; row: number };
  collision: TerrainCollision;
};
export type TerrainCollision =
  | { kind: 'none' }
  | { kind: 'blockCell' }
  | { kind: 'edges'; edges: Direction[] };
export type TilesetBase = {
  id: string;
  name: string;
  category: string;
  image: string;
  tileSize: number;
  columns: number;
  rows: number;
};
export type A2TilesetDefinition = TilesetBase & {
  kind: 'a2';
  quarterSize: number;
  terrains: AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type A3TilesetDefinition = TilesetBase & {
  kind: 'a3';
  quarterSize: number;
  terrains: AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type A1TilesetDefinition = TilesetBase & {
  kind: 'a1';
  quarterSize: number;
  terrains: A1AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type A4TilesetDefinition = TilesetBase & {
  kind: 'a4';
  quarterSize: number;
  terrains: A4AutotileTerrain[];
  variants: Record<string, AutotileVariant>;
};
export type AutotileTilesetDefinition = A1TilesetDefinition | A2TilesetDefinition | A3TilesetDefinition | A4TilesetDefinition;
export type GridTilesetDefinition = TilesetBase & {
  kind: 'grid';
  terrains: GridTerrain[];
};
export type A5TilesetDefinition = TilesetBase & {
  kind: 'a5';
  terrains: GridTerrain[];
};
export type TilesetDefinition = AutotileTilesetDefinition | A5TilesetDefinition | GridTilesetDefinition;
export type TilesetTerrain = A1AutotileTerrain | A4AutotileTerrain | AutotileTerrain | GridTerrain;
export type TerrainPlacement = Vec2 & { tilesetId: string; terrainId: string };
export type RenderPhase = 'belowActors' | 'aboveActors';
export type SurfaceCoverage = 'bounds' | 'painted';
export type MapPlane = { id: string; name: string; order: number; surfaceLayerId: string; surfaceCoverage: SurfaceCoverage };
export type TileLayer = { id: string; name: string; planeId: string; renderPhase: RenderPhase; tiles: TerrainPlacement[] };
export type PlaneConnectionEndpoint = PlanePosition & { edge: Direction };
export type PlaneConnection = { id: string; from: PlaneConnectionEndpoint; to: PlaneConnectionEndpoint; bidirectional: boolean };
export type NavigationOverride = PlanePosition & {
  cell?: 'open' | 'blocked';
  edges?: Partial<Record<Direction, 'open' | 'blocked'>>;
};
export type BlockedRegion = Rect & { planeId: string };
export type GameMap = {
  id: string;
  numericId: number;
  name: string;
  parentMapId?: string;
  ground: string;
  accent: string;
  tileSize: number;
  bounds: Rect;
  planes: MapPlane[];
  tileLayers: TileLayer[];
  planeConnections: PlaneConnection[];
  navigationOverrides: NavigationOverride[];
  blockedRegions: BlockedRegion[];
  events: MapEvent[];
  enemySpawns: EnemySpawn[];
  deathDestination?: { mapId: string; spawn: PlanePosition };
};

export type EnemyBehavior = 'chase' | 'charge' | 'ranged' | 'boss';
export type EnemyTemplate = {
  name: string;
  color: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  behavior: EnemyBehavior;
  phases?: Array<{
    atHpRatio: number;
    speedMultiplier?: number;
    projectile?: { cooldown: number; speed: number; damage: number; color: string };
  }>;
  onDefeated?: EventCommand[];
};

export type Skill = { name: string; type: 'melee' | 'projectile' | 'area'; damage: number; cooldown: number; range?: number; projectileSpeed?: number; color?: string };
export type Item = { name: string; type: 'quest' | 'consumable' | 'equipment'; healing?: number; equipmentSlot?: string; stats?: Record<string, number> };
export type QuestDefinition = { name: string; states: string[]; reward?: { story: string } };
export type SwitchDefinition = { name: string; initialValue: boolean };
export type VariableDefinition = { name: string; initialValue: number };
export type UiDefinition = {
  theme: { fontFamily: string; pageBackground: string; panel: string; panelBorder: string; text: string; accent: string; health: string };
  hud: { slots: string[] };
  pauseMenu: { title: string; tabs: Array<{ id: string; label: string }> };
  equipmentSlots: Array<{ id: string; label: string }>;
};
export type Manifest = { schemaVersion: string; engineRange: string; gameId: string; version: string; nextMapNumericId: number; entryPoint: { mapId: string; spawnId: string }; title: string; contentRating: string };
export type PlayerDefinition = { id: string; name: string; start: PlanePosition; stats: { maxHp: number; level: number; xp: number }; primaryAttack: string; skillSlots: Record<string, string>; unlockedSkills: string[] };
export type Objective = { conditions?: Condition[]; text: string };
export type InitialState = { switches: Record<string, SwitchDefinition>; variables: Record<string, VariableDefinition>; quests: Record<string, string>; inventory?: Record<string, number>; equipment?: Record<string, string | null> };
export type EventData = { objectives: Objective[] };

/** The exact authoring representation. Every coordinate remains in tile units. */
export type SourceGame = {
  manifest: Manifest;
  tilesets: Record<string, TilesetDefinition>;
  maps: Record<string, GameMap>;
  actors: { player: PlayerDefinition };
  enemies: Record<string, EnemyTemplate>;
  skills: Record<string, Skill>;
  items: Record<string, Item>;
  quests: Record<string, QuestDefinition>;
  ui: UiDefinition;
  events: EventData;
  initialState: InitialState;
};

export type SourceGameFiles = {
  manifest: unknown;
  tilesets: unknown;
  maps: unknown;
  actors: unknown;
  enemies: unknown;
  skills: unknown;
  items: unknown;
  quests: unknown;
  ui: unknown;
  events: unknown;
  initialState: unknown;
};

export type ContentIssue = { path: string; message: string };
export type SourceGameResult =
  | { success: true; data: SourceGame; issues: [] }
  | { success: false; issues: ContentIssue[] };
