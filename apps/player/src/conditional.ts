import type { ConditionState } from './conditions.js';
import { conditionsMet } from './conditions.js';
import type { EventCommand } from './types.js';

export function conditionalCommands(command: Extract<EventCommand, { type: 'conditional' }>, state: ConditionState) {
  return conditionsMet([command.condition], state) ? command.thenCommands : command.elseCommands || [];
}
