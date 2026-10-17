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
