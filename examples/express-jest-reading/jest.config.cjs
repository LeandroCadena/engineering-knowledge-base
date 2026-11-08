module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/**/*.test.js'],
  transform: {},
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['<rootDir>/dist/{app,orders,async-utils}.js'],
};
