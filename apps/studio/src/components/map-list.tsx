import { useState } from 'react';
import type { GameMap, SourceGame } from '@rpgcrafter/game-schema';
import { ChevronRight, MapIcon, Plus, Settings2 } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IconButtonTooltip } from '@/components/ui/tooltip';
import { ResizableSidebarSection } from '@/components/sidebar-section';
import { mapDropTargetForRow, type MapDropPosition } from '@/lib/map-hierarchy';
import { cn } from '@/lib/utils';

function SizeFields({ width, height, onWidthChange, onHeightChange }: { width: number; height: number; onWidthChange: (value: number) => void; onHeightChange: (value: number) => void }) {
  return <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-[10px] text-muted-foreground">Width (tiles)<Input type="number" min={1} value={width} onChange={event => onWidthChange(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} /></label><label className="grid gap-1 text-[10px] text-muted-foreground">Height (tiles)<Input type="number" min={1} value={height} onChange={event => onHeightChange(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} /></label></div>;
}

function NewMapPopover({ onCreate, trigger }: { onCreate: (width: number, height: number) => void; trigger: React.ReactElement }) {
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(15);
  return <Popover.Root><IconButtonTooltip label="Add map"><Popover.Trigger render={trigger} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={4} className="z-50"><Popover.Popup className="w-56 space-y-3 bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"><div><h3 className="text-xs font-medium">New map</h3><p className="text-[10px] text-muted-foreground">Choose the map size in tiles.</p></div><SizeFields width={width} height={height} onWidthChange={setWidth} onHeightChange={setHeight} /><Button type="button" size="sm" className="w-full" onClick={() => onCreate(width, height)}>Create map</Button></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>;
}

function descendantIds(game: SourceGame, mapId: string) {
  const descendants = new Set<string>();
  const visit = (parentId: string) => Object.values(game.maps).forEach(map => {
    if (map.parentMapId !== parentId || descendants.has(map.id)) return;
    descendants.add(map.id);
    visit(map.id);
  });
  visit(mapId);
  return descendants;
}

function MapSettings({ game, map, onMove, onResize }: { game: SourceGame; map: GameMap; onMove: (id: string, parentMapId: string | null) => void; onResize: (id: string, width: number, height: number) => void }) {
  const [width, setWidth] = useState(map.bounds.w);
  const [height, setHeight] = useState(map.bounds.h);
  const unavailableParents = descendantIds(game, map.id);
  unavailableParents.add(map.id);
  return <Popover.Root><IconButtonTooltip label={`Map settings: ${map.name}`}><Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" className="opacity-0 hover:bg-foreground/10 group-hover/map-row:opacity-100 group-focus-within/map-row:opacity-100 aria-expanded:bg-foreground/10 aria-expanded:opacity-100" aria-label={`Map settings: ${map.name}`}><Settings2 /></Button>} /></IconButtonTooltip><Popover.Portal><Popover.Positioner side="right" align="start" sideOffset={4} className="z-50"><Popover.Popup className="w-60 space-y-3 bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"><label className="grid gap-1 text-[10px] text-muted-foreground">Parent map<select aria-label="Parent map" className="h-8 border bg-background px-2 text-xs text-foreground" value={map.parentMapId || ''} onChange={event => onMove(map.id, event.target.value || null)}><option value="">Top level</option>{Object.values(game.maps).filter(candidate => !unavailableParents.has(candidate.id)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><div className="border-t pt-3"><h3 className="text-xs font-medium">Map size</h3><p className="mb-2 text-[10px] text-muted-foreground">Changing the size crops content outside the new bounds.</p><SizeFields width={width} height={height} onWidthChange={setWidth} onHeightChange={setHeight} /></div><Button type="button" size="sm" className="w-full" onClick={() => onResize(map.id, width, height)}>Apply size</Button></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>;
}

export function MapList({ game, selectedMapId, open, onOpenChange, onSelect, onCreate, onRename, onMove, onReorder, onResize }: { game: SourceGame; selectedMapId: string; open?: boolean; onOpenChange?: (open: boolean) => void; onSelect: (id: string) => void; onCreate: (width: number, height: number) => void; onRename: (id: string, name: string) => void; onMove: (id: string, parentMapId: string | null) => void; onReorder: (id: string, targetId: string, position: MapDropPosition) => void; onResize: (id: string, width: number, height: number) => void }) {
  const [dropTarget, setDropTarget] = useState<{ id: string; position: MapDropPosition } | null>(null);
  const [draggedMapId, setDraggedMapId] = useState<string | null>(null);
  const [collapsedMapIds, setCollapsedMapIds] = useState<Set<string>>(() => new Set());
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const maps = Object.values(game.maps);
  const childrenOf = (parentMapId?: string) => maps.filter(map => map.parentMapId === parentMapId || (!parentMapId && map.parentMapId && !game.maps[map.parentMapId]));
  const renderMap = (map: GameMap, siblingIndex: number, siblings: GameMap[]): React.ReactNode => {
    const children = childrenOf(map.id);
    const collapsed = collapsedMapIds.has(map.id);
    const finishEditing = (value: string) => {
      const name = value.trim();
      setEditingMapId(null);
      if (name && name !== map.name) onRename(map.id, name);
    };
    return <div key={map.id} className="mb-1 last:mb-0" role="treeitem" aria-expanded={children.length ? !collapsed : undefined}>
      <div
        draggable
        data-map-row-id={map.id}
        className={cn(
          'group/map-row flex min-h-9 items-center gap-1 border-y border-transparent px-1 text-xs hover:bg-sidebar-accent/60',
          map.id === selectedMapId && 'bg-sidebar-accent text-sidebar-accent-foreground',
          dropTarget?.id === map.id && dropTarget.position === 'before' && 'border-t-primary',
          dropTarget?.id === map.id && dropTarget.position === 'after' && 'border-b-primary',
          dropTarget?.id === map.id && dropTarget.position === 'inside' && 'bg-primary/15 ring-1 ring-primary ring-inset',
        )}
        onDragStart={event => {
          setDraggedMapId(map.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', map.id);
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
          ? <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1"><MapIcon className="size-3.5 shrink-0 text-primary" /><Input
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
          : <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left" onClick={() => onSelect(map.id)} onDoubleClick={() => setEditingMapId(map.id)}><MapIcon className="size-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate font-medium">{map.name}</span></button>}
        <MapSettings key={`${map.id}:${map.parentMapId}:${map.bounds.w}:${map.bounds.h}`} game={game} map={map} onMove={onMove} onResize={onResize} />
      </div>
      {children.length > 0 && !collapsed && <div className="ml-4 border-l border-border pl-1" role="group">{children.map((child, index) => renderMap(child, index, children))}</div>}
    </div>;
  };
  const roots = childrenOf();
  return <ResizableSidebarSection defaultSize="40%" defaultOpen={false} open={open} onOpenChange={onOpenChange} topBorder={false} title="Maps" contentClassName="flex-1" actions={<NewMapPopover onCreate={onCreate} trigger={<Button type="button" variant="ghost" size="icon-sm" aria-label="Add map"><Plus /></Button>} />}>
    <ScrollArea className="h-full min-h-0"><div role="tree" aria-label="Map hierarchy">{roots.map((map, index) => renderMap(map, index, roots))}</div></ScrollArea>
  </ResizableSidebarSection>;
}
