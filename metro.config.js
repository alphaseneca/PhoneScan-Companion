const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, 'packages/react-native-phonescan');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [libraryRoot],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
