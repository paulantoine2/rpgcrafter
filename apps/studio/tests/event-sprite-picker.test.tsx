import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LibrarySprite } from '../src/components/asset-manager-dialog';
import { EventSpritePicker, spriteReference } from '../src/components/event-sprite-picker';

const sprite: LibrarySprite = {
  kind: 'sprite',
  id: 'actor-1',
  name: 'Actor 1',
  blob: new Blob(['png'], { type: 'image/png' }),
  imagePath: 'sprites/actor-1.png',
  url: 'actor-1.png',
  assetType: 'character-sprite',
  tags: ['fantasy'],
  layout: { characterColumns: 4, characterRows: 2, characterCount: 8, patterns: 3, directions: ['down', 'left', 'right', 'up'], frameWidth: 48, frameHeight: 48, objectAligned: false },
};

describe('EventSpritePicker', () => {
  it('creates a persisted reference from sprite metadata', () => {
    expect(spriteReference(sprite, 3)).toEqual({
      image: 'sprites/actor-1.png',
      characterIndex: 3,
      characterColumns: 4,
      frameWidth: 48,
      frameHeight: 48,
      objectAligned: false,
    });
  });

  it('lets the user choose a character from a sprite sheet', async () => {
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<EventSpritePicker open onOpenChange={onOpenChange} sprites={[sprite]} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Choose Actor 1 2' }));

    expect(onSelect).toHaveBeenCalledWith(sprite, 1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
