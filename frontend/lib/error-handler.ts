/**
 * Centralized Error Handler
 * 
 * Provides user-friendly error messages and error handling utilities
 */

import { toast } from 'sonner';

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  details?: unknown;
}

/**
 * Error codes for different error types
 */
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TRANSACTION_REJECTED = 'TRANSACTION_REJECTED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Maps error messages to user-friendly messages
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'User rejected': 'Transaction was cancelled',
  'user rejected': 'Transaction was cancelled',
  'User denied': 'Transaction was denied',
  'insufficient funds': 'Insufficient funds for transaction',
  'Insufficient funds': 'Insufficient funds for transaction',
  'network error': 'Network error. Please check your connection and try again.',
  'Network error': 'Network error. Please check your connection and try again.',
  'timeout': 'Request timed out. Please try again.',
  'Timeout': 'Request timed out. Please try again.',
  'authentication required': 'Please sign in to continue',
  'Authentication required': 'Please sign in to continue',
  'unauthorized': 'You do not have permission to perform this action',
  'Unauthorized': 'You do not have permission to perform this action',
  'not found': 'The requested resource was not found',
  'Not found': 'The requested resource was not found',
  'ExpirationInPast': 'Expiration date must be in the future',
  'expiration': 'Expiration date must be in the future',
  'EmptyBatch': 'Invalid selection. Please ensure all fields are properly selected.',
  'Empty': 'Invalid selection. Please ensure all fields are properly selected.',
  'InvalidAddress': 'Invalid address. Please select a valid address.',
  'address': 'Invalid address. Please select a valid address.',
  'CannotGrantConsentToSelf': 'Cannot grant consent to yourself.',
  'require(false)': 'Transaction failed validation. Please check your selections and try again.',
};

/**
 * Converts an error to a user-friendly message
 */
export function getUserFriendlyMessage(error: Error | string | unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for exact matches first
  for (const [key, message] of Object.entries(ERROR_MESSAGE_MAP)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }
  
  // Check for error codes
  if (error instanceof Error && (error as any).code) {
    const code = (error as any).code;
    switch (code) {
      case ErrorCode.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.';
      case ErrorCode.AUTHENTICATION_REQUIRED:
        return 'Please sign in to continue';
      case ErrorCode.UNAUTHORIZED:
        return 'You do not have permission to perform this action';
      case ErrorCode.NOT_FOUND:
        return 'The requested resource was not found';
      case ErrorCode.TRANSACTION_REJECTED:
        return 'Transaction was cancelled';
      case ErrorCode.INSUFFICIENT_FUNDS:
        return 'Insufficient funds for transaction';
      case ErrorCode.TIMEOUT:
        return 'Request timed out. Please try again.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
  
  // Default message
  return 'An error occurred. Please try again.';
}

/**
 * Handles errors and shows appropriate toast notification
 */
export function handleError(
  error: Error | string | unknown,
  options?: {
    showToast?: boolean;
    toastTitle?: string;
    logError?: boolean;
  }
): AppError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const userMessage = getUserFriendlyMessage(error);
  
  const appError: AppError = {
    code: error instanceof Error && (error as any).code 
      ? (error as any).code 
      : ErrorCode.UNKNOWN_ERROR,
    message: errorMessage,
    userMessage,
    details: error instanceof Error ? error.stack : undefined,
  };
  
  // Log error in development
  if (options?.logError !== false && process.env.NODE_ENV === 'development') {
    console.error('[ErrorHandler]', appError);
  }
  
  // Show toast notification
  if (options?.showToast !== false) {
    const title = options?.toastTitle || 'Error';
    toast.error(title, {
      description: userMessage,
    });
  }
  
  return appError;
}

/**
 * Handles transaction-specific errors
 */
export function handleTransactionError(error: Error | string | unknown): AppError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Don't show toast for user rejections (they're intentional)
  if (errorMessage.toLowerCase().includes('user rejected') || 
      errorMessage.toLowerCase().includes('user denied')) {
    return {
      code: ErrorCode.TRANSACTION_REJECTED,
      message: errorMessage,
      userMessage: 'Transaction was cancelled',
    };
  }
  
  return handleError(error, {
    toastTitle: 'Transaction Failed',
  });
}

/**
 * Handles API errors
 */
export function handleApiError(
  error: Error | string | unknown,
  statusCode?: number
): AppError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Map HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return handleError(error, {
          toastTitle: 'Authentication Required',
          showToast: true,
        });
      case 403:
        return handleError(error, {
          toastTitle: 'Access Denied',
          showToast: true,
        });
      case 404:
        return handleError(error, {
          toastTitle: 'Not Found',
          showToast: true,
        });
      case 429:
        return handleError(error, {
          toastTitle: 'Too Many Requests',
          showToast: true,
        });
      case 500:
      case 502:
      case 503:
        return handleError(error, {
          toastTitle: 'Server Error',
          showToast: true,
        });
    }
  }
  
  return handleError(error, {
    toastTitle: 'Request Failed',
  });
}


