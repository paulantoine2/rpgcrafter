import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RpgMakerMzMenubar } from '../src/components/rpg-maker-mz-menubar';

function props(overrides: Partial<ComponentProps<typeof RpgMakerMzMenubar>> = {}) {
  return {
    title: 'Test Game',
    hasProject: true,
    canExport: true,
    mode: 'drawing' as const,
    studioInterface: 'rpgMakerMz' as const,
    onNewProject: vi.fn(),
    onOpenProject: vi.fn(),
    onSaveDraft: vi.fn(),
    onExportProject: vi.fn(),
    onRevertProject: vi.fn(),
    onCloseProject: vi.fn(),
    onChangeMode: vi.fn(),
    onOpenMapSettings: vi.fn(),
    onOpenAssets: vi.fn(),
    onOpenDatabase: vi.fn(),
    onPlay: vi.fn(),
    onChangeStudioInterface: vi.fn(),
    ...overrides,
  };
}

describe('RpgMakerMzMenubar', () => {
  it('exposes project tools as classic application menus', async () => {
    const values = props();
    render(<RpgMakerMzMenubar {...values} />);
    expect(screen.getByText('Test Game — RPG Crafter')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tools' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Database…' }));
    expect(values.onOpenDatabase).toHaveBeenCalledOnce();
  });

  it('switches back to the modern interface from File', async () => {
    const onChangeStudioInterface = vi.fn();
    render(<RpgMakerMzMenubar {...props({ onChangeStudioInterface })} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    await userEvent.hover(await screen.findByRole('menuitem', { name: 'Interface' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Modern' }));
    expect(onChangeStudioInterface).toHaveBeenCalledWith('modern');
  });
});
