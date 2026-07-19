import { useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanel } from '@/components/ui/resizable';
import { usePanelRef } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

type SidebarSectionProps = { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; contentClassName?: string };

export function SidebarSection({ title, icon, actions, children, defaultOpen = true, open: controlledOpen, onOpenChange, className, contentClassName }: SidebarSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  return <Collapsible open={open} onOpenChange={setOpen} className={cn('flex min-h-0 flex-col border-b', className)}>
    <div className="group flex h-8 shrink-0 items-center gap-1 border-b px-2 text-[10px] font-medium text-muted-foreground">
      <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"><ChevronRight className={cn('size-3 shrink-0 opacity-0 transition-transform group-hover:opacity-100 group-focus-within:opacity-100', open && 'rotate-90')} />{icon}{title}</CollapsibleTrigger>
      {actions}
    </div>
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
  return <ResizablePanel panelRef={panelRef} defaultSize={defaultSize} minSize={minSize} collapsible collapsedSize="32px" className="min-h-0">
    <SidebarSection {...props} open={open} onOpenChange={handleOpenChange} className={cn('h-full', className)} />
  </ResizablePanel>;
}
