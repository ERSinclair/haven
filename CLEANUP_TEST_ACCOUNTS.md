# Clean Up Test Accounts 🧹

Now that you have account deletion features, here's how to clean up test accounts:

## For Individual Test Accounts

### Admin Method (Recommended):
1. Go to `/admin/users` 
2. Search for test accounts by name/email
3. Click **Delete** next to each test account
4. Confirm deletion
5. Account and all data is permanently removed

### User Method:
1. Sign in as the test user
2. Go to Settings
3. Click "Delete account" 
4. Confirm deletion

## For Multiple Test Accounts

### Option 1: Admin UI (Manual)
- Use admin panel to delete one by one
- Good for reviewing each account before deletion

### Option 2: Direct Database (Fast)
If you have many test accounts, you can remove them directly in Supabase:

```sql
-- CAUTION: This permanently deletes accounts!
-- Replace 'test@' with whatever identifies your test accounts

-- First, get the user IDs you want to delete:
SELECT id, name, email FROM profiles 
WHERE email LIKE 'test%' OR name LIKE 'Test%';

-- Then delete them (be very careful!):
DELETE FROM profiles 
WHERE email LIKE 'test%' OR name LIKE 'Test%';
```

## What Gets Deleted

When an account is deleted, the system removes:
- ✅ Profile and personal info
- ✅ All messages sent/received  
- ✅ All conversations
- ✅ Events hosted by the user
- ✅ Event RSVPs
- ✅ Block/report records
- ✅ Profile photos from storage
- ✅ Notification preferences

## Production Safety

**Before launch**, make sure you:
1. Remove all test accounts
2. Create 1-2 real family profiles (yours + friends)  
3. Set yourself as admin (first user is auto-admin)
4. Test the signup flow once more

## Admin Access

Remember: The **first user** who signs up automatically becomes admin. If you need to make someone else admin:

```sql
-- In Supabase SQL Editor:
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your-real-email@example.com';
```

## Quick Start for Clean Launch

1. **Delete all test accounts** (admin panel or SQL)
2. **Create your real profile** (sign up normally)
3. **Add 2-3 friends/family** as test families  
4. **Create 1-2 sample events** (park meetup, etc.)
5. **Launch!** 🚀

The app feels much more alive with even 3-4 real families vs empty or full of test data.