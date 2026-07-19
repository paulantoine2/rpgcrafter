import type { DrawingTool, EditorMode } from '@/components/studio-sidebar';

export type EditorShortcut =
  | { type: 'mode'; mode: EditorMode }
  | { type: 'layer'; layerId: string }
  | { type: 'tool'; tool: DrawingTool };

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>;

export function editorShortcut(event: ShortcutEvent, mode: EditorMode, layerIds: string[]): EditorShortcut | null {
  const command = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (command) {
    if (mode !== 'drawing' || event.altKey || !['1', '2', '3', '4'].includes(key)) return null;
    const layerId = layerIds[Number(key) - 1];
    return layerId ? { type: 'layer', layerId } : null;
  }

  if (event.altKey) return null;
  if (key === 'e') return { type: 'mode', mode: 'events' };
  if (key === 'd') return { type: 'mode', mode: 'drawing' };
  if (mode !== 'drawing') return null;

  const tools: Partial<Record<string, DrawingTool>> = {
    p: 'pencil',
    r: 'rectangle',
    o: 'ellipse',
    b: 'bucket',
    x: 'eraser',
  };
  const tool = tools[key];
  return tool ? { type: 'tool', tool } : null;
}
