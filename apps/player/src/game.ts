import { isStudioPreview, loadGameContent } from './content-loader.js';
import { circleIntersectsBlockedDiagonal } from './circle-collision.js';
import { MapEventRuntime, teleportDisposition, type RuntimeEvent } from './event-runtime.js';
import { EventMovementRuntime } from './event-movement.js';
import { PixiRenderer } from './pixi-renderer.js';
import type { Renderer, RenderState } from './renderer.js';
import { DIRECTION_OFFSETS, eventPageMovement, navigationHasCell, navigationTarget, resolveEventPage } from './types.js';
import type { Condition, Direction, EnemyTemplate, EventCommand, GameMap, LoadedGame, MapEvent, MapEventPage, PlanePosition, Skill, Vec2 } from './types.js';

void (async () => {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) throw new Error('Surface de rendu indisponible.');
  canvas.tabIndex = 0;

  const ui = {
    dialogue: document.querySelector<HTMLElement>('#dialogue')!, speaker: document.querySelector<HTMLElement>('#dialogue-speaker')!, text: document.querySelector<HTMLElement>('#dialogue-text')!, choices: document.querySelector<HTMLElement>('#dialogue-choices')!, toast: document.querySelector<HTMLElement>('#toast')!, objective: document.querySelector<HTMLElement>('#objective')!, mapName: document.querySelector<HTMLElement>('#map-name')!, skillStatus: document.querySelector<HTMLElement>('#skill-status')!, pause: document.querySelector<HTMLElement>('#pause-menu')!, pauseTitle: document.querySelector<HTMLElement>('#pause-title')!, pauseTabs: document.querySelector<HTMLElement>('#pause-tabs')!, pauseContent: document.querySelector<HTMLElement>('#pause-content')!, devGrid: document.querySelector<HTMLButtonElement>('#dev-grid-toggle')!
  };
  const keys = new Set<string>();
  const studioPreview = isStudioPreview();
  const SAVE_SCHEMA = '0.7';
  const VIEW_WIDTH = 960, VIEW_HEIGHT = 540;
  // Keep a small clearance inside one-tile-wide (48 px) passages.
  const PLAYER_RADIUS = 20;
  type ActiveEvent = Pick<MapEvent, 'id' | 'position'> & MapEventPage & { pageIndex: number };
  type CommandProcess = {
    key: string;
    eventId?: string;
    pageIndex?: number;
    commands: EventCommand[];
    index: number;
    waitRemaining: number;
    blocked: boolean;
    parallel: boolean;
    autorun: boolean;
    revision: number;
  };
  let content: LoadedGame, game: any, renderer: Renderer, eventRuntime: MapEventRuntime, movementRuntime: EventMovementRuntime, visitRevision = 0, dialogue: { choices: Array<{ label: string; commands: EventCommand[] }>; choiceIndex: number; process?: CommandProcess } | null = null, paused = false, pauseTabIndex = 0, inventorySelection = 0, lastTime = performance.now(), toastTimer = 0, showTileGrid = false, playerMoving = false, playerAnimationTime = 0;
  const eventProcesses = new Map<string, CommandProcess>();
  let facing = { x: 0, y: 1 };
  const cooldowns: Record<string, number> = {};

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
  const currentMap = (): GameMap => content.maps[game.mapId];
  const currentEnemies = () => game.enemies[game.mapId] || [];
  const saveKey = () => `runtime-v0:${content.manifest.gameId}:${content.manifest.version}`;

  function conditionsMet(conditions: Condition[] = []) {
    return conditions.every(condition => {
      if (condition.kind === 'flag') return game.flags[condition.id] === (condition.equals ?? true);
      if (condition.kind === 'item') return (game.inventory[condition.id] || 0) >= (condition.amount || 1);
      return game.quests[condition.id] === condition.state;
    });
  }
  function freshGame() {
    const mapId = content.manifest.entryPoint.mapId;
    const start = content.player.start;
    return {
      schema: SAVE_SCHEMA, mapId, player: { x: start.x, y: start.y, planeId: start.planeId, hp: content.player.stats.maxHp, maxHp: content.player.stats.maxHp, xp: content.player.stats.xp, level: content.player.stats.level, invuln: 0, dash: 0 },
      flags: structuredClone(content.initialState.flags), quests: structuredClone(content.initialState.quests), inventory: structuredClone(content.initialState.inventory || {}), equipment: structuredClone(content.initialState.equipment || {}), unlockedSkills: [...content.player.unlockedSkills],
      enemies: Object.fromEntries(Object.values(content.maps).map(map => [map.id, map.enemySpawns.map((spawn, index) => makeEnemy(spawn.enemyId, spawn.x, spawn.y, spawn.planeId, index))])), projectiles: [], particles: [], checkpoint: { mapId, spawn: structuredClone(start) }
    };
  }
  function makeEnemy(enemyId: string, x: number, y: number, planeId: string, index = 0) {
    const template: EnemyTemplate = content.enemies[enemyId];
    if (!template) throw new Error(`Ennemi inconnu : ${enemyId}`);
    return { ...template, id: `${enemyId}-${index}-${crypto.randomUUID()}`, enemyId, x, y, planeId, maxHp: template.hp, cooldown: 0, phase: 0, alive: true, charge: 0 };
  }
  function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function isValidSave(saved: unknown) {
    if (!isRecord(saved) || saved.schema !== SAVE_SCHEMA || typeof saved.mapId !== 'string' || !content.maps[saved.mapId]) return false;
    const player = saved.player;
    if (!isRecord(player) || typeof player.planeId !== 'string' || !currentMapPlaneExists(saved.mapId, player.planeId) || !['x', 'y', 'hp', 'maxHp', 'xp', 'level', 'invuln', 'dash'].every(key => typeof player[key] === 'number' && Number.isFinite(player[key]))) return false;
    if (!isRecord(saved.flags) || !isRecord(saved.quests) || !isRecord(saved.inventory) || !isRecord(saved.equipment) || !isRecord(saved.enemies) || !Array.isArray(saved.projectiles) || !Array.isArray(saved.particles) || !Array.isArray(saved.unlockedSkills) || !isRecord(saved.checkpoint)) return false;
    const checkpoint = saved.checkpoint; const spawn = checkpoint.spawn;
    if (typeof checkpoint.mapId !== 'string' || !content.maps[checkpoint.mapId] || !isRecord(spawn) || typeof spawn.planeId !== 'string' || !currentMapPlaneExists(checkpoint.mapId, spawn.planeId) || !['x', 'y'].every(key => typeof spawn[key] === 'number' && Number.isFinite(spawn[key]))) return false;
    if (!Object.values(saved.enemies).every(Array.isArray) || !Object.entries(saved.inventory).every(([itemId, amount]) => Boolean(content.items[itemId]) && typeof amount === 'number' && amount >= 0)) return false;
    return saved.unlockedSkills.every(skillId => typeof skillId === 'string' && Boolean(content.skills[skillId]));
  }
  function currentMapPlaneExists(mapId: string, planeId: string) { return content.maps[mapId]?.planes.some(plane => plane.id === planeId) ?? false; }
  function loadGame() {
    if (studioPreview) return freshGame();
    try { const saved = JSON.parse(localStorage.getItem(saveKey()) || 'null'); if (isValidSave(saved)) return saved; } catch { /* invalid or unavailable storage */ }
    return freshGame();
  }
  function activeEvents(useRuntimePosition = true): ActiveEvent[] {
    return currentMap().events.flatMap(event => {
      const resolved = resolveEventPage(event, conditionsMet);
      if (!resolved) return [];
      const actor = useRuntimePosition ? movementRuntime?.actor(event.id) : undefined;
      return [{
        id: event.id,
        position: actor ? { ...actor.position } : { ...event.position },
        ...resolved.page,
        pageIndex: resolved.index,
      }];
    });
  }
  function movementEvents(events = activeEvents()) {
    return events.map(event => ({ id: event.id, position: event.position, movement: eventPageMovement(event), priority: event.priority, pageIndex: event.pageIndex }));
  }
  function runtimeEvents(events = activeEvents()): RuntimeEvent[] {
    return events.map(event => ({ id: event.id, position: event.position, pageIndex: event.pageIndex, trigger: event.trigger }));
  }
  function initializeEventRuntime() {
    eventProcesses.clear();
    eventRuntime = new MapEventRuntime();
    movementRuntime = new EventMovementRuntime();
    const events = activeEvents(false);
    movementRuntime.beginVisit(currentMap(), game.player, movementEvents(events));
    eventRuntime.beginVisit(currentMap().id, runtimeEvents(events));
    visitRevision += 1;
  }
  function saveSilently() { if (studioPreview) return true; try { localStorage.setItem(saveKey(), JSON.stringify(game)); return true; } catch { return false; } }
  function saveGame() { showToast(saveSilently() ? 'Sauvegarde effectuée' : 'Sauvegarde indisponible'); }
  function resetGame() { try { localStorage.removeItem(saveKey()); } catch { /* the in-memory reset is still safe */ } game = freshGame(); initializeEventRuntime(); closeDialogue(); closePause(); refreshHud(); showToast('Nouvelle partie commencée'); }
  function toggleTileGrid() { showTileGrid = !showTileGrid; ui.devGrid.setAttribute('aria-pressed', String(showTileGrid)); ui.devGrid.textContent = `Grille dev : ${showTileGrid ? 'on' : 'off'}`; }

  function showToast(text: string) { ui.toast.textContent = text; ui.toast.classList.remove('hidden'); toastTimer = 2.5; }
  function openDialogue(speaker: string, text: string, choices: Array<{ label: string; commands: EventCommand[] }> = [], process?: CommandProcess) {
    dialogue = { choices, choiceIndex: 0, process }; ui.speaker.textContent = speaker; ui.text.textContent = text; ui.choices.innerHTML = '';
    choices.forEach((choice, index) => { const button = document.createElement('button'); button.textContent = choice.label; button.addEventListener('click', () => chooseDialogueChoice(index)); ui.choices.append(button); });
    document.querySelector<HTMLElement>('.continue-hint')!.style.display = choices.length ? 'none' : 'block'; ui.dialogue.classList.remove('hidden');
    if (choices.length) queueMicrotask(() => (ui.choices.querySelector('button') as HTMLButtonElement | null)?.focus());
  }
  function closeDialogue() {
    const process = dialogue?.process;
    dialogue = null;
    ui.dialogue.classList.add('hidden');
    if (process && eventProcesses.get(process.key) === process) process.blocked = false;
  }
  function chooseDialogueChoice(index = dialogue?.choiceIndex || 0) {
    const choice = dialogue?.choices[index];
    const process = dialogue?.process;
    if (!choice) return;
    if (process && eventProcesses.get(process.key) === process) process.commands.splice(process.index, 0, ...choice.commands);
    closeDialogue();
  }
  function moveDialogueChoice(delta: number) { if (!dialogue?.choices.length) return; dialogue.choiceIndex = (dialogue.choiceIndex + delta + dialogue.choices.length) % dialogue.choices.length; (ui.choices.children[dialogue.choiceIndex] as HTMLButtonElement | undefined)?.focus(); }
  function startProcess(key: string, commands: EventCommand[], options: { eventId?: string; pageIndex?: number; parallel?: boolean; autorun?: boolean } = {}) {
    if (eventProcesses.has(key)) return false;
    const process: CommandProcess = {
      key,
      eventId: options.eventId,
      pageIndex: options.pageIndex,
      commands: [...commands],
      index: 0,
      waitRemaining: 0,
      blocked: false,
      parallel: options.parallel ?? false,
      autorun: options.autorun ?? false,
      revision: visitRevision,
    };
    eventProcesses.set(key, process);
    advanceProcess(process, 0);
    return true;
  }
  function finishProcess(process: CommandProcess) {
    if (eventProcesses.get(process.key) === process) eventProcesses.delete(process.key);
    refreshHud();
  }
  function advanceProcess(process: CommandProcess, dt: number) {
    if (process.revision !== visitRevision || eventProcesses.get(process.key) !== process) return finishProcess(process);
    if (process.waitRemaining > 0) {
      process.waitRemaining = Math.max(0, process.waitRemaining - dt);
      if (process.waitRemaining > 0) return;
    }
    if (process.blocked) return;
    let steps = 0;
    while (process.index < process.commands.length && steps < 100) {
      steps += 1;
      const command = process.commands[process.index++];
      if (command.type === 'dialogue') {
        process.blocked = true;
        openDialogue(command.speaker, command.text, command.choices || [], process);
        return refreshHud();
      }
      if (command.type === 'setFlag') game.flags[command.id] = command.value;
      if (command.type === 'setQuestState') game.quests[command.id] = command.state;
      if (command.type === 'giveItem') game.inventory[command.id] = (game.inventory[command.id] || 0) + (command.amount || 1);
      if (command.type === 'removeItem') game.inventory[command.id] = Math.max(0, (game.inventory[command.id] || 0) - (command.amount || 1));
      if (command.type === 'unlockSkill' && !game.unlockedSkills.includes(command.id)) game.unlockedSkills.push(command.id);
      if (command.type === 'healPlayer') game.player.hp = Math.min(game.player.maxHp, game.player.hp + command.amount);
      if (command.type === 'toast') showToast(command.text);
      if (command.type === 'wait') {
        process.waitRemaining = command.duration;
        if (command.duration > 0) return refreshHud();
      }
      if (command.type === 'teleport' && teleport(command.mapId, command.position, command.resetMap)) return;
      if (command.type === 'movementRoute') {
        const completion = movementRuntime.forceRoute(command.target, command.route, process.eventId);
        if (command.route.wait) {
          process.blocked = true;
          void completion.then(() => {
            if (eventProcesses.get(process.key) === process) process.blocked = false;
          });
          return refreshHud();
        }
      }
      if (command.type === 'save') saveSilently();
    }
    if (process.index >= process.commands.length) finishProcess(process);
    else refreshHud();
  }
  function updateProcesses(dt: number) {
    for (const process of [...eventProcesses.values()]) advanceProcess(process, dt);
  }
  function executeCommands(commands: EventCommand[], currentEventId?: string) {
    startProcess(`manual:${crypto.randomUUID()}`, commands, { eventId: currentEventId });
  }
  function objective() { return content.objectives.find(item => conditionsMet(item.conditions))?.text || ''; }
  function refreshHud() {
    ui.objective.textContent = objective(); ui.mapName.textContent = currentMap().name;
    const slots = Object.values(content.player.skillSlots).map(id => `${content.skills[id].name} : ${game.unlockedSkills.includes(id) ? 'prête' : 'verrouillée'}`);
    ui.skillStatus.textContent = slots.join(' · ');
  }
  function applyTheme() {
    const root = document.documentElement; const theme = content.ui.theme;
    root.style.setProperty('--ui-font', theme.fontFamily); root.style.setProperty('--ui-page', theme.pageBackground); root.style.setProperty('--ui-panel', theme.panel); root.style.setProperty('--ui-border', theme.panelBorder); root.style.setProperty('--ui-text', theme.text); root.style.setProperty('--ui-accent', theme.accent); root.style.setProperty('--ui-health', theme.health);
  }
  function openPause() { if (dialogue) return; paused = true; ui.pause.classList.remove('hidden'); renderPause(); queueMicrotask(() => (ui.pauseTabs.querySelector('.active') as HTMLButtonElement | null)?.focus()); }
  function closePause() { paused = false; ui.pause.classList.add('hidden'); canvas.focus(); }
  function togglePause() { if (paused) closePause(); else openPause(); }
  function renderPause() {
    const tabs = content.ui.pauseMenu.tabs; const tab = tabs[pauseTabIndex]; ui.pauseTitle.textContent = content.ui.pauseMenu.title;
    ui.pauseTabs.innerHTML = ''; tabs.forEach((item, index) => { const button = document.createElement('button'); const selected = index === pauseTabIndex; button.textContent = item.label; button.className = selected ? 'active' : ''; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'pause-content'); button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; button.addEventListener('click', () => { pauseTabIndex = index; inventorySelection = 0; renderPause(); }); ui.pauseTabs.append(button); });
    if (tab.id === 'character') ui.pauseContent.innerHTML = `<h2>${content.player.name}</h2><p>Niveau ${game.player.level} · ${Math.ceil(game.player.hp)} / ${game.player.maxHp} PV</p><p>Compétences : ${game.unlockedSkills.map((id: string) => content.skills[id].name).join(', ')}</p>`;
    if (tab.id === 'inventory') renderInventory();
    if (tab.id === 'equipment') renderEquipment();
    if (tab.id === 'quests') ui.pauseContent.innerHTML = `<h2>Quêtes</h2><ul class="pause-list">${Object.entries(game.quests).map(([id, state]) => `<li><strong>${content.quests[id]?.name || id}</strong><br><small>${state}</small></li>`).join('')}</ul>`;
    if (tab.id === 'settings') ui.pauseContent.innerHTML = '<h2>Options</h2><p>Les réglages d’accessibilité, audio et affichage seront fournis par le Player.</p>';
  }
  function inventoryEntries() { return Object.entries(game.inventory).filter(([, amount]) => Number(amount) > 0) as Array<[string, number]>; }
  function renderInventory() { const entries = inventoryEntries(); ui.pauseContent.innerHTML = `<h2>Inventaire</h2><ul class="pause-list">${entries.map(([id, amount], index) => { const item = content.items[id]; const hint = item?.type === 'equipment' ? `Entrée : équiper (${item.equipmentSlot})` : item?.type === 'consumable' ? 'Entrée : utiliser' : item?.type || ''; return `<li class="${index === inventorySelection ? 'selected' : ''}"><strong>${item?.name || id}</strong> ×${amount}<br><small>${hint}</small></li>`; }).join('') || '<li>Inventaire vide.</li>'}</ul>`; }
  function renderEquipment() { ui.pauseContent.innerHTML = `<h2>Équipement</h2><ul class="pause-list">${content.ui.equipmentSlots.map(slot => { const id = game.equipment[slot.id]; return `<li><strong>${slot.label}</strong><br><small>${id ? content.items[id]?.name || id : 'Aucun équipement'}</small></li>`; }).join('')}</ul>`; }
  function equipSelectedItem() { const [id] = inventoryEntries()[inventorySelection] || []; const item = content.items[id]; if (!item?.equipmentSlot) return; game.equipment[item.equipmentSlot] = id; saveSilently(); showToast(`${item.name} équipé`); renderPause(); }
  function useSelectedItem() { const [id, amount] = inventoryEntries()[inventorySelection] || []; const item = content.items[id]; if (!item || amount < 1 || item.type !== 'consumable') return; game.inventory[id] -= 1; if (item.healing) game.player.hp = Math.min(game.player.maxHp, game.player.hp + item.healing); saveSilently(); showToast(`${item.name} utilisé`); renderPause(); }
  function activateSelectedItem() { const [id] = inventoryEntries()[inventorySelection] || []; if (content.items[id]?.type === 'equipment') equipSelectedItem(); else useSelectedItem(); }
  function handlePauseKey(event: KeyboardEvent) { const tabs = content.ui.pauseMenu.tabs; if (event.code === 'Escape') return closePause(); if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') { pauseTabIndex = (pauseTabIndex + (event.code === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; inventorySelection = 0; return renderPause(); } if (tabs[pauseTabIndex].id === 'inventory' && (event.code === 'ArrowUp' || event.code === 'ArrowDown')) { const count = inventoryEntries().length || 1; inventorySelection = (inventorySelection + (event.code === 'ArrowDown' ? 1 : -1) + count) % count; return renderPause(); } if (tabs[pauseTabIndex].id === 'inventory' && (event.code === 'Enter' || event.code === 'Space')) activateSelectedItem(); }

  function eventCallbacks(events: ActiveEvent[]) {
    const byId = new Map(events.map(event => [event.id, event]));
    return {
      canExecute: (event: RuntimeEvent) => {
        const active = byId.get(event.id);
        if (!active || active.pageIndex !== event.pageIndex || eventProcesses.has(event.id)) return false;
        return active.trigger.type === 'parallel' || ![...eventProcesses.values()].some(process => !process.parallel);
      },
      execute: (event: RuntimeEvent) => {
        const active = byId.get(event.id);
        if (!active) return;
        const revision = visitRevision;
        if (active.trigger.type === 'actionButton' || active.trigger.type === 'playerTouch' || active.trigger.type === 'eventTouch') movementRuntime.faceToward(event.id, game.player);
        startProcess(event.id, active.contents, {
          eventId: event.id,
          pageIndex: event.pageIndex,
          parallel: active.trigger.type === 'parallel',
          autorun: active.trigger.type === 'autorun',
        });
        return { stop: revision !== visitRevision };
      }
    };
  }
  function interact() {
    const events = activeEvents();
    eventRuntime.interact(currentMap().id, runtimeEvents(events), game.player, eventCallbacks(events));
  }

  function gridCell(position: Vec2) { const size = currentMap().tileSize; return { x: Math.floor(position.x / size), y: Math.floor(position.y / size) }; }
  function circleBlocked(position: PlanePosition, radius: number, ignoredEdge?: Direction) {
    const map = currentMap(), graph = content.navigation[map.id], size = map.tileSize;
    const cell = gridCell(position);
    if (!navigationHasCell(graph, position.planeId, cell.x, cell.y)) return true;
    const distances: Record<Direction, number> = {
      north: position.y - cell.y * size,
      east: (cell.x + 1) * size - position.x,
      south: (cell.y + 1) * size - position.y,
      west: position.x - cell.x * size,
    };
    const touchesBlockedEdge = (Object.entries(distances) as Array<[Direction, number]>).some(([edge, edgeDistance]) => edge !== ignoredEdge && edgeDistance < radius && !navigationTarget(graph, position.planeId, cell.x, cell.y, edge));
    if (touchesBlockedEdge) return true;
    return circleIntersectsBlockedDiagonal(position, radius, size, (x, y) => !navigationHasCell(graph, position.planeId, x, y));
  }
  function moveAxis(entity: PlanePosition, axis: 'x' | 'y', delta: number, radius: number) {
    if (!delta) return;
    const map = currentMap(), graph = content.navigation[map.id];
    const candidate = { x: entity.x, y: entity.y, planeId: entity.planeId };
    candidate[axis] = clamp(candidate[axis] + delta, map.bounds[axis] + radius, map.bounds[axis] + (axis === 'x' ? map.bounds.w : map.bounds.h) - radius);
    const from = gridCell(entity), to = gridCell(candidate);
    let ignoredEdge: Direction | undefined;
    if (from.x !== to.x || from.y !== to.y) {
      const edge: Direction = axis === 'x' ? (delta > 0 ? 'east' : 'west') : (delta > 0 ? 'south' : 'north');
      const target = navigationTarget(graph, entity.planeId, from.x, from.y, edge);
      if (!target || target.x !== to.x || target.y !== to.y) return;
      if (target.planeId !== entity.planeId) ignoredEdge = DIRECTION_OFFSETS[edge].opposite;
      candidate.planeId = target.planeId;
    }
    if (circleBlocked(candidate, radius, ignoredEdge)) return;
    entity[axis] = candidate[axis];
    entity.planeId = candidate.planeId;
  }
  function moveWithCollisions(entity: PlanePosition, dx: number, dy: number, radius = 14) {
    moveAxis(entity, 'x', dx, radius);
    moveAxis(entity, 'y', dy, radius);
  }
  function eventCanMove(actorId: string, from: PlanePosition, to: PlanePosition, through: boolean) {
    if (through) return true;
    const map = currentMap(), graph = content.navigation[map.id], fromCell = gridCell(from), toCell = gridCell(to);
    if (fromCell.x !== toCell.x || fromCell.y !== toCell.y) {
      const edge: Direction = fromCell.x !== toCell.x ? (toCell.x > fromCell.x ? 'east' : 'west') : (toCell.y > fromCell.y ? 'south' : 'north');
      const target = navigationTarget(graph, from.planeId, fromCell.x, fromCell.y, edge);
      if (!target || target.x !== toCell.x || target.y !== toCell.y) return false;
      to.planeId = target.planeId;
    }
    if (circleBlocked(to, 18)) return false;
    const movingActor = movementRuntime.actor(actorId);
    if (actorId !== 'player' && movingActor?.priority === 'sameAsCharacters' && to.planeId === game.player.planeId && distance(to, game.player) < PLAYER_RADIUS + 18) return false;
    for (const other of movementRuntime.eventActors()) {
      if (other.id === actorId || other.settings.through || other.priority !== 'sameAsCharacters' || other.position.planeId !== to.planeId) continue;
      if (distance(to, other.position) < 36) return false;
    }
    return true;
  }
  function movePlayer(dx: number, dy: number, dt: number) {
    const length = Math.hypot(dx, dy);
    if (!length) return false;
    dx /= length; dy /= length; facing = { x: dx, y: dy };
    const previous = { x: game.player.x, y: game.player.y, planeId: game.player.planeId };
    moveWithCollisions(game.player, dx * (game.player.dash > 0 ? 420 : 185) * dt, dy * (game.player.dash > 0 ? 420 : 185) * dt, PLAYER_RADIUS);
    const eventCollision = movementRuntime.eventActors().some(actor => !actor.settings.through && actor.priority === 'sameAsCharacters' && actor.position.planeId === game.player.planeId && distance(actor.position, game.player) < PLAYER_RADIUS + 18);
    if (eventCollision) Object.assign(game.player, previous);
    return previous.x !== game.player.x || previous.y !== game.player.y || previous.planeId !== game.player.planeId;
  }
  function moveEnemy(enemy: any, dx: number, dy: number) { moveWithCollisions(enemy, dx, dy, enemy.radius); }
  function equippedStat(stat: string) { return Object.values(game.equipment).reduce<number>((total, itemId) => { const id = typeof itemId === 'string' ? itemId : ''; return total + (content.items[id]?.stats?.[stat] || 0); }, 0); }
  function effectiveDamage(damage: number) { return Math.max(0, damage + equippedStat('attack')); }
  function usePrimaryAttack() { useSkill(content.player.primaryAttack, 'primary'); }
  function useSlot(slot: string) { const skillId = content.player.skillSlots[slot]; if (skillId) useSkill(skillId, slot); }
  function useSkill(skillId: string, cooldownKey: string) {
    const skill: Skill = content.skills[skillId]; if (!skill || !game.unlockedSkills.includes(skillId) || (cooldowns[cooldownKey] || 0) > 0) return;
    cooldowns[cooldownKey] = skill.cooldown;
    const damage = effectiveDamage(skill.damage);
    if (skill.type === 'melee') {
      const nearby = currentEnemies().filter((enemy: any) => enemy.alive && enemy.planeId === game.player.planeId && distance(enemy, game.player) < (skill.range || 70)); const forward = nearby.filter((enemy: any) => ((enemy.x - game.player.x) * facing.x + (enemy.y - game.player.y) * facing.y) > -12); (forward.length ? forward : nearby.sort((a: any, b: any) => distance(a, game.player) - distance(b, game.player)).slice(0, 1)).forEach((enemy: any) => hurtEnemy(enemy, damage)); game.particles.push({ type: 'slash', x: game.player.x + facing.x * 27, y: game.player.y + facing.y * 27, planeId: game.player.planeId, t: .18 });
    }
    if (skill.type === 'projectile') game.projectiles.push({ from: 'player', x: game.player.x + facing.x * 22, y: game.player.y + facing.y * 22, planeId: game.player.planeId, dx: facing.x * (skill.projectileSpeed || 300), dy: facing.y * (skill.projectileSpeed || 300), r: 7, damage, t: 1.2, color: skill.color || '#ffffff' });
    if (skill.type === 'area') { currentEnemies().filter((enemy: any) => enemy.alive && enemy.planeId === game.player.planeId && distance(enemy, game.player) < (skill.range || 90)).forEach((enemy: any) => hurtEnemy(enemy, damage)); game.particles.push({ type: 'wave', x: game.player.x, y: game.player.y, planeId: game.player.planeId, t: .45, color: skill.color || '#ffffff' }); }
  }
  function dash() { if ((cooldowns.dash || 0) > 0 || game.player.dash > 0) return; game.player.dash = .17; cooldowns.dash = .85; }
  function hurtEnemy(enemy: any, damage: number) { enemy.hp -= damage; game.particles.push({ type: 'hit', x: enemy.x, y: enemy.y, planeId: enemy.planeId, t: .25, text: `-${damage}` }); if (enemy.hp <= 0) killEnemy(enemy); }
  function killEnemy(enemy: any) { enemy.alive = false; game.player.xp += enemy.xp; if (game.player.xp >= game.player.level * 35) { game.player.level += 1; game.player.maxHp += 15; game.player.hp = game.player.maxHp; showToast(`Niveau ${game.player.level} ! PV restaurés`); } game.particles.push({ type: 'burst', x: enemy.x, y: enemy.y, planeId: enemy.planeId, t: .5 }); executeCommands(enemy.onDefeated || []); }
  function hurtPlayer(amount: number) { if (game.player.invuln > 0 || game.player.dash > 0) return; game.player.hp -= Math.max(1, amount - equippedStat('defense')); game.player.invuln = .55; if (game.player.hp <= 0) { game.player.hp = game.player.maxHp; const destination = currentMap().deathDestination || game.checkpoint; teleport(destination.mapId, destination.spawn, true); showToast('Vous reprenez conscience au dernier passage.'); } }
  function teleport(mapId: string, position: PlanePosition, resetMap: boolean) {
    const command = { type: 'teleport' as const, mapId, position, resetMap };
    const disposition = teleportDisposition(game.mapId, command);
    if (!content.maps[mapId] || disposition === 'invalid') return false;
    game.mapId = mapId;
    Object.assign(game.player, position);
    if (disposition === 'local') return false;
    game.projectiles = [];
    game.particles = [];
    game.player.hp = Math.max(game.player.hp, Math.ceil(game.player.maxHp * .6));
    game.checkpoint = { mapId, spawn: structuredClone(position) };
    eventProcesses.clear();
    closeDialogue();
    const events = activeEvents(false);
    movementRuntime.beginVisit(currentMap(), game.player, movementEvents(events));
    eventRuntime.beginVisit(currentMap().id, runtimeEvents(events));
    visitRevision += 1;
    saveSilently();
    refreshHud();
    showToast(currentMap().name);
    return true;
  }

  function update(dt: number) {
    playerMoving = false;
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) ui.toast.classList.add('hidden');
    if (paused || document.hidden) { playerAnimationTime = 0; return; }
    updateProcesses(dt);
    let events = activeEvents();
    const activePages = new Map(events.map(event => [event.id, event.pageIndex]));
    for (const process of [...eventProcesses.values()]) {
      if (process.eventId && process.pageIndex !== undefined && activePages.get(process.eventId) !== process.pageIndex) {
        if (dialogue?.process === process) closeDialogue();
        eventProcesses.delete(process.key);
      }
    }
    movementRuntime.syncEvents(movementEvents(events));
    const playerWasForced = movementRuntime.isPlayerForced();
    movementRuntime.update(dt, game.player, eventCanMove);
    const forcedPlayer = movementRuntime.actor('player');
    if (forcedPlayer && (playerWasForced || movementRuntime.isPlayerForced())) {
      Object.assign(game.player, forcedPlayer.position);
      facing = forcedPlayer.direction === 'north' ? { x: 0, y: -1 } : forcedPlayer.direction === 'east' ? { x: 1, y: 0 } : forcedPlayer.direction === 'west' ? { x: -1, y: 0 } : { x: 0, y: 1 };
      playerMoving = forcedPlayer.moving;
      playerAnimationTime = forcedPlayer.animationTime;
    }
    events = activeEvents();
    eventRuntime.update(currentMap().id, runtimeEvents(events), game.player, eventCallbacks(events), PLAYER_RADIUS);
    if (dialogue || events.some(event => event.trigger.type === 'autorun') || [...eventProcesses.values()].some(process => !process.parallel)) { if (!playerMoving) playerAnimationTime = 0; return; }
    Object.keys(cooldowns).forEach(key => cooldowns[key] = Math.max(0, cooldowns[key] - dt)); game.player.invuln = Math.max(0, game.player.invuln - dt); game.player.dash = Math.max(0, game.player.dash - dt);
    playerMoving = movementRuntime.isPlayerForced() ? playerMoving : movePlayer((keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0), (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0), dt);
    playerAnimationTime = playerMoving ? playerAnimationTime + dt : 0;
    updateProjectiles(dt); updateEnemies(dt); game.particles.forEach((particle: any) => particle.t -= dt); game.particles = game.particles.filter((particle: any) => particle.t > 0);
  }
  function projectileCanContinue(projectile: any, previous: Vec2) {
    const graph = content.navigation[game.mapId], from = gridCell(previous), to = gridCell(projectile);
    if (from.x !== to.x || from.y !== to.y) {
      const edge: Direction = from.x !== to.x ? (to.x > from.x ? 'east' : 'west') : (to.y > from.y ? 'south' : 'north');
      const target = navigationTarget(graph, projectile.planeId, from.x, from.y, edge);
      if (!target || target.planeId !== projectile.planeId || target.x !== to.x || target.y !== to.y) return false;
    }
    return !circleBlocked(projectile, projectile.r);
  }
  function updateProjectiles(dt: number) { for (const projectile of game.projectiles) { const previous = { x: projectile.x, y: projectile.y }; projectile.x += projectile.dx * dt; projectile.y += projectile.dy * dt; projectile.t -= dt; if (!projectileCanContinue(projectile, previous)) { projectile.t = 0; continue; } if (projectile.from === 'player') { const enemy = currentEnemies().find((candidate: any) => candidate.alive && candidate.planeId === projectile.planeId && distance(candidate, projectile) < candidate.radius + projectile.r); if (enemy) { hurtEnemy(enemy, projectile.damage); projectile.t = 0; } } else if (projectile.planeId === game.player.planeId && distance(game.player, projectile) < PLAYER_RADIUS + projectile.r) { hurtPlayer(projectile.damage); projectile.t = 0; } } game.projectiles = game.projectiles.filter((projectile: any) => projectile.t > 0); }
  function updateEnemies(dt: number) {
    for (const enemy of currentEnemies()) {
      if (!enemy.alive) continue; enemy.cooldown = Math.max(0, enemy.cooldown - dt); if (enemy.planeId !== game.player.planeId) continue; const d = distance(enemy, game.player), nx = (game.player.x - enemy.x) / (d || 1), ny = (game.player.y - enemy.y) / (d || 1); const phase = enemy.phases?.find((item: any) => enemy.hp / enemy.maxHp <= item.atHpRatio); enemy.phase = phase ? enemy.phases.indexOf(phase) + 1 : 0; const speed = enemy.speed * (phase?.speedMultiplier || 1);
      if (enemy.behavior === 'ranged' && d < 270) { if (d < 105) moveEnemy(enemy, -nx * speed * dt, -ny * speed * dt); if (enemy.cooldown <= 0) { fireEnemyProjectile(enemy, nx, ny, { cooldown: 1.45, speed: 230, damage: enemy.damage, color: '#d3a3ff' }); } }
      else if (enemy.behavior === 'charge') { if (enemy.charge > 0) { moveEnemy(enemy, enemy.chargeX * 235 * dt, enemy.chargeY * 235 * dt); enemy.charge -= dt; } else if (d < 210 && enemy.cooldown <= 0) { enemy.chargeX = nx; enemy.chargeY = ny; enemy.charge = .42; enemy.cooldown = 1.35; } else if (d < 190) moveEnemy(enemy, nx * speed * dt, ny * speed * dt); }
      else { if (d < 290) moveEnemy(enemy, nx * speed * dt, ny * speed * dt); if (phase?.projectile && enemy.cooldown <= 0 && d < 310) fireEnemyProjectile(enemy, nx, ny, phase.projectile); }
      if (d < enemy.radius + PLAYER_RADIUS && enemy.cooldown <= 0) { hurtPlayer(enemy.damage); enemy.cooldown = .95; }
    }
  }
  function fireEnemyProjectile(enemy: any, nx: number, ny: number, projectile: any) { game.projectiles.push({ from: 'enemy', x: enemy.x, y: enemy.y, planeId: enemy.planeId, dx: nx * projectile.speed, dy: ny * projectile.speed, r: 7, damage: projectile.damage, t: 1.4, color: projectile.color }); enemy.cooldown = projectile.cooldown; }

  function renderState(): RenderState {
    const map = currentMap();
    const camera = {
      x: clamp(game.player.x - VIEW_WIDTH / 2, map.bounds.x, Math.max(map.bounds.x, map.bounds.x + map.bounds.w - VIEW_WIDTH)),
      y: clamp(game.player.y - VIEW_HEIGHT / 2, map.bounds.y, Math.max(map.bounds.y, map.bounds.y + map.bounds.h - VIEW_HEIGHT))
    };
    return {
      map,
      events: activeEvents().map(event => {
        const actor = movementRuntime.actor(event.id);
        const position = actor?.position || event.position;
        return {
          ...event,
          position,
          nearby: position.planeId === game.player.planeId && event.trigger.type === 'actionButton' && distance(game.player, position) <= event.trigger.radius,
          movementDirection: actor?.direction || 'south',
          movementMoving: actor?.moving || false,
          movementAnimationTime: actor?.animationTime || 0,
          jumpHeight: actor?.jumpHeight || 0,
        };
      }),
      enemies: currentEnemies().filter((enemy: any) => enemy.alive),
      projectiles: game.projectiles,
      particles: game.particles,
      camera,
      showTileGrid,
      player: { ...game.player, radius: PLAYER_RADIUS },
      playerMoving,
      playerAnimationTime,
      facing,
      hud: { panel: content.ui.theme.panel, text: content.ui.theme.text, health: content.ui.theme.health, slots: content.ui.hud.slots }
    };
  }
  function draw() { renderer.render(renderState()); }

  function trigger(action: string) { if (dialogue) { if (action === 'previousChoice') moveDialogueChoice(-1); else if (action === 'nextChoice') moveDialogueChoice(1); else if (dialogue.choices.length && ['interact', 'attack'].includes(action)) chooseDialogueChoice(); else if (!dialogue.choices.length && ['interact', 'attack'].includes(action)) closeDialogue(); return; } if (action === 'interact') interact(); if (action === 'attack') usePrimaryAttack(); if (action === 'dash') dash(); if (action === 'skill1' || action === 'skill2') useSlot(action); }
  function frame(time: number) { const dt = Math.min(.034, (time - lastTime) / 1000); lastTime = time; update(dt); draw(); requestAnimationFrame(frame); }
  ui.devGrid.addEventListener('click', toggleTileGrid);
  window.addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'F2'].includes(event.code)) event.preventDefault(); if (event.code === 'F2' && !event.repeat) return toggleTileGrid(); if (paused) { if (!event.repeat) handlePauseKey(event); return; } if (event.code === 'Escape') return openPause(); if ((event.metaKey || event.ctrlKey) && event.code === 'KeyS') { event.preventDefault(); saveGame(); return; } if (event.repeat) return; if (event.code === 'KeyR') { resetGame(); return; } const actions: Record<string, string> = { KeyE: 'interact', Space: 'attack', KeyK: 'dash', KeyL: 'skill1', KeyI: 'skill2', Enter: 'interact', ArrowUp: 'previousChoice', ArrowLeft: 'previousChoice', ArrowDown: 'nextChoice', ArrowRight: 'nextChoice' }; if (actions[event.code] && (dialogue || !['previousChoice', 'nextChoice'].includes(actions[event.code]))) return trigger(actions[event.code]); keys.add(event.code); });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
  try { content = await loadGameContent(); renderer = await PixiRenderer.create(canvas, content.tilesets, content.assetUrls, Object.values(content.maps)); applyTheme(); document.title = `${content.manifest.title}${studioPreview ? ' — Aperçu Studio' : ''}`; document.querySelector('h1')!.textContent = content.manifest.title; game = loadGame(); initializeEventRuntime(); refreshHud(); if (studioPreview) showToast('Aperçu Studio'); requestAnimationFrame(frame); window.addEventListener('pagehide', () => renderer.destroy(), { once: true }); } catch (error) { console.error(error); ui.speaker.textContent = 'Erreur de chargement'; ui.text.textContent = error instanceof Error ? error.message : 'Le package de jeu ne peut pas être chargé.'; ui.choices.innerHTML = ''; document.querySelector<HTMLElement>('.continue-hint')!.style.display = 'none'; ui.dialogue.classList.remove('hidden'); }
})();
