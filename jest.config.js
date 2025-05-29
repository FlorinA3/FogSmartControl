module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/*.test.js'],  // Changed to match top-level tests only
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
}
