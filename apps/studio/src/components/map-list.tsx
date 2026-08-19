import { useState } from 'react';
import type { GameMap, SourceGame } from '@rpgcrafter/game-schema';
import { ChevronRight, MapIcon, Plus, Settings2 } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconButtonTooltip } from '@/components/ui/tooltip';
import { PopoverPanel, ResizableSidebarSection, SectionHeader } from '@/components/sidebar-section';
import { SidebarList, sidebarListItemVariants } from '@/components/sidebar-list';
import { mapDropTargetForRow, type MapDropPosition } from '@/lib/map-hierarchy';
import { cn } from '@/lib/utils';

function SizeFields({ width, height, onWidthChange, onHeightChange }: { width: number; height: number; onWidthChange: (value: number) => void; onHeightChange: (value: number) => void }) {
  return <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-[10px] text-muted-foreground">Width (tiles)<Input type="number" min={1} value={width} onChange={event => onWidthChange(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} /></label><label className="grid gap-1 text-[10px] text-muted-foreground">Height (tiles)<Input type="number" min={1} value={height} onChange={event => onHeightChange(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} /></label></div>;
}

function NewMapPopover({ onCreate, trigger }: { onCreate: (width: number, height: number) => void; trigger: React.ReactElement }) {
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  return <Popover.Root><IconButtonTooltip label="Add map"><Popover.Trigger render={trigger} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={4} className="z-50"><PopoverPanel className="w-56"><SectionHeader className="border-t-0 border-b">New map</SectionHeader><div className="space-y-3 p-3"><p className="text-[10px] text-muted-foreground">Choose the map size in tiles.</p><SizeFields width={width} height={height} onWidthChange={setWidth} onHeightChange={setHeight} /><Button type="button" size="sm" className="w-full" onClick={() => onCreate(width, height)}>Create map</Button></div></PopoverPanel></Popover.Positioner></Popover.Portal></Popover.Root>;
}

function descendantIds(game: SourceGame, mapId: number) {
  const descendants = new Set<number>();
  const visit = (parentId: number) => Object.values(game.maps).forEach(map => {
    if (map.parentMapId !== parentId || descendants.has(map.id)) return;
    descendants.add(map.id);
    visit(map.id);
  });
  visit(mapId);
  return descendants;
}

