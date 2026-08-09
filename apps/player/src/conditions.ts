import type { Condition } from './types.js';
import { resolveSwitchOperand, resolveVariableOperand, type StateOperandContext } from './state-commands.js';

export type ConditionState = StateOperandContext;

export function conditionsMet(conditions: Condition[] = [], state: ConditionState) {
  return conditions.every(condition => {
    if (condition.kind === 'switch') {
      const operand = resolveSwitchOperand(condition.operand, state);
      return operand !== undefined && state.switches[condition.id] === operand;
    }
    if (condition.kind === 'item') return (state.inventory[condition.id] || 0) >= (condition.amount || 1);
    const value = state.variables[condition.id];
    const operand = resolveVariableOperand(condition.operand, state);
    if (operand === undefined) return false;
    if (condition.operator === 'equal') return value === operand;
    if (condition.operator === 'notEqual') return value !== operand;
    if (condition.operator === 'greaterThan') return value > operand;
    if (condition.operator === 'greaterThanOrEqual') return value >= operand;
    if (condition.operator === 'lessThan') return value < operand;
    return value <= operand;
  });
}
