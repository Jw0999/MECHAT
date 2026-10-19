import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Users,
  Phone,
  Video,
  Bell,
  BellOff,
  UserPlus,
  ShieldCheck,
  Calendar,
  LogOut,
  Edit3,
  Check,
  Search,
  MoreVertical,
  UserMinus,
  Crown,
  FileText,
  Image as ImageIcon,
  Camera,
  Loader2,
  Link2,
  ExternalLink,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { DEMO_PROFILES } from '@/lib/constants/demoProfiles';
import type { Profile, Message } from '@/types/database.types';
import { formatDate, formatFileSize } from '@/lib/utils';
import { toast } from 'sonner';

// Stable empty fallback to prevent Zustand infinite loop re-renders
const EMPTY_MESSAGES: Message[] = [];

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

export const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const conversations = useChatStore((s) => s.conversations);
  const messagesMap = useChatStore((s) => s.messages);
  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = messagesMap[conversationId] || EMPTY_MESSAGES;

  const updateGroupDetails = useChatStore((s) => s.updateGroupDetails);
  const addGroupMembers = useChatStore((s) => s.addGroupMembers);
  const removeGroupMember = useChatStore((s) => s.removeGroupMember);
  const toggleGroupAdmin = useChatStore((s) => s.toggleGroupAdmin);
  const leaveGroup = useChatStore((s) => s.leaveGroup);
  const toggleMuteGroup = useChatStore((s) => s.toggleMuteGroup);
  const initiateGroupCall = useCallStore((s) => s.initiateGroupCall);

  // Local state for editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  // Group picture upload state
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Participant search and management
  const [participantSearch, setParticipantSearch] = useState('');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState<string[]>([]);
  const [activeMemberActionId, setActiveMemberActionId] = useState<string | null>(null);

  // Live registered profiles fetched from Supabase
  const [liveProfiles, setLiveProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Media, Links & Docs Viewer State
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'docs' | 'links'>('media');
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // Fetch live registered profiles from database
  useEffect(() => {
    if (!isOpen) return;

    const fetchRegisteredUsers = async () => {
      const isDemo = useAuthStore.getState().isDemoMode || !isSupabaseConfigured();
      if (isDemo) {
        setLiveProfiles(DEMO_PROFILES);
        return;
      }

      setIsLoadingProfiles(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('display_name', { ascending: true })
          .limit(100);

        if (!error && data) {
          setLiveProfiles(data as Profile[]);
        } else {
          setLiveProfiles(DEMO_PROFILES);
        }
      } catch (e) {
        console.warn('Error fetching live members:', e);
        setLiveProfiles(DEMO_PROFILES);
      } finally {
        setIsLoadingProfiles(false);
      }
    };

    fetchRegisteredUsers();
  }, [isOpen, conversationId]);

  // Helper extractors for media and documents
  const getMediaUrl = (m: Message): string => {
    if (m.metadata?.file_url) return m.metadata.file_url;
    if (m.message_type === 'image' && m.content) return m.content;
    const trimmed = m.content?.trim();
    if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://')) && /\.(jpeg|jpg|gif|png|webp|svg|mp4|webm|mov)(\?.*)?$/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  };

  const getDocUrl = (m: Message): string => {
    return m.metadata?.file_url || (m.message_type === 'file' ? m.content : '');
  };

  // Extract live media, docs, and links from real messages
  const mediaList = useMemo(() => {
    return messages.filter(
      (m) =>
        m.message_type === 'image' ||
        Boolean(m.metadata?.file_url && m.metadata?.mime_type?.startsWith('image/')) ||
        Boolean(getMediaUrl(m))
    );
  }, [messages]);

  const docsList = useMemo(() => {
    return messages.filter(
      (m) =>
        m.message_type === 'file' ||
        Boolean(m.metadata?.file_name) ||
        Boolean(m.metadata?.file_url && !m.metadata?.mime_type?.startsWith('image/'))
    );
  }, [messages]);

  const linksList = useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const links: { url: string; domain: string; messageId: string; date: string }[] = [];
    messages.forEach((m) => {
      const matches = m.content?.match(urlRegex);
      if (matches) {
        matches.forEach((url) => {
          const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
          try {
            const parsed = new URL(cleanUrl);
            links.push({
              url: cleanUrl,
              domain: parsed.hostname,
              messageId: m.id,
              date: m.created_at,
            });
          } catch {
            links.push({
              url: cleanUrl,
              domain: cleanUrl,
              messageId: m.id,
              date: m.created_at,
            });
          }
        });
      }
    });
    return links;
  }, [messages]);

  const totalSharedCount = mediaList.length + docsList.length + linksList.length;

  if (!isOpen || !conversation) return null;

  const members = conversation.members || [];
  const myMembership = members.find((m) => m.user_id === currentUserId);
  const isCurrentUserAdmin = myMembership?.role === 'admin' || conversation.created_by === currentUserId;
  const isMuted = myMembership?.is_muted || false;

  // Filtered participants list
  const filteredMembers = members.filter((m) => {
    const name = m.profile?.display_name || '';
    const username = m.profile?.username || '';
    const query = participantSearch.toLowerCase();
    return name.toLowerCase().includes(query) || username.toLowerCase().includes(query);
  });

  // Candidate users to add: live registered members excluding existing members and self
  const currentMemberIds = new Set(members.map((m) => m.user_id));
  const candidateUsersToAdd = liveProfiles.filter((p) => {
    if (currentMemberIds.has(p.id) || p.id === currentUserId) return false;
    if (!addMemberSearch.trim()) return true;
    const q = addMemberSearch.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  // Handlers
  const handleSaveTitle = async () => {
    if (!editTitle.trim()) return;
    await updateGroupDetails(conversationId, { title: editTitle.trim() });
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    await updateGroupDetails(conversationId, { description: editDesc.trim() });
    setIsEditingDesc(false);
  };

  // Profile picture upload from device library (no URL)
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const isDemo = useAuthStore.getState().isDemoMode || !isSupabaseConfigured();
      let avatarUrl = '';

      if (isDemo) {
        avatarUrl = URL.createObjectURL(file);
      } else {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const filePath = `groups/${conversationId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      await updateGroupDetails(conversationId, { avatar_url: avatarUrl });
      toast.success('Group picture updated');
    } catch (err: any) {
      console.error('Group avatar upload error:', err);
      toast.error(err.message || 'Failed to update group picture');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleAddMembers = async () => {
    if (selectedNewMemberIds.length === 0) return;
    await addGroupMembers(conversationId, selectedNewMemberIds);
    setSelectedNewMemberIds([]);
    setIsAddMemberOpen(false);
    setAddMemberSearch('');
  };

  const handleStartCall = (type: 'audio' | 'video') => {
    const memberProfiles = members.map((m) => m.profile).filter(Boolean) as Profile[];
    initiateGroupCall(conversation.id, conversation.title || 'Group', type, memberProfiles);
    onClose();
  };

  const handleLeaveGroup = async () => {
    if (window.confirm('Are you sure you want to leave this group?')) {
      const ok = await leaveGroup(conversationId);
      if (ok) {
        onClose();
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
        <div className="relative w-full max-w-lg bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* Top Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD] shrink-0">
            <div className="flex items-center gap-2.5">
              {isMediaViewerOpen ? (
                <button
                  onClick={() => setIsMediaViewerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#9BA5A8] hover:text-[#F5F7F7] hover:bg-[#252C2E]/60 transition -ml-1 mr-1"
                  title="Back to Group Info"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <Users size={19} className="text-brand" />
              )}
              <h2 className="text-sm font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                {isMediaViewerOpen ? 'Media, Links and Docs' : 'Group Info'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#9BA5A8] hover:text-[#F5F7F7] hover:bg-[#252C2E]/60 transition"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Conditional Body: Media Viewer vs Normal Group Info */}
          {isMediaViewerOpen ? (
            /* Media, Links & Docs Screen */
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
              {/* Tab Selector */}
              <div className="flex items-center border-b border-[#252C2E] px-4 pt-2 shrink-0 bg-[#151A1C]">
                <button
                  onClick={() => setActiveMediaTab('media')}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                    activeMediaTab === 'media'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-[#9BA5A8] hover:text-[#F5F7F7]'
                  }`}
                >
                  Media ({mediaList.length})
                </button>
                <button
                  onClick={() => setActiveMediaTab('docs')}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                    activeMediaTab === 'docs'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-[#9BA5A8] hover:text-[#F5F7F7]'
                  }`}
                >
                  Docs ({docsList.length})
                </button>
                <button
                  onClick={() => setActiveMediaTab('links')}
                  className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition ${
                    activeMediaTab === 'links'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-[#9BA5A8] hover:text-[#F5F7F7]'
                  }`}
                >
                  Links ({linksList.length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeMediaTab === 'media' && (
                  mediaList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-[#9BA5A8]">
                      <ImageIcon size={36} className="mb-2 opacity-40 text-brand" />
                      <p className="text-xs font-semibold">No media shared in this group yet</p>
                      <p className="text-[11px] opacity-70 mt-1">Photos and videos sent here will appear automatically</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {mediaList.map((m) => {
                        const mediaUrl = getMediaUrl(m);
                        if (!mediaUrl) return null;
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedImagePreview(mediaUrl)}
                            className="relative aspect-square rounded-2xl overflow-hidden bg-[#1E2325] border border-[#252C2E] cursor-pointer hover:border-brand/50 transition group"
                          >
                            <img
                              src={mediaUrl}
                              alt="Shared media"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-end p-1.5">
                              <span className="text-[9px] text-white/90 font-mono">
                                {formatDate(m.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {activeMediaTab === 'docs' && (
                  docsList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-[#9BA5A8]">
                      <FileText size={36} className="mb-2 opacity-40 text-brand" />
                      <p className="text-xs font-semibold">No documents shared in this group yet</p>
                      <p className="text-[11px] opacity-70 mt-1">PDFs and files sent here will appear automatically</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docsList.map((doc) => {
                        const docUrl = getDocUrl(doc);
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 rounded-2xl bg-[#1C2225] border border-[#252C2E] hover:bg-[#22282B] transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#F5F7F7] truncate">
                                  {doc.metadata?.file_name || doc.content || 'Document'}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-[#9BA5A8]">
                                  <span>{formatFileSize(doc.metadata?.file_size)}</span>
                                  <span>•</span>
                                  <span>{formatDate(doc.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            {docUrl && (
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={doc.metadata?.file_name || 'document'}
                                className="p-2 text-[#9BA5A8] hover:text-brand hover:bg-[#252C2E] rounded-xl transition shrink-0"
                                title="Download document"
                              >
                                <Download size={16} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {activeMediaTab === 'links' && (
                  linksList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-[#9BA5A8]">
                      <Link2 size={36} className="mb-2 opacity-40 text-brand" />
                      <p className="text-xs font-semibold">No links shared in this group yet</p>
                      <p className="text-[11px] opacity-70 mt-1">Web links mentioned in chat will appear automatically</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linksList.map((item, idx) => (
                        <a
                          key={idx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-2xl bg-[#1C2225] border border-[#252C2E] hover:bg-[#22282B] transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#252C2E] flex items-center justify-center text-brand shrink-0">
                              <Link2 size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#F5F7F7] group-hover:text-brand transition truncate">
                                {item.domain}
                              </p>
                              <p className="text-[11px] text-[#9BA5A8] truncate max-w-xs">
                                {item.url}
                              </p>
                              <span className="text-[10px] text-[#9BA5A8]/70">
                                {formatDate(item.date)}
                              </span>
                            </div>
                          </div>
                          <ExternalLink size={15} className="text-[#9BA5A8] group-hover:text-brand transition shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            /* Normal Scrollable Content Body */
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              
              {/* Hero Profile Section */}
              <div className="flex flex-col items-center text-center pt-2 pb-1">
                <div className="relative group">
                  <img
                    src={
                      conversation.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${conversation.title}`
                    }
                    alt={conversation.title || 'Group'}
                    className="w-24 h-24 rounded-full object-cover border-2 border-brand/40 shadow-xl shadow-brand/10"
                  />
                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand text-[#0B0F10] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-75"
                      title="Choose group picture from library"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 size={15} className="animate-spin text-[#0B0F10]" />
                      ) : (
                        <Camera size={15} strokeWidth={2.4} />
                      )}
                    </button>
                  )}
                  {/* Hidden Native File Picker for Group Picture */}
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Group Title (Inline Editable for Admin) */}
                <div className="mt-3.5 flex items-center justify-center gap-2 w-full max-w-sm">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 bg-[#1E2325] text-sm font-bold text-[#F5F7F7] px-3 py-1.5 rounded-xl border border-[#252C2E] focus:outline-none focus:border-brand"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveTitle}
                        className="p-2 bg-brand text-[#0B0F10] rounded-xl hover:bg-brand-hover transition"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                      <button
                        onClick={() => setIsEditingTitle(false)}
                        className="p-2 bg-[#252C2E] text-[#9BA5A8] rounded-xl hover:text-white transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] tracking-tight">
                        {conversation.title}
                      </h3>
                      {isCurrentUserAdmin && (
                        <button
                          onClick={() => {
                            setEditTitle(conversation.title || '');
                            setIsEditingTitle(true);
                          }}
                          className="p-1 text-[#9BA5A8] hover:text-brand rounded-full transition"
                          title="Edit group name"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#9BA5A8] mt-1">
                  Group · {members.length} {members.length === 1 ? 'participant' : 'participants'}
                </p>

                {/* Quick Action Buttons Row */}
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => handleStartCall('audio')}
                    className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#1E2325] hover:bg-[#252C2E] text-[#F5F7F7] hover:text-brand transition min-w-[72px]"
                  >
                    <Phone size={17} />
                    <span className="text-[11px] font-semibold">Audio</span>
                  </button>
                  <button
                    onClick={() => handleStartCall('video')}
                    className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#1E2325] hover:bg-[#252C2E] text-[#F5F7F7] hover:text-brand transition min-w-[72px]"
                  >
                    <Video size={17} />
                    <span className="text-[11px] font-semibold">Video</span>
                  </button>
                  <button
                    onClick={() => toggleMuteGroup(conversationId)}
                    className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#1E2325] hover:bg-[#252C2E] text-[#F5F7F7] hover:text-brand transition min-w-[72px]"
                  >
                    {isMuted ? <BellOff size={17} className="text-amber-400" /> : <Bell size={17} />}
                    <span className="text-[11px] font-semibold">{isMuted ? 'Muted' : 'Mute'}</span>
                  </button>
                </div>
              </div>

              {/* Group Description Card */}
              <div className="bg-[#1C2225] dark:bg-[#1C2225] light:bg-[#F2F5F0] border border-[#252C2E]/80 dark:border-[#252C2E]/80 light:border-[#E0E6DD] rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
                    <FileText size={14} />
                    <span>Group Description</span>
                  </div>
                  {isCurrentUserAdmin && !isEditingDesc && (
                    <button
                      onClick={() => {
                        setEditDesc(conversation.description || '');
                        setIsEditingDesc(true);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#9BA5A8] hover:text-brand transition"
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                {isEditingDesc ? (
                  <div className="space-y-2 pt-1 animate-fade-in">
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="What is this group about? Add rules, goals or announcements..."
                      rows={3}
                      className="w-full bg-[#151A1C] text-xs text-[#F5F7F7] p-3 rounded-xl border border-[#252C2E] focus:outline-none focus:border-brand transition resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingDesc(false)}
                        className="px-3 py-1.5 text-xs text-[#9BA5A8] hover:text-white rounded-xl bg-[#252C2E] transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveDescription}
                        className="px-4 py-1.5 text-xs font-bold text-[#0B0F10] rounded-xl bg-brand hover:bg-brand-hover transition shadow-sm"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] leading-relaxed whitespace-pre-wrap">
                    {conversation.description ? (
                      conversation.description
                    ) : (
                      <span
                        onClick={() => {
                          if (isCurrentUserAdmin) {
                            setEditDesc('');
                            setIsEditingDesc(true);
                          }
                        }}
                        className={`italic text-[#9BA5A8] ${
                          isCurrentUserAdmin ? 'cursor-pointer hover:underline' : ''
                        }`}
                      >
                        {isCurrentUserAdmin
                          ? 'Add group description, guidelines or topic...'
                          : 'No description provided.'}
                      </span>
                    )}
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-[#9BA5A8] pt-2 border-t border-[#252C2E]/40">
                  <Calendar size={12} />
                  <span>Created {formatDate(conversation.created_at)}</span>
                </div>
              </div>

              {/* Media, Links & Docs Card - Live Clickable Viewer */}
              <div
                onClick={() => setIsMediaViewerOpen(true)}
                className="flex items-center justify-between p-3.5 bg-[#1C2225] dark:bg-[#1C2225] light:bg-[#F2F5F0] border border-[#252C2E]/80 dark:border-[#252C2E]/80 light:border-[#E0E6DD] rounded-2xl cursor-pointer hover:bg-[#22282B] transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#252C2E] flex items-center justify-center text-brand group-hover:scale-105 transition">
                    <ImageIcon size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                      Media, links, and docs
                    </p>
                    <p className="text-[10px] text-[#9BA5A8]">Photos, audio notes, shared files</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-full border border-brand/20">
                    {totalSharedCount} {totalSharedCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              {/* Security & Encryption Notice */}
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#151A1C] border border-[#252C2E]/60 text-[11px] text-[#9BA5A8]">
                <ShieldCheck size={16} className="text-brand shrink-0 mt-0.5" />
                <p className="leading-tight">
                  Messages and calls are end-to-end secured with PostgreSQL Row Level Security and Supabase Auth.
                </p>
              </div>

              {/* Participants Section */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Participants</span>
                    <span className="text-[11px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                      {members.length}
                    </span>
                  </h4>

                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => setIsAddMemberOpen((p) => !p)}
                      className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                    >
                      <UserPlus size={14} />
                      <span>Add Members</span>
                    </button>
                  )}
                </div>

                {/* Search within participants */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5A8]"
                  />
                  <input
                    type="text"
                    placeholder="Search participants..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="w-full bg-[#1C2225] text-xs text-[#F5F7F7] placeholder-[#9BA5A8] pl-9 pr-3 py-2 rounded-xl border border-[#252C2E] focus:outline-none focus:border-brand transition"
                  />
                </div>

                {/* Add Member Drawer / Selector if toggled */}
                {isAddMemberOpen && (
                  <div className="p-3 bg-[#1C2225] border border-brand/40 rounded-2xl space-y-3 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#F5F7F7]">
                        Add Live Registered Members ({selectedNewMemberIds.length})
                      </p>
                      <button
                        onClick={() => {
                          setIsAddMemberOpen(false);
                          setAddMemberSearch('');
                        }}
                        className="text-[#9BA5A8] hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Search box for live members */}
                    <div className="relative">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA5A8]"
                      />
                      <input
                        type="text"
                        placeholder="Search live members by name or username..."
                        value={addMemberSearch}
                        onChange={(e) => setAddMemberSearch(e.target.value)}
                        className="w-full bg-[#151A1C] text-xs text-[#F5F7F7] placeholder-[#9BA5A8] pl-8 pr-3 py-1.5 rounded-xl border border-[#252C2E] focus:outline-none focus:border-brand"
                      />
                    </div>

                    {isLoadingProfiles ? (
                      <div className="flex items-center justify-center py-6 text-xs text-[#9BA5A8] gap-2">
                        <Loader2 size={16} className="animate-spin text-brand" />
                        <span>Loading live registered members...</span>
                      </div>
                    ) : candidateUsersToAdd.length === 0 ? (
                      <p className="text-xs text-[#9BA5A8] py-3 text-center">
                        {addMemberSearch.trim()
                          ? 'No matching members found.'
                          : 'All registered members are already in this group!'}
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {candidateUsersToAdd.map((u) => {
                          const isSel = selectedNewMemberIds.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => {
                                setSelectedNewMemberIds((prev) =>
                                  prev.includes(u.id)
                                    ? prev.filter((id) => id !== u.id)
                                    : [...prev, u.id]
                                );
                              }}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-[#252C2E] cursor-pointer transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={
                                    u.avatar_url ||
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`
                                  }
                                  alt={u.display_name}
                                  className="w-8 h-8 rounded-full object-cover border border-[#252C2E] shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#F5F7F7] truncate">{u.display_name}</p>
                                  <p className="text-[10px] text-[#9BA5A8] truncate">@{u.username}</p>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition shrink-0 ${
                                  isSel ? 'bg-brand border-brand text-[#0B0F10]' : 'border-[#9BA5A8]/50'
                                }`}
                              >
                                {isSel && <Check size={10} strokeWidth={3} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {candidateUsersToAdd.length > 0 && (
                      <button
                        onClick={handleAddMembers}
                        disabled={selectedNewMemberIds.length === 0}
                        className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-[#0B0F10] font-bold text-xs py-2 rounded-xl transition shadow"
                      >
                        Add {selectedNewMemberIds.length > 0 ? `${selectedNewMemberIds.length} ` : ''}Selected Member{selectedNewMemberIds.length === 1 ? '' : 's'}
                      </button>
                    )}
                  </div>
                )}

                {/* Member List */}
                <div className="space-y-1">
                  {filteredMembers.map((member) => {
                    const isMe = member.user_id === currentUserId;
                    const isAdmin = member.role === 'admin';
                    const profile = member.profile;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#1C2225] transition relative"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              profile?.avatar_url ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_id}`
                            }
                            alt={profile?.display_name || 'Member'}
                            className="w-10 h-10 rounded-full object-cover border border-[#252C2E]"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] truncate">
                                {isMe ? 'You' : profile?.display_name || 'Group Member'}
                              </p>
                              {isAdmin && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-brand bg-brand/20 border border-brand/40 px-2 py-0.5 rounded-full shrink-0">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#9BA5A8] truncate">
                              {profile?.bio || `@${profile?.username || 'user'}`}
                            </p>
                          </div>
                        </div>

                        {/* Member Options Menu (for admins modifying other members) */}
                        {isCurrentUserAdmin && !isMe && (
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveMemberActionId((prev) =>
                                  prev === member.id ? null : member.id
                                )
                              }
                              className="p-1.5 text-[#9BA5A8] hover:text-[#F5F7F7] hover:bg-[#252C2E] rounded-full transition"
                              title="Member options"
                            >
                              <MoreVertical size={15} />
                            </button>

                            {activeMemberActionId === member.id && (
                              <div className="absolute right-0 top-8 z-30 bg-[#151A1C] border border-[#252C2E] rounded-2xl p-1.5 shadow-2xl min-w-[170px] animate-slide-up">
                                <button
                                  onClick={() => {
                                    toggleGroupAdmin(conversationId, member.user_id, !isAdmin);
                                    setActiveMemberActionId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#F5F7F7] hover:bg-[#252C2E] transition"
                                >
                                  <Crown size={14} className="text-amber-400" />
                                  <span>{isAdmin ? 'Dismiss as Admin' : 'Make Group Admin'}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    removeGroupMember(conversationId, member.user_id);
                                    setActiveMemberActionId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                                >
                                  <UserMinus size={14} />
                                  <span>Remove from Group</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exit Group Button */}
              <div className="pt-3 pb-2">
                <button
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs transition"
                >
                  <LogOut size={16} />
                  <span>Exit Group</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Full-screen Image Lightbox Preview */}
      {selectedImagePreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedImagePreview(null)}
        >
          <button
            onClick={() => setSelectedImagePreview(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-[#151A1C] text-white flex items-center justify-center hover:bg-[#252C2E] transition"
            title="Close preview"
          >
            <X size={20} />
          </button>
          <img
            src={selectedImagePreview}
            alt="Shared Media Preview"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
