// Learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');
require('whatwg-fetch');
const { TextEncoder, TextDecoder } = require('util');
const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill/dist/ponyfill.js');

const assignTextEncodingPolyfills = () => {
  if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder;
  }
  if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = TextDecoder;
  }
  if (typeof globalThis.TransformStream === 'undefined' && typeof TransformStream !== 'undefined') {
    globalThis.TransformStream = TransformStream;
  }
  if (typeof globalThis.ReadableStream === 'undefined' && typeof ReadableStream !== 'undefined') {
    globalThis.ReadableStream = ReadableStream;
  }
  if (typeof globalThis.WritableStream === 'undefined' && typeof WritableStream !== 'undefined') {
    globalThis.WritableStream = WritableStream;
  }
  if (typeof globalThis.BroadcastChannel === 'undefined') {
    class BroadcastChannelMock {
      constructor() {}
      postMessage() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
    globalThis.BroadcastChannel = BroadcastChannelMock;
  }
  if (typeof window !== 'undefined') {
    if (typeof window.TextEncoder === 'undefined') {
      window.TextEncoder = TextEncoder;
    }
    if (typeof window.TextDecoder === 'undefined') {
      window.TextDecoder = TextDecoder;
    }
    if (typeof window.TransformStream === 'undefined' && typeof TransformStream !== 'undefined') {
      window.TransformStream = TransformStream;
    }
    if (typeof window.ReadableStream === 'undefined' && typeof ReadableStream !== 'undefined') {
      window.ReadableStream = ReadableStream;
    }
    if (typeof window.WritableStream === 'undefined' && typeof WritableStream !== 'undefined') {
      window.WritableStream = WritableStream;
    }
    if (typeof window.BroadcastChannel === 'undefined') {
      window.BroadcastChannel = globalThis.BroadcastChannel;
    }
  }
};

assignTextEncodingPolyfills();

const fetchMock = jest.fn();

Object.defineProperty(globalThis, 'fetch', {
  writable: true,
  configurable: true,
  value: fetchMock,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'fetch', {
    writable: true,
    configurable: true,
    value: fetchMock,
  });
}

// Setup MSW server
const { server } = require('./tests/utils/msw-server');

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

