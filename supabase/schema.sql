-- PickleRally Supabase Schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- WARNING: This DROPS existing tables. Back up data first.

-- Enable PostGIS (for location queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================
-- DROP existing tables (order matters: children first)
-- CASCADE also drops triggers on those tables
-- ============================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_room_members CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.event_registrations CASCADE;
DROP TABLE IF EXISTS public.friend_requests CASCADE;
DROP TABLE IF EXISTS public.friendships CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;

-- Drop functions (triggers are removed with tables; functions remain)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.set_events_location_point();
DROP FUNCTION IF EXISTS public.set_players_location_point();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================
-- Profiles (linked to auth.users)
-- ============================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  skill TEXT,
  location TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  bio TEXT,
  game_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================
-- Events (with creator)
-- ============================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('open', 'league', 'tournament')),
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_point GEOGRAPHY(POINT, 4326),
  max_players INTEGER NOT NULL DEFAULT 16,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event registrations (who joined)
CREATE TABLE public.event_registrations (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- ============================
-- Players (directory, can link to auth user)
-- ============================
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  skill TEXT NOT NULL,
  location TEXT NOT NULL,
  avatar_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_point GEOGRAPHY(POINT, 4326),
  game_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- Friend requests
-- ============================
CREATE TABLE public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_user_id, to_user_id)
);

-- Friendships (bidirectional)
CREATE TABLE public.friendships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id < friend_id)
);

-- ============================
-- Notifications
-- ============================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================
-- Chat rooms
-- ============================
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_group BOOLEAN NOT NULL DEFAULT false,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_room_members (
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_room_created ON public.messages (room_id, created_at);

-- ============================
-- Location triggers (PostGIS)
-- ============================
CREATE OR REPLACE FUNCTION public.set_events_location_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_point := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_events_location_point
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_events_location_point();

CREATE OR REPLACE FUNCTION public.set_players_location_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location_point := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_players_location_point
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_players_location_point();

-- ============================
-- RLS policies
-- ============================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: read all, update own
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Events: read all, insert/update/delete when authenticated
CREATE POLICY "Anyone can read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert events" ON public.events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update events" ON public.events FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete events" ON public.events FOR DELETE USING (auth.role() = 'authenticated');

-- Event registrations
CREATE POLICY "Anyone can read event_registrations" ON public.event_registrations FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert event_registrations" ON public.event_registrations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Players: read all, insert/update when authenticated
CREATE POLICY "Anyone can read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert players" ON public.players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update players" ON public.players FOR UPDATE USING (auth.role() = 'authenticated');

-- Friend requests
CREATE POLICY "Users can read own friend_requests" ON public.friend_requests
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can insert friend_requests" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Recipients can update friend_requests" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Friendships
CREATE POLICY "Users can read own friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- Notifications
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Chat rooms: members can view their rooms
CREATE POLICY "members can view their rooms" ON public.chat_rooms
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members m
    WHERE m.room_id = chat_rooms.id AND m.user_id = auth.uid()
  )
);
CREATE POLICY "Authenticated can create rooms" ON public.chat_rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Chat room members
CREATE POLICY "members can view room members" ON public.chat_room_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members m
    WHERE m.room_id = chat_room_members.room_id AND m.user_id = auth.uid()
  )
);
CREATE POLICY "Authenticated can join rooms" ON public.chat_room_members
FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Messages
CREATE POLICY "members can read messages" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_room_members m
    WHERE m.room_id = messages.room_id AND m.user_id = auth.uid()
  )
);
CREATE POLICY "members can send messages" ON public.messages
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_room_members m
    WHERE m.room_id = messages.room_id AND m.user_id = auth.uid()
  )
  AND sender_id = auth.uid()
);

-- ============================
-- Storage bucket for avatars (run in Supabase Dashboard or via API)
-- Create bucket: avatars, public
-- RLS: allow authenticated upload, public read
-- ============================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- CREATE POLICY "Avatar upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
-- CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
