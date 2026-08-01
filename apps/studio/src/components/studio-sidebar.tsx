import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { GameMap, RenderPhase, SourceGame, SurfaceCoverage, TileLayer } from '@rpgcrafter/game-schema';
import { ArrowDown, ArrowUp, Box, Layers3, Navigation, Plus, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapList } from '@/components/map-list';
import { TerrainPreview } from '@/components/terrain-preview';
import { SpritePreview } from '@/components/event-sprite-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizableSidebarSection, SectionHeader, SidebarSection } from '@/components/sidebar-section';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { IconButtonTooltip } from '@/components/ui/tooltip';
import { Popover } from '@base-ui/react/popover';
import { gridTerrainSelection, PALETTE_COLUMNS, paletteTerrains, type SelectedTerrain } from '@/lib/tile-palette';
import type { MapDropPosition } from '@/lib/map-hierarchy';
import { cn } from '@/lib/utils';

export type EditorMode = 'events' | 'drawing';
export type { SelectedTerrain } from '@/lib/tile-palette';
export type NavigationPaintMode = 'cell' | 'edge' | 'connection';
export type DrawingTool = 'pencil' | 'rectangle' | 'ellipse' | 'bucket' | 'eraser';

function TooltipIconButton({ tooltip, 'aria-label': ariaLabel, ...props }: ComponentProps<typeof Button> & { tooltip: string }) {
  return <IconButtonTooltip label={tooltip}><Button aria-label={ariaLabel || tooltip} {...props} /></IconButtonTooltip>;
}

function EventList({ map, assetUrls, selectedEventId, onSelect, onRename }: { map: GameMap; assetUrls: Record<string, string>; selectedEventId: string | null; onSelect: (id: string) => void; onRename: (id: string, name: string) => void }) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  if (!map.events.length) return <div className="p-6 text-center text-xs text-muted-foreground">No events on this map.</div>;
  const finishEditing = (eventId: string, value: string) => {
    const name = value.trim();
    setEditingEventId(null);
    if (name && name !== eventId) onRename(eventId, name);
  };
  return <ScrollArea className="min-h-0 flex-1"><div>
    {map.events.map(event => {
      const sprite = event.pages[0]?.sprite;
      const preview = sprite
        ? <span data-slot="event-sprite" className="size-10 shrink-0"><SpritePreview sprite={sprite} imageUrl={assetUrls[sprite.image]} characterRows={sprite.characterColumns === 1 ? 1 : 2} className="size-full" /></span>
        : <span className="grid size-10 shrink-0 place-items-center bg-muted/30"><Box className="size-4 text-primary" /></span>;
      return editingEventId === event.id
        ? <div key={event.id} data-event-row-id={event.id} className={cn('flex min-h-12 w-full items-center gap-2 px-2 py-1', event.id === selectedEventId && 'bg-sidebar-accent text-sidebar-accent-foreground')}>
          {preview}
          <Input
            autoFocus
            aria-label={`Rename event: ${event.id}`}
            className="h-7 min-w-0 flex-1 px-1 text-xs font-medium"
            defaultValue={event.id}
            onFocus={input => input.currentTarget.select()}
            onBlur={input => finishEditing(event.id, input.currentTarget.value)}
            onKeyDown={input => {
              if (input.key === 'Enter') { input.preventDefault(); finishEditing(event.id, input.currentTarget.value); }
              if (input.key === 'Escape') setEditingEventId(null);
            }}
          />
        </div>
        : <button
          key={event.id}
          type="button"
          data-event-row-id={event.id}
          className={cn('flex min-h-12 w-full items-center gap-2 px-2 py-1 text-left hover:bg-sidebar-accent/60', event.id === selectedEventId && 'bg-sidebar-accent text-sidebar-accent-foreground')}
          onClick={() => onSelect(event.id)}
          onDoubleClick={() => setEditingEventId(event.id)}
        >
          {preview}
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{event.id}</span>
        </button>;
    })}
  </div></ScrollArea>;
}

