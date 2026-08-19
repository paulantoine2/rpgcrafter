import type { Condition, EventCommand, SourceGame, SwitchOperand, VariableOperand } from '@rpgcrafter/game-schema';

export type DatabaseEntryKind = 'item' | 'skill' | 'enemy' | 'troop' | 'switch' | 'variable' | 'equipmentType' | 'commonEvent';
export type DatabaseReference = { path: string; label: string };

export function findDatabaseReferences(game: SourceGame, kind: DatabaseEntryKind, id: number): DatabaseReference[] {
  const references: DatabaseReference[] = [];
  const add = (path: string, label: string) => references.push({ path, label });

  if (kind === 'enemy') {
    for (const [troopId, troop] of Object.entries(game.troops)) troop.members.forEach((member, index) => { if (member.enemyId === id) add(`troops.${troopId}.members[${index}].enemyId`, troop.name); });
    return references;
  }
  if (kind === 'troop') {
    for (const [mapId, map] of Object.entries(game.maps)) map.encounters?.entries.forEach((entry, index) => { if (entry.troopId === id) add(`maps.${mapId}.encounters.entries[${index}]`, map.name); });
  }

  if (kind === 'equipmentType') {
    const typeId = id;
    for (const [itemId, item] of Object.entries(game.items)) if (item.equipmentTypeId === typeId) add(`items.${itemId}.equipmentTypeId`, item.name);
    if (id in (game.initialState.equipment || {})) add(`initialState.equipment.${id}`, `Initial equipment type ${id}`);
    return references;
  }

  const visitSwitchOperand = (operand: SwitchOperand, path: string, label: string) => {
    if (kind === 'switch' && operand.kind === 'switch' && operand.switchId === id) add(path, label);
    if (operand.kind !== 'gameData') return;
    if (kind === 'item' && (operand.data.kind === 'hasItem' || operand.data.kind === 'itemEquipped') && operand.data.itemId === id) add(path, label);
    if (kind === 'skill' && operand.data.kind === 'skillUnlocked' && operand.data.skillId === id) add(path, label);
  };
  const visitVariableOperand = (operand: VariableOperand, path: string, label: string) => {
    if (kind === 'variable' && operand.kind === 'variable' && operand.variableId === id) add(path, label);
    if (kind === 'item' && operand.kind === 'gameData' && operand.data.kind === 'itemAmount' && operand.data.itemId === id) add(path, label);
  };
  const visitCondition = (condition: Condition, path: string, label: string) => {
    if (kind === 'item' && condition.kind === 'item' && condition.id === id) add(path, label);
    if (kind === 'switch' && condition.kind === 'switch' && condition.id === id) add(path, label);
    if (kind === 'variable' && condition.kind === 'variable' && condition.id === id) add(path, label);
    if (condition.kind === 'switch') visitSwitchOperand(condition.operand, `${path}.operand`, label);
    if (condition.kind === 'variable') visitVariableOperand(condition.operand, `${path}.operand`, label);
  };
  const visitCommands = (commands: EventCommand[], path: string, label: string) => commands.forEach((command, index) => {
    const commandPath = `${path}[${index}]`;
    if (kind === 'item' && (command.type === 'giveItem' || command.type === 'removeItem') && command.id === id) add(commandPath, label);
    if (kind === 'skill' && command.type === 'unlockSkill' && command.id === id) add(commandPath, label);
    if (kind === 'switch' && command.type === 'setSwitch' && command.id === id) add(commandPath, label);
    if (kind === 'variable' && command.type === 'setVariable' && command.id === id) add(commandPath, label);
    if (kind === 'commonEvent' && command.type === 'callCommonEvent' && command.id === id) add(commandPath, label);
    if (kind === 'troop' && command.type === 'battle' && command.troopId === id) add(commandPath, label);
    if (command.type === 'setSwitch' && command.operation === 'set') visitSwitchOperand(command.operand, `${commandPath}.operand`, label);
    if (command.type === 'setVariable') visitVariableOperand(command.operand, `${commandPath}.operand`, label);
    if (command.type === 'conditional') {
      visitCondition(command.condition, `${commandPath}.condition`, label);
      visitCommands(command.thenCommands, `${commandPath}.thenCommands`, label);
      if (command.elseCommands) visitCommands(command.elseCommands, `${commandPath}.elseCommands`, label);
    }
    if (command.type === 'dialogue') command.choices?.forEach((choice, choiceIndex) => visitCommands(choice.commands, `${commandPath}.choices[${choiceIndex}].commands`, label));
    if (kind === 'variable' && command.type === 'teleport') {
      if (command.destination.map.kind === 'variable' && command.destination.map.variableId === id) add(`${commandPath}.destination.map`, label);
      if (command.destination.x.kind === 'variable' && command.destination.x.variableId === id) add(`${commandPath}.destination.x`, label);
      if (command.destination.y.kind === 'variable' && command.destination.y.variableId === id) add(`${commandPath}.destination.y`, label);
    }
  });

  if (kind === 'skill') {
    if (game.actors.player.primaryAttack === id) add('actors.player.primaryAttack', 'Player primary attack');
    for (const [slot, skillId] of Object.entries(game.actors.player.skillSlots)) if (skillId === id) add(`actors.player.skillSlots.${slot}`, `Player skill slot ${slot}`);
    game.actors.player.unlockedSkills.forEach((skillId, index) => { if (skillId === id) add(`actors.player.unlockedSkills[${index}]`, 'Player unlocked skills'); });
  } else if (kind === 'item') {
    if (id in (game.initialState.inventory || {})) add(`initialState.inventory.${id}`, 'Initial inventory');
    for (const [slot, itemId] of Object.entries(game.initialState.equipment || {})) if (itemId === id) add(`initialState.equipment.${slot}`, `Initial equipment slot ${slot}`);
  }

  for (const [mapId, map] of Object.entries(game.maps)) {
    map.events.forEach((event, eventIndex) => event.pages.forEach((page, pageIndex) => {
      const label = `${map.name} · ${event.name} · page ${pageIndex + 1}`;
      const pagePath = `maps.${mapId}.events[${eventIndex}].pages[${pageIndex}]`;
      page.conditions?.forEach((condition, index) => visitCondition(condition, `${pagePath}.conditions[${index}]`, label));
      visitCommands(page.contents, `${pagePath}.contents`, label);
    }));
  }
  for (const [enemyId, enemy] of Object.entries(game.enemies)) if (enemy.onDefeated) visitCommands(enemy.onDefeated, `enemies.${enemyId}.onDefeated`, `${enemy.name} · on defeated`);
  for (const [commonEventId, commonEvent] of Object.entries(game.events.commonEvents)) {
    const label = `Common Event · ${commonEvent.name}`;
    if (kind === 'switch' && commonEvent.trigger.type !== 'none' && commonEvent.trigger.switchId === id) add(`events.commonEvents.${commonEventId}.trigger.switchId`, label);
    visitCommands(commonEvent.contents, `events.commonEvents.${commonEventId}.contents`, label);
  }

  return references;
}
