import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { A1_ANIMATION_FRAME_STRIDE, autotileAnimationFrame, autotileVariant, resolveTerrainPlacements, type A1AnimationLayout, type AutotileRecipe, type AutotileTerrain, type AutotileTilesetDefinition, type AutotileVariant, type TerrainPlacement, type TilesetDefinition } from '@rpgcrafter/game-schema';
import { CHARACTER_DIRECTIONS, CHARACTER_FRAME_SIZE, characterDirection, characterFrame, walkFrame, type CharacterDirection } from './character-sprite.js';
import { actorRenderZ, planeRenderBase, tileLayerRenderZ, type RenderEnemy, type RenderState, type Renderer } from './renderer.js';

const WIDTH = 960;
const HEIGHT = 540;
const SOURCE_TILE_SIZE = 48;
const PLAYER_CHARACTER_INDEX = 0;

type FrameName = 'hero' | 'mayor' | 'merchant' | 'guardian' | 'wisp' | 'slime' | 'beetle' | 'chest' | 'door';
type PlayerFrames = Record<CharacterDirection, Texture[]>;

function playerFrames(texture: Texture, characterIndex: number): PlayerFrames {
  return Object.fromEntries(CHARACTER_DIRECTIONS.map(direction => [direction, [0, 1, 2].map(pattern => {
    const frame = characterFrame(characterIndex, direction, pattern);
    return new Texture({ source: texture.source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) });
  })])) as PlayerFrames;
}

