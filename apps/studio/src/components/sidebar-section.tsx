import { useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanel } from '@/components/ui/resizable';
import { usePanelRef } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

type SidebarSectionProps = { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; collapsible?: boolean; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; contentClassName?: string };

export function SectionHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div
    data-slot="section-header"
    className={cn('flex h-12 shrink-0 items-center gap-2 border-t px-4 py-4 text-[11px] font-semibold text-foreground', className)}
    {...props}
  />;
}

export function SidebarSection({ title, icon, actions, children, collapsible = true, defaultOpen = true, open: controlledOpen, onOpenChange, className, contentClassName }: SidebarSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  if (!collapsible) return <section className={cn('flex min-h-0 flex-col', className)}>
    <SectionHeader>
      {icon}{title}
      {actions && <span className="ml-auto">{actions}</span>}
    </SectionHeader>
    <div className={cn('min-h-0', contentClassName)}>{children}</div>
  </section>;
  return <Collapsible open={open} onOpenChange={setOpen} className={cn('flex min-h-0 flex-col', className)}>
    <SectionHeader className="group">
      <CollapsibleTrigger className="relative flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"><ChevronRight className={cn('absolute -left-3.5 size-3 opacity-0 transition-transform group-hover:opacity-100 group-focus-within:opacity-100', open && 'rotate-90')} />{icon}{title}</CollapsibleTrigger>
      {actions}
    </SectionHeader>
    <CollapsibleContent className={cn('min-h-0', contentClassName)}>{children}</CollapsibleContent>
  </Collapsible>;
}

export function ResizableSidebarSection({ defaultSize, minSize = '120px', className, ...props }: SidebarSectionProps & Pick<ComponentProps<typeof ResizablePanel>, 'defaultSize' | 'minSize'>) {
  const panelRef = usePanelRef();
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) panelRef.current?.expand();
    else panelRef.current?.collapse();
  };
  return <ResizablePanel panelRef={panelRef} defaultSize={open ? defaultSize : '48px'} minSize={minSize} collapsible collapsedSize="48px" className="min-h-0">
    <SidebarSection {...props} open={open} onOpenChange={handleOpenChange} className={cn('h-full', className)} />
  </ResizablePanel>;
}
