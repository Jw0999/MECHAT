import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, MessageCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { toast } from 'sonner';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const createDirectConversation = useChatStore((s) => s.createDirectConversation);

  useEffect(() => {
    if (!isOpen) return;

    const fetchProfiles = async () => {
      setLoading(true);

      if (isDemoMode || !isSupabaseConfigured()) {
        // Return preset contacts in demo mode
        setProfiles([
          {
            id: 'demo-user-2',
            username: 'ninaflora',
            display_name: 'Nina Flora',
            avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
            bio: 'Coffee lover & UI/UX explorer ☕️✨',
            online_status: 'online',
            last_seen: new Date().toISOString(),
            privacy_online: true,
            privacy_last_seen: true,
            privacy_read_receipts: true,
            created_at: '',
            updated_at: '',
          },
          {
            id: 'demo-user-danang',
            username: 'danangcalvin',
            display_name: 'Danang Calvin',
            avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
            bio: 'Mobile Dev & Traveler 🎒',
            online_status: 'offline',
            last_seen: '',
            privacy_online: true,
            privacy_last_seen: true,
            privacy_read_receipts: true,
            created_at: '',
            updated_at: '',
          },
          {
            id: 'demo-user-satria',
            username: 'satriah',
            display_name: 'Satria herman',
            avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
            bio: 'Lead Engineer @ FinTech',
            online_status: 'online',
            last_seen: '',
            privacy_online: true,
            privacy_last_seen: true,
            privacy_read_receipts: true,
            created_at: '',
            updated_at: '',
          },
          {
            id: 'demo-user-alex',
            username: 'alexander',
            display_name: 'Alexander',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            bio: 'Sound designer & synth enthusiast 🎹',
            online_status: 'online',
            last_seen: '',
            privacy_online: true,
            privacy_last_seen: true,
            privacy_read_receipts: true,
            created_at: '',
            updated_at: '',
          },
        ]);
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

        const { data, error } = await query.limit(20);
        if (error) throw error;
        setProfiles((data as Profile[]) || []);
      } catch (err: any) {
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [isOpen, search, currentUser?.id, isDemoMode]);

  if (!isOpen) return null;

  const handleStartChat = async (targetUser: Profile) => {
    onClose();
    await createDirectConversation(targetUser.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-3xl p-5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-brand" />
            <h2 className="text-base font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
              Start New Chat
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#9BA5A8] hover:text-[#F5F7F7] rounded-full transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative my-4">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5A8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username or name..."
            className="w-full bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] text-sm text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] placeholder-[#9BA5A8] rounded-full pl-10 pr-4 py-2.5 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand transition"
          />
        </div>

        {/* Users list */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <p className="text-xs text-center text-[#9BA5A8] py-8">Searching users...</p>
          ) : profiles.length === 0 ? (
            <p className="text-xs text-center text-[#9BA5A8] py-8">No users found</p>
          ) : (
            profiles.map((p) => (
              <div
                key={p.id}
                onClick={() => handleStartChat(p)}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#1D2326] dark:hover:bg-[#1D2326] light:hover:bg-[#F0F3ED] cursor-pointer transition group"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`}
                    alt={p.display_name}
                    className="w-11 h-11 rounded-full object-cover border border-[#252C2E]"
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                      {p.display_name}
                    </h4>
                    <p className="text-xs text-[#9BA5A8]">@{p.username}</p>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-brand/15 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-[#0B0F10] transition">
                  <MessageCircle size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
