import { describe, expect, it } from 'vitest';
import { CommonEventRuntime, MAX_COMMON_EVENT_CALL_DEPTH, commonEventCallDepthWarning } from '../src/common-event-runtime';

const commonEvents = {
  1: { name: 'Intro', trigger: { type: 'autorun' as const, switchId: 1 }, contents: [] },
  2: { name: 'Ambience', trigger: { type: 'parallel' as const, switchId: 1 }, contents: [] },
  3: { name: 'Manual', trigger: { type: 'none' as const }, contents: [] },
};

describe('CommonEventRuntime', () => {
  it('allows recursive calls through depth 32 and reports the complete overflowing chain', () => {
    const allowedStack = Array.from({ length: MAX_COMMON_EVENT_CALL_DEPTH - 1 }, () => 1);
    expect(commonEventCallDepthWarning(allowedStack, 1)).toBeNull();
    const fullStack = [...allowedStack, 1];
    const warning = commonEventCallDepthWarning(fullStack, 2);
    expect(warning).toContain('exceeded (32)');
    expect(warning).toContain(`${fullStack.join(' -> ')} -> 2`);
  });

  it('queues one activation per false-to-true switch edge', () => {
    const runtime = new CommonEventRuntime(commonEvents);
    runtime.notifySwitchChange(1, true, true);
    runtime.notifySwitchChange(1, false, false);
    expect(runtime.takeReady(true)).toEqual([]);

    runtime.notifySwitchChange(1, false, true);
    expect(runtime.takeReady(true).map(item => [item.commonEventId, item.mode])).toEqual([
      [1, 'autorun'],
      [2, 'parallel'],
    ]);
    expect(runtime.takeReady(true)).toEqual([]);
  });

  it('starts parallel work while retaining autorun activations in FIFO order', () => {
    const runtime = new CommonEventRuntime(commonEvents);
    runtime.notifySwitchChange(1, false, true);
    runtime.notifySwitchChange(1, false, true);

    expect(runtime.takeReady(false).map(item => item.commonEventId)).toEqual([2, 2]);
    expect(runtime.takeReady(true).map(item => item.commonEventId)).toEqual([1]);
    expect(runtime.takeReady(true).map(item => item.commonEventId)).toEqual([1]);
  });
});
