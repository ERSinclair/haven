# MANUAL TASKS - HAVEN DATABASE

## ✅ COMPLETED: Database Schema Update 

**Status**: ✅ COMPLETE (completed 2026-02-09 15:13 GMT+11)
**Priority**: ~~High~~ DONE
**Time**: Completed successfully

### Steps:
1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: Your Haven project → SQL Editor
3. **Run this SQL**:

```sql
-- Add username column to profiles table
ALTER TABLE profiles ADD COLUMN username TEXT UNIQUE;

-- Add performance indexes
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_location ON profiles(location_name);

-- Optional: Populate existing users with auto-generated usernames
UPDATE profiles 
SET username = LOWER(name) || '_' || RIGHT(id::text, 8) 
WHERE username IS NULL;
```

### What This Fixes:
- ✅ Enables full username functionality in signup
- ✅ Allows users to have @handles for profiles
- ✅ Improves app performance with proper indexes
- ✅ Future-proofs the user system

### Current Workaround:
- App works without this (usernames auto-generated and hidden)
- No user-facing impact while this is pending
- Can be done anytime when convenient

---

## 📝 Other Future Enhancements (Non-Critical)

### Database Optimizations:
```sql
-- Add more indexes for performance (optional)
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_profiles_kids_ages ON profiles USING GIN(kids_ages);
CREATE INDEX idx_profiles_location_coords ON profiles(location_lat, location_lng);
```

### Photo Storage Setup:
- Configure Supabase Storage bucket for profile/event photos
- Set up RLS policies for image access
- Add image upload UI components

---

**Last Updated**: 2026-02-09 15:50 GMT+11
**Status**: All critical bugs fixed and deployed ✅