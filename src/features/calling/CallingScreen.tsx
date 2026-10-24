import React, { useState, useEffect } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Plus,
  Users,
  VideoOff,
  Trash2,
} from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDuration, formatChatTimestamp, cn, getInitials } from '@/lib/utils';
import { StartCallModal } from './StartCallModal';
import { toast } from 'sonner';

export const CallingScreen: React.FC = () => {
  const callHistory = useCallStore((s) => s.callHistory);
  const initiateCall = useCallStore((s) => s.initiateCall);
  const initiateGroupCall = useCallStore((s) => s.initiateGroupCall);
  const simulateIncomingCall = useCallStore((s) => s.simulateIncomingCall);
  const loadCallHistory = useCallStore((s) => s.loadCallHistory);
  const deleteCallLog = useCallStore((s) => s.deleteCallLog);
  const currentUserId = useAuthStore((s) => s.user?.id) || 'demo-user-1';

  const [filter, setFilter] = useState<'all' | 'missed' | 'groups'>('all');
  const [isNewCallOpen, setIsNewCallOpen] = useState(false);

  useEffect(() => {
    loadCallHistory();
  }, [loadCallHistory]);

  const filteredCalls = callHistory.filter((c) => {
    const isGroup = Boolean(c.is_group || c.group_title || (!c.receiver_id && c.conversation_id));
    if (filter === 'missed') return c.status === 'missed' || c.status === 'declined';
    if (filter === 'groups') return isGroup;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors overflow-hidden select-none">
      {/* Header */}
      <div className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Calls</h1>
          <p className="text-xs text-[#9BA5A8]">Recent audio & video calls</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick call test helpers */}
          <button
            onClick={() => {
              const contact = callHistory[0]?.caller || {
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
              };
              simulateIncomingCall(contact, 'audio');
            }}
            className="text-[11px] font-semibold bg-brand/15 text-brand px-2.5 py-1 rounded-full hover:bg-brand/25 transition hidden sm:inline-flex items-center gap-1"
            title="Test zero-delay voice call"
          >
            <Phone size={13} />
            <span>Test Voice</span>
          </button>
          <button
            onClick={() => {
              const contact = callHistory[0]?.caller || {
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
              };
              simulateIncomingCall(contact, 'video');
            }}
            className="text-[11px] font-semibold bg-brand/15 text-brand px-2.5 py-1 rounded-full hover:bg-brand/25 transition hidden sm:inline-flex items-center gap-1"
            title="Test zero-delay video call"
          >
            <Video size={13} />
            <span>Test Video</span>
          </button>
          <button
            onClick={() => {
              initiateGroupCall('group-1', 'Product Design Team', 'video');
            }}
            className="text-[11px] font-semibold bg-[#252C2E] text-brand px-2.5 py-1 rounded-full hover:bg-[#323B3E] transition hidden sm:inline-flex items-center gap-1 border border-brand/20"
            title="Test zero-delay group video call"
          >
            <Users size={13} />
            <span>Test Group</span>
          </button>

          <button
            onClick={() => setIsNewCallOpen(true)}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] flex items-center justify-center font-bold shadow-lg shadow-brand/20 active:scale-95 transition ml-1"
            title="New Call"
          >
            <Plus size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 flex items-center gap-2 shrink-0">
        {(['all', 'missed', 'groups'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all',
              filter === tab
                ? 'bg-brand text-[#0B0F10]'
                : 'bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] text-[#9BA5A8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Call History List */}
      <div className="flex-1 overflow-y-auto px-2 divide-y divide-[#252C2E]/40 dark:divide-[#252C2E]/40 light:divide-[#E0E6DD]/60">
        {filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center px-4">
            <p className="text-sm font-semibold text-[#9BA5A8] mb-2">No calls in this tab</p>
            <button
              onClick={() => setIsNewCallOpen(true)}
              className="text-xs text-brand font-bold hover:underline"
            >
              Start a call
            </button>
          </div>
        ) : (
          filteredCalls.map((log) => {
            const isGroup = Boolean(
              log.is_group || log.group_title || (!log.receiver_id && log.conversation_id)
            );
            const isMissed = log.status === 'missed' || log.status === 'declined';
            const isCancelled = log.status === 'cancelled';
            const isOutgoing = log.caller_id === currentUserId;
            const isVideo = log.call_type === 'video';

            // Resolve contact and title
            const groupTitle = log.group_title || 'Group Call';
            const directContact = isOutgoing ? (log.receiver || log.caller) : (log.caller || log.receiver);
            const title = isGroup ? groupTitle : directContact?.display_name || 'Contact';

            return (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#151A1C]/80 dark:hover:bg-[#151A1C]/80 light:hover:bg-[#FFFFFF] transition group"
              >
                {/* Avatar & Call Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                  <div className="relative shrink-0">
                    {isGroup ? (
                      <div className="w-12 h-12 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-base border border-brand/30">
                        <Users size={22} />
                      </div>
                    ) : directContact?.avatar_url ? (
                      <img
                        src={directContact.avatar_url}
                        alt={title}
                        className="w-12 h-12 rounded-full object-cover border border-[#252C2E]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm border border-[#252C2E]">
                        {getInitials(title)}
                      </div>
                    )}

                    {/* Badge Icon (Video or Group) */}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#151A1C] border border-[#252C2E] flex items-center justify-center text-[10px]">
                      {isVideo ? (
                        <Video size={11} className={isMissed ? 'text-rose-400' : 'text-brand'} />
                      ) : (
                        <Phone size={10} className={isMissed ? 'text-rose-400' : 'text-brand'} />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3
                        className={cn(
                          'text-[15px] font-bold truncate leading-tight',
                          isMissed
                            ? 'text-rose-400'
                            : 'text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]'
                        )}
                      >
                        {title}
                      </h3>
                      {isGroup && (
                        <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.2 rounded-md shrink-0">
                          Group
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#9BA5A8] mt-1 truncate">
                      {/* Direction Icon */}
                      {isMissed ? (
                        <PhoneMissed size={14} className="text-rose-400 shrink-0" />
                      ) : isCancelled ? (
                        <PhoneOutgoing size={14} className="text-amber-400 shrink-0" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <PhoneIncoming size={14} className="text-blue-400 shrink-0" />
                      )}

                      <span className="truncate">
                        {isMissed
                          ? `Missed ${isVideo ? 'Video' : 'Voice'}`
                          : isCancelled
                          ? `Cancelled ${isVideo ? 'Video' : 'Voice'}`
                          : isOutgoing
                          ? `Outgoing ${isVideo ? 'Video' : 'Voice'}`
                          : `Incoming ${isVideo ? 'Video' : 'Voice'}`}
                      </span>

                      <span>• {formatChatTimestamp(log.started_at)}</span>

                      {log.duration_seconds > 0 && (
                        <span>• {formatDuration(log.duration_seconds)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Call Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      if (isGroup) {
                        initiateGroupCall(log.conversation_id || 'group-1', groupTitle, 'audio');
                      } else if (directContact) {
                        initiateCall(directContact, 'audio', log.conversation_id || undefined);
                      }
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-brand hover:bg-brand/15 active:scale-95 transition"
                    title={isGroup ? 'Group Voice Call' : 'Voice Call'}
                  >
                    <Phone size={17} />
                  </button>

                  <button
                    onClick={() => {
                      if (isGroup) {
                        initiateGroupCall(log.conversation_id || 'group-1', groupTitle, 'video');
                      } else if (directContact) {
                        initiateCall(directContact, 'video', log.conversation_id || undefined);
                      }
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-brand hover:bg-brand/15 active:scale-95 transition"
                    title={isGroup ? 'Group Video Call' : 'Video Call'}
                  >
                    <Video size={17} />
                  </button>

                  <button
                    onClick={() => {
                      deleteCallLog(log.id);
                      toast.success('Call log deleted');
                    }}
                    className="w-8 h-8 rounded-full text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100 flex items-center justify-center ml-0.5"
                    title="Delete log"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Start Call Modal */}
      <StartCallModal isOpen={isNewCallOpen} onClose={() => setIsNewCallOpen(false)} />
    </div>
  );
};
