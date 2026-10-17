import React, { useState } from 'react';
import { MoreHorizontal, Search, Plus, Check, CheckCheck } from 'lucide-react';
import { useChatStore, type FilterTab } from '@/stores/chatStore';
import { formatChatTimestamp, cn } from '@/lib/utils';
import { NewChatModal } from './NewChatModal';

interface ChatListScreenProps {
  onSelectConversation: (conversationId: string) => void;
  onOpenNewGroup?: () => void;
}

export const ChatListScreen: React.FC<ChatListScreenProps> = ({
  onSelectConversation,
  onOpenNewGroup,
}) => {
  const conversations = useChatStore((s) => s.conversations);
  const filterTab = useChatStore((s) => s.filterTab);
  const setFilterTab = useChatStore((s) => s.setFilterTab);
  const searchQuery = useChatStore((s) => s.searchQuery);
  const setSearchQuery = useChatStore((s) => s.setSearchQuery);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const filterTabs: FilterTab[] = ['All', 'Chats', 'Groups', 'Favorite'];

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // 1. Tab filter
    if (filterTab === 'Chats' && c.type !== 'direct') return false;
    if (filterTab === 'Groups' && c.type !== 'group') return false;
    if (filterTab === 'Favorite') {
      const isFav = c.unread_count && c.unread_count > 0;
      if (!isFav) return false;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (c.type === 'direct' ? c.other_user?.display_name : c.title) || '';
      const lastMsg = c.last_message?.content || '';
      return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
        {/* Menu 3-dots Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="w-10 h-10 rounded-full bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] flex items-center justify-center text-[#9BA5A8] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18] transition"
            title="Options"
          >
            <MoreHorizontal size={20} />
          </button>

          {showMenu && (
            <div className="absolute top-12 left-0 z-40 bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-2xl py-1.5 shadow-2xl min-w-[170px] animate-slide-up">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsNewChatOpen(true);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#252C2E]/60 text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]"
              >
                New Direct Chat
              </button>
              {onOpenNewGroup && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenNewGroup();
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-[#252C2E]/60 text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]"
                >
                  Create Group
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Action Icons: Search & + Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className={cn(
              'w-10 h-10 rounded-full bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] flex items-center justify-center transition',
              isSearchOpen
                ? 'text-brand border-brand/50'
                : 'text-[#9BA5A8] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18]'
            )}
            title="Search"
          >
            <Search size={19} />
          </button>

          {/* Lime Green New Chat Button (+) */}
          <button
            onClick={() => setIsNewChatOpen(true)}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-hover text-[#0B0F10] flex items-center justify-center font-bold shadow-lg shadow-brand/20 active:scale-95 transition"
            title="Start conversation"
          >
            <Plus size={22} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Expandable Search Input */}
      {isSearchOpen && (
        <div className="px-4 py-1.5 animate-slide-up shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9BA5A8]"
            />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] text-xs text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] placeholder-[#9BA5A8] rounded-full pl-9 pr-4 py-2 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus:outline-none focus:border-brand"
            />
          </div>
        </div>
      )}

      {/* Filter Pills Bar ("All", "Chats", "Grups", "Favorite") */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
        {filterTabs.map((tab) => {
          const isActive = filterTab === tab;
          const displayLabel = tab === 'Groups' ? 'Grups' : tab; // Matches visual reference spelling

          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0',
                isActive
                  ? 'bg-brand text-[#0B0F10] shadow-sm'
                  : 'bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] text-[#9BA5A8] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] hover:text-[#F5F7F7] dark:hover:text-[#F5F7F7] light:hover:text-[#171B18]'
              )}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 divide-y divide-[#252C2E]/40 dark:divide-[#252C2E]/40 light:divide-[#E0E6DD]/60">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-center px-4">
            <p className="text-sm font-semibold text-[#9BA5A8] mb-2">No conversations found</p>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="text-xs text-brand font-bold hover:underline"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isGroup = conv.type === 'group';
            const name = isGroup ? conv.title : conv.other_user?.display_name || 'User';
            const avatar = isGroup
              ? conv.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv.title}`
              : conv.other_user?.avatar_url ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
            const isOnline = isGroup ? false : conv.other_user?.online_status === 'online';
            const lastMsg = conv.last_message;
            const hasUnread = (conv.unread_count || 0) > 0;
            const isTyping = lastMsg?.content === 'Typing...';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className="flex items-center justify-between p-3 rounded-2xl hover:bg-[#151A1C]/80 dark:hover:bg-[#151A1C]/80 light:hover:bg-[#FFFFFF] cursor-pointer transition select-none group"
              >
                {/* Avatar with Online Indicator */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={avatar}
                      alt={name || ''}
                      className="w-13 h-13 w-[52px] h-[52px] rounded-full object-cover border border-[#252C2E]/80"
                    />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-brand rounded-full ring-2 ring-[#0B0F10] dark:ring-[#0B0F10] light:ring-[#F7F9F5]" />
                    )}
                  </div>

                  {/* Name & Subtitle Preview */}
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] truncate leading-tight">
                      {name}
                    </h3>
                    <p
                      className={cn(
                        'text-xs truncate mt-1',
                        isTyping
                          ? 'text-brand font-semibold italic'
                          : 'text-[#9BA5A8]'
                      )}
                    >
                      {lastMsg ? lastMsg.content : 'No messages yet'}
                    </p>
                  </div>
                </div>

                {/* Timestamp & Status / Unread Badge */}
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                  <span className="text-[11px] text-[#9BA5A8] font-medium">
                    {formatChatTimestamp(conv.last_message_at || conv.created_at)}
                  </span>

                  {hasUnread ? (
                    // Bright Lime Green Badge with Dark Text (as in screenshot e.g. 3, 2)
                    <span className="w-5 h-5 rounded-full bg-brand text-[#0B0F10] text-[11px] font-black flex items-center justify-center shadow-sm">
                      {conv.unread_count}
                    </span>
                  ) : (
                    // Checkmark indicator for read/delivered
                    <span className="text-[#9BA5A8]">
                      {lastMsg?.is_read ? (
                        <CheckCheck size={14} className="stroke-[2.2]" />
                      ) : (
                        <Check size={14} className="stroke-[2]" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Direct Chat Modal */}
      <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />
    </div>
  );
};
