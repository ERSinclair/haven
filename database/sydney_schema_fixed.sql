-- Haven: Sydney Database Schema (Fixed Dependencies)
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  
  -- Basic info
  email text unique,
  family_name text not null, -- "The Smith Family"
  display_name text, -- "Sarah" or "Sarah & Mike"
  bio text,
  avatar_url text,
  
  -- Location (suburb-level for privacy, never exact address)
  suburb text,
  state text,
  country text default 'Australia',
  latitude numeric(10, 7), -- suburb centroid, not home
  longitude numeric(10, 7),
  
  -- Preferences
  interests text[] default '{}',
  homeschool_style text, -- "Unschooling", "Classical", "Charlotte Mason", "Eclectic", etc.
  looking_for text[] default '{}', -- "Playdates", "Co-op", "Field trips", "Sports groups"
  
  -- Privacy settings
  show_on_map boolean default true,
  show_suburb boolean default true,
  allow_messages boolean default true,
  
  -- Status
  is_verified boolean default false,
  is_active boolean default true,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- EVENTS (create table first, policies later)
-- ============================================

create type public.event_visibility as enum ('public', 'followers', 'private', 'group');

create table public.events (
  id uuid default gen_random_uuid() primary key,
  
  -- Basic info
  title text not null,
  description text,
  cover_image_url text,
  
  -- Timing
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_all_day boolean default false,
  timezone text default 'Australia/Melbourne',
  
  -- Location
  location_name text, -- "Torquay Beach", "Jan's House"
  location_address text, -- only shown to RSVPs if host chooses
  location_suburb text,
  location_state text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  hide_exact_location boolean default true, -- show suburb only until RSVP
  
  -- Settings
  visibility public.event_visibility default 'public',
  max_attendees integer, -- null = unlimited
  rsvp_required boolean default true,
  allow_comments boolean default true,
  
  -- Host
  host_id uuid references public.profiles(id) on delete cascade not null,
  group_id uuid, -- will reference groups table once created
  
  -- Status
  is_cancelled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- EVENT RSVPs (create before events policies)
-- ============================================

create type public.rsvp_status as enum ('going', 'maybe', 'not_going', 'waitlist');

create table public.event_rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status public.rsvp_status default 'going',
  adults_count integer default 1,
  kids_count integer default 0,
  note text, -- "Bringing snacks!"
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(event_id, user_id)
);

-- ============================================
-- CONVERSATIONS (for messaging)
-- ============================================

create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz default now()
);

create table public.conversation_participants (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  is_muted boolean default false,
  joined_at timestamptz default now(),
  
  unique(conversation_id, user_id)
);

-- ============================================
-- MESSAGES
-- ============================================

create table public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null,
  is_edited boolean default false,
  is_deleted boolean default false, -- soft delete
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

create type public.notification_type as enum (
  'message',
  'event_invite',
  'event_update',
  'event_reminder',
  'rsvp',
  'group_invite',
  'group_request',
  'follow',
  'system'
);

create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type public.notification_type not null,
  title text not null,
  body text,
  data jsonb default '{}', -- flexible payload (event_id, message_id, etc.)
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Profiles indexes
create index profiles_location_idx on public.profiles(state, suburb);
create index profiles_coords_idx on public.profiles(latitude, longitude) where show_on_map = true;
create index profiles_interests_idx on public.profiles using gin(interests);

-- Events indexes
create index events_starts_at_idx on public.events(starts_at);
create index events_host_idx on public.events(host_id);
create index events_location_idx on public.events(location_state, location_suburb);
create index events_visibility_idx on public.events(visibility) where is_cancelled = false;

-- RSVP indexes
create index event_rsvps_event_idx on public.event_rsvps(event_id);
create index event_rsvps_user_idx on public.event_rsvps(user_id);

-- Conversation indexes
create index conv_participants_conv_idx on public.conversation_participants(conversation_id);
create index conv_participants_user_idx on public.conversation_participants(user_id);

-- Message indexes
create index messages_conversation_idx on public.messages(conversation_id, created_at desc);
create index messages_sender_idx on public.messages(sender_id);

-- Notification indexes
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where is_read = false;

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- ============================================
-- PROFILES POLICIES
-- ============================================

create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================
-- EVENTS POLICIES (now safe to reference event_rsvps)
-- ============================================

create policy "Public events are viewable"
  on public.events for select
  using (
    auth.role() = 'authenticated' 
    and visibility = 'public' 
    and is_cancelled = false
  );

create policy "Users can view own events"
  on public.events for select
  using (auth.uid() = host_id);

create policy "Attendees can view events they RSVPd to"
  on public.events for select
  using (
    exists (
      select 1 from public.event_rsvps
      where event_id = events.id
      and user_id = auth.uid()
    )
  );

create policy "Users can create events"
  on public.events for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update own events"
  on public.events for update
  using (auth.uid() = host_id);

create policy "Hosts can delete own events"
  on public.events for delete
  using (auth.uid() = host_id);

-- ============================================
-- RSVP POLICIES
-- ============================================

create policy "RSVPs visible to event attendees and host"
  on public.event_rsvps for select
  using (
    auth.role() = 'authenticated'
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.events
        where id = event_rsvps.event_id
        and host_id = auth.uid()
      )
      or exists (
        select 1 from public.event_rsvps as my_rsvp
        where my_rsvp.event_id = event_rsvps.event_id
        and my_rsvp.user_id = auth.uid()
      )
    )
  );

create policy "Users can RSVP"
  on public.event_rsvps for insert
  with check (auth.uid() = user_id);

create policy "Users can update own RSVP"
  on public.event_rsvps for update
  using (auth.uid() = user_id);

create policy "Users can delete own RSVP"
  on public.event_rsvps for delete
  using (auth.uid() = user_id);

-- ============================================
-- CONVERSATION POLICIES
-- ============================================

create policy "Users can view conversations they're in"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = conversations.id
      and user_id = auth.uid()
    )
  );

create policy "Users can create conversations"
  on public.conversations for insert
  with check (auth.role() = 'authenticated');

create policy "Users can view participants of their conversations"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants as my_part
      where my_part.conversation_id = conversation_participants.conversation_id
      and my_part.user_id = auth.uid()
    )
  );

create policy "Users can add themselves to conversations"
  on public.conversation_participants for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own participation"
  on public.conversation_participants for update
  using (auth.uid() = user_id);

-- ============================================
-- MESSAGE POLICIES
-- ============================================

create policy "Users can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
      and user_id = auth.uid()
    )
  );

create policy "Users can send messages to conversations they're in"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
      and user_id = auth.uid()
    )
  );

create policy "Users can edit own messages"
  on public.messages for update
  using (auth.uid() = sender_id);

-- ============================================
-- NOTIFICATION POLICIES
-- ============================================

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "System can create notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: auto-create profile when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update conversation timestamp on new message
create or replace function public.handle_new_message()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = now(), updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.handle_new_message();

-- Updated_at trigger function (reusable)
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_events_updated_at
  before update on public.events
  for each row execute procedure public.handle_updated_at();

create trigger set_rsvps_updated_at
  before update on public.event_rsvps
  for each row execute procedure public.handle_updated_at();

create trigger set_conversations_updated_at
  before update on public.conversations
  for each row execute procedure public.handle_updated_at();

create trigger set_messages_updated_at
  before update on public.messages
  for each row execute procedure public.handle_updated_at();

-- Success message
select 'Haven Sydney database setup completed successfully!' as status;