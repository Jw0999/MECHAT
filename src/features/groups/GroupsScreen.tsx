import React, { useState } from 'react';
import { Users, Plus, MessageCircle } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { formatChatTimestamp } from '@/lib/utils';
import { CreateGroupModal } from './CreateGroupModal';

interface GroupsScreenProps {
  onSelectConversation: (conversationId: string) => void;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ onSelectConversation }) => {
  const conversations = useChatStore((s) => s.conversations);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const groupConversations = conversations.filter((c) => c.type === 'group');

  return (
    <div className="flex flex-col h-full bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-2 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Groups</h1>
          <p className="text-xs text-[#9BA5A8]">Collaborative team & friend spaces</p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] flex items-center justify-center font-bold shadow-lg shadow-brand/20 active:scale-95 transition"
          title="Create Group"
        >
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto px-2 mt-2 divide-y divide-[#252C2E]/40 dark:divide-[#252C2E]/40 light:divide-[#E0E6DD]/60">
        {groupConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center px-4">
            <Users size={36} className="text-[#9BA5A8] mb-3 stroke-[1.5]" />
            <p className="text-sm font-semibold text-[#9BA5A8] mb-2">No groups yet</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="text-xs text-brand font-bold hover:underline"
            >
              Create your first group
            </button>
          </div>
        ) : (
          groupConversations.map((group) => {
            const lastMsg = group.last_message;
            const hasUnread = (group.unread_count || 0) > 0;

            return (
              <div
                key={group.id}
                onClick={() => onSelectConversation(group.id)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#151A1C]/80 dark:hover:bg-[#151A1C]/80 light:hover:bg-[#FFFFFF] cursor-pointer transition select-none group"
              >
                {/* Group Avatar & Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={
                      group.avatar_url ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${group.title}`
                    }
                    alt={group.title || ''}
                    className="w-12 h-12 rounded-full object-cover border border-[#252C2E]"
                  />

                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] truncate leading-tight">
                      {group.title}
                    </h3>

                    <p className="text-xs text-[#9BA5A8] truncate mt-1">
                      {lastMsg ? (
                        <>
                          <span className="text-brand font-medium">
                            {lastMsg.sender?.display_name || 'Member'}:{' '}
                          </span>
                          {lastMsg.content}
                        </>
                      ) : (
                        'No messages yet'
                      )}
                    </p>
                  </div>
                </div>

                {/* Timestamp & Unread */}
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                  <span className="text-[11px] text-[#9BA5A8] font-medium">
                    {formatChatTimestamp(group.last_message_at || group.created_at)}
                  </span>

                  {hasUnread && (
                    <span className="w-5 h-5 rounded-full bg-brand text-[#0B0F10] text-[11px] font-black flex items-center justify-center shadow-sm">
                      {group.unread_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <CreateGroupModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};
