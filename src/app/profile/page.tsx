'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getStoredSession, clearStoredSession } from '@/lib/session';
import { getAvatarColor, statusColors, statusLabels, statusIcons } from '@/lib/colors';
import AvatarUpload from '@/components/AvatarUpload';

type Profile = {
  id: string;
  name: string;
  location_name: string;
  kids_ages: number[];
  status: string;
  bio?: string;
  avatar_url?: string;
  is_verified: boolean;
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    location_name: '',
    bio: '',
    kids_ages: [] as number[],
    status: '',
  });
  const router = useRouter();

  // Load user and profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Get session from localStorage (bypass SDK)
        const session = getStoredSession();
        
        if (!session?.user) {
          router.push('/login');
          return;
        }
        
        setUser(session.user);
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        // Get profile via direct fetch
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${session.user.id}&select=*`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const arr = await res.json();
        const profileData = arr[0] || null;
        
        if (profileData) {
          setProfile(profileData);
          setEditData({
            name: profileData.name || '',
            location_name: profileData.location_name || '',
            bio: profileData.bio || '',
            kids_ages: profileData.kids_ages || [],
            status: profileData.status || '',
          });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      const session = getStoredSession();
      if (!session) {
        alert('Session expired. Please log in again.');
        return;
      }
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            name: editData.name,
            location_name: editData.location_name,
            bio: editData.bio,
            kids_ages: editData.kids_ages,
            status: editData.status,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        alert('Error saving profile: ' + (err.message || 'Unknown error'));
      } else {
        // Update local state
        setProfile(prev => prev ? {
          ...prev,
          name: editData.name,
          location_name: editData.location_name,
          bio: editData.bio,
          kids_ages: editData.kids_ages,
          status: editData.status,
        } : null);
        setIsEditing(false);
      }
    } catch (err) {
      alert('Error saving profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    clearStoredSession();
    window.location.href = '/';
  };

  const toggleAge = (age: number) => {
    if (editData.kids_ages.includes(age)) {
      setEditData({
        ...editData,
        kids_ages: editData.kids_ages.filter(a => a !== age).sort((a, b) => a - b)
      });
    } else {
      setEditData({
        ...editData,
        kids_ages: [...editData.kids_ages, age].sort((a, b) => a - b)
      });
    }
  };

  const getStatusInfo = (status: string) => {
    const colors = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
    return {
      label: statusLabels[status] || status,
      icon: statusIcons[status] || '👤',
      color: `${colors.bg} ${colors.text}`,
    };
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setPhotoUploading(true);
      const file = event.target.files?.[0];
      if (!file || !user?.id) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be smaller than 5MB');
        return;
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete existing avatar if any
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('profile-photos').remove([oldPath]);
      }

      // Upload new avatar
      const { data, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Failed to upload image. Please try again.');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      const newAvatarUrl = urlData.publicUrl;

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        alert('Failed to update profile. Please try again.');
        return;
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : prev);
      
    } catch (err) {
      console.error('Photo upload error:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setPhotoUploading(false);
      // Clear the input so the same file can be selected again
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
            <span className="text-3xl">👤</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Sign in to view profile</h1>
          <p className="text-gray-600 mb-8">You need to be logged in to view your profile.</p>
          <Link
            href="/login"
            className="inline-block bg-teal-600 text-white font-semibold py-3 px-8 rounded-xl hover:bg-teal-700 transition-all"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(profile.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pt-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-fredoka)' }}>
              Haven
            </h1>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-teal-600 font-medium hover:bg-blue-50 rounded-lg transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({
                      name: profile.name || '',
                      location_name: profile.location_name || '',
                      bio: profile.bio || '',
                      kids_ages: profile.kids_ages || [],
                      status: profile.status || '',
                    });
                  }}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:bg-gray-300 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {/* Avatar & Name */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <AvatarUpload
                userId={user?.id || ''}
                currentAvatarUrl={profile?.avatar_url}
                name={isEditing ? editData.name : profile?.name || ''}
                size="xl"
                editable={false}
                onAvatarChange={(newUrl) => {
                  if (profile) {
                    setProfile({ ...profile, avatar_url: newUrl || undefined });
                  }
                }}
              />
            </div>

            {/* DEBUG: Photo Upload Section v2.0 */}
            <div className="mb-4 space-y-2 bg-yellow-100 border border-yellow-300 p-3 rounded-lg">
              <p className="text-xs text-yellow-800">DEBUG: Photo upload section v2.0</p>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload-input"
              />
              <label
                htmlFor="photo-upload-input"
                className={`inline-block px-6 py-3 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors cursor-pointer ${
                  photoUploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {photoUploading ? (
                  <>
                    <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Uploading Photo...
                  </>
                ) : (
                  <>
                    📷 Upload Photo
                  </>
                )}
              </label>
              
              {profile?.avatar_url && !photoUploading && (
                <button
                  onClick={async () => {
                    if (!user?.id) return;
                    if (!confirm('Remove your profile photo?')) return;
                    
                    try {
                      setPhotoUploading(true);
                      
                      // Remove from storage
                      const path = profile.avatar_url!.split('/').slice(-2).join('/');
                      await supabase.storage.from('profile-photos').remove([path]);
                      
                      // Update profile in database
                      await supabase
                        .from('profiles')
                        .update({ avatar_url: null })
                        .eq('id', user.id);
                      
                      // Update local state
                      setProfile(prev => prev ? { ...prev, avatar_url: undefined } : prev);
                      
                    } catch (err) {
                      console.error('Photo removal error:', err);
                      alert('Failed to remove photo');
                    } finally {
                      setPhotoUploading(false);
                    }
                  }}
                  className="block px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors"
                >
                  🗑️ Remove Photo
                </button>
              )}
            </div>
            
            {isEditing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-xl font-bold text-gray-900 text-center w-full border-b-2 border-teal-500 focus:outline-none pb-1"
                placeholder="Your name"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900">{profile.name || 'No name set'}</h2>
            )}
            
            {profile.is_verified && (
              <span className="inline-flex items-center text-teal-600 text-sm mt-1">
                ✓ Verified family
              </span>
            )}
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500 mb-1">📍 Location</label>
            {isEditing ? (
              <input
                type="text"
                value={editData.location_name}
                onChange={(e) => setEditData({ ...editData, location_name: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Your suburb"
              />
            ) : (
              <p className="text-gray-900">{profile.location_name || 'Not set'}</p>
            )}
          </div>

          {/* Status */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500 mb-1">📅 Status</label>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'considering', label: 'Considering', icon: '🤔' },
                  { value: 'new', label: 'Just started', icon: '🌱' },
                  { value: 'experienced', label: 'Experienced', icon: '⭐' },
                  { value: 'connecting', label: 'Connecting', icon: '🤝' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditData({ ...editData, status: opt.value })}
                    className={`p-2 rounded-lg border-2 text-sm text-left ${
                      editData.status === opt.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.label}
              </span>
            )}
          </div>

          {/* Kids Ages */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500 mb-1">👶 Kids' ages</label>
            {isEditing ? (
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => toggleAge(age)}
                    className={`aspect-square rounded-lg font-medium text-sm transition-all ${
                      editData.kids_ages.includes(age)
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-900">
                {profile.kids_ages?.length > 0
                  ? profile.kids_ages.map(a => `${a} years`).join(', ')
                  : 'Not specified'}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">📝 About us</label>
            {isEditing ? (
              <textarea
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Tell other families about your homeschool journey..."
              />
            ) : (
              <p className="text-gray-700">
                {profile.bio || 'No bio yet. Add one to help families get to know you!'}
              </p>
            )}
          </div>
        </div>

        {/* How Others See You */}
        {!isEditing && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">👀 How others see you</h3>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${getAvatarColor(profile.name)}`}>
                  {profile.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {profile.name || 'No name'}
                    {profile.is_verified && <span className="ml-1 text-teal-600 text-sm">✓</span>}
                  </h4>
                  <p className="text-sm text-gray-600">📍 {profile.location_name || 'Location not set'}</p>
                  {profile.kids_ages?.length > 0 && (
                    <p className="text-sm text-gray-600">
                      👶 {profile.kids_ages.join(', ')} years
                    </p>
                  )}
                  {profile.status && (
                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <Link href="/settings" className="flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-100">
            <span className="text-gray-900">⚙️ Settings</span>
            <span className="text-gray-400">→</span>
          </Link>
          <Link href="/notifications" className="flex items-center justify-between p-4 hover:bg-gray-50">
            <span className="text-gray-900">🔔 Notifications</span>
            <span className="text-gray-400">→</span>
          </Link>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
