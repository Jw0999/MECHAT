-- ====================================================================
-- MASTER FIX: RLS Policies, Group Creation, and Realtime Replication
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pceftrjxczfkyvdpoybv/sql/new
-- ====================================================================

-- 1. Helper function with SECURITY DEFINER to bypass RLS recursion cleanly
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, u_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.conversation_members
        WHERE conversation_id = conv_id
          AND user_id = u_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Update Conversations Policies (Permit creator to view and insert)
DROP POLICY IF EXISTS "Users can view conversations they belong to" ON public.conversations;
CREATE POLICY "Users can view conversations they belong to"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (created_by = auth.uid() OR public.is_conversation_member(id));

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
    ON public.conversations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

DROP POLICY IF EXISTS "Conversation admins or members can update conversation info" ON public.conversations;
CREATE POLICY "Conversation admins or members can update conversation info"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid() OR public.is_conversation_member(id));

-- 3. Update Conversation Members Policies
DROP POLICY IF EXISTS "Members can view membership of their conversations" ON public.conversation_members;
CREATE POLICY "Members can view membership of their conversations"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Authenticated users can join or be added to conversations" ON public.conversation_members;
CREATE POLICY "Authenticated users can join or be added to conversations"
    ON public.conversation_members FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own membership or admins can update members" ON public.conversation_members;
CREATE POLICY "Users can update their own membership or admins can update members"
    ON public.conversation_members FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Users can leave conversations or admins can remove members" ON public.conversation_members;
CREATE POLICY "Users can leave conversations or admins can remove members"
    ON public.conversation_members FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id));

-- 4. Update Messages Policies
DROP POLICY IF EXISTS "Members can read messages in their conversations" ON public.messages;
CREATE POLICY "Members can read messages in their conversations"
    ON public.messages FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Members can insert messages into their conversations" ON public.messages;
CREATE POLICY "Members can insert messages into their conversations"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND public.is_conversation_member(conversation_id)
    );

DROP POLICY IF EXISTS "Senders can soft-delete or edit own messages" ON public.messages;
CREATE POLICY "Senders can soft-delete or edit own messages"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (auth.uid() = sender_id);

-- 5. Set REPLICA IDENTITY FULL for instant Realtime change dispatches
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;

-- 6. Add all tables to supabase_realtime publication
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
END $$;
