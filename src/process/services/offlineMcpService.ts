/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline MCP Service - Manages offline MCP servers bundled with the application
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import type {
  OfflineMcpServerConfig,
  McpServerRuntimeState,
  OfflineMcpTool,
  McpBundleInfo,

  OfflineMcpServerType} from '@/common/types/offlineMcp';
import {
  DEFAULT_OFFLINE_MCP_SERVERS,
  DEFAULT_OFFLINE_MCP_BUNDLES,
  McpBundleStatus,
} from '@/common/types/offlineMcp';
import { ConfigStorage } from '@/common/config/storage';

export interface OfflineMcpServiceEvents {
  'bundle-downloading': { serverId: string; type: OfflineMcpServerType };
  'bundle-ready': { serverId: string; type: OfflineMcpServerType };
  'bundle-error': { serverId: string; error: string };
  'server-started': { serverId: string; port: number };
  'server-stopped': { serverId: string };
  'server-error': { serverId: string; error: string };
  'tools-discovered': { serverId: string; tools: OfflineMcpTool[] };
}

declare interface OfflineMcpService {
  on<U extends keyof OfflineMcpServiceEvents>(event: U, listener: (data: OfflineMcpServiceEvents[U]) => void): this;
  emit<U extends keyof OfflineMcpServiceEvents>(event: U, data: OfflineMcpServiceEvents[U]): boolean;
}

class OfflineMcpService extends EventEmitter {
  private configs: Map<string, OfflineMcpServerConfig> = new Map();
  private states: Map<string, McpServerRuntimeState> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private bundlePaths: Map<string, string> = new Map();
  private readonly bundledDir: string;

  constructor() {
    super();
    this.bundledDir = path.join(process.cwd(), 'bundled', 'mcp-servers');
    this.loadConfigs();
  }

  /**
   * Load server configurations
   */
  private async loadConfigs(): Promise<void> {
    try {
      const stored = await ConfigStorage.get('offlineMcp.servers');
      if (stored && Array.isArray(stored)) {
        for (const config of stored as OfflineMcpServerConfig[]) {
          this.configs.set(config.id, config);
          this.states.set(config.id, {
            id: config.id,
            status: config.installStatus,
            toolsAvailable: [],
          });
        }
      } else {
        // Initialize with defaults
        for (const config of DEFAULT_OFFLINE_MCP_SERVERS) {
          this.configs.set(config.id, { ...config });
          this.states.set(config.id, {
            id: config.id,
            status: config.installStatus,
            toolsAvailable: [],
          });
        }
        await this.saveConfigs();
      }
    } catch (error) {
      console.error('Failed to load offline MCP configs:', error);
      // Fallback to defaults
      for (const config of DEFAULT_OFFLINE_MCP_SERVERS) {
        this.configs.set(config.id, { ...config });
      }
    }
  }

  /**
   * Save server configurations
   */
  private async saveConfigs(): Promise<void> {
    const configs = Array.from(this.configs.values());
    try {
      await ConfigStorage.set('offlineMcp.servers', configs);
    } catch (error) {
      console.error('Failed to save offline MCP configs:', error);
    }
  }

  /**
   * Get all server configs
   */
  getAllConfigs(): OfflineMcpServerConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get server config
   */
  getConfig(serverId: string): OfflineMcpServerConfig | undefined {
    return this.configs.get(serverId);
  }

  /**
   * Get server runtime state
   */
  getState(serverId: string): McpServerRuntimeState | undefined {
    return this.states.get(serverId);
  }

  /**
   * Get all runtime states
   */
  getAllStates(): McpServerRuntimeState[] {
    return Array.from(this.states.values());
  }

  /**
   * Update server config
   */
  async updateConfig(
    serverId: string,
    updates: Partial<OfflineMcpServerConfig>
  ): Promise<OfflineMcpServerConfig | undefined> {
    const config = this.configs.get(serverId);
    if (!config) return undefined;

    const updated = { ...config, ...updates };
    this.configs.set(serverId, updated);
    await this.saveConfigs();
    return updated;
  }

  /**
   * Get bundle info for a server type
   */
  getBundleInfo(type: OfflineMcpServerType): McpBundleInfo | undefined {
    return DEFAULT_OFFLINE_MCP_BUNDLES.find((b) => b.type === type);
  }

