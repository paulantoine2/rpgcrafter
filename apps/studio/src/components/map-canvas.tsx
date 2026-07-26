import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AnimatedSprite, Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { Hand, HandGrab } from 'lucide-react';
import 'pixi.js/advanced-blend-modes';
import { A1_ANIMATION_FRAME_COUNT, A1_ANIMATION_FRAME_DURATION_MS, A1_ANIMATION_FRAME_STRIDE, A1_HORIZONTAL_ANIMATION_SEQUENCE, autotileVariant, buildNavigationGraph, navigationCellKey, navigationEdgeKey, resolveTerrainPlacements, type A1AnimationLayout, type AutotileRecipe, type AutotileTerrain, type AutotileTilesetDefinition, type AutotileVariant, type Direction, type GameMap, type PlanePosition, type TilesetDefinition, type Vec2 } from '@rpgcrafter/game-schema';
import { ellipseCells, floodFillCells, navigationTargetAtWorldPosition, rectangleCells, snapAndClampEventPosition, terrainBrushPlacements, tileAtWorldPosition } from '@/lib/editor-geometry';
import { mapCanvasCursor } from '@/lib/editor-cursor';
import { terrainSelectionAt } from '@/lib/tile-palette';
import type { DrawingTool, EditorMode, NavigationPaintMode, SelectedTerrain } from '@/components/studio-sidebar';
import type { EventTool } from '@/components/studio-toolbar';

const SOURCE_TILE_SIZE = 48;
type CanvasMode = EditorMode | 'navigation';