function MapSettings({ game, map, onMove, onResize, onChangeEncounters }: { game: SourceGame; map: GameMap; onMove: (id: number, parentMapId: number | null) => void; onResize: (id: number, width: number, height: number) => void; onChangeEncounters: (id: number, encounters: NonNullable<GameMap['encounters']>) => void }) {
  const [width, setWidth] = useState(map.bounds.w);
  const [height, setHeight] = useState(map.bounds.h);
  const unavailableParents = descendantIds(game, map.id);
  unavailableParents.add(map.id);
  const encounterSettings = map.encounters || { averageSteps: 30, entries: [] };
  return <Popover.Root><IconButtonTooltip label={`Map settings: ${map.name}`}><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" className="opacity-0 hover:bg-foreground/10 group-hover/map-row:opacity-100 group-focus-within/map-row:opacity-100 aria-expanded:bg-foreground/10 aria-expanded:opacity-100" aria-label={`Map settings: ${map.name}`}><Settings2 /></Button>} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={4} className="z-50"><PopoverPanel className="w-72"><SectionHeader className="border-t-0 border-b">Map settings</SectionHeader><div className="space-y-3 p-3"><label className="grid gap-1 text-[10px] text-muted-foreground">ID<Input aria-label="Map ID" value={map.id} readOnly /></label><label className="grid gap-1 text-[10px] text-muted-foreground">Parent map<select aria-label="Parent map" className="h-8 border bg-background px-2 text-xs text-foreground" value={map.parentMapId || ''} onChange={event => onMove(map.id, event.target.value ? Number(event.target.value) : null)}><option value="">Top level</option>{Object.values(game.maps).filter(candidate => !unavailableParents.has(candidate.id)).map(candidate => <option key={candidate.id} value={candidate.id}>#{candidate.id} · {candidate.name}</option>)}</select></label>{game.manifest.combatMode === 'turnBased' && <div className="space-y-2 border-t pt-3"><h3 className="text-xs font-medium">Random encounters</h3><label className="grid gap-1 text-[10px] text-muted-foreground">Average steps<Input type="number" min={1} value={encounterSettings.averageSteps} onChange={event => onChangeEncounters(map.id, { ...encounterSettings, averageSteps: Math.max(1, Number(event.target.value) || 1) })} /></label>{Object.entries(game.troops).map(([id, troop]) => { const troopId = Number(id); const weight = encounterSettings.entries.find(entry => entry.troopId === troopId)?.weight || 0; return <label key={id} className="grid grid-cols-[1fr_64px] items-center gap-2 text-[10px]"><span className="truncate">{troop.name}</span><Input aria-label={`${troop.name} encounter weight`} type="number" min={0} value={weight} onChange={event => { const nextWeight = Math.max(0, Math.trunc(Number(event.target.value) || 0)); onChangeEncounters(map.id, { ...encounterSettings, entries: [...encounterSettings.entries.filter(entry => entry.troopId !== troopId), ...(nextWeight ? [{ troopId, weight: nextWeight }] : [])] }); }} /></label>; })}</div>}<div className="border-t pt-3"><h3 className="text-xs font-medium">Map size</h3><p className="mb-2 text-[10px] text-muted-foreground">Changing the size crops content outside the new bounds.</p><SizeFields width={width} height={height} onWidthChange={setWidth} onHeightChange={setHeight} /></div><Button type="button" size="sm" className="w-full" onClick={() => onResize(map.id, width, height)}>Apply size</Button></div></PopoverPanel></Popover.Positioner></Popover.Portal></Popover.Root>;
}

