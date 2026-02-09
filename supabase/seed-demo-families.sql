-- Demo families for Haven
-- Run this in Supabase SQL Editor

-- Note: These are fake profiles for testing, not real auth users
-- They use UUIDs that don't exist in auth.users, so they won't be able to "log in"
-- But they'll show up in Discover for testing

INSERT INTO profiles (id, name, email, location_name, location_lat, location_lng, kids_ages, status, bio, interests, is_verified, created_at)
VALUES 
  (
    'a1111111-1111-1111-1111-111111111111',
    'Emma & David',
    'emma.demo@example.com',
    'Torquay',
    -38.3318,
    144.3260,
    ARRAY[2, 4],
    'new',
    'Former teacher turned homeschool mum! Just moved from Melbourne for the sea change. Our girls love the beach and nature walks. Looking for families for regular park meetups.',
    ARRAY['nature play', 'art & crafts', 'beach activities'],
    true,
    NOW() - INTERVAL '2 weeks'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'Michelle & James',
    'michelle.demo@example.com',
    'Torquay',
    -38.3350,
    144.3200,
    ARRAY[5, 8, 10],
    'experienced',
    '5+ years homeschooling journey! Started when our eldest wasn''t thriving in traditional school. Now all three are confident, curious learners. Happy to mentor new families!',
    ARRAY['STEM projects', 'drama & theatre', 'mentoring'],
    true,
    NOW() - INTERVAL '4 weeks'
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'Lisa & Mark',
    'lisa.demo@example.com',
    'Jan Juc',
    -38.3525,
    144.3010,
    ARRAY[4, 5, 7],
    'new',
    'Pulled our kids from school mid-term after realizing it wasn''t working for them. Best decision ever! We have a big backyard perfect for group activities.',
    ARRAY['outdoor adventures', 'hands-on learning', 'science experiments'],
    true,
    NOW() - INTERVAL '3 weeks'
  ),
  (
    'a4444444-4444-4444-4444-444444444444',
    'Sarah',
    'sarah.demo@example.com',
    'Anglesea',
    -38.4085,
    144.1850,
    ARRAY[1, 3],
    'considering',
    'Stay-at-home mum with a toddler and preschooler. Strongly considering homeschooling rather than traditional kindy. Would love to find a supportive community!',
    ARRAY['music & movement', 'Montessori', 'toddler activities'],
    false,
    NOW() - INTERVAL '1 week'
  ),
  (
    'a5555555-5555-5555-5555-555555555555',
    'Kate',
    'kate.demo@example.com',
    'Geelong',
    -38.1499,
    144.3617,
    ARRAY[3, 6],
    'connecting',
    'Single mum exploring the homeschool community. I love the values and intentional approach. We''re into gardening, cooking together, and lots of library visits.',
    ARRAY['gardening', 'cooking', 'library visits', 'reading'],
    true,
    NOW() - INTERVAL '1 week'
  ),
  (
    'a6666666-6666-6666-6666-666666666666',
    'Rachel & Tom',
    'rachel.demo@example.com',
    'Lorne',
    -38.5419,
    143.9778,
    ARRAY[3, 5, 7, 9],
    'experienced',
    'Large family homeschooling in paradise! Dad''s a surf instructor, mum manages the chaos. Our kids are ocean-loving, free-spirited learners.',
    ARRAY['surfing', 'sustainable living', 'nature studies'],
    true,
    NOW() - INTERVAL '6 weeks'
  )
ON CONFLICT (id) DO NOTHING;

-- Verify insertion
SELECT name, location_name, kids_ages, status FROM profiles ORDER BY created_at DESC;
