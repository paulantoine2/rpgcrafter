import { useLayoutEffect, useRef, type ReactElement } from 'react';
import type { TileLayer } from '@rpgcrafter/game-schema';
import { CalendarRange, Circle, Eraser, Layers3, MousePointer2, PaintBucket, Paintbrush, Pencil, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DrawingTool, EditorMode } from '@/components/studio-sidebar';

function ToolTooltip({ label, description, children }: { label: string; description?: string; children: ReactElement }) {
  return <Tooltip>
    <TooltipTrigger render={children} />
    <TooltipContent>
      <span><span className="block font-medium">{label}</span>{description && <span className="block text-background/70">{description}</span>}</span>
    </TooltipContent>
  </Tooltip>;
}

function ModeToggle({ mode, onChange }: { mode: EditorMode; onChange: (mode: EditorMode) => void }) {
  const modes: { value: EditorMode; label: string; icon: typeof CalendarRange }[] = [
    { value: 'events', label: 'Events', icon: CalendarRange },
    { value: 'drawing', label: 'Draw', icon: Paintbrush },
  ];

  return <div className="flex shrink-0 gap-0.5 rounded-lg bg-muted/80 p-0.5" role="tablist" aria-label="Editor mode">
    {modes.map(item => {
      const Icon = item.icon;
      return <ToolTooltip key={item.value} label={item.label}><button
          type="button"
          role="tab"
          aria-label={item.label}
          aria-selected={mode === item.value}
          className={cn(
            'grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            mode === item.value && 'bg-background text-foreground shadow-sm',
          )}
          onClick={() => onChange(item.value)}
        ><Icon className="size-3.5" /></button></ToolTooltip>;
    })}
  </div>;
}

function EventsTools() {
  return <div className="flex shrink-0 rounded-md border bg-background/70 p-0.5" role="toolbar" aria-label="Event tools">
    <ToolTooltip label="Event cursor" description="Select an event or double-click a tile to create one"><Button type="button" variant="default" size="icon-sm" className="rounded-sm" aria-label="Event cursor" aria-pressed="true"><MousePointer2 /></Button></ToolTooltip>
  </div>;
}

function DrawingTools({ layers, activeLayerId, drawingTool, onSelectLayer, onChangeDrawingTool }: {
  layers: TileLayer[];
  activeLayerId: string | null;
  drawingTool: DrawingTool;
  onSelectLayer: (layerId: string) => void;
  onChangeDrawingTool: (tool: DrawingTool) => void;
}) {
  const tools: { value: DrawingTool; label: string; description: string; icon: typeof Pencil }[] = [
    { value: 'pencil', label: 'Pencil', description: 'Paint with the selected tiles', icon: Pencil },
    { value: 'rectangle', label: 'Rectangle', description: 'Click and drag to paint a rectangle', icon: Square },
    { value: 'ellipse', label: 'Ellipse', description: 'Click and drag to paint an ellipse', icon: Circle },
    { value: 'bucket', label: 'Bucket', description: 'Fill an adjacent area of matching tiles', icon: PaintBucket },
    { value: 'eraser', label: 'Eraser', description: 'Click a tile or drag to erase a rectangle', icon: Eraser },
  ];
  return <>
    <div className="flex shrink-0 gap-1" role="group" aria-label="Drawing layer">
      {layers.slice(0, 4).map((layer, index) => <ToolTooltip
        key={layer.id}
        label={`Layer ${index + 1}`}
        description={layer.renderPhase === 'belowActors' ? 'Below actors' : 'Above actors'}
      ><Button type="button" variant={layer.id === activeLayerId ? 'default' : 'ghost'} size="icon-lg" className="relative rounded-md" aria-label={`Layer ${index + 1}`} aria-pressed={layer.id === activeLayerId} onClick={() => onSelectLayer(layer.id)}><Layers3 className="size-4" /><span className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center rounded-full bg-background text-[8px] leading-none font-bold text-foreground ring-1 ring-border">{index + 1}</span></Button></ToolTooltip>)}
    </div>
    <div className="h-8 w-px shrink-0 bg-border" aria-hidden="true" />
    <div className="flex shrink-0 gap-1" role="toolbar" aria-label="Drawing tool">
      {tools.map(item => {
        const Icon = item.icon;
        return <ToolTooltip key={item.value} label={item.label} description={item.description}><Button type="button" variant={drawingTool === item.value ? 'default' : 'ghost'} size="icon-lg" className="rounded-md" aria-label={item.label} aria-pressed={drawingTool === item.value} onClick={() => onChangeDrawingTool(item.value)}><Icon /></Button></ToolTooltip>;
      })}
    </div>
  </>;
}

export function StudioToolbar({ mode, layers, activeLayerId, drawingTool, onChangeMode, onSelectLayer, onChangeDrawingTool }: {
  mode: EditorMode;
  layers: TileLayer[];
  activeLayerId: string | null;
  drawingTool: DrawingTool;
  onChangeMode: (mode: EditorMode) => void;
  onSelectLayer: (layerId: string) => void;
  onChangeDrawingTool: (tool: DrawingTool) => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const previousWidthRef = useRef<number | null>(null);
  const widthAnimationRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    let fromWidth = previousWidthRef.current;
    if (widthAnimationRef.current?.playState === 'running') {
      fromWidth = toolbar.getBoundingClientRect().width;
    }
    widthAnimationRef.current?.cancel();

    const targetWidth = toolbar.getBoundingClientRect().width;
    previousWidthRef.current = targetWidth;
    if (fromWidth === null || Math.abs(fromWidth - targetWidth) < 1 || typeof toolbar.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    widthAnimationRef.current = toolbar.animate(
      [{ width: `${fromWidth}px` }, { width: `${targetWidth}px` }],
      { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [mode]);

  return <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3">
    <div ref={toolbarRef} className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-hidden rounded-xl border bg-card/95 p-1.5 shadow-[0_12px_36px_-12px_rgb(0_0_0/0.45)] backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mode === 'events' && <EventsTools />}
        {mode === 'drawing' && <DrawingTools layers={layers} activeLayerId={activeLayerId} drawingTool={drawingTool} onSelectLayer={onSelectLayer} onChangeDrawingTool={onChangeDrawingTool} />}
      </div>
      <div className="h-7 w-px shrink-0 bg-border" aria-hidden="true" />
      <ModeToggle mode={mode} onChange={onChangeMode} />
    </div>
  </div>;
}
