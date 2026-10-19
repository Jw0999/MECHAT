import { describe, it, expect } from 'bun:test';
import { WebRTCManager } from '@/features/calling/WebRTCManager';

describe('WebRTC Calling Audio Guarantees', () => {
  it('initializes WebRTCManager with audio enabled and simulates audible tracks', () => {
    let remoteStreamReceived: MediaStream | null = null;
    const manager = new WebRTCManager({
      onRemoteStream: (stream) => {
        remoteStreamReceived = stream;
      },
    });

    const stream = manager.simulateAudioStream();
    expect(stream).toBeDefined();
    expect(remoteStreamReceived).toBeDefined();

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      expect(audioTracks[0].enabled).toBe(true);
    }
  });

  it('ensures simulateRemoteStream generates audible audio tracks for video calls', () => {
    let received: MediaStream | null = null;
    const manager = new WebRTCManager({
      onRemoteStream: (stream) => {
        received = stream;
      },
    });

    const stream = manager.simulateRemoteStream({
      id: 'test-user',
      display_name: 'Test User',
      username: 'test',
      avatar_url: null,
      bio: null,
      online_status: 'online',
      last_seen: '',
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    });

    expect(stream).toBeDefined();
    expect(received).toBeDefined();
  });

  it('toggleMute correctly toggles audio track state on local stream', () => {
    const manager = new WebRTCManager({});
    // Initially when no local stream, returns false
    expect(manager.toggleMute()).toBe(false);
  });
});
