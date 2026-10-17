import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, Image, FileText, X, Square, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/database.types';
import { toast } from 'sonner';

interface MessageComposerProps {
  onSendMessage: (
    content: string,
    messageType?: 'text' | 'image' | 'audio' | 'file',
    metadata?: any
  ) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  onTyping?: (isTyping: boolean) => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  onTyping,
}) => {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    previewUrl: string;
    type: 'image' | 'file';
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const isTypingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Auto-focus textarea when replying
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Handle typing debounce safely
  useEffect(() => {
    if (!onTyping) return;
    if (text.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }
      const timer = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping(false);
    }
  }, [text]);

  const handleSend = () => {
    // If there is a pending image or file attachment
    if (pendingAttachment) {
      onSendMessage(
        pendingAttachment.previewUrl,
        pendingAttachment.type,
        {
          file_name: pendingAttachment.file.name,
          file_size: pendingAttachment.file.size,
          mime_type: pendingAttachment.file.type,
          file_url: pendingAttachment.previewUrl,
        }
      );
      setPendingAttachment(null);
      if (text.trim()) {
        onSendMessage(text.trim(), 'text');
        setText('');
      }
      return;
    }

    if (!text.trim()) return;
    onSendMessage(text.trim(), 'text');
    setText('');
    if (onCancelReply) onCancelReply();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds 25MB limit');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingAttachment({ file, previewUrl, type });
    setShowAttachMenu(false);
  };

  // Real voice message recording using MediaRecorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission not granted or unavailable:', err);
      toast.error('Microphone permission required for voice notes');
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(recordTimerRef.current);
    const duration = recordingSeconds;

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      onSendMessage(audioUrl, 'audio', {
        audio_duration: Math.max(duration, 1),
        file_url: audioUrl,
        file_name: `voice_${Date.now()}.webm`,
      });

      setIsRecording(false);
      setRecordingSeconds(0);
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatRecTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative p-3 bg-[#0B0F10] dark:bg-[#0B0F10] light:bg-[#F7F9F5] border-t border-[#252C2E]/60 dark:border-[#252C2E]/60 light:border-[#E0E6DD]/80 transition-colors">
      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border-l-4 border-brand rounded-lg text-xs">
          <div className="truncate mr-2">
            <span className="font-bold text-brand block">
              Replying to {replyingTo.sender?.display_name || 'Message'}
            </span>
            <span className="text-[#9BA5A8] truncate">{replyingTo.content}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="text-[#9BA5A8] hover:text-[#F5F7F7] p-1 rounded transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attachment Preview Banner */}
      {pendingAttachment && (
        <div className="relative inline-block mb-2 rounded-xl overflow-hidden border border-[#252C2E] shadow-md">
          {pendingAttachment.type === 'image' ? (
            <img
              src={pendingAttachment.previewUrl}
              alt="Upload preview"
              className="h-20 w-auto object-cover rounded-xl"
            />
          ) : (
            <div className="flex items-center gap-2 p-2 bg-[#151A1C] text-xs text-[#F5F7F7]">
              <FileText size={18} className="text-brand" />
              <span className="truncate max-w-[160px]">{pendingAttachment.file.name}</span>
            </div>
          )}
          <button
            onClick={() => setPendingAttachment(null)}
            className="absolute top-1 right-1 bg-black/70 hover:bg-black text-white p-1 rounded-full transition"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Attachment Popup Menu */}
      {showAttachMenu && (
        <div className="absolute bottom-20 left-4 z-30 bg-[#151A1C] dark:bg-[#151A1C] light:bg-[#FFFFFF] border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] rounded-2xl p-2 shadow-2xl flex flex-col gap-1 min-w-[160px] animate-slide-up">
          <button
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#252C2E]/60 text-sm font-medium text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition"
          >
            <div className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center">
              <Image size={18} />
            </div>
            <span>Photos & Videos</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#252C2E]/60 text-sm font-medium text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] transition"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <span>Document</span>
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        onChange={(e) => handleFileSelect(e, 'image')}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileSelect(e, 'file')}
        className="hidden"
      />

      {/* Main Composer Pill Bar */}
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        {isRecording ? (
          // Recording View
          <div className="flex-1 flex items-center justify-between bg-[#1D2326] dark:bg-[#1D2326] light:bg-[#E9EDE8] rounded-full px-4 py-2.5 shadow-inner border border-[#252C2E]">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18]">
                {formatRecTime(recordingSeconds)}
              </span>
              <span className="text-xs text-[#9BA5A8] hidden sm:inline">Recording audio...</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                className="p-1.5 text-[#9BA5A8] hover:text-red-400 rounded-full transition"
                title="Cancel recording"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={stopAndSendRecording}
                className="w-8 h-8 rounded-full bg-brand text-[#0B0F10] flex items-center justify-center hover:bg-brand-hover transition shadow"
                title="Send voice note"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        ) : (
          // Standard Input Pill
          <div className="flex-1 flex items-center gap-2 bg-[#1E2325] dark:bg-[#1E2325] light:bg-[#E9EDE8] rounded-full px-3 py-1.5 border border-[#252C2E] dark:border-[#252C2E] light:border-[#E0E6DD] focus-within:border-brand/60 transition-colors shadow-inner">
            {/* Attachment Button */}
            <button
              onClick={() => setShowAttachMenu((prev) => !prev)}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-[#9BA5A8] hover:text-[#F5F7F7] transition shrink-0',
                showAttachMenu && 'rotate-45 text-brand'
              )}
              title="Add attachment"
            >
              <Plus size={20} />
            </button>

            {/* Message Text Area */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 bg-transparent text-[#F5F7F7] dark:text-[#F5F7F7] light:text-[#171B18] placeholder-[#9BA5A8] text-sm resize-none focus:outline-none max-h-28 py-1 leading-normal"
            />

            {/* Voice Message Record Button */}
            {!text.trim() && !pendingAttachment && (
              <button
                onClick={startRecording}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#9BA5A8] hover:text-brand transition shrink-0"
                title="Record voice note"
              >
                <Mic size={19} />
              </button>
            )}

            {/* Send Button */}
            {(text.trim() || pendingAttachment) && (
              <button
                onClick={handleSend}
                className="w-8 h-8 rounded-full bg-brand text-[#0B0F10] flex items-center justify-center hover:bg-brand-hover active:scale-95 transition shrink-0 shadow-md shadow-brand/20"
                title="Send message"
              >
                <Send size={16} className="translate-x-[1px]" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
