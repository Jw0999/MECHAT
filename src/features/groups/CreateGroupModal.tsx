import React, { useState, useEffect } from 'react';
import { X, Users, Check, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';
import { DEMO_PROFILES } from '@/lib/constants/demoProfiles';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { toast } from 'sonner';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
        setProfiles(DEMO_PROFILES.filter((p) => p.id !== currentUser?.id));
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUser?.id || '')
          .order('display_name', { ascending: true })
          .limit(50);
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

    setIsSubmitting(true);
    const res = await createGroup(
      title.trim(),
      selectedUserIds,
      description.trim() || undefined
    );
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
              Group Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              rows={2}
              className="w-full bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] text-xs text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] placeholder-[#9BA5A8] rounded-xl px-4 py-2 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#9BA5A8] mb-1.5">
              Select Members ({selectedUserIds.length} selected)
            </label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {profiles.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#1D2326] text-center text-xs text-[#9BA5A8]">
                  No other contacts found yet. You will be the group creator & admin. You can invite more members later!
                </div>
              ) : (
                profiles.map((p) => {
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
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-[#0B0F10] font-bold text-sm py-3 rounded-full transition shadow-lg shadow-brand/20"
          >
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
};
