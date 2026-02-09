# Database Schema

## Overview

Core tables for the MVP. Using Supabase (PostgreSQL) with Row Level Security (RLS) for privacy.

---

## Tables

### `profiles`
The core user/family profile. One per account.

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Basic info
  name text not null,
  email text,
  phone text,
  avatar_url text,
  
  -- Location (suburb-level, never exact)
  location_name text not null,           -- "Torquay, VIC"
  location_lat decimal(10, 8),           -- For distance calculations
  location_lng decimal(11, 8),           -- For distance calculations
  location_precision text default 'suburb', -- 'suburb' | 'approximate' | 'hidden'
  
  -- Family info
  kids_ages integer[] not null default '{}',  -- Array of ages: {2, 4, 7}
  status text not null,                       -- 'considering' | 'new' | 'experienced' | 'connecting'
  
  -- Profile details (future)
  bio text,
  interests text[] default '{}',
  homeschool_approach text,
  
  -- Contact preferences
  contact_methods text[] default '{app}',  -- 'app' | 'phone' | 'email'
  
  -- Settings
  notifications_enabled boolean default true,
  
  -- Safety
  is_verified boolean default false,
  is_banned boolean default false
);

-- Index for location-based queries
create index profiles_location_idx on profiles (location_lat, location_lng);
```

---

### `conversations`
A conversation thread between two families.

```sql
create table conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Participants (always 2 for now)
  participant_1 uuid references profiles(id) on delete cascade not null,
  participant_2 uuid references profiles(id) on delete cascade not null,
  
  -- Last message preview (denormalized for list view)
  last_message_text text,
  last_message_at timestamp with time zone,
  last_message_by uuid references profiles(id),
  
  -- Unique constraint: one conversation per pair
  unique(participant_1, participant_2)
);

-- Index for finding user's conversations
create index conversations_p1_idx on conversations (participant_1);
create index conversations_p2_idx on conversations (participant_2);
```

---

### `messages`
Individual messages within a conversation.

```sql
create table messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  
  content text not null,
  
  -- Read status
  read_at timestamp with time zone
);

-- Index for fetching conversation messages
create index messages_conversation_idx on messages (conversation_id, created_at);
```

---

### `events`
Local meetups and activities.

```sql
create table events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Host
  host_id uuid references profiles(id) on delete cascade not null,
  
  -- Event details
  title text not null,
  description text,
  category text not null,  -- 'playdate' | 'learning' | 'co-op'
  
  -- Date/time
  event_date date not null,
  event_time time not null,
  
  -- Location
  location_name text not null,           -- "Torquay Foreshore Playground"
  location_details text,                  -- "Near the big climbing frame"
  location_lat decimal(10, 8),
  location_lng decimal(11, 8),
  show_exact_location boolean default true,  -- false for private homes
  
  -- Capacity
  age_range text,
  max_attendees integer,
  
  -- Status
  is_cancelled boolean default false
);

-- Index for finding upcoming events
create index events_date_idx on events (event_date);
create index events_host_idx on events (host_id);
```

---

### `event_rsvps`
Who's attending what event.

```sql
create table event_rsvps (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  event_id uuid references events(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  
  status text default 'going',  -- 'going' | 'maybe' | 'cancelled'
  
  -- One RSVP per person per event
  unique(event_id, profile_id)
);

-- Index for counting attendees
create index rsvps_event_idx on event_rsvps (event_id);
create index rsvps_profile_idx on event_rsvps (profile_id);
```

---

### `blocked_users`
For safety - blocking other families.

```sql
create table blocked_users (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  
  unique(blocker_id, blocked_id)
);

create index blocked_users_blocker_idx on blocked_users (blocker_id);
```

---

### `reports`
For moderation - reporting inappropriate behavior.

```sql
create table reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  
  reporter_id uuid references profiles(id) on delete cascade not null,
  reported_id uuid references profiles(id) on delete cascade not null,
  
  reason text not null,
  details text,
  
  -- Admin handling
  status text default 'pending',  -- 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  reviewed_at timestamp with time zone,
  admin_notes text
);
```

---

## Row Level Security (RLS) Policies

These ensure users can only see/edit what they should.

```sql
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table events enable row level security;
alter table event_rsvps enable row level security;
alter table blocked_users enable row level security;
alter table reports enable row level security;

-- Profiles: Anyone can read (for discovery), only owner can update
create policy "Profiles are viewable by everyone" 
  on profiles for select using (true);

create policy "Users can update own profile" 
  on profiles for update using (auth.uid() = id);

-- Conversations: Only participants can view
create policy "Users can view own conversations" 
  on conversations for select 
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

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

-- RSVPs: Anyone can view, users manage their own
create policy "RSVPs are viewable by everyone" 
  on event_rsvps for select using (true);

create policy "Users can manage own RSVPs" 
  on event_rsvps for all using (auth.uid() = profile_id);

-- Blocked users: Only visible to blocker
create policy "Users can view own blocks" 
  on blocked_users for select using (auth.uid() = blocker_id);

create policy "Users can manage own blocks" 
  on blocked_users for all using (auth.uid() = blocker_id);
```

---

## Helper Functions

### Distance calculation (km)
```sql
create or replace function calculate_distance(
  lat1 decimal, lng1 decimal,
  lat2 decimal, lng2 decimal
) returns decimal as $$
  select (
    6371 * acos(
      cos(radians(lat1)) * cos(radians(lat2)) * 
      cos(radians(lng2) - radians(lng1)) + 
      sin(radians(lat1)) * sin(radians(lat2))
    )
  )::decimal;
$$ language sql immutable;
```

### Get nearby families
```sql
create or replace function get_nearby_families(
  user_lat decimal,
  user_lng decimal,
  max_distance_km decimal default 20
) returns table (
  id uuid,
  name text,
  location_name text,
  kids_ages integer[],
  status text,
  distance_km decimal
) as $$
  select 
    p.id,
    p.name,
    p.location_name,
    p.kids_ages,
    p.status,
    calculate_distance(user_lat, user_lng, p.location_lat, p.location_lng) as distance_km
  from profiles p
  where 
    p.location_lat is not null 
    and p.location_lng is not null
    and p.is_banned = false
    and calculate_distance(user_lat, user_lng, p.location_lat, p.location_lng) <= max_distance_km
  order by distance_km;
$$ language sql stable;
```

---

## Notes

- **UUID primary keys**: Better for distributed systems, no sequential guessing
- **Timestamps**: Always `with time zone` for Australian users
- **Arrays**: PostgreSQL native arrays for `kids_ages` and `interests` - simpler than join tables for MVP
- **RLS**: Row Level Security handles permissions at database level - secure by default
- **Indexes**: Added where we'll query frequently

---

## Future Additions (Post-MVP)

- `notifications` table for in-app notifications
- `family_members` if we want multiple accounts per family
- `resources` for sharing curriculum/links
- `reviews` or `endorsements` for trust building