function DrawingTree({ map, activeLayer, onSelect, onAddLayer, onAddPlane, onRenameLayer, onDeleteLayer, onMoveLayer, onChangeLayerPlane, onChangeLayerPhase, onRenamePlane, onMovePlane, onDeletePlane, onCoverage, onSurface }: {
  map: GameMap;
  activeLayer: TileLayer | null;
  onSelect: (id: string) => void;
  onAddLayer: () => void;
  onAddPlane: () => void;
  onRenameLayer: (id: string, name: string) => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: -1 | 1) => void;
  onChangeLayerPlane: (id: string, planeId: string) => void;
  onChangeLayerPhase: (id: string, phase: RenderPhase) => void;
  onRenamePlane: (id: string, name: string) => void;
  onMovePlane: (id: string, direction: -1 | 1) => void;
  onDeletePlane: (id: string) => void;
  onCoverage: (id: string, coverage: SurfaceCoverage) => void;
  onSurface: (id: string, layerId: string) => void;
}) {
  const planes = [...map.planes].sort((a, b) => b.order - a.order);
  return <ResizableSidebarSection defaultSize="35%" title="Planes & layers" icon={<Layers3 className="size-3.5" />} actions={<Popover.Root><IconButtonTooltip label="Add plane or layer"><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add plane or layer"><Plus /></Button>} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-50"><Popover.Popup className="grid min-w-32 gap-1 bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"><Button type="button" variant="ghost" className="justify-start" onClick={onAddPlane}><Navigation />Add plane</Button><Button type="button" variant="ghost" className="justify-start" onClick={onAddLayer}><Layers3 />Add layer</Button></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>}>
    <ScrollArea className="max-h-52" aria-label="Map planes and layers"><div className="p-1">
      {planes.map((plane, planeIndex) => {
        const layers = map.tileLayers.filter(layer => layer.planeId === plane.id).sort((a, b) => {
          const phaseOrder = Number(b.renderPhase === 'aboveActors') - Number(a.renderPhase === 'aboveActors');
          return phaseOrder || map.tileLayers.indexOf(b) - map.tileLayers.indexOf(a);
        });
        return <div key={plane.id} className="mb-1 last:mb-0">
          <div className={cn('flex h-7 items-center gap-1 px-2 text-xs hover:bg-sidebar-accent/60', activeLayer?.planeId === plane.id && 'bg-primary/10')}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(plane.surfaceLayerId)}><Navigation className="size-3 shrink-0 text-primary" /><span className="truncate font-medium">{plane.name}</span></button>
            <Popover.Root><IconButtonTooltip label={`Plane settings: ${plane.name}`}><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Plane settings: ${plane.name}`}><Settings2 /></Button>} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={4} className="z-50"><Popover.Popup className="w-60 bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
              <SectionHeader className="border-t-0 border-b">Plane settings</SectionHeader><div className="space-y-2 p-2"><label className="grid gap-1 text-[10px] text-muted-foreground">Name<Input key={`${plane.id}:${plane.name}`} className="h-7 text-xs" defaultValue={plane.name} onBlur={event => { const name = event.currentTarget.value.trim(); if (name && name !== plane.name) onRenamePlane(plane.id, name); }} /></label><label className="grid gap-1 text-[10px] text-muted-foreground">Coverage<select className="h-7 border bg-background px-1 text-xs" value={plane.surfaceCoverage} onChange={event => onCoverage(plane.id, event.target.value as SurfaceCoverage)}><option value="bounds">Whole map</option><option value="painted">Painted cells</option></select></label><label className="grid gap-1 text-[10px] text-muted-foreground">Surface layer<select className="h-7 border bg-background px-1 text-xs" value={plane.surfaceLayerId} onChange={event => onSurface(plane.id, event.target.value)}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label><div className="flex justify-end gap-1 border-t pt-2"><TooltipIconButton tooltip="Move plane down" type="button" variant="ghost" size="icon-sm" disabled={planeIndex >= planes.length - 1} onClick={() => onMovePlane(plane.id, -1)}><ArrowDown /></TooltipIconButton><TooltipIconButton tooltip="Move plane up" type="button" variant="ghost" size="icon-sm" disabled={planeIndex <= 0} onClick={() => onMovePlane(plane.id, 1)}><ArrowUp /></TooltipIconButton><TooltipIconButton tooltip="Delete plane" type="button" variant="ghost" size="icon-sm" disabled={planes.length === 1} onClick={() => onDeletePlane(plane.id)}><Trash2 /></TooltipIconButton></div></div>
            </Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>
          </div>
          <div className="ml-4 border-l border-border pl-1">{layers.map(layer => { const layerIndex = layers.findIndex(item => item.id === layer.id); return <div key={layer.id} className={cn('flex h-7 items-center gap-1 px-2 text-xs hover:bg-sidebar-accent', layer.id === activeLayer?.id && 'bg-sidebar-accent text-sidebar-accent-foreground')}><button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(layer.id)}><Layers3 className="size-3 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{layer.name}</span></button><Popover.Root><IconButtonTooltip label={`Layer settings: ${layer.name}`}><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Layer settings: ${layer.name}`}><Settings2 /></Button>} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={4} className="z-50"><Popover.Popup className="w-60 bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"><SectionHeader className="border-t-0 border-b">Layer settings</SectionHeader><div className="space-y-2 p-2"><label className="grid gap-1 text-[10px] text-muted-foreground">Name<Input key={`${layer.id}:${layer.name}`} className="h-7 text-xs" defaultValue={layer.name} onBlur={event => { const name = event.currentTarget.value.trim(); if (name && name !== layer.name) onRenameLayer(layer.id, name); }} /></label><label className="grid gap-1 text-[10px] text-muted-foreground">Plane<select className="h-7 border bg-background px-1 text-xs" value={layer.planeId} disabled={plane.surfaceLayerId === layer.id} onChange={event => onChangeLayerPlane(layer.id, event.target.value)}>{planes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-[10px] text-muted-foreground">Render phase<select className="h-7 border bg-background px-1 text-xs" value={layer.renderPhase} onChange={event => onChangeLayerPhase(layer.id, event.target.value as RenderPhase)}><option value="belowActors">Below actors</option><option value="aboveActors">Above actors</option></select></label><div className="flex justify-end gap-1 border-t pt-2"><TooltipIconButton tooltip="Move layer down" type="button" variant="ghost" size="icon-sm" disabled={layerIndex >= layers.length - 1} onClick={() => onMoveLayer(layer.id, -1)}><ArrowDown /></TooltipIconButton><TooltipIconButton tooltip="Move layer up" type="button" variant="ghost" size="icon-sm" disabled={layerIndex <= 0} onClick={() => onMoveLayer(layer.id, 1)}><ArrowUp /></TooltipIconButton><TooltipIconButton tooltip="Delete layer" type="button" variant="ghost" size="icon-sm" disabled={plane.surfaceLayerId === layer.id} onClick={() => onDeleteLayer(layer.id)}><Trash2 /></TooltipIconButton></div></div></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root></div>; })}</div>
          {!layers.length && <div className="ml-7 px-2 py-1 text-[10px] text-muted-foreground">No layers</div>}
        </div>;
      })}
    </div></ScrollArea>
  </ResizableSidebarSection>;
}

