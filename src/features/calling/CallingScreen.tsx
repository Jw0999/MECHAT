import React, { useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
import { formatDuration, formatChatTimestamp, cn } from '@/lib/utils';
import { NewChatModal } from '@/features/chat/NewChatModal';

export const CallingScreen: React.FC = () => {
  const callHistory = useCallStore((s) => s.callHistory);
  const initiateCall = useCallStore((s) => s.initiateCall);
  const simulateIncomingCall = useCallStore((s) => s.simulateIncomingCall);

  const [filter, setFilter] = useState<'all' | 'missed'>('all');
  const [isNewCallOpen, setIsNewCallOpen] = useState(false);

  const filteredCalls = callHistory.filter((c) => {
    if (filter === 'missed') return c.status === 'missed' || c.status === 'declined';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Calls</h1>
          <p className="text-xs text-[#9BA5A8]">Recent audio & video calls</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick simulation helper for testing calling screen */}
          <button
            onClick={() => {
              if (callHistory[0]?.caller) {
                simulateIncomingCall(callHistory[0].caller, 'audio');
              }
            }}
            className="text-[11px] font-semibold bg-brand/15 text-brand px-2.5 py-1 rounded-full hover:bg-brand/25 transition hidden sm:inline-block"
            title="Simulate incoming call to test UI"
          >
            Simulate Call
          </button>

          <button
            onClick={() => setIsNewCallOpen(true)}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] flex items-center justify-center font-bold shadow-lg shadow-brand/20 active:scale-95 transition"
            title="New Call"
          >
            <Plus size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 flex items-center gap-2 shrink-0">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
            filter === 'all'
              ? 'bg-brand text-[#0B0F10]'
              : 'bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] text-[#9BA5A8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('missed')}
          className={cn(
            'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
            filter === 'missed'
              ? 'bg-brand text-[#0B0F10]'
              : 'bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] text-[#9BA5A8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD]'
          )}
        >
          Missed
        </button>
      </div>

      {/* Call History List */}
      <div className="flex-1 overflow-y-auto px-2 divide-y divide-[#252C2E]/40 dark:divide-[#252C2E]/40 light:divide-[#E0E6DD]/60">
        {filteredCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center px-4">
            <p className="text-sm font-semibold text-[#9BA5A8] mb-2">No recent calls</p>
            <button
              onClick={() => setIsNewCallOpen(true)}
              className="text-xs text-brand font-bold hover:underline"
            >
              Start a call
            </button>
          </div>
        ) : (
          filteredCalls.map((log) => {
            const contact = log.caller || log.receiver;
            if (!contact) return null;

            const isMissed = log.status === 'missed' || log.status === 'declined';
            const isOutgoing = log.receiver_id === contact.id;

            return (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#151A1C]/80 dark:hover:bg-[#151A1C]/80 light:hover:bg-[#FFFFFF] transition select-none group"
              >
                {/* Contact Avatar & Call Details */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={
                      contact.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.display_name}`
                    }
                    alt={contact.display_name}
                    className="w-12 h-12 rounded-full object-cover border border-[#252C2E]"
                  />

                  <div className="min-w-0">
                    <h3
                      className={cn(
                        'text-[15px] font-bold truncate leading-tight',
                        isMissed
                          ? 'text-red-400'
                          : 'text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]'
                      )}
                    >
                      {contact.display_name}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-[#9BA5A8] mt-1">
                      {isMissed ? (
                        <PhoneMissed size={14} className="text-red-400 shrink-0" />
                      ) : isOutgoing ? (
                        <PhoneOutgoing size={14} className="text-brand shrink-0" />
                      ) : (
                        <PhoneIncoming size={14} className="text-blue-400 shrink-0" />
                      )}
                      <span>{formatChatTimestamp(log.started_at)}</span>
                      {log.duration_seconds > 0 && (
                        <span>• {formatDuration(log.duration_seconds)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Call Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => initiateCall(contact, 'audio')}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-brand hover:bg-brand/15 transition"
                    title="Audio call"
                  >
                    <Phone size={18} />
                  </button>
                  <button
                    onClick={() => initiateCall(contact, 'video')}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-brand hover:bg-brand/15 transition"
                    title="Video call"
                  >
                    <Video size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <NewChatModal isOpen={isNewCallOpen} onClose={() => setIsNewCallOpen(false)} />
    </div>
  );
};
