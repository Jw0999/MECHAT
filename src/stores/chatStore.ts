import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type {
  Conversation,
  Message,
  Profile,
  MessageType,
  ConversationMember,
} from '@/types/database.types';
import { DEMO_PROFILES } from '@/lib/constants/demoProfiles';
import { useAuthStore } from './authStore';
import { toast } from 'sonner';

export type FilterTab = 'All' | 'Chats' | 'Groups' | 'Favorite';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  filterTab: FilterTab;
  searchQuery: string;
  typingUsers: Record<string, string[]>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  realtimeChannel: any | null;

  setFilterTab: (tab: FilterTab) => void;
  setSearchQuery: (query: string) => void;
  setActiveConversationId: (id: string | null) => void;

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    messageType?: MessageType,
    metadata?: any,
    replyToId?: string
  ) => Promise<boolean>;
  deleteMessage: (messageId: string, conversationId: string) => Promise<void>;
  createDirectConversation: (targetUserId: string) => Promise<string | null>;
  createGroup: (
    title: string,
    memberIds: string[],
    description?: string,
    avatarUrl?: string
  ) => Promise<string | null>;
  updateGroupDetails: (
    conversationId: string,
    updates: { title?: string; description?: string; avatar_url?: string }
  ) => Promise<boolean>;
  addGroupMembers: (conversationId: string, userIds: string[]) => Promise<boolean>;
  removeGroupMember: (conversationId: string, userId: string) => Promise<boolean>;
  toggleGroupAdmin: (
    conversationId: string,
    userId: string,
    makeAdmin: boolean
  ) => Promise<boolean>;
  leaveGroup: (conversationId: string) => Promise<boolean>;
  toggleMuteGroup: (conversationId: string) => Promise<boolean>;
  markAsRead: (conversationId: string) => Promise<void>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  subscribeToConversation: (conversationId: string) => void;
  unsubscribeFromConversation: () => void;
}

