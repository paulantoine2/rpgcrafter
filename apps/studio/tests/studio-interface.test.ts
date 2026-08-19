import { describe, expect, it, vi } from 'vitest';
import { applyStudioInterface, readStudioInterface, studioInterfaceChangeEvent, studioInterfaceStorageKey, writeStudioInterface } from '../src/lib/studio-interface';

describe('studio interface preference', () => {
  it('defaults invalid or missing values to the modern interface', () => {
    expect(readStudioInterface({ getItem: () => null })).toBe('modern');
    expect(readStudioInterface({ getItem: () => 'classic' })).toBe('modern');
  });

  it('reads and writes supported values', () => {
    const setItem = vi.fn();
    expect(readStudioInterface({ getItem: () => 'rpgMakerMz' })).toBe('rpgMakerMz');
    writeStudioInterface('rpgMakerMz', { setItem });
    expect(setItem).toHaveBeenCalledWith(studioInterfaceStorageKey, 'rpgMakerMz');
  });

  it('applies the interface to the document root and announces the change', () => {
    const root = document.createElement('html');
    const listener = vi.fn();
    root.addEventListener(studioInterfaceChangeEvent, listener);
    applyStudioInterface('rpgMakerMz', root);
    expect(root).toHaveAttribute('data-studio-interface', 'rpgMakerMz');
    expect(listener).toHaveBeenCalledOnce();
  });
});
