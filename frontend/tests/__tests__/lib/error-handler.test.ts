/**
 * Tests for error handler utility
 */

import { handleError, handleTransactionError, handleApiError, getUserFriendlyMessage, ErrorCode } from '@/lib/error-handler';
import { toast } from 'sonner';

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('error-handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for user rejected error', () => {
      const error = new Error('User rejected');
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Transaction was cancelled');
    });

    it('should return user-friendly message for insufficient funds', () => {
      const error = new Error('insufficient funds');
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Insufficient funds for transaction');
    });

    it('should return user-friendly message for network error', () => {
      const error = new Error('network error');
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Network error. Please check your connection and try again.');
    });

    it('should return user-friendly message for timeout', () => {
      const error = new Error('timeout');
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Request timed out. Please try again.');
    });

    it('should return default message for unknown error', () => {
      const error = new Error('Unknown error');
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('An error occurred. Please try again.');
    });

    it('should handle error codes', () => {
      const error = new Error('Network error');
      (error as any).code = ErrorCode.NETWORK_ERROR;
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Network error. Please check your connection and try again.');
    });
  });

  describe('handleError', () => {
    it('should show toast notification by default', () => {
      const error = new Error('Test error');
      handleError(error);
      expect(toast.error).toHaveBeenCalledWith('Error', {
        description: 'An error occurred. Please try again.',
      });
    });

    it('should not show toast if showToast is false', () => {
      const error = new Error('Test error');
      handleError(error, { showToast: false });
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should use custom toast title', () => {
      const error = new Error('Test error');
      handleError(error, { toastTitle: 'Custom Title' });
      expect(toast.error).toHaveBeenCalledWith('Custom Title', {
        description: 'An error occurred. Please try again.',
      });
    });

    it('should return AppError object', () => {
      const error = new Error('Test error');
      const result = handleError(error, { showToast: false });
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('userMessage');
    });
  });

  describe('handleTransactionError', () => {
    it('should not show toast for user rejections', () => {
      const error = new Error('User rejected');
      const result = handleTransactionError(error);
      expect(result.code).toBe(ErrorCode.TRANSACTION_REJECTED);
      expect(result.userMessage).toBe('Transaction was cancelled');
      // User rejections are intentional, so no toast
    });

    it('should show toast for other transaction errors', () => {
      const error = new Error('Transaction failed');
      handleTransactionError(error);
      expect(toast.error).toHaveBeenCalledWith('Transaction Failed', {
        description: expect.any(String),
      });
    });
  });

  describe('handleApiError', () => {
    it('should handle 401 status code', () => {
      const error = new Error('Unauthorized');
      handleApiError(error, 401);
      expect(toast.error).toHaveBeenCalledWith('Authentication Required', {
        description: expect.any(String),
      });
    });

    it('should handle 403 status code', () => {
      const error = new Error('Forbidden');
      handleApiError(error, 403);
      expect(toast.error).toHaveBeenCalledWith('Access Denied', {
        description: expect.any(String),
      });
    });

    it('should handle 404 status code', () => {
      const error = new Error('Not Found');
      handleApiError(error, 404);
      expect(toast.error).toHaveBeenCalledWith('Not Found', {
        description: expect.any(String),
      });
    });

    it('should handle 500 status code', () => {
      const error = new Error('Server Error');
      handleApiError(error, 500);
      expect(toast.error).toHaveBeenCalledWith('Server Error', {
        description: expect.any(String),
      });
    });

    it('should handle unknown status codes', () => {
      const error = new Error('Unknown error');
      handleApiError(error, 999);
      expect(toast.error).toHaveBeenCalledWith('Request Failed', {
        description: expect.any(String),
      });
    });
  });
});

