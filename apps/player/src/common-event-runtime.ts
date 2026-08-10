import type { CommonEvent } from './types.js';

export type CommonEventActivation = {
  sequence: number;
  commonEventId: string;
  mode: 'autorun' | 'parallel';
};

export const MAX_COMMON_EVENT_CALL_DEPTH = 32;

export function commonEventCallDepthWarning(callStack: string[], nextId: string) {
  return callStack.length < MAX_COMMON_EVENT_CALL_DEPTH
    ? null
    : `Common event call depth exceeded (${MAX_COMMON_EVENT_CALL_DEPTH}): ${[...callStack, nextId].join(' -> ')}`;
}

/** Edge-triggered scheduler for global common events. */
export class CommonEventRuntime {
  private sequence = 0;
  private queue: CommonEventActivation[] = [];

  constructor(private readonly commonEvents: Record<string, CommonEvent>) {}

  notifySwitchChange(switchId: string, previous: boolean, next: boolean) {
    if (previous || !next) return;
    for (const [commonEventId, commonEvent] of Object.entries(this.commonEvents)) {
      if (commonEvent.trigger.type !== 'none' && commonEvent.trigger.switchId === switchId) {
        this.queue.push({ sequence: this.sequence++, commonEventId, mode: commonEvent.trigger.type });
      }
    }
  }

  takeReady(canStartAutorun: boolean) {
    const ready: CommonEventActivation[] = [];
    const remaining: CommonEventActivation[] = [];
    let autorunTaken = false;
    for (const activation of this.queue) {
      if (activation.mode === 'parallel') ready.push(activation);
      else if (canStartAutorun && !autorunTaken) {
        ready.push(activation);
        autorunTaken = true;
      } else remaining.push(activation);
    }
    this.queue = remaining;
    return ready.sort((left, right) => left.sequence - right.sequence);
  }
}
