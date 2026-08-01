import type { Condition } from './types.js';

export type ConditionState = {
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  inventory: Record<string, number>;
};

export function conditionsMet(conditions: Condition[] = [], state: ConditionState) {
  return conditions.every(condition => {
    if (condition.kind === 'switch') return state.switches[condition.id] === (condition.equals ?? true);
    if (condition.kind === 'item') return (state.inventory[condition.id] || 0) >= (condition.amount || 1);
    const value = state.variables[condition.id];
    if (condition.operator === 'equal') return value === condition.value;
    if (condition.operator === 'notEqual') return value !== condition.value;
    if (condition.operator === 'greaterThan') return value > condition.value;
    if (condition.operator === 'greaterThanOrEqual') return value >= condition.value;
    if (condition.operator === 'lessThan') return value < condition.value;
    return value <= condition.value;
  });
}
