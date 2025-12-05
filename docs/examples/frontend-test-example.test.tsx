/**
 * Example Frontend Unit Test
 * 
 * This example demonstrates how to write frontend unit tests using
 * Jest and React Testing Library.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '@/components/my-component';
import { render as renderWithProviders } from '../../tests/utils/test-utils';
import { mockWindowEthereum, cleanupWindowEthereum } from '../../tests/utils/mock-wallet';

// Mock hooks
jest.mock('@/hooks/use-api', () => ({
  useMyData: jest.fn(() => ({
    data: { value: 'test' },
    isLoading: false,
  })),
}));

describe('MyComponent', () => {
  beforeEach(() => {
    mockWindowEthereum();
  });

  afterEach(() => {
    cleanupWindowEthereum();
    jest.clearAllMocks();
  });

  it('should render component', () => {
    renderWithProviders(<MyComponent />);
    
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Updated Text')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    const { useMyData } = require('@/hooks/use-api');
    useMyData.mockReturnValue({
      data: null,
      isLoading: true,
    });

    renderWithProviders(<MyComponent />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle errors', () => {
    const { useMyData } = require('@/hooks/use-api');
    useMyData.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Test error'),
    });

    renderWithProviders(<MyComponent />);
    
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});

