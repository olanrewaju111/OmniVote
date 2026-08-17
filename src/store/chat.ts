import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
  isSystem: boolean;
}

export interface OnlineUser {
  id: string;
  name: string;
  role: string;
  isOnline: boolean;
}

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  onlineUsers: OnlineUser[];
  unreadCount: number;
  isSending: boolean;
  lastFetchedAt: string | null;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  markAsRead: () => void;
  setSending: (sending: boolean) => void;
  setLastFetchedAt: (ts: string) => void;
}

// ─── Role color mapping (oklch-inspired tailwind tokens) ───────────────

export const ROLE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  SYSTEM: { bg: 'bg-amber/10', text: 'text-amber', dot: 'bg-amber' },
  TENANT_ADMIN: { bg: 'bg-emerald/10', text: 'text-emerald', dot: 'bg-emerald' },
  ANALYST: { bg: 'bg-cyan/10', text: 'text-cyan', dot: 'bg-cyan' },
  TRUST_SAFETY: { bg: 'bg-rose/10', text: 'text-rose', dot: 'bg-rose' },
  FIELD_AGENT: { bg: 'bg-violet/10', text: 'text-violet', dot: 'bg-violet' },
  SUPER_ADMIN: { bg: 'bg-emerald/10', text: 'text-emerald', dot: 'bg-emerald' },
};

export const ROLE_LABELS: Record<string, string> = {
  SYSTEM: 'System',
  TENANT_ADMIN: 'Admin',
  ANALYST: 'Analyst',
  TRUST_SAFETY: 'Trust & Safety',
  FIELD_AGENT: 'Field Agent',
  SUPER_ADMIN: 'Super Admin',
};

// ─── Store ─────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  onlineUsers: [],
  unreadCount: 0,
  isSending: false,
  lastFetchedAt: null,

  setOpen: (open) => {
    set({ isOpen: open });
    if (open) set({ unreadCount: 0 });
  },

  toggleOpen: () => {
    const wasOpen = get().isOpen;
    set({ isOpen: !wasOpen, unreadCount: wasOpen ? get().unreadCount : 0 });
  },

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => {
    const { isOpen, messages } = get();
    const newMessages = [...messages, message];
    set({
      messages: newMessages,
      unreadCount: isOpen ? 0 : get().unreadCount + 1,
    });
  },

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  markAsRead: () => set({ unreadCount: 0 }),

  setSending: (sending) => set({ isSending: sending }),

  setLastFetchedAt: (ts) => set({ lastFetchedAt: ts }),
}));
