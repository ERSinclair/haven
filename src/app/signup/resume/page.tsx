'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getStoredSession } from '@/lib/session';
import { checkProfileCompletion, getProfileCompletionMessage, ProfileData } from '@/lib/profileCompletion';

function ResumeSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

const STORAGE_KEY = 'sb-aqghkzixmedgoydgzhzu-auth-token';

  const [step, setStep] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Profile data
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [kidsAges, setKidsAges] = useState<number[]>([]);
  const [contactMethods, setContactMethods] = useState<string[]>(['app']);

  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqghkzixmedgoydgzhzu.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_YzzytQKVUVjimBU_s_n5NA_6JNzybT3';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const session = getStoredSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }

        setUserId(session.user.id);
        setAccessToken(session.access_token);

        // Get current profile
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${session.user.id}&select=*`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (res.ok) {
          const profiles = await res.json();
          const currentProfile = profiles[0];
          
          if (currentProfile) {
            setProfile(currentProfile);
            
            // Pre-fill existing data
            setName(currentProfile.name || '');
            setLocation(currentProfile.location_name || '');
            setStatus(Array.isArray(currentProfile.status) ? currentProfile.status : 
                     currentProfile.status ? [currentProfile.status] : []);
            setKidsAges(currentProfile.kids_ages || []);
            setContactMethods(currentProfile.contact_methods || ['app']);

            // Determine which step to start from
            const completionStep = checkProfileCompletion(currentProfile);
            const urlStep = parseInt(searchParams.get('step') || '2');
            
            if (completionStep === 'complete') {
              router.push('/discover');
              return;
            }

            // Use URL step if provided and valid, otherwise use completion check
            if (urlStep >= 2 && urlStep <= 4) {
              setStep(urlStep);
            } else {
              switch (completionStep) {
                case 'about-you': setStep(2); break;
                case 'kids': setStep(3); break;
                case 'contact': setStep(4); break;
                default: setStep(2);
              }
            }
          } else {
            setStep(2); // No profile, start from beginning
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, searchParams, supabaseUrl, supabaseKey]);

  const saveProfile = async (updates: Partial<ProfileData>) => {
    if (!userId || !accessToken) return false;

    setSaving(true);
    setError('');

    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Failed to save profile');
        return false;
      }

      return true;
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Something went wrong. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Continue = async () => {
    const success = await saveProfile({
      name,
      location_name: location,
      status,
    });

    if (success) {
      setStep(3);
    }
  };

  const handleStep3Continue = async () => {
    const success = await saveProfile({
      kids_ages: kidsAges,
    });

    if (success) {
      setStep(4);
    }
  };

  const handleStep4Continue = async () => {
    const success = await saveProfile({
      contact_methods: contactMethods,
    });

    if (success) {
      router.push('/welcome');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/discover" className="text-gray-400 hover:text-gray-600">
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏡</span>
            <span className="font-bold text-teal-600 text-lg" style={{ fontFamily: 'var(--font-fredoka)' }}>
              Haven
            </span>
          </div>
          <div className="w-12"></div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200">
              <div 
                className="h-full bg-teal-600 transition-all duration-300"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              />
            </div>
            {[
              { num: 1, label: 'Account' },
              { num: 2, label: 'About you' },
              { num: 3, label: 'Kids' },
              { num: 4, label: 'Connect' },
            ].map((item) => (
              <div key={item.num} className="relative flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold z-10 ${
                    step >= item.num ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > item.num ? '✓' : item.num}
                </div>
                <span 
                  className={`text-xs mt-2 ${
                    step >= item.num ? 'text-teal-600 font-medium' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-blue-800 text-sm">
              <strong>Welcome back!</strong> Let's finish setting up your profile.
            </div>
          </div>

          {/* Step 2: About you */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about you</h2>
              <p className="text-gray-600 mb-6">This helps other families find you.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your first name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    placeholder="Sarah"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your suburb</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    placeholder="Torquay, VIC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">What brings you here? (Select all that apply)</label>
                  <div className="space-y-2">
                    {[
                      { value: 'considering', label: 'Considering homeschool', icon: '🤔' },
                      { value: 'new', label: 'Just started homeschooling', icon: '🌱' },
                      { value: 'experienced', label: 'Experienced homeschooler', icon: '⭐' },
                      { value: 'connecting', label: 'Looking to connect', icon: '🤝' },
                    ].map((opt) => (
                      <label 
                        key={opt.value}
                        className={`flex items-center p-3.5 rounded-xl border-2 cursor-pointer ${
                          status.includes(opt.value) ? 'border-teal-600 bg-teal-50' : 'border-gray-100'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={status.includes(opt.value)} 
                          onChange={() => {
                            if (status.includes(opt.value)) {
                              setStatus(status.filter(s => s !== opt.value));
                            } else {
                              setStatus([...status, opt.value]);
                            }
                          }} 
                        />
                        <span className="text-xl mr-3">{opt.icon}</span>
                        <span className={status.includes(opt.value) ? 'text-teal-700 font-medium' : 'text-gray-700'}>
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleStep2Continue}
                  disabled={!name || !location || status.length === 0 || saving}
                  className="w-full py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {saving ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Kids */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your kids</h2>
              <p className="text-gray-600 mb-6">Tap all ages that apply.</p>
              
              {kidsAges.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-xl">
                  <p className="text-sm text-blue-700">
                    Selected: {kidsAges.map(a => `${a} years`).join(', ')}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-6 gap-2 mb-6">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((age) => (
                  <button
                    key={age}
                    onClick={() => {
                      if (kidsAges.includes(age)) {
                        setKidsAges(kidsAges.filter(a => a !== age));
                      } else {
                        setKidsAges([...kidsAges, age].sort((a, b) => a - b));
                      }
                    }}
                    className={`aspect-square rounded-xl font-semibold transition-all ${
                      kidsAges.includes(age)
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={handleStep3Continue}
                  disabled={kidsAges.length === 0 || saving}
                  className="flex-1 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {saving ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Contact */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">How to reach you</h2>
              <p className="text-gray-600 mb-6">Choose how other families can contact you.</p>
              
              <div className="space-y-3 mb-6">
                {[
                  { value: 'app', label: 'In-app messaging', desc: 'Message through Haven', icon: '💬' },
                  { value: 'phone', label: 'Phone', desc: 'Share your number', icon: '📱' },
                  { value: 'email', label: 'Email', desc: 'Share your email', icon: '📧' },
                ].map((method) => (
                  <label 
                    key={method.value}
                    className={`flex items-center p-4 rounded-xl border-2 cursor-pointer ${
                      contactMethods.includes(method.value) ? 'border-teal-600 bg-teal-50' : 'border-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={contactMethods.includes(method.value)}
                      onChange={() => {
                        if (contactMethods.includes(method.value)) {
                          setContactMethods(contactMethods.filter(m => m !== method.value));
                        } else {
                          setContactMethods([...contactMethods, method.value]);
                        }
                      }}
                    />
                    <span className="text-2xl mr-4">{method.icon}</span>
                    <div className="flex-1">
                      <p className={contactMethods.includes(method.value) ? 'text-teal-700 font-medium' : 'text-gray-700'}>
                        {method.label}
                      </p>
                      <p className="text-sm text-gray-500">{method.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={handleStep4Continue}
                  disabled={contactMethods.length === 0 || saving}
                  className="flex-1 py-3.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {saving ? 'Completing...' : 'Finish'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResumeSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ResumeSignupContent />
    </Suspense>
  );
}