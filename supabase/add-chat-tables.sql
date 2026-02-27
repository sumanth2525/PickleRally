-- Add chat_rooms and messages if missing (run in Supabase SQL Editor)
-- Use this if your schema doesn't have these tables yet.

-- Chat rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_group BOOLEAN NOT NULL DEFAULT false,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat room members
CREATE TABLE IF NOT EXISTS public.chat_room_members (
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON public.messages (room_id, created_at);

-- RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper to check room membership (avoids infinite recursion in policies)
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

-- Policies (idempotent: drop if exists, then create)
DROP POLICY IF EXISTS "members can view their rooms" ON public.chat_rooms;
CREATE POLICY "members can view their rooms" ON public.chat_rooms
FOR SELECT USING (public.is_room_member(chat_rooms.id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can create rooms" ON public.chat_rooms;
CREATE POLICY "Authenticated can create rooms" ON public.chat_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "members can view room members" ON public.chat_room_members;
CREATE POLICY "members can view room members" ON public.chat_room_members
FOR SELECT USING (public.is_room_member(chat_room_members.room_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can join rooms" ON public.chat_room_members;
CREATE POLICY "Authenticated can join rooms" ON public.chat_room_members
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "members can read messages" ON public.messages;
CREATE POLICY "members can read messages" ON public.messages
FOR SELECT USING (public.is_room_member(messages.room_id, auth.uid()));

DROP POLICY IF EXISTS "members can send messages" ON public.messages;
CREATE POLICY "members can send messages" ON public.messages
FOR INSERT WITH CHECK (
  public.is_room_member(messages.room_id, auth.uid()) AND sender_id = auth.uid()
);
