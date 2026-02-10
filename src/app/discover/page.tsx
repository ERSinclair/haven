'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStoredSession } from '@/lib/session';
import { getAvatarColor, statusColors, statusLabels, statusIcons } from '@/lib/colors';
import { checkProfileCompletion, getResumeSignupUrl } from '@/lib/profileCompletion';
import FamilyMap from '@/components/FamilyMap';
import AvatarUpload from '@/components/AvatarUpload';

type Family = {
  id: string;
  name: string;
  location_name: string;
  kids_ages: number[];
  status: string;
  bio?: string;
  avatar_url?: string;
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

type ViewMode = 'list' | 'map' | 'grid';

export default function EnhancedDiscoverPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [filteredFamilies, setFilteredFamilies] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Selection and hiding system
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [hiddenFamilies, setHiddenFamilies] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // View and filtering
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [maxDistance, setMaxDistance] = useState(15);
  const [ageRange, setAgeRange] = useState({ min: 1, max: 10 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  
  const router = useRouter();

  // Load families and data
  useEffect(() => {
    const loadData = async () => {
      // Only run on client side
      if (typeof window === 'undefined') return;
      
      console.log('Enhanced Discover: Loading data...');
      try {
        // Get session from localStorage (bypass SDK)
        const session = getStoredSession();
        console.log('Enhanced Discover: Session:', session ? 'found' : 'not found');
        
        if (!session?.user) {
          console.log('Enhanced Discover: No user, redirecting to login');
          router.push('/login');
          return;
        }
        
        setUser(session.user);
        console.log('Enhanced Discover: User set, fetching profile...');
        
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
        
        if (!profileRes.ok) {
          console.error('Enhanced Discover: Profile fetch failed:', profileRes.status);
          setIsLoading(false);
          return;
        }
        
        const profileArr = await profileRes.json();
        const profileData = profileArr[0] || null;
        
        console.log('Enhanced Discover: Profile result:', profileData);
        
        if (profileData) {
          // Check if profile is complete
          const completionStep = checkProfileCompletion(profileData);
          
          if (completionStep !== 'complete') {
            console.log('Enhanced Discover: Profile incomplete, redirecting to resume signup');
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
          console.log('Enhanced Discover: No profile found, redirecting to resume signup');
          router.push('/signup/resume?step=2');
          return;
        }

        // Check if user has completed the welcome flow
        const welcomeCompleted = localStorage.getItem('haven-welcome-completed');
        if (!welcomeCompleted) {
          console.log('Enhanced Discover: Welcome not completed, redirecting to welcome');
          router.push('/welcome');
          return;
        }
        
        console.log('Enhanced Discover: Fetching families...');
        
        // Get other families via direct fetch
        const familiesRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=neq.${session.user.id}&select=*&order=created_at.desc`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        
        if (!familiesRes.ok) {
          console.error('Enhanced Discover: Families fetch failed:', familiesRes.status);
          const errorData = await familiesRes.json();
          console.error('Enhanced Discover: Families error:', errorData);
          setIsLoading(false);
          return;
        }
        
        const familiesData = await familiesRes.json();
        console.log('Enhanced Discover: Families result:', familiesData);
        setFamilies(familiesData);
        
        console.log('Enhanced Discover: Done loading');
      } catch (err) {
        console.error('Enhanced Discover: Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Cleanup long press timer on unmount
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [router, longPressTimer]);

  // Filter families based on current filters
  useEffect(() => {
    let filtered = families.filter(family => !hiddenFamilies.includes(family.id));

    // Search term
    if (searchTerm) {
      filtered = filtered.filter(family =>
        family.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        family.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        family.bio?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Location filter
    if (locationFilter) {
      filtered = filtered.filter(family =>
        family.location_name.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    // Age range filter
    if (profile?.kids_ages && Array.isArray(profile.kids_ages) && profile.kids_ages.length > 0) {
      filtered = filtered.filter(family =>
        family.kids_ages?.some(age => age >= ageRange.min && age <= ageRange.max)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(family =>
        Array.isArray(family.status) 
          ? family.status.includes(filterStatus)
          : family.status === filterStatus
      );
    }

    setFilteredFamilies(filtered);
  }, [families, searchTerm, locationFilter, ageRange, filterStatus, hiddenFamilies, profile]);

  // Family selection handlers
  const toggleFamilySelection = (familyId: string) => {
    setSelectedFamilies(prev =>
      prev.includes(familyId)
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  };

  // Long hold handlers for selection
  const handleLongPressStart = (familyId: string, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    
    const timer = setTimeout(() => {
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      // Enter selection mode if not already active
      if (!selectionMode) {
        setSelectionMode(true);
      }
      
      // Select the family
      toggleFamilySelection(familyId);
    }, 500); // 500ms for long press
    
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleFamilyClick = (familyId: string) => {
    if (selectionMode) {
      // In selection mode, clicking toggles selection
      toggleFamilySelection(familyId);
    } else {
      // Normal mode - could open family details (future feature)
      console.log('Open family details:', familyId);
    }
  };

  const hideSelectedFamilies = () => {
    setHiddenFamilies(prev => [...prev, ...selectedFamilies]);
    setSelectedFamilies([]);
    setSelectionMode(false);
    
    // Save to localStorage
    const newHidden = [...hiddenFamilies, ...selectedFamilies];
    localStorage.setItem('haven-hidden-families', JSON.stringify(newHidden));
  };

  const clearHiddenFamilies = () => {
    setHiddenFamilies([]);
    localStorage.removeItem('haven-hidden-families');
  };

  // Load hidden families from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('haven-hidden-families');
    if (saved) {
      try {
        setHiddenFamilies(JSON.parse(saved));
      } catch {
        localStorage.removeItem('haven-hidden-families');
      }
    }
  }, []);

  const sendMessage = async (recipientId: string, message: string) => {
    if (!user?.id || !message.trim()) return false;

    setIsSendingMessage(true);
    try {
      const session = getStoredSession();
      if (!session) {
        console.error('No session found');
        return false;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqghkzixmedgoydgzhzu.supabase.co';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_YzzytQKVUVjimBU_s_n5NA_6JNzybT3';

      console.log('Attempting to send message from', user.id, 'to', recipientId);

      // Create conversation
      const conversationData = {
        participant_1: user.id,
        participant_2: recipientId,
        last_message_text: message,
        last_message_at: new Date().toISOString(),
        last_message_by: user.id,
      };

      const conversationRes = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(conversationData),
      });

      if (!conversationRes.ok) {
        const errorText = await conversationRes.text();
        console.error('Failed to create conversation:', conversationRes.status, errorText);
        return false;
      }

      const [conversation] = await conversationRes.json();

      // Send message
      const messageData = {
        conversation_id: conversation.id,
        sender_id: user.id,
        content: message,
      };

      const messageRes = await fetch(`${supabaseUrl}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!messageRes.ok) {
        const errorText = await messageRes.text();
        console.error('Failed to send message:', messageRes.status, errorText);
        return false;
      }

      console.log('Message sent successfully');
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent" 
                style={{ fontFamily: 'var(--font-fredoka)' }}>
              Haven
            </h1>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'map' 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Map
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search families by name, location, or interests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showFilters
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Location Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g., Torquay, Geelong..."
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Age Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kids Age Range: {ageRange.min}-{ageRange.max} years
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="range"
                      min="0"
                      max="18"
                      value={ageRange.min}
                      onChange={(e) => setAgeRange(prev => ({ ...prev, min: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <input
                      type="range"
                      min="0"
                      max="18"
                      value={ageRange.max}
                      onChange={(e) => setAgeRange(prev => ({ ...prev, max: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Family Type</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">All families</option>
                    <option value="considering">Considering homeschool</option>
                    <option value="new">New to homeschooling</option>
                    <option value="experienced">Experienced</option>
                    <option value="connecting">Looking to connect</option>
                  </select>
                </div>

                {/* Quick Actions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quick Actions</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setLocationFilter('');
                        setFilterStatus('all');
                        setAgeRange({ min: 1, max: 10 });
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm font-medium hover:bg-gray-200"
                    >
                      Clear
                    </button>
                    {hiddenFamilies.length > 0 && (
                      <button
                        onClick={clearHiddenFamilies}
                        className="px-3 py-1.5 bg-teal-100 text-teal-700 rounded text-sm font-medium hover:bg-teal-200"
                      >
                        Show Hidden ({hiddenFamilies.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Results Summary */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-600">
            Showing {filteredFamilies.length} families
            {hiddenFamilies.length > 0 && ` (${hiddenFamilies.length} hidden)`}
          </p>
          {selectionMode && (
            <p className="text-teal-600 font-medium">
              {selectedFamilies.length} selected
            </p>
          )}
        </div>

        {/* Map View */}
        {viewMode === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                {filteredFamilies.length} families on map
                {hiddenFamilies.length > 0 && ` (${hiddenFamilies.length} hidden)`}
              </p>
              <button
                onClick={() => setViewMode('list')}
                className="text-teal-600 hover:text-teal-700 font-medium"
              >
                ← Back to List
              </button>
            </div>
            <FamilyMap 
              families={filteredFamilies}
              onFamilyClick={(family) => setSelectedFamily(family)}
              className="w-full"
            />
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            {filteredFamilies.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No families found</h3>
                <p className="text-gray-600">
                  Try adjusting your search filters or check back later for new families!
                </p>
              </div>
            ) : (
              <>
                {filteredFamilies.map((family) => (
                <div 
                  key={family.id} 
                  className={`bg-white rounded-xl shadow-sm p-6 transition-all cursor-pointer select-none ${
                    selectionMode 
                      ? selectedFamilies.includes(family.id) 
                        ? 'ring-2 ring-teal-500 bg-teal-50' 
                        : 'hover:bg-gray-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleFamilyClick(family.id)}
                  onMouseDown={(e) => handleLongPressStart(family.id, e)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={(e) => handleLongPressStart(family.id, e)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                >
                  <div className="flex items-start justify-between">
                    {/* Selection Indicator */}
                    {selectionMode && (
                      <div className="mr-4 mt-1">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedFamilies.includes(family.id)
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}>
                          {selectedFamilies.includes(family.id) && (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Family Info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <AvatarUpload
                          userId={family.id}
                          currentAvatarUrl={family.avatar_url}
                          name={family.name}
                          size="md"
                          editable={false}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{family.name}</h3>
                            {family.is_verified && <span className="text-green-500">✓</span>}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">📍 {family.location_name}</p>
                          <p className="text-sm text-gray-600 mb-3">
                            Kids: {family.kids_ages?.length ? family.kids_ages.join(', ') + ' years' : 'No info'}
                          </p>
                          {family.bio && (
                            <p className="text-sm text-gray-700 mb-3 line-clamp-2">{family.bio}</p>
                          )}
                          {family.interests && family.interests.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {family.interests.slice(0, 3).map(interest => (
                                <span key={interest} className="px-2 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium">
                                  {interest}
                                </span>
                              ))}
                              {family.interests.length > 3 && (
                                <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded-full text-xs">
                                  +{family.interests.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {!selectionMode && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedFamily(family)}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                        >
                          Message
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              </>
            )}
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFamilies.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No families found</h3>
                <p className="text-gray-600">
                  Try adjusting your search filters or check back later for new families!
                </p>
              </div>
            ) : (
              filteredFamilies.map((family) => (
                <div key={family.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div className="mb-4">
                      <input
                        type="checkbox"
                        checked={selectedFamilies.includes(family.id)}
                        onChange={() => toggleFamilySelection(family.id)}
                        className="w-5 h-5 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                    </div>
                  )}

                  {/* Family Card Content */}
                  <div className="text-center">
                    <div className="mx-auto mb-4">
                      <AvatarUpload
                        userId={family.id}
                        currentAvatarUrl={family.avatar_url}
                        name={family.name}
                        size="lg"
                        editable={false}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{family.name}</h3>
                      {family.is_verified && <span className="text-green-500">✓</span>}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">📍 {family.location_name}</p>
                    <p className="text-sm text-gray-600 mb-3">
                      Kids: {family.kids_ages?.length ? family.kids_ages.join(', ') + ' years' : 'No info'}
                    </p>
                    {family.bio && (
                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">{family.bio}</p>
                    )}
                    {!selectionMode && (
                      <button
                        onClick={() => setSelectedFamily(family)}
                        className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                      >
                        Message
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Message Modal */}
      {selectedFamily && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AvatarUpload
                userId={selectedFamily.id}
                currentAvatarUrl={selectedFamily.avatar_url}
                name={selectedFamily.name}
                size="md"
                editable={false}
              />
              <div>
                <h3 className="font-semibold text-gray-900">{selectedFamily.name}</h3>
                <p className="text-sm text-gray-600">📍 {selectedFamily.location_name}</p>
              </div>
            </div>
            
            <div className="mb-4">
              <textarea
                placeholder="Hi! I'd love to connect with your family..."
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 resize-none"
                rows={4}
                id="messageInput"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedFamily(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
                  const message = messageInput?.value || '';
                  if (message.trim()) {
                    const success = await sendMessage(selectedFamily.id, message);
                    if (success) {
                      setSelectedFamily(null);
                      setShowSuccessMessage(true);
                      // Hide success message after 3 seconds
                      setTimeout(() => setShowSuccessMessage(false), 3000);
                    } else {
                      alert('Failed to send message. Please try again.');
                    }
                  }
                }}
                disabled={isSendingMessage}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:bg-gray-300"
              >
                {isSendingMessage ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Actions */}
      {selectionMode && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center">
          <div className="bg-gray-800 text-white rounded-full px-6 py-3 shadow-xl flex items-center gap-4">
            {selectedFamilies.length > 0 ? (
              <>
                <span className="text-sm font-medium">
                  {selectedFamilies.length} selected
                </span>
                <button
                  onClick={hideSelectedFamilies}
                  className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Hide
                </button>
              </>
            ) : (
              <span className="text-sm text-gray-300">Select families to hide them</span>
            )}
            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedFamilies([]);
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success Message Notification */}
      {showSuccessMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <span className="text-lg">✓</span>
            <span className="font-medium">Message sent successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}