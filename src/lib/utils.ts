import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  } catch {
    return '';
  }
}

export function formatChatTimestamp(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy');
  } catch {
    return '';
  }
}

export function formatLastSeen(dateString?: string | null): string {
  if (!dateString) return 'Offline';
  try {
    const date = new Date(dateString);
    if (isToday(date)) {
      return `Last seen today at ${format(date, 'HH:mm')}`;
    }
    if (isYesterday(date)) {
      return `Last seen yesterday at ${format(date, 'HH:mm')}`;
    }
    return `Last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
  } catch {
    return 'Offline';
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getInitials(name?: string | null): string {
  if (!name) return 'M';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getRandomColor(id: string): string {
  const colors = [
    '#A5E548',
    '#4ADE80',
    '#38BDF8',
    '#A78BFA',
    '#F472B6',
    '#FB923C',
    '#FACC15',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function isUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:');
}

export function isVideoUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return /\.(mp4|webm|mov|m4v|mkv|3gp)(\?.*)?$/i.test(str.trim());
}

export function isVideoMessage(message?: {
  content?: string;
  message_type?: string;
  metadata?: any;
} | null): boolean {
  if (!message) return false;
  const mime = message.metadata?.mime_type;
  if (typeof mime === 'string' && mime.startsWith('video/')) return true;
  if (isVideoUrl(message.metadata?.file_url)) return true;
  if (isVideoUrl(message.metadata?.file_name)) return true;
  if (isVideoUrl(message.content)) return true;
  return false;
}

export function isMediaUrl(str?: string | null): boolean {
  if (!str || !isUrl(str)) return false;
  return (
    str.includes('chat-attachments') ||
    str.includes('avatars') ||
    str.startsWith('blob:') ||
    /\.(jpg|jpeg|png|gif|webp|svg|pdf|docx?|xlsx?|mp4|webm|mov|m4v|mkv|3gp)(\?.*)?$/i.test(str)
  );
}

export function getMessagePreviewText(message?: {
  content?: string;
  message_type?: string;
  metadata?: any;
} | null): string {
  if (!message) return 'No messages yet';
  if (message.content === 'Typing...') return 'Typing...';

  // Check if message is a video first
  if (isVideoMessage(message)) {
    const caption = message.content && !isUrl(message.content) ? message.content.trim() : '';
    return caption ? `Video: ${caption}` : 'Video';
  }

  const type = message.message_type || 'text';
  if (type === 'image' || isMediaUrl(message.content)) {
    const caption = message.content && !isUrl(message.content) ? message.content.trim() : '';
    return caption ? `Photo: ${caption}` : 'Photo';
  }

  if (type === 'audio') {
    return 'Voice message';
  }

  if (type === 'file') {
    const name = message.metadata?.file_name || 'Document';
    return `Document: ${name}`;
  }

  if (type === 'call_log') {
    return message.metadata?.call_type === 'video' ? 'Video call' : 'Audio call';
  }

  // If text message is just a raw URL or blob
  if (isUrl(message.content)) {
    return 'Photo';
  }

  return message.content || '';
}
