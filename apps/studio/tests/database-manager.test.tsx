import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/components/database-manager';
import { createEmptyProject } from '../src/lib/source-game';

function setupGame() {
  const game = createEmptyProject('Database test').game;
  game.items = {
    1: { name: 'Potion', type: 'consumable', healing: 25 },
    2: { name: 'Sword', type: 'equipment', stats: { attack: 4 } },
  };
  game.initialState.variables[1] = { name: 'Score', initialValue: 0 };
  game.initialState.switches[1] = { name: 'Door open', initialValue: false };
  game.events.commonEvents[1] = { name: 'Intro', trigger: { type: 'none' }, contents: [] };
  game.maps[1].events.push({
    id: 1, name: 'score-event', position: { x: 1, y: 1, planeId: 'plane-1' }, pages: [{
      movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
      options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
      priority: 'sameAsCharacters', trigger: { type: 'actionButton', radius: 1 },
      contents: [{ type: 'setVariable', id: 1, operation: 'add', operand: { kind: 'constant', value: 1 } }],
    }],
  });
  return game;
}

function props(overrides: Partial<ComponentProps<typeof DatabaseManager>> = {}): ComponentProps<typeof DatabaseManager> {
  return {
    game: setupGame(),
    onCreateItem: vi.fn(() => 3), onUpdateItem: vi.fn(), onDuplicateItem: vi.fn(() => 3), onDeleteItem: vi.fn(),
    onCreateSkill: vi.fn(() => 2), onUpdateSkill: vi.fn(), onDuplicateSkill: vi.fn(() => 2), onDeleteSkill: vi.fn(),
    battleAssets: [], onImportBattleAsset: vi.fn(async () => undefined),
    onCreateEnemy: vi.fn(() => 1), onUpdateEnemy: vi.fn(), onDuplicateEnemy: vi.fn(() => 1), onDeleteEnemy: vi.fn(),
    onCreateTroop: vi.fn(() => 1), onUpdateTroop: vi.fn(), onDuplicateTroop: vi.fn(() => 1), onDeleteTroop: vi.fn(), onBattleTest: vi.fn(), onUpdateDefaultBattleBackground: vi.fn(),
    onCreateCommonEvent: vi.fn(() => 2), onUpdateCommonEvent: vi.fn(), onDuplicateCommonEvent: vi.fn(() => 2), onDeleteCommonEvent: vi.fn(),
    onCreateType: vi.fn(() => 1), onRenameType: vi.fn(), onDeleteType: vi.fn(),
    onRenameVariable: vi.fn(), onRenameSwitch: vi.fn(), onCreateSwitch: vi.fn(() => 2), onCreateVariable: vi.fn(() => 2),
    assetUrls: {}, onImportLocal: vi.fn(), onUpdate: vi.fn(), onChangeTerrainCollision: vi.fn(),
    ...overrides,
  };
}

