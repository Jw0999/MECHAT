import React, { useState, useEffect } from 'react';
import { X, Search, Send, Check, Users, Copy, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';
import type { GameType } from '@/types/games.types';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { DEMO_PROFILES } from '@/lib/constants/demoProfiles';
import { getInitials, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ShareGameCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  gameType: GameType;
}

const GAME_TITLES: Record<GameType, string> = {
  pool: '8-Ball Pool',
  tic_tac_toe: 'Tic-Tac-Toe',
  whot: 'Naija Whot! (Whot Whot)',
  trivia: 'Trivia Clash',
};

export const ShareGameCodeModal: React.FC<ShareGameCodeModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  gameType,
}) => {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentUserIds, setSentUserIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const currentProfile = useAuthStore((s) => s.profile);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const createDirectConversation = useChatStore((s) => s.createDirectConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);

  useEffect(() => {
    if (!isOpen) return;

    const fetchRegisteredUsers = async () => {
      setLoading(true);

      if (isDemoMode || !isSupabaseConfigured()) {
        const otherDemos = DEMO_PROFILES.filter((p) => p.id !== currentUser?.id);
        setProfiles(otherDemos);
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUser?.id || '');

        if (search.trim()) {
          query = query.or(`username.ilike.%${search.trim()}%,display_name.ilike.%${search.trim()}%`);
        }

        const { data, error } = await query.limit(30);
        if (error) throw error;
        setProfiles((data as Profile[]) || []);
      } catch (err: any) {
        console.warn('Profiles query notice (falling back to demo list):', err);
        const otherDemos = DEMO_PROFILES.filter((p) => p.id !== currentUser?.id);
        setProfiles(otherDemos);
      } finally {
        setLoading(false);
      }
    };

    fetchRegisteredUsers();
  }, [isOpen, search, currentUser?.id, isDemoMode]);

  if (!isOpen) return null;

  const gameTitle = GAME_TITLES[gameType] || 'Game';

  const handleCopyCode = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success('Room code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendToUser = async (targetUser: Profile) => {
    if (sendingUserId) return;

    setSendingUserId(targetUser.id);
    try {
      // 1. Create or get existing direct conversation with target user
      const conversationId = await createDirectConversation(targetUser.id);
      if (!conversationId) {
        throw new Error('Could not open conversation with user');
      }

      // 2. Format a clear, structured invitation message
      const hostName = currentProfile?.display_name || 'Your friend';
      const invitationText = `🎮 Let's play ${gameTitle} on MeChat!\n\nRoom Code: ${roomCode}\n\n👉 To play:\n1. Copy this code: ${roomCode}\n2. Go to Games > Join with Code\n3. Paste the code to join the match!`;

      // 3. Send message with structured metadata
      await sendMessage(conversationId, invitationText, 'text', {
        isGameInvite: true,
        gameType,
        roomCode,
        hostName,
      });

      setSentUserIds((prev) => new Set(prev).add(targetUser.id));
      toast.success(`Game code sent to ${targetUser.display_name}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send game code');
    } finally {
      setSendingUserId(null);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-3xl p-5 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Share Game Code</h2>
              <p className="text-[11px] text-[#9BA5A8]">Send code to registered MeChat users</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9BA5A8] hover:text-white hover:bg-[#252C2E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Room Code Banner */}
        <div className="my-3 p-3 rounded-2xl bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9BA5A8] block">
              {gameTitle} Code
            </span>
            <span className="font-mono text-xl font-black text-brand tracking-widest">
              {roomCode}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#E9EDE8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-xs font-semibold hover:border-brand/40 transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} className="text-brand" />
                <span className="text-brand">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} className="text-[#9BA5A8]" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5A8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search registered users..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-xs placeholder:text-[#9BA5A8] focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[180px] max-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-[#9BA5A8]">
              <Loader2 size={24} className="animate-spin text-brand mb-2" />
              <p className="text-xs">Loading users...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#9BA5A8]">
              No registered users found
            </div>
          ) : (
            filteredProfiles.map((user) => {
              const isSent = sentUserIds.has(user.id);
              const isSending = sendingUserId === user.id;

              return (
                <div
                  key={user.id}
                  onClick={() => !isSent && !isSending && handleSendToUser(user)}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer',
                    isSent
                      ? 'border-brand/40 bg-brand/5'
                      : 'border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD] bg-[#0B0F10]/50 dark:bg-[#0B0F10]/50 light:bg-[#F7F9F5] hover:border-brand/40 hover:bg-[#1c2326]'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                          {getInitials(user.display_name || user.username)}
                        </div>
                      )}
                      {user.online_status === 'online' && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#151A1C]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate leading-tight">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-[10px] text-[#9BA5A8] truncate mt-0.5">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSent || isSending}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendToUser(user);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0',
                      isSent
                        ? 'bg-brand/20 text-brand border border-brand/30 cursor-default'
                        : 'bg-brand text-[#0B0F10] hover:bg-brand/90 active:scale-95 shadow-sm'
                    )}
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : isSent ? (
                      <>
                        <Check size={12} strokeWidth={2.5} />
                        <span>Sent</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        <span>Send Code</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-3 mt-2 border-t border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-center">
          <p className="text-[11px] text-[#9BA5A8]">
            Tapping "Send Code" sends a direct chat message with the room code so they can paste it in <span className="text-brand font-semibold">Join with Code</span>.
          </p>
        </div>
      </div>
    </div>
  );
};
