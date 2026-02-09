'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStoredSession } from '@/lib/session';
import { getAvatarColor, statusColors, statusLabels, statusIcons } from '@/lib/colors';
import { checkProfileCompletion, getResumeSignupUrl } from '@/lib/profileCompletion';

type Family = {
  id: string;
  name: string;
  location_name: string;
  kids_ages: number[];
  status: string;
  bio?: string;
  interests?: string[];
  is_verified: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  name: string;
  location_name: string;
  kids_ages: number[];
  status: string;
  bio?: string;
};

// Using statusLabels, statusColors from @/lib/colors

export default function DiscoverPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [maxDistance, setMaxDistance] = useState(15);
  const [ageRange, setAgeRange] = useState({ min: 1, max: 10 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const router = useRouter();

  // Load auth and data
  useEffect(() => {
    const loadData = async () => {
      // Only run on client side
      if (typeof window === 'undefined') return;
      
      console.log('Discover: Loading data...');
      try {
        // Get session from localStorage (bypass SDK)
        const session = getStoredSession();
        console.log('Discover: Session:', session ? 'found' : 'not found');
        
        if (!session?.user) {
          console.log('Discover: No user, redirecting to login');
          router.push('/login');
          return;
        }
        
        setUser(session.user);
        console.log('Discover: User set, fetching profile...');
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        // Get user's profile via direct fetch
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${session.user.id}&select=*`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const profileArr = await profileRes.json();
        const profileData = profileArr[0] || null;
        
        console.log('Discover: Profile result:', profileData);
        
        if (profileData) {
          // Check if profile is complete
          const completionStep = checkProfileCompletion(profileData);
          
          if (completionStep !== 'complete') {
            console.log('Discover: Profile incomplete, redirecting to resume signup');
            router.push(getResumeSignupUrl(completionStep));
            return;
          }
          
          setProfile(profileData);
          // Set age range based on kids
          if (profileData.kids_ages?.length > 0) {
            const minAge = Math.max(0, Math.min(...profileData.kids_ages) - 2);
            const maxAge = Math.min(18, Math.max(...profileData.kids_ages) + 2);
            setAgeRange({ min: minAge, max: maxAge });
          }
        } else {
          // No profile found, redirect to complete signup
          console.log('Discover: No profile found, redirecting to resume signup');
          router.push('/signup/resume?step=2');
          return;
        }
        
        console.log('Discover: Fetching families...');
        
        // Get other families via direct fetch
        const familiesRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=neq.${session.user.id}&is_banned=eq.false&select=*&order=created_at.desc`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const familiesData = await familiesRes.json();
        
        console.log('Discover: Families result:', familiesData);
        
        setFamilies(familiesData || []);
        console.log('Discover: Done loading');
      } catch (err) {
        console.error('Discover: Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [router]);

  // Filter families
  const filteredFamilies = families.filter(family => {
    // Age overlap filter
    const hasAgeOverlap = family.kids_ages?.some(
      age => age >= ageRange.min && age <= ageRange.max
    ) ?? true;
    
    // Status filter
    const statusMatch = filterStatus === 'all' || family.status === filterStatus;
    
    return hasAgeOverlap && statusMatch;
  });

  const handleMessage = (family: Family) => {
    setSelectedFamily(family);
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || !selectedFamily || !user) return;
    
    const session = getStoredSession();
    if (!session) return;
    
    setIsSendingMessage(true);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    try {
      // Check if conversation already exists
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?or=(and(participant_1.eq.${user.id},participant_2.eq.${selectedFamily.id}),and(participant_1.eq.${selectedFamily.id},participant_2.eq.${user.id}))&select=id`,
        {
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const existing = await existingRes.json();
      
      let conversationId: string;
      
      if (existing.length > 0) {
        conversationId = existing[0].id;
      } else {
        // Create new conversation
        const convoRes = await fetch(
          `${supabaseUrl}/rest/v1/conversations`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              participant_1: user.id,
              participant_2: selectedFamily.id,
            }),
          }
        );
        const [newConvo] = await convoRes.json();
        conversationId = newConvo.id;
      }
      
      // Send message
      await fetch(
        `${supabaseUrl}/rest/v1/messages`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            sender_id: user.id,
            content: message,
          }),
        }
      );
      
      // Update conversation last message
      await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            last_message_text: message,
            last_message_at: new Date().toISOString(),
            last_message_by: user.id,
          }),
        }
      );
      
      setSelectedFamily(null);
      router.push('/messages');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getWeeksAgo = (dateString: string) => {
    const created = new Date(dateString);
    const now = new Date();
    const weeks = Math.floor((now.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weeks < 1 ? 'This week' : `${weeks}w ago`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="w-48 h-8 bg-gray-200 rounded mx-auto mb-2 animate-pulse"></div>
            <div className="w-32 h-4 bg-gray-200 rounded mx-auto animate-pulse"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-gray-200">
                <div className="flex items-start mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full mr-3 animate-pulse"></div>
                  <div className="flex-1">
                    <div className="w-32 h-5 bg-gray-200 rounded mb-1 animate-pulse"></div>
                    <div className="w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
                <div className="w-full h-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Message view
  if (selectedFamily) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center mb-6">
            <button 
              onClick={() => setSelectedFamily(null)}
              className="mr-4 text-teal-600 font-medium"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              Message {selectedFamily.name}
            </h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="text-center mb-4">
              <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-xl font-bold ${getAvatarColor(selectedFamily.name)}`}>
                {selectedFamily.name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-gray-800">{selectedFamily.name}</h2>
              <p className="text-gray-600">📍 {selectedFamily.location_name}</p>
            </div>
            
            <div className="space-y-2 mb-4 text-gray-700">
              {selectedFamily.kids_ages?.length > 0 && (
                <p><span className="font-medium">👶 Kids:</span> {selectedFamily.kids_ages.join(', ')} years old</p>
              )}
              <p><span className="font-medium">📅 Status:</span> {statusLabels[selectedFamily.status] || selectedFamily.status}</p>
              <p><span className="font-medium">🕐 Joined:</span> {getWeeksAgo(selectedFamily.created_at)}</p>
            </div>

            {selectedFamily.bio && (
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-gray-700">{selectedFamily.bio}</p>
              </div>
            )}

            {selectedFamily.interests && selectedFamily.interests.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Interests:</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedFamily.interests.map(interest => (
                    <span
                      key={interest}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Send a message</h3>
            
            <textarea
              id="messageInput"
              className="w-full p-4 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 mb-4"
              rows={4}
              placeholder={`Hi ${selectedFamily.name}! I'm ${profile?.name || 'interested'} from ${profile?.location_name || 'the area'}. I'd love to connect...`}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedFamily(null)}
                className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-300:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const textarea = document.getElementById('messageInput') as HTMLTextAreaElement;
                  sendMessage(textarea.value);
                }}
                disabled={isSendingMessage}
                className="flex-1 bg-teal-600 text-white font-semibold py-3 rounded-lg hover:bg-teal-700 disabled:bg-gray-300:bg-slate-600 transition-colors"
              >
                {isSendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="relative text-center mb-16 pt-16">
          <h1 className="text-4xl font-bold mb-16" style={{ fontFamily: 'var(--font-fredoka)' }}>
            <span className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent">Haven</span>
          </h1>
          
          {/* Map Button - Small, Top Right */}
          <Link 
            href="/map"
            className="absolute top-16 right-4 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Map
          </Link>
        </div>

        {/* Filters */}
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800">🔍 Filter families</h2>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-sm text-teal-600 hover:text-teal-700:text-teal-300 font-medium"
            >
              {showAdvancedFilters ? 'Hide filters' : 'More filters'}
            </button>
          </div>
          
          {/* Age Range Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              👶 Kids aged {ageRange.min} - {ageRange.max} years
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="0"
                max="10"
                value={ageRange.min}
                onChange={(e) => setAgeRange({...ageRange, min: parseInt(e.target.value)})}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-600">to</span>
              <input
                type="range"
                min="5"
                max="18"
                value={ageRange.max}
                onChange={(e) => setAgeRange({...ageRange, max: parseInt(e.target.value)})}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Experience Level
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'All families' },
                  { value: 'considering', label: 'Considering' },
                  { value: 'new', label: 'Just started' },
                  { value: 'experienced', label: 'Experienced' },
                  { value: 'connecting', label: 'Looking to connect' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterStatus(option.value)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      filterStatus === option.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200:bg-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredFamilies.length} {filteredFamilies.length === 1 ? 'family' : 'families'}
          </div>
        </div>

        {/* Family List */}
        <div className="max-w-md mx-auto space-y-4">
          {filteredFamilies.length === 0 ? (
            <div className="text-center bg-white rounded-xl shadow-lg p-8">
              <div className="text-4xl mb-4">👋</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {families.length === 0 ? "You're the first!" : 'No matches yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {families.length === 0 
                  ? "No other families have signed up yet. Share Haven with local homeschool groups!"
                  : "Try adjusting your filters to find more families."
                }
              </p>
              {filterStatus !== 'all' && (
                <button
                  onClick={() => setFilterStatus('all')}
                  className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filteredFamilies.map((family) => (
              <div 
                key={family.id} 
                className={`bg-white rounded-xl overflow-hidden border-l-4 ${statusColors[family.status]?.border || 'border-gray-400'} card-hover`}
              >
                <div className="p-4">
                  <div className="flex items-start mb-3">
                    <div className={`w-12 h-12 rounded-full mr-3 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(family.name)}`}>
                      {family.name.charAt(0)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-800 text-base flex items-center">
                            {family.name}
                            {family.is_verified && (
                              <span className="ml-2 text-teal-600 text-sm" title="Verified">✓</span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600">📍 {family.location_name}</p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">
                          {getWeeksAgo(family.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    {family.kids_ages?.length > 0 && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">👶 Kids:</span> {family.kids_ages.join(', ')} years old
                      </p>
                    )}
                    <p className="text-sm text-gray-700">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[family.status]?.bg || 'bg-gray-100'} ${statusColors[family.status]?.text || 'text-gray-700'}`}>
                        {statusIcons[family.status]} {statusLabels[family.status] || family.status}
                      </span>
                    </p>
                  </div>

                  {family.bio && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {family.bio}
                    </p>
                  )}

                  {family.interests && family.interests.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {family.interests.slice(0, 3).map(interest => (
                          <span
                            key={interest}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                          >
                            {interest}
                          </span>
                        ))}
                        {family.interests.length > 3 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
                            +{family.interests.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleMessage(family)}
                    className="w-full bg-teal-600 text-white font-semibold py-3 rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors"
                  >
                    💬 Message
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            Connect safely with local homeschool families
          </p>
        </div>
      </div>
    </div>
  );
}
