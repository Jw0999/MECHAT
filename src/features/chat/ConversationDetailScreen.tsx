import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, Video, Phone, Info, RotateCw } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useCallStore } from '@/stores/callStore';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { GroupDetailsModal } from '@/features/groups/GroupDetailsModal';
import { formatLastSeen } from '@/lib/utils';
import type { Message } from '@/types/database.types';

interface ConversationDetailScreenProps {
  conversationId: string;
  onBack: () => void;
}

// Stable empty references to prevent Zustand infinite selector re-renders
const EMPTY_STRINGS: string[] = [];
const EMPTY_MESSAGES: Message[] = [];

export const ConversationDetailScreen: React.FC<ConversationDetailScreenProps> = ({
  conversationId,
  onBack,
}) => {
  const conversations = useChatStore((s) => s.conversations);
  const messagesMap = useChatStore((s) => s.messages);
  const typingMap = useChatStore((s) => s.typingUsers);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const setTyping = useChatStore((s) => s.setTyping);
  const loadMessages = useChatStore((s) => s.loadMessages);

  const initiateCall = useCallStore((s) => s.initiateCall);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = messagesMap[conversationId] || EMPTY_MESSAGES;
  const typingUsers = typingMap[conversationId] || EMPTY_STRINGS;

  const isGroup = conversation?.type === 'group';
  const title = isGroup ? conversation.title : conversation?.other_user?.display_name || 'Chat';
  const avatar = isGroup
    ? conversation?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${conversation?.title || 'Group'}`
    : conversation?.other_user?.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${title}`;
  const isOnline = !isGroup && conversation?.other_user?.online_status === 'online';

  const subtitle = isGroup
    ? `${conversation?.members?.length || 2} participants`
    : isOnline
    ? 'Online'
    : formatLastSeen(conversation?.other_user?.last_seen);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = useCallback(
    (
      content: string,
      messageType: 'text' | 'image' | 'audio' | 'file' = 'text',
      metadata: any = {}
    ) => {
      sendMessage(conversationId, content, messageType, metadata, replyingTo?.id);
      setReplyingTo(null);
    },
    [conversationId, sendMessage, replyingTo]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      setTyping(conversationId, isTyping);
    },
    [conversationId, setTyping]
  );

  const handleStartCall = useCallback(
    (type: 'audio' | 'video') => {
      if (conversation?.other_user) {
        initiateCall(conversation.other_user, type);
      }
    },
    [conversation, initiateCall]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMessages(conversationId);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition-colors overflow-hidden">
      {/* Top Header Bar matching Screen 3 */}
      <header className="px-3 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 flex items-center justify-between border-b border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]/80 glass-header shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          {/* Back button */}
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] hover:text-brand transition rounded-full shrink-0"
            title="Back to conversations"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Contact Avatar + online dot & Name (clickable for group info) */}
          <div
            onClick={() => isGroup && setIsGroupDetailsOpen(true)}
            className={`flex items-center gap-2.5 min-w-0 flex-1 ${
              isGroup ? 'cursor-pointer hover:opacity-85 transition' : ''
            }`}
            title={isGroup ? 'View group info & description' : undefined}
          >
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt={title || ''}
                className="w-10 h-10 rounded-full object-cover border border-[#252C2E]"
              />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-brand rounded-full ring-2 ring-[#0B0F10]" />
              )}
            </div>

            {/* Name & Subtitle / Last seen */}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] truncate leading-tight">
                {title}
              </h2>
              <p className="text-[11px] text-[#9BA5A8] truncate mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Refresh, Video, Phone & Group Info */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleRefresh}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#9BA5A8] hover:text-brand hover:bg-[#151A1C] dark:hover:bg-[#151A1C] light:hover:bg-[#E9EDE8] transition"
            title="Refresh messages"
          >
            <RotateCw size={17} className={isRefreshing ? 'animate-spin text-brand' : ''} />
          </button>
          <button
            onClick={() => handleStartCall('video')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] hover:bg-[#151A1C] dark:hover:bg-[#151A1C] light:hover:bg-[#E9EDE8] hover:text-brand transition"
            title="Video call"
          >
            <Video size={19} />
          </button>
          <button
            onClick={() => handleStartCall('audio')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] hover:bg-[#151A1C] dark:hover:bg-[#151A1C] light:hover:bg-[#E9EDE8] hover:text-brand transition"
            title="Audio call"
          >
            <Phone size={18} />
          </button>
          {isGroup && (
            <button
              onClick={() => setIsGroupDetailsOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] hover:bg-[#151A1C] dark:hover:bg-[#151A1C] light:hover:bg-[#E9EDE8] hover:text-brand transition"
              title="Group info & description"
            >
              <Info size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Message History Stream */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1.5 overscroll-contain">
        {/* Date Divider: "Today" */}
        <div className="flex items-center justify-center my-3 select-none">
          <span className="text-[11px] font-semibold text-[#9BA5A8] bg-[#151A1C]/80 dark:bg-[#151A1C]/80 light:bg-[#E9EDE8] px-3 py-1 rounded-full border border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]">
            Today
          </span>
        </div>

        {/* Messages */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isGroup={isGroup}
            onReply={(m) => setReplyingTo(m)}
            onDelete={(id) => deleteMessage(id, conversationId)}
          />
        ))}

        {/* Live typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-brand font-medium italic py-1 px-2 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
            <span>{typingUsers.join(', ')} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Composer */}
      <MessageComposer
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onTyping={handleTyping}
      />

      {/* WhatsApp-style Group Details Modal */}
      {isGroup && (
        <GroupDetailsModal
          isOpen={isGroupDetailsOpen}
          onClose={() => setIsGroupDetailsOpen(false)}
          conversationId={conversationId}
        />
      )}
    </div>
  );
};
