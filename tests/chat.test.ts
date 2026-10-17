import { describe, it, expect, beforeAll } from 'bun:test';
import { formatDuration, getInitials, formatMessageTime } from '../src/lib/utils';
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
});

describe('Chat Reply & Calling Logic', () => {
  beforeAll(() => {
    useAuthStore.getState().enableDemoMode(0);
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
});

