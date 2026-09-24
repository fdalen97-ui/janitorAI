const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This points to the workspace root
const monorepoRoot = path.resolve(projectRoot, '../..');
const workspaceConfigPath = path
  .resolve(monorepoRoot, '.config')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];
// The workspace's browser profile is not source code and contains transient
// paths (for example Chromium/BrowserMetrics) that can disappear while Metro
// is walking the monorepo. Excluding it keeps Expo web startup deterministic.
config.resolver.blockList = [new RegExp(`^${workspaceConfigPath}([/\\\\]|$)`)];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
