'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClearAuthPage() {
  const [cleared, setCleared] = useState(false);
  const [oldTokensFound, setOldTokensFound] = useState(false);

  useEffect(() => {
    // Check for old tokens
    const oldKey = 'sb-lpatbzdghfrghzximywg-auth-token';
    const newKey = 'sb-aqghkzixmedgoydgzhzu-auth-token';
    
    const hasOldToken = localStorage.getItem(oldKey);
    const hasNewToken = localStorage.getItem(newKey);
    
    setOldTokensFound(!!hasOldToken);
    
    console.log('🔍 Auth token audit:');
    console.log('Old US East token:', hasOldToken ? 'FOUND' : 'none');
    console.log('New Sydney token:', hasNewToken ? 'FOUND' : 'none');
  }, []);

  const clearAllAuth = () => {
    // Clear all possible auth-related localStorage items
    const keysToRemove = [
      'sb-lpatbzdghfrghzximywg-auth-token', // Old US East
      'sb-aqghkzixmedgoydgzhzu-auth-token', // New Sydney
      'supabase.auth.token',
      'haven-saved-email'
    ];

    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`🗑️ Removing: ${key}`);
        localStorage.removeItem(key);
      }
    });

    // Clear any other supabase related items
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        console.log(`🗑️ Removing additional: ${key}`);
        localStorage.removeItem(key);
      }
    });

    setCleared(true);
    console.log('✅ All auth data cleared');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto pt-20">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">
            🔧 Clear Auth Data
          </h1>
          
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h2 className="font-semibold text-yellow-800 mb-2">
              📋 Sydney Migration Notice
            </h2>
            <p className="text-sm text-yellow-700">
              We migrated Haven to Sydney servers for better performance. 
              Existing accounts need to be recreated due to the database migration.
            </p>
          </div>

          {oldTokensFound && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                ⚠️ Found old authentication data that may be causing login issues.
              </p>
            </div>
          )}

          {!cleared ? (
            <div className="space-y-4">
              <button
                onClick={clearAllAuth}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700"
              >
                Clear All Auth Data
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                This will remove all stored login information. You'll need to sign up again.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-700 font-semibold">✅ Auth data cleared!</p>
                <p className="text-sm text-green-600 mt-1">
                  You can now sign up for a fresh account.
                </p>
              </div>
              
              <Link
                href="/signup"
                className="block w-full bg-teal-600 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-teal-700"
              >
                Go to Signup
              </Link>
              
              <Link
                href="/"
                className="block w-full text-center text-gray-600 hover:text-gray-800"
              >
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}