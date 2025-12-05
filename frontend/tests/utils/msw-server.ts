/**
 * MSW Server Setup
 * 
 * Sets up Mock Service Worker for API mocking in tests
 */

import { setupServer } from 'msw/node';
import { handlers } from './mock-api';

// This configures a request mocking server with the given request handlers
export const server = setupServer(...handlers);

