/**
 * BroadcastBriefing component — unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BroadcastBriefing } from '@/components/dashboard/broadcast-briefing';

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() })),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('framer-motion', () => ({
  m: {
    div: (props: Record<string, unknown>) => <div {...props} />, 
    button: (props: Record<string, unknown>) => <button {...props} />, 
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/api', () => ({ fetchJson: vi.fn() }));

vi.mock('lucide-react', () => {
  const icons = [
    'Megaphone', 'Send', 'Users', 'Shield', 'Clock', 'Loader2', 'X', 'CheckCircle2',
    'AlertTriangle', 'Info', 'Eye', 'Sparkles', 'Copy', 'Download', 'FileText', 'Zap',
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

describe('BroadcastBriefing', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<BroadcastBriefing {...defaultProps} />);
  });

  it('renders the dialog title', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Stakeholder Broadcast')).toBeInTheDocument();
  });

  it('renders dialog description', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText(/Send targeted announcements/)).toBeInTheDocument();
  });

  it('renders quick template buttons', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Urgent Incident')).toBeInTheDocument();
    expect(screen.getByText('Turnout Update')).toBeInTheDocument();
    expect(screen.getByText('Results Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Security Advisory')).toBeInTheDocument();
    expect(screen.getByText('Victory Milestone')).toBeInTheDocument();
    expect(screen.getByText('Closing Reminder')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('renders priority select', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('renders target audience select', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Target Audience')).toBeInTheDocument();
  });

  it('renders channel select', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Channel')).toBeInTheDocument();
  });

  it('renders footer buttons', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send broadcast/i })).toBeInTheDocument();
  });

  it('send broadcast button is disabled when form is empty', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByRole('button', { name: /send broadcast/i })).toBeDisabled();
  });

  it('renders the preview section', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders character count', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('0 / 1000')).toBeInTheDocument();
  });

  it('renders Attach Election Summary toggle', () => {
    render(<BroadcastBriefing {...defaultProps} />);
    expect(screen.getByText('Attach Election Summary')).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    const { queryByText } = render(<BroadcastBriefing open={false} onOpenChange={vi.fn()} />);
    expect(queryByText('Stakeholder Broadcast')).not.toBeInTheDocument();
  });
});
