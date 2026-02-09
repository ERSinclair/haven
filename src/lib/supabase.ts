import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database
export type Profile = {
  id: string
  created_at: string
  updated_at: string
  name: string
  email?: string
  phone?: string
  avatar_url?: string
  location_name: string
  location_lat?: number
  location_lng?: number
  location_precision: 'suburb' | 'approximate' | 'hidden'
  kids_ages: number[]
  status: 'considering' | 'new' | 'experienced' | 'connecting'
  bio?: string
  interests: string[]
  homeschool_approach?: string
  contact_methods: string[]
  notifications_enabled: boolean
  is_verified: boolean
  is_banned: boolean
}

export type Conversation = {
  id: string
  created_at: string
  updated_at: string
  participant_1: string
  participant_2: string
  last_message_text?: string
  last_message_at?: string
  last_message_by?: string
}

export type Message = {
  id: string
  created_at: string
  conversation_id: string
  sender_id: string
  content: string
  read_at?: string
}

export type Event = {
  id: string
  created_at: string
  updated_at: string
  host_id: string
  title: string
  description?: string
  category: 'playdate' | 'learning' | 'co-op'
  event_date: string
  event_time: string
  location_name: string
  location_details?: string
  location_lat?: number
  location_lng?: number
  show_exact_location: boolean
  age_range?: string
  max_attendees?: number
  is_cancelled: boolean
}

export type EventRsvp = {
  id: string
  created_at: string
  event_id: string
  profile_id: string
  status: 'going' | 'maybe' | 'cancelled'
}