export function MapList({ game, selectedMapId, open, onOpenChange, onSelect, onCreate, onRename, onMove, onReorder, onResize, onChangeEncounters }: { game: SourceGame; selectedMapId: number; open?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (id: number) => void; onCreate: (width: number, height: number) => void; onRename: (id: number, name: string) => void; onMove: (id: number, parentMapId: number | null) => void; onReorder: (id: number, targetId: number, position: MapDropPosition) => void; onResize: (id: number, width: number, height: number) => void; onChangeEncounters: (id: number, encounters: NonNullable<GameMap['encounters']>) => void }) {
  const [dropTarget, setDropTarget] = useState<{ id: number; position: MapDropPosition } | null>(null);
  const [draggedMapId, setDraggedMapId] = useState<number | null>(null);
  const [collapsedMapIds, setCollapsedMapIds] = useState<Set<number>>(() => new Set());
  const [editingMapId, setEditingMapId] = useState<number | null>(null);
  const maps = Object.values(game.maps).sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
  const childrenOf = (parentMapId?: number) => maps.filter(map => map.parentMapId === parentMapId || (!parentMapId && map.parentMapId && !game.maps[map.parentMapId]));
  const renderMap = (map: GameMap, siblingIndex: number, siblings: GameMap[]): React.ReactNode => {
    const children = childrenOf(map.id);
    const collapsed = collapsedMapIds.has(map.id);
    const finishEditing = (value: string) => {
      const name = value.trim();
      setEditingMapId(null);
      if (name && name !== map.name) onRename(map.id, name);
    };
    return <div key={map.id} role="treeitem" aria-expanded={children.length ? !collapsed : undefined}>
      <div data-map-separator-before={map.id} className="flex h-1 items-center" aria-hidden="true">
        <div className={cn('h-px w-full bg-transparent transition-colors', dropTarget?.id === map.id && dropTarget.position === 'before' && 'bg-primary')} />
      </div>
      <div
        draggable
        data-map-row-id={map.id}
        className={cn(
          sidebarListItemVariants({ selected: map.id === selectedMapId }),
          'group/map-row relative flex min-h-8 items-center gap-1 px-1 text-xs',
          dropTarget?.id === map.id && dropTarget.position === 'inside' && 'bg-primary/15 ring-1 ring-primary ring-inset',
        )}
        onDragStart={event => {
          setDraggedMapId(map.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(map.id));
        }}
        onDragEnd={() => { setDraggedMapId(null); setDropTarget(null); }}
        onDragOver={event => {
          const dragged = draggedMapId && game.maps[draggedMapId];
          if (!dragged || dragged.id === map.id || descendantIds(game, dragged.id).has(map.id)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - bounds.top) / bounds.height;
          setDropTarget(mapDropTargetForRow(map.id, siblings[siblingIndex + 1]?.id, ratio));
        }}
        onDrop={event => {
          event.preventDefault();
          if (draggedMapId && dropTarget) onReorder(draggedMapId, dropTarget.id, dropTarget.position);
          setDraggedMapId(null);
          setDropTarget(null);
        }}
      >
        {children.length > 0 ? <IconButtonTooltip label={`${collapsed ? 'Expand' : 'Collapse'} ${map.name}`}><button
          type="button"
          className="grid h-6 w-3 shrink-0 place-items-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${map.name}`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsedMapIds(current => {
            const next = new Set(current);
            if (next.has(map.id)) next.delete(map.id);
            else next.add(map.id);
            return next;
          })}
        ><ChevronRight className={cn('size-3 transition-transform', !collapsed && 'rotate-90')} /></button></IconButtonTooltip> : <span className="h-6 w-3 shrink-0" aria-hidden="true" />}
        {editingMapId === map.id
          ? <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5"><MapIcon className="size-3.5 shrink-0 text-primary" /><Input
            autoFocus
            draggable={false}
            aria-label={`Rename map: ${map.name}`}
            className="h-6 px-1 text-xs font-medium"
            defaultValue={map.name}
            onFocus={event => event.currentTarget.select()}
            onBlur={event => finishEditing(event.currentTarget.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); finishEditing(event.currentTarget.value); }
              if (event.key === 'Escape') setEditingMapId(null);
            }}
            onDragStart={event => event.stopPropagation()}
          /></div>
          : <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left" onClick={() => onSelect(map.id)} onDoubleClick={() => setEditingMapId(map.id)}><MapIcon className="size-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate font-medium">{map.name}</span><span className="shrink-0 text-[10px] text-muted-foreground">#{map.id}</span></button>}
        <MapSettings key={`${map.id}:${map.parentMapId}:${map.bounds.w}:${map.bounds.h}`} game={game} map={map} onMove={onMove} onResize={onResize} onChangeEncounters={onChangeEncounters} />
        <div
          data-map-separator-after={map.id}
          className={cn('pointer-events-none absolute right-0 -bottom-[3px] left-0 h-px bg-transparent transition-colors', dropTarget?.id === map.id && dropTarget.position === 'after' && 'bg-primary')}
          aria-hidden="true"
        />
      </div>
      {children.length > 0 && !collapsed && <div className="ml-4 border-l border-border pl-1" role="group">{children.map((child, index) => renderMap(child, index, children))}</div>}
    </div>;
  };
  const roots = childrenOf();
  return <ResizableSidebarSection defaultSize="25%" defaultOpen open={open} onOpenChange={onOpenChange} topBorder={false} title="Maps" contentClassName="flex-1" actions={<NewMapPopover onCreate={onCreate} trigger={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add map"><Plus /></Button>} />}>
    <ScrollArea className="h-full min-h-0"><SidebarList className="space-y-0 py-0 pb-1" role="tree" aria-label="Map hierarchy">{roots.map((map, index) => renderMap(map, index, roots))}</SidebarList></ScrollArea>
  </ResizableSidebarSection>;
}