function TilePalette({ game, assetUrls, activeLayer, selectedTerrain, onSelect }: { game: SourceGame; assetUrls: Record<string, string>; activeLayer: TileLayer | null; selectedTerrain: SelectedTerrain | null; onSelect: (terrain: SelectedTerrain) => void }) {
  const categories = [...new Set(Object.values(game.tilesets).map(tileset => tileset.category))].sort((a, b) => a.localeCompare(b));
  const selectedTileset = selectedTerrain ? game.tilesets[selectedTerrain.tilesetId] : undefined;
  const [category, setCategory] = useState(selectedTileset?.category || categories[0] || '');
  const selectionStart = useRef<{ tilesetId: string; terrainId: string } | null>(null);
  useEffect(() => {
    if (selectedTileset?.category) setCategory(selectedTileset.category);
  }, [selectedTileset?.category]);
  useEffect(() => {
    const stopSelection = () => { selectionStart.current = null; };
    window.addEventListener('pointerup', stopSelection);
    return () => window.removeEventListener('pointerup', stopSelection);
  }, []);
  const activeCategory = categories.includes(category) ? category : categories[0] || '';
  if (!activeLayer) return <div className="p-6 text-center text-xs text-muted-foreground">Select or add a layer to choose a terrain.</div>;
  if (!categories.length) return <div className="p-6 text-center text-xs text-muted-foreground">No tilesets yet. Open Assets &gt; Asset Manager to import one.</div>;
  const tilesets = Object.values(game.tilesets).filter(tileset => tileset.category === activeCategory);
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="border-b p-2"><select className="h-7 w-full border bg-background px-2 text-xs" aria-label="Asset category" value={activeCategory} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
    <ScrollArea className="min-h-0 flex-1"><div>{tilesets.map(tileset => <section key={tileset.id}><div className="grid w-96 grid-cols-8 justify-center overflow-hidden" role="grid" aria-colcount={PALETTE_COLUMNS} aria-label={`${tileset.name} tileset`}>
      {paletteTerrains(tileset).map(({ terrain, column, row }) => {
        const selected = selectedTerrain?.tilesetId === tileset.id && (selectedTerrain.terrainId === terrain.id || selectedTerrain.pattern?.some(item => item.terrainId === terrain.id));
        const extendGridSelection = () => {
          const start = selectionStart.current;
          if ((tileset.kind === 'grid' || tileset.kind === 'a5') && start?.tilesetId === tileset.id) onSelect(gridTerrainSelection(tileset, start.terrainId, terrain.id));
        };
        return <button key={terrain.id} type="button" className="group relative size-12 touch-none cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ gridColumnStart: column, gridRowStart: row }} onPointerDown={event => {
          if (event.button !== 0 || (tileset.kind !== 'grid' && tileset.kind !== 'a5')) return;
          selectionStart.current = { tilesetId: tileset.id, terrainId: terrain.id };
          onSelect(gridTerrainSelection(tileset, terrain.id, terrain.id));
        }} onPointerEnter={event => { if (event.buttons === 1) extendGridSelection(); }} onPointerUp={() => { extendGridSelection(); selectionStart.current = null; }} onClick={() => { if (tileset.kind !== 'grid' && tileset.kind !== 'a5') onSelect({ tilesetId: tileset.id, terrainId: terrain.id }); }} aria-label={terrain.name} aria-pressed={selected} role="gridcell" title={terrain.name}>
          <TerrainPreview tileset={tileset} terrainId={terrain.id} imageUrl={assetUrls[tileset.image]} />
          <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-10 group-hover:shadow-[inset_0_0_0_2px_#ffffff,inset_0_0_0_4px_#0f172a]', selected && 'shadow-[inset_0_0_0_3px_#ffffff,inset_0_0_0_6px_#0f172a] group-hover:shadow-[inset_0_0_0_3px_#ffffff,inset_0_0_0_6px_#0f172a]')} />
        </button>;
      })}
    </div></section>)}</div></ScrollArea>
  </div>;
}

