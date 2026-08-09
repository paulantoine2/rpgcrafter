import type { EventCommand, MovementTarget, PlanePosition, SwitchOperand, VariableOperand, VariableOperation } from './types.js';

type SetSwitchCommand = Extract<EventCommand, { type: 'setSwitch' }>;
type SetVariableCommand = Extract<EventCommand, { type: 'setVariable' }>;

export type StateOperandContext = {
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  inventory: Record<string, number>;
  equipment: Record<string, string | null>;
  unlockedSkills: string[];
  player: { hp: number; maxHp: number; level: number; xp: number };
  mapNumericId: number;
  tileSize: number;
  characterPosition: (target: MovementTarget) => PlanePosition | undefined;
  random?: () => number;
};

export function resolveSwitchOperand(operand: SwitchOperand, context: StateOperandContext): boolean | undefined {
  if (operand.kind === 'constant') return operand.value;
  if (operand.kind === 'switch') return context.switches[operand.switchId];
  if (operand.data.kind === 'hasItem') return (context.inventory[operand.data.itemId] || 0) > 0;
  if (operand.data.kind === 'itemEquipped') return Object.values(context.equipment).includes(operand.data.itemId);
  if (operand.data.kind === 'skillUnlocked') return context.unlockedSkills.includes(operand.data.skillId);
  return undefined;
}

export function resolveVariableOperand(operand: VariableOperand, context: StateOperandContext): number | undefined {
  let value: number | undefined;
  if (operand.kind === 'constant') value = operand.value;
  else if (operand.kind === 'variable') value = context.variables[operand.variableId];
  else if (operand.kind === 'random') value = operand.min === operand.max ? operand.min : operand.min + (context.random ?? Math.random)() * (operand.max - operand.min);
  else if (operand.data.kind === 'itemAmount') value = context.inventory[operand.data.itemId] || 0;
  else if (operand.data.kind === 'playerStat') value = context.player[operand.data.stat];
  else if (operand.data.kind === 'mapId') value = context.mapNumericId;
  else if (operand.data.kind === 'characterCoordinate') {
    const position = context.characterPosition(operand.data.target);
    if (position) value = Math.floor(position[operand.data.axis] / context.tileSize);
  }
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function applyVariableOperation(current: number, operation: VariableOperation, operand: number): number | undefined {
  if ((operation === 'divide' || operation === 'modulo') && operand === 0) return undefined;
  const result = operation === 'set' ? operand
    : operation === 'add' ? current + operand
      : operation === 'subtract' ? current - operand
        : operation === 'multiply' ? current * operand
          : operation === 'divide' ? current / operand
            : current % operand;
  return Number.isFinite(result) ? result : undefined;
}

export function resolveSetSwitch(command: SetSwitchCommand, current: boolean, context: StateOperandContext): boolean | undefined {
  return command.operation === 'toggle' ? !current : resolveSwitchOperand(command.operand, context);
}

export function resolveSetVariable(command: SetVariableCommand, current: number, context: StateOperandContext): number | undefined {
  const operand = resolveVariableOperand(command.operand, context);
  return operand === undefined ? undefined : applyVariableOperation(current, command.operation, operand);
}
