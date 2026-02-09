-- Haven: Kids & Groups/Circles Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- KIDS PROFILES
-- ============================================

create table public.kids (
  id uuid default gen_random_uuid() primary key,
  family_id uuid references public.profiles(id) on delete cascade not null,
  display_name text, -- optional, can be null for privacy
  birth_year integer not null,
  interests text[] default '{}',
  notes text, -- anything the parent wants to share (learning style, etc.)
  is_visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for finding kids by family
create index kids_family_id_idx on public.kids(family_id);

-- Index for age-based searches
create index kids_birth_year_idx on public.kids(birth_year);

-- RLS policies for kids
alter table public.kids enable row level security;

-- Anyone can view visible kids (for discovery)
create policy "Visible kids are viewable by authenticated users"
  on public.kids for select
  using (auth.role() = 'authenticated' and is_visible = true);

-- Families can view all their own kids (even hidden ones)
create policy "Users can view own kids"
  on public.kids for select
  using (auth.uid() = family_id);

-- Families can insert their own kids
create policy "Users can insert own kids"
  on public.kids for insert
  with check (auth.uid() = family_id);

-- Families can update their own kids
create policy "Users can update own kids"
  on public.kids for update
  using (auth.uid() = family_id);

-- Families can delete their own kids
create policy "Users can delete own kids"
  on public.kids for delete
  using (auth.uid() = family_id);


-- ============================================
-- GROUPS / CIRCLES
-- ============================================

-- Group types enum
create type public.group_type as enum ('location', 'interest', 'age', 'other');

create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null, -- URL-friendly name
  description text,
  group_type public.group_type default 'other',
  cover_image_url text,
  is_private boolean default false, -- private = request to join
  location_suburb text, -- for location-based groups
  location_state text,
  age_range_min integer, -- for age-based groups
  age_range_max integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for searching groups
create index groups_name_idx on public.groups using gin (to_tsvector('english', name));
create index groups_type_idx on public.groups(group_type);
create index groups_location_idx on public.groups(location_state, location_suburb);

-- RLS policies for groups
alter table public.groups enable row level security;

-- Anyone authenticated can view public groups
create policy "Public groups are viewable"
  on public.groups for select
  using (auth.role() = 'authenticated' and is_private = false);

-- Members can view private groups they belong to
create policy "Members can view private groups"
  on public.groups for select
  using (
    auth.role() = 'authenticated' 
    and is_private = true 
    and exists (
      select 1 from public.group_members 
      where group_id = groups.id 
      and user_id = auth.uid()
      and status = 'active'
    )
  );

-- Anyone authenticated can create groups
create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.role() = 'authenticated' and auth.uid() = created_by);

-- Only group admins can update
create policy "Admins can update groups"
  on public.groups for update
  using (
    exists (
      select 1 from public.group_members 
      where group_id = groups.id 
      and user_id = auth.uid() 
      and role = 'admin'
    )
  );

-- Only group admins can delete
create policy "Admins can delete groups"
  on public.groups for delete
  using (
    exists (
      select 1 from public.group_members 
      where group_id = groups.id 
      and user_id = auth.uid() 
      and role = 'admin'
    )
  );


-- ============================================
-- GROUP MEMBERS
-- ============================================

create type public.member_role as enum ('admin', 'moderator', 'member');
create type public.member_status as enum ('active', 'pending', 'banned');

create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role public.member_role default 'member',
  status public.member_status default 'active',
  joined_at timestamptz default now(),
  
  -- Prevent duplicate memberships
  unique(group_id, user_id)
);

-- Indexes for common queries
create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx on public.group_members(user_id);
create index group_members_status_idx on public.group_members(status);

-- RLS policies for group_members
alter table public.group_members enable row level security;

-- Members can see other members of groups they belong to
create policy "Members can view group members"
  on public.group_members for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.group_members as my_membership
      where my_membership.group_id = group_members.group_id
      and my_membership.user_id = auth.uid()
      and my_membership.status = 'active'
    )
  );

-- Users can view their own memberships
create policy "Users can view own memberships"
  on public.group_members for select
  using (auth.uid() = user_id);

-- Anyone can request to join (insert themselves as pending for private, active for public)
create policy "Users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

-- Admins can update member status/role
create policy "Admins can manage members"
  on public.group_members for update
  using (
    exists (
      select 1 from public.group_members as admin_check
      where admin_check.group_id = group_members.group_id
      and admin_check.user_id = auth.uid()
      and admin_check.role = 'admin'
    )
  );

-- Users can remove themselves, admins can remove others
create policy "Users can leave or admins can remove"
  on public.group_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.group_members as admin_check
      where admin_check.group_id = group_members.group_id
      and admin_check.user_id = auth.uid()
      and admin_check.role = 'admin'
    )
  );


-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get a kid's age from birth year
create or replace function public.get_kid_age(birth_year integer)
returns integer as $$
begin
  return extract(year from now())::integer - birth_year;
end;
$$ language plpgsql immutable;

-- Function to auto-add creator as admin when group is created
create or replace function public.handle_new_group()
returns trigger as $$
begin
  insert into public.group_members (group_id, user_id, role, status)
  values (new.id, new.created_by, 'admin', 'active');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to auto-add creator as admin
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- Function to generate slug from group name
create or replace function public.generate_group_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter integer := 0;
begin
  -- Create base slug from name
  base_slug := lower(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  
  -- Check for uniqueness, add number if needed
  while exists (select 1 from public.groups where slug = final_slug and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;
  
  new.slug := final_slug;
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-generate slug
create trigger generate_slug_before_insert
  before insert or update of name on public.groups
  for each row execute procedure public.generate_group_slug();


-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Reusable function for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_kids_updated_at
  before update on public.kids
  for each row execute procedure public.handle_updated_at();

create trigger set_groups_updated_at
  before update on public.groups
  for each row execute procedure public.handle_updated_at();
