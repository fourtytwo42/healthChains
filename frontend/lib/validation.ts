/**
 * Validation Utilities
 * 
 * Provides input validation schemas and utilities using Zod
 */

import { z } from 'zod';

/**
 * Ethereum address validation schema
 */
export const ethereumAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform((val) => val.toLowerCase());

/**
 * Search query validation schema
 */
export const searchQuerySchema = z.object({
  query: z.string().max(100).trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Patient search validation schema
 */
export const patientSearchSchema = z.object({
  query: z.string().max(100).trim(),
});

/**
 * Date validation schema
 */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .or(z.date());

/**
 * Consent request validation schema
 */
export const consentRequestSchema = z.object({
  providers: z.array(ethereumAddressSchema).min(1, 'At least one provider is required'),
  dataTypes: z.array(z.string()).min(1, 'At least one data type is required'),
  purposes: z.array(z.string()).min(1, 'At least one purpose is required'),
  expirationTime: z.number().positive().optional(),
});

/**
 * Access request validation schema
 */
export const accessRequestSchema = z.object({
  patientAddress: ethereumAddressSchema,
  dataTypes: z.array(z.string()).min(1, 'At least one data type is required'),
  purposes: z.array(z.string()).min(1, 'At least one purpose is required'),
  expirationTime: z.number().positive().optional(),
});

/**
 * Validates an Ethereum address
 */
export function validateEthereumAddress(address: string): boolean {
  try {
    ethereumAddressSchema.parse(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a search query
 */
export function validateSearchQuery(input: unknown): z.infer<typeof searchQuerySchema> {
  return searchQuerySchema.parse(input);
}

/**
 * Validates a consent request
 */
export function validateConsentRequest(input: unknown): z.infer<typeof consentRequestSchema> {
  return consentRequestSchema.parse(input);
}

/**
 * Validates an access request
 */
export function validateAccessRequest(input: unknown): z.infer<typeof accessRequestSchema> {
  return accessRequestSchema.parse(input);
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .slice(0, 1000); // Limit length
}


