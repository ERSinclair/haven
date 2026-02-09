'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '@/lib/session';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function WelcomePage() {
  const fetchProfileData = async (userId: string, accessToken: string) => {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=name,location_name`,
        {
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const profiles = await response.json();
      if (profiles && profiles.length > 0) {
        setProfileData(profiles[0]);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };
  const [userData, setUserData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const session = getStoredSession();
    if (session?.user) {
      setUserData(session.user);
      // Fetch profile data separately
      fetchProfileData(session.user.id, session.access_token);
    } else {
      router.push('/signup');
      return;
    }

    // Don't auto-redirect - let users see welcome every time they complete signup
    // (Only redirect from direct URL access, not from signup completion)

    // Animate in steps
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 800),
      setTimeout(() => setStep(3), 1300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [router]);

  if (!userData || isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-600 to-emerald-600 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-600 to-emerald-600 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {/* Celebration Icon */}
        <div className={`transition-all duration-500 ${step >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="w-24 h-24 bg-white rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
            <span className="text-5xl">🎉</span>
          </div>
        </div>

        {/* Welcome Message */}
        <div className={`transition-all duration-500 delay-100 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-fredoka)' }}>
            Welcome{profileData?.name ? `, ${profileData.name}` : ''}!
          </h1>
          <p className="text-teal-100 text-lg mb-8">
            You're all set up and ready to connect.
          </p>
        </div>

        {/* Stats Preview */}
        <div className={`bg-white/10 backdrop-blur rounded-2xl p-6 mb-8 transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-white/80 text-sm mb-4">Near {profileData?.location_name || 'your area'}, there are:</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-bold text-white">12</p>
              <p className="text-xs text-teal-200">Families</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">8</p>
              <p className="text-xs text-teal-200">With similar ages</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">3</p>
              <p className="text-xs text-teal-200">Events this week</p>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className={`text-left bg-white rounded-2xl p-6 mb-8 transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-sm font-semibold text-gray-900 mb-4">Quick tips to get started:</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-teal-600 text-xs font-bold">1</span>
              </div>
              <p className="text-sm text-gray-600">
                <strong className="text-gray-900">Browse families nearby</strong> — see who's in your area and filter by kids' ages
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-teal-600 text-xs font-bold">2</span>
              </div>
              <p className="text-sm text-gray-600">
                <strong className="text-gray-900">Send a message</strong> — introduce yourself, suggest a park meetup
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-teal-600 text-xs font-bold">3</span>
              </div>
              <p className="text-sm text-gray-600">
                <strong className="text-gray-900">Check out events</strong> — join local meetups or create your own
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={`transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Link
            href="/discover"
            onClick={() => localStorage.setItem('haven-welcome-completed', 'true')}
            className="block w-full bg-white text-teal-600 text-lg font-semibold py-4 px-8 rounded-xl hover:bg-teal-50 active:scale-[0.98] transition-all shadow-lg"
          >
            Find Families Near Me →
          </Link>
          
          <p className="mt-4 text-teal-200 text-sm">
            Or explore{' '}
            <Link 
              href="/events" 
              onClick={() => localStorage.setItem('haven-welcome-completed', 'true')}
              className="underline text-white hover:text-teal-100"
            >
              upcoming events
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
