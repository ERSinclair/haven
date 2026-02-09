-- Haven: Safe Migration (skips existing tables)
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILES: Add missing columns if needed
-- ============================================

DO $$ 
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'family_name') THEN
    ALTER TABLE public.profiles ADD COLUMN family_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
    ALTER TABLE public.profiles ADD COLUMN display_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
    ALTER TABLE public.profiles ADD COLUMN bio text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'suburb') THEN
    ALTER TABLE public.profiles ADD COLUMN suburb text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'state') THEN
    ALTER TABLE public.profiles ADD COLUMN state text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'country') THEN
    ALTER TABLE public.profiles ADD COLUMN country text DEFAULT 'Australia';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'latitude') THEN
    ALTER TABLE public.profiles ADD COLUMN latitude numeric(10, 7);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'longitude') THEN
    ALTER TABLE public.profiles ADD COLUMN longitude numeric(10, 7);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'interests') THEN
    ALTER TABLE public.profiles ADD COLUMN interests text[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'homeschool_style') THEN
    ALTER TABLE public.profiles ADD COLUMN homeschool_style text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'looking_for') THEN
    ALTER TABLE public.profiles ADD COLUMN looking_for text[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'show_on_map') THEN
    ALTER TABLE public.profiles ADD COLUMN show_on_map boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'show_suburb') THEN
    ALTER TABLE public.profiles ADD COLUMN show_suburb boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'allow_messages') THEN
    ALTER TABLE public.profiles ADD COLUMN allow_messages boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_verified') THEN
    ALTER TABLE public.profiles ADD COLUMN is_verified boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE public.profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen_at') THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen_at timestamptz DEFAULT now();
  END IF;
END $$;


-- ============================================
-- EVENTS
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.event_visibility AS ENUM ('public', 'followers', 'private', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  cover_image_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_all_day boolean default false,
  timezone text default 'Australia/Melbourne',
  location_name text,
  location_address text,
  location_suburb text,
  location_state text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  hide_exact_location boolean default true,
  visibility public.event_visibility default 'public',
  max_attendees integer,
  rsvp_required boolean default true,
  allow_comments boolean default true,
  host_id uuid references public.profiles(id) on delete cascade not null,
  group_id uuid,
  is_cancelled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS events_host_idx ON public.events(host_id);
CREATE INDEX IF NOT EXISTS events_location_idx ON public.events(location_state, location_suburb);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies (safe - just permissions)
DROP POLICY IF EXISTS "Public events are viewable" ON public.events;
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Attendees can view events they RSVPd to" ON public.events;
DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Hosts can update own events" ON public.events;
DROP POLICY IF EXISTS "Hosts can delete own events" ON public.events;

CREATE POLICY "Public events are viewable" ON public.events FOR SELECT
  USING (auth.role() = 'authenticated' AND visibility = 'public' AND is_cancelled = false);

CREATE POLICY "Users can view own events" ON public.events FOR SELECT
  USING (auth.uid() = host_id);

CREATE POLICY "Users can create events" ON public.events FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own events" ON public.events FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own events" ON public.events FOR DELETE
  USING (auth.uid() = host_id);


-- ============================================
-- EVENT RSVPs
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.rsvp_status AS ENUM ('going', 'maybe', 'not_going', 'waitlist');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status public.rsvp_status default 'going',
  adults_count integer default 1,
  kids_count integer default 0,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_idx ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS event_rsvps_user_idx ON public.event_rsvps(user_id);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RSVPs visible to event attendees and host" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can delete own RSVP" ON public.event_rsvps;

CREATE POLICY "Users can RSVP" ON public.event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVP" ON public.event_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVP" ON public.event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "RSVPs visible to event attendees and host" ON public.event_rsvps FOR SELECT
  USING (auth.role() = 'authenticated' AND (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_rsvps.event_id AND host_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_rsvps AS my_rsvp WHERE my_rsvp.event_id = event_rsvps.event_id AND my_rsvp.user_id = auth.uid())
  ));

-- Add policy for viewing events you've RSVPd to
DROP POLICY IF EXISTS "Attendees can view events they RSVPd to" ON public.events;
CREATE POLICY "Attendees can view events they RSVPd to" ON public.events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.event_rsvps WHERE event_id = events.id AND user_id = auth.uid()));


-- ============================================
-- CONVERSATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  is_muted boolean default false,
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conv_participants_conv_idx ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS conv_participants_user_idx ON public.conversation_participants(user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view conversations they're in" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Users can view conversations they're in" ON public.conversations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND user_id = auth.uid()));

CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.conversation_participants;

CREATE POLICY "Users can view participants of their conversations" ON public.conversation_participants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversation_participants AS my_part WHERE my_part.conversation_id = conversation_participants.conversation_id AND my_part.user_id = auth.uid()));

CREATE POLICY "Users can add themselves to conversations" ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" ON public.conversation_participants FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================
-- MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null,
  is_edited boolean default false,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id, created_at desc);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to conversations they're in" ON public.messages;
DROP POLICY IF EXISTS "Users can edit own messages" ON public.messages;

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users can send messages to conversations they're in" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()));

CREATE POLICY "Users can edit own messages" ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);


-- ============================================
-- NOTIFICATIONS
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('message', 'event_invite', 'event_update', 'event_reminder', 'rsvp', 'group_invite', 'group_request', 'follow', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type public.notification_type not null,
  title text not null,
  body text,
  data jsonb default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at desc);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');


-- ============================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = now(), updated_at = now() WHERE id = new.conversation_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers only if they don't exist
DROP TRIGGER IF EXISTS set_events_updated_at ON public.events;
CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_rsvps_updated_at ON public.event_rsvps;
CREATE TRIGGER set_rsvps_updated_at BEFORE UPDATE ON public.event_rsvps FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created AFTER INSERT ON public.messages FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message();
