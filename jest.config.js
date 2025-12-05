module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/examples/**',
    '!src/server.js'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '.*\\.fixture\\.js$'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};