// Initial demo mock conversations matching the attached design reference
const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-nina',
    type: 'direct',
    title: null,
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-1',
    last_message_at: '2026-10-17T17:45:00Z',
    created_at: '2026-10-17T10:00:00Z',
    updated_at: '2026-10-17T17:45:00Z',
    unread_count: 0,
    other_user: {
      id: 'demo-user-2',
      username: 'ninaflora',
      display_name: 'Nina Flora',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: 'Coffee lover & UI/UX explorer ☕️✨',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '2026-10-17T10:00:00Z',
      updated_at: '2026-10-17T10:00:00Z',
    },
    last_message: {
      id: 'msg-6',
      conversation_id: 'conv-nina',
      sender_id: 'demo-user-1',
      content: 'See you',
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: true,
      deleted_at: null,
      created_at: '2026-10-17T17:45:00Z',
      updated_at: '2026-10-17T17:45:00Z',
    },
  },
  {
    id: 'conv-danang',
    type: 'direct',
    title: null,
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-danang',
    last_message_at: '2026-10-17T17:45:00Z',
    created_at: '2026-10-17T09:00:00Z',
    updated_at: '2026-10-17T17:45:00Z',
    unread_count: 0,
    other_user: {
      id: 'demo-user-danang',
      username: 'danangcalvin',
      display_name: 'Danang Calvin',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: 'Mobile Dev & Traveler 🎒',
      online_status: 'offline',
      last_seen: '2026-10-17T16:30:00Z',
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '2026-10-17T09:00:00Z',
      updated_at: '2026-10-17T09:00:00Z',
    },
    last_message: {
      id: 'msg-danang-1',
      conversation_id: 'conv-danang',
      sender_id: 'demo-user-danang',
      content: "Let's meet there at 9 PM?",
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: true,
      deleted_at: null,
      created_at: '2026-10-17T17:45:00Z',
      updated_at: '2026-10-17T17:45:00Z',
    },
  },
  {
    id: 'conv-satria',
    type: 'direct',
    title: null,
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-satria',
    last_message_at: '2026-10-17T17:45:00Z',
    created_at: '2026-10-17T08:00:00Z',
    updated_at: '2026-10-17T17:45:00Z',
    unread_count: 3,
    other_user: {
      id: 'demo-user-satria',
      username: 'satriah',
      display_name: 'Satria herman',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      bio: 'Lead Engineer @ FinTech',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '2026-10-17T08:00:00Z',
      updated_at: '2026-10-17T08:00:00Z',
    },
    last_message: {
      id: 'msg-satria-1',
      conversation_id: 'conv-satria',
      sender_id: 'demo-user-satria',
      content: 'Please send me the updated pitch deck...',
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: false,
      deleted_at: null,
      created_at: '2026-10-17T17:45:00Z',
      updated_at: '2026-10-17T17:45:00Z',
    },
  },
  {
    id: 'conv-alexander',
    type: 'direct',
    title: null,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-alex',
    last_message_at: '2026-10-17T17:45:00Z',
    created_at: '2026-10-17T07:00:00Z',
    updated_at: '2026-10-17T17:45:00Z',
    unread_count: 2,
    other_user: {
      id: 'demo-user-alex',
      username: 'alexander',
      display_name: 'Alexander',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'Sound designer & synth enthusiast 🎹',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '2026-10-17T07:00:00Z',
      updated_at: '2026-10-17T07:00:00Z',
    },
    last_message: {
      id: 'msg-alex-1',
      conversation_id: 'conv-alexander',
      sender_id: 'demo-user-alex',
      content: 'Typing...',
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: false,
      deleted_at: null,
      created_at: '2026-10-17T17:45:00Z',
      updated_at: '2026-10-17T17:45:00Z',
    },
  },
  {
    id: 'conv-jake',
    type: 'direct',
    title: null,
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-jake',
    last_message_at: '2026-10-17T17:45:00Z',
    created_at: '2026-10-17T06:00:00Z',
    updated_at: '2026-10-17T17:45:00Z',
    unread_count: 0,
    other_user: {
      id: 'demo-user-jake',
      username: 'jake',
      display_name: 'Jake',
      avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
      bio: 'Guitar & coding 🎸💻',
      online_status: 'offline',
      last_seen: '2026-10-17T14:10:00Z',
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '2026-10-17T06:00:00Z',
      updated_at: '2026-10-17T06:00:00Z',
    },
    last_message: {
      id: 'msg-jake-1',
      conversation_id: 'conv-jake',
      sender_id: 'demo-user-jake',
      content: "Let me know when you're free to jam...",
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: true,
      deleted_at: null,
      created_at: '2026-10-17T17:45:00Z',
      updated_at: '2026-10-17T17:45:00Z',
    },
  },
  {
    id: 'conv-roomie',
    type: 'direct',
    title: null,
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-roomie',
    last_message_at: '2026-10-17T17:45:00Z',
    created_at: '2026-10-17T05:00:00Z',
    updated_at: '2026-10-17T17:45:00Z',
    unread_count: 0,
    other_user: {
      id: 'demo-user-roomie',
      username: 'roomie',
      display_name: 'Roomie',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      bio: 'House rules: buy more snacks 🍕',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '2026-10-17T05:00:00Z',
      updated_at: '2026-10-17T05:00:00Z',
    },
    last_message: {
      id: 'msg-roomie-1',
      conversation_id: 'conv-roomie',
      sender_id: 'demo-user-roomie',
      content: "We're out of milk again 😅",
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: true,
      deleted_at: null,
      created_at: '2026-10-17T17:45:00Z',
      updated_at: '2026-10-17T17:45:00Z',
    },
  },
  {
    id: 'conv-group-product',
    type: 'group',
    title: 'Design Guild 🎨',
    description:
      'Official guild space for MeChat UI/UX designers, product architects, and design system contributors. Share mockups, critiques, and design tokens here.',
    avatar_url:
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-1',
    last_message_at: '2026-10-17T16:20:00Z',
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-17T16:20:00Z',
    unread_count: 1,
    members: [
      {
        id: 'mem-guild-1',
        conversation_id: 'conv-group-product',
        user_id: 'demo-user-1',
        role: 'admin',
        is_favorite: true,
        is_muted: false,
        last_read_at: '2026-10-17T16:20:00Z',
        joined_at: '2026-10-15T10:00:00Z',
        profile: DEMO_PROFILES[0],
      },
      {
        id: 'mem-guild-2',
        conversation_id: 'conv-group-product',
        user_id: 'demo-user-2',
        role: 'admin',
        is_favorite: false,
        is_muted: false,
        last_read_at: '2026-10-17T16:20:00Z',
        joined_at: '2026-10-15T10:05:00Z',
        profile: DEMO_PROFILES[1],
      },
      {
        id: 'mem-guild-3',
        conversation_id: 'conv-group-product',
        user_id: 'demo-user-satria',
        role: 'member',
        is_favorite: false,
        is_muted: false,
        last_read_at: '2026-10-17T16:15:00Z',
        joined_at: '2026-10-15T10:10:00Z',
        profile: DEMO_PROFILES[2],
      },
      {
        id: 'mem-guild-4',
        conversation_id: 'conv-group-product',
        user_id: 'demo-user-alex',
        role: 'member',
        is_favorite: false,
        is_muted: false,
        last_read_at: '2026-10-17T16:00:00Z',
        joined_at: '2026-10-15T10:15:00Z',
        profile: DEMO_PROFILES[3],
      },
      {
        id: 'mem-guild-5',
        conversation_id: 'conv-group-product',
        user_id: 'demo-user-jake',
        role: 'member',
        is_favorite: false,
        is_muted: false,
        last_read_at: '2026-10-17T15:30:00Z',
        joined_at: '2026-10-15T10:20:00Z',
        profile: DEMO_PROFILES[4],
      },
    ],
    last_message: {
      id: 'msg-group-1',
      conversation_id: 'conv-group-product',
      sender_id: 'demo-user-2',
      content: 'Check out the new design system specs in Figma!',
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: false,
      deleted_at: null,
      created_at: '2026-10-17T16:20:00Z',
      updated_at: '2026-10-17T16:20:00Z',
      sender: DEMO_PROFILES[1],
    },
  },
  {
    id: 'conv-group-mobile',
    type: 'group',
    title: 'MeChat Core Team 🚀',
    description:
      'Engineering coordination channel for Supabase Realtime, WebRTC audio/video calling, and PWA service worker caching.',
    avatar_url:
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=150&auto=format&fit=crop&q=80',
    created_by: 'demo-user-1',
    last_message_at: '2026-10-17T15:10:00Z',
    created_at: '2026-10-14T09:00:00Z',
    updated_at: '2026-10-17T15:10:00Z',
    unread_count: 0,
    members: [
      {
        id: 'mem-core-1',
        conversation_id: 'conv-group-mobile',
        user_id: 'demo-user-1',
        role: 'admin',
        is_favorite: true,
        is_muted: false,
        last_read_at: '2026-10-17T15:10:00Z',
        joined_at: '2026-10-14T09:00:00Z',
        profile: DEMO_PROFILES[0],
      },
      {
        id: 'mem-core-2',
        conversation_id: 'conv-group-mobile',
        user_id: 'demo-user-satria',
        role: 'member',
        is_favorite: false,
        is_muted: false,
        last_read_at: '2026-10-17T15:10:00Z',
        joined_at: '2026-10-14T09:05:00Z',
        profile: DEMO_PROFILES[2],
      },
      {
        id: 'mem-core-3',
        conversation_id: 'conv-group-mobile',
        user_id: 'demo-user-alex',
        role: 'member',
        is_favorite: false,
        is_muted: false,
        last_read_at: '2026-10-17T15:10:00Z',
        joined_at: '2026-10-14T09:10:00Z',
        profile: DEMO_PROFILES[3],
      },
    ],
    last_message: {
      id: 'msg-group-core-1',
      conversation_id: 'conv-group-mobile',
      sender_id: 'demo-user-satria',
      content: 'WebRTC audio ringtones and STUN candidates are working flawlessly!',
      message_type: 'text',
      reply_to_message_id: null,
      metadata: {},
      is_read: true,
      deleted_at: null,
      created_at: '2026-10-17T15:10:00Z',
      updated_at: '2026-10-17T15:10:00Z',
      sender: DEMO_PROFILES[2],
    },
  },
];

