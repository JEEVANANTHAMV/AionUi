/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Attached Agents Service - Manages sub-agents (OpenCode, Windows-MCP, Browser-Control)
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import type {
  AttachedAgentConfig,
  AttachedAgentState,
  AttachedAgentTaskRequest,
  AttachedAgentTaskResponse,
  AttachedAgentCapabilities,
  AttachedAgentToolDefinition,
  OpenCodeAgentConfig,
  WindowsMcpAgentConfig,
  BrowserControlAgentConfig,
} from '@/common/types/attachedAgents';
import {
  DEFAULT_ATTACHED_AGENTS,
  ATTACHED_AGENT_METADATA,
  AttachedAgentStatus,
  AttachedAgentType,
} from '@/common/types/attachedAgents';

export interface AttachedAgentServiceEvents {
  'agent-started': { agentId: string; type: AttachedAgentType };
  'agent-stopped': { agentId: string; type: AttachedAgentType };
  'agent-error': { agentId: string; error: string };
  'task-completed': { agentId: string; taskId: string; result: AttachedAgentTaskResponse };
}

declare interface AttachedAgentService {
  on<U extends keyof AttachedAgentServiceEvents>(
    event: U,
    listener: (data: AttachedAgentServiceEvents[U]) => void
  ): this;
  emit<U extends keyof AttachedAgentServiceEvents>(event: U, data: AttachedAgentServiceEvents[U]): boolean;
}

class AttachedAgentService extends EventEmitter {
  private configs: Map<string, AttachedAgentConfig> = new Map();
  private states: Map<string, AttachedAgentState> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private taskPromises: Map<string, (result: AttachedAgentTaskResponse) => void> = new Map();

  constructor() {
    super();
    this.loadDefaultConfigs();
  }

  /**
   * Load default agent configurations
   */
  private loadDefaultConfigs(): void {
    for (const config of DEFAULT_ATTACHED_AGENTS) {
      this.configs.set(config.id, { ...config });
      this.states.set(config.id, {
        id: config.id,
        type: config.type,
        status: AttachedAgentStatus.IDLE,
        taskCount: 0,
      });
    }
  }

  /**
   * Get all agent configurations
   */
  getAllConfigs(): AttachedAgentConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get agent configuration by ID
   */
  getConfig(agentId: string): AttachedAgentConfig | undefined {
    return this.configs.get(agentId);
  }

  /**
   * Get agent state by ID
   */
  getState(agentId: string): AttachedAgentState | undefined {
    return this.states.get(agentId);
  }

  /**
   * Get all agent states
   */
  getAllStates(): AttachedAgentState[] {
    return Array.from(this.states.values());
  }

  /**
   * Update agent configuration
   */
  updateConfig(agentId: string, updates: Partial<AttachedAgentConfig>): AttachedAgentConfig | undefined {
    const config = this.configs.get(agentId);
    if (!config) return undefined;

    const updated = { ...config, ...updates };
    this.configs.set(agentId, updated);
    return updated;
  }

  /**
   * Start an attached agent
   */
  async startAgent(agentId: string): Promise<boolean> {
    const config = this.configs.get(agentId);
    const state = this.states.get(agentId);

    if (!config || !state) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (state.status === AttachedAgentStatus.RUNNING || state.status === AttachedAgentStatus.STARTING) {
      return true;
    }

    this.updateState(agentId, { status: AttachedAgentStatus.STARTING });

    try {
      switch (config.type) {
        case AttachedAgentType.OPENCODE:
          await this.startOpenCodeAgent(agentId, config as OpenCodeAgentConfig);
          break;
        case AttachedAgentType.WINDOWS_MCP:
          await this.startWindowsMcpAgent(agentId, config as WindowsMcpAgentConfig);
          break;
        case AttachedAgentType.BROWSER_CONTROL:
          await this.startBrowserControlAgent(agentId, config as BrowserControlAgentConfig);
          break;
        default:
          throw new Error(`Unknown agent type: ${config.type}`);
      }

      this.updateState(agentId, {
        status: AttachedAgentStatus.RUNNING,
        startedAt: Date.now(),
      });

      this.emit('agent-started', { agentId, type: config.type });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateState(agentId, {
        status: AttachedAgentStatus.ERROR,
        error: errorMsg,
      });
      this.emit('agent-error', { agentId, error: errorMsg });
      return false;
    }
  }

