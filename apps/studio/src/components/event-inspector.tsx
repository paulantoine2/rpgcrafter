import { useEffect, useState, type ReactNode } from 'react';
import type { Condition, ContentIssue, EventCommand, MapEvent, MapEventPage, MovementCommand, MovementRoute, SourceGame } from '@rpgcrafter/game-schema';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { LibrarySprite } from '@/components/asset-manager-dialog';
import { EventSpritePicker, SpritePreview, spriteReference } from '@/components/event-sprite-picker';
import { SectionHeader } from '@/components/sidebar-section';

type Props = {
  game: SourceGame;
  mapId: string;
  event: MapEvent | null;
  issues: ContentIssue[];
  assetUrls: Record<string, string>;
  sprites: LibrarySprite[];
  onChangeEvent: (event: MapEvent) => void;
  onSelectPage?: (index: number) => void;
  onImportSprite: (sprite: LibrarySprite) => Promise<void>;
};

const commandTypes: EventCommand['type'][] = ['dialogue', 'movementRoute', 'wait', 'setFlag', 'setQuestState', 'giveItem', 'removeItem', 'unlockSkill', 'healPlayer', 'toast', 'teleport', 'save'];
const conditionKinds: Condition['kind'][] = ['flag', 'item', 'quest'];

function Section({ title, children, first = false }: { title: string; children: ReactNode; first?: boolean }) {
  return <section>
    <SectionHeader className={first ? 'border-t-0' : undefined}>{title}</SectionHeader>
    <div className="space-y-3 px-4 pb-4">{children}</div>
  </section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-muted-foreground">{label}</Label>{children}</div>;
}

function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return <Input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} />;
}

