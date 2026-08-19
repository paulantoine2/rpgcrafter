import { describe, expect, it, vi } from 'vitest';
import { watchSystemTheme } from '../src/lib/system-theme';

describe('system theme', () => {
  it('follows the current color scheme and reacts to system changes', () => {
    let onChange = () => {};
    const media = {
      matches: false,
      addEventListener: vi.fn((_type: string, listener: () => void) => { onChange = listener; }),
      removeEventListener: vi.fn(),
    };
    const root = document.createElement('html');
    const stop = watchSystemTheme(media as unknown as MediaQueryList, root);

    expect(root).not.toHaveClass('dark');
    expect(root.style.colorScheme).toBe('light');

    media.matches = true;
    onChange();
    expect(root).toHaveClass('dark');
    expect(root.style.colorScheme).toBe('dark');

    stop();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', onChange);
  });

  it('uses a fixed light palette for the RPG Maker MZ interface', () => {
    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const root = document.createElement('html');
    root.dataset.studioInterface = 'rpgMakerMz';
    watchSystemTheme(media as unknown as MediaQueryList, root);
    expect(root).not.toHaveClass('dark');
    expect(root.style.colorScheme).toBe('light');
  });
});
