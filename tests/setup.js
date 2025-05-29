import '@testing-library/jest-dom/extend-expect';
import { configure } from '@testing-library/dom';

configure({
  testIdAttribute: 'data-test'
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock service worker
global.workbox = {
  register: jest.fn()
};
