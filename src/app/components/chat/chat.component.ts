import { Component, Input, signal, computed, inject, OnDestroy, OnInit, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { ChatService } from '../../services/chat/chat.service';
import { formatTimestamp, isSystemMessage, validateMessage, shouldAutoScroll, type ChatMessage } from './chat-utils';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="chat-container" data-testid="chat-container">
      <div class="chat-header">💬 Chat</div>

      <div
        class="messages-area"
        #scrollContainer
        (scroll)="onScroll()"
        data-testid="messages-area"
      >
        @for (msg of messages(); track msg.id) {
          <div
            class="message"
            [class.system-message]="msg.is_system"
            data-testid="message-row"
          >
            <span class="msg-name">{{ msg.display_name }}</span>
            <span class="msg-content">{{ msg.content }}</span>
            <span class="msg-time">{{ formatMsgTimestamp(msg.created_at) }}</span>
          </div>
        } @empty {
          <div class="empty-state" data-testid="empty-chat">No messages yet</div>
        }
      </div>

      @if (sendError()) {
        <div class="send-error" data-testid="send-error">{{ sendError() }}</div>
      }

      <div class="input-area">
        <input
          type="text"
          [(ngModel)]="messageInput"
          (keyup.enter)="onSend()"
          placeholder="Type a message..."
          class="chat-input"
          [disabled]="sending()"
          data-testid="chat-input"
        />
        <button
          (click)="onSend()"
          class="send-btn"
          [disabled]="!messageInput().trim() || sending()"
          data-testid="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      background: #f8f9fa;
      border-radius: 12px;
      border: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .chat-header {
      padding: 0.5rem 0.75rem;
      font-weight: 700;
      font-size: 0.85rem;
      color: #2c3e50;
      background: white;
      border-bottom: 1px solid #e9ecef;
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-height: 0;
      max-height: 280px;
      scroll-behavior: smooth;
    }

    .message {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      align-items: baseline;
      padding: 0.2rem 0;
      font-size: 0.82rem;
      line-height: 1.4;
    }

    .message.system-message {
      font-style: italic;
      color: #7f8c8d;
    }
    .message.system-message .msg-name {
      color: #95a5a6;
    }

    .msg-name {
      font-weight: 600;
      color: #2c3e50;
      white-space: nowrap;
    }

    .system-message .msg-name {
      display: none;
    }

    .system-message .msg-content::before {
      content: '⚡ ';
    }

    .msg-content {
      color: #34495e;
      word-break: break-word;
      flex: 1;
      min-width: 0;
    }

    .msg-time {
      font-size: 0.7rem;
      color: #95a5a6;
      white-space: nowrap;
    }

    .empty-state {
      color: #95a5a6;
      font-size: 0.82rem;
      font-style: italic;
      text-align: center;
      padding: 2rem 0;
    }

    .send-error {
      background: #fdf2f2;
      color: #e74c3c;
      font-size: 0.78rem;
      padding: 0.3rem 0.75rem;
      text-align: center;
    }

    .input-area {
      display: flex;
      gap: 0.4rem;
      padding: 0.5rem;
      border-top: 1px solid #e9ecef;
      background: white;
    }

    .chat-input {
      flex: 1;
      border: 1px solid #dde4e6;
      border-radius: 8px;
      padding: 0.4rem 0.6rem;
      font-size: 0.82rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .chat-input:focus {
      border-color: #3498db;
    }
    .chat-input:disabled {
      background: #f0f0f0;
    }

    .send-btn {
      padding: 0.4rem 0.9rem;
      border: none;
      border-radius: 8px;
      background: #3498db;
      color: white;
      font-weight: 600;
      font-size: 0.82rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    .send-btn:hover:not(:disabled) {
      background: #2980b9;
    }
    .send-btn:disabled {
      background: #bdc3c7;
      cursor: not-allowed;
    }
  `],
})
export class ChatComponent implements OnInit, OnDestroy {
  @Input({ required: true }) roomId!: string;
  @Input() currentUserId: string | null = null;
  @Input() currentDisplayName: string = '';

  private supabase = inject(SupabaseService);
  private chatService = inject(ChatService);

  private scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');

  protected messages = signal<ChatMessage[]>([]);
  protected messageInput = signal('');
  protected sending = signal(false);
  protected sendError = signal<string | null>(null);
  private userScrolledUp = signal(false);

  private channel: ReturnType<SupabaseService['client']['channel']> | null = null;

  ngOnInit(): void {
    this.loadRecentMessages();
    this.subscribeToMessages();
  }

  ngOnDestroy(): void {
    this.channel?.unsubscribe();
    this.channel = null;
  }

  private async loadRecentMessages(): Promise<void> {
    try {
      const { data, error } = await this.chatService.messages
        .select('*')
        .eq('room_id', this.roomId)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      if (data) {
        this.messages.set(data as unknown as ChatMessage[]);
      }
    } catch {
      // Silently fail — messages will still arrive via Realtime
    }
  }

  private subscribeToMessages(): void {
    const channelName = `messages:${this.roomId}`;
    this.channel = this.supabase.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${this.roomId}`,
        },
        (payload) => {
          const newMsg = payload.new as unknown as ChatMessage;
          this.messages.update((prev) => [...prev, newMsg]);
          if (!this.userScrolledUp()) {
            this.scrollToBottom();
          }
        },
      )
      .subscribe();
  }

  private scrollToBottom(): void {
    // Defer to next tick to allow DOM to update
    requestAnimationFrame(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  protected onScroll(): void {
    const el = this.scrollContainer()?.nativeElement;
    if (el) {
      this.userScrolledUp.set(!shouldAutoScroll(el));
    }
  }

  protected formatMsgTimestamp(iso: string): string {
    return formatTimestamp(new Date(iso));
  }

  protected isSystem(msg: ChatMessage): boolean {
    return isSystemMessage(msg);
  }

  protected async onSend(): Promise<void> {
    const content = this.messageInput();
    const validation = validateMessage(content);
    if (!validation.valid) return;

    if (!this.currentUserId) return;

    this.sending.set(true);
    this.sendError.set(null);

    try {
      // Optimistically clear input
      this.messageInput.set('');
      await this.chatService.sendMessage(
        this.roomId,
        this.currentUserId,
        this.currentDisplayName || 'Unknown',
        content.trim(),
      );
    } catch (err) {
      // Restore input on failure
      this.messageInput.set(content);
      this.sendError.set('Failed to send message');
    } finally {
      this.sending.set(false);
    }
  }
}