// Reference messages for Nina Flora conversation (Screen 3 in mockup)
const NINA_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    conversation_id: 'conv-nina',
    sender_id: 'demo-user-2', // Nina (Incoming)
    content: "Hey! Don't forget our dinner plans tonight 🍣",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:51:00Z',
    updated_at: '2026-10-17T17:51:00Z',
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-nina',
    sender_id: 'demo-user-2', // Nina (Incoming)
    content: 'I made a reservation at the new sushi place you mentioned last week.',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:51:30Z',
    updated_at: '2026-10-17T17:51:30Z',
  },
  {
    id: 'msg-3',
    conversation_id: 'conv-nina',
    sender_id: 'demo-user-2', // Nina (Incoming)
    content: "Let's meet there at 7 PM? I can pick you up if you want ☺️",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:54:00Z',
    updated_at: '2026-10-17T17:54:00Z',
  },
  {
    id: 'msg-4',
    conversation_id: 'conv-nina',
    sender_id: 'demo-user-1', // You (Outgoing lime green)
    content: "Of course! can't wait. I'll be ready by 7",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:45:00Z',
    updated_at: '2026-10-17T17:45:00Z',
  },
  {
    id: 'msg-5',
    conversation_id: 'conv-nina',
    sender_id: 'demo-user-2', // Nina (Incoming)
    content: 'Great! See you later!',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:54:30Z',
    updated_at: '2026-10-17T17:54:30Z',
  },
  {
    id: 'msg-6',
    conversation_id: 'conv-nina',
    sender_id: 'demo-user-1', // You (Outgoing lime green)
    content: 'See you',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:45:30Z',
    updated_at: '2026-10-17T17:45:30Z',
  },
];

