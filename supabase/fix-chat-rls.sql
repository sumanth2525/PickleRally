-- Fix two issues:
-- 1. RLS violation on chat_rooms INSERT (use auth.uid() IS NOT NULL)
-- 2. Infinite recursion in chat_room_members policies (use SECURITY DEFINER helper)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ===========================================
-- 1. Create helper function (avoids recursion)
-- ===========================================
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

-- ===========================================
-- 2. Fix chat_rooms policies
-- ===========================================
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Allow signed-in users to create rooms
DROP POLICY IF EXISTS "Authenticated can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "allow_authenticated_insert_chat_rooms" ON public.chat_rooms;
CREATE POLICY "allow_authenticated_insert_chat_rooms" ON public.chat_rooms
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "members can view their rooms" ON public.chat_rooms;
CREATE POLICY "members can view their rooms" ON public.chat_rooms
FOR SELECT USING (public.is_room_member(chat_rooms.id, auth.uid()));

-- ===========================================
-- 3. Fix chat_room_members policies (no recursion)
-- ===========================================
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can view room members" ON public.chat_room_members;
CREATE POLICY "members can view room members" ON public.chat_room_members
FOR SELECT USING (public.is_room_member(chat_room_members.room_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can join rooms" ON public.chat_room_members;
CREATE POLICY "Authenticated can join rooms" ON public.chat_room_members
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ===========================================
-- 4. Fix messages policies (use helper)
-- ===========================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read messages" ON public.messages;
CREATE POLICY "members can read messages" ON public.messages
FOR SELECT USING (public.is_room_member(messages.room_id, auth.uid()));

DROP POLICY IF EXISTS "members can send messages" ON public.messages;
CREATE POLICY "members can send messages" ON public.messages
FOR INSERT WITH CHECK (
  public.is_room_member(messages.room_id, auth.uid()) AND sender_id = auth.uid()
);
