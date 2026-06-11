import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Card from '../../components/Card';

afterEach(cleanup);

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>Hello content</Card>);
    expect(screen.getByText('Hello content')).toBeTruthy();
  });

  it('renders a heading when a title is provided', () => {
    render(<Card title="Statistics">body</Card>);
    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeTruthy();
  });

  it('does not render a heading when no title is provided', () => {
    render(<Card>body</Card>);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('applies a custom className to the card container', () => {
    const { container } = render(<Card className="custom-class">body</Card>);
    expect(container.querySelector('.custom-class')).toBeTruthy();
  });
});
