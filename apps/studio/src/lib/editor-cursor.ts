type MapCanvasCursorState = {
  mode: 'events' | 'drawing' | 'navigation';
  eventTool: 'cursor' | 'playerStart';
  drawingTool: string;
  hasSelectedTerrain: boolean;
  spacePressed: boolean;
  panning: boolean;
  dragging: boolean;
  hoveringDraggable: boolean;
};

export function mapCanvasCursor(state: MapCanvasCursorState) {
  if (state.spacePressed) return 'none';
  if (state.panning || state.dragging) return 'grabbing';
  if (state.hoveringDraggable) return 'grab';
  if (
    state.mode === 'navigation'
    || (state.mode === 'events' && state.eventTool === 'playerStart')
    || (state.mode === 'drawing' && (state.drawingTool === 'eraser' || state.hasSelectedTerrain))
  ) return 'crosshair';
  return '';
}
