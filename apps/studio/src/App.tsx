import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DIRECTION_OFFSETS, buildNavigationGraph, navigationCellKey, navigationEdgeKey, navigationHasCell } from '@rpgcrafter/game-schema';
import type { Direction, EventCommand, GameMap, MapEvent, RenderPhase, SourceGame, SurfaceCoverage, TerrainCollision, Vec2 } from '@rpgcrafter/game-schema';
import { Contrast, FolderOpen, Grid3X3, Maximize2, Minus, Plus, Upload } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventInspector } from '@/components/event-inspector';
import { AssetManager, type LibraryBundle, type LibrarySprite, type LibraryTileset } from '@/components/asset-manager-dialog';
import { MapCanvas, type MapCanvasHandle } from '@/components/map-canvas';
import { StudioSidebar, type DrawingTool, type EditorMode, type NavigationPaintMode, type SelectedTerrain } from '@/components/studio-sidebar';
import { StudioToolbar, type EventTool } from '@/components/studio-toolbar';
import { StudioAppSidebar } from '@/components/studio-app-sidebar';
import { SectionHeader, SectionHeaderActions } from '@/components/sidebar-section';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { IconButtonTooltip } from '@/components/ui/tooltip';
import { clearDraft, createEmptyProject, draftProjectId, exportGamePackage, listRecentProjects, loadBundledTilesetLibrary, loadReferenceProject, openProjectArchive, openRecentProject, restoreDraft, restoreProjectAssets, saveDraft, saveProjectAssets, validateSourceGame, type DraftDocumentName, type ProjectAssets, type ProjectBundle, type RecentProject } from '@/lib/source-game';
import { createTilesetDefinition, pngDimensions, tilesetConfigurationBlob, tilesetConfigurationPath, uniqueAssetId, type TilesetImportFormat } from '@/lib/tileset-import';
import { clearNavigationOverridesForCells, editTerrainLayer, editTerrainPlacementsLayer, floodFillCells, terrainBrushPlacements } from '@/lib/editor-geometry';
import { createMapEventAt, renameMapEvent } from '@/lib/editor-events';
import { readStudioLocation, studioLocationUrl } from '@/lib/studio-location';
import { createDefaultMap } from '@/lib/default-map';
import { editorShortcut } from '@/lib/editor-shortcuts';
import { moveMapInHierarchy, type MapDropPosition } from '@/lib/map-hierarchy';
import { defaultTerrainSelection, terrainSelectionExists } from '@/lib/tile-palette';

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
type DrawingHistoryState = Pick<GameMap, 'tileLayers' | 'navigationOverrides'>;
type DrawingHistoryEntry = { mapId: string; before: DrawingHistoryState; after: DrawingHistoryState };
type StudioTab = 'maps' | 'assets';