describe('DatabaseManager', () => {
  it('keeps one navigation sidebar and uses detailed tables for database entries', async () => {
    render(<DatabaseManager {...props()} />);
    const menu = screen.getByRole('navigation', { name: 'Database sections' });
    expect(menu.closest('[data-database-sidebar]')).toHaveAttribute('data-database-sidebar', 'sections');
    expect(within(menu).getByRole('button', { name: 'Items' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Tilesets' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Skills' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Enemies' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Troops' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'System' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Types' })).toHaveAttribute('data-slot', 'collapsible-trigger');
    expect(within(menu).getByRole('button', { name: 'Variables' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByRole('button', { name: 'Switches' })).toHaveAttribute('data-slot', 'sidebar-menu-button');
    expect(within(menu).getByText('Game')).toBeInTheDocument();
    expect(within(menu).queryByText('Project')).not.toBeInTheDocument();
    expect(within(menu).getAllByText('System')).toHaveLength(2);
    expect(within(menu).getAllByText('2')[0]).toHaveAttribute('data-slot', 'sidebar-menu-badge');
    expect(screen.getByRole('table', { name: 'Items' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /1 Potion consumable/i })).toHaveAttribute('data-state', 'selected');
    expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveClass('pl-4');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search items' }), 'potion');
    expect(screen.getByRole('row', { name: /Potion/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Sword/ })).not.toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('button', { name: 'Skills' }));
    expect(screen.getByRole('table', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Basic attack melee/i })).toBeInTheDocument();
    expect(screen.getAllByText('Basic attack')).toHaveLength(2);
  });

  it('keeps project tilesets in the database', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Tilesets' }));
    expect(screen.getByText('Tilesets', { selector: '[data-slot="section-header"]' })).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search project tilesets' });
    expect(search).toBeInTheDocument();
    expect(search.closest('aside')?.closest('[data-database-sidebar]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Import PNG' })).toBeInTheDocument();
  });

  it('creates and edits common events with the shared command editor', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    const menu = screen.getByRole('navigation', { name: 'Database sections' });
    await userEvent.click(within(menu).getByRole('button', { name: 'Common Events' }));
    expect(screen.getByRole('table', { name: 'Common Events' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /1 Intro none/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Common event name' })).toHaveValue('Intro');
    await userEvent.click(screen.getByRole('button', { name: 'Create common event' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New entry name' }), 'Parallel clock');
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(values.onCreateCommonEvent).toHaveBeenCalledWith('Parallel clock');
  });

  it('renames system entries and lists their usages', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Variables' }));
    expect(screen.getByRole('table', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /1 Score 0/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Variable initial value' })).toHaveValue('0');
    expect(screen.getByText('Map 1 · score-event · page 1')).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Variable name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Player score');
    await userEvent.tab();
    expect(values.onRenameVariable).toHaveBeenCalledWith(1, 'Player score');
  });

  it('creates an item and duplicates the selected entry', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create item' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New entry name' }), 'Ether');
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(values.onCreateItem).toHaveBeenCalledWith('Ether', 'consumable');
    await userEvent.click(screen.getByRole('row', { name: /Potion/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(values.onDuplicateItem).toHaveBeenCalledWith(1);
  });

  it('shows conditional item fields and the missing equipment slot state', async () => {
    const game = setupGame();
    game.types.equipment = { nextId: 1, entries: [] };
    render(<DatabaseManager {...props({ game })} />);
    expect(screen.getByRole('spinbutton', { name: 'Item healing' })).toHaveValue(25);
    await userEvent.click(screen.getByRole('row', { name: /Sword/ }));
    expect(screen.getByText('No equipment types are configured for this project yet.')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Stat value attack' })).toHaveValue(4);
  });

  it('blocks deletion when the selected skill is referenced', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Skills' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cannot delete Basic attack');
    expect(screen.getByText('Player primary attack')).toBeInTheDocument();
    expect(values.onDeleteSkill).not.toHaveBeenCalled();
  });

  it('confirms deletion of an unreferenced item', async () => {
    const values = props();
    render(<DatabaseManager {...values} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete Potion?');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(values.onDeleteItem).toHaveBeenCalledWith(1);
  });

  it('creates and renames numeric types within the selected category', async () => {
    const game = setupGame();
    game.types.elements = { nextId: 2, entries: [{ id: 1, name: 'Fire' }] };
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    const menu = screen.getByRole('navigation', { name: 'Database sections' });
    expect(within(menu).queryByRole('list', { name: 'Type categories' })).not.toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('button', { name: 'Types' }));
    const categories = screen.getByRole('list', { name: 'Type categories' });
    expect(categories).toHaveAttribute('data-slot', 'sidebar-menu-sub');
    expect(categories.closest('[data-slot="collapsible-content"]')).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Elements name 1' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Flame');
    await userEvent.tab();
    expect(values.onRenameType).toHaveBeenCalledWith('elements', 1, 'Flame');
    await userEvent.click(screen.getByRole('button', { name: 'Create Elements' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New type name' }), 'Ice');
    await userEvent.click(screen.getByRole('button', { name: /^Create$/ }));
    expect(values.onCreateType).toHaveBeenCalledWith('elements', 'Ice');
  });

  it('blocks deletion of a referenced equipment type', async () => {
    const game = setupGame();
    game.types.equipment = { nextId: 2, entries: [{ id: 1, name: 'Weapon' }] };
    game.items[2].equipmentTypeId = 1;
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Types' }));
    await userEvent.click(screen.getByRole('button', { name: 'Equipment Types' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Weapon' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cannot delete Weapon');
    expect(screen.getByText('items.2.equipmentTypeId')).toBeInTheDocument();
    expect(values.onDeleteType).not.toHaveBeenCalled();
  });

  it('edits enemy stats and imports a selected enemy image', async () => {
    const game = setupGame();
    game.enemies[1] = { name: 'Slime', color: '#00ff00', stats: { maxHp: 30, attack: 8, defense: 2 }, rewards: { xp: 6 }, speed: 40, radius: 18, behavior: 'chase' };
    game.manifest.nextIds.enemies = 2;
    const asset = { kind: 'battleAsset' as const, id: 'slime', name: 'Green Slime', imagePath: 'battle/slime.png', url: 'slime.png', assetType: 'side-view-enemy-battler', tags: ['enemy'] };
    const values = props({ game, battleAssets: [asset] });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Enemies' }));
    expect(screen.getByRole('spinbutton', { name: 'Enemy max HP' })).toHaveValue(30);
    expect(screen.getByRole('spinbutton', { name: 'Enemy attack' })).toHaveValue(8);
    expect(screen.getByRole('spinbutton', { name: 'Enemy defense' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Enemy experience' })).toHaveValue(6);
    await userEvent.click(screen.getByRole('button', { name: 'Choose enemy image' }));
    await userEvent.click(screen.getByRole('button', { name: 'Green Slime' }));
    expect(values.onImportBattleAsset).toHaveBeenCalledWith(asset);
    expect(values.onUpdateEnemy).toHaveBeenCalledWith(1, expect.objectContaining({ image: 'battle/slime.png' }));
  });

  it('selects a troop member before allowing it to be dragged without snapping', async () => {
    const game = setupGame();
    game.enemies[1] = { name: 'Slime', color: '#00ff00', stats: { maxHp: 30, attack: 8, defense: 2 }, rewards: { xp: 6 }, speed: 40, radius: 18, behavior: 'chase' };
    game.troops[1] = { name: 'Slime pair', members: [{ enemyId: 1, x: 25, y: 40 }] };
    game.manifest.nextIds.enemies = 2;
    game.manifest.nextIds.troops = 2;
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Troops' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add enemy' }));
    expect(values.onUpdateTroop).toHaveBeenCalledWith(1, expect.objectContaining({ members: [{ enemyId: 1, x: 25, y: 40 }, { enemyId: 1, x: 28, y: 48 }] }));

    const preview = screen.getByLabelText('Troop battle preview');
    vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 225, width: 400, height: 225, toJSON: () => ({}) });
    const member = screen.getByRole('button', { name: 'Troop member 1: Slime' });
    vi.mocked(values.onUpdateTroop).mockClear();
    fireEvent.pointerDown(member, { pointerId: 1, buttons: 1, clientX: 100, clientY: 90 });
    expect(member).toHaveAttribute('aria-pressed', 'true');
    expect(values.onUpdateTroop).not.toHaveBeenCalled();

    fireEvent.pointerDown(member, { pointerId: 2, buttons: 1, clientX: 100, clientY: 90 });
    expect(values.onUpdateTroop).not.toHaveBeenCalled();
    fireEvent.pointerMove(member, { pointerId: 2, buttons: 1, clientX: 300, clientY: 112.5 });
    expect(values.onUpdateTroop).toHaveBeenLastCalledWith(1, expect.objectContaining({ members: [expect.objectContaining({ x: 75, y: 50 })] }));
  });

  it('auto-names a troop from its composition and starts its battle test', async () => {
    const game = setupGame();
    game.enemies[1] = { name: 'Slime', color: '#00ff00', stats: { maxHp: 30, attack: 8, defense: 2 }, rewards: { xp: 6 }, speed: 40, radius: 18, behavior: 'chase' };
    game.enemies[2] = { name: 'Bat', color: '#333333', stats: { maxHp: 20, attack: 6, defense: 1 }, rewards: { xp: 4 }, speed: 50, radius: 14, behavior: 'chase' };
    game.troops[1] = { name: 'Untitled troop', members: [{ enemyId: 1, x: 25, y: 40 }, { enemyId: 2, x: 50, y: 35 }, { enemyId: 1, x: 75, y: 40 }] };
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Troops' }));

    await userEvent.click(screen.getByRole('button', { name: 'Auto name' }));
    expect(values.onUpdateTroop).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Slime ×2, Bat' }));

    await userEvent.click(screen.getByRole('button', { name: 'Battle Test' }));
    expect(values.onBattleTest).toHaveBeenCalledWith(1);
  });

  it('configures the default battle background from the System section', async () => {
    const game = setupGame();
    game.enemies[1] = { name: 'Slime', color: '#00ff00', stats: { maxHp: 30, attack: 8, defense: 2 }, rewards: { xp: 6 }, speed: 40, radius: 18, behavior: 'chase' };
    game.troops[1] = { name: 'Slime pair', members: [{ enemyId: 1, x: 25, y: 40 }] };
    const lower = { kind: 'battleAsset' as const, id: 'forest-ground', name: 'Forest Ground', imagePath: 'battle/forest-ground.png', url: 'forest-ground.png', assetType: 'battle-background-lower', tags: ['forest'] };
    const upper = { kind: 'battleAsset' as const, id: 'forest-backdrop', name: 'Forest Backdrop', imagePath: 'battle/forest-backdrop.png', url: 'forest-backdrop.png', assetType: 'battle-background-upper', tags: ['forest'] };
    const values = props({ game, battleAssets: [lower, upper] });
    render(<DatabaseManager {...values} />);
    const menu = screen.getByRole('navigation', { name: 'Database sections' });

    await userEvent.click(within(menu).getByRole('button', { name: 'Troops' }));
    expect(screen.queryByText('Default background')).not.toBeInTheDocument();

    await userEvent.click(within(menu).getByRole('button', { name: 'System' }));
    expect(screen.getByText('Default background')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose default' }));
    await userEvent.click(screen.getByRole('button', { name: 'Forest Ground' }));
    await userEvent.click(screen.getByRole('button', { name: 'Forest Backdrop' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply background' }));
    expect(values.onImportBattleAsset).toHaveBeenCalledWith(lower);
    expect(values.onImportBattleAsset).toHaveBeenCalledWith(upper);
    expect(values.onUpdateDefaultBattleBackground).toHaveBeenCalledWith({ lowerImage: 'battle/forest-ground.png', upperImage: 'battle/forest-backdrop.png' });
  });

  it('blocks enemy deletion while a troop references it', async () => {
    const game = setupGame();
    game.enemies[1] = { name: 'Slime', color: '#00ff00', stats: { maxHp: 30, attack: 8, defense: 2 }, rewards: { xp: 6 }, speed: 40, radius: 18, behavior: 'chase' };
    game.troops[1] = { name: 'Slime pair', members: [{ enemyId: 1, x: 25, y: 40 }] };
    game.manifest.nextIds.enemies = 2;
    game.manifest.nextIds.troops = 2;
    const values = props({ game });
    render(<DatabaseManager {...values} />);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Database sections' })).getByRole('button', { name: 'Enemies' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Cannot delete Slime');
    expect(screen.getByText('troops.1.members[0].enemyId')).toBeInTheDocument();
    expect(values.onDeleteEnemy).not.toHaveBeenCalled();
  });
});
