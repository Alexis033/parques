// Pure utility functions for chat logic.
// Kept separate for testability — zero Angular/Supabase dependencies.

export interface ChatMessage {
  id: string;
  room_id: string;
  player_id: string | null;
  display_name: string;
  content: string;
  created_at: string;
  is_system: boolean;
}

const MAX_MESSAGE_LENGTH = 1000;
const DEFAULT_SCROLL_THRESHOLD = 10;

/**
 * Format a Date to HH:MM (24-hour) string.
 */
export function formatTimestamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Check if a message is a system-generated message.
 */
export function isSystemMessage(msg: ChatMessage): boolean {
  return msg.is_system === true;
}

/**
 * Validate message content before sending.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateMessage(
  content: string,
): { valid: true } | { valid: false; error: string } {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { valid: true };
}

/**
 * Check if the user is scrolled near the bottom of a scroll container.
 * Returns true if within `threshold` pixels of the bottom.
 */
export function shouldAutoScroll(
  el: { scrollTop: number; scrollHeight: number; clientHeight: number },
  threshold = DEFAULT_SCROLL_THRESHOLD,
): boolean {
  const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
  return distanceFromBottom <= threshold;
}
