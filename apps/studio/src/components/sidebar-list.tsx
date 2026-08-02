import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const sidebarListItemVariants = cva(
  'rounded-md outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      selected: {
        true: 'bg-sidebar-accent text-sidebar-accent-foreground',
        false: '',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

export function SidebarList({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sidebar-list" className={cn('space-y-1 px-2 py-1', className)} {...props} />;
}

export function SidebarListItem({ className, selected, ...props }: ComponentProps<'button'> & VariantProps<typeof sidebarListItemVariants>) {
  return <button
    type="button"
    data-slot="sidebar-list-item"
    className={cn('flex w-full items-center text-left', sidebarListItemVariants({ selected }), className)}
    {...props}
  />;
}
