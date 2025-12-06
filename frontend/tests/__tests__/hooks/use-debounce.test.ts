/**
 * Tests for useDebounce hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from '@/hooks/use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300));
    expect(result.current).toBe('test');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now value should be updated
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should reset timer on rapid value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'a', delay: 300 },
      }
    );

    // Rapidly change values
    rerender({ value: 'b', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'c', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    rerender({ value: 'd', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Value should still be 'a' (not updated yet)
    expect(result.current).toBe('a');

    // Fast-forward remaining time
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Now value should be 'd' (last value)
    await waitFor(() => {
      expect(result.current).toBe('d');
    });
  });

  it('should use default delay of 300ms', () => {
    const { result } = renderHook(() => useDebounce('test'));
    expect(result.current).toBe('test');
  });

  it('should handle different delay values', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    // Fast-forward less than delay
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe('initial');

    // Fast-forward remaining time
    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });
});


