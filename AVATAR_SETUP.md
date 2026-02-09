# Avatar Photo Upload Setup

## ✅ Code Changes Complete

Avatar upload functionality has been added to Haven:

- **AvatarUpload component** - Handles photo upload, display, and fallback to colored circles
- **Profile page** - Editable avatar when in edit mode
- **All other pages** - Display uploaded photos or colored circle fallbacks (Discover, Messages, etc.)
- **File validation** - 5MB limit, image files only
- **Storage path** - `profile-photos/{userId}/avatar.{ext}`

## 🔧 Supabase Storage Setup Required

**YOU NEED TO RUN THIS** in your Supabase SQL Editor:

1. Go to https://supabase.com/dashboard → Your Haven project → SQL Editor
2. Copy + paste + run the contents of `supabase/storage-setup.sql`

This creates:
- ✅ `profile-photos` storage bucket (public, 5MB limit)
- ✅ RLS policies (users can only manage their own photos)
- ✅ File type restrictions (jpeg, png, webp only)

## 🎯 How It Works

### Upload Flow:
1. User clicks their avatar in edit mode
2. File picker opens
3. Image uploads to Supabase Storage at `profile-photos/{userId}/avatar.{ext}`
4. Profile.avatar_url updated in database
5. New photo displays immediately

### Display Logic:
- **If photo exists:** Show uploaded image
- **If no photo:** Show colored circle with initials (current system)
- **If photo fails to load:** Fallback to colored circle

### File Management:
- **Replace photo:** Old file is deleted automatically
- **Remove photo:** File deleted, avatar_url set to null
- **File validation:** 5MB max, images only

## 🚀 Ready to Test

1. Run the storage SQL setup
2. Deploy latest code to Vercel (auto-deploys from git)
3. Test by editing your profile and uploading a photo

The avatar system gracefully degrades - existing users see colored circles until they upload photos.

## 💡 Why This Design

- **Privacy-friendly:** No photo required, colored circles work great
- **Fast loading:** Photos are optional enhancement
- **Consistent UX:** Same avatar display across all pages
- **Easy management:** One-click upload/remove
- **Storage efficient:** Single avatar per user, auto-cleanup

Perfect for families who want personal touch but don't want to deal with photo requirements!