import { describe, it, expect, beforeAll } from 'bun:test';
import { formatDuration, getInitials, formatMessageTime, formatFileSize } from '../src/lib/utils';
import { useChatStore } from '../src/stores/chatStore';
import { useAuthStore } from '../src/stores/authStore';
import { WebRTCManager } from '../src/features/calling/WebRTCManager';

describe('Chat Utilities & Formats', () => {
  it('formats call duration correctly', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(480)).toBe('08:00');
    expect(formatDuration(3600)).toBe('60:00');
  });

  it('extracts initials properly', () => {
    expect(getInitials('Nina Flora')).toBe('NF');
    expect(getInitials('Danang Calvin')).toBe('DC');
    expect(getInitials('Single')).toBe('SI');
    expect(getInitials('')).toBe('M');
  });

  it('formats valid ISO message time to HH:mm', () => {
    const iso = '2026-10-17T17:45:00Z';
    const formatted = formatMessageTime(iso);
    expect(formatted.length).toBe(5);
    expect(formatted.includes(':')).toBe(true);
  });

  it('formats file sizes accurately into human readable strings', () => {
    expect(formatFileSize(undefined)).toBe('0 B');
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });
});

describe('Chat Reply & Calling Logic', () => {
  beforeAll(() => {
    useAuthStore.getState().enableDemoMode(0);
    useChatStore.getState().resetToDemoData();
  });
  it('attaches reply_to_message when sending a reply to a chat message', async () => {
    const store = useChatStore.getState();
    await store.loadConversations();
    await store.loadMessages('conv-nina');

    const messagesBefore = useChatStore.getState().messages['conv-nina'] || [];
    expect(messagesBefore.length).toBeGreaterThan(0);

    const targetMessage = messagesBefore[0];

    // Send a reply pointing to targetMessage.id
    await store.sendMessage('conv-nina', 'This is a test reply message', undefined, undefined, targetMessage.id);

    // The newly appended message should have reply_to_message populated
    const updatedMessages = useChatStore.getState().messages['conv-nina'];
    const sentReply = updatedMessages[updatedMessages.length - 1];
    expect(sentReply.content).toBe('This is a test reply message');
    expect(sentReply.reply_to_message_id).toBe(targetMessage.id);
    expect(sentReply.reply_to_message).toBeDefined();
    expect(sentReply.reply_to_message?.id).toBe(targetMessage.id);
  });

  it('WebRTCManager safely initializes and manages audio/video state', () => {
    let localStreamEmitted: any = null;
    let remoteStreamEmitted: any = null;

    const manager = new WebRTCManager({
      onLocalStream: (s) => { localStreamEmitted = s; },
      onRemoteStream: (s) => { remoteStreamEmitted = s; },
    });

    expect(manager).toBeDefined();
    expect(manager.hasRemoteTracks()).toBe(false);

    // Stopping media should be safe and idempotent
    manager.stopMedia();
    expect(manager.hasRemoteTracks()).toBe(false);
  });

  it('supports sending and displaying image and file messages with metadata', async () => {
    const store = useChatStore.getState();

    // 1. Send an image message
    await store.sendMessage(
      'conv-nina',
      'https://example.com/photo.jpg',
      'image',
      {
        file_name: 'vacation.jpg',
        file_url: 'https://example.com/photo.jpg',
        file_size: 204800,
        mime_type: 'image/jpeg',
      }
    );

    let messages = useChatStore.getState().messages['conv-nina'];
    const sentImage = messages[messages.length - 1];
    expect(sentImage.message_type).toBe('image');
    expect(sentImage.metadata?.file_name).toBe('vacation.jpg');
    expect(sentImage.metadata?.file_size).toBe(204800);

    // 2. Send a document/file message
    await store.sendMessage(
      'conv-nina',
      'Project_Brief.pdf',
      'file',
      {
        file_name: 'Project_Brief.pdf',
        file_url: 'https://example.com/Project_Brief.pdf',
        file_size: 1048576,
        mime_type: 'application/pdf',
      }
    );

    messages = useChatStore.getState().messages['conv-nina'];
    const sentDoc = messages[messages.length - 1];
    expect(sentDoc.message_type).toBe('file');
    expect(sentDoc.metadata?.file_name).toBe('Project_Brief.pdf');
    expect(sentDoc.metadata?.file_size).toBe(1048576);
  });

  it('manages 1-on-1 call flow (initiate, mute, video toggle, end)', async () => {
    const { useCallStore } = await import('../src/stores/callStore');
    const callStore = useCallStore.getState();

    const mockRemoteUser = {
      id: 'demo-user-2',
      username: 'ninaflora',
      display_name: 'Nina Flora',
      avatar_url: '',
      bio: '',
      online_status: 'online' as const,
      last_seen: '',
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    };

    // Initiate call
    await callStore.initiateCall(mockRemoteUser, 'video', 'conv-nina');
    expect(useCallStore.getState().activeCall).toBeDefined();
    expect(useCallStore.getState().activeCall?.callType).toBe('video');
    expect(useCallStore.getState().activeCall?.remoteUser?.display_name).toBe('Nina Flora');

    // Toggle mute and video
    callStore.toggleMute();
    callStore.toggleVideo();

    // End call
    callStore.endCall();
    expect(useCallStore.getState().activeCall).toBeNull();
  });

  it('manages group call flow (initiate, participants, mute, leave)', async () => {
    const { useCallStore } = await import('../src/stores/callStore');
    const callStore = useCallStore.getState();

    // Initiate group call
    await callStore.initiateGroupCall('group-1', 'Product Design Team', 'video');
    expect(useCallStore.getState().activeGroupCall).toBeDefined();
    expect(useCallStore.getState().activeGroupCall?.groupTitle).toBe('Product Design Team');
    expect(useCallStore.getState().activeGroupCall?.status).toBe('connected');
    expect(useCallStore.getState().activeGroupCall?.participants.length).toBeGreaterThanOrEqual(1);

    // Toggle group mute & video
    callStore.toggleGroupMute();
    callStore.toggleGroupVideo();

    // Leave group call
    callStore.leaveGroupCall();
    expect(useCallStore.getState().activeGroupCall).toBeNull();
  });
});


