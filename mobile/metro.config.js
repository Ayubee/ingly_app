const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Only the shared public configuration folder is outside Expo's project root.
config.watchFolders = [...new Set([...(config.watchFolders || []), path.resolve(__dirname,'../shared')])];
module.exports = config;
