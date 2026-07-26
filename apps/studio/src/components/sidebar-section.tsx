import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type UIEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanel } from '@/components/ui/resizable';
import { usePanelRef } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

type SidebarSectionProps = { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; topBorder?: boolean; className?: string; contentClassName?: string };

export function SectionHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div
    data-slot="section-header"
    className={cn('flex h-12 shrink-0 items-center gap-2 border-t px-4 py-4 text-[11px] font-semibold text-foreground', className)}
    {...props}
  />;
}

export function SidebarSection({ title, icon, actions, children, collapsible = true, defaultOpen = true, open: controlledOpen, onOpenChange, topBorder = true, className, contentClassName }: SidebarSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [hasHiddenContentAbove, setHasHiddenContentAbove] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) setHasHiddenContentAbove(false);
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const handleScroll = (event: UIEvent<HTMLElement>) => {
    const scrollContainer = event.target;
    if (scrollContainer instanceof HTMLElement) setHasHiddenContentAbove(scrollContainer.scrollTop > 0);
  };
  const headerClassName = cn(!topBorder && 'border-t-0', 'border-b', hasHiddenContentAbove ? 'border-b-border' : 'border-b-transparent');
  if (!collapsible) return <section data-slot="sidebar-section" className={cn('flex min-h-0 flex-col', className)} onScrollCapture={handleScroll}>
    <SectionHeader className={headerClassName}>
      {icon}{title}
      {actions && <span className="ml-auto">{actions}</span>}
    </SectionHeader>
    <div data-slot="section-content" className={cn('min-h-0 flex-1 overflow-hidden', contentClassName)}>{children}</div>
  </section>;
  return <Collapsible data-slot="sidebar-section" open={open} onOpenChange={setOpen} className={cn('flex min-h-0 flex-col', className)} onScrollCapture={handleScroll}>
    <SectionHeader className={cn('group', headerClassName)}>
      <CollapsibleTrigger className="relative flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"><ChevronRight className={cn('absolute -left-3.5 size-3 opacity-0 transition-transform group-hover:opacity-100 group-focus-within:opacity-100', open && 'rotate-90')} />{icon}{title}</CollapsibleTrigger>
      {actions}
    </SectionHeader>
    <CollapsibleContent data-slot="section-content" className={cn('min-h-0 flex-1 overflow-hidden', contentClassName)}>{children}</CollapsibleContent>
  </Collapsible>;
}

export function ResizableSidebarSection({ defaultSize, minSize = '120px', className, ...props }: SidebarSectionProps & Pick<ComponentProps<typeof ResizablePanel>, 'defaultSize' | 'minSize'>) {
  const panelRef = usePanelRef();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(props.defaultOpen ?? true);
  const open = props.open ?? uncontrolledOpen;
  const lastOpenSize = useRef<number | string>(defaultSize ?? minSize);
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    if (open && !wasOpen.current) panelRef.current?.resize(lastOpenSize.current);
    wasOpen.current = open;
  }, [open, panelRef]);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      const currentSize = panelRef.current?.getSize();
      if (currentSize && currentSize.inPixels > 48) lastOpenSize.current = `${currentSize.inPixels}px`;
      panelRef.current?.collapse();
    }
    if (props.open === undefined) setUncontrolledOpen(nextOpen);
    props.onOpenChange?.(nextOpen);
  };
  return <ResizablePanel panelRef={panelRef} defaultSize={open ? defaultSize : '48px'} minSize={minSize} collapsible collapsedSize="48px" disabled={!open} className="min-h-0">
    <SidebarSection {...props} open={open} onOpenChange={handleOpenChange} className={cn('h-full', className)} />
  </ResizablePanel>;
}
