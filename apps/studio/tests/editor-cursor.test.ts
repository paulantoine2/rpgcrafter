import { describe, expect, it } from 'vitest';
import { mapCanvasCursor } from '../src/lib/editor-cursor';

const idleDrawingState = {
  mode: 'drawing' as const,
  eventTool: 'cursor' as const,
  drawingTool: 'pencil',
  hasSelectedTerrain: true,
  spacePressed: false,
  panning: false,
  dragging: false,
  hoveringDraggable: false,
};

describe('map canvas cursor', () => {
  it('hides the native cursor while the custom Space cursor is active', () => {
    expect(mapCanvasCursor({
      ...idleDrawingState,
      spacePressed: true,
      panning: true,
    })).toBe('none');
  });

  it('keeps the native cursor hidden after a Space pan ends', () => {
    expect(mapCanvasCursor({
      ...idleDrawingState,
      spacePressed: true,
    })).toBe('none');
  });

  it('restores the active tool cursor after Space is released', () => {
    expect(mapCanvasCursor(idleDrawingState)).toBe('crosshair');
  });

  it('keeps the native cursor hidden when Pixi updates its hovered object', () => {
    expect(mapCanvasCursor({
      ...idleDrawingState,
      spacePressed: true,
      hoveringDraggable: true,
    })).toBe('none');
  });
});
