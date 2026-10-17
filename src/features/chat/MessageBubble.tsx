import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';
import { formatMessageTime, cn } from '@/lib/utils';
import {
  Check,
  CheckCheck,
  Play,
  Pause,
  Trash2,
  Reply,
  Copy,
  Clock,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';

interface MessageBubbleProps {
  message: Message;
  isGroup?: boolean;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isGroup = false,
  onReply,
  onDelete,
}) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOutgoing = message.sender_id === currentUserId;

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast.success('Message copied');
    }
    setShowMenu(false);
  };

  const handleReply = () => {
    if (onReply) onReply(message);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (onDelete) onDelete(message.id);
    setShowMenu(false);
  };

  if (message.deleted_at) {
    return (
      <div
        className={cn(
          'flex my-1 text-xs italic text-[#9BA5A8] px-3 py-1.5 rounded-xl border border-dashed border-[#252C2E]/60 max-w-xs select-none',
          isOutgoing ? 'ml-auto' : 'mr-auto'
        )}
      >
        This message was deleted
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col mb-2 max-w-[85%] sm:max-w-[70%]',
        isOutgoing ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {/* Sender name for group chats */}
      {isGroup && !isOutgoing && message.sender && (
        <span className="text-[11px] font-semibold text-brand mb-1 px-1">
          {message.sender.display_name}
        </span>
      )}

      {/* Reply Reference Preview */}
      {message.reply_to_message && (
        <div
          className={cn(
            'text-xs mb-1 px-3 py-1.5 rounded-t-xl rounded-b border-l-2 max-w-full truncate',
            isOutgoing
              ? 'bg-[#8BCF32]/20 border-brand text-[#F5F7F7]'
              : 'bg-[#1D2326] border-[#9BA5A8] text-[#9BA5A8]'
          )}
        >
          <span className="font-bold block text-[10px] text-brand">Reply</span>
          <span className="truncate">{message.reply_to_message.content}</span>
        </div>
      )}

      {/* Bubble Container */}
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu((prev) => !prev);
        }}
        className={cn(
          'relative px-4 py-2.5 shadow-sm text-sm transition-all select-text',
          isOutgoing
            ? 'bg-brand text-[#0B0F10] font-medium rounded-2xl rounded-tr-sm'
            : 'bg-[#292F32] dark:bg-[#292F32] light:bg-[#E9EDE8] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] rounded-2xl rounded-tl-sm'
        )}
      >
        {/* Subtle 3-Dots Hover Menu Trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((prev) => !prev);
          }}
          className={cn(
            'absolute top-1.5 right-1.5 opacity-40 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-0.5 rounded-full z-10',
            isOutgoing
              ? 'hover:bg-[#0B0F10]/15 text-[#0B0F10]'
              : 'hover:bg-white/10 text-[#9BA5A8] hover:text-[#F5F7F7]'
          )}
          title="Message options"
        >
          <MoreVertical size={14} />
        </button>

        {/* Text Message */}
        {message.message_type === 'text' && (
          <p className="whitespace-pre-wrap break-words leading-relaxed select-text pr-3">
            {message.content}
          </p>
        )}

        {/* Image Attachment */}
        {message.message_type === 'image' && (
          <div className="space-y-1">
            <img
              src={message.metadata?.file_url || message.content}
              alt="Attachment"
              className="rounded-xl max-h-72 w-auto object-cover cursor-pointer hover:opacity-95 transition"
              onClick={() => window.open(message.metadata?.file_url || message.content, '_blank')}
            />
            {message.content && message.content !== message.metadata?.file_url && (
              <p className="whitespace-pre-wrap break-words text-xs pt-1">{message.content}</p>
            )}
          </div>
        )}

        {/* Audio / Voice Note Message */}
        {message.message_type === 'audio' && (
          <div className="flex items-center gap-3 py-1 min-w-[210px]">
            <button
              onClick={toggleAudio}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95',
                isOutgoing ? 'bg-[#0B0F10] text-brand' : 'bg-brand text-[#0B0F10]'
              )}
            >
              {isPlayingAudio ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            {/* Audio waveform illustration */}
            <div className="flex items-center gap-0.5 flex-1 h-6">
              {[40, 70, 30, 90, 60, 100, 45, 80, 55, 30, 85, 45, 60, 90, 40].map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-1 rounded-full transition-all duration-200',
                    isPlayingAudio ? 'bg-current opacity-90 animate-pulse' : 'bg-current opacity-40'
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            <span className="text-[11px] font-mono shrink-0">
              {message.metadata?.audio_duration ? `${message.metadata.audio_duration}s` : '0:04'}
            </span>

            {message.metadata?.file_url && (
              <audio
                ref={audioRef}
                src={message.metadata.file_url}
                onEnded={() => setIsPlayingAudio(false)}
                className="hidden"
              />
            )}
          </div>
        )}

        {/* Timestamp & Status Indicator */}
        <div
          className={cn(
            'flex items-center justify-end gap-1 mt-1 text-[10px] select-none',
            isOutgoing ? 'text-[#0B0F10]/70' : 'text-[#9BA5A8]'
          )}
        >
          <span>{formatMessageTime(message.created_at)}</span>

          {isOutgoing && (
            <>
              {message.isSending ? (
                <Clock size={11} className="animate-spin text-[#0B0F10]/60" />
              ) : message.hasFailed ? (
                <AlertCircle size={12} className="text-red-700" />
              ) : message.is_read ? (
                <CheckCheck size={13} className="stroke-[2.5]" />
              ) : (
                <Check size={13} className="stroke-[2]" />
              )}
            </>
          )}
        </div>

        {/* Floating Context Dropdown Menu (Anchored to top of bubble, NEVER pushes content) */}
        {showMenu && (
          <div
            ref={menuRef}
            className={cn(
              'absolute top-8 z-30 bg-[#151A1C] border border-[#252C2E] rounded-2xl p-1.5 shadow-2xl min-w-[140px] animate-slide-up select-none',
              isOutgoing ? 'right-0' : 'left-0'
            )}
          >
            <button
              onClick={handleReply}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#F5F7F7] hover:bg-[#252C2E] transition"
            >
              <Reply size={14} className="text-brand" />
              <span>Reply</span>
            </button>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#F5F7F7] hover:bg-[#252C2E] transition"
            >
              <Copy size={14} className="text-blue-400" />
              <span>Copy</span>
            </button>
            {isOutgoing && onDelete && (
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
