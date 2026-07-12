module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: [
    '<rootDir>/__tests__/**/*.{js,ts,tsx}',
    '<rootDir>/packages/**/__tests__/**/*.{js,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/packages/react-native-phonescan/__tests__/helpers/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/packages/react-native-phonescan/lib/'],
  collectCoverageFrom: [
    'packages/react-native-phonescan/src/constants.ts',
    'packages/react-native-phonescan/src/domain/entities/**/*.{ts,tsx}',
    'packages/react-native-phonescan/src/domain/usecases/**/*.{ts,tsx}',
    'packages/react-native-phonescan/src/data/UsbSerialRepository.ts',
    'packages/react-native-phonescan/src/data/FirmwareFlashRepository.ts',
    'src/settings/types.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 55,
      functions: 70,
      lines: 70,
    },
  },
};
