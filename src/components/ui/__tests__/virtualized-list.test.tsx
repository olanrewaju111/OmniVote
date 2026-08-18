import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualizedList } from '../virtualized-list';

interface TestItem {
  id: string;
  name: string;
}

const items: TestItem[] = Array.from({ length: 50 }, (_, i) => ({
  id: `item-${i}`,
  name: `Item ${i}`,
}));

describe('VirtualizedList', () => {
  it('renders empty message when no items are provided', () => {
    render(
      <VirtualizedList
        items={[]}
        itemHeight={40}
        containerHeight={200}
        getKey={(item) => item.id}
        renderItem={({ item }) => <div>{item.name}</div>}
        emptyContent={<p>No items found</p>}
      />,
    );
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders with items', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={40}
        containerHeight={200}
        getKey={(item) => item.id}
        renderItem={({ item }) => <div>{item.name}</div>}
      />,
    );
    // Should render at least the first item (within viewport + overscan)
    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });

  it('renders header when provided', () => {
    render(
      <VirtualizedList
        items={items}
        itemHeight={40}
        containerHeight={200}
        getKey={(item) => item.id}
        renderItem={({ item }) => <div>{item.name}</div>}
        header={<h2>List Header</h2>}
      />,
    );
    expect(screen.getByText('List Header')).toBeInTheDocument();
  });

  it('applies className to the container', () => {
    const { container } = render(
      <VirtualizedList
        items={items}
        itemHeight={40}
        containerHeight={200}
        getKey={(item) => item.id}
        renderItem={({ item }) => <div>{item.name}</div>}
        className="test-container"
      />,
    );
    expect(container.firstChild).toHaveClass('test-container');
  });
});
