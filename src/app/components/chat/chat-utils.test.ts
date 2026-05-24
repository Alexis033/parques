import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  isSystemMessage,
  validateMessage,
  shouldAutoScroll,
  type ChatMessage,
} from './chat-utils';

// ---------- formatTimestamp ----------

describe('formatTimestamp', () => {
  it('should format a date to HH:MM pattern', () => {
    const date = new Date(2026, 4, 24, 14, 30); // May 24, 14:30 local
    expect(formatTimestamp(date)).toBe('14:30');
  });

  it('should format with leading zeros for single-digit hours/minutes', () => {
    const date = new Date(2026, 4, 24, 9, 5); // May 24, 09:05 local
    expect(formatTimestamp(date)).toBe('09:05');
  });

  it('should format 23:59 correctly', () => {
    const date = new Date(2026, 4, 24, 23, 59); // May 24, 23:59 local
    expect(formatTimestamp(date)).toBe('23:59');
  });
});

// ---------- isSystemMessage ----------

describe('isSystemMessage', () => {
  it('should return true for system messages', () => {
    const msg: ChatMessage = {
      id: '1',
      room_id: 'room-1',
      player_id: null,
      display_name: 'System',
      content: 'Player joined',
      created_at: new Date().toISOString(),
      is_system: true,
    };
    expect(isSystemMessage(msg)).toBe(true);
  });

  it('should return false for user messages', () => {
    const msg: ChatMessage = {
      id: '2',
      room_id: 'room-1',
      player_id: 'player-1',
      display_name: 'Alice',
      content: 'Hello!',
      created_at: new Date().toISOString(),
      is_system: false,
    };
    expect(isSystemMessage(msg)).toBe(false);
  });
});

// ---------- validateMessage ----------

describe('validateMessage', () => {
  it('should return valid for non-empty message under limit', () => {
    const result = validateMessage('Hello everyone!');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return invalid for empty message', () => {
    const result = validateMessage('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message cannot be empty');
  });

  it('should return invalid for whitespace-only message', () => {
    const result = validateMessage('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message cannot be empty');
  });

  it('should return invalid for message exceeding 1000 characters', () => {
    const longMsg = 'a'.repeat(1001);
    const result = validateMessage(longMsg);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('1000');
  });

  it('should accept message at exactly 1000 characters', () => {
    const exactMsg = 'a'.repeat(1000);
    const result = validateMessage(exactMsg);
    expect(result.valid).toBe(true);
  });
});

// ---------- shouldAutoScroll ----------

describe('shouldAutoScroll', () => {
  it('should return true when scrolled to bottom (within threshold)', () => {
    const el = { scrollTop: 500, scrollHeight: 600, clientHeight: 100 };
    expect(shouldAutoScroll(el)).toBe(true);
  });

  it('should return false when scrolled up significantly', () => {
    const el = { scrollTop: 200, scrollHeight: 600, clientHeight: 100 };
    expect(shouldAutoScroll(el)).toBe(false);
  });

  it('should return true when slightly above bottom (within 10px threshold)', () => {
    // 600 - 100 - 500 = 0 → exactly at bottom
    const el = { scrollTop: 490, scrollHeight: 600, clientHeight: 100 };
    // 600 - 100 - 490 = 10 → at threshold boundary
    expect(shouldAutoScroll(el, 10)).toBe(true);
  });

  it('should return false even 1px outside threshold', () => {
    const el = { scrollTop: 489, scrollHeight: 600, clientHeight: 100 };
    // 600 - 100 - 489 = 11 > 10 → outside threshold
    expect(shouldAutoScroll(el, 10)).toBe(false);
  });
});
