'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredSession } from '@/lib/session';
import { getAvatarColor } from '@/lib/colors';
import AvatarUpload from '@/components/AvatarUpload';

type Conversation = {
  id: string;
  other_user: {
    id: string;
    name: string;
    avatar_url?: string;
    location_name: string;
  };
  last_message_text: string | null;
  last_message_at: string | null;
  unread: boolean;
};

type Message = {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
};

function MessagesContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [conversationSelectionMode, setConversationSelectionMode] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showDeleteConversationModal, setShowDeleteConversationModal] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Reusable function to load conversations
  const reloadConversations = async () => {
    const session = getStoredSession();
    if (!session?.user) return;

    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/conversations?or=(participant_1.eq.${session.user.id},participant_2.eq.${session.user.id})&select=*`,
        {
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const convos = await res.json();
      
      const enriched = await Promise.all(convos.map(async (c: any) => {
        const otherId = c.participant_1 === session.user.id ? c.participant_2 : c.participant_1;
        
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${otherId}&select=id,name,location_name`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const profiles = await profileRes.json();
        
        return {
          id: c.id,
          other_user: profiles[0] || { id: otherId, name: 'Unknown', location_name: '' },
          last_message_text: c.last_message_text,
          last_message_at: c.last_message_at,
          unread: c.last_message_by && c.last_message_by !== session.user.id,
        };
      }));
      
      setConversations(enriched);
    } catch (err) {
      console.error('Error reloading conversations:', err);
    }
  };

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      const session = getStoredSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      try {
        await reloadConversations();
        
        const openId = searchParams.get('open');
        if (openId) {
          setSelectedId(openId);
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [router, searchParams]);

  useEffect(() => {
    if (!selectedId || !userId) return;
    
    const loadMessages = async () => {
      const session = getStoredSession();
      if (!session) return;

      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${selectedId}&select=*&order=created_at.asc`,
          {
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const msgs = await res.json();
        setMessages(msgs);

        // Mark conversation as read by clearing unread status
        // This happens when user opens a conversation
        await fetch(
          `${supabaseUrl}/rest/v1/conversations?id=eq.${selectedId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // We can use a specific field for marking as read, or just not update last_message_by
              // For now, we'll leave it as is since the main unread logic is in BottomNav
            }),
          }
        );
        
        // Update local conversations state to remove unread indicator  
        setConversations(prev => prev.map(c => 
          c.id === selectedId 
            ? { ...c, unread: false }
            : c
        ));
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    loadMessages();
  }, [selectedId, userId]);

  // Cleanup timer on unmount and clear selection when switching conversations
  useEffect(() => {
    setSelectionMode(false);
    setSelectedMessages([]);
    setConversationSelectionMode(false);
    setSelectedConversations([]);
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [selectedId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  const sendMessageHandler = async () => {
    if (!newMessage.trim() || !selectedId || !userId) return;
    
    const session = getStoredSession();
    if (!session) return;

    setSending(true);
    
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/messages`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            conversation_id: selectedId,
            sender_id: userId,
            content: newMessage,
          }),
        }
      );
      
      if (res.ok) {
        const [newMsg] = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        
        await fetch(
          `${supabaseUrl}/rest/v1/conversations?id=eq.${selectedId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              last_message_text: newMessage,
              last_message_at: new Date().toISOString(),
              last_message_by: userId,
            }),
          }
        );
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async () => {
    if (!selectedId || !userId) return;
    
    const session = getStoredSession();
    if (!session) return;

    try {
      // Delete all messages in the conversation first
      const deleteMessagesRes = await fetch(
        `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${selectedId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!deleteMessagesRes.ok) {
        throw new Error(`Failed to delete messages: ${deleteMessagesRes.status}`);
      }

      // Delete the conversation
      const deleteConvoRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${selectedId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey!,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!deleteConvoRes.ok) {
        throw new Error(`Failed to delete conversation: ${deleteConvoRes.status}`);
      }

      // Update local state only after successful deletion
      setConversations(prev => prev.filter(c => c.id !== selectedId));
      setSelectedId(null);
      setMessages([]);
      setShowDeleteModal(false);
      setShowOptionsMenu(false);
      
      // Don't reload immediately - trust local state to prevent reappearing items
    } catch (err) {
      console.error('Error deleting conversation:', err);
      alert('Failed to delete conversation. Please try again.');
    }
  };

  const deleteSelectedMessages = async () => {
    if (selectedMessages.length === 0 || !userId) return;
    
    const session = getStoredSession();
    if (!session) return;

    try {
      // Delete all selected messages
      for (const messageId of selectedMessages) {
        const deleteRes = await fetch(
          `${supabaseUrl}/rest/v1/messages?id=eq.${messageId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (!deleteRes.ok) {
          throw new Error(`Failed to delete message ${messageId}: ${deleteRes.status}`);
        }
      }

      // Update local state only after successful deletion
      setMessages(prev => prev.filter(m => !selectedMessages.includes(m.id)));
      setSelectedMessages([]);
      setSelectionMode(false);
      setShowDeleteMessageModal(false);
    } catch (err) {
      console.error('Error deleting messages:', err);
      alert('Failed to delete messages. Please try again.');
    }
  };

  const handleMessageLongPress = (messageId: string) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedMessages([messageId]);
    }
  };

  const handleMessageTap = (messageId: string) => {
    if (selectionMode) {
      setSelectedMessages(prev => 
        prev.includes(messageId) 
          ? prev.filter(id => id !== messageId)
          : [...prev, messageId]
      );
    }
  };

  const handleConversationLongPress = (conversationId: string) => {
    if (!conversationSelectionMode) {
      setConversationSelectionMode(true);
      setSelectedConversations([conversationId]);
    }
  };

  const handleConversationTap = (conversationId: string) => {
    if (conversationSelectionMode) {
      setSelectedConversations(prev => 
        prev.includes(conversationId) 
          ? prev.filter(id => id !== conversationId)
          : [...prev, conversationId]
      );
    } else {
      setSelectedId(conversationId);
    }
  };

  const deleteSelectedConversations = async () => {
    if (selectedConversations.length === 0 || !userId) return;
    
    const session = getStoredSession();
    if (!session) return;

    try {
      // Delete all selected conversations
      for (const conversationId of selectedConversations) {
        // Delete all messages in the conversation first
        const deleteMessagesRes = await fetch(
          `${supabaseUrl}/rest/v1/messages?conversation_id=eq.${conversationId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (!deleteMessagesRes.ok) {
          throw new Error(`Failed to delete messages for conversation ${conversationId}: ${deleteMessagesRes.status}`);
        }

        // Delete the conversation
        const deleteConvoRes = await fetch(
          `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey!,
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (!deleteConvoRes.ok) {
          throw new Error(`Failed to delete conversation ${conversationId}: ${deleteConvoRes.status}`);
        }
      }

      // Update local state only after successful deletion
      setConversations(prev => prev.filter(c => !selectedConversations.includes(c.id)));
      setSelectedConversations([]);
      setConversationSelectionMode(false);
      setShowDeleteConversationModal(false);
      
      // If we deleted the currently selected conversation, clear it
      if (selectedId && selectedConversations.includes(selectedId)) {
        setSelectedId(null);
        setMessages([]);
      }
      
      // Don't reload immediately - trust local state to prevent reappearing items
    } catch (err) {
      console.error('Error deleting conversations:', err);
      alert('Failed to delete conversations. Please try again.');
    }
  };

  const cancelConversationSelection = () => {
    setConversationSelectionMode(false);
    setSelectedConversations([]);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
  };

  const selected = conversations.find(c => c.id === selectedId);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            {/* Haven branding */}
            <div className="mb-3 pt-2">
              <h1 className="text-lg font-bold bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-fredoka)' }}>
                Haven
              </h1>
            </div>
            
            {/* User info row */}
            {selectionMode ? (
              <div className="flex items-center justify-between">
                <button 
                  onClick={cancelSelection}
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{selectedMessages.length} selected</span>
                  <button
                    onClick={() => setShowDeleteMessageModal(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                    disabled={selectedMessages.length === 0}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedId(null)}
                  className="text-teal-600 hover:text-teal-700 p-1 font-medium"
                >
                  ← Back
                </button>
                <AvatarUpload
                  userId={selected.other_user.id}
                  currentAvatarUrl={selected.other_user.avatar_url}
                  name={selected.other_user.name}
                  size="sm"
                  editable={false}
                />
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">{selected.other_user.name}</h2>
                  <p className="text-xs text-gray-500">📍 {selected.other_user.location_name}</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                  >
                    ⋯
                  </button>
                  {showOptionsMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[160px]">
                      <button
                        onClick={() => {
                          setShowDeleteModal(true);
                          setShowOptionsMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 text-sm"
                      >
                        🗑️ Delete conversation
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No messages yet.</p>
              <p className="text-sm mt-1">Send a message to start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
              >
                <div className="relative">
                  {selectionMode && (
                    <div 
                      className="absolute -left-8 top-1/2 transform -translate-y-1/2 z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMessageTap(msg.id);
                      }}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedMessages.includes(msg.id) 
                          ? 'bg-teal-600 border-teal-600' 
                          : 'bg-white border-gray-300 hover:border-gray-400'
                      }`}>
                        {selectedMessages.includes(msg.id) && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    className={`max-w-[92%] px-4 py-3 rounded-2xl transition-all cursor-pointer ${
                      msg.sender_id === userId
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                    } ${
                      selectedMessages.includes(msg.id) 
                        ? 'ring-2 ring-teal-300 scale-95' 
                        : selectionMode 
                          ? 'opacity-60' 
                          : ''
                    }`}
                    onTouchStart={(e) => {
                      if (longPressTimer) clearTimeout(longPressTimer);
                      const timer = setTimeout(() => handleMessageLongPress(msg.id), 600);
                      setLongPressTimer(timer);
                    }}
                    onTouchEnd={() => {
                      if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        setLongPressTimer(null);
                      }
                      if (selectionMode) handleMessageTap(msg.id);
                    }}
                    onClick={() => {
                      if (selectionMode) handleMessageTap(msg.id);
                    }}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.sender_id === userId ? 'text-teal-200' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {!selectionMode && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-24 z-10">
            <div className="max-w-4xl mx-auto flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessageHandler()}
                placeholder="Type a message..."
                className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={sendMessageHandler}
                disabled={!newMessage.trim() || sending}
                className="px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400"
              >
                {sending ? '...' : '→'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header with Haven branding */}
        {conversationSelectionMode ? (
          <div className="flex items-center justify-between mb-8 pt-6">
            <button 
              onClick={cancelConversationSelection}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Cancel
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{selectedConversations.length} selected</span>
              <button
                onClick={() => setShowDeleteConversationModal(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                disabled={selectedConversations.length === 0}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8 pt-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-fredoka)' }}>
              Haven
            </h1>
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No conversations yet</h3>
            <p className="text-gray-600 mb-4">
              Start connecting with families in Discover!
            </p>
            <button
              onClick={() => router.push('/discover')}
              className="bg-teal-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-teal-700"
            >
              Find Families
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((convo) => (
              <div key={convo.id} className="relative">
                {conversationSelectionMode && (
                  <div 
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConversationTap(convo.id);
                    }}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedConversations.includes(convo.id) 
                        ? 'bg-teal-600 border-teal-600' 
                        : 'bg-white border-gray-300 hover:border-gray-400'
                    }`}>
                      {selectedConversations.includes(convo.id) && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleConversationTap(convo.id)}
                  onTouchStart={() => {
                    if (longPressTimer) clearTimeout(longPressTimer);
                    if (!conversationSelectionMode) {
                      const timer = setTimeout(() => handleConversationLongPress(convo.id), 600);
                      setLongPressTimer(timer);
                    }
                  }}
                  onTouchEnd={() => {
                    if (longPressTimer) {
                      clearTimeout(longPressTimer);
                      setLongPressTimer(null);
                    }
                  }}
                  className={`w-full bg-white rounded-xl p-4 flex items-center gap-3 transition-all text-left ${
                    conversationSelectionMode
                      ? selectedConversations.includes(convo.id)
                        ? 'ring-2 ring-teal-300 scale-95 ml-8'
                        : 'opacity-60 ml-8'
                      : 'hover:bg-gray-50'
                  }`}
                >
                <div className="flex-shrink-0">
                  <AvatarUpload
                    userId={convo.other_user.id}
                    currentAvatarUrl={convo.other_user.avatar_url}
                    name={convo.other_user.name}
                    size="md"
                    editable={false}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-semibold ${convo.unread ? 'text-gray-900' : 'text-gray-700'}`}>
                      {convo.other_user.name}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {formatTime(convo.last_message_at)}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${convo.unread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {convo.last_message_text || 'No messages yet'}
                  </p>
                </div>
                {convo.unread && !conversationSelectionMode && (
                  <div className="w-3 h-3 bg-teal-600 rounded-full flex-shrink-0"></div>
                )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete conversation?</h3>
              <p className="text-gray-600 mb-6">
                This will permanently delete all messages with {(selected as Conversation).other_user.name}. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteConversation}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Messages Modal */}
      {showDeleteMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Delete {selectedMessages.length} message{selectedMessages.length === 1 ? '' : 's'}?
              </h3>
              <p className="text-gray-600 mb-6">
                {selectedMessages.length === 1 
                  ? 'This message will be permanently deleted.'
                  : `These ${selectedMessages.length} messages will be permanently deleted.`
                } This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteMessageModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteSelectedMessages}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversations Modal */}
      {showDeleteConversationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Delete {selectedConversations.length} conversation{selectedConversations.length === 1 ? '' : 's'}?
              </h3>
              <p className="text-gray-600 mb-6">
                {selectedConversations.length === 1 
                  ? 'This will permanently delete this conversation and all its messages.'
                  : `This will permanently delete these ${selectedConversations.length} conversations and all their messages.`
                } This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConversationModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteSelectedConversations}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}