  /**
   * Ensure bundle is downloaded and ready
   */
  async ensureBundle(serverId: string): Promise<boolean> {
    const config = this.configs.get(serverId);
    if (!config) return false;

    const currentState = this.states.get(serverId);
    if (currentState?.status === McpBundleStatus.READY || currentState?.status === McpBundleStatus.RUNNING) {
      return true;
    }

    this.updateState(serverId, { status: McpBundleStatus.DOWNLOADING });
    this.emit('bundle-downloading', { serverId, type: config.type });

    try {
      // Create bundled directory if not exists
      await fs.mkdir(this.bundledDir, { recursive: true });

      const bundleInfo = this.getBundleInfo(config.type);
      if (!bundleInfo) {
        throw new Error(`No bundle info for type: ${config.type}`);
      }

      const bundlePath = path.join(this.bundledDir, config.type);
      this.bundlePaths.set(serverId, bundlePath);

      // Check if already downloaded
      try {
        await fs.access(path.join(bundlePath, 'package.json'));
        this.updateState(serverId, { status: McpBundleStatus.READY });
        this.emit('bundle-ready', { serverId, type: config.type });
        return true;
      } catch {
        // Not downloaded yet, proceed with download
      }

      // Download via npx
      await this.downloadBundle(config, bundleInfo, bundlePath);

      this.updateState(serverId, { status: McpBundleStatus.READY });
      await this.updateConfig(serverId, { installStatus: McpBundleStatus.READY, bundlePath });
      this.emit('bundle-ready', { serverId, type: config.type });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateState(serverId, { status: McpBundleStatus.ERROR, error: errorMsg });
      await this.updateConfig(serverId, { installStatus: McpBundleStatus.ERROR, installError: errorMsg });
      this.emit('bundle-error', { serverId, error: errorMsg });
      return false;
    }
  }

