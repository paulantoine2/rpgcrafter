import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StudioAppSidebar } from '../src/components/studio-app-sidebar';
import { TooltipProvider } from '../src/components/ui/tooltip';

function props(overrides: Partial<ComponentProps<typeof StudioAppSidebar>> = {}) {
  return {
    hasProject: true,
    canExport: true,
    activeTab: 'maps' as const,
    onNewProject: vi.fn(),
    onOpenProject: vi.fn(),
    onSaveDraft: vi.fn(),
    onExportProject: vi.fn(),
    onRevertProject: vi.fn(),
    onCloseProject: vi.fn(),
    onSelectMaps: vi.fn(),
    onSelectAssets: vi.fn(),
    ...overrides,
  };
}

describe('StudioAppSidebar', () => {
  it('separates the RPG Crafter menu from the Maps and Assets tabs', () => {
    render(<TooltipProvider><StudioAppSidebar {...props()} /></TooltipProvider>);
    expect(screen.getByRole('complementary', { name: 'Studio navigation' })).toHaveClass('w-12', 'bg-sidebar', 'text-sidebar-foreground');
    expect(screen.getByRole('button', { name: 'RPG Crafter menu' })).not.toHaveAttribute('aria-pressed');
    const buttons = within(screen.getByRole('navigation', { name: 'Studio tabs' })).getAllByRole('button');
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['Maps', 'Assets']);
  });

  it('opens the project actions from the RPG Crafter logo', async () => {
    const values = props();
    render(<TooltipProvider><StudioAppSidebar {...values} /></TooltipProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'RPG Crafter menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New Project…' }));
    expect(values.onNewProject).toHaveBeenCalledOnce();
  });

  it('opens Assets from the second icon', async () => {
    const onSelectAssets = vi.fn();
    render(<TooltipProvider><StudioAppSidebar {...props({ onSelectAssets })} /></TooltipProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Assets' }));
    expect(onSelectAssets).toHaveBeenCalledOnce();
  });

  it('uses the navigation icons as tabs', async () => {
    const onSelectMaps = vi.fn();
    const { rerender } = render(<TooltipProvider><StudioAppSidebar {...props({ activeTab: 'assets', onSelectMaps })} /></TooltipProvider>);
    expect(screen.getByRole('button', { name: 'Assets' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Assets' })).toHaveClass('size-8', 'bg-primary', 'text-primary-foreground', 'rounded-md');
    await userEvent.click(screen.getByRole('button', { name: 'Maps' }));
    expect(onSelectMaps).toHaveBeenCalledOnce();
    rerender(<TooltipProvider><StudioAppSidebar {...props({ activeTab: 'maps' })} /></TooltipProvider>);
    expect(screen.getByRole('button', { name: 'Maps' })).toHaveAttribute('aria-pressed', 'true');
  });
});
