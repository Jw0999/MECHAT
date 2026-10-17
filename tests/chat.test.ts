import { describe, it, expect } from 'bun:test';
import { formatDuration, getInitials, formatMessageTime } from '../src/lib/utils';

describe('Chat Utilities & Formats', () => {
  it('formats call duration correctly', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(480)).toBe('08:00');
    expect(formatDuration(3600)).toBe('60:00');
  });

  it('extracts initials properly', () => {
    expect(getInitials('Nina Flora')).toBe('NF');
    expect(getInitials('Danang Calvin')).toBe('DC');
    expect(getInitials('Single')).toBe('SI');
    expect(getInitials('')).toBe('M');
  });

  it('formats valid ISO message time to HH:mm', () => {
    const iso = '2026-10-17T17:45:00Z';
    const formatted = formatMessageTime(iso);
    expect(formatted.length).toBe(5);
    expect(formatted.includes(':')).toBe(true);
  });
});