function PlanPanel({ map, activePlaneId, onSelect, onAdd, onRename, onMove, onDelete, onCoverage, onSurface }: { map: GameMap; activePlaneId: string; onSelect: (layerId: string) => void; onAdd: () => void; onRename: (id: string, name: string) => void; onMove: (id: string, direction: -1 | 1) => void; onDelete: (id: string) => void; onCoverage: (id: string, coverage: SurfaceCoverage) => void; onSurface: (id: string, layerId: string) => void }) {
  const planes = [...map.planes].sort((a, b) => a.order - b.order);
  const active = planes.find(plane => plane.id === activePlaneId) || planes[0];
  const index = planes.findIndex(plane => plane.id === active?.id);
  return <ResizableSidebarSection defaultSize="35%" title="Planes" icon={<Navigation className="size-3.5" />} actions={<TooltipIconButton tooltip="Add plane" type="button" variant="ghost" size="icon-sm" onClick={onAdd}><Plus/></TooltipIconButton>}>
    <div className="max-h-28 overflow-y-auto p-1">{planes.map(plane => { const selected = plane.id === active?.id; return <button type="button" key={plane.id} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(plane.surfaceLayerId)} className={cn('flex h-8 w-full items-center gap-1 border-l-2 border-transparent px-2 text-left text-xs transition-colors hover:bg-sidebar-accent/60', selected && 'border-primary bg-primary/15 font-medium text-sidebar-accent-foreground')}><span className="min-w-0 flex-1 truncate">{plane.name}</span></button>; })}</div>
    {active && <div className="space-y-1 border-t p-1.5"><div className="flex gap-1"><Input className="h-7 min-w-0 flex-1 px-2 text-xs" value={active.name} onChange={event => onRename(active.id, event.target.value)} /><TooltipIconButton tooltip="Move plane down" variant="ghost" size="icon-sm" disabled={index <= 0} onClick={() => onMove(active.id, -1)}><ArrowDown/></TooltipIconButton><TooltipIconButton tooltip="Move plane up" variant="ghost" size="icon-sm" disabled={index >= planes.length - 1} onClick={() => onMove(active.id, 1)}><ArrowUp/></TooltipIconButton><TooltipIconButton tooltip="Delete plane" variant="ghost" size="icon-sm" disabled={planes.length === 1} onClick={() => onDelete(active.id)}><Trash2/></TooltipIconButton></div><div className="grid grid-cols-2 gap-1"><select className="h-7 border bg-background px-1 text-[10px]" value={active.surfaceCoverage} onChange={event => onCoverage(active.id, event.target.value as SurfaceCoverage)}><option value="bounds">Whole map</option><option value="painted">Painted cells</option></select><select className="h-7 border bg-background px-1 text-[10px]" value={active.surfaceLayerId} onChange={event => onSurface(active.id, event.target.value)}>{map.tileLayers.filter(layer => layer.planeId === active.id).map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></div></div>}
  </ResizableSidebarSection>;
}

