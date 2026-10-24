import React, { useState, useEffect } from 'react';
import { X, Search, Phone, Video, Users, User, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { DEMO_PROFILES } from '@/lib/constants/demoProfiles';
import type { Profile, Conversation } from '@/types/database.types';
import { getInitials, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StartCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartCallModal: React.FC<StartCallModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'contacts' | 'groups'>('all');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const conversations = useChatStore((s) => s.conversations);
  const initiateCall = useCallStore((s) => s.initiateCall);
  const initiateGroupCall = useCallStore((s) => s.initiateGroupCall);

  const groups = conversations.filter((c) => c.type === 'group');

  useEffect(() => {
    if (!isOpen) return;

    const fetchContacts = async () => {
      setLoading(true);
      if (isDemoMode || !isSupabaseConfigured()) {
        const others = DEMO_PROFILES.filter((p) => p.id !== currentUser?.id);
        setProfiles(others);
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
      } catch (e) {
        const others = DEMO_PROFILES.filter((p) => p.id !== currentUser?.id);
        setProfiles(others);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [isOpen, search, currentUser?.id, isDemoMode]);

  if (!isOpen) return null;

  const handleStartDirectCall = (contact: Profile, callType: 'audio' | 'video') => {
    // Find matching direct conversation if any
    const existing = conversations.find(
      (c) => c.type === 'direct' && c.other_user?.id === contact.id
    );
    initiateCall(contact, callType, existing?.id);
    onClose();
  };

  const handleStartGroupCall = (group: Conversation, callType: 'audio' | 'video') => {
    const memberProfiles = (group.members || [])
      .map((m) => m.profile)
      .filter(Boolean) as any[];
    initiateGroupCall(group.id, group.title || 'Group Call', callType, memberProfiles);
    onClose();
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  const filteredGroups = groups.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return g.title?.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
              <Phone size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">New Call</h2>
              <p className="text-[11px] text-[#9BA5A8]">Start a voice or video call with anyone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#9BA5A8] hover:text-white hover:bg-[#252C2E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative my-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5A8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts or groups..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] text-xs placeholder:text-[#9BA5A8] focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 mb-3">
          {(['all', 'contacts', 'groups'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-bold capitalize transition-all',
                tab === t
                  ? 'bg-brand text-[#0B0F10]'
                  : 'bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#9BA5A8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* List of Contacts and Groups */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#9BA5A8]">
              <Loader2 size={24} className="animate-spin text-brand mb-2" />
              <p className="text-xs">Loading contacts...</p>
            </div>
          ) : (
            <>
              {/* Groups Section */}
              {(tab === 'all' || tab === 'groups') && filteredGroups.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-1 text-[11px] font-bold text-[#9BA5A8] uppercase tracking-wider flex items-center gap-1">
                    <Users size={12} className="text-brand" />
                    <span>Groups ({filteredGroups.length})</span>
                  </div>
                  {filteredGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl border border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD] bg-[#0B0F10]/50 dark:bg-[#0B0F10]/50 light:bg-[#F7F9F5] hover:border-brand/40 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                          <Users size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate leading-tight">{group.title}</p>
                          <p className="text-[10px] text-[#9BA5A8] mt-0.5">
                            {group.members?.length || 2} members • Group Call
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartGroupCall(group, 'audio')}
                          className="w-8 h-8 rounded-xl bg-[#252C2E] hover:bg-brand hover:text-[#0B0F10] text-brand flex items-center justify-center transition-all shadow-sm"
                          title="Group Voice Call"
                        >
                          <Phone size={14} />
                        </button>
                        <button
                          onClick={() => handleStartGroupCall(group, 'video')}
                          className="w-8 h-8 rounded-xl bg-brand text-[#0B0F10] hover:bg-brand/90 flex items-center justify-center transition-all shadow-sm font-bold"
                          title="Group Video Call"
                        >
                          <Video size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contacts Section */}
              {(tab === 'all' || tab === 'contacts') && (
                <div className="space-y-1.5 mt-2">
                  <div className="px-1 text-[11px] font-bold text-[#9BA5A8] uppercase tracking-wider flex items-center gap-1">
                    <User size={12} className="text-brand" />
                    <span>People ({filteredProfiles.length})</span>
                  </div>
                  {filteredProfiles.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#9BA5A8]">
                      No contacts found
                    </div>
                  ) : (
                    filteredProfiles.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl border border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD] bg-[#0B0F10]/50 dark:bg-[#0B0F10]/50 light:bg-[#F7F9F5] hover:border-brand/40 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.display_name}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                              {getInitials(user.display_name || user.username)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">
                              {user.display_name || user.username}
                            </p>
                            <p className="text-[10px] text-[#9BA5A8] truncate mt-0.5">
                              @{user.username}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleStartDirectCall(user, 'audio')}
                            className="w-8 h-8 rounded-xl bg-[#252C2E] hover:bg-brand hover:text-[#0B0F10] text-brand flex items-center justify-center transition-all shadow-sm"
                            title="Voice Call"
                          >
                            <Phone size={14} />
                          </button>
                          <button
                            onClick={() => handleStartDirectCall(user, 'video')}
                            className="w-8 h-8 rounded-xl bg-brand text-[#0B0F10] hover:bg-brand/90 flex items-center justify-center transition-all shadow-sm font-bold"
                            title="Video Call"
                          >
                            <Video size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
