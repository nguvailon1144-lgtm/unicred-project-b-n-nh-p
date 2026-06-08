'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Conversation {
  id: string;
  job_id: string;
  worker_id: string;
  job?: { title: string; owner_id: string };
  other_user?: { id: string; name: string | null; email: string };
  last_message?: string;
  unread_count?: number;
}

interface FloatingChatProps {
  activeUserId: string;
  activeUserName: string;
  onOpenConversation: (convId: string, jobTitle: string, otherName: string) => void;
}

export default function FloatingChat({
  activeUserId,
  activeUserName,
  onOpenConversation,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  // Profile modal state
  const [profileModal, setProfileModal] = useState<{
    name: string;
    email: string;
    university?: string;
    reputation?: number;
    credits?: number;
  } | null>(null);

  const loadConversations = useCallback(async () => {
    if (!activeUserId) return;
    setLoading(true);
    try {
      // Fetch all conversations where current user is either owner (via job) or worker
      const { data: convData, error } = await supabase
        .from('conversations')
        .select('id, job_id, worker_id, job:job_id(title, owner_id)')
        .or(`worker_id.eq.${activeUserId}`)
        .order('id', { ascending: false })
        .limit(30);

      if (error) throw error;

      const rawConvs: any[] = convData || [];

      // Also fetch conversations where we're the job owner
      const { data: ownerConvData } = await supabase
        .from('conversations')
        .select('id, job_id, worker_id, job:job_id(title, owner_id)')
        .filter('job_id', 'in', `(${rawConvs.length > 0 ? 'null' : 'null'})`) // placeholder
        .limit(0);
      
      // Get all job IDs owned by current user to find owner-side convs
      const { data: myJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('owner_id', activeUserId);

      let ownerConvs: any[] = [];
      if (myJobs && myJobs.length > 0) {
        const jobIds = myJobs.map((j: any) => j.id);
        const { data: oc } = await supabase
          .from('conversations')
          .select('id, job_id, worker_id, job:job_id(title, owner_id)')
          .in('job_id', jobIds)
          .order('id', { ascending: false })
          .limit(30);
        ownerConvs = oc || [];
      }

      // Merge and deduplicate
      const allConvs: any[] = [];
      const seen = new Set<string>();
      [...rawConvs, ...ownerConvs].forEach((c) => {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          allConvs.push(c);
        }
      });

      // For each conversation, fetch the other party's info
      const enriched = await Promise.all(
        allConvs.map(async (conv) => {
          const job = Array.isArray(conv.job) ? conv.job[0] : conv.job;
          const isWorker = conv.worker_id === activeUserId;
          const otherUserId = isWorker ? (job?.owner_id || null) : conv.worker_id;

          let other_user = { id: otherUserId || '', name: null as string | null, email: 'Người dùng' };
          if (otherUserId) {
            const { data: ud } = await supabase
              .from('users')
              .select('id, name, email')
              .eq('id', otherUserId)
              .single();
            if (ud) other_user = ud as any;
          }

          // Fetch unread count
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', activeUserId)
            .eq('seen', false);

          // Fetch last message
          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...conv,
            job: Array.isArray(conv.job) ? conv.job[0] : conv.job,
            other_user,
            unread_count: count || 0,
            last_message: lastMsgData?.[0]?.content || null,
          } as Conversation;
        })
      );

      setConversations(enriched);
      setTotalUnread(enriched.reduce((sum, c) => sum + (c.unread_count || 0), 0));
    } catch (err) {
      console.error('[FloatingChat] Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Poll for unread count even when closed
  useEffect(() => {
    if (!activeUserId) return;
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', activeUserId)
        .eq('seen', false);
      setTotalUnread(count || 0);
    }, 15000);
    return () => clearInterval(interval);
  }, [activeUserId]);

  const handleOpenProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('name, email, university, freelancer_reputation, credits')
        .eq('id', userId)
        .single();
      if (data) {
        setProfileModal({
          name: data.name || data.email?.split('@')[0] || 'Sinh Viên',
          email: data.email,
          university: data.university,
          reputation: data.freelancer_reputation,
          credits: data.credits,
        });
      }
    } catch (err) {
      console.error('[FloatingChat] Error loading profile:', err);
    }
  };

  const handleOpenConv = (conv: Conversation) => {
    const jobTitle = (conv.job as any)?.title || 'Công việc';
    const otherName = conv.other_user?.name || conv.other_user?.email?.split('@')[0] || 'Người dùng';
    setIsOpen(false);
    onOpenConversation(conv.id, jobTitle, otherName);
  };

  return (
    <>
      {/* Profile Modal */}
      {profileModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setProfileModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-xs w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                {(profileModal.name?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <p className="font-black text-slate-900">{profileModal.name}</p>
                <p className="text-xs text-slate-500">{profileModal.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {profileModal.university && (
                <p className="text-slate-600">🏫 {profileModal.university}</p>
              )}
              <p className="text-slate-600">⭐ Uy tín: <span className="font-bold text-amber-500">{profileModal.reputation ?? 100}/100</span></p>
              <p className="text-slate-600">🪙 Credits: <span className="font-bold text-indigo-500">{profileModal.credits ?? 0}</span></p>
            </div>
            <button
              onClick={() => setProfileModal(null)}
              className="mt-4 w-full text-center text-xs font-bold text-slate-500 hover:text-slate-700 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Conversation Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[60] w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
            <span className="text-sm font-black text-white">💬 Tin nhắn</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white text-lg leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 flex justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <p className="text-2xl mb-2">💬</p>
                <p>Chưa có cuộc trò chuyện nào.</p>
                <p className="mt-1">Nhắn tin với ứng viên qua các bài đăng công việc.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const otherName = conv.other_user?.name || conv.other_user?.email?.split('@')[0] || 'Người dùng';
                const jobTitle = (conv.job as any)?.title || 'Công việc';
                return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => handleOpenConv(conv)}
                  >
                    {/* Avatar / clickable for profile */}
                    <button
                      className="h-10 w-10 min-w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0 hover:scale-105 transition-transform cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (conv.other_user?.id) handleOpenProfile(conv.other_user.id);
                      }}
                      title="Xem hồ sơ"
                    >
                      {otherName[0]?.toUpperCase() || 'U'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          className="text-xs font-black text-slate-900 truncate hover:text-indigo-600 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (conv.other_user?.id) handleOpenProfile(conv.other_user.id);
                          }}
                        >
                          {otherName}
                        </button>
                        {(conv.unread_count || 0) > 0 && (
                          <span className="flex-shrink-0 h-5 min-w-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center px-1">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-indigo-500 font-semibold truncate">💼 {jobTitle}</p>
                      {conv.last_message && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{conv.last_message}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Bubble Button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white"
        title="Mở tin nhắn"
      >
        <span className="text-2xl">{isOpen ? '✕' : '💬'}</span>
        {totalUnread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-rose-500 border-2 border-white text-white text-[10px] font-black flex items-center justify-center px-1">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </>
  );
}
