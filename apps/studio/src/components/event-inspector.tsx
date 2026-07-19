import type { ReactNode } from 'react';
import type { Action, Condition, ContentIssue, EventPage, GameEvent, MapEvent, SourceGame } from '@rpgcrafter/game-schema';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  game: SourceGame;
  mapId: string;
  event: MapEvent | null;
  issues: ContentIssue[];
  onSelectEvent: (id: string) => void;
  onChangeEvent: (event: MapEvent) => void;
  onChangeScript: (scriptId: string, script: GameEvent) => void;
};

const actionTypes: Action['type'][] = ['dialogue', 'setFlag', 'setQuestState', 'giveItem', 'removeItem', 'unlockSkill', 'healPlayer', 'toast', 'teleport', 'save'];
const conditionKinds: Condition['kind'][] = ['flag', 'item', 'quest'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 py-4"><h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>{children}</section>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="grid gap-1.5"><Label className="text-xs">{label}</Label>{children}{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>;
}

function NumberInput({ value, onChange, min, step = 1 }: { value: number; onChange: (value: number) => void; min?: number; step?: number }) {
  return <Input type="number" value={Number.isFinite(value) ? value : 0} min={min} step={step} onChange={event => onChange(Number(event.target.value))} />;
}

function EnumSelect<T extends string>({ value, values, onChange, labels }: { value: T; values: readonly T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <Select value={value} onValueChange={next => onChange(next as T)}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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

function defaultAction(type: Action['type'], game: SourceGame): Action {
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
  return { type: 'save' };
}

function ActionFields({ game, action, onChange, depth }: { game: SourceGame; action: Action; onChange: (action: Action) => void; depth: number }) {
  if (action.type === 'dialogue') return <div className="space-y-2">
    <Input value={action.speaker} placeholder="Speaker" onChange={event => onChange({ ...action, speaker: event.target.value })} />
    <Textarea value={action.text} placeholder="Dialogue text" onChange={event => onChange({ ...action, text: event.target.value })} />
    <div className="space-y-2 border-l-2 border-primary/25 pl-2">
      {(action.choices || []).map((choice, index) => <div key={index} className="space-y-2 border bg-background p-2">
        <div className="flex gap-2"><Input value={choice.label} placeholder="Choice label" onChange={event => onChange({ ...action, choices: action.choices!.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} /><Button variant="ghost" size="icon-sm" onClick={() => onChange({ ...action, choices: action.choices!.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></div>
        <ActionsEditor game={game} value={choice.actions} depth={depth + 1} onChange={actions => onChange({ ...action, choices: action.choices!.map((item, itemIndex) => itemIndex === index ? { ...item, actions } : item) })} />
      </div>)}
      <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...action, choices: [...(action.choices || []), { label: 'Choice', actions: [] }] })}><Plus /> Add choice</Button>
    </div>
  </div>;
  if (action.type === 'setFlag') return <div className="grid gap-2"><EnumSelect value={action.id} values={Object.keys(game.initialState.flags)} onChange={id => onChange({ ...action, id })} /><label className="flex items-center gap-2 text-xs"><Checkbox checked={action.value} onCheckedChange={value => onChange({ ...action, value })} />Set true</label></div>;
  if (action.type === 'setQuestState') return <div className="grid gap-2"><EnumSelect value={action.id} values={Object.keys(game.quests)} onChange={id => onChange({ ...action, id, state: game.quests[id]?.states[0] || '' })} /><EnumSelect value={action.state} values={game.quests[action.id]?.states || []} onChange={state => onChange({ ...action, state })} /></div>;
  if (action.type === 'giveItem' || action.type === 'removeItem') return <div className="grid grid-cols-[1fr_88px] gap-2"><EnumSelect value={action.id} values={Object.keys(game.items)} onChange={id => onChange({ ...action, id })} /><NumberInput value={action.amount ?? 1} min={1} onChange={amount => onChange({ ...action, amount })} /></div>;
  if (action.type === 'unlockSkill') return <EnumSelect value={action.id} values={Object.keys(game.skills)} onChange={id => onChange({ ...action, id })} />;
  if (action.type === 'healPlayer') return <NumberInput value={action.amount} onChange={amount => onChange({ ...action, amount })} />;
  if (action.type === 'toast') return <Textarea value={action.text} onChange={event => onChange({ ...action, text: event.target.value })} />;
  if (action.type === 'teleport') return <div className="space-y-2"><EnumSelect value={action.mapId} values={Object.keys(game.maps)} onChange={mapId => onChange({ ...action, mapId, position: { ...action.position, planeId: [...(game.maps[mapId]?.planes || [])].sort((a, b) => a.order - b.order)[0]?.id || '' } })} /><EnumSelect value={action.position.planeId} values={[...(game.maps[action.mapId]?.planes || [])].sort((a, b) => a.order - b.order).map(plane => plane.id)} labels={Object.fromEntries((game.maps[action.mapId]?.planes || []).map(plane => [plane.id, plane.name]))} onChange={planeId => onChange({ ...action, position: { ...action.position, planeId } })} /><div className="grid grid-cols-2 gap-2"><NumberInput value={action.position.x} step={0.5} onChange={x => onChange({ ...action, position: { ...action.position, x } })} /><NumberInput value={action.position.y} step={0.5} onChange={y => onChange({ ...action, position: { ...action.position, y } })} /></div><label className="flex items-center gap-2 text-xs"><Checkbox checked={action.resetMap} onCheckedChange={resetMap => onChange({ ...action, resetMap })} />Reset map state</label></div>;
  return <p className="text-xs text-muted-foreground">No parameters.</p>;
}

function ActionsEditor({ game, value, onChange, depth = 0 }: { game: SourceGame; value: Action[]; onChange: (value: Action[]) => void; depth?: number }) {
  const update = (index: number, action: Action) => onChange(value.map((item, itemIndex) => itemIndex === index ? action : item));
  return <div className="space-y-2">
    {value.map((action, index) => <div key={index} className="space-y-2 border bg-muted/15 p-2">
      <div className="flex items-center justify-between gap-2"><EnumSelect value={action.type} values={actionTypes} onChange={type => update(index, defaultAction(type, game))} /><RowActions index={index} count={value.length} onMove={delta => onChange(move(value, index, delta))} onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} /></div>
      <ActionFields game={game} action={action} depth={depth} onChange={next => update(index, next)} />
    </div>)}
    <Button variant="outline" size="sm" className="w-full" onClick={() => onChange([...value, defaultAction('dialogue', game)])}><Plus /> Add action</Button>
  </div>;
}

function PagesEditor({ game, script, onChange }: { game: SourceGame; script: GameEvent; onChange: (script: GameEvent) => void }) {
  const update = (index: number, page: EventPage) => onChange({ ...script, pages: script.pages.map((item, itemIndex) => itemIndex === index ? page : item) });
  return <div className="space-y-3">
    {script.pages.map((page, index) => <div key={index} className="space-y-3 border bg-muted/10 p-3">
      <div className="flex items-center justify-between"><Badge variant="outline">Page {index + 1}</Badge><RowActions index={index} count={script.pages.length} removeDisabled={script.pages.length === 1} onMove={delta => onChange({ ...script, pages: move(script.pages, index, delta) })} onRemove={() => onChange({ ...script, pages: script.pages.filter((_, itemIndex) => itemIndex !== index) })} /></div>
      <Field label="Conditions"><ConditionsEditor game={game} value={page.conditions || []} onChange={conditions => update(index, { ...page, conditions: conditions.length ? conditions : undefined })} /></Field>
      <Field label="Actions"><ActionsEditor game={game} value={page.actions} onChange={actions => update(index, { ...page, actions })} /></Field>
    </div>)}
    <Button variant="outline" size="sm" className="w-full" onClick={() => onChange({ ...script, pages: [...script.pages, { actions: [] }] })}><Plus /> Add page</Button>
  </div>;
}

export function EventInspector({ game, mapId, event, issues, onSelectEvent, onChangeEvent, onChangeScript }: Props) {
  const map = game.maps[mapId];
  if (!event) return <div className="flex h-full flex-col"><div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Inspector</h2></div><div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">Select an event on the map or double-click a tile to create one.</div></div>;
  const script = game.events.events[event.scriptId];
  const detailedVisual = event.visual && event.visual.type !== 'exit' ? event.visual : null;
  const updateDetailedVisual = (patch: Partial<NonNullable<typeof detailedVisual>>) => {
    if (detailedVisual) onChangeEvent({ ...event, visual: { ...detailedVisual, ...patch } });
  };
  const updateVisualType = (type: 'none' | 'exit' | 'npc' | 'chest' | 'door') => onChangeEvent({ ...event, visual: type === 'none' ? undefined : type === 'exit' ? { type } : { type, name: event.id, color: '#67e8f9', radius: 18 } });
  const updateTriggerType = (type: MapEvent['trigger']['type']) => onChangeEvent({ ...event, trigger: type === 'playerEnter' ? { type, size: { w: 1, h: 1 } } : type === 'interact' ? { type, radius: 1 } : type === 'interval' ? { type, every: 1 } : { type, delay: 0 } });
  return <div className="flex h-full min-h-0 flex-col">
    <div className="space-y-2 border-b px-4 py-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Event Editor</h2><Badge variant={issues.length ? 'destructive' : 'secondary'}>{issues.length ? 'Issues' : 'Valid'}</Badge></div><EnumSelect value={event.id} values={map.events.map(item => item.id)} onChange={onSelectEvent} /></div>
    <ScrollArea className="min-h-0 flex-1"><div className="px-4 pb-8">
      {issues.length > 0 && <div className="mt-4 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{issues.slice(0, 5).map(issue => <p key={`${issue.path}:${issue.message}`}>{issue.path}: {issue.message}</p>)}</div>}
      <Section title="General"><Field label="Event ID" hint="Placement identifiers are immutable in Studio V1."><Input value={event.id} readOnly /></Field><Field label="Linked script"><EnumSelect value={event.scriptId} values={Object.keys(game.events.events)} onChange={scriptId => onChangeEvent({ ...event, scriptId })} /></Field></Section>
      <Separator />
      <Section title="Position"><Field label="Plane"><EnumSelect value={event.position.planeId} values={[...map.planes].sort((a, b) => a.order - b.order).map(plane => plane.id)} labels={Object.fromEntries(map.planes.map(plane => [plane.id, plane.name]))} onChange={planeId => onChangeEvent({ ...event, position: { ...event.position, planeId } })} /></Field><div className="grid grid-cols-2 gap-2"><Field label="X (tiles)"><NumberInput value={event.position.x} step={0.5} onChange={x => onChangeEvent({ ...event, position: { ...event.position, x } })} /></Field><Field label="Y (tiles)"><NumberInput value={event.position.y} step={0.5} onChange={y => onChangeEvent({ ...event, position: { ...event.position, y } })} /></Field></div></Section>
      <Separator />
      <Section title="Trigger"><EnumSelect value={event.trigger.type} values={['playerEnter', 'interact', 'interval', 'mapEnter'] as const} onChange={updateTriggerType} />
        {event.trigger.type === 'playerEnter' && <div className="grid grid-cols-2 gap-2"><Field label="Width"><NumberInput value={event.trigger.size.w} min={0.5} step={0.5} onChange={w => onChangeEvent({ ...event, trigger: { ...event.trigger as Extract<MapEvent['trigger'], { type: 'playerEnter' }>, size: { ...(event.trigger as Extract<MapEvent['trigger'], { type: 'playerEnter' }>).size, w } } })} /></Field><Field label="Height"><NumberInput value={event.trigger.size.h} min={0.5} step={0.5} onChange={h => onChangeEvent({ ...event, trigger: { ...event.trigger as Extract<MapEvent['trigger'], { type: 'playerEnter' }>, size: { ...(event.trigger as Extract<MapEvent['trigger'], { type: 'playerEnter' }>).size, h } } })} /></Field></div>}
        {event.trigger.type === 'interact' && <Field label="Radius"><NumberInput value={event.trigger.radius} min={0.25} step={0.25} onChange={radius => onChangeEvent({ ...event, trigger: { type: 'interact', radius } })} /></Field>}
        {event.trigger.type === 'interval' && <div className="grid grid-cols-2 gap-2"><Field label="Every (seconds)"><NumberInput value={event.trigger.every} min={0.1} step={0.1} onChange={every => onChangeEvent({ ...event, trigger: { ...event.trigger as Extract<MapEvent['trigger'], { type: 'interval' }>, every } })} /></Field><Field label="Initial delay"><NumberInput value={event.trigger.initialDelay ?? 0} min={0} step={0.1} onChange={initialDelay => onChangeEvent({ ...event, trigger: { ...event.trigger as Extract<MapEvent['trigger'], { type: 'interval' }>, initialDelay } })} /></Field></div>}
        {event.trigger.type === 'mapEnter' && <Field label="Delay (seconds)"><NumberInput value={event.trigger.delay} min={0} step={0.1} onChange={delay => onChangeEvent({ ...event, trigger: { type: 'mapEnter', delay } })} /></Field>}
      </Section>
      <Separator />
      <Section title="Execution"><Field label="Mode"><EnumSelect value={event.execution.mode} values={['repeat', 'oncePerVisit', 'oncePerGame'] as const} onChange={mode => onChangeEvent({ ...event, execution: { ...event.execution, mode } })} /></Field><Field label="Cooldown (seconds)"><NumberInput value={event.execution.cooldown ?? 0} min={0} step={0.1} onChange={cooldown => onChangeEvent({ ...event, execution: { ...event.execution, cooldown } })} /></Field></Section>
      <Separator />
      <Section title="Activation Conditions"><ConditionsEditor game={game} value={event.activeWhen || []} onChange={activeWhen => onChangeEvent({ ...event, activeWhen: activeWhen.length ? activeWhen : undefined })} /></Section>
      <Separator />
      <Section title="Visual"><Field label="Type"><EnumSelect value={event.visual?.type || 'none'} values={['none', 'exit', 'npc', 'chest', 'door'] as const} onChange={updateVisualType} /></Field>{detailedVisual && <><Field label="Name"><Input value={detailedVisual.name} onChange={input => updateDetailedVisual({ name: input.target.value })} /></Field><div className="grid grid-cols-[1fr_90px] gap-2"><Field label="Color"><Input value={detailedVisual.color} onChange={input => updateDetailedVisual({ color: input.target.value })} /></Field><Field label="Radius"><NumberInput value={detailedVisual.radius} min={1} onChange={radius => updateDetailedVisual({ radius })} /></Field></div></>}</Section>
      <Separator />
      <Section title="Linked Script"><div className="text-xs"><code>{event.scriptId}</code></div></Section>
      <Separator />
      <Section title="Script Pages, Conditions & Actions">{script ? <PagesEditor game={game} script={script} onChange={next => onChangeScript(event.scriptId, next)} /> : <p className="text-xs text-destructive">The linked script does not exist.</p>}</Section>
    </div></ScrollArea>
  </div>;
}
