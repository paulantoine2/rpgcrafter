import { describe, expect, it } from 'vitest';
import { CommonEventRuntime, MAX_COMMON_EVENT_CALL_DEPTH, commonEventCallDepthWarning } from '../src/common-event-runtime';

const commonEvents = {
  intro: { name: 'Intro', trigger: { type: 'autorun' as const, switchId: 'start' }, contents: [] },
  ambience: { name: 'Ambience', trigger: { type: 'parallel' as const, switchId: 'start' }, contents: [] },
  manual: { name: 'Manual', trigger: { type: 'none' as const }, contents: [] },
};

describe('CommonEventRuntime', () => {
  it('allows recursive calls through depth 32 and reports the complete overflowing chain', () => {
    const allowedStack = Array.from({ length: MAX_COMMON_EVENT_CALL_DEPTH - 1 }, () => 'loop');
    expect(commonEventCallDepthWarning(allowedStack, 'loop')).toBeNull();
    const fullStack = [...allowedStack, 'loop'];
    const warning = commonEventCallDepthWarning(fullStack, 'final');
    expect(warning).toContain('exceeded (32)');
    expect(warning).toContain(`${fullStack.join(' -> ')} -> final`);
  });

  it('queues one activation per false-to-true switch edge', () => {
    const runtime = new CommonEventRuntime(commonEvents);
    runtime.notifySwitchChange('start', true, true);
    runtime.notifySwitchChange('start', false, false);
    expect(runtime.takeReady(true)).toEqual([]);

    runtime.notifySwitchChange('start', false, true);
    expect(runtime.takeReady(true).map(item => [item.commonEventId, item.mode])).toEqual([
      ['intro', 'autorun'],
      ['ambience', 'parallel'],
    ]);
    expect(runtime.takeReady(true)).toEqual([]);
  });

  it('starts parallel work while retaining autorun activations in FIFO order', () => {
    const runtime = new CommonEventRuntime(commonEvents);
    runtime.notifySwitchChange('start', false, true);
    runtime.notifySwitchChange('start', false, true);

    expect(runtime.takeReady(false).map(item => item.commonEventId)).toEqual(['ambience', 'ambience']);
    expect(runtime.takeReady(true).map(item => item.commonEventId)).toEqual(['intro']);
    expect(runtime.takeReady(true).map(item => item.commonEventId)).toEqual(['intro']);
  });
});
