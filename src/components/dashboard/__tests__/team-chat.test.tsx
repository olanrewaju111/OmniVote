/**
 * TeamChat components — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatToggleButton, TeamChatDrawer } from '@/components/dashboard/team-chat';

// ── Mocks ──────────────────────────────────────────────────────────────
let _isAuthenticated = true;

vi.mock('@/store/dashboard', () => ({
  useDashboardStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      tenantId: 'tenant-1',
      user: { id: 'u1', name: 'Admin User', role: 'TENANT_ADMIN', tenantId: 'tenant-1' },
      isAuthenticated: _isAuthenticated,
    };
    return selector ? selector(state) : state;
  },
}));

const chatState = {
  isOpen: false,
  messages: [] as Array<{ id: string; senderId: string; senderName: string; senderRole: string; body: string; createdAt: string; isSystem: boolean }>,
  onlineUsers: [] as Array<{ id: string; name: string; role: string; isOnline: boolean }>,
  unreadCount: 0,
  isSending: false,
  lastFetchedAt: null as string | null,
  setOpen: vi.fn(),
  toggleOpen: vi.fn(),
  setMessages: vi.fn(),
  addMessage: vi.fn(),
  setOnlineUsers: vi.fn(),
  markAsRead: vi.fn(),
  setSending: vi.fn(),
  setLastFetchedAt: vi.fn(),
};

let _chatOverrides: Partial<typeof chatState> = {};

vi.mock('@/store/chat', () => ({
  useChatStore: Object.assign(
    (selector?: (s: typeof chatState) => unknown) => {
      const merged = { ...chatState, ..._chatOverrides };
      return selector ? selector(merged) : merged;
    },
    { getState: () => ({ ...chatState, ..._chatOverrides }) }
  ),
  ROLE_COLORS: {
    SYSTEM: { bg: 'bg-amber/10', text: 'text-amber', dot: 'bg-amber' },
    TENANT_ADMIN: { bg: 'bg-emerald/10', text: 'text-emerald', dot: 'bg-emerald' },
    ANALYST: { bg: 'bg-cyan/10', text: 'text-cyan', dot: 'bg-cyan' },
    TRUST_SAFETY: { bg: 'bg-rose/10', text: 'text-rose', dot: 'bg-rose' },
    FIELD_AGENT: { bg: 'bg-violet/10', text: 'text-violet', dot: 'bg-violet' },
    SUPER_ADMIN: { bg: 'bg-emerald/10', text: 'text-emerald', dot: 'bg-emerald' },
  },
  ROLE_LABELS: {
    SYSTEM: 'System', TENANT_ADMIN: 'Admin', ANALYST: 'Analyst',
    TRUST_SAFETY: 'Trust & Safety', FIELD_AGENT: 'Field Agent', SUPER_ADMIN: 'Super Admin',
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined, isLoading: true, isError: false, error: null,
    isFetching: false, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() })),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('framer-motion', () => ({
  m: {
    div: (props: Record<string, unknown>) => <div {...props} />, span: (props: Record<string, unknown>) => <span {...props} />, button: (props: Record<string, unknown>) => <button {...props} />, aside: (props: Record<string, unknown>) => <aside {...props} />, circle: (props: Record<string, unknown>) => <circle {...props} />, svg: (props: Record<string, unknown>) => <svg {...props} />, path: (props: Record<string, unknown>) => <path {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({ fetchJson: vi.fn() }));

vi.mock('lucide-react', () => {
  const icons = [
    'MessageCircle', 'X', 'Send', 'Users', 'Hash', 'Circle', 'Loader2', 'AlertCircle', 'AtSign',
    // Icons used internally by shadcn/ui components
    'XIcon', 'CheckIcon', 'ChevronDownIcon', 'ChevronUpIcon',
    'ChevronRightIcon', 'CircleIcon',
  ];
  const mod: Record<string, unknown> = {};
  for (const name of icons) {
    mod[name] = (props: Record<string, unknown>) => <span data-testid={`icon-${name}`} {...props} />;
  }
  return mod;
});

import { useQuery } from '@tanstack/react-query';
const mockedUseQuery = vi.mocked(useQuery);

describe('ChatToggleButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _chatOverrides = {};
    _isAuthenticated = true;
  });

  it('renders without crashing', () => {
    render(<ChatToggleButton />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has correct aria-label when closed', () => {
    render(<ChatToggleButton />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Open team chat');
  });

  it('shows unread count badge when unreadCount > 0', () => {
    _chatOverrides = { unreadCount: 5, isOpen: false };
    render(<ChatToggleButton />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ when unreadCount exceeds 99', () => {
    _chatOverrides = { unreadCount: 150, isOpen: false };
    render(<ChatToggleButton />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not render when not authenticated', () => {
    _isAuthenticated = false;
    const { container } = render(<ChatToggleButton />);
    expect(container.innerHTML).toBe('');
  });
});

describe('TeamChatDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _chatOverrides = { isOpen: true };
  });

  it('renders without crashing when open', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null,
      isFetching: true, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByText('Team Chat')).toBeInTheDocument();
  });

  it('renders the Team Chat heading', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null,
      isFetching: true, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByRole('heading', { name: 'Team Chat' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null,
      isFetching: true, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByText('Loading messages…')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('fail'),
      isFetching: false, isPending: false, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByText('Failed to load messages')).toBeInTheDocument();
  });

  it('shows empty message state when no messages', () => {
    _chatOverrides = { isOpen: true, messages: [] };
    mockedUseQuery.mockReturnValue({
      data: { messages: [], onlineUsers: [] }, isLoading: false, isError: false, error: null,
      isFetching: false, isPending: false, isSuccess: true, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('renders the message input area', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null,
      isFetching: true, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument();
  });

  it('renders the close button', () => {
    mockedUseQuery.mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null,
      isFetching: true, isPending: true, isSuccess: false, isRefetching: false, refetch: vi.fn(),
    } as ReturnType<typeof useQuery>);
    render(<TeamChatDrawer />);
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    _chatOverrides = { isOpen: false };
    const { queryByText } = render(<TeamChatDrawer />);
    expect(queryByText('Team Chat')).not.toBeInTheDocument();
  });
});
