# Tech Stack & Setup

## Overview

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | Next.js 16 + React 19 | Already built, fast, SEO-friendly |
| Styling | Tailwind CSS 4 | Already using, rapid development |
| Hosting | Vercel | Free tier, auto-deploys, edge network |
| Database | Supabase (PostgreSQL) | Free tier, real-time, auth included |
| Auth | Supabase Auth | Email + magic links, OAuth ready |
| Storage | Supabase Storage | Profile photos, event images |
| Maps | Mapbox GL JS | Free tier (50k loads/mo), good UX |
| Real-time | Supabase Realtime | Live messaging, notifications |

---

## Setup Steps

### 1. Supabase Project

1. Go to https://supabase.com
2. Create account → New Project
3. Settings:
   - Name: `haven`
   - Database password: (generate strong, save in password manager)
   - Region: **ap-southeast-2 (Sydney)**
4. Wait for project to provision (~2 min)
5. Get your keys from Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-side only)

### 2. Environment Variables

Create `.env.local` in project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Server-side only

# Mapbox (get from mapbox.com)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxxxx
```

### 3. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install mapbox-gl @types/mapbox-gl
```

### 4. Database Setup

Run the SQL from `DATABASE_SCHEMA.md` in Supabase SQL Editor:
1. Go to SQL Editor in Supabase dashboard
2. Paste and run each table creation
3. Then run the RLS policies
4. Then run the helper functions

### 5. Supabase Client Setup

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

For server components, create `src/lib/supabase-server.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const createServerClient = () => {
  const cookieStore = cookies()
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

---

## Auth Flow

### Sign Up
1. User enters email
2. Supabase sends magic link (or we use password)
3. User clicks link → logged in
4. On first login, redirect to profile setup
5. Create `profiles` row linked to `auth.users`

### Sign In
1. Magic link or email/password
2. Check if profile exists
3. If yes → discover page
4. If no → profile setup

### Profile Creation Trigger

```sql
-- Auto-create profile when user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

---

## Key Patterns

### Fetching nearby families

```typescript
const { data: families } = await supabase
  .rpc('get_nearby_families', {
    user_lat: -38.3317,
    user_lng: 144.3054,
    max_distance_km: 20
  })
```

### Real-time messages

```typescript
const channel = supabase
  .channel('messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => {
      // Add new message to UI
      setMessages(prev => [...prev, payload.new])
    }
  )
  .subscribe()
```

### Checking blocks before showing profile

```typescript
const { data: isBlocked } = await supabase
  .from('blocked_users')
  .select('id')
  .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`)
  .or(`blocker_id.eq.${theirId},blocked_id.eq.${theirId}`)
  .single()

if (isBlocked) {
  // Don't show this profile
}
```

---

## Mapbox Setup

1. Create account at https://www.mapbox.com
2. Get public access token
3. Add to `.env.local`
4. Install: `npm install mapbox-gl`

Basic map component:

```tsx
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

export function Map({ families, center }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!mapContainer.current) return
    
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [center.lng, center.lat],
      zoom: 11
    })
    
    // Add family markers
    families.forEach(family => {
      new mapboxgl.Marker()
        .setLngLat([family.lng, family.lat])
        .addTo(map)
    })
    
    return () => map.remove()
  }, [families, center])
  
  return <div ref={mapContainer} className="w-full h-full" />
}
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

Auto-deploys on every push to main.

---

## Cost Breakdown

### Free Tier Limits

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | 100GB bandwidth | $20/mo |
| Supabase | 500MB DB, 1GB storage, 50K MAU | $25/mo |
| Mapbox | 50K map loads/mo | Pay per use |

### When to upgrade

- Supabase: When approaching 500MB or need more than 50K monthly users
- Vercel: When bandwidth exceeds 100GB (lots of traffic)
- Mapbox: Unlikely to hit free tier for MVP

**Realistic MVP cost: $0-25/month**

---

## Security Checklist

- [x] RLS enabled on all tables
- [x] Service role key only on server
- [x] Anon key is public-safe (RLS protects data)
- [ ] Rate limiting (add later)
- [ ] Input validation
- [ ] Sanitize user content
- [ ] HTTPS only (Vercel handles this)
