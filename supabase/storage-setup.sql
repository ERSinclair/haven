-- Supabase Storage Setup for Profile Photos
-- Run this in Supabase SQL Editor

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Enable RLS on storage
CREATE POLICY "Users can view all profile photos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photo" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile photo" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own profile photo" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );