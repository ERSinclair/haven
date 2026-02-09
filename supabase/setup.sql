-- =============================================
-- Haven Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. PROFILES TABLE
-- =============================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  name text not null,
  email text,
  phone text,
  avatar_url text,
  
  location_name text not null,
  location_lat decimal(10, 8),
  location_lng decimal(11, 8),
  location_precision text default 'suburb' check (location_precision in ('suburb', 'approximate', 'hidden')),
  
  kids_ages integer[] not null default '{}',
  status text not null check (status in ('considering', 'new', 'experienced', 'connecting')),
  
  bio text,
  interests text[] default '{}',
  homeschool_approach text,
  
  contact_methods text[] default '{app}',
  notifications_enabled boolean default true,
  
  is_verified boolean default false,
  is_banned boolean default false
);

create index if not exists profiles_location_idx on profiles (location_lat, location_lng);

-- 2. CONVERSATIONS TABLE
-- =============================================
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  participant_1 uuid references profiles(id) on delete cascade not null,
  participant_2 uuid references profiles(id) on delete cascade not null,
  
  last_message_text text,
  last_message_at timestamp with time zone,
  last_message_by uuid references profiles(id),
  
  unique(participant_1, participant_2)
);

create index if not exists conversations_p1_idx on conversations (participant_1);
create index if not exists conversations_p2_idx on conversations (participant_2);

-- 3. MESSAGES TABLE
-- =============================================
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  
  content text not null,
  read_at timestamp with time zone
);

create index if not exists messages_conversation_idx on messages (conversation_id, created_at);

-- 4. EVENTS TABLE
-- =============================================
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  host_id uuid references profiles(id) on delete cascade not null,
  
  title text not null,
  description text,
  category text not null check (category in ('playdate', 'learning', 'co-op')),
  
  event_date date not null,
  event_time time not null,
  
  location_name text not null,
  location_details text,
  location_lat decimal(10, 8),
  location_lng decimal(11, 8),
  show_exact_location boolean default true,
  
  age_range text,
  max_attendees integer,
  
  is_cancelled boolean default false
);

create index if not exists events_date_idx on events (event_date);
create index if not exists events_host_idx on events (host_id);

-- 5. EVENT RSVPS TABLE
-- =============================================
create table if not exists event_rsvps (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  event_id uuid references events(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  
  status text default 'going' check (status in ('going', 'maybe', 'cancelled')),
  
  unique(event_id, profile_id)
);

create index if not exists rsvps_event_idx on event_rsvps (event_id);
create index if not exists rsvps_profile_idx on event_rsvps (profile_id);

-- 6. BLOCKED USERS TABLE
-- =============================================
create table if not exists blocked_users (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  
  unique(blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_idx on blocked_users (blocker_id);

-- 7. REPORTS TABLE
-- =============================================
create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  reporter_id uuid references profiles(id) on delete cascade not null,
  reported_id uuid references profiles(id) on delete cascade not null,
  
  reason text not null,
  details text,
  
  status text default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_at timestamp with time zone,
  admin_notes text
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table blocked_users enable row level security;
alter table reports enable row level security;

-- Profiles: Anyone can read, only owner can update
create policy "Profiles are viewable by everyone" 
  on profiles for select using (true);

create policy "Users can insert own profile" 
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile" 
  on profiles for update using (auth.uid() = id);

-- Conversations: Only participants can view
create policy "Users can view own conversations" 
  on conversations for select 
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

create policy "Users can create conversations" 
  on conversations for insert 
  with check (auth.uid() = participant_1 or auth.uid() = participant_2);

-- Messages: Only conversation participants can view/send
create policy "Users can view messages in their conversations" 
  on messages for select 
  using (
    conversation_id in (
      select id from conversations 
      where participant_1 = auth.uid() or participant_2 = auth.uid()
    )
  );

create policy "Users can send messages to their conversations" 
  on messages for insert 
  with check (
    sender_id = auth.uid() and
    conversation_id in (
      select id from conversations 
      where participant_1 = auth.uid() or participant_2 = auth.uid()
    )
  );

-- Events: Anyone can view, only host can update/delete
create policy "Events are viewable by everyone" 
  on events for select using (true);

create policy "Users can create events" 
  on events for insert with check (auth.uid() = host_id);

create policy "Hosts can update own events" 
  on events for update using (auth.uid() = host_id);

create policy "Hosts can delete own events" 
  on events for delete using (auth.uid() = host_id);

-- RSVPs: Anyone can view, users manage their own
create policy "RSVPs are viewable by everyone" 
  on event_rsvps for select using (true);

create policy "Users can create own RSVPs" 
  on event_rsvps for insert with check (auth.uid() = profile_id);

create policy "Users can update own RSVPs" 
  on event_rsvps for update using (auth.uid() = profile_id);

create policy "Users can delete own RSVPs" 
  on event_rsvps for delete using (auth.uid() = profile_id);

-- Blocked users: Only visible to blocker
create policy "Users can view own blocks" 
  on blocked_users for select using (auth.uid() = blocker_id);

create policy "Users can create blocks" 
  on blocked_users for insert with check (auth.uid() = blocker_id);

create policy "Users can delete own blocks" 
  on blocked_users for delete using (auth.uid() = blocker_id);

-- Reports: Only reporter can view their own (admins via service role)
create policy "Users can view own reports" 
  on reports for select using (auth.uid() = reporter_id);

create policy "Users can create reports" 
  on reports for insert with check (auth.uid() = reporter_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Distance calculation (km) using Haversine formula
create or replace function calculate_distance(
  lat1 decimal, lng1 decimal,
  lat2 decimal, lng2 decimal
) returns decimal as $$
  select (
    6371 * acos(
      least(1.0, 
        cos(radians(lat1)) * cos(radians(lat2)) * 
        cos(radians(lng2) - radians(lng1)) + 
        sin(radians(lat1)) * sin(radians(lat2))
      )
    )
  )::decimal;
$$ language sql immutable;

-- Get nearby families (excludes banned users and self)
create or replace function get_nearby_families(
  user_lat decimal,
  user_lng decimal,
  max_distance_km decimal default 20,
  current_user_id uuid default null
) returns table (
  id uuid,
  name text,
  location_name text,
  location_precision text,
  kids_ages integer[],
  status text,
  bio text,
  interests text[],
  is_verified boolean,
  distance_km decimal
) as $$
  select 
    p.id,
    p.name,
    p.location_name,
    p.location_precision,
    p.kids_ages,
    p.status,
    p.bio,
    p.interests,
    p.is_verified,
    round(calculate_distance(user_lat, user_lng, p.location_lat, p.location_lng)::numeric, 1) as distance_km
  from profiles p
  where 
    p.location_lat is not null 
    and p.location_lng is not null
    and p.is_banned = false
    and (current_user_id is null or p.id != current_user_id)
    and p.location_precision != 'hidden'
    and calculate_distance(user_lat, user_lng, p.location_lat, p.location_lng) <= max_distance_km
  order by distance_km;
$$ language sql stable;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

create trigger conversations_updated_at
  before update on conversations
  for each row execute procedure update_updated_at();

create trigger events_updated_at
  before update on events
  for each row execute procedure update_updated_at();

-- Update conversation last_message when message is inserted
create or replace function update_conversation_last_message()
returns trigger as $$
begin
  update conversations
  set 
    last_message_text = new.content,
    last_message_at = new.created_at,
    last_message_by = new.sender_id,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

create trigger on_message_insert
  after insert on messages
  for each row execute procedure update_conversation_last_message();

-- =============================================
-- DONE! Your database is ready.
-- =============================================
