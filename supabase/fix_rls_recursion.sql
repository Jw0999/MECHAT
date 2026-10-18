-- ====================================================================
-- FIX: Eliminate RLS Infinite Recursion on conversation_members
-- Run this in your Supabase SQL Editor
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

-- 2. Update Conversations Policies
DROP POLICY IF EXISTS "Users can view conversations they belong to" ON public.conversations;
CREATE POLICY "Users can view conversations they belong to"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(id));

DROP POLICY IF EXISTS "Conversation admins or members can update conversation info" ON public.conversations;
CREATE POLICY "Conversation admins or members can update conversation info"
    ON public.conversations FOR UPDATE
    TO authenticated
    USING (public.is_conversation_member(id));

-- 3. Update Conversation Members Policies
DROP POLICY IF EXISTS "Members can view membership of their conversations" ON public.conversation_members;
CREATE POLICY "Members can view membership of their conversations"
    ON public.conversation_members FOR SELECT
    TO authenticated
    USING (public.is_conversation_member(conversation_id));

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
