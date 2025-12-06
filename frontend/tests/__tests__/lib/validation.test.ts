/**
 * Tests for validation utilities
 */

import {
  validateEthereumAddress,
  validateSearchQuery,
  validateConsentRequest,
  validateAccessRequest,
  sanitizeInput,
  ethereumAddressSchema,
  searchQuerySchema,
} from '@/lib/validation';
import { z } from 'zod';

describe('validation', () => {
  describe('validateEthereumAddress', () => {
    it('should validate correct Ethereum address', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      expect(validateEthereumAddress(address)).toBe(true);
    });

    it('should reject invalid Ethereum address', () => {
      expect(validateEthereumAddress('invalid')).toBe(false);
      expect(validateEthereumAddress('0x123')).toBe(false);
      expect(validateEthereumAddress('')).toBe(false);
    });

    it('should handle case-insensitive addresses', () => {
      const address = '0x742D35CC6634C0532925A3B844BC9E7595F0BEB0';
      expect(validateEthereumAddress(address)).toBe(true);
    });
  });

  describe('validateSearchQuery', () => {
    it('should validate correct search query', () => {
      const query = { query: 'test search' };
      expect(() => validateSearchQuery(query)).not.toThrow();
    });

    it('should validate search query with date', () => {
      const query = { query: 'test', date: '2024-01-01' };
      expect(() => validateSearchQuery(query)).not.toThrow();
    });

    it('should reject invalid date format', () => {
      const query = { query: 'test', date: '01/01/2024' };
      expect(() => validateSearchQuery(query)).toThrow();
    });

    it('should reject query that is too long', () => {
      const query = { query: 'a'.repeat(101) };
      expect(() => validateSearchQuery(query)).toThrow();
    });
  });

  describe('validateConsentRequest', () => {
    it('should validate correct consent request', () => {
      const request = {
        providers: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'],
        dataTypes: ['medical_records'],
        purposes: ['treatment'],
      };
      expect(() => validateConsentRequest(request)).not.toThrow();
    });

    it('should reject request without providers', () => {
      const request = {
        providers: [],
        dataTypes: ['medical_records'],
        purposes: ['treatment'],
      };
      expect(() => validateConsentRequest(request)).toThrow();
    });

    it('should reject request without data types', () => {
      const request = {
        providers: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'],
        dataTypes: [],
        purposes: ['treatment'],
      };
      expect(() => validateConsentRequest(request)).toThrow();
    });

    it('should reject request without purposes', () => {
      const request = {
        providers: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'],
        dataTypes: ['medical_records'],
        purposes: [],
      };
      expect(() => validateConsentRequest(request)).toThrow();
    });
  });

  describe('validateAccessRequest', () => {
    it('should validate correct access request', () => {
      const request = {
        patientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        dataTypes: ['medical_records'],
        purposes: ['treatment'],
      };
      expect(() => validateAccessRequest(request)).not.toThrow();
    });

    it('should reject request with invalid address', () => {
      const request = {
        patientAddress: 'invalid',
        dataTypes: ['medical_records'],
        purposes: ['treatment'],
      };
      expect(() => validateAccessRequest(request)).toThrow();
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should trim whitespace', () => {
      const input = '  test  ';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('test');
    });

    it('should limit length to 1000 characters', () => {
      const input = 'a'.repeat(2000);
      const sanitized = sanitizeInput(input);
      expect(sanitized.length).toBe(1000);
    });

    it('should handle empty string', () => {
      const input = '';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('');
    });
  });

  describe('ethereumAddressSchema', () => {
    it('should parse and transform valid address', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      const result = ethereumAddressSchema.parse(address);
      expect(result).toBe(address.toLowerCase());
    });

    it('should reject invalid address', () => {
      expect(() => ethereumAddressSchema.parse('invalid')).toThrow();
    });
  });

  describe('searchQuerySchema', () => {
    it('should parse valid search query', () => {
      const query = { query: 'test', date: '2024-01-01' };
      expect(() => searchQuerySchema.parse(query)).not.toThrow();
    });

    it('should handle optional fields', () => {
      const query = { query: 'test' };
      expect(() => searchQuerySchema.parse(query)).not.toThrow();
    });
  });
});