function EnumSelect<T extends string>({ value, values, onChange, labels }: { value: T; values: readonly T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <Select value={value} onValueChange={next => onChange(next as T)}>
      <SelectTrigger className="w-full"><SelectValue>{labels?.[value] || value}</SelectValue></SelectTrigger>
      <SelectContent>{values.map(item => <SelectItem key={item} value={item}>{labels?.[item] || item}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function move<T>(items: T[], index: number, delta: number) {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function RowActions({ index, count, onMove, onRemove, removeDisabled }: { index: number; count: number; onMove: (delta: number) => void; onRemove: () => void; removeDisabled?: boolean }) {
  return <div className="flex items-center gap-1">
    <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp /></Button>
    <Button type="button" variant="ghost" size="icon-xs" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown /></Button>
    <Button type="button" variant="ghost" size="icon-xs" disabled={removeDisabled} onClick={onRemove} aria-label="Remove"><Trash2 /></Button>
  </div>;
}

function defaultCondition(kind: Condition['kind'], game: SourceGame): Condition {
  if (kind === 'flag') return { kind, id: Object.keys(game.initialState.flags)[0] || '', equals: true };
  if (kind === 'item') return { kind, id: Object.keys(game.items)[0] || '', amount: 1 };
  const id = Object.keys(game.quests)[0] || '';
  return { kind, id, state: game.quests[id]?.states[0] || '' };
}

function ConditionsEditor({ game, value, onChange }: { game: SourceGame; value: Condition[]; onChange: (value: Condition[]) => void }) {
  const update = (index: number, condition: Condition) => onChange(value.map((item, itemIndex) => itemIndex === index ? condition : item));
  return <div className="space-y-2">
    {value.map((condition, index) => <div key={index} className="space-y-2 border bg-muted/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <EnumSelect value={condition.kind} values={conditionKinds} onChange={kind => update(index, defaultCondition(kind, game))} />
        <RowActions index={index} count={value.length} onMove={delta => onChange(move(value, index, delta))} onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} />
      </div>
      {condition.kind === 'flag' && <>
        <EnumSelect value={condition.id} values={Object.keys(game.initialState.flags)} onChange={id => update(index, { ...condition, id })} />
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={condition.equals ?? true} onCheckedChange={equals => update(index, { ...condition, equals })} />Expected true</label>
      </>}
      {condition.kind === 'item' && <div className="grid grid-cols-[1fr_88px] gap-2">
        <EnumSelect value={condition.id} values={Object.keys(game.items)} onChange={id => update(index, { ...condition, id })} />
        <NumberInput value={condition.amount ?? 1} min={1} onChange={amount => update(index, { ...condition, amount })} />
      </div>}
      {condition.kind === 'quest' && <div className="grid gap-2">
        <EnumSelect value={condition.id} values={Object.keys(game.quests)} onChange={id => update(index, { ...condition, id, state: game.quests[id]?.states[0] || '' })} />
        <EnumSelect value={condition.state} values={game.quests[condition.id]?.states || []} onChange={state => update(index, { ...condition, state })} />
      </div>}
    </div>)}
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange([...value, defaultCondition('flag', game)])}><Plus /> Add condition</Button>
  </div>;
}

function defaultCommand(type: EventCommand['type'], game: SourceGame): EventCommand {
  const flag = Object.keys(game.initialState.flags)[0] || '';
  const item = Object.keys(game.items)[0] || '';
  const quest = Object.keys(game.quests)[0] || '';
  const skill = Object.keys(game.skills)[0] || '';
  const mapId = Object.keys(game.maps)[0] || '';
  if (type === 'dialogue') return { type, speaker: 'Speaker', text: 'Dialogue text', choices: [] };
  if (type === 'setFlag') return { type, id: flag, value: true };
  if (type === 'setQuestState') return { type, id: quest, state: game.quests[quest]?.states[0] || '' };
  if (type === 'giveItem' || type === 'removeItem') return { type, id: item, amount: 1 };
  if (type === 'unlockSkill') return { type, id: skill };
  if (type === 'healPlayer') return { type, amount: 10 };
  if (type === 'toast') return { type, text: 'Notification' };
  if (type === 'teleport') return { type, mapId, position: { x: 0, y: 0, planeId: [...(game.maps[mapId]?.planes || [])].sort((a, b) => a.order - b.order)[0]?.id || '' }, resetMap: true };
  if (type === 'movementRoute') return { type, target: { kind: 'thisEvent' }, route: { commands: [], repeat: false, skippable: false, wait: true } };
  if (type === 'wait') return { type, duration: 0.5 };
  return { type: 'save' };
}

const moveDirections = ['north', 'east', 'south', 'west', 'forward', 'backward', 'random', 'towardPlayer', 'awayFromPlayer', 'left', 'right'] as const;
const turnDirections = ['north', 'east', 'south', 'west', 'left', 'right', 'around', 'random', 'towardPlayer', 'awayFromPlayer'] as const;
function defaultMovementCommand(type: MovementCommand['type']): MovementCommand {
  if (type === 'move') return { type, direction: 'forward' };
  if (type === 'turn') return { type, direction: 'south' };
  if (type === 'jump') return { type, x: 0, y: -1 };
  return { type: 'wait', duration: 0.5 };
}
function MovementCommandsEditor({ value, onChange }: { value: MovementCommand[]; onChange: (value: MovementCommand[]) => void }) {
  const update = (index: number, command: MovementCommand) => onChange(value.map((item, itemIndex) => itemIndex === index ? command : item));
  return <div className="space-y-2">
    {value.map((command, index) => <div key={index} className="space-y-2 border bg-muted/15 p-2">
      <div className="flex items-center justify-between gap-2"><EnumSelect value={command.type} values={['move', 'turn', 'jump', 'wait'] as const} onChange={type => update(index, defaultMovementCommand(type))} /><RowActions index={index} count={value.length} onMove={delta => onChange(move(value, index, delta))} onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} /></div>
      {command.type === 'move' && <EnumSelect value={command.direction} values={moveDirections} onChange={direction => update(index, { ...command, direction })} />}
      {command.type === 'turn' && <EnumSelect value={command.direction} values={turnDirections} onChange={direction => update(index, { ...command, direction })} />}
      {command.type === 'jump' && <div className="grid grid-cols-2 gap-2"><Field label="X offset"><NumberInput value={command.x} onChange={x => update(index, { ...command, x })} /></Field><Field label="Y offset"><NumberInput value={command.y} onChange={y => update(index, { ...command, y })} /></Field></div>}
      {command.type === 'wait' && <Field label="Seconds"><NumberInput value={command.duration} min={0} step={0.1} onChange={duration => update(index, { ...command, duration })} /></Field>}
    </div>)}
    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange([...value, defaultMovementCommand('move')])}><Plus /> Add movement command</Button>
  </div>;
}
function MovementRouteEditor({ value, onChange, showWait = true }: { value: MovementRoute; onChange: (value: MovementRoute) => void; showWait?: boolean }) {
  return <div className="space-y-2">
    <MovementCommandsEditor value={value.commands} onChange={commands => onChange({ ...value, commands })} />
    <div className="grid gap-2">
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={value.repeat} onCheckedChange={repeat => onChange({ ...value, repeat, wait: repeat ? false : value.wait })} />Repeat route</label>
      <label className="flex items-center gap-2 text-xs"><Checkbox checked={value.skippable} onCheckedChange={skippable => onChange({ ...value, skippable })} />Skip if cannot move</label>
      {showWait && <label className="flex items-center gap-2 text-xs"><Checkbox checked={value.wait} disabled={value.repeat} onCheckedChange={wait => onChange({ ...value, wait })} />Wait for completion</label>}
    </div>
  </div>;
}

function CommandFields({ game, mapId, command, onChange, depth }: { game: SourceGame; mapId: string; command: EventCommand; onChange: (command: EventCommand) => void; depth: number }) {
  const action = command;
  if (action.type === 'dialogue') return <div className="space-y-2">
    <Input value={action.speaker} placeholder="Speaker" onChange={event => onChange({ ...action, speaker: event.target.value })} />
    <Textarea value={action.text} placeholder="Dialogue text" onChange={event => onChange({ ...action, text: event.target.value })} />
    <div className="space-y-2 border-l-2 border-primary/25 pl-2">
      {(action.choices || []).map((choice, index) => <div key={index} className="space-y-2 border bg-background p-2">
        <div className="flex gap-2"><Input value={choice.label} placeholder="Choice label" onChange={event => onChange({ ...action, choices: action.choices!.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} /><Button variant="ghost" size="icon-sm" onClick={() => onChange({ ...action, choices: action.choices!.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></div>
        <CommandsEditor game={game} mapId={mapId} value={choice.commands} depth={depth + 1} onChange={commands => onChange({ ...action, choices: action.choices!.map((item, itemIndex) => itemIndex === index ? { ...item, commands } : item) })} />
      </div>)}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...action, choices: [...(action.choices || []), { label: 'Choice', commands: [] }] })}><Plus /> Add choice</Button>
    </div>
  </div>;
  if (action.type === 'setFlag') return <div className="grid gap-2"><EnumSelect value={action.id} values={Object.keys(game.initialState.flags)} onChange={id => onChange({ ...action, id })} /><label className="flex items-center gap-2 text-xs"><Checkbox checked={action.value} onCheckedChange={value => onChange({ ...action, value })} />Set true</label></div>;
  if (action.type === 'setQuestState') return <div className="grid gap-2"><EnumSelect value={action.id} values={Object.keys(game.quests)} onChange={id => onChange({ ...action, id, state: game.quests[id]?.states[0] || '' })} /><EnumSelect value={action.state} values={game.quests[action.id]?.states || []} onChange={state => onChange({ ...action, state })} /></div>;
  if (action.type === 'giveItem' || action.type === 'removeItem') return <div className="grid grid-cols-[1fr_88px] gap-2"><EnumSelect value={action.id} values={Object.keys(game.items)} onChange={id => onChange({ ...action, id })} /><NumberInput value={action.amount ?? 1} min={1} onChange={amount => onChange({ ...action, amount })} /></div>;
  if (action.type === 'unlockSkill') return <EnumSelect value={action.id} values={Object.keys(game.skills)} onChange={id => onChange({ ...action, id })} />;
  if (action.type === 'healPlayer') return <NumberInput value={action.amount} onChange={amount => onChange({ ...action, amount })} />;
  if (action.type === 'toast') return <Textarea value={action.text} onChange={event => onChange({ ...action, text: event.target.value })} />;
  if (action.type === 'teleport') return <div className="space-y-2"><EnumSelect value={action.mapId} values={Object.keys(game.maps)} onChange={mapId => onChange({ ...action, mapId, position: { ...action.position, planeId: [...(game.maps[mapId]?.planes || [])].sort((a, b) => a.order - b.order)[0]?.id || '' } })} /><EnumSelect value={action.position.planeId} values={[...(game.maps[action.mapId]?.planes || [])].sort((a, b) => a.order - b.order).map(plane => plane.id)} labels={Object.fromEntries((game.maps[action.mapId]?.planes || []).map(plane => [plane.id, plane.name]))} onChange={planeId => onChange({ ...action, position: { ...action.position, planeId } })} /><div className="grid grid-cols-2 gap-2"><NumberInput value={action.position.x} step={0.5} onChange={x => onChange({ ...action, position: { ...action.position, x } })} /><NumberInput value={action.position.y} step={0.5} onChange={y => onChange({ ...action, position: { ...action.position, y } })} /></div><label className="flex items-center gap-2 text-xs"><Checkbox checked={action.resetMap} onCheckedChange={resetMap => onChange({ ...action, resetMap })} />Reset map state</label></div>;
  if (action.type === 'movementRoute') {
    const targetValue = action.target.kind === 'event' ? `event:${action.target.eventId}` : action.target.kind;
    const targetValues = ['player', 'thisEvent', ...game.maps[mapId].events.map(event => `event:${event.id}`)] as string[];
    return <div className="space-y-3"><Field label="Target"><EnumSelect value={targetValue} values={targetValues} labels={{ player: 'Player', thisEvent: 'This event' }} onChange={value => onChange({ ...action, target: value === 'player' ? { kind: 'player' } : value === 'thisEvent' ? { kind: 'thisEvent' } : { kind: 'event', eventId: value.slice(6) } })} /></Field><MovementRouteEditor value={action.route} onChange={route => onChange({ ...action, route })} /></div>;
  }
  if (action.type === 'wait') return <Field label="Seconds"><NumberInput value={action.duration} min={0} step={0.1} onChange={duration => onChange({ ...action, duration })} /></Field>;
  return <p className="text-xs text-muted-foreground">No parameters.</p>;
}

function CommandsEditor({ game, mapId, value, onChange, depth = 0 }: { game: SourceGame; mapId: string; value: EventCommand[]; onChange: (value: EventCommand[]) => void; depth?: number }) {
  const update = (index: number, command: EventCommand) => onChange(value.map((item, itemIndex) => itemIndex === index ? command : item));
  return <div className="space-y-2">
    {value.map((command, index) => <div key={index} className="space-y-2 border bg-muted/15 p-2">
      <div className="flex items-center justify-between gap-2"><EnumSelect value={command.type} values={commandTypes} onChange={type => update(index, defaultCommand(type, game))} /><RowActions index={index} count={value.length} onMove={delta => onChange(move(value, index, delta))} onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} /></div>
      <CommandFields game={game} mapId={mapId} command={command} depth={depth} onChange={next => update(index, next)} />
    </div>)}
    <Button variant="outline" size="sm" className="w-full" onClick={() => onChange([...value, defaultCommand('dialogue', game)])}><Plus /> Add command</Button>
  </div>;
}

function defaultPage(): MapEventPage {
  return {
    movement: { type: 'fixed', speed: 3, frequency: 3, route: [] },
    options: { walkingAnimation: true, steppingAnimation: false, directionFix: false, through: false },
    priority: 'sameAsCharacters',
    trigger: { type: 'actionButton', radius: 1 },
    contents: [],
  };
}

export function EventInspector({ game, mapId, event, issues, assetUrls, sprites, onChangeEvent, onSelectPage, onImportSprite }: Props) {
  const [spritePickerOpen, setSpritePickerOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
    onSelectPage?.(0);
  }, [event?.id, onSelectPage]);
  if (!event) return <div className="flex h-full flex-col"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Inspector</h2></div><div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">Select an event on the map or double-click a tile to create one.</div></div>;
  const selectedPageIndex = Math.min(pageIndex, event.pages.length - 1);
  const selectPage = (index: number) => {
    setPageIndex(index);
    onSelectPage?.(index);
  };
  const page = event.pages[selectedPageIndex];
  const updatePage = (nextPage: MapEventPage) => onChangeEvent({ ...event, pages: event.pages.map((item, index) => index === selectedPageIndex ? nextPage : item) });
  const addPage = () => {
    const pages = [...event.pages];
    pages.splice(selectedPageIndex + 1, 0, defaultPage());
    onChangeEvent({ ...event, pages });
    selectPage(selectedPageIndex + 1);
  };
  const deletePage = () => {
    if (event.pages.length === 1) return;
    onChangeEvent({ ...event, pages: event.pages.filter((_, index) => index !== selectedPageIndex) });
    selectPage(Math.max(0, selectedPageIndex - 1));
  };
  const movePage = (delta: number) => {
    const target = selectedPageIndex + delta;
    if (target < 0 || target >= event.pages.length) return;
    onChangeEvent({ ...event, pages: move(event.pages, selectedPageIndex, delta) });
    selectPage(target);
  };
  const updateTriggerType = (type: MapEventPage['trigger']['type']) => updatePage({
    ...page,
    trigger: type === 'actionButton'
      ? { type, radius: 1 }
      : type === 'playerTouch' || type === 'eventTouch'
        ? { type, size: { w: 1, h: 1 } }
        : { type },
  });
  const touchTrigger = page.trigger.type === 'playerTouch' || page.trigger.type === 'eventTouch' ? page.trigger : null;
  return <div className="flex h-full min-h-0 flex-col">
    <div className="shrink-0 border-b bg-background px-3 py-2">
      <div className="mb-2 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-semibold">{event.id}</span><span className="text-[10px] text-muted-foreground">Page 1 has highest priority</span></div>
      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Event pages">
          {event.pages.map((_, index) => <Button key={index} type="button" role="tab" aria-selected={index === selectedPageIndex} variant={index === selectedPageIndex ? 'secondary' : 'ghost'} size="xs" onClick={() => selectPage(index)}>{index + 1}</Button>)}
        </div>
        <Button type="button" variant="ghost" size="icon-xs" disabled={selectedPageIndex === 0} onClick={() => movePage(-1)} aria-label="Move page earlier"><ArrowUp /></Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={selectedPageIndex === event.pages.length - 1} onClick={() => movePage(1)} aria-label="Move page later"><ArrowDown /></Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={addPage} aria-label="Add event page"><Plus /></Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={event.pages.length === 1} onClick={deletePage} aria-label="Delete event page"><Trash2 /></Button>
      </div>
    </div>
    <ScrollArea className="min-h-0 flex-1"><div className="pb-8">
      {issues.length > 0 && <div className="mx-4 mt-4 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{issues.slice(0, 5).map(issue => <p key={`${issue.path}:${issue.message}`}>{issue.path}: {issue.message}</p>)}</div>}
      <Section first title="Conditions"><ConditionsEditor game={game} value={page.conditions || []} onChange={conditions => updatePage({ ...page, conditions: conditions.length ? conditions : undefined })} /></Section>
      <Section title="Autonomous Movement">
        <Field label="Type"><EnumSelect value={page.movement.type} values={['fixed', 'random', 'approach', 'custom'] as const} labels={{ fixed: 'Fixed', random: 'Random', approach: 'Approach player', custom: 'Custom route' }} onChange={type => updatePage({ ...page, movement: { ...page.movement, type } })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Speed · ${page.movement.speed}`}><Slider aria-label="Movement speed" value={page.movement.speed} min={1} max={6} step={1} onValueChange={speed => updatePage({ ...page, movement: { ...page.movement, speed: speed as MapEventPage['movement']['speed'] } })} /></Field>
          <Field label={`Frequency · ${page.movement.frequency}`}><Slider aria-label="Movement frequency" value={page.movement.frequency} min={1} max={5} step={1} onValueChange={frequency => updatePage({ ...page, movement: { ...page.movement, frequency: frequency as MapEventPage['movement']['frequency'] } })} /></Field>
        </div>
        {page.movement.type === 'custom' && <Field label="Looping route"><MovementCommandsEditor value={page.movement.route} onChange={route => updatePage({ ...page, movement: { ...page.movement, route } })} /></Field>}
      </Section>
      <Section title="Options">
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.walkingAnimation} onCheckedChange={walkingAnimation => updatePage({ ...page, options: { ...page.options, walkingAnimation } })} />Walking animation</label>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.steppingAnimation} onCheckedChange={steppingAnimation => updatePage({ ...page, options: { ...page.options, steppingAnimation } })} />Stepping animation</label>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.directionFix} onCheckedChange={directionFix => updatePage({ ...page, options: { ...page.options, directionFix } })} />Direction fix</label>
          <label className="flex items-center gap-2 text-xs"><Checkbox checked={page.options.through} onCheckedChange={through => updatePage({ ...page, options: { ...page.options, through } })} />Through</label>
        </div>
        <Field label="Priority"><EnumSelect value={page.priority} values={['belowCharacters', 'sameAsCharacters', 'aboveCharacters'] as const} labels={{ belowCharacters: 'Below characters', sameAsCharacters: 'Same as characters', aboveCharacters: 'Above characters' }} onChange={priority => updatePage({ ...page, priority })} /></Field>
      </Section>
      <Section title="Trigger"><EnumSelect value={page.trigger.type} values={['actionButton', 'playerTouch', 'eventTouch', 'autorun', 'parallel'] as const} labels={{ actionButton: 'Action Button', playerTouch: 'Player Touch', eventTouch: 'Event Touch', autorun: 'Autorun', parallel: 'Parallel' }} onChange={updateTriggerType} />
        {page.trigger.type === 'actionButton' && <Field label="Radius"><NumberInput value={page.trigger.radius} min={0.25} step={0.25} onChange={radius => updatePage({ ...page, trigger: { type: 'actionButton', radius } })} /></Field>}
        {touchTrigger && <div className="grid grid-cols-2 gap-2"><Field label="Width"><NumberInput value={touchTrigger.size.w} min={0.5} step={0.5} onChange={w => updatePage({ ...page, trigger: { ...touchTrigger, size: { ...touchTrigger.size, w } } })} /></Field><Field label="Height"><NumberInput value={touchTrigger.size.h} min={0.5} step={0.5} onChange={h => updatePage({ ...page, trigger: { ...touchTrigger, size: { ...touchTrigger.size, h } } })} /></Field></div>}
      </Section>
      <Section title="Sprite">
        <button type="button" className="flex w-full items-center gap-3 border bg-muted/10 p-3 text-left hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSpritePickerOpen(true)}>
          {page.sprite
            ? <SpritePreview sprite={page.sprite} imageUrl={assetUrls[page.sprite.image] || sprites.find(sprite => sprite.imagePath === page.sprite?.image)?.url} characterRows={sprites.find(sprite => sprite.imagePath === page.sprite?.image)?.layout.characterRows} className="size-20 shrink-0 border bg-background" />
            : <span className="grid size-20 shrink-0 place-items-center border bg-background text-xs text-muted-foreground">No sprite</span>}
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{page.sprite ? sprites.find(sprite => sprite.imagePath === page.sprite?.image)?.name || page.sprite.image : 'Choose a sprite'}</span><span className="mt-1 block text-xs text-muted-foreground">Click to browse the sprite library.</span></span>
        </button>
        {page.sprite && <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => updatePage({ ...page, sprite: undefined })}>Remove sprite</Button>}
        <EventSpritePicker open={spritePickerOpen} onOpenChange={setSpritePickerOpen} sprites={sprites} selected={page.sprite} onSelect={async (asset, characterIndex) => {
          await onImportSprite(asset);
          updatePage({ ...page, sprite: spriteReference(asset, characterIndex) });
        }} />
      </Section>
      <Section title="Contents"><CommandsEditor game={game} mapId={mapId} value={page.contents} onChange={contents => updatePage({ ...page, contents })} /></Section>
    </div></ScrollArea>
  </div>;
}
