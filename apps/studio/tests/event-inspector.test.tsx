import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MapEvent, SourceGame } from '@rpgcrafter/game-schema';
import { EventInspector } from '../src/components/event-inspector';
import { TooltipProvider } from '../src/components/ui/tooltip';
import { createMapEventAt } from '../src/lib/editor-events';
import { createEmptyProject } from '../src/lib/source-game';

function Harness({ emptySwitches = false, withSprite = false, onEventChange }: { emptySwitches?: boolean; withSprite?: boolean; onEventChange?: (event: MapEvent) => void }) {
  const project = createEmptyProject('Inspector');
  const [switches, setSwitches] = useState<SourceGame['initialState']['switches']>(emptySwitches ? {} : {
      'door-open': { name: 'Door open', initialValue: false },
      'boss-defeated': { name: 'Boss defeated', initialValue: false },
  });
  project.game.initialState.switches = switches;
  const [items, setItems] = useState<SourceGame['items']>({
    potion: { name: 'Potion', type: 'consumable', healing: 25 },
    'silver-sword': { name: 'Silver Sword', type: 'equipment', equipmentSlot: 'weapon' },
  });
  project.game.items = items;
  const [variables, setVariables] = useState<SourceGame['initialState']['variables']>({
    score: { name: 'Score', initialValue: 0 },
    reputation: { name: 'Reputation', initialValue: 0 },
  });
  project.game.initialState.variables = variables;
  const [event, setEvent] = useState<MapEvent>(() => {
    const created = createMapEventAt(project.game, 'map-1', { x: 1, y: 1, planeId: 'plane-1' });
    if (withSprite) created.pages[0].sprite = { image: 'sprites/test.png', characterIndex: 0, characterColumns: 4, frameWidth: 48, frameHeight: 48, objectAligned: false };
    return created;
  });
  project.game.maps['map-1'].events = [event];
  const createSwitch = (name: string) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'switch';
    let id = base;
    let suffix = 2;
    while (switches[id]) id = `${base}-${suffix++}`;
    setSwitches(current => ({ ...current, [id]: { name, initialValue: false } }));
    return id;
  };
  const createVariable = (name: string) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'variable';
    let id = base;
    let suffix = 2;
    while (variables[id]) id = `${base}-${suffix++}`;
    setVariables(current => ({ ...current, [id]: { name, initialValue: 0 } }));
    return id;
  };
  const changeEvent = (nextEvent: MapEvent) => {
    setEvent(nextEvent);
    onEventChange?.(nextEvent);
  };
  const renameSwitch = (id: string, name: string) => setSwitches(current => current[id] ? ({ ...current, [id]: { ...current[id], name } }) : current);
  const renameVariable = (id: string, name: string) => setVariables(current => current[id] ? ({ ...current, [id]: { ...current[id], name } }) : current);
  const renameItem = (id: string, name: string) => setItems(current => current[id] ? ({ ...current, [id]: { ...current[id], name } }) : current);
  return <TooltipProvider delay={0}><EventInspector game={project.game} mapId="map-1" event={event} issues={[]} assetUrls={{}} sprites={[]} onChangeEvent={changeEvent} onImportSprite={async () => {}} onCreateSwitch={createSwitch} onCreateVariable={createVariable} onRenameSwitch={renameSwitch} onRenameVariable={renameVariable} onRenameItem={renameItem} /></TooltipProvider>;
}

