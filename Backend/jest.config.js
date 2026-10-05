/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  // Must run before any test file imports src/config/env.ts, so DB_NAME is
  // already forced onto the isolated test database by the time env.ts loads
  // .env - see tests/jest.setup-env.js.
  setupFiles: ['<rootDir>/tests/jest.setup-env.js'],
};
