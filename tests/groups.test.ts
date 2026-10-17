import { describe, it, expect, beforeAll } from 'bun:test';
import { useChatStore } from '../src/stores/chatStore';
import { useAuthStore } from '../src/stores/authStore';

describe('MeChat Groups & WhatsApp-style Management', () => {
  beforeAll(() => {
    useAuthStore.getState().enableDemoMode(0);
  });

  it('initializes demo groups with description and participants', () => {
    const conversations = useChatStore.getState().conversations;
    const designGuild = conversations.find((c) => c.id === 'conv-group-product');

    expect(designGuild).toBeDefined();
    expect(designGuild?.type).toBe('group');
    expect(designGuild?.title).toBe('Design Guild 🎨');
    expect(designGuild?.description).toContain('guild space');
    expect(designGuild?.members).toBeDefined();
    expect(designGuild?.members?.length).toBeGreaterThan(3);

    // Verify admin member exists
    const admin = designGuild?.members?.find((m) => m.role === 'admin');
    expect(admin).toBeDefined();
  });

  it('creates a new group with a description and selected members', async () => {
    const createGroup = useChatStore.getState().createGroup;
    const newGroupId = await createGroup(
      'Mobile UX Reviewers',
      ['demo-user-2', 'demo-user-satria'],
      'Reviewing mobile UI designs for MeChat PWA'
    );

    expect(newGroupId).toBeDefined();

    const conv = useChatStore
      .getState()
      .conversations.find((c) => c.id === newGroupId);

    expect(conv).toBeDefined();
    expect(conv?.title).toBe('Mobile UX Reviewers');
    expect(conv?.description).toBe('Reviewing mobile UI designs for MeChat PWA');
    expect(conv?.members?.length).toBe(3); // creator + 2 selected
  });

  it('updates group title and description', async () => {
    const updateGroupDetails = useChatStore.getState().updateGroupDetails;
    const ok = await updateGroupDetails('conv-group-product', {
      title: 'Design Guild 2.0 🎨',
      description: 'Updated guidelines for typography and lime-green tokens.',
    });

    expect(ok).toBe(true);

    const updated = useChatStore
      .getState()
      .conversations.find((c) => c.id === 'conv-group-product');
    expect(updated?.title).toBe('Design Guild 2.0 🎨');
    expect(updated?.description).toBe(
      'Updated guidelines for typography and lime-green tokens.'
    );
  });

  it('adds new members to group', async () => {
    const addGroupMembers = useChatStore.getState().addGroupMembers;
    const ok = await addGroupMembers('conv-group-product', ['demo-user-roomie']);

    expect(ok).toBe(true);

    const conv = useChatStore
      .getState()
      .conversations.find((c) => c.id === 'conv-group-product');
    const hasRoomie = conv?.members?.some((m) => m.user_id === 'demo-user-roomie');
    expect(hasRoomie).toBe(true);
  });

  it('removes a member from group', async () => {
    const removeGroupMember = useChatStore.getState().removeGroupMember;
    const ok = await removeGroupMember('conv-group-product', 'demo-user-roomie');

    expect(ok).toBe(true);

    const conv = useChatStore
      .getState()
      .conversations.find((c) => c.id === 'conv-group-product');
    const hasRoomie = conv?.members?.some((m) => m.user_id === 'demo-user-roomie');
    expect(hasRoomie).toBe(false);
  });

  it('toggles group admin role', async () => {
    const toggleGroupAdmin = useChatStore.getState().toggleGroupAdmin;
    const ok = await toggleGroupAdmin('conv-group-product', 'demo-user-satria', true);

    expect(ok).toBe(true);

    const conv = useChatStore
      .getState()
      .conversations.find((c) => c.id === 'conv-group-product');
    const satria = conv?.members?.find((m) => m.user_id === 'demo-user-satria');
    expect(satria?.role).toBe('admin');
  });

  it('allows leaving a group', async () => {
    const leaveGroup = useChatStore.getState().leaveGroup;
    const ok = await leaveGroup('conv-group-product');

    expect(ok).toBe(true);

    const conv = useChatStore
      .getState()
      .conversations.find((c) => c.id === 'conv-group-product');
    expect(conv).toBeUndefined();
  });
});
