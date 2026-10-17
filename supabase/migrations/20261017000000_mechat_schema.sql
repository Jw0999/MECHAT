-- MeChat Complete Supabase PostgreSQL Schema Migration
-- Production-ready schema with RLS, Realtime publication, indexes, and triggers

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    online_status TEXT DEFAULT 'offline' CHECK (online_status IN ('online', 'offline', 'away')),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    privacy_online BOOLEAN DEFAULT TRUE,
    privacy_last_seen BOOLEAN DEFAULT TRUE,
    privacy_read_receipts BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching users by username or display name
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- 3. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    title TEXT,
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- 4. CONVERSATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    is_favorite BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_conv ON public.conversation_members(conversation_id);

-- 5. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'file', 'call_log')),
    reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- 6. CALL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
    status TEXT NOT NULL CHECK (status IN ('missed', 'completed', 'declined', 'busy', 'cancelled')),
    duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver ON public.call_logs(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_started ON public.call_logs(started_at DESC);

-- 7. USER SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
    notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    read_receipts BOOLEAN DEFAULT TRUE,
    presence_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
-- Anyone authenticated can view profiles (to search contacts, view chat recipient)
CREATE POLICY "Public profiles are readable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- CONVERSATION MEMBERS POLICIES
-- Users can see memberships for conversations they belong to
CREATE POLICY "Members can view membership of their conversations"
ON public.conversation_members FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
);

-- Users can add members if they are group admin or creating direct chat
CREATE POLICY "Users can join or create conversation memberships"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    ) OR
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = public.conversation_members.conversation_id
        AND c.created_by = auth.uid()
    )
);

-- Users can update their own membership (e.g. favorite, muted, last_read_at)
CREATE POLICY "Users can update own membership state"
ON public.conversation_members FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can leave conversation or admin can remove
CREATE POLICY "Users can leave conversation or admin remove"
ON public.conversation_members FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);

-- CONVERSATIONS POLICIES
-- Users can view conversations they belong to
CREATE POLICY "Users can view their conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.conversations.id
        AND cm.user_id = auth.uid()
    )
);

-- Any authenticated user can create a new conversation
CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Admins or creator can update conversation details (title, avatar)
CREATE POLICY "Authorized members can update conversation"
ON public.conversations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.conversations.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    ) OR created_by = auth.uid()
);

-- MESSAGES POLICIES
-- Members of conversation can read messages
CREATE POLICY "Members can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.messages.conversation_id
        AND cm.user_id = auth.uid()
    )
);

-- Members can insert messages in their conversations as themselves
CREATE POLICY "Members can insert messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = public.messages.conversation_id
        AND cm.user_id = auth.uid()
    )
);

-- Senders can update/soft-delete their own messages
CREATE POLICY "Senders can update own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid());

-- CALL LOGS POLICIES
-- Participants can view their call logs
CREATE POLICY "Participants can view their call logs"
ON public.call_logs FOR SELECT
TO authenticated
USING (caller_id = auth.uid() OR receiver_id = auth.uid());

-- Caller can create call log
CREATE POLICY "Caller can insert call log"
ON public.call_logs FOR INSERT
TO authenticated
WITH CHECK (caller_id = auth.uid());

-- Participants can update call log (e.g. status, duration upon end)
CREATE POLICY "Participants can update call log"
ON public.call_logs FOR UPDATE
TO authenticated
USING (caller_id = auth.uid() OR receiver_id = auth.uid());

-- USER SETTINGS POLICIES
CREATE POLICY "Users can read own settings"
ON public.user_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
ON public.user_settings FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ==========================================
-- DATABASE FUNCTIONS & TRIGGERS
-- ==========================================

-- Function to handle new user registration automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    clean_username TEXT;
    base_name TEXT;
BEGIN
    base_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
    clean_username := lower(regexp_replace(base_name, '[^a-zA-Z0-9_]', '', 'g'));
    
    -- Ensure clean username is not empty
    IF clean_username = '' THEN
        clean_username := 'user_' || substr(new.id::text, 1, 8);
    END IF;

    -- Avoid conflicts by appending random suffix if needed
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
        clean_username := clean_username || '_' || substr(new.id::text, 1, 4);
    END IF;

    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        new.id,
        clean_username,
        base_name,
        COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    );

    INSERT INTO public.user_settings (user_id)
    VALUES (new.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get or create a 1-on-1 direct conversation cleanly
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(target_user_id UUID)
RETURNS UUID AS $$
DECLARE
    conv_id UUID;
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF current_uid = target_user_id THEN
        RAISE EXCEPTION 'Cannot start conversation with yourself';
    END IF;

    -- Look for existing direct conversation between both users
    SELECT c.id INTO conv_id
    FROM public.conversations c
    JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = current_uid
    JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = target_user_id
    WHERE c.type = 'direct'
    LIMIT 1;

    -- If not found, create new conversation and memberships atomically
    IF conv_id IS NULL THEN
        INSERT INTO public.conversations (type, created_by)
        VALUES ('direct', current_uid)
        RETURNING id INTO conv_id;

        INSERT INTO public.conversation_members (conversation_id, user_id, role)
        VALUES 
            (conv_id, current_uid, 'admin'),
            (conv_id, target_user_id, 'member');
    END IF;

    RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update conversation's last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

-- ==========================================
-- REALTIME REPLICATION ENABLEMENT
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'call_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
    END IF;
END $$;
