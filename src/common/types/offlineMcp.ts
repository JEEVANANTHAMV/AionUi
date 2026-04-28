/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline MCP Types - For managing offline MCP servers
 */

/**
 * Offline MCP server type
 */
export enum OfflineMcpServerType {
  BROWSER = 'browser',
  FILESYSTEM = 'filesystem',
  GIT = 'git',
  GITHUB = 'github',
  SQL = 'sql',
  FETCH = 'fetch',
  BRAVE_SEARCH = 'brave_search',
  MEMORY = 'memory',
  PUPPETEER = 'puppeteer',
  PLAYWRIGHT = 'playwright',
  CUSTOM = 'custom',
}

/**
 * MCP bundle status
 */
export enum McpBundleStatus {
  NOT_INSTALLED = 'not_installed',
  DOWNLOADING = 'downloading',
  INSTALLING = 'installing',
  READY = 'ready',
  ERROR = 'error',
  RUNNING = 'running',
  STOPPED = 'stopped',
}

/**
 * Offline MCP server configuration
 */
export interface OfflineMcpServerConfig {
  id: string;
  name: string;
  type: OfflineMcpServerType;
  description: string;
  enabled: boolean;
  autoStart: boolean;
  port?: number;
  /** Path to bundled MCP package */
  bundlePath?: string;
  /** npx package name for download */
  npxPackage?: string;
  /** Command to run the MCP server */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  options?: Record<string, unknown>;
  /** Installation status */
  installStatus: McpBundleStatus;
  /** Error message if installation failed */
  installError?: string;
}

/**
 * MCP bundle info
 */
export interface McpBundleInfo {
  type: OfflineMcpServerType;
  name: string;
  description: string;
  npxPackage: string;
  defaultPort: number;
  requiredFiles: string[];
  envVars?: Record<string, string>;
}

/**
 * Default offline MCP bundles configuration
 * These are downloaded via npx on first use and run locally
 */
export const DEFAULT_OFFLINE_MCP_BUNDLES: McpBundleInfo[] = [
  {
    type: OfflineMcpServerType.BROWSER,
    name: 'Browser MCP',
    description: 'Browser automation via MCP protocol using agent-browser-protocol',
    npxPackage: 'agent-browser-protocol',
    defaultPort: 8222,
    requiredFiles: ['dist/index.js', 'package.json'],
    envVars: {
      PORT: '8222',
    },
  },
  {
    type: OfflineMcpServerType.FILESYSTEM,
    name: 'Filesystem MCP',
    description: 'File system operations via MCP',
    npxPackage: '@modelcontextprotocol/server-filesystem',
    defaultPort: 3000,
    requiredFiles: ['dist/index.js', 'package.json'],
  },
  {
    type: OfflineMcpServerType.GIT,
    name: 'Git MCP',
    description: 'Git operations via MCP',
    npxPackage: '@modelcontextprotocol/server-git',
    defaultPort: 3001,
    requiredFiles: ['dist/index.js', 'package.json'],
  },
  {
    type: OfflineMcpServerType.GITHUB,
    name: 'GitHub MCP',
    description: 'GitHub API operations via MCP',
    npxPackage: '@modelcontextprotocol/server-github',
    defaultPort: 3002,
    requiredFiles: ['dist/index.js', 'package.json'],
    envVars: {
      GITHUB_PERSONAL_ACCESS_TOKEN: '',
    },
  },
  {
    type: OfflineMcpServerType.SQL,
    name: 'SQLite MCP',
    description: 'SQLite database operations via MCP',
    npxPackage: '@modelcontextprotocol/server-sqlite',
    defaultPort: 3003,
    requiredFiles: ['dist/index.js', 'package.json'],
  },
  {
    type: OfflineMcpServerType.FETCH,
    name: 'Fetch MCP',
    description: 'HTTP fetch operations via MCP',
    npxPackage: '@modelcontextprotocol/server-fetch',
    defaultPort: 3004,
    requiredFiles: ['dist/index.js', 'package.json'],
  },
  {
    type: OfflineMcpServerType.BRAVE_SEARCH,
    name: 'Brave Search MCP',
    description: 'Web search via Brave Search API',
    npxPackage: '@modelcontextprotocol/server-brave-search',
    defaultPort: 3005,
    requiredFiles: ['dist/index.js', 'package.json'],
    envVars: {
      BRAVE_API_KEY: '',
    },
  },
  {
    type: OfflineMcpServerType.MEMORY,
    name: 'Memory MCP',
    description: 'Knowledge graph memory server',
    npxPackage: '@modelcontextprotocol/server-memory',
    defaultPort: 3006,
    requiredFiles: ['dist/index.js', 'package.json'],
  },
  {
    type: OfflineMcpServerType.PUPPETEER,
    name: 'Puppeteer MCP',
    description: 'Browser automation via Puppeteer',
    npxPackage: '@modelcontextprotocol/server-puppeteer',
    defaultPort: 3007,
    requiredFiles: ['dist/index.js', 'package.json'],
  },
];

/**
 * Default offline MCP servers configuration
 */
export const DEFAULT_OFFLINE_MCP_SERVERS: OfflineMcpServerConfig[] = [
  {
    id: 'offline-browser-mcp',
    name: 'Browser MCP',
    type: OfflineMcpServerType.BROWSER,
    description: 'Browser automation via MCP protocol',
    enabled: false,
    autoStart: false,
    port: 8222,
    npxPackage: 'agent-browser-protocol',
    command: 'npx',
    args: ['-y', 'agent-browser-protocol'],
    installStatus: McpBundleStatus.NOT_INSTALLED,
  },
  {
    id: 'offline-filesystem-mcp',
    name: 'Filesystem MCP',
    type: OfflineMcpServerType.FILESYSTEM,
    description: 'File system operations via MCP',
    enabled: false,
    autoStart: false,
    port: 3000,
    npxPackage: '@modelcontextprotocol/server-filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    installStatus: McpBundleStatus.NOT_INSTALLED,
  },
  {
    id: 'offline-git-mcp',
    name: 'Git MCP',
    type: OfflineMcpServerType.GIT,
    description: 'Git operations via MCP',
    enabled: false,
    autoStart: false,
    port: 3001,
    npxPackage: '@modelcontextprotocol/server-git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
    installStatus: McpBundleStatus.NOT_INSTALLED,
  },
  {
    id: 'offline-fetch-mcp',
    name: 'Fetch MCP',
    type: OfflineMcpServerType.FETCH,
    description: 'HTTP fetch operations via MCP',
    enabled: false,
    autoStart: false,
    port: 3004,
    npxPackage: '@modelcontextprotocol/server-fetch',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    installStatus: McpBundleStatus.NOT_INSTALLED,
  },
  {
    id: 'offline-memory-mcp',
    name: 'Memory MCP',
    type: OfflineMcpServerType.MEMORY,
    description: 'Knowledge graph memory server',
    enabled: false,
    autoStart: false,
    port: 3006,
    npxPackage: '@modelcontextprotocol/server-memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    installStatus: McpBundleStatus.NOT_INSTALLED,
  },
];

/**
 * MCP server runtime state
 */
export interface McpServerRuntimeState {
  id: string;
  status: McpBundleStatus;
  pid?: number;
  port?: number;
  startedAt?: number;
  lastActiveAt?: number;
  error?: string;
  toolsAvailable: string[];
}

/**
 * MCP tool definition from offline server
 */
export interface OfflineMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
  serverName: string;
}
