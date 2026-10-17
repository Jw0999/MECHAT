-- ====================================================================
-- MeChat Unified Supabase Setup Script
-- Tables, RLS, Triggers, Realtime Replication & Storage Buckets
-- ====================================================================

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

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can view profiles, users can update own profile
CREATE POLICY "Public profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- User Settings
CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Conversations: Users can see conversations they are members of
CREATE POLICY "Users can view conversations they belong to"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_members.conversation_id = conversations.id
            AND conversation_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create conversations"
    ON public.conversations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Conversation admins or members can update conversation info"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_members.conversation_id = conversations.id
            AND conversation_members.user_id = auth.uid()
        )
    );

-- Conversation Members: Members can view member list of their conversations
CREATE POLICY "Members can view membership of their conversations"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members AS cm
            WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can join or be added to conversations"
    ON public.conversation_members FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update their own membership or admins can update members"
    ON public.conversation_members FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.conversation_members AS cm
            WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
        )
    );

CREATE POLICY "Users can leave conversations or admins can remove members"
    ON public.conversation_members FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.conversation_members AS cm
            WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'admin'
        )
    );

-- Messages: Members can view and post messages in their conversations
CREATE POLICY "Members can read messages in their conversations"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_members.conversation_id = messages.conversation_id
            AND conversation_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can insert messages into their conversations"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_members.conversation_id = messages.conversation_id
            AND conversation_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Senders can soft-delete or edit own messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (auth.uid() = sender_id);

-- Call Logs
CREATE POLICY "Users can view call logs they are part of"
    ON public.call_logs FOR SELECT
    TO authenticated
    USING (caller_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert call logs"
    ON public.call_logs FOR INSERT
    TO authenticated
    WITH CHECK (caller_id = auth.uid() OR receiver_id = auth.uid());

-- ====================================================================
-- FUNCTIONS & TRIGGERS
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_name TEXT;
    clean_username TEXT;
BEGIN
    base_name := COALESCE(
        new.raw_user_meta_data->>'display_name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1)
    );

    clean_username := LOWER(REGEXP_REPLACE(
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        '[^a-zA-Z0-9_]',
        '',
        'g'
    ));
    
    IF clean_username = '' THEN
        clean_username := 'user_' || substr(new.id::text, 1, 8);
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = clean_username) THEN
        clean_username := clean_username || '_' || substr(new.id::text, 1, 4);
    END IF;

    INSERT INTO public.profiles (id, username, display_name, avatar_url)
    VALUES (
        new.id,
        clean_username,
        base_name,
        COALESCE(new.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update conversation timestamp on new message
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

    SELECT c.id INTO conv_id
    FROM public.conversations c
    JOIN public.conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = current_uid
    JOIN public.conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = target_user_id
    WHERE c.type = 'direct'
    LIMIT 1;

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

-- ====================================================================
-- REALTIME REPLICATION ENABLEMENT
-- ====================================================================
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

-- ====================================================================
-- STORAGE BUCKETS SETUP
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for Avatars
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public avatar viewing" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
END $$;

CREATE POLICY "Public avatar viewing"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can view chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');
