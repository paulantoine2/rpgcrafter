import { createRef } from 'react';
import { Popover } from '@base-ui/react/popover';
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
    const anchor = createRef<HTMLButtonElement>();
    render(<Popover.Root open><Popover.Trigger render={<button ref={anchor} type="button">Open sprites</button>} /><EventSpritePicker open onOpenChange={onOpenChange} anchor={anchor} sprites={[sprite]} onSelect={onSelect} /></Popover.Root>);

    expect(screen.getByRole('dialog')).toHaveClass('w-72', 'rounded-lg', 'bg-popover');
    expect(screen.getByRole('searchbox', { name: 'Search event sprites' })).toBeInTheDocument();
    const scrollArea = screen.getByRole('listbox', { name: 'Event sprites' }).closest('[data-slot="scroll-area"]');
    expect(scrollArea).toHaveClass('h-80', 'min-h-0');
    expect(scrollArea?.querySelector('[data-slot="scroll-area-viewport"]')).toBeInTheDocument();
    const option = screen.getByRole('option', { name: 'Actor 1 2' });
    expect(option.firstElementChild).toHaveClass('size-9');
    await userEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith(sprite, 1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('filters the sprite list by name', async () => {
    const anchor = createRef<HTMLButtonElement>();
    const enemy = { ...sprite, id: 'enemy-1', name: 'Enemy', imagePath: 'sprites/enemy.png' };
    render(<Popover.Root open><Popover.Trigger render={<button ref={anchor} type="button">Open sprites</button>} /><EventSpritePicker open onOpenChange={() => {}} anchor={anchor} sprites={[sprite, enemy]} onSelect={async () => {}} /></Popover.Root>);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search event sprites' }), 'enemy');
    expect(screen.queryByRole('option', { name: 'Actor 1 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Enemy 1' })).toBeInTheDocument();
  });
});
