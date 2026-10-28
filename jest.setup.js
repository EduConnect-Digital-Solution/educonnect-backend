// Jest setup file
// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
// 32 byte, base64 encoded - required by src/config/index.js
process.env.SECRETS_ENC_KEY = Buffer.alloc(32, 7).toString('base64');

// Puppeteer ships as ES modules, which Jest cannot parse, and unit tests must
// never launch a real browser. Any suite that loads src/app.js reaches it
// through pdfRenderer, so stub it for every test.
jest.mock('puppeteer', () => ({ launch: jest.fn() }));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};