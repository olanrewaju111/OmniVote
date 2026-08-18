'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Users,
  Hash,
  Circle,
  Loader2,
  AlertCircle,
  AtSign,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { fetchJson } from '@/lib/api';
import { useChatStore, ROLE_COLORS, ROLE_LABELS, type ChatMessage, type OnlineUser } from '@/store/chat';
import { useDashboardStore, type UserRole } from '@/store/dashboard';

// ─── Helpers ───────────────────────────────────────────────────────────

function relativeTime(date: string) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(date: string) {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Returns a date key like "2025-02-25" for grouping messages by day */
function dateKey(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

function friendlyDate(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Detect @mentions in text and highlight them */
function renderBody(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    /^@\w+$/.test(part) ? (
      <span key={i} className="text-emerald font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ─── Backdrop ──────────────────────────────────────────────────────────

function ChatBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <m.div
      key="chat-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] md:bg-black/20"
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

// ─── Chat Toggle Button ────────────────────────────────────────────────

export function ChatToggleButton() {
  const { isOpen, toggleOpen, unreadCount } = useChatStore();
  const isAuthenticated = useDashboardStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return null;

  return (
    <m.button
      onClick={toggleOpen}
      aria-label={isOpen ? 'Close team chat' : `Open team chat${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      aria-expanded={isOpen}
      className={cn(
        'fixed z-50 flex items-center justify-center w-12 h-12 rounded-full',
        'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
        'shadow-lg shadow-emerald-500/25',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2',
        'hover:from-emerald-400 hover:to-emerald-500 active:scale-95',
        'transition-colors duration-150',
        // Position above the FAB (which is at bottom-20)
        'bottom-24 right-4'
      )}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
    >
      {/* Emerald pulsing ring when unread */}
      {unreadCount > 0 && !isOpen && (
        <m.span
          className="absolute inset-0 rounded-full bg-emerald-400"
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* Pulsing dot indicator */}
      {unreadCount > 0 && !isOpen && (
        <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-300 animate-pulse-dot border-2 border-emerald-600" />
      )}

      <m.div
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}
      </m.div>

      {/* Unread badge */}
      {unreadCount > 0 && !isOpen && (
        <m.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className={cn(
            'absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full',
            'bg-rose text-white text-[10px] font-bold',
            'flex items-center justify-center px-1',
            'border-2 border-background',
            'shadow-md shadow-rose/30'
          )}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </m.span>
      )}
    </m.button>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isConsecutive,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  isConsecutive: boolean;
}) {
  const roleColor = ROLE_COLORS[message.senderRole] || ROLE_COLORS.FIELD_AGENT;

  // System message — centered
  if (message.isSystem) {
    return (
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex justify-center py-1 px-4"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 max-w-[90%]">
          <span className="shrink-0 h-px flex-1 bg-border/50" />
          <span className="shrink-0 flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-amber/5 border border-amber/10">
            <AlertCircle className="h-3 w-3 text-amber/60" />
            {renderBody(message.body)}
          </span>
          <span className="shrink-0 h-px flex-1 bg-border/50" />
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex gap-2 px-4',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        isConsecutive ? 'mt-0.5' : 'mt-3'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {showAvatar ? (
          <Avatar className={cn('w-7 h-7', isOwn && 'order-2')}>
            <AvatarFallback
              className={cn(
                'text-[10px] font-semibold',
                roleColor.bg,
                roleColor.text
              )}
            >
              {getInitials(message.senderName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-7" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col max-w-[75%] min-w-0', isOwn && 'items-end')}>
        {/* Name + time for first in group */}
        {showAvatar && (
          <div
            className={cn(
              'flex items-center gap-2 mb-0.5 px-1',
              isOwn && 'flex-row-reverse'
            )}
          >
            <span className={cn('text-[11px] font-semibold', roleColor.text)}>
              {message.senderName}
            </span>
            <span className={cn('text-[10px] px-1.5 py-px rounded-full', roleColor.bg, roleColor.text, 'font-medium')}>
              {ROLE_LABELS[message.senderRole] || message.senderRole}
            </span>
            <span className="text-[10px] text-muted-foreground/50">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        {/* Message body */}
        <div
          className={cn(
            'px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words',
            isOwn
              ? 'bg-emerald/15 text-foreground rounded-br-md border border-emerald/10'
              : 'glass-subtle rounded-bl-md border border-border/40'
          )}
        >
          {renderBody(message.body)}
        </div>
      </div>
    </m.div>
  );
}

// ─── Date Separator ────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-3 px-4">
      <span className="h-px flex-1 bg-border/40" />
      <span className="px-3 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
        {friendlyDate(date)}
      </span>
      <span className="h-px flex-1 bg-border/40" />
    </div>
  );
}

// ─── Online Users Bar ──────────────────────────────────────────────────

function OnlineUsersBar({ users }: { users: OnlineUser[] }) {
  const onlineCount = users.filter((u) => u.isOnline).length;
  const [expanded, setExpanded] = useState(false);

  // Show first 3 avatars + count
  const displayed = users.filter((u) => u.isOnline).slice(0, 3);
  const extraCount = onlineCount - displayed.length;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
        aria-label={`${onlineCount} team members online`}
      >
        <Users className="h-3.5 w-3.5" />
        <span className="font-medium">
          {onlineCount} online
        </span>
        <div className="flex -space-x-1.5 ml-auto">
          {displayed.map((u) => (
            <Avatar key={u.id} className="w-5 h-5 ring-1 ring-background">
              <AvatarFallback
                className={cn(
                  'text-[7px] font-semibold',
                  (ROLE_COLORS[u.role] || ROLE_COLORS.FIELD_AGENT).bg,
                  (ROLE_COLORS[u.role] || ROLE_COLORS.FIELD_AGENT).text
                )}
              >
                {getInitials(u.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {extraCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground ring-1 ring-background">
              +{extraCount}
            </span>
          )}
        </div>
      </button>

      {/* Expanded users list */}
      <AnimatePresence>
        {expanded && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="px-3 py-2 space-y-1.5 max-h-40 overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-2 text-xs">
                  <Circle
                    className={cn(
                      'h-2 w-2 fill-current',
                      u.isOnline ? 'text-emerald' : 'text-muted-foreground/30'
                    )}
                  />
                  <span className={cn('font-medium', !u.isOnline && 'text-muted-foreground/50')}>
                    {u.name}
                  </span>
                  <span className={cn('ml-auto text-[10px]', (ROLE_COLORS[u.role] || ROLE_COLORS.FIELD_AGENT).text)}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Message Input ─────────────────────────────────────────────────────

function MessageInput({
  onSend,
  isSending,
}: {
  onSend: (body: string) => void;
  isSending: boolean;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [text, isSending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Auto-resize textarea
  const handleInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  return (
    <div className="shrink-0 border-t border-border/30 p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Type a message…"
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl px-3.5 py-2.5 text-[13px]',
              'bg-muted/50 border border-border/40',
              'placeholder:text-muted-foreground/40',
              'focus:outline-none focus:ring-1 focus:ring-emerald/40 focus:border-emerald/30',
              'transition-colors duration-150',
              'max-h-[100px] overflow-y-auto',
              'scrollbar-thin'
            )}
            aria-label="Type a message"
          />
        </div>
        <m.button
          onClick={handleSubmit}
          disabled={!text.trim() || isSending}
          aria-label="Send message"
          className={cn(
            'shrink-0 flex items-center justify-center w-9 h-9 rounded-xl',
            'transition-all duration-150',
            text.trim() && !isSending
              ? 'bg-emerald text-white shadow-md shadow-emerald/20 hover:bg-emerald/90'
              : 'bg-muted/50 text-muted-foreground/30 cursor-not-allowed'
          )}
          whileTap={text.trim() && !isSending ? { scale: 0.92 } : undefined}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </m.button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[10px] text-muted-foreground/30 flex items-center gap-1">
          <AtSign className="h-3 w-3" />
          Mention with @name
        </span>
        <span className="text-[10px] text-muted-foreground/30">
          Enter to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}

// ─── Drawer variants ───────────────────────────────────────────────────

const drawerVariants = {
  hidden: { x: '100%' },
  visible: { x: 0 },
};

const drawerTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
};

// ─── Main Drawer ───────────────────────────────────────────────────────

export function TeamChatDrawer() {
  const { isOpen, setOpen, messages, onlineUsers, isSending, setSending } = useChatStore();
  const user = useDashboardStore((s) => s.user);
  const tenantId = useDashboardStore((s) => s.tenantId);
  const queryClient = useQueryClient();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // ── Fetch messages ──
  const { data, isLoading, error } = useQuery<{ messages: ChatMessage[]; onlineUsers: OnlineUser[] }>({
    queryKey: ['chat', tenantId],
    queryFn: () => fetchJson(`/api/chat?tenantId=${tenantId}`),
    enabled: isOpen && !!tenantId,
    staleTime: 15_000,
    refetchInterval: 10_000,
  });

  // Sync fetched data to store
  useEffect(() => {
    if (data?.messages) {
      useChatStore.getState().setMessages(data.messages);
    }
    if (data?.onlineUsers) {
      useChatStore.getState().setOnlineUsers(data.onlineUsers);
    }
  }, [data]);

  // ── Send message mutation ──
  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      setSending(true);
      const res = await fetch(`/api/chat?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      // Refetch to get the canonical message from server
      queryClient.invalidateQueries({ queryKey: ['chat', tenantId] });
    },
    onError: (err) => {
      toast.error('Failed to send message', { description: err.message });
    },
    onSettled: () => {
      setSending(false);
    },
  });

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom when drawer opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [isOpen]);

  // ── Track scroll position ──
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 60;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // ── Group messages for display ──
  const groupedMessages = useMemo(() => {
    const groups: Array<{ type: 'date'; date: string } | { type: 'message'; message: ChatMessage; isOwn: boolean; showAvatar: boolean; isConsecutive: boolean }> = [];
    let lastDate = '';
    let lastSenderId = '';

    for (const msg of messages) {
      const dk = dateKey(msg.createdAt);
      if (dk !== lastDate) {
        groups.push({ type: 'date', date: msg.createdAt });
        lastDate = dk;
        lastSenderId = '';
      }

      const isOwn = msg.senderId === user?.id;
      const showAvatar = msg.senderId !== lastSenderId && !msg.isSystem;
      const isConsecutive = msg.senderId === lastSenderId && !msg.isSystem;

      groups.push({ type: 'message', message: msg, isOwn, showAvatar, isConsecutive });
      lastSenderId = msg.senderId;
    }

    return groups;
  }, [messages, user?.id]);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  return (
    <AnimatePresence>
      {isOpen && <ChatBackdrop onClick={handleClose} />}

      <AnimatePresence>
        {isOpen && (
          <m.aside
            key="team-chat-drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={drawerTransition}
            role="dialog"
            aria-label="Team chat"
            aria-modal="true"
            className={cn(
              'fixed top-0 right-0 z-50 h-full',
              'w-full md:w-[380px]',
              'glass-strong border-l border-border/30',
              'flex flex-col',
              'shadow-2xl shadow-black/20'
            )}
          >
            {/* ── Header ── */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald/10">
                  <Hash className="h-4 w-4 text-emerald" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold truncate">Team Chat</h2>
                  <div className="flex items-center gap-1.5">
                    <Circle className="h-1.5 w-1.5 fill-emerald text-emerald" />
                    <span className="text-[11px] text-muted-foreground">
                      {onlineUsers.filter((u) => u.isOnline).length} members online
                    </span>
                  </div>
                </div>
              </div>

              <m.button
                onClick={handleClose}
                aria-label="Close chat"
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  'transition-colors duration-150'
                )}
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-4 w-4" />
              </m.button>
            </div>

            {/* ── Online users bar ── */}
            <OnlineUsersBar users={onlineUsers} />

            {/* ── Messages ── */}
            <div
              ref={scrollAreaRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto py-2"
            >
              {isLoading && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Loading messages…</span>
                </div>
              ) : error && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-xs">Failed to load messages</span>
                </div>
              ) : groupedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
                  <MessageCircle className="h-8 w-8" />
                  <span className="text-xs">No messages yet. Start the conversation!</span>
                </div>
              ) : (
                groupedMessages.map((item, idx) => {
                  if (item.type === 'date') {
                    return <DateSeparator key={`date-${idx}`} date={item.date} />;
                  }
                  const { message, isOwn, showAvatar, isConsecutive } = item;
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      isConsecutive={isConsecutive}
                    />
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <MessageInput
              onSend={(body) => sendMessage.mutate(body)}
              isSending={isSending}
            />
          </m.aside>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