  /**
   * Download bundle using npx
   */
  private async downloadBundle(
    config: OfflineMcpServerConfig,
    bundleInfo: McpBundleInfo,
    bundlePath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use npx to download and install the package
      const installProcess = spawn('npm', ['install', '--prefix', bundlePath, bundleInfo.npxPackage], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let output = '';
      let errorOutput = '';

      installProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      installProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      installProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to download bundle: ${errorOutput || output}`));
        }
      });

      installProcess.on('error', (error) => {
        reject(error);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        installProcess.kill();
        reject(new Error('Bundle download timeout'));
      }, 300000);
    });
  }

  /**
   * Start an MCP server
   */
  async startServer(serverId: string): Promise<boolean> {
    const config = this.configs.get(serverId);
    const state = this.states.get(serverId);

    if (!config || !state) return false;

    if (state.status === McpBundleStatus.RUNNING) {
      return true;
    }

    // Ensure bundle is ready
    if (state.status !== McpBundleStatus.READY) {
      const ready = await this.ensureBundle(serverId);
      if (!ready) return false;
    }

    this.updateState(serverId, { status: McpBundleStatus.RUNNING });

    try {
      const port = config.port || this.getBundleInfo(config.type)?.defaultPort || 3000;
      const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        ...config.env,
        ...this.getBundleInfo(config.type)?.envVars,
        PORT: String(port),
      };

      let processCmd: string;
      let processArgs: string[];

      if (config.command && config.args) {
        processCmd = config.command;
        processArgs = [...config.args];
      } else {
        // Default: use npx
        processCmd = 'npx';
        processArgs = ['-y', config.npxPackage || this.getBundleInfo(config.type)?.npxPackage || ''];
      }

      const serverProcess = spawn(processCmd, processArgs, {
        detached: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      this.processes.set(serverId, serverProcess);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MCP server start timeout'));
        }, 30000);

        serverProcess.stdout?.on('data', (data: Buffer) => {
          const message = data.toString();
          console.log(`[MCP ${serverId}] ${message}`);

          // Check for ready message
          if (message.includes('Server running') || message.includes('MCP server') || message.includes('port')) {
            clearTimeout(timeout);
            this.updateState(serverId, {
              status: McpBundleStatus.RUNNING,
              pid: serverProcess.pid,
              port,
              startedAt: Date.now(),
            });
            this.emit('server-started', { serverId, port });
            resolve(true);
          }
        });

        serverProcess.stderr?.on('data', (data: Buffer) => {
          console.error(`[MCP ${serverId} error] ${data}`);
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        serverProcess.on('exit', (code) => {
          if (code !== 0) {
            clearTimeout(timeout);
            reject(new Error(`MCP server exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateState(serverId, {
        status: McpBundleStatus.ERROR,
        error: errorMsg,
      });
      this.emit('server-error', { serverId, error: errorMsg });
      return false;
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<boolean> {
    const process = this.processes.get(serverId);
    const state = this.states.get(serverId);

    if (!state) return false;

    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(serverId);
    }

    this.updateState(serverId, {
      status: McpBundleStatus.STOPPED,
    });

    this.emit('server-stopped', { serverId });
    return true;
  }

  /**
   * Restart an MCP server
   */
  async restartServer(serverId: string): Promise<boolean> {
    await this.stopServer(serverId);
    // Small delay to ensure clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.startServer(serverId);
  }

  /**
   * Get tools from a running MCP server
   */
  async discoverTools(serverId: string): Promise<OfflineMcpTool[]> {
    const config = this.configs.get(serverId);
    const state = this.states.get(serverId);

    if (!config || !state || state.status !== McpBundleStatus.RUNNING) {
      return [];
    }

    // TODO: Implement actual MCP tools/discover endpoint call
    // For now, return placeholder based on server type
    const tools: OfflineMcpTool[] = [];

    switch (config.type) {
      case 'browser':
        tools.push(
          {
            name: 'navigate',
            description: 'Navigate to a URL',
            inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
            serverId,
            serverName: config.name,
          },
          {
            name: 'click',
            description: 'Click on an element',
            inputSchema: { type: 'object', properties: { selector: { type: 'string' } } },
            serverId,
            serverName: config.name,
          },
          {
            name: 'type',
            description: 'Type text into an input',
            inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } } },
            serverId,
            serverName: config.name,
          },
          {
            name: 'screenshot',
            description: 'Take a screenshot',
            inputSchema: { type: 'object' },
            serverId,
            serverName: config.name,
          }
        );
        break;
      case 'filesystem':
        tools.push(
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
            serverId,
            serverName: config.name,
          },
          {
            name: 'write_file',
            description: 'Write to a file',
            inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
            serverId,
            serverName: config.name,
          },
          {
            name: 'list_directory',
            description: 'List directory contents',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
            serverId,
            serverName: config.name,
          }
        );
        break;
      case 'git':
        tools.push(
          {
            name: 'git_status',
            description: 'Get git status',
            inputSchema: { type: 'object', properties: { repo_path: { type: 'string' } } },
            serverId,
            serverName: config.name,
          },
          {
            name: 'git_log',
            description: 'Get git log',
            inputSchema: {
              type: 'object',
              properties: { repo_path: { type: 'string' }, max_count: { type: 'number' } },
            },
            serverId,
            serverName: config.name,
          },
          {
            name: 'git_diff',
            description: 'Get git diff',
            inputSchema: { type: 'object', properties: { repo_path: { type: 'string' } } },
            serverId,
            serverName: config.name,
          }
        );
        break;
      // Add more types as needed
    }

    this.updateState(serverId, { toolsAvailable: tools.map((t) => t.name) });
    this.emit('tools-discovered', { serverId, tools });
    return tools;
  }

  /**
   * Start all auto-start servers
   */
  async startAutoStartServers(): Promise<void> {
    const promises: Promise<boolean>[] = [];
    for (const config of this.configs.values()) {
      if (config.autoStart && config.enabled) {
        promises.push(this.startServer(config.id));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Stop all servers
   */
  async stopAll(): Promise<void> {
    const promises: Promise<boolean>[] = [];
    for (const serverId of this.processes.keys()) {
      promises.push(this.stopServer(serverId));
    }
    await Promise.all(promises);
  }

  /**
   * Update server state
   */
  private updateState(serverId: string, updates: Partial<McpServerRuntimeState>): void {
    const state = this.states.get(serverId);
    if (state) {
      this.states.set(serverId, { ...state, ...updates });
    }
  }
}

// Export singleton instance
export const offlineMcpService = new OfflineMcpService();
