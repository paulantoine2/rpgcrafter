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
    assetManagerOpen: false,
    onNewProject: vi.fn(),
    onOpenProject: vi.fn(),
    onSaveDraft: vi.fn(),
    onExportProject: vi.fn(),
    onRevertProject: vi.fn(),
    onCloseProject: vi.fn(),
    onOpenAssetManager: vi.fn(),
    onPlay: vi.fn(),
    ...overrides,
  };
}

describe('StudioAppSidebar', () => {
  it('shows File first and Asset Manager second', () => {
    render(<TooltipProvider><StudioAppSidebar {...props()} /></TooltipProvider>);
    const buttons = within(screen.getByRole('navigation', { name: 'Project tools' })).getAllByRole('button');
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['File', 'Asset Manager']);
  });

  it('opens the project actions from the File icon', async () => {
    const values = props();
    render(<TooltipProvider><StudioAppSidebar {...values} /></TooltipProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New Project…' }));
    expect(values.onNewProject).toHaveBeenCalledOnce();
  });

  it('opens the Asset Manager from the second icon', async () => {
    const onOpenAssetManager = vi.fn();
    render(<TooltipProvider><StudioAppSidebar {...props({ onOpenAssetManager })} /></TooltipProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Asset Manager' }));
    expect(onOpenAssetManager).toHaveBeenCalledOnce();
  });
});
