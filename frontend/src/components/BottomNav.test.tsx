import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomNav from './BottomNav';
import { setConfig, $currentPage } from '@stores/dashboard';
import type { DashboardConfig } from '@lib/api';

const mockConfig: DashboardConfig = {
  dashboards: [
    {
      id: 'main',
      name: 'Platform Overview',
      icon: '⚡',
      grid: { columns: 4, rows: 2, gap: 14 },
      widgets: [],
    },
    {
      id: 'secondary',
      name: 'Secondary Dashboard',
      icon: '📊',
      grid: { columns: 4, rows: 2, gap: 14 },
      widgets: [],
    },
    {
      id: 'third',
      name: 'Third Dashboard',
      icon: '🎯',
      grid: { columns: 4, rows: 2, gap: 14 },
      widgets: [],
    },
  ],
  global: {
    title: 'MadHive Platform',
    rotation_interval: 30,
  },
};

describe('BottomNav', () => {
  beforeEach(() => {
    setConfig(mockConfig);
    $currentPage.set(0);
  });

  it('should render page counter', () => {
    render(<BottomNav />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should render page indicators', () => {
    render(<BottomNav />);
    const indicators = screen.getAllByRole('button', { name: /go to page/i });
    expect(indicators).toHaveLength(3);
  });

  it('should highlight current page indicator', () => {
    render(<BottomNav />);
    const indicators = screen.getAllByRole('button', { name: /go to page/i });

    // First indicator should be active (page 0)
    expect(indicators[0]).toHaveClass('bg-blue-500');
    expect(indicators[1]).not.toHaveClass('bg-blue-500');
    expect(indicators[2]).not.toHaveClass('bg-blue-500');
  });

  it('should update page counter when page changes', () => {
    const { rerender } = render(<BottomNav />);

    $currentPage.set(1);
    rerender(<BottomNav />);

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('should render previous button', () => {
    render(<BottomNav />);
    expect(screen.getByLabelText('previous page')).toBeInTheDocument();
  });

  it('should render next button', () => {
    render(<BottomNav />);
    expect(screen.getByLabelText('next page')).toBeInTheDocument();
  });

  it('should navigate to next page on next button click', () => {
    render(<BottomNav />);

    const nextButton = screen.getByLabelText('next page');
    fireEvent.click(nextButton);

    expect($currentPage.get()).toBe(1);
  });

  it('should navigate to previous page on prev button click', () => {
    $currentPage.set(1);
    render(<BottomNav />);

    const prevButton = screen.getByLabelText('previous page');
    fireEvent.click(prevButton);

    expect($currentPage.get()).toBe(0);
  });

  it('should navigate to specific page on indicator click', () => {
    render(<BottomNav />);

    const indicators = screen.getAllByRole('button', { name: /go to page/i });
    fireEvent.click(indicators[2]);

    expect($currentPage.get()).toBe(2);
  });

  it('should wrap to first page when clicking next on last page', () => {
    $currentPage.set(2);
    render(<BottomNav />);

    const nextButton = screen.getByLabelText('next page');
    fireEvent.click(nextButton);

    expect($currentPage.get()).toBe(0);
  });

  it('should wrap to last page when clicking prev on first page', () => {
    render(<BottomNav />);

    const prevButton = screen.getByLabelText('previous page');
    fireEvent.click(prevButton);

    expect($currentPage.get()).toBe(2);
  });

  it('should handle keyboard navigation - arrow right', () => {
    render(<BottomNav />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });

    expect($currentPage.get()).toBe(1);
  });

  it('should handle keyboard navigation - arrow left', () => {
    $currentPage.set(1);
    render(<BottomNav />);

    fireEvent.keyDown(document, { key: 'ArrowLeft' });

    expect($currentPage.get()).toBe(0);
  });

  it('should show keyboard shortcuts in UI', () => {
    render(<BottomNav />);
    // Check that keyboard shortcuts appear multiple times (in buttons and kbd hints)
    const leftArrows = screen.getAllByText('←');
    const rightArrows = screen.getAllByText('→');

    expect(leftArrows.length).toBeGreaterThan(0);
    expect(rightArrows.length).toBeGreaterThan(0);

    // Verify the Navigate label is present (shows keyboard shortcuts section)
    expect(screen.getByText('Navigate:')).toBeInTheDocument();
  });
});