const GROUP_MESSAGES: Message[] = [
  {
    id: 'grp-msg-1',
    conversation_id: 'conv-group-product',
    sender_id: 'demo-user-2',
    content: 'Hey everyone! Welcome to the new Design Guild space 🚀',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T15:30:00Z',
    updated_at: '2026-10-17T15:30:00Z',
    sender: {
      id: 'demo-user-2',
      username: 'ninaflora',
      display_name: 'Nina Flora',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: '',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    },
  },
  {
    id: 'grp-msg-2',
    conversation_id: 'conv-group-product',
    sender_id: 'demo-user-danang',
    content: 'Love the new dark theme with the lime green accent!',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T15:45:00Z',
    updated_at: '2026-10-17T15:45:00Z',
    sender: {
      id: 'demo-user-danang',
      username: 'danangcalvin',
      display_name: 'Danang Calvin',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: '',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    },
  },
  {
    id: 'grp-msg-3',
    conversation_id: 'conv-group-product',
    sender_id: 'demo-user-1',
    content: 'Thanks! Everything is built with real-time sync and WebRTC calling.',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T16:15:00Z',
    updated_at: '2026-10-17T16:15:00Z',
  },
  {
    id: 'grp-msg-4',
    conversation_id: 'conv-group-product',
    sender_id: 'demo-user-2',
    content: 'Check out the new design system specs in Figma!',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: false,
    deleted_at: null,
    created_at: '2026-10-17T16:20:00Z',
    updated_at: '2026-10-17T16:20:00Z',
    sender: {
      id: 'demo-user-2',
      username: 'ninaflora',
      display_name: 'Nina Flora',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: '',
      online_status: 'online',
      last_seen: new Date().toISOString(),
      privacy_online: true,
      privacy_last_seen: true,
      privacy_read_receipts: true,
      created_at: '',
      updated_at: '',
    },
  },
];

const DANANG_MESSAGES: Message[] = [
  {
    id: 'danang-msg-1',
    conversation_id: 'conv-danang',
    sender_id: 'demo-user-danang',
    content: "Hey, are you free for a quick sync later today?",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:30:00Z',
    updated_at: '2026-10-17T17:30:00Z',
  },
  {
    id: 'danang-msg-2',
    conversation_id: 'conv-danang',
    sender_id: 'demo-user-1',
    content: 'Sure, what time works best for you?',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:35:00Z',
    updated_at: '2026-10-17T17:35:00Z',
  },
  {
    id: 'danang-msg-3',
    conversation_id: 'conv-danang',
    sender_id: 'demo-user-danang',
    content: "Let's meet there at 9 PM?",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:45:00Z',
    updated_at: '2026-10-17T17:45:00Z',
  },
];

const SATRIA_MESSAGES: Message[] = [
  {
    id: 'satria-msg-1',
    conversation_id: 'conv-satria',
    sender_id: 'demo-user-satria',
    content: 'Hi Kelvin, did you get a chance to review the Q4 roadmap?',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:40:00Z',
    updated_at: '2026-10-17T17:40:00Z',
  },
  {
    id: 'satria-msg-2',
    conversation_id: 'conv-satria',
    sender_id: 'demo-user-satria',
    content: 'Please send me the updated pitch deck when you can.',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: false,
    deleted_at: null,
    created_at: '2026-10-17T17:45:00Z',
    updated_at: '2026-10-17T17:45:00Z',
  },
];

const ALEXANDER_MESSAGES: Message[] = [
  {
    id: 'alex-msg-1',
    conversation_id: 'conv-alexander',
    sender_id: 'demo-user-alex',
    content: 'Hey! Check out this new track stem I synthesized 🎶',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:40:00Z',
    updated_at: '2026-10-17T17:40:00Z',
  },
  {
    id: 'alex-msg-2',
    conversation_id: 'conv-alexander',
    sender_id: 'demo-user-alex',
    content: 'Working on the audio stems right now.',
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: false,
    deleted_at: null,
    created_at: '2026-10-17T17:44:00Z',
    updated_at: '2026-10-17T17:44:00Z',
  },
];

const JAKE_MESSAGES: Message[] = [
  {
    id: 'jake-msg-1',
    conversation_id: 'conv-jake',
    sender_id: 'demo-user-jake',
    content: "Let me know when you're free to jam...",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:45:00Z',
    updated_at: '2026-10-17T17:45:00Z',
  },
];

