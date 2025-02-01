const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const {
    wrapWithReanimatedMetroConfig,
  } = require('react-native-reanimated/metro-config');

  
const path = require('path');

// Define additional node module lookup directories
const extraNodeModules = {
  'react-native-pdfium': path.resolve(__dirname, '../react-native-pdfium'),
};

// Watch additional folders to ensure they are included in Metro bundling
const watchFolders = [path.resolve(__dirname, '../react-native-pdfium')];

const customConfig = {
  resolver: {
    extraNodeModules,
  },
  watchFolders,
};

module.exports = wrapWithReanimatedMetroConfig(mergeConfig(getDefaultConfig(__dirname), customConfig));