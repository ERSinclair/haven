'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStoredSession } from '@/lib/session';

export default function BottomNav() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const session = getStoredSession();
    setIsLoggedIn(!!session?.user);
  }, [pathname]);

  // Check for unread messages
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkUnreadMessages = async () => {
      const session = getStoredSession();
      if (!session?.user) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        // Get conversations where user is participant and has unread messages
        const res = await fetch(
          `${supabaseUrl}/rest/v1/conversations?or=(participant_1.eq.${session.user.id},participant_2.eq.${session.user.id})&select=*`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const conversations = await res.json();
        
        // Count unread conversations (where last message was not by current user)
        const unreadConversations = conversations.filter((conv: any) => 
          conv.last_message_by && conv.last_message_by !== session.user.id
        );
        
        setUnreadCount(unreadConversations.length);
      } catch (err) {
        console.error('Error checking unread messages:', err);
      }
    };

    // Check immediately
    checkUnreadMessages();

    // Check every 30 seconds for new messages
    const interval = setInterval(checkUnreadMessages, 30000);
    
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const navItems = [
    { href: '/discover', label: 'Discover', badge: 0 },
    { href: '/events', label: 'Events', badge: 0 },
    { href: '/messages', label: 'Messages', badge: unreadCount },
    { href: '/profile', label: 'Profile', badge: 0 },
  ];

  // Only show nav when logged in, but not on auth pages
  const authPages = ['/', '/signup', '/login', '/welcome', '/forgot-password'];
  if (authPages.includes(pathname) || !isLoggedIn) {
    return null;
  }

  return (
    <div
      id="bottom-navigation-v2"
      style={{
        position: 'fixed',
        bottom: '0px',
        left: '0px',
        right: '0px',
        zIndex: 9999,
        height: '80px',
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
    >
      <nav className="h-full bg-gradient-to-t from-gray-50 via-white to-gray-50">
        <div className="max-w-md mx-auto h-full flex justify-around items-center px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${
                isActive 
                  ? 'text-teal-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="relative mb-1">
                {item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-sm z-10">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-sm font-semibold transition-all duration-200 ${
                isActive ? 'text-teal-600 scale-105' : 'text-gray-600'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-10 h-1 bg-teal-600 rounded-full shadow-sm"></span>
              )}
            </Link>
          );
        })}
        </div>
      </nav>
    </div>
  );
}