const ROOMIE_MESSAGES: Message[] = [
  {
    id: 'roomie-msg-1',
    conversation_id: 'conv-roomie',
    sender_id: 'demo-user-roomie',
    content: "We're out of milk again 😅",
    message_type: 'text',
    reply_to_message_id: null,
    metadata: {},
    is_read: true,
    deleted_at: null,
    created_at: '2026-10-17T17:45:00Z',
    updated_at: '2026-10-17T17:45:00Z',
  },
];

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: DEMO_CONVERSATIONS,
  activeConversationId: null,
  messages: {
    'conv-nina': NINA_MESSAGES,
    'conv-group-product': GROUP_MESSAGES,
    'conv-danang': DANANG_MESSAGES,
    'conv-satria': SATRIA_MESSAGES,
    'conv-alexander': ALEXANDER_MESSAGES,
    'conv-jake': JAKE_MESSAGES,
    'conv-roomie': ROOMIE_MESSAGES,
  },
  filterTab: 'All',
  searchQuery: '',
  typingUsers: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  realtimeChannel: null,

  setFilterTab: (tab) => set({ filterTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveConversationId: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().markAsRead(id);
      get().loadMessages(id);
      get().subscribeToConversation(id);
    } else {
      get().unsubscribeFromConversation();
    }
  },

  loadConversations: async () => {
    const { isDemoMode } = useAuthStore.getState();
    const currentUserId = useAuthStore.getState().user?.id;

    if (isDemoMode || !isSupabaseConfigured() || !currentUserId) {
      // In demo mode, conversations are already in state
      return;
    }

    set({ isLoadingConversations: true });
    try {
      // Fetch user's conversation memberships
      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          role,
          is_favorite,
          is_muted,
          last_read_at,
          conversations (
            id,
            type,
            title,
            description,
            avatar_url,
            created_by,
            last_message_at,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', currentUserId);

      if (memberErr) throw memberErr;

      const loadedList: Conversation[] = [];

      for (const row of memberRows || []) {
        const conv = row.conversations as any;
        if (!conv) continue;

        // Fetch other member for direct chat
        let otherUser: Profile | null = null;
        if (conv.type === 'direct') {
          const { data: otherMember } = await supabase
            .from('conversation_members')
            .select('user_id, profiles(*)')
            .eq('conversation_id', conv.id)
            .neq('user_id', currentUserId)
            .single();

          if (otherMember && otherMember.profiles) {
            otherUser = otherMember.profiles as unknown as Profile;
          }
        }

        // Fetch group members if group
        let groupMembers: ConversationMember[] = [];
        if (conv.type === 'group') {
          const { data: memberData } = await supabase
            .from('conversation_members')
            .select('id, conversation_id, user_id, role, is_favorite, is_muted, last_read_at, joined_at, profiles(*)')
            .eq('conversation_id', conv.id);
          if (memberData) {
            groupMembers = memberData.map((m: any) => ({
              ...m,
              profile: m.profiles,
            }));
          }
        }

        // Fetch last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Calculate unread count
        const lastRead = row.last_read_at || new Date(0).toISOString();
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', currentUserId)
          .gt('created_at', lastRead);

        loadedList.push({
          ...conv,
          other_user: otherUser,
          members: groupMembers,
          last_message: lastMsg || null,
          unread_count: unreadCount || 0,
        });
      }

      // Sort by last_message_at desc
      loadedList.sort(
        (a, b) =>
          new Date(b.last_message_at || b.created_at).getTime() -
          new Date(a.last_message_at || a.created_at).getTime()
      );

      set({ conversations: loadedList, isLoadingConversations: false });
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (conversationId: string) => {
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured()) {
      // In demo mode, if no messages exist yet for this conversation, initialize empty array
      if (!get().messages[conversationId]) {
        set((state) => ({
          messages: { ...state.messages, [conversationId]: [] },
        }));
      }
      return;
    }

    set({ isLoadingMessages: true });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rawMessages = (data as any[]) || [];
      const msgMap = new Map<string, Message>();
      rawMessages.forEach((m) => msgMap.set(m.id, m));
      const resolvedMessages: Message[] = rawMessages.map((m) => ({
        ...m,
        reply_to_message:
          m.reply_to_message ||
          (m.reply_to_message_id ? msgMap.get(m.reply_to_message_id) || null : null),
      }));

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: resolvedMessages,
        },
        isLoadingMessages: false,
      }));
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (
    conversationId: string,
    content: string,
    messageType: MessageType = 'text',
    metadata: any = {},
    replyToId?: string
  ) => {
    const { user, profile, isDemoMode } = useAuthStore.getState();
    if (!user || !profile) return false;

    // Find the replied message if replyToId is present
    const existingMessages = get().messages[conversationId] || [];
    const replyTarget = replyToId
      ? existingMessages.find((m) => m.id === replyToId) || null
      : null;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: messageType,
      reply_to_message_id: replyToId || null,
      reply_to_message: replyTarget,
      metadata,
      is_read: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: profile,
      isSending: true,
      hasFailed: false,
    };

    // Optimistically insert message into UI
    set((state) => {
      const existing = state.messages[conversationId] || [];
      const updatedConvs = state.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              last_message: optimisticMessage,
              last_message_at: optimisticMessage.created_at,
            }
          : c
      );
      // Bring active conversation to top
      updatedConvs.sort(
        (a, b) =>
          new Date(b.last_message_at || b.created_at).getTime() -
          new Date(a.last_message_at || a.created_at).getTime()
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existing, optimisticMessage],
        },
        conversations: updatedConvs,
      };
    });

    if (isDemoMode || !isSupabaseConfigured()) {
      // Demo mode simulated delivery
      setTimeout(() => {
        set((state) => {
          const msgs = (state.messages[conversationId] || []).map((m) =>
            m.id === tempId ? { ...m, isSending: false } : m
          );
          return {
            messages: { ...state.messages, [conversationId]: msgs },
          };
        });

        // If chatting with Nina in demo mode, generate a realistic reply after 1.8s
        if (conversationId === 'conv-nina' && messageType === 'text') {
          setTimeout(() => {
            const replyMsg: Message = {
              id: `nina-reply-${Date.now()}`,
              conversation_id: 'conv-nina',
              sender_id: 'demo-user-2',
              content: 'Sounds awesome! See you in a bit! 😊',
              message_type: 'text',
              reply_to_message_id: null,
              metadata: {},
              is_read: true,
              deleted_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            set((st) => ({
              messages: {
                ...st.messages,
                [conversationId]: [...(st.messages[conversationId] || []), replyMsg],
              },
            }));
          }, 1800);
        }
      }, 300);
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          message_type: messageType,
          reply_to_message_id: replyToId || null,
          metadata,
        })
        .select(`*, sender:profiles(*)`)
        .single();

      if (error) throw error;

      // Replace optimistic message with actual persisted record while preserving resolved reply target
      set((state) => {
        const msgs = (state.messages[conversationId] || []).map((m) =>
          m.id === tempId
            ? ({ ...data, reply_to_message: replyTarget } as Message)
            : m
        );
        return {
          messages: { ...state.messages, [conversationId]: msgs },
        };
      });

      return true;
    } catch (err: any) {
      console.error('Failed to send message:', err);
      // Mark as failed in UI for retry
      set((state) => {
        const msgs = (state.messages[conversationId] || []).map((m) =>
          m.id === tempId ? { ...m, isSending: false, hasFailed: true } : m
        );
        return {
          messages: { ...state.messages, [conversationId]: msgs },
        };
      });
      toast.error('Message failed to send. Tap to retry.');
      return false;
    }
  },

  deleteMessage: async (messageId: string, conversationId: string) => {
    const { isDemoMode } = useAuthStore.getState();

    // Optimistically update
    set((state) => {
      const msgs = (state.messages[conversationId] || []).map((m) =>
        m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
      );
      return { messages: { ...state.messages, [conversationId]: msgs } };
    });

    if (isDemoMode || !isSupabaseConfigured()) {
      toast.success('Message deleted');
      return;
    }

    try {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);
      toast.success('Message deleted');
    } catch (err) {
      toast.error('Failed to delete message');
    }
  },

  createDirectConversation: async (targetUserId: string) => {
    const { isDemoMode, user } = useAuthStore.getState();
    if (!user) return null;

    if (isDemoMode || !isSupabaseConfigured()) {
      const existing = get().conversations.find(
        (c) => c.type === 'direct' && c.other_user?.id === targetUserId
      );
      if (existing) {
        get().setActiveConversationId(existing.id);
        return existing.id;
      }
      const newConvId = `conv-direct-${Date.now()}`;
      const newConv: Conversation = {
        id: newConvId,
        type: 'direct',
        title: null,
        avatar_url: null,
        created_by: user.id,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
        other_user: {
          id: targetUserId,
          username: `user_${targetUserId.slice(0, 5)}`,
          display_name: `Contact ${targetUserId.slice(0, 4)}`,
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUserId}`,
          bio: '',
          online_status: 'online',
          last_seen: new Date().toISOString(),
          privacy_online: true,
          privacy_last_seen: true,
          privacy_read_receipts: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
      set((st) => ({
        conversations: [newConv, ...st.conversations],
      }));
      get().setActiveConversationId(newConvId);
      return newConvId;
    }

    try {
      // Call Postgres atomic RPC function
      const { data: convId, error } = await supabase.rpc(
        'get_or_create_direct_conversation',
        { target_user_id: targetUserId }
      );

      if (error) throw error;
      await get().loadConversations();
      get().setActiveConversationId(convId);
      return convId;
    } catch (err: any) {
      toast.error(err.message || 'Could not start conversation');
      return null;
    }
  },

  createGroup: async (
    title: string,
    memberIds: string[],
    description?: string,
    avatarUrl?: string
  ) => {
    const { user, profile, isDemoMode } = useAuthStore.getState();
    if (!user) return null;

    if (isDemoMode || !isSupabaseConfigured()) {
      const newGroupId = `group-${Date.now()}`;
      const groupMembers: ConversationMember[] = [
        {
          id: `mem-creator-${user.id}`,
          conversation_id: newGroupId,
          user_id: user.id,
          role: 'admin',
          is_favorite: true,
          is_muted: false,
          last_read_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          profile: profile || DEMO_PROFILES[0],
        },
        ...memberIds.map((mId) => {
          const p = DEMO_PROFILES.find((dp) => dp.id === mId);
          return {
            id: `mem-${Date.now()}-${mId}`,
            conversation_id: newGroupId,
            user_id: mId,
            role: 'member' as const,
            is_favorite: false,
            is_muted: false,
            last_read_at: new Date().toISOString(),
            joined_at: new Date().toISOString(),
            profile: p,
          };
        }),
      ];

      const newGroup: Conversation = {
        id: newGroupId,
        type: 'group',
        title,
        description: description || null,
        avatar_url:
          avatarUrl ||
          `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(title)}`,
        created_by: user.id,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        unread_count: 0,
        members: groupMembers,
      };

      set((st) => ({
        conversations: [newGroup, ...st.conversations],
      }));
      get().setActiveConversationId(newGroupId);
      toast.success(`Group "${title}" created!`);
      return newGroupId;
    }

    try {
      // 1. Insert conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          title,
          description: description || null,
          avatar_url: avatarUrl || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // 2. Insert creator as admin & invited members
      const memberInserts = [
        { conversation_id: conv.id, user_id: user.id, role: 'admin' },
        ...memberIds.map((mId) => ({
          conversation_id: conv.id,
          user_id: mId,
          role: 'member',
        })),
      ];

      const { error: memberErr } = await supabase
        .from('conversation_members')
        .insert(memberInserts);

      if (memberErr) throw memberErr;

      await get().loadConversations();
      get().setActiveConversationId(conv.id);
      toast.success(`Group "${title}" created!`);
      return conv.id;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
      return null;
    }
  },

  updateGroupDetails: async (
    conversationId: string,
    updates: { title?: string; description?: string; avatar_url?: string }
  ) => {
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured()) {
      set((st) => ({
        conversations: st.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, ...updates, updated_at: new Date().toISOString() }
            : c
        ),
      }));
      toast.success('Group updated successfully');
      return true;
    }
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      if (error) throw error;
      set((st) => ({
        conversations: st.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, ...updates, updated_at: new Date().toISOString() }
            : c
        ),
      }));
      toast.success('Group updated successfully');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to update group');
      return false;
    }
  },

  addGroupMembers: async (conversationId: string, userIds: string[]) => {
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured()) {
      const newMembers: ConversationMember[] = userIds.map((uId) => {
        const p = DEMO_PROFILES.find((dp) => dp.id === uId);
        return {
          id: `mem-${Date.now()}-${uId}`,
          conversation_id: conversationId,
          user_id: uId,
          role: 'member',
          is_favorite: false,
          is_muted: false,
          last_read_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          profile: p,
        };
      });
      set((st) => ({
        conversations: st.conversations.map((c) => {
          if (c.id === conversationId) {
            const currentMembers = c.members || [];
            return {
              ...c,
              members: [...currentMembers, ...newMembers],
            };
          }
          return c;
        }),
      }));
      toast.success(`Added ${userIds.length} ${userIds.length === 1 ? 'member' : 'members'}`);
      return true;
    }
    try {
      const rows = userIds.map((uId) => ({
        conversation_id: conversationId,
        user_id: uId,
        role: 'member' as const,
      }));
      const { error } = await supabase.from('conversation_members').insert(rows);
      if (error) throw error;
      await get().loadConversations();
      toast.success('Members added successfully');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to add members');
      return false;
    }
  },

  removeGroupMember: async (conversationId: string, userId: string) => {
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured()) {
      set((st) => ({
        conversations: st.conversations.map((c) => {
          if (c.id === conversationId && c.members) {
            return {
              ...c,
              members: c.members.filter((m) => m.user_id !== userId),
            };
          }
          return c;
        }),
      }));
      toast.success('Member removed');
      return true;
    }
    try {
      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
      if (error) throw error;
      set((st) => ({
        conversations: st.conversations.map((c) => {
          if (c.id === conversationId && c.members) {
            return {
              ...c,
              members: c.members.filter((m) => m.user_id !== userId),
            };
          }
          return c;
        }),
      }));
      toast.success('Member removed');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
      return false;
    }
  },

  toggleGroupAdmin: async (
    conversationId: string,
    userId: string,
    makeAdmin: boolean
  ) => {
    const newRole = makeAdmin ? 'admin' : 'member';
    const { isDemoMode } = useAuthStore.getState();
    if (isDemoMode || !isSupabaseConfigured()) {
      set((st) => ({
        conversations: st.conversations.map((c) => {
          if (c.id === conversationId && c.members) {
            return {
              ...c,
              members: c.members.map((m) =>
                m.user_id === userId ? { ...m, role: newRole } : m
              ),
            };
          }
          return c;
        }),
      }));
      toast.success(makeAdmin ? 'Promoted to Group Admin' : 'Dismissed as Admin');
      return true;
    }
    try {
      const { error } = await supabase
        .from('conversation_members')
        .update({ role: newRole })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
      if (error) throw error;
      set((st) => ({
        conversations: st.conversations.map((c) => {
          if (c.id === conversationId && c.members) {
            return {
              ...c,
              members: c.members.map((m) =>
                m.user_id === userId ? { ...m, role: newRole } : m
              ),
            };
          }
          return c;
        }),
      }));
      toast.success(makeAdmin ? 'Promoted to Group Admin' : 'Dismissed as Admin');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role');
      return false;
    }
  },

  leaveGroup: async (conversationId: string) => {
    const { user, isDemoMode } = useAuthStore.getState();
    if (!user) return false;
    if (isDemoMode || !isSupabaseConfigured()) {
      set((st) => ({
        conversations: st.conversations.filter((c) => c.id !== conversationId),
        activeConversationId:
          st.activeConversationId === conversationId ? null : st.activeConversationId,
      }));
      toast.success('You have left the group');
      return true;
    }
    try {
      const { error } = await supabase
        .from('conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      if (error) throw error;
      set((st) => ({
        conversations: st.conversations.filter((c) => c.id !== conversationId),
        activeConversationId:
          st.activeConversationId === conversationId ? null : st.activeConversationId,
      }));
      toast.success('You have left the group');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave group');
      return false;
    }
  },

  toggleMuteGroup: async (conversationId: string) => {
    const { user, isDemoMode } = useAuthStore.getState();
    if (!user) return false;

    let nextMuted = false;
    set((st) => ({
      conversations: st.conversations.map((c) => {
        if (c.id === conversationId && c.members) {
          const myMem = c.members.find((m) => m.user_id === user.id);
          nextMuted = !myMem?.is_muted;
          return {
            ...c,
            members: c.members.map((m) =>
              m.user_id === user.id ? { ...m, is_muted: nextMuted } : m
            ),
          };
        }
        return c;
      }),
    }));

    toast.success(
      nextMuted ? 'Group notifications muted' : 'Group notifications unmuted'
    );

    if (!isDemoMode && isSupabaseConfigured()) {
      try {
        await supabase
          .from('conversation_members')
          .update({ is_muted: nextMuted })
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
      } catch (e) {
        console.error(e);
      }
    }
    return true;
  },

  markAsRead: async (conversationId: string) => {
    const { user, isDemoMode } = useAuthStore.getState();
    // Update local state unread count immediately
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
    }));

    if (isDemoMode || !isSupabaseConfigured() || !user) return;

    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  },

  setTyping: (conversationId: string, isTyping: boolean) => {
    const channel = get().realtimeChannel;
    const { profile } = useAuthStore.getState();
    if (!channel || !profile) return;

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversationId,
        username: profile.display_name,
        isTyping,
      },
    });
  },

  subscribeToConversation: (conversationId: string) => {
    get().unsubscribeFromConversation();
    if (!isSupabaseConfigured() || useAuthStore.getState().isDemoMode) return;

    const channel = supabase.channel(`conversation:${conversationId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch sender details
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          const completeMsg = { ...newMsg, sender: sender || undefined };

          set((state) => {
            const list = state.messages[conversationId] || [];
            // Check if already in list
            if (list.some((m) => m.id === completeMsg.id)) return state;
            return {
              messages: {
                ...state.messages,
                [conversationId]: [...list, completeMsg],
              },
            };
          });

          // Update last message in conversations list
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    last_message: completeMsg,
                    last_message_at: completeMsg.created_at,
                  }
                : c
            ),
          }));
        }
      )
      .on('broadcast', { event: 'typing' }, (event) => {
        const { username, isTyping } = event.payload || {};
        if (!username) return;

        set((state) => {
          const currentTypers = state.typingUsers[conversationId] || [];
          const updated = isTyping
            ? Array.from(new Set([...currentTypers, username]))
            : currentTypers.filter((u) => u !== username);

          return {
            typingUsers: { ...state.typingUsers, [conversationId]: updated },
          };
        });
      })
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribeFromConversation: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  },
}));
