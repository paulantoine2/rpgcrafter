import { describe, expect, it } from 'vitest';
import { editorShortcut } from '../src/lib/editor-shortcuts';

const key = (value: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...modifiers,
});

describe('editor keyboard shortcuts', () => {
  it('switches between events and drawing modes', () => {
    expect(editorShortcut(key('d'), 'events', [])).toEqual({ type: 'mode', mode: 'drawing' });
    expect(editorShortcut(key('E'), 'drawing', [])).toEqual({ type: 'mode', mode: 'events' });
  });

  it('selects drawing layers with Command or Control and 1–4', () => {
    const layers = ['layer-1', 'layer-2', 'layer-3', 'layer-4'];
    expect(editorShortcut(key('3', { metaKey: true }), 'drawing', layers)).toEqual({ type: 'layer', layerId: 'layer-3' });
    expect(editorShortcut(key('4', { ctrlKey: true }), 'drawing', layers)).toEqual({ type: 'layer', layerId: 'layer-4' });
    expect(editorShortcut(key('2', { metaKey: true }), 'events', layers)).toBeNull();
  });

  it.each([
    ['p', 'pencil'],
    ['r', 'rectangle'],
    ['o', 'ellipse'],
    ['b', 'bucket'],
    ['x', 'eraser'],
  ] as const)('maps %s to the %s drawing tool', (shortcut, tool) => {
    expect(editorShortcut(key(shortcut), 'drawing', [])).toEqual({ type: 'tool', tool });
    expect(editorShortcut(key(shortcut), 'events', [])).toBeNull();
  });
});