describe('EventInspector pages', () => {
  it('omits the top border from the first section header', () => {
    const { container } = render(<Harness />);

    const conditionsHeader = screen.getByText('Conditions').closest('[data-slot="section-header"]');
    expect(conditionsHeader).toHaveClass('border-t-0');
    expect(conditionsHeader?.parentElement?.children).toHaveLength(1);
    expect(screen.getByText('Autonomous Movement').closest('[data-slot="section-header"]')).not.toHaveClass('border-t-0');
    expect([...container.querySelectorAll('[data-slot="section-header"]')].map(header => header.textContent)).toEqual([
      'Conditions', 'Trigger', 'Sprite', 'Autonomous Movement', 'Contents',
    ]);
    expect(screen.queryByRole('checkbox', { name: 'Walking animation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Options')).not.toBeInTheDocument();
  });

  it('shows sprite options inside the Sprite section only when a sprite is selected', () => {
    render(<Harness withSprite />);

    const spriteSection = screen.getByText('Sprite').closest('section');
    expect(spriteSection?.querySelector('[data-slot="attachment"]')).toBeInTheDocument();
    expect(spriteSection).toContainElement(screen.getByRole('button', { name: 'Change sprite' }));
    expect(spriteSection).toContainElement(screen.getByRole('button', { name: 'Remove sprite' }));
    expect(spriteSection).toContainElement(screen.getByRole('checkbox', { name: 'Walking animation' }));
    expect(spriteSection).toContainElement(screen.getByRole('checkbox', { name: 'Through' }));
    expect(spriteSection).toHaveTextContent('Priority');
    expect(screen.queryByText('Options')).not.toBeInTheDocument();
  });

  it('selects the trigger type from icon tabs', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    expect(screen.queryByRole('combobox', { name: 'Trigger type' })).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Trigger type' })).toHaveClass('w-full');
    const actionButton = screen.getByRole('tab', { name: 'Action Button' });
    expect(actionButton).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Player Touch' }));

    expect(screen.getByRole('tab', { name: 'Player Touch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Height' })).toBeInTheDocument();
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].trigger).toEqual({ type: 'playerTouch', size: { w: 1, h: 1 } });
  });

  it('configures autonomous movement in a contextual settings panel', async () => {
    const user = userEvent.setup();
    render(<Harness withSprite />);

    const enabled = screen.getByRole('switch', { name: 'Enable autonomous movement' });
    expect(enabled).not.toBeChecked();
    expect(screen.queryByRole('combobox', { name: 'Autonomous movement type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Autonomous movement settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Movement speed' })).not.toBeInTheDocument();

    await user.click(enabled);
    expect(enabled).toBeChecked();
    const type = screen.getByRole('combobox', { name: 'Autonomous movement type' });
    expect(type).toHaveTextContent('Random');
    await user.click(screen.getByRole('button', { name: 'Autonomous movement settings' }));
    expect(await screen.findByRole('slider', { name: 'Movement speed' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Movement frequency' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close autonomous movement settings' }));

    await user.click(type);
    await user.click(await screen.findByRole('option', { name: 'Custom route' }));
    await user.click(screen.getByRole('button', { name: 'Autonomous movement settings' }));
    const routeHeader = (await screen.findByText('Looping route')).closest('[data-slot="section-header"]');
    expect(routeHeader).toHaveClass('border-t');
    expect(routeHeader).not.toHaveClass('border-b');
    await user.click(screen.getByRole('button', { name: 'Add movement command' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const moveDirection = screen.getByRole('combobox', { name: 'Move direction' });
    expect(moveDirection).toHaveTextContent('Moveforward');
    await user.click(screen.getByRole('button', { name: 'Remove move command' }));
    expect(screen.queryByRole('combobox', { name: 'Move direction' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close autonomous movement settings' }));
    await user.click(enabled);
    expect(screen.queryByRole('combobox', { name: 'Autonomous movement type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Autonomous movement settings' })).not.toBeInTheDocument();
  });

  it('adds a selected condition type from the section header and removes it inline', async () => {
    render(<Harness />);

    const addCondition = screen.getByRole('button', { name: 'Add condition' });
    expect(screen.getByText('Conditions').closest('[data-slot="section-header"]')).toContainElement(addCondition);
    expect(addCondition).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move down' })).not.toBeInTheDocument();

    addCondition.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('menuitem', { name: 'Quest' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Switch' }));

    const switchPicker = screen.getByRole('button', { name: 'Choose switch' });
    expect(switchPicker).toHaveTextContent('Door openTrue');
    expect(switchPicker).toContainElement(screen.getByRole('img', { name: 'switch condition' }));
    expect(await screen.findByRole('textbox', { name: 'Search switches' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove switch condition' })).toHaveAttribute('data-base-ui-tooltip-trigger');

    await userEvent.click(screen.getByRole('button', { name: 'Remove switch condition' }));
    expect(screen.queryByRole('img', { name: 'switch condition' })).not.toBeInTheDocument();

    await userEvent.click(addCondition);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Item' }));
    expect(screen.getByRole('button', { name: 'Choose item' })).toContainElement(screen.getByRole('img', { name: 'item condition' }));
  });

  it('searches and selects items from the condition picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Item' }));
    const itemPicker = screen.getByRole('button', { name: 'Choose item' });
    expect(itemPicker).toHaveTextContent('Potion×1');

    await user.click(itemPicker);
    const search = await screen.findByRole('textbox', { name: 'Search items' });
    expect(screen.getByRole('option', { name: 'Potion' })).toHaveClass('bg-primary/15');
    expect(screen.getByRole('option', { name: 'Silver Sword' })).toBeInTheDocument();

    await user.type(search, 'silver');
    expect(screen.queryByRole('option', { name: 'Potion' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Silver Sword' }));
    expect(itemPicker).toHaveTextContent('Silver Sword');
  });

  it('searches, selects and creates switches from the condition picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));

    const search = await screen.findByRole('textbox', { name: 'Search switches' });
    const picker = screen.getByRole('dialog');
    const selectedOption = screen.getByRole('option', { name: 'Door open' });
    expect(picker).toHaveClass('bg-background');
    expect(picker).not.toHaveClass('p-2');
    expect(selectedOption).toHaveClass('bg-primary/15');
    expect(selectedOption.closest('[data-slot="scroll-area"]')).toHaveClass('max-h-56');
    expect(screen.queryByText('door-open')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create switch' })).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.getByRole('button', { name: 'Close switch picker' })).toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(screen.getByRole('option', { name: 'Boss defeated' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close switch picker' }));
    expect(screen.queryByRole('textbox', { name: 'Search switches' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose switch' }));

    await user.type(screen.getByRole('textbox', { name: 'Search switches' }), 'boss');
    expect(screen.queryByRole('option', { name: 'Door open' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Boss defeated' }));
    expect(screen.getByRole('button', { name: 'Choose switch' })).toHaveTextContent('Boss defeated');

    await user.click(screen.getByRole('button', { name: 'Choose switch' }));
    await user.click(screen.getByRole('button', { name: 'Create switch' }));
    await user.type(await screen.findByRole('textbox', { name: 'Switch name' }), 'Treasure claimed');
    await user.click(screen.getByRole('button', { name: 'Confirm switch creation' }));

    expect(screen.getByRole('button', { name: 'Choose switch' })).toHaveTextContent('Treasure claimed');
    await user.click(screen.getByRole('button', { name: 'Choose switch' }));
    expect(await screen.findByRole('option', { name: 'Treasure claimed' })).toBeInTheDocument();
  });

  it('configures and renames a switch condition from its settings', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));
    await user.click(await screen.findByRole('option', { name: 'Door open' }));
    expect(screen.queryByLabelText('Expected switch value')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch condition settings' }));
    expect(await screen.findByText('Switch condition')).toBeInTheDocument();
    expect(screen.getByText('Switch condition').closest('[role="dialog"]')).toHaveClass('bg-background');
    expect(screen.getByRole('button', { name: 'Close condition settings' })).toBeInTheDocument();
    const expectedValue = await screen.findByLabelText('Expected switch value');
    expect(expectedValue).toBeChecked();
    await user.click(expectedValue);
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toMatchObject({ kind: 'switch', equals: false });
    expect(screen.getByRole('button', { name: 'Choose switch' })).toHaveTextContent('False');

    const name = screen.getByRole('textbox', { name: 'Switch name' });
    await user.clear(name);
    await user.type(name, 'Entry unlocked');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Choose switch' })).toHaveTextContent('Entry unlocked');
    await user.click(screen.getByRole('button', { name: 'Close condition settings' }));
    expect(screen.queryByText('Expected value')).not.toBeInTheDocument();
  });

  it('configures and renames an item condition from its settings', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Item' }));
    expect(screen.queryByRole('spinbutton', { name: 'Required quantity' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Item condition settings' }));
    const quantity = await screen.findByRole('spinbutton', { name: 'Required quantity' });
    await user.clear(quantity);
    await user.type(quantity, '3');
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toMatchObject({ kind: 'item', amount: 3 });
    expect(screen.getByRole('button', { name: 'Choose item' })).toHaveTextContent('×3');

    const name = screen.getByRole('textbox', { name: 'Item name' });
    await user.clear(name);
    await user.type(name, 'Greater Potion');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Choose item' })).toHaveTextContent('Greater Potion');
  });

  it('searches, configures and renames a variable condition', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Variable' }));
    expect(await screen.findByRole('textbox', { name: 'Search variables' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create variable' }));
    await user.type(await screen.findByRole('textbox', { name: 'Variable name' }), 'Enemy Count');
    await user.click(screen.getByRole('button', { name: 'Confirm variable creation' }));
    expect(screen.getByRole('button', { name: 'Choose variable' })).toHaveTextContent('Enemy Count');

    await user.click(screen.getByRole('button', { name: 'Choose variable' }));
    await user.type(screen.getByRole('textbox', { name: 'Search variables' }), 'reputation');
    await user.click(screen.getByRole('option', { name: 'Reputation' }));

    const variablePicker = screen.getByRole('button', { name: 'Choose variable' });
    expect(variablePicker).toHaveTextContent('Reputation= 0');
    await user.click(screen.getByRole('button', { name: 'Variable condition settings' }));

    await user.click(await screen.findByRole('combobox', { name: 'Variable comparison' }));
    await user.click(await screen.findByRole('option', { name: '≥ Greater than or equal' }));
    const comparisonValue = screen.getByRole('spinbutton', { name: 'Value' });
    await user.clear(comparisonValue);
    await user.type(comparisonValue, '12');
    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].conditions?.[0]).toMatchObject({ kind: 'variable', id: 'reputation', operator: 'greaterThanOrEqual', value: 12 });
    expect(variablePicker).toHaveTextContent('Reputation≥ 12');

    const name = screen.getByRole('textbox', { name: 'Variable name' });
    await user.clear(name);
    await user.type(name, 'Town Reputation');
    await user.tab();
    expect(variablePicker).toHaveTextContent('Town Reputation');
  });

  it('keeps a switch condition as a draft until its first switch is created', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness emptySwitches onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Switch' }));

    expect(await screen.findByText('No switches found.')).toBeInTheDocument();
    expect(onEventChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Create switch' }));
    await user.type(await screen.findByRole('textbox', { name: 'Switch name' }), 'First switch');
    await user.click(screen.getByRole('button', { name: 'Confirm switch creation' }));

    expect(onEventChange).toHaveBeenCalledTimes(1);
    const persistedCondition = onEventChange.mock.calls[0][0].pages[0].conditions?.[0];
    expect(persistedCondition).toMatchObject({ kind: 'switch', id: 'first-switch', equals: true });
  });

  it('adds and configures a set-variable command without offering set quest state', async () => {
    const user = userEvent.setup();
    const onEventChange = vi.fn();
    render(<Harness onEventChange={onEventChange} />);

    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.click(screen.getByRole('combobox', { name: 'Command type' }));
    expect(screen.queryByRole('option', { name: /set quest state/i })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Set variable' }));

    const variable = screen.getByRole('combobox', { name: 'Variable' });
    expect(variable).toHaveTextContent('Score');
    await user.click(variable);
    await user.click(await screen.findByRole('option', { name: 'Reputation' }));
    const value = screen.getByRole('spinbutton', { name: 'Value' });
    await user.clear(value);
    await user.type(value, '25');

    expect(onEventChange.mock.calls.at(-1)?.[0].pages[0].contents[0]).toEqual({ type: 'setVariable', id: 'reputation', value: 25 });
  });

  it('adds, duplicates, navigates and deletes inline pages', async () => {
    render(<Harness withSprite />);
    const pageTabs = within(screen.getByRole('tablist', { name: 'Event pages' }));
    expect(screen.queryByText('Highest page number has priority')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move page earlier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move page later' })).not.toBeInTheDocument();
    for (const name of ['Add event page', 'Duplicate event page', 'Delete event page']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('data-base-ui-tooltip-trigger');
    }
    expect(screen.getByRole('button', { name: 'Duplicate event page' })).toHaveTextContent('');
    expect(pageTabs.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete event page' })).toBeDisabled();

    const through = screen.getByRole('checkbox', { name: 'Through' });
    await userEvent.click(through);
    expect(through).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(2);
    expect(pageTabs.getByRole('tab', { name: '2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: 'Through' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Through' }));
    await userEvent.click(pageTabs.getByRole('tab', { name: '1' }));
    expect(screen.getByRole('checkbox', { name: 'Through' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Add event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(3);
    expect(pageTabs.getByRole('tab', { name: '2' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Delete event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(2);
    expect(pageTabs.getByRole('tab', { name: '1' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Delete event page' }));
    expect(pageTabs.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete event page' })).toBeDisabled();
  });
});
