export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OnlineStatus = 'online' | 'offline' | 'away';
export type ConversationType = 'direct' | 'group';
export type MemberRole = 'member' | 'admin';
export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'call_log';
export type CallType = 'audio' | 'video';
export type CallStatus = 'missed' | 'completed' | 'declined' | 'busy' | 'cancelled';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  online_status: OnlineStatus;
  last_seen: string;
  privacy_online: boolean;
  privacy_last_seen: boolean;
  privacy_read_receipts: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  description?: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields:
  members?: ConversationMember[];
  last_message?: Message | null;
  other_user?: Profile | null; // For direct conversations
  unread_count?: number;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  is_favorite: boolean;
  is_muted: boolean;
  last_read_at: string;
  joined_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  reply_to_message_id: string | null;
  reply_to_message?: Message | null;
  metadata: {
    file_name?: string;
    file_size?: number;
    file_url?: string;
    mime_type?: string;
    audio_duration?: number;
    image_width?: number;
    image_height?: number;
    call_type?: CallType;
    call_status?: CallStatus;
    call_duration?: number;
    [key: string]: any;
  };
  is_read: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  // Local optimistic tracking
  isSending?: boolean;
  hasFailed?: boolean;
}

export interface CallLog {
  id: string;
  conversation_id: string | null;
  caller_id: string;
  receiver_id: string | null;
  call_type: CallType;
  status: CallStatus;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  caller?: Profile;
  receiver?: Profile;
  // Group call extensions
  is_group?: boolean;
  group_title?: string;
  group_avatar_url?: string;
  group_members_count?: number;
}

export interface UserSettings {
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  notifications_enabled: boolean;
  sound_enabled: boolean;
  read_receipts: boolean;
  presence_visible: boolean;
  created_at: string;
  updated_at: string;
}