export type MapCanvasHandle = {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

type Props = {
  map: GameMap;
  tilesets: Record<string, TilesetDefinition>;
  assetUrls: Record<string, string>;
  mode: CanvasMode;
  activePlaneId: string;
  activeLayerId: string | null;
  selectedTerrain: SelectedTerrain | null;
  drawingTool: DrawingTool;
  eventTool: EventTool;
  playerStartMapId: string;
  playerStart: PlanePosition;
  showGrid: boolean;
  dimInactiveLayers: boolean;
  navigationPaintMode: NavigationPaintMode;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onCreateEvent: (x: number, y: number) => void;
  onMoveEvent: (id: string, x: number, y: number) => void;
  onDrawTiles: (cells: Vec2[], behavior: 'stamp' | 'fill') => void;
  onFillTile: (x: number, y: number) => void;
  onPickTerrain: (terrain: SelectedTerrain) => void;
  onPlacePlayerStart: (x: number, y: number, planeId: string) => void;
  onNavigateTarget: (x: number, y: number, edge?: Direction) => void;
  onHoverTile: (tile: Vec2 | null) => void;
};

function sourceTile(texture: Texture, column: number, row: number) {
  return new Texture({ source: texture.source, frame: new Rectangle(column * SOURCE_TILE_SIZE, row * SOURCE_TILE_SIZE, SOURCE_TILE_SIZE, SOURCE_TILE_SIZE) });
}

function composeAutotileTexture(atlas: Texture, tileset: AutotileTilesetDefinition, terrain: AutotileTerrain, variant: AutotileVariant, animationFrame = 0, animation: A1AnimationLayout = 'none') {
  const canvas = document.createElement('canvas');
  canvas.width = tileset.tileSize;
  canvas.height = tileset.tileSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`Could not compose terrain ${tileset.id}.${terrain.id}.`);
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

function drawingAreaPreview(cells: Vec2[], map: GameMap, scale: number, erasing: boolean) {
  const preview = new Graphics();
  for (const cell of cells) preview.rect(cell.x * map.tileSize, cell.y * map.tileSize, map.tileSize, map.tileSize);
  preview.fill({ color: erasing ? '#fb7185' : '#22d3ee', alpha: 0.28 });
  preview.stroke({ color: erasing ? '#fecdd3' : '#cffafe', alpha: 0.95, width: 2 / scale });
  return preview;
}

function transparentMapBackground(map: GameMap) {
  const background = new Graphics();
  const checkerSize = map.tileSize / 2;
  const worldX = map.bounds.x * map.tileSize;
  const worldY = map.bounds.y * map.tileSize;
  const worldWidth = map.bounds.w * map.tileSize;
  const worldHeight = map.bounds.h * map.tileSize;
  background.rect(worldX, worldY, worldWidth, worldHeight).fill('#f2f2f2');
  for (let row = 0; row < map.bounds.h * 2; row += 1) {
    for (let column = row % 2; column < map.bounds.w * 2; column += 2) {
      background.rect(worldX + column * checkerSize, worldY + row * checkerSize, checkerSize, checkerSize);
    }
  }
  background.fill('#d2d2d2');
  return background;
}

export const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cursorOverlayRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState('');
  const runtimeRef = useRef<{
    app: Application;
    world: Container;
    grid: Graphics | null;
    atlases: Map<string, Texture>;
    spriteAtlases: Map<string, Texture>;
    autotileTextures: Map<string, Texture>;
    scale: number;
    x: number;
    y: number;
    dragging: string | null;
    dragPointerId: number | null;
    painting: boolean;
    lastPainted: string | null;
    shape: { tool: 'rectangle' | 'ellipse'; start: Vec2; current: Vec2 } | null;
    preview: Graphics | null;
    redrawShapePreview: (() => void) | null;
    brushHover: Graphics | null;
    navigationHover: Graphics | null;
    hoveredTileKey: string | null;
    hoveringDraggable: boolean;
    pointerInside: boolean;
    spacePressed: boolean;
    panning: { x: number; y: number; originX: number; originY: number } | null;
  } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const updateCursor = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { mode, eventTool, drawingTool, selectedTerrain } = propsRef.current;
    runtime.app.canvas.style.cursor = mapCanvasCursor({
      mode,
      eventTool,
      drawingTool,
      hasSelectedTerrain: Boolean(selectedTerrain),
      spacePressed: runtime.spacePressed,
      panning: Boolean(runtime.panning),
      dragging: Boolean(runtime.dragging),
      hoveringDraggable: runtime.hoveringDraggable,
    });
    const cursorOverlay = cursorOverlayRef.current;
    if (cursorOverlay) {
      cursorOverlay.hidden = !runtime.spacePressed || !runtime.pointerInside;
      cursorOverlay.dataset.panning = String(Boolean(runtime.panning));
    }
  };

  const redrawGrid = (grid: Graphics, map: GameMap, zoom: number, mode: CanvasMode, showGrid: boolean) => {
    const tileSize = map.tileSize;
    const worldX = map.bounds.x * tileSize;
    const worldY = map.bounds.y * tileSize;
    const worldWidth = map.bounds.w * tileSize;
    const worldHeight = map.bounds.h * tileSize;
    grid.clear();
    if (!showGrid) return;
    for (let x = map.bounds.x; x <= map.bounds.x + map.bounds.w; x += 1) grid.moveTo(x * tileSize, worldY).lineTo(x * tileSize, worldY + worldHeight);
    for (let y = map.bounds.y; y <= map.bounds.y + map.bounds.h; y += 1) grid.moveTo(worldX, y * tileSize).lineTo(worldX + worldWidth, y * tileSize);
    // The grid is part of the scaled world, so compensate its world-space width
    // to keep a consistent screen-space line at every zoom level.
    grid.blendMode = 'difference';
    grid.stroke({
      color: '#ffffff',
      alpha: 0.4,
      width: 1 / zoom,
      pixelLine: mode === 'events',
    });
  };

  const applyCamera = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.world.scale.set(runtime.scale);
    runtime.world.position.set(runtime.x, runtime.y);
  };

  const fit = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const map = propsRef.current.map;
    const width = map.bounds.w * map.tileSize;
    const height = map.bounds.h * map.tileSize;
    runtime.scale = Math.min(2, Math.max(0.12, Math.min((runtime.app.renderer.width - 72) / width, (runtime.app.renderer.height - 72) / height)));
    runtime.x = (runtime.app.renderer.width - width * runtime.scale) / 2 - map.bounds.x * map.tileSize * runtime.scale;
    runtime.y = (runtime.app.renderer.height - height * runtime.scale) / 2 - map.bounds.y * map.tileSize * runtime.scale;
    if (runtime.grid) redrawGrid(runtime.grid, map, runtime.scale, propsRef.current.mode, propsRef.current.showGrid);
    runtime.redrawShapePreview?.();
    applyCamera();
  };

  const zoomBy = (factor: number, centerX?: number, centerY?: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const cx = centerX ?? runtime.app.renderer.width / 2;
    const cy = centerY ?? runtime.app.renderer.height / 2;
    const oldScale = runtime.scale;
    const nextScale = Math.min(3, Math.max(0.15, oldScale * factor));
    const worldX = (cx - runtime.x) / oldScale;
    const worldY = (cy - runtime.y) / oldScale;
    runtime.scale = nextScale;
    runtime.x = cx - worldX * nextScale;
    runtime.y = cy - worldY * nextScale;
    if (runtime.grid) redrawGrid(runtime.grid, propsRef.current.map, runtime.scale, propsRef.current.mode, propsRef.current.showGrid);
    runtime.redrawShapePreview?.();
    applyCamera();
  };

  useImperativeHandle(ref, () => ({ fit, zoomIn: () => zoomBy(1.2), zoomOut: () => zoomBy(1 / 1.2) }));

  const draw = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { map, tilesets, selectedEventId, onSelectEvent, activeLayerId, eventTool, playerStartMapId, playerStart } = propsRef.current;
    const brushHover = runtime.brushHover;
    for (const child of runtime.world.removeChildren()) {
      if (child !== brushHover) child.destroy({ children: true });
    }
    runtime.preview = null;
    runtime.navigationHover = null;
    const tileSize = map.tileSize;
    runtime.world.addChild(transparentMapBackground(map));

    const orderedLayers = [...map.planes].sort((a, b) => a.order - b.order).flatMap(plane => [
      ...map.tileLayers.filter(layer => layer.planeId === plane.id && layer.renderPhase === 'belowActors'),
      ...map.tileLayers.filter(layer => layer.planeId === plane.id && layer.renderPhase === 'aboveActors'),
    ]);
    for (const layer of orderedLayers) {
      for (const tile of resolveTerrainPlacements(layer.tiles)) {
        const authoredTileset = tilesets[tile.tilesetId];
        const authoredAtlas = authoredTileset && runtime.atlases.get(authoredTileset.id);
        const terrain = authoredTileset?.terrains.find(item => item.id === tile.terrainId);
        if (!authoredTileset || !authoredAtlas || !terrain) continue;
        const animation: A1AnimationLayout = authoredTileset.kind === 'a1' && 'animation' in terrain ? terrain.animation as A1AnimationLayout : 'none';
        const recipe: AutotileRecipe = animation === 'vertical' ? 'waterfall' : authoredTileset.kind === 'a4' && 'autotile' in terrain && terrain.autotile === 'wall' ? 'wall' : 'floor';
        const isAutotile = authoredTileset.kind === 'a1' || authoredTileset.kind === 'a2' || authoredTileset.kind === 'a4';
        const textureKey = `${authoredTileset.id}:${terrain.id}:${isAutotile ? `${tile.mask}:0` : 'grid'}`;
        let texture = runtime.autotileTextures.get(textureKey);
        if (!texture) {
          texture = isAutotile && 'previewMask' in terrain
            ? composeAutotileTexture(authoredAtlas, authoredTileset, terrain as AutotileTerrain, autotileVariant(authoredTileset, tile.mask, recipe))
            : sourceTile(authoredAtlas, terrain.origin.column, terrain.origin.row);
          runtime.autotileTextures.set(textureKey, texture);
        }
        let sprite: Sprite;
        if (authoredTileset.kind === 'a1' && animation !== 'none') {
          const sequence = animation === 'horizontal' ? A1_HORIZONTAL_ANIMATION_SEQUENCE : Array.from({ length: A1_ANIMATION_FRAME_COUNT }, (_, index) => index);
          const textures = sequence.map(animationFrame => {
            const frameKey = `${authoredTileset.id}:${terrain.id}:${tile.mask}:${animationFrame}`;
            let frameTexture = runtime.autotileTextures.get(frameKey);
            if (!frameTexture) {
              frameTexture = composeAutotileTexture(authoredAtlas, authoredTileset, terrain as AutotileTerrain, autotileVariant(authoredTileset, tile.mask, recipe), animationFrame, animation);
              runtime.autotileTextures.set(frameKey, frameTexture);
            }
            return frameTexture;
          });
          const animated = new AnimatedSprite(textures);
          animated.animationSpeed = 1000 / (A1_ANIMATION_FRAME_DURATION_MS * 60);
          animated.play();
          sprite = animated;
        } else sprite = new Sprite(texture);
        sprite.position.set(tile.x * tileSize, tile.y * tileSize);
        sprite.width = tileSize;
        sprite.height = tileSize;
        sprite.alpha = 1;
        sprite.tint = propsRef.current.mode === 'drawing' && propsRef.current.dimInactiveLayers && layer.id !== activeLayerId ? 0x707070 : 0xffffff;
        runtime.world.addChild(sprite);
      }
    }

    const grid = new Graphics();
    redrawGrid(grid, map, runtime.scale, propsRef.current.mode, propsRef.current.showGrid);
    runtime.grid = grid;
    runtime.world.addChild(grid);

    if (propsRef.current.mode === 'navigation') {
      const planeId = propsRef.current.activePlaneId, graph = buildNavigationGraph(map, tilesets), cellOverlay = new Graphics(), edgeOverlay = new Graphics();
      for (let y = map.bounds.y; y < map.bounds.y + map.bounds.h; y += 1) for (let x = map.bounds.x; x < map.bounds.x + map.bounds.w; x += 1) {
        if (graph.blockedCells.has(navigationCellKey(planeId, x, y))) cellOverlay.rect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
      cellOverlay.fill({ color: '#ef4444', alpha: 0.32 });
      runtime.world.addChild(cellOverlay);
      const renderedEdges = new Set<string>();
      for (let y = map.bounds.y; y < map.bounds.y + map.bounds.h; y += 1) for (let x = map.bounds.x; x < map.bounds.x + map.bounds.w; x += 1) {
        for (const edge of ['north', 'east', 'south', 'west'] as const) {
          const key = navigationEdgeKey(planeId, x, y, edge);
          if (!graph.blockedEdges.has(key) || renderedEdges.has(key)) continue;
          renderedEdges.add(key);
          if (edge === 'north') edgeOverlay.moveTo(x * tileSize, y * tileSize).lineTo((x + 1) * tileSize, y * tileSize);
          if (edge === 'east') edgeOverlay.moveTo((x + 1) * tileSize, y * tileSize).lineTo((x + 1) * tileSize, (y + 1) * tileSize);
          if (edge === 'south') edgeOverlay.moveTo(x * tileSize, (y + 1) * tileSize).lineTo((x + 1) * tileSize, (y + 1) * tileSize);
          if (edge === 'west') edgeOverlay.moveTo(x * tileSize, y * tileSize).lineTo(x * tileSize, (y + 1) * tileSize);
        }
      }
      edgeOverlay.stroke({ color: '#f59e0b', alpha: 0.95, width: 4 });
      for (const connection of map.planeConnections) if (connection.from.planeId === planeId || connection.to.planeId === planeId) {
        const endpoint = connection.from.planeId === planeId ? connection.from : connection.to;
        edgeOverlay.circle((endpoint.x + 0.5) * tileSize, (endpoint.y + 0.5) * tileSize, 7).fill('#22d3ee').stroke({ color: '#ecfeff', width: 2 });
      }
      runtime.world.addChild(edgeOverlay);
    }

    const enemyLayer = new Graphics();
    for (const enemy of map.enemySpawns) enemyLayer.circle(enemy.x * tileSize, enemy.y * tileSize, 8).fill({ color: '#ef4444', alpha: 0.65 }).stroke({ color: '#fecaca', width: 1 });
    runtime.world.addChild(enemyLayer);

    for (const event of map.events) {
      const x = event.position.x * tileSize;
      const y = event.position.y * tileSize;
      const selected = event.id === selectedEventId;
      const marker = new Graphics();
      if (selected && event.trigger.type === 'playerEnter') {
        marker.rect(x - event.trigger.size.w * tileSize / 2, y - event.trigger.size.h * tileSize / 2, event.trigger.size.w * tileSize, event.trigger.size.h * tileSize).fill({ color: '#22d3ee', alpha: 0.12 }).stroke({ color: '#67e8f9', width: 2 });
      }
      if (selected && event.trigger.type === 'interact') marker.circle(x, y, event.trigger.radius * tileSize).fill({ color: '#22d3ee', alpha: 0.08 }).stroke({ color: '#67e8f9', width: 2 });
      if (event.sprite) {
        const atlas = runtime.spriteAtlases.get(event.sprite.image);
        if (atlas) {
          const characterColumn = event.sprite.characterIndex % event.sprite.characterColumns;
          const characterRow = Math.floor(event.sprite.characterIndex / event.sprite.characterColumns);
          const texture = new Texture({ source: atlas.source, frame: new Rectangle((characterColumn * 3 + 1) * event.sprite.frameWidth, characterRow * 4 * event.sprite.frameHeight, event.sprite.frameWidth, event.sprite.frameHeight) });
          const eventSprite = new Sprite(texture);
          const scale = Math.min(1, tileSize / Math.max(event.sprite.frameWidth, event.sprite.frameHeight));
          eventSprite.anchor.set(0.5, event.sprite.objectAligned ? 1 : 0.5);
          eventSprite.position.set(x, event.sprite.objectAligned ? y + tileSize / 2 : y);
          eventSprite.scale.set(scale);
          runtime.world.addChild(eventSprite);
        }
      }
      marker.circle(x, y, selected ? 14 : 11).fill({ color: event.sprite ? '#0891b2' : '#a78bfa', alpha: event.sprite ? 0.35 : 0.95 }).stroke({ color: selected ? '#ffffff' : '#111827', width: selected ? 4 : 2 });
      marker.moveTo(x, y - 5).lineTo(x + 5, y).lineTo(x, y + 5).lineTo(x - 5, y).closePath().fill('#ffffff');
      if (propsRef.current.mode === 'events' && eventTool === 'cursor') {
        marker.eventMode = 'static';
        marker.cursor = 'grab';
        marker.hitArea = new Rectangle(x - 18, y - 18, 36, 36);
        marker.on('pointerdown', pointer => {
          if (pointer.button !== 0) return;
          if (runtime.spacePressed) return;
          pointer.stopPropagation();
          runtime.dragging = event.id;
          runtime.dragPointerId = pointer.pointerId;
          runtime.app.canvas.setPointerCapture(pointer.pointerId);
          marker.cursor = 'grabbing';
          updateCursor();
          onSelectEvent(event.id);
        });
      }
      runtime.world.addChild(marker);
      if (selected) {
        const label = new Text({ text: event.id, style: { fill: '#f8fafc', fontFamily: 'Geist Variable, sans-serif', fontSize: 12, fontWeight: '600' } });
        label.anchor.set(0.5, 1);
        label.position.set(x, y - 20);
        runtime.world.addChild(label);
      }
    }
    if (propsRef.current.mode === 'events' && map.id === playerStartMapId) {
      const x = playerStart.x * tileSize, y = playerStart.y * tileSize;
      const marker = new Graphics();
      marker.circle(x, y, 14).fill({ color: '#16a34a', alpha: 0.96 }).stroke({ color: '#ffffff', width: 3 });
      marker.circle(x, y - 4, 3.5).fill('#ffffff');
      marker.moveTo(x - 6, y + 7).quadraticCurveTo(x, y - 1, x + 6, y + 7).stroke({ color: '#ffffff', width: 3 });
      runtime.world.addChild(marker);
      const label = new Text({ text: 'PLAYER START', style: { fill: '#ffffff', fontFamily: 'Geist Variable, sans-serif', fontSize: 10, fontWeight: '700', stroke: { color: '#14532d', width: 3 } } });
      label.anchor.set(0.5, 1);
      label.position.set(x, y - 18);
      runtime.world.addChild(label);
    }
    if (brushHover && !brushHover.destroyed) runtime.world.addChild(brushHover);
  };

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let canvas: HTMLCanvasElement | undefined;
    let pointerLeaveHandler: (() => void) | undefined;
    let pointerMoveHandler: ((event: PointerEvent) => void) | undefined;
    let pointerUpHandler: ((event: PointerEvent) => void) | undefined;
    let contextMenuHandler: ((event: MouseEvent) => void) | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const runtime = runtimeRef.current;
      if (!runtime || event.code !== 'Space' || document.activeElement !== runtime.app.canvas) return;
      event.preventDefault();
      if (runtime.spacePressed) return;
      runtime.spacePressed = true;
      updateCursor();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const runtime = runtimeRef.current;
      if (!runtime || event.code !== 'Space') return;
      runtime.spacePressed = false;
      updateCursor();
    };
    const stopPointer = (commitShape = false) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      if (commitShape && runtime.shape) {
        const { map, onDrawTiles } = propsRef.current;
        onDrawTiles(runtime.shape.tool === 'rectangle'
          ? rectangleCells(runtime.shape.start, runtime.shape.current, map.bounds)
          : ellipseCells(runtime.shape.start, runtime.shape.current, map.bounds), 'fill');
      }
      runtime.preview?.removeFromParent();
      runtime.preview?.destroy();
      runtime.preview = null;
      runtime.shape = null;
      if (runtime.dragPointerId !== null && runtime.app.canvas.hasPointerCapture(runtime.dragPointerId)) runtime.app.canvas.releasePointerCapture(runtime.dragPointerId);
      runtime.dragging = null;
      runtime.dragPointerId = null;
      runtime.painting = false;
      runtime.lastPainted = null;
      runtime.panning = null;
      updateCursor();
    };
    const cancelPointer = () => {
      stopPointer(false);
      const runtime = runtimeRef.current;
      runtime?.brushHover?.removeFromParent();
      runtime?.brushHover?.destroy();
      runtime?.navigationHover?.removeFromParent();
      runtime?.navigationHover?.destroy();
      if (runtime) { runtime.brushHover = null; runtime.navigationHover = null; }
    };
    const onWindowBlur = () => {
      const runtime = runtimeRef.current;
      if (runtime) { runtime.spacePressed = false; runtime.hoveredTileKey = null; }
      propsRef.current.onHoverTile(null);
      cancelPointer();
    };
    const initialize = async () => {
      const host = hostRef.current;
      if (!host) return;
      setLoadError('');
      const app = new Application();
      await app.init({ resizeTo: host, antialias: false, backgroundAlpha: 0, resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true });
      if (cancelled) return app.destroy(true);
      host.appendChild(app.canvas);
      canvas = app.canvas;
      app.canvas.className = 'size-full outline-none';
      app.canvas.tabIndex = 0;
      const atlases = new Map<string, Texture>();
      await Promise.all(Object.values(propsRef.current.tilesets).map(async tileset => {
        const url = propsRef.current.assetUrls[tileset.image];
        if (!url) throw new Error(`Tileset image unavailable: ${tileset.image}`);
        const textureUrl = new URL(url, window.location.href);
        textureUrl.hash = 'rpgcrafter-texture.png';
        const atlas = await Assets.load<Texture>({ src: textureUrl.href, format: 'png', parser: 'texture' });
        if (!atlas?.source) throw new Error(`Tileset image could not be decoded: ${tileset.image}`);
        atlas.source.scaleMode = 'nearest';
        atlases.set(tileset.id, atlas);
      }));
      const spriteAtlases = new Map<string, Texture>();
      await Promise.all([...new Set(propsRef.current.map.events.flatMap(event => event.sprite ? [event.sprite.image] : []))].map(async image => {
        const url = propsRef.current.assetUrls[image];
        if (!url) return;
        const textureUrl = new URL(url, window.location.href);
        textureUrl.hash = 'rpgcrafter-sprite.png';
        const atlas = await Assets.load<Texture>({ src: textureUrl.href, format: 'png', parser: 'texture' });
        atlas.source.scaleMode = 'nearest';
        spriteAtlases.set(image, atlas);
      }));
      const world = new Container();
      app.stage.addChild(world);
      runtimeRef.current = { app, world, grid: null, atlases, spriteAtlases, autotileTextures: new Map(), scale: 1, x: 0, y: 0, dragging: null, dragPointerId: null, painting: false, lastPainted: null, shape: null, preview: null, redrawShapePreview: null, brushHover: null, navigationHover: null, hoveredTileKey: null, hoveringDraggable: false, pointerInside: false, spacePressed: false, panning: null };
      const applyPixiCursor = (hoveringDraggable: boolean) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        runtime.hoveringDraggable = hoveringDraggable;
        updateCursor();
      };
      app.renderer.events.cursorStyles.default = () => applyPixiCursor(false);
      app.renderer.events.cursorStyles.grab = () => applyPixiCursor(true);
      app.renderer.events.cursorStyles.grabbing = () => applyPixiCursor(true);
      updateCursor();
      const tileAt = (global: { x: number; y: number }) => {
        const runtime = runtimeRef.current;
        const { map } = propsRef.current;
        if (!runtime) return null;
        const local = runtime.world.toLocal(global);
        return tileAtWorldPosition({ x: local.x / map.tileSize, y: local.y / map.tileSize }, map.bounds);
      };
      const updateHoveredTile = (global?: { x: number; y: number }) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        const tile = global ? tileAt(global) : null;
        const key = tile ? `${tile.x}:${tile.y}` : null;
        if (key === runtime.hoveredTileKey) return;
        runtime.hoveredTileKey = key;
        propsRef.current.onHoverTile(tile);
      };
      const drawAt = (global: { x: number; y: number }) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        const tile = tileAt(global);
        if (!tile) return;
        const key = `${tile.x}:${tile.y}`;
        if (runtime.lastPainted === key) return;
        runtime.lastPainted = key;
        propsRef.current.onDrawTiles([tile], 'stamp');
      };
      const canvasPoint = (event: PointerEvent) => {
        const bounds = app.canvas.getBoundingClientRect();
        return {
          x: (event.clientX - bounds.left) * app.renderer.width / bounds.width,
          y: (event.clientY - bounds.top) * app.renderer.height / bounds.height,
        };
      };
      const moveDraggedEvent = (global: { x: number; y: number }) => {
        const runtime = runtimeRef.current;
        if (!runtime?.dragging) return;
        const map = propsRef.current.map;
        const local = runtime.world.toLocal(global);
        const { x, y } = snapAndClampEventPosition({ x: local.x / map.tileSize, y: local.y / map.tileSize }, map.bounds);
        propsRef.current.onMoveEvent(runtime.dragging, x, y);
      };
      const drawShapePreview = () => {
        const runtime = runtimeRef.current;
        if (!runtime?.shape) return;
        runtime.preview?.removeFromParent();
        runtime.preview?.destroy();
        const { map, drawingTool } = propsRef.current;
        const cells = runtime.shape.tool === 'rectangle'
          ? rectangleCells(runtime.shape.start, runtime.shape.current, map.bounds)
          : ellipseCells(runtime.shape.start, runtime.shape.current, map.bounds);
        const preview = drawingAreaPreview(cells, map, runtime.scale, drawingTool === 'eraser');
        runtime.preview = preview;
        runtime.world.addChild(preview);
      };
      if (runtimeRef.current) runtimeRef.current.redrawShapePreview = drawShapePreview;
      const drawBrushHover = (global: { x: number; y: number }) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        runtime.brushHover?.removeFromParent();
        runtime.brushHover?.destroy();
        runtime.brushHover = null;
        const { map, mode, drawingTool, selectedTerrain, activeLayerId } = propsRef.current;
        if (mode !== 'drawing' || runtime.spacePressed || (drawingTool !== 'eraser' && !selectedTerrain)) return;
        const anchor = tileAt(global);
        if (!anchor) return;
        let cells: Vec2[] = [anchor];
        if (drawingTool === 'pencil' && selectedTerrain) {
          cells = terrainBrushPlacements([anchor], selectedTerrain, map.bounds, 'stamp').map(({ x, y }) => ({ x, y }));
        } else if (drawingTool === 'bucket') {
          const layer = map.tileLayers.find(item => item.id === activeLayerId);
          if (layer) cells = floodFillCells(layer.tiles, anchor, map.bounds);
        }
        if (!cells.length) return;
        const hover = drawingAreaPreview(cells, map, runtime.scale, drawingTool === 'eraser');
        runtime.brushHover = hover;
        runtime.world.addChild(hover);
      };
      const navigationTargetAt = (global: { x: number; y: number }) => {
        const runtime = runtimeRef.current, { map, navigationPaintMode } = propsRef.current;
        if (!runtime) return null;
        const local = runtime.world.toLocal(global);
        return navigationTargetAtWorldPosition({ x: local.x / map.tileSize, y: local.y / map.tileSize }, map.bounds, navigationPaintMode === 'cell' ? 'cell' : 'edge');
      };
      const drawNavigationHover = (global: { x: number; y: number }) => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        runtime.navigationHover?.removeFromParent();
        runtime.navigationHover?.destroy();
        runtime.navigationHover = null;
        const target = navigationTargetAt(global);
        if (!target) return;
        const { map } = propsRef.current, hover = new Graphics(), x = target.x * map.tileSize, y = target.y * map.tileSize;
        if (!target.edge) hover.rect(x, y, map.tileSize, map.tileSize).fill({ color: '#22d3ee', alpha: 0.28 }).stroke({ color: '#a5f3fc', alpha: 0.95, width: 2 });
        if (target.edge === 'north') hover.moveTo(x, y).lineTo(x + map.tileSize, y);
        if (target.edge === 'east') hover.moveTo(x + map.tileSize, y).lineTo(x + map.tileSize, y + map.tileSize);
        if (target.edge === 'south') hover.moveTo(x, y + map.tileSize).lineTo(x + map.tileSize, y + map.tileSize);
        if (target.edge === 'west') hover.moveTo(x, y).lineTo(x, y + map.tileSize);
        if (target.edge) hover.stroke({ color: '#67e8f9', alpha: 1, width: propsRef.current.navigationPaintMode === 'connection' ? 4 : 7 });
        if (target.edge && propsRef.current.navigationPaintMode === 'connection') {
          const centerX = target.edge === 'east' ? x + map.tileSize : target.edge === 'west' ? x : x + map.tileSize / 2;
          const centerY = target.edge === 'south' ? y + map.tileSize : target.edge === 'north' ? y : y + map.tileSize / 2;
          if (target.edge === 'east' || target.edge === 'west') {
            hover.moveTo(centerX - 13, centerY).lineTo(centerX + 13, centerY);
            hover.moveTo(centerX - 13, centerY).lineTo(centerX - 7, centerY - 5).moveTo(centerX - 13, centerY).lineTo(centerX - 7, centerY + 5);
            hover.moveTo(centerX + 13, centerY).lineTo(centerX + 7, centerY - 5).moveTo(centerX + 13, centerY).lineTo(centerX + 7, centerY + 5);
          } else {
            hover.moveTo(centerX, centerY - 13).lineTo(centerX, centerY + 13);
            hover.moveTo(centerX, centerY - 13).lineTo(centerX - 5, centerY - 7).moveTo(centerX, centerY - 13).lineTo(centerX + 5, centerY - 7);
            hover.moveTo(centerX, centerY + 13).lineTo(centerX - 5, centerY + 7).moveTo(centerX, centerY + 13).lineTo(centerX + 5, centerY + 7);
          }
          hover.stroke({ color: '#ecfeff', alpha: 1, width: 3 });
        }
        runtime.navigationHover = hover;
        runtime.world.addChild(hover);
      };
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointerdown', pointer => {
        const runtime = runtimeRef.current;
        if (!runtime || runtime.dragging) return;
        if (propsRef.current.mode !== 'drawing' || propsRef.current.drawingTool !== 'pencil') {
          runtime.brushHover?.removeFromParent();
          runtime.brushHover?.destroy();
          runtime.brushHover = null;
        }
        app.canvas.focus();
        if (propsRef.current.mode === 'events' && propsRef.current.eventTool === 'playerStart' && pointer.button === 0) {
          const tile = tileAt(pointer.global);
          if (tile) propsRef.current.onPlacePlayerStart(tile.x + 0.5, tile.y + 0.5, propsRef.current.activePlaneId);
          return;
        }
        if (propsRef.current.mode === 'drawing' && pointer.button === 2) {
          const tile = tileAt(pointer.global);
          const selection = tile && terrainSelectionAt(propsRef.current.map.tileLayers, propsRef.current.activeLayerId, tile);
          if (selection) propsRef.current.onPickTerrain(selection);
          return;
        }
        if (propsRef.current.mode === 'drawing' || propsRef.current.mode === 'navigation') {
          if (runtime.spacePressed) {
            runtime.panning = { x: pointer.global.x, y: pointer.global.y, originX: runtime.x, originY: runtime.y };
            updateCursor();
          } else if (propsRef.current.mode === 'navigation') {
            const target = navigationTargetAt(pointer.global);
            if (target) propsRef.current.onNavigateTarget(target.x, target.y, target.edge);
          } else if (propsRef.current.drawingTool === 'eraser' || propsRef.current.selectedTerrain) {
            const tile = tileAt(pointer.global);
            if (!tile) return;
            if (propsRef.current.drawingTool === 'eraser') {
              runtime.shape = { tool: 'rectangle', start: tile, current: tile };
              drawShapePreview();
            } else if (propsRef.current.drawingTool === 'bucket') {
              propsRef.current.onFillTile(tile.x, tile.y);
            } else if (propsRef.current.drawingTool === 'pencil') {
              runtime.painting = true;
              drawAt(pointer.global);
              drawBrushHover(pointer.global);
            } else {
              runtime.shape = { tool: propsRef.current.drawingTool, start: tile, current: tile };
              drawShapePreview();
            }
          }
          return;
        }
        runtime.panning = { x: pointer.global.x, y: pointer.global.y, originX: runtime.x, originY: runtime.y };
        updateCursor();
      });
      app.stage.on('click', pointer => {
        const { mode, map, activePlaneId, onCreateEvent } = propsRef.current;
        if (mode !== 'events' || propsRef.current.eventTool !== 'cursor' || pointer.detail !== 2) return;
        const tile = tileAt(pointer.global);
        if (!tile) return;
        const occupied = map.events.some(event => event.position.planeId === activePlaneId && Math.floor(event.position.x) === tile.x && Math.floor(event.position.y) === tile.y);
        if (!occupied) onCreateEvent(tile.x + 0.5, tile.y + 0.5);
      });
      app.stage.on('globalpointermove', pointer => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        updateHoveredTile(pointer.global);
        if (runtime.dragging) {
          moveDraggedEvent(pointer.global);
        } else if (runtime.painting) {
          drawAt(pointer.global);
          drawBrushHover(pointer.global);
        } else if (runtime.shape) {
          const tile = tileAt(pointer.global);
          if (tile && (tile.x !== runtime.shape.current.x || tile.y !== runtime.shape.current.y)) {
            runtime.shape.current = tile;
            drawShapePreview();
          }
        } else if (runtime.panning) {
          runtime.x = runtime.panning.originX + pointer.global.x - runtime.panning.x;
          runtime.y = runtime.panning.originY + pointer.global.y - runtime.panning.y;
          applyCamera();
        } else if (propsRef.current.mode === 'navigation') {
          drawNavigationHover(pointer.global);
        } else if (propsRef.current.mode === 'drawing') {
          drawBrushHover(pointer.global);
        }
      });
      app.stage.on('pointerup', pointer => {
        const restoreEraserHover = propsRef.current.mode === 'drawing' && propsRef.current.drawingTool === 'eraser';
        stopPointer(true);
        if (restoreEraserHover) drawBrushHover(pointer.global);
      });
      app.stage.on('pointerupoutside', () => stopPointer(true));
      pointerMoveHandler = event => {
        const runtime = runtimeRef.current;
        if (!runtime) return;
        const hostBounds = hostRef.current?.getBoundingClientRect();
        const cursorOverlay = cursorOverlayRef.current;
        if (hostBounds && cursorOverlay) {
          cursorOverlay.style.transform = `translate3d(${event.clientX - hostBounds.left - 12}px, ${event.clientY - hostBounds.top - 12}px, 0)`;
        }
        if (!runtime.pointerInside) {
          runtime.pointerInside = true;
          updateCursor();
        }
        if (!runtime.dragging || runtime.dragPointerId !== event.pointerId) return;
        moveDraggedEvent(canvasPoint(event));
      };
      pointerUpHandler = event => {
        const runtime = runtimeRef.current;
        if (runtime?.dragPointerId === event.pointerId) stopPointer(true);
      };
      app.canvas.addEventListener('pointermove', pointerMoveHandler, true);
      app.canvas.addEventListener('pointerup', pointerUpHandler, true);
      app.canvas.addEventListener('pointercancel', pointerUpHandler, true);
      app.canvas.addEventListener('wheel', event => { event.preventDefault(); zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.offsetX, event.offsetY); }, { passive: false });
      contextMenuHandler = event => { if (propsRef.current.mode === 'drawing') event.preventDefault(); };
      app.canvas.addEventListener('contextmenu', contextMenuHandler);
      pointerLeaveHandler = () => {
        const runtime = runtimeRef.current;
        if (runtime) runtime.pointerInside = false;
        updateHoveredTile();
        cancelPointer();
      };
      app.canvas.addEventListener('pointerleave', pointerLeaveHandler);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onWindowBlur);
      resizeObserver = new ResizeObserver(() => { app.stage.hitArea = app.screen; });
      resizeObserver.observe(host);
      draw();
      requestAnimationFrame(fit);
    };
    void initialize().catch(reason => {
      if (cancelled) return;
      const message = reason instanceof Error ? reason.message : 'The map renderer could not be initialized.';
      setLoadError(message);
      console.error('Map canvas initialization failed:', reason);
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (pointerLeaveHandler) canvas?.removeEventListener('pointerleave', pointerLeaveHandler);
      if (pointerMoveHandler) canvas?.removeEventListener('pointermove', pointerMoveHandler, true);
      if (pointerUpHandler) {
        canvas?.removeEventListener('pointerup', pointerUpHandler, true);
        canvas?.removeEventListener('pointercancel', pointerUpHandler, true);
      }
      if (contextMenuHandler) canvas?.removeEventListener('contextmenu', contextMenuHandler);
      propsRef.current.onHoverTile(null);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      runtime?.app.destroy(true, { children: true });
    };
  }, [Object.values(props.assetUrls).join('|'), props.map.id, props.map.events.map(event => event.sprite?.image || '').join('|')]);

  useEffect(() => { draw(); }, [props.map, props.tilesets, props.selectedEventId, props.mode, props.eventTool, props.playerStartMapId, props.playerStart, props.activePlaneId, props.activeLayerId, props.showGrid, props.dimInactiveLayers]);
  useEffect(() => { requestAnimationFrame(fit); }, [props.map.id]);
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) {
      updateCursor();
      runtime.navigationHover?.removeFromParent();
      runtime.navigationHover?.destroy();
      runtime.navigationHover = null;
      runtime.brushHover?.removeFromParent();
      runtime.brushHover?.destroy();
      runtime.brushHover = null;
    }
  }, [props.mode, props.eventTool, props.selectedTerrain, props.drawingTool, props.navigationPaintMode]);

  return <div className="relative size-full overflow-hidden bg-card" aria-label={`${props.map.name} map editor`}>
    <div ref={hostRef} className="size-full" />
    <div ref={cursorOverlayRef} hidden className="group pointer-events-none absolute top-0 left-0 z-20 size-6 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" aria-hidden="true">
      <Hand className="size-6 fill-black/45 stroke-[2.5] group-data-[panning=true]:hidden" />
      <HandGrab className="hidden size-6 fill-black/45 stroke-[2.5] group-data-[panning=true]:block" />
    </div>
    {loadError && <div className="absolute inset-x-4 top-4 z-10 border border-destructive/40 bg-background/95 p-3 text-xs text-destructive shadow-lg">{loadError}</div>}
  </div>;
});
