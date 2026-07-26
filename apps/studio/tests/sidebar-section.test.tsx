import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const panelApi = vi.hoisted(() => ({
  collapse: vi.fn(),
  expand: vi.fn(),
  getSize: vi.fn(() => ({ asPercentage: 40, inPixels: 256 })),
  isCollapsed: vi.fn(),
  resize: vi.fn(),
}));

vi.mock('react-resizable-panels', async () => {
  const React = await import('react');
  return {
    Panel: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => React.createElement('div', { 'data-disabled': disabled || undefined }, children),
    usePanelRef: () => ({ current: panelApi }),
  };
});

import { ResizableSidebarSection } from '../src/components/sidebar-section';

describe('ResizableSidebarSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    panelApi.getSize.mockReturnValue({ asPercentage: 40, inPixels: 256 });
  });

  it('restores the last open pixel size after closing and reopening', async () => {
    render(<ResizableSidebarSection defaultSize="40%" title="Maps"><div>Content</div></ResizableSidebarSection>);
    const trigger = screen.getByRole('button', { name: 'Maps' });

    await userEvent.click(trigger);
    expect(panelApi.getSize).toHaveBeenCalledOnce();
    expect(panelApi.collapse).toHaveBeenCalledOnce();

    await userEvent.click(trigger);
    expect(panelApi.resize).toHaveBeenCalledWith('256px');
  });
});