  /**
   * Start OpenCode agent
   */
  private async startOpenCodeAgent(agentId: string, config: OpenCodeAgentConfig): Promise<void> {
    const port = config.port || 4096;
    const endpoint = config.endpoint || `http://localhost:${port}`;

    // Check if OpenCode is already running
    try {
      const response = await fetch(`${endpoint}/global/health`);
      if (response.ok) {
        return;
      }
    } catch (e) {
      // Not reachable, proceed to spawn it
    }

    const executablePath = (config.options?.executablePath as string) || 'opencode';
    const args = ['web'];
    if (config.port) {
      args.push('--port', String(config.port));
    }

    const opencodeProcess = spawn(executablePath, args, {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.processes.set(agentId, opencodeProcess);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OpenCode server start timeout'));
      }, 30000);

      const checkHealth = async () => {
        try {
          const response = await fetch(`${endpoint}/global/health`);
          if (response.ok) {
            clearTimeout(timeout);
            resolve();
            return;
          }
        } catch (error) {
          // Ignore connection errors during startup
        }
        setTimeout(checkHealth, 1000);
      };

      void checkHealth();

      opencodeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      opencodeProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`OpenCode exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Start Windows MCP agent
   */
  private async startWindowsMcpAgent(agentId: string, config: WindowsMcpAgentConfig): Promise<void> {
    const port = config.port || 3001;
    const bundlePath = config.bundlePath || './bundled/windows-mcp';

    // Start Windows MCP server using npx or bundled version
    const mcpProcess = spawn('npx', ['-y', '@modelcontextprotocol/server-windows', '--port', String(port)], {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...config.env,
        WINDOWS_MCP_PORT: String(port),
      },
    });

    this.processes.set(agentId, mcpProcess);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Windows MCP agent start timeout'));
      }, 30000);

      mcpProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString();
        if (message.includes('Server running') || message.includes('port')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      mcpProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`Windows MCP agent error: ${data}`);
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      mcpProcess.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Windows MCP agent exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Start Browser Control agent
   */
  private async startBrowserControlAgent(agentId: string, config: BrowserControlAgentConfig): Promise<void> {
    const port = config.browserPort || 8222;

    // Start browser MCP server using agent-browser-protocol
    const browserProcess = spawn('npx', ['-y', 'agent-browser-protocol'], {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...config.env,
        PORT: String(port),
        HEADLESS: config.headless ? 'true' : 'false',
      },
    });

    this.processes.set(agentId, browserProcess);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Browser Control agent start timeout'));
      }, 30000);

      browserProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString();
        if (message.includes('MCP server running') || message.includes('localhost')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      browserProcess.stderr?.on('data', (data: Buffer) => {
        // Browser MCP often logs to stderr, so we check for success messages
        const message = data.toString();
        if (message.includes('Server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      browserProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      browserProcess.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Browser Control agent exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Stop an attached agent
   */
  async stopAgent(agentId: string): Promise<boolean> {
    const process = this.processes.get(agentId);
    const config = this.configs.get(agentId);
    const state = this.states.get(agentId);

    if (!state) return false;

    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(agentId);
    }

    this.updateState(agentId, {
      status: AttachedAgentStatus.STOPPED,
      lastActiveAt: Date.now(),
    });

    if (config) {
      this.emit('agent-stopped', { agentId, type: config.type });
    }

    return true;
  }

  /**
   * Execute a task on an attached agent
   */
  async executeTask(request: AttachedAgentTaskRequest): Promise<AttachedAgentTaskResponse> {
    const { agentId, taskId, instruction, timeout = 60000 } = request;
    const config = this.configs.get(agentId);
    const state = this.states.get(agentId);

    if (!config || !state) {
      return {
        taskId,
        agentId,
        success: false,
        error: `Agent not found: ${agentId}`,
        completedAt: Date.now(),
      };
    }

    if (state.status !== AttachedAgentStatus.RUNNING) {
      const started = await this.startAgent(agentId);
      if (!started) {
        return {
          taskId,
          agentId,
          success: false,
          error: `Failed to start agent: ${agentId}`,
          completedAt: Date.now(),
        };
      }
    }

    this.updateState(agentId, {
      status: AttachedAgentStatus.BUSY,
      lastTask: taskId,
    });

    if (config.type === AttachedAgentType.OPENCODE) {
      try {
        const port = config.port || 4096;
        const endpoint = config.endpoint || `http://localhost:${port}`;

        // 1. Create a session
        const sessionRes = await fetch(`${endpoint}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `AionUI Session ${taskId}` }),
        });

        if (!sessionRes.ok) {
          throw new Error(`Failed to create OpenCode session: ${sessionRes.statusText}`);
        }

        const sessionData = (await sessionRes.json()) as { id: string };
        const sessionId = sessionData.id;

        // 2. Send instruction
        const messageRes = await fetch(`${endpoint}/session/${sessionId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parts: [{ type: 'text', text: instruction }],
          }),
        });

        if (!messageRes.ok) {
          throw new Error(`Failed to send message to OpenCode: ${messageRes.statusText}`);
        }

        // 3. Optional: Get current worktree to build URL
        let worktree = '';
        try {
          const worktreeRes = await fetch(`${endpoint}/project/current`);
          if (worktreeRes.ok) {
            const worktreeData = (await worktreeRes.json()) as { worktree: string };
            worktree = worktreeData.worktree;
          }
        } catch (e) {
          // Non-critical failure
        }

        let sessionUrl = `${endpoint}/session/${sessionId}`;
        if (worktree) {
          const encodedWorktree = Buffer.from(worktree)
            .toString('base64')
            .replace(/=+$/, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
          sessionUrl = `${endpoint}/${encodedWorktree}/session/${sessionId}`;
        }

        this.updateState(agentId, {
          status: AttachedAgentStatus.RUNNING,
          lastResult: `Session created and message sent. URL: ${sessionUrl}`,
          taskCount: state.taskCount + 1,
        });

        return {
          taskId,
          agentId,
          success: true,
          result: `OpenCode task dispatched. View session at: ${sessionUrl}`,
          completedAt: Date.now(),
        };
      } catch (error) {
        this.updateState(agentId, { status: AttachedAgentStatus.RUNNING });
        return {
          taskId,
          agentId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          completedAt: Date.now(),
        };
      }
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.taskPromises.delete(taskId);
        this.updateState(agentId, { status: AttachedAgentStatus.RUNNING });
        resolve({
          taskId,
          agentId,
          success: false,
          error: 'Task execution timeout',
          completedAt: Date.now(),
        });
      }, timeout);

      this.taskPromises.set(taskId, (result) => {
        clearTimeout(timeoutId);
        this.taskPromises.delete(taskId);
        this.updateState(agentId, {
          status: AttachedAgentStatus.RUNNING,
          lastResult: result.result,
          taskCount: state.taskCount + 1,
        });
        this.emit('task-completed', { agentId, taskId, result });
        resolve(result);
      });

      this.sendTaskToAgent(agentId, taskId, instruction, request.context);
    });
  }

  /**
   * Send task to agent process
   */
  private sendTaskToAgent(
    agentId: string,
    taskId: string,
    instruction: string,
    context?: Record<string, unknown>
  ): void {
    const process = this.processes.get(agentId);
    if (process && process.stdin) {
      const message = JSON.stringify({
        type: 'task',
        taskId,
        instruction,
        context,
      });
      process.stdin.write(message + '\n');
    }
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentId: string): AttachedAgentCapabilities | undefined {
    const config = this.configs.get(agentId);
    if (!config) return undefined;

    const tools: AttachedAgentToolDefinition[] = [];

    switch (config.type) {
      case AttachedAgentType.OPENCODE:
        tools.push(
          { name: 'analyze_code', description: 'Analyze code in a repository', parameters: {}, agentType: config.type },
          { name: 'apply_patch', description: 'Apply code patches', parameters: {}, agentType: config.type },
          { name: 'create_session', description: 'Create a coding session', parameters: {}, agentType: config.type },
          {
            name: 'send_message',
            description: 'Send message to coding session',
            parameters: {},
            agentType: config.type,
          }
        );
        break;
      case AttachedAgentType.WINDOWS_MCP:
        tools.push(
          { name: 'click', description: 'Click at screen coordinates', parameters: {}, agentType: config.type },
          { name: 'type', description: 'Type text', parameters: {}, agentType: config.type },
          { name: 'screenshot', description: 'Take a screenshot', parameters: {}, agentType: config.type },
          { name: 'list_windows', description: 'List open windows', parameters: {}, agentType: config.type },
          { name: 'focus_window', description: 'Focus a window', parameters: {}, agentType: config.type }
        );
        break;
      case AttachedAgentType.BROWSER_CONTROL:
        tools.push(
          { name: 'navigate', description: 'Navigate to URL', parameters: {}, agentType: config.type },
          { name: 'click', description: 'Click element', parameters: {}, agentType: config.type },
          { name: 'type', description: 'Type into input', parameters: {}, agentType: config.type },
          { name: 'extract', description: 'Extract element text', parameters: {}, agentType: config.type },
          { name: 'screenshot', description: 'Take screenshot', parameters: {}, agentType: config.type },
          { name: 'execute_js', description: 'Execute JavaScript', parameters: {}, agentType: config.type }
        );
        break;
    }

    return { type: config.type, tools };
  }

  /**
   * Update agent state
   */
  private updateState(agentId: string, updates: Partial<AttachedAgentState>): void {
    const state = this.states.get(agentId);
    if (state) {
      this.states.set(agentId, { ...state, ...updates });
    }
  }

  /**
   * Stop all agents
   */
  async stopAll(): Promise<void> {
    const promises: Promise<boolean>[] = [];
    for (const agentId of this.processes.keys()) {
      promises.push(this.stopAgent(agentId));
    }
    await Promise.all(promises);
  }
}

// Export singleton instance
export const attachedAgentService = new AttachedAgentService();
