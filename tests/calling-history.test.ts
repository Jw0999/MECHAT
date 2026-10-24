import { describe, it, expect, beforeEach } from 'bun:test';
import { useCallStore } from '@/stores/callStore';
import type { Profile } from '@/types/database.types';

describe('Call History & Calling Screen Guarantees', () => {
  const mockUser: Profile = {
    id: 'test-contact-1',
    username: 'alice',
    display_name: 'Alice Cooper',
    avatar_url: null,
    bio: '',
    online_status: 'online',
    last_seen: '',
    privacy_online: true,
    privacy_last_seen: true,
    privacy_read_receipts: true,
    created_at: '',
    updated_at: '',
  };

  it('records outgoing voice and video calls in callHistory', async () => {
    const store = useCallStore.getState();

    // 1. Voice call flow
    await store.initiateCall(mockUser, 'audio', 'conv-1');
    expect(useCallStore.getState().activeCall?.callType).toBe('audio');
    store.endCall();

    const historyAfterVoice = useCallStore.getState().callHistory;
    expect(historyAfterVoice.length).toBeGreaterThan(0);
    expect(historyAfterVoice[0].call_type).toBe('audio');
    expect(historyAfterVoice[0].receiver?.display_name).toBe('Alice Cooper');

    // 2. Video call flow
    await store.initiateCall(mockUser, 'video', 'conv-1');
    expect(useCallStore.getState().activeCall?.callType).toBe('video');
    store.endCall();

    const historyAfterVideo = useCallStore.getState().callHistory;
    expect(historyAfterVideo[0].call_type).toBe('video');
    expect(historyAfterVideo[0].receiver?.display_name).toBe('Alice Cooper');
  });

  it('records group voice and video calls in callHistory with group title and is_group flag', async () => {
    const store = useCallStore.getState();

    // 1. Group Video Call
    await store.initiateGroupCall('group-qa', 'QA Core Squad', 'video');
    expect(useCallStore.getState().activeGroupCall?.groupTitle).toBe('QA Core Squad');
    store.leaveGroupCall();

    let history = useCallStore.getState().callHistory;
    expect(history[0].is_group).toBe(true);
    expect(history[0].group_title).toBe('QA Core Squad');
    expect(history[0].call_type).toBe('video');

    // 2. Group Voice Call
    await store.initiateGroupCall('group-design', 'Design Huddle', 'audio');
    expect(useCallStore.getState().activeGroupCall?.callType).toBe('audio');
    store.leaveGroupCall();

    history = useCallStore.getState().callHistory;
    expect(history[0].is_group).toBe(true);
    expect(history[0].group_title).toBe('Design Huddle');
    expect(history[0].call_type).toBe('audio');
  });

  it('logs missed and declined calls accurately', async () => {
    const store = useCallStore.getState();

    // Simulate incoming call and reject it
    store.simulateIncomingCall(mockUser, 'video');
    store.rejectCall();

    const history = useCallStore.getState().callHistory;
    expect(history[0].status).toBe('declined');
    expect(history[0].caller?.display_name).toBe('Alice Cooper');
    expect(history[0].call_type).toBe('video');
  });

  it('supports deleting individual call logs and clearing history', () => {
    const store = useCallStore.getState();
    const initialCount = store.callHistory.length;
    expect(initialCount).toBeGreaterThan(0);

    const firstId = store.callHistory[0].id;
    store.deleteCallLog(firstId);
    expect(useCallStore.getState().callHistory.some((c) => c.id === firstId)).toBe(false);

    store.clearCallHistory();
    expect(useCallStore.getState().callHistory.length).toBe(0);
  });
});
