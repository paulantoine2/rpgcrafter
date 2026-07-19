import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StudioToolbar } from '../src/components/studio-toolbar';
import { TooltipProvider } from '../src/components/ui/tooltip';

const common = {
  layers: [
    { id: 'layer-1', name: 'Layer 1', planeId: 'plane-1', renderPhase: 'belowActors' as const, tiles: [] },
    { id: 'layer-2', name: 'Layer 2', planeId: 'plane-1', renderPhase: 'belowActors' as const, tiles: [] },
    { id: 'layer-3', name: 'Layer 3', planeId: 'plane-1', renderPhase: 'aboveActors' as const, tiles: [] },
    { id: 'layer-4', name: 'Layer 4', planeId: 'plane-1', renderPhase: 'aboveActors' as const, tiles: [] },
  ],
  activeLayerId: 'layer-1', drawingTool: 'pencil' as const,
  onChangeMode: vi.fn(), onSelectLayer: vi.fn(), onChangeDrawingTool: vi.fn(),
};

describe('StudioToolbar', () => {
  it('keeps the mode switcher on the right and changes editor mode', async () => {
    const onChangeMode = vi.fn();
    render(<StudioToolbar {...common} mode="events" onChangeMode={onChangeMode} />);
    expect(screen.queryByRole('tab', { name: 'Nav' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Draw' }));
    expect(onChangeMode).toHaveBeenCalledWith('drawing');
  });

  it('shows a single always-selected cursor in events mode', () => {
    render(<StudioToolbar {...common} mode="events" />);
    const toolbar = screen.getByRole('toolbar', { name: 'Event tools' });
    expect(toolbar.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Event cursor' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes four painting tools followed by the hybrid eraser', async () => {
    const onChangeDrawingTool = vi.fn();
    render(<TooltipProvider delay={0}><StudioToolbar {...common} mode="drawing" onChangeDrawingTool={onChangeDrawingTool} /></TooltipProvider>);
    const pencil = screen.getByRole('button', { name: 'Pencil' });
    expect(pencil).toHaveAttribute('aria-pressed', 'true');
    expect(pencil).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.getByRole('button', { name: 'Rectangle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ellipse' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Brush' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bucket' }));
    expect(onChangeDrawingTool).toHaveBeenNthCalledWith(1, 'eraser');
    expect(onChangeDrawingTool).toHaveBeenCalledWith('bucket');
    expect([...screen.getByRole('toolbar', { name: 'Drawing tool' }).querySelectorAll('button')].map(button => button.getAttribute('aria-label'))).toEqual(['Pencil', 'Rectangle', 'Ellipse', 'Bucket', 'Eraser']);
  });

  it('selects one of the four fixed map layers', async () => {
    const onSelectLayer = vi.fn();
    render(<TooltipProvider delay={0}><StudioToolbar {...common} mode="drawing" onSelectLayer={onSelectLayer} /></TooltipProvider>);
    const layerButtons = screen.getByRole('group', { name: 'Drawing layer' }).querySelectorAll('button');
    expect(layerButtons).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Layer 1' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Layer 3' }));
    expect(onSelectLayer).toHaveBeenCalledWith('layer-3');
  });
});
