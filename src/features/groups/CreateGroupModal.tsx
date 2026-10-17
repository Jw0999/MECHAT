import React, { useState, useEffect } from 'react';
import { X, Users, Check, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { toast } from 'sonner';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const createGroup = useChatStore((s) => s.createGroup);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCandidates = async () => {
      if (isDemoMode || !isSupabaseConfigured()) {
        setProfiles([
          {
            id: 'demo-user-2',
            username: 'ninaflora',
            display_name: 'Nina Flora',
            avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
            bio: '',
            online_status: 'online',
            last_seen: '',
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
            bio: '',
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
            bio: '',
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
            bio: '',
            online_status: 'online',
            last_seen: '',
            privacy_online: true,
            privacy_last_seen: true,
            privacy_read_receipts: true,
            created_at: '',
            updated_at: '',
          },
        ]);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUser?.id || '')
          .limit(20);
        setProfiles((data as Profile[]) || []);
      } catch (e) {
        console.error(e);
      }
    };

    fetchCandidates();
  }, [isOpen, isDemoMode, currentUser?.id]);

  if (!isOpen) return null;

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least 1 member');
      return;
    }

    setIsSubmitting(true);
    const res = await createGroup(title.trim(), selectedUserIds);
    setIsSubmitting(false);

    if (res) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-3xl p-5 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-brand" />
            <h2 className="text-base font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
              Create New Group
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#9BA5A8] hover:text-[#F5F7F7] rounded-full transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#9BA5A8] mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Team 🎨"
              className="w-full bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] text-sm text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] placeholder-[#9BA5A8] rounded-xl px-4 py-2.5 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9BA5A8] mb-1.5">
              Select Members ({selectedUserIds.length} selected)
            </label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {profiles.map((p) => {
                const isSelected = selectedUserIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelectUser(p.id)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-[#1D2326] cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          p.avatar_url ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.username}`
                        }
                        alt={p.display_name}
                        className="w-9 h-9 rounded-full object-cover border border-[#252C2E]"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                          {p.display_name}
                        </p>
                        <p className="text-[10px] text-[#9BA5A8]">@{p.username}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-brand border-brand text-[#0B0F10]'
                          : 'border-[#9BA5A8]/50'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || selectedUserIds.length === 0}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-[#0B0F10] font-bold text-sm py-3 rounded-full transition shadow-lg shadow-brand/20"
          >
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
};