function NavigationPanel({ map, activePlaneId, onDeleteConnection }: { map: GameMap; activePlaneId: string; onDeleteConnection: (id: string) => void }) {
  return <div className="min-h-0 flex-1 overflow-auto p-2 text-xs">
    <p className="mb-2 text-[10px] text-muted-foreground">Use the floating toolbar to edit cell or edge collisions on <strong>{map.planes.find(plane => plane.id === activePlaneId)?.name}</strong>. Click a highlighted target to toggle it.</p>
    <p className="mb-3 text-[10px] text-muted-foreground">The connection tool creates a bidirectional passage from a cell edge, then asks for its destination plane.</p>
    <div className="mt-2 space-y-1">{map.planeConnections.map(connection => <div key={connection.id} className="flex items-center gap-1 border px-2 py-1 text-[9px]"><span className="min-w-0 flex-1 truncate">{connection.from.planeId} ({connection.from.x},{connection.from.y}) → {connection.to.planeId}</span><TooltipIconButton tooltip="Delete connection" variant="ghost" size="icon-sm" onClick={() => onDeleteConnection(connection.id)}><Trash2/></TooltipIconButton></div>)}</div>
  </div>;
}

export function StudioSidebar({ game, assetUrls, map, selectedMapId, selectedEventId, mode, selectedTerrain, activeLayerId, onSelectMap, onCreateMap, onRenameMap, onMoveMap, onReorderMap, onResizeMap, onSelectEvent, onRenameEvent, onSelectTerrain, onSelectLayer, onAddLayer, onRenameLayer, onDeleteLayer, onMoveLayer, onChangeLayerPlane, onChangeLayerPhase, onAddPlane, onRenamePlane, onMovePlane, onDeletePlane, onChangeCoverage, onChangeSurface, onDeleteConnection }: {
  game: SourceGame;
  assetUrls: Record<string, string>;
  map: GameMap;
  selectedMapId: string;
  selectedEventId: string | null;
  mode: EditorMode;
  selectedTerrain: SelectedTerrain | null;
  activeLayerId: string | null;
  onSelectMap: (id: string) => void;
  onCreateMap: (width: number, height: number, parentMapId?: string) => void;
  onRenameMap: (id: string, name: string) => void;
  onMoveMap: (id: string, parentMapId: string | null) => void;
  onReorderMap: (id: string, targetId: string, position: MapDropPosition) => void;
  onResizeMap: (id: string, width: number, height: number) => void;
  onSelectEvent: (id: string) => void;
  onRenameEvent: (id: string, name: string) => void;
  onSelectTerrain: (terrain: SelectedTerrain) => void;
  onSelectLayer: (id: string) => void;
  onAddLayer: () => void;
  onRenameLayer: (id: string, name: string) => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: -1 | 1) => void;
  onChangeLayerPlane: (id: string, planeId: string) => void;
  onChangeLayerPhase: (id: string, phase: RenderPhase) => void;
  onAddPlane: () => void;
  onRenamePlane: (id: string, name: string) => void;
  onMovePlane: (id: string, direction: -1 | 1) => void;
  onDeletePlane: (id: string) => void;
  onChangeCoverage: (id: string, coverage: SurfaceCoverage) => void;
  onChangeSurface: (id: string, layerId: string) => void;
  onDeleteConnection: (id: string) => void;
}) {
  const [mapsOpen, setMapsOpen] = useState(false);
  const activeLayer = map.tileLayers.find(layer => layer.id === activeLayerId) || null;
  const activePlaneId = activeLayer?.planeId || [...map.planes].sort((a, b) => a.order - b.order)[0]?.id || '';
  const editorPanel = mode === 'events'
    ? <SidebarSection collapsible={false} topBorder={false} title="Events" className="h-full" contentClassName="flex min-h-0 flex-1"><EventList map={map} assetUrls={assetUrls} selectedEventId={selectedEventId} onSelect={onSelectEvent} onRename={onRenameEvent} /></SidebarSection>
    : <SidebarSection collapsible={false} topBorder={false} title="Tiles" className="h-full" contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"><TilePalette game={game} assetUrls={assetUrls} activeLayer={activeLayer} selectedTerrain={selectedTerrain} onSelect={onSelectTerrain}/></SidebarSection>;
  return <div data-slot="studio-sidebar" className="h-full min-h-0 cursor-default border-r bg-background text-foreground">
    <ResizablePanelGroup orientation="vertical">
      <MapList game={game} selectedMapId={selectedMapId} open={mapsOpen} onOpenChange={setMapsOpen} onSelect={onSelectMap} onCreate={onCreateMap} onRename={onRenameMap} onMove={onMoveMap} onReorder={onReorderMap} onResize={onResizeMap} />
      <ResizableHandle disabled={!mapsOpen} />
      <ResizablePanel defaultSize="60%" minSize="160px" className="min-h-0">{editorPanel}</ResizablePanel>
    </ResizablePanelGroup>
  </div>;
}
