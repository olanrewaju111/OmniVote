/**
 * EmptyState component — unit tests
 * Phase 19: Component testing infrastructure
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';

// Mock lucide-react icons to avoid SVG rendering issues
vi.mock('lucide-react', () => ({
  AlertCircle: (props: Record<string, unknown>) => <svg data-testid='icon' {...props} />,
}));

describe('EmptyState', () => {
  const defaultProps = {
    icon: AlertCircle,
    title: 'No data found',
    description: 'There are no items to display at this time.',
  };

  it('renders title and description', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText('There are no items to display at this time.')).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render action button when action is not provided', () => {
    render(<EmptyState {...defaultProps} />);
    // No button should be present (except potentially within the icon/svg)
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders action button when action prop is provided', () => {
    const action = { label: 'Add Item', onClick: vi.fn() };
    render(<EmptyState {...defaultProps} action={action} />);
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('calls action.onClick when action button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const action = { label: 'Add Item', onClick };
    render(<EmptyState {...defaultProps} action={action} />);

    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState {...defaultProps} className="my-custom-class" />
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('renders with sm size variant', () => {
    const { container } = render(<EmptyState {...defaultProps} size="sm" />);
    expect(container.firstChild).toHaveClass('py-8');
  });

  it('renders with lg size variant', () => {
    const { container } = render(<EmptyState {...defaultProps} size="lg" />);
    expect(container.firstChild).toHaveClass('py-24');
  });

  it('defaults to md size variant', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    expect(container.firstChild).toHaveClass('py-16');
  });
});
