import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Tabs } from '../../../components/ui/Tabs';

describe('Tabs', () => {
  afterEach(() => {
    cleanup();
  });

  const tabs = [
    { id: 'tab1', label: 'Tab 1', content: <div data-testid="t1">Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div data-testid="t2">Content 2</div> },
  ];

  it('renders correctly with default tab', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.queryByTestId('t1')).toBeDefined();
    expect(screen.queryByTestId('t2')).toBeNull();

    expect(screen.getByText('Tab 1')).toBeDefined();
    expect(screen.getByText('Tab 2')).toBeDefined();
  });

  it('renders correctly with specified default tab', () => {
    render(<Tabs tabs={tabs} defaultTab="tab2" />);

    expect(screen.queryByTestId('t1')).toBeNull();
    expect(screen.queryByTestId('t2')).toBeDefined();
  });

  it('switches tabs on click', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.queryByTestId('t1')).toBeDefined();

    fireEvent.click(screen.getByText('Tab 2'));

    expect(screen.queryByTestId('t1')).toBeNull();
    expect(screen.queryByTestId('t2')).toBeDefined();
  });
});