export default function App() {
  const initialLocationRef = useRef(readStudioLocation(window.location.search));
  const [game, setGame] = useState<SourceGame | null>(null);
  const [sourceGame, setSourceGame] = useState<SourceGame | null>(null);
  const [projectAssets, setProjectAssets] = useState<ProjectAssets>({});
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetUrlSource, setAssetUrlSource] = useState<ProjectAssets | null>(null);
  const [library, setLibrary] = useState<LibraryTileset[]>([]);
  const [librarySprites, setLibrarySprites] = useState<LibrarySprite[]>([]);
  const [libraryBundles, setLibraryBundles] = useState<LibraryBundle[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [selectedMapId, setSelectedMapId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventPageIndex, setSelectedEventPageIndex] = useState(0);
  const [editorMode, setEditorMode] = useState<EditorMode>(initialLocationRef.current.mode);
  const [activeProjectParam, setActiveProjectParam] = useState<string | null>(null);
  const [locationReady, setLocationReady] = useState(!initialLocationRef.current.projectId);
  const [selectedTerrain, setSelectedTerrain] = useState<SelectedTerrain | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<Record<string, string>>({});
  const [navigationPaintMode, setNavigationPaintMode] = useState<NavigationPaintMode>('cell');
  const [pendingConnection, setPendingConnection] = useState<{ sourcePlaneId: string; x: number; y: number; edge: Direction } | null>(null);
  const [connectionDestinationPlaneId, setConnectionDestinationPlaneId] = useState('');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pencil');
  const [eventTool, setEventTool] = useState<EventTool>('cursor');
  const [gridVisibility, setGridVisibility] = useState<Record<EditorMode, boolean>>({ events: true, drawing: false });
  const [dimInactiveLayers, setDimInactiveLayers] = useState(true);
  const [hoveredTile, setHoveredTile] = useState<Vec2 | null>(null);
  const [newPlaneDialog, setNewPlaneDialog] = useState(false);
  const [newPlaneName, setNewPlaneName] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [studioTab, setStudioTab] = useState<StudioTab>('maps');
  const [revertDialog, setRevertDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playError, setPlayError] = useState('');
  const [, setSaveState] = useState<SaveState>('idle');
  const [, setSaveError] = useState('');
  const mapCanvasRef = useRef<MapCanvasHandle>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const skipAutosaveRef = useRef(false);
  const dirtyDocumentsRef = useRef(new Map<DraftDocumentName, number>());
  const editRevisionRef = useRef(0);
  const projectSessionRef = useRef(0);
  const drawingUndoRef = useRef<DrawingHistoryEntry[]>([]);
  const drawingRedoRef = useRef<DrawingHistoryEntry[]>([]);

  useEffect(() => {
    const urls = Object.fromEntries(Object.entries(projectAssets).map(([path, blob]) => [path, URL.createObjectURL(blob)]));
    setAssetUrls(urls);
    setAssetUrlSource(projectAssets);
    return () => Object.values(urls).forEach(url => URL.revokeObjectURL(url));
  }, [projectAssets]);

  useLayoutEffect(() => {
    if (editorMode !== 'drawing' || !game || terrainSelectionExists(game.tilesets, selectedTerrain)) return;
    const selection = defaultTerrainSelection(game.tilesets);
    if (selection) setSelectedTerrain(selection);
  }, [editorMode, game?.tilesets, selectedTerrain]);

  useEffect(() => {
    if (!game || ((studioTab !== 'assets' && editorMode !== 'events') || library.length)) return;
    let cancelled = false;
    void loadBundledTilesetLibrary().then(catalog => {
      if (cancelled) return;
      const tilesets = catalog.tilesets.map(item => ({ ...item, kind: 'tileset' as const, url: URL.createObjectURL(item.blob) }));
      const sprites = catalog.sprites.map(item => ({ ...item, kind: 'sprite' as const, url: URL.createObjectURL(item.blob) }));
      const assetsById = new Map<string, LibraryTileset | LibrarySprite>();
      for (const item of tilesets) assetsById.set(item.definition.id, item);
      for (const item of sprites) assetsById.set(item.id, item);
      setLibrary(tilesets);
      setLibrarySprites(sprites);
      setLibraryBundles(catalog.bundles.map(bundle => ({
        id: bundle.id,
        name: bundle.name,
        version: bundle.version,
        assets: bundle.assetIds.map(id => assetsById.get(id)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)),
      })));
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'The asset library could not be loaded.'));
    return () => { cancelled = true; };
  }, [studioTab, editorMode, game?.manifest.gameId, library.length]);

  useEffect(() => () => library.forEach(item => URL.revokeObjectURL(item.url)), [library]);
  useEffect(() => () => librarySprites.forEach(item => URL.revokeObjectURL(item.url)), [librarySprites]);

  useEffect(() => { if (openDialog) void listRecentProjects().then(setRecentProjects).catch(() => setRecentProjects([])); }, [openDialog]);
  useEffect(() => {
    requestAnimationFrame(() => mapCanvasRef.current?.fit());
    const timer = window.setTimeout(() => mapCanvasRef.current?.fit(), 260);
    return () => window.clearTimeout(timer);
  }, [editorMode, studioTab]);

  const validation = useMemo(() => game ? validateSourceGame(game) : null, [game]);
  const selectedMap = game?.maps[selectedMapId];
  const preferredLayerId = selectedMap ? selectedLayerIds[selectedMapId] : undefined;
  const defaultLayerId = selectedMap ? [...selectedMap.planes].sort((a, b) => a.order - b.order)[0]?.surfaceLayerId : undefined;
  const selectedLayer = selectedMap?.tileLayers.find(layer => layer.id === preferredLayerId)
    || selectedMap?.tileLayers.find(layer => layer.id === defaultLayerId)
    || selectedMap?.tileLayers[0]
    || null;
  const selectedLayerId = selectedLayer?.id || null;
  const selectedEvent = selectedMap?.events.find(event => event.id === selectedEventId) || null;
  const tilesetAssetsReady = !game || !Object.keys(game.tilesets).length || (assetUrlSource === projectAssets && Object.values(game.tilesets).every(tileset => Boolean(assetUrls[tileset.image])));
  const selectedMapEventIds = selectedMap?.events.map(event => event.id).join('\u0000') || '';

  useEffect(() => {
    if (!selectedMap) return;
    if (!selectedMap.events.length) {
      if (selectedEventId !== null) setSelectedEventId(null);
      return;
    }
    if (!selectedMap.events.some(event => event.id === selectedEventId)) setSelectedEventId(selectedMap.events[0].id);
  }, [selectedMapId, selectedMapEventIds, selectedEventId]);

  useEffect(() => {
    if (!locationReady) return;
    const nextUrl = studioLocationUrl(window.location.href, { projectId: game ? activeProjectParam : null, mapId: game ? selectedMapId : null, mode: editorMode });
    window.history.replaceState(null, '', nextUrl);
  }, [locationReady, game, activeProjectParam, selectedMapId, editorMode]);

  const markDirty = (document: DraftDocumentName) => {
    editRevisionRef.current += 1;
    dirtyDocumentsRef.current.set(document, editRevisionRef.current);
  };

  const resetDrawingHistory = () => {
    drawingUndoRef.current = [];
    drawingRedoRef.current = [];
  };

  const recordDrawingEdit = (mapId: string, before: DrawingHistoryState, after: DrawingHistoryState) => {
    drawingUndoRef.current.push({ mapId, before: structuredClone(before), after: structuredClone(after) });
    drawingRedoRef.current = [];
  };

  const applyDrawingHistory = (direction: 'undo' | 'redo') => {
    const source = direction === 'undo' ? drawingUndoRef.current : drawingRedoRef.current;
    const destination = direction === 'undo' ? drawingRedoRef.current : drawingUndoRef.current;
    const entry = source.pop();
    if (!entry) return false;
    setGame(current => {
      const map = current?.maps[entry.mapId];
      if (!current || !map) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      const state = direction === 'undo' ? entry.before : entry.after;
      next.maps[entry.mapId].tileLayers = structuredClone(state.tileLayers);
      next.maps[entry.mapId].navigationOverrides = structuredClone(state.navigationOverrides);
      return next;
    });
    destination.push(entry);
    setSelectedMapId(entry.mapId);
    return true;
  };

  const undoDrawing = () => applyDrawingHistory('undo');
  const redoDrawing = () => applyDrawingHistory('redo');

  const persistDraft = async (snapshot: SourceGame) => {
    const session = projectSessionRef.current;
    const revisions = new Map(dirtyDocumentsRef.current);
    const documents = [...revisions.keys()];
    setSaveState('saving');
    setSaveError('');
    try {
      await saveDraft(snapshot, documents);
      for (const [document, revision] of revisions) if (dirtyDocumentsRef.current.get(document) === revision) dirtyDocumentsRef.current.delete(document);
      if (projectSessionRef.current === session) setSaveState(dirtyDocumentsRef.current.size ? 'unsaved' : 'saved');
    } catch (reason) {
      if (projectSessionRef.current !== session) return;
      setSaveError(reason instanceof Error ? reason.message : 'IndexedDB could not save this draft.');
      setSaveState('error');
    }
  };

  const flushDraft = (snapshot = game) => {
    if (!snapshot) return Promise.resolve();
    window.clearTimeout(saveTimerRef.current);
    return persistDraft(snapshot);
  };

  useEffect(() => {
    if (!game) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    setSaveState('unsaved');
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistDraft(game);
    }, 400);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [game]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.repeat) return;
      const shortcut = editorShortcut(event, editorMode, selectedMap?.tileLayers.slice(0, 4).map(layer => layer.id) || []);
      if (shortcut) {
        event.preventDefault();
        if (shortcut.type === 'mode') {
          setEditorMode(shortcut.mode);
        } else if (shortcut.type === 'layer') {
          setSelectedLayerIds(current => ({ ...current, [selectedMapId]: shortcut.layerId }));
        } else {
          setDrawingTool(shortcut.tool);
        }
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoDrawing(); else undoDrawing();
        return;
      }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redoDrawing(); return; }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); setOpenDialog(true); }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); void flushDraft(); }
      if (event.shiftKey && event.key.toLowerCase() === 'e' && game && validation?.success) { event.preventDefault(); void exportGamePackage(game, projectAssets); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [game, validation, projectAssets, editorMode, selectedMap, selectedMapId]);

  const activateProject = async (bundle: ProjectBundle, options: { restore?: boolean; projectParam: string; mapId?: string | null; mode?: EditorMode } ) => {
    const { restore = true, projectParam, mapId: requestedMapId, mode = 'events' } = options;
    projectSessionRef.current += 1;
    dirtyDocumentsRef.current.clear();
    setLoading(true);
    setError('');
    setSaveError('');
    try {
      void navigator.storage?.persist?.().catch(() => false);
      const source = bundle.game;
      const restored = restore ? await restoreDraft(source) : null;
      const next = restored || structuredClone(source);
      const savedAssets = restore ? await restoreProjectAssets(next) : {};
      const nextAssets = { ...bundle.assets, ...savedAssets };
      const mapId = requestedMapId && requestedMapId in next.maps ? requestedMapId : next.manifest.entryPoint.mapId in next.maps ? next.manifest.entryPoint.mapId : Object.keys(next.maps)[0];
      if (!restore) { await saveDraft(next); await saveProjectAssets(next, nextAssets); }
      setSourceGame(structuredClone(source));
      setProjectAssets(nextAssets);
      skipAutosaveRef.current = true;
      setGame(next);
      setActiveProjectParam(projectParam);
      setSelectedMapId(mapId);
      setEditorMode(mode);
      setSelectedLayerIds({});
      setSelectedTerrain(null);
      setSelectedEventId(next.maps[mapId]?.events[0]?.id || null);
      resetDrawingHistory();
      setSaveState(restored ? 'saved' : 'idle');
      setOpenDialog(false);
      if (!restore) setSaveState('saved');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The project could not be opened.');
    } finally {
      setLoading(false);
    }
  };

  const openReference = async () => {
    setLoading(true); setError('');
    try { await activateProject(await loadReferenceProject(), { projectParam: 'reference' }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The reference project could not be opened.'); }
    finally { setLoading(false); }
  };

  const openArchive = async (file: File) => {
    setLoading(true); setError('');
    try { const bundle = await openProjectArchive(file); await activateProject(bundle, { restore: false, projectParam: draftProjectId(bundle.game) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The project package could not be opened.'); }
    finally { setLoading(false); }
  };

  const openRecent = async (id: string) => {
    const bundle = await openRecentProject(id);
    if (!bundle) { setError('This saved project is incomplete or invalid.'); return; }
    await activateProject(bundle, { restore: false, projectParam: id });
  };

  const createProject = async () => {
    const title = newProjectTitle.trim();
    if (!title) return;
    setNewProjectDialog(false);
    const bundle = createEmptyProject(title);
    await activateProject(bundle, { restore: false, projectParam: draftProjectId(bundle.game) });
    setNewProjectTitle('');
  };

  useEffect(() => {
    const requested = initialLocationRef.current;
    if (!requested.projectId) return;
    const projectParam = requested.projectId;
    let cancelled = false;
    void (async () => {
      try {
        const bundle = projectParam === 'reference' ? await loadReferenceProject() : await openRecentProject(projectParam);
        if (cancelled) return;
        if (!bundle) throw new Error('The project stored in the URL is unavailable in this browser.');
        await activateProject(bundle, { restore: projectParam === 'reference', projectParam, mapId: requested.mapId, mode: requested.mode });
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'The project stored in the URL could not be opened.');
          setOpenDialog(true);
        }
      } finally {
        if (!cancelled) setLocationReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectMap = (mapId: string) => {
    if (!game) return;
    setPendingConnection(null);
    setSelectedMapId(mapId);
    setHoveredTile(null);
    setSelectedEventId(game.maps[mapId]?.events[0]?.id || null);
    setSelectedTerrain(null);
    requestAnimationFrame(() => mapCanvasRef.current?.fit());
  };

  const createMap = (width: number, height: number, parentMapId?: string) => {
    if (!game) return;
    const ids = new Set(Object.keys(game.maps));
    let number = ids.size + 1;
    while (ids.has(`map-${number}`)) number += 1;
    const id = `map-${number}`;
    setGame(current => {
      if (!current) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      next.maps = { [id]: createDefaultMap(id, `Map ${number}`, width, height, parentMapId), ...next.maps };
      return next;
    });
    setSelectedMapId(id);
    setHoveredTile(null);
    setSelectedLayerIds(current => ({ ...current, [id]: 'layer-1' }));
    setSelectedEventId(null);
    setSelectedTerrain(null);
    requestAnimationFrame(() => mapCanvasRef.current?.fit());
  };

  const renameMap = (mapId: string, name: string) => {
    setGame(current => {
      const map = current?.maps[mapId];
      if (!current || !map || map.name === name) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      next.maps[mapId].name = name;
      return next;
    });
  };

  const moveMap = (mapId: string, parentMapId: string | null) => {
    setGame(current => {
      const map = current?.maps[mapId];
      if (!current || !map || parentMapId === mapId || (parentMapId && !current.maps[parentMapId])) return current;
      let ancestorId = parentMapId || undefined;
      while (ancestorId) {
        if (ancestorId === mapId) return current;
        ancestorId = current.maps[ancestorId]?.parentMapId;
      }
      if ((map.parentMapId || null) === parentMapId) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      if (parentMapId) next.maps[mapId].parentMapId = parentMapId;
      else delete next.maps[mapId].parentMapId;
      return next;
    });
  };

  const reorderMap = (mapId: string, targetMapId: string, position: MapDropPosition) => {
    setGame(current => {
      if (!current) return current;
      const maps = moveMapInHierarchy(current.maps, mapId, targetMapId, position);
      if (maps === current.maps) return current;
      markDirty('maps.json');
      return { ...current, maps };
    });
  };

  const resizeMap = (mapId: string, width: number, height: number) => {
    setGame(current => {
      const map = current?.maps[mapId];
      if (!current || !map || (map.bounds.w === width && map.bounds.h === height)) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      const resized = next.maps[mapId];
      const inside = (x: number, y: number) => x >= resized.bounds.x && y >= resized.bounds.y && x < resized.bounds.x + width && y < resized.bounds.y + height;
      resized.bounds = { ...resized.bounds, w: width, h: height };
      resized.tileLayers = resized.tileLayers.map(layer => ({ ...layer, tiles: layer.tiles.filter(tile => inside(tile.x, tile.y)) }));
      resized.navigationOverrides = resized.navigationOverrides.filter(item => inside(item.x, item.y));
      resized.planeConnections = resized.planeConnections.filter(connection => inside(connection.from.x, connection.from.y) && inside(connection.to.x, connection.to.y));
      resized.blockedRegions = resized.blockedRegions.flatMap(region => {
        const x = Math.max(region.x, resized.bounds.x), y = Math.max(region.y, resized.bounds.y);
        const endX = Math.min(region.x + region.w, resized.bounds.x + width), endY = Math.min(region.y + region.h, resized.bounds.y + height);
        return endX > x && endY > y ? [{ ...region, x, y, w: endX - x, h: endY - y }] : [];
      });
      resized.events = resized.events.filter(event => inside(event.position.x, event.position.y));
      resized.enemySpawns = resized.enemySpawns.filter(spawn => inside(spawn.x, spawn.y));
      return next;
    });
    if (mapId === selectedMapId) requestAnimationFrame(() => mapCanvasRef.current?.fit());
  };

  const selectLayer = (layerId: string) => {
    const layer = selectedMap?.tileLayers.find(item => item.id === layerId);
    if (!layer) return;
    setSelectedLayerIds(current => ({ ...current, [selectedMapId]: layerId }));
  };

  const addLayer = () => {
    if (!game || !selectedMap) return;
    const existingIds = new Set(selectedMap.tileLayers.map(layer => layer.id));
    let number = selectedMap.tileLayers.length + 1;
    while (existingIds.has(`layer-${number}`)) number += 1;
    const id = `layer-${number}`;
    setGame(current => {
      if (!current) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      const planeId = selectedLayer?.planeId || [...next.maps[selectedMapId].planes].sort((a, b) => a.order - b.order)[0].id;
      next.maps[selectedMapId].tileLayers.push({ id, name: `Layer ${number}`, planeId, renderPhase: 'belowActors', tiles: [] });
      return next;
    });
    setSelectedLayerIds(current => ({ ...current, [selectedMapId]: id }));
  };

  const renameLayer = (layerId: string, name: string) => {
    setGame(current => {
      const layer = current?.maps[selectedMapId]?.tileLayers.find(item => item.id === layerId);
      if (!current || !layer || layer.name === name) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      next.maps[selectedMapId].tileLayers.find(item => item.id === layerId)!.name = name;
      return next;
    });
  };

  const deleteLayer = (layerId: string) => {
    const layers = selectedMap?.tileLayers;
    const index = layers?.findIndex(layer => layer.id === layerId) ?? -1;
    if (!layers || index < 0) return;
    if (selectedMap?.planes.some(plane => plane.surfaceLayerId === layerId)) return window.alert('A surface layer cannot be deleted while its plane exists.');
    if (layers[index].tiles.length && !window.confirm(`Delete “${layers[index].name}” and its ${layers[index].tiles.length} tiles?`)) return;
    const nextSelectedId = layers[index - 1]?.id || layers[index + 1]?.id;
    setGame(current => {
      if (!current) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      next.maps[selectedMapId].tileLayers.splice(index, 1);
      return next;
    });
    setSelectedLayerIds(current => {
      const next = { ...current };
      if (nextSelectedId) next[selectedMapId] = nextSelectedId;
      else delete next[selectedMapId];
      return next;
    });
    setSelectedTerrain(null);
  };

  const changeLayerPlane = (layerId: string, planeId: string) => setGame(current => {
    const map = current?.maps[selectedMapId], layer = map?.tileLayers.find(item => item.id === layerId);
    if (!current || !map || !layer || !map.planes.some(plane => plane.id === planeId) || map.planes.some(plane => plane.surfaceLayerId === layerId)) return current;
    markDirty('maps.json'); const next = structuredClone(current); next.maps[selectedMapId].tileLayers.find(item => item.id === layerId)!.planeId = planeId; return next;
  });

  const changeLayerPhase = (layerId: string, renderPhase: RenderPhase) => setGame(current => {
    const layer = current?.maps[selectedMapId]?.tileLayers.find(item => item.id === layerId);
    if (!current || !layer || layer.renderPhase === renderPhase) return current;
    markDirty('maps.json'); const next = structuredClone(current); next.maps[selectedMapId].tileLayers.find(item => item.id === layerId)!.renderPhase = renderPhase; return next;
  });

  const addPlane = () => {
    const name = newPlaneName.trim();
    if (!game || !selectedMap || !name) return;
    const planeIds = new Set(selectedMap.planes.map(plane => plane.id)), layerIds = new Set(selectedMap.tileLayers.map(layer => layer.id));
    let number = selectedMap.planes.length + 1; while (planeIds.has(`plane-${number}`) || layerIds.has(`surface-${number}`)) number += 1;
    const planeId = `plane-${number}`, layerId = `surface-${number}`;
    setGame(current => { if (!current) return current; markDirty('maps.json'); const next = structuredClone(current), map = next.maps[selectedMapId]; map.tileLayers.push({ id: layerId, name: `${name} — Surface`, planeId, renderPhase: 'belowActors', tiles: [] }); map.planes.push({ id: planeId, name, order: Math.max(-1, ...map.planes.map(plane => plane.order)) + 1, surfaceLayerId: layerId, surfaceCoverage: 'painted' }); return next; });
    setSelectedLayerIds(current => ({ ...current, [selectedMapId]: layerId })); setNewPlaneName(''); setNewPlaneDialog(false);
  };

  const renamePlane = (planeId: string, name: string) => setGame(current => { const plane = current?.maps[selectedMapId]?.planes.find(item => item.id === planeId); if (!current || !plane || plane.name === name) return current; markDirty('maps.json'); const next = structuredClone(current); next.maps[selectedMapId].planes.find(item => item.id === planeId)!.name = name; return next; });
  const movePlane = (planeId: string, direction: -1 | 1) => setGame(current => { const planes = current ? [...current.maps[selectedMapId].planes].sort((a, b) => a.order - b.order) : undefined; const index = planes?.findIndex(plane => plane.id === planeId) ?? -1, target = index + direction; if (!current || !planes || index < 0 || target < 0 || target >= planes.length) return current; [planes[index], planes[target]] = [planes[target], planes[index]]; markDirty('maps.json'); const next = structuredClone(current); next.maps[selectedMapId].planes = planes.map((plane, order) => ({ ...plane, order })); return next; });
  const deletePlane = (planeId: string) => {
    const map = selectedMap, plane = map?.planes.find(item => item.id === planeId); if (!map || !plane || map.planes.length === 1) return;
    const fallback = [...map.planes].sort((a, b) => a.order - b.order).find(item => item.id !== planeId); if (!fallback) return;
    setGame(current => {
      if (!current) return current;
      markDirty('maps.json');
      const next = structuredClone(current), nextMap = next.maps[selectedMapId];
      nextMap.planes = nextMap.planes.filter(item => item.id !== planeId).sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }));
      nextMap.tileLayers = nextMap.tileLayers.filter(layer => layer.planeId !== planeId);
      nextMap.events = nextMap.events.filter(event => event.position.planeId !== planeId);
      nextMap.enemySpawns = nextMap.enemySpawns.filter(spawn => spawn.planeId !== planeId);
      nextMap.planeConnections = nextMap.planeConnections.filter(connection => connection.from.planeId !== planeId && connection.to.planeId !== planeId);
      nextMap.navigationOverrides = nextMap.navigationOverrides.filter(item => item.planeId !== planeId);
      nextMap.blockedRegions = nextMap.blockedRegions.filter(region => region.planeId !== planeId);
      const remapCommands = (commands: EventCommand[]): EventCommand[] => commands.map(command => {
        if (command.type === 'teleport' && command.mapId === selectedMapId && command.position.planeId === planeId) return { ...command, position: { ...command.position, planeId: fallback.id } };
        if (command.type === 'dialogue' && command.choices) return { ...command, choices: command.choices.map(choice => ({ ...choice, commands: remapCommands(choice.commands) })) };
        return command;
      });
      for (const sourceMap of Object.values(next.maps)) {
        sourceMap.events = sourceMap.events.map(event => ({
          ...event,
          pages: event.pages.map(page => ({ ...page, contents: remapCommands(page.contents) })),
        }));
      }
      if (next.actors.player.start.planeId === planeId && next.manifest.entryPoint.mapId === selectedMapId) {
        next.actors.player.start = { ...next.actors.player.start, planeId: fallback.id };
        markDirty('actors.json');
      }
      let changedEnemies = false;
      next.enemies = Object.fromEntries(Object.entries(next.enemies).map(([id, enemy]) => {
        const onDefeated = enemy.onDefeated && remapCommands(enemy.onDefeated);
        if (onDefeated && onDefeated !== enemy.onDefeated) changedEnemies = true;
        return [id, onDefeated ? { ...enemy, onDefeated } : enemy];
      }));
      for (const sourceMap of Object.values(next.maps)) if (sourceMap.deathDestination?.mapId === selectedMapId && sourceMap.deathDestination.spawn.planeId === planeId) sourceMap.deathDestination.spawn.planeId = fallback.id;
      if (changedEnemies) markDirty('enemies.json');
      return next;
    });
    setSelectedLayerIds(current => ({ ...current, [selectedMapId]: fallback.surfaceLayerId }));
    if (selectedEvent?.position.planeId === planeId) setSelectedEventId(null);
  };
  const changeCoverage = (planeId: string, surfaceCoverage: SurfaceCoverage) => setGame(current => { if (!current) return current; markDirty('maps.json'); const next = structuredClone(current); next.maps[selectedMapId].planes.find(plane => plane.id === planeId)!.surfaceCoverage = surfaceCoverage; return next; });
  const changeSurface = (planeId: string, surfaceLayerId: string) => setGame(current => { const map = current?.maps[selectedMapId], layer = map?.tileLayers.find(item => item.id === surfaceLayerId); if (!current || !map || layer?.planeId !== planeId) return current; markDirty('maps.json'); const next = structuredClone(current); next.maps[selectedMapId].planes.find(plane => plane.id === planeId)!.surfaceLayerId = surfaceLayerId; return next; });
  const changeTerrainCollision = (tilesetId: string, terrainId: string, collision: TerrainCollision) => {
    const definition = game?.tilesets[tilesetId];
    if (!game || !definition?.terrains.some(item => item.id === terrainId)) return;
    markDirty('tilesets.json');
    const updatedDefinition = structuredClone(definition);
    updatedDefinition.terrains.find(item => item.id === terrainId)!.collision = collision;
    setGame(current => {
      if (!current?.tilesets[tilesetId]?.terrains.some(item => item.id === terrainId)) return current;
      const next = structuredClone(current);
      next.tilesets[tilesetId].terrains.find(item => item.id === terrainId)!.collision = collision;
      return next;
    });
    const configurationPath = tilesetConfigurationPath(updatedDefinition.image);
    const configurationBlob = tilesetConfigurationBlob(updatedDefinition);
    setProjectAssets(assets => ({ ...assets, [configurationPath]: configurationBlob }));
    void saveProjectAssets(game, { [configurationPath]: configurationBlob });
  };

  const paintNavigation = (x: number, y: number, edge?: Direction) => {
    const planeId = selectedLayer?.planeId || (selectedMap ? [...selectedMap.planes].sort((a, b) => a.order - b.order)[0]?.id : undefined); if (!planeId) return;
    setGame(current => {
      if (!current) return current;
      const currentMap = current.maps[selectedMapId], graph = buildNavigationGraph(currentMap, current.tilesets);
      const blocked = edge ? graph.blockedEdges.has(navigationEdgeKey(planeId, x, y, edge)) : graph.blockedCells.has(navigationCellKey(planeId, x, y));
      markDirty('maps.json');
      const next = structuredClone(current), overrides = next.maps[selectedMapId].navigationOverrides;
      if (edge) {
        const targetKey = navigationEdgeKey(planeId, x, y, edge);
        for (const item of overrides) for (const itemEdge of Object.keys(item.edges || {}) as Direction[]) {
          if (navigationEdgeKey(item.planeId, item.x, item.y, itemEdge) !== targetKey) continue;
          delete item.edges?.[itemEdge];
          if (item.edges && !Object.keys(item.edges).length) delete item.edges;
        }
      }
      let override = overrides.find(item => item.planeId === planeId && item.x === x && item.y === y);
      if (!override) { override = { planeId, x, y }; overrides.push(override); }
      if (edge) override.edges = { ...override.edges, [edge]: blocked ? 'open' : 'blocked' };
      else override.cell = blocked ? 'open' : 'blocked';
      next.maps[selectedMapId].navigationOverrides = overrides.filter(item => item.cell || item.edges);
      return next;
    });
  };
  const requestNavigationEdit = (x: number, y: number, edge?: Direction) => {
    if (navigationPaintMode !== 'connection') return paintNavigation(x, y, edge);
    const sourcePlaneId = selectedLayer?.planeId || selectedMap?.planes[0]?.id;
    if (!selectedMap || !sourcePlaneId || !edge) return;
    const existing = selectedMap.planeConnections.some(connection => (connection.from.planeId === sourcePlaneId && connection.from.x === x && connection.from.y === y && connection.from.edge === edge)
      || (connection.bidirectional && connection.to.planeId === sourcePlaneId && connection.to.x === x && connection.to.y === y && connection.to.edge === edge));
    if (existing) return window.alert('This edge already has a connection.');
    const destination = [...selectedMap.planes].sort((a, b) => a.order - b.order).find(plane => plane.id !== sourcePlaneId);
    if (!destination) return window.alert('Create another navigation plane before adding a connection.');
    setConnectionDestinationPlaneId(destination.id);
    setPendingConnection({ sourcePlaneId, x, y, edge });
  };
  const addConnection = (toPlaneId: string, x: number, y: number, edge: Direction, bidirectional: boolean, requestedFromPlaneId?: string) => {
    const fromPlaneId = requestedFromPlaneId || selectedLayer?.planeId;
    if (!selectedMap || !fromPlaneId || fromPlaneId === toPlaneId || !selectedMap.planes.some(plane => plane.id === toPlaneId)) return false;
    const offset = DIRECTION_OFFSETS[edge], to = { x: x + offset.x, y: y + offset.y };
    const inBounds = (position: { x: number; y: number }) => position.x >= selectedMap.bounds.x && position.y >= selectedMap.bounds.y && position.x < selectedMap.bounds.x + selectedMap.bounds.w && position.y < selectedMap.bounds.y + selectedMap.bounds.h;
    if (!inBounds({ x, y }) || !inBounds(to)) { window.alert('Both connection cells must be inside the map.'); return false; }
    const graph = buildNavigationGraph(selectedMap, game.tilesets);
    if (navigationHasCell(graph, fromPlaneId, to.x, to.y)) { window.alert('The current plane already has a navigable neighboring surface there, so it would take precedence. Leave or force that cell blocked.'); return false; }
    if (!navigationHasCell(graph, toPlaneId, to.x, to.y)) { window.alert('The destination plane has no accessible surface on the target cell.'); return false; }
    if (bidirectional && navigationHasCell(graph, toPlaneId, x, y)) { window.alert('The destination plane already has a navigable neighbor that would shadow the return connection.'); return false; }
    setGame(current => {
      if (!current) return current;
      markDirty('maps.json');
      const next = structuredClone(current), nextMap = next.maps[selectedMapId], connections = nextMap.planeConnections, ids = new Set(connections.map(item => item.id));
      const openEdge = (planeId: string, cellX: number, cellY: number, direction: Direction) => {
        const key = navigationEdgeKey(planeId, cellX, cellY, direction);
        for (const item of nextMap.navigationOverrides) for (const itemEdge of Object.keys(item.edges || {}) as Direction[]) {
          if (navigationEdgeKey(item.planeId, item.x, item.y, itemEdge) !== key) continue;
          delete item.edges?.[itemEdge];
          if (item.edges && !Object.keys(item.edges).length) delete item.edges;
        }
        let override = nextMap.navigationOverrides.find(item => item.planeId === planeId && item.x === cellX && item.y === cellY);
        if (!override) { override = { planeId, x: cellX, y: cellY }; nextMap.navigationOverrides.push(override); }
        override.edges = { ...override.edges, [direction]: 'open' };
      };
      openEdge(fromPlaneId, x, y, edge);
      if (bidirectional) openEdge(toPlaneId, to.x, to.y, offset.opposite);
      nextMap.navigationOverrides = nextMap.navigationOverrides.filter(item => item.cell || item.edges);
      let number = connections.length + 1; while (ids.has(`connection-${number}`)) number += 1;
      connections.push({ id: `connection-${number}`, from: { planeId: fromPlaneId, x, y, edge }, to: { planeId: toPlaneId, ...to, edge: offset.opposite }, bidirectional });
      return next;
    });
    return true;
  };
  const deleteConnection = (id: string) => setGame(current => {
    if (!current || !current.maps[selectedMapId].planeConnections.some(item => item.id === id)) return current;
    markDirty('maps.json');
    const next = structuredClone(current); next.maps[selectedMapId].planeConnections = next.maps[selectedMapId].planeConnections.filter(item => item.id !== id); return next;
  });

  const moveLayer = (layerId: string, direction: -1 | 1) => {
    setGame(current => {
      const layers = current?.maps[selectedMapId]?.tileLayers;
      const index = layers?.findIndex(layer => layer.id === layerId) ?? -1;
      const destination = index + direction;
      if (!current || !layers || index < 0 || destination < 0 || destination >= layers.length) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      const nextLayers = next.maps[selectedMapId].tileLayers;
      const [layer] = nextLayers.splice(index, 1);
      nextLayers.splice(destination, 0, layer);
      return next;
    });
  };

  const changeEvent = (nextEvent: MapEvent) => {
    setGame(current => {
      if (!current) return current;
      const next = structuredClone(current);
      const map = next.maps[selectedMapId];
      const index = map.events.findIndex(event => event.id === selectedEventId);
      if (index < 0) return current;
      markDirty('maps.json');
      map.events[index] = nextEvent;
      return next;
    });
    setSelectedEventId(nextEvent.id);
  };

  const createSwitch = (name: string) => {
    if (!game) return '';
    const trimmedName = name.trim();
    if (!trimmedName) return '';
    const id = uniqueAssetId(trimmedName, Object.keys(game.initialState.switches));
    setGame(current => {
      if (!current || current.initialState.switches[id]) return current;
      markDirty('initial-state.json');
      const next = structuredClone(current);
      next.initialState.switches[id] = { name: trimmedName, initialValue: false };
      return next;
    });
    return id;
  };

  const renameSwitch = (id: string, name: string) => setGame(current => {
    const trimmedName = name.trim();
    if (!current?.initialState.switches[id] || !trimmedName || current.initialState.switches[id].name === trimmedName) return current;
    markDirty('initial-state.json');
    const next = structuredClone(current);
    next.initialState.switches[id].name = trimmedName;
    return next;
  });

  const createVariable = (name: string) => {
    if (!game) return '';
    const trimmedName = name.trim();
    if (!trimmedName) return '';
    const id = uniqueAssetId(trimmedName, Object.keys(game.initialState.variables));
    setGame(current => {
      if (!current || current.initialState.variables[id]) return current;
      markDirty('initial-state.json');
      const next = structuredClone(current);
      next.initialState.variables[id] = { name: trimmedName, initialValue: 0 };
      return next;
    });
    return id;
  };

  const renameVariable = (id: string, name: string) => setGame(current => {
    const trimmedName = name.trim();
    if (!current?.initialState.variables[id] || !trimmedName || current.initialState.variables[id].name === trimmedName) return current;
    markDirty('initial-state.json');
    const next = structuredClone(current);
    next.initialState.variables[id].name = trimmedName;
    return next;
  });

  const renameItem = (id: string, name: string) => setGame(current => {
    const trimmedName = name.trim();
    if (!current?.items[id] || !trimmedName || current.items[id].name === trimmedName) return current;
    markDirty('items.json');
    const next = structuredClone(current);
    next.items[id].name = trimmedName;
    return next;
  });

  const renameEvent = (eventId: string, nextId: string) => {
    const trimmedId = nextId.trim();
    if (!game || !trimmedId || trimmedId === eventId || game.maps[selectedMapId]?.events.some(event => event.id === trimmedId)) return;
    setGame(current => {
      if (!current) return current;
      const result = renameMapEvent(current, selectedMapId, eventId, trimmedId);
      if (!result) return current;
      markDirty('maps.json');
      if (result.enemiesChanged) markDirty('enemies.json');
      return result.game;
    });
    setSelectedEventId(current => current === eventId ? trimmedId : current);
  };

  const moveEvent = (id: string, x: number, y: number) => {
    setGame(current => {
      if (!current) return current;
      const event = current.maps[selectedMapId]?.events.find(item => item.id === id);
      if (!event || (event.position.x === x && event.position.y === y)) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      const nextEvent = next.maps[selectedMapId].events.find(item => item.id === id)!;
      nextEvent.position = { ...nextEvent.position, x, y };
      return next;
    });
  };

  const createEvent = (x: number, y: number) => {
    if (!game || !selectedMap) return;
    const planeId = selectedLayer?.planeId || [...selectedMap.planes].sort((a, b) => a.order - b.order)[0]?.id;
    if (!planeId) return;
    const created = createMapEventAt(game, selectedMapId, { x, y, planeId });
    setGame(current => {
      if (!current || !current.maps[selectedMapId] || current.maps[selectedMapId].events.some(event => event.id === created.id)) return current;
      markDirty('maps.json');
      const next = structuredClone(current);
      next.maps[selectedMapId].events.push(created);
      return next;
    });
    setSelectedEventId(created.id);
  };

  const placePlayerStart = (x: number, y: number, planeId: string) => {
    setGame(current => {
      const map = current?.maps[selectedMapId];
      if (!current || !map?.planes.some(plane => plane.id === planeId)) return current;
      const previous = current.actors.player.start;
      const mapChanged = current.manifest.entryPoint.mapId !== selectedMapId;
      const positionChanged = previous.x !== x || previous.y !== y || previous.planeId !== planeId;
      if (!mapChanged && !positionChanged) return current;
      if (mapChanged) markDirty('manifest.json');
      if (positionChanged) markDirty('actors.json');
      const next = structuredClone(current);
      next.manifest.entryPoint.mapId = selectedMapId;
      next.actors.player.start = { x, y, planeId };
      return next;
    });
  };

  const drawMapTiles = (cells: Vec2[], behavior: 'stamp' | 'fill') => {
    if (!selectedLayerId || (drawingTool !== 'eraser' && !selectedTerrain)) return;
    setGame(current => {
      if (!current) return current;
      const map = current.maps[selectedMapId], layer = map?.tileLayers.find(item => item.id === selectedLayerId);
      if (!map || !layer) return current;
      const placements = drawingTool !== 'eraser' && selectedTerrain ? terrainBrushPlacements(cells, selectedTerrain, map.bounds, behavior) : [];
      const affectedCells = drawingTool === 'eraser' ? cells : placements.map(({ x, y }) => ({ x, y }));
      const nextLayers = drawingTool === 'eraser' ? editTerrainLayer(map.tileLayers, selectedLayerId, cells, null) : editTerrainPlacementsLayer(map.tileLayers, selectedLayerId, placements);
      const nextOverrides = clearNavigationOverridesForCells(map.navigationOverrides, layer.planeId, affectedCells);
      if (nextLayers === map.tileLayers && nextOverrides === map.navigationOverrides) return current;
      markDirty('maps.json');
      recordDrawingEdit(selectedMapId, { tileLayers: map.tileLayers, navigationOverrides: map.navigationOverrides }, { tileLayers: nextLayers, navigationOverrides: nextOverrides });
      const next = structuredClone(current);
      next.maps[selectedMapId].tileLayers = nextLayers;
      next.maps[selectedMapId].navigationOverrides = nextOverrides;
      return next;
    });
  };

  const fillMapTile = (x: number, y: number) => {
    if (!selectedLayerId || !selectedTerrain) return;
    setGame(current => {
      const map = current?.maps[selectedMapId];
      const layer = map?.tileLayers.find(item => item.id === selectedLayerId);
      if (!current || !map || !layer) return current;
      const cells = floodFillCells(layer.tiles, { x, y }, map.bounds);
      const placements = terrainBrushPlacements(cells, selectedTerrain, map.bounds, 'fill', { x, y });
      const nextLayers = editTerrainPlacementsLayer(map.tileLayers, selectedLayerId, placements);
      const nextOverrides = clearNavigationOverridesForCells(map.navigationOverrides, layer.planeId, cells);
      if (nextLayers === map.tileLayers && nextOverrides === map.navigationOverrides) return current;
      markDirty('maps.json');
      recordDrawingEdit(selectedMapId, { tileLayers: map.tileLayers, navigationOverrides: map.navigationOverrides }, { tileLayers: nextLayers, navigationOverrides: nextOverrides });
      const next = structuredClone(current);
      next.maps[selectedMapId].tileLayers = nextLayers;
      next.maps[selectedMapId].navigationOverrides = nextOverrides;
      return next;
    });
  };

  const revert = async () => {
    if (!game || !sourceGame) return;
    window.clearTimeout(saveTimerRef.current);
    const session = ++projectSessionRef.current;
    dirtyDocumentsRef.current.clear();
    setSaveState('saving');
    setSaveError('');
    try {
      await clearDraft(game);
      if (projectSessionRef.current !== session) return;
      const next = structuredClone(sourceGame);
      skipAutosaveRef.current = true;
      setGame(next);
      const assetPaths = [
        ...Object.values(next.tilesets).flatMap(tileset => [tileset.image, tilesetConfigurationPath(tileset.image)]),
        ...Object.values(next.maps).flatMap(map => map.events.flatMap(event => event.pages.flatMap(page => page.sprite ? [page.sprite.image] : []))),
      ];
      setProjectAssets(Object.fromEntries(assetPaths.map(assetPath => [assetPath, projectAssets[assetPath]]).filter((entry): entry is [string, Blob] => Boolean(entry[1]))));
      const mapId = next.manifest.entryPoint.mapId;
      setSelectedMapId(mapId);
      setSelectedLayerIds({});
      setSelectedTerrain(null);
      setSelectedEventId(next.maps[mapId]?.events[0]?.id || null);
      resetDrawingHistory();
      setSaveState('idle');
      setRevertDialog(false);
    } catch (reason) {
      markDirty('maps.json');
      markDirty('events.json');
      setSaveError(reason instanceof Error ? reason.message : 'IndexedDB could not clear this draft.');
      setSaveState('error');
    }
  };

  const closeProject = () => {
    const snapshot = game;
    if (snapshot) void flushDraft(snapshot);
    projectSessionRef.current += 1;
    dirtyDocumentsRef.current.clear();
    setGame(null);
    setActiveProjectParam(null);
    setSourceGame(null);
    setProjectAssets({});
    setSelectedMapId('');
    setSelectedLayerIds({});
    setSelectedTerrain(null);
    setSelectedEventId(null);
    setStudioTab('maps');
    resetDrawingHistory();
    setSaveState('idle');
    setSaveError('');
  };

  const playGame = () => {
    if (!game || !validation?.success) return;
    void flushDraft();
    const configuredUrl = import.meta.env.VITE_PLAYER_URL || 'http://127.0.0.1:4173/';
    const playerUrl = new URL(configuredUrl, window.location.href);
    playerUrl.searchParams.set('studioPreview', '1');
    playerUrl.searchParams.set('studioOrigin', window.location.origin);
    const playerWindow = window.open(playerUrl.href, '_blank');
    if (!playerWindow) {
      setPlayError('The Player could not be opened. Allow pop-ups for the Studio and try again.');
      return;
    }
    const snapshot = structuredClone(game);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== playerWindow || event.origin !== playerUrl.origin || event.data?.type !== 'rpgcrafter-player-ready') return;
      playerWindow.postMessage({ type: 'rpgcrafter-studio-preview', game: snapshot, assets: projectAssets }, playerUrl.origin);
    };
    window.addEventListener('message', onMessage);
    const closePoll = window.setInterval(() => {
      if (!playerWindow.closed) return;
      window.clearInterval(closePoll);
      window.removeEventListener('message', onMessage);
    }, 1_000);
  };

  const importTilesets = async (entries: Array<{ definition: SourceGame['tilesets'][string]; assets: ProjectAssets }>) => {
    if (!game) return;
    const pending = entries.filter(entry => !game.tilesets[entry.definition.id]);
    if (!pending.length) return;
    const importedAssets = Object.assign({}, ...pending.map(entry => entry.assets)) as ProjectAssets;
    setProjectAssets(current => ({ ...current, ...importedAssets }));
    setGame(current => {
      if (!current) return current;
      markDirty('tilesets.json');
      const next = structuredClone(current);
      for (const entry of pending) if (!next.tilesets[entry.definition.id]) next.tilesets[entry.definition.id] = structuredClone(entry.definition);
      return next;
    });
    await saveProjectAssets(game, importedAssets);
  };

  const importTileset = (definition: SourceGame['tilesets'][string], assets: ProjectAssets) => importTilesets([{ definition, assets }]);

  const libraryImportEntry = (asset: LibraryTileset) => {
    const canonical = game && Object.values(game.tilesets).find(tileset => tileset.category.localeCompare(asset.definition.category, undefined, { sensitivity: 'accent' }) === 0)?.category;
    const definition = { ...asset.definition, category: canonical || asset.definition.category };
    return {
      definition,
      assets: {
        [definition.image]: asset.blob,
        [asset.configurationPath]: canonical ? tilesetConfigurationBlob(definition) : asset.configurationBlob,
      },
    };
  };

  const importLibraryTileset = (asset: LibraryTileset) => importTilesets([libraryImportEntry(asset)]);
  const importLibrarySprites = async (sprites: LibrarySprite[]) => {
    if (!game) return;
    const importedAssets = Object.fromEntries(sprites.filter(sprite => !projectAssets[sprite.imagePath]).map(sprite => [sprite.imagePath, sprite.blob])) as ProjectAssets;
    if (!Object.keys(importedAssets).length) return;
    setProjectAssets(current => ({ ...current, ...importedAssets }));
    await saveProjectAssets(game, importedAssets);
  };
  const importLibrarySprite = (asset: LibrarySprite) => importLibrarySprites([asset]);
  const importLibraryBundle = async (bundle: LibraryBundle) => {
    const tilesets = bundle.assets.filter((asset): asset is LibraryTileset => asset.kind === 'tileset');
    const sprites = bundle.assets.filter((asset): asset is LibrarySprite => asset.kind === 'sprite');
    await importTilesets(tilesets.map(libraryImportEntry));
    await importLibrarySprites(sprites);
  };

  const importLocalTileset = async ({ file, name, category, format }: { file: File; name: string; category: string; format: TilesetImportFormat }) => {
    if (!game) return;
    const id = uniqueAssetId(name, Object.keys(game.tilesets));
    const dimensions = await pngDimensions(file);
    const autotileTemplate = library.find(item => item.definition.kind === 'a2')?.definition;
    const canonicalCategory = Object.values(game.tilesets).find(tileset => tileset.category.localeCompare(category.trim(), undefined, { sensitivity: 'accent' }) === 0)?.category || category;
    const definition = createTilesetDefinition({ id, name, category: canonicalCategory, format, ...dimensions, variants: autotileTemplate?.kind === 'a2' ? autotileTemplate.variants : undefined });
    await importTileset(definition, {
      [definition.image]: file,
      [tilesetConfigurationPath(definition.image)]: tilesetConfigurationBlob(definition),
    });
  };

  const updateTileset = (id: string, values: { name: string; category: string }) => {
    const tileset = game?.tilesets[id];
    if (!game || !tileset) return;
    const name = values.name.trimStart();
    const requestedCategory = values.category.trimStart();
    const category = Object.values(game.tilesets).find(item => item.id !== id && item.category.localeCompare(requestedCategory, undefined, { sensitivity: 'accent' }) === 0)?.category || requestedCategory;
    if (!name || !category || (name === tileset.name && category === tileset.category)) return;
    markDirty('tilesets.json');
    setGame(current => {
      if (!current?.tilesets[id]) return current;
      const next = structuredClone(current);
      next.tilesets[id].name = name;
      next.tilesets[id].category = category;
      return next;
    });
    const updatedDefinition = { ...tileset, name, category };
    const configurationPath = tilesetConfigurationPath(updatedDefinition.image);
    const configurationBlob = tilesetConfigurationBlob(updatedDefinition);
    setProjectAssets(assets => ({ ...assets, [configurationPath]: configurationBlob }));
    void saveProjectAssets(game, { [configurationPath]: configurationBlob });
  };

  const issues = validation && !validation.success ? validation.issues : [];
  const eventPanelOpen = editorMode === 'events';

  return <div className="isolate flex h-full min-h-0 bg-background text-foreground">
    <StudioAppSidebar
      hasProject={Boolean(game)}
      canExport={Boolean(game && validation?.success)}
      activeTab={studioTab}
      onNewProject={() => setNewProjectDialog(true)}
      onOpenProject={() => setOpenDialog(true)}
      onSaveDraft={() => void flushDraft()}
      onExportProject={() => game && void exportGamePackage(game, projectAssets)}
      onRevertProject={() => setRevertDialog(true)}
      onCloseProject={closeProject}
      onSelectMaps={() => setStudioTab('maps')}
      onSelectAssets={() => setStudioTab('assets')}
    />
    <div className="flex min-w-0 flex-1 flex-col">

    {!game || !selectedMap ? <main className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,var(--color-muted)_0,transparent_60%)]">
      <div className="max-w-sm border bg-card/80 p-8 text-center shadow-xl backdrop-blur"><FolderOpen className="mx-auto mb-4 size-8 text-primary" /><h1 className="text-base font-semibold">No project open</h1><p className="mt-2 text-xs leading-5 text-muted-foreground">Create an empty project or open an existing package.</p><div className="mt-5 flex justify-center gap-2"><Button size="sm" onClick={() => setNewProjectDialog(true)}>New project</Button><Button variant="outline" size="sm" onClick={() => setOpenDialog(true)}>Open…</Button></div></div>
    </main> : studioTab === 'assets' ? <main className="min-h-0 flex-1"><AssetManager game={game} assetUrls={assetUrls} library={library} sprites={librarySprites} bundles={libraryBundles} onImportLibrary={importLibraryTileset} onImportSprite={importLibrarySprite} onImportLibraryBundle={importLibraryBundle} onImportLocal={importLocalTileset} onUpdate={updateTileset} onChangeTerrainCollision={changeTerrainCollision} canPlay={Boolean(validation?.success)} onPlay={playGame}/></main> : <main className="min-h-0 flex-1">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="384px" minSize="384px" maxSize="384px"><StudioSidebar game={game} assetUrls={assetUrls} map={selectedMap} selectedMapId={selectedMapId} selectedEventId={selectedEventId} mode={editorMode} selectedTerrain={selectedTerrain} activeLayerId={selectedLayerId} canPlay={Boolean(validation?.success)} onPlay={playGame} onSelectMap={selectMap} onCreateMap={createMap} onRenameMap={renameMap} onMoveMap={moveMap} onReorderMap={reorderMap} onResizeMap={resizeMap} onSelectEvent={setSelectedEventId} onRenameEvent={renameEvent} onSelectTerrain={setSelectedTerrain} onSelectLayer={selectLayer} onAddLayer={addLayer} onRenameLayer={renameLayer} onDeleteLayer={deleteLayer} onMoveLayer={moveLayer} onChangeLayerPlane={changeLayerPlane} onChangeLayerPhase={changeLayerPhase} onAddPlane={() => setNewPlaneDialog(true)} onRenamePlane={renamePlane} onMovePlane={movePlane} onDeletePlane={deletePlane} onChangeCoverage={changeCoverage} onChangeSurface={changeSurface} onDeleteConnection={deleteConnection} /></ResizablePanel>
        <ResizablePanel defaultSize="100%" minSize="400px"><div className="flex h-full min-h-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <SectionHeader className="border-t-0 border-b bg-background"><div className="flex min-w-0 items-center gap-3"><span className="truncate text-xs font-medium">{selectedMap.name}</span><span className="font-mono text-[10px] text-muted-foreground">{selectedMap.bounds.w}×{selectedMap.bounds.h}</span><span className="min-w-20 font-mono text-[10px] text-muted-foreground">{hoveredTile ? `x ${hoveredTile.x} · y ${hoveredTile.y}` : 'x — · y —'}</span></div><SectionHeaderActions><IconButtonTooltip label="Toggle grid"><Button variant={gridVisibility[editorMode] ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Toggle grid" aria-pressed={gridVisibility[editorMode]} onClick={() => setGridVisibility(current => ({ ...current, [editorMode]: !current[editorMode] }))}><Grid3X3 /></Button></IconButtonTooltip>{editorMode === 'drawing' && <IconButtonTooltip label="Dim inactive layers"><Button variant={dimInactiveLayers ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Dim inactive layers" aria-pressed={dimInactiveLayers} onClick={() => setDimInactiveLayers(value => !value)}><Contrast /></Button></IconButtonTooltip>}<div className="mx-1 h-5 w-px bg-border" aria-hidden="true"/><IconButtonTooltip label="Zoom out"><Button variant="ghost" size="icon-sm" onClick={() => mapCanvasRef.current?.zoomOut()} aria-label="Zoom out"><Minus /></Button></IconButtonTooltip><IconButtonTooltip label="Fit map"><Button variant="ghost" size="icon-sm" onClick={() => mapCanvasRef.current?.fit()} aria-label="Fit map"><Maximize2 /></Button></IconButtonTooltip><IconButtonTooltip label="Zoom in"><Button variant="ghost" size="icon-sm" onClick={() => mapCanvasRef.current?.zoomIn()} aria-label="Zoom in"><Plus /></Button></IconButtonTooltip></SectionHeaderActions></SectionHeader>
            <div className="relative min-h-0 flex-1">{tilesetAssetsReady
              ? <MapCanvas ref={mapCanvasRef} map={selectedMap} tilesets={game.tilesets} assetUrls={assetUrls} mode={editorMode} activePlaneId={selectedLayer?.planeId || selectedMap.planes[0].id} activeLayerId={selectedLayerId} selectedTerrain={selectedTerrain} drawingTool={drawingTool} eventTool={eventTool} playerStartMapId={game.manifest.entryPoint.mapId} playerStart={game.actors.player.start} showGrid={gridVisibility[editorMode]} dimInactiveLayers={dimInactiveLayers} navigationPaintMode={navigationPaintMode} selectedEventId={selectedEventId} selectedEventPageIndex={selectedEventPageIndex} onSelectEvent={setSelectedEventId} onCreateEvent={createEvent} onMoveEvent={moveEvent} onDrawTiles={drawMapTiles} onFillTile={fillMapTile} onPickTerrain={setSelectedTerrain} onPlacePlayerStart={placePlayerStart} onNavigateTarget={requestNavigationEdit} onHoverTile={setHoveredTile} />
              : <div className="grid size-full place-items-center bg-background text-xs text-muted-foreground">Loading tileset images…</div>}
              <StudioToolbar mode={editorMode} layers={selectedMap.tileLayers} activeLayerId={selectedLayerId} drawingTool={drawingTool} eventTool={eventTool} onChangeMode={setEditorMode} onSelectLayer={selectLayer} onChangeDrawingTool={setDrawingTool} onChangeEventTool={setEventTool} /></div>
          </div>
          <aside
            data-event-inspector-panel
            aria-hidden={!eventPanelOpen}
            inert={!eventPanelOpen}
            className={`h-full shrink-0 overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${eventPanelOpen ? 'w-[420px] border-l' : 'pointer-events-none w-0'}`}
          >
            <div className="h-full w-[420px]">
              <EventInspector game={game} mapId={selectedMapId} event={selectedEvent} issues={issues} assetUrls={assetUrls} sprites={librarySprites} onChangeEvent={changeEvent} onSelectPage={setSelectedEventPageIndex} onImportSprite={importLibrarySprite} onCreateSwitch={createSwitch} onCreateVariable={createVariable} onRenameSwitch={renameSwitch} onRenameVariable={renameVariable} onRenameItem={renameItem} />
            </div>
          </aside>
        </div></ResizablePanel>
      </ResizablePanelGroup>
    </main>}
    </div>

    <Dialog open={openDialog} onOpenChange={setOpenDialog}><DialogContent><DialogHeader><DialogTitle>Open Project</DialogTitle><DialogDescription>Open a recent project, the bundled example, or an exported RPGCrafter ZIP.</DialogDescription></DialogHeader>{recentProjects.length > 0 && <div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Recent projects</div>{recentProjects.slice(0, 5).map(project => <button key={project.id} type="button" className="flex w-full items-center justify-between border px-3 py-2 text-left hover:bg-muted/30" onClick={() => void openRecent(project.id)}><span className="truncate text-sm">{project.title}</span><span className="text-[10px] text-muted-foreground">{project.gameVersion}</span></button>)}</div>}<button type="button" className="flex w-full items-center gap-3 border bg-muted/20 p-4 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => void openReference()} disabled={loading}><div className="grid size-10 place-items-center bg-primary/15 text-primary"><FolderOpen /></div><span><span className="block text-sm font-medium">La Cloche des Brumes</span><span className="block text-xs text-muted-foreground">Bundled reference game · schema 0.8</span></span></button><label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed p-4 text-sm hover:bg-muted/30"><Upload className="size-4"/>Choose project ZIP<Input className="sr-only" type="file" accept=".zip,application/zip" onChange={event => { const file = event.target.files?.[0]; if (file) void openArchive(file); }}/></label>{error && <pre className="max-h-36 overflow-auto whitespace-pre-wrap border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</pre>}<DialogFooter><Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}><DialogContent><DialogHeader><DialogTitle>New Project</DialogTitle><DialogDescription>The project starts with an empty map and no tilesets.</DialogDescription></DialogHeader><Input autoFocus value={newProjectTitle} placeholder="Project title" onChange={event => setNewProjectTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void createProject(); }}/><DialogFooter><Button variant="outline" onClick={() => setNewProjectDialog(false)}>Cancel</Button><Button disabled={!newProjectTitle.trim()} onClick={() => void createProject()}>Create</Button></DialogFooter></DialogContent></Dialog>
    {selectedMap && <Dialog open={Boolean(pendingConnection)} onOpenChange={open => { if (!open) setPendingConnection(null); }}><DialogContent><DialogHeader><DialogTitle>Create plane connection</DialogTitle><DialogDescription>Choose the destination plane for this bidirectional passage.</DialogDescription></DialogHeader>{pendingConnection && <div className="space-y-3"><div className="border bg-muted/20 px-3 py-2 text-xs"><span className="font-medium">{selectedMap.planes.find(plane => plane.id === pendingConnection.sourcePlaneId)?.name}</span><span className="text-muted-foreground"> · cell {pendingConnection.x}, {pendingConnection.y} · {pendingConnection.edge} edge</span></div><label className="block space-y-1"><span className="text-xs font-medium">Destination plane</span><select autoFocus aria-label="Destination plane" className="h-9 w-full border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={connectionDestinationPlaneId} onChange={event => setConnectionDestinationPlaneId(event.target.value)}>{[...selectedMap.planes].sort((a, b) => a.order - b.order).filter(plane => plane.id !== pendingConnection.sourcePlaneId).map(plane => <option key={plane.id} value={plane.id}>{plane.name}</option>)}</select></label></div>}<DialogFooter><Button variant="outline" onClick={() => setPendingConnection(null)}>Cancel</Button><Button disabled={!pendingConnection || !connectionDestinationPlaneId} onClick={() => { if (!pendingConnection) return; if (addConnection(connectionDestinationPlaneId, pendingConnection.x, pendingConnection.y, pendingConnection.edge, true, pendingConnection.sourcePlaneId)) setPendingConnection(null); }}>Create connection</Button></DialogFooter></DialogContent></Dialog>}
    <Dialog open={newPlaneDialog} onOpenChange={setNewPlaneDialog}><DialogContent><DialogHeader><DialogTitle>Create navigation plane</DialogTitle><DialogDescription>Choose any name that describes this gameplay surface. Names have no engine semantics.</DialogDescription></DialogHeader><Input autoFocus value={newPlaneName} placeholder="Plane name" onChange={event => setNewPlaneName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addPlane(); }}/><DialogFooter><Button variant="outline" onClick={() => setNewPlaneDialog(false)}>Cancel</Button><Button disabled={!newPlaneName.trim()} onClick={addPlane}>Create</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={revertDialog} onOpenChange={setRevertDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revert all changes?</AlertDialogTitle><AlertDialogDescription>This clears the browser draft and restores the bundled source JSON. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void revert()}>Revert to Source</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={Boolean(playError)} onOpenChange={open => !open && setPlayError('')}><DialogContent><DialogHeader><DialogTitle>Unable to open Player</DialogTitle><DialogDescription>{playError}</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setPlayError('')}>OK</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