function fallbackFrame(name: FrameName) {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`Impossible de créer la texture de secours ${name}.`);
  context.imageSmoothingEnabled = false;
  const rect = (color: string, x: number, y: number, width: number, height: number) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };

  if (name === 'door') {
    rect('#172033', 10, 4, 28, 42); rect('#6d3f2c', 13, 7, 22, 39); rect('#a9683e', 16, 10, 16, 33); rect('#f3cf72', 28, 27, 3, 3);
  } else if (name === 'chest') {
    rect('#351d25', 6, 18, 36, 24); rect('#8e4b2f', 8, 15, 32, 12); rect('#c9793c', 10, 18, 28, 7); rect('#f3cf72', 21, 24, 6, 10); rect('#291822', 8, 28, 32, 3);
  } else if (name === 'slime') {
    context.fillStyle = '#70d6a7'; context.beginPath(); context.arc(24, 27, 15, Math.PI, 0); context.lineTo(39, 39); context.lineTo(9, 39); context.closePath(); context.fill();
    rect('#173042', 17, 27, 4, 4); rect('#173042', 29, 27, 4, 4); rect('#d9fff0', 18, 27, 1, 1); rect('#d9fff0', 30, 27, 1, 1);
  } else if (name === 'beetle') {
    rect('#302044', 21, 6, 6, 10); rect('#7f5af0', 10, 14, 28, 27); rect('#4f378f', 22, 14, 4, 27); rect('#c4b5fd', 13, 18, 7, 5); rect('#c4b5fd', 28, 18, 7, 5);
    rect('#302044', 4, 18, 8, 3); rect('#302044', 36, 18, 8, 3); rect('#302044', 4, 32, 8, 3); rect('#302044', 36, 32, 8, 3);
  } else if (name === 'wisp') {
    context.fillStyle = '#9ee7ff'; context.beginPath(); context.arc(24, 20, 12, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#57bfe5'; context.beginPath(); context.moveTo(14, 26); context.lineTo(20, 43); context.lineTo(25, 29); context.lineTo(31, 40); context.lineTo(34, 24); context.closePath(); context.fill();
    rect('#ffffff', 18, 18, 3, 4); rect('#ffffff', 28, 18, 3, 4);
  } else {
    const colors: Record<Exclude<FrameName, 'door' | 'chest' | 'slime' | 'beetle' | 'wisp'>, [string, string]> = {
      hero: ['#3b82f6', '#f5c9a5'], mayor: ['#8b5cf6', '#e8bea0'], merchant: ['#d97706', '#efc6a4'], guardian: ['#31566e', '#8fc1cf'],
    };
    const [body, skin] = colors[name];
    rect('#182235', 17, 4, 14, 7); rect(skin, 16, 9, 16, 14); rect('#182235', 18, 13, 3, 3); rect('#182235', 27, 13, 3, 3);
    rect(body, 12, 23, 24, 18); rect('#172033', 14, 41, 8, 6); rect('#172033', 26, 41, 8, 6); rect('#dbeafe', 22, 25, 4, 11);
  }

  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

function sourceTile(texture: Texture, column: number, row: number) {
  return new Texture({ source: texture.source, frame: new Rectangle(column * SOURCE_TILE_SIZE, row * SOURCE_TILE_SIZE, SOURCE_TILE_SIZE, SOURCE_TILE_SIZE) });
}

function composeAutotileTexture(atlas: Texture, tileset: AutotileTilesetDefinition, terrain: AutotileTerrain, variant: AutotileVariant, animationFrame = 0, animation: A1AnimationLayout = 'none') {
  const canvas = document.createElement('canvas');
  canvas.width = tileset.tileSize;
  canvas.height = tileset.tileSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`Impossible de composer le terrain ${tileset.id}.${terrain.id}.`);
  context.imageSmoothingEnabled = false;
  variant.quarters.forEach(([quarterX, quarterY], index) => context.drawImage(
    atlas.source.resource as CanvasImageSource,
    (terrain.origin.column + (animation === 'horizontal' ? animationFrame * A1_ANIMATION_FRAME_STRIDE : 0)) * tileset.tileSize + quarterX * tileset.quarterSize,
    (terrain.origin.row + (animation === 'vertical' ? animationFrame : 0)) * tileset.tileSize + quarterY * tileset.quarterSize,
    tileset.quarterSize, tileset.quarterSize,
    (index % 2) * tileset.quarterSize, Math.floor(index / 2) * tileset.quarterSize,
    tileset.quarterSize, tileset.quarterSize,
  ));
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

/** Web renderer for the JRPG runtime. The engine itself never imports PixiJS. */
export class PixiRenderer implements Renderer {
  private readonly worldLayer = new Container();
  private readonly planeContentLayer = new Container();
  private readonly authoredTileBacking = new Graphics();
  private readonly spriteCache = new Map<string, Sprite>();
  private readonly authoredTiles = new Map<string, Sprite>();
  private readonly authoredTileTextures = new Map<string, Texture>();
  private readonly planeActorGraphics = new Map<string, Graphics>();
  private readonly planeEffectGraphics = new Map<string, Graphics>();
  private readonly terrainTopologyCache = new WeakMap<TerrainPlacement[], ReturnType<typeof resolveTerrainPlacements>>();

  private constructor(
    private readonly app: Application,
    private readonly frames: Record<FrameName, Texture>,
    private readonly playerFrames: PlayerFrames,
    private readonly tilesets: Record<string, TilesetDefinition>,
    private readonly tilesetTextures: Map<string, Texture>,
    private readonly terrain = new Graphics(),
    private readonly world = new Graphics(),
    private readonly details = new Graphics(),
    private readonly effects = new Graphics(),
    private readonly debug = new Graphics(),
    private readonly hud = new Graphics(),
    private readonly worldLabels = new Container(),
    private readonly hudLabels = new Container(),
  ) {
    this.planeContentLayer.sortableChildren = true;
    this.authoredTileBacking.zIndex = -1;
    this.planeContentLayer.addChild(this.authoredTileBacking);
    this.worldLayer.addChild(this.terrain, this.world, this.details, this.planeContentLayer, this.debug, this.effects, this.worldLabels);
    this.app.stage.addChild(this.worldLayer, this.hud, this.hudLabels);
  }

  static async create(canvas: HTMLCanvasElement, tilesets: Record<string, TilesetDefinition>, assetUrls: Record<string, string>) {
    const app = new Application();
    await app.init({ canvas, width: WIDTH, height: HEIGHT, antialias: false, backgroundAlpha: 0, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
    let playerSheet: Texture;
    try {
      playerSheet = await Assets.load<Texture>(new URL('../../../assets/sprites/rpg-maker-mz/Actor1.png', import.meta.url).href);
      playerSheet.source.scaleMode = 'nearest';
    } catch (error) {
      throw new Error('Impossible de charger le spriteset du joueur (Actor1.png)', { cause: error });
    }
    const tilesetTextures = new Map<string, Texture>();
    await Promise.all(Object.values(tilesets).map(async tileset => {
      const url = assetUrls[tileset.image];
      if (!url) throw new Error(`Impossible de charger tilesets.${tileset.id}.image (${tileset.image})`);
      try {
        // Studio previews pass image blobs whose URLs have no `.png` extension.
        // Tell Pixi which parser to use instead of relying on URL-based detection.
        const texture = await Assets.load<Texture>({ src: url, loadParser: 'loadTextures' });
        texture.source.scaleMode = 'nearest';
        tilesetTextures.set(tileset.id, texture);
      } catch (error) {
        throw new Error(`Impossible de charger tilesets.${tileset.id}.image (${tileset.image})`, { cause: error });
      }
    }));
    const characterFrames = Object.fromEntries((['hero', 'mayor', 'merchant', 'guardian', 'wisp', 'slime', 'beetle', 'chest', 'door'] as const).map(name => [name, fallbackFrame(name)])) as Record<FrameName, Texture>;
    return new PixiRenderer(app, characterFrames, playerFrames(playerSheet, PLAYER_CHARACTER_INDEX), tilesets, tilesetTextures);
  }

  render(state: RenderState) {
    this.clearLabels();
    this.worldLayer.position.set(-state.camera.x, -state.camera.y);
    this.drawTerrain(state);
    this.drawWorld(state);
    this.drawDebugGrid(state);
    this.drawEffects(state);
    this.drawHud(state);
  }

  destroy() { this.app.destroy(true, { children: true, texture: true }); }

  private drawTerrain(state: RenderState) {
    const { map } = state;
    const worldWidth = Math.max(map.bounds.w, WIDTH);
    const worldHeight = Math.max(map.bounds.h, HEIGHT);
    this.terrain.clear().rect(map.bounds.x, map.bounds.y, worldWidth, worldHeight).fill(map.ground);
    this.syncAuthoredLayers(map, map.ground);
  }

  private drawWorld(state: RenderState) {
    this.world.clear();
    this.details.clear();
    for (const graphics of this.planeActorGraphics.values()) { graphics.clear(); graphics.visible = false; }
    const activeSprites = new Set<string>();
    for (const event of state.events) if (event.visual?.type === 'exit' && event.trigger.type === 'playerEnter') {
      const { w, h } = event.trigger.size;
      const graphics = this.graphicsForPlane(state.map, event.position.planeId, 'actors');
      graphics.rect(event.position.x - w / 2, event.position.y - h / 2, w, h).fill({ color: '#9dd5f2', alpha: 0.18 }).rect(event.position.x - w / 2, event.position.y - h / 2, w, h).stroke({ color: '#bceaff', width: 2 });
    }
    const visualEvents = state.events.filter(event => event.visual && event.visual.type !== 'exit');
    const actors = [...visualEvents.map(event => ({ kind: 'event' as const, value: event, y: event.position.y })), ...state.enemies.map(enemy => ({ kind: 'enemy' as const, value: enemy, y: enemy.y })), { kind: 'player' as const, value: state.player, y: state.player.y }].sort((a, b) => a.y - b.y);
    for (const actor of actors) {
      const planeId = actor.kind === 'event' ? actor.value.position.planeId : actor.value.planeId;
      const graphics = this.graphicsForPlane(state.map, planeId, 'actors');
      if (actor.kind === 'event') this.drawEvent(graphics, actor.value, activeSprites);
      if (actor.kind === 'enemy') this.drawEnemy(graphics, graphics, actor.value, activeSprites);
      if (actor.kind === 'player') this.drawPlayer(graphics, state, activeSprites);
    }
    for (const [key, sprite] of this.spriteCache) sprite.visible = activeSprites.has(key);
    this.planeContentLayer.sortChildren();
    for (const projectile of state.projectiles) this.graphicsForPlane(state.map, projectile.planeId, 'actors').circle(projectile.x, projectile.y, projectile.r + 3).fill({ color: projectile.color, alpha: 0.2 }).circle(projectile.x, projectile.y, projectile.r).fill(projectile.color);
  }

  private drawDebugGrid(state: RenderState) {
    const graphics = this.debug.clear();
    if (!state.showTileGrid) return;
    const { x, y, w, h } = state.map.bounds;
    const endX = x + w;
    const endY = y + h;
    for (let tileX = x; tileX <= endX; tileX += state.map.tileSize) graphics.moveTo(tileX, y).lineTo(tileX, endY).stroke({ color: '#8ce6ff', alpha: 0.55, width: 1 });
    for (let tileY = y; tileY <= endY; tileY += state.map.tileSize) graphics.moveTo(x, tileY).lineTo(endX, tileY).stroke({ color: '#8ce6ff', alpha: 0.55, width: 1 });
    graphics.circle(state.player.x, state.player.y, state.player.radius).stroke({ color: '#55f7a5', width: 2 });
    graphics.moveTo(state.player.x - 4, state.player.y).lineTo(state.player.x + 4, state.player.y).moveTo(state.player.x, state.player.y - 4).lineTo(state.player.x, state.player.y + 4).stroke({ color: '#55f7a5', width: 1 });
    for (const enemy of state.enemies) {
      graphics.circle(enemy.x, enemy.y, enemy.radius).stroke({ color: '#ff6b8a', width: 2 });
      graphics.moveTo(enemy.x - 4, enemy.y).lineTo(enemy.x + 4, enemy.y).moveTo(enemy.x, enemy.y - 4).lineTo(enemy.x, enemy.y + 4).stroke({ color: '#ff6b8a', width: 1 });
    }
    for (const event of state.events) {
      if (event.trigger.type === 'playerEnter') graphics.rect(event.position.x - event.trigger.size.w / 2, event.position.y - event.trigger.size.h / 2, event.trigger.size.w, event.trigger.size.h).stroke({ color: '#ffd166', alpha: 0.8, width: 2 });
      else if (event.trigger.type === 'interact') graphics.circle(event.position.x, event.position.y, event.trigger.radius).stroke({ color: '#ffd166', alpha: 0.65, width: 1 });
    }
  }

  private drawEvent(graphics: Graphics, event: RenderState['events'][number], activeSprites: Set<string>) {
    const visual = event.visual;
    if (!visual || visual.type === 'exit') return;
    const { x, y } = event.position;
    const asset = visual.type === 'door' ? 'door' : visual.type === 'chest' ? 'chest' : event.id === 'mayor' ? 'mayor' : event.id === 'merchant' ? 'merchant' : null;
    if (asset) this.placeSprite(`event:${event.id}`, asset, x, y, event.position.planeId, visual.type === 'door' ? 106 : visual.type === 'chest' ? 78 : 88, visual.type === 'door' ? 122 : visual.type === 'chest' ? 76 : 94, activeSprites);
    else if (visual.type === 'door') graphics.roundRect(x - 18, y - 34, 36, 68, 4).fill(visual.color).stroke({ color: '#d6e6f5', alpha: 0.45, width: 2 }).circle(x + 9, y, 3).fill('#ffe18c');
    else if (visual.type === 'chest') graphics.roundRect(x - 18, y - 12, 36, 25, 4).fill(visual.color).stroke({ color: '#ffe18c', width: 2 }).rect(x - 18, y - 2, 36, 4).fill('#ffe18c');
    else graphics.circle(x, y - 10, visual.radius * 0.58).fill('#f2d3bc').roundRect(x - visual.radius * 0.66, y - 2, visual.radius * 1.32, visual.radius * 1.45, 5).fill(visual.color).circle(x - 4, y - 11, 1.5).fill('#172536').circle(x + 4, y - 11, 1.5).fill('#172536');
    if (event.nearby) this.addLabel(visual.name, x, y - visual.radius - 24, '#e2f0ff');
  }

  private drawEnemy(graphics: Graphics, details: Graphics, enemy: RenderEnemy, activeSprites: Set<string>) {
    const asset = enemy.id.startsWith('guardian-') ? 'guardian' : enemy.id.startsWith('wisp-') ? 'wisp' : enemy.id.startsWith('slime-') ? 'slime' : enemy.id.startsWith('beetle-') ? 'beetle' : null;
    if (asset) this.placeSprite(`enemy:${enemy.id}`, asset, enemy.x, enemy.y, enemy.planeId, asset === 'guardian' ? 128 : asset === 'beetle' ? 82 : 70, asset === 'guardian' ? 142 : asset === 'beetle' ? 82 : 70, activeSprites);
    else graphics.circle(enemy.x, enemy.y, enemy.radius + 5).fill({ color: enemy.color, alpha: 0.16 }).circle(enemy.x, enemy.y, enemy.radius).fill(enemy.color).stroke({ color: '#151b2c', width: 3 }).poly([enemy.x - 8, enemy.y - 2, enemy.x, enemy.y - enemy.radius - 7, enemy.x + 8, enemy.y - 2]).fill('#f7dcff');
    this.drawBar(details, enemy.x - 29, enemy.y - enemy.radius - 49, 58, 6, enemy.hp / enemy.maxHp, '#ff8096');
    if (enemy.phases?.length) this.addLabel(`${enemy.name}${enemy.phase ? ' — Furie' : ''}`, enemy.x, enemy.y - enemy.radius - 34, '#e9ccff');
  }

  private drawPlayer(graphics: Graphics, state: RenderState, activeSprites: Set<string>) {
    const { player, facing } = state;
    const direction = characterDirection(facing);
    const texture = this.playerFrames[direction][walkFrame(state.playerAnimationTime, state.playerMoving)];
    const sprite = this.placeTexturedSprite('player', texture, player.x, player.y, player.planeId, CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, activeSprites);
    sprite.alpha = player.invuln > 0 && Math.floor(player.invuln * 18) % 2 ? 0.4 : 1;
    graphics.moveTo(player.x + facing.x * 7, player.y + facing.y * 7).lineTo(player.x + facing.x * 29, player.y + facing.y * 29).stroke({ color: '#fff4bd', alpha: sprite.alpha, width: 4 });
  }

  private placeSprite(key: string, frameName: FrameName, x: number, y: number, planeId: string, width: number, height: number, activeSprites: Set<string>) {
    return this.placeTexturedSprite(key, this.frames[frameName], x, y, planeId, width, height, activeSprites);
  }

  private placeTexturedSprite(key: string, texture: Texture, x: number, y: number, planeId: string, width: number, height: number, activeSprites: Set<string>) {
    let sprite = this.spriteCache.get(key);
    if (!sprite) { sprite = new Sprite(texture); sprite.anchor.set(0.5); this.spriteCache.set(key, sprite); this.planeContentLayer.addChild(sprite); }
    if (sprite.texture !== texture) sprite.texture = texture;
    sprite.position.set(x, y); sprite.width = width; sprite.height = height; sprite.zIndex = this.activeMap ? actorRenderZ(this.activeMap, planeId, y) : y; sprite.alpha = 1; sprite.visible = true;
    activeSprites.add(key);
    return sprite;
  }

  private activeMap: RenderState['map'] | null = null;

  private graphicsForPlane(map: RenderState['map'], planeId: string, kind: 'actors' | 'effects') {
    const cache = kind === 'actors' ? this.planeActorGraphics : this.planeEffectGraphics;
    let graphics = cache.get(planeId);
    if (!graphics) { graphics = new Graphics(); cache.set(planeId, graphics); this.planeContentLayer.addChild(graphics); }
    graphics.zIndex = kind === 'actors' ? actorRenderZ(map, planeId, 0) : planeRenderBase(map, planeId) + 800_000;
    graphics.visible = true;
    return graphics;
  }

  private syncAuthoredLayers(map: RenderState['map'], ground: string) {
    this.activeMap = map;
    const { id: mapId, tileSize, tileLayers: layers } = map;
    const animationElapsed = performance.now();
    for (const tile of this.authoredTiles.values()) tile.visible = false;
    this.authoredTileBacking.clear();
    const backedPositions = new Set<string>();
    for (const layer of layers) for (const authored of layer.tiles) {
      const key = `${authored.x}:${authored.y}`;
      if (backedPositions.has(key)) continue;
      backedPositions.add(key);
      this.authoredTileBacking.rect(authored.x, authored.y, tileSize, tileSize);
    }
    if (backedPositions.size) this.authoredTileBacking.fill(ground);
    for (const [layerIndex, layer] of layers.entries()) {
      if (!layer.tiles.length) continue;
      let resolved = this.terrainTopologyCache.get(layer.tiles);
      if (!resolved) {
        resolved = resolveTerrainPlacements(layer.tiles, tileSize);
        this.terrainTopologyCache.set(layer.tiles, resolved);
      }
      for (const authored of resolved) {
        const tileset = this.tilesets[authored.tilesetId];
        const atlas = this.tilesetTextures.get(authored.tilesetId);
        const terrain = tileset?.terrains.find(item => item.id === authored.terrainId);
        if (!tileset || !atlas || !terrain) continue;
        const key = `${mapId}:${layer.id}:${authored.x}:${authored.y}`;
        const animation: A1AnimationLayout = tileset.kind === 'a1' && 'animation' in terrain ? terrain.animation as A1AnimationLayout : 'none';
        const recipe: AutotileRecipe = animation === 'vertical' ? 'waterfall' : tileset.kind === 'a3' || tileset.kind === 'a4' && 'autotile' in terrain && terrain.autotile === 'wall' ? 'wall' : 'floor';
        const animationFrame = tileset.kind === 'a1' ? autotileAnimationFrame(animationElapsed, animation) : 0;
        const isAutotile = tileset.kind === 'a1' || tileset.kind === 'a2' || tileset.kind === 'a3' || tileset.kind === 'a4';
        const textureKey = `${tileset.id}:${terrain.id}:${isAutotile ? `${authored.mask}:${animationFrame}` : 'grid'}`;
        let texture = this.authoredTileTextures.get(textureKey);
        if (!texture) {
          texture = isAutotile && 'previewMask' in terrain
            ? composeAutotileTexture(atlas, tileset, terrain as AutotileTerrain, autotileVariant(tileset, authored.mask, recipe), animationFrame, animation)
            : sourceTile(atlas, terrain.origin.column, terrain.origin.row);
          this.authoredTileTextures.set(textureKey, texture);
        }
        let tile = this.authoredTiles.get(key);
        if (!tile) {
          tile = new Sprite(texture);
          this.authoredTiles.set(key, tile);
          this.planeContentLayer.addChild(tile);
        }
        tile.texture = texture;
        tile.position.set(authored.x, authored.y);
        tile.width = tileSize;
        tile.height = tileSize;
        tile.zIndex = tileLayerRenderZ(map, layer, layerIndex);
        tile.visible = true;
      }
    }
    this.planeContentLayer.sortChildren();
  }

  private drawEffects(state: RenderState) {
    this.effects.clear();
    for (const graphics of this.planeEffectGraphics.values()) { graphics.clear(); graphics.visible = false; }
    for (const particle of state.particles) {
      const graphics = this.graphicsForPlane(state.map, particle.planeId, 'effects');
      if (particle.type === 'slash') graphics.arc(particle.x, particle.y, 27, -1, 1.8).stroke({ color: '#fff2a2', width: 6 });
      if (particle.type === 'wave') graphics.circle(particle.x, particle.y, (1 - particle.t / 0.45) * 105).stroke({ color: particle.color || '#ffffff', alpha: Math.min(1, particle.t * 2), width: 5 });
      if (particle.type === 'hit') this.addLabel(particle.text || '', particle.x, particle.y - 26, '#ffdfeb');
    }
    this.planeContentLayer.sortChildren();
  }

  private drawHud(state: RenderState) {
    const { player, hud } = state;
    const graphics = this.hud.clear().roundRect(16, 14, 250, 61, 8).fill({ color: hud.panel, alpha: 0.86 }).stroke({ color: '#91b8d4', alpha: 0.75, width: 1 });
    if (hud.slots.includes('health')) this.drawBar(graphics, 27, 46, 220, 13, player.hp / player.maxHp, hud.health);
    if (hud.slots.includes('level')) this.addLabel(`Niv. ${player.level}  ·  XP ${player.xp}`, 86, 28, hud.text, false, this.hudLabels);
    if (hud.slots.includes('health')) this.addLabel(`${Math.ceil(player.hp)} / ${player.maxHp} PV`, 137, 53, hud.text, false, this.hudLabels);
  }

  private drawBar(graphics: Graphics, x: number, y: number, width: number, height: number, ratio: number, color: string) {
    graphics.roundRect(x, y, width, height, height / 2).fill('#111827').roundRect(x, y, width * Math.max(0, Math.min(1, ratio)), height, height / 2).fill(color);
  }

  private addLabel(text: string, x: number, y: number, color: string, panel = true, layer = this.worldLabels) {
    const label = new Text({ text, style: { fill: color, fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '700' } });
    label.anchor.set(0.5); label.position.set(x, y);
    if (panel) { const width = label.width + 12; layer.addChild(new Graphics().roundRect(x - width / 2, y - 10, width, 20, 5).fill({ color: '#07101c', alpha: 0.86 })); }
    layer.addChild(label);
  }

  private clearLabels() {
    for (const child of this.worldLabels.removeChildren()) child.destroy({ children: true });
    for (const child of this.hudLabels.removeChildren()) child.destroy({ children: true });
  }
}
