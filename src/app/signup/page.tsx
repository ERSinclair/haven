'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// SimpleLocationPicker removed - using simple town/state inputs

const STORAGE_KEY = 'sb-aqghkzixmedgoydgzhzu-auth-token';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Removed email checking state variables
  const [showEmailConflict, setShowEmailConflict] = useState(false);
  
  // Step 2: About you
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [location, setLocation] = useState(', VIC'); // Default to VIC state
  const [locationData, setLocationData] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [status, setStatus] = useState<string[]>([]);
  
  // Step 3: Kids
  const [kidsAges, setKidsAges] = useState<number[]>([]);
  
  // Step 4: Contact
  const [contactMethods, setContactMethods] = useState<string[]>(['app']);

  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aqghkzixmedgoydgzhzu.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_YzzytQKVUVjimBU_s_n5NA_6JNzybT3';

  // Load saved email on component mount
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('haven-saved-email');
      if (savedEmail && savedEmail.includes('@')) {
        setEmail(savedEmail);
      }
    }
  }, []);

  // Check username availability
  const checkUsernameAvailability = useCallback(async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?username=eq.${encodeURIComponent(usernameToCheck)}&select=id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      
      // If column doesn't exist, treat all usernames as available for now
      if (data.code === "42703") {
        console.log('Username column not found - treating as available');
        setUsernameAvailable(true);
        return;
      }
      
      setUsernameAvailable(Array.isArray(data) && data.length === 0);
    } catch (error) {
      console.error('Error checking username:', error);
      // Default to available if check fails
      setUsernameAvailable(true);
    } finally {
      setCheckingUsername(false);
    }
  }, [supabaseUrl, supabaseKey]);

  // Debounced username check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailability]);

  // Save email when it changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setShowEmailConflict(false); // Clear email conflict when user changes email
    
    // Save to localStorage when it looks like a valid email
    if (typeof window !== 'undefined' && newEmail.includes('@') && newEmail.includes('.')) {
      localStorage.setItem('haven-saved-email', newEmail);
    }
  };

  // Step 1: Simple validation only (no email checking to avoid temp account issues)
  const handleValidateCredentials = () => {
    // Simple validation for step 1
    setError('');
    setLoading(true);

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Save email for future login
    if (typeof window !== 'undefined' && email.includes('@') && email.includes('.')) {
      localStorage.setItem('haven-saved-email', email);
    }

    // Move to next step
    setStep(2);
    setLoading(false);
  };

  // Final: Create account and save profile
  const handleSaveProfile = async () => {
    if (loading) {
      return; // Prevent duplicate saves
    }
    
    setError('');
    setLoading(true);

    try {
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Configuration error. Please try again.');
      }

      // Step 1: Create the user account (with retry for reliability)
      // Create account with Supabase
      
      let authRes: Response | null = null;
      let authData: any = null;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          authRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
            },
            body: JSON.stringify({ email, password }),
          });

          authData = await authRes.json();
          break; // Success, exit retry loop
        } catch (fetchError) {
          // Retry failed, will try again
          retryCount++;
          if (retryCount > maxRetries) {
            throw fetchError;
          }
          // Wait 500ms before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (!authRes || !authData) {
        throw new Error('Failed to create account. Please try again.');
      }

      // Handle account creation errors  
      if (!authRes.ok) {
        // Get the actual error message from Supabase
        const supabaseError = authData.error_description || 
                             authData.error?.message || 
                             authData.msg || 
                             authData.message ||
                             authData.error ||
                             'Account creation failed. Please try again.';
        
        // Only show email conflict dialog for very specific "user already exists" cases
        if (supabaseError.toLowerCase().includes('user already registered') || 
            authData.error_code === 'user_already_exists' ||
            authRes.status === 422) {
          setShowEmailConflict(true);
          setError('');
        } else {
          // For all other errors (rate limits, etc.), show the actual Supabase message
          setError(supabaseError);
        }
        
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Account creation failed. Please try again.');
        setLoading(false);
        return;
      }

      // Store session
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
        expires_at: authData.expires_at,
        expires_in: authData.expires_in,
        token_type: authData.token_type,
        user: authData.user,
      }));

      // Step 2: Create the profile (INSERT since no auto-trigger)
      const profileData = {
        id: authData.user.id,  // Add user ID for INSERT
        family_name: name,     // Use name as family_name  
        display_name: name,    // Also set display_name
        email,
        username,
        location_name: location.trim(),
        location_lat: null, // Not using exact coordinates for profiles
        location_lng: null,
        kids_ages: kidsAges,
        status: status.length > 0 ? status[0] : 'connecting',
        contact_methods: contactMethods,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles`,
        {
          method: 'POST',  // Changed from PATCH to POST (INSERT)
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authData.access_token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(profileData),
        }
      );

      if (!profileRes.ok) {
        let errorMessage = 'Failed to save profile. Please try again.';
        try {
          const err = await profileRes.json();
          if (err.message && typeof err.message === 'string' && err.message.length < 100) {
            errorMessage = err.message;
          }
        } catch (parseErr) {
          // Use default error message
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Success! Redirect to welcome
      router.push('/welcome');
    } catch (err) {
      console.error('Signup error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const toggleAge = (age: number) => {
    if (kidsAges.includes(age)) {
      setKidsAges(kidsAges.filter(a => a !== age));
    } else {
      setKidsAges([...kidsAges, age].sort((a, b) => a - b));
    }
  };

  // Contact methods now default to in-app messaging only

  const steps = [
    { num: 1, label: 'Account' },
    { num: 2, label: 'About you' },
    { num: 3, label: 'Kids' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {step === 1 ? (
            <Link href="/" className="text-gray-400 hover:text-gray-600">← Back</Link>
          ) : (
            <button 
              onClick={() => {
                // Navigate to previous step
                setStep(step - 1);
              }} 
              className="text-gray-400 hover:text-gray-600"
            >
              ← Back
            </button>
          )}
          <div className="flex items-center gap-2 pointer-events-none">
            <span className="text-xl">✨</span>
            <span className="font-bold text-emerald-600 text-lg" style={{ fontFamily: 'var(--font-fredoka)' }}>Join Haven</span>
          </div>
          <div className="w-12"></div>
        </div>

        {/* Welcome Banner for New Users */}
        {step === 1 && (
          <div className="bg-emerald-100 border border-emerald-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-medium text-emerald-800">Welcome to Haven!</p>
                <p className="text-sm text-emerald-700">Let's create your family profile in 4 easy steps</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200">
              <div 
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              />
            </div>
            {steps.map((s) => (
              <div key={s.num} className="relative flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold z-10 ${
                  step >= s.num ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className={`text-xs mt-2 ${step >= s.num ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                  {s.label}
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

          {showEmailConflict && (
            <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📧</span>
                <h3 className="font-bold text-orange-900">This Email is Already Registered!</h3>
              </div>
              <p className="text-orange-800 text-sm mb-4 leading-relaxed">
                An account with <strong>{email}</strong> already exists in Haven. 
                You can either sign in with this email or use a different one for a new account.
              </p>
              <div className="space-y-2">
                <button 
                  onClick={() => {
                    setShowEmailConflict(false);
                    setStep(1);
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <span>←</span>
                  Go back and use a different email
                </button>
                <Link 
                  href="/login"
                  className="block w-full py-3 bg-emerald-600 text-white rounded-lg text-sm text-center hover:bg-emerald-700 font-semibold transition-colors"
                >
                  Sign in with {email}
                </Link>
              </div>
              <p className="text-xs text-orange-600 mt-3 text-center">
                Choose the option that works best for you
              </p>
            </div>
          )}

          {/* Step 1: Account */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h2>
              <p className="text-gray-600 mb-6">Choose your login details. We'll check email availability when you complete your profile.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    placeholder="At least 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full p-3.5 border rounded-xl focus:ring-2 ${
                      confirmPassword && password !== confirmPassword 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-200 focus:ring-teal-500'
                    }`}
                    placeholder="Confirm your password"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>
                <button
                  onClick={handleValidateCredentials}
                  disabled={!email || password.length < 6 || !confirmPassword || password !== confirmPassword || loading}
                  className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {loading ? 'Validating...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Choose a username</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        setUsername(value);
                      }}
                      className={`w-full p-3.5 border rounded-xl focus:ring-2 pr-10 ${
                        username && username.length >= 3
                          ? 'border-green-300 focus:ring-green-500' 
                          : 'border-gray-200 focus:ring-emerald-500'
                      }`}
                      placeholder="sarah_t"
                      minLength={3}
                      maxLength={20}
                    />
                    {checkingUsername && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin"></div>
                      </div>
                    )}
                    {!checkingUsername && usernameAvailable === true && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
                        ✓
                      </div>
                    )}
                    {!checkingUsername && usernameAvailable === false && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-600">
                        ✗
                      </div>
                    )}
                  </div>
                  {username && username.length < 3 && (
                    <p className="text-sm text-gray-500 mt-1">Username must be at least 3 characters</p>
                  )}
                  {usernameAvailable === false && (
                    <p className="text-sm text-red-600 mt-1">This username is already taken</p>
                  )}
                  {usernameAvailable === true && (
                    <p className="text-sm text-green-600 mt-1">Username is available!</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Only letters, numbers, and underscores. Will be displayed as @{username || 'username'}</p>
                  {checkingUsername && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm font-medium text-blue-900">🔄 Checking username availability...</div>
                    </div>
                  )}
                  {username.trim().length >= 3 && usernameAvailable === false && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-sm font-medium text-red-900">❌ Username "@{username}" is already taken</div>
                      <div className="text-xs text-red-700">Please try a different username</div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your location</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={location.split(',')[0]?.trim() || ''}
                      onChange={(e) => {
                        const town = e.target.value;
                        const state = location.split(',')[1]?.trim() || 'VIC';
                        const newLocation = `${town}, ${state}`;
                        setLocation(newLocation);
                        // Auto-set locationData for form compatibility (town change)
                        setLocationData({
                          name: town,
                          address: newLocation,
                          lat: -38.3305,
                          lng: 144.3256,
                        });
                      }}
                      placeholder="Town/Suburb"
                      className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    />
                    <select
                      value={location.split(',')[1]?.trim() || 'VIC'}
                      onChange={(e) => {
                        const town = location.split(',')[0]?.trim() || '';
                        const state = e.target.value;
                        const newLocation = `${town}, ${state}`;
                        setLocation(newLocation);
                        // Auto-set locationData for form compatibility (state change)
                        setLocationData({
                          name: town,
                          address: newLocation,
                          lat: -38.3305,
                          lng: 144.3256,
                        });
                      }}
                      className="w-full p-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="VIC">VIC</option>
                      <option value="NSW">NSW</option>
                      <option value="QLD">QLD</option>
                      <option value="WA">WA</option>
                      <option value="SA">SA</option>
                      <option value="TAS">TAS</option>
                      <option value="ACT">ACT</option>
                      <option value="NT">NT</option>
                    </select>
                  </div>
                  {location && location.includes(',') && location.split(',')[0].trim() && (
                    <div className="mt-2 p-2 bg-teal-50 border border-teal-200 rounded-lg">
                      <div className="text-sm font-medium text-teal-900">📍 {location}</div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">What brings you here? (Select all that apply)</label>
                  <div className="space-y-2">
                    {[
                      { value: 'considering', label: 'Considering homeschool', icon: '🤔' },
                      { value: 'new', label: 'Just started homeschooling', icon: '🌱' },
                      { value: 'experienced', label: 'Experienced homeschooler', icon: '⭐' },
                      { value: 'connecting', label: 'Looking to connect', icon: '🤝' }
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
                        <span className={status.includes(opt.value) ? 'text-teal-700 font-medium' : 'text-gray-700'}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {status.length === 0 && (
                    <p className="text-sm text-orange-600 mt-1">⚠️ Please select at least one option above to continue</p>
                  )}
                </div>
                
                {/* Debug section removed for production */}
                
                <div>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!name.trim() || !username.trim() || usernameAvailable === false || !location.split(',')[0]?.trim() || status.length === 0 || checkingUsername}
                    className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Kids */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your kids</h2>
              <p className="text-gray-600 mb-6">Tap all ages that apply.</p>
              
              {kidsAges.length > 0 && (
                <div className="mb-4 p-3 bg-emerald-50 rounded-xl">
                  <p className="text-sm text-emerald-700">
                    Selected: {kidsAges.map(a => `${a} years`).join(', ')}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-6 gap-2 mb-6">
                {Array.from({ length: 18 }, (_, i) => i + 1).map((age) => (
                  <button
                    key={age}
                    onClick={() => toggleAge(age)}
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

              <div>
                <button
                  onClick={handleSaveProfile}
                  disabled={kidsAges.length === 0 || loading}
                  className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {loading ? 'Creating your account...' : 'Create Account & Finish'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 removed - default to in-app messaging only */}
        </div>

        {/* Footer - Existing User Call to Action */}
        {step === 1 && (
          <div className="bg-teal-100 border border-teal-200 rounded-xl p-4 mt-6 text-center">
            <p className="text-teal-800 font-medium mb-2">🔑 Already have an account?</p>
            <p className="text-sm text-teal-700 mb-3">Welcome back! Sign in to access your profile</p>
            <Link 
              href="/login" 
              className="inline-block bg-teal-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              Sign In Instead
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
