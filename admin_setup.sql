-- Admin Centre Database Setup
-- Run this in Supabase SQL Editor

-- Add admin role to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- Create notifications/announcements table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'announcement', -- announcement, system, warning
    target_type text DEFAULT 'all', -- all, user, location
    target_value text, -- user_id or location name if targeted
    sent_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    is_sent boolean DEFAULT false
);

-- Create user_notifications junction table
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
    read_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, notification_id)
);

-- Enable RLS on new tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications (admins can manage, users can read their own)
CREATE POLICY "Admins can manage notifications" ON public.notifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

CREATE POLICY "Users can read sent notifications" ON public.notifications
    FOR SELECT USING (is_sent = true);

CREATE POLICY "Users can manage their notification status" ON public.user_notifications
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can see all user notifications" ON public.user_notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.is_admin = true
        )
    );

-- Make the first user (you) an admin - UPDATE THIS EMAIL!
-- Replace 'your-email@example.com' with your actual email address
UPDATE public.profiles 
SET is_admin = true, is_banned = false
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);

-- Create admin stats view
CREATE OR REPLACE VIEW public.admin_stats AS
SELECT 
    (SELECT COUNT(*) FROM public.profiles WHERE COALESCE(is_banned, false) = false) as total_active_users,
    (SELECT COUNT(*) FROM public.profiles WHERE created_at > now() - interval '7 days') as new_users_this_week,
    (SELECT COUNT(*) FROM public.conversations WHERE created_at > now() - interval '24 hours') as conversations_today,
    (SELECT COUNT(*) FROM public.messages WHERE created_at > now() - interval '24 hours') as messages_today,
    (SELECT COUNT(*) FROM public.profiles WHERE COALESCE(is_banned, false) = true) as banned_users,
    (SELECT COUNT(*) FROM public.notifications WHERE created_at > now() - interval '30 days') as announcements_this_month;

-- Grant admin view access
GRANT SELECT ON public.admin_stats TO authenticated;

-- Add admin RLS policy to profiles for full access
CREATE POLICY "Admins can see all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles as admin_profiles
            WHERE admin_profiles.id = auth.uid() 
            AND admin_profiles.is_admin = true
        )
    );

CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles as admin_profiles
            WHERE admin_profiles.id = auth.uid() 
            AND admin_profiles.is_admin = true
        )
    );