import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { formatMessageTime, formatFileSize, cn } from '@/lib/utils';
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
  FileText,
  Download,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile } from '@/lib/storage';
import { ImageViewerModal } from './ImageViewerModal';

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

  const conversationMessages = useChatStore((s) => s.messages[message.conversation_id]);
  const replyTarget =
    message.reply_to_message ||
    (message.reply_to_message_id && conversationMessages
      ? conversationMessages.find((m) => m.id === message.reply_to_message_id) || null
      : null);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
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

      {/* Bubble Container */}
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu((prev) => !prev);
        }}
        className={cn(
          'relative px-4 py-2.5 shadow-sm text-sm transition-all select-text max-w-full break-words [overflow-wrap:anywhere]',
          isOutgoing
            ? 'bg-brand text-[#0B0F10] font-medium rounded-2xl rounded-tr-sm'
            : 'bg-[#292F32] dark:bg-[#292F32] light:bg-[#E9EDE8] text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] rounded-2xl rounded-tl-sm'
        )}
      >
        {/* Reply Quote Banner Inside Bubble */}
        {replyTarget && (
          <div
            className={cn(
              'text-xs mb-2 px-3 py-1.5 rounded-xl border-l-[3px] max-w-full select-none text-left',
              isOutgoing
                ? 'bg-[#0B0F10]/20 border-[#0B0F10] text-[#0B0F10]'
                : 'bg-[#151A1C]/90 border-brand text-[#F5F7F7]'
            )}
          >
            <span
              className={cn(
                'font-extrabold block text-[11px] mb-0.5',
                isOutgoing ? 'text-[#0B0F10]' : 'text-brand'
              )}
            >
              {replyTarget.sender?.display_name ||
                (replyTarget.sender_id === currentUserId ? 'You' : 'Reply')}
            </span>
            <span
              className={cn(
                'truncate block text-xs',
                isOutgoing ? 'text-[#0B0F10]/85 font-normal' : 'text-[#9BA5A8]'
              )}
            >
              {replyTarget.content ||
                (replyTarget.message_type === 'image' ? '📷 Photo' : 'Voice note')}
            </span>
          </div>
        )}

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
          <div className="space-y-1.5 max-w-sm">
            <div
              onClick={() => setIsImageViewerOpen(true)}
              className="relative group/img cursor-pointer rounded-2xl overflow-hidden border border-black/15 shadow-sm"
              title="Tap to see full picture"
            >
              <img
                src={message.metadata?.file_url || message.content}
                alt={message.metadata?.file_name || 'Attachment'}
                className="rounded-2xl max-h-72 w-full object-cover transition-transform duration-200 group-hover/img:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md shadow-lg">
                  <Maximize2 size={18} />
                </div>
              </div>
            </div>

            {message.content &&
              message.content !== message.metadata?.file_url && (
                <p className="whitespace-pre-wrap break-words text-xs pt-1 px-1">{message.content}</p>
              )}
          </div>
        )}

        {/* Document / File Attachment */}
        {message.message_type === 'file' && (
          <div className="space-y-1.5 min-w-[210px] max-w-[280px]">
            <div
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-2xl border transition shadow-sm',
                isOutgoing
                  ? 'bg-black/15 border-black/20 text-[#0B0F10]'
                  : 'bg-[#181E20] border-[#252C2E] text-[#F5F7F7]'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                  isOutgoing
                    ? 'bg-[#0B0F10] text-brand'
                    : 'bg-brand/20 text-brand'
                )}
              >
                <FileText size={22} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate leading-tight">
                  {message.metadata?.file_name || 'Document'}
                </p>
                <p
                  className={cn(
                    'text-[10px] mt-0.5',
                    isOutgoing ? 'text-[#0B0F10]/75' : 'text-[#9BA5A8]'
                  )}
                >
                  {formatFileSize(message.metadata?.file_size)}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(
                    message.metadata?.file_url || message.content,
                    message.metadata?.file_name || 'document'
                  );
                }}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition active:scale-95 shadow',
                  isOutgoing
                    ? 'bg-[#0B0F10] text-brand hover:bg-black'
                    : 'bg-brand text-[#0B0F10] hover:bg-brand-hover'
                )}
                title="Download document"
              >
                <Download size={16} strokeWidth={2.4} />
              </button>
            </div>

            {message.content &&
              message.content !== message.metadata?.file_url &&
              message.content !== message.metadata?.file_name && (
                <p className="whitespace-pre-wrap break-words text-xs pt-1 px-1">
                  {message.content}
                </p>
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

      {/* Fullscreen Picture Lightbox Viewer */}
      {message.message_type === 'image' && (
        <ImageViewerModal
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageUrl={message.metadata?.file_url || message.content}
          fileName={message.metadata?.file_name || 'photo.jpg'}
        />
      )}
    </div>
  );
};
