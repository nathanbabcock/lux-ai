module.exports = {
  roots: [
    '<rootDir>'
  ],
  testMatch: [
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/replays/',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
